import { useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import { Users, UserMinus, Shield, ShieldAlert, Loader2, RefreshCw } from 'lucide-react';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function Players() {
  const { activeServerId, status } = useStore();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [playerInput, setPlayerInput] = useState('');

  const { data, isLoading, mutate } = useSWR(
    activeServerId ? `/api/servers/${activeServerId}/players` : null,
    fetcher,
    { refreshInterval: 5000 }
  );

  const allKnownNames = useMemo(() => {
    if (!data) return [] as string[];
    const names = new Set<string>();
    data.ops?.forEach((p: any) => names.add(p.name));
    data.whitelist?.forEach((p: any) => names.add(p.name));
    data.bannedPlayers?.forEach((p: any) => names.add(p.name));
    data.activity?.forEach((a: any) => names.add(a.player));
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [data]);

  const filteredSuggestions = useMemo(() => {
    const term = playerInput.trim().toLowerCase();
    if (!term) return [] as string[];
    return allKnownNames.filter((n) => n.toLowerCase().startsWith(term)).slice(0, 8);
  }, [allKnownNames, playerInput]);

  const recentJoins = useMemo(() => {
    if (!data?.activity) return [] as any[];
    return data.activity
      .filter((a: any) => a.action === 'join')
      .slice(-10)
      .reverse();
  }, [data]);

  const handleAction = async (action: string, player: string) => {
    if (!activeServerId) return;
    setActionLoading(`${action}-${player}`);
    try {
      const res = await fetch(`/api/servers/${activeServerId}/players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, player }),
      });
      if (res.ok) {
        setPlayerInput('');
        setTimeout(() => mutate(), 1000); // Wait a bit for server to write to file
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to perform action');
      }
    } catch (e) {
      alert('Error performing action');
    } finally {
      setActionLoading(null);
    }
  };

  const isRunning = status === 'running';

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Users className="text-indigo-500" /> Players
          </h2>
          <p className="text-zinc-400 mt-1">Manage operators, whitelist, and bans.</p>
        </div>
        <button
          onClick={() => mutate()}
          className="p-2 hover:bg-zinc-800 rounded-xl transition-colors text-zinc-400 hover:text-white"
        >
          <RefreshCw size={20} />
        </button>
      </header>

      {!isRunning && (
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 p-4 rounded-xl text-sm">
          The server must be running to manage players.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Operators */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col">
          <div className="p-4 border-b border-zinc-800 bg-zinc-900/50 flex items-center gap-2">
            <Shield className="text-indigo-400" size={18} />
            <h3 className="font-semibold">Operators</h3>
          </div>
          <div className="p-4 border-b border-zinc-800">
            <div className="flex gap-2">
              <input
                type="text"
                value={playerInput}
                onChange={(e) => setPlayerInput(e.target.value)}
                placeholder="Player name..."
                disabled={!isRunning}
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-50"
              />
              {filteredSuggestions.length > 0 && (
                <div className="absolute mt-12 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl w-full z-10 max-h-40 overflow-y-auto">
                  {filteredSuggestions.map((name) => (
                    <button
                      key={name}
                      className="block w-full text-left px-3 py-2 text-sm hover:bg-zinc-800"
                      onClick={() => setPlayerInput(name)}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
              <button
                onClick={() => handleAction('op', playerInput)}
                disabled={!isRunning || !playerInput || actionLoading === `op-${playerInput}`}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
              >
                Op
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {isLoading ? (
              <div className="p-4 flex justify-center"><Loader2 className="animate-spin text-zinc-500" size={20}/></div>
            ) : data?.ops?.length === 0 ? (
              <div className="p-4 text-center text-zinc-500 text-sm">No operators found.</div>
            ) : (
              data?.ops?.map((op: any) => (
                <div key={op.uuid} className="flex items-center justify-between p-2 hover:bg-zinc-900 rounded-lg group">
                  <span className="font-medium">{op.name}</span>
                  <button
                    onClick={() => handleAction('deop', op.name)}
                    disabled={!isRunning || actionLoading === `deop-${op.name}`}
                    className="opacity-0 group-hover:opacity-100 text-rose-400 hover:bg-rose-500/10 p-1.5 rounded-md transition-all disabled:opacity-50"
                  >
                    {actionLoading === `deop-${op.name}` ? <Loader2 size={16} className="animate-spin"/> : <UserMinus size={16} />}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Whitelist */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col">
          <div className="p-4 border-b border-zinc-800 bg-zinc-900/50 flex items-center gap-2">
            <Users className="text-emerald-400" size={18} />
            <h3 className="font-semibold">Whitelist</h3>
          </div>
          <div className="p-4 border-b border-zinc-800">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Player name..."
                disabled={!isRunning}
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-50"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAction('whitelist add', e.currentTarget.value);
                    e.currentTarget.value = '';
                  }
                }}
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {isLoading ? (
              <div className="p-4 flex justify-center"><Loader2 className="animate-spin text-zinc-500" size={20}/></div>
            ) : data?.whitelist?.length === 0 ? (
              <div className="p-4 text-center text-zinc-500 text-sm">Whitelist is empty.</div>
            ) : (
              data?.whitelist?.map((player: any) => (
                <div key={player.uuid} className="flex items-center justify-between p-2 hover:bg-zinc-900 rounded-lg group">
                  <span className="font-medium">{player.name}</span>
                  <button
                    onClick={() => handleAction('whitelist remove', player.name)}
                    disabled={!isRunning || actionLoading === `whitelist remove-${player.name}`}
                    className="opacity-0 group-hover:opacity-100 text-rose-400 hover:bg-rose-500/10 p-1.5 rounded-md transition-all disabled:opacity-50"
                  >
                    {actionLoading === `whitelist remove-${player.name}` ? <Loader2 size={16} className="animate-spin"/> : <UserMinus size={16} />}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Bans */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col lg:col-span-2">
          <div className="p-4 border-b border-zinc-800 bg-zinc-900/50 flex items-center gap-2">
            <ShieldAlert className="text-rose-400" size={18} />
            <h3 className="font-semibold">Banned Players</h3>
          </div>
          <div className="p-4 border-b border-zinc-800">
            <div className="flex gap-2 max-w-md">
              <input
                type="text"
                placeholder="Player name to ban..."
                disabled={!isRunning}
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/50 disabled:opacity-50"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAction('ban', e.currentTarget.value);
                    e.currentTarget.value = '';
                  }
                }}
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 max-h-64">
            {isLoading ? (
              <div className="p-4 flex justify-center"><Loader2 className="animate-spin text-zinc-500" size={20}/></div>
            ) : data?.bannedPlayers?.length === 0 ? (
              <div className="p-4 text-center text-zinc-500 text-sm">No banned players.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {data?.bannedPlayers?.map((player: any) => (
                  <div key={player.uuid} className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-xl group">
                    <div>
                      <div className="font-medium text-rose-400">{player.name}</div>
                      <div className="text-xs text-zinc-500 mt-1">Reason: {player.reason}</div>
                    </div>
                    <button
                      onClick={() => handleAction('pardon', player.name)}
                      disabled={!isRunning || actionLoading === `pardon-${player.name}`}
                      className="opacity-0 group-hover:opacity-100 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded-lg text-sm transition-all disabled:opacity-50"
                    >
                      {actionLoading === `pardon-${player.name}` ? <Loader2 size={16} className="animate-spin"/> : 'Pardon'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Logins */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col lg:col-span-2">
          <div className="p-4 border-b border-zinc-800 bg-zinc-900/50 flex items-center gap-2">
            <Users className="text-emerald-400" size={18} />
            <h3 className="font-semibold">Recent Logins</h3>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {isLoading ? (
              <div className="col-span-full flex justify-center"><Loader2 className="animate-spin text-zinc-500" size={20}/></div>
            ) : recentJoins.length === 0 ? (
              <div className="col-span-full text-sm text-zinc-500">No recent joins.</div>
            ) : (
              recentJoins.map((act: any, i: number) => (
                <div key={i} className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-3 flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white">{act.player}</span>
                    <span className="text-xs text-zinc-500">{new Date(act.time).toLocaleTimeString()}</span>
                  </div>
                  <div className="text-xs text-zinc-400">Action: {act.action}</div>
                  <div className="text-xs text-zinc-500 break-all">{act.details || 'joined'}</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Player Activity */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col lg:col-span-2">
          <div className="p-4 border-b border-zinc-800 bg-zinc-900/50 flex items-center gap-2">
            <Users className="text-sky-400" size={18} />
            <h3 className="font-semibold">Player Activity</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4 max-h-96 space-y-2 font-mono text-sm">
            {isLoading ? (
              <div className="flex justify-center"><Loader2 className="animate-spin text-zinc-500" size={20}/></div>
            ) : data?.activity?.length === 0 ? (
              <div className="text-center text-zinc-500">No recent activity.</div>
            ) : (
              data?.activity?.map((act: any, i: number) => (
                <div key={i} className="flex gap-4 p-2 hover:bg-zinc-900/50 rounded-lg transition-colors">
                  <span className="text-zinc-500 shrink-0">{new Date(act.time).toLocaleTimeString()}</span>
                  <span className="font-medium text-indigo-400 shrink-0 w-32 truncate">{act.player}</span>
                  <span className={`shrink-0 w-20 ${act.action === 'join' ? 'text-emerald-400' : act.action === 'leave' ? 'text-rose-400' : act.action === 'chat' ? 'text-sky-400' : 'text-amber-400'}`}>
                    {act.action}
                  </span>
                  <span className="text-zinc-300 break-all">{act.details}</span>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
