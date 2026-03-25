'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Server, Trash2, Plus, Loader2, RefreshCw, AlertTriangle } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function SpacetimeServers() {
	const { data, isLoading, mutate } = useSWR('/api/spacetimedb/servers', fetcher);
	const [showAdd, setShowAdd] = useState(false);
	const [actionLoading, setActionLoading] = useState<string | null>(null);
	const [form, setForm] = useState({ id: '', name: '', software: 'paper', version: 'latest', ram: '2G', cpu_limit: 100, status: 'stopped' });

	const handleAdd = async () => {
		if (!form.name) return;
		setActionLoading('add');
		try {
			await fetch('/api/spacetimedb/servers', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ ...form, id: form.id || crypto.randomUUID() }),
			});
			setForm({ id: '', name: '', software: 'paper', version: 'latest', ram: '2G', cpu_limit: 100, status: 'stopped' });
			setShowAdd(false);
			mutate();
		} catch {} finally { setActionLoading(null); }
	};

	const handleDelete = async (id: string) => {
		if (!confirm('Delete this server record from the database?')) return;
		setActionLoading(`del-${id}`);
		try {
			await fetch(`/api/spacetimedb/servers?id=${id}`, { method: 'DELETE' });
			mutate();
		} catch {} finally { setActionLoading(null); }
	};

	const handleClearAll = async () => {
		if (!confirm('Clear ALL server data from the database? This cannot be undone.')) return;
		setActionLoading('clear');
		try {
			await fetch('/api/spacetimedb/servers', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'clear' }),
			});
			mutate();
		} catch {} finally { setActionLoading(null); }
	};

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<h3 className="text-lg font-semibold flex items-center gap-2">
					<Server size={20} className="text-indigo-400" />
					Server Records ({data?.length || 0})
				</h3>
				<div className="flex gap-2">
					<button onClick={() => setShowAdd(!showAdd)}
						className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors">
						<Plus size={16} /> Add Server
					</button>
					<button onClick={handleClearAll} disabled={actionLoading === 'clear'}
						className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 px-4 py-2 rounded-xl text-sm flex items-center gap-2 transition-colors disabled:opacity-50">
						{actionLoading === 'clear' ? <Loader2 size={16} className="animate-spin" /> : <AlertTriangle size={16} className="text-amber-400" />}
						Clear All
					</button>
					<button onClick={() => mutate()} className="p-2 hover:bg-zinc-800 rounded-xl transition-colors text-zinc-400 hover:text-white">
						<RefreshCw size={18} />
					</button>
				</div>
			</div>

			{showAdd && (
				<div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 space-y-4">
					<h4 className="font-semibold">Add Server Record</h4>
					<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
						<input type="text" placeholder="Server Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
							className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
						<input type="text" placeholder="Software" value={form.software} onChange={(e) => setForm({ ...form, software: e.target.value })}
							className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
						<input type="text" placeholder="Version" value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })}
							className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
						<input type="text" placeholder="RAM" value={form.ram} onChange={(e) => setForm({ ...form, ram: e.target.value })}
							className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
					</div>
					<div className="flex gap-3">
						<button onClick={handleAdd} disabled={actionLoading === 'add' || !form.name}
							className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50">
							{actionLoading === 'add' ? <Loader2 size={16} className="animate-spin" /> : 'Save'}
						</button>
						<button onClick={() => setShowAdd(false)} className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 px-5 py-2.5 rounded-xl text-sm transition-colors">
							Cancel
						</button>
					</div>
				</div>
			)}

			<div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden">
				{isLoading ? (
					<div className="flex justify-center py-12"><Loader2 className="animate-spin text-indigo-500" size={28} /></div>
				) : !data || data.length === 0 ? (
					<div className="p-8 text-center text-zinc-500">No server records in database.</div>
				) : (
					<div className="overflow-x-auto">
						<table className="w-full">
							<thead>
								<tr className="border-b border-zinc-800 bg-zinc-900/50">
									<th className="text-left p-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Name</th>
									<th className="text-left p-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Software</th>
									<th className="text-left p-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Version</th>
									<th className="text-left p-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">RAM</th>
									<th className="text-left p-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Status</th>
									<th className="text-left p-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Updated</th>
									<th className="text-right p-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Actions</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-zinc-800/50">
								{data.map((s: any) => (
									<tr key={s.id} className="hover:bg-zinc-900/50 transition-colors group">
										<td className="p-4 font-medium">{s.name}</td>
										<td className="p-4 text-zinc-400">{s.software}</td>
										<td className="p-4 text-zinc-400">{s.version}</td>
										<td className="p-4 text-zinc-400">{s.ram}</td>
										<td className="p-4">
											<span className={`text-xs font-medium px-3 py-1 rounded-lg ${
												s.status === 'running' ? 'bg-emerald-500/10 text-emerald-400' :
												s.status === 'starting' ? 'bg-amber-500/10 text-amber-400' :
												'bg-zinc-800 text-zinc-400'
											}`}>{s.status}</span>
										</td>
										<td className="p-4 text-zinc-500 text-sm">{s.updated_at ? new Date(s.updated_at).toLocaleString() : 'N/A'}</td>
										<td className="p-4 text-right">
											<button onClick={() => handleDelete(s.id)} disabled={actionLoading === `del-${s.id}`}
												className="opacity-0 group-hover:opacity-100 text-rose-400 hover:bg-rose-500/10 p-2 rounded-lg transition-all disabled:opacity-50">
												{actionLoading === `del-${s.id}` ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
											</button>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</div>
		</div>
	);
}
