import { useStore } from '@/lib/store';
import { useState, useRef, useEffect } from 'react';
import { Terminal as TerminalIcon, Send, Play, Square, Skull, RotateCcw, RefreshCw } from 'lucide-react';

const COMMON_COMMANDS = [
  'help', 'stop', 'say', 'tp', 'give', 'gamemode', 'weather', 'time', 
  'kick', 'ban', 'op', 'deop', 'whitelist', 'save-all', 'list', 'seed',
  'difficulty', 'gamerule', 'kill', 'clear', 'effect', 'enchant', 'xp'
];

export function Console() {
  const { logs, activeServerId, status, setStatus } = useStore();
  const [command, setCommand] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const getLogColor = (log: string) => {
    const lower = log.toLowerCase();
    if (log.startsWith('>')) return 'text-emerald-400';
    if (log.includes('[manager]')) return 'text-indigo-400';
    if (log.includes('[automation]')) return 'text-amber-400';
    if (log.includes('[scheduler]')) return 'text-sky-400';
    if (log.includes('[backup]') || log.includes('[restore]')) return 'text-purple-400';
    if (log.includes('[rcon]')) return 'text-cyan-400';
    if (lower.includes('error') || lower.includes('exception') || lower.includes('fatal')) return 'text-rose-400';
    if (lower.includes('warn')) return 'text-amber-400';
    if (lower.includes('info')) return 'text-sky-400';
    if (lower.includes('[server]')) return 'text-zinc-400';
    if (lower.includes('done')) return 'text-emerald-400';
    if (log.match(/\[\d{2}:\d{2}:\d{2}\]/)) return 'text-zinc-400';
    return 'text-zinc-300';
  };

  const filteredLogs = filter
    ? logs.filter(log => log.toLowerCase().includes(filter.toLowerCase()))
    : logs;

  const handleCommandChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCommand(val);
    
    if (val.trim() && !val.includes(' ')) {
      const match = val.startsWith('/') ? val.substring(1).toLowerCase() : val.toLowerCase();
      setSuggestions(COMMON_COMMANDS.filter(c => c.startsWith(match)));
    } else {
      setSuggestions([]);
    }
  };

  const handleSuggestionClick = (cmd: string) => {
    setCommand(cmd + ' ');
    setSuggestions([]);
  };

  const handleCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim() || !activeServerId) return;
    
    await fetch(`/api/servers/${activeServerId}/command`, {
      method: 'POST',
      body: JSON.stringify({ command }),
    });
    setCommand('');
    setSuggestions([]);
  };

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

  const handleServerAction = async (action: 'start' | 'stop' | 'kill' | 'restart') => {
    if (!activeServerId) return;
    await refreshStatus();
    setLoading(true);
    try {
      if (action === 'stop' || action === 'kill' || action === 'restart') {
        setStatus('stopping');
      }
      
      if (action === 'restart') {
        await fetch(`/api/servers/${activeServerId}/stop`, { method: 'POST' });
        await new Promise(resolve => setTimeout(resolve, 2000));
        await fetch(`/api/servers/${activeServerId}/start`, { method: 'POST' });
        setStatus('starting');
      } else {
        await fetch(`/api/servers/${activeServerId}/${action}`, { method: 'POST' });
        if (action === 'start') setStatus('starting');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto h-full flex flex-col">
      <header className="mb-6">
        <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <TerminalIcon className="text-indigo-500" /> Console
        </h2>
        <p className="text-zinc-400 mt-1">View live server logs and execute commands.</p>
      </header>

      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={() => handleServerAction('start')}
          disabled={loading || status === 'running' || status === 'starting'}
          className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/50 text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors disabled:cursor-not-allowed"
        >
          <Play size={16} /> Start
        </button>
        <button
          onClick={() => handleServerAction('stop')}
          disabled={loading || status !== 'running'}
          className="bg-amber-600 hover:bg-amber-500 disabled:bg-amber-600/50 text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors disabled:cursor-not-allowed"
        >
          <Square size={16} /> Stop
        </button>
        <button
          onClick={() => handleServerAction('kill')}
          disabled={loading || status !== 'running'}
          className="bg-rose-600 hover:bg-rose-500 disabled:bg-rose-600/50 text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors disabled:cursor-not-allowed"
        >
          <Skull size={16} /> Kill
        </button>
        <button
          onClick={() => handleServerAction('restart')}
          disabled={loading || status === 'starting' || status === 'stopping'}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors disabled:cursor-not-allowed"
        >
          <RotateCcw size={16} /> Restart
        </button>
        <button
          onClick={refreshStatus}
          disabled={loading}
          className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-white px-3 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={16} /> Refresh Status
        </button>
        <span className={`ml-4 px-3 py-1 rounded-full text-sm font-medium ${
          status === 'running' ? 'bg-emerald-500/20 text-emerald-400' :
          status === 'starting' ? 'bg-amber-500/20 text-amber-400' :
          status === 'stopping' ? 'bg-rose-500/20 text-rose-400' :
          'bg-zinc-700/50 text-zinc-400'
        }`}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
      </div>

      <div className="flex-1 bg-zinc-950 border border-zinc-800 rounded-2xl flex flex-col overflow-hidden shadow-xl mb-8 relative">
        <div className="flex-1 overflow-y-auto p-4 font-mono text-sm space-y-1">
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter logs..."
              className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
            />
            <button onClick={() => setFilter('')} className="text-xs text-zinc-500 hover:text-white px-2">
              Clear
            </button>
            <span className="text-xs text-zinc-600 ml-auto">{filteredLogs.length} / {logs.length} lines</span>
          </div>
          {filteredLogs.length === 0 ? (
            <div className="text-zinc-500 italic">
              {filter ? 'No logs match the filter.' : 'No logs available. Start the server to see output.'}
            </div>
          ) : (
            filteredLogs.map((log, i) => (
              <div key={i} className={`break-all ${getLogColor(log)}`}>
                {log}
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
        
        {suggestions.length > 0 && (
          <div className="absolute bottom-[72px] left-4 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl p-2 flex flex-wrap gap-2 max-w-2xl z-10">
            {suggestions.map(s => (
              <button
                key={s}
                onClick={() => handleSuggestionClick(s)}
                className="px-3 py-1.5 bg-zinc-800 hover:bg-indigo-500/20 hover:text-indigo-400 text-zinc-300 rounded-lg text-sm font-mono transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleCommand} className="p-4 bg-zinc-900 border-t border-zinc-800 flex gap-3">
          <input
            type="text"
            value={command}
            onChange={handleCommandChange}
            placeholder="Type a command (e.g. 'help', 'list')..."
            className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-mono text-sm"
          />
          <button
            type="submit"
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors shadow-lg shadow-indigo-500/20"
          >
            <Send size={18} /> Send
          </button>
        </form>
      </div>
    </div>
  );
}
