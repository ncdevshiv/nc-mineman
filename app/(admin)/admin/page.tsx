'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion, useInView } from 'motion/react';
import { useServerStats } from '@/hooks/use-server-stats';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/error-debug-toast';
import { AppShell } from '@/components/layout';
import siteConfig from '@/lib/site.config';
import {
    Shield, Users, Settings, Store, Eye, Search,
    UserPlus, UserMinus, Ban, Clock, Activity,
    Server, MessageSquare, ArrowLeftRight, ShoppingCart,
    AlertTriangle, Palette, ChevronRight, Crown, Zap,
    HardDrive, Database, Globe, TrendingUp
} from 'lucide-react';

interface UserRecord {
    id: string;
    email: string;
    mc_username: string;
    discord_username: string;
    roles: string[];
    site_name: string;
    created_at: string;
    is_online?: boolean;
}

function StatCard({ icon: Icon, label, value, color, delay }: {
    icon: React.ElementType;
    label: string;
    value: string | number;
    color: string;
    delay: number;
}) {
    const colorMap: Record<string, { bg: string; text: string; border: string }> = {
        cyan: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/30' },
        green: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/30' },
        amber: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
        purple: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30' },
        red: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30' },
    };

    const styles = colorMap[color] || colorMap.cyan;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay }}
            className={`hud-card p-4 ${styles.border}`}
        >
            <div className="flex items-center gap-3">
                <div className={`size-10 rounded-lg ${styles.bg} flex items-center justify-center`}>
                    <Icon className={`size-5 ${styles.text}`} />
                </div>
                <div>
                    <div className="text-[10px] text-white/40 uppercase tracking-wider">{label}</div>
                    <div className="text-2xl font-bold text-white data-value">{value}</div>
                </div>
            </div>
        </motion.div>
    );
}

function parseDurationToMinutes(d: string): number {
    const match = d.match(/^(\d+)(d|h|m|s)$/);
    if (!match) return 1440;
    const val = parseInt(match[1]);
    const unit = match[2];
    switch (unit) {
        case 'd': return val * 1440;
        case 'h': return val * 60;
        case 'm': return val;
        case 's': return Math.ceil(val / 60);
        default: return 1440;
    }
}

export default function AdminPage() {
    const { user, isAdmin } = useAuth();
    const { server, players } = useServerStats(10000);
    const addToast = useToast(s => s.addToast);

    const [users, setUsers] = useState<UserRecord[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [ticketCount, setTicketCount] = useState(0);
    const [tradeCount, setTradeCount] = useState(0);

    const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
    const [showRoleModal, setShowRoleModal] = useState(false);
    const [userRoles, setUserRoles] = useState<string[]>([]);

    const [showBanModal, setShowBanModal] = useState(false);
    const [banReason, setBanReason] = useState('');
    const [banDuration, setBanDuration] = useState('');

    useEffect(() => {
        loadUsers();
        loadStats();
    }, []);

    const loadUsers = async () => {
        setLoadingUsers(true);
        try {
            const res = await fetch('/api/users');
            if (res.ok) setUsers(await res.json());
        } catch { } finally {
            setLoadingUsers(false);
        }
    };

    const loadStats = async () => {
        try {
            const [ticketsRes, tradesRes] = await Promise.all([
                fetch('/api/tickets').then(r => r.ok ? r.json() : []).catch(() => []),
                fetch('/api/trades').then(r => r.ok ? r.json() : []).catch(() => []),
            ]);
            setTicketCount(Array.isArray(ticketsRes) ? ticketsRes.filter((t: any) => t.status === 'open').length : 0);
            setTradeCount(Array.isArray(tradesRes) ? tradesRes.filter((t: any) => t.status === 'open').length : 0);
        } catch {}
    };

    const openRoleModal = (u: UserRecord) => {
        setSelectedUser(u);
        setUserRoles(u.roles || []);
        setShowRoleModal(true);
    };

    const saveRoles = async () => {
        if (!selectedUser) return;
        try {
            const res = await fetch(`/api/users/${selectedUser.id}/roles`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roles: userRoles }),
            });
            if (!res.ok) throw new Error('Failed to update roles');
            addToast({ type: 'success', title: 'Updated', message: 'Roles updated.' });
            setShowRoleModal(false);
            loadUsers();
        } catch (err: any) {
            addToast({ type: 'error', title: 'Error', message: err.message });
        }
    };

    const handleBan = async () => {
        if (!selectedUser) return;
        try {
            const res = await fetch(`/api/users/${selectedUser.id}/ban`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason: banReason, duration: banDuration }),
            });
            if (!res.ok) throw new Error('Failed to ban user');

            if (selectedUser.mc_username) {
                const durationMinutes = banDuration ? parseDurationToMinutes(banDuration) : null;
                await fetch('/api/serverstats/proxy?path=moderation', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'ban',
                        moderatorUuid: user?.id || 'system',
                        targetUuid: selectedUser.mc_username,
                        reason: banReason || 'Banned by admin',
                        durationMinutes,
                    }),
                }).catch(() => {});
            }

            addToast({ type: 'success', title: 'Banned', message: 'User has been banned.' });
            setShowBanModal(false);
            setBanReason('');
            setBanDuration('');
            loadUsers();
        } catch (err: any) {
            addToast({ type: 'error', title: 'Error', message: err.message });
        }
    };

    const handleUnban = async (userId: string, mcUsername: string) => {
        try {
            await fetch(`/api/moderation/${userId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'unban' }),
            });
            if (mcUsername) {
                await fetch('/api/serverstats/proxy?path=moderation', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'unban',
                        moderatorUuid: user?.id || 'system',
                        targetUuid: mcUsername,
                    }),
                }).catch(() => {});
            }
            addToast({ type: 'success', title: 'Unbanned', message: 'User has been unbanned.' });
            loadUsers();
        } catch (err: any) {
            addToast({ type: 'error', title: 'Error', message: err.message });
        }
    };

    const allRoles = ['owner', 'admin', 'god', 'helper', 'youtuber', 'normal_member'];

    const filteredUsers = users.filter(u => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
            u.mc_username?.toLowerCase().includes(q) ||
            u.email?.toLowerCase().includes(q) ||
            u.site_name?.toLowerCase().includes(q)
        );
    });

    const stats = {
        totalUsers: users.length,
        onlinePlayers: server?.online_players || 0,
        openTickets: ticketCount,
        activeTrades: tradeCount,
    };

    return (
        <AppShell>
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
                                <Shield className="size-6 text-cyan-400" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-white tracking-wider">ADMIN CONTROL</h1>
                                <p className="text-xs text-white/40 mt-0.5">Manage users, roles, and site configuration</p>
                            </div>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                            <Link href="/admin/servers">
                                <Button variant="secondary" size="sm" icon={<Server className="size-4" />}>
                                    Servers
                                </Button>
                            </Link>
                            <Link href="/admin/roles">
                                <Button variant="secondary" size="sm" icon={<Settings className="size-4" />}>
                                    Roles
                                </Button>
                            </Link>
                            <Link href="/admin/branding">
                                <Button variant="secondary" size="sm" icon={<Palette className="size-4" />}>
                                    Branding
                                </Button>
                            </Link>
                            <Link href="/admin/store">
                                <Button variant="secondary" size="sm" icon={<Store className="size-4" />}>
                                    Store
                                </Button>
                            </Link>
                            <Link href="/admin/config">
                                <Button variant="secondary" size="sm" icon={<Settings className="size-4" />}>
                                    Config
                                </Button>
                            </Link>
                            <Link href="/god">
                                <Button size="sm" icon={<Eye className="size-4" />}>
                                    God View
                                </Button>
                            </Link>
                        </div>
                    </div>
                </motion.div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard icon={Users} label="Total Users" value={stats.totalUsers} color="cyan" delay={0.1} />
                    <StatCard icon={Activity} label="Online Players" value={stats.onlinePlayers} color="green" delay={0.2} />
                    <StatCard icon={MessageSquare} label="Open Tickets" value={stats.openTickets} color="amber" delay={0.3} />
                    <StatCard icon={ArrowLeftRight} label="Active Trades" value={stats.activeTrades} color="purple" delay={0.4} />
                </div>

                {/* User Management */}
                <div className="hud-card p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                        <div className="flex items-center gap-3">
                            <div className="size-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                                <Users className="size-5 text-purple-400" />
                            </div>
                            <span className="text-sm font-bold text-white uppercase tracking-wider">User Management</span>
                        </div>
                        <Input
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search users..."
                            icon={<Search className="size-4" />}
                            className="w-full sm:w-64 bg-white/5 border-white/10"
                        />
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-white/10">
                                    <th className="text-left text-[10px] font-bold text-white/40 uppercase tracking-wider px-4 py-3">User</th>
                                    <th className="text-left text-[10px] font-bold text-white/40 uppercase tracking-wider px-4 py-3">MC Username</th>
                                    <th className="text-left text-[10px] font-bold text-white/40 uppercase tracking-wider px-4 py-3">Roles</th>
                                    <th className="text-left text-[10px] font-bold text-white/40 uppercase tracking-wider px-4 py-3">Joined</th>
                                    <th className="text-right text-[10px] font-bold text-white/40 uppercase tracking-wider px-4 py-3">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loadingUsers ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <tr key={i} className="border-b border-white/5">
                                            {Array.from({ length: 5 }).map((_, j) => (
                                                <td key={j} className="px-4 py-3">
                                                    <Skeleton className="h-4 w-full" />
                                                </td>
                                            ))}
                                        </tr>
                                    ))
                                ) : filteredUsers.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="text-center py-8 text-white/30">No users found</td>
                                    </tr>
                                ) : (
                                    filteredUsers.map(u => (
                                        <tr key={u.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <Avatar name={u.mc_username || u.email} size="sm" online={u.is_online} />
                                                    <div>
                                                        <div className="text-sm font-medium text-white">{u.site_name || u.mc_username}</div>
                                                        <div className="text-xs text-white/30">{u.email}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <code className="text-xs text-cyan-400 bg-cyan-500/10 px-2 py-1 rounded">
                                                    {u.mc_username || '—'}
                                                </code>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-wrap gap-1">
                                                    {(u.roles || []).slice(0, 3).map(r => (
                                                        <Badge
                                                            key={r}
                                                            variant={r === 'admin' || r === 'owner' ? 'danger' : r === 'god' ? 'accent' : 'default'}
                                                            size="sm"
                                                        >
                                                            {r}
                                                        </Badge>
                                                    ))}
                                                    {(u.roles || []).length > 3 && (
                                                        <Badge variant="default" size="sm">+{u.roles.length - 3}</Badge>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-xs text-white/30">
                                                {new Date(u.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        icon={<Settings className="size-3" />}
                                                        onClick={() => openRoleModal(u)}
                                                    >
                                                        Roles
                                                    </Button>
                                                    <Button
                                                        variant="danger"
                                                        size="sm"
                                                        icon={<Ban className="size-3" />}
                                                        onClick={() => { setSelectedUser(u); setShowBanModal(true); }}
                                                    />
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Role Modal */}
                <Modal
                    open={showRoleModal}
                    onClose={() => setShowRoleModal(false)}
                    title={`Edit Roles: ${selectedUser?.mc_username || selectedUser?.email}`}
                >
                    <div className="space-y-3">
                        {allRoles.map(role => {
                            const roleColors: Record<string, string> = {
                                owner: 'border-red-500/30 bg-red-500/5',
                                admin: 'border-amber-500/30 bg-amber-500/5',
                                god: 'border-purple-500/30 bg-purple-500/5',
                                helper: 'border-blue-500/30 bg-blue-500/5',
                                youtuber: 'border-cyan-500/30 bg-cyan-500/5',
                                normal_member: 'border-white/10 bg-white/5',
                            };
                            return (
                                <label
                                    key={role}
                                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-white/[0.02] transition-colors ${roleColors[role]}`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={userRoles.includes(role)}
                                        onChange={e => {
                                            if (e.target.checked) {
                                                setUserRoles(prev => [...prev, role]);
                                            } else {
                                                setUserRoles(prev => prev.filter(r => r !== role));
                                            }
                                        }}
                                        className="size-4 rounded border-white/20 bg-transparent text-cyan-500 focus:ring-cyan-500"
                                    />
                                    <div className="flex items-center gap-2">
                                        {role === 'owner' && <Crown className="size-4 text-red-400" />}
                                        {role === 'admin' && <Shield className="size-4 text-amber-400" />}
                                        {role === 'god' && <Zap className="size-4 text-purple-400" />}
                                        <div>
                                            <div className="text-sm font-medium text-white capitalize">{role.replace('_', ' ')}</div>
                                            <div className="text-[10px] text-white/30">
                                                {role === 'owner' && 'Full system control'}
                                                {role === 'admin' && 'Full authorization'}
                                                {role === 'god' && 'Ceremonial with moderation'}
                                                {role === 'helper' && 'Ticket management, QA'}
                                                {role === 'youtuber' && 'Creator role'}
                                                {role === 'normal_member' && 'Default member access'}
                                            </div>
                                        </div>
                                    </div>
                                </label>
                            );
                        })}
                    </div>
                    <div className="flex gap-3 justify-end pt-4">
                        <Button variant="ghost" onClick={() => setShowRoleModal(false)}>Cancel</Button>
                        <Button onClick={saveRoles}>Save Roles</Button>
                    </div>
                </Modal>

                {/* Ban Modal */}
                <Modal
                    open={showBanModal}
                    onClose={() => setShowBanModal(false)}
                    title={`Ban User: ${selectedUser?.mc_username}`}
                >
                    <div className="space-y-4">
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
                            <AlertTriangle className="size-4 inline mr-2" />
                            This action will prevent the user from accessing the server.
                        </div>
                        <Input
                            label="Reason"
                            value={banReason}
                            onChange={e => setBanReason(e.target.value)}
                            placeholder="Reason for ban"
                            className="bg-white/5 border-white/10"
                        />
                        <Input
                            label="Duration (optional)"
                            value={banDuration}
                            onChange={e => setBanDuration(e.target.value)}
                            placeholder="e.g., 7d, 30d, permanent"
                            className="bg-white/5 border-white/10"
                        />
                        <div className="flex gap-3 justify-end pt-2">
                            <Button variant="ghost" onClick={() => setShowBanModal(false)}>Cancel</Button>
                            <Button variant="danger" onClick={handleBan}>Ban User</Button>
                        </div>
                    </div>
                </Modal>
            </div>
        </AppShell>
    );
}
