'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '@/hooks/use-auth';
import { useServerStats } from '@/hooks/use-server-stats';
import { useSpacetimeDBStatus } from '@/hooks/use-spacetimedb';
import { Button } from '@/components/ui/button';
import { Badge, OnlineDot } from '@/components/ui/badge';
import {
    Menu, Bell, Search, Sun, Moon, LogOut, User,
    Settings, Shield, Activity
} from 'lucide-react';
import { useTheme } from '@/components/site/ThemeProvider';
import { clsx } from 'clsx';

interface HeaderProps {
    onMenuClick: () => void;
    sidebarCollapsed: boolean;
}

export function Header({ onMenuClick, sidebarCollapsed }: HeaderProps) {
    const pathname = usePathname();
    const { user, isAuthenticated, isAdmin } = useAuth();
    const { server } = useServerStats(isAuthenticated ? 10000 : 0);
    const { isRunning: stdbRunning } = useSpacetimeDBStatus();
    const { theme, toggle } = useTheme();
    const [searchOpen, setSearchOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 10);
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Close dropdowns on click outside
    useEffect(() => {
        const handleClick = () => {
            setProfileOpen(false);
            setSearchOpen(false);
        };
        document.addEventListener('click', handleClick);
        return () => document.removeEventListener('click', handleClick);
    }, []);

    const getPageTitle = () => {
        const segments = pathname.split('/').filter(Boolean);
        if (segments.length === 0) return 'Home';
        const last = segments[segments.length - 1];
        return last.charAt(0).toUpperCase() + last.slice(1).replace(/-/g, ' ');
    };

    return (
        <header
            className={clsx(
                'fixed top-0 right-0 z-20 h-16 flex items-center justify-between px-4 md:px-6 transition-all duration-300',
                scrolled ? 'bg-[#0A0E14]/90 backdrop-blur-xl border-b border-cyan-500/10' : 'bg-transparent',
                'left-0 lg:left-[260px]',
                sidebarCollapsed && 'lg:left-[72px]'
            )}
        >
            {/* Left */}
            <div className="flex items-center gap-4">
                <button
                    onClick={onMenuClick}
                    className="lg:hidden p-2 rounded-xl hover:bg-white/5 text-white/50 hover:text-white transition-colors"
                >
                    <Menu className="size-5" />
                </button>
                <div>
                    <h1 className="text-lg font-bold text-white">{getPageTitle()}</h1>
                </div>
            </div>

            {/* Right */}
            <div className="flex items-center gap-2">
                {/* Connection Status Pills */}
                <div className="hidden md:flex items-center gap-2 mr-2">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.03] border border-white/[0.06]">
                        <OnlineDot online={!!server} />
                        <span className="text-[10px] font-medium text-white/40">MC</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.03] border border-white/[0.06]">
                        <OnlineDot online={stdbRunning} />
                        <span className="text-[10px] font-medium text-white/40">STDB</span>
                    </div>
                </div>

                {/* Theme Toggle */}
                <button
                    onClick={toggle}
                    className="p-2 rounded-xl hover:bg-white/5 text-white/40 hover:text-white transition-colors"
                >
                    <motion.span
                        key={theme}
                        initial={{ rotate: -90, opacity: 0 }}
                        animate={{ rotate: 0, opacity: 1 }}
                        transition={{ duration: 0.3 }}
                    >
                        {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
                    </motion.span>
                </button>

                {/* Auth */}
                {isAuthenticated ? (
                    <div className="relative">
                        <button
                            onClick={(e) => { e.stopPropagation(); setProfileOpen(!profileOpen); }}
                            className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-white/5 transition-colors"
                        >
                            <div className="size-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/20 flex items-center justify-center overflow-hidden">
                                <img
                                    src={`https://mc-heads.net/avatar/${user?.mc_username || 'MHF_Steve'}/32`}
                                    alt=""
                                    className="size-6 rounded"
                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                />
                            </div>
                        </button>

                        <AnimatePresence>
                            {profileOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                                    transition={{ duration: 0.15 }}
                                    onClick={(e) => e.stopPropagation()}
                                    className="absolute right-0 top-full mt-2 w-64 bg-[#111620] border border-cyan-500/10 rounded-2xl shadow-2xl overflow-hidden"
                                >
                                    <div className="p-4 border-b border-white/[0.06]">
                                        <div className="font-bold text-white">{user?.site_name || user?.mc_username}</div>
                                        <div className="text-xs text-white/40 mt-0.5">{user?.email}</div>
                                        <div className="flex flex-wrap gap-1 mt-2">
                                            {user?.roles?.map(r => (
                                                <Badge key={r} variant={r === 'admin' || r === 'owner' ? 'success' : 'default'} size="sm">
                                                    {r}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="p-2">
                                        <Link href="/profile" className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 text-white/60 hover:text-white transition-colors text-sm">
                                            <User className="size-4" /> Profile
                                        </Link>
                                        {isAdmin && (
                                            <Link href="/admin" className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 text-white/60 hover:text-white transition-colors text-sm">
                                                <Shield className="size-4" /> Admin Panel
                                            </Link>
                                        )}
                                        <a href="/api/auth/logout" className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-red-500/10 text-red-400 transition-colors text-sm">
                                            <LogOut className="size-4" /> Logout
                                        </a>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                ) : (
                    <a href="/api/auth/login">
                        <Button size="sm">Login</Button>
                    </a>
                )}
            </div>
        </header>
    );
}
