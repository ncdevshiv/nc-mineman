import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import crypto from 'crypto';
import archiver from 'archiver';
import AdmZip from 'adm-zip';
import pidusage from 'pidusage';
import * as cron from 'node-cron';
import { pipeline } from 'stream/promises';
import { rconPool } from './rcon';
import { downloadFile, getLatestBuild } from './papermc';
import * as stdb from './database';
import {
  setServerStatus, getServerStatus, getAllServersStatus,
  setPlayerOnline, setPlayerOffline, getOnlinePlayers, getTotalOnlineCount,
  pushMetric, getMetrics, publish
} from './redis';

const STDB_ENABLED = true; // SQLite is always enabled

function stdbErr(operation: string) {
  return (err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[ServerManager] Database ${operation}: ${msg}`);
  };
}

export type ServerStatus = 'stopped' | 'starting' | 'running' | 'stopping';

export interface ServerConfig {
  id: string;
  name: string;
  software: string;
  version: string;
  ram: string;
  cpuLimit?: number;
}

export interface AutomationRule {
  id: string;
  name: string;
  trigger: string;
  action: string;
  actionPayload?: string;
  enabled?: boolean;
  cooldownMs?: number;
}

export interface ScheduledTask {
  id: string;
  name: string;
  cron: string;
  action: string;
  actionPayload?: string;
  enabled?: boolean;
  type: 'task';
}

export class ServerInstance extends EventEmitter {
  public config: ServerConfig;
  public process: ChildProcess | null = null;
  public status: ServerStatus = 'stopped';
  public logs: string[] = [];
  public maxLogs = 1000;

  public metrics: { cpu: number; ram: number; time: string; players: number; tps: number }[] = [];
  private metricsInterval: NodeJS.Timeout | null = null;
  private tpsInterval: NodeJS.Timeout | null = null;
  public players: Set<string> = new Set();
  public tps: number = 20.0;

  public playerActivity: { time: string; player: string; action: string; details: string }[] = [];

  public serverDir: string;
  private jarPath: string;

  public automationRules: AutomationRule[] = [];
  private lastAutomationExecution: Record<string, number> = {};
  public scheduledTasks: ScheduledTask[] = [];
  private cronJobs: cron.ScheduledTask[] = [];

  private rconHost = '127.0.0.1';
  private rconPort = 25575;
  private rconPassword = '';
  private rconEnabled = false;

  constructor(config: ServerConfig) {
    super();
    this.config = { ...config, ram: config.ram || '2G', cpuLimit: config.cpuLimit || 100 };
    this.serverDir = path.join(process.cwd(), 'servers', config.id);
    this.jarPath = path.join(this.serverDir, 'server.jar');

    if (!fs.existsSync(this.serverDir)) {
      fs.mkdirSync(this.serverDir, { recursive: true });
    }
    this.loadServerProperties();
    this.loadAutomationRules();

    // Set initial server status in Redis (cross-instance state sharing)
    setServerStatus(this.config.id, {
      status: 'stopped',
      cpu: 0,
      ram: 0,
      players: 0,
      tps: 20,
      updatedAt: new Date().toISOString(),
    }).catch((err) => console.error(`[Redis] Failed to set initial server status: ${err.message}`));

    this.on('status', (status: string) => {
      if (STDB_ENABLED) {
        stdb.updateServerStatus(this.config.id, status).catch(stdbErr('updateServerStatus'));
      }
      // Update Redis status for cross-instance state sharing
      setServerStatus(this.config.id, {
        status,
        cpu: 0,
        ram: 0,
        players: this.players.size,
        tps: this.tps,
        updatedAt: new Date().toISOString(),
      }).catch((err) => console.error(`[Redis] Failed to update server status: ${err.message}`));
    });
  }

  private loadServerProperties() {
    const propsPath = path.join(this.serverDir, 'server.properties');
    if (fs.existsSync(propsPath)) {
      const content = fs.readFileSync(propsPath, 'utf-8');
      content.split('\n').forEach((line) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...valueParts] = line.split('=');
          const value = valueParts.join('=').trim();
          if (key === 'server-port') this.rconPort = parseInt(value) || 25565;
          if (key === 'enable-rcon' && value === 'true') this.rconEnabled = true;
          if (key === 'rcon.port') this.rconPort = parseInt(value) || 25575;
          if (key === 'rcon.password') this.rconPassword = value;
        }
      });
    }
  }

  public async getRconClient() {
    if (!this.rconEnabled || !this.rconPassword) return null;
    try {
      const client = rconPool.get(this.rconHost, this.rconPort, this.rconPassword);
      await client.send('');
      return client;
    } catch {
      return null;
    }
  }

  private startScheduler() {
    for (const job of this.cronJobs) {
      job.stop();
    }
    this.cronJobs = [];

    for (const task of this.scheduledTasks) {
      if (!task.enabled && task.enabled !== undefined) continue;
      if (task.cron && cron.validate(task.cron)) {
        const job = cron.schedule(task.cron, () => {
          this.addLog(`[Scheduler] Executing task: ${task.name}`);
          this.executeTaskAction(task);
        });
        this.cronJobs.push(job);
      } else {
        this.addLog(`[Scheduler] Invalid cron expression for task: ${task.name}`);
      }
    }
  }

  private async executeTaskAction(task: ScheduledTask) {
    if (task.action === 'command' && task.actionPayload) {
      await this.sendCommand(task.actionPayload);
    } else if (task.action === 'restart') {
      this.stop();
      setTimeout(() => this.start(), 3000);
    } else if (task.action === 'stop') {
      this.stop();
    } else if (task.action === 'backup') {
      this.createBackup(task.name);
    } else if (task.action === 'say' && task.actionPayload) {
      await this.sendCommand(`say ${task.actionPayload}`);
    }
  }

  public async createBackup(namePrefix: string = 'AutoBackup'): Promise<string | null> {
    const backupsDir = path.join(process.cwd(), 'backups', this.config.id);
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `${namePrefix}-${timestamp}.zip`;
    const backupPath = path.join(backupsDir, backupName);

    this.addLog(`[Backup] Creating backup: ${backupName}...`);

    return new Promise((resolve) => {
      const output = fs.createWriteStream(backupPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      let rejected = false;

      archive.on('error', (err) => {
        if (!rejected) {
          rejected = true;
          this.addLog(`[Backup] Error: ${err.message}`);
          fs.unlink(backupPath, () => {});
          resolve(null);
        }
      });

      output.on('close', () => {
        if (!rejected) {
          const size = fs.statSync(backupPath).size;
          this.addLog(`[Backup] Created ${backupName} (${(size / 1024 / 1024).toFixed(2)} MB)`);
          resolve(backupPath);
        }
      });

      archive.pipe(output);

      const excludeDirs = new Set(['backups', 'playit', '.restore_temp']);
      const items = fs.readdirSync(this.serverDir, { withFileTypes: true });
      for (const item of items) {
        if (excludeDirs.has(item.name)) continue;
        const itemPath = path.join(this.serverDir, item.name);
        if (item.isDirectory()) {
          archive.directory(itemPath, item.name);
        } else {
          archive.file(itemPath, { name: item.name });
        }
      }

      archive.finalize();
    });
  }

  public async restoreBackup(backupPath: string): Promise<boolean> {
    if (this.status !== 'stopped') {
      this.addLog('[Restore] Server must be stopped to restore a backup.');
      return false;
    }

    this.addLog(`[Restore] Starting restore from ${path.basename(backupPath)}...`);

    try {
      const tempDir = path.join(this.serverDir, '.restore_temp');
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
      fs.mkdirSync(tempDir, { recursive: true });

      const zip = new AdmZip(backupPath);
      zip.extractAllTo(tempDir, true);

      const excludeDirs = new Set(['backups', 'playit', '.restore_temp']);

      const items = fs.readdirSync(this.serverDir, { withFileTypes: true });
      for (const item of items) {
        if (excludeDirs.has(item.name)) continue;
        const itemPath = path.join(this.serverDir, item.name);
        if (item.isDirectory()) {
          fs.rmSync(itemPath, { recursive: true, force: true });
        } else {
          fs.unlinkSync(itemPath);
        }
      }

      const tempItems = fs.readdirSync(tempDir, { withFileTypes: true });
      for (const item of tempItems) {
        const srcPath = path.join(tempDir, item.name);
        const destPath = path.join(this.serverDir, item.name);
        if (item.isDirectory()) {
          this.copyDirectoryRecursive(srcPath, destPath);
        } else {
          fs.copyFileSync(srcPath, destPath);
        }
      }

      fs.rmSync(tempDir, { recursive: true, force: true });

      this.addLog('[Restore] Backup restored successfully. Restart the server to apply changes.');
      return true;
    } catch (err: any) {
      this.addLog(`[Restore] Error: ${err.message}`);
      return false;
    }
  }

  private copyDirectoryRecursive(src: string, dest: string) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    const items = fs.readdirSync(src, { withFileTypes: true });
    for (const item of items) {
      const srcPath = path.join(src, item.name);
      const destPath = path.join(dest, item.name);
      if (item.isDirectory()) {
        this.copyDirectoryRecursive(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  public loadAutomationRules() {
    const rulesPath = path.join(this.serverDir, 'automation.json');
    if (fs.existsSync(rulesPath)) {
      try {
        this.automationRules = JSON.parse(fs.readFileSync(rulesPath, 'utf-8'));
      } catch (e) {
        this.automationRules = [];
      }
    } else {
      this.automationRules = [];
    }

    const tasksPath = path.join(this.serverDir, 'tasks.json');
    if (fs.existsSync(tasksPath)) {
      try {
        this.scheduledTasks = JSON.parse(fs.readFileSync(tasksPath, 'utf-8'));
      } catch (e) {
        this.scheduledTasks = [];
      }
    } else {
      this.scheduledTasks = [];
    }

    this.startScheduler();
  }

  private addPlayerActivity(player: string, action: string, details: string) {
    const record = {
      time: new Date().toISOString(),
      player,
      action,
      details
    };
    this.playerActivity.unshift(record);
    if (this.playerActivity.length > 500) {
      this.playerActivity.pop();
    }
    if (STDB_ENABLED) {
      stdb.insertLog({
        server_id: this.config.id,
        level: action === 'kick' ? 'warn' : action === 'leave' ? 'info' : 'info',
        source: 'player',
        message: `${player} ${action}: ${details}`,
      }).catch(stdbErr('operation'));
    }
  }

  private executeAutomation(trigger: string, context: any = {}) {
    for (const rule of this.automationRules) {
      if (rule.trigger !== trigger) continue;
      if (rule.enabled === false) continue;

      const now = Date.now();
      const cooldown = rule.cooldownMs || 60000;
      if (this.lastAutomationExecution[rule.id] && now - this.lastAutomationExecution[rule.id] < cooldown) {
        continue;
      }
      this.lastAutomationExecution[rule.id] = now;

      this.addLog(`[Automation] Executing rule: ${rule.name} (trigger: ${trigger})`);
      if (rule.action === 'command' && rule.actionPayload) {
        let cmd = rule.actionPayload;
        if (context.player) cmd = cmd.replace(/\{player\}/g, context.player);
        if (context.count) cmd = cmd.replace(/\{count\}/g, String(context.count));
        this.sendCommand(cmd);
      } else if (rule.action === 'restart') {
        this.stop();
        setTimeout(() => this.start(), 3000);
      } else if (rule.action === 'stop') {
        this.stop();
      } else if (rule.action === 'say' && rule.actionPayload) {
        let msg = rule.actionPayload;
        if (context.player) msg = msg.replace(/\{player\}/g, context.player);
        this.sendCommand(`say ${msg}`);
      }
    }
  }

  public updateConfig(newConfig: Partial<ServerConfig>) {
    this.config = { ...this.config, ...newConfig };
    nodeManager.save();
    if (STDB_ENABLED) {
      stdb.upsertServer({
        id: this.config.id,
        name: this.config.name,
        software: this.config.software,
        version: this.config.version,
        ram: this.config.ram,
        cpu_limit: this.config.cpuLimit || 100,
        status: this.status,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).catch(stdbErr('operation'));
    }
  }

  public addLog(msg: string) {
    this.logs.push(msg);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    if (STDB_ENABLED) {
      const level = msg.includes('ERROR') || msg.includes('error') ? 'error'
        : msg.includes('WARN') || msg.includes('warn') ? 'warn'
        : 'info';
      stdb.insertLog({
        server_id: this.config.id,
        level,
        source: 'server',
        message: msg,
      }).catch(stdbErr('operation'));
    }

    const joinMatch = msg.match(/\[.*\]: (\w+) joined the game/);
    if (joinMatch) {
      this.players.add(joinMatch[1]);
      this.addPlayerActivity(joinMatch[1], 'join', 'Joined the game');
      this.executeAutomation('player_join', { player: joinMatch[1] });
      if (STDB_ENABLED) {
        stdb.setPlayerOnline(this.config.id, joinMatch[1], '', true).catch(stdbErr('operation'));
        stdb.startSession(this.config.id, joinMatch[1], '').catch(stdbErr('operation'));
      }
      // Redis: set player online and publish event for cross-instance sharing
      setPlayerOnline(this.config.id, joinMatch[1]).catch((err) => console.error(`[Redis] Player online error: ${err.message}`));
      publish('player_join', {
        serverId: this.config.id,
        player: joinMatch[1],
        timestamp: Date.now(),
      }).catch((err) => console.error(`[Redis] Publish player_join error: ${err.message}`));
      // Update server status with new player count
      setServerStatus(this.config.id, {
        status: this.status,
        cpu: 0,
        ram: 0,
        players: this.players.size,
        tps: this.tps,
        updatedAt: new Date().toISOString(),
      }).catch((err) => console.error(`[Redis] Failed to update server status: ${err.message}`));
    }
    const leaveMatch = msg.match(/\[.*\]: (\w+) lost connection: (.*)/);
    if (leaveMatch) {
      this.players.delete(leaveMatch[1]);
      this.addPlayerActivity(leaveMatch[1], 'leave', `Lost connection: ${leaveMatch[2]}`);
      this.executeAutomation('player_leave', { player: leaveMatch[1] });
      if (STDB_ENABLED) {
        stdb.setPlayerOnline(this.config.id, leaveMatch[1], '', false).catch(stdbErr('operation'));
        stdb.endSession(this.config.id, leaveMatch[1]).catch(stdbErr('operation'));
      }
      // Redis: set player offline and publish event for cross-instance sharing
      setPlayerOffline(this.config.id, leaveMatch[1]).catch((err) => console.error(`[Redis] Player offline error: ${err.message}`));
      publish('player_leave', {
        serverId: this.config.id,
        player: leaveMatch[1],
        reason: leaveMatch[2],
        timestamp: Date.now(),
      }).catch((err) => console.error(`[Redis] Publish player_leave error: ${err.message}`));
      // Update server status with new player count
      setServerStatus(this.config.id, {
        status: this.status,
        cpu: 0,
        ram: 0,
        players: this.players.size,
        tps: this.tps,
        updatedAt: new Date().toISOString(),
      }).catch((err) => console.error(`[Redis] Failed to update server status: ${err.message}`));
    }
    const kickMatch = msg.match(/\[.*\]: (\w+) was kicked: (.*)/);
    if (kickMatch) {
      this.players.delete(kickMatch[1]);
      this.addPlayerActivity(kickMatch[1], 'kick', `Kicked: ${kickMatch[2]}`);
      this.executeAutomation('player_kick', { player: kickMatch[1] });
      if (STDB_ENABLED) {
        stdb.setPlayerOnline(this.config.id, kickMatch[1], '', false).catch(stdbErr('operation'));
        stdb.endSession(this.config.id, kickMatch[1]).catch(stdbErr('operation'));
      }
      // Redis: set player offline and publish event for cross-instance sharing
      setPlayerOffline(this.config.id, kickMatch[1]).catch((err) => console.error(`[Redis] Player offline error: ${err.message}`));
      publish('player_kick', {
        serverId: this.config.id,
        player: kickMatch[1],
        reason: kickMatch[2],
        timestamp: Date.now(),
      }).catch((err) => console.error(`[Redis] Publish player_kick error: ${err.message}`));
      // Update server status with new player count
      setServerStatus(this.config.id, {
        status: this.status,
        cpu: 0,
        ram: 0,
        players: this.players.size,
        tps: this.tps,
        updatedAt: new Date().toISOString(),
      }).catch((err) => console.error(`[Redis] Failed to update server status: ${err.message}`));
    }
    const chatMatch = msg.match(/\[.*\]: <(\w+)> (.*)/);
    if (chatMatch) {
      this.addPlayerActivity(chatMatch[1], 'chat', chatMatch[2]);
      this.executeAutomation('player_chat', { player: chatMatch[1], message: chatMatch[2] });
    }
    const cmdMatch = msg.match(/\[.*\]: (\w+) issued server command: (.*)/);
    if (cmdMatch) {
      this.addPlayerActivity(cmdMatch[1], 'command', cmdMatch[2]);
      this.executeAutomation('player_command', { player: cmdMatch[1], command: cmdMatch[2] });
    }
    const tpsMatch = msg.match(/(?:TPS from last 1m, 5m, 15m|Mean tick time).*?\*?([\d.]+)/)
      || msg.match(/TPS[^\d]*([\d.]+)/);
    if (tpsMatch) {
      this.tps = parseFloat(tpsMatch[1]);
    }
    const tickMatch = msg.match(/Mean tick time[^\d]*([\d.]+)ms/);
    if (tickMatch) {
      const tickMs = parseFloat(tickMatch[1]);
      this.tps = Math.min(20, Math.round((1000 / tickMs) * 100) / 100);
    }

    this.emit('log', msg);
  }

  private async queryTps() {
    if (this.status !== 'running') return;
    if (this.process && this.process.stdin) {
      this.process.stdin.write('tps\n');
    }
  }

  private startTpsQuerying() {
    if (this.tpsInterval) clearInterval(this.tpsInterval);
    this.tpsInterval = setInterval(() => {
      this.queryTps();
    }, 15000);
  }

  private startMetrics() {
    if (this.metricsInterval) clearInterval(this.metricsInterval);
    this.metrics = [];
    this.players.clear();
    this.tps = 20.0;

    this.startTpsQuerying();

    this.metricsInterval = setInterval(async () => {
      if (this.process?.pid && this.status === 'running' && this.process.exitCode === null) {
        try {
          const stats = await pidusage(this.process.pid);
          const metric = {
            cpu: Math.round(stats.cpu * 10) / 10,
            ram: Math.round(stats.memory / 1024 / 1024),
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            players: this.players.size,
            tps: this.tps
          };
          this.metrics.push(metric);
          if (this.metrics.length > 60) this.metrics.shift();
          this.emit('metrics', metric);
          if (STDB_ENABLED) {
            stdb.insertMetric({
              server_id: this.config.id,
              cpu: metric.cpu,
              ram: metric.ram,
              players: metric.players,
              tps: metric.tps,
            }).catch(stdbErr('operation'));
          }

          // Push metric to Redis for cross-instance state sharing
          pushMetric(this.config.id, {
            cpu: metric.cpu,
            ram: metric.ram,
            players: metric.players,
            tps: metric.tps,
            time: metric.time,
          }).catch((err) => console.error(`[Redis] Push metric error: ${err.message}`));

          if (metric.cpu > 90) this.executeAutomation('cpu_high', { cpu: metric.cpu });

          let maxRamMB = 2048;
          if (this.config.ram.endsWith('G')) {
            maxRamMB = parseInt(this.config.ram) * 1024;
          } else if (this.config.ram.endsWith('M')) {
            maxRamMB = parseInt(this.config.ram);
          }
          if (metric.ram > maxRamMB * 0.9) this.executeAutomation('ram_high', { ram: metric.ram });
        } catch (err: any) {
          if (err.message?.includes('No matching pid found')) {
            this.stopMetrics();
          }
        }
      }
    }, 3000);
  }

  private stopMetrics() {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
    if (this.tpsInterval) {
      clearInterval(this.tpsInterval);
      this.tpsInterval = null;
    }
  }

  public async sendCommand(cmd: string): Promise<void> {
    if (this.process && this.process.stdin) {
      this.addLog(`> ${cmd}`);
      this.process.stdin.write(cmd + '\n');
    } else if (this.rconEnabled && this.rconPassword) {
      try {
        const client = await this.getRconClient();
        if (client) {
          const response = await client.send(cmd);
          if (response) {
            response.split('\n').forEach((line: string) => {
              if (line.trim()) this.addLog(`[RCON] ${line}`);
            });
          }
        } else {
          this.addLog('[Manager] RCON unavailable.');
        }
      } catch {
        this.addLog('[Manager] RCON command failed.');
      }
    } else {
      this.addLog('[Manager] Server is not running.');
    }
  }

  public async start() {
    if (this.status !== 'stopped') return;

    if (!fs.existsSync(this.jarPath)) {
      this.addLog('[Manager] server.jar not found. Downloading selected software...');
      const downloaded = await this.ensureLatestJar();
      if (!downloaded) {
        this.addLog('[Manager] Download failed. Please download software first.');
        return;
      }
      this.addLog('[Manager] Download complete. Starting server...');
    }

    fs.writeFileSync(path.join(this.serverDir, 'eula.txt'), 'eula=true\n');

    // Optional: proxy forwarding autoconfig (disabled unless explicitly opted-in)
    if (process.env.FORCE_VELOCITY_AUTOCONFIG === 'true') {
      this.ensureVelocityForwarding();
    }

    this.status = 'starting';
    this.emit('status', this.status);
    this.addLog('[Manager] Starting server...');

    this.loadServerProperties();

    try {
      const args = ['-Xms' + this.config.ram, '-Xmx' + this.config.ram];
      if (this.config.cpuLimit) {
        args.push(`-XX:ActiveProcessorCount=${Math.max(1, Math.ceil(this.config.cpuLimit / 100))}`);
      }
      args.push('-jar', 'server.jar', 'nogui');

      this.process = spawn('java', args, {
        cwd: this.serverDir,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      this.startMetrics();

      this.process.stdout?.on('data', (data) => {
        const str = data.toString().trim();
        if (str) {
          str.split('\n').forEach((line: string) => {
            this.addLog(line);
            const lower = line.toLowerCase();
            const isVelocity = this.config.software?.toLowerCase().includes('velocity');
            const vanillaReady = line.includes('Done (') && line.includes(')! For help, type "help"');
            const velocityReady = isVelocity && (
              lower.includes('ready to accept connections') ||
              lower.includes('listening on') ||
              lower.includes('bound to') ||
              lower.includes('done (')
            );
            if ((vanillaReady || velocityReady) && this.status !== 'running') {
              this.status = 'running';
              this.emit('status', this.status);
              this.executeAutomation('server_start');
              // Publish server_start event for cross-instance sharing
              publish('server_start', {
                serverId: this.config.id,
                timestamp: Date.now(),
              }).catch((err) => console.error(`[Redis] Publish server_start error: ${err.message}`));
            }
          });
        }
      });

      this.process.stderr?.on('data', (data) => {
        const str = data.toString().trim();
        if (str) {
          str.split('\n').forEach((line: string) => this.addLog(line));
        }
      });

      this.process.on('close', (code) => {
        this.addLog(`[Manager] Server process exited with code ${code}`);
        this.status = 'stopped';
        this.process = null;
        this.stopMetrics();
        this.emit('status', this.status);
        this.executeAutomation('server_stop');
        // Publish server_stop event for cross-instance sharing
        publish('server_stop', {
          serverId: this.config.id,
          exitCode: code,
          timestamp: Date.now(),
        }).catch((err) => console.error(`[Redis] Publish server_stop error: ${err.message}`));
      });

      this.process.on('error', (err) => {
        this.addLog(`[Manager] Failed to start server: ${err.message}. Is Java installed?`);
        this.status = 'stopped';
        this.process = null;
        this.stopMetrics();
        this.emit('status', this.status);
      });
    } catch (err: any) {
      this.addLog(`[Manager] Exception starting server: ${err.message}`);
      this.status = 'stopped';
      this.emit('status', this.status);
    }
  }

  private async ensureLatestJar(): Promise<boolean> {
    try {
      const latestBuild = await getLatestBuild(this.config.software, this.config.version);
      if (!latestBuild) {
        this.addLog('[Manager] Could not determine latest build for selected version.');
        return false;
      }
      const downloadUrl = `https://api.papermc.io/v2/projects/${this.config.software}/versions/${this.config.version}/builds/${latestBuild}/downloads/${this.config.software}-${this.config.version}-${latestBuild}.jar`;
      await downloadFile(downloadUrl, this.jarPath);
      return true;
    } catch (error: any) {
      this.addLog(`[Manager] Download failed: ${error.message}`);
      return false;
    }
  }

  public stop() {
    if (this.status === 'stopped') return;
    this.status = 'stopping';
    this.emit('status', this.status);
    this.addLog('[Manager] Stopping server...');
    if (this.process && this.process.stdin) {
      this.process.stdin.write('stop\n');
    } else {
      this.process?.kill();
    }
  }

  public killProcess() {
    if (this.process) {
      try {
        this.process.kill('SIGKILL');
      } catch {
        this.process.kill();
      }
      this.process = null;
    }
    this.stopMetrics();
    this.status = 'stopped';
    this.emit('status', this.status);
    this.addLog('[Manager] Process killed.');
  }

  public async downloadSoftware(url: string) {
    this.addLog(`[Manager] Downloading software from ${url}...`);
    return new Promise<void>((resolve, reject) => {
      const file = fs.createWriteStream(this.jarPath);
      const request = url.startsWith('https') ? https : http;

      request.get(url, (response) => {
        if (response.statusCode !== 200) {
          file.close();
          fs.unlink(this.jarPath, () => {});
          reject(new Error(`Failed to download: ${response.statusCode}`));
          return;
        }
        pipeline(response, file).then(() => {
          this.addLog('[Manager] Download complete.');
          resolve();
        }).catch(reject);
      }).on('error', (err) => {
        file.close();
        fs.unlink(this.jarPath, () => {});
        this.addLog(`[Manager] Download failed: ${err.message}`);
        reject(err);
      });
    });
  }

  public async installPlugin(url: string, filename: string) {
    if (!filename || !filename.endsWith('.jar')) {
      throw new Error('Invalid plugin filename');
    }

    const safePath = this.getSafePath(path.join('/plugins', filename));
    fs.mkdirSync(path.dirname(safePath), { recursive: true });
    this.addLog(`[Manager] Downloading plugin ${filename}...`);

    const doDownload = async (downloadUrl: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        const request = downloadUrl.startsWith('https') ? https : http;
        const file = fs.createWriteStream(safePath);

        const handleError = (err: Error) => {
          file.close();
          fs.unlink(safePath, () => {});
          this.addLog(`[Manager] Plugin download failed: ${err.message}`);
          reject(err);
        };

        request.get(downloadUrl, { headers: { 'User-Agent': 'MineManager/1.0' } }, (response) => {
          if (response.statusCode === 301 || response.statusCode === 302) {
            const nextLocation = response.headers.location;
            file.close();
            fs.unlink(safePath, () => {});
            if (nextLocation) {
              const resolved = nextLocation.startsWith('http')
                ? nextLocation
                : new URL(nextLocation, downloadUrl).toString();
              this.addLog(`[Manager] Plugin redirect ${response.statusCode} -> ${resolved}`);
              doDownload(resolved).then(resolve).catch(reject);
            } else {
              handleError(new Error('Redirect without location header'));
            }
            return;
          }

          if (response.statusCode !== 200) {
            handleError(new Error(`Failed to download plugin: ${response.statusCode} from ${downloadUrl}`));
            return;
          }

          pipeline(response, file)
            .then(() => {
              this.addLog(`[Manager] Plugin ${filename} installed.`);
              resolve();
            })
            .catch(handleError);
        }).on('error', handleError);
      });
    };

    await doDownload(url);
  }

  private ensureVelocityForwarding() {
    const secret = process.env.VELOCITY_SECRET;
    if (!secret) {
      this.addLog('[Manager] VELOCITY_SECRET not configured. Skipping Velocity forwarding setup.');
      return;
    }
    const secretFilePath = path.join(this.serverDir, 'forwarding.secret');
    fs.writeFileSync(secretFilePath, secret);
    const isVelocity = this.config.software?.toLowerCase().includes('velocity');
    const isPaperLike = this.config.software?.toLowerCase().includes('paper') || this.config.software?.toLowerCase().includes('folia');

    if (isVelocity) {
      const velocityPath = path.join(this.serverDir, 'velocity.toml');
      if (fs.existsSync(velocityPath)) {
        let content = fs.readFileSync(velocityPath, 'utf-8');
        if (!content.includes('player-info-forwarding-mode')) {
          content += '\nplayer-info-forwarding-mode = "modern"\n';
        } else {
          content = content.replace(/player-info-forwarding-mode\s*=\s*"[^"]*"/i, 'player-info-forwarding-mode = "modern"');
        }
        if (content.includes('forwarding-secret-file')) {
          content = content.replace(/forwarding-secret-file\s*=\s*"[^"]*"/i, `forwarding-secret-file = "${secretFilePath.replace(/\\/g, '/')}"`);
        } else if (content.includes('forwarding-secret')) {
          content = content.replace(/forwarding-secret\s*=\s*"[^"]*"/i, `forwarding-secret = "${secret}"`);
        } else {
          content += `\nforwarding-secret-file = "${secretFilePath.replace(/\\/g, '/')}"\n`;
        }
        fs.writeFileSync(velocityPath, content);
        this.addLog('[Manager] Velocity forwarding configured for proxy.');
      }
      return;
    }

    if (isPaperLike) {
      // server.properties: set online-mode false for proxy use, disable secure profiles for compatibility
      const propsPath = path.join(this.serverDir, 'server.properties');
      if (fs.existsSync(propsPath)) {
        let props = fs.readFileSync(propsPath, 'utf-8');
        const setProp = (key: string, value: string) => {
          if (props.match(new RegExp(`^${key}=`, 'm'))) {
            props = props.replace(new RegExp(`^${key}=.*`, 'm'), `${key}=${value}`);
          } else {
            props += `\n${key}=${value}`;
          }
        };
        // Velocity modern forwarding expects backend online-mode true but secure profiles off
        setProp('online-mode', 'true');
        setProp('enforce-secure-profiles', 'false');
        fs.writeFileSync(propsPath, props);
      }

      // paper-global.yml velocity-support block
      const paperDir = path.join(this.serverDir, 'config');
      if (!fs.existsSync(paperDir)) fs.mkdirSync(paperDir, { recursive: true });
      const paperGlobalPath = path.join(paperDir, 'paper-global.yml');
      let yaml = '';
      if (fs.existsSync(paperGlobalPath)) {
        yaml = fs.readFileSync(paperGlobalPath, 'utf-8');
      }
      const velocityBlock = `velocity-support:\n  enabled: true\n  online-mode: true\n  secret: ${secret}\n`;
      if (yaml.includes('velocity-support')) {
        yaml = yaml.replace(/velocity-support:[\s\S]*?(?=^[^\s]|\n?$)/m, velocityBlock);
      } else {
        yaml += `\n${velocityBlock}`;
      }
      fs.writeFileSync(paperGlobalPath, yaml.trim() + '\n');
      this.addLog('[Manager] Velocity forwarding configured for backend (Paper/Folia).');
    }
  }

  public getSafePath(targetPath: string) {
    const cleaned = targetPath.replace(/^([/\\])+/g, '');
    const safePath = path.normalize(path.join(this.serverDir, cleaned));
    if (!safePath.startsWith(this.serverDir)) {
      throw new Error('Invalid path');
    }
    return safePath;
  }
}

export class NodeManager {
  public servers: Map<string, ServerInstance> = new Map();
  private dataPath = path.join(process.cwd(), 'servers.json');

  constructor() {
    if (!fs.existsSync(path.join(process.cwd(), 'servers'))) {
      fs.mkdirSync(path.join(process.cwd(), 'servers'), { recursive: true });
    }
    this.load();
  }

  private load() {
    if (fs.existsSync(this.dataPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(this.dataPath, 'utf-8'));
        for (const conf of data) {
          this.servers.set(conf.id, new ServerInstance(conf));
        }
      } catch (err: any) {
        console.error(`[ServerManager] Failed to load servers.json: ${err.message}`);
      }
    }
    if (STDB_ENABLED) {
      this.syncFromDatabase().catch(stdbErr('syncFromDatabase'));
    }
  }

  private async syncFromDatabase() {
    try {
      const dbServers = await stdb.getAllServers();
      for (const rec of dbServers) {
        if (!this.servers.has(rec.id)) {
          this.servers.set(rec.id, new ServerInstance({
            id: rec.id,
            name: rec.name,
            software: rec.software,
            version: rec.version,
            ram: rec.ram,
            cpuLimit: rec.cpu_limit,
          }));
        }
      }
    } catch (err: any) {
      console.error(`[ServerManager] Database sync error: ${err.message}`);
    }
  }

  public save() {
    const data = Array.from(this.servers.values()).map(s => s.config);
    fs.writeFileSync(this.dataPath, JSON.stringify(data, null, 2));
  }

  public createServer(name: string, software: string, version: string) {
    const id = crypto.randomUUID();
    const config = { id, name, software, version, ram: '2G' };
    const instance = new ServerInstance(config);
    this.servers.set(id, instance);
    this.save();
    if (STDB_ENABLED) {
      stdb.upsertServer({
        id,
        name,
        software,
        version,
        ram: '2G',
        cpu_limit: 100,
        status: 'stopped',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).catch(stdbErr('operation'));
    }
    return instance;
  }

  public deleteServer(id: string): boolean {
    const instance = this.servers.get(id);
    if (!instance) return false;

    try {
      instance.killProcess();
      fs.rmSync(path.join(process.cwd(), 'servers', id), { recursive: true, force: true });
      fs.rmSync(path.join(process.cwd(), 'backups', id), { recursive: true, force: true });
      this.servers.delete(id);
      this.save();
      if (STDB_ENABLED) {
        stdb.deleteServer(id).catch(stdbErr('operation'));
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  public getServer(id: string) {
    return this.servers.get(id);
  }

  /**
   * Sync all server states to Redis for cross-instance state sharing
   */
  public async syncToRedis(): Promise<void> {
    try {
      for (const [serverId, instance] of this.servers) {
        await setServerStatus(serverId, {
          status: instance.status,
          cpu: instance.metrics.length > 0 ? instance.metrics[instance.metrics.length - 1].cpu : 0,
          ram: instance.metrics.length > 0 ? instance.metrics[instance.metrics.length - 1].ram : 0,
          players: instance.players.size,
          tps: instance.tps,
          updatedAt: new Date().toISOString(),
        });
      }
      console.log('[ServerManager] Synced server states to Redis');
    } catch (err: any) {
      console.error(`[ServerManager] Redis sync error: ${err.message}`);
    }
  }
}

const globalForNodeManager = global as unknown as { nodeManager: NodeManager };
export const nodeManager = globalForNodeManager.nodeManager || new NodeManager();
if (process.env.NODE_ENV !== 'production') globalForNodeManager.nodeManager = nodeManager;
