'use client';

import { motion, HTMLMotionProps } from 'motion/react';
import { clsx } from 'clsx';

interface CardProps extends HTMLMotionProps<'div'> {
    variant?: 'default' | 'glass' | 'glow' | 'bordered';
    padding?: 'none' | 'sm' | 'md' | 'lg';
    hover?: boolean;
    children: React.ReactNode;
}

const variantStyles: Record<string, string> = {
    default: 'bg-[#111620]/85 border border-white/[0.06]',
    glass: 'bg-white/[0.03] backdrop-blur-xl border border-white/[0.08]',
    glow: 'bg-[#111620]/80 border border-cyan-500/20 shadow-[0_0_30px_rgba(0,229,255,0.1)]',
    bordered: 'bg-transparent border border-white/10',
};

const paddingStyles: Record<string, string> = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
};

export function Card({
    variant = 'default',
    padding = 'md',
    hover = false,
    children,
    className,
    ...props
}: CardProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
            whileHover={hover ? { y: -4, scale: 1.01 } : undefined}
            className={clsx(
                'rounded-2xl transition-all duration-300',
                variantStyles[variant],
                paddingStyles[padding],
                hover && 'cursor-pointer hover:shadow-lg hover:border-white/15',
                className
            )}
            {...props}
        >
            {children}
        </motion.div>
    );
}

export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
    return <div className={clsx('mb-4', className)}>{children}</div>;
}

export function CardTitle({ children, className }: { children: React.ReactNode; className?: string }) {
    return <h3 className={clsx('text-lg font-bold text-white', className)}>{children}</h3>;
}

export function CardDescription({ children, className }: { children: React.ReactNode; className?: string }) {
    return <p className={clsx('text-sm text-white/50 mt-1', className)}>{children}</p>;
}
