'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import useSWR from 'swr';
import { BarChart3, Loader2, RefreshCw, Trash2, AlertTriangle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function SpacetimeMetrics() {
	const { servers } = useStore();
	const [selectedServer, setSelectedServer] = useState(servers[0]?.id || '');
	const [limit, setLimit] = useState(60);
	const [actionLoading, setActionLoading] = useState<string | null>(null);

	const { data: metrics, isLoading, mutate } = useSWR(
		selectedServer ? `/api/spacetimedb/metrics?serverId=${selectedServer}&limit=${limit}` : null,
		fetcher,
		{ refreshInterval: 10000 }
	);

	const handleClear = async () => {
		if (!selectedServer || !confirm('Clear ALL metrics for this server?')) return;
		setActionLoading('clear');
		try {
			await fetch('/api/spacetimedb/metrics', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'clear', serverId: selectedServer }),
			});
			mutate();
		} catch {} finally { setActionLoading(null); }
	};

	const chartData = (metrics || []).map((m: any) => ({
		...m,
		time: m.recorded_at ? new Date(m.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '',
	}));

	const latest = chartData.length > 0 ? chartData[chartData.length - 1] : null;

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between flex-wrap gap-4">
				<h3 className="text-lg font-semibold flex items-center gap-2">
					<BarChart3 size={20} className="text-indigo-400" />
					Metrics ({metrics?.length || 0} data points)
				</h3>
				<div className="flex items-center gap-3">
					<select value={selectedServer} onChange={(e) => setSelectedServer(e.target.value)}
						className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50">
						{servers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
					</select>
					<select value={limit} onChange={(e) => setLimit(parseInt(e.target.value))}
						className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50">
						<option value={30}>Last 30 points</option>
						<option value={60}>Last 60 points</option>
						<option value={120}>Last 120 points</option>
						<option value={300}>Last 300 points</option>
					</select>
					<button onClick={handleClear} disabled={actionLoading === 'clear'}
						className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 px-4 py-2.5 rounded-xl text-sm flex items-center gap-2 transition-colors disabled:opacity-50">
						{actionLoading === 'clear' ? <Loader2 size={16} className="animate-spin" /> : <AlertTriangle size={16} className="text-amber-400" />}
						Clear
					</button>
					<button onClick={() => mutate()} className="p-2.5 hover:bg-zinc-800 rounded-xl transition-colors text-zinc-400 hover:text-white">
						<RefreshCw size={18} />
					</button>
				</div>
			</div>

			{/* Current Stats */}
			{latest && (
				<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
					{[
						{ label: 'CPU', value: `${latest.cpu}%`, color: 'text-sky-400' },
						{ label: 'RAM', value: `${latest.ram} MB`, color: 'text-violet-400' },
						{ label: 'Players', value: String(latest.players), color: 'text-emerald-400' },
						{ label: 'TPS', value: latest.tps?.toFixed(1) ?? '20.0', color: latest.tps >= 18 ? 'text-emerald-400' : latest.tps >= 15 ? 'text-amber-400' : 'text-rose-400' },
					].map((stat) => (
						<div key={stat.label} className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5">
							<div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">{stat.label}</div>
							<div className={`text-3xl font-bold ${stat.color}`}>{stat.value}</div>
						</div>
					))}
				</div>
			)}

			{/* Charts */}
			{isLoading ? (
				<div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-12 flex justify-center">
					<Loader2 className="animate-spin text-indigo-500" size={28} />
				</div>
			) : chartData.length === 0 ? (
				<div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-8 text-center text-zinc-500">
					No metrics data. Start a server to collect metrics.
				</div>
			) : (
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
					{/* CPU Chart */}
					<div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6">
						<h4 className="font-semibold mb-4 text-zinc-300">CPU Usage (%)</h4>
						<div className="h-64">
							<ResponsiveContainer width="100%" height="100%">
								<AreaChart data={chartData}>
									<CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
									<XAxis dataKey="time" stroke="#71717a" tick={{ fontSize: 10 }} />
									<YAxis stroke="#71717a" tick={{ fontSize: 10 }} domain={[0, 100]} />
									<Tooltip contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '12px', fontSize: 12 }} />
									<Area type="monotone" dataKey="cpu" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.15} strokeWidth={2} />
								</AreaChart>
							</ResponsiveContainer>
						</div>
					</div>

					{/* RAM Chart */}
					<div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6">
						<h4 className="font-semibold mb-4 text-zinc-300">RAM Usage (MB)</h4>
						<div className="h-64">
							<ResponsiveContainer width="100%" height="100%">
								<AreaChart data={chartData}>
									<CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
									<XAxis dataKey="time" stroke="#71717a" tick={{ fontSize: 10 }} />
									<YAxis stroke="#71717a" tick={{ fontSize: 10 }} />
									<Tooltip contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '12px', fontSize: 12 }} />
									<Area type="monotone" dataKey="ram" stroke="#a78bfa" fill="#a78bfa" fillOpacity={0.15} strokeWidth={2} />
								</AreaChart>
							</ResponsiveContainer>
						</div>
					</div>

					{/* TPS Chart */}
					<div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6">
						<h4 className="font-semibold mb-4 text-zinc-300">Ticks Per Second</h4>
						<div className="h-64">
							<ResponsiveContainer width="100%" height="100%">
								<LineChart data={chartData}>
									<CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
									<XAxis dataKey="time" stroke="#71717a" tick={{ fontSize: 10 }} />
									<YAxis stroke="#71717a" tick={{ fontSize: 10 }} domain={[0, 20]} />
									<Tooltip contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '12px', fontSize: 12 }} />
									<Line type="monotone" dataKey="tps" stroke="#34d399" strokeWidth={2} dot={false} />
								</LineChart>
							</ResponsiveContainer>
						</div>
					</div>

					{/* Players Chart */}
					<div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6">
						<h4 className="font-semibold mb-4 text-zinc-300">Online Players</h4>
						<div className="h-64">
							<ResponsiveContainer width="100%" height="100%">
								<AreaChart data={chartData}>
									<CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
									<XAxis dataKey="time" stroke="#71717a" tick={{ fontSize: 10 }} />
									<YAxis stroke="#71717a" tick={{ fontSize: 10 }} allowDecimals={false} />
									<Tooltip contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '12px', fontSize: 12 }} />
									<Area type="monotone" dataKey="players" stroke="#34d399" fill="#34d399" fillOpacity={0.15} strokeWidth={2} />
								</AreaChart>
							</ResponsiveContainer>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
