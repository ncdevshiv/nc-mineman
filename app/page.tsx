'use client';

import { useEffect } from 'react';
import { Sidebar } from '@/components/sidebar';
import { useStore } from '@/lib/store';
import { ServerList } from '@/components/server-list';
import { Dashboard } from '@/components/dashboard';
import { Console } from '@/components/console';
import { Players } from '@/components/players';
import { Files } from '@/components/files';
import { Software } from '@/components/software';
import { Plugins } from '@/components/plugins';
import { NetworkWizard } from '@/components/network-wizard';
import { Settings } from '@/components/settings';
import { Backups } from '@/components/backups';
import { Automation } from '@/components/automation';
import { SpacetimeDashboard } from '@/components/spacetime-dashboard';

export default function Home() {
	const { activeServerId, activeTab, fetchServers, globalTab, setStatus, setNetworkStatus, setNetworkConfig, addNetworkLog, setNetworkLogs } = useStore();
	const reconnectDelayMs = 3000;
	const pollIntervalMs = 30000;

	useEffect(() => {
		fetchServers();
	}, [fetchServers]);

	// Auto-start SpacetimeDB on app load (silent, fire-and-forget)
	useEffect(() => {
		fetch('/api/spacetimedb').catch(() => {});
	}, []);

	useEffect(() => {
		if (!activeServerId) return;

		let es: EventSource | null = null;
		let retryHandle: NodeJS.Timeout | null = null;
		let pollHandle: NodeJS.Timeout | null = null;

		const openStream = () => {
			es = new EventSource(`/api/servers/${activeServerId}/logs`);

			es.onmessage = (event) => {
				const data = JSON.parse(event.data);
				if (data.type === 'init') {
					setNetworkLogs(data.logs);
					setStatus(data.status);
					if (data.metrics) setNetworkConfig(data.metrics);
				} else if (data.type === 'log') {
					addNetworkLog(data.msg);
				} else if (data.type === 'status') {
					setStatus(data.status);
				} else if (data.type === 'metrics') {
					setNetworkConfig(data.metric);
				}
			};

			es.onerror = () => {
				if (es) es.close();
				if (!retryHandle) {
					retryHandle = setTimeout(() => {
						retryHandle = null;
						openStream();
					}, reconnectDelayMs);
				}
			};
		};

		const startPoll = () => {
			pollHandle = setInterval(() => {
				fetch(`/api/servers`).then((res) => res.json()).then((servers) => {
					const current = servers.find((s: any) => s.id === activeServerId);
					if (current?.status) setStatus(current.status);
				}).catch(() => {});
			}, pollIntervalMs);
		};

		openStream();
		startPoll();

		return () => {
			if (es) es.close();
			if (retryHandle) clearTimeout(retryHandle);
			if (pollHandle) clearInterval(pollHandle);
		};
	}, [activeServerId, setStatus, addNetworkLog, setNetworkLogs, setNetworkConfig]);

	useEffect(() => {
		let es: EventSource | null = null;
		let retryHandle: NodeJS.Timeout | null = null;

		const openStream = () => {
			es = new EventSource('/api/network/logs');

			es.onmessage = (event) => {
				const data = JSON.parse(event.data);
				if (data.type === 'init') {
					setNetworkLogs([]);
					setNetworkStatus(data.status?.status || 'unconfigured');
					setNetworkConfig(data.config);
				} else if (data.type === 'log') {
					addNetworkLog(data.msg);
				} else if (data.type === 'config') {
					setNetworkConfig(data.config);
				} else if (data.type === 'error') {
					addNetworkLog(`[ERROR] ${data.message}`);
				}
			};

			es.onerror = () => {
				if (es) es.close();
				if (!retryHandle) {
					retryHandle = setTimeout(() => {
						retryHandle = null;
						openStream();
					}, reconnectDelayMs);
				}
			};
		};

		openStream();

		return () => {
			if (es) es.close();
			if (retryHandle) clearTimeout(retryHandle);
		};
	}, [setNetworkStatus, setNetworkConfig, addNetworkLog, setNetworkLogs]);

	if (!activeServerId && globalTab === 'network') {
		return (
			<div className="flex h-screen bg-zinc-900 text-zinc-100 font-sans selection:bg-indigo-500/30">
				<Sidebar />
				<main className="flex-1 overflow-y-auto relative">
					<NetworkWizard />
				</main>
			</div>
		);
	}

	if (!activeServerId && globalTab === 'database') {
		return (
			<div className="flex h-screen bg-zinc-900 text-zinc-100 font-sans selection:bg-indigo-500/30">
				<Sidebar />
				<main className="flex-1 overflow-y-auto relative">
					<SpacetimeDashboard />
				</main>
			</div>
		);
	}

	return (
		<div className="flex h-screen bg-zinc-900 text-zinc-100 font-sans selection:bg-indigo-500/30">
			<Sidebar />
			<main className="flex-1 overflow-y-auto relative">
				{!activeServerId ? (
					<ServerList />
				) : (
					<>
						{activeTab === 'dashboard' && <Dashboard />}
						{activeTab === 'console' && <Console />}
						{activeTab === 'players' && <Players />}
						{activeTab === 'files' && <Files />}
						{activeTab === 'software' && <Software />}
						{activeTab === 'plugins' && <Plugins />}
						{activeTab === 'backups' && <Backups />}
						{activeTab === 'automation' && <Automation />}
						{activeTab === 'settings' && <Settings />}
					</>
				)}
			</main>
		</div>
	);
}
