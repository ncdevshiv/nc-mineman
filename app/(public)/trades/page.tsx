'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '@/hooks/use-auth';
import { AppShell } from '@/components/layout';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/error-debug-toast';
import {
    ArrowLeftRight, Plus, Search, Filter, Clock,
    Package, MessageSquare, Check, X, Eye
} from 'lucide-react';

interface TradeListing {
    id: string;
    seller_id: string;
    seller_name: string;
    type: 'in-game' | 'off-game';
    item_name: string;
    item_description: string;
    asking_price: string;
    status: 'open' | 'negotiating' | 'completed' | 'cancelled';
    created_at: string;
}

export default function TradesPage() {
    const { user } = useAuth();
    const addToast = useToast(s => s.addToast);

    const [listings, setListings] = useState<TradeListing[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'in-game' | 'off-game'>('all');
    const [searchQuery, setSearchQuery] = useState('');

    const [showCreate, setShowCreate] = useState(false);
    const [createForm, setCreateForm] = useState({
        type: 'in-game' as 'in-game' | 'off-game',
        item_name: '',
        item_description: '',
        asking_price: '',
    });
    const [creating, setCreating] = useState(false);

    const [selectedTrade, setSelectedTrade] = useState<TradeListing | null>(null);
    const [chatMessage, setChatMessage] = useState('');

    useEffect(() => {
        loadListings();
    }, []);

    const loadListings = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/trades');
            if (res.ok) setListings(await res.json());
        } catch { } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!createForm.item_name.trim() || !createForm.asking_price.trim()) return;
        setCreating(true);
        try {
            const res = await fetch('/api/trades', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(createForm),
            });
            if (!res.ok) throw new Error('Failed to create listing');
            addToast({ type: 'success', title: 'Created', message: 'Trade listing created!' });
            setShowCreate(false);
            setCreateForm({ type: 'in-game', item_name: '', item_description: '', asking_price: '' });
            loadListings();
        } catch (err: any) {
            addToast({ type: 'error', title: 'Error', message: err.message });
        } finally {
            setCreating(false);
        }
    };

    const filteredListings = listings.filter(l => {
        if (filter !== 'all' && l.type !== filter) return false;
        if (searchQuery && !l.item_name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
    });

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
                            <ArrowLeftRight className="size-7 text-emerald-400" />
                            Trade Hub
                        </h1>
                        <p className="text-white/40 mt-1">Buy, sell, and trade items with other players</p>
                    </div>
                    <Button icon={<Plus className="size-4" />} onClick={() => setShowCreate(true)}>
                        Create Listing
                    </Button>
                </motion.div>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <Input
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search items..."
                        icon={<Search className="size-4" />}
                        className="flex-1"
                    />
                    <div className="flex gap-2">
                        {(['all', 'in-game', 'off-game'] as const).map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${filter === f
                                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                        : 'text-white/40 hover:text-white/60 border border-transparent'
                                    }`}
                            >
                                {f === 'all' ? 'All' : f === 'in-game' ? 'In-Game' : 'Off-Game'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Listings Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {loading ? (
                        Array.from({ length: 6 }).map((_, i) => (
                            <Card key={i} variant="glass" padding="md">
                                <div className="space-y-3">
                                    <div className="h-5 bg-white/[0.06] rounded w-2/3 animate-pulse" />
                                    <div className="h-4 bg-white/[0.06] rounded w-full animate-pulse" />
                                    <div className="h-4 bg-white/[0.06] rounded w-1/2 animate-pulse" />
                                </div>
                            </Card>
                        ))
                    ) : filteredListings.length === 0 ? (
                        <div className="col-span-full text-center py-16 text-white/30">
                            <ArrowLeftRight className="size-12 mx-auto mb-3 opacity-30" />
                            <p>No trade listings found</p>
                            <Button variant="secondary" size="sm" className="mt-4" onClick={() => setShowCreate(true)}>
                                Create the first listing
                            </Button>
                        </div>
                    ) : (
                        filteredListings.map((listing, i) => (
                            <motion.div
                                key={listing.id}
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                            >
                                <Card variant="glass" padding="md" hover onClick={() => setSelectedTrade(listing)}>
                                    <div className="flex items-start justify-between mb-3">
                                        <Badge variant={listing.type === 'in-game' ? 'info' : 'accent'} size="sm">
                                            {listing.type}
                                        </Badge>
                                        <Badge
                                            variant={
                                                listing.status === 'open' ? 'success' :
                                                    listing.status === 'negotiating' ? 'warning' :
                                                        'default'
                                            }
                                            size="sm"
                                        >
                                            {listing.status}
                                        </Badge>
                                    </div>
                                    <h3 className="text-lg font-bold text-white mb-1">{listing.item_name}</h3>
                                    <p className="text-sm text-white/40 line-clamp-2 mb-4">{listing.item_description}</p>
                                    <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
                                        <div className="flex items-center gap-2">
                                            <Avatar name={listing.seller_name} size="sm" />
                                            <span className="text-sm text-white/60">{listing.seller_name}</span>
                                        </div>
                                        <div className="text-emerald-400 font-bold">{listing.asking_price}</div>
                                    </div>
                                    <div className="flex items-center gap-1 mt-3 text-xs text-white/20">
                                        <Clock className="size-3" />
                                        {new Date(listing.created_at).toLocaleDateString()}
                                    </div>
                                </Card>
                            </motion.div>
                        ))
                    )}
                </div>

                {/* Create Modal */}
                <Modal
                    open={showCreate}
                    onClose={() => setShowCreate(false)}
                    title="Create Trade Listing"
                    description="List an item for trade"
                >
                    <form onSubmit={handleCreate} className="space-y-4">
                        <div className="flex gap-2">
                            {(['in-game', 'off-game'] as const).map(t => (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => setCreateForm({ ...createForm, type: t })}
                                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${createForm.type === t
                                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                            : 'bg-white/[0.03] text-white/40 border border-white/[0.06]'
                                        }`}
                                >
                                    {t === 'in-game' ? '🎮 In-Game Item' : '💰 Off-Game'}
                                </button>
                            ))}
                        </div>
                        <Input
                            label="Item Name"
                            value={createForm.item_name}
                            onChange={e => setCreateForm({ ...createForm, item_name: e.target.value })}
                            placeholder="e.g., Diamond Sword"
                            required
                        />
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-white/50 uppercase tracking-wider">Description</label>
                            <textarea
                                value={createForm.item_description}
                                onChange={e => setCreateForm({ ...createForm, item_description: e.target.value })}
                                placeholder="Describe the item..."
                                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 min-h-[80px] resize-none"
                            />
                        </div>
                        <Input
                            label="Asking Price"
                            value={createForm.asking_price}
                            onChange={e => setCreateForm({ ...createForm, asking_price: e.target.value })}
                            placeholder="e.g., 50 diamonds or $10"
                            required
                        />
                        <div className="flex gap-3 justify-end pt-2">
                            <Button variant="ghost" type="button" onClick={() => setShowCreate(false)}>Cancel</Button>
                            <Button type="submit" loading={creating}>Create Listing</Button>
                        </div>
                    </form>
                </Modal>

                {/* Trade Detail Modal */}
                <Modal
                    open={!!selectedTrade}
                    onClose={() => setSelectedTrade(null)}
                    title={selectedTrade?.item_name}
                    size="lg"
                >
                    {selectedTrade && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <Avatar name={selectedTrade.seller_name} size="md" />
                                <div>
                                    <div className="font-medium text-white">{selectedTrade.seller_name}</div>
                                    <div className="text-xs text-white/30">Seller</div>
                                </div>
                                <Badge variant={selectedTrade.type === 'in-game' ? 'info' : 'accent'} className="ml-auto">
                                    {selectedTrade.type}
                                </Badge>
                            </div>
                            <p className="text-white/60">{selectedTrade.item_description}</p>
                            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                                <div className="text-xs text-emerald-400/60 uppercase tracking-wider mb-1">Asking Price</div>
                                <div className="text-2xl font-bold text-emerald-400">{selectedTrade.asking_price}</div>
                            </div>
                            {selectedTrade.seller_id !== user?.id && selectedTrade.status === 'open' && (
                                <div className="flex gap-3">
                                    <Button className="flex-1" icon={<MessageSquare className="size-4" />}>
                                        Start Negotiation
                                    </Button>
                                    <Button variant="secondary" className="flex-1" icon={<Check className="size-4" />}>
                                        Accept Price
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </Modal>
            </div>
        </AppShell>
    );
}
