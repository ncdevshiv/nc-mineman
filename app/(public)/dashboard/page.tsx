'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { useAuth } from '@/hooks/use-auth';
import { useServerStats } from '@/hooks/use-server-stats';
import { AppShell } from '@/components/layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Activity, Users, Server, MessageSquare, ArrowLeftRight,
    ShoppingCart, Clock, Shield, Zap, Heart, UserPlus, Package,
    Search, Wifi, Cpu, HardDrive, Signal, ChevronRight
} from 'lucide-react';

function PulseIndicator({ active }: { active: boolean }) {
    return (
        <span className="relative flex size-2.5">
            {active && (
                <motion.span
                    animate={{ scale: [1, 1.8, 1], opacity: [0.7, 0, 0.7] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute inline-flex h-full w-full rounded-full bg-cyan-400"
                />
            )}
            <span
                className={`relative inline-flex rounded-full size-2.5 ${
                    active ? 'bg-cyan-400' : 'bg-white/20'
                }`}
            />
        </span>
    );
}

function StatBlock({
    icon: Icon,
    label,
    value,
    unit,
    trend,
    variant = 'cyan',
    loading
}: {
    icon: React.ElementType;
    label: string;
    value: string | number;
    unit?: string;
    trend?: string;
    variant?: 'cyan' | 'amber' | 'green' | 'red';
    loading?: boolean;
}) {
    const colors = {
        cyan: 'border-cyan-500/30 text-cyan-400',
        amber: 'border-amber-500/30 text-amber-400',
        green: 'border-green-500/30 text-green-400',
        red: 'border-red-500/30 text-red-400',
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`hud-card p-4 ${colors[variant]}`}
        >
            <div className="flex items-start justify-between mb-3">
                <div className="size-10 rounded-lg bg-white/5 flex items-center justify-center">
                    <Icon className="size-5" />
                </div>
                {trend && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-green-400 flex items-center gap-1">
                        <Signal className="size-3" /> {trend}
                    </span>
                )}
            </div>
            <div className="mt-2">
                {loading ? (
                    <Skeleton className="h-8 w-24" />
                ) : (
                    <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold text-white data-value">{value}</span>
                        {unit && <span className="text-sm text-white/40">{unit}</span>}
                    </div>
                )}
                <div className="text-xs text-white/40 mt-1 uppercase tracking-wider font-medium">{label}</div>
            </div>
        </motion.div>
    );
}

function ServerHealthPanel({ server, loading }: { server: any; loading: boolean }) {
    const tps = server?.tps_1min ?? 20;
    const tpsColor = tps >= 18 ? 'text-green-400' : tps >= 15 ? 'text-amber-400' : 'text-red-400';
    const tpsGlow = tps >= 18 ? 'shadow-green-500/20' : tps >= 15 ? 'shadow-amber-500/20' : 'shadow-red-500/20';

    return (
        <div className="hud-card p-5">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="size-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                        <Server className="size-4 text-cyan-400" />
                    </div>
                    <span className="text-sm font-bold text-white uppercase tracking-wider">Server Health</span>
                </div>
                <Badge variant={server ? 'success' : 'danger'} size="sm">
                    <PulseIndicator active={!!server} /> {server ? 'ONLINE' : 'OFFLINE'}
                </Badge>
            </div>

            <div className="grid grid-cols-2 gap-4">
                {/* TPS */}
                <div className={`bg-white/5 rounded-xl p-4 border border-white/5 ${tpsGlow}`}>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] uppercase tracking-wider text-white/40">TPS</span>
                        <Cpu className="size-3 text-white/30" />
                    </div>
                    {loading ? (
                        <Skeleton className="h-8 w-16" />
                    ) : (
                        <span className={`text-3xl font-bold data-value ${tpsColor}`}>{tps.toFixed(1)}</span>
                    )}
                    <div className="text-[10px] text-white/30 mt-1">1 min average</div>
                </div>

                {/* Players */}
                <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] uppercase tracking-wider text-white/40">Players</span>
                        <Users className="size-3 text-white/30" />
                    </div>
                    {loading ? (
                        <Skeleton className="h-8 w-16" />
                    ) : (
                        <span className="text-3xl font-bold text-white data-value">
                            {server?.online_players || 0}
                            <span className="text-sm text-white/40">/{server?.max_players || 100}</span>
                        </span>
                    )}
                    <div className="text-[10px] text-white/30 mt-1">online now</div>
                </div>

                {/* Ping */}
                <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] uppercase tracking-wider text-white/40">Ping</span>
                        <Wifi className="size-3 text-white/30" />
                    </div>
                    {loading ? (
                        <Skeleton className="h-8 w-16" />
                    ) : (
                        <span className={`text-3xl font-bold data-value ${
                            (server?.average_ping || 0) < 100 ? 'text-green-400' :
                            (server?.average_ping || 0) < 200 ? 'text-amber-400' : 'text-red-400'
                        }`}>
                            {server?.average_ping || 0}
                            <span className="text-sm text-white/40">ms</span>
                        </span>
                    )}
                    <div className="text-[10px] text-white/30 mt-1">avg latency</div>
                </div>

                {/* Uptime */}
                <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] uppercase tracking-wider text-white/40">Uptime</span>
                        <Clock className="size-3 text-white/30" />
                    </div>
                    {loading ? (
                        <Skeleton className="h-8 w-16" />
                    ) : (
                        <span className="text-3xl font-bold text-white data-value">
                            {server?.uptime_seconds ? `${Math.floor(server.uptime_seconds / 3600)}h` : '0h'}
                        </span>
                    )}
                    <div className="text-[10px] text-white/30 mt-1">continuous</div>
                </div>
            </div>
        </div>
    );
}

function ActivityFeed({ activities }: { activities: any[] }) {
    if (!activities.length) {
        return (
            <div className="text-center py-8 text-white/30 text-sm">
                <Activity className="size-8 mx-auto mb-2 opacity-30" />
                No recent activity
            </div>
        );
    }

    return (
        <div className="space-y-1">
            {activities.slice(0, 8).map((activity, i) => (
                <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-start gap-3 p-3 rounded-lg hover:bg-white/[0.02] transition-colors group"
                >
                    <div className="size-8 rounded bg-white/5 flex items-center justify-center shrink-0 group-hover:bg-cyan-500/10 transition-colors">
                        <Activity className="size-4 text-white/30 group-hover:text-cyan-400 transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm text-white/60">
                            <span className="font-bold text-white group-hover:text-cyan-400 transition-colors">{activity.player}</span>{' '}
                            <span className="text-white/40">{activity.message}</span>
                        </p>
                        <p className="text-[10px] text-white/20 mt-0.5 font-mono">
                            {new Date(activity.timestamp).toLocaleTimeString()}
                        </p>
                    </div>
                </motion.div>
            ))}
        </div>
    );
}

function QuickActions() {
    const actions = [
        { icon: Package, label: 'Inventory', href: '/inventory', color: 'hover:border-cyan-500/30 hover:bg-cyan-500/5' },
        { icon: ArrowLeftRight, label: 'Trades', href: '/trades', color: 'hover:border-purple-500/30 hover:bg-purple-500/5' },
        { icon: ShoppingCart, label: 'Store', href: '/store', color: 'hover:border-amber-500/30 hover:bg-amber-500/5' },
        { icon: Search, label: 'Players', href: '/players', color: 'hover:border-green-500/30 hover:bg-green-500/5' },
        { icon: MessageSquare, label: 'Tickets', href: '/tickets', color: 'hover:border-red-500/30 hover:bg-red-500/5' },
        { icon: Shield, label: 'Profile', href: '/profile', color: 'hover:border-blue-500/30 hover:bg-blue-500/5' },
    ];

    return (
        <div className="grid grid-cols-3 gap-2">
            {actions.map((action) => (
                <Link key={action.label} href={action.href}>
                    <motion.div
                        whileHover={{ y: -2 }}
                        className={`hud-card p-3 text-center cursor-pointer border-transparent ${action.color}`}
                    >
                        <action.icon className="size-5 mx-auto mb-1 text-white/40" />
                        <span className="text-[10px] uppercase tracking-wider text-white/60 font-medium">{action.label}</span>
                    </motion.div>
                </Link>
            ))}
        </div>
    );
}

function FriendsList() {
    const [friends, setFriends] = useState<any[]>([]);

    useEffect(() => {
        fetch('/api/users/me/friends')
            .then(r => r.ok ? r.json() : [])
            .then(setFriends)
            .catch(() => {});
    }, []);

    if (friends.length === 0) {
        return (
            <div className="text-center py-4 text-white/30 text-xs">
                <Heart className="size-6 mx-auto mb-2 opacity-30" />
                No friends yet.{' '}
                <Link href="/social" className="text-cyan-400 hover:underline">Find players</Link>
            </div>
        );
    }

    return (
        <div className="space-y-1">
            {friends.slice(0, 5).map((friend: any) => (
                <div key={friend.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/[0.02] transition-colors">
                    <Avatar name={friend.mc_username || friend.name} size="sm" online={friend.online} />
                    <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white truncate">
                            {friend.mc_username || friend.name}
                        </div>
                        <div className="text-[10px] text-white/30 flex items-center gap-1">
                            <PulseIndicator active={friend.online} />
                            {friend.online ? 'Online' : 'Offline'}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

export default function DashboardPage() {
    const { user, isLoading: authLoading } = useAuth();
    const { server, players, activities, isLoading: statsLoading } = useServerStats(5000);
    const [tickets, setTickets] = useState<any[]>([]);

    useEffect(() => {
        fetch('/api/tickets').then(r => r.ok ? r.json() : []).then(setTickets).catch(() => { });
    }, []);

    const playerData = user?.mc_username
        ? players.find(p => p.name.toLowerCase() === user.mc_username?.toLowerCase())
        : null;

    const openTickets = tickets.filter(t => t.status === 'open').length;

    return (
        <AppShell>
            <div className="space-y-6">
                {/* Welcome Banner */}
                <motion.div
                    initial={{ opacity: 0, y: -12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative overflow-hidden rounded-xl hud-card p-6 md:p-8"
                >
                    {/* Background Effects */}
                    <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-[100px] pointer-events-none" />
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-amber-500/5 rounded-full blur-[80px] pointer-events-none" />

                    <div className="relative z-10">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="size-1.5 rounded-full bg-cyan-400 animate-pulse" />
                                    <span className="text-[10px] uppercase tracking-[0.2em] text-cyan-400 font-bold">
                                        SYSTEM ONLINE
                                    </span>
                                </div>
                                <h1 className="text-2xl md:text-3xl font-bold text-white">
                                    Welcome back,{' '}
                                    <span className="text-cyan-400 text-glow-cyan">
                                        {user?.site_name || user?.mc_username || 'Player'}
                                    </span>
                                </h1>
                                <div className="flex items-center gap-4 mt-3">
                                    {playerData?.is_online ? (
                                        <div className="flex items-center gap-2 text-green-400">
                                            <PulseIndicator active /> <span className="text-sm">Online on server</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 text-white/40">
                                            <PulseIndicator active={false} /> <span className="text-sm">Offline</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Link href="/store">
                                    <Button variant="secondary" size="sm" icon={<ShoppingCart className="size-4" />}>
                                        Store
                                    </Button>
                                </Link>
                                <Link href="/trades">
                                    <Button size="sm" icon={<ArrowLeftRight className="size-4" />}>
                                        Trade Hub
                                    </Button>
                                </Link>
                            </div>
                        </div>

                        {/* Quick Stats Bar */}
                        <div className="grid grid-cols-4 gap-3 mt-6">
                            <div className="bg-white/5 rounded-lg p-3 border border-white/5">
                                <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Playtime</div>
                                <div className="text-lg font-bold text-white data-value">
                                    {Math.floor((playerData?.total_playtime_seconds || 0) / 3600)}h
                                </div>
                            </div>
                            <div className="bg-white/5 rounded-lg p-3 border border-white/5">
                                <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Status</div>
                                <div className="text-lg font-bold">
                                    {playerData?.is_banned ? (
                                        <span className="text-red-400">BANNED</span>
                                    ) : playerData?.is_online ? (
                                        <span className="text-green-400">ONLINE</span>
                                    ) : (
                                        <span className="text-white/50">OFFLINE</span>
                                    )}
                                </div>
                            </div>
                            <div className="bg-white/5 rounded-lg p-3 border border-white/5">
                                <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Tickets</div>
                                <div className="text-lg font-bold text-white data-value">{openTickets}</div>
                            </div>
                            <div className="bg-white/5 rounded-lg p-3 border border-white/5">
                                <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Roles</div>
                                <div className="text-lg font-bold text-white data-value">{user?.roles?.length || 0}</div>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatBlock
                        icon={Server}
                        label="Server TPS"
                        value={server?.tps_1min?.toFixed(1) || '20.0'}
                        variant="cyan"
                        loading={statsLoading}
                    />
                    <StatBlock
                        icon={Users}
                        label="Players Online"
                        value={`${server?.online_players || 0}/${server?.max_players || 100}`}
                        variant="green"
                        loading={statsLoading}
                    />
                    <StatBlock
                        icon={Zap}
                        label="Avg Ping"
                        value={`${server?.average_ping || 0}`}
                        unit="ms"
                        variant="amber"
                        loading={statsLoading}
                    />
                    <StatBlock
                        icon={Clock}
                        label="Uptime"
                        value={server?.uptime_seconds ? `${Math.floor(server.uptime_seconds / 3600)}h` : '0h'}
                        variant="cyan"
                        loading={statsLoading}
                    />
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Activity Feed */}
                    <div className="lg:col-span-2">
                        <div className="hud-card p-5">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <div className="size-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                                        <Activity className="size-4 text-cyan-400" />
                                    </div>
                                    <span className="text-sm font-bold text-white uppercase tracking-wider">Live Activity</span>
                                </div>
                                <Badge variant="success" size="sm" pulse>
                                    {activities.length} events
                                </Badge>
                            </div>
                            <ActivityFeed activities={activities} />
                        </div>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-4">
                        {/* Server Health */}
                        <ServerHealthPanel server={server} loading={statsLoading} />

                        {/* Quick Actions */}
                        <div className="hud-card p-4">
                            <div className="flex items-center gap-2 mb-4">
                                <HardDrive className="size-4 text-amber-400" />
                                <span className="text-sm font-bold text-white uppercase tracking-wider">Quick Actions</span>
                            </div>
                            <QuickActions />
                        </div>

                        {/* Friends */}
                        <div className="hud-card p-4">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <Heart className="size-4 text-pink-400" />
                                    <span className="text-sm font-bold text-white uppercase tracking-wider">Friends</span>
                                </div>
                                <Link href="/social">
                                    <Button variant="ghost" size="sm" icon={<UserPlus className="size-3" />}>
                                        Add
                                    </Button>
                                </Link>
                            </div>
                            <FriendsList />
                        </div>

                        {/* Account Status */}
                        <div className="hud-card p-4">
                            <div className="flex items-center gap-2 mb-4">
                                <Shield className="size-4 text-blue-400" />
                                <span className="text-sm font-bold text-white uppercase tracking-wider">Account Status</span>
                            </div>
                            {playerData?.is_banned ? (
                                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                                    <p className="text-red-400 font-bold flex items-center gap-2 text-sm">
                                        <Shield className="size-4" /> BANNED
                                    </p>
                                    <p className="text-xs text-red-300/70 mt-1">
                                        Reason: {playerData.ban_reason || 'No reason specified'}
                                    </p>
                                </div>
                            ) : (
                                <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center justify-between">
                                    <span className="text-green-400 font-bold flex items-center gap-2 text-sm">
                                        <Shield className="size-4" /> Good Standing
                                    </span>
                                    <Badge variant="success" size="sm">Active</Badge>
                                </div>
                            )}
                            <div className="mt-4 space-y-2">
                                <div className="flex justify-between text-xs">
                                    <span className="text-white/40">Whitelisted</span>
                                    <span className="text-white font-medium">{playerData?.is_whitelisted ? 'Yes' : 'No'}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-white/40">Gamemode</span>
                                    <span className="text-white font-medium font-mono">{playerData?.gamemode || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-white/40">Health</span>
                                    <span className="text-white font-medium data-value">{playerData?.health ?? 'N/A'}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AppShell>
    );
}
