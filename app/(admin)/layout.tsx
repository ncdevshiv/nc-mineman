'use client';

import { AppShell } from '@/components/layout';
import { DebugPanel } from '@/components/ui/debug-panel';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppShell>{children}</AppShell>
      <DebugPanel />
    </>
  );
}
