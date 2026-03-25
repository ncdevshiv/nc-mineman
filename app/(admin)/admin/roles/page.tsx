'use client';

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '@/hooks/use-auth';
import { AppShell } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/error-debug-toast';
import { Shield, Users, RefreshCw, FileText, Plus } from 'lucide-react';
import { RoleCard } from '@/components/admin/role-card';
import { PermissionPopup } from '@/components/admin/permission-popup';
import { CustomRoleCreator } from '@/components/admin/custom-role-creator';
import { DiscordSyncPanel } from '@/components/admin/discord-sync-panel';
import { AuditLogTable } from '@/components/admin/audit-log-table';

interface Role {
    name: string;
    color: string;
    description: string;
    isLocked: boolean;
    permissions: string[];
}

interface AuditEntry {
    id: number;
    performed_by: string;
    action: string;
    target_role: string | null;
    permission_key: string | null;
    old_value: string | null;
    new_value: string | null;
    timestamp: string;
}

interface DiscordMapping {
    id: string;
    discord_role_id: string;
    discord_role_name: string;
    site_role: string;
    sync_direction: string;
}

export default function AdminRolesPage() {
    const { user, isAdmin } = useAuth();
    const addToast = useToast(s => s.addToast);

    const [activeTab, setActiveTab] = useState<'preset' | 'custom' | 'discord' | 'audit'>('preset');
    const [presetRoles, setPresetRoles] = useState<Role[]>([]);
    const [customRoles, setCustomRoles] = useState<Role[]>([]);
    const [permissionDefs, setPermissionDefs] = useState<Record<string, { key: string; label: string; description: string; isDangerous: boolean }[]>>({});
    const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
    const [discordMappings, setDiscordMappings] = useState<DiscordMapping[]>([]);
    const [loading, setLoading] = useState(true);

    const [editingRole, setEditingRole] = useState<Role | null>(null);
    const [showPermissionPopup, setShowPermissionPopup] = useState(false);
    const [showCustomRoleCreator, setShowCustomRoleCreator] = useState(false);

    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    // Load audit entries when audit tab is active
    useEffect(() => {
        if (activeTab === 'audit') {
            loadAuditEntries();
        }
    }, [activeTab]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [rolesRes, permsRes, customRes, discordRes] = await Promise.all([
                fetch('/api/roles').then(r => r.ok ? r.json() : []),
                fetch('/api/permissions').then(r => r.ok ? r.json() : {}),
                fetch('/api/roles/custom').then(r => r.ok ? r.json() : []),
                fetch('/api/discord-sync').then(r => r.ok ? r.json() : []),
            ]);
            setPresetRoles(rolesRes);
            setPermissionDefs(permsRes);
            setCustomRoles(customRes);
            setDiscordMappings(discordRes);
        } catch {
            addToast({ type: 'error', title: 'Error', message: 'Failed to load data' });
        } finally {
            setLoading(false);
        }
    };

    const loadAuditEntries = async () => {
        try {
            const res = await fetch('/api/audit-log?limit=50');
            if (res.ok) {
                setAuditEntries(await res.json());
            }
        } catch {
            addToast({ type: 'error', title: 'Error', message: 'Failed to load audit log' });
        }
    };

    const openRoleEditor = (roleName: string) => {
        const role = [...presetRoles, ...customRoles].find(r => r.name === roleName);
        if (role) {
            setEditingRole(role);
            setShowPermissionPopup(true);
        }
    };

    const handleSavePermissions = async (roleName: string, permissions: Record<string, boolean>) => {
        setSaving(true);
        try {
            const res = await fetch(`/api/roles/${roleName}/permissions`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ permissions }),
            });
            if (!res.ok) throw new Error('Failed to save');
            addToast({ type: 'success', title: 'Saved', message: `Permissions updated for ${roleName}` });
            setShowPermissionPopup(false);
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
            setShowPermissionPopup(false);
            loadData();
        } catch (err: any) {
            addToast({ type: 'error', title: 'Error', message: err.message });
        }
    };

    const handleCustomRoleCreated = () => {
        addToast({ type: 'success', title: 'Created', message: `Custom role created` });
        setShowCustomRoleCreator(false);
        loadData();
    };

    const tabs = [
        { id: 'preset' as const, label: 'Preset Roles', icon: Shield },
        { id: 'custom' as const, label: 'Custom Roles', icon: Users },
        { id: 'discord' as const, label: 'Discord Sync', icon: RefreshCw },
        { id: 'audit' as const, label: 'Audit Log', icon: FileText },
    ];

    return (
        <AppShell>
            <div className="space-y-6">
                <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <Shield className="size-7 text-emerald-400" />
                        Role Manager
                    </h1>
                    <p className="text-white/40 mt-1">Manage roles, permissions, and Discord sync</p>
                </motion.div>

                {/* Tabs */}
                <div className="flex gap-2">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                                activeTab === tab.id
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                    : 'text-white/40 hover:text-white/60 hover:bg-white/[0.03] border border-transparent'
                            }`}
                        >
                            <tab.icon className="size-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                {activeTab === 'preset' && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {loading ? (
                                Array.from({ length: 6 }).map((_, i) => (
                                    <Skeleton key={i} className="h-32" />
                                ))
                            ) : (
                                presetRoles.map(role => (
                                    <RoleCard key={role.name} role={role} onEdit={openRoleEditor} />
                                ))
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'custom' && (
                    <div className="space-y-4">
                        <div className="flex justify-end">
                            <Button icon={<Plus className="size-4" />} onClick={() => setShowCustomRoleCreator(true)}>
                                Create Custom Role
                            </Button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {loading ? (
                                Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32" />)
                            ) : customRoles.length === 0 ? (
                                <div className="col-span-full text-center py-12 text-white/30">
                                    <Users className="size-12 mx-auto mb-3 opacity-30" />
                                    <p>No custom roles yet. Create one above.</p>
                                </div>
                            ) : (
                                customRoles.map(role => (
                                    <Card
                                        key={role.name}
                                        className="cursor-pointer hover:border-emerald-500/30 transition-colors"
                                        onClick={() => openRoleEditor(role.name)}
                                    >
                                        <div className="flex items-center gap-3 p-4">
                                            <div className="size-4 rounded-full" style={{ backgroundColor: role.color }} />
                                            <div className="flex-1">
                                                <div className="font-medium text-white">{role.name}</div>
                                                <div className="text-xs text-white/30">{role.description || 'No description'}</div>
                                            </div>
                                        </div>
                                    </Card>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'discord' && (
                    <DiscordSyncPanel
                        mappings={discordMappings}
                        onRefresh={loadData}
                    />
                )}

                {activeTab === 'audit' && (
                    <AuditLogTable entries={auditEntries} />
                )}
            </div>

            {/* Permission Popup */}
            {editingRole && (
                <PermissionPopup
                    role={editingRole}
                    permissionDefs={permissionDefs}
                    open={showPermissionPopup}
                    onClose={() => setShowPermissionPopup(false)}
                    onSave={handleSavePermissions}
                    onReset={handleResetRole}
                />
            )}

            {/* Custom Role Creator */}
            <CustomRoleCreator
                open={showCustomRoleCreator}
                onClose={() => setShowCustomRoleCreator(false)}
                onCreated={handleCustomRoleCreated}
            />
        </AppShell>
    );
}
