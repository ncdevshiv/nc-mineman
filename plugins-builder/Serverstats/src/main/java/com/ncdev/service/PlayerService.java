package com.ncdev.service;

import com.ncdev.NcDevPlugin;
import com.ncdev.database.DatabaseManager;
import com.ncdev.util.JsonLogger;
import org.bukkit.entity.Player;

import java.sql.*;
import java.time.Instant;
import java.util.*;

/**
 * Player service for managing player data and tracking.
 */
public class PlayerService {

    private final DatabaseManager db;
    private final NcDevPlugin plugin;
    private final Map<UUID, Long> sessionStartTimes = new java.util.concurrent.ConcurrentHashMap<>();

    public PlayerService(DatabaseManager db, NcDevPlugin plugin) {
        this.db = db;
        this.plugin = plugin;
    }

    public void recordJoin(Player player) {
        UUID uuid = player.getUniqueId();
        sessionStartTimes.put(uuid, System.currentTimeMillis());

        try (Connection conn = db.getConnection()) {
            String sql = """
                MERGE INTO players (uuid, name, first_join, last_seen, last_interaction)
                KEY(uuid) VALUES (?, ?, ?, ?, ?)
                """;
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setString(1, uuid.toString());
                stmt.setString(2, player.getName());
                stmt.setTimestamp(3, Timestamp.from(Instant.now()));
                stmt.setTimestamp(4, Timestamp.from(Instant.now()));
                stmt.setTimestamp(5, Timestamp.from(Instant.now()));
                stmt.executeUpdate();
            }
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
                String sql = "UPDATE players SET total_playtime = total_playtime + ?, last_seen = ?, last_interaction = ? WHERE uuid = ?";
                try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                    stmt.setLong(1, sessionDuration);
                    stmt.setTimestamp(2, Timestamp.from(Instant.now()));
                    stmt.setTimestamp(3, Timestamp.from(Instant.now()));
                    stmt.setString(4, uuid.toString());
                    stmt.executeUpdate();
                }
            } catch (SQLException e) {
                JsonLogger.error("player_quit_db_error", Map.of("uuid", uuid.toString()), e);
            }
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
                        return rolesStr != null && !rolesStr.isEmpty() ?
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

    public Map<String, Object> getPlayerFullData(UUID uuid) {
        Map<String, Object> data = new HashMap<>();
        
        try (Connection conn = db.getConnection()) {
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
            
            // Get recent activities from cache
            data.put("recent_activities", plugin.getPlayerCache().getRecentActivities(uuid, 20));
            
        } catch (SQLException e) {
            JsonLogger.error("get_player_full_data_error", Map.of("uuid", uuid.toString()), e);
        }
        return data;
    }
}
