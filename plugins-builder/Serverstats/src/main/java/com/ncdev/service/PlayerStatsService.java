package com.ncdev.service;

import com.ncdev.NcDevPlugin;
import com.ncdev.database.DatabaseManager;
import com.ncdev.util.JsonLogger;
import org.bukkit.entity.Player;

import java.sql.*;
import java.time.Instant;
import java.util.*;

/**
 * Player statistics tracking service.
 */
public class PlayerStatsService {

    private final DatabaseManager db;
    private final NcDevPlugin plugin;

    public PlayerStatsService(DatabaseManager db, NcDevPlugin plugin) {
        this.db = db;
        this.plugin = plugin;
    }

    public void updatePlayerStats(Player player) {
        try (Connection conn = db.getConnection()) {
            String sql = """
                MERGE INTO player_stats (uuid, health, food, saturation, experience_level,
                    experience_progress, gamemode, ping, last_updated)
                KEY(uuid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """;
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setString(1, player.getUniqueId().toString());
                stmt.setDouble(2, player.getHealth());
                stmt.setInt(3, player.getFoodLevel());
                stmt.setFloat(4, player.getSaturation());
                stmt.setInt(5, player.getLevel());
                stmt.setFloat(6, player.getExp());
                stmt.setString(7, player.getGameMode().name());
                stmt.setInt(8, player.getPing());
                stmt.setTimestamp(9, Timestamp.from(Instant.now()));
                stmt.executeUpdate();
            }
        } catch (SQLException e) {
            JsonLogger.error("player_stats_update_error", Map.of(
                    "uuid", player.getUniqueId().toString()
            ), e);
        }
    }

    public Map<String, Object> getPlayerStats(UUID uuid) {
        Map<String, Object> stats = new HashMap<>();
        
        try (Connection conn = db.getConnection()) {
            String sql = "SELECT * FROM player_stats WHERE uuid = ?";
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setString(1, uuid.toString());
                try (ResultSet rs = stmt.executeQuery()) {
                    if (rs.next()) {
                        stats.put("health", rs.getDouble("health"));
                        stats.put("food", rs.getInt("food"));
                        stats.put("saturation", rs.getFloat("saturation"));
                        stats.put("experience_level", rs.getInt("experience_level"));
                        stats.put("experience_progress", rs.getFloat("experience_progress"));
                        stats.put("gamemode", rs.getString("gamemode"));
                        stats.put("ping", rs.getInt("ping"));
                        stats.put("blocks_mined", rs.getLong("blocks_mined"));
                        stats.put("blocks_placed", rs.getLong("blocks_placed"));
                        stats.put("deaths", rs.getInt("deaths"));
                        stats.put("kills", rs.getInt("kills"));
                    }
                }
            }
        } catch (SQLException e) {
            JsonLogger.error("get_player_stats_error", Map.of("uuid", uuid.toString()), e);
        }
        return stats;
    }

    public void incrementStat(UUID uuid, String stat, int amount) {
        try (Connection conn = db.getConnection()) {
            String sql = String.format("UPDATE player_stats SET %s = %s + ? WHERE uuid = ?", stat, stat);
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setInt(1, amount);
                stmt.setString(2, uuid.toString());
                stmt.executeUpdate();
            }
        } catch (SQLException e) {
            JsonLogger.error("increment_stat_error", Map.of(
                    "uuid", uuid.toString(),
                    "stat", stat
            ), e);
        }
    }
}
