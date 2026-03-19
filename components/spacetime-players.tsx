'use client';

import { useState, useMemo } from 'react';
import { useStore } from '@/lib/store';
import useSWR from 'swr';
import {
	Users, Shield, ShieldAlert, Clock, Globe, UserPlus, UserMinus,
	Loader2, RefreshCw, Trash2, ChevronDown, ChevronUp, Search,
	Eye, EyeOff, Ban, CheckCircle, XCircle, StickyNote, History,
	AlertTriangle, Filter
} from 'lucide-react';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type PlayerFilter = 'all' | 'online' | 'op' | 'banned' | 'whitelisted' | 'waitlisted';

export function SpacetimePlayers() {
	const { servers } = useStore();
	const [selectedServer, setSelectedServer] = useState(servers[0]?.id || '');
	const [filter, setFilter] = useState<PlayerFilter>('all');
	const [searchTerm, setSearchTerm] = useState('');
	const [actionLoading, setActionLoading] = useState<string | null>(null);
	const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);
	const [ipHistoryPlayer, setIpHistoryPlayer] = useState<string | null>(null);
	const [editNotes, setEditNotes] = useState<{ name: string; notes: string } | null>(null);
	const [showAdd, setShowAdd] = useState(false);
	const [addForm, setAddForm] = useState({ name: '', ip: '', isOp: false, isWhitelisted: false, isWaitlisted: false, notes: '' });

	const apiUrl = selectedServer ? `/api/spacetimedb/players?serverId=${selectedServer}` : null;
	const { data: players, isLoading, mutate } = useSWR(apiUrl, fetcher);
	const { data: stats } = useSWR(selectedServer ? `/api/spacetimedb/players?serverId=${selectedServer}&action=stats` : null, fetcher);
	const { data: sessions } = useSWR(selectedServer ? `/api/spacetimedb/players?serverId=${selectedServer}&action=sessions` : null, fetcher);
	const { data: ipHistory } = useSWR(
		ipHistoryPlayer && selectedServer ? `/api/spacetimedb/players?serverId=${selectedServer}&action=ipHistory&name=${ipHistoryPlayer}` : null,
		fetcher
	);

	const filteredPlayers = useMemo(() => {
		if (!players) return [];
		let list = players;
		switch (filter) {
			case 'online': list = list.filter((p: any) => p.is_online); break;
			case 'op': list = list.filter((p: any) => p.is_op); break;
			case 'banned': list = list.filter((p: any) => p.is_banned); break;
			case 'whitelisted': list = list.filter((p: any) => p.is_whitelisted); break;
			case 'waitlisted': list = list.filter((p: any) => p.is_waitlisted); break;
		}
		if (searchTerm) {
			const term = searchTerm.toLowerCase();
			list = list.filter((p: any) => p.name.toLowerCase().includes(term) || (p.ip_address && p.ip_address.includes(term)));
		}
		return list;
	}, [players, filter, searchTerm]);

	const doAction = async (action: string, name: string, extra: Record<string, unknown> = {}) => {
		if (!selectedServer) return;
		setActionLoading(`${action}-${name}`);
		try {
			await fetch('/api/spacetimedb/players', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ serverId: selectedServer, action, name, ...extra }),
			});
			mutate();
		} catch {} finally { setActionLoading(null); }
	};

	const handleAdd = async () => {
		if (!addForm.name || !selectedServer) return;
		setActionLoading('add');
		try {
			await fetch('/api/spacetimedb/players', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ serverId: selectedServer, ...addForm }),
			});
			setAddForm({ name: '', ip: '', isOp: false, isWhitelisted: false, isWaitlisted: false, notes: '' });
			setShowAdd(false);
			mutate();
		} catch {} finally { setActionLoading(null); }
	};

	const handleClearAll = async () => {
		if (!selectedServer || !confirm('Delete ALL player data for this server?')) return;
		setActionLoading('clear');
		try {
			await fetch('/api/spacetimedb/players', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ serverId: selectedServer, action: 'clear', name: '' }),
			});
			mutate();
		} catch {} finally { setActionLoading(null); }
	};

	const handleSaveNotes = async () => {
		if (!editNotes) return;
		await doAction('notes', editNotes.name, { notes: editNotes.notes });
		setEditNotes(null);
	};

	const filterButtons: { id: PlayerFilter; label: string; count?: number }[] = [
		{ id: 'all', label: 'All', count: stats?.total },
		{ id: 'online', label: 'Online', count: stats?.online },
		{ id: 'op', label: 'Operators', count: stats?.ops },
		{ id: 'banned', label: 'Banned', count: stats?.banned },
		{ id: 'whitelisted', label: 'Whitelisted', count: stats?.whitelisted },
		{ id: 'waitlisted', label: 'Waitlisted', count: stats?.waitlisted },
	];

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between flex-wrap gap-4">
				<h3 className="text-lg font-semibold flex items-center gap-2">
					<Users size={20} className="text-indigo-400" />
					Player Management
				</h3>
				<div className="flex items-center gap-3">
					<select value={selectedServer} onChange={(e) => setSelectedServer(e.target.value)}
						className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50">
						{servers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
					</select>
					<button onClick={() => setShowAdd(!showAdd)}
						className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors">
						<UserPlus size={16} /> Add Player
					</button>
					<button onClick={handleClearAll} disabled={actionLoading === 'clear'}
						className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 px-4 py-2.5 rounded-xl text-sm flex items-center gap-2 transition-colors disabled:opacity-50">
						{actionLoading === 'clear' ? <Loader2 size={16} className="animate-spin" /> : <AlertTriangle size={16} className="text-amber-400" />}
						Clear All
					</button>
					<button onClick={() => mutate()} className="p-2.5 hover:bg-zinc-800 rounded-xl transition-colors text-zinc-400 hover:text-white">
						<RefreshCw size={18} />
					</button>
				</div>
			</div>

			{/* Stats Bar */}
			{stats && (
				<div className="grid grid-cols-3 md:grid-cols-6 gap-3">
					{filterButtons.map((f) => (
						<button key={f.id} onClick={() => setFilter(f.id)}
							className={`p-3 rounded-xl text-center transition-all border ${
								filter === f.id ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:bg-zinc-900'
							}`}>
							<div className="text-2xl font-bold">{f.count ?? 0}</div>
							<div className="text-xs mt-0.5">{f.label}</div>
						</button>
					))}
				</div>
			)}

			{/* Add Player Form */}
			{showAdd && (
				<div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 space-y-4">
					<h4 className="font-semibold">Add Player Record</h4>
					<div className="grid grid-cols-2 md:grid-cols-3 gap-4">
						<input type="text" placeholder="Player Name *" value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
							className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
						<input type="text" placeholder="IP Address" value={addForm.ip} onChange={(e) => setAddForm({ ...addForm, ip: e.target.value })}
							className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
						<input type="text" placeholder="Notes" value={addForm.notes} onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })}
							className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
					</div>
					<div className="flex gap-4">
						<label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
							<input type="checkbox" checked={addForm.isOp} onChange={(e) => setAddForm({ ...addForm, isOp: e.target.checked })}
								className="rounded border-zinc-700 bg-zinc-800 text-indigo-500 focus:ring-indigo-500/50" />
							<Shield size={14} className="text-indigo-400" /> Operator
						</label>
						<label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
							<input type="checkbox" checked={addForm.isWhitelisted} onChange={(e) => setAddForm({ ...addForm, isWhitelisted: e.target.checked })}
								className="rounded border-zinc-700 bg-zinc-800 text-emerald-500 focus:ring-emerald-500/50" />
							<Eye size={14} className="text-emerald-400" /> Whitelisted
						</label>
						<label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
							<input type="checkbox" checked={addForm.isWaitlisted} onChange={(e) => setAddForm({ ...addForm, isWaitlisted: e.target.checked })}
								className="rounded border-zinc-700 bg-zinc-800 text-amber-500 focus:ring-amber-500/50" />
							<Clock size={14} className="text-amber-400" /> Waitlisted
						</label>
					</div>
					<div className="flex gap-3">
						<button onClick={handleAdd} disabled={actionLoading === 'add' || !addForm.name}
							className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50">
							{actionLoading === 'add' ? <Loader2 size={16} className="animate-spin" /> : 'Save Player'}
						</button>
						<button onClick={() => setShowAdd(false)} className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 px-5 py-2.5 rounded-xl text-sm transition-colors">
							Cancel
						</button>
					</div>
				</div>
			)}

			{/* Search */}
			<div className="relative">
				<Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
				<input type="text" placeholder="Search players by name or IP..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
					className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl pl-12 pr-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
			</div>

			{/* Players Table */}
			<div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden">
				{isLoading ? (
					<div className="flex justify-center py-12"><Loader2 className="animate-spin text-indigo-500" size={28} /></div>
				) : filteredPlayers.length === 0 ? (
					<div className="p-8 text-center text-zinc-500">No players found.</div>
				) : (
					<div className="overflow-x-auto">
						<table className="w-full">
							<thead>
								<tr className="border-b border-zinc-800 bg-zinc-900/50">
									<th className="text-left p-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Player</th>
									<th className="text-left p-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">IP</th>
									<th className="text-left p-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Status</th>
									<th className="text-left p-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">First Seen</th>
									<th className="text-left p-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Last Seen</th>
									<th className="text-right p-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Actions</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-zinc-800/50">
								{filteredPlayers.map((p: any) => (
									<PlayerRow
										key={`${p.server_id}-${p.name}`}
										player={p}
										expanded={expandedPlayer === p.name}
										onToggle={() => setExpandedPlayer(expandedPlayer === p.name ? null : p.name)}
										onAction={doAction}
										actionLoading={actionLoading}
										onShowIpHistory={() => setIpHistoryPlayer(ipHistoryPlayer === p.name ? null : p.name)}
										onEditNotes={() => setEditNotes({ name: p.name, notes: p.notes || '' })}
									/>
								))}
							</tbody>
						</table>
					</div>
				)}
			</div>

			{/* IP History Modal */}
			{ipHistoryPlayer && ipHistory && (
				<div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden">
					<div className="p-4 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
						<h3 className="font-semibold flex items-center gap-2">
							<Globe size={18} className="text-sky-400" /> IP History for {ipHistoryPlayer}
						</h3>
						<button onClick={() => setIpHistoryPlayer(null)} className="text-zinc-400 hover:text-white p-1">
							<XCircle size={18} />
						</button>
					</div>
					<div className="divide-y divide-zinc-800/50 max-h-64 overflow-y-auto">
						{ipHistory.length === 0 ? (
							<div className="p-4 text-center text-zinc-500 text-sm">No IP history recorded.</div>
						) : (
							ipHistory.map((r: any) => (
								<div key={r.id} className="p-3 flex items-center justify-between text-sm">
									<code className="text-sky-400 font-mono">{r.ip_address}</code>
									<span className="text-zinc-500">{new Date(r.seen_at).toLocaleString()}</span>
								</div>
							))
						)}
					</div>
				</div>
			)}

			{/* Notes Edit Modal */}
			{editNotes && (
				<div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 space-y-4">
					<h4 className="font-semibold flex items-center gap-2">
						<StickyNote size={18} className="text-amber-400" /> Edit Notes for {editNotes.name}
					</h4>
					<textarea value={editNotes.notes} onChange={(e) => setEditNotes({ ...editNotes, notes: e.target.value })} rows={4}
						className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none" />
					<div className="flex gap-3">
						<button onClick={handleSaveNotes}
							className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors">
							Save Notes
						</button>
						<button onClick={() => setEditNotes(null)}
							className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 px-5 py-2.5 rounded-xl text-sm transition-colors">
							Cancel
						</button>
					</div>
				</div>
			)}

			{/* Recent Sessions */}
			{sessions && sessions.length > 0 && (
				<div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden">
					<div className="p-4 border-b border-zinc-800 bg-zinc-900/50">
						<h3 className="font-semibold flex items-center gap-2">
							<Clock size={18} className="text-zinc-400" /> Recent Sessions
						</h3>
					</div>
					<div className="overflow-x-auto">
						<table className="w-full">
							<thead>
								<tr className="border-b border-zinc-800 bg-zinc-900/50">
									<th className="text-left p-3 text-xs font-bold text-zinc-500 uppercase">Player</th>
									<th className="text-left p-3 text-xs font-bold text-zinc-500 uppercase">IP</th>
									<th className="text-left p-3 text-xs font-bold text-zinc-500 uppercase">Joined</th>
									<th className="text-left p-3 text-xs font-bold text-zinc-500 uppercase">Left</th>
									<th className="text-left p-3 text-xs font-bold text-zinc-500 uppercase">Duration</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-zinc-800/50">
								{sessions.slice(0, 20).map((s: any) => (
									<tr key={s.id} className="hover:bg-zinc-900/50 text-sm">
										<td className="p-3 font-medium">{s.player_name}</td>
										<td className="p-3 text-zinc-400 font-mono text-xs">{s.ip_address || '—'}</td>
										<td className="p-3 text-zinc-400">{new Date(s.joined_at).toLocaleString()}</td>
										<td className="p-3 text-zinc-400">{s.left_at ? new Date(s.left_at).toLocaleString() : <span className="text-emerald-400">Active</span>}</td>
										<td className="p-3 text-zinc-400">{s.duration_seconds ? `${Math.floor(s.duration_seconds / 60)}m ${s.duration_seconds % 60}s` : '—'}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			)}
		</div>
	);
}

function PlayerRow({ player, expanded, onToggle, onAction, actionLoading, onShowIpHistory, onEditNotes }: {
	player: any; expanded: boolean; onToggle: () => void;
	onAction: (action: string, name: string, extra?: Record<string, unknown>) => void;
	actionLoading: string | null; onShowIpHistory: () => void; onEditNotes: () => void;
}) {
	const p = player;
	const loading = (action: string) => actionLoading === `${action}-${p.name}`;

	return (
		<>
			<tr className="hover:bg-zinc-900/50 transition-colors group cursor-pointer" onClick={onToggle}>
				<td className="p-4">
					<div className="flex items-center gap-2">
						<div className={`w-2.5 h-2.5 rounded-full shrink-0 ${p.is_online ? 'bg-emerald-500' : 'bg-zinc-600'}`} />
						<span className="font-medium">{p.name}</span>
						{p.is_op && <Shield size={14} className="text-indigo-400 shrink-0" />}
						{p.is_banned && <Ban size={14} className="text-rose-400 shrink-0" />}
						{p.is_waitlisted && <Clock size={14} className="text-amber-400 shrink-0" />}
						{p.is_whitelisted && <Eye size={14} className="text-emerald-400 shrink-0" />}
						{expanded ? <ChevronUp size={14} className="text-zinc-500 ml-auto" /> : <ChevronDown size={14} className="text-zinc-500 ml-auto" />}
					</div>
				</td>
				<td className="p-4 text-zinc-400 font-mono text-xs">{p.ip_address || '—'}</td>
				<td className="p-4">
					<span className={`text-xs font-medium px-2.5 py-1 rounded-lg ${
						p.is_online ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-400'
					}`}>{p.is_online ? 'Online' : 'Offline'}</span>
				</td>
				<td className="p-4 text-zinc-500 text-sm">{p.first_seen ? new Date(p.first_seen).toLocaleDateString() : '—'}</td>
				<td className="p-4 text-zinc-500 text-sm">{p.last_seen ? new Date(p.last_seen).toLocaleString() : '—'}</td>
				<td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
					<div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
						{!p.is_op ? (
							<button onClick={() => onAction('op', p.name)} disabled={loading('op')}
								className="text-indigo-400 hover:bg-indigo-500/10 p-1.5 rounded-lg transition-all disabled:opacity-50" title="Make Operator">
								{loading('op') ? <Loader2 size={15} className="animate-spin" /> : <Shield size={15} />}
							</button>
						) : (
							<button onClick={() => onAction('deop', p.name)} disabled={loading('deop')}
								className="text-zinc-400 hover:bg-zinc-800 p-1.5 rounded-lg transition-all disabled:opacity-50" title="Remove Operator">
								{loading('deop') ? <Loader2 size={15} className="animate-spin" /> : <ShieldAlert size={15} />}
							</button>
						)}
						{!p.is_banned ? (
							<button onClick={() => onAction('ban', p.name)} disabled={loading('ban')}
								className="text-rose-400 hover:bg-rose-500/10 p-1.5 rounded-lg transition-all disabled:opacity-50" title="Ban">
								{loading('ban') ? <Loader2 size={15} className="animate-spin" /> : <Ban size={15} />}
							</button>
						) : (
							<button onClick={() => onAction('unban', p.name)} disabled={loading('unban')}
								className="text-emerald-400 hover:bg-emerald-500/10 p-1.5 rounded-lg transition-all disabled:opacity-50" title="Unban">
								{loading('unban') ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
							</button>
						)}
						{!p.is_waitlisted ? (
							<button onClick={() => onAction('waitlist', p.name)} disabled={loading('waitlist')}
								className="text-amber-400 hover:bg-amber-500/10 p-1.5 rounded-lg transition-all disabled:opacity-50" title="Add to Waitlist">
								{loading('waitlist') ? <Loader2 size={15} className="animate-spin" /> : <Clock size={15} />}
							</button>
						) : (
							<button onClick={() => onAction('unwaitlist', p.name)} disabled={loading('unwaitlist')}
								className="text-zinc-400 hover:bg-zinc-800 p-1.5 rounded-lg transition-all disabled:opacity-50" title="Remove from Waitlist">
								{loading('unwaitlist') ? <Loader2 size={15} className="animate-spin" /> : <XCircle size={15} />}
							</button>
						)}
						<button onClick={onShowIpHistory}
							className="text-sky-400 hover:bg-sky-500/10 p-1.5 rounded-lg transition-all" title="IP History">
							<Globe size={15} />
						</button>
						<button onClick={onEditNotes}
							className="text-amber-400 hover:bg-amber-500/10 p-1.5 rounded-lg transition-all" title="Edit Notes">
							<StickyNote size={15} />
						</button>
						<button onClick={() => onAction('delete', p.name)} disabled={loading('delete')}
							className="text-rose-400 hover:bg-rose-500/10 p-1.5 rounded-lg transition-all disabled:opacity-50" title="Delete Record">
							{loading('delete') ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
						</button>
					</div>
				</td>
			</tr>
			{expanded && (
				<tr>
					<td colSpan={6} className="bg-zinc-900/30 p-4 border-b border-zinc-800/50">
						<div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
							<div>
								<div className="text-xs font-bold text-zinc-500 uppercase mb-1">UUID</div>
								<div className="text-zinc-300 font-mono text-xs break-all">{p.uuid || 'Not recorded'}</div>
							</div>
							<div>
								<div className="text-xs font-bold text-zinc-500 uppercase mb-1">Permission Level</div>
								<div className="text-zinc-300">{p.permission_level}</div>
							</div>
							<div>
								<div className="text-xs font-bold text-zinc-500 uppercase mb-1">Ban Reason</div>
								<div className="text-zinc-300">{p.ban_reason || '—'}</div>
							</div>
							<div>
								<div className="text-xs font-bold text-zinc-500 uppercase mb-1">Playtime</div>
								<div className="text-zinc-300">{p.total_playtime_seconds ? `${Math.floor(p.total_playtime_seconds / 3600)}h ${Math.floor((p.total_playtime_seconds % 3600) / 60)}m` : '—'}</div>
							</div>
							<div className="md:col-span-2">
								<div className="text-xs font-bold text-zinc-500 uppercase mb-1">Notes</div>
								<div className="text-zinc-300">{p.notes || 'No notes'}</div>
							</div>
							<div>
								<div className="text-xs font-bold text-zinc-500 uppercase mb-1">First Seen</div>
								<div className="text-zinc-300">{p.first_seen ? new Date(p.first_seen).toLocaleString() : '—'}</div>
							</div>
							<div>
								<div className="text-xs font-bold text-zinc-500 uppercase mb-1">Current Session</div>
								<div className="text-zinc-300">{p.current_session_start ? `Since ${new Date(p.current_session_start).toLocaleTimeString()}` : 'Not in session'}</div>
							</div>
						</div>
					</td>
				</tr>
			)}
		</>
	);
}
