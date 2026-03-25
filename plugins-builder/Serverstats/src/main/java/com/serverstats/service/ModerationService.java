package com.serverstats.service;

import com.serverstats.ServerStarPlugin;
import com.serverstats.database.DatabaseManager;
import com.serverstats.util.JsonLogger;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;

import java.sql.*;
import java.time.Instant;
import java.util.*;

public class ModerationService {
    private final DatabaseManager db;
    private final ServerStarPlugin plugin;

    public ModerationService(DatabaseManager db, ServerStarPlugin plugin) {
        this.db = db;
        this.plugin = plugin;
    }

    public boolean banPlayer(UUID targetUuid, UUID moderatorUuid, String reason, Instant expiresAt) {
        try (Connection conn = db.getConnection()) {
            String sql = "INSERT INTO bans (player_uuid, reason, banned_by, banned_at, expires_at, active) " +
                        "VALUES (?, ?, ?, ?, ?, TRUE)";

            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setString(1, targetUuid.toString());
                stmt.setString(2, reason);
                stmt.setString(3, moderatorUuid.toString());
                stmt.setTimestamp(4, Timestamp.from(Instant.now()));
                stmt.setTimestamp(5, expiresAt != null ? Timestamp.from(expiresAt) : null);
                stmt.executeUpdate();
            }

            // Update player status
            String updateSql = "UPDATE players SET status = 'banned' WHERE uuid = ?";
            try (PreparedStatement updateStmt = conn.prepareStatement(updateSql)) {
                updateStmt.setString(1, targetUuid.toString());
                updateStmt.executeUpdate();
            }

            // Kick player if online
            Player target = Bukkit.getPlayer(targetUuid);
            if (target != null) {
                String kickMessage = "You have been banned" +
                    (expiresAt != null ? " until " + expiresAt.toString() : " permanently") +
                    (reason != null ? "\nReason: " + reason : "");
                target.kickPlayer(kickMessage);
            }

            JsonLogger.info("player_banned", Map.of(
                "target_uuid", targetUuid.toString(),
                "moderator_uuid", moderatorUuid.toString(),
                "reason", reason,
                "expires_at", expiresAt != null ? expiresAt.toString() : "permanent"
            ));

            return true;
        } catch (SQLException e) {
            JsonLogger.error("ban_player_error", Map.of(
                "target_uuid", targetUuid.toString(),
                "moderator_uuid", moderatorUuid.toString()
            ), e);
            return false;
        }
    }

    public boolean unbanPlayer(UUID targetUuid, UUID moderatorUuid) {
        try (Connection conn = db.getConnection()) {
            String sql = "UPDATE bans SET active = FALSE WHERE player_uuid = ? AND active = TRUE";
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setString(1, targetUuid.toString());
                int updated = stmt.executeUpdate();
                if (updated > 0) {
                    // Update player status
                    String updateSql = "UPDATE players SET status = 'active' WHERE uuid = ?";
                    try (PreparedStatement updateStmt = conn.prepareStatement(updateSql)) {
                        updateStmt.setString(1, targetUuid.toString());
                        updateStmt.executeUpdate();
                    }

                    JsonLogger.info("player_unbanned", Map.of(
                        "target_uuid", targetUuid.toString(),
                        "moderator_uuid", moderatorUuid.toString()
                    ));

                    return true;
                }
            }
        } catch (SQLException e) {
            JsonLogger.error("unban_player_error", Map.of(
                "target_uuid", targetUuid.toString(),
                "moderator_uuid", moderatorUuid.toString()
            ), e);
        }
        return false;
    }

    public boolean kickPlayer(UUID targetUuid, UUID moderatorUuid, String reason) {
        Player target = Bukkit.getPlayer(targetUuid);
        if (target != null) {
            String kickMessage = "You have been kicked" +
                (reason != null ? "\nReason: " + reason : "");
            target.kickPlayer(kickMessage);

            JsonLogger.info("player_kicked", Map.of(
                "target_uuid", targetUuid.toString(),
                "moderator_uuid", moderatorUuid.toString(),
                "reason", reason
            ));

            return true;
        }
        return false;
    }

    public boolean freezePlayer(UUID targetUuid, UUID moderatorUuid, boolean frozen) {
        try (Connection conn = db.getConnection()) {
            String status = frozen ? "frozen" : "active";
            String sql = "UPDATE players SET status = ? WHERE uuid = ?";
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setString(1, status);
                stmt.setString(2, targetUuid.toString());
                int updated = stmt.executeUpdate();

                if (updated > 0) {
                    JsonLogger.info("player_frozen", Map.of(
                        "target_uuid", targetUuid.toString(),
                        "moderator_uuid", moderatorUuid.toString(),
                        "frozen", frozen
                    ));

                    return true;
                }
            }
        } catch (SQLException e) {
            JsonLogger.error("freeze_player_error", Map.of(
                "target_uuid", targetUuid.toString(),
                "frozen", frozen
            ), e);
        }
        return false;
    }

    public boolean jailPlayer(UUID targetUuid, UUID moderatorUuid, boolean jailed) {
        try (Connection conn = db.getConnection()) {
            String status = jailed ? "jailed" : "active";
            String sql = "UPDATE players SET status = ? WHERE uuid = ?";
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setString(1, status);
                stmt.setString(2, targetUuid.toString());
                int updated = stmt.executeUpdate();

                if (updated > 0) {
                    JsonLogger.info("player_jailed", Map.of(
                        "target_uuid", targetUuid.toString(),
                        "moderator_uuid", moderatorUuid.toString(),
                        "jailed", jailed
                    ));

                    return true;
                }
            }
        } catch (SQLException e) {
            JsonLogger.error("jail_player_error", Map.of(
                "target_uuid", targetUuid.toString(),
                "jailed", jailed
            ), e);
        }
        return false;
    }

    public boolean timeoutPlayer(UUID targetUuid, UUID moderatorUuid, int seconds, String reason) {
        // For simplicity, we'll use a temporary ban
        Instant expiresAt = Instant.now().plusSeconds(seconds);
        return banPlayer(targetUuid, moderatorUuid, reason, expiresAt);
    }

    public boolean slapPlayer(UUID targetUuid, UUID moderatorUuid, double damage) {
        Player target = Bukkit.getPlayer(targetUuid);
        if (target != null && target.isOnline()) {
            target.damage(damage);

            JsonLogger.info("player_slapped", Map.of(
                "target_uuid", targetUuid.toString(),
                "moderator_uuid", moderatorUuid.toString(),
                "damage", damage
            ));

            return true;
        }
        return false;
    }

    public boolean warnPlayer(UUID targetUuid, UUID moderatorUuid, String message) {
        Player target = Bukkit.getPlayer(targetUuid);
        if (target != null && target.isOnline()) {
            target.sendMessage("§c[WARNING] §f" + message);

            JsonLogger.info("player_warned", Map.of(
                "target_uuid", targetUuid.toString(),
                "moderator_uuid", moderatorUuid.toString(),
                "message", message
            ));

            return true;
        }
        return false;
    }

    public List<Map<String, Object>> getActiveBans() {
        List<Map<String, Object>> bans = new ArrayList<>();
        try (Connection conn = db.getConnection()) {
            String sql = "SELECT b.*, p.name as player_name FROM bans b " +
                        "JOIN players p ON b.player_uuid = p.uuid " +
                        "WHERE b.active = TRUE ORDER BY b.banned_at DESC";
            try (PreparedStatement stmt = conn.prepareStatement(sql);
                 ResultSet rs = stmt.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> ban = new HashMap<>();
                    ban.put("id", rs.getLong("id"));
                    ban.put("player_uuid", rs.getString("player_uuid"));
                    ban.put("player_name", rs.getString("player_name"));
                    ban.put("reason", rs.getString("reason"));
                    ban.put("banned_by", rs.getString("banned_by"));
                    ban.put("banned_at", rs.getTimestamp("banned_at"));
                    ban.put("expires_at", rs.getTimestamp("expires_at"));
                    bans.add(ban);
                }
            }
        } catch (SQLException e) {
            JsonLogger.error("get_active_bans_error", Map.of(), e);
        }
        return bans;
    }

    public boolean isPlayerBanned(UUID uuid) {
        try (Connection conn = db.getConnection()) {
            String sql = "SELECT COUNT(*) FROM bans WHERE player_uuid = ? AND active = TRUE " +
                        "AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)";
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setString(1, uuid.toString());
                try (ResultSet rs = stmt.executeQuery()) {
                    return rs.next() && rs.getInt(1) > 0;
                }
            }
        } catch (SQLException e) {
            JsonLogger.error("check_ban_error", Map.of("uuid", uuid.toString()), e);
        }
        return false;
    }

    public List<Map<String, Object>> getPlayerModerationHistory(UUID uuid) {
        List<Map<String, Object>> history = new ArrayList<>();
        try (Connection conn = db.getConnection()) {
            String sql = "SELECT * FROM bans WHERE player_uuid = ? ORDER BY banned_at DESC";
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setString(1, uuid.toString());
                try (ResultSet rs = stmt.executeQuery()) {
                    while (rs.next()) {
                        Map<String, Object> record = new HashMap<>();
                        record.put("id", rs.getLong("id"));
                        record.put("reason", rs.getString("reason"));
                        record.put("banned_by", rs.getString("banned_by"));
                        record.put("banned_at", rs.getTimestamp("banned_at"));
                        record.put("expires_at", rs.getTimestamp("expires_at"));
                        record.put("active", rs.getBoolean("active"));
                        history.add(record);
                    }
                }
            }
        } catch (SQLException e) {
            JsonLogger.error("get_moderation_history_error", Map.of("uuid", uuid.toString()), e);
        }
        return history;
    }
}