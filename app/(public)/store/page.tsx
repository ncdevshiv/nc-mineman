'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '@/hooks/use-auth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/error-debug-toast';
import {
  ShoppingCart, Search, Filter, Star, Package,
  Plus, Minus, Trash2, CreditCard, History
} from 'lucide-react';

interface StoreItem {
  id: string;
  name: string;
  price: number;
  category: string;
  display_image: string;
  is_active: boolean;
  metadata: string;
}

interface CartItem extends StoreItem {
  quantity: number;
}

export default function StorePage() {
  const { user, isAdmin } = useAuth();
  const addToast = useToast(s => s.addToast);

  const [items, setItems] = useState<StoreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [purchasing, setPurchasing] = useState(false);

  const [purchases, setPurchases] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    loadItems();
    if (user) loadPurchases();
  }, [user]);

  const loadItems = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/store/manage');
      if (res.ok) {
        const data = await res.json();
        setItems(data.filter((i: StoreItem) => i.is_active));
      }
    } catch { } finally {
      setLoading(false);
    }
  };

  const loadPurchases = async () => {
    try {
      const res = await fetch('/api/store/purchases');
      if (res.ok) setPurchases(await res.json());
    } catch { }
  };

  const addToCart = (item: StoreItem) => {
    setCart(prev => {
      const existing = prev.find(c => c.id === item.id);
      if (existing) {
        return prev.map(c => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, { ...item, quantity: 1 }];
    });
    addToast({ type: 'success', title: 'Added', message: `${item.name} added to cart.` });
  };

  const updateCartQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(c => {
      if (c.id !== id) return c;
      const newQty = c.quantity + delta;
      return newQty > 0 ? { ...c, quantity: newQty } : c;
    }).filter(c => c.quantity > 0));
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (!user) {
      addToast({ type: 'info', title: 'Login Required', message: 'Please login to complete your purchase.' });
      window.location.href = '/api/auth/login';
      return;
    }
    setPurchasing(true);
    try {
      const res = await fetch('/api/store/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: cart.map(c => ({ id: c.id, quantity: c.quantity })) }),
      });
      if (!res.ok) throw new Error('Purchase failed');
      addToast({ type: 'success', title: 'Purchased!', message: 'Your items have been purchased.' });
      setCart([]);
      setShowCart(false);
      loadPurchases();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message });
    } finally {
      setPurchasing(false);
    }
  };

  const categories = ['all', ...new Set(items.map(i => i.category))];

  const filteredItems = items.filter(item => {
    if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
    if (searchQuery && !item.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-center justify-between gap-4"
        >
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <ShoppingCart className="size-7 text-emerald-400" />
              Store
            </h1>
            <p className="text-white/40 mt-1">Exclusive ranks, cosmetics, and perks</p>
          </div>
          <div className="flex gap-3">
            {user && (
              <Button variant="secondary" icon={<History className="size-4" />} onClick={() => setShowHistory(true)}>
                History
              </Button>
            )}
            <Button
              icon={<ShoppingCart className="size-4" />}
              onClick={() => setShowCart(true)}
            >
              Cart ({cart.length})
            </Button>
            {isAdmin && (
              <Link href="/admin/store">
                <Button variant="accent" icon={<Package className="size-4" />}>
                  Edit Store
                </Button>
              </Link>
            )}
          </div>
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
          <div className="flex gap-2 overflow-x-auto pb-2">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${selectedCategory === cat
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'text-white/40 hover:text-white/60 border border-transparent'
                  }`}
              >
                {cat === 'all' ? 'All' : cat}
              </button>
            ))}
          </div>
        </div>

        {/* Items Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {loading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <Card key={i} variant="glass" padding="md">
                <Skeleton className="h-40 rounded-xl mb-4" />
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-1/2 mt-2" />
                <Skeleton className="h-10 w-full mt-4 rounded-xl" />
              </Card>
            ))
          ) : filteredItems.length === 0 ? (
            <div className="col-span-full text-center py-16 text-white/30">
              <Package className="size-12 mx-auto mb-3 opacity-30" />
              <p>No items found</p>
            </div>
          ) : (
            filteredItems.map((item, i) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card variant="glass" padding="none" hover className="overflow-hidden">
                  {/* Image */}
                  <div className="h-40 bg-gradient-to-br from-emerald-500/10 to-teal-500/5 flex items-center justify-center relative overflow-hidden">
                    {item.display_image ? (
                      <img src={item.display_image} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <Package className="size-16 text-white/10" />
                    )}
                    <Badge variant="info" size="sm" className="absolute top-3 right-3">
                      {item.category}
                    </Badge>
                  </div>
                  <div className="p-4">
                    <h3 className="text-lg font-bold text-white mb-1">{item.name}</h3>
                    <p className="text-sm text-white/40 line-clamp-2 mb-4">
                      {JSON.parse(item.metadata || '{}').description || 'No description'}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-bold text-emerald-400">${item.price.toFixed(2)}</span>
                      <Button size="sm" onClick={() => addToCart(item)} icon={<Plus className="size-3" />}>
                        Add
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))
          )}
        </div>

        {/* Cart Modal */}
        <Modal
          open={showCart}
          onClose={() => setShowCart(false)}
          title="Shopping Cart"
          description={`${cart.length} item${cart.length !== 1 ? 's' : ''}`}
          size="lg"
        >
          {cart.length === 0 ? (
            <div className="text-center py-8 text-white/30">
              <ShoppingCart className="size-12 mx-auto mb-3 opacity-30" />
              <p>Your cart is empty</p>
            </div>
          ) : (
            <div className="space-y-4">
              {cart.map(item => (
                <div key={item.id} className="flex items-center gap-4 p-3 bg-white/[0.02] rounded-xl border border-white/[0.04]">
                  <div className="size-12 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <Package className="size-6 text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-white truncate">{item.name}</div>
                    <div className="text-sm text-emerald-400">${item.price.toFixed(2)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateCartQuantity(item.id, -1)}
                      className="p-1.5 rounded-lg hover:bg-white/5 text-white/40"
                    >
                      <Minus className="size-4" />
                    </button>
                    <span className="text-white font-medium w-6 text-center">{item.quantity}</span>
                    <button
                      onClick={() => updateCartQuantity(item.id, 1)}
                      className="p-1.5 rounded-lg hover:bg-white/5 text-white/40"
                    >
                      <Plus className="size-4" />
                    </button>
                    <button
                      onClick={() => updateCartQuantity(item.id, -item.quantity)}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400 ml-2"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              ))}
              <div className="border-t border-white/[0.06] pt-4 flex items-center justify-between">
                <div>
                  <div className="text-sm text-white/40">Total</div>
                  <div className="text-2xl font-bold text-white">${cartTotal.toFixed(2)}</div>
                </div>
                <Button
                  icon={<CreditCard className="size-4" />}
                  onClick={handleCheckout}
                  loading={purchasing}
                >
                  Checkout
                </Button>
              </div>
            </div>
          )}
        </Modal>

        {/* Purchase History Modal */}
        <Modal
          open={showHistory}
          onClose={() => setShowHistory(false)}
          title="Purchase History"
          size="lg"
        >
          {purchases.length === 0 ? (
            <div className="text-center py-8 text-white/30">
              <History className="size-12 mx-auto mb-3 opacity-30" />
              <p>No purchases yet</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {purchases.map((p, i) => (
                <div key={i} className="p-3 bg-white/[0.02] rounded-xl border border-white/[0.04]">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-white">{p.item_name || 'Item'}</div>
                    <Badge variant="success" size="sm">Completed</Badge>
                  </div>
                  <div className="text-xs text-white/30 mt-1">
                    {new Date(p.created_at).toLocaleDateString()} • ${p.amount?.toFixed(2) || '0.00'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal>
      </div>
  );
}
