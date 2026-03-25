'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '@/hooks/use-auth';
import { AppShell } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/error-debug-toast';
import { Users, Search, Eye, UserPlus, Heart, Flag, ChevronLeft, ChevronRight, Crown, Shield, Zap } from 'lucide-react';

function PulseIndicator({ active }: { active: boolean }) {
    return (
        <span className="relative flex size-2">
            {active && (
                <motion.span
                    animate={{ scale: [1, 1.8, 1], opacity: [0.7, 0, 0.7] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute inline-flex h-full w-full rounded-full bg-green-400"
                />
            )}
            <span className={`relative inline-flex rounded-full size-2 ${active ? 'bg-green-400' : 'bg-white/20'}`} />
        </span>
    );
}

function PlayerCard({ player, userId, onFriendRequest, onFollow, index }: {
    player: any;
    userId: string | undefined;
    onFriendRequest: (id: string) => void;
    onFollow: (id: string) => void;
    index: number;
}) {
    const roleColors: Record<string, string> = {
        owner: 'text-red-400 bg-red-500/10 border-red-500/30',
        admin: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
        god: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
        helper: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
        youtuber: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
        normal_member: 'text-white/40 bg-white/5 border-white/10',
    };

    const topRole = player.roles?.[0] || 'normal_member';

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(index * 0.02, 0.5) }}
            className="hud-card p-4 group hover:border-cyan-500/30 transition-all duration-300"
        >
            <div className="flex items-start gap-3">
                {/* Avatar with status */}
                <div className="relative">
                    <Avatar name={player.mc_username || player.site_name} size="lg" online={player.is_online} />
                    <div className="absolute -bottom-1 -right-1">
                        <PulseIndicator active={player.is_online} />
                    </div>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-bold text-white truncate group-hover:text-cyan-400 transition-colors">
                            {player.mc_username || player.site_name}
                        </span>
                        {topRole !== 'normal_member' && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border font-bold uppercase tracking-wider ${
                                roleColors[topRole] || roleColors.normal_member
                            }`}>
                                {topRole === 'owner' && <Crown className="size-2.5 inline mr-0.5" />}
                                {topRole === 'admin' && <Shield className="size-2.5 inline mr-0.5" />}
                                {topRole === 'god' && <Zap className="size-2.5 inline mr-0.5" />}
                                {topRole}
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-3 text-[10px] text-white/40 mb-3">
                        <span className="flex items-center gap-1">
                            <PulseIndicator active={player.is_online} />
                            {player.is_online ? 'Online' : 'Offline'}
                        </span>
                        {player.last_seen && (
                            <span>Last seen {new Date(player.last_seen).toLocaleDateString()}</span>
                        )}
                    </div>

                    {/* Roles */}
                    {player.roles?.length > 1 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                            {player.roles.slice(1, 3).map((r: string) => (
                                <Badge key={r} variant="default" size="sm">{r}</Badge>
                            ))}
                            {player.roles.length > 3 && (
                                <Badge variant="default" size="sm">+{player.roles.length - 3}</Badge>
                            )}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2">
                        <Link href={`/players/${player.id}`} className="flex-1">
                            <Button variant="ghost" size="sm" className="w-full text-xs" icon={<Eye className="size-3" />}>
                                View
                            </Button>
                        </Link>
                        {player.id !== userId && (
                            <>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    icon={<UserPlus className="size-3" />}
                                    onClick={() => onFriendRequest(player.id)}
                                    className="text-xs"
                                />
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    icon={<Heart className="size-3" />}
                                    onClick={() => onFollow(player.id)}
                                    className="text-xs hover:text-pink-400"
                                />
                            </>
                        )}
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

function PlayerSkeleton() {
    return (
        <div className="hud-card p-4">
            <div className="flex items-start gap-3">
                <Skeleton variant="circular" className="size-12" />
                <div className="flex-1">
                    <Skeleton className="h-4 w-32 mb-2" />
                    <Skeleton className="h-3 w-24 mb-3" />
                    <div className="flex gap-2">
                        <Skeleton className="h-8 w-16" />
                        <Skeleton className="h-8 w-8" />
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function PlayersPage() {
    const { user } = useAuth();
    const addToast = useToast(s => s.addToast);

    const [searchQuery, setSearchQuery] = useState('');
    const [players, setPlayers] = useState<any[]>([]);
    const [onlinePlayers, setOnlinePlayers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searching, setSearching] = useState(false);
    const [cursor, setCursor] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [totalCount, setTotalCount] = useState(0);

    const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const observerRef = useRef<IntersectionObserver | null>(null);
    const loadMoreRef = useRef<HTMLDivElement>(null);

    // Load online players
    useEffect(() => {
        loadOnlinePlayers();
    }, []);

    const loadOnlinePlayers = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/players?online=true&limit=50');
            if (res.ok) {
                const data = await res.json();
                setOnlinePlayers(data.players || []);
                setTotalCount(data.total || 0);
            }
        } catch {
        } finally {
            setLoading(false);
        }
    };

    // Debounced search with cursor pagination
    const debouncedSearch = useCallback((query: string, loadMore = false) => {
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

        if (!query.trim()) {
            setPlayers([]);
            setCursor(null);
            setHasMore(true);
            return;
        }

        searchTimeoutRef.current = setTimeout(async () => {
            setSearching(true);
            try {
                const params = new URLSearchParams({ q: query, limit: '20' });
                if (loadMore && cursor) {
                    params.set('cursor', cursor);
                } else {
                    setPlayers([]);
                    setCursor(null);
                }

                const res = await fetch(`/api/players?${params}`);
                if (res.ok) {
                    const data = await res.json();
                    if (loadMore) {
                        setPlayers(prev => [...prev, ...(data.players || [])]);
                    } else {
                        setPlayers(data.players || []);
                    }
                    setCursor(data.next_cursor);
                    setHasMore(data.has_more);
                    setTotalCount(data.total || 0);
                }
            } catch {
            } finally {
                setSearching(false);
            }
        }, loadMore ? 0 : 300);
    }, [cursor]);

    useEffect(() => {
        debouncedSearch(searchQuery);
        return () => {
            if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        };
    }, [searchQuery, debouncedSearch]);

    // Infinite scroll for search results
    useEffect(() => {
        if (!hasMore || !searchQuery.trim()) return;

        observerRef.current = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && !searching && hasMore) {
                    debouncedSearch(searchQuery, true);
                }
            },
            { threshold: 0.1 }
        );

        if (loadMoreRef.current) {
            observerRef.current.observe(loadMoreRef.current);
        }

        return () => {
            if (observerRef.current) observerRef.current.disconnect();
        };
    }, [hasMore, searching, searchQuery, debouncedSearch]);

    const sendFriendRequest = async (targetId: string) => {
        try {
            const res = await fetch('/api/users/me/requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ to_id: targetId, type: 'friend' }),
            });
            if (!res.ok) throw new Error('Failed to send request');
            addToast({ type: 'success', title: 'Sent', message: 'Friend request sent!' });
        } catch (err: any) {
            addToast({ type: 'error', title: 'Error', message: err.message });
        }
    };

    const followUser = async (targetId: string) => {
        try {
            const res = await fetch('/api/users/me/follows', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ target_id: targetId }),
            });
            if (!res.ok) throw new Error('Failed to follow');
            addToast({ type: 'success', title: 'Followed', message: 'You are now following this player.' });
        } catch (err: any) {
            addToast({ type: 'error', title: 'Error', message: err.message });
        }
    };

    const displayPlayers = searchQuery.trim() ? players : onlinePlayers;

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
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="size-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                                    <Users className="size-5 text-cyan-400" />
                                </div>
                                <div>
                                    <h1 className="text-xl font-bold text-white tracking-wider">PLAYERS DIRECTORY</h1>
                                    <p className="text-xs text-white/40 mt-0.5">
                                        {searchQuery.trim() ? (
                                            <>Search results: {totalCount.toLocaleString()} found</>
                                        ) : (
                                            <>{totalCount.toLocaleString()} total players • {onlinePlayers.length} online</>
                                        )}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Search */}
                    <div className="mt-4">
                        <Input
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search by username..."
                            icon={<Search className="size-4" />}
                            className="bg-white/5 border-white/10 focus:border-cyan-500/50"
                        />
                    </div>
                </motion.div>

                {/* Player Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    <AnimatePresence mode="popLayout">
                        {(loading || searching) && !searchQuery.trim() ? (
                            Array.from({ length: 8 }).map((_, i) => (
                                <PlayerSkeleton key={`skel-${i}`} />
                            ))
                        ) : displayPlayers.length === 0 ? (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="col-span-full text-center py-16"
                            >
                                <Users className="size-12 mx-auto mb-3 text-white/20" />
                                <p className="text-white/40">
                                    {searchQuery.trim() ? 'No players found' : 'No players online'}
                                </p>
                            </motion.div>
                        ) : (
                            displayPlayers.map((player, i) => (
                                <PlayerCard
                                    key={player.id}
                                    player={player}
                                    userId={user?.id}
                                    onFriendRequest={sendFriendRequest}
                                    onFollow={followUser}
                                    index={i}
                                />
                            ))
                        )}
                    </AnimatePresence>
                </div>

                {/* Load More Trigger */}
                {searchQuery.trim() && hasMore && (
                    <div ref={loadMoreRef} className="flex justify-center py-8">
                        {searching && (
                            <div className="flex items-center gap-3 text-white/40">
                                <div className="size-5 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin" />
                                <span className="text-sm">Loading more...</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Pagination info */}
                {searchQuery.trim() && !hasMore && players.length > 0 && (
                    <div className="text-center py-4 text-white/30 text-xs">
                        End of results • {players.length.toLocaleString()} players shown
                    </div>
                )}
            </div>
        </AppShell>
    );
}
