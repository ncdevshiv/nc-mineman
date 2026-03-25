import { useState, useEffect, useMemo } from 'react';
import { useStore } from '@/lib/store';
import { Server, Plus, Loader2, Play, Square, Trash2 } from 'lucide-react';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function ServerList() {
  const { servers, fetchServers, setActiveServerId } = useStore();
  const [showCreate, setShowCreate] = useState(false);
  
  // Create form state
  const [name, setName] = useState('');
  const [software, setSoftware] = useState('paper');
  const [version, setVersion] = useState('');
  const [creating, setCreating] = useState(false);

  const { data: projectData } = useSWR(
    showCreate && (software === 'paper' || software === 'folia' || software === 'velocity')
      ? `https://api.papermc.io/v2/projects/${software}`
      : null,
    fetcher
  );

  const supportedSoftware = ['paper', 'folia', 'velocity'];

  const versions = useMemo(() => projectData?.versions?.slice().reverse() || [], [projectData]);

  useEffect(() => {
    if (versions.length > 0 && !version) {
      setVersion(versions[0]);
    }
  }, [versions, version]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !software || !version) return;
    
    setCreating(true);
    try {
      const res = await fetch('/api/servers', {
        method: 'POST',
        body: JSON.stringify({ name, software, version }),
      });
      if (res.ok) {
        const data = await res.json();
        await fetchServers();
        setShowCreate(false);
        setName('');
        setActiveServerId(data.id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this server? All data will be lost.')) return;
    
    await fetch(`/api/servers/${id}`, { method: 'DELETE' });
    fetchServers();
  };

  if (showCreate) {
    return (
      <div className="p-8 max-w-2xl mx-auto space-y-8">
        <header>
          <h2 className="text-3xl font-bold tracking-tight">Create Server</h2>
          <p className="text-zinc-400 mt-1">Set up a new Minecraft server instance.</p>
        </header>

        <form onSubmit={handleCreate} className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Server Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Survival Server"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Software</label>
            <div className="grid grid-cols-3 gap-4">
              {['paper', 'folia', 'velocity'].map((soft) => (
                <button
                  key={soft}
                  type="button"
                  onClick={() => {
                    setSoftware(soft);
                    setVersion('');
                  }}
                  className={`p-4 rounded-xl border text-center transition-all capitalize ${
                    software === soft
                      ? 'bg-indigo-500/10 border-indigo-500/50 text-indigo-400'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  {soft}
                </button>
              ))}
            </div>
            <p className="text-xs text-zinc-500 mt-2">Currently supports Paper, Folia, and Velocity only.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Version</label>
            <select
              required
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            >
              <option value="" disabled>Select a version</option>
              {versions.map((v: string) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-4 pt-4 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-white px-6 py-3 rounded-xl font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating || !version}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              {creating ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} />}
              Create Server
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 lg:p-12 max-w-7xl mx-auto space-y-10 animate-fade-in-up">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-4xl font-extrabold tracking-tight text-white mb-2">
            Your <span className="gradient-text">Servers</span>
          </h2>
          <p className="text-zinc-400 font-medium">Manage and monitor all your Minecraft instances from one place.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:-translate-y-0.5 active:translate-y-0"
        >
          <Plus size={20} strokeWidth={3} /> New Server
        </button>
      </header>

      {servers.length === 0 ? (
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-12 text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mb-4 text-zinc-500">
            <Server size={32} />
          </div>
          <h3 className="text-xl font-bold mb-2">No servers yet</h3>
          <p className="text-zinc-400 max-w-md mx-auto mb-6">
            You haven&apos;t created any Minecraft servers yet. Click the button above to set up your first instance.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="bg-zinc-900 hover:bg-zinc-800 text-white px-6 py-3 rounded-xl font-medium transition-colors border border-zinc-800"
          >
            Create your first server
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {servers.map((server) => (
            <div
              key={server.id}
              onClick={() => setActiveServerId(server.id)}
              className="group relative bg-zinc-900/40 backdrop-blur-md border border-zinc-800/50 rounded-3xl p-8 hover:border-indigo-500/40 transition-all cursor-pointer flex flex-col gap-6 overflow-hidden shadow-xl"
            >
              {/* Subtle background glow on hover */}
              <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/5 blur-[80px] group-hover:bg-indigo-500/15 transition-all duration-700" />
              
              <div className="flex items-start justify-between relative z-10">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 duration-500 ${
                    server.status === 'running' ? 'bg-emerald-500/10 text-emerald-400 shadow-inner' :
                    server.status === 'starting' ? 'bg-amber-500/10 text-amber-400 shadow-inner' :
                    'bg-zinc-800/50 text-zinc-500'
                  }`}>
                    <Server size={28} />
                  </div>
                  <div>
                    <h3 className="font-black text-xl text-white tracking-tight group-hover:text-indigo-300 transition-colors uppercase">{server.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-zinc-500 text-sm font-bold bg-zinc-800/50 px-2 py-0.5 rounded-md uppercase tracking-tighter">{server.software}</span>
                      <span className="text-zinc-500 text-sm font-medium">{server.version}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={(e) => handleDelete(e, server.id)}
                  className="text-zinc-600 hover:text-rose-500 transition-all p-2 hover:bg-rose-500/10 rounded-xl"
                >
                  <Trash2 size={20} />
                </button>
              </div>

              <div className="mt-auto pt-6 border-t border-zinc-800/30 flex items-center justify-between relative z-10">
                <div className="flex items-center gap-3">
                  <div className="relative flex h-3 w-3">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                      server.status === 'running' ? 'bg-emerald-400' :
                      server.status === 'starting' ? 'bg-amber-400' :
                      'hidden'
                    }`}></span>
                    <span className={`relative inline-flex rounded-full h-3 w-3 ${
                      server.status === 'running' ? 'bg-emerald-500' :
                      server.status === 'starting' ? 'bg-amber-500' :
                      'bg-zinc-600'
                    }`}></span>
                  </div>
                  <span className="text-zinc-400 text-sm font-bold uppercase tracking-widest">{server.status}</span>
                </div>
                <div className="text-indigo-400 text-sm font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                  MANAGE <span className="text-lg">&rarr;</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
