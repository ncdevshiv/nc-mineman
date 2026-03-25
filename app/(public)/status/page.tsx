'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '@/hooks/use-auth';
import { useServerStats } from '@/hooks/use-server-stats';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Activity, Users, Server, Zap, Clock, Globe,
    Heart, Gamepad2, MapPin, Wifi, Cpu, HardDrive,
    ChevronRight, Signal
} from 'lucide-react';
import { clsx } from 'clsx';

function PulseIndicator({ active, size }: { active: boolean; size?: 'sm' | 'md' }) {
    const s = size === 'sm' ? 'size-1.5' : 'size-2';
    return (
        <span className="relative flex">
            {active && (
                <motion.span
                    animate={{ scale: [1, 2, 1], opacity: [0.6, 0, 0.6] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className={`absolute inline-flex rounded-full bg-cyan-400 ${s}`}
                />
            )}
            <span className={`relative inline-flex rounded-full ${s} ${active ? 'bg-cyan-400' : 'bg-white/20'}`} />
        </span>
    );
}

function TPSGauge({ tps, label }: { tps: number; label: string }) {
    const percentage = Math.min((tps / 20) * 100, 100);
    const color = tps >= 18 ? '#39FF14' : tps >= 15 ? '#FFB800' : '#FF3366';

    return (
        <div className="text-center">
            <div className="relative size-24 mx-auto">
                <svg className="size-full -rotate-90" viewBox="0 0 100 100">
                    <circle
                        cx="50" cy="50" r="42"
                        fill="none"
                        stroke="rgba(255,255,255,0.05)"
                        strokeWidth="8"
                    />
                    <motion.circle
                        cx="50" cy="50" r="42"
                        fill="none"
                        stroke={color}
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 42}`}
                        initial={{ strokeDashoffset: 2 * Math.PI * 42 }}
                        animate={{ strokeDashoffset: 2 * Math.PI * 42 * (1 - percentage / 100) }}
                        transition={{ duration: 1, ease: 'easeOut' }}
                        style={{ filter: `drop-shadow(0 0 8px ${color}60)` }}
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <motion.span
                        key={tps}
                        initial={{ scale: 1.2, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="text-2xl font-bold text-white data-value"
                        style={{ color }}
                    >
                        {tps.toFixed(1)}
                    </motion.span>
                </div>
            </div>
            <div className="text-[10px] text-white/40 mt-2 font-bold uppercase tracking-wider">{label}</div>
        </div>
    );
}

function PlayerCard({ player, index }: { player: any; index: number }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03 }}
            className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] hover:border-cyan-500/20 transition-all"
        >
            <div className="relative">
                <Avatar name={player.name} size="sm" online={player.is_online} />
                <div className="absolute -bottom-0.5 -right-0.5">
                    <PulseIndicator active={player.is_online} size="sm" />
                </div>
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white truncate">{player.name}</span>
                    {player.gamemode === 'CREATIVE' && (
                        <Badge variant="accent" size="sm">Creative</Badge>
                    )}
                </div>
                <div className="flex items-center gap-3 mt-1 text-[10px] text-white/30">
                    <span className="flex items-center gap-1">
                        <Heart className="size-2.5 text-red-400" /> {player.health?.toFixed(0) ?? '?'}
                    </span>
                    <span className="flex items-center gap-1">
                        <MapPin className="size-2.5" /> {player.x?.toFixed(0)}, {player.z?.toFixed(0)}
                    </span>
                </div>
            </div>
            <div className="text-right">
                <div className="text-[10px] text-white/30 font-mono">{player.world || 'world'}</div>
            </div>
        </motion.div>
    );
}

function ActivityItem({ activity, index }: { activity: any; index: number }) {
    const typeColors: Record<string, string> = {
        join: 'text-green-400',
        leave: 'text-red-400',
        chat: 'text-cyan-400',
        death: 'text-purple-400',
        achievement: 'text-amber-400',
    };

    return (
        <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.02 }}
            className="flex items-start gap-3 py-2"
        >
            <div className={clsx('text-[10px] font-bold uppercase tracking-wider mt-0.5', typeColors[activity.type] || 'text-white/30')}>
                {activity.type?.slice(0, 4)}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm text-white/60">
                    <span className="font-medium text-white">{activity.player}</span>{' '}
                    <span className="text-white/40">{activity.message}</span>
                </p>
                <p className="text-[10px] text-white/20 mt-0.5 font-mono">
                    {new Date(activity.timestamp).toLocaleTimeString()}
                </p>
            </div>
        </motion.div>
    );
}

function StatBlock({ icon: Icon, label, value, color }: {
    icon: React.ElementType;
    label: string;
    value: string;
    color: 'cyan' | 'amber' | 'green' | 'purple';
}) {
    const colorMap = {
        cyan: 'text-cyan-400',
        amber: 'text-amber-400',
        green: 'text-green-400',
        purple: 'text-purple-400',
    };

    return (
        <div className="hud-card p-4">
            <div className="flex items-center gap-2 mb-2">
                <Icon className={`size-4 ${colorMap[color]}`} />
                <span className="text-[10px] text-white/40 uppercase tracking-wider">{label}</span>
            </div>
            <div className={`text-xl font-bold data-value ${colorMap[color]}`}>{value}</div>
        </div>
    );
}

export default function StatusPage() {
    const { user } = useAuth();
    const { server, players, activities, isLoading, error } = useServerStats(user ? 3000 : 0);
    const [selectedTab, setSelectedTab] = useState<'players' | 'activity'>('players');

    // Show login prompt for unauthenticated users
    if (!user) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="hud-card p-8 text-center max-w-md"
                >
                    <div className="size-16 rounded-xl bg-cyan-500/10 flex items-center justify-center mx-auto mb-4 border border-cyan-500/20">
                        <Server className="size-8 text-cyan-400" />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2 tracking-wider">LIVE SERVER STATUS</h2>
                    <p className="text-white/40 text-sm mb-6">
                        Login to view real-time server statistics, player activity, and live TPS data.
                    </p>
                    <button
                        onClick={() => { window.location.href = '/api/auth/login'; }}
                        className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold hover:opacity-90 transition-opacity"
                    >
                        Login with Discord
                    </button>
                </motion.div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="hud-card p-8 text-center max-w-md"
                >
                    <div className="size-16 rounded-xl bg-red-500/10 flex items-center justify-center mx-auto mb-4 border border-red-500/20">
                        <Server className="size-8 text-red-400" />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2 tracking-wider">SERVER API OFFLINE</h2>
                    <p className="text-white/40 text-sm">
                        The Minecraft server stats API is not responding. Please check if the Serverstats plugin is running on port 8088.
                    </p>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                className="hud-card p-6"
            >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="size-12 rounded-xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
                            <Server className="size-6 text-cyan-400" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-white tracking-wider">LIVE SERVER DASHBOARD</h1>
                            <p className="text-xs text-white/40 mt-0.5">Real-time Minecraft server statistics</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <Badge variant={server ? 'success' : 'danger'} size="md">
                            <PulseIndicator active={!!server} />
                            {server ? 'ONLINE' : 'OFFLINE'}
                        </Badge>
                        <div className="flex items-center gap-1.5 text-xs text-white/30">
                            <Wifi className="size-3" />
                            Auto-refresh: 3s
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* TPS Gauges */}
            <div className="hud-card p-6">
                <div className="grid grid-cols-3 gap-8">
                    {isLoading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="text-center">
                                <Skeleton variant="circular" className="size-24 mx-auto" />
                                <Skeleton className="h-3 w-16 mx-auto mt-2" />
                            </div>
                        ))
                    ) : (
                        <>
                            <TPSGauge tps={server?.tps_1min ?? 20} label="1 Min" />
                            <TPSGauge tps={server?.tps_5min ?? 20} label="5 Min" />
                            <TPSGauge tps={server?.tps_15min ?? 20} label="15 Min" />
                        </>
                    )}
                </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatBlock icon={Users} label="Players" value={`${server?.online_players || 0}/${server?.max_players || 100}`} color="cyan" />
                <StatBlock icon={Zap} label="Avg Ping" value={`${server?.average_ping || 0}ms`} color="amber" />
                <StatBlock icon={Clock} label="Uptime" value={server?.uptime_seconds ? `${Math.floor(server.uptime_seconds / 3600)}h ${Math.floor((server.uptime_seconds % 3600) / 60)}m` : '0h'} color="green" />
                <StatBlock icon={Globe} label="Version" value={server?.version || 'Unknown'} color="purple" />
            </div>

            {/* Players & Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Players List */}
                <div className="hud-card p-5">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Users className="size-4 text-cyan-400" />
                            <span className="text-sm font-bold text-white uppercase tracking-wider">Online Players</span>
                        </div>
                        <Badge variant="info" size="sm">{players.length}</Badge>
                    </div>
                    <div className="space-y-1 max-h-[500px] overflow-y-auto pr-2">
                        {isLoading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="flex items-center gap-3 p-3">
                                    <Skeleton variant="circular" className="size-8" />
                                    <div className="flex-1">
                                        <Skeleton className="h-4 w-24" />
                                        <Skeleton className="h-3 w-32 mt-1" />
                                    </div>
                                </div>
                            ))
                        ) : players.length === 0 ? (
                            <div className="text-center py-12 text-white/30">
                                <Users className="size-12 mx-auto mb-3 opacity-30" />
                                <p className="text-sm">No players online</p>
                            </div>
                        ) : (
                            players.map((player, i) => (
                                <PlayerCard key={player.name} player={player} index={i} />
                            ))
                        )}
                    </div>
                </div>

                {/* Activity Feed */}
                <div className="hud-card p-5">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Activity className="size-4 text-green-400" />
                            <span className="text-sm font-bold text-white uppercase tracking-wider">Activity Feed</span>
                        </div>
                        <Badge variant="success" size="sm" pulse>
                            Live
                        </Badge>
                    </div>
                    <div className="max-h-[500px] overflow-y-auto pr-2 divide-y divide-white/[0.04]">
                        {isLoading ? (
                            Array.from({ length: 8 }).map((_, i) => (
                                <div key={i} className="py-2">
                                    <Skeleton className="h-4 w-full" />
                                    <Skeleton className="h-3 w-24 mt-1" />
                                </div>
                            ))
                        ) : activities.length === 0 ? (
                            <div className="text-center py-12 text-white/30">
                                <Activity className="size-12 mx-auto mb-3 opacity-30" />
                                <p className="text-sm">No recent activity</p>
                            </div>
                        ) : (
                            activities.map((activity, i) => (
                                <ActivityItem key={i} activity={activity} index={i} />
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
