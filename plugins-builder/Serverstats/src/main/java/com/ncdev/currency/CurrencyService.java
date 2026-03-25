package com.ncdev.currency;

import com.ncdev.NcDevPlugin;
import com.ncdev.config.NcDevConfig;
import com.ncdev.database.DatabaseManager;
import com.ncdev.util.JsonLogger;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.*;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Currency service for managing player balances and transactions.
 */
public class CurrencyService {

    private final DatabaseManager db;
    private final NcDevPlugin plugin;
    private final NcDevConfig.Currency config;
    
    // In-memory balance cache
    private final Map<UUID, Double> balanceCache = new ConcurrentHashMap<>();
    private final Map<UUID, Long> cacheTimestamps = new ConcurrentHashMap<>();
    private static final long CACHE_TTL_MS = 30000; // 30 seconds

    public CurrencyService(DatabaseManager db, NcDevPlugin plugin) {
        this.db = db;
        this.plugin = plugin;
        this.config = plugin.getNcDevConfig().currency();
    }

    /**
     * Initialize player balance on first join
     */
    public void initializePlayerBalance(UUID playerUuid) {
        if (!config.enabled()) return;
        
        try (Connection conn = db.getConnection()) {
            String sql = """
                INSERT INTO currency_balance (player_uuid, balance, total_earned, total_spent)
                VALUES (?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE balance = balance
                """;
            
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setString(1, playerUuid.toString());
                stmt.setDouble(2, config.startingBalance());
                stmt.setDouble(3, config.startingBalance());
                stmt.setDouble(4, 0.0);
                stmt.executeUpdate();
            }
            
            // Update cache
            balanceCache.put(playerUuid, config.startingBalance());
            
            JsonLogger.info("currency_initialized", Map.of(
                    "player_uuid", playerUuid.toString(),
                    "starting_balance", config.startingBalance()
            ));
            
        } catch (SQLException e) {
            JsonLogger.error("currency_init_failed", Map.of(
                    "player_uuid", playerUuid.toString()
            ), e);
        }
    }

    /**
     * Get player balance
     */
    public double getBalance(UUID playerUuid) {
        // Check cache first
        Long cacheTime = cacheTimestamps.get(playerUuid);
        if (cacheTime != null && System.currentTimeMillis() - cacheTime < CACHE_TTL_MS) {
            Double cached = balanceCache.get(playerUuid);
            if (cached != null) return cached;
        }
        
        try (Connection conn = db.getConnection()) {
            String sql = "SELECT balance FROM currency_balance WHERE player_uuid = ?";
            
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setString(1, playerUuid.toString());
                
                try (ResultSet rs = stmt.executeQuery()) {
                    if (rs.next()) {
                        double balance = rs.getDouble("balance");
                        balanceCache.put(playerUuid, balance);
                        cacheTimestamps.put(playerUuid, System.currentTimeMillis());
                        return balance;
                    }
                }
            }
        } catch (SQLException e) {
            JsonLogger.error("get_balance_failed", Map.of(
                    "player_uuid", playerUuid.toString()
            ), e);
        }
        
        return 0.0;
    }

    /**
     * Set player balance (admin only)
     */
    public boolean setBalance(UUID playerUuid, double amount) {
        if (!config.enabled()) return false;
        if (amount < 0 && !config.allowNegative()) return false;
        
        amount = roundBalance(amount);
        
        try (Connection conn = db.getConnection()) {
            String sql = "UPDATE currency_balance SET balance = ?, last_updated = ? WHERE player_uuid = ?";
            
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setDouble(1, amount);
                stmt.setTimestamp(2, Timestamp.from(Instant.now()));
                stmt.setString(3, playerUuid.toString());
                
                int updated = stmt.executeUpdate();
                
                if (updated > 0) {
                    balanceCache.put(playerUuid, amount);
                    cacheTimestamps.put(playerUuid, System.currentTimeMillis());
                    
                    JsonLogger.info("balance_set", Map.of(
                            "player_uuid", playerUuid.toString(),
                            "new_balance", amount
                    ));
                    
                    return true;
                }
            }
        } catch (SQLException e) {
            JsonLogger.error("set_balance_failed", Map.of(
                    "player_uuid", playerUuid.toString(),
                    "amount", amount
            ), e);
        }
        
        return false;
    }

    /**
     * Add to player balance
     */
    public boolean addBalance(UUID playerUuid, double amount) {
        double current = getBalance(playerUuid);
        return setBalance(playerUuid, current + amount);
    }

    /**
     * Remove from player balance
     */
    public boolean removeBalance(UUID playerUuid, double amount) {
        double current = getBalance(playerUuid);
        
        if (current < amount) {
            return false; // Insufficient funds
        }
        
        return setBalance(playerUuid, current - amount);
    }

    /**
     * Check if player has sufficient balance
     */
    public boolean hasBalance(UUID playerUuid, double amount) {
        return getBalance(playerUuid) >= amount;
    }

    /**
     * Transfer balance between players
     */
    public TransferResult transfer(UUID fromUuid, UUID toUuid, double amount, String reason) {
        if (!config.enabled()) {
            return new TransferResult(false, "Currency system disabled");
        }
        
        if (amount < config.minTransaction()) {
            return new TransferResult(false, "Amount below minimum transaction");
        }
        
        if (amount > config.transaction().maxSingle()) {
            return new TransferResult(false, "Amount exceeds maximum transaction");
        }
        
        double fromBalance = getBalance(fromUuid);
        
        if (fromBalance < amount) {
            return new TransferResult(false, "Insufficient funds");
        }
        
        if (!config.allowNegative() && fromBalance - amount < 0) {
            return new TransferResult(false, "Transaction would result in negative balance");
        }
        
        // Perform transfer
        try (Connection conn = db.getConnection()) {
            conn.setAutoCommit(false);
            
            try {
                // Deduct from sender
                String deductSql = "UPDATE currency_balance SET balance = balance - ?, total_spent = total_spent + ?, last_updated = ? WHERE player_uuid = ? AND balance >= ?";
                try (PreparedStatement stmt = conn.prepareStatement(deductSql)) {
                    stmt.setDouble(1, amount);
                    stmt.setDouble(2, amount);
                    stmt.setTimestamp(3, Timestamp.from(Instant.now()));
                    stmt.setString(4, fromUuid.toString());
                    stmt.setDouble(5, amount);
                    
                    if (stmt.executeUpdate() == 0) {
                        conn.rollback();
                        return new TransferResult(false, "Insufficient funds or player not found");
                    }
                }
                
                // Add to receiver
                String addSql = "UPDATE currency_balance SET balance = balance + ?, total_earned = total_earned + ?, last_updated = ? WHERE player_uuid = ?";
                try (PreparedStatement stmt = conn.prepareStatement(addSql)) {
                    stmt.setDouble(1, amount);
                    stmt.setDouble(2, amount);
                    stmt.setTimestamp(3, Timestamp.from(Instant.now()));
                    stmt.setString(4, toUuid.toString());
                    
                    stmt.executeUpdate();
                }
                
                // Log transaction
                logTransaction(conn, fromUuid, "TRANSFER_OUT", amount, toUuid, reason);
                logTransaction(conn, toUuid, "TRANSFER_IN", amount, fromUuid, reason);
                
                conn.commit();
                
                // Update cache
                balanceCache.put(fromUuid, fromBalance - amount);
                balanceCache.put(toUuid, getBalance(toUuid) + amount);
                
                JsonLogger.info("transfer_completed", Map.of(
                        "from", fromUuid.toString(),
                        "to", toUuid.toString(),
                        "amount", amount,
                        "reason", reason != null ? reason : "none"
                ));
                
                return new TransferResult(true, "Transfer successful");
                
            } catch (SQLException e) {
                conn.rollback();
                throw e;
            }
        } catch (SQLException e) {
            JsonLogger.error("transfer_failed", Map.of(
                    "from", fromUuid.toString(),
                    "to", toUuid.toString(),
                    "amount", amount
            ), e);
            return new TransferResult(false, "Database error");
        }
    }

    /**
     * Give daily bonus to player
     */
    public DailyBonusResult giveDailyBonus(UUID playerUuid) {
        if (!config.enabled() || !config.dailyBonus().enabled()) {
            return new DailyBonusResult(false, 0, 0, "Daily bonus disabled");
        }
        
        try (Connection conn = db.getConnection()) {
            // Get current streak
            String getSql = "SELECT last_daily_bonus, login_streak, balance FROM currency_balance WHERE player_uuid = ?";
            
            try (PreparedStatement stmt = conn.prepareStatement(getSql)) {
                stmt.setString(1, playerUuid.toString());
                
                try (ResultSet rs = stmt.executeQuery()) {
                    if (!rs.next()) {
                        return new DailyBonusResult(false, 0, 0, "Player not found");
                    }
                    
                    Timestamp lastBonus = rs.getTimestamp("last_daily_bonus");
                    int currentStreak = rs.getInt("login_streak");
                    double currentBalance = rs.getDouble("balance");
                    
                    // Check if bonus already claimed today
                    if (lastBonus != null) {
                        Instant lastBonusTime = lastBonus.toInstant();
                        Instant now = Instant.now();
                        
                        if (lastBonusTime.plusSeconds(86400).isAfter(now)) {
                            long remainingSeconds = Duration.between(now, lastBonusTime.plusSeconds(86400)).getSeconds();
                            return new DailyBonusResult(false, 0, currentStreak, 
                                    "Already claimed. Next bonus in " + remainingSeconds / 3600 + " hours");
                        }
                        
                        // Check if streak continues (claimed yesterday)
                        if (lastBonusTime.plusSeconds(172800).isBefore(now)) {
                            // Streak broken
                            currentStreak = 0;
                        }
                    }
                    
                    // Calculate bonus
                    int newStreak = Math.min(currentStreak + 1, config.dailyBonus().maxStreakDays());
                    double bonus = config.dailyBonus().amount() + 
                            (newStreak * config.dailyBonus().streakMultiplier() * config.dailyBonus().amount());
                    bonus = roundBalance(bonus);
                    
                    // Apply bonus
                    String updateSql = "UPDATE currency_balance SET balance = balance + ?, login_streak = ?, last_daily_bonus = ?, total_earned = total_earned + ?, last_updated = ? WHERE player_uuid = ?";
                    try (PreparedStatement updateStmt = conn.prepareStatement(updateSql)) {
                        updateStmt.setDouble(1, bonus);
                        updateStmt.setInt(2, newStreak);
                        updateStmt.setTimestamp(3, Timestamp.from(Instant.now()));
                        updateStmt.setDouble(4, bonus);
                        updateStmt.setTimestamp(5, Timestamp.from(Instant.now()));
                        updateStmt.setString(6, playerUuid.toString());
                        
                        updateStmt.executeUpdate();
                    }
                    
                    // Log transaction
                    logTransaction(conn, playerUuid, "DAILY_BONUS", bonus, null, 
                            "Daily bonus (streak: " + newStreak + ")");
                    
                    // Update cache
                    balanceCache.put(playerUuid, currentBalance + bonus);
                    
                    Player player = Bukkit.getPlayer(playerUuid);
                    if (player != null) {
                        player.sendMessage("§a§l[NCDEv] §fYou received §e" + 
                                formatBalance(bonus) + " §fdaily bonus! (Streak: " + newStreak + ")");
                    }
                    
                    return new DailyBonusResult(true, bonus, newStreak, "Bonus claimed!");
                }
            }
        } catch (SQLException e) {
            JsonLogger.error("daily_bonus_failed", Map.of(
                    "player_uuid", playerUuid.toString()
            ), e);
            return new DailyBonusResult(false, 0, 0, "Database error");
        }
    }

    /**
     * Log a transaction
     */
    private void logTransaction(Connection conn, UUID playerUuid, String type, double amount, 
            UUID otherParty, String reason) throws SQLException {
        
        String sql = """
            INSERT INTO currency_transactions (player_uuid, type, amount, balance_before, balance_after, reason, other_party, timestamp)
            VALUES (?, ?, ?, 
                (SELECT balance FROM currency_balance WHERE player_uuid = ?) - ?,
                (SELECT balance FROM currency_balance WHERE player_uuid = ?),
                ?, ?, ?)
            """;
        
        try (PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setString(1, playerUuid.toString());
            stmt.setString(2, type);
            stmt.setDouble(3, amount);
            stmt.setString(4, playerUuid.toString());
            stmt.setDouble(5, amount);
            stmt.setString(6, playerUuid.toString());
            stmt.setString(7, reason);
            stmt.setString(8, otherParty != null ? otherParty.toString() : null);
            stmt.setTimestamp(9, Timestamp.from(Instant.now()));
            stmt.executeUpdate();
        }
    }

    /**
     * Get transaction history
     */
    public List<Map<String, Object>> getTransactionHistory(UUID playerUuid, int limit) {
        List<Map<String, Object>> transactions = new ArrayList<>();
        
        try (Connection conn = db.getConnection()) {
            String sql = """
                SELECT * FROM currency_transactions 
                WHERE player_uuid = ? 
                ORDER BY timestamp DESC 
                LIMIT ?
                """;
            
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setString(1, playerUuid.toString());
                stmt.setInt(2, limit);
                
                try (ResultSet rs = stmt.executeQuery()) {
                    while (rs.next()) {
                        Map<String, Object> tx = new HashMap<>();
                        tx.put("id", rs.getLong("id"));
                        tx.put("type", rs.getString("type"));
                        tx.put("amount", rs.getDouble("amount"));
                        tx.put("balance_before", rs.getDouble("balance_before"));
                        tx.put("balance_after", rs.getDouble("balance_after"));
                        tx.put("reason", rs.getString("reason"));
                        tx.put("other_party", rs.getString("other_party"));
                        tx.put("timestamp", rs.getTimestamp("timestamp").toInstant().toString());
                        transactions.add(tx);
                    }
                }
            }
        } catch (SQLException e) {
            JsonLogger.error("get_transaction_history_failed", Map.of(
                    "player_uuid", playerUuid.toString()
            ), e);
        }
        
        return transactions;
    }

    /**
     * Format balance for display
     */
    public String formatBalance(double amount) {
        String symbol = config.primary().symbol();
        return symbol + formatNumber(amount);
    }

    /**
     * Format number with proper decimal places
     */
    private String formatNumber(double amount) {
        return String.format("%." + config.primary().decimalPlaces() + "f", amount)
                .replaceAll("\\.0*$", "")
                .replaceAll("(\\d)(?=(?:\\d{3})+(?:\\.|$))", "$1,");
    }

    /**
     * Round balance to proper decimal places
     */
    private double roundBalance(double amount) {
        return BigDecimal.valueOf(amount)
                .setScale(config.primary().decimalPlaces(), RoundingMode.HALF_UP)
                .doubleValue();
    }

    /**
     * Invalidate cache for player
     */
    public void invalidateCache(UUID playerUuid) {
        balanceCache.remove(playerUuid);
        cacheTimestamps.remove(playerUuid);
    }

    /**
     * Get top players by balance
     */
    public List<Map<String, Object>> getTopBalances(int limit) {
        List<Map<String, Object>> topPlayers = new ArrayList<>();
        
        try (Connection conn = db.getConnection()) {
            String sql = """
                SELECT cb.*, p.name 
                FROM currency_balance cb 
                JOIN players p ON cb.player_uuid = p.uuid 
                ORDER BY cb.balance DESC 
                LIMIT ?
                """;
            
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setInt(1, limit);
                
                try (ResultSet rs = stmt.executeQuery()) {
                    int rank = 1;
                    while (rs.next()) {
                        Map<String, Object> player = new HashMap<>();
                        player.put("rank", rank++);
                        player.put("uuid", rs.getString("player_uuid"));
                        player.put("name", rs.getString("name"));
                        player.put("balance", rs.getDouble("balance"));
                        player.put("total_earned", rs.getDouble("total_earned"));
                        player.put("total_spent", rs.getDouble("total_spent"));
                        topPlayers.add(player);
                    }
                }
            }
        } catch (SQLException e) {
            JsonLogger.error("get_top_balances_failed", Map.of(), e);
        }
        
        return topPlayers;
    }

    // ==================== RESULT CLASSES ====================

    public record TransferResult(boolean success, String message) {}
    
    public record DailyBonusResult(boolean claimed, double amount, int newStreak, String message) {}
}
