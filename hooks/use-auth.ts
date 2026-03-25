'use client';

import useSWR from 'swr';
import { useHasPermission } from '@/hooks/use-permission';

export interface User {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    role: 'admin' | 'member';
    roles: string[];
    mc_username?: string | null;
    discord_username?: string;
    phone_number?: string | null;
    site_name?: string;
    avatar_url?: string | null;
}

const fetcher = (url: string) =>
    fetch(url).then(r => (r.ok ? r.json() : null));

export function useAuth() {
    const { data, error, isLoading, mutate } = useSWR<User | null>(
        '/api/auth/me',
        fetcher,
        {
            revalidateOnFocus: true,
            dedupingInterval: 10000,
        }
    );

    const hasRole = (role: string) => {
        if (!data) return false;
        return data.role === 'admin' || data.roles?.includes(role);
    };

    const hasAnyRole = (roles: string[]) => {
        if (!data) return false;
        if (data.role === 'admin') return true;
        return roles.some(r => data.roles?.includes(r));
    };

    const isAdmin = hasAnyRole(['owner', 'admin']);
    const isHelper = hasAnyRole(['helper']);
    const isGod = hasAnyRole(['god']);

    return {
        user: data,
        isLoading,
        error,
        isAuthenticated: !!data,
        hasRole,
        hasAnyRole,
        isAdmin,
        isHelper,
        isGod,
        refresh: mutate,
        useHasPermission,
    };
}
