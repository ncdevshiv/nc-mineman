import { useStore, Tab, GlobalTab } from '@/lib/store';
import { LayoutDashboard, Terminal, Download, Puzzle, ArrowLeft, Users, FolderOpen, Settings, Archive, Zap, Server, Database } from 'lucide-react';

export function Sidebar() {
	const { activeTab, setActiveTab, activeServerId, setActiveServerId, servers, globalTab, setGlobalTab } = useStore();

	const activeServer = servers.find(s => s.id === activeServerId);

	const tabs: { id: Tab; label: string; icon: any }[] = [
		{ id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
		{ id: 'console', label: 'Console', icon: Terminal },
		{ id: 'players', label: 'Players', icon: Users },
		{ id: 'files', label: 'File Manager', icon: FolderOpen },
		{ id: 'software', label: 'Software', icon: Download },
		{ id: 'plugins', label: 'Plugins', icon: Puzzle },
		{ id: 'backups', label: 'Backups', icon: Archive },
		{ id: 'automation', label: 'Automation', icon: Zap },
		{ id: 'settings', label: 'Settings', icon: Settings },
	];

	const globalTabs: { id: GlobalTab; label: string; icon: any }[] = [
		{ id: 'servers', label: 'Servers', icon: Server },
		{ id: 'database', label: 'Database', icon: Database },
	];

	return (
		<div className="w-72 bg-zinc-950/80 backdrop-blur-xl border-r border-zinc-900/50 h-screen flex flex-col shrink-0 relative z-20">
			<div className="p-8">
				<h1 className="text-2xl font-black text-white flex items-center gap-4 tracking-tighter">
					<div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30 transform -rotate-3 hover:rotate-0 transition-transform duration-500">
						<span className="text-white font-black text-xl">M</span>
					</div>
					<span className="gradient-text">MineManager</span>
				</h1>
			</div>

			<div className="px-4 mb-4">
				<div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 px-2">Global</div>
				<nav className="space-y-1">
					{globalTabs.map((tab) => {
						const Icon = tab.icon;
						const isActive = globalTab === tab.id && !activeServerId;
						return (
							<button key={tab.id} onClick={() => { setGlobalTab(tab.id); setActiveServerId(null); }}
								className={`w-full flex items-center gap-4 px-5 py-3.5 rounded-2xl transition-all duration-300 ${
									isActive ? 'bg-indigo-500/10 text-indigo-400 font-bold shadow-[inset_0_0_20px_rgba(99,102,241,0.05)]' : 'text-zinc-500 hover:bg-zinc-900/50 hover:text-zinc-200'
								}`}>
								<Icon size={18} />
								<span>{tab.label}</span>
							</button>
						);
					})}
				</nav>
			</div>

			{activeServerId ? (
				<>
					<div className="px-4 mb-2">
						<button onClick={() => setActiveServerId(null)}
							className="w-full flex items-center gap-2 px-4 py-2 rounded-xl text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 transition-all text-sm font-medium border border-zinc-800">
							<ArrowLeft size={16} />
							Back to Servers
						</button>
					</div>
					<div className="px-6 mb-4">
						<div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Active Server</div>
						<div className="font-medium text-indigo-400 truncate">{activeServer?.name || 'Unknown'}</div>
					</div>
					<nav className="flex-1 px-4 space-y-1 overflow-y-auto">
						{tabs.map((tab) => {
							const Icon = tab.icon;
							const isActive = activeTab === tab.id;
							return (
								<button key={tab.id} onClick={() => setActiveTab(tab.id)}
									className={`w-full flex items-center gap-4 px-5 py-3 rounded-2xl transition-all duration-300 ${
										isActive ? 'bg-indigo-500/10 text-indigo-400 font-bold shadow-[inset_0_0_20px_rgba(99,102,241,0.05)]' : 'text-zinc-500 hover:bg-zinc-900/50 hover:text-zinc-200'
									}`}>
									<Icon size={18} />
									<span>{tab.label}</span>
								</button>
							);
						})}
					</nav>
				</>
			) : (
				<div className="flex-1" />
			)}

			<div className="p-4 border-t border-zinc-800 text-xs text-zinc-500 text-center shrink-0">
				MineManager v1.0.0
			</div>
		</div>
	);
}
