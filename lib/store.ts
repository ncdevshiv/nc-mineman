import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Tab = 'dashboard' | 'console' | 'players' | 'files' | 'software' | 'plugins' | 'backups' | 'automation' | 'settings';
export type GlobalTab = 'servers' | 'network' | 'database';

export interface Server {
	id: string;
	name: string;
	software: string;
	version: string;
	ram: string;
	status: string;
}

export interface Metric {
	cpu: number;
	ram: number;
	time: string;
	players?: number;
	tps?: number;
}

interface AppState {
	servers: Server[];
	activeServerId: string | null;
	activeTab: Tab;
	globalTab: GlobalTab;
	setActiveServerId: (id: string | null) => void;
	setActiveTab: (tab: Tab) => void;
	setGlobalTab: (tab: GlobalTab) => void;
	fetchServers: () => Promise<void>;

	status: string;
	setStatus: (status: string) => void;
	logs: string[];
	addLog: (log: string) => void;
	setLogs: (logs: string[]) => void;
	metrics: Metric[];
	addMetric: (metric: Metric) => void;
	setMetrics: (metrics: Metric[]) => void;

	networkStatus: string;
	setNetworkStatus: (status: string) => void;
	networkConfig: any;
	setNetworkConfig: (config: any) => void;
	networkLogs: string[];
	addNetworkLog: (log: string) => void;
	setNetworkLogs: (logs: string[]) => void;
}

export const useStore = create<AppState>()(
	persist(
		(set) => ({
			servers: [],
			activeServerId: null,
			activeTab: 'dashboard',
			globalTab: 'servers',
			setActiveServerId: (id) => set({ activeServerId: id, activeTab: 'dashboard', logs: [], metrics: [], status: 'stopped' }),
			setActiveTab: (tab) => set({ activeTab: tab }),
			setGlobalTab: (tab) => set({ globalTab: tab, activeServerId: tab === 'servers' ? null : undefined }),
			fetchServers: async () => {
				const res = await fetch('/api/servers');
				if (res.ok) {
					const servers = await res.json();
					set({ servers });
				}
			},

			status: 'stopped',
			setStatus: (status) => set({ status }),
			logs: [],
			addLog: (log) => set((state) => ({ logs: [...state.logs, log].slice(-1000) })),
			setLogs: (logs) => set({ logs }),
			metrics: [],
			addMetric: (metric) => set((state) => ({ metrics: [...state.metrics, metric].slice(-60) })),
			setMetrics: (metrics) => set({ metrics }),

			networkStatus: 'unconfigured',
			setNetworkStatus: (networkStatus) => set({ networkStatus }),
			networkConfig: null,
			setNetworkConfig: (networkConfig) => set({ networkConfig }),
			networkLogs: [],
			addNetworkLog: (log) => set((state) => ({ networkLogs: [...state.networkLogs, log].slice(-200) })),
			setNetworkLogs: (networkLogs) => set({ networkLogs }),
		}),
		{
			name: 'minemanager-storage',
			partialize: (state) => ({
				activeServerId: state.activeServerId,
				activeTab: state.activeTab,
				globalTab: state.globalTab,
			}),
		}
	)
);
