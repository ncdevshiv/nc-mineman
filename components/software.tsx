import { useState, useEffect, useMemo } from 'react';
import { Download, Server, Loader2, CheckCircle2 } from 'lucide-react';
import useSWR from 'swr';
import { useStore } from '@/lib/store';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function Software() {
  const { activeServerId } = useStore();
  const [selectedSoftware, setSelectedSoftware] = useState('paper');
  const [selectedVersion, setSelectedVersion] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [success, setSuccess] = useState(false);

  // PaperMC API integration
  const { data: projectData } = useSWR(
    selectedSoftware === 'paper' || selectedSoftware === 'folia' || selectedSoftware === 'velocity'
      ? `https://api.papermc.io/v2/projects/${selectedSoftware}`
      : null,
    fetcher
  );

  const versions = useMemo(() => projectData?.versions?.slice().reverse() || [], [projectData]);

  useEffect(() => {
    if (versions.length > 0 && !selectedVersion) {
      setSelectedVersion(versions[0]);
    }
  }, [versions, selectedVersion]);

  const handleDownload = async () => {
    if (!selectedVersion || !activeServerId) return;
    setDownloading(true);
    setSuccess(false);

    try {
      // Get builds for the version
      const buildRes = await fetch(`https://api.papermc.io/v2/projects/${selectedSoftware}/versions/${selectedVersion}`);
      const buildData = await buildRes.json();
      const latestBuild = buildData.builds[buildData.builds.length - 1].build;

      const downloadUrl = `https://api.papermc.io/v2/projects/${selectedSoftware}/versions/${selectedVersion}/builds/${latestBuild}/downloads/${selectedSoftware}-${selectedVersion}-${latestBuild}.jar`;

      const res = await fetch(`/api/servers/${activeServerId}/software`, {
        method: 'POST',
        body: JSON.stringify({ url: downloadUrl }),
      });

      if (res.ok) {
        setSuccess(true);
      } else {
        alert('Download failed');
      }
    } catch (err) {
      alert('Error downloading software');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <header>
        <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Server className="text-indigo-500" /> Software
        </h2>
        <p className="text-zinc-400 mt-1">Change your server software and version.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {['paper', 'folia', 'velocity'].map((soft) => (
          <button
            key={soft}
            onClick={() => {
              setSelectedSoftware(soft);
              setSelectedVersion('');
              setSuccess(false);
            }}
            className={`p-6 rounded-2xl border text-left transition-all ${
              selectedSoftware === soft
                ? 'bg-indigo-500/10 border-indigo-500/50 ring-1 ring-indigo-500/50'
                : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700'
            }`}
          >
            <h3 className="text-xl font-bold capitalize mb-2">{soft}</h3>
            <p className="text-zinc-400 text-sm">
              {soft === 'paper' && 'High performance Minecraft server.'}
              {soft === 'folia' && 'Regionized multithreading for extreme scale.'}
              {soft === 'velocity' && 'Next-generation Minecraft proxy.'}
            </p>
          </button>
        ))}
      </div>

      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-2">Select Version</label>
          <select
            value={selectedVersion}
            onChange={(e) => setSelectedVersion(e.target.value)}
            className="w-full md:w-64 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          >
            {versions.map((v: string) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>

        <button
          onClick={handleDownload}
          disabled={downloading || !selectedVersion}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 transition-colors disabled:opacity-50 shadow-lg shadow-indigo-500/20"
        >
          {downloading ? <Loader2 size={20} className="animate-spin" /> : <Download size={20} />}
          {downloading ? 'Downloading...' : `Install ${selectedSoftware} ${selectedVersion}`}
        </button>

        {success && (
          <div className="flex items-center gap-2 text-emerald-400 bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/20">
            <CheckCircle2 size={20} />
            <span>Successfully installed {selectedSoftware} {selectedVersion}!</span>
          </div>
        )}
      </div>
    </div>
  );
}
