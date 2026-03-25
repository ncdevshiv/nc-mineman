'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '@/hooks/use-auth';
import { useHasPermission } from '@/hooks/use-permission';
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
  Users, Search, UserPlus, UserMinus, UserCheck,
  Clock, Check, X, ArrowLeftRight, MessageSquare,
  UserX, Heart, HeartOff, Flag, Eye, EyeOff
} from 'lucide-react';

interface FriendRequest {
  id: string;
  from_id: string;
  to_id: string;
  type: string;
  status: string;
  created_at: string;
  from_name?: string;
  to_name?: string;
  from_online_smp?: boolean;
  from_online_site?: boolean;
  to_online_smp?: boolean;
  to_online_site?: boolean;
}

interface Friend {
  id: string;
  name: string;
  online_smp: boolean;
  online_site: boolean;
  mc_username?: string;
  site_name?: string;
}

export default function SocialPage() {
  const { user } = useAuth();
  const addToast = useToast(s => s.addToast);

  const canSearch = useHasPermission('social.player.search');
  const canViewPublic = useHasPermission('social.player.view_public');
  const canSendFriendRequest = useHasPermission('social.friend.request');
  const canAcceptFriend = useHasPermission('social.friend.accept');
  const canRejectFriend = useHasPermission('social.friend.reject');
  const canFollow = useHasPermission('social.follow.request');
  const canReport = useHasPermission('social.report.submit');

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'search'>('friends');

  const [showReportModal, setShowReportModal] = useState(false);
  const [reportTarget, setReportTarget] = useState<any>(null);
  const [reportReason, setReportReason] = useState('');
  const [reportDescription, setReportDescription] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [friendsRes, requestsRes] = await Promise.all([
        fetch('/api/users/me/friends').then(r => r.ok ? r.json() : []).catch(() => []),
        fetch('/api/users/me/requests').then(r => r.ok ? r.json() : []).catch(() => []),
      ]);
      setFriends(friendsRes);
      setRequests(requestsRes.filter((r: FriendRequest) => r.to_id === user?.id && r.status === 'pending'));
      setSentRequests(requestsRes.filter((r: FriendRequest) => r.from_id === user?.id));
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const debouncedSearch = useCallback((query: string) => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    searchTimeoutRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
        if (res.ok) setSearchResults(await res.json());
      } catch {
      } finally {
        setSearching(false);
      }
    }, 300);
  }, []);

  useEffect(() => {
    debouncedSearch(searchQuery);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery, debouncedSearch]);

  const sendFriendRequest = async (targetId: string) => {
    try {
      const res = await fetch('/api/users/me/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to_id: targetId, type: 'friend' }),
      });
      if (!res.ok) throw new Error('Failed to send request');
      addToast({ type: 'success', title: 'Sent', message: 'Friend request sent!' });
      loadData();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message });
    }
  };

  const handleRequest = async (requestId: string, action: 'accept' | 'reject' | 'ignore') => {
    setActionLoading(requestId);
    try {
      const res = await fetch(`/api/users/me/requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: action === 'accept' ? 'accepted' : action === 'reject' ? 'rejected' : 'ignored'
        }),
      });
      if (!res.ok) throw new Error('Failed to update request');
      addToast({
        type: 'success',
        title: action === 'accept' ? 'Accepted' : action === 'reject' ? 'Rejected' : 'Ignored',
        message: `Friend request ${action === 'ignore' ? 'ignored' : action + 'ed'}.`
      });
      loadData();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  const cancelRequest = async (requestId: string) => {
    setActionLoading(requestId);
    try {
      const res = await fetch(`/api/users/me/requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'withdrawn' }),
      });
      if (!res.ok) throw new Error('Failed to cancel request');
      addToast({ type: 'success', title: 'Cancelled', message: 'Friend request cancelled.' });
      loadData();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  const removeFriend = async (friendId: string) => {
    try {
      const res = await fetch(`/api/users/me/friends/${friendId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to remove friend');
      addToast({ type: 'success', title: 'Removed', message: 'Friend removed.' });
      loadData();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message });
    }
  };

  const followUser = async (targetId: string) => {
    try {
      const res = await fetch('/api/users/me/follows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_id: targetId }),
      });
      if (!res.ok) throw new Error('Failed to follow');
      addToast({ type: 'success', title: 'Followed', message: 'You are now following this player.' });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message });
    }
  };

  const submitReport = async () => {
    if (!reportTarget || !reportReason.trim()) return;
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reported_id: reportTarget.id, reason: reportReason, description: reportDescription }),
      });
      if (!res.ok) throw new Error('Failed to submit report');
      addToast({ type: 'success', title: 'Reported', message: 'Report submitted successfully.' });
      setShowReportModal(false);
      setReportTarget(null);
      setReportReason('');
      setReportDescription('');
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message });
    }
  };

  const tabs = [
    { id: 'friends' as const, label: 'Friends', icon: Users, count: friends.length },
    { id: 'requests' as const, label: 'Requests', icon: UserPlus, count: requests.length },
    ...(canSearch ? [{ id: 'search' as const, label: 'Find Players', icon: Search }] : []),
  ];

  return (
    <AppShell>
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-center justify-between gap-4"
        >
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Users className="size-7 text-emerald-400" />
              Social Hub
            </h1>
            <p className="text-white/40 mt-1">Connect with other players</p>
          </div>
          <div className="flex gap-2">
            <Link href="/players">
              <Button variant="secondary" size="sm" icon={<Eye className="size-4" />}>
                Players Directory
              </Button>
            </Link>
          </div>
        </motion.div>

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
              {tab.count !== undefined && tab.count > 0 && (
                <Badge variant="success" size="sm">{tab.count}</Badge>
              )}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'friends' && (
            <motion.div key="friends" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Card variant="glass" padding="md">
                <CardHeader>
                  <CardTitle>Your Friends ({friends.length})</CardTitle>
                </CardHeader>
                {loading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3 p-3">
                        <Skeleton variant="circular" className="size-10" />
                        <Skeleton className="h-4 w-32" />
                      </div>
                    ))}
                  </div>
                ) : friends.length === 0 ? (
                  <div className="text-center py-12 text-white/30">
                    <Users className="size-12 mx-auto mb-3 opacity-30" />
                    <p>No friends yet. Use the search to find players!</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(() => {
                      const onlineSMP = friends.filter(f => f.online_smp);
                      const onlineSite = friends.filter(f => f.online_site && !f.online_smp);
                      const offline = friends.filter(f => !f.online_smp && !f.online_site);
                      const groups: { label: string; count: number; items: Friend[] }[] = [
                        { label: 'Online on SMP', count: onlineSMP.length, items: onlineSMP },
                        { label: 'Online on Site', count: onlineSite.length, items: onlineSite },
                        { label: 'Offline', count: offline.length, items: offline },
                      ].filter(g => g.count > 0);
                      return groups.map(group => (
                        <div key={group.label}>
                          <div className="text-xs font-bold text-white/30 uppercase tracking-wider px-1 py-2">{group.label} ({group.count})</div>
                          {group.items.map((friend, i) => (
                            <motion.div
                              key={friend.id}
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: i * 0.03 }}
                              className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.02] transition-colors"
                            >
                              <Avatar name={friend.mc_username || friend.name} size="md" online={friend.online_smp} />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-white">{friend.mc_username || friend.name}</div>
                                <div className="text-xs text-white/30 flex items-center gap-1">
                                  {friend.online_smp ? (
                                    <><OnlineDot online /> Online on SMP</>
                                  ) : friend.online_site ? (
                                    <><OnlineDot online /> Online on Site</>
                                  ) : 'Offline'}
                                </div>
                              </div>
                              <div className="flex gap-2">
                                {canViewPublic && (
                                  <Link href={`/players/${friend.id}`}>
                                    <Button variant="ghost" size="sm" icon={<Eye className="size-3" />}>View</Button>
                                  </Link>
                                )}
                                <Button
                                  variant="danger"
                                  size="sm"
                                  icon={<UserMinus className="size-3" />}
                                  onClick={() => removeFriend(friend.id)}
                                />
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      ));
                    })()}
                  </div>
                )}
              </Card>
            </motion.div>
          )}

          {activeTab === 'requests' && (
            <motion.div key="requests" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card variant="glass" padding="md">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <UserPlus className="size-5 text-emerald-400" />
                      Incoming ({requests.length})
                    </CardTitle>
                  </CardHeader>
                  {requests.length === 0 ? (
                    <div className="text-center py-8 text-white/30 text-sm">No pending requests</div>
                  ) : (
                    <div className="space-y-2">
                      {requests.map(req => (
                        <div key={req.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                          <Avatar name={req.from_name || 'Unknown'} size="sm" online={req.from_online_smp} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-white">{req.from_name || 'Unknown'}</div>
                            <div className="text-xs text-white/30 flex items-center gap-1">
                              <Clock className="size-3 inline mr-1" />
                              {new Date(req.created_at).toLocaleDateString()}
                              {req.from_online_smp && <span className="text-emerald-400 ml-1">Online on SMP</span>}
                              {req.from_online_site && !req.from_online_smp && <span className="text-blue-400 ml-1">Online on Site</span>}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              icon={<EyeOff className="size-3" />}
                              onClick={() => handleRequest(req.id, 'ignore')}
                              disabled={actionLoading === req.id}
                            />
                            {canAcceptFriend && (
                              <Button
                                variant="primary"
                                size="sm"
                                icon={<Check className="size-3" />}
                                onClick={() => handleRequest(req.id, 'accept')}
                                disabled={actionLoading === req.id}
                              />
                            )}
                            {canRejectFriend && (
                              <Button
                                variant="danger"
                                size="sm"
                                icon={<X className="size-3" />}
                                onClick={() => handleRequest(req.id, 'reject')}
                                disabled={actionLoading === req.id}
                              />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                <Card variant="glass" padding="md">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="size-5 text-amber-400" />
                      Sent ({sentRequests.length})
                    </CardTitle>
                  </CardHeader>
                  {sentRequests.length === 0 ? (
                    <div className="text-center py-8 text-white/30 text-sm">No sent requests</div>
                  ) : (
                    <div className="space-y-2">
                      {sentRequests.map(req => (
                        <div key={req.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                          <Avatar name={req.to_name || 'Unknown'} size="sm" online={req.to_online_smp} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-white">{req.to_name || 'Unknown'}</div>
                            <div className="text-xs text-white/30">
                              {req.status === 'pending' ? (
                                <>Pending...</>
                              ) : (
                                <span className={
                                  req.status === 'accepted' ? 'text-emerald-400' :
                                  req.status === 'rejected' ? 'text-red-400' :
                                  req.status === 'ignored' ? 'text-white/50' :
                                  'text-white/30'
                                }>
                                  {req.status === 'accepted' ? 'Accepted' :
                                   req.status === 'rejected' ? 'Rejected' :
                                   req.status === 'ignored' ? 'Ignored' :
                                   req.status === 'withdrawn' ? 'Withdrawn' : 'Unknown'}
                                </span>
                              )}
                            </div>
                          </div>
                          {req.status === 'pending' ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={<X className="size-3" />}
                              onClick={() => cancelRequest(req.id)}
                              disabled={actionLoading === req.id}
                            />
                          ) : (
                            <Badge
                              variant={
                                req.status === 'accepted' ? 'success' :
                                req.status === 'rejected' ? 'danger' :
                                req.status === 'ignored' ? 'default' :
                                'warning'
                              }
                              size="sm"
                            >
                              {req.status === 'accepted' ? 'Accepted' :
                               req.status === 'rejected' ? 'Rejected' :
                               req.status === 'ignored' ? 'Ignored' :
                               req.status === 'withdrawn' ? 'Withdrawn' : req.status}
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            </motion.div>
          )}

          {activeTab === 'search' && (
            <motion.div key="search" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Card variant="glass" padding="md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Search className="size-5 text-blue-400" />
                    Find Players
                  </CardTitle>
                </CardHeader>
                <div className="mb-6">
                  <Input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search by Minecraft username, site name, or email..."
                    icon={<Search className="size-4" />}
                  />
                </div>

                <div className="space-y-2">
                  {searching && (
                    <div className="flex items-center justify-center py-4">
                      <div className="animate-spin size-6 border-2 border-emerald-500 border-t-transparent rounded-full" />
                    </div>
                  )}
                  {!searching && searchResults.map((result, i) => (
                    <motion.div
                      key={result.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.02] transition-colors"
                    >
                      <Avatar name={result.mc_username || result.name} size="md" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white">{result.mc_username || result.site_name}</div>
                        <div className="flex gap-1 mt-1">
                          {(result.roles || []).slice(0, 3).map((r: string) => (
                            <Badge key={r} variant="default" size="sm">{r}</Badge>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {canViewPublic && (
                          <Link href={`/players/${result.id}`}>
                            <Button variant="ghost" size="sm" icon={<Eye className="size-3" />}>Profile</Button>
                          </Link>
                        )}
                        {canSendFriendRequest && (
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={<UserPlus className="size-3" />}
                            onClick={() => sendFriendRequest(result.id)}
                          >
                            Add Friend
                          </Button>
                        )}
                        {canFollow && (
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<Heart className="size-3" />}
                            onClick={() => followUser(result.id)}
                          />
                        )}
                        {canReport && (
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<Flag className="size-3" />}
                            onClick={() => { setReportTarget(result); setShowReportModal(true); }}
                          />
                        )}
                      </div>
                    </motion.div>
                  ))}
                  {!searching && searchResults.length === 0 && searchQuery && (
                    <div className="text-center py-8 text-white/30 text-sm">No players found</div>
                  )}
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <Modal
          open={showReportModal}
          onClose={() => { setShowReportModal(false); setReportTarget(null); }}
          title={`Report ${reportTarget?.mc_username || reportTarget?.site_name || 'Player'}`}
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
              <Button variant="ghost" onClick={() => { setShowReportModal(false); setReportTarget(null); }}>Cancel</Button>
              <Button variant="danger" onClick={submitReport} disabled={!reportReason.trim()}>Submit Report</Button>
            </div>
          </div>
        </Modal>
      </div>
    </AppShell>
  );
}
