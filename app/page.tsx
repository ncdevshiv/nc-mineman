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
import { Network } from '@/components/network';
import { Settings } from '@/components/settings';
import { Backups } from '@/components/backups';
import { Automation } from '@/components/automation';

export default function Home() {
  const { activeServerId, activeTab, fetchServers, setStatus, setTunnelStatus, setTunnelAddress, addLog, setLogs, addTunnelLog, setTunnelLogs, addMetric, setMetrics } = useStore();
  const reconnectDelayMs = 3000;
  const pollIntervalMs = 30000;

  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

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
          setLogs(data.logs);
          setStatus(data.status);
          setTunnelLogs(data.tunnelLogs);
          setTunnelStatus(data.tunnelStatus);
          setTunnelAddress(data.tunnelAddress || null);
          if (data.metrics) setMetrics(data.metrics);
        } else if (data.type === 'log') {
          addLog(data.msg);
        } else if (data.type === 'status') {
          setStatus(data.status);
        } else if (data.type === 'tunnelLog') {
          addTunnelLog(data.msg);
        } else if (data.type === 'tunnelStatus') {
          setTunnelStatus(data.status);
        } else if (data.type === 'tunnelAddress') {
          setTunnelAddress(data.address);
        } else if (data.type === 'metrics') {
          addMetric(data.metric);
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

    // Fallback polling to keep status aligned even if SSE drops silently
    const startPoll = () => {
      pollHandle = setInterval(() => {
        fetch(`/api/servers`).then((res) => res.json()).then((servers) => {
          const current = servers.find((s: any) => s.id === activeServerId);
          if (current?.status) setStatus(current.status);
          if (current?.tunnelStatus) setTunnelStatus(current.tunnelStatus);
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
  }, [activeServerId, setStatus, setTunnelStatus, setTunnelAddress, addLog, setLogs, addTunnelLog, setTunnelLogs, addMetric, setMetrics]);

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
            {activeTab === 'network' && <Network />}
            {activeTab === 'backups' && <Backups />}
            {activeTab === 'automation' && <Automation />}
            {activeTab === 'settings' && <Settings />}
          </>
        )}
      </main>
    </div>
  );
}
