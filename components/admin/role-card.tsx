'use client';

import { motion } from 'motion/react';
import { Lock, Shield } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { clsx } from 'clsx';

interface RoleCardProps {
    role: {
        name: string;
        color: string;
        description: string;
        isLocked: boolean;
        permissions: string[];
    };
    onEdit: (roleName: string) => void;
}

export function RoleCard({ role, onEdit }: RoleCardProps) {
    return (
        <motion.div
            whileHover={{ y: -4, scale: 1.01 }}
            transition={{ duration: 0.2 }}
            onClick={() => onEdit(role.name)}
            className={clsx(
                'relative flex flex-col gap-3 p-5 rounded-2xl cursor-pointer',
                'bg-[#111620]/85 border border-white/[0.06]',
                'hover:border-white/15 hover:shadow-lg',
                'transition-all duration-200'
            )}
            style={{
                borderLeftWidth: '4px',
                borderLeftColor: role.color,
            }}
        >
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-bold text-white truncate">{role.name}</h3>
                        {role.isLocked && (
                            <Badge variant="warning" size="sm">
                                <Lock className="size-2.5 mr-1" />
                                locked
                            </Badge>
                        )}
                    </div>
                    <p className="text-sm text-white/40 mt-1 line-clamp-2">{role.description}</p>
                </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-white/5">
                <div className="flex items-center gap-2">
                    <Badge variant="info" size="sm">
                        <Shield className="size-3 mr-1" />
                        {role.permissions.length} permissions
                    </Badge>
                </div>

                {/* Color indicator */}
                <div
                    className="size-3 rounded-full ring-2 ring-white/10"
                    style={{ backgroundColor: role.color }}
                />
            </div>
        </motion.div>
    );
}
