package com.ncdev.trading;

import com.ncdev.NcDevPlugin;
import com.ncdev.database.DatabaseManager;
import com.ncdev.util.JsonLogger;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.inventory.ItemStack;

import java.sql.*;
import java.time.Instant;
import java.util.*;

/**
 * Player-to-player trading service.
 */
public class TradingService {

    private final DatabaseManager db;
    private final NcDevPlugin plugin;

    public TradingService(DatabaseManager db, NcDevPlugin plugin) {
        this.db = db;
        this.plugin = plugin;
    }

    /**
     * Create a player-to-player exchange offer
     */
    public ExchangeResult createExchange(UUID senderUuid, UUID receiverUuid,
            List<ItemStack> offeredItems, List<ItemStack> requestedItems,
            double offeredMoney, double requestedMoney) {
        
        try (Connection conn = db.getConnection()) {
            String sql = """
                INSERT INTO player_exchanges (sender_uuid, sender_name, receiver_uuid, receiver_name,
                    offered_items, requested_items, offered_money, requested_money, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
                """;
            
            try (PreparedStatement stmt = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
                stmt.setString(1, senderUuid.toString());
                stmt.setString(2, getPlayerName(senderUuid));
                stmt.setString(3, receiverUuid.toString());
                stmt.setString(4, getPlayerName(receiverUuid));
                stmt.setString(5, serializeItems(offeredItems));
                stmt.setString(6, serializeItems(requestedItems));
                stmt.setDouble(7, offeredMoney);
                stmt.setDouble(8, requestedMoney);
                stmt.setTimestamp(9, Timestamp.from(Instant.now()));
                
                stmt.executeUpdate();
                
                try (ResultSet rs = stmt.getGeneratedKeys()) {
                    if (rs.next()) {
                        long exchangeId = rs.getLong(1);
                        
                        // Notify receiver
                        Player receiver = Bukkit.getPlayer(receiverUuid);
                        if (receiver != null) {
                            receiver.sendMessage("§b§l[NCDEv] §f" + getPlayerName(senderUuid) + 
                                    " wants to trade with you! Use /trade accept " + exchangeId);
                        }
                        
                        return new ExchangeResult(true, exchangeId, "Exchange offer created");
                    }
                }
            }
        } catch (SQLException e) {
            JsonLogger.error("create_exchange_failed", Map.of(), e);
        }
        return new ExchangeResult(false, null, "Failed to create exchange");
    }

    /**
     * Accept an exchange offer
     */
    public ExchangeResult acceptExchange(UUID acceptorUuid, long exchangeId) {
        try (Connection conn = db.getConnection()) {
            conn.setAutoCommit(false);
            
            try {
                // Get exchange details
                String getSql = "SELECT * FROM player_exchanges WHERE id = ? AND receiver_uuid = ? AND status = 'pending'";
                try (PreparedStatement stmt = conn.prepareStatement(getSql)) {
                    stmt.setLong(1, exchangeId);
                    stmt.setString(2, acceptorUuid.toString());
                    
                    try (ResultSet rs = stmt.executeQuery()) {
                        if (!rs.next()) {
                            conn.rollback();
                            return new ExchangeResult(false, null, "Exchange not found or already processed");
                        }
                        
                        UUID senderUuid = UUID.fromString(rs.getString("sender_uuid"));
                        List<ItemStack> offeredItems = deserializeItems(rs.getString("offered_items"));
                        List<ItemStack> requestedItems = deserializeItems(rs.getString("requested_items"));
                        double offeredMoney = rs.getDouble("offered_money");
                        double requestedMoney = rs.getDouble("requested_money");
                        
                        // Verify money
                        var currencyService = plugin.getCurrencyService();
                        if (currencyService != null && requestedMoney > 0) {
                            if (!currencyService.hasBalance(acceptorUuid, requestedMoney)) {
                                conn.rollback();
                                return new ExchangeResult(false, null, "Insufficient funds");
                            }
                        }
                        
                        // Transfer money
                        if (currencyService != null && requestedMoney > 0 && offeredMoney > 0) {
                            currencyService.transfer(acceptorUuid, senderUuid, requestedMoney, "Trade exchange");
                            currencyService.transfer(senderUuid, acceptorUuid, offeredMoney, "Trade exchange");
                        } else if (requestedMoney > 0) {
                            currencyService.transfer(acceptorUuid, senderUuid, requestedMoney, "Trade exchange");
                        } else if (offeredMoney > 0) {
                            currencyService.transfer(senderUuid, acceptorUuid, offeredMoney, "Trade exchange");
                        }
                        
                        // Transfer items
                        Player sender = Bukkit.getPlayer(senderUuid);
                        Player acceptor = Bukkit.getPlayer(acceptorUuid);
                        
                        if (sender != null) {
                            // Remove offered items from sender
                            for (ItemStack item : offeredItems) {
                                sender.getInventory().removeItem(item);
                            }
                            // Give sender requested items
                            for (ItemStack item : requestedItems) {
                                sender.getInventory().addItem(item);
                            }
                        }
                        
                        if (acceptor != null) {
                            // Remove requested items from acceptor
                            for (ItemStack item : requestedItems) {
                                acceptor.getInventory().removeItem(item);
                            }
                            // Give acceptor offered items
                            for (ItemStack item : offeredItems) {
                                acceptor.getInventory().addItem(item);
                            }
                        }
                        
                        // Update exchange status
                        String updateSql = "UPDATE player_exchanges SET status = 'completed', responded_at = ?, completed_at = ? WHERE id = ?";
                        try (PreparedStatement updateStmt = conn.prepareStatement(updateSql)) {
                            updateStmt.setTimestamp(1, Timestamp.from(Instant.now()));
                            updateStmt.setTimestamp(2, Timestamp.from(Instant.now()));
                            updateStmt.setLong(3, exchangeId);
                            updateStmt.executeUpdate();
                        }
                        
                        conn.commit();
                        
                        // Notify both parties
                        if (sender != null) {
                            sender.sendMessage("§a§l[NCDEv] §fTrade completed!");
                        }
                        acceptor.sendMessage("§a§l[NCDEv] §fTrade completed!");
                        
                        return new ExchangeResult(true, exchangeId, "Trade completed successfully");
                    }
                }
            } catch (Exception e) {
                conn.rollback();
                throw e;
            }
        } catch (SQLException e) {
            JsonLogger.error("accept_exchange_failed", Map.of("exchange_id", exchangeId), e);
        }
        return new ExchangeResult(false, null, "Failed to complete trade");
    }

    /**
     * Cancel an exchange offer
     */
    public boolean cancelExchange(UUID playerUuid, long exchangeId) {
        try (Connection conn = db.getConnection()) {
            String sql = "UPDATE player_exchanges SET status = 'cancelled', responded_at = ? WHERE id = ? AND status = 'pending' AND (sender_uuid = ? OR receiver_uuid = ?)";
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setTimestamp(1, Timestamp.from(Instant.now()));
                stmt.setLong(2, exchangeId);
                stmt.setString(3, playerUuid.toString());
                stmt.setString(4, playerUuid.toString());
                stmt.executeUpdate();
            }
            return true;
        } catch (SQLException e) {
            return false;
        }
    }

    /**
     * Get pending exchanges for a player
     */
    public List<Map<String, Object>> getPendingExchanges(UUID playerUuid) {
        List<Map<String, Object>> exchanges = new ArrayList<>();
        
        try (Connection conn = db.getConnection()) {
            String sql = "SELECT * FROM player_exchanges WHERE (sender_uuid = ? OR receiver_uuid = ?) AND status = 'pending' ORDER BY created_at DESC";
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setString(1, playerUuid.toString());
                stmt.setString(2, playerUuid.toString());
                
                try (ResultSet rs = stmt.executeQuery()) {
                    while (rs.next()) {
                        Map<String, Object> exchange = new HashMap<>();
                        exchange.put("id", rs.getLong("id"));
                        exchange.put("sender_uuid", rs.getString("sender_uuid"));
                        exchange.put("sender_name", rs.getString("sender_name"));
                        exchange.put("receiver_uuid", rs.getString("receiver_uuid"));
                        exchange.put("receiver_name", rs.getString("receiver_name"));
                        exchange.put("offered_money", rs.getDouble("offered_money"));
                        exchange.put("requested_money", rs.getDouble("requested_money"));
                        exchange.put("created_at", rs.getTimestamp("created_at").toInstant().toString());
                        exchanges.add(exchange);
                    }
                }
            }
        } catch (SQLException e) {
            JsonLogger.error("get_pending_exchanges_failed", Map.of(), e);
        }
        return exchanges;
    }

    /**
     * Record transaction for audit
     */
    public void recordTransaction(UUID fromUuid, UUID toUuid, String itemType, int amount, String type, String status) {
        try (Connection conn = db.getConnection()) {
            String sql = "INSERT INTO transactions (from_uuid, to_uuid, item_type, amount, type, status, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)";
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setString(1, fromUuid != null ? fromUuid.toString() : null);
                stmt.setString(2, toUuid != null ? toUuid.toString() : null);
                stmt.setString(3, itemType);
                stmt.setInt(4, amount);
                stmt.setString(5, type);
                stmt.setString(6, status);
                stmt.setTimestamp(7, Timestamp.from(Instant.now()));
                stmt.executeUpdate();
            }
        } catch (SQLException e) {
            JsonLogger.error("record_transaction_failed", Map.of(), e);
        }
    }

    private String getPlayerName(UUID uuid) {
        Player player = Bukkit.getPlayer(uuid);
        return player != null ? player.getName() : uuid.toString();
    }

    private String serializeItems(List<ItemStack> items) {
        if (items == null || items.isEmpty()) {
            return "[]";
        }
        List<Map<String, Object>> serialized = new ArrayList<>();
        for (ItemStack item : items) {
            if (item != null) {
                serialized.add(Map.of(
                        "type", item.getType().name(),
                        "amount", item.getAmount()
                ));
            }
        }
        return plugin.GSON.toJson(serialized);
    }

    private List<ItemStack> deserializeItems(String json) {
        if (json == null || json.isEmpty() || json.equals("[]")) {
            return Collections.emptyList();
        }
        List<ItemStack> items = new ArrayList<>();
        try {
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> data = plugin.GSON.fromJson(json, List.class);
            if (data != null) {
                for (Map<String, Object> itemData : data) {
                    String type = (String) itemData.get("type");
                    int amount = ((Number) itemData.get("amount")).intValue();
                    org.bukkit.Material material = org.bukkit.Material.getMaterial(type);
                    if (material != null) {
                        items.add(new ItemStack(material, amount));
                    }
                }
            }
        } catch (Exception e) {
            JsonLogger.error("deserialize_items_failed", Map.of(), e);
        }
        return items;
    }

    public record ExchangeResult(boolean success, Long exchangeId, String message) {}
}
