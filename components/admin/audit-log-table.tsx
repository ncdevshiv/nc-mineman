'use client';

import { motion } from 'motion/react';
import { Clock, User, Shield, Key, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface AuditLogTableProps {
    entries: Array<{
        id: number;
        performed_by: string;
        action: string;
        target_role: string | null;
        permission_key: string | null;
        old_value: string | null;
        new_value: string | null;
        timestamp: string;
    }>;
}

function formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function getActionBadgeVariant(action: string): 'success' | 'warning' | 'danger' | 'info' | 'default' {
    const actionLower = action.toLowerCase();
    if (actionLower.includes('grant') || actionLower.includes('add')) return 'success';
    if (actionLower.includes('revoke') || actionLower.includes('remove')) return 'danger';
    if (actionLower.includes('reset')) return 'warning';
    return 'info';
}

export function AuditLogTable({ entries }: AuditLogTableProps) {
    if (entries.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <Clock className="size-10 text-white/10 mb-3" />
                <p className="text-sm text-white/50">No audit log entries</p>
                <p className="text-xs text-white/30 mt-1">Permission changes will appear here</p>
            </div>
        );
    }

    return (
        <div className="rounded-xl border border-white/[0.06] overflow-hidden">
            <table className="w-full">
                <thead>
                    <tr className="bg-white/[0.02] border-b border-white/[0.06]">
                        <th className="px-4 py-3 text-left text-xs font-bold text-white/50 uppercase tracking-wider">
                            Timestamp
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-white/50 uppercase tracking-wider">
                            Performed By
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-white/50 uppercase tracking-wider">
                            Action
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-white/50 uppercase tracking-wider">
                            Target Role
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-white/50 uppercase tracking-wider">
                            Permission
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-white/50 uppercase tracking-wider">
                            Change
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {entries.map((entry) => (
                        <motion.tr
                            key={entry.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                        >
                            {/* Timestamp */}
                            <td className="px-4 py-3">
                                <div className="flex items-center gap-2 text-xs text-white/40">
                                    <Clock className="size-3.5" />
                                    {formatTimestamp(entry.timestamp)}
                                </div>
                            </td>

                            {/* Performed By */}
                            <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                    <User className="size-3.5 text-white/30" />
                                    <span className="text-sm text-white/70">{entry.performed_by}</span>
                                </div>
                            </td>

                            {/* Action */}
                            <td className="px-4 py-3">
                                <Badge variant={getActionBadgeVariant(entry.action)} size="sm">
                                    {entry.action}
                                </Badge>
                            </td>

                            {/* Target Role */}
                            <td className="px-4 py-3">
                                {entry.target_role ? (
                                    <div className="flex items-center gap-2">
                                        <Shield className="size-3.5 text-white/30" />
                                        <span className="text-sm text-white/70">{entry.target_role}</span>
                                    </div>
                                ) : (
                                    <span className="text-sm text-white/20">-</span>
                                )}
                            </td>

                            {/* Permission */}
                            <td className="px-4 py-3">
                                {entry.permission_key ? (
                                    <div className="flex items-center gap-2">
                                        <Key className="size-3.5 text-white/30" />
                                        <span className="text-sm text-white/70 font-mono">
                                            {entry.permission_key}
                                        </span>
                                    </div>
                                ) : (
                                    <span className="text-sm text-white/20">-</span>
                                )}
                            </td>

                            {/* Change */}
                            <td className="px-4 py-3">
                                {entry.old_value || entry.new_value ? (
                                    <div className="flex items-center gap-1.5 text-xs">
                                        <span
                                            className={`px-1.5 py-0.5 rounded ${
                                                entry.old_value === 'true'
                                                    ? 'bg-red-500/10 text-red-400'
                                                    : 'bg-white/5 text-white/40'
                                            }`}
                                        >
                                            {entry.old_value === 'true' ? 'Yes' : entry.old_value === 'false' ? 'No' : '-'}
                                        </span>
                                        <ArrowRight className="size-3 text-white/20" />
                                        <span
                                            className={`px-1.5 py-0.5 rounded ${
                                                entry.new_value === 'true'
                                                    ? 'bg-emerald-500/10 text-emerald-400'
                                                    : 'bg-white/5 text-white/40'
                                            }`}
                                        >
                                            {entry.new_value === 'true' ? 'Yes' : entry.new_value === 'false' ? 'No' : '-'}
                                        </span>
                                    </div>
                                ) : (
                                    <span className="text-sm text-white/20">-</span>
                                )}
                            </td>
                        </motion.tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
