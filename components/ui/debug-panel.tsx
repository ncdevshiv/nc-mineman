'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '@/hooks/use-auth';
import { useServerStats } from '@/hooks/use-server-stats';
import { useSpacetimeDBStatus } from '@/hooks/use-spacetimedb';
import { Badge } from './badge';
import {
    Bug, X, ChevronDown, ChevronUp, Wifi, WifiOff,
    Database, Server, Activity, Clock, RefreshCw
} from 'lucide-react';
import { clsx } from 'clsx';

interface LogEntry {
    timestamp: string;
    type: 'request' | 'response' | 'error' | 'ws' | 'info';
    message: string;
    data?: any;
}

export function DebugPanel() {
    const [isOpen, setIsOpen] = useState(false);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [activeTab, setActiveTab] = useState<'logs' | 'status' | 'ws'>('status');
    const logsRef = useRef<HTMLDivElement>(null);

    const { isAuthenticated } = useAuth();
    const { server, players, isLoading: statsLoading, error: statsError } = useServerStats(isAuthenticated ? 10000 : 0);
    const { isRunning: stdbRunning, tables } = useSpacetimeDBStatus();

    // Don't render debug panel for unauthenticated users
    if (!isAuthenticated) return null;

    // Keyboard shortcut: Ctrl+Shift+D
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'D') {
                e.preventDefault();
                setIsOpen(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Intercept fetch for logging
    useEffect(() => {
        const originalFetch = window.fetch.bind(window);
        const patchedFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
            const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url || 'unknown';
            const startTime = Date.now();

            setLogs(prev => [...prev.slice(-49), {
                timestamp: new Date().toISOString(),
                type: 'request',
                message: `→ ${init?.method || 'GET'} ${url}`,
            }]);

            try {
                const response = await originalFetch(input, init);
                const duration = Date.now() - startTime;

                setLogs(prev => [...prev.slice(-49), {
                    timestamp: new Date().toISOString(),
                    type: response.ok ? 'response' : 'error',
                    message: `← ${response.status} ${url} (${duration}ms)`,
                    data: { status: response.status, duration },
                }]);

                return response;
            } catch (error: any) {
                setLogs(prev => [...prev.slice(-49), {
                    timestamp: new Date().toISOString(),
                    type: 'error',
                    message: `✗ ${url} - ${error.message}`,
                }]);
                throw error;
            }
        };

        (window as any).fetch = patchedFetch;

        return () => {
            (window as any).fetch = originalFetch;
        };
    }, []);

    useEffect(() => {
        if (logsRef.current) {
            logsRef.current.scrollTop = logsRef.current.scrollHeight;
        }
    }, [logs]);

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-4 right-4 z-[200] p-3 rounded-xl bg-[#111827] border border-white/10 shadow-2xl hover:bg-white/5 transition-colors group"
                title="Debug Panel (Ctrl+Shift+D)"
            >
                <Bug className="size-5 text-white/40 group-hover:text-emerald-400 transition-colors" />
            </button>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-4 right-4 z-[200] w-[400px] max-h-[500px] bg-[#0a0f1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
                <div className="flex items-center gap-2">
                    <Bug className="size-4 text-emerald-400" />
                    <span className="text-sm font-bold text-white">Debug Panel</span>
                    <Badge variant="info" size="sm">Ctrl+Shift+D</Badge>
                </div>
                <button onClick={() => setIsOpen(false)} className="p-1 rounded-lg hover:bg-white/5 text-white/40">
                    <X className="size-4" />
                </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-white/[0.06]">
                {[
                    { id: 'status' as const, label: 'Status', icon: Activity },
                    { id: 'logs' as const, label: 'Logs', icon: RefreshCw },
                    { id: 'ws' as const, label: 'WebSocket', icon: Wifi },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={clsx(
                            'flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors',
                            activeTab === tab.id
                                ? 'text-emerald-400 border-b-2 border-emerald-400'
                                : 'text-white/30 hover:text-white/50'
                        )}
                    >
                        <tab.icon className="size-3" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="h-[350px] overflow-y-auto">
                {activeTab === 'status' && (
                    <div className="p-4 space-y-3">
                        <div className="flex items-center justify-between p-3 bg-white/[0.02] rounded-xl">
                            <div className="flex items-center gap-2">
                                <Server className="size-4 text-blue-400" />
                                <span className="text-sm text-white/60">Minecraft API</span>
                            </div>
                            <Badge variant={server ? 'success' : 'danger'} size="sm">
                                {server ? 'Connected' : 'Offline'}
                            </Badge>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-white/[0.02] rounded-xl">
                            <div className="flex items-center gap-2">
                                <Database className="size-4 text-purple-400" />
                                <span className="text-sm text-white/60">Database</span>
                            </div>
                            <Badge variant={stdbRunning ? 'success' : 'danger'} size="sm">
                                {stdbRunning ? 'Running' : 'Offline'}
                            </Badge>
                        </div>
                        {server && (
                            <>
                                <div className="flex items-center justify-between p-3 bg-white/[0.02] rounded-xl">
                                    <span className="text-sm text-white/60">TPS</span>
                                    <span className="text-sm font-bold text-white">{server.tps_1min?.toFixed(1)}</span>
                                </div>
                                <div className="flex items-center justify-between p-3 bg-white/[0.02] rounded-xl">
                                    <span className="text-sm text-white/60">Players</span>
                                    <span className="text-sm font-bold text-white">{server.online_players}/{server.max_players}</span>
                                </div>
                                <div className="flex items-center justify-between p-3 bg-white/[0.02] rounded-xl">
                                    <span className="text-sm text-white/60">Ping</span>
                                    <span className="text-sm font-bold text-white">{server.average_ping}ms</span>
                                </div>
                            </>
                        )}
                        {statsError && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
                                Failed to load server stats: {statsError.message || 'Minecraft server API is offline'}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'logs' && (
                    <div ref={logsRef} className="p-2 space-y-1 font-mono text-xs">
                        {logs.length === 0 ? (
                            <div className="text-center py-8 text-white/20">No logs yet</div>
                        ) : (
                            logs.map((log, i) => (
                                <div
                                    key={i}
                                    className={clsx(
                                        'px-2 py-1 rounded',
                                        log.type === 'error' && 'bg-red-500/10 text-red-400',
                                        log.type === 'request' && 'text-blue-400',
                                        log.type === 'response' && 'text-emerald-400',
                                        log.type === 'ws' && 'text-purple-400',
                                        log.type === 'info' && 'text-white/40',
                                    )}
                                >
                                    <span className="text-white/20 mr-2">
                                        {new Date(log.timestamp).toLocaleTimeString()}
                                    </span>
                                    {log.message}
                                </div>
                            ))
                        )}
                    </div>
                )}

                {activeTab === 'ws' && (
                    <div className="p-4 space-y-3">
                        <div className="text-center py-8 text-white/20 text-sm">
                            <Wifi className="size-8 mx-auto mb-2 opacity-30" />
                            WebSocket connection status will appear here
                        </div>
                    </div>
                )}
            </div>
        </motion.div>
    );
}
