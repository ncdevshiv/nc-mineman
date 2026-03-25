/**
 * Client-safe auth utilities — no next/headers, no fs, no database imports.
 * Exports permission-checking hooks for client components.
 */
export { useHasPermission, useHasAnyPermission } from '@/hooks/use-permission';
