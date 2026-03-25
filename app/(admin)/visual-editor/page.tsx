"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { AppShell } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/error-debug-toast";
import { CopyPlus, Edit2, Plus, Trash2, ArrowLeft, Save } from "lucide-react";
import { TiltCard } from "@/components/ui/3d-card";

export default function VisualStoreEditor() {
const [items, setItems] = useState<any[]>([]);
const [loading, setLoading] = useState(true);
const [isEditing, setIsEditing] = useState<any | null>(null);
const [saving, setSaving] = useState(false);
const addToast = useToast((s) => s.addToast);

const fetchItems = async () => {
try {
const res = await fetch("/api/store/manage");
if (res.ok) setItems(await res.json());
} catch {
addToast({ type: "error", title: "Fetch Failed", message: "Could not load store items" });
} finally {
setLoading(false);
}
};

useEffect(() => { fetchItems(); }, []);

const saveItem = async (e: React.FormEvent) => {
e.preventDefault();
if (!isEditing) return;
setSaving(true);
try {
const res = await fetch("/api/store/manage", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify(isEditing)
});
if (!res.ok) throw new Error("Failed to save");
addToast({ type: "success", title: "Saved", message: "Item updated successfully." });
setIsEditing(null);
fetchItems();
} catch (err: any) {
addToast({ type: "error", title: "Save Error", message: err.message });
} finally {
setSaving(false);
}
};

const deleteItem = async (id: string) => {
if (!confirm("Are you sure?")) return;
try {
const res = await fetch(`/api/store/manage?id=${id}`, { method: "DELETE" });
if (!res.ok) throw new Error("Delete failed");
addToast({ type: "success", title: "Deleted", message: "Item removed." });
fetchItems();
} catch (err: any) {
addToast({ type: "error", title: "Delete Error", message: err.message });
}
};

if (loading) {
return (
<AppShell>
<div className="flex items-center justify-center h-[60vh]">
<div className="animate-spin size-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
</div>
</AppShell>
);
}

return (
<AppShell>
<div className="space-y-6">
{/* Header */}
<motion.div
initial={{ opacity: 0, y: -12 }}
animate={{ opacity: 1, y: 0 }}
className="flex flex-col md:flex-row md:items-center justify-between gap-4"
>
<div className="flex items-center gap-3">
<Link href="/admin">
<Button variant="ghost" size="sm" icon={<ArrowLeft className="size-4" />}>
Back
</Button>
</Link>
<div>
<h1 className="text-2xl font-bold text-white">Visual Store Editor</h1>
<p className="text-white/40 mt-1">Manage store items with live preview</p>
</div>
</div>
<Button
icon={<Plus className="size-4" />}
onClick={() => setIsEditing({ name: "", price: 0, category: "Ranks", display_image: "", is_active: true })}
>
Add Item
</Button>
</motion.div>

{/* Edit Form */}
{isEditing && (
<motion.div
initial={{ opacity: 0, y: 20 }}
animate={{ opacity: 1, y: 0 }}
>
<Card variant="glass" padding="lg" className="border-emerald-500/30">
<h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
<Edit2 className="size-5 text-emerald-400" />
{isEditing.id ? "Edit Item" : "Create New Item"}
</h2>
<form onSubmit={saveItem} className="grid grid-cols-1 md:grid-cols-2 gap-6">
<div className="space-y-2">
<label className="text-sm font-bold text-white/60">Item Name</label>
<input
required
value={isEditing.name}
onChange={e => setIsEditing({ ...isEditing, name: e.target.value })}
className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50"
/>
</div>
<div className="space-y-2">
<label className="text-sm font-bold text-white/60">Price (USD)</label>
<input
type="number"
step="0.01"
required
value={isEditing.price}
onChange={e => setIsEditing({ ...isEditing, price: parseFloat(e.target.value) || 0 })}
className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50"
/>
</div>
<div className="space-y-2">
<label className="text-sm font-bold text-white/60">Category</label>
<select
value={isEditing.category}
onChange={e => setIsEditing({ ...isEditing, category: e.target.value })}
className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50"
>
<option value="Ranks">Ranks</option>
<option value="Crates">Crates</option>
<option value="Keys">Keys</option>
<option value="Cosmetics">Cosmetics</option>
<option value="General">General</option>
</select>
</div>
<div className="space-y-2">
<label className="text-sm font-bold text-white/60">Image URL</label>
<input
value={isEditing.display_image}
onChange={e => setIsEditing({ ...isEditing, display_image: e.target.value })}
className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50"
placeholder="https://example.com/image.png"
/>
</div>
<div className="md:col-span-2 flex justify-end gap-3 pt-4">
<Button variant="ghost" onClick={() => setIsEditing(null)}>Cancel</Button>
<Button type="submit" loading={saving} icon={<Save className="size-4" />}>
{isEditing.id ? "Update Item" : "Create Item"}
</Button>
</div>
</form>
</Card>
</motion.div>
)}

{/* Items Grid */}
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
<AnimatePresence>
{items.map((item) => (
<motion.div
key={item.id}
layout
initial={{ opacity: 0, scale: 0.9 }}
animate={{ opacity: 1, scale: 1 }}
exit={{ opacity: 0, scale: 0.9 }}
>
<TiltCard className="p-6 bg-zinc-900/50 flex flex-col items-center text-center gap-4">
<div className="size-24 rounded-2xl bg-black/40 border border-white/5 flex items-center justify-center overflow-hidden">
{item.display_image ? (
<img src={item.display_image} alt={item.name} className="object-cover w-full h-full" />
) : (
<CopyPlus className="size-8 text-zinc-600" />
)}
</div>
<div>
<h3 className="font-bold text-lg text-white">{item.name}</h3>
<p className="text-emerald-400 font-mono font-bold">${item.price?.toFixed?.(2) || '0.00'}</p>
<span className="text-xs text-zinc-500 uppercase tracking-wider block mt-1">{item.category}</span>
</div>
<div className="w-full flex items-center gap-2 mt-4 pt-4 border-t border-white/5">
<Button variant="secondary" size="sm" className="flex-1" onClick={() => setIsEditing(item)}>
Edit
</Button>
<Button variant="danger" size="sm" icon={<Trash2 className="size-4" />} onClick={() => deleteItem(item.id)} />
</div>
</TiltCard>
</motion.div>
))}
</AnimatePresence>
</div>

{items.length === 0 && (
<Card variant="glass" padding="lg" className="text-center text-white/40">
<CopyPlus className="size-12 mx-auto mb-3 opacity-30" />
<p>No store items yet. Click "Add Item" to create one.</p>
</Card>
)}
</div>
</AppShell>
);
}
