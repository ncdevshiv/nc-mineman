import { useStore } from '@/lib/store';
import { Play, Square, RefreshCw, Server, Users, Cpu, Activity, HardDrive } from 'lucide-react';
import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function Dashboard() {
  const { status, activeServerId, servers, metrics, fetchServers, setStatus } = useStore();
  const [loading, setLoading] = useState(false);

  const activeServer = servers.find(s => s.id === activeServerId);

  const refreshStatus = async () => {
    if (!activeServerId) return;
    try {
      const res = await fetch(`/api/servers/${activeServerId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.status) setStatus(data.status);
      }
    } catch {}
  };

  const handleStart = async () => {
    if (!activeServerId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/servers/${activeServerId}/start`, { method: 'POST' });
      if (!res.ok) {
        alert('Failed to start server');
      } else {
        // refresh status via fetchServers to sync in case SSE is delayed
        await fetchServers();
      }
    } catch (e) {
      alert('Failed to start server');
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    if (!activeServerId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/servers/${activeServerId}/stop`, { method: 'POST' });
      if (!res.ok) {
        alert('Failed to stop server');
      } else {
        await fetchServers();
      }
    } catch (e) {
      alert('Failed to stop server');
    } finally {
      setLoading(false);
    }
  };

  const isRunning = status === 'running';
  const currentCpu = metrics.length > 0 ? metrics[metrics.length - 1].cpu : 0;
  const currentRam = metrics.length > 0 ? metrics[metrics.length - 1].ram : 0;
  const currentPlayers = metrics.length > 0 ? metrics[metrics.length - 1].players || 0 : 0;
  const currentTps = metrics.length > 0 ? metrics[metrics.length - 1].tps || 20.0 : 20.0;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{activeServer?.name || 'Dashboard'}</h2>
          <p className="text-zinc-400 mt-1">
            {activeServer?.software} {activeServer?.version} • {activeServer?.ram} RAM
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 border ${
            status === 'running' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
            status === 'starting' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
            status === 'stopping' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
            'bg-zinc-950 text-zinc-400 border-zinc-800'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              status === 'running' ? 'bg-emerald-500' :
              status === 'starting' ? 'bg-amber-500 animate-pulse' :
              status === 'stopping' ? 'bg-rose-500 animate-pulse' :
              'bg-zinc-500'
            }`} />
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </div>
          
          {status === 'stopped' ? (
            <button
              onClick={handleStart}
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors disabled:opacity-50 shadow-lg shadow-indigo-500/20"
            >
              <Play size={18} /> Start Server
            </button>
          ) : (
            <button
              onClick={handleStop}
              disabled={loading || status === 'stopping'}
              className="bg-rose-600 hover:bg-rose-500 text-white px-5 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors disabled:opacity-50 shadow-lg shadow-rose-500/20"
            >
              <Square size={18} /> Stop Server
            </button>
          )}
          <button
            onClick={refreshStatus}
            disabled={loading}
            className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} /> Refresh Status
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="TPS" value={isRunning ? currentTps.toFixed(1) : "Offline"} icon={Activity} color="text-indigo-400" />
        <StatCard title="Players" value={isRunning ? currentPlayers.toString() : "Offline"} icon={Users} color="text-emerald-400" />
        <StatCard title="RAM Usage" value={isRunning ? `${currentRam} MB` : "0 MB"} icon={Server} color="text-amber-400" />
        <StatCard title="CPU Usage" value={isRunning ? `${currentCpu}%` : "0%"} icon={Cpu} color="text-rose-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-w-0 w-full">
        <div className="bg-zinc-950 border border-zinc-800 p-6 rounded-2xl min-w-0 w-full" style={{ minWidth: 0, minHeight: 0 }}>
          <h3 className="font-semibold mb-6 flex items-center gap-2">
            <Cpu className="text-rose-400" size={18} /> CPU History
          </h3>
          <div className="min-w-0 w-full min-h-[240px]" style={{ minWidth: 0 }}>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={metrics}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="time" stroke="#52525b" fontSize={12} tickMargin={10} />
                <YAxis stroke="#52525b" fontSize={12} domain={[0, 100]} tickFormatter={(val) => `${val}%`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '8px' }}
                  itemStyle={{ color: '#fb7185' }}
                />
                <Line type="monotone" dataKey="cpu" stroke="#fb7185" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 p-6 rounded-2xl h-80 min-w-0 w-full">
          <h3 className="font-semibold mb-6 flex items-center gap-2">
            <HardDrive className="text-amber-400" size={18} /> RAM History
          </h3>
          <div className="h-56 min-w-0 w-full" style={{ minWidth: 0 }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <LineChart data={metrics}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="time" stroke="#52525b" fontSize={12} tickMargin={10} />
                <YAxis stroke="#52525b" fontSize={12} tickFormatter={(val) => `${val}M`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '8px' }}
                  itemStyle={{ color: '#fbbf24' }}
                />
                <Line type="monotone" dataKey="ram" stroke="#fbbf24" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6">
        <h3 className="text-xl font-semibold mb-4">Quick Actions</h3>
        <div className="flex gap-4">
          <button 
            onClick={async () => {
              await handleStop();
              setTimeout(handleStart, 2000);
            }}
            disabled={!isRunning || loading}
            className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
          >
            Restart Server
          </button>
          <button 
            onClick={handleStop}
            disabled={status === 'stopped' || loading}
            className="bg-zinc-900 hover:bg-rose-500/10 hover:text-rose-400 border border-zinc-800 px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
          >
            Kill Process
          </button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color }: any) {
  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 flex items-start justify-between">
      <div>
        <p className="text-zinc-400 text-sm font-medium mb-1">{title}</p>
        <p className="text-2xl font-bold">{value}</p>
      </div>
      <div className={`p-3 bg-zinc-900 rounded-xl ${color}`}>
        <Icon size={24} />
      </div>
    </div>
  );
}
