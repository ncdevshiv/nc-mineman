'use client';

import { clsx } from 'clsx';

interface AvatarProps {
    name: string;
    src?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    online?: boolean;
    className?: string;
}

const sizeStyles = {
    sm: 'size-8 text-xs',
    md: 'size-10 text-sm',
    lg: 'size-14 text-lg',
    xl: 'size-20 text-2xl',
};

function getInitials(name: string): string {
    return name
        .split(' ')
        .map((w) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
}

function getColorFromName(name: string): string {
    const colors = [
        'from-cyan-500 to-blue-600',
        'from-blue-500 to-indigo-600',
        'from-purple-500 to-pink-600',
        'from-amber-500 to-orange-600',
        'from-rose-500 to-red-600',
        'from-green-500 to-emerald-600',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
}

export function Avatar({ name, src, size = 'md', online, className }: AvatarProps) {
    const mcSkinUrl = src || `https://mc-heads.net/avatar/${name}/128`;

    return (
        <div className={clsx('relative shrink-0', className)}>
            <div
                className={clsx(
                    'rounded-xl overflow-hidden bg-gradient-to-br flex items-center justify-center font-bold text-white',
                    sizeStyles[size],
                    !src && getColorFromName(name)
                )}
            >
                <img
                    src={mcSkinUrl}
                    alt={name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        target.parentElement!.textContent = getInitials(name);
                    }}
                />
            </div>
            {online !== undefined && (
                <span
                    className={clsx(
                        'absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-[#0A0E14]',
                        online ? 'bg-green-400' : 'bg-white/20'
                    )}
                />
            )}
        </div>
    );
}
