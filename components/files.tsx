import { useState, useRef } from 'react';
import { useStore } from '@/lib/store';
import { FolderOpen, File, ChevronRight, ArrowLeft, Save, Trash2, Loader2, RefreshCw, Upload, FolderPlus, Download } from 'lucide-react';
import useSWR from 'swr';
import Editor from '@monaco-editor/react';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function Files() {
  const { activeServerId } = useStore();
  const [currentPath, setCurrentPath] = useState('/');
  const [editingFile, setEditingFile] = useState<{ path: string; content: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadSummary, setUploadSummary] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const { data, error, isLoading, mutate } = useSWR(
    activeServerId && !editingFile ? `/api/servers/${activeServerId}/files?path=${encodeURIComponent(currentPath)}` : null,
    fetcher
  );

  const handleCreateFolder = async () => {
    const folderName = prompt('Enter folder name:');
    if (!folderName || !activeServerId) return;

    const path = currentPath === '/' ? `/${folderName}` : `${currentPath}/${folderName}`;
    try {
      const res = await fetch(`/api/servers/${activeServerId}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, action: 'createFolder' }),
      });
      if (res.ok) {
        mutate();
      } else {
        alert('Failed to create folder');
      }
    } catch (e) {
      alert('Error creating folder');
    }
  };

  const handleNavigate = (dir: string) => {
    if (dir === '..') {
      const parts = currentPath.split('/').filter(Boolean);
      parts.pop();
      setCurrentPath('/' + parts.join('/'));
    } else {
      setCurrentPath(currentPath === '/' ? `/${dir}` : `${currentPath}/${dir}`);
    }
  };

  const handleOpenFile = async (filename: string) => {
    const path = currentPath === '/' ? `/${filename}` : `${currentPath}/${filename}`;
    try {
      const res = await fetch(`/api/servers/${activeServerId}/files?path=${encodeURIComponent(path)}`);
      const data = await res.json();
      if (data.type === 'file') {
        setEditingFile({ path, content: data.content });
      }
    } catch (e) {
      alert('Error opening file');
    }
  };

  const handleSaveFile = async () => {
    if (!editingFile || !activeServerId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/servers/${activeServerId}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: editingFile.path, content: editingFile.content }),
      });
      if (res.ok) {
        alert('File saved successfully');
      } else {
        alert('Failed to save file');
      }
    } catch (e) {
      alert('Error saving file');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, filename: string) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete ${filename}?`)) return;
    
    const path = currentPath === '/' ? `/${filename}` : `${currentPath}/${filename}`;
    try {
      const res = await fetch(`/api/servers/${activeServerId}/files?path=${encodeURIComponent(path)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        mutate();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete');
      }
    } catch (e) {
      alert('Error deleting file');
    }
  };

  const handleDownload = async (e: React.MouseEvent, filename: string) => {
    e.stopPropagation();
    const path = currentPath === '/' ? `/${filename}` : `${currentPath}/${filename}`;
    const url = `/api/servers/${activeServerId}/files/download?path=${encodeURIComponent(path)}`;
    window.open(url, '_blank');
  };

  const uploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0 || !activeServerId) return;
    setUploading(true);
    setUploadSummary(null);
    const formData = new FormData();
    const names: string[] = [];
    Array.from(files).forEach((file) => {
      formData.append('file', file);
      names.push((file as any).webkitRelativePath || file.name);
    });
    formData.append('path', currentPath);

    try {
      const res = await fetch(`/api/servers/${activeServerId}/files/upload`, {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        mutate();
        const listed = names.slice(0, 3).join(', ');
        const more = names.length > 3 ? ` +${names.length - 3} more` : '';
        setUploadSummary(`Uploaded ${names.length} item(s) to ${currentPath}: ${listed}${more}`);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to upload');
      }
    } catch (err) {
      alert('Error uploading files');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (folderInputRef.current) folderInputRef.current.value = '';
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => uploadFiles(e.target.files);
  const handleFolderUpload = (e: React.ChangeEvent<HTMLInputElement>) => uploadFiles(e.target.files);

  const getLanguage = (filename: string) => {
    if (filename.endsWith('.json')) return 'json';
    if (filename.endsWith('.yml') || filename.endsWith('.yaml')) return 'yaml';
    if (filename.endsWith('.properties')) return 'ini';
    if (filename.endsWith('.xml')) return 'xml';
    if (filename.endsWith('.js')) return 'javascript';
    return 'plaintext';
  };

  if (editingFile) {
    return (
      <div className="p-8 max-w-6xl mx-auto h-full flex flex-col">
        <header className="flex items-center justify-between mb-6 shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setEditingFile(null)}
              className="p-2 hover:bg-zinc-800 rounded-xl transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">{editingFile.path.split('/').pop()}</h2>
              <p className="text-zinc-400 text-sm">{editingFile.path}</p>
            </div>
          </div>
          <button
            onClick={handleSaveFile}
            disabled={saving}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            Save File
          </button>
        </header>
        <div className="flex-1 bg-[#1e1e1e] border border-zinc-800 rounded-2xl overflow-hidden py-4">
          <Editor
            height="100%"
            language={getLanguage(editingFile.path)}
            theme="vs-dark"
            value={editingFile.content}
            onChange={(value) => setEditingFile({ ...editingFile, content: value || '' })}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              wordWrap: 'on',
              scrollBeyondLastLine: false,
              smoothScrolling: true,
              padding: { top: 16 },
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <FolderOpen className="text-indigo-500" /> File Manager
          </h2>
          <p className="text-zinc-400 mt-1">Manage your server files and configurations.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleCreateFolder}
            className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors"
          >
            <FolderPlus size={18} />
            New Folder
          </button>
          <input 
            type="file" 
            multiple
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            className="hidden" 
          />
          <input 
            type="file"
            ref={folderInputRef}
            onChange={handleFolderUpload}
            className="hidden"
            multiple
            {...({ webkitdirectory: "true", mozdirectory: "true", directory: "true" } as any)}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            {uploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
            Upload Files
          </button>
          <button
            onClick={() => folderInputRef.current?.click()}
            disabled={uploading}
            className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            {uploading ? <Loader2 size={18} className="animate-spin" /> : <FolderPlus size={18} />}
            Upload Folder
          </button>
          <button
            onClick={() => mutate()}
            className="p-2 hover:bg-zinc-800 rounded-xl transition-colors text-zinc-400 hover:text-white"
          >
            <RefreshCw size={20} />
          </button>
        </div>
      </header>

      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden">
        {uploadSummary && (
          <div className="bg-emerald-500/10 text-emerald-300 border-b border-emerald-500/30 px-4 py-3 text-sm flex items-center justify-between">
            <span>{uploadSummary}</span>
            <button className="text-emerald-200 hover:text-emerald-100" onClick={() => setUploadSummary(null)}>✕</button>
          </div>
        )}
        <div className="bg-zinc-900 border-b border-zinc-800 p-4 flex items-center gap-2 text-sm font-medium">
          <button onClick={() => setCurrentPath('/')} className="hover:text-indigo-400 transition-colors">root</button>
          {currentPath !== '/' && currentPath.split('/').filter(Boolean).map((part, i, arr) => (
            <div key={i} className="flex items-center gap-2">
              <ChevronRight size={16} className="text-zinc-600" />
              <button 
                onClick={() => setCurrentPath('/' + arr.slice(0, i + 1).join('/'))}
                className="hover:text-indigo-400 transition-colors"
              >
                {part}
              </button>
            </div>
          ))}
        </div>

        {isLoading ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="animate-spin text-indigo-500" size={32} />
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-400">Failed to load directory.</div>
        ) : (
          <div className="divide-y divide-zinc-800/50">
            {currentPath !== '/' && (
              <div 
                onClick={() => handleNavigate('..')}
                className="p-4 hover:bg-zinc-900/50 flex items-center gap-3 cursor-pointer transition-colors"
              >
                <FolderOpen size={20} className="text-indigo-400" />
                <span className="font-medium">..</span>
              </div>
            )}
            
            {data?.files?.sort((a: any, b: any) => {
              if (a.isDirectory && !b.isDirectory) return -1;
              if (!a.isDirectory && b.isDirectory) return 1;
              return a.name.localeCompare(b.name);
            }).map((file: any) => (
              <div 
                key={file.name}
                onClick={() => file.isDirectory ? handleNavigate(file.name) : handleOpenFile(file.name)}
                className="p-4 hover:bg-zinc-900/50 flex items-center justify-between cursor-pointer transition-colors group"
              >
                <div className="flex items-center gap-3">
                  {file.isDirectory ? (
                    <FolderOpen size={20} className="text-indigo-400" />
                  ) : (
                    <File size={20} className="text-zinc-500" />
                  )}
                  <span className="font-medium">{file.name}</span>
                </div>
                <div className="flex items-center gap-4 text-sm text-zinc-500">
                  {!file.isDirectory && <span>{(file.size / 1024).toFixed(1)} KB</span>}
                  {!file.isDirectory && (
                    <button
                      onClick={(e) => handleDownload(e, file.name)}
                      className="opacity-0 group-hover:opacity-100 p-2 hover:bg-indigo-500/10 hover:text-indigo-400 rounded-lg transition-all"
                      title="Download"
                    >
                      <Download size={16} />
                    </button>
                  )}
                  <button
                    onClick={(e) => handleDelete(e, file.name)}
                    className="opacity-0 group-hover:opacity-100 p-2 hover:bg-rose-500/10 hover:text-rose-400 rounded-lg transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
            {data?.files?.length === 0 && currentPath === '/' && (
              <div className="p-8 text-center text-zinc-500">Directory is empty.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
