'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronDown, RotateCcw, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PermissionToggle } from '@/components/ui/permission-toggle';
import { clsx } from 'clsx';

interface PermissionPopupProps {
    role: {
        name: string;
        color: string;
        description: string;
        isLocked: boolean;
        permissions: string[];
    };
    permissionDefs: Record<string, { key: string; label: string; description: string; isDangerous: boolean }[]>;
    open: boolean;
    onClose: () => void;
    onSave: (role: string, permissions: Record<string, boolean>) => void;
    onReset: (role: string) => void;
}

const CATEGORY_ORDER = [
    'AUTH',
    'SOCIAL',
    'INVENTORY',
    'TRADES',
    'MARKETPLACE',
    'TICKETS',
    'WIKI',
    'RULES',
    'ACTIVITY',
    'MODERATION',
    'ADMIN',
    'GOD',
];

export function PermissionPopup({
    role,
    permissionDefs,
    open,
    onClose,
    onSave,
    onReset,
}: PermissionPopupProps) {
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(CATEGORY_ORDER));
    const [localPermissions, setLocalPermissions] = useState<Record<string, boolean>>({});
    const [saving, setSaving] = useState(false);
    const overlayRef = useRef<HTMLDivElement>(null);

    // Initialize local permissions when role changes
    useEffect(() => {
        if (open && role) {
            const perms: Record<string, boolean> = {};
            role.permissions.forEach((p) => {
                perms[p] = true;
            });
            setLocalPermissions(perms);
        }
    }, [open, role]);

    // Handle escape key
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (open) {
            document.addEventListener('keydown', handleEsc);
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.removeEventListener('keydown', handleEsc);
            document.body.style.overflow = '';
        };
    }, [open, onClose]);

    const toggleCategory = (category: string) => {
        setExpandedCategories((prev) => {
            const next = new Set(prev);
            if (next.has(category)) {
                next.delete(category);
            } else {
                next.add(category);
            }
            return next;
        });
    };

    const handleToggle = (key: string, granted: boolean) => {
        setLocalPermissions((prev) => ({
            ...prev,
            [key]: granted,
        }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await onSave(role.name, localPermissions);
            onClose();
        } finally {
            setSaving(false);
        }
    };

    const isOwner = role.name.toLowerCase() === 'owner';

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    ref={overlayRef}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
                    onClick={(e) => {
                        if (e.target === overlayRef.current) onClose();
                    }}
                >
                    <motion.div
                        initial={{ opacity: 0, x: '100%' }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: '100%' }}
                        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                        className="absolute right-0 top-0 bottom-0 w-full max-w-2xl bg-[#0D1117] border-l border-cyan-500/20 shadow-2xl flex flex-col"
                    >
                        {/* Header */}
                        <div
                            className="flex items-start justify-between p-6 border-b border-white/10"
                            style={{ borderTopWidth: '4px', borderTopColor: role.color }}
                        >
                            <div>
                                <div className="flex items-center gap-3">
                                    <h2 className="text-xl font-bold text-white">{role.name}</h2>
                                    {role.isLocked && (
                                        <span className="text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                                            Locked
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-white/50 mt-1">{role.description}</p>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                            >
                                <X className="size-5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            {CATEGORY_ORDER.filter((cat) => permissionDefs[cat]?.length > 0).map(
                                (category) => (
                                    <div key={category} className="space-y-2">
                                        <button
                                            onClick={() => toggleCategory(category)}
                                            className="flex items-center justify-between w-full text-left px-3 py-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
                                        >
                                            <span className="text-sm font-bold text-white/70 uppercase tracking-wider">
                                                {category}
                                            </span>
                                            <ChevronDown
                                                className={clsx(
                                                    'size-4 text-white/40 transition-transform duration-200',
                                                    expandedCategories.has(category) && 'rotate-180'
                                                )}
                                            />
                                        </button>

                                        <AnimatePresence>
                                            {expandedCategories.has(category) && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={{ duration: 0.2 }}
                                                    className="space-y-1.5 overflow-hidden"
                                                >
                                                    {permissionDefs[category].map((perm) => (
                                                        <PermissionToggle
                                                            key={perm.key}
                                                            permission={perm}
                                                            granted={!!localPermissions[perm.key]}
                                                            onToggle={handleToggle}
                                                            disabled={role.isLocked}
                                                        />
                                                    ))}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                )
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-6 border-t border-white/10 space-y-3">
                            <div className="flex gap-3">
                                <Button
                                    variant="secondary"
                                    size="md"
                                    icon={<RotateCcw className="size-4" />}
                                    onClick={() => onReset(role.name)}
                                    disabled={isOwner || role.isLocked}
                                    className="flex-1"
                                >
                                    Reset to Defaults
                                </Button>
                                <Button
                                    variant="primary"
                                    size="md"
                                    icon={saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                                    onClick={handleSave}
                                    disabled={role.isLocked}
                                    loading={saving}
                                    className="flex-1"
                                >
                                    Save Changes
                                </Button>
                            </div>
                            {isOwner && (
                                <p className="text-xs text-amber-400 text-center">
                                    Owner role permissions cannot be modified
                                </p>
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
