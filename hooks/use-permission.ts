'use client';

import useSWR from 'swr';
import { useAuth } from '@/hooks/use-auth';

const fetcher = (url: string) =>
  fetch(url).then(r => (r.ok ? r.json() : []));

function usePermissions(): string[] {
  const { user } = useAuth();
  const { data } = useSWR<string[]>(
    user ? '/api/users/me/permissions' : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  );
  return data ?? [];
}

export function useHasPermission(permissionKey: string): boolean {
  const perms = usePermissions();
  return perms.includes(permissionKey);
}

export function useHasAnyPermission(permissionKeys: string[]): boolean {
  const perms = usePermissions();
  return permissionKeys.some(k => perms.includes(k));
}
