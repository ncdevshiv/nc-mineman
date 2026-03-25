'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'motion/react';
import { useAuth } from '@/hooks/use-auth';
import { AppShell } from '@/components/layout';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge, OnlineDot } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/error-debug-toast';
import {
  User, Users, Heart, HeartOff, Flag, UserPlus, UserMinus,
  Shield, Clock, Activity, Ban, Package, Eye, Search,
  Gavel, AlertTriangle, Zap, Lock, Unlock
} from 'lucide-react';

interface PlayerProfile {
  id: string;
  mc_username: string;
  site_name: string;
  roles: string[];
  created_at: string;
  is_online: boolean;
  followers: number;
  following: number;
  is_followed_by_me: boolean;
  active_moderation?: any[];
}

export default function PlayerProfilePage() {
  const params = useParams();
  const playerId = params.id as string;
  const { user, isAdmin, isGod, isHelper } = useAuth();
  const addToast = useToast(s => s.addToast);

  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [inventory, setInventory] = useState<any[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(false);

  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDescription, setReportDescription] = useState('');

  const [showModModal, setShowModModal] = useState(false);
  const [modAction, setModAction] = useState('');
  const [modReason, setModReason] = useState('');
  const [modDuration, setModDuration] = useState('');

  const isMod = isAdmin || isGod || isHelper;
  const isOwnProfile = user?.id === playerId;

  useEffect(() => {
    if (playerId) loadProfile();
  }, [playerId]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/players/${playerId}`);
      if (res.ok) setProfile(await res.json());
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const loadInventory = async () => {
    if (!isMod && !isOwnProfile) return;
    setLoadingInventory(true);
    try {
      const res = await fetch(`/api/inventory/${playerId}`);
      if (res.ok) setInventory(await res.json());
    } catch {
    } finally {
      setLoadingInventory(false);
    }
  };

  const toggleFollow = async () => {
    if (!profile) return;
    try {
      const method = profile.is_followed_by_me ? 'DELETE' : 'POST';
      const body = method === 'POST'
        ? JSON.stringify({ target_id: playerId })
        : undefined;
      const url = method === 'DELETE'
        ? `/api/users/me/follows?targetId=${playerId}`
        : '/api/users/me/follows';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      if (!res.ok) throw new Error('Failed');
      loadProfile();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message });
    }
  };

  const sendFriendRequest = async () => {
    try {
      const res = await fetch('/api/users/me/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to_id: playerId, type: 'friend' }),
      });
      if (!res.ok) throw new Error('Failed to send request');
      addToast({ type: 'success', title: 'Sent', message: 'Friend request sent!' });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message });
    }
  };

  const submitReport = async () => {
    if (!reportReason.trim()) return;
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reported_id: playerId, reason: reportReason, description: reportDescription }),
      });
      if (!res.ok) throw new Error('Failed to submit report');
      addToast({ type: 'success', title: 'Reported', message: 'Report submitted.' });
      setShowReportModal(false);
      setReportReason('');
      setReportDescription('');
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message });
    }
  };

  const executeModAction = async () => {
    if (!modAction) return;
    try {
      const durationMap: Record<string, number | undefined> = {
        timeout: modDuration ? parseInt(modDuration) * 60 : 10,
        mute: modDuration ? parseInt(modDuration) * 60 : 10,
        jail: modDuration ? parseInt(modDuration) * 60 : undefined,
        freeze: modDuration ? parseInt(modDuration) * 60 : undefined,
      };

      // Save to our DB
      const res = await fetch('/api/moderation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_user_id: playerId,
          action: modAction,
          reason: modReason || `${modAction} action`,
          duration_seconds: durationMap[modAction],
        }),
      });
      if (!res.ok) throw new Error('Failed to execute action');

      // Also execute on the actual Minecraft server via plugin API
      if (profile?.mc_username) {
        try {
          const pluginActionMap: Record<string, any> = {
            ban: { action: 'ban', targetUuid: profile.mc_username, reason: modReason, durationMinutes: modDuration ? parseInt(modDuration) : undefined },
            unban: { action: 'unban', targetUuid: profile.mc_username },
            kick: { action: 'kick', targetUuid: profile.mc_username, reason: modReason },
            mute: { action: 'warn', targetUuid: profile.mc_username, message: modReason || 'You have been muted' },
            freeze: { action: 'freeze', targetUuid: profile.mc_username, frozen: true },
            jail: { action: 'jail', targetUuid: profile.mc_username, jailed: true },
            slap: { action: 'slap', targetUuid: profile.mc_username, damage: 4.0 },
            timeout: { action: 'timeout', targetUuid: profile.mc_username, durationSeconds: durationMap.timeout || 600, reason: modReason },
          };

          const pluginPayload = pluginActionMap[modAction];
          if (pluginPayload) {
            await fetch(`/api/serverstats/proxy?path=moderation`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ...pluginPayload,
                moderatorUuid: user?.id || 'system',
              }),
            }).catch(() => {});
          }
        } catch {
          // Plugin API may be offline, action still saved to DB
        }
      }

      addToast({ type: 'success', title: 'Done', message: `${modAction} applied.` });
      setShowModModal(false);
      setModAction('');
      setModReason('');
      setModDuration('');
      loadProfile();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message });
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Skeleton variant="circular" className="size-16" />
            <div>
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-24 mt-2" />
            </div>
          </div>
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      </AppShell>
    );
  }

  if (!profile) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card variant="glass" padding="lg" className="text-center max-w-md">
            <User className="size-12 mx-auto mb-3 text-white/30" />
            <h2 className="text-xl font-bold text-white mb-2">Player Not Found</h2>
            <p className="text-white/40 text-sm">This player profile does not exist.</p>
            <Link href="/players">
              <Button variant="secondary" size="sm" className="mt-4">Back to Players</Button>
            </Link>
          </Card>
        </div>
      </AppShell>
    );
  }

  const modActions = [
    { id: 'ban', label: 'Ban', icon: Ban, color: 'text-red-400', desc: 'Ban from server' },
    { id: 'kick', label: 'Kick', icon: UserMinus, color: 'text-orange-400', desc: 'Kick from server' },
    { id: 'mute', label: 'Mute', icon: Lock, color: 'text-yellow-400', desc: 'Mute in chat' },
    { id: 'freeze', label: 'Freeze', icon: Zap, color: 'text-blue-400', desc: 'Freeze player' },
    { id: 'jail', label: 'Jail', icon: Shield, color: 'text-purple-400', desc: 'Send to jail' },
    { id: 'slap', label: 'Slap', icon: AlertTriangle, color: 'text-pink-400', desc: 'Slap player' },
    { id: 'timeout', label: 'Timeout', icon: Clock, color: 'text-amber-400', desc: 'Temporary timeout' },
  ];

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Profile Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent border border-white/[0.06] p-6 md:p-8"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Avatar name={profile.mc_username || profile.site_name} size="xl" online={profile.is_online} />
              <div>
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                  {profile.mc_username || profile.site_name}
                  {profile.is_online && <OnlineDot online />}
                </h1>
                <p className="text-white/40 mt-1">{profile.site_name}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {(profile.roles || []).map(r => (
                    <Badge key={r} variant={r === 'admin' || r === 'owner' ? 'success' : 'default'} size="sm">
                      {r}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {!isOwnProfile && (
                <>
                  <Button variant="secondary" size="sm" icon={<UserPlus className="size-4" />} onClick={sendFriendRequest}>
                    Add Friend
                  </Button>
                  <Button
                    variant={profile.is_followed_by_me ? 'primary' : 'secondary'}
                    size="sm"
                    icon={profile.is_followed_by_me ? <HeartOff className="size-4" /> : <Heart className="size-4" />}
                    onClick={toggleFollow}
                  >
                    {profile.is_followed_by_me ? 'Unfollow' : 'Follow'}
                  </Button>
                  <Button variant="ghost" size="sm" icon={<Flag className="size-4" />} onClick={() => setShowReportModal(true)}>
                    Report
                  </Button>
                </>
              )}
              {isMod && !isOwnProfile && (
                <Button variant="danger" size="sm" icon={<Shield className="size-4" />} onClick={() => setShowModModal(true)}>
                  Moderate
                </Button>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.06]">
              <div className="text-xs text-white/40">Followers</div>
              <div className="text-lg font-bold text-white mt-1">{profile.followers}</div>
            </div>
            <div className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.06]">
              <div className="text-xs text-white/40">Following</div>
              <div className="text-lg font-bold text-white mt-1">{profile.following}</div>
            </div>
            <div className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.06]">
              <div className="text-xs text-white/40">Joined</div>
              <div className="text-lg font-bold text-white mt-1">
                {profile.created_at ? new Date(profile.created_at).toLocaleDateString() : 'N/A'}
              </div>
            </div>
          </div>

          {/* Active Moderation (admin/mod only) */}
          {isMod && profile.active_moderation && profile.active_moderation.length > 0 && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
              <div className="text-xs font-bold text-red-400 uppercase tracking-wider mb-2">Active Moderation</div>
              {profile.active_moderation.map((m: any) => (
                <div key={m.id} className="text-sm text-red-300/80">
                  {m.action}: {m.reason || 'No reason'} {m.expires_at ? `(expires ${new Date(m.expires_at).toLocaleString()})` : '(permanent)'}
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Inventory (admin/mod view or own profile) */}
        {(isMod || isOwnProfile) && (
          <Card variant="glass" padding="md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Package className="size-5 text-emerald-400" />
                  {isOwnProfile ? 'My Inventory' : `${profile.mc_username || profile.site_name}'s Inventory`}
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={loadInventory} loading={loadingInventory}>
                  {inventory.length > 0 ? 'Refresh' : 'Load'}
                </Button>
              </div>
            </CardHeader>
            {loadingInventory ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : inventory.length === 0 ? (
              <div className="text-center py-8 text-white/30 text-sm">
                {inventory.length === 0 && !loadingInventory ? 'Click Load to view inventory' : 'No items in inventory'}
              </div>
            ) : (
              <div className="space-y-2">
                {inventory.map(item => (
                  <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                    <div className="size-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                      <Package className="size-5 text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white">{item.item_name}</div>
                      <div className="text-xs text-white/30">
                        {item.item_type} • x{item.quantity} • {new Date(item.acquired_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {item.is_frozen && <Badge variant="danger" size="sm">Frozen</Badge>}
                      {item.is_hidden && <Badge variant="warning" size="sm">Hidden</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}
      </div>

      {/* Report Modal */}
      <Modal
        open={showReportModal}
        onClose={() => setShowReportModal(false)}
        title={`Report ${profile.mc_username || profile.site_name}`}
      >
        <div className="space-y-4">
          <Input
            label="Reason"
            value={reportReason}
            onChange={e => setReportReason(e.target.value)}
            placeholder="e.g., Harassment, Cheating, Spam"
            required
          />
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-white/50 uppercase tracking-wider">Details</label>
            <textarea
              value={reportDescription}
              onChange={e => setReportDescription(e.target.value)}
              placeholder="Describe what happened..."
              className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 min-h-[100px] resize-none"
            />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="ghost" onClick={() => setShowReportModal(false)}>Cancel</Button>
            <Button variant="danger" onClick={submitReport} disabled={!reportReason.trim()}>Submit Report</Button>
          </div>
        </div>
      </Modal>

      {/* Moderation Modal */}
      <Modal
        open={showModModal}
        onClose={() => { setShowModModal(false); setModAction(''); }}
        title={`Moderate ${profile.mc_username || profile.site_name}`}
        size="lg"
      >
        <div className="space-y-4">
          {!modAction ? (
            <div className="grid grid-cols-2 gap-3">
              {modActions.map(action => (
                <button
                  key={action.id}
                  onClick={() => setModAction(action.id)}
                  className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] transition-colors text-left"
                >
                  <action.icon className={`size-5 ${action.color}`} />
                  <div>
                    <div className="text-sm font-medium text-white">{action.label}</div>
                    <div className="text-xs text-white/30">{action.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
                <AlertTriangle className="size-4 inline mr-2" />
                Executing: <strong>{modAction}</strong> on {profile.mc_username || profile.site_name}
              </div>
              <Input
                label="Reason"
                value={modReason}
                onChange={e => setModReason(e.target.value)}
                placeholder="Reason for this action"
              />
              {['timeout', 'mute', 'jail', 'freeze'].includes(modAction) && (
                <Input
                  label="Duration (minutes)"
                  type="number"
                  value={modDuration}
                  onChange={e => setModDuration(e.target.value)}
                  placeholder="Leave empty for permanent"
                />
              )}
              <div className="flex gap-3 justify-end pt-2">
                <Button variant="ghost" onClick={() => setModAction('')}>Back</Button>
                <Button variant="danger" onClick={executeModAction}>
                  Execute {modAction}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </AppShell>
  );
}
