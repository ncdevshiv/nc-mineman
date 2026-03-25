import { useState } from 'react';
import { useStore } from '@/lib/store';
import { Archive, Download, Trash2, Loader2, RefreshCw, Play, Plus } from 'lucide-react';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function Backups() {
  const { activeServerId } = useStore();
	const [creatingBackup, setCreatingBackup] = useState(false);
	const [showCreateForm, setShowCreateForm] = useState(false);
  const [backupName, setBackupName] = useState('');
  const [restoring, setRestoring] = useState<string | null>(null);

  const { data, error, isLoading, mutate } = useSWR(
    activeServerId ? `/api/servers/${activeServerId}/backups` : null,
    fetcher
  );

	const handleCreateBackup = async () => {
		if (!activeServerId) return;
		setCreatingBackup(true);
		try {
			const res = await fetch(`/api/servers/${activeServerId}/backups`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: backupName || 'Backup' }),
			});
			if (res.ok) {
				mutate();
				setBackupName('');
				setCreatingBackup(false);
				setShowCreateForm(false);
			} else {
				const err = await res.json();
				alert(`Failed to create backup: ${err.error}`);
				setCreatingBackup(false);
			}
		} catch (e) {
			alert('Error creating backup');
			setCreatingBackup(false);
		}
	};

  const handleRestore = async (filename: string) => {
    if (!activeServerId || !confirm(`Are you sure you want to restore ${filename}? This will overwrite current server files.`)) return;
    setRestoring(filename);
    try {
      const res = await fetch(`/api/servers/${activeServerId}/backups/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || 'Backup restored successfully!');
      } else {
        alert(`Failed to restore backup: ${data.error}`);
      }
    } catch (e) {
      alert('Error restoring backup');
    } finally {
      setRestoring(null);
    }
  };

  const handleDelete = async (filename: string) => {
    if (!activeServerId || !confirm(`Delete backup ${filename}?`)) return;
    try {
      const res = await fetch(`/api/servers/${activeServerId}/backups?filename=${encodeURIComponent(filename)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        mutate();
      } else {
        alert('Failed to delete backup');
      }
    } catch (e) {
      alert('Error deleting backup');
    }
  };

  const handleDownload = async (filename: string) => {
    const url = `/api/servers/${activeServerId}/backups/download?filename=${encodeURIComponent(filename)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Archive className="text-indigo-500" /> Backups
          </h2>
          <p className="text-zinc-400 mt-1">Manage and restore server backups.</p>
        </div>
        <div className="flex gap-3">
	<button
		onClick={() => setShowCreateForm(!showCreateForm)}
		className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors shadow-lg shadow-indigo-500/20"
	>
		<Plus size={18} />
		Create Backup
	</button>
          <button
            onClick={() => mutate()}
            className="p-2 hover:bg-zinc-800 rounded-xl transition-colors text-zinc-400 hover:text-white"
          >
            <RefreshCw size={20} />
          </button>
        </div>
      </header>

	{showCreateForm && (
	<div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6">
		<h3 className="font-semibold mb-4">Create New Backup</h3>
		<div className="flex gap-4 items-end">
			<div className="flex-1">
				<label className="block text-sm font-medium text-zinc-400 mb-1">Backup Name (optional)</label>
				<input
					type="text"
					value={backupName}
					onChange={(e) => setBackupName(e.target.value)}
					placeholder="e.g., Daily Backup, Pre-update, etc."
					className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
				/>
			</div>
			<button
				onClick={handleCreateBackup}
				disabled={creatingBackup}
				className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
			>
				{creatingBackup ? (
					<>
						<Loader2 size={18} className="animate-spin" />
						Creating...
					</>
				) : (
					<>
						<Plus size={18} />
						Create
					</>
				)}
			</button>
			<button
				onClick={() => { setShowCreateForm(false); setBackupName(''); }}
				className="px-4 py-2 rounded-xl text-zinc-400 hover:text-white transition-colors"
			>
				Cancel
			</button>
		</div>
		<p className="text-xs text-zinc-500 mt-2">
			Backups are stored as .zip archives and can be restored to any state.
		</p>
	</div>
	)}

      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-indigo-500" size={32} />
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-400">Failed to load backups.</div>
        ) : data?.backups?.length === 0 ? (
          <div className="text-center py-12 text-zinc-500">
            <Archive size={48} className="mx-auto mb-4 opacity-20" />
            <p>No backups found.</p>
            <p className="text-sm mt-1">Create a backup to protect your server data.</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/50">
            {data?.backups?.map((backup: any) => (
              <div key={backup.name} className="p-4 hover:bg-zinc-900/50 flex items-center justify-between transition-colors group">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-zinc-900 rounded-xl text-indigo-400">
                    <Archive size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold">{backup.name}</h3>
                    <p className="text-sm text-zinc-400">{new Date(backup.createdAt).toLocaleString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-zinc-500 font-mono">{(backup.size / 1024 / 1024).toFixed(2)} MB</span>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleDownload(backup.name)}
                      className="p-2 hover:bg-indigo-500/10 hover:text-indigo-400 rounded-lg transition-all"
                      title="Download"
                    >
                      <Download size={16} />
                    </button>
                    <button
                      onClick={() => handleRestore(backup.name)}
                      disabled={restoring === backup.name}
                      className="bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
                    >
                      {restoring === backup.name ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                      Restore
                    </button>
                    <button
                      onClick={() => handleDelete(backup.name)}
                      className="p-2 hover:bg-rose-500/10 hover:text-rose-400 rounded-lg transition-all text-zinc-400"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
