package com.serverstats.service;

import com.serverstats.ServerStarPlugin;
import com.serverstats.database.DatabaseManager;
import com.serverstats.util.JsonLogger;

import java.sql.*;
import java.time.Instant;
import java.util.*;

public class TradingService {
    private final DatabaseManager db;
    private final ServerStarPlugin plugin;

    public TradingService(DatabaseManager db, ServerStarPlugin plugin) {
        this.db = db;
        this.plugin = plugin;
    }

    public boolean recordTransaction(UUID fromUuid, UUID toUuid, String itemType, int amount, String type, String status) {
        try (Connection conn = db.getConnection()) {
            String sql = "INSERT INTO transactions (from_uuid, to_uuid, item_type, amount, type, status, timestamp) " +
                        "VALUES (?, ?, ?, ?, ?, ?, ?)";

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

            JsonLogger.info("transaction_recorded", Map.of(
                "from_uuid", fromUuid != null ? fromUuid.toString() : "system",
                "to_uuid", toUuid != null ? toUuid.toString() : "system",
                "item_type", itemType,
                "amount", amount,
                "type", type,
                "status", status
            ));

            return true;
        } catch (SQLException e) {
            JsonLogger.error("record_transaction_error", Map.of(
                "from_uuid", fromUuid != null ? fromUuid.toString() : "system",
                "to_uuid", toUuid != null ? toUuid.toString() : "system",
                "item_type", itemType
            ), e);
            return false;
        }
    }

    public boolean sellItem(UUID sellerUuid, String itemType, int amount, double price) {
        // Check if seller has enough items
        List<Map<String, Object>> inventory = plugin.getInventoryService().getPlayerInventory(sellerUuid);
        long totalAmount = inventory.stream()
            .filter(item -> itemType.equals(item.get("item_type")) && !(Boolean)item.get("locked"))
            .mapToLong(item -> (Integer)item.get("amount"))
            .sum();

        if (totalAmount < amount) {
            return false;
        }

        // For now, selling to "server" - could be extended to player-to-player trading
        return recordTransaction(sellerUuid, null, itemType, amount, "sell", "completed");
    }

    public boolean giftItem(UUID giverUuid, UUID receiverUuid, String itemType, int amount) {
        return plugin.getInventoryService().transferItem(giverUuid, receiverUuid, itemType, amount);
    }

    public long createAuction(UUID sellerUuid, String itemType, int amount, double startingPrice, Instant endTime) {
        // This would need an auctions table, but for now we'll use transactions
        // In a full implementation, you'd have a separate auctions system
        try (Connection conn = db.getConnection()) {
            // For simplicity, we'll record this as a pending transaction
            String sql = "INSERT INTO transactions (from_uuid, item_type, amount, type, status, timestamp) " +
                        "VALUES (?, ?, ?, 'auction', 'pending', ?)";

            try (PreparedStatement stmt = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
                stmt.setString(1, sellerUuid.toString());
                stmt.setString(2, itemType);
                stmt.setInt(3, amount);
                stmt.setTimestamp(4, Timestamp.from(endTime));
                stmt.executeUpdate();

                try (ResultSet rs = stmt.getGeneratedKeys()) {
                    if (rs.next()) {
                        long auctionId = rs.getLong(1);
                        JsonLogger.info("auction_created", Map.of(
                            "auction_id", auctionId,
                            "seller_uuid", sellerUuid.toString(),
                            "item_type", itemType,
                            "amount", amount,
                            "starting_price", startingPrice
                        ));
                        return auctionId;
                    }
                }
            }
        } catch (SQLException e) {
            JsonLogger.error("create_auction_error", Map.of(
                "seller_uuid", sellerUuid.toString(),
                "item_type", itemType
            ), e);
        }
        return -1;
    }

    public boolean bidOnAuction(long auctionId, UUID bidderUuid, double bidAmount) {
        // Simplified auction bidding - in reality, you'd track current highest bid
        try (Connection conn = db.getConnection()) {
            String sql = "UPDATE transactions SET to_uuid = ?, status = 'bid', timestamp = CURRENT_TIMESTAMP " +
                        "WHERE id = ? AND type = 'auction' AND status = 'pending'";
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setString(1, bidderUuid.toString());
                stmt.setLong(2, auctionId);
                int updated = stmt.executeUpdate();

                if (updated > 0) {
                    JsonLogger.info("auction_bid", Map.of(
                        "auction_id", auctionId,
                        "bidder_uuid", bidderUuid.toString(),
                        "bid_amount", bidAmount
                    ));
                    return true;
                }
            }
        } catch (SQLException e) {
            JsonLogger.error("auction_bid_error", Map.of(
                "auction_id", auctionId,
                "bidder_uuid", bidderUuid.toString()
            ), e);
        }
        return false;
    }

    public List<Map<String, Object>> getTransactionHistory(UUID playerUuid, int limit) {
        List<Map<String, Object>> transactions = new ArrayList<>();
        try (Connection conn = db.getConnection()) {
            String sql = "SELECT * FROM transactions WHERE from_uuid = ? OR to_uuid = ? " +
                        "ORDER BY timestamp DESC LIMIT ?";
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setString(1, playerUuid.toString());
                stmt.setString(2, playerUuid.toString());
                stmt.setInt(3, limit);
                try (ResultSet rs = stmt.executeQuery()) {
                    while (rs.next()) {
                        Map<String, Object> transaction = new HashMap<>();
                        transaction.put("id", rs.getLong("id"));
                        transaction.put("from_uuid", rs.getString("from_uuid"));
                        transaction.put("to_uuid", rs.getString("to_uuid"));
                        transaction.put("item_type", rs.getString("item_type"));
                        transaction.put("amount", rs.getInt("amount"));
                        transaction.put("type", rs.getString("type"));
                        transaction.put("status", rs.getString("status"));
                        transaction.put("timestamp", rs.getTimestamp("timestamp"));
                        transactions.add(transaction);
                    }
                }
            }
        } catch (SQLException e) {
            JsonLogger.error("get_transaction_history_error", Map.of("uuid", playerUuid.toString()), e);
        }
        return transactions;
    }

    public List<Map<String, Object>> getActiveAuctions() {
        List<Map<String, Object>> auctions = new ArrayList<>();
        try (Connection conn = db.getConnection()) {
            String sql = "SELECT t.*, p.name as seller_name FROM transactions t " +
                        "JOIN players p ON t.from_uuid = p.uuid " +
                        "WHERE t.type = 'auction' AND t.status = 'pending' " +
                        "AND t.timestamp > CURRENT_TIMESTAMP"; // Not expired
            try (PreparedStatement stmt = conn.prepareStatement(sql);
                 ResultSet rs = stmt.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> auction = new HashMap<>();
                    auction.put("id", rs.getLong("id"));
                    auction.put("seller_uuid", rs.getString("from_uuid"));
                    auction.put("seller_name", rs.getString("seller_name"));
                    auction.put("item_type", rs.getString("item_type"));
                    auction.put("amount", rs.getInt("amount"));
                    auction.put("end_time", rs.getTimestamp("timestamp"));
                    auctions.add(auction);
                }
            }
        } catch (SQLException e) {
            JsonLogger.error("get_active_auctions_error", Map.of(), e);
        }
        return auctions;
    }

    public boolean processExpiredAuctions() {
        try (Connection conn = db.getConnection()) {
            // Find expired auctions and process them
            String sql = "SELECT * FROM transactions WHERE type = 'auction' AND status = 'pending' " +
                        "AND timestamp <= CURRENT_TIMESTAMP";
            try (PreparedStatement stmt = conn.prepareStatement(sql);
                 ResultSet rs = stmt.executeQuery()) {

                while (rs.next()) {
                    long auctionId = rs.getLong("id");
                    String sellerUuid = rs.getString("from_uuid");
                    String winnerUuid = rs.getString("to_uuid"); // Last bidder

                    if (winnerUuid != null) {
                        // Transfer item to winner
                        plugin.getInventoryService().transferItem(
                            UUID.fromString(sellerUuid),
                            UUID.fromString(winnerUuid),
                            rs.getString("item_type"),
                            rs.getInt("amount")
                        );

                        // Mark auction as completed
                        String updateSql = "UPDATE transactions SET status = 'completed' WHERE id = ?";
                        try (PreparedStatement updateStmt = conn.prepareStatement(updateSql)) {
                            updateStmt.setLong(1, auctionId);
                            updateStmt.executeUpdate();
                        }
                    } else {
                        // No bids, return item to seller
                        String updateSql = "UPDATE transactions SET status = 'cancelled' WHERE id = ?";
                        try (PreparedStatement updateStmt = conn.prepareStatement(updateSql)) {
                            updateStmt.setLong(1, auctionId);
                            updateStmt.executeUpdate();
                        }
                    }
                }
            }

            return true;
        } catch (SQLException e) {
            JsonLogger.error("process_expired_auctions_error", Map.of(), e);
            return false;
        }
    }
}