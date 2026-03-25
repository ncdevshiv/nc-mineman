'use client';

import { motion } from 'motion/react';
import { clsx } from 'clsx';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

interface BadgeProps {
    variant?: BadgeVariant;
    size?: 'sm' | 'md';
    pulse?: boolean;
    children: React.ReactNode;
    className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
    default: 'bg-white/10 text-white/70 border-white/10',
    success: 'bg-green-500/10 text-green-400 border-green-500/20',
    warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    danger: 'bg-red-500/10 text-red-400 border-red-500/20',
    info: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    accent: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
};

const sizeStyles = {
    sm: 'px-2 py-0.5 text-[10px]',
    md: 'px-3 py-1 text-xs',
};

export function Badge({ variant = 'default', size = 'sm', pulse, children, className }: BadgeProps) {
    return (
        <span
            className={clsx(
                'inline-flex items-center font-bold uppercase tracking-wider rounded-full border',
                variantStyles[variant],
                sizeStyles[size],
                pulse && 'animate-pulse',
                className
            )}
        >
            {children}
        </span>
    );
}

export function OnlineDot({ online }: { online: boolean }) {
    return (
        <span className="relative flex size-2.5">
            {online && (
                <motion.span
                    animate={{ scale: [1, 1.8, 1], opacity: [0.7, 0, 0.7] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute inline-flex h-full w-full rounded-full bg-green-400"
                />
            )}
            <span
                className={clsx(
                    'relative inline-flex rounded-full size-2.5',
                    online ? 'bg-green-400' : 'bg-white/20'
                )}
            />
        </span>
    );
}
