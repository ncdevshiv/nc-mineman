'use client';

import { motion } from 'motion/react';
import { AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';

interface PermissionToggleProps {
    permission: {
        key: string;
        label: string;
        description: string;
        isDangerous: boolean;
    };
    granted: boolean;
    onToggle: (key: string, granted: boolean) => void;
    disabled?: boolean;
}

export function PermissionToggle({ permission, granted, onToggle, disabled }: PermissionToggleProps) {
    return (
        <div
            className={clsx(
                'flex items-center justify-between gap-4 p-3 rounded-xl transition-all duration-200',
                'bg-white/[0.03] hover:bg-white/[0.06]',
                disabled && 'opacity-50 cursor-not-allowed'
            )}
            title={`${permission.label}\n\n${permission.description}${permission.isDangerous ? '\n\n⚠️ This is a dangerous permission' : ''}`}
        >
            <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{permission.label}</span>
                        {permission.isDangerous && (
                            <AlertTriangle className="size-3.5 text-red-400 shrink-0" />
                        )}
                    </div>
                    <p className="text-xs text-white/40 mt-0.5 truncate">{permission.description}</p>
                </div>
            </div>

            <button
                type="button"
                role="switch"
                aria-checked={granted}
                disabled={disabled}
                onClick={() => !disabled && onToggle(permission.key, !granted)}
                className={clsx(
                    'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    granted ? 'bg-emerald-500' : 'bg-white/10'
                )}
            >
                <motion.span
                    layout
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    className={clsx(
                        'inline-flex size-5 translate-x-0 items-center justify-center rounded-full bg-white shadow-lg'
                    )}
                    style={{
                        translateX: granted ? '20px' : '0px',
                    }}
                />
            </button>
        </div>
    );
}
