package com.serverstats.service;

import com.serverstats.model.PlayerActivityRecord;
import com.serverstats.util.JsonLogger;
import org.bukkit.Bukkit;
import org.bukkit.Location;
import org.bukkit.World;
import org.bukkit.attribute.Attribute;
import org.bukkit.attribute.AttributeInstance;
import org.bukkit.entity.Player;
import org.bukkit.inventory.ItemStack;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

public final class PlayerStatsService {
    private final int activityLimitPerPlayer;

    private final Map<UUID, Long> accumulatedPlaytimeMs = new ConcurrentHashMap<>();
    private final Map<UUID, Long> sessionStartMs = new ConcurrentHashMap<>();
    private final Map<UUID, LinkedList<PlayerActivityRecord>> activities = new ConcurrentHashMap<>();

    public PlayerStatsService(int activityLimitPerPlayer) {
        this.activityLimitPerPlayer = activityLimitPerPlayer;
    }

    public void markJoin(Player player) {
        sessionStartMs.put(player.getUniqueId(), System.currentTimeMillis());
        accumulatedPlaytimeMs.putIfAbsent(player.getUniqueId(), 0L);
    }

    public void markQuit(Player player) {
        UUID id = player.getUniqueId();
        long now = System.currentTimeMillis();
        Long start = sessionStartMs.remove(id);
        if (start != null) {
            accumulatedPlaytimeMs.merge(id, now - start, Long::sum);
        }
    }

    public void recordActivity(PlayerActivityRecord record) {
        activities.computeIfAbsent(record.getPlayerId(), key -> new LinkedList<>());
        LinkedList<PlayerActivityRecord> list = activities.get(record.getPlayerId());
        list.addFirst(record);
        while (list.size() > activityLimitPerPlayer) {
            list.removeLast();
        }
    }

    public List<Map<String, Object>> allPlayerSnapshots() {
        List<Map<String, Object>> snapshots = new ArrayList<>();
        for (Player player : Bukkit.getOnlinePlayers()) {
            snapshots.add(playerSnapshot(player));
        }
        return snapshots;
    }

    public Map<String, Object> playerSnapshot(Player player) {
        Map<String, Object> map = new HashMap<>();
        map.put("player_id", player.getUniqueId().toString());
        map.put("player_name", player.getName());
        map.put("health", player.getHealth());
        AttributeInstance maxHealth = player.getAttribute(Attribute.GENERIC_MAX_HEALTH);
        map.put("max_health", maxHealth != null ? maxHealth.getValue() : 20.0D);
        map.put("food", player.getFoodLevel());
        map.put("saturation", player.getSaturation());
        map.put("experience_level", player.getLevel());
        map.put("exp_progress", player.getExp());
        map.put("gamemode", player.getGameMode().name());
        map.put("ping_ms", player.getPing());

        map.put("location", serializeLocation(player.getLocation()));
        map.put("playtime_seconds", computePlaytimeSeconds(player.getUniqueId()));
        map.put("inventory", serializeInventory(player.getInventory().getContents()));

        List<PlayerActivityRecord> recent = activities.getOrDefault(player.getUniqueId(), new LinkedList<>());
        map.put("recent_activity", recent.stream().limit(20).map(PlayerActivityRecord::toMap).toList());
        return map;
    }

    public Map<String, Object> serverSnapshot() {
        Map<String, Object> server = new HashMap<>();
        int online = Bukkit.getOnlinePlayers().size();
        server.put("online_players", online);
        server.put("max_players", Bukkit.getMaxPlayers());
        server.put("tps_1m", safeTpsIndex(0));
        server.put("tps_5m", safeTpsIndex(1));
        server.put("tps_15m", safeTpsIndex(2));
        server.put("average_ping_ms", averagePing());
        server.put("time", Instant.now().toString());
        return server;
    }

    public Map<String, Object> activitiesSnapshot() {
        Map<String, Object> payload = new HashMap<>();
        for (Map.Entry<UUID, LinkedList<PlayerActivityRecord>> entry : activities.entrySet()) {
            payload.put(entry.getKey().toString(), entry.getValue().stream().map(PlayerActivityRecord::toMap).toList());
        }
        return payload;
    }

    private double averagePing() {
        int count = 0;
        int total = 0;
        for (Player player : Bukkit.getOnlinePlayers()) {
            count++;
            total += player.getPing();
        }
        return count == 0 ? 0 : (double) total / count;
    }

    private double safeTpsIndex(int index) {
        try {
            double[] tps = Bukkit.getServer().getTPS();
            if (tps != null && tps.length > index) {
                return tps[index];
            }
        } catch (NoSuchMethodError err) {
            JsonLogger.warn("tps_unavailable", Map.of("index", index), err);
        }
        return -1D;
    }

    private long computePlaytimeSeconds(UUID id) {
        long totalMs = accumulatedPlaytimeMs.getOrDefault(id, 0L);
        Long start = sessionStartMs.get(id);
        if (start != null) {
            totalMs += (System.currentTimeMillis() - start);
        }
        return totalMs / 1000L;
    }

    private Map<String, Object> serializeLocation(Location loc) {
        World world = loc.getWorld();
        Map<String, Object> map = new HashMap<>();
        map.put("world", world != null ? world.getName() : "unknown");
        map.put("x", loc.getX());
        map.put("y", loc.getY());
        map.put("z", loc.getZ());
        map.put("yaw", loc.getYaw());
        map.put("pitch", loc.getPitch());
        return map;
    }

    private List<Map<String, Object>> serializeInventory(ItemStack[] contents) {
        List<Map<String, Object>> items = new ArrayList<>();
        for (ItemStack stack : contents) {
            if (stack == null || stack.getType().isAir() || stack.getAmount() <= 0) {
                continue;
            }
            Map<String, Object> item = new HashMap<>();
            item.put("type", stack.getType().name());
            item.put("amount", stack.getAmount());
            if (stack.hasItemMeta() && stack.getItemMeta().hasDisplayName()) {
                item.put("display_name", stack.getItemMeta().getDisplayName());
            }
            items.add(item);
        }
        return items;
    }
}
