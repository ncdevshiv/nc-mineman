'use client';

import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) {
    if (r.status === 403 || r.status === 401) return null;
    throw new Error(`HTTP ${r.status}`);
  }
  return r.json();
});

export interface SpacetimeDBStatus {
  running: boolean;
  tables: string[];
}

export function useSpacetimeDBStatus() {
  const { data, error, isLoading } = useSWR<SpacetimeDBStatus | null>(
    '/api/spacetimedb/status',
    fetcher,
    { refreshInterval: 30000, errorRetryCount: 1, revalidateOnFocus: false }
  );

  return {
    status: data,
    isRunning: data?.running ?? false,
    tables: data?.tables || [],
    isLoading,
    error,
  };
}

export function useSpacetimeDBQuery<T = any>(query: string, enabled = true) {
  const { data, error, isLoading, mutate } = useSWR<T[]>(
    enabled ? `/api/spacetimedb?query=${encodeURIComponent(query)}` : null,
    fetcher,
    { refreshInterval: 5000 }
  );

  return {
    data: data || [],
    isLoading,
    error,
    refresh: mutate,
  };
}
