import { useState, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { Search, Download, Loader2, Puzzle, Trash2, CheckCircle2 } from 'lucide-react';
import useSWR from 'swr';
import Image from 'next/image';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function Plugins() {
  const { activeServerId } = useStore();
  const [query, setQuery] = useState('');
  const [installing, setInstalling] = useState<string | null>(null);
  const [installed, setInstalled] = useState<Record<string, boolean>>({});
  const [tab, setTab] = useState<'marketplace' | 'installed'>('marketplace');

  const { data, isLoading } = useSWR(
    tab === 'marketplace' ? `https://hangar.papermc.io/api/v1/projects?q=${query}&limit=12` : null,
    fetcher
  );

  const { data: installedData, mutate: mutateInstalled } = useSWR(
    activeServerId && tab === 'installed' ? `/api/servers/${activeServerId}/plugins` : null,
    fetcher
  );

  // Keep installed map in sync with server data so marketplace cards show "Installed" state
  useEffect(() => {
    if (!installedData?.plugins) return;
    const next: Record<string, boolean> = {};
    installedData.plugins.forEach((p: any) => {
      const base = (p.name || '').replace(/\.jar$/i, '').split('-')[0];
      if (base) next[base] = true;
    });
    setInstalled(next);
  }, [installedData]);

  const handleInstall = async (project: any) => {
    if (!activeServerId) return;
    setInstalling(project.name);
    try {
      // Get latest version
      const verRes = await fetch(`https://hangar.papermc.io/api/v1/projects/${project.namespace.owner}/${project.namespace.slug}/versions?limit=1`);
      const verData = await verRes.json();
      const latestVersion = verData.result[0];
      
      // Hangar download endpoint is singular "download"
      const downloadUrl = `https://hangar.papermc.io/api/v1/projects/${project.namespace.owner}/${project.namespace.slug}/versions/${latestVersion.name}/PAPER/download`;
      
      const res = await fetch(`/api/servers/${activeServerId}/plugins`, {
        method: 'POST',
        body: JSON.stringify({ url: downloadUrl, filename: `${project.name}-${latestVersion.name}.jar` }),
      });

      if (res.ok) {
        setInstalled((prev) => ({ ...prev, [project.name]: true }));
      } else {
        alert('Failed to install plugin');
      }
    } catch (err) {
      alert('Error installing plugin');
    } finally {
      setInstalling(null);
    }
  };

  const handleDelete = async (filename: string) => {
    if (!activeServerId || !confirm(`Delete ${filename}?`)) return;
    try {
      const res = await fetch(`/api/servers/${activeServerId}/plugins?filename=${encodeURIComponent(filename)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        mutateInstalled();
      } else {
        alert('Failed to delete plugin');
      }
    } catch (e) {
      alert('Error deleting plugin');
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Puzzle className="text-indigo-500" /> Plugins
          </h2>
          <p className="text-zinc-400 mt-1">Discover and manage plugins for your server.</p>
        </div>
        <div className="flex bg-zinc-900 rounded-xl p-1 border border-zinc-800">
          <button
            onClick={() => setTab('marketplace')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'marketplace' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}
          >
            Marketplace
          </button>
          <button
            onClick={() => setTab('installed')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'installed' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}
          >
            Installed
          </button>
        </div>
      </header>

      {tab === 'marketplace' ? (
        <>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search plugins..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl pl-12 pr-4 py-4 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all text-lg"
            />
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin text-indigo-500" size={32} />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {data?.result?.map((project: any) => (
                <div key={project.name} className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 flex flex-col">
                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-4">
                      {project.avatarUrl ? (
                        <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-zinc-900 border border-zinc-800">
                          <Image
                            src={project.avatarUrl}
                            alt={project.name}
                            fill
                            sizes="48px"
                            className="object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
                          <Puzzle className="text-zinc-500" size={24} />
                        </div>
                      )}
                      <h3 className="text-xl font-bold">{project.name}</h3>
                    </div>
                    <p className="text-zinc-400 text-sm line-clamp-3 mb-4">{project.description}</p>
                  </div>
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-zinc-800">
                    <div className="text-xs text-zinc-500">
                      {project.stats.downloads} downloads
                    </div>
                    <button
                      onClick={() => handleInstall(project)}
                      disabled={installing === project.name || installed[project.name]}
                      className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors ${
                        installed[project.name]
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                      }`}
                    >
                      {installing === project.name ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : installed[project.name] ? (
                        <CheckCircle2 size={16} />
                      ) : (
                        <Download size={16} />
                      )}
                      {installing === project.name ? 'Installing...' : installed[project.name] ? 'Installed' : 'Install'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden">
          {!installedData ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin text-indigo-500" size={32} />
            </div>
          ) : installedData.plugins?.length === 0 ? (
            <div className="text-center py-12 text-zinc-500">No plugins installed.</div>
          ) : (
            <div className="divide-y divide-zinc-800/50">
              {installedData.plugins?.map((plugin: any) => {
                const displayName = (plugin.name || '').replace(/\.jar$/i, '').split('-')[0] || plugin.name;
                return (
                  <div key={plugin.name} className="p-4 hover:bg-zinc-900/50 flex items-center justify-between transition-colors group">
                    <div className="flex items-center gap-3">
                      <Puzzle size={20} className="text-indigo-400" />
                      <div className="flex flex-col">
                        <span className="font-medium">{displayName}</span>
                        <span className="text-xs text-zinc-500">{plugin.name}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-zinc-500">
                      <span>{(plugin.size / 1024 / 1024).toFixed(2)} MB</span>
                      <button
                        onClick={() => handleDelete(plugin.name)}
                        className="opacity-0 group-hover:opacity-100 p-2 hover:bg-rose-500/10 hover:text-rose-400 rounded-lg transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
