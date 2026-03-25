'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { AppShell } from '@/components/layout';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/components/ui/error-debug-toast';
import {
  RefreshCw, Save, Plus, Trash2, Check,
  MessageSquare, Shield, ArrowRight,
  Users, Crown, Star, Zap, ShieldCheck,
  Sparkles
} from 'lucide-react';

interface DiscordRole {
  id: string;
  name: string;
  color: number;
  position: number;
  managed: boolean;
  mentionable: boolean;
}

interface RoleMapping {
  discordRoleId: string;
  discordRoleName: string;
  siteRole: string;
  direction: 'discord-to-site' | 'site-to-discord' | 'both';
}

const SITE_ROLES = [
  { value: 'owner', label: 'Owner', icon: Crown, color: 'text-yellow-400' },
  { value: 'admin', label: 'Admin', icon: Shield, color: 'text-red-400' },
  { value: 'god', label: 'God', icon: Star, color: 'text-purple-400' },
  { value: 'helper', label: 'Helper', icon: Zap, color: 'text-blue-400' },
  { value: 'member', label: 'Member', icon: Users, color: 'text-emerald-400' },
  { value: 'youtuber', label: 'YouTuber', icon: Star, color: 'text-rose-400' },
  { value: 'custom', label: 'Custom', icon: Sparkles, color: 'text-pink-400' },
];

const SYNC_DIRECTIONS = [
  { value: 'discord-to-site', label: 'Discord → Site', description: 'Sync role from Discord to Site only' },
  { value: 'site-to-discord', label: 'Site → Discord', description: 'Sync role from Site to Discord only' },
  { value: 'both', label: 'Both Ways', description: 'Sync role in both directions' },
];

function getRoleColor(color: number): string {
  if (!color) return 'text-white';
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  return `rgb(${r}, ${g}, ${b})`;
}

function getRoleBadgeStyle(color: number): { background: string; border: string } {
  if (!color) return { background: 'rgba(255,255,255,0.1)', border: 'rgba(255,255,255,0.2)' };
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  return {
    background: `rgba(${r},${g},${b},0.15)`,
    border: `rgba(${r},${g},${b},0.4)`,
  };
}

export default function DiscordRolesPage() {
  const { user, isLoading: authLoading } = useAuth();
  const addToast = useToast(s => s.addToast);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [roles, setRoles] = useState<DiscordRole[]>([]);
  const [guild, setGuild] = useState<{ id: string; name: string } | null>(null);
  const [mappings, setMappings] = useState<RoleMapping[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    fetchRoles();
  }, [refreshKey]);

  const fetchRoles = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/discord');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setRoles(data.roles || []);
      setGuild(data.guild || null);
      setMappings(data.mappings?.map((m: any) => ({
        discordRoleId: m.discord_role_id,
        discordRoleName: m.discord_role_name,
        siteRole: m.site_role,
        direction: m.sync_direction || 'discord-to-site',
      })) || []);
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleAddMapping = () => {
    setMappings(prev => [
      ...prev,
      { discordRoleId: '', discordRoleName: '', siteRole: 'member', direction: 'discord-to-site' },
    ]);
  };

  const handleRemoveMapping = (index: number) => {
    setMappings(prev => prev.filter((_, i) => i !== index));
  };

  const handleMappingChange = (index: number, field: keyof RoleMapping, value: string) => {
    setMappings(prev => prev.map((m, i) => {
      if (i !== index) return m;
      const updated = { ...m, [field]: value };
      // Auto-fill role name when role ID is selected
      if (field === 'discordRoleId' && value) {
        const role = roles.find(r => r.id === value);
        if (role) updated.discordRoleName = role.name;
      }
      return updated;
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/discord', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_mappings', mappings }),
      });
      if (!res.ok) throw new Error('Failed to save');
      addToast({ type: 'success', title: 'Saved', message: 'Role mappings updated successfully.' });
      setRefreshKey(k => k + 1);
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message });
    } finally {
      setSaving(false);
    }
  };

  const unmappedRoles = roles.filter(role =>
    !mappings.some(m => m.discordRoleId === role.id)
  );

  if (authLoading) {
    return (
      <AppShell>
        <div className="space-y-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Discord Role Sync</h1>
            <p className="text-white/50 mt-1">
              Configure how Discord roles map to site roles
              {guild && <span className="ml-2 text-[#5865F2]">• {guild.name}</span>}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              icon={<RefreshCw className="size-4" />}
              onClick={() => setRefreshKey(k => k + 1)}
              disabled={loading}
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Save className="size-4" />}
              onClick={handleSave}
              loading={saving}
            >
              Save Changes
            </Button>
          </div>
        </div>

        {/* Current Mappings */}
        <Card variant="glass" padding="md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="size-5 text-emerald-400" />
              Role Mappings ({mappings.length})
            </CardTitle>
            <CardDescription>
              Define which Discord roles grant which site permissions
            </CardDescription>
          </CardHeader>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
            </div>
          ) : mappings.length === 0 ? (
            <div className="text-center py-12 text-white/30">
              <Shield className="size-12 mx-auto mb-3 opacity-30" />
              <p>No role mappings configured</p>
              <p className="text-sm mt-1">Click "Add Mapping" to create one</p>
            </div>
          ) : (
            <div className="space-y-3">
              {mappings.map((mapping, index) => {
                const discordRole = roles.find(r => r.id === mapping.discordRoleId);
                const siteRole = SITE_ROLES.find(r => r.value === mapping.siteRole);
                const RoleIcon = siteRole?.icon || Users;
                const style = discordRole ? getRoleBadgeStyle(discordRole.color) : { background: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.1)' };

                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]"
                  >
                    {/* Discord Role */}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-white/40 mb-1">Discord Role</div>
                      <select
                        value={mapping.discordRoleId}
                        onChange={e => handleMappingChange(index, 'discordRoleId', e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white appearance-none cursor-pointer"
                        style={style}
                      >
                        <option value="">Select Discord role...</option>
                        {roles.map(role => (
                          <option key={role.id} value={role.id} style={{ color: getRoleColor(role.color) }}>
                            {role.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Arrow */}
                    <ArrowRight className="size-5 text-white/30 shrink-0" />

                    {/* Site Role */}
                    <div className="w-40">
                      <div className="text-xs text-white/40 mb-1">Site Role</div>
                      <select
                        value={mapping.siteRole}
                        onChange={e => handleMappingChange(index, 'siteRole', e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white appearance-none cursor-pointer"
                      >
                        {SITE_ROLES.map(role => (
                          <option key={role.value} value={role.value}>
                            {role.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Direction */}
                    <div className="w-44">
                      <div className="text-xs text-white/40 mb-1">Sync Direction</div>
                      <select
                        value={mapping.direction}
                        onChange={e => handleMappingChange(index, 'direction', e.target.value as any)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white appearance-none cursor-pointer"
                      >
                        {SYNC_DIRECTIONS.map(dir => (
                          <option key={dir.value} value={dir.value}>
                            {dir.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Delete */}
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Trash2 className="size-4 text-red-400" />}
                      onClick={() => handleRemoveMapping(index)}
                      className="shrink-0"
                    />
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Add Mapping Button */}
          <div className="mt-4 pt-4 border-t border-white/[0.06]">
            <Button
              variant="ghost"
              size="sm"
              icon={<Plus className="size-4" />}
              onClick={handleAddMapping}
            >
              Add Mapping
            </Button>
          </div>
        </Card>

        {/* Available Roles */}
        <Card variant="glass" padding="md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="size-5 text-[#5865F2]" />
              Discord Server Roles ({unmappedRoles.length} unmapped)
            </CardTitle>
            <CardDescription>
              All roles in the Elsahideout Discord server
            </CardDescription>
          </CardHeader>

          <div className="flex flex-wrap gap-2">
            {unmappedRoles.length === 0 ? (
              <div className="text-center py-8 text-white/30 w-full">
                <Check className="size-8 mx-auto mb-2 text-emerald-400" />
                <p>All Discord roles are mapped!</p>
              </div>
            ) : (
              unmappedRoles.map(role => (
                <Badge
                  key={role.id}
                  variant="default"
                  className="border"
                >
                  {role.name}
                </Badge>
              ))
            )}
          </div>
        </Card>

        {/* Info Box */}
        <div className="bg-[#5865F2]/10 border border-[#5865F2]/20 rounded-xl p-4 text-sm text-white/70">
          <strong className="text-[#5865F2]">How Role Sync Works:</strong>
          <ul className="mt-2 space-y-1 text-white/60">
            <li>• <strong>Discord → Site:</strong> When a user logs in, their Discord roles are checked and site roles are assigned automatically</li>
            <li>• <strong>Site → Discord:</strong> (Future) Site roles can push back to Discord via role connection API</li>
            <li>• <strong>Both Ways:</strong> Role sync works in both directions</li>
            <li>• Users always get the <strong>member</strong> role by default regardless of Discord membership</li>
          </ul>
        </div>
      </div>
    </AppShell>
  );
}
