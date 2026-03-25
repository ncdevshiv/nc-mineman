package com.serverstats.model;

import java.time.Instant;
import java.util.Map;

public record ServerData(
    int onlinePlayers,
    int maxPlayers,
    double tps,
    int averagePing,
    Instant timestamp
) {
    public Map<String, Object> toMap() {
        return Map.of(
            "online_players", onlinePlayers,
            "max_players", maxPlayers,
            "tps", tps,
            "average_ping", averagePing,
            "timestamp", timestamp.toString()
        );
    }
}