'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { RefreshCw, Plus, Trash2, Loader2, ArrowRightLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useSWRConfig } from 'swr';
import { useToast } from '@/components/ui/error-debug-toast';

interface DiscordSyncPanelProps {
    mappings: Array<{
        id: string;
        discord_role_id: string;
        discord_role_name: string;
        site_role: string;
        sync_direction: string;
    }>;
    onRefresh: () => void;
}

export function DiscordSyncPanel({ mappings, onRefresh }: DiscordSyncPanelProps) {
    const [syncing, setSyncing] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const { mutate } = useSWRConfig();
    const addToast = useToast((s) => s.addToast);

    const handleSync = async () => {
        setSyncing(true);
        try {
            const res = await fetch('/api/discord-sync/sync', { method: 'POST' });
            if (!res.ok) throw new Error('Sync failed');
            onRefresh();
        } catch (err) {
            console.error('Sync error:', err);
        } finally {
            setSyncing(false);
        }
    };

    const handleDelete = async (discordRoleId: string) => {
        setDeletingId(discordRoleId as any);
        try {
            const res = await fetch(`/api/discord-sync/${discordRoleId}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Delete failed');
            mutate('/api/discord-sync');
            onRefresh();
        } catch (err: any) {
            console.error('Delete error:', err);
            addToast({ type: 'error', title: 'Delete Failed', message: err.message || 'Failed to remove role mapping' });
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-[#5865F2]/10 border border-[#5865F2]/20">
                        <svg className="size-5 text-[#5865F2]" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-white">Discord Role Sync</h3>
                        <p className="text-xs text-white/40">Map Discord roles to site roles</p>
                    </div>
                </div>
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

            {/* Table */}
            {mappings.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                    <ArrowRightLeft className="size-8 text-white/20 mb-3" />
                    <p className="text-sm text-white/50">No Discord role mappings configured</p>
                    <p className="text-xs text-white/30 mt-1">Add mappings to sync Discord roles with site roles</p>
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
                            {mappings.map((mapping) => (
                                <tr
                                    key={mapping.id}
                                    className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                                >
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <div className="size-2 rounded-full bg-[#5865F2]" />
                                            <span className="text-sm text-white">{mapping.discord_role_name}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <Badge variant="info" size="sm">
                                            {mapping.site_role}
                                        </Badge>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-xs text-white/40 capitalize">
                                            {mapping.sync_direction.toLowerCase()}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            icon={<Trash2 className="size-4" />}
                                            onClick={() => handleDelete(mapping.discord_role_id)}
                                            disabled={deletingId === mapping.discord_role_id}
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
        </div>
    );
}
