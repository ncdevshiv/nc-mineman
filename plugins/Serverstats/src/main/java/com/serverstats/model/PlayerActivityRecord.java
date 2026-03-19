package com.serverstats.model;

import org.bukkit.Location;

import java.time.Instant;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

public final class PlayerActivityRecord {
    private final UUID playerId;
    private final String playerName;
    private final String action;
    private final String target;
    private final Location location;
    private final String tool;
    private final int amount;
    private final String detail;
    private final Instant timestamp;

    private PlayerActivityRecord(UUID playerId, String playerName, String action, String target, Location location, String tool, int amount, String detail, Instant timestamp) {
        this.playerId = playerId;
        this.playerName = playerName;
        this.action = action;
        this.target = target;
        this.location = location;
        this.tool = tool;
        this.amount = amount;
        this.detail = detail;
        this.timestamp = timestamp;
    }

    public static PlayerActivityRecord blockBreak(UUID playerId, String playerName, String blockType, Location location, String tool, Instant timestamp) {
        return new PlayerActivityRecord(playerId, playerName, "BLOCK_BREAK", blockType, location, tool, 1, null, timestamp);
    }

    public static PlayerActivityRecord itemPickup(UUID playerId, String playerName, String itemType, int amount, Location location, Instant timestamp) {
        return new PlayerActivityRecord(playerId, playerName, "ITEM_PICKUP", itemType, location, null, amount, null, timestamp);
    }

    public static PlayerActivityRecord itemDrop(UUID playerId, String playerName, String itemType, int amount, Location location, Instant timestamp) {
        return new PlayerActivityRecord(playerId, playerName, "ITEM_DROP", itemType, location, null, amount, null, timestamp);
    }

    public static PlayerActivityRecord blockPlace(UUID playerId, String playerName, String blockType, Location location, String tool, Instant timestamp) {
        return new PlayerActivityRecord(playerId, playerName, "BLOCK_PLACE", blockType, location, tool, 1, null, timestamp);
    }

    public static PlayerActivityRecord death(UUID playerId, String playerName, String cause, Location location, Instant timestamp) {
        return new PlayerActivityRecord(playerId, playerName, "DEATH", cause, location, null, 1, null, timestamp);
    }

    public static PlayerActivityRecord kill(UUID playerId, String playerName, String victimName, Location location, Instant timestamp) {
        return new PlayerActivityRecord(playerId, playerName, "KILL", victimName, location, null, 1, null, timestamp);
    }

    public static PlayerActivityRecord chat(UUID playerId, String playerName, String message, Instant timestamp) {
        return new PlayerActivityRecord(playerId, playerName, "CHAT", "message", null, null, 1, message, timestamp);
    }

    public static PlayerActivityRecord craft(UUID playerId, String playerName, String resultType, int amount, Location location, Instant timestamp) {
        return new PlayerActivityRecord(playerId, playerName, "CRAFT", resultType, location, null, amount, null, timestamp);
    }

    public Map<String, Object> toMap() {
        Map<String, Object> map = new HashMap<>();
        map.put("player_id", playerId.toString());
        map.put("player_name", playerName);
        map.put("action", action);
        map.put("target", target);
        map.put("amount", amount);
        map.put("timestamp", timestamp.toString());
        if (tool != null) {
            map.put("tool", tool);
        }
        if (detail != null) {
            map.put("detail", detail);
        }
        if (location != null) {
            map.put("location", Map.of(
                    "world", location.getWorld() != null ? location.getWorld().getName() : "unknown",
                    "x", location.getBlockX(),
                    "y", location.getBlockY(),
                    "z", location.getBlockZ()
            ));
        }
        return map;
    }

    public UUID getPlayerId() {
        return playerId;
    }

    public String getPlayerName() {
        return playerName;
    }

    public String getAction() {
        return action;
    }

    public String getTarget() {
        return target;
    }

    public Location getLocation() {
        return location;
    }

    public String getTool() {
        return tool;
    }

    public int getAmount() {
        return amount;
    }

    public Instant getTimestamp() {
        return timestamp;
    }

    public String getDetail() {
        return detail;
    }
}
