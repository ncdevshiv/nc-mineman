'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import { Database, Play, Square, Loader2, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import useSWR from 'swr';
import { SpacetimeServers } from './spacetime-servers';
import { SpacetimePlayers } from './spacetime-players';
import { SpacetimeLogs } from './spacetime-logs';
import { SpacetimeMetrics } from './spacetime-metrics';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type DbTab = 'overview' | 'servers' | 'players' | 'logs' | 'metrics';

export function SpacetimeDashboard() {
	const { servers } = useStore();
	const [dbTab, setDbTab] = useState<DbTab>('overview');
	const [actionLoading, setActionLoading] = useState<string | null>(null);

	const { data: status, isLoading, mutate } = useSWR('/api/spacetimedb', fetcher, { refreshInterval: 10000 });

	const handleStart = async () => {
		setActionLoading('start');
		try {
			await fetch('/api/spacetimedb', { method: 'POST' });
			setTimeout(() => mutate(), 3000);
		} catch {} finally { setActionLoading(null); }
	};

	const handleStop = async () => {
		setActionLoading('stop');
		try {
			await fetch('/api/spacetimedb', { method: 'DELETE' });
			setTimeout(() => mutate(), 1000);
		} catch {} finally { setActionLoading(null); }
	};

	const dbRunning = status?.running;
	const dbTables = status?.database?.tables || [];

	const tabs: { id: DbTab; label: string }[] = [
		{ id: 'overview', label: 'Overview' },
		{ id: 'servers', label: 'Servers' },
		{ id: 'players', label: 'Players' },
		{ id: 'logs', label: 'Logs' },
		{ id: 'metrics', label: 'Metrics' },
	];

	return (
		<div className="p-8 max-w-7xl mx-auto space-y-8">
			<header className="flex items-center justify-between">
				<div>
					<h2 className="text-3xl font-bold tracking-tight flex items-center gap-3">
						<Database className="text-indigo-500" /> SpacetimeDB
					</h2>
					<p className="text-zinc-400 mt-1">Embedded database for persistent server, player, and log data.</p>
				</div>
				<div className="flex items-center gap-3">
					{dbRunning ? (
						<button onClick={handleStop} disabled={actionLoading === 'stop'}
							className="bg-rose-600 hover:bg-rose-500 text-white px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-colors shadow-lg shadow-rose-500/20 disabled:opacity-50">
							{actionLoading === 'stop' ? <Loader2 size={18} className="animate-spin" /> : <Square size={18} />}
							Stop DB
						</button>
					) : (
						<button onClick={handleStart} disabled={actionLoading === 'start'}
							className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-colors shadow-lg shadow-indigo-500/20 disabled:opacity-50">
							{actionLoading === 'start' ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
							Start DB
						</button>
					)}
					<button onClick={() => mutate()} className="p-2.5 hover:bg-zinc-800 rounded-xl transition-colors text-zinc-400 hover:text-white">
						<RefreshCw size={20} />
					</button>
				</div>
			</header>

			{/* Status Bar */}
			{isLoading ? (
				<div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 flex justify-center">
					<Loader2 className="animate-spin text-indigo-500" size={28} />
				</div>
			) : (
				<div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6">
					<div className="grid grid-cols-2 md:grid-cols-4 gap-6">
						<div className="space-y-1">
							<div className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Status</div>
							<div className={`flex items-center gap-2 font-semibold ${dbRunning ? 'text-emerald-400' : 'text-rose-400'}`}>
								{dbRunning ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
								{dbRunning ? 'Running' : 'Stopped'}
							</div>
						</div>
						<div className="space-y-1">
							<div className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Port</div>
							<div className="font-semibold text-zinc-200">{status?.port || 3001}</div>
						</div>
						<div className="space-y-1">
							<div className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Version</div>
							<div className="font-semibold text-zinc-200">{status?.version || 'Unknown'}</div>
						</div>
						<div className="space-y-1">
							<div className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Tables</div>
							<div className="font-semibold text-zinc-200">{dbTables.length}</div>
						</div>
					</div>
				</div>
			)}

			{/* Tab Navigation */}
			<div className="flex gap-1 bg-zinc-950 border border-zinc-800 rounded-2xl p-1.5">
				{tabs.map((tab) => (
					<button key={tab.id} onClick={() => setDbTab(tab.id)}
						className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
							dbTab === tab.id ? 'bg-indigo-500/15 text-indigo-400' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
						}`}>
						{tab.label}
					</button>
				))}
			</div>

			{/* Tab Content */}
			{!dbRunning && dbTab !== 'overview' ? (
				<div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 p-6 rounded-2xl text-center">
					<p className="font-medium">SpacetimeDB is not running.</p>
					<p className="text-sm mt-1 text-amber-400/70">Start the database to manage data.</p>
				</div>
			) : (
				<>
					{dbTab === 'overview' && <SpacetimeOverview status={status} dbRunning={dbRunning} tables={dbTables} />}
					{dbTab === 'servers' && <SpacetimeServers />}
					{dbTab === 'players' && <SpacetimePlayers />}
					{dbTab === 'logs' && <SpacetimeLogs />}
					{dbTab === 'metrics' && <SpacetimeMetrics />}
				</>
			)}
		</div>
	);
}

function SpacetimeOverview({ status, dbRunning, tables }: { status: any; dbRunning: boolean; tables: string[] }) {
	const { servers } = useStore();

	return (
		<div className="space-y-6">
			{/* Live Servers */}
			<div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden">
				<div className="p-4 border-b border-zinc-800 bg-zinc-900/50">
					<h3 className="font-semibold">Managed Servers ({servers.length})</h3>
				</div>
				{servers.length === 0 ? (
					<div className="p-8 text-center text-zinc-500">No servers configured.</div>
				) : (
					<div className="divide-y divide-zinc-800/50">
						{servers.map((s) => (
							<div key={s.id} className="p-4 flex items-center justify-between hover:bg-zinc-900/50 transition-colors">
								<div className="flex items-center gap-3">
									<div className={`w-2.5 h-2.5 rounded-full ${s.status === 'running' ? 'bg-emerald-500' : s.status === 'starting' ? 'bg-amber-500 animate-pulse' : 'bg-zinc-600'}`} />
									<div>
										<div className="font-medium">{s.name}</div>
										<div className="text-xs text-zinc-500">{s.software} {s.version} &middot; {s.ram}</div>
									</div>
								</div>
								<span className={`text-xs font-medium px-3 py-1 rounded-lg ${
									s.status === 'running' ? 'bg-emerald-500/10 text-emerald-400' :
									s.status === 'starting' ? 'bg-amber-500/10 text-amber-400' :
									'bg-zinc-800 text-zinc-400'
								}`}>{s.status}</span>
							</div>
						))}
					</div>
				)}
			</div>

			{/* Database Tables */}
			<div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden">
				<div className="p-4 border-b border-zinc-800 bg-zinc-900/50">
					<h3 className="font-semibold">Database Schema</h3>
				</div>
				<div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
					{tables.length === 0 ? (
						<div className="col-span-full text-center text-zinc-500 text-sm">No tables found. Start the DB and initialize.</div>
					) : (
						tables.map((t) => (
							<div key={t} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center">
								<div className="text-sm font-medium text-indigo-400">{t}</div>
							</div>
						))
					)}
				</div>
			</div>
		</div>
	);
}
