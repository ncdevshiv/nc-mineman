'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

const WEBSOCKET_PORT = parseInt(process.env.NEXT_PUBLIC_WEBSOCKET_PORT || '8089');

export interface ServerStarMessage {
type: string;
data: any;
timestamp: number;
}

interface UseServerStarWebSocketOptions {
enabled?: boolean;
onPlayerUpdate?: (data: any) => void;
onServerUpdate?: (data: any) => void;
onActivity?: (data: any) => void;
onInventoryUpdate?: (data: any) => void;
onPlayerJoin?: (data: any) => void;
onPlayerQuit?: (data: any) => void;
}

function getPluginWsUrl(): string {
if (typeof window === 'undefined') return '';
const host = window.location.hostname;
return `ws://${host}:${WEBSOCKET_PORT}`;
}

export function useServerStarWebSocket(options: UseServerStarWebSocketOptions = {}) {
    const { enabled = true, onPlayerUpdate, onServerUpdate, onActivity, onInventoryUpdate, onPlayerJoin, onPlayerQuit } = options;

    const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
    const [lastMessage, setLastMessage] = useState<ServerStarMessage | null>(null);
    const [serverData, setServerData] = useState<any>(null);
    const [activities, setActivities] = useState<any[]>([]);
    const [playerUpdates, setPlayerUpdates] = useState<Map<string, any>>(new Map());

    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const reconnectAttempts = useRef(0);
    const maxReconnectAttempts = 3;

    // Use refs for callbacks to avoid infinite re-renders
    const callbacksRef = useRef({ onPlayerUpdate, onServerUpdate, onActivity, onInventoryUpdate, onPlayerJoin, onPlayerQuit });
    callbacksRef.current = { onPlayerUpdate, onServerUpdate, onActivity, onInventoryUpdate, onPlayerJoin, onPlayerQuit };

    const connect = useCallback(() => {
        if (!enabled || wsRef.current?.readyState === WebSocket.OPEN) return;

        const url = getPluginWsUrl();
        if (!url) return;

        setStatus('connecting');

        try {
            const ws = new WebSocket(url);

            ws.onopen = () => {
                setStatus('connected');
                reconnectAttempts.current = 0;
                ws.send(JSON.stringify({ type: 'ping' }));
            };

            ws.onmessage = (event) => {
                try {
                    const msg: ServerStarMessage = JSON.parse(event.data);
                    setLastMessage(msg);

                    switch (msg.type) {
                        case 'server_update':
                            setServerData(msg.data);
                            callbacksRef.current.onServerUpdate?.(msg.data);
                            break;
                        case 'player_update':
                            if (msg.data?.uuid) {
                                setPlayerUpdates(prev => {
                                    const next = new Map(prev);
                                    next.set(msg.data.uuid, msg.data);
                                    return next;
                                });
                            }
                            callbacksRef.current.onPlayerUpdate?.(msg.data);
                            break;
                        case 'activity':
                            setActivities(prev => [msg.data, ...prev].slice(0, 50));
                            callbacksRef.current.onActivity?.(msg.data);
                            break;
                        case 'inventory_update':
                            callbacksRef.current.onInventoryUpdate?.(msg.data);
                            break;
                        case 'player_join':
                            callbacksRef.current.onPlayerJoin?.(msg.data);
                            break;
                        case 'player_quit':
                            callbacksRef.current.onPlayerQuit?.(msg.data);
                            break;
                    }
                } catch { }
            };

            ws.onclose = () => {
                setStatus('disconnected');
                if (reconnectAttempts.current < maxReconnectAttempts) {
                    reconnectAttempts.current++;
                    reconnectTimer.current = setTimeout(connect, 5000);
                }
            };

            ws.onerror = () => {
                setStatus('error');
            };

            wsRef.current = ws;
        } catch {
            setStatus('error');
        }
    }, [enabled]);

    const disconnect = useCallback(() => {
        clearTimeout(reconnectTimer.current);
        wsRef.current?.close();
        wsRef.current = null;
        setStatus('disconnected');
    }, []);

    const subscribeToPlayer = useCallback((uuid: string) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'subscribe_player', uuid }));
        }
    }, []);

    const unsubscribeFromPlayer = useCallback((uuid: string) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'unsubscribe_player', uuid }));
        }
    }, []);

    useEffect(() => {
        if (enabled) connect();
        return () => {
            clearTimeout(reconnectTimer.current);
            wsRef.current?.close();
        };
    }, [enabled, connect]);

    return {
        status,
        isConnected: status === 'connected',
        lastMessage,
        serverData,
        activities,
        playerUpdates,
        subscribeToPlayer,
        unsubscribeFromPlayer,
        connect,
        disconnect,
    };
}

export function useWebSocket(options: { url?: string; reconnectInterval?: number; maxReconnectAttempts?: number } = {}) {
    const {
        url = typeof window !== 'undefined'
            ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/ws`
            : '',
        reconnectInterval = 3000,
        maxReconnectAttempts = 10,
    } = options;

    const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectAttempts = useRef(0);
    const reconnectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    const connect = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) return;
        setStatus('connecting');
        try {
            const ws = new WebSocket(url);
            ws.onopen = () => { setStatus('connected'); reconnectAttempts.current = 0; };
            ws.onclose = () => {
                setStatus('disconnected');
                if (reconnectAttempts.current < maxReconnectAttempts) {
                    reconnectAttempts.current++;
                    reconnectTimer.current = setTimeout(connect, reconnectInterval);
                }
            };
            ws.onerror = () => setStatus('error');
            wsRef.current = ws;
        } catch { setStatus('error'); }
    }, [url, reconnectInterval, maxReconnectAttempts]);

    const disconnect = useCallback(() => {
        clearTimeout(reconnectTimer.current);
        wsRef.current?.close();
    }, []);

    const send = useCallback((type: string, payload: any) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type, ...payload }));
        }
    }, []);

    useEffect(() => { connect(); return () => { clearTimeout(reconnectTimer.current); wsRef.current?.close(); }; }, [connect]);

    return { status, isConnected: status === 'connected', send, connect, disconnect };
}
