'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion, useInView, AnimatePresence } from 'motion/react';
import { useServerStats } from '@/hooks/use-server-stats';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import siteConfig from '@/lib/site.config';
import {
    Server, Users, Zap, Shield, ArrowRight, Copy, Check,
    Sparkles, Globe, MessageSquare, ShoppingCart, ArrowLeftRight,
    ChevronDown, Play, Pause, Cpu, HardDrive, Wifi, Clock
} from 'lucide-react';

function ServerIPBadge() {
    const [copied, setCopied] = useState(false);
    const ip = siteConfig.brand.serverIp;

    const copy = async () => {
        try { await navigator.clipboard.writeText(ip); } catch { }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <motion.button
            onClick={copy}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="relative flex items-center gap-4 bg-[#0A0E14]/80 backdrop-blur-xl px-8 py-5 rounded-xl border border-cyan-500/20 hover:border-cyan-500/50 transition-all group"
        >
            <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-xl blur opacity-0 group-hover:opacity-100 transition duration-500 pointer-events-none" />
            <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-cyan-400/50 rounded-tl-lg" />
            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-cyan-400/50 rounded-br-lg" />

            <span className="relative text-white font-bold text-lg font-mono tracking-wider">{ip}</span>
            <div className="relative h-6 w-px bg-cyan-500/30" />
            <span className="relative text-cyan-400 font-bold text-sm uppercase tracking-wider flex items-center gap-1.5">
                {copied ? (
                    <><Check className="size-4" /> Copied</>
                ) : (
                    <><Copy className="size-4" /> Copy IP</>
                )}
            </span>
        </motion.button>
    );
}

function FloatingParticles() {
    const [particles, setParticles] = useState<any[]>([]);

    useEffect(() => {
        setParticles(Array.from({ length: 30 }, (_, i) => ({
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animationDuration: `${10 + Math.random() * 20}s`,
            animationDelay: `${Math.random() * 10}s`,
            size: 2 + Math.random() * 3,
            opacity: 0.1 + Math.random() * 0.3,
        })));
    }, []);

    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {particles.map((p, i) => (
                <div
                    key={i}
                    className="absolute rounded-full bg-cyan-400"
                    style={{
                        left: p.left,
                        top: p.top,
                        width: p.size,
                        height: p.size,
                        animation: `float-particle ${p.animationDuration} linear ${p.animationDelay} infinite`,
                        opacity: p.opacity,
                    }}
                />
            ))}
        </div>
    );
}

function AnimatedSection({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
    const ref = useRef<HTMLDivElement>(null);
    const isInView = useInView(ref, { once: true, margin: '-80px' });

    return (
        <motion.div
            ref={ref}
            initial={{ opacity: 0, y: 40 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
            className={className}
        >
            {children}
        </motion.div>
    );
}

function FeatureCard({ icon: Icon, title, description, color, delay }: {
    icon: React.ElementType;
    title: string;
    description: string;
    color: string;
    delay: number;
}) {
    const colorMap: Record<string, { bg: string; border: string; icon: string }> = {
        cyan: { bg: 'bg-cyan-500/5', border: 'border-cyan-500/20 hover:border-cyan-500/40', icon: 'text-cyan-400' },
        amber: { bg: 'bg-amber-500/5', border: 'border-amber-500/20 hover:border-amber-500/40', icon: 'text-amber-400' },
        purple: { bg: 'bg-purple-500/5', border: 'border-purple-500/20 hover:border-purple-500/40', icon: 'text-purple-400' },
        green: { bg: 'bg-green-500/5', border: 'border-green-500/20 hover:border-green-500/40', icon: 'text-green-400' },
        red: { bg: 'bg-red-500/5', border: 'border-red-500/20 hover:border-red-500/40', icon: 'text-red-400' },
    };

    const styles = colorMap[color] || colorMap.cyan;

    return (
        <AnimatedSection delay={delay}>
            <motion.div
                whileHover={{ y: -4, scale: 1.01 }}
                className={`hud-card p-6 h-full ${styles.border}`}
            >
                <div className={`size-12 rounded-lg ${styles.bg} flex items-center justify-center mb-4`}>
                    <Icon className={`size-6 ${styles.icon}`} />
                </div>
                <h3 className="text-lg font-bold text-white mb-2 tracking-wider">{title}</h3>
                <p className="text-sm text-white/40 leading-relaxed">{description}</p>
            </motion.div>
        </AnimatedSection>
    );
}

function StatDisplay({ icon: Icon, label, value, color, delay }: {
    icon: React.ElementType;
    label: string;
    value: string;
    color: string;
    delay: number;
}) {
    const colorMap: Record<string, string> = {
        cyan: 'text-cyan-400',
        amber: 'text-amber-400',
        green: 'text-green-400',
        purple: 'text-purple-400',
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay }}
            className="text-center"
        >
            <Icon className={`size-8 mx-auto mb-3 ${colorMap[color]} opacity-60`} />
            <div className="text-3xl md:text-4xl font-black text-white mb-1 data-value">{value}</div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-white/30">{label}</div>
        </motion.div>
    );
}

export default function LandingPage() {
    const { server } = useServerStats(10000);
    const { isAuthenticated } = useAuth();

    return (
        <>
            {/* Hero */}
            <section className="relative min-h-[100vh] flex items-center justify-center overflow-hidden">
                {/* Background Effects */}
                <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 via-transparent to-transparent pointer-events-none" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(0,229,255,0.08),transparent_60%)] pointer-events-none" />
                <div className="absolute inset-0 grid-bg pointer-events-none opacity-30" />
                <FloatingParticles />

                {/* Corner Decorations */}
                <div className="absolute top-0 left-0 w-32 h-32 border-l-2 border-t-2 border-cyan-500/20 rounded-tl-3xl pointer-events-none" />
                <div className="absolute top-0 right-0 w-32 h-32 border-r-2 border-t-2 border-cyan-500/20 rounded-tr-3xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-32 h-32 border-l-2 border-b-2 border-cyan-500/20 rounded-bl-3xl pointer-events-none" />
                <div className="absolute bottom-0 right-0 w-32 h-32 border-r-2 border-b-2 border-cyan-500/20 rounded-br-3xl pointer-events-none" />

                <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.8 }}
                    >
                        <Badge variant="success" size="md" pulse className="mb-8 inline-flex">
                            <Sparkles className="size-3 mr-1.5" />
                            Free To Play • Powered by SrishtiPlayz
                        </Badge>

                        <h1 className="text-5xl md:text-7xl lg:text-[5.5rem] font-black tracking-tight mb-6 leading-[1.05]">
                            <span className="text-white">Redefining the</span>
                            <br />
                            <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent text-glow-cyan">
                                SMP Experience
                            </span>
                        </h1>

                        <p className="max-w-2xl mx-auto text-lg md:text-xl text-white/40 mb-12 leading-relaxed">
                            Join a world where jaw-dropping performance meets limitless creativity.
                            Blazing fast hardware, real-time web dashboard, and a community that actually matters.
                        </p>

                        <div className="flex flex-col md:flex-row items-center justify-center gap-6">
                            <ServerIPBadge />
                            {isAuthenticated ? (
                                <Link href="/dashboard">
                                    <Button size="lg" icon={<ArrowRight className="size-5" />}>
                                        Go to Dashboard
                                    </Button>
                                </Link>
                            ) : (
                                <a href="/api/auth/login">
                                    <Button size="lg" icon={<ArrowRight className="size-5" />}>
                                        Get Started
                                    </Button>
                                </a>
                            )}
                        </div>
                    </motion.div>
                </div>

                {/* Scroll Indicator */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.5 }}
                    className="absolute bottom-8 left-1/2 -translate-x-1/2"
                >
                    <motion.div
                        animate={{ y: [0, 8, 0] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="flex flex-col items-center gap-2 text-white/30"
                    >
                        <span className="text-[10px] uppercase tracking-widest">Scroll</span>
                        <ChevronDown className="size-5" />
                    </motion.div>
                </motion.div>

                <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-[#0A0E14] to-transparent pointer-events-none" />
            </section>

            {/* Live Stats */}
            <section className="py-24 max-w-7xl mx-auto px-6 relative z-10">
                <AnimatedSection>
                    <div className="hud-card p-8 md:p-12 relative overflow-hidden">
                        {/* Top line accent */}
                        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                            <StatDisplay icon={Clock} label="Uptime" value="99.9%" color="green" delay={0.1} />
                            <StatDisplay icon={Zap} label="TPS" value={server?.tps_1min?.toFixed(1) || '20.0'} color="cyan" delay={0.2} />
                            <StatDisplay icon={Users} label="Players" value={`${server?.online_players || 0}+`} color="amber" delay={0.3} />
                            <StatDisplay icon={MessageSquare} label="Support" value="24/7" color="purple" delay={0.4} />
                        </div>

                        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
                    </div>
                </AnimatedSection>
            </section>

            {/* Features */}
            <section className="py-24 max-w-7xl mx-auto px-6 relative z-10">
                <AnimatedSection>
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-5xl font-black mb-4 text-white tracking-wider">
                            Why the <span className="text-cyan-400 text-glow-cyan">best play here</span>
                        </h2>
                        <p className="text-white/40 text-lg max-w-2xl mx-auto">
                            A complete, from-scratch visual and mechanical overhaul built for the modern player.
                        </p>
                    </div>
                </AnimatedSection>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <FeatureCard
                        icon={Zap}
                        title="Ultra-Performance"
                        description="Powered by SQLite for real-time profiles, dynamic roles, live ticket systems, and active friend requests with blazing speed."
                        color="cyan"
                        delay={0.1}
                    />
                    <FeatureCard
                        icon={Shield}
                        title="Grief Protection"
                        description="Advanced mechanics to ensure your jaw-dropping builds stay yours forever. Trusted by thousands of builders."
                        color="green"
                        delay={0.2}
                    />
                    <FeatureCard
                        icon={Globe}
                        title="Real-Time Dashboard"
                        description="Monitor server stats, manage your profile, trade items, and submit tickets all from a beautiful web dashboard."
                        color="amber"
                        delay={0.3}
                    />
                    <FeatureCard
                        icon={ShoppingCart}
                        title="Player Economy"
                        description="A player-driven marketplace managed by a fully visual admin CMS dashboard dynamically mapped via our backend."
                        color="purple"
                        delay={0.4}
                    />
                    <FeatureCard
                        icon={ArrowLeftRight}
                        title="Trade Hub"
                        description="Create and browse in-game and off-game trade listings. Filter by item, player, or server with real-time negotiation."
                        color="cyan"
                        delay={0.5}
                    />
                    <FeatureCard
                        icon={MessageSquare}
                        title="24/7 Support"
                        description="Create tickets, get real-time responses from our helper team, and track progress all from your dashboard."
                        color="green"
                        delay={0.6}
                    />
                </div>
            </section>

            {/* How to Join */}
            <section className="py-32 relative">
                <div className="absolute inset-0 bg-white/[0.01] border-y border-white/[0.04]" />
                <div className="max-w-7xl mx-auto px-6 relative z-10">
                    <AnimatedSection>
                        <div className="text-center mb-20">
                            <h2 className="text-3xl md:text-5xl font-black mb-4 text-white tracking-wider">
                                Start Your <span className="text-cyan-400 text-glow-cyan">Adventure</span>
                            </h2>
                            <p className="text-white/40 text-lg">Join in three simple steps</p>
                        </div>
                    </AnimatedSection>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                        {[
                            { step: '01', title: 'Create Account', desc: 'Link your Discord & Minecraft profiles via our authentication portal.', color: 'text-cyan-400 border-cyan-500/30' },
                            { step: '02', title: 'Add Server', desc: `Open Minecraft, click "Add Server" and paste ${siteConfig.brand.serverIp}.`, color: 'text-amber-400 border-amber-500/30' },
                            { step: '03', title: 'Join & Play', desc: 'Immerse yourself and check the dashboard to see your stats sync instantly!', color: 'text-green-400 border-green-500/30' },
                        ].map((item, i) => (
                            <AnimatedSection key={item.step} delay={i * 0.15} className="text-center">
                                <div className={`size-20 rounded-xl bg-[#0A0E14] flex items-center justify-center mx-auto mb-6 border ${item.color}`}>
                                    <span className={`text-2xl font-black ${item.color.split(' ')[0]}`}>{item.step}</span>
                                </div>
                                <h4 className="text-xl font-bold mb-3 text-white tracking-wider">{item.title}</h4>
                                <p className="text-white/40 leading-relaxed max-w-sm mx-auto">{item.desc}</p>
                            </AnimatedSection>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="py-24 max-w-7xl mx-auto px-6 relative z-10">
                <AnimatedSection>
                    <div className="text-center">
                        <h2 className="text-3xl md:text-5xl font-black mb-6 text-white tracking-wider">
                            Ready to <span className="text-cyan-400 text-glow-cyan">join</span>?
                        </h2>
                        <p className="text-white/40 text-lg mb-8 max-w-xl mx-auto">
                            Create your account, link your Minecraft username, and start playing today.
                        </p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                            <ServerIPBadge />
                            {isAuthenticated ? (
                                <Link href="/dashboard">
                                    <Button size="lg" icon={<ArrowRight className="size-5" />}>
                                        Go to Dashboard
                                    </Button>
                                </Link>
                            ) : (
                                <a href="/api/auth/login">
                                    <Button size="lg" icon={<ArrowRight className="size-5" />}>
                                        Create Account
                                    </Button>
                                </a>
                            )}
                        </div>
                    </div>
                </AnimatedSection>
            </section>
        </>
    );
}
