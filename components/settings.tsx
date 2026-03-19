import { useState, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { Settings as SettingsIcon, Save, Loader2, ShieldAlert } from 'lucide-react';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function Settings() {
  const { activeServerId, fetchServers } = useStore();
  const [saving, setSaving] = useState(false);
  
  const [ram, setRam] = useState('2G');
  const [cpuLimit, setCpuLimit] = useState(100);
  const [properties, setProperties] = useState('');

  // RCON Settings
  const [rconEnabled, setRconEnabled] = useState(false);
  const [rconPort, setRconPort] = useState('25575');
  const [rconPassword, setRconPassword] = useState('');

  const { data, isLoading } = useSWR(
    activeServerId ? `/api/servers/${activeServerId}/settings` : null,
    fetcher
  );

  useEffect(() => {
    if (data) {
      setRam(data.config.ram || '2G');
      setCpuLimit(data.config.cpuLimit || 100);
      setProperties(data.properties || '');

      // Parse RCON from properties
      if (data.properties) {
        const lines = data.properties.split('\n');
        let enabled = false;
        let port = '25575';
        let pass = '';
        lines.forEach((line: string) => {
          if (line.startsWith('enable-rcon=')) enabled = line.split('=')[1].trim() === 'true';
          if (line.startsWith('rcon.port=')) port = line.split('=')[1].trim();
          if (line.startsWith('rcon.password=')) pass = line.split('=')[1].trim();
        });
        setRconEnabled(enabled);
        setRconPort(port);
        setRconPassword(pass);
      }
    }
  }, [data]);

  const handleSave = async () => {
    if (!activeServerId) return;
    setSaving(true);

    // Update properties string with RCON settings
    let newProps = properties;
    const updateProp = (key: string, value: string) => {
      const regex = new RegExp(`^${key}=.*$`, 'm');
      if (regex.test(newProps)) {
        newProps = newProps.replace(regex, `${key}=${value}`);
      } else {
        newProps += `\n${key}=${value}`;
      }
    };

    updateProp('enable-rcon', rconEnabled.toString());
    updateProp('rcon.port', rconPort);
    updateProp('rcon.password', rconPassword);

    try {
      const res = await fetch(`/api/servers/${activeServerId}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: { ram, cpuLimit },
          properties: newProps
        }),
      });
      if (res.ok) {
        await fetchServers();
        setProperties(newProps);
        alert('Settings saved successfully. Restart server to apply changes.');
      } else {
        alert('Failed to save settings');
      }
    } catch (e) {
      alert('Error saving settings');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="animate-spin text-indigo-500" size={32} />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <SettingsIcon className="text-indigo-500" /> Settings
          </h2>
          <p className="text-zinc-400 mt-1">Configure server properties and instance settings.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors disabled:opacity-50 shadow-lg shadow-indigo-500/20"
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          Save Changes
        </button>
      </header>

      <div className="space-y-6">
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6">
          <h3 className="text-xl font-semibold mb-4">Instance Configuration</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">Allocated RAM</label>
              <select
                value={ram}
                onChange={(e) => setRam(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              >
                <option value="1G">1 GB</option>
                <option value="2G">2 GB</option>
                <option value="4G">4 GB</option>
                <option value="8G">8 GB</option>
                <option value="12G">12 GB</option>
                <option value="16G">16 GB</option>
              </select>
              <p className="text-xs text-zinc-500 mt-2">Amount of memory allocated to the Java process.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">CPU Limit (%)</label>
              <input
                type="number"
                min="10"
                max="1600"
                step="10"
                value={cpuLimit}
                onChange={(e) => setCpuLimit(parseInt(e.target.value) || 100)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
              <p className="text-xs text-zinc-500 mt-2">Maximum CPU usage (100% = 1 core).</p>
            </div>
          </div>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6">
          <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <ShieldAlert className="text-amber-500" size={20} /> RCON Settings
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-center justify-between md:col-span-3 bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
              <div>
                <div className="font-medium">Enable RCON</div>
                <div className="text-sm text-zinc-400">Allow remote console access</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={rconEnabled} onChange={(e) => setRconEnabled(e.target.checked)} />
                <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
              </label>
            </div>
            {rconEnabled && (
              <>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">RCON Port</label>
                  <input
                    type="text"
                    value={rconPort}
                    onChange={(e) => setRconPort(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-zinc-400 mb-2">RCON Password</label>
                  <input
                    type="password"
                    value={rconPassword}
                    onChange={(e) => setRconPassword(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                </div>
              </>
            )}
          </div>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 flex flex-col h-[500px]">
          <h3 className="text-xl font-semibold mb-2">server.properties</h3>
          <p className="text-zinc-400 text-sm mb-4">Edit the raw server.properties file. Changes require a restart.</p>
          <textarea
            value={properties}
            onChange={(e) => setProperties(e.target.value)}
            className="flex-1 w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  );
}
