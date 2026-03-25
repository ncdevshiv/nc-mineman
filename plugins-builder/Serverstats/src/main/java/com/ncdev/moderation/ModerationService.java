package com.ncdev.moderation;

import com.ncdev.NcDevPlugin;
import com.ncdev.config.NcDevConfig;
import com.ncdev.database.DatabaseManager;
import com.ncdev.socketio.SocketIOManager;
import com.ncdev.util.JsonLogger;
import org.bukkit.Bukkit;
import org.bukkit.GameMode;
import org.bukkit.Location;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.block.BlockBreakEvent;
import org.bukkit.event.block.BlockPlaceEvent;
import org.bukkit.event.entity.EntityDamageByEntityEvent;
import org.bukkit.event.entity.EntityPickupItemEvent;
import org.bukkit.event.inventory.InventoryMoveItemEvent;
import org.bukkit.event.player.*;

import java.sql.*;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Advanced moderation service with jail, freeze, mute, and other tools.
 */
public class ModerationService {

    private final DatabaseManager db;
    private final NcDevPlugin plugin;
    private final NcDevConfig.Moderation config;
    
    // Active player states
    private final Map<UUID, PlayerState> playerStates = new ConcurrentHashMap<>();
    private final Map<UUID, Location> jailLocations = new ConcurrentHashMap<>();

    public ModerationService(DatabaseManager db, NcDevPlugin plugin) {
        this.db = db;
        this.plugin = plugin;
        this.config = plugin.getNcDevConfig().moderation();
    }

    // ==================== BAN SYSTEM ====================

    /**
     * Ban a player
     */
    public boolean banPlayer(UUID targetUuid, UUID moderatorUuid, String reason, Instant expiresAt) {
        if (!config.enabled()) return false;
        
        String targetName = getPlayerName(targetUuid);
        String moderatorName = getPlayerName(moderatorUuid);
        
        try (Connection conn = db.getConnection()) {
            String sql = """
                INSERT INTO bans (player_uuid, player_name, reason, banned_by, banned_by_name, banned_at, expires_at, active)
                VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)
                """;
            
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setString(1, targetUuid.toString());
                stmt.setString(2, targetName);
                stmt.setString(3, reason != null ? reason : config.ban().defaultReason());
                stmt.setString(4, moderatorUuid.toString());
                stmt.setString(5, moderatorName);
                stmt.setTimestamp(6, Timestamp.from(Instant.now()));
                stmt.setTimestamp(7, expiresAt != null ? Timestamp.from(expiresAt) : null);
                stmt.executeUpdate();
            }
            
            // Update player status
            updatePlayerStatus(targetUuid, "banned");
            
            // Kick player if online
            Player target = Bukkit.getPlayer(targetUuid);
            if (target != null) {
                String kickMessage = buildBanKickMessage(reason, expiresAt);
                target.kickPlayer(kickMessage);
            }
            
            // Log moderation action
            logModerationAction(moderatorUuid, "BAN", targetUuid, reason);
            
            // Broadcast to admins
            broadcastModerationEvent("ban", Map.of(
                    "target_uuid", targetUuid.toString(),
                    "target_name", targetName,
                    "moderator_name", moderatorName,
                    "reason", reason,
                    "expires_at", expiresAt != null ? expiresAt.toString() : "permanent"
            ));
            
            JsonLogger.info("player_banned", Map.of(
                    "target", targetName,
                    "moderator", moderatorName,
                    "reason", reason
            ));
            
            return true;
        } catch (SQLException e) {
            JsonLogger.error("ban_player_failed", Map.of(
                    "target", targetUuid.toString()
            ), e);
            return false;
        }
    }

    /**
     * Unban a player
     */
    public boolean unbanPlayer(UUID targetUuid, UUID moderatorUuid, String reason) {
        if (!config.enabled()) return false;
        
        try (Connection conn = db.getConnection()) {
            String sql = "UPDATE bans SET active = FALSE WHERE player_uuid = ? AND active = TRUE";
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setString(1, targetUuid.toString());
                int updated = stmt.executeUpdate();
                
                if (updated > 0) {
                    updatePlayerStatus(targetUuid, "active");
                    logModerationAction(moderatorUuid, "UNBAN", targetUuid, reason);
                    
                    broadcastModerationEvent("unban", Map.of(
                            "target_uuid", targetUuid.toString(),
                            "moderator_name", getPlayerName(moderatorUuid)
                    ));
                    
                    return true;
                }
            }
        } catch (SQLException e) {
            JsonLogger.error("unban_player_failed", Map.of(
                    "target", targetUuid.toString()
            ), e);
        }
        return false;
    }

    /**
     * Check if player is banned
     */
    public boolean isPlayerBanned(UUID uuid) {
        try (Connection conn = db.getConnection()) {
            String sql = """
                SELECT COUNT(*) FROM bans 
                WHERE player_uuid = ? AND active = TRUE 
                AND (expires_at IS NULL OR expires_at > ?)
                """;
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setString(1, uuid.toString());
                stmt.setTimestamp(2, Timestamp.from(Instant.now()));
                
                try (ResultSet rs = stmt.executeQuery()) {
                    return rs.next() && rs.getInt(1) > 0;
                }
            }
        } catch (SQLException e) {
            return false;
        }
    }

    /**
     * Get active bans
     */
    public List<Map<String, Object>> getActiveBans() {
        List<Map<String, Object>> bans = new ArrayList<>();
        
        try (Connection conn = db.getConnection()) {
            String sql = """
                SELECT b.*, p.name as player_name FROM bans b
                LEFT JOIN players p ON b.player_uuid = p.uuid
                WHERE b.active = TRUE AND (b.expires_at IS NULL OR b.expires_at > ?)
                ORDER BY b.banned_at DESC
                """;
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setTimestamp(1, Timestamp.from(Instant.now()));
                
                try (ResultSet rs = stmt.executeQuery()) {
                    while (rs.next()) {
                        bans.add(parseBanRecord(rs));
                    }
                }
            }
        } catch (SQLException e) {
            JsonLogger.error("get_active_bans_failed", Map.of(), e);
        }
        
        return bans;
    }

    // ==================== MUTE SYSTEM ====================

    /**
     * Mute a player
     */
    public boolean mutePlayer(UUID targetUuid, UUID moderatorUuid, String reason, Instant expiresAt) {
        if (!config.enabled()) return false;
        
        try (Connection conn = db.getConnection()) {
            // Deactivate existing mutes
            String deactivateSql = "UPDATE mutes SET active = FALSE WHERE player_uuid = ? AND active = TRUE";
            try (PreparedStatement stmt = conn.prepareStatement(deactivateSql)) {
                stmt.setString(1, targetUuid.toString());
                stmt.executeUpdate();
            }
            
            // Create new mute
            String sql = """
                INSERT INTO mutes (player_uuid, player_name, reason, muted_by, muted_by_name, muted_at, expires_at, active)
                VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)
                """;
            
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setString(1, targetUuid.toString());
                stmt.setString(2, getPlayerName(targetUuid));
                stmt.setString(3, reason);
                stmt.setString(4, moderatorUuid.toString());
                stmt.setString(5, getPlayerName(moderatorUuid));
                stmt.setTimestamp(6, Timestamp.from(Instant.now()));
                stmt.setTimestamp(7, expiresAt != null ? Timestamp.from(expiresAt) : null);
                stmt.executeUpdate();
            }
            
            logModerationAction(moderatorUuid, "MUTE", targetUuid, reason);
            
            JsonLogger.info("player_muted", Map.of(
                    "target", targetUuid.toString(),
                    "moderator", moderatorUuid.toString()
            ));
            
            return true;
        } catch (SQLException e) {
            JsonLogger.error("mute_player_failed", Map.of("target", targetUuid.toString()), e);
            return false;
        }
    }

    /**
     * Unmute a player
     */
    public boolean unmutePlayer(UUID targetUuid, UUID moderatorUuid) {
        if (!config.enabled()) return false;
        
        try (Connection conn = db.getConnection()) {
            String sql = "UPDATE mutes SET active = FALSE WHERE player_uuid = ? AND active = TRUE";
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setString(1, targetUuid.toString());
                stmt.executeUpdate();
            }
            
            logModerationAction(moderatorUuid, "UNMUTE", targetUuid, null);
            return true;
        } catch (SQLException e) {
            return false;
        }
    }

    /**
     * Check if player is muted
     */
    public boolean isPlayerMuted(UUID uuid) {
        try (Connection conn = db.getConnection()) {
            String sql = """
                SELECT COUNT(*) FROM mutes 
                WHERE player_uuid = ? AND active = TRUE 
                AND (expires_at IS NULL OR expires_at > ?)
                """;
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setString(1, uuid.toString());
                stmt.setTimestamp(2, Timestamp.from(Instant.now()));
                
                try (ResultSet rs = stmt.executeQuery()) {
                    return rs.next() && rs.getInt(1) > 0;
                }
            }
        } catch (SQLException e) {
            return false;
        }
    }

    // ==================== FREEZE SYSTEM ====================

    /**
     * Freeze a player
     */
    public boolean freezePlayer(UUID targetUuid, UUID moderatorUuid, boolean freeze) {
        if (!config.enabled()) return false;
        
        PlayerState state = playerStates.computeIfAbsent(targetUuid, k -> new PlayerState());
        
        if (freeze) {
            Player player = Bukkit.getPlayer(targetUuid);
            if (player != null) {
                state.frozen(true);
                state.frozenLocation(player.getLocation());
                
                player.sendMessage("§b§l[NCDEv] §fYou have been frozen by a staff member.");
                
                if (config.freeze().notifyOnFreeze()) {
                    broadcastModerationEvent("freeze", Map.of(
                            "target", getPlayerName(targetUuid),
                            "moderator", getPlayerName(moderatorUuid)
                    ));
                }
            }
        } else {
            state.frozen(false);
            state.frozenLocation(null);
            
            Player player = Bukkit.getPlayer(targetUuid);
            if (player != null) {
                player.sendMessage("§a§l[NCDEv] §fYou have been unfrozen.");
            }
        }
        
        logModerationAction(moderatorUuid, freeze ? "FREEZE" : "UNFREEZE", targetUuid, null);
        
        return true;
    }

    /**
     * Check if player is frozen
     */
    public boolean isPlayerFrozen(UUID uuid) {
        PlayerState state = playerStates.get(uuid);
        return state != null && state.frozen();
    }

    // ==================== JAIL SYSTEM ====================

    /**
     * Jail a player
     */
    public boolean jailPlayer(UUID targetUuid, UUID moderatorUuid, Location jailLocation, String reason) {
        if (!config.enabled() || !config.jail().enabled()) return false;
        
        PlayerState state = playerStates.computeIfAbsent(targetUuid, k -> new PlayerState());
        state.jailed(true);
        
        if (jailLocation == null) {
            // Use default jail location from config
            String defaultLocation = config.jail().defaultLocation();
            jailLocation = parseLocation(defaultLocation);
        }
        
        state.jailLocation(jailLocation);
        state.jailReason(reason);
        
        Player player = Bukkit.getPlayer(targetUuid);
        if (player != null) {
            // Save original location
            state.originalLocation(player.getLocation());
            
            // Teleport to jail
            player.teleportAsync(jailLocation);
            player.sendMessage("§c§l[NCDEv] §fYou have been jailed. Reason: " + reason);
        }
        
        logModerationAction(moderatorUuid, "JAIL", targetUuid, reason);
        
        broadcastModerationEvent("jail", Map.of(
                "target", getPlayerName(targetUuid),
                "moderator", getPlayerName(moderatorUuid),
                "reason", reason
        ));
        
        return true;
    }

    /**
     * Release player from jail
     */
    public boolean unjailPlayer(UUID targetUuid, UUID moderatorUuid) {
        if (!config.enabled()) return false;
        
        PlayerState state = playerStates.get(targetUuid);
        if (state == null || !state.jailed()) return false;
        
        state.jailed(false);
        
        Player player = Bukkit.getPlayer(targetUuid);
        if (player != null) {
            // Teleport back to original location or spawn
            Location returnLoc = state.originalLocation();
            if (returnLoc != null) {
                player.teleportAsync(returnLoc);
            } else {
                player.teleportAsync(player.getWorld().getSpawnLocation());
            }
            
            player.sendMessage("§a§l[NCDEv] §fYou have been released from jail.");
        }
        
        logModerationAction(moderatorUuid, "UNJAIL", targetUuid, null);
        
        broadcastModerationEvent("unjail", Map.of(
                "target", getPlayerName(targetUuid),
                "moderator", getPlayerName(moderatorUuid)
        ));
        
        return true;
    }

    /**
     * Check if player is jailed
     */
    public boolean isPlayerJailed(UUID uuid) {
        PlayerState state = playerStates.get(uuid);
        return state != null && state.jailed();
    }

    // ==================== WARN SYSTEM ====================

    /**
     * Warn a player
     */
    public boolean warnPlayer(UUID targetUuid, UUID moderatorUuid, String message) {
        if (!config.enabled()) return false;
        
        try (Connection conn = db.getConnection()) {
            String sql = """
                INSERT INTO warnings (player_uuid, player_name, reason, warned_by, warned_by_name, warned_at, active)
                VALUES (?, ?, ?, ?, ?, ?, TRUE)
                """;
            
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setString(1, targetUuid.toString());
                stmt.setString(2, getPlayerName(targetUuid));
                stmt.setString(3, message);
                stmt.setString(4, moderatorUuid.toString());
                stmt.setString(5, getPlayerName(moderatorUuid));
                stmt.setTimestamp(6, Timestamp.from(Instant.now()));
                stmt.executeUpdate();
            }
            
            // Send warning message to player
            Player player = Bukkit.getPlayer(targetUuid);
            if (player != null) {
                player.sendMessage("§c§l[WARNING] §f" + message);
            }
            
            // Check for auto actions
            int warnCount = getActiveWarningCount(targetUuid);
            checkAutoActions(targetUuid, warnCount);
            
            logModerationAction(moderatorUuid, "WARN", targetUuid, message);
            
            return true;
        } catch (SQLException e) {
            JsonLogger.error("warn_player_failed", Map.of("target", targetUuid.toString()), e);
            return false;
        }
    }

    /**
     * Get active warning count
     */
    public int getActiveWarningCount(UUID targetUuid) {
        try (Connection conn = db.getConnection()) {
            String sql = "SELECT COUNT(*) FROM warnings WHERE player_uuid = ? AND active = TRUE";
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setString(1, targetUuid.toString());
                
                try (ResultSet rs = stmt.executeQuery()) {
                    return rs.next() ? rs.getInt(1) : 0;
                }
            }
        } catch (SQLException e) {
            return 0;
        }
    }

    /**
     * Check and execute auto actions based on warnings
     */
    private void checkAutoActions(UUID targetUuid, int warnCount) {
        for (var autoAction : config.warn().autoActions()) {
            if (warnCount == autoAction.warns()) {
                switch (autoAction.action()) {
                    case "mute" -> mutePlayer(targetUuid, Bukkit.getConsoleSender().getUniqueId(),
                            autoAction.reason(), Instant.now().plusSeconds(autoAction.durationMinutes() * 60L));
                    case "kick" -> {
                        Player player = Bukkit.getPlayer(targetUuid);
                        if (player != null) {
                            player.kickPlayer("§cKicked: " + autoAction.reason());
                        }
                    }
                    case "ban" -> banPlayer(targetUuid, Bukkit.getConsoleSender().getUniqueId(),
                            autoAction.reason(), null);
                }
            }
        }
    }

    // ==================== FUN MODERATION COMMANDS ====================

    /**
     * Slap a player
     */
    public boolean slapPlayer(UUID targetUuid, UUID moderatorUuid, double damage) {
        if (!config.enabled()) return false;
        
        Player player = Bukkit.getPlayer(targetUuid);
        if (player == null) return false;
        
        player.damage(damage);
        
        // Apply knockback
        Location loc = player.getLocation();
        loc.setY(loc.getY() + 1);
        player.setVelocity(player.getVelocity().multiply(3));
        
        player.sendMessage("§e§l[SLAP] §fYou were slapped by " + getPlayerName(moderatorUuid));
        
        broadcastModerationEvent("slap", Map.of(
                "target", getPlayerName(targetUuid),
                "moderator", getPlayerName(moderatorUuid),
                "damage", damage
        ));
        
        return true;
    }

    /**
     * Heal a player
     */
    public boolean healPlayer(UUID targetUuid, UUID moderatorUuid) {
        Player player = Bukkit.getPlayer(targetUuid);
        if (player == null) return false;
        
        player.setHealth(player.getMaxHealth());
        player.setFoodLevel(20);
        player.setSaturation(5);
        player.sendMessage("§a§l[HEAL] §fYou were healed by " + getPlayerName(moderatorUuid));
        
        return true;
    }

    /**
     * Feed a player
     */
    public boolean feedPlayer(UUID targetUuid, UUID moderatorUuid) {
        Player player = Bukkit.getPlayer(targetUuid);
        if (player == null) return false;
        
        player.setFoodLevel(20);
        player.setSaturation(20);
        player.sendMessage("§a§l[FEED] §fYou were fed by " + getPlayerName(moderatorUuid));
        
        return true;
    }

    /**
     * Strike player with lightning
     */
    public boolean lightningStrike(UUID targetUuid, UUID moderatorUuid) {
        Player player = Bukkit.getPlayer(targetUuid);
        if (player == null) return false;
        
        player.getWorld().strikeLightning(player.getLocation());
        
        return true;
    }

    // ==================== EVENT LISTENER ====================

    /**
     * Create event listener for moderation
     */
    public Listener createEventListener() {
        return new ModerationEventListener();
    }

    private class ModerationEventListener implements Listener {
        
        @EventHandler(priority = EventPriority.LOWEST)
        public void onPlayerMove(PlayerMoveEvent event) {
            UUID uuid = event.getPlayer().getUniqueId();
            PlayerState state = playerStates.get(uuid);
            
            if (state == null) return;
            
            if (state.jailed() && config.jail().allowMovement()) {
                event.setTo(state.jailLocation());
                return;
            }
            
            if (state.frozen() && !config.freeze().allowMovement()) {
                if (event.getFrom().getBlockX() != event.getTo().getBlockX() ||
                    event.getFrom().getBlockY() != event.getTo().getBlockY() ||
                    event.getFrom().getBlockZ() != event.getTo().getBlockZ()) {
                    event.setTo(event.getFrom());
                }
            }
        }

        @EventHandler(priority = EventPriority.LOWEST)
        public void onPlayerChat(AsyncPlayerChatEvent event) {
            UUID uuid = event.getPlayer().getUniqueId();
            
            if (isPlayerMuted(uuid)) {
                event.setCancelled(true);
                event.getPlayer().sendMessage("§c§l[MUTED] §fYou cannot chat while muted.");
                return;
            }
            
            if (isPlayerJailed(uuid) && !config.jail().allowChat()) {
                event.setCancelled(true);
                event.getPlayer().sendMessage("§c§l[JAILED] §fYou cannot chat while jailed.");
            }
        }

        @EventHandler(priority = EventPriority.LOWEST)
        public void onBlockBreak(BlockBreakEvent event) {
            UUID uuid = event.getPlayer().getUniqueId();
            
            if (isPlayerFrozen(uuid)) {
                event.setCancelled(true);
                event.getPlayer().sendMessage("§b§l[FROZEN] §fYou cannot break blocks while frozen.");
                return;
            }
            
            if (isPlayerJailed(uuid) && !config.jail().allowCommands()) {
                event.setCancelled(true);
            }
        }

        @EventHandler(priority = EventPriority.LOWEST)
        public void onBlockPlace(BlockPlaceEvent event) {
            UUID uuid = event.getPlayer().getUniqueId();
            
            if (isPlayerFrozen(uuid)) {
                event.setCancelled(true);
                event.getPlayer().sendMessage("§b§l[FROZEN] §fYou cannot place blocks while frozen.");
                return;
            }
            
            if (isPlayerJailed(uuid) && !config.jail().allowCommands()) {
                event.setCancelled(true);
            }
        }

        @EventHandler(priority = EventPriority.LOWEST)
        public void onCommand(PlayerCommandPreprocessEvent event) {
            UUID uuid = event.getPlayer().getUniqueId();
            
            if (isPlayerJailed(uuid) && !config.jail().allowCommands()) {
                String command = event.getMessage().toLowerCase();
                // Allow basic commands
                if (!command.startsWith("/msg") && !command.startsWith("/tell") && 
                    !command.startsWith("/r ")) {
                    event.setCancelled(true);
                    event.getPlayer().sendMessage("§c§l[JAILED] §fYou cannot use commands while jailed.");
                }
            }
        }
    }

    // ==================== HELPER METHODS ====================

    private void updatePlayerStatus(UUID uuid, String status) {
        try (Connection conn = db.getConnection()) {
            String sql = "UPDATE players SET status = ? WHERE uuid = ?";
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setString(1, status);
                stmt.setString(2, uuid.toString());
                stmt.executeUpdate();
            }
        } catch (SQLException e) {
            JsonLogger.error("update_player_status_failed", Map.of("uuid", uuid.toString()), e);
        }
    }

    private String getPlayerName(UUID uuid) {
        Player player = Bukkit.getPlayer(uuid);
        if (player != null) return player.getName();
        
        try (Connection conn = db.getConnection()) {
            String sql = "SELECT name FROM players WHERE uuid = ?";
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setString(1, uuid.toString());
                
                try (ResultSet rs = stmt.executeQuery()) {
                    if (rs.next()) {
                        return rs.getString("name");
                    }
                }
            }
        } catch (SQLException e) {
            // Ignore
        }
        
        return uuid.toString();
    }

    private void logModerationAction(UUID moderator, String action, UUID target, String reason) {
        if (!config.logging().enabled() || !config.logging().logModActions()) return;
        
        // Already logged in database, just broadcast
        if (config.logging().logToDiscord() && config.logging().discordWebhook() != null) {
            // Would send to Discord webhook
        }
    }

    private void broadcastModerationEvent(String event, Map<String, Object> data) {
        SocketIOManager socketIO = plugin.getSocketIOManager();
        if (socketIO != null) {
            socketIO.broadcastModerationEvent(event, data);
        }
    }

    private String buildBanKickMessage(String reason, Instant expiresAt) {
        StringBuilder msg = new StringBuilder();
        msg.append("§c§lYou have been banned§f\n\n");
        
        if (reason != null) {
            msg.append("§fReason: §c").append(reason).append("\n\n");
        }
        
        if (expiresAt != null) {
            msg.append("§fExpires: §e").append(expiresAt.toString()).append("\n");
        } else {
            msg.append("§fThis ban is §cPERMANENT\n");
        }
        
        msg.append("\n§7Appeal at: §fhttps://appeals.ncdev.io");
        
        return msg.toString();
    }

    private Location parseLocation(String loc) {
        if (loc == null || loc.isEmpty()) {
            return Bukkit.getWorlds().get(0).getSpawnLocation();
        }
        
        String[] parts = loc.split(",");
        if (parts.length >= 4) {
            String worldName = parts[0];
            int x = Integer.parseInt(parts[1]);
            int y = Integer.parseInt(parts[2]);
            int z = Integer.parseInt(parts[3]);
            
            return new Location(Bukkit.getWorld(worldName), x, y, z);
        }
        
        return Bukkit.getWorlds().get(0).getSpawnLocation();
    }

    private Map<String, Object> parseBanRecord(ResultSet rs) throws SQLException {
        Map<String, Object> ban = new HashMap<>();
        ban.put("id", rs.getLong("id"));
        ban.put("player_uuid", rs.getString("player_uuid"));
        ban.put("player_name", rs.getString("player_name"));
        ban.put("reason", rs.getString("reason"));
        ban.put("banned_by", rs.getString("banned_by"));
        ban.put("banned_by_name", rs.getString("banned_by_name"));
        ban.put("banned_at", rs.getTimestamp("banned_at").toInstant().toString());
        ban.put("expires_at", rs.getTimestamp("expires_at") != null ? 
                rs.getTimestamp("expires_at").toInstant().toString() : null);
        ban.put("active", rs.getBoolean("active"));
        return ban;
    }

    // ==================== PLAYER STATE CLASS ====================

    public class PlayerState {
        private boolean frozen = false;
        private Location frozenLocation = null;
        private boolean jailed = false;
        private Location jailLocation = null;
        private Location originalLocation = null;
        private String jailReason = null;
        private int warnings = 0;
        
        public boolean frozen() { return frozen; }
        public void frozen(boolean v) { this.frozen = v; }
        public Location frozenLocation() { return frozenLocation; }
        public void frozenLocation(Location l) { this.frozenLocation = l; }
        
        public boolean jailed() { return jailed; }
        public void jailed(boolean v) { this.jailed = v; }
        public Location jailLocation() { return jailLocation; }
        public void jailLocation(Location l) { this.jailLocation = l; }
        public Location originalLocation() { return originalLocation; }
        public void originalLocation(Location l) { this.originalLocation = l; }
        public String jailReason() { return jailReason; }
        public void jailReason(String r) { this.jailReason = r; }
        
        public int warnings() { return warnings; }
        public void warnings(int w) { this.warnings = w; }
    }
}
