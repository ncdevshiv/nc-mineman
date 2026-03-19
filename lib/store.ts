import { create } from 'zustand';

export type Tab = 'dashboard' | 'console' | 'players' | 'files' | 'software' | 'plugins' | 'network' | 'backups' | 'automation' | 'settings';

export interface Server {
  id: string;
  name: string;
  software: string;
  version: string;
  ram: string;
  status: string;
  tunnelStatus: string;
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
  setActiveServerId: (id: string | null) => void;
  setActiveTab: (tab: Tab) => void;
  fetchServers: () => Promise<void>;

  // Active server state
  status: string;
  setStatus: (status: string) => void;
  tunnelStatus: string;
  setTunnelStatus: (status: string) => void;
  tunnelAddress: string | null;
  setTunnelAddress: (address: string | null) => void;
  logs: string[];
  addLog: (log: string) => void;
  setLogs: (logs: string[]) => void;
  tunnelLogs: string[];
  addTunnelLog: (log: string) => void;
  setTunnelLogs: (logs: string[]) => void;
  metrics: Metric[];
  addMetric: (metric: Metric) => void;
  setMetrics: (metrics: Metric[]) => void;
}

export const useStore = create<AppState>((set) => ({
  servers: [],
  activeServerId: null,
  activeTab: 'dashboard',
  setActiveServerId: (id) => set({ activeServerId: id, activeTab: 'dashboard', logs: [], tunnelLogs: [], metrics: [], status: 'stopped', tunnelStatus: 'stopped', tunnelAddress: null }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  fetchServers: async () => {
    const res = await fetch('/api/servers');
    if (res.ok) {
      const servers = await res.json();
      set({ servers });
    }
  },

  status: 'stopped',
  setStatus: (status) => set({ status }),
  tunnelStatus: 'stopped',
  setTunnelStatus: (tunnelStatus) => set({ tunnelStatus }),
  tunnelAddress: null,
  setTunnelAddress: (tunnelAddress) => set({ tunnelAddress }),
  logs: [],
  addLog: (log) => set((state) => ({ logs: [...state.logs, log].slice(-1000) })),
  setLogs: (logs) => set({ logs }),
  tunnelLogs: [],
  addTunnelLog: (log) => set((state) => ({ tunnelLogs: [...state.tunnelLogs, log].slice(-100) })),
  setTunnelLogs: (tunnelLogs) => set({ tunnelLogs }),
  metrics: [],
  addMetric: (metric) => set((state) => ({ metrics: [...state.metrics, metric].slice(-60) })),
  setMetrics: (metrics) => set({ metrics }),
}));
