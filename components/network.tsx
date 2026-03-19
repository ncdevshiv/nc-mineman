import { useState, useRef, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { Globe, Play, Square, Settings, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const PUBLIC_FRP_SERVERS = [
  {
    name: 'Public FRP (EU)',
    serverAddr: 'frp1.publicvm.com',
    serverPort: 7000,
    authToken: 'pythonfetion',
    suggestedPort: 21000,
  },
  {
    name: 'Public FRP (US)',
    serverAddr: 'frp2.publicvm.com',
    serverPort: 7000,
    authToken: 'pythonfetion',
    suggestedPort: 21000,
  },
  {
    name: 'Custom Server',
    serverAddr: '',
    serverPort: 7000,
    authToken: '',
    suggestedPort: 25565,
  },
];

export function Network() {
  const { tunnelStatus, tunnelLogs, tunnelAddress, activeServerId } = useStore();
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showCustomDomain, setShowCustomDomain] = useState(false);
  const [config, setConfig] = useState({
    serverAddr: PUBLIC_FRP_SERVERS[0].serverAddr,
    serverPort: 7000,
    tunnelPort: 21000,
    authToken: PUBLIC_FRP_SERVERS[0].authToken,
  });
  const [saved, setSaved] = useState(false);
  const [domainStep, setDomainStep] = useState(1);
  const [customDomain, setCustomDomain] = useState('');
  const [verifyStatus, setVerifyStatus] = useState<'idle' | 'checking' | 'ok' | 'fail'>('idle');
  const [verifyMessage, setVerifyMessage] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [tunnelLogs]);

  const handlePresetChange = (index: number) => {
    const preset = PUBLIC_FRP_SERVERS[index];
    setConfig({
      serverAddr: preset.serverAddr,
      serverPort: preset.serverPort,
      tunnelPort: preset.suggestedPort,
      authToken: preset.authToken,
    });
    setSaved(false);
  };

  const inferredRecords = () => {
    const target = config.serverAddr.trim() || 'your-frps-host';
    const port = config.tunnelPort || 25565;
    return [
      { type: 'A', host: customDomain || 'your.domain', value: target, ttl: 300 },
      { type: 'SRV', host: `_minecraft._tcp.${customDomain || 'your.domain'}`, value: `${port} ${customDomain || 'your.domain'}`, ttl: 300 },
    ];
  };

  const verifyDns = async () => {
    if (!customDomain) return;
    setVerifyStatus('checking');
    setVerifyMessage('Checking DNS...');
    try {
      const res = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(customDomain)}&type=A`);
      if (!res.ok) throw new Error('DNS lookup failed');
      const data = await res.json();
      const answers = data.Answer || [];
      if (answers.length > 0) {
        setVerifyStatus('ok');
        setVerifyMessage('DNS record found. If it points to your FRP server IP, you are good to go.');
      } else {
        setVerifyStatus('fail');
        setVerifyMessage('No A record found yet. DNS may still be propagating.');
      }
    } catch (e: any) {
      setVerifyStatus('fail');
      setVerifyMessage(e.message || 'DNS lookup failed');
    }
  };

  const handleStart = async () => {
    if (!activeServerId) return;
    if (!config.serverAddr || !config.authToken) {
      alert('Please configure server address and auth token.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/servers/${activeServerId}/tunnel/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(`Failed to start tunnel: ${err.error}`);
      }
    } catch (e) {
      alert('Error starting tunnel');
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    if (!activeServerId) return;
    setLoading(true);
    await fetch(`/api/servers/${activeServerId}/tunnel/stop`, { method: 'POST' });
    setLoading(false);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 h-full flex flex-col">
      <header className="flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Globe className="text-indigo-500" /> Network Tunnel
          </h2>
          <p className="text-zinc-400 mt-1">Expose your server to the internet using FRP (no registration required).</p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 border ${
            tunnelStatus === 'running' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
            'bg-zinc-950 text-zinc-400 border-zinc-800'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              tunnelStatus === 'running' ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-500'
            }`} />
            {tunnelStatus === 'running' ? 'Tunnel Active' : 'Tunnel Offline'}
          </div>

          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 hover:bg-zinc-800 rounded-xl transition-colors text-zinc-400 hover:text-white"
            title="Configure"
          >
            <Settings size={20} />
          </button>
          <button
            onClick={() => { setShowCustomDomain(true); setDomainStep(1); setVerifyStatus('idle'); setVerifyMessage(''); }}
            className="p-2 hover:bg-zinc-800 rounded-xl transition-colors text-zinc-400 hover:text-white"
            title="Custom Domain Wizard"
          >
            <Globe size={20} />
          </button>

          {tunnelStatus === 'stopped' ? (
            <button
              onClick={handleStart}
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors disabled:opacity-50 shadow-lg shadow-indigo-500/20"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
              Start Tunnel
            </button>
          ) : (
            <button
              onClick={handleStop}
              disabled={loading}
              className="bg-rose-600 hover:bg-rose-500 text-white px-5 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors disabled:opacity-50 shadow-lg shadow-rose-500/20"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Square size={18} />}
              Stop Tunnel
            </button>
          )}
        </div>
      </header>

      {showSettings && (
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 space-y-4">
          <h3 className="text-lg font-semibold">FRP Server Configuration</h3>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Preset</label>
            <div className="grid grid-cols-3 gap-2">
              {PUBLIC_FRP_SERVERS.map((preset, i) => (
                <button
                  key={i}
                  onClick={() => handlePresetChange(i)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                    config.serverAddr === preset.serverAddr
                      ? 'bg-indigo-600 text-white'
                      : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
                  }`}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">FRP Server Address</label>
              <input
                type="text"
                value={config.serverAddr}
                onChange={(e) => { setConfig({ ...config, serverAddr: e.target.value }); setSaved(false); }}
                placeholder="e.g., frp1.publicvm.com"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">FRP Server Port</label>
              <input
                type="number"
                value={config.serverPort}
                onChange={(e) => { setConfig({ ...config, serverPort: parseInt(e.target.value) }); setSaved(false); }}
                placeholder="7000"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Tunnel Port (Public)</label>
              <input
                type="number"
                value={config.tunnelPort}
                onChange={(e) => { setConfig({ ...config, tunnelPort: parseInt(e.target.value) }); setSaved(false); }}
                placeholder="21000"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
              <p className="text-xs text-zinc-500 mt-1">The port others will use to connect</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Auth Token</label>
              <input
                type="password"
                value={config.authToken}
                onChange={(e) => { setConfig({ ...config, authToken: e.target.value }); setSaved(false); }}
                placeholder="Token from FRP server admin"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
            <p className="text-amber-400 text-sm">
              <strong>How FRP works:</strong> FRP requires a publicly accessible FRP server (frps). 
              You can run your own on a VPS, use a public server, or rent one. 
              The public servers above are free but may have limitations. 
              For production, deploy your own frps server — download from{' '}
              <a href="https://github.com/fatedier/frp" target="_blank" rel="noopener noreferrer" className="underline">
                github.com/fatedier/frp
              </a>.
            </p>
          </div>

          <button
            onClick={() => {
              localStorage.setItem(`frp-config-${activeServerId}`, JSON.stringify(config));
              setSaved(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl font-medium transition-colors"
          >
            {saved ? 'Saved!' : 'Save Configuration'}
          </button>
        </div>
      )}

      {showCustomDomain && (
        <div className="bg-zinc-950 border border-indigo-500/30 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2"><Globe size={18} className="text-indigo-400" /> Custom Domain Setup</h3>
            <span className="text-xs text-zinc-500">Step {domainStep} of 3</span>
          </div>

          {domainStep === 1 && (
            <div className="space-y-3">
              <p className="text-sm text-zinc-400">Enter the domain you want to use. We’ll generate DNS records for you.</p>
              <input
                type="text"
                value={customDomain}
                onChange={(e) => setCustomDomain(e.target.value.trim())}
                placeholder="e.g., mc.yourdomain.com"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
              <div className="flex justify-end gap-2">
                <button className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl font-medium" onClick={() => setDomainStep(2)} disabled={!customDomain}>Next</button>
              </div>
            </div>
          )}

          {domainStep === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-zinc-400">Add these DNS records at your DNS provider. You can adjust values before applying.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {inferredRecords().map((rec, i) => (
                  <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 space-y-2">
                    <div className="text-xs text-zinc-500">{rec.type} record</div>
                    <input value={rec.host} readOnly className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm" />
                    <input value={rec.value} readOnly className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm" />
                    <div className="text-xs text-zinc-500">TTL: {rec.ttl}s</div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between">
                <button className="px-4 py-2 rounded-xl bg-zinc-800 text-white" onClick={() => setDomainStep(1)}>Back</button>
                <button className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl font-medium" onClick={() => setDomainStep(3)}>Next</button>
              </div>
            </div>
          )}

          {domainStep === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-zinc-400">Verify DNS once records are added.</p>
              <div className="flex items-center gap-3">
                <button
                  onClick={verifyDns}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2"
                >
                  {verifyStatus === 'checking' ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  Verify DNS
                </button>
                {verifyStatus === 'ok' && <span className="text-emerald-400 text-sm flex items-center gap-1"><CheckCircle2 size={16} /> Verified</span>}
                {verifyStatus === 'fail' && <span className="text-amber-400 text-sm flex items-center gap-1"><AlertTriangle size={16} /> {verifyMessage}</span>}
                {verifyStatus === 'checking' && <span className="text-zinc-400 text-sm">Checking...</span>}
              </div>
              {verifyMessage && verifyStatus !== 'checking' && <div className="text-sm text-zinc-300 bg-zinc-900 border border-zinc-800 rounded-xl p-3">{verifyMessage}</div>}
              <div className="flex justify-between">
                <button className="px-4 py-2 rounded-xl bg-zinc-800 text-white" onClick={() => setDomainStep(2)}>Back</button>
                <button
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl font-medium"
                  onClick={() => setShowCustomDomain(false)}
                >Done</button>
              </div>
            </div>
          )}
        </div>
      )}

      {tunnelAddress && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-emerald-400 mb-2">Server Address</h3>
          <p className="text-2xl font-mono font-bold text-white">{tunnelAddress}</p>
          <p className="text-zinc-400 text-sm mt-2">
            Players can connect using this address in Minecraft.
          </p>
        </div>
      )}

      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl flex flex-col overflow-hidden shadow-xl flex-1">
        <div className="bg-zinc-900 border-b border-zinc-800 p-4 flex items-center justify-between">
          <h3 className="font-medium flex items-center gap-2">
            <Globe size={18} className="text-zinc-400" /> Tunnel Logs
          </h3>
          {tunnelAddress && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500">Connect:</span>
              <code className="text-xs bg-zinc-800 px-2 py-1 rounded text-emerald-400">{tunnelAddress}</code>
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-4 font-mono text-sm space-y-1">
          {tunnelLogs.length === 0 ? (
            <div className="text-zinc-500 italic">No tunnel logs. Start the tunnel to see output.</div>
          ) : (
            tunnelLogs.map((log, i) => {
              const isSuccess = log.toLowerCase().includes('success') || log.toLowerCase().includes('start');
              const isError = log.toLowerCase().includes('fail') || log.toLowerCase().includes('error') || log.toLowerCase().includes('disconnected');
              return (
                <div 
                  key={i} 
                  className={`break-all ${
                    isError ? 'text-rose-400' : 
                    isSuccess ? 'text-emerald-400' : 
                    'text-zinc-300'
                  }`}
                >
                  {log}
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}
