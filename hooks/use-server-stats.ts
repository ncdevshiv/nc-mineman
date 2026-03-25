'use client';

import useSWR from 'swr';
import { useEffect, useState } from 'react';
import { useServerStarWebSocket } from './use-websocket';

const fetcher = (url: string) => fetch(url, { credentials: 'same-origin' }).then(r => {
    if (!r.ok) {
        if (r.status === 401 || r.status === 403) return null;
        throw new Error(`HTTP ${r.status}`);
    }
    return r.json();
});

export interface ServerSnapshot {
    components: {
        server: {
            tps_1min: number;
            tps_5min: number;
            tps_15min: number;
            online_players: number;
            max_players: number;
            average_ping: number;
            uptime_seconds: number;
            version: string;
        };
        players: Array<{
            name: string;
            uuid: string;
            health: number;
            food: number;
            gamemode: string;
            x: number;
            y: number;
            z: number;
            world: string;
            is_online: boolean;
            is_banned: boolean;
            ban_reason?: string;
            is_whitelisted: boolean;
            total_playtime_seconds: number;
            first_seen: string;
            last_seen: string;
            ping?: number;
            role?: string;
        }>;
        activities: Array<{
            type: string;
            player: string;
            message: string;
            timestamp: string;
        }>;
    };
}

export function useServerStats(refreshInterval = 5000) {
    const enabled = refreshInterval > 0;
    const { data, error, isLoading, mutate } = useSWR<ServerSnapshot | null>(
        enabled ? '/api/serverstats/proxy?path=snapshot' : null,
        fetcher,
        {
            refreshInterval: enabled ? refreshInterval : 0,
            revalidateOnFocus: enabled,
            errorRetryCount: 3,
            errorRetryInterval: 5000,
        }
    );

    const [wsPlayers, setWsPlayers] = useState<any[]>([]);
    const [wsServer, setWsServer] = useState<any>(null);
    const [wsActivities, setWsActivities] = useState<any[]>([]);

    const { isConnected, serverData, activities, playerUpdates } = useServerStarWebSocket({
        enabled: true,
        onServerUpdate: (d) => setWsServer(d),
        onActivity: (d) => setWsActivities(prev => [d, ...prev].slice(0, 20)),
    });

    useEffect(() => {
        if (playerUpdates.size > 0) {
            setWsPlayers(Array.from(playerUpdates.values()));
        }
    }, [playerUpdates]);

    const pollServer = data?.components?.server;
    const pollPlayers = data?.components?.players || [];
    const pollActivities = data?.components?.activities || [];

    const server = wsServer ? {
        tps_1min: wsServer.tps ?? 20,
        tps_5min: wsServer.tps ?? 20,
        tps_15min: wsServer.tps ?? 20,
        online_players: wsServer.online_players ?? 0,
        max_players: wsServer.max_players ?? 100,
        average_ping: wsServer.average_ping ?? 0,
        uptime_seconds: 0,
        version: '1.21',
    } : pollServer;

    const players = wsPlayers.length > 0 ? wsPlayers.map(p => ({
        name: p.name || '',
        uuid: p.uuid || '',
        health: p.health ?? 20,
        food: p.food ?? 20,
        gamemode: p.gamemode || 'SURVIVAL',
        x: p.location?.x ?? 0,
        y: p.location?.y ?? 64,
        z: p.location?.z ?? 0,
        world: p.location?.world || 'world',
        is_online: true,
        is_banned: p.status === 'banned',
        ban_reason: '',
        is_whitelisted: true,
        total_playtime_seconds: 0,
        first_seen: '',
        last_seen: '',
        ping: p.ping ?? 0,
        role: p.role || 'Member',
    })) : pollPlayers;

    const wsActivitiesFormatted = wsActivities.map(a => ({
        type: (a.action || a.type || '').toLowerCase().replace('_', ''),
        player: a.player_name || a.player || '',
        message: `${(a.action || '').toLowerCase().replace('_', ' ')} ${a.target || ''}`.trim(),
        timestamp: a.timestamp || new Date().toISOString(),
    }));

    const activities_final = wsActivitiesFormatted.length > 0 ? wsActivitiesFormatted : pollActivities;

    return {
        snapshot: data,
        server,
        players,
        activities: activities_final,
        isLoading,
        error,
        refresh: mutate,
        wsConnected: isConnected,
    };
}

export function usePlayerStats(username: string) {
    const { snapshot, players } = useServerStats();
    const player = players.find(
        p => p.name.toLowerCase() === username.toLowerCase()
    );
    return player || null;
}
