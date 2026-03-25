'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '@/hooks/use-auth';
import { useServerStats } from '@/hooks/use-server-stats';
import { AppShell } from '@/components/layout';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge, OnlineDot } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/error-debug-toast';
import siteConfig from '@/lib/site.config';
import {
  User, Edit3, Shield, ShieldCheck, ShieldAlert,
  Server, Clock, Heart, MapPin, Gamepad2,
  MessageSquare, Settings, Link2, Copy, Check,
  Phone, Mail
} from 'lucide-react';
import { clsx } from 'clsx';

function SkinViewer({ username }: { username: string }) {
  const [rotation, setRotation] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (!isHovered) {
      const interval = setInterval(() => {
        setRotation(prev => prev + 0.5);
      }, 50);
      return () => clearInterval(interval);
    }
  }, [isHovered]);

  const skinUrl = `https://mc-heads.net/body/${username}/256`;

  return (
    <div
      className="relative size-48 mx-auto cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ perspective: '800px' }}
    >
      <motion.div
        className="w-full h-full"
        style={{
          transformStyle: 'preserve-3d',
          transform: `rotateY(${rotation}deg)`,
        }}
      >
        <img
          src={skinUrl}
          alt={`${username}'s skin`}
          className="w-full h-full object-contain drop-shadow-[0_0_20px_rgba(20,184,166,0.3)]"
          onError={(e) => {
            (e.target as HTMLImageElement).src = 'https://mc-heads.net/body/MHF_Steve/256';
          }}
        />
      </motion.div>
      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-white/20 font-medium">
        {isHovered ? 'Drag to rotate' : 'Auto-rotating'}
      </div>
    </div>
  );
}

function StatBlock({ label, value, icon: Icon }: { label: string; value: string | number; icon: React.ElementType }) {
  return (
    <div className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.06]">
      <div className="flex items-center gap-2 text-white/40 text-xs mb-2">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className="text-xl font-bold text-white">{value}</div>
    </div>
  );
}

export default function ProfilePage() {
  const { user, isLoading: authLoading, refresh: refreshAuth } = useAuth();
  const { players, server } = useServerStats(5000);
  const addToast = useToast(s => s.addToast);

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ site_name: '', discord_username: '', phone_number: '' });
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const [tickets, setTickets] = useState<any[]>([]);
  const [newTicket, setNewTicket] = useState('');
  const [creatingTicket, setCreatingTicket] = useState(false);

  useEffect(() => {
    if (user) {
      setEditForm({
        site_name: user.site_name || '',
        discord_username: user.discord_username || '',
        phone_number: user.phone_number || '',
      });
    }
  }, [user]);

  useEffect(() => {
    fetch('/api/tickets').then(r => r.ok ? r.json() : []).then(setTickets).catch(() => { });
  }, []);

  const playerData = user?.mc_username
    ? players.find(p => p.name.toLowerCase() === user.mc_username?.toLowerCase())
    : null;

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/users/me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) throw new Error('Failed to update');
      addToast({ type: 'success', title: 'Updated', message: 'Profile saved.' });
      setEditing(false);
      refreshAuth();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicket.trim()) return;
    setCreatingTicket(true);
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTicket }),
      });
      if (!res.ok) throw new Error('Failed to create ticket');
      addToast({ type: 'success', title: 'Ticket Created', message: 'Support will assist you shortly.' });
      setNewTicket('');
      const data = await res.json();
      setTickets(prev => [data, ...prev]);
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message });
    } finally {
      setCreatingTicket(false);
    }
  };

const copyIP = async () => {
  try {
    await navigator.clipboard.writeText(siteConfig.brand.serverIp);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  } catch { }
};

  if (authLoading) {
    return (
      <AppShell>
        <div className="space-y-6">
          <Skeleton className="h-48 rounded-2xl" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Skeleton className="h-64 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl lg:col-span-2" />
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Profile Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent border border-white/[0.06] p-6 md:p-8"
        >
          <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 blur-[120px] rounded-full pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row gap-8 items-center md:items-start">
            {/* Avatar Stack: Discord + Minecraft */}
            <div className="shrink-0 relative">
              <SkinViewer username={user?.mc_username || 'MHF_Steve'} />
              {/* Discord Avatar Badge */}
              {user?.avatar_url && (
                <div className="absolute -bottom-2 -right-2 w-12 h-12 rounded-full border-2 border-[#5865F2] overflow-hidden bg-[#5865F2]">
                  <img
                    src={user.avatar_url}
                    alt="Discord avatar"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 text-center md:text-left">
              <div className="flex flex-col md:flex-row md:items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-white">
                  {user?.site_name || user?.mc_username || 'Player'}
                </h1>
                {playerData?.is_online && (
                  <Badge variant="success" pulse>
                    <OnlineDot online /> Online
                  </Badge>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 mb-4 justify-center md:justify-start">
                <span className="text-sm text-white/40 font-mono">{user?.mc_username}</span>
                <button onClick={copyIP} className="text-white/20 hover:text-white/40 transition-colors">
                  {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
                </button>
              </div>

              <div className="flex flex-wrap gap-2 mb-6 justify-center md:justify-start">
                {user?.roles?.map(role => (
                  <Badge
                    key={role}
                    variant={
                      role === 'owner' || role === 'admin' ? 'success' :
                        role === 'god' ? 'accent' :
                          role === 'helper' ? 'info' :
                            'default'
                    }
                    size="md"
                  >
                    {role}
                  </Badge>
                ))}
              </div>

              <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Edit3 className="size-4" />}
                  onClick={() => setEditing(true)}
                >
                  Edit Profile
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Copy className="size-4" />}
                  onClick={copyIP}
                >
                  {copied ? 'Copied!' : 'Copy Server IP'}
                </Button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Edit Modal */}
        <Modal
          open={editing}
          onClose={() => setEditing(false)}
          title="Edit Profile"
          description="Update your display information"
        >
          <div className="space-y-4">
            <Input
              label="Email Address"
              value={user?.email || ''}
              disabled
              icon={<Mail className="size-4" />}
              className="bg-white/5"
            />
            <Input
              label="Site Display Name"
              value={editForm.site_name}
              onChange={e => setEditForm({ ...editForm, site_name: e.target.value })}
              placeholder="Your display name"
            />
            <Input
              label="Discord Username"
              value={editForm.discord_username}
              disabled
              className="bg-white/5"
              icon={<MessageSquare className="size-4" />}
            />
            <Input
              label="Phone Number"
              value={editForm.phone_number}
              onChange={e => setEditForm({ ...editForm, phone_number: e.target.value })}
              placeholder="+1 234 567 8900"
              icon={<Phone className="size-4" />}
            />
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-sm text-amber-400">
              <strong>Note:</strong> Minecraft username cannot be changed without admin intervention.
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
              <Button onClick={handleSave} loading={saving}>Save Changes</Button>
            </div>
          </div>
        </Modal>

        {/* Stats & Tickets */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Stats */}
          <div className="space-y-6">
            {/* Account Status */}
            <Card variant="glass" padding="md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="size-5 text-blue-400" />
                  Account Status
                </CardTitle>
              </CardHeader>
              {playerData?.is_banned ? (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <p className="text-red-400 font-bold flex items-center gap-2">
                    <ShieldAlert className="size-5" /> BANNED
                  </p>
                  <p className="text-sm text-red-300/70 mt-1">
                    Reason: {playerData.ban_reason || 'No reason specified'}
                  </p>
                </div>
              ) : (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-between">
                  <span className="text-emerald-400 font-bold flex items-center gap-2">
                    <ShieldCheck className="size-5" /> Good Standing
                  </span>
                  <Badge variant="success">Active</Badge>
                </div>
              )}
            </Card>

            {/* Player Stats */}
            <Card variant="glass" padding="md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="size-5 text-emerald-400" />
                  In-Game Stats
                </CardTitle>
              </CardHeader>
              <div className="grid grid-cols-2 gap-3">
                <StatBlock
                  label="Playtime"
                  value={`${Math.floor((playerData?.total_playtime_seconds || 0) / 3600)}h`}
                  icon={Clock}
                />
                <StatBlock
                  label="Health"
                  value={playerData?.health?.toFixed(0) ?? 'N/A'}
                  icon={Heart}
                />
                <StatBlock
                  label="Gamemode"
                  value={playerData?.gamemode || 'N/A'}
                  icon={Gamepad2}
                />
                <StatBlock
                  label="Whitelisted"
                  value={playerData?.is_whitelisted ? 'Yes' : 'No'}
                  icon={Shield}
                />
              </div>
              {playerData && (
                <div className="mt-4 p-3 bg-white/[0.02] rounded-xl border border-white/[0.04]">
                  <div className="text-xs text-white/40 mb-1">Location</div>
                  <div className="text-sm text-white font-mono">
                    X: {playerData.x?.toFixed(0)}, Y: {playerData.y?.toFixed(0)}, Z: {playerData.z?.toFixed(0)}
                  </div>
                  <div className="text-xs text-white/30 mt-1">{playerData.world || 'world'}</div>
                </div>
              )}
            </Card>

            {/* Account Details */}
            <Card variant="glass" padding="md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="size-5 text-blue-400" />
                  Account Details
                </CardTitle>
              </CardHeader>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-white/[0.02] rounded-xl border border-white/[0.04]">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <Mail className="size-4 text-blue-400" />
                    </div>
                    <div>
                      <div className="text-xs text-white/40">Email</div>
                      <div className="text-sm font-medium text-white">{user?.email}</div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 bg-white/[0.02] rounded-xl border border-white/[0.04]">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                      <span className="text-sm">🎮</span>
                    </div>
                    <div>
                      <div className="text-xs text-white/40">Minecraft</div>
                      <div className="text-sm font-medium text-white font-mono">{user?.mc_username || 'Not linked'}</div>
                    </div>
                  </div>
                  <Badge variant={user?.mc_username ? 'success' : 'default'} size="sm">
                    {user?.mc_username ? 'Linked' : 'None'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-white/[0.02] rounded-xl border border-white/[0.04]">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                      <span className="text-sm">💬</span>
                    </div>
                    <div>
                      <div className="text-xs text-white/40">Discord</div>
                      <div className="text-sm font-medium text-white">{user?.discord_username || 'Not linked'}</div>
                    </div>
                  </div>
                  <Badge variant={user?.discord_username ? 'success' : 'default'} size="sm">
                    {user?.discord_username ? 'Linked' : 'None'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-white/[0.02] rounded-xl border border-white/[0.04]">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                      <Phone className="size-4 text-purple-400" />
                    </div>
                    <div>
                      <div className="text-xs text-white/40">Phone</div>
                      <div className="text-sm font-medium text-white">{user?.phone_number || 'Not set'}</div>
                    </div>
                  </div>
                  <Badge variant={user?.phone_number ? 'success' : 'default'} size="sm">
                    {user?.phone_number ? 'Set' : 'Missing'}
                  </Badge>
                </div>
              </div>
            </Card>
          </div>

          {/* Right: Tickets */}
          <div className="lg:col-span-2">
            <Card variant="glass" padding="md" className="min-h-[500px]">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="size-5 text-emerald-400" />
                    Support Tickets
                  </CardTitle>
                  <Badge variant="info">{tickets.filter(t => t.status === 'open').length} open</Badge>
                </div>
              </CardHeader>

              <form onSubmit={handleCreateTicket} className="flex gap-3 mb-6">
                <Input
                  value={newTicket}
                  onChange={e => setNewTicket(e.target.value)}
                  placeholder="What do you need help with?"
                  className="flex-1"
                />
                <Button type="submit" loading={creatingTicket} disabled={!newTicket.trim()}>
                  Open Ticket
                </Button>
              </form>

              <div className="space-y-3">
                {tickets.length === 0 ? (
                  <div className="text-center py-12 text-white/30">
                    <MessageSquare className="size-12 mx-auto mb-3 opacity-30" />
                    <p>No support tickets yet</p>
                  </div>
                ) : (
                  tickets.map(ticket => (
                    <Link key={ticket.id} href={`/tickets/${ticket.id}`}>
                      <motion.div
                        whileHover={{ x: 4 }}
                        className="p-4 bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.04] hover:border-white/[0.08] rounded-xl transition-all cursor-pointer"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-white font-medium">{ticket.title}</h4>
                            <p className="text-xs text-white/30 mt-1 font-mono">
                              #{ticket.id?.slice(0, 8)} • {new Date(ticket.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <Badge
                            variant={
                              ticket.status === 'open' ? 'success' :
                                ticket.status === 'in-progress' ? 'warning' :
                                  'default'
                            }
                          >
                            {ticket.status}
                          </Badge>
                        </div>
                      </motion.div>
                    </Link>
                  ))
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
