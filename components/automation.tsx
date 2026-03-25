import { useState } from 'react';
import { useStore } from '@/lib/store';
import { Zap, Plus, Trash2, Save, Loader2, Clock } from 'lucide-react';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function Automation() {
  const { activeServerId } = useStore();
  const [creatingRule, setCreatingRule] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [newRule, setNewRule] = useState({ name: '', trigger: 'player_join', action: 'command', actionPayload: '' });
  const [newTask, setNewTask] = useState({ name: '', cron: '0 0 * * *', action: 'restart', actionPayload: '', type: 'task' });

  const { data, error, isLoading, mutate } = useSWR(
    activeServerId ? `/api/servers/${activeServerId}/automation` : null,
    fetcher
  );

  const handleSaveRule = async () => {
    if (!activeServerId || !newRule.name) return;
    try {
      const res = await fetch(`/api/servers/${activeServerId}/automation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRule),
      });
      if (res.ok) {
        setCreatingRule(false);
        setNewRule({ name: '', trigger: 'player_join', action: 'command', actionPayload: '' });
        mutate();
      } else {
        alert('Failed to save rule');
      }
    } catch (e) {
      alert('Error saving rule');
    }
  };

  const handleSaveTask = async () => {
    if (!activeServerId || !newTask.name) return;
    try {
      const res = await fetch(`/api/servers/${activeServerId}/automation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTask),
      });
      if (res.ok) {
        setCreatingTask(false);
        setNewTask({ name: '', cron: '0 0 * * *', action: 'restart', actionPayload: '', type: 'task' });
        mutate();
      } else {
        alert('Failed to save task');
      }
    } catch (e) {
      alert('Error saving task');
    }
  };

  const handleDeleteRule = async (id: string) => {
    if (!activeServerId || !confirm('Delete this rule?')) return;
    try {
      const res = await fetch(`/api/servers/${activeServerId}/automation?id=${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        mutate();
      } else {
        alert('Failed to delete rule');
      }
    } catch (e) {
      alert('Error deleting rule');
    }
  };

  const handleDeleteTask = async (id: string) => {
    if (!activeServerId || !confirm('Delete this task?')) return;
    try {
      const res = await fetch(`/api/servers/${activeServerId}/automation?taskId=${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        mutate();
      } else {
        alert('Failed to delete task');
      }
    } catch (e) {
      alert('Error deleting task');
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Zap className="text-indigo-500" /> Automation & Tasks
          </h2>
          <p className="text-zinc-400 mt-1">Create rules and scheduled tasks to automate server management.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setCreatingTask(true)}
            className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors shadow-lg"
          >
            <Plus size={18} /> New Task
          </button>
          <button
            onClick={() => setCreatingRule(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors shadow-lg shadow-indigo-500/20"
          >
            <Plus size={18} /> New Rule
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Rules Section */}
        <div className="space-y-4">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Zap className="text-amber-400" size={20} /> Event Rules
          </h3>
          
          {creatingRule && (
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 space-y-4">
              <h4 className="font-bold">Create New Rule</h4>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Rule Name</label>
                  <input
                    type="text"
                    value={newRule.name}
                    onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                    placeholder="e.g., Welcome Message"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Trigger</label>
                  <select
                    value={newRule.trigger}
                    onChange={(e) => setNewRule({ ...newRule, trigger: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  >
                    <option value="player_join">Player Joins</option>
                    <option value="player_leave">Player Leaves</option>
                    <option value="server_start">Server Starts</option>
                    <option value="server_stop">Server Stops</option>
                    <option value="cpu_high">CPU &gt; 90%</option>
                    <option value="ram_high">RAM &gt; 90%</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Action</label>
                  <select
                    value={newRule.action}
                    onChange={(e) => setNewRule({ ...newRule, action: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  >
                    <option value="command">Execute Command</option>
                    <option value="restart">Restart Server</option>
                    <option value="stop">Stop Server</option>
                  </select>
                </div>

                {newRule.action === 'command' && (
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-1">Command Payload</label>
                    <input
                      type="text"
                      value={newRule.actionPayload}
                      onChange={(e) => setNewRule({ ...newRule, actionPayload: e.target.value })}
                      placeholder="e.g., say Hello {player}!"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
                <button
                  onClick={() => setCreatingRule(false)}
                  className="px-4 py-2 rounded-xl text-zinc-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveRule}
                  disabled={!newRule.name}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  <Save size={18} /> Save Rule
                </button>
              </div>
            </div>
          )}

          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="animate-spin text-indigo-500" size={32} />
              </div>
            ) : error ? (
              <div className="p-8 text-center text-rose-400">Failed to load rules.</div>
            ) : data?.rules?.length === 0 ? (
              <div className="text-center py-12 text-zinc-500">No event rules configured.</div>
            ) : (
              <div className="divide-y divide-zinc-800/50">
                {data?.rules?.map((rule: any) => (
                  <div key={rule.id} className="p-4 hover:bg-zinc-900/50 flex items-center justify-between transition-colors group">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-zinc-900 rounded-xl text-amber-400">
                        <Zap size={24} />
                      </div>
                      <div>
                        <h3 className="font-bold">{rule.name}</h3>
                        <p className="text-sm text-zinc-400">
                          When <span className="text-indigo-400 font-medium">{rule.trigger}</span> then <span className="text-emerald-400 font-medium">{rule.action}</span>
                          {rule.actionPayload && ` (${rule.actionPayload})`}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteRule(rule.id)}
                      className="opacity-0 group-hover:opacity-100 p-2 hover:bg-rose-500/10 hover:text-rose-400 rounded-lg transition-all"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Tasks Section */}
        <div className="space-y-4">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Clock className="text-sky-400" size={20} /> Scheduled Tasks
          </h3>
          
          {creatingTask && (
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 space-y-4">
              <h4 className="font-bold">Create New Task</h4>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Task Name</label>
                  <input
                    type="text"
                    value={newTask.name}
                    onChange={(e) => setNewTask({ ...newTask, name: e.target.value })}
                    placeholder="e.g., Daily Restart"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Cron Expression</label>
                  <input
                    type="text"
                    value={newTask.cron}
                    onChange={(e) => setNewTask({ ...newTask, cron: e.target.value })}
                    placeholder="e.g., 0 0 * * *"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 font-mono"
                  />
                  <p className="text-xs text-zinc-500 mt-1">Format: minute hour day month day-of-week</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Action</label>
                  <select
                    value={newTask.action}
                    onChange={(e) => setNewTask({ ...newTask, action: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  >
                    <option value="command">Execute Command</option>
                    <option value="restart">Restart Server</option>
                    <option value="stop">Stop Server</option>
                    <option value="backup">Create Backup</option>
                  </select>
                </div>

                {newTask.action === 'command' && (
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-1">Command Payload</label>
                    <input
                      type="text"
                      value={newTask.actionPayload}
                      onChange={(e) => setNewTask({ ...newTask, actionPayload: e.target.value })}
                      placeholder="e.g., say Server restarting in 5 minutes!"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
                <button
                  onClick={() => setCreatingTask(false)}
                  className="px-4 py-2 rounded-xl text-zinc-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveTask}
                  disabled={!newTask.name || !newTask.cron}
                  className="bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  <Save size={18} /> Save Task
                </button>
              </div>
            </div>
          )}

          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="animate-spin text-sky-500" size={32} />
              </div>
            ) : error ? (
              <div className="p-8 text-center text-rose-400">Failed to load tasks.</div>
            ) : data?.tasks?.length === 0 ? (
              <div className="text-center py-12 text-zinc-500">No scheduled tasks configured.</div>
            ) : (
              <div className="divide-y divide-zinc-800/50">
                {data?.tasks?.map((task: any) => (
                  <div key={task.id} className="p-4 hover:bg-zinc-900/50 flex items-center justify-between transition-colors group">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-zinc-900 rounded-xl text-sky-400">
                        <Clock size={24} />
                      </div>
                      <div>
                        <h3 className="font-bold">{task.name}</h3>
                        <p className="text-sm text-zinc-400">
                          Schedule: <span className="text-indigo-400 font-mono">{task.cron}</span> → <span className="text-emerald-400 font-medium">{task.action}</span>
                          {task.actionPayload && ` (${task.actionPayload})`}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteTask(task.id)}
                      className="opacity-0 group-hover:opacity-100 p-2 hover:bg-rose-500/10 hover:text-rose-400 rounded-lg transition-all"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
