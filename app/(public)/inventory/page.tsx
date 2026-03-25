'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '@/hooks/use-auth';
import { AppShell } from '@/components/layout';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/error-debug-toast';
import {
  Package, Search, Gift, ArrowLeftRight, Gavel,
  Trash2, Send, Eye, ShoppingCart, Plus, Minus
} from 'lucide-react';

interface InventoryItem {
  id: string;
  user_id: string;
  item_name: string;
  item_type: string;
  quantity: number;
  metadata: string;
  acquired_from: string;
  acquired_at: string;
  is_hidden: boolean;
  is_frozen: boolean;
}

export default function InventoryPage() {
  const { user } = useAuth();
  const addToast = useToast(s => s.addToast);

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const [showGiftModal, setShowGiftModal] = useState(false);
  const [giftTarget, setGiftTarget] = useState('');
  const [giftSearchResults, setGiftSearchResults] = useState<any[]>([]);
  const [giftSearching, setGiftSearching] = useState(false);
  const [giftQuantity, setGiftQuantity] = useState(1);

  const [showSellModal, setShowSellModal] = useState(false);
  const [sellPrice, setSellPrice] = useState('');
  const [sellType, setSellType] = useState<'in-game' | 'off-game'>('in-game');

  const [showAuctionModal, setShowAuctionModal] = useState(false);
  const [auctionStartPrice, setAuctionStartPrice] = useState('');
  const [auctionDuration, setAuctionDuration] = useState('24');

  useEffect(() => {
    loadInventory();
  }, []);

  const loadInventory = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/inventory');
      if (res.ok) setItems(await res.json());
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedItems.size === filteredItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredItems.map(i => i.id)));
    }
  };

  const filteredItems = items.filter(item => {
    if (searchQuery && !item.item_name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const selectedItemData = items.filter(i => selectedItems.has(i.id));

  const searchGiftTarget = async (query: string) => {
    setGiftTarget(query);
    if (!query.trim()) { setGiftSearchResults([]); return; }
    setGiftSearching(true);
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
      if (res.ok) setGiftSearchResults(await res.json());
    } catch {
    } finally {
      setGiftSearching(false);
    }
  };

  const handleGift = async (targetId: string) => {
    if (selectedItems.size === 0) return;
    try {
      for (const itemId of selectedItems) {
        const res = await fetch('/api/inventory', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'transfer',
            item_id: itemId,
            to_user_id: targetId,
            quantity: giftQuantity,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Transfer failed');
        }
      }
      addToast({ type: 'success', title: 'Gifted', message: 'Items transferred successfully!' });
      setShowGiftModal(false);
      setGiftTarget('');
      setGiftSearchResults([]);
      setSelectedItems(new Set());
      loadInventory();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message });
    }
  };

  const handleSell = async () => {
    if (selectedItems.size === 0 || !sellPrice.trim()) return;
    try {
      for (const itemId of selectedItems) {
        const item = items.find(i => i.id === itemId);
        if (!item) continue;
        await fetch('/api/trades', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: sellType,
            item_name: item.item_name,
            item_description: `Selling from inventory. Quantity: ${item.quantity}`,
            asking_price: sellPrice,
          }),
        });
      }
      addToast({ type: 'success', title: 'Listed', message: 'Items listed for sale!' });
      setShowSellModal(false);
      setSellPrice('');
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message });
    }
  };

  const handleAuction = async () => {
    if (selectedItems.size === 0 || !auctionStartPrice.trim()) return;
    try {
      const item = selectedItemData[0];
      const endsAt = new Date(Date.now() + parseInt(auctionDuration) * 3600000).toISOString();
      const res = await fetch('/api/auctions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_name: item.item_name,
          item_description: item.metadata ? JSON.parse(item.metadata).description || '' : '',
          starting_price: Number(auctionStartPrice),
          ends_at: endsAt,
        }),
      });
      if (!res.ok) throw new Error('Failed to create auction');
      addToast({ type: 'success', title: 'Auction Created', message: 'Your auction is now live!' });
      setShowAuctionModal(false);
      setAuctionStartPrice('');
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message });
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-center justify-between gap-4"
        >
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Package className="size-7 text-emerald-400" />
              My Inventory
            </h1>
            <p className="text-white/40 mt-1">Manage your items - gift, sell, or auction</p>
          </div>
          <div className="flex gap-2">
            <Link href="/store">
              <Button variant="secondary" size="sm" icon={<ShoppingCart className="size-4" />}>Store</Button>
            </Link>
          </div>
        </motion.div>

        {/* Actions bar */}
        {selectedItems.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20"
          >
            <Badge variant="success">{selectedItems.size} selected</Badge>
            <div className="flex gap-2 ml-auto">
              <Button size="sm" variant="secondary" icon={<Gift className="size-3" />} onClick={() => setShowGiftModal(true)}>
                Gift
              </Button>
              <Button size="sm" variant="secondary" icon={<ArrowLeftRight className="size-3" />} onClick={() => setShowSellModal(true)}>
                Sell
              </Button>
              <Button size="sm" variant="secondary" icon={<Gavel className="size-3" />} onClick={() => setShowAuctionModal(true)}>
                Auction
              </Button>
            </div>
          </motion.div>
        )}

        {/* Search */}
        <div className="flex gap-3">
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search items..."
            icon={<Search className="size-4" />}
            className="flex-1"
          />
          <Button variant="ghost" size="sm" onClick={selectAll}>
            {selectedItems.size === filteredItems.length ? 'Deselect All' : 'Select All'}
          </Button>
        </div>

        {/* Items Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {loading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <Card key={i} variant="glass" padding="md">
                <Skeleton className="h-20 rounded-xl mb-3" />
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-1/2 mt-2" />
              </Card>
            ))
          ) : filteredItems.length === 0 ? (
            <div className="col-span-full text-center py-16 text-white/30">
              <Package className="size-12 mx-auto mb-3 opacity-30" />
              <p>Your inventory is empty</p>
              <Link href="/store">
                <Button variant="secondary" size="sm" className="mt-4">Visit Store</Button>
              </Link>
            </div>
          ) : (
            filteredItems.map((item, i) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <Card
                  variant="glass"
                  padding="md"
                  hover
                  onClick={() => toggleSelect(item.id)}
                  className={`cursor-pointer transition-all ${selectedItems.has(item.id) ? 'ring-2 ring-emerald-500/50 bg-emerald-500/5' : ''}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <Badge variant={item.is_frozen ? 'danger' : 'info'} size="sm">
                      {item.item_type}
                    </Badge>
                    <div className="flex items-center gap-1">
                      {item.is_frozen && <Badge variant="danger" size="sm">Frozen</Badge>}
                      <span className="text-xs text-white/30">x{item.quantity}</span>
                    </div>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-1">{item.item_name}</h3>
                  {item.metadata && item.metadata !== '{}' && (
                    <p className="text-sm text-white/40 line-clamp-2 mb-2">
                      {JSON.parse(item.metadata).description || ''}
                    </p>
                  )}
                  <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
                    <span className="text-xs text-white/30">
                      {new Date(item.acquired_at).toLocaleDateString()}
                    </span>
                    <span className="text-xs text-white/30">
                      from: {item.acquired_from || 'store'}
                    </span>
                  </div>
                </Card>
              </motion.div>
            ))
          )}
        </div>

        {/* Gift Modal */}
        <Modal
          open={showGiftModal}
          onClose={() => { setShowGiftModal(false); setGiftTarget(''); setGiftSearchResults([]); }}
          title="Gift Items"
          description={`Sending ${selectedItems.size} item(s)`}
        >
          <div className="space-y-4">
            <Input
              label="Search Player"
              value={giftTarget}
              onChange={e => searchGiftTarget(e.target.value)}
              placeholder="Search by Minecraft username..."
              icon={<Search className="size-4" />}
            />
            {giftSearching && (
              <div className="flex justify-center py-2">
                <div className="animate-spin size-5 border-2 border-emerald-500 border-t-transparent rounded-full" />
              </div>
            )}
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {giftSearchResults.map(r => (
                <div
                  key={r.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] cursor-pointer transition-colors"
                  onClick={() => handleGift(r.id)}
                >
                  <div className="size-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-sm font-bold text-emerald-400">
                    {(r.mc_username || r.site_name || '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-white">{r.mc_username || r.site_name}</div>
                    <div className="text-xs text-white/30">{r.email}</div>
                  </div>
                  <Send className="size-4 text-emerald-400" />
                </div>
              ))}
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <Button variant="ghost" onClick={() => { setShowGiftModal(false); setGiftTarget(''); }}>Cancel</Button>
            </div>
          </div>
        </Modal>

        {/* Sell Modal */}
        <Modal
          open={showSellModal}
          onClose={() => { setShowSellModal(false); setSellPrice(''); }}
          title="Sell Items"
          description={`Listing ${selectedItems.size} item(s)`}
        >
          <div className="space-y-4">
            <div className="flex gap-2">
              {(['in-game', 'off-game'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setSellType(t)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    sellType === t
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-white/[0.03] text-white/40 border border-white/[0.06]'
                  }`}
                >
                  {t === 'in-game' ? 'In-Game' : 'Off-Game'}
                </button>
              ))}
            </div>
            <Input
              label="Asking Price"
              value={sellPrice}
              onChange={e => setSellPrice(e.target.value)}
              placeholder="e.g., 50 diamonds or $10"
              required
            />
            <div className="p-3 bg-white/[0.02] rounded-xl border border-white/[0.04]">
              <div className="text-xs text-white/40 mb-2">Items to sell:</div>
              {selectedItemData.map(item => (
                <div key={item.id} className="text-sm text-white/70">{item.item_name} x{item.quantity}</div>
              ))}
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <Button variant="ghost" onClick={() => { setShowSellModal(false); setSellPrice(''); }}>Cancel</Button>
              <Button onClick={handleSell} disabled={!sellPrice.trim()}>List for Sale</Button>
            </div>
          </div>
        </Modal>

        {/* Auction Modal */}
        <Modal
          open={showAuctionModal}
          onClose={() => { setShowAuctionModal(false); setAuctionStartPrice(''); }}
          title="Create Auction"
        >
          <div className="space-y-4">
            {selectedItemData.length > 0 && (
              <div className="p-3 bg-white/[0.02] rounded-xl border border-white/[0.04]">
                <div className="text-sm font-medium text-white">{selectedItemData[0].item_name}</div>
                <div className="text-xs text-white/30">x{selectedItemData[0].quantity}</div>
              </div>
            )}
            <Input
              label="Starting Price"
              type="number"
              value={auctionStartPrice}
              onChange={e => setAuctionStartPrice(e.target.value)}
              placeholder="e.g., 10"
              required
            />
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-white/50 uppercase tracking-wider">Duration (hours)</label>
              <div className="flex gap-2">
                {['1', '6', '12', '24', '48'].map(d => (
                  <button
                    key={d}
                    onClick={() => setAuctionDuration(d)}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                      auctionDuration === d
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-white/[0.03] text-white/40 border border-white/[0.06]'
                    }`}
                  >
                    {d}h
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <Button variant="ghost" onClick={() => { setShowAuctionModal(false); setAuctionStartPrice(''); }}>Cancel</Button>
              <Button onClick={handleAuction} disabled={!auctionStartPrice.trim()}>Create Auction</Button>
            </div>
          </div>
        </Modal>
      </div>
    </AppShell>
  );
}
