package com.serverstats.service;

import com.serverstats.ServerStarPlugin;
import com.serverstats.database.DatabaseManager;
import com.serverstats.model.PlayerActivityRecord;
import com.serverstats.util.JsonLogger;
import org.bukkit.entity.Player;

import java.sql.*;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public class PlayerService {
    private final DatabaseManager db;
    private final ServerStarPlugin plugin;
    private final Map<UUID, Long> sessionStartTimes = new ConcurrentHashMap<>();
    private final Map<UUID, List<PlayerActivityRecord>> recentActivities = new ConcurrentHashMap<>();

    public PlayerService(DatabaseManager db, ServerStarPlugin plugin) {
        this.db = db;
        this.plugin = plugin;
    }

    public void recordJoin(Player player) {
        UUID uuid = player.getUniqueId();
        String name = player.getName();
        long now = System.currentTimeMillis();

        sessionStartTimes.put(uuid, now);

        try (Connection conn = db.getConnection()) {
            // Insert or update player record
            String sql = "MERGE INTO players (uuid, name, first_join, last_seen) " +
                        "KEY(uuid) VALUES (?, ?, ?, ?)";
            if (db instanceof com.serverstats.database.DatabaseManager &&
                ((com.serverstats.database.DatabaseManager)db).toString().contains("postgresql")) {
                sql = "INSERT INTO players (uuid, name, first_join, last_seen) " +
                      "VALUES (?, ?, ?, ?) ON CONFLICT (uuid) DO UPDATE SET " +
                      "name = EXCLUDED.name, last_seen = EXCLUDED.last_seen";
            }

            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setString(1, uuid.toString());
                stmt.setString(2, name);
                stmt.setTimestamp(3, Timestamp.from(Instant.now()));
                stmt.setTimestamp(4, Timestamp.from(Instant.now()));
                stmt.executeUpdate();
            }

            // Update player stats
            updatePlayerStats(player);

        } catch (SQLException e) {
            JsonLogger.error("player_join_db_error", Map.of("uuid", uuid.toString()), e);
        }
    }

    public void recordQuit(Player player) {
        UUID uuid = player.getUniqueId();
        Long startTime = sessionStartTimes.remove(uuid);

        if (startTime != null) {
            long sessionDuration = System.currentTimeMillis() - startTime;
            try (Connection conn = db.getConnection()) {
                String sql = "UPDATE players SET total_playtime = total_playtime + ?, last_seen = ? WHERE uuid = ?";
                try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                    stmt.setLong(1, sessionDuration);
                    stmt.setTimestamp(2, Timestamp.from(Instant.now()));
                    stmt.setString(3, uuid.toString());
                    stmt.executeUpdate();
                }
            } catch (SQLException e) {
                JsonLogger.error("player_quit_db_error", Map.of("uuid", uuid.toString()), e);
            }
        }
    }

    public void recordActivity(PlayerActivityRecord record) {
        try (Connection conn = db.getConnection()) {
            String sql = "INSERT INTO activity_log (player_uuid, action, target, amount, " +
                        "location_world, location_x, location_y, location_z, timestamp) " +
                        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";

            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setString(1, record.getPlayerId().toString());
                stmt.setString(2, record.getAction());
                stmt.setString(3, record.getTarget());
                stmt.setInt(4, record.getAmount());
                if (record.getLocation() != null) {
                    stmt.setString(5, record.getLocation().getWorld() != null ?
                                 record.getLocation().getWorld().getName() : "unknown");
                    stmt.setInt(6, record.getLocation().getBlockX());
                    stmt.setInt(7, record.getLocation().getBlockY());
                    stmt.setInt(8, record.getLocation().getBlockZ());
                } else {
                    stmt.setString(5, null);
                    stmt.setInt(6, 0);
                    stmt.setInt(7, 0);
                    stmt.setInt(8, 0);
                }
                stmt.setTimestamp(9, Timestamp.from(record.getTimestamp()));
                stmt.executeUpdate();
            }

            // Keep recent activities in memory for quick access
            recentActivities.computeIfAbsent(record.getPlayerId(), k -> new ArrayList<>())
                           .add(0, record);
            List<PlayerActivityRecord> activities = recentActivities.get(record.getPlayerId());
            while (activities.size() > 100) { // Keep last 100 activities in memory
                activities.remove(activities.size() - 1);
            }

        } catch (SQLException e) {
            JsonLogger.error("activity_record_db_error",
                Map.of("uuid", record.getPlayerId().toString(), "action", record.getAction()), e);
        }
    }

    public void updatePlayerStats(Player player) {
        try (Connection conn = db.getConnection()) {
            String sql = "MERGE INTO player_stats (uuid, health, food, saturation, " +
                        "experience_level, experience_progress, gamemode, ping) " +
                        "KEY(uuid) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";

            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setString(1, player.getUniqueId().toString());
                stmt.setDouble(2, player.getHealth());
                stmt.setInt(3, player.getFoodLevel());
                stmt.setFloat(4, player.getSaturation());
                stmt.setInt(5, player.getLevel());
                stmt.setFloat(6, player.getExp());
                stmt.setString(7, player.getGameMode().name());
                stmt.setInt(8, player.getPing());
                stmt.executeUpdate();
            }
        } catch (SQLException e) {
            JsonLogger.error("player_stats_update_error",
                Map.of("uuid", player.getUniqueId().toString()), e);
        }
    }

    public Set<String> getPlayerRoles(UUID uuid) {
        try (Connection conn = db.getConnection()) {
            String sql = "SELECT roles FROM players WHERE uuid = ?";
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setString(1, uuid.toString());
                try (ResultSet rs = stmt.executeQuery()) {
                    if (rs.next()) {
                        String rolesStr = rs.getString("roles");
                        return rolesStr != null ?
                               new HashSet<>(Arrays.asList(rolesStr.split(","))) :
                               Set.of("Member");
                    }
                }
            }
        } catch (SQLException e) {
            JsonLogger.error("get_player_roles_error", Map.of("uuid", uuid.toString()), e);
        }
        return Set.of("Member");
    }

    public String getHighestRole(UUID uuid) {
        Set<String> roles = getPlayerRoles(uuid);
        return roles.stream()
            .max((a, b) -> {
                // Use the plugin's role hierarchy
                ServerStarPlugin plugin = (ServerStarPlugin) org.bukkit.Bukkit.getPluginManager().getPlugin("ServerStar");
                if (plugin != null) {
                    Map<String, Integer> hierarchy = plugin.getRoleHierarchy();
                    int aRank = hierarchy.getOrDefault(a, 0);
                    int bRank = hierarchy.getOrDefault(b, 0);
                    return Integer.compare(aRank, bRank);
                }
                return 0;
            })
            .orElse("Member");
    }

    public void setPlayerRoles(UUID uuid, Set<String> roles) {
        try (Connection conn = db.getConnection()) {
            String rolesStr = String.join(",", roles);
            String sql = "UPDATE players SET roles = ? WHERE uuid = ?";
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setString(1, rolesStr);
                stmt.setString(2, uuid.toString());
                stmt.executeUpdate();
            }
        } catch (SQLException e) {
            JsonLogger.error("set_player_roles_error", Map.of("uuid", uuid.toString()), e);
        }
    }

    public List<PlayerActivityRecord> getRecentActivities(UUID uuid, int limit) {
        return recentActivities.getOrDefault(uuid, new ArrayList<>())
                              .stream()
                              .limit(limit)
                              .toList();
    }

    public Map<String, Object> getPlayerFullData(UUID uuid) {
        Map<String, Object> data = new HashMap<>();
        try (Connection conn = db.getConnection()) {
            // Get player info
            String sql = "SELECT * FROM players WHERE uuid = ?";
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setString(1, uuid.toString());
                try (ResultSet rs = stmt.executeQuery()) {
                    if (rs.next()) {
                        data.put("uuid", rs.getString("uuid"));
                        data.put("name", rs.getString("name"));
                        data.put("first_join", rs.getTimestamp("first_join"));
                        data.put("last_seen", rs.getTimestamp("last_seen"));
                        data.put("total_playtime", rs.getLong("total_playtime"));
                        data.put("status", rs.getString("status"));
                        data.put("roles", rs.getString("roles"));
                    }
                }
            }

            // Get player stats
            sql = "SELECT * FROM player_stats WHERE uuid = ?";
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setString(1, uuid.toString());
                try (ResultSet rs = stmt.executeQuery()) {
                    if (rs.next()) {
                        Map<String, Object> stats = new HashMap<>();
                        stats.put("health", rs.getDouble("health"));
                        stats.put("food", rs.getInt("food"));
                        stats.put("saturation", rs.getFloat("saturation"));
                        stats.put("experience_level", rs.getInt("experience_level"));
                        stats.put("experience_progress", rs.getFloat("experience_progress"));
                        stats.put("gamemode", rs.getString("gamemode"));
                        stats.put("ping", rs.getInt("ping"));
                        data.put("stats", stats);
                    }
                }
            }

            // Get recent activities
            data.put("recent_activities", getRecentActivities(uuid, 20));

        } catch (SQLException e) {
            JsonLogger.error("get_player_full_data_error", Map.of("uuid", uuid.toString()), e);
        }
        return data;
    }
}