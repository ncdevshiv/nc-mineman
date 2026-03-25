'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'motion/react';
import { useAuth } from '@/hooks/use-auth';
import { useServerStats } from '@/hooks/use-server-stats';
import { useSpacetimeDBStatus } from '@/hooks/use-spacetimedb';
import { OnlineDot } from '@/components/ui/badge';
import siteConfig from '@/lib/site.config';
import {
LayoutDashboard, Users, ShoppingCart, MessageSquare,
ArrowLeftRight, Shield, Eye, Settings, ChevronLeft,
ChevronRight, Server, Globe, UserCircle, BookOpen,
FileText, HelpCircle, Store, Package, Search, Palette
} from 'lucide-react';
import { clsx } from 'clsx';

interface SidebarProps {
    collapsed: boolean;
    onToggle: () => void;
}

interface NavItem {
    href: string;
    label: string;
    icon: React.ElementType;
    roles?: string[];
    badge?: string;
}

const mainNav: NavItem[] = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/status', label: 'Live Server', icon: Server },
    { href: '/profile', label: 'My Profile', icon: UserCircle },
    { href: '/players', label: 'Players', icon: Search },
    { href: '/social', label: 'Social', icon: Users },
    { href: '/inventory', label: 'Inventory', icon: Package },
    { href: '/trades', label: 'Trade Hub', icon: ArrowLeftRight },
    { href: '/tickets', label: 'Tickets', icon: MessageSquare },
];

const publicNav: NavItem[] = [
    { href: '/store', label: 'Store', icon: ShoppingCart },
];

const infoNav: NavItem[] = [
    { href: '/', label: 'Home', icon: Globe },
    { href: '/wiki', label: 'Wiki', icon: BookOpen },
    { href: '/rules', label: 'Rules', icon: FileText },
    { href: '/about', label: 'About', icon: HelpCircle },
];

const adminNav: NavItem[] = [
{ href: '/admin', label: 'Admin Panel', icon: Shield, roles: ['owner', 'admin'] },
{ href: '/admin/servers', label: 'Servers', icon: Server, roles: ['owner', 'admin'] },
{ href: '/admin/roles', label: 'Role Manager', icon: Settings, roles: ['owner', 'admin'] },
{ href: '/admin/branding', label: 'Branding', icon: Palette, roles: ['owner', 'admin'] },
{ href: '/admin/store', label: 'Store Editor', icon: Store, roles: ['owner', 'admin'] },
{ href: '/god', label: 'God View', icon: Eye, roles: ['owner', 'admin', 'god'] },
];

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
    const pathname = usePathname();
    const { user, hasAnyRole } = useAuth();
    const { server } = useServerStats(user ? 10000 : 0);
    const { isRunning: stdbRunning } = useSpacetimeDBStatus();

    // Only show authenticated links when user is loaded
    const isAuthenticated = !!user;

    const renderNavItems = (items: NavItem[]) => {
        return items
            .filter(item => !item.roles || hasAnyRole(item.roles))
            .map(item => {
                const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                const Icon = item.icon;

                return (
                    <Link key={item.href} href={item.href}>
                        <motion.div
                            whileHover={{ x: collapsed ? 0 : 4 }}
                            className={clsx(
                                'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative',
                                isActive
                                    ? 'bg-cyan-500/10 text-cyan-400'
                                    : 'text-white/50 hover:text-white/80 hover:bg-white/[0.03]'
                            )}
                        >
                            {isActive && (
                                <motion.div
                                    layoutId="sidebar-active"
                                    className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-cyan-400 rounded-full"
                                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                                />
                            )}
                            <Icon className={clsx('size-5 shrink-0', isActive && 'text-cyan-400')} />
                            {!collapsed && (
                                <motion.span
                                    initial={{ opacity: 0, x: -8 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="text-sm font-medium truncate"
                                >
                                    {item.label}
                                </motion.span>
                            )}
                            {item.badge && !collapsed && (
                                <span className="ml-auto text-[10px] font-bold bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded-full">
                                    {item.badge}
                                </span>
                            )}
                        </motion.div>
                    </Link>
                );
            });
    };

    return (
        <div
            className={clsx(
                'fixed left-0 top-0 bottom-0 z-30 flex flex-col bg-[#0A0E14]/95 backdrop-blur-xl border-r border-cyan-500/10 transition-all duration-300',
                collapsed ? 'w-[72px]' : 'w-[260px]'
            )}
        >
  {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 shrink-0">
        <div className="size-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center font-black text-white text-sm shadow-[0_0_20px_rgba(0,229,255,0.3)] shrink-0">
          {siteConfig.brand.logo.letter}
        </div>
        {!collapsed && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="truncate">
            <span className="font-bold text-white text-lg tracking-tight">{siteConfig.name.short}</span>
            <span className="text-cyan-400 font-bold text-lg">{siteConfig.name.full.replace(siteConfig.name.short, '')}</span>
          </motion.div>
        )}
                <button
                    onClick={onToggle}
                    className="ml-auto p-1.5 rounded-lg hover:bg-white/5 text-white/30 hover:text-white/60 transition-colors hidden lg:block"
                >
                    {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
                </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
                {/* Public nav - always visible */}
                {renderNavItems(publicNav)}

                {/* Authenticated nav - only when logged in */}
                {isAuthenticated && (
                    <>
                        {!collapsed && (
                            <div className="text-[10px] font-bold text-white/20 uppercase tracking-widest px-3 mb-2 mt-4">
                                Main
                            </div>
                        )}
                        {collapsed && <div className="my-4 mx-3 border-t border-white/[0.06]" />}
                        {renderNavItems(mainNav)}
                    </>
                )}

                {!collapsed && (
                    <div className="text-[10px] font-bold text-white/20 uppercase tracking-widest px-3 mb-2 mt-6">
                        Info
                    </div>
                )}
                {collapsed && isAuthenticated && <div className="my-4 mx-3 border-t border-white/[0.06]" />}
                {renderNavItems(infoNav)}

                {user && hasAnyRole(['owner', 'admin', 'god']) && (
                    <>
                        {!collapsed && (
                            <div className="text-[10px] font-bold text-white/20 uppercase tracking-widest px-3 mb-2 mt-6">
                                Admin
                            </div>
                        )}
                        {collapsed && <div className="my-4 mx-3 border-t border-white/[0.06]" />}
                        {renderNavItems(adminNav)}
                    </>
                )}
            </nav>

            {/* Connection Status */}
            <div className={clsx('px-3 py-4 border-t border-white/[0.06]', collapsed && 'px-2')}>
                <div className={clsx('space-y-2', collapsed && 'space-y-1')}>
                    <div className={clsx('flex items-center gap-2 text-xs', collapsed && 'justify-center')}>
                        <OnlineDot online={!!server} />
                        {!collapsed && (
                            <span className={server ? 'text-green-400' : 'text-white/30'}>
                                Minecraft API
                            </span>
                        )}
                    </div>
                    <div className={clsx('flex items-center gap-2 text-xs', collapsed && 'justify-center')}>
                        <OnlineDot online={stdbRunning} />
                        {!collapsed && (
                            <span className={stdbRunning ? 'text-green-400' : 'text-white/30'}>
                                Database
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* User */}
            {user && (
                <div className={clsx('px-3 py-3 border-t border-white/[0.06]', collapsed && 'px-2')}>
                    <div className={clsx('flex items-center gap-3', collapsed && 'justify-center')}>
                        <div className="size-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/20 flex items-center justify-center shrink-0">
                            <img
                                src={`https://mc-heads.net/avatar/${user.mc_username || 'MHF_Steve'}/32`}
                                alt=""
                                className="size-6 rounded"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                        </div>
                        {!collapsed && (
                            <div className="truncate">
                                <div className="text-sm font-medium text-white truncate">
                                    {user.site_name || user.mc_username || user.email}
                                </div>
                                <div className="text-[10px] text-white/30 truncate">{user.email}</div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
