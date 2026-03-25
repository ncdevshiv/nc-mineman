'use client';

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '@/hooks/use-auth';
import { useServerStats } from '@/hooks/use-server-stats';
import { useSpacetimeDBStatus } from '@/hooks/use-spacetimedb';
import { useServerStarWebSocket } from '@/hooks/use-websocket';
import { AppShell } from '@/components/layout';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge, OnlineDot } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Eye, Activity, Users, Server, Database, Shield,
    AlertTriangle, CheckCircle, Clock, TrendingUp,
    Wifi, Zap, MessageSquare, ArrowLeftRight, ShoppingCart
} from 'lucide-react';
import { clsx } from 'clsx';

function HealthIndicator({ label, status, detail }: { label: string; status: 'healthy' | 'warning' | 'critical'; detail?: string }) {
    const colors = {
        healthy: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
        warning: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
        critical: 'bg-red-500/10 border-red-500/20 text-red-400',
    };

    const icons = {
        healthy: <CheckCircle className="size-5" />,
        warning: <AlertTriangle className="size-5" />,
        critical: <AlertTriangle className="size-5" />,
    };

    return (
        <div className={clsx('p-4 rounded-xl border flex items-center gap-3', colors[status])}>
            {icons[status]}
            <div className="flex-1">
                <div className="font-bold text-sm">{label}</div>
                {detail && <div className="text-xs opacity-70 mt-0.5">{detail}</div>}
            </div>
            <Badge variant={status === 'healthy' ? 'success' : status === 'warning' ? 'warning' : 'danger'} size="sm">
                {status}
            </Badge>
        </div>
    );
}

function MetricGauge({ label, value, max, unit, color }: { label: string; value: number; max: number; unit: string; color: string }) {
    const percentage = Math.min((value / max) * 100, 100);

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
                <span className="text-white/40">{label}</span>
                <span className="font-bold text-white">{value.toFixed(1)}{unit}</span>
            </div>
            <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
                <motion.div
                    className={clsx('h-full rounded-full', color)}
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                />
            </div>
        </div>
    );
}

export default function GodViewPage() {
    const { user, isAdmin, isGod } = useAuth();
    const { server, players, activities, isLoading } = useServerStats(5000);
    const { isRunning: stdbRunning, tables } = useSpacetimeDBStatus();
    const { isConnected: wsConnected, status: wsStatus } = useServerStarWebSocket({ enabled: true });

    const [systemStats, setSystemStats] = useState<any>(null);

    useEffect(() => {
        fetch('/api/spacetimedb/metrics').then(r => r.ok ? r.json() : null).then(setSystemStats).catch(() => { });
    }, []);

    const healthChecks = [
        {
            label: 'Minecraft Server API',
            status: server ? 'healthy' as const : 'critical' as const,
            detail: server ? `Port 8088 • ${server.online_players} players` : 'Not responding on port 8088',
        },
        {
            label: 'WebSocket (Real-time)',
            status: wsConnected ? 'healthy' as const : wsStatus === 'connecting' ? 'warning' as const : 'critical' as const,
            detail: wsConnected ? 'Port 8089 • Connected' : `Port 8089 • ${wsStatus}`,
        },
        {
            label: 'Database',
            status: stdbRunning ? 'healthy' as const : 'critical' as const,
            detail: stdbRunning ? `${tables.length} tables active` : 'Database offline',
        },
        {
            label: 'Server TPS',
            status: (server?.tps_1min ?? 0) >= 18 ? 'healthy' as const : (server?.tps_1min ?? 0) >= 15 ? 'warning' as const : 'critical' as const,
            detail: `${server?.tps_1min?.toFixed(1) ?? 'N/A'} TPS (1min avg)`,
        },
        {
            label: 'Player Capacity',
            status: (server?.online_players ?? 0) < (server?.max_players ?? 100) * 0.9 ? 'healthy' as const : 'warning' as const,
            detail: `${server?.online_players ?? 0}/${server?.max_players ?? 100} players`,
        },
    ];

    const overallHealth = healthChecks.every(h => h.status === 'healthy')
        ? 'healthy'
        : healthChecks.some(h => h.status === 'critical')
            ? 'critical'
            : 'warning';

    return (
        <AppShell>
            <div className="space-y-6">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                    <div>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                            <Eye className="size-7 text-amber-400" />
                            God View
                        </h1>
                        <p className="text-white/40 mt-1">System observability dashboard (read-only)</p>
                    </div>
                    <Badge
                        variant={overallHealth === 'healthy' ? 'success' : overallHealth === 'warning' ? 'warning' : 'danger'}
                        size="md"
                        pulse={overallHealth !== 'healthy'}
                    >
                        System {overallHealth}
                    </Badge>
                </motion.div>

                {/* Health Checks */}
                <Card variant="glass" padding="md">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Shield className="size-5 text-emerald-400" />
                            System Health
                        </CardTitle>
                    </CardHeader>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {healthChecks.map(check => (
                            <HealthIndicator key={check.label} {...check} />
                        ))}
                    </div>
                </Card>

                {/* Metrics Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Server Metrics */}
                    <Card variant="glass" padding="md">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Server className="size-5 text-blue-400" />
                                Server Metrics
                            </CardTitle>
                        </CardHeader>
                        <div className="space-y-4">
                            <MetricGauge label="TPS (1min)" value={server?.tps_1min ?? 0} max={20} unit="" color="bg-emerald-500" />
                            <MetricGauge label="TPS (5min)" value={server?.tps_5min ?? 0} max={20} unit="" color="bg-blue-500" />
                            <MetricGauge label="TPS (15min)" value={server?.tps_15min ?? 0} max={20} unit="" color="bg-purple-500" />
                            <MetricGauge label="Avg Ping" value={server?.average_ping ?? 0} max={200} unit="ms" color="bg-amber-500" />
                        </div>
                    </Card>

                    {/* Player Stats */}
                    <Card variant="glass" padding="md">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Users className="size-5 text-emerald-400" />
                                Player Stats
                            </CardTitle>
                        </CardHeader>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-white/40 text-sm">Online</span>
                                <span className="text-2xl font-bold text-white">{server?.online_players ?? 0}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-white/40 text-sm">Max Capacity</span>
                                <span className="text-2xl font-bold text-white">{server?.max_players ?? 100}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-white/40 text-sm">Banned</span>
                                <span className="text-2xl font-bold text-red-400">
                                    {players.filter(p => p.is_banned).length}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-white/40 text-sm">Whitelisted</span>
                                <span className="text-2xl font-bold text-emerald-400">
                                    {players.filter(p => p.is_whitelisted).length}
                                </span>
                            </div>
                        </div>
                    </Card>

                    {/* Database Status */}
                    <Card variant="glass" padding="md">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Database className="size-5 text-purple-400" />
                                Database
                            </CardTitle>
                        </CardHeader>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-white/40 text-sm">Status</span>
                                <Badge variant={stdbRunning ? 'success' : 'danger'} size="sm">
                                    {stdbRunning ? 'Online' : 'Offline'}
                                </Badge>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-white/40 text-sm">Tables</span>
                                <span className="text-white font-bold">{tables.length}</span>
                            </div>
                            <div className="mt-3">
                                <div className="text-xs text-white/30 mb-2">Tables</div>
                                <div className="flex flex-wrap gap-1">
                                    {tables.slice(0, 8).map(t => (
                                        <Badge key={t} variant="default" size="sm">{t}</Badge>
                                    ))}
                                    {tables.length > 8 && <Badge variant="default" size="sm">+{tables.length - 8}</Badge>}
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Recent Activity */}
                <Card variant="glass" padding="md">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Activity className="size-5 text-emerald-400" />
                            Recent Activity (Last 20)
                        </CardTitle>
                    </CardHeader>
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                        {activities.slice(0, 20).map((activity, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.02 }}
                                className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/[0.02] transition-colors"
                            >
                                <div className="size-2 rounded-full bg-emerald-500/50 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <span className="text-sm text-white/70">
                                        <span className="font-medium text-white">{activity.player}</span> {activity.message}
                                    </span>
                                </div>
                                <span className="text-xs text-white/20 shrink-0">
                                    {new Date(activity.timestamp).toLocaleTimeString()}
                                </span>
                            </motion.div>
                        ))}
                        {activities.length === 0 && (
                            <div className="text-center py-8 text-white/30 text-sm">No recent activity</div>
                        )}
                    </div>
                </Card>
            </div>
        </AppShell>
    );
}
