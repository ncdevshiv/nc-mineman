'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Plus, Loader2 } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { clsx } from 'clsx';

interface CustomRoleCreatorProps {
    open: boolean;
    onClose: () => void;
    onCreated: () => void;
}

const PRESET_COLORS = [
    '#ef4444', // red
    '#f97316', // orange
    '#eab308', // yellow
    '#22c55e', // green
    '#14b8a6', // teal
    '#3b82f6', // blue
    '#8b5cf6', // violet
    '#ec4899', // pink
];

export function CustomRoleCreator({ open, onClose, onCreated }: CustomRoleCreatorProps) {
    const [name, setName] = useState('');
    const [color, setColor] = useState(PRESET_COLORS[5]);
    const [description, setDescription] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (name.length < 2 || name.length > 30) {
            setError('Role name must be 2-30 characters');
            return;
        }

        if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
            setError('Invalid color format. Use #rrggbb');
            return;
        }

        setSaving(true);
        try {
            const res = await fetch('/api/roles/custom', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, color, description }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to create role');
            }

            setName('');
            setColor(PRESET_COLORS[5]);
            setDescription('');
            onCreated();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create role');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal open={open} onClose={onClose} title="Create Custom Role" size="md">
            <form onSubmit={handleSubmit} className="space-y-5">
                {/* Role Name */}
                <Input
                    label="Role Name"
                    placeholder="Enter role name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={30}
                    required
                />
                <p className="text-xs text-white/30 -mt-3">{name.length}/30 characters</p>

                {/* Color Picker */}
                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-white/50 uppercase tracking-wider">
                        Color
                    </label>
                    <div className="flex items-center gap-3 flex-wrap">
                        {PRESET_COLORS.map((c) => (
                            <button
                                key={c}
                                type="button"
                                onClick={() => setColor(c)}
                                className={clsx(
                                    'size-8 rounded-full transition-all duration-200',
                                    'hover:scale-110 hover:ring-2 hover:ring-white/40',
                                    color === c && 'ring-2 ring-white ring-offset-2 ring-offset-[#111620]'
                                )}
                                style={{ backgroundColor: c }}
                            />
                        ))}
                        <div className="relative">
                            <input
                                type="text"
                                value={color}
                                onChange={(e) => setColor(e.target.value)}
                                placeholder="#3b82f6"
                                pattern="^#[0-9A-Fa-f]{6}$"
                                className={clsx(
                                    'w-24 bg-[#0A0E14]/50 border border-cyan-500/20 rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-white/20',
                                    'focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/40',
                                    'hover:border-cyan-500/30'
                                )}
                            />
                        </div>
                    </div>
                    {/* Color Preview */}
                    <div className="flex items-center gap-2 mt-2">
                        <div
                            className="size-4 rounded-full ring-2 ring-white/10"
                            style={{ backgroundColor: color }}
                        />
                        <span className="text-xs text-white/40">{color}</span>
                    </div>
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-white/50 uppercase tracking-wider">
                        Description
                    </label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Enter role description..."
                        rows={3}
                        className={clsx(
                            'w-full bg-[#0A0E14]/50 border border-cyan-500/20 rounded-xl px-4 py-3 text-white placeholder:text-white/20 transition-all duration-200 resize-none',
                            'focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/40',
                            'hover:border-cyan-500/30'
                        )}
                    />
                </div>

                {/* Error */}
                {error && (
                    <motion.p
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-lg"
                    >
                        {error}
                    </motion.p>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                    <Button type="button" variant="secondary" size="md" onClick={onClose} className="flex-1">
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        variant="primary"
                        size="md"
                        icon={saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                        loading={saving}
                        className="flex-1"
                    >
                        Create Role
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
