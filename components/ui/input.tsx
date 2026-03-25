'use client';

import { forwardRef, InputHTMLAttributes } from 'react';
import { clsx } from 'clsx';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    icon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ label, error, icon, className, ...props }, ref) => {
        return (
            <div className="space-y-1.5">
                {label && (
                    <label className="text-xs font-bold text-white/50 uppercase tracking-wider">
                        {label}
                    </label>
                )}
                <div className="relative">
                    {icon && (
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30">
                            {icon}
                        </div>
                    )}
                    <input
                        ref={ref}
                        className={clsx(
                            'w-full bg-[#0A0E14]/50 border border-cyan-500/20 rounded-xl px-4 py-3 text-white placeholder:text-white/20 transition-all duration-200',
                            'focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/40',
                            'hover:border-cyan-500/30',
                            icon && 'pl-10',
                            error && 'border-red-500/40 focus:ring-red-500/40 focus:border-red-500/40',
                            className
                        )}
                        {...props}
                    />
                </div>
                {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
            </div>
        );
    }
);

Input.displayName = 'Input';
