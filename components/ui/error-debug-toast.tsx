"use client";

import { create } from "zustand";
import { motion, AnimatePresence } from "motion/react";
import { AlertCircle, CheckCircle, Info, X } from "lucide-react";
import { useEffect } from "react";

export type ToastType = "error" | "success" | "info";

interface Toast {
  id: string;
  title: string;
  message?: string;
  type: ToastType;
}

interface ToastStore {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
}

export const useToast = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, 5000);
  },
  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

const icons = {
  error: <AlertCircle className="size-5 text-red-400" />,
  success: <CheckCircle className="size-5 text-emerald-400" />,
  info: <Info className="size-5 text-blue-400" />
};

export const DebugToaster = () => {
  const toasts = useToast((state) => state.toasts);
  const removeToast = useToast((state) => state.removeToast);

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex min-w-[300px] pointer-events-auto items-start gap-3 rounded-lg border border-white/10 bg-zinc-900/90 p-4 shadow-2xl backdrop-blur-xl"
          >
            <div className="shrink-0 mt-0.5">{icons[t.type]}</div>
            <div className="flex-1 text-sm font-medium text-zinc-100">
              {t.title}
              {t.message && (
                <div className="mt-1 text-xs text-zinc-400 font-mono bg-black/40 p-2 rounded mt-2">
                  {t.message}
                </div>
              )}
            </div>
            <button onClick={() => removeToast(t.id)} className="text-zinc-500 hover:text-zinc-100 transition-colors">
              <X className="size-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
