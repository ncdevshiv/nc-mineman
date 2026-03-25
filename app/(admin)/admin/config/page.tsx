'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '@/hooks/use-auth';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Skeleton } from '@/components/ui/skeleton';
import { PermissionToggle } from '@/components/ui/permission-toggle';
import { useToast } from '@/components/ui/error-debug-toast';
import { DiscordSyncPanel } from '@/components/admin/discord-sync-panel';
import {
    Settings, Shield, Globe, MessageSquare, Loader2,
    ChevronDown, Save, RotateCcw, Plus, Trash2, RefreshCw
} from 'lucide-react';
import { clsx } from 'clsx';

// ============ Types ============

interface PermissionDef {
    key: string;
    label: string;
    description: string;
    isDangerous: boolean;
}

interface Role {
    name: string;
    color: string;
    description: string;
    isLocked: boolean;
    permissions: string[];
}

interface CustomRole {
    name: string;
    color: string;
    description: string;
}

interface DiscordMapping {
    id: string;
    discord_role_id: string;
    discord_role_name: string;
    site_role: string;
    sync_direction: string;
}

interface SiteConfig {
    general: {
        siteName: string;
        siteFullName: string;
        description: string;
        domain: string;
        logoUrl: string;
        faviconUrl: string;
    };
    discord: {
        guildName: string;
        inviteUrl: string;
        botStatus: string;
    };
    features: {
        wikiEnabled: boolean;
        rulesEnabled: boolean;
        activityEnabled: boolean;
        socialEnabled: boolean;
    };
}

const CATEGORY_ORDER = [
    'AUTH', 'SOCIAL', 'INVENTORY', 'TRADES', 'MARKETPLACE',
    'TICKETS', 'WIKI', 'RULES', 'ACTIVITY', 'MODERATION', 'ADMIN', 'GOD'
] as const;

type Category = typeof CATEGORY_ORDER[number];

// ============ Main Component ============

export default function AdminConfigPage() {
    const { user, isAdmin } = useAuth();
    const addToast = useToast(s => s.addToast);

    const [activeTab, setActiveTab] = useState<'permissions' | 'settings' | 'discord'>('permissions');
    const [loading, setLoading] = useState(true);

    // Permissions data
    const [presetRoles, setPresetRoles] = useState<Role[]>([]);
    const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
    const [permissionDefs, setPermissionDefs] = useState<Record<string, PermissionDef[]>>({});

    // Site config data
    const [siteConfig, setSiteConfig] = useState<SiteConfig | null>(null);

    // Discord data
    const [discordMappings, setDiscordMappings] = useState<DiscordMapping[]>([]);
    const [lastSync, setLastSync] = useState<string | null>(null);

    // Expanded state for permissions matrix
    const [expandedCells, setExpandedCells] = useState<Set<string>>(new Set());
    const [editingRole, setEditingRole] = useState<string | null>(null);
    const [editingCategory, setEditingCategory] = useState<string | null>(null);
    const [localPerms, setLocalPerms] = useState<Record<string, boolean>>({});
    const [saving, setSaving] = useState(false);

    // Settings form state
    const [generalForm, setGeneralForm] = useState({ siteName: '', siteFullName: '', description: '', domain: '', logoUrl: '', faviconUrl: '' });
    const [discordForm, setDiscordForm] = useState({ guildName: '', inviteUrl: '', botStatus: '' });
    const [featuresForm, setFeaturesForm] = useState({ wikiEnabled: true, rulesEnabled: true, activityEnabled: true, socialEnabled: true });
    const [settingsSaving, setSettingsSaving] = useState(false);

    // Discord mapping form
    const [newDiscordMapping, setNewDiscordMapping] = useState({ discord_role_id: '', discord_role_name: '', site_role: '', sync_direction: 'both' });
    const [addingMapping, setAddingMapping] = useState(false);
    const [syncing, setSyncing] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [rolesRes, permsRes, customRes, discordRes, configRes] = await Promise.all([
                fetch('/api/roles').then(r => r.ok ? r.json() : []),
                fetch('/api/permissions').then(r => r.ok ? r.json() : {}),
                fetch('/api/roles/custom').then(r => r.ok ? r.json() : []),
                fetch('/api/discord-sync').then(r => r.ok ? r.json() : []),
                fetch('/api/site-config').then(r => r.ok ? r.json() : null).catch(() => null),
            ]);

            setPresetRoles(rolesRes);
            setPermissionDefs(permsRes);
            setCustomRoles(customRes);
            setDiscordMappings(discordRes);

            if (configRes) {
                setSiteConfig(configRes);
                setGeneralForm(configRes.general || {});
                setDiscordForm(configRes.discord || {});
                setFeaturesForm(configRes.features || {});
            }
        } catch {
            addToast({ type: 'error', title: 'Error', message: 'Failed to load data' });
        } finally {
            setLoading(false);
        }
    };

    const allRoles = [
        ...presetRoles.map(r => ({ ...r, isCustom: false })),
        ...customRoles.map(r => ({ ...r, isCustom: true, isLocked: false, permissions: [] as string[] })),
    ];

    // Permissions Matrix Functions
    const getCellId = (roleName: string, category: string) => `${roleName}:${category}`;

    const getPermCount = (roleName: string, category: string): { granted: number; total: number } => {
        const role = allRoles.find(r => r.name === roleName);
        if (!role) return { granted: 0, total: 0 };
        const perms = permissionDefs[category] || [];
        const granted = perms.filter(p => role.permissions.includes(p.key)).length;
        return { granted, total: perms.length };
    };

    const toggleCell = (roleName: string, category: string) => {
        const cellId = getCellId(roleName, category);
        if (expandedCells.has(cellId)) {
            setExpandedCells(prev => {
                const next = new Set(prev);
                next.delete(cellId);
                return next;
            });
            setEditingRole(null);
            setEditingCategory(null);
        } else {
            const role = allRoles.find(r => r.name === roleName);
            if (role) {
                setEditingRole(roleName);
                setEditingCategory(category);
                const perms: Record<string, boolean> = {};
                (permissionDefs[category] || []).forEach(p => {
                    perms[p.key] = role.permissions.includes(p.key);
                });
                setLocalPerms(perms);
            }
            setExpandedCells(prev => new Set(prev).add(cellId));
        }
    };

    const handlePermToggle = (key: string, granted: boolean) => {
        setLocalPerms(prev => ({ ...prev, [key]: granted }));
    };

    const handleSaveCategory = async (roleName: string) => {
        setSaving(true);
        try {
            const res = await fetch(`/api/roles/${roleName}/permissions`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ permissions: localPerms }),
            });
            if (!res.ok) throw new Error('Failed to save');
            addToast({ type: 'success', title: 'Saved', message: `Permissions updated for ${roleName}` });
            loadData();
        } catch (err: any) {
            addToast({ type: 'error', title: 'Error', message: err.message });
        } finally {
            setSaving(false);
        }
    };

    const handleResetRole = async (roleName: string) => {
        try {
            const res = await fetch(`/api/roles/${roleName}/permissions`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to reset');
            addToast({ type: 'success', title: 'Reset', message: `Role ${roleName} reset to defaults` });
            loadData();
        } catch (err: any) {
            addToast({ type: 'error', title: 'Error', message: err.message });
        }
    };

    // Settings Functions
    const handleSaveGeneral = async () => {
        setSettingsSaving(true);
        try {
            await fetch('/api/site-config', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ section: 'general', data: generalForm }),
            });
            addToast({ type: 'success', title: 'Saved', message: 'General settings updated' });
        } catch (err: any) {
            addToast({ type: 'error', title: 'Error', message: err.message });
        } finally {
            setSettingsSaving(false);
        }
    };

    const handleSaveDiscord = async () => {
        setSettingsSaving(true);
        try {
            await fetch('/api/site-config', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ section: 'discord', data: discordForm }),
            });
            addToast({ type: 'success', title: 'Saved', message: 'Discord settings updated' });
        } catch (err: any) {
            addToast({ type: 'error', title: 'Error', message: err.message });
        } finally {
            setSettingsSaving(false);
        }
    };

    const handleSaveFeatures = async () => {
        setSettingsSaving(true);
        try {
            await fetch('/api/site-config', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ section: 'features', data: featuresForm }),
            });
            addToast({ type: 'success', title: 'Saved', message: 'Feature settings updated' });
        } catch (err: any) {
            addToast({ type: 'error', title: 'Error', message: err.message });
        } finally {
            setSettingsSaving(false);
        }
    };

    // Discord Mapping Functions
    const handleAddMapping = async () => {
        if (!newDiscordMapping.discord_role_id || !newDiscordMapping.site_role) {
            addToast({ type: 'error', title: 'Error', message: 'Discord role ID and site role are required' });
            return;
        }
        setAddingMapping(true);
        try {
            const res = await fetch('/api/discord-sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newDiscordMapping),
            });
            if (!res.ok) throw new Error('Failed to add mapping');
            addToast({ type: 'success', title: 'Added', message: 'Discord mapping added' });
            setNewDiscordMapping({ discord_role_id: '', discord_role_name: '', site_role: '', sync_direction: 'both' });
            loadData();
        } catch (err: any) {
            addToast({ type: 'error', title: 'Error', message: err.message });
        } finally {
            setAddingMapping(false);
        }
    };

    const handleDeleteMapping = async (discordRoleId: string) => {
        try {
            const res = await fetch(`/api/discord-sync/${discordRoleId}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete');
            addToast({ type: 'success', title: 'Deleted', message: 'Mapping removed' });
            loadData();
        } catch (err: any) {
            addToast({ type: 'error', title: 'Error', message: err.message });
        }
    };

    const handleSync = async () => {
        setSyncing(true);
        try {
            const res = await fetch('/api/discord-sync/sync', { method: 'POST' });
            if (!res.ok) throw new Error('Sync failed');
            setLastSync(new Date().toISOString());
            addToast({ type: 'success', title: 'Synced', message: 'Discord roles synced' });
            loadData();
        } catch (err: any) {
            addToast({ type: 'error', title: 'Error', message: err.message });
        } finally {
            setSyncing(false);
        }
    };

    const tabs = [
        { id: 'permissions' as const, label: 'Permissions Matrix', icon: Shield },
        { id: 'settings' as const, label: 'Site Settings', icon: Settings },
        { id: 'discord' as const, label: 'Discord Sync', icon: MessageSquare },
    ];

    const roleColors: Record<string, string> = {
        owner: '#ef4444', admin: '#f59e0b', god: '#a855f7',
        helper: '#3b82f6', youtuber: '#ec4899', member: '#6b7280'
    };

    return (
        <AppShell>
            <div className="space-y-6">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between"
                >
                    <div>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                            <Settings className="size-7 text-emerald-400" />
                            Site Configuration
                        </h1>
                        <p className="text-white/40 mt-1 text-sm">Control center for permissions, settings, and integrations</p>
                    </div>
                </motion.div>

                {/* Tabs */}
                <div className="flex gap-2 border-b border-white/10">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={clsx(
                                'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                                activeTab === tab.id
                                    ? 'text-emerald-400 border-emerald-400'
                                    : 'text-white/40 border-transparent hover:text-white/60'
                            )}
                        >
                            <tab.icon className="size-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <AnimatePresence mode="wait">
                    {/* ========== PERMISSIONS MATRIX TAB ========== */}
                    {activeTab === 'permissions' && (
                        <motion.div
                            key="permissions"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            className="space-y-4"
                        >
                            {loading ? (
                                <div className="space-y-3">
                                    {Array.from({ length: 6 }).map((_, i) => (
                                        <Skeleton key={i} className="h-12" />
                                    ))}
                                </div>
                            ) : (
                                <div className="border border-white/10 rounded-xl overflow-hidden">
                                    {/* Table Header */}
                                    <div className="grid bg-white/[0.02] border-b border-white/10"
                                        style={{ gridTemplateColumns: `160px repeat(${CATEGORY_ORDER.length}, minmax(80px, 1fr))` }}>
                                        <div className="px-4 py-3 text-xs font-bold text-white/50 uppercase tracking-wider">
                                            Role
                                        </div>
                                        {CATEGORY_ORDER.map(cat => (
                                            <div key={cat} className="px-2 py-3 text-center text-xs font-bold text-white/50 uppercase tracking-wider">
                                                {cat}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Table Body */}
                                    {allRoles.map(role => (
                                        <div key={role.name}>
                                            <div
                                                className="grid hover:bg-white/[0.02] transition-colors"
                                                style={{ gridTemplateColumns: `160px repeat(${CATEGORY_ORDER.length}, minmax(80px, 1fr))` }}
                                            >
                                                {/* Role Name Cell */}
                                                <div className="px-4 py-2 flex items-center gap-2">
                                                    <div
                                                        className="size-2.5 rounded-full shrink-0"
                                                        style={{ backgroundColor: role.color || roleColors[role.name] || '#6b7280' }}
                                                    />
                                                    <span className="text-sm font-medium text-white truncate">
                                                        {role.name}
                                                    </span>
                                                    {role.isLocked && (
                                                        <Badge variant="warning" size="sm">Locked</Badge>
                                                    )}
                                                </div>

                                                {/* Category Cells */}
                                                {CATEGORY_ORDER.map(category => {
                                                    const { granted, total } = getPermCount(role.name, category);
                                                    const cellId = getCellId(role.name, category);
                                                    const isExpanded = expandedCells.has(cellId);
                                                    const isEditing = editingRole === role.name && editingCategory === category;

                                                    return (
                                                        <div key={category} className="px-2 py-2 text-center">
                                                            {total > 0 ? (
                                                                <button
                                                                    onClick={() => toggleCell(role.name, category)}
                                                                    className={clsx(
                                                                        'w-full px-2 py-1.5 rounded-lg text-xs font-medium transition-all',
                                                                        isExpanded
                                                                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                                                            : 'bg-white/5 text-white/70 hover:bg-white/10 border border-transparent'
                                                                    )}
                                                                >
                                                                    <span className={clsx(
                                                                        granted === total && 'text-emerald-400',
                                                                        granted > 0 && granted < total && 'text-amber-400'
                                                                    )}>
                                                                        {granted}/{total}
                                                                    </span>
                                                                </button>
                                                            ) : (
                                                                <span className="text-white/20 text-xs">—</span>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* Expanded Permission Editor */}
                                            {CATEGORY_ORDER.map(category => {
                                                const cellId = getCellId(role.name, category);
                                                if (!expandedCells.has(cellId)) return null;

                                                const perms = permissionDefs[category] || [];
                                                const roleData = allRoles.find(r => r.name === role.name);

                                                return (
                                                    <motion.div
                                                        key={`${role.name}-${category}`}
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: 'auto', opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        className="border-t border-white/5 bg-black/20"
                                                    >
                                                        <div className="p-4 space-y-3">
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex items-center gap-2">
                                                                    <Badge variant="info" size="sm">{category}</Badge>
                                                                    <span className="text-xs text-white/40">
                                                                        Editing {role.name}
                                                                    </span>
                                                                </div>
                                                                <div className="flex gap-2">
                                                                    {!role.isLocked && (
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            icon={<RotateCcw className="size-3" />}
                                                                            onClick={() => handleResetRole(role.name)}
                                                                        >
                                                                            Reset
                                                                        </Button>
                                                                    )}
                                                                    <Button
                                                                        variant="primary"
                                                                        size="sm"
                                                                        icon={saving ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
                                                                        onClick={() => handleSaveCategory(role.name)}
                                                                        disabled={role.isLocked}
                                                                    >
                                                                        Save
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                            <div className="space-y-1.5">
                                                                {perms.map(perm => (
                                                                    <PermissionToggle
                                                                        key={perm.key}
                                                                        permission={perm}
                                                                        granted={!!localPerms[perm.key]}
                                                                        onToggle={handlePermToggle}
                                                                        disabled={role.isLocked}
                                                                    />
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                );
                                            })}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Custom Roles Note */}
                            <p className="text-xs text-white/30 text-center">
                                Custom roles can be created in the <a href="/admin/roles" className="text-emerald-400 hover:underline">Roles page</a>
                            </p>
                        </motion.div>
                    )}

                    {/* ========== SITE SETTINGS TAB ========== */}
                    {activeTab === 'settings' && (
                        <motion.div
                            key="settings"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            className="space-y-6"
                        >
                            {/* General Settings */}
                            <Card className="p-6 space-y-4">
                                <div className="flex items-center gap-3 pb-4 border-b border-white/10">
                                    <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                                        <Globe className="size-5 text-emerald-400" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-white">General</h3>
                                        <p className="text-xs text-white/40">Basic site information</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Input
                                        label="Site Short Name"
                                        value={generalForm.siteName}
                                        onChange={e => setGeneralForm(f => ({ ...f, siteName: e.target.value }))}
                                        placeholder="Hideout"
                                    />
                                    <Input
                                        label="Site Full Name"
                                        value={generalForm.siteFullName}
                                        onChange={e => setGeneralForm(f => ({ ...f, siteFullName: e.target.value }))}
                                        placeholder="Hideout SMP"
                                    />
                                    <Input
                                        label="Domain"
                                        value={generalForm.domain}
                                        onChange={e => setGeneralForm(f => ({ ...f, domain: e.target.value }))}
                                        placeholder="hideoutsmp.com"
                                    />
                                    <Input
                                        label="Description"
                                        value={generalForm.description}
                                        onChange={e => setGeneralForm(f => ({ ...f, description: e.target.value }))}
                                        placeholder="Site description"
                                    />
                                    <Input
                                        label="Logo URL"
                                        value={generalForm.logoUrl}
                                        onChange={e => setGeneralForm(f => ({ ...f, logoUrl: e.target.value }))}
                                        placeholder="https://..."
                                    />
                                    <Input
                                        label="Favicon URL"
                                        value={generalForm.faviconUrl}
                                        onChange={e => setGeneralForm(f => ({ ...f, faviconUrl: e.target.value }))}
                                        placeholder="https://..."
                                    />
                                </div>

                                <div className="flex justify-end pt-2">
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        icon={settingsSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                                        onClick={handleSaveGeneral}
                                        disabled={settingsSaving}
                                    >
                                        Save General
                                    </Button>
                                </div>
                            </Card>

                            {/* Discord Settings */}
                            <Card className="p-6 space-y-4">
                                <div className="flex items-center gap-3 pb-4 border-b border-white/10">
                                    <div className="p-2 rounded-lg bg-[#5865F2]/10 border border-[#5865F2]/20">
                                        <svg className="size-5 text-[#5865F2]" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-white">Discord</h3>
                                        <p className="text-xs text-white/40">Discord integration settings</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Input
                                        label="Guild Name"
                                        value={discordForm.guildName}
                                        onChange={e => setDiscordForm(f => ({ ...f, guildName: e.target.value }))}
                                        placeholder="Hideout SMP"
                                    />
                                    <Input
                                        label="Invite URL"
                                        value={discordForm.inviteUrl}
                                        onChange={e => setDiscordForm(f => ({ ...f, inviteUrl: e.target.value }))}
                                        placeholder="https://discord.gg/..."
                                    />
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-white/50 uppercase tracking-wider">
                                            Bot Status
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <div className={clsx(
                                                'size-2 rounded-full',
                                                discordForm.botStatus === 'connected' ? 'bg-green-400' :
                                                discordForm.botStatus === 'error' ? 'bg-red-400' : 'bg-white/20'
                                            )} />
                                            <span className="text-sm text-white/70 capitalize">
                                                {discordForm.botStatus || 'Unknown'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-end pt-2">
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        icon={settingsSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                                        onClick={handleSaveDiscord}
                                        disabled={settingsSaving}
                                    >
                                        Save Discord
                                    </Button>
                                </div>
                            </Card>

                            {/* Feature Flags */}
                            <Card className="p-6 space-y-4">
                                <div className="flex items-center gap-3 pb-4 border-b border-white/10">
                                    <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                                        <Shield className="size-5 text-amber-400" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-white">Features</h3>
                                        <p className="text-xs text-white/40">Enable or disable platform features</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {[
                                        { key: 'wikiEnabled', label: 'Wiki', desc: 'Documentation and guides' },
                                        { key: 'rulesEnabled', label: 'Rules', desc: 'Server rules page' },
                                        { key: 'activityEnabled', label: 'Activity', desc: 'Player activity tracking' },
                                        { key: 'socialEnabled', label: 'Social', desc: 'Friends and following' },
                                    ].map(feature => (
                                        <label
                                            key={feature.key}
                                            className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] transition-colors cursor-pointer"
                                        >
                                            <div>
                                                <div className="text-sm font-medium text-white">{feature.label}</div>
                                                <div className="text-xs text-white/40">{feature.desc}</div>
                                            </div>
                                            <button
                                                role="switch"
                                                aria-checked={(featuresForm as any)[feature.key]}
                                                onClick={() => setFeaturesForm(f => ({
                                                    ...f,
                                                    [feature.key]: !(f as any)[feature.key]
                                                }))}
                                                className={clsx(
                                                    'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200',
                                                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40',
                                                    (featuresForm as any)[feature.key] ? 'bg-emerald-500' : 'bg-white/10'
                                                )}
                                            >
                                                <motion.span
                                                    layout
                                                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                                                    className="inline-flex size-5 translate-x-0 items-center justify-center rounded-full bg-white shadow-lg"
                                                    style={{ translateX: (featuresForm as any)[feature.key] ? '20px' : '0px' }}
                                                />
                                            </button>
                                        </label>
                                    ))}
                                </div>

                                <div className="flex justify-end pt-2">
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        icon={settingsSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                                        onClick={handleSaveFeatures}
                                        disabled={settingsSaving}
                                    >
                                        Save Features
                                    </Button>
                                </div>
                            </Card>
                        </motion.div>
                    )}

                    {/* ========== DISCORD SYNC TAB ========== */}
                    {activeTab === 'discord' && (
                        <motion.div
                            key="discord"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            className="space-y-4"
                        >
                            <Card className="p-6 space-y-4">
                                {/* Header */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-[#5865F2]/10 border border-[#5865F2]/20">
                                            <svg className="size-5 text-[#5865F2]" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                                            </svg>
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-white">Discord Role Mappings</h3>
                                            <p className="text-xs text-white/40">Map Discord roles to site roles</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {lastSync && (
                                            <span className="text-xs text-white/30">
                                                Last sync: {new Date(lastSync).toLocaleTimeString()}
                                            </span>
                                        )}
                                        <Button
                                            variant="primary"
                                            size="sm"
                                            icon={syncing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                                            onClick={handleSync}
                                            disabled={syncing}
                                        >
                                            Sync Now
                                        </Button>
                                    </div>
                                </div>

                                {/* Mappings Table */}
                                {discordMappings.length === 0 ? (
                                    <div className="text-center py-8 text-white/30">
                                        <p className="text-sm">No Discord role mappings configured</p>
                                        <p className="text-xs mt-1">Add mappings below to sync Discord roles with site roles</p>
                                    </div>
                                ) : (
                                    <div className="rounded-xl border border-white/[0.06] overflow-hidden">
                                        <table className="w-full">
                                            <thead>
                                                <tr className="bg-white/[0.02] border-b border-white/[0.06]">
                                                    <th className="px-4 py-3 text-left text-xs font-bold text-white/50 uppercase tracking-wider">
                                                        Discord Role
                                                    </th>
                                                    <th className="px-4 py-3 text-left text-xs font-bold text-white/50 uppercase tracking-wider">
                                                        Site Role
                                                    </th>
                                                    <th className="px-4 py-3 text-left text-xs font-bold text-white/50 uppercase tracking-wider">
                                                        Direction
                                                    </th>
                                                    <th className="px-4 py-3 text-right text-xs font-bold text-white/50 uppercase tracking-wider">
                                                        Actions
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {discordMappings.map((mapping) => (
                                                    <tr
                                                        key={mapping.id}
                                                        className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                                                    >
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center gap-2">
                                                                <div className="size-2 rounded-full bg-[#5865F2]" />
                                                                <span className="text-sm text-white">{mapping.discord_role_name}</span>
                                                                <code className="text-xs text-white/30 ml-1">{mapping.discord_role_id.slice(0, 8)}...</code>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <Badge variant="info" size="sm">
                                                                {mapping.site_role}
                                                            </Badge>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <select
                                                                value={mapping.sync_direction}
                                                                className="text-xs bg-white/5 border border-white/10 rounded px-2 py-1 text-white/70"
                                                                disabled
                                                            >
                                                                <option value="discord_to_site">Discord → Site</option>
                                                                <option value="site_to_discord">Site → Discord</option>
                                                                <option value="both">Both</option>
                                                            </select>
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                icon={<Trash2 className="size-4" />}
                                                                onClick={() => handleDeleteMapping(mapping.discord_role_id)}
                                                            >
                                                                Remove
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {/* Add Mapping Form */}
                                <div className="pt-4 border-t border-white/10">
                                    <p className="text-xs text-white/50 mb-3 uppercase tracking-wider font-bold">Add New Mapping</p>
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                        <Input
                                            placeholder="Discord Role ID"
                                            value={newDiscordMapping.discord_role_id}
                                            onChange={e => setNewDiscordMapping(f => ({ ...f, discord_role_id: e.target.value }))}
                                            className="bg-white/5 border-white/10"
                                        />
                                        <Input
                                            placeholder="Discord Role Name"
                                            value={newDiscordMapping.discord_role_name}
                                            onChange={e => setNewDiscordMapping(f => ({ ...f, discord_role_name: e.target.value }))}
                                            className="bg-white/5 border-white/10"
                                        />
                                        <select
                                            value={newDiscordMapping.site_role}
                                            onChange={e => setNewDiscordMapping(f => ({ ...f, site_role: e.target.value }))}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20"
                                        >
                                            <option value="">Select site role...</option>
                                            {allRoles.map(r => (
                                                <option key={r.name} value={r.name}>{r.name}</option>
                                            ))}
                                        </select>
                                        <select
                                            value={newDiscordMapping.sync_direction}
                                            onChange={e => setNewDiscordMapping(f => ({ ...f, sync_direction: e.target.value }))}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white"
                                        >
                                            <option value="both">Both directions</option>
                                            <option value="discord_to_site">Discord → Site</option>
                                            <option value="site_to_discord">Site → Discord</option>
                                        </select>
                                    </div>
                                    <div className="flex justify-end mt-3">
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            icon={addingMapping ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                                            onClick={handleAddMapping}
                                            disabled={addingMapping}
                                        >
                                            Add Mapping
                                        </Button>
                                    </div>
                                </div>
                            </Card>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </AppShell>
    );
}
