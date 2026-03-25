'use client';

import { useState, useMemo } from 'react';
import { useStore } from '@/lib/store';
import useSWR from 'swr';
import { ScrollText, Search, Filter, Trash2, Loader2, RefreshCw, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type LogLevel = 'all' | 'info' | 'warn' | 'error';

export function SpacetimeLogs() {
	const { servers } = useStore();
	const [selectedServer, setSelectedServer] = useState(servers[0]?.id || '');
	const [level, setLevel] = useState<LogLevel>('all');
	const [search, setSearch] = useState('');
	const [page, setPage] = useState(0);
	const [actionLoading, setActionLoading] = useState<string | null>(null);
	const pageSize = 100;

	const queryStr = selectedServer
		? `/api/spacetimedb/logs?serverId=${selectedServer}&level=${level}&search=${encodeURIComponent(search)}&limit=${pageSize}&offset=${page * pageSize}`
		: null;
	const { data, isLoading, mutate } = useSWR(queryStr, fetcher);

	const logs = data?.logs || [];
	const total = data?.total || 0;
	const totalPages = Math.ceil(total / pageSize);

	const handleClear = async () => {
		if (!selectedServer || !confirm('Clear ALL logs for this server?')) return;
		setActionLoading('clear');
		try {
			await fetch('/api/spacetimedb/logs', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ serverId: selectedServer, action: 'clear' }),
			});
			setPage(0);
			mutate();
		} catch {} finally { setActionLoading(null); }
	};

	const handleSearch = (e: React.FormEvent) => {
		e.preventDefault();
		setPage(0);
		mutate();
	};

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between flex-wrap gap-4">
				<h3 className="text-lg font-semibold flex items-center gap-2">
					<ScrollText size={20} className="text-indigo-400" />
					Server Logs ({total.toLocaleString()} records)
				</h3>
				<div className="flex items-center gap-3">
					<select value={selectedServer} onChange={(e) => { setSelectedServer(e.target.value); setPage(0); }}
						className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50">
						{servers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
					</select>
					<button onClick={handleClear} disabled={actionLoading === 'clear'}
						className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 px-4 py-2.5 rounded-xl text-sm flex items-center gap-2 transition-colors disabled:opacity-50">
						{actionLoading === 'clear' ? <Loader2 size={16} className="animate-spin" /> : <AlertTriangle size={16} className="text-amber-400" />}
						Clear Logs
					</button>
					<button onClick={() => mutate()} className="p-2.5 hover:bg-zinc-800 rounded-xl transition-colors text-zinc-400 hover:text-white">
						<RefreshCw size={18} />
					</button>
				</div>
			</div>

			{/* Filters */}
			<div className="flex items-center gap-3 flex-wrap">
				<div className="flex gap-1 bg-zinc-950 border border-zinc-800 rounded-xl p-1">
					{(['all', 'info', 'warn', 'error'] as LogLevel[]).map((l) => (
						<button key={l} onClick={() => { setLevel(l); setPage(0); }}
							className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
								level === l
									? l === 'error' ? 'bg-rose-500/15 text-rose-400' : l === 'warn' ? 'bg-amber-500/15 text-amber-400' : 'bg-indigo-500/15 text-indigo-400'
									: 'text-zinc-400 hover:text-zinc-200'
							}`}>
							{l.charAt(0).toUpperCase() + l.slice(1)}
						</button>
					))}
				</div>
				<form onSubmit={handleSearch} className="flex-1 flex gap-2 min-w-[200px]">
					<div className="relative flex-1">
						<Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
						<input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search logs..."
							className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
					</div>
					<button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors">
						Search
					</button>
				</form>
			</div>

			{/* Log Table */}
			<div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden">
				{isLoading ? (
					<div className="flex justify-center py-12"><Loader2 className="animate-spin text-indigo-500" size={28} /></div>
				) : logs.length === 0 ? (
					<div className="p-8 text-center text-zinc-500">No logs found.</div>
				) : (
					<div className="overflow-x-auto">
						<table className="w-full">
							<thead>
								<tr className="border-b border-zinc-800 bg-zinc-900/50">
									<th className="text-left p-3 text-xs font-bold text-zinc-500 uppercase w-48">Timestamp</th>
									<th className="text-left p-3 text-xs font-bold text-zinc-500 uppercase w-20">Level</th>
									<th className="text-left p-3 text-xs font-bold text-zinc-500 uppercase w-24">Source</th>
									<th className="text-left p-3 text-xs font-bold text-zinc-500 uppercase">Message</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-zinc-800/30 font-mono text-xs">
								{logs.map((log: any) => (
									<tr key={log.id} className="hover:bg-zinc-900/50 transition-colors">
										<td className="p-3 text-zinc-500 whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
										<td className="p-3">
											<span className={`px-2 py-0.5 rounded text-xs font-medium ${
												log.level === 'error' ? 'bg-rose-500/15 text-rose-400' :
												log.level === 'warn' ? 'bg-amber-500/15 text-amber-400' :
												'bg-zinc-800 text-zinc-400'
											}`}>{log.level}</span>
										</td>
										<td className="p-3 text-zinc-500">{log.source}</td>
										<td className="p-3 text-zinc-300 break-all">{log.message}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</div>

			{/* Pagination */}
			{totalPages > 1 && (
				<div className="flex items-center justify-between">
					<div className="text-sm text-zinc-500">
						Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} of {total.toLocaleString()}
					</div>
					<div className="flex items-center gap-2">
						<button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}
							className="p-2 hover:bg-zinc-800 rounded-xl transition-colors text-zinc-400 hover:text-white disabled:opacity-30">
							<ChevronLeft size={18} />
						</button>
						<span className="text-sm text-zinc-400 px-3">Page {page + 1} of {totalPages}</span>
						<button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1}
							className="p-2 hover:bg-zinc-800 rounded-xl transition-colors text-zinc-400 hover:text-white disabled:opacity-30">
							<ChevronRight size={18} />
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
