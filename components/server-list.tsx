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
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Your Servers</h2>
          <p className="text-zinc-400 mt-1">Manage all your Minecraft instances.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors shadow-lg shadow-indigo-500/20"
        >
          <Plus size={18} /> New Server
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {servers.map((server) => (
            <div
              key={server.id}
              onClick={() => setActiveServerId(server.id)}
              className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 hover:border-indigo-500/50 transition-all cursor-pointer group flex flex-col"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    server.status === 'running' ? 'bg-emerald-500/10 text-emerald-400' :
                    server.status === 'starting' ? 'bg-amber-500/10 text-amber-400' :
                    'bg-zinc-900 text-zinc-500'
                  }`}>
                    <Server size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{server.name}</h3>
                    <p className="text-zinc-500 text-xs capitalize">{server.software} {server.version}</p>
                  </div>
                </div>
                <button
                  onClick={(e) => handleDelete(e, server.id)}
                  className="text-zinc-600 hover:text-rose-400 transition-colors p-2"
                >
                  <Trash2 size={18} />
                </button>
              </div>

              <div className="mt-auto pt-4 border-t border-zinc-800/50 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <div className={`w-2 h-2 rounded-full ${
                    server.status === 'running' ? 'bg-emerald-500' :
                    server.status === 'starting' ? 'bg-amber-500 animate-pulse' :
                    'bg-zinc-600'
                  }`} />
                  <span className="text-zinc-400 capitalize">{server.status}</span>
                </div>
                <div className="text-indigo-400 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                  Manage &rarr;
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
