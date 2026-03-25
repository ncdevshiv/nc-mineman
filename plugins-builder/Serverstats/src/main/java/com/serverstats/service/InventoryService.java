package com.serverstats.service;

import com.serverstats.ServerStarPlugin;
import com.serverstats.database.DatabaseManager;
import com.serverstats.util.JsonLogger;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;

import java.sql.*;
import java.time.Instant;
import java.util.*;

public class InventoryService {
    private final DatabaseManager db;
    private final ServerStarPlugin plugin;

    public InventoryService(DatabaseManager db, ServerStarPlugin plugin) {
        this.db = db;
        this.plugin = plugin;
    }

    public void recordItemPickup(UUID playerUuid, ItemStack item) {
        if (item == null || item.getType().isAir()) return;

        try (Connection conn = db.getConnection()) {
            String sql = "INSERT INTO inventory (player_uuid, item_type, amount, display_name, lore, enchantments) " +
                        "VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE amount = amount + ?";

            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setString(1, playerUuid.toString());
                stmt.setString(2, item.getType().name());
                stmt.setInt(3, item.getAmount());
                stmt.setString(4, getDisplayName(item));
                stmt.setString(5, getLore(item));
                stmt.setString(6, getEnchantments(item));
                stmt.setInt(7, item.getAmount());
                stmt.executeUpdate();
            }
        } catch (SQLException e) {
            JsonLogger.error("inventory_pickup_error",
                Map.of("uuid", playerUuid.toString(), "item", item.getType().name()), e);
        }
    }

    public void recordItemDrop(UUID playerUuid, ItemStack item) {
        if (item == null || item.getType().isAir()) return;

        try (Connection conn = db.getConnection()) {
            String sql = "UPDATE inventory SET amount = amount - ? WHERE player_uuid = ? AND item_type = ? AND amount >= ?";
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setInt(1, item.getAmount());
                stmt.setString(2, playerUuid.toString());
                stmt.setString(3, item.getType().name());
                stmt.setInt(4, item.getAmount());
                int updated = stmt.executeUpdate();

                if (updated == 0) {
                    JsonLogger.warn("inventory_drop_insufficient",
                        Map.of("uuid", playerUuid.toString(), "item", item.getType().name()), null);
                }
            }
        } catch (SQLException e) {
            JsonLogger.error("inventory_drop_error",
                Map.of("uuid", playerUuid.toString(), "item", item.getType().name()), e);
        }
    }

    public void recordCrafting(UUID playerUuid, ItemStack item) {
        if (item == null || item.getType().isAir()) return;

        try (Connection conn = db.getConnection()) {
            String sql = "INSERT INTO inventory (player_uuid, item_type, amount, display_name, lore, enchantments) " +
                        "VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE amount = amount + ?";

            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setString(1, playerUuid.toString());
                stmt.setString(2, item.getType().name());
                stmt.setInt(3, item.getAmount());
                stmt.setString(4, getDisplayName(item));
                stmt.setString(5, getLore(item));
                stmt.setString(6, getEnchantments(item));
                stmt.setInt(7, item.getAmount());
                stmt.executeUpdate();
            }

            // Record transaction
            plugin.getTradingService().recordTransaction(
                null, playerUuid, item.getType().name(), item.getAmount(), "craft", "completed"
            );
        } catch (SQLException e) {
            JsonLogger.error("inventory_craft_error",
                Map.of("uuid", playerUuid.toString(), "item", item.getType().name()), e);
        }
    }

    public List<Map<String, Object>> getPlayerInventory(UUID playerUuid) {
        List<Map<String, Object>> inventory = new ArrayList<>();
        try (Connection conn = db.getConnection()) {
            String sql = "SELECT * FROM inventory WHERE player_uuid = ? AND amount > 0 ORDER BY slot";
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setString(1, playerUuid.toString());
                try (ResultSet rs = stmt.executeQuery()) {
                    while (rs.next()) {
                        Map<String, Object> item = new HashMap<>();
                        item.put("id", rs.getLong("id"));
                        item.put("slot", rs.getInt("slot"));
                        item.put("item_type", rs.getString("item_type"));
                        item.put("amount", rs.getInt("amount"));
                        item.put("display_name", rs.getString("display_name"));
                        item.put("lore", rs.getString("lore"));
                        item.put("enchantments", rs.getString("enchantments"));
                        item.put("locked", rs.getBoolean("locked"));
                        inventory.add(item);
                    }
                }
            }
        } catch (SQLException e) {
            JsonLogger.error("get_inventory_error", Map.of("uuid", playerUuid.toString()), e);
        }
        return inventory;
    }

    public boolean transferItem(UUID fromUuid, UUID toUuid, String itemType, int amount) {
        try (Connection conn = db.getConnection()) {
            conn.setAutoCommit(false);

            try {
                // Check if sender has enough items
                String checkSql = "SELECT amount FROM inventory WHERE player_uuid = ? AND item_type = ? AND locked = FALSE";
                try (PreparedStatement checkStmt = conn.prepareStatement(checkSql)) {
                    checkStmt.setString(1, fromUuid.toString());
                    checkStmt.setString(2, itemType);
                    try (ResultSet rs = checkStmt.executeQuery()) {
                        if (!rs.next() || rs.getInt("amount") < amount) {
                            return false;
                        }
                    }
                }

                // Deduct from sender
                String deductSql = "UPDATE inventory SET amount = amount - ? WHERE player_uuid = ? AND item_type = ?";
                try (PreparedStatement deductStmt = conn.prepareStatement(deductSql)) {
                    deductStmt.setInt(1, amount);
                    deductStmt.setString(2, fromUuid.toString());
                    deductStmt.setString(3, itemType);
                    deductStmt.executeUpdate();
                }

                // Add to receiver
                String addSql = "INSERT INTO inventory (player_uuid, item_type, amount) " +
                               "VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE amount = amount + ?";
                try (PreparedStatement addStmt = conn.prepareStatement(addSql)) {
                    addStmt.setString(1, toUuid.toString());
                    addStmt.setString(2, itemType);
                    addStmt.setInt(3, amount);
                    addStmt.setInt(4, amount);
                    addStmt.executeUpdate();
                }

                // Record transaction
                plugin.getTradingService().recordTransaction(fromUuid, toUuid, itemType, amount, "transfer", "completed");

                conn.commit();
                return true;

            } catch (SQLException e) {
                conn.rollback();
                throw e;
            }
        } catch (SQLException e) {
            JsonLogger.error("item_transfer_error", Map.of(
                "from", fromUuid.toString(),
                "to", toUuid.toString(),
                "item", itemType,
                "amount", amount
            ), e);
            return false;
        }
    }

    public boolean lockItem(UUID playerUuid, long itemId, boolean locked) {
        try (Connection conn = db.getConnection()) {
            String sql = "UPDATE inventory SET locked = ? WHERE id = ? AND player_uuid = ?";
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setBoolean(1, locked);
                stmt.setLong(2, itemId);
                stmt.setString(3, playerUuid.toString());
                return stmt.executeUpdate() > 0;
            }
        } catch (SQLException e) {
            JsonLogger.error("item_lock_error", Map.of(
                "uuid", playerUuid.toString(),
                "item_id", itemId,
                "locked", locked
            ), e);
            return false;
        }
    }

    public boolean deleteItem(UUID playerUuid, long itemId, int amount) {
        try (Connection conn = db.getConnection()) {
            String sql = "UPDATE inventory SET amount = GREATEST(0, amount - ?) WHERE id = ? AND player_uuid = ? AND locked = FALSE";
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setInt(1, amount);
                stmt.setLong(2, itemId);
                stmt.setString(3, playerUuid.toString());
                return stmt.executeUpdate() > 0;
            }
        } catch (SQLException e) {
            JsonLogger.error("item_delete_error", Map.of(
                "uuid", playerUuid.toString(),
                "item_id", itemId
            ), e);
            return false;
        }
    }

    private String getDisplayName(ItemStack item) {
        if (item.hasItemMeta() && item.getItemMeta().hasDisplayName()) {
            return item.getItemMeta().getDisplayName();
        }
        return null;
    }

    private String getLore(ItemStack item) {
        if (item.hasItemMeta() && item.getItemMeta().hasLore()) {
            return String.join("\n", item.getItemMeta().getLore());
        }
        return null;
    }

    private String getEnchantments(ItemStack item) {
        if (item.hasItemMeta() && item.getItemMeta().hasEnchants()) {
            StringBuilder sb = new StringBuilder();
            item.getItemMeta().getEnchants().forEach((enchant, level) -> {
                if (sb.length() > 0) sb.append(",");
                sb.append(enchant.getKey().getKey()).append(":").append(level);
            });
            return sb.toString();
        }
        return null;
    }
}