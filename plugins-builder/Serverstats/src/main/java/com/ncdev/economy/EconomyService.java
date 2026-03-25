package com.ncdev.economy;

import com.ncdev.NcDevPlugin;
import com.ncdev.currency.CurrencyService;
import com.ncdev.database.DatabaseManager;
import com.ncdev.util.JsonLogger;

import java.sql.*;
import java.time.Instant;
import java.util.*;

/**
 * Economy service for managing server-wide economic operations.
 */
public class EconomyService {

    private final DatabaseManager db;
    private final CurrencyService currencyService;
    private final NcDevPlugin plugin;

    public EconomyService(DatabaseManager db, CurrencyService currencyService, NcDevPlugin plugin) {
        this.db = db;
        this.currencyService = currencyService;
        this.plugin = plugin;
    }

    /**
     * Get economy statistics
     */
    public Map<String, Object> getEconomyStats() {
        Map<String, Object> stats = new HashMap<>();
        
        try (Connection conn = db.getConnection()) {
            // Total money in circulation
            String totalSql = "SELECT SUM(balance) as total, AVG(balance) as average, COUNT(*) as players FROM currency_balance";
            try (PreparedStatement stmt = conn.prepareStatement(totalSql);
                 ResultSet rs = stmt.executeQuery()) {
                if (rs.next()) {
                    stats.put("total_circulation", rs.getDouble("total"));
                    stats.put("average_balance", rs.getDouble("average"));
                    stats.put("active_players", rs.getInt("players"));
                }
            }
            
            // Today's transactions
            String todaySql = "SELECT COUNT(*) as count, SUM(amount) as volume FROM currency_transactions WHERE timestamp > ?";
            try (PreparedStatement stmt = conn.prepareStatement(todaySql)) {
                stmt.setTimestamp(1, Timestamp.from(Instant.now().minusSeconds(86400)));
                try (ResultSet rs = stmt.executeQuery()) {
                    if (rs.next()) {
                        stats.put("today_transactions", rs.getInt("count"));
                        stats.put("today_volume", rs.getDouble("volume"));
                    }
                }
            }
            
            // Top gainers today
            List<Map<String, Object>> topGainers = new ArrayList<>();
            String gainersSql = """
                SELECT player_uuid, SUM(CASE WHEN type IN ('TRANSFER_IN', 'DAILY_BONUS', 'SALE') THEN amount ELSE 0 END) as gained
                FROM currency_transactions WHERE timestamp > ?
                GROUP BY player_uuid ORDER BY gained DESC LIMIT 10
                """;
            try (PreparedStatement stmt = conn.prepareStatement(gainersSql)) {
                stmt.setTimestamp(1, Timestamp.from(Instant.now().minusSeconds(86400)));
                try (ResultSet rs = stmt.executeQuery()) {
                    while (rs.next()) {
                        Map<String, Object> player = new HashMap<>();
                        player.put("uuid", rs.getString("player_uuid"));
                        player.put("gained", rs.getDouble("gained"));
                        topGainers.add(player);
                    }
                }
            }
            stats.put("top_gainers", topGainers);
            
            // Transaction breakdown by type
            Map<String, Long> typeBreakdown = new HashMap<>();
            String breakdownSql = "SELECT type, COUNT(*) as count FROM currency_transactions WHERE timestamp > ? GROUP BY type";
            try (PreparedStatement stmt = conn.prepareStatement(breakdownSql)) {
                stmt.setTimestamp(1, Timestamp.from(Instant.now().minusSeconds(86400)));
                try (ResultSet rs = stmt.executeQuery()) {
                    while (rs.next()) {
                        typeBreakdown.put(rs.getString("type"), rs.getLong("count"));
                    }
                }
            }
            stats.put("transaction_types", typeBreakdown);
            
        } catch (SQLException e) {
            JsonLogger.error("economy_stats_failed", Map.of(), e);
        }
        
        return stats;
    }

    /**
     * Reset player economy data
     */
    public boolean resetPlayerEconomy(UUID playerUuid, UUID adminUuid) {
        try (Connection conn = db.getConnection()) {
            conn.setAutoCommit(false);
            
            try {
                // Get current balance
                double currentBalance = currencyService.getBalance(playerUuid);
                
                // Reset balance
                String resetBalanceSql = "UPDATE currency_balance SET balance = 0 WHERE player_uuid = ?";
                try (PreparedStatement stmt = conn.prepareStatement(resetBalanceSql)) {
                    stmt.setString(1, playerUuid.toString());
                    stmt.executeUpdate();
                }
                
                // Log reset transaction
                String logSql = """
                    INSERT INTO currency_transactions (player_uuid, type, amount, balance_before, balance_after, reason, timestamp)
                    VALUES (?, 'ADMIN_RESET', ?, ?, 0, 'Economy reset by admin', ?)
                    """;
                try (PreparedStatement stmt = conn.prepareStatement(logSql)) {
                    stmt.setString(1, playerUuid.toString());
                    stmt.setDouble(2, currentBalance);
                    stmt.setDouble(3, currentBalance);
                    stmt.setTimestamp(4, Timestamp.from(Instant.now()));
                    stmt.executeUpdate();
                }
                
                conn.commit();
                
                // Invalidate cache
                currencyService.invalidateCache(playerUuid);
                
                JsonLogger.info("player_economy_reset", Map.of(
                        "player", playerUuid.toString(),
                        "admin", adminUuid.toString(),
                        "previous_balance", currentBalance
                ));
                
                return true;
            } catch (SQLException e) {
                conn.rollback();
                throw e;
            }
        } catch (SQLException e) {
            JsonLogger.error("economy_reset_failed", Map.of(
                    "player", playerUuid.toString()
            ), e);
            return false;
        }
    }

    /**
     * Give money to all online players (event bonus)
     */
    public Map<String, Object> distributeToAllOnline(double amountPerPlayer, String reason) {
        int count = 0;
        double totalDistributed = 0;
        
        for (var player : plugin.getServer().getOnlinePlayers()) {
            if (currencyService.addBalance(player.getUniqueId(), amountPerPlayer)) {
                count++;
                totalDistributed += amountPerPlayer;
                
                player.sendMessage("§a§l[NCDEv] §fYou received §e" + 
                        currencyService.formatBalance(amountPerPlayer) + " §ffor: " + reason);
            }
        }
        
        JsonLogger.info("economy_distributed", Map.of(
                "amount_per_player", amountPerPlayer,
                "players_received", count,
                "total_distributed", totalDistributed,
                "reason", reason
        ));
        
        return Map.of(
                "count", count,
                "total_distributed", totalDistributed
        );
    }

    /**
     * Get wealth distribution report
     */
    public Map<String, Object> getWealthDistribution() {
        Map<String, Object> distribution = new HashMap<>();
        
        try (Connection conn = db.getConnection()) {
            // Percentile distribution
            String sql = """
                SELECT 
                    COUNT(*) FILTER (WHERE balance < 100) as poor,
                    COUNT(*) FILTER (WHERE balance >= 100 AND balance < 1000) as common,
                    COUNT(*) FILTER (WHERE balance >= 1000 AND balance < 10000) as wealthy,
                    COUNT(*) FILTER (WHERE balance >= 10000 AND balance < 100000) as rich,
                    COUNT(*) FILTER (WHERE balance >= 100000) as elite
                FROM currency_balance
                """;
            
            try (PreparedStatement stmt = conn.prepareStatement(sql);
                 ResultSet rs = stmt.executeQuery()) {
                if (rs.next()) {
                    distribution.put("poor", rs.getInt("poor"));
                    distribution.put("common", rs.getInt("common"));
                    distribution.put("wealthy", rs.getInt("wealthy"));
                    distribution.put("rich", rs.getInt("rich"));
                    distribution.put("elite", rs.getInt("elite"));
                }
            }
        } catch (SQLException e) {
            JsonLogger.error("wealth_distribution_failed", Map.of(), e);
        }
        
        return distribution;
    }
}
