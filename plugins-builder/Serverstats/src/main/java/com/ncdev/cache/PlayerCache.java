package com.ncdev.cache;

import com.ncdev.NcDevPlugin;
import org.bukkit.Location;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedQueue;

/**
 * In-memory player data cache for fast access.
 * Stores recent activities and player data snapshots.
 */
public class PlayerCache {

    private final int maxActivitiesPerPlayer;
    private final Map<UUID, PlayerData> playerDataCache = new ConcurrentHashMap<>();
    private final Map<UUID, ConcurrentLinkedQueue<Activity>> activityCache = new ConcurrentHashMap<>();

    public PlayerCache(int maxActivitiesPerPlayer) {
        this.maxActivitiesPerPlayer = maxActivitiesPerPlayer;
    }

    /**
     * Update player data
     */
    public void updatePlayerData(UUID uuid, String name, int ping, String role,
            Location location, double health, int food, 
            org.bukkit.GameMode gameMode, long timestamp) {
        
        playerDataCache.put(uuid, new PlayerData(
                uuid, name, ping, role, location, 
                health, food, gameMode, timestamp
        ));
    }

    /**
     * Get player data
     */
    public PlayerData getPlayerData(UUID uuid) {
        return playerDataCache.get(uuid);
    }

    /**
     * Get all cached player data
     */
    public Collection<PlayerData> getAllPlayerData() {
        return playerDataCache.values();
    }

    /**
     * Remove player from cache
     */
    public void removePlayer(UUID uuid) {
        playerDataCache.remove(uuid);
        activityCache.remove(uuid);
    }

    /**
     * Record player activity
     */
    public void recordActivity(UUID playerId, NcDevPlugin.ActivityEvent event) {
        ConcurrentLinkedQueue<Activity> activities = 
                activityCache.computeIfAbsent(playerId, k -> new ConcurrentLinkedQueue<>());
        
        Activity activity = new Activity(
                event.action(),
                event.target(),
                event.world(),
                event.x(), event.y(), event.z(),
                event.tool(),
                event.amount(),
                event.detail(),
                event.timestamp()
        );
        
        activities.offer(activity);
        
        // Trim to max size
        while (activities.size() > maxActivitiesPerPlayer) {
            activities.poll();
        }
    }

    /**
     * Get recent activities for player
     */
    public List<Activity> getRecentActivities(UUID playerId, int limit) {
        ConcurrentLinkedQueue<Activity> activities = activityCache.get(playerId);
        if (activities == null) {
            return Collections.emptyList();
        }
        
        return activities.stream()
                .limit(limit)
                .toList();
    }

    /**
     * Get activity count for player
     */
    public int getActivityCount(UUID playerId) {
        ConcurrentLinkedQueue<Activity> activities = activityCache.get(playerId);
        return activities != null ? activities.size() : 0;
    }

    /**
     * Clear activity cache for player
     */
    public void clearActivities(UUID playerId) {
        activityCache.remove(playerId);
    }

    /**
     * Get cached player count
     */
    public int getCachedPlayerCount() {
        return playerDataCache.size();
    }

    /**
     * Clean up stale entries
     */
    public void cleanup(long maxAgeMs) {
        long cutoff = System.currentTimeMillis() - maxAgeMs;
        
        playerDataCache.entrySet().removeIf(entry -> 
                entry.getValue().lastUpdate() < cutoff);
        
        // Clean empty activity queues
        activityCache.entrySet().removeIf(entry -> entry.getValue().isEmpty());
    }

    // ==================== DATA CLASSES ====================

    /**
     * Player data snapshot
     */
    public record PlayerData(
            UUID uuid,
            String name,
            int ping,
            String role,
            Location location,
            double health,
            int food,
            org.bukkit.GameMode gameMode,
            long lastUpdate
    ) {
        public Map<String, Object> toMap() {
            Map<String, Object> map = new HashMap<>();
            map.put("uuid", uuid.toString());
            map.put("name", name);
            map.put("ping", ping);
            map.put("role", role);
            map.put("health", health);
            map.put("food", food);
            map.put("gamemode", gameMode.name());
            map.put("last_update", lastUpdate);
            
            if (location != null && location.getWorld() != null) {
                map.put("location", Map.of(
                        "world", location.getWorld().getName(),
                        "x", location.getBlockX(),
                        "y", location.getBlockY(),
                        "z", location.getBlockZ()
                ));
            }
            
            return map;
        }
    }

    /**
     * Cached activity
     */
    public record Activity(
            String action,
            String target,
            String world,
            int x, int y, int z,
            String tool,
            int amount,
            String detail,
            Instant timestamp
    ) {
        public Map<String, Object> toMap() {
            Map<String, Object> map = new HashMap<>();
            map.put("action", action);
            map.put("target", target);
            map.put("amount", amount);
            map.put("timestamp", timestamp.toString());
            
            if (tool != null) map.put("tool", tool);
            if (detail != null) map.put("detail", detail);
            if (world != null) {
                map.put("location", Map.of("world", world, "x", x, "y", y, "z", z));
            }
            
            return map;
        }
    }
}
