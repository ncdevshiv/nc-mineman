import React from "react";
import { cn } from "@/lib/utils";
import { getRoleColor } from "@/lib/site.config";

const roleColors: Record<string, string> = {
  owner: "bg-red-500/20 text-red-400 border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.2)]",
  admin: "bg-orange-500/20 text-orange-400 border-orange-500/30 shadow-[0_0_15px_rgba(249,115,22,0.2)]",
  god: "bg-amber-500/20 text-amber-400 border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.2)]",
  helper: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.2)]",
  youtuber: "bg-pink-500/20 text-pink-400 border-pink-500/30 shadow-[0_0_15px_rgba(236,72,153,0.2)]",
  member: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
};

export const RoleBadge = ({ role, className }: { role: string; className?: string }) => {
  const normRole = role.toLowerCase().trim();
  const classes = roleColors[normRole] || roleColors["member"];

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full border px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider backdrop-blur-sm",
        classes,
        className
      )}
    >
      {normRole}
    </span>
  );
};
