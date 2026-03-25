package com.serverstats.model;

import org.bukkit.Location;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

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
        return Map.of(
            "uuid", uuid.toString(),
            "name", name,
            "ping", ping,
            "role", role,
            "health", health,
            "food", food,
            "gamemode", gameMode.name(),
            "last_update", lastUpdate,
            "location", location != null ? Map.of(
                "world", location.getWorld() != null ? location.getWorld().getName() : "unknown",
                "x", location.getBlockX(),
                "y", location.getBlockY(),
                "z", location.getBlockZ()
            ) : null
        );
    }
}