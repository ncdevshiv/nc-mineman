/**
 * Realtime client for subscribing to Server-Sent Events from the dashboard.
 *
 * Usage:
 *   import { subscribeToRealtime } from '@/lib/realtime';
 *
 *   const unsubscribe = subscribeToRealtime((snapshot) => {
 *     console.log(snapshot.servers);
 *   }, { interval: 3000 });
 *
 *   // Later:
 *   unsubscribe();
 */

export interface ServerSnapshot {
  id: string;
  name: string;
  status: string;
  cpu: number;
  ram: number;
  players: number;
  tps: number;
  playerList: string[];
}

export interface DashboardSnapshot {
  timestamp: string;
  servers: ServerSnapshot[];
  totalPlayers: number;
  totalServers: number;
}

export type SnapshotCallback = (snapshot: DashboardSnapshot) => void;

export interface RealtimeOptions {
  interval?: number;
  onError?: (error: Event) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export function subscribeToRealtime(
  callback: SnapshotCallback,
  options: RealtimeOptions = {}
): () => void {
  const interval = options.interval ?? 3000;
  const url = `/api/realtime?interval=${interval}`;

  let eventSource: EventSource | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  function connect() {
    if (stopped) return;

    eventSource = new EventSource(url);

    eventSource.onopen = () => {
      options.onConnect?.();
    };

    eventSource.onmessage = (event) => {
      try {
        const snapshot: DashboardSnapshot = JSON.parse(event.data);
        callback(snapshot);
      } catch {}
    };

    eventSource.onerror = () => {
      options.onError?.(new Event('error'));
      eventSource?.close();
      eventSource = null;

      if (!stopped) {
        options.onDisconnect?.();
        reconnectTimer = setTimeout(connect, 5000);
      }
    };
  }

  connect();

  return () => {
    stopped = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    eventSource?.close();
    eventSource = null;
  };
}
