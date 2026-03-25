'use client';

import { usePathname } from 'next/navigation';
import { Navbar } from '@/components/site/Navbar';
import { Footer } from '@/components/site/Footer';
import { AppShell } from '@/components/layout';
import { DebugPanel } from '@/components/ui/debug-panel';

// Pages that use the AppShell (authenticated dashboard layout)
// These are protected by middleware - unauthenticated users get redirected to login
const APP_SHELL_PAGES = [
  '/dashboard',
  '/profile',
  '/social',
  '/trades',
  '/tickets',
  '/inventory',
  '/players',
  '/god',
];

// Pages that use the public Navbar layout
// These are accessible to everyone
const PUBLIC_PAGES = [
  '/',
  '/about',
  '/contact',
  '/rules',
  '/wiki',
  '/disclaimer',
  '/signup',
  '/store',
  '/status',
];

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const useAppShell = APP_SHELL_PAGES.some(page =>
    pathname === page || pathname.startsWith(page + '/')
  );

  if (useAppShell) {
    // AppShell pages are always authenticated (middleware protects them)
    return (
      <AppShell>
        {children}
        <DebugPanel />
      </AppShell>
    );
  }

  // Public layout with Navbar
  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-emerald-600 focus:text-white focus:rounded-lg focus:outline-none"
      >
        Skip to main content
      </a>
      <Navbar />
      <main id="main-content" style={{ minHeight: '100vh', paddingTop: '80px' }}>
        {children}
      </main>
      <Footer />
    </>
  );
}
