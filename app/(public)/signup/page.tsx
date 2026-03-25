'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { useToast } from '@/components/ui/error-debug-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { User, Gamepad2, MessageSquare, AlertTriangle, Check, Lock } from 'lucide-react';

export default function SignupPage() {
  const [mcUsername, setMcName] = useState('');
  const [discordUsername, setDiscord] = useState('');
  const [discordId, setDiscordId] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const addToast = useToast(s => s.addToast);

  useEffect(() => {
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => {
        if (data) {
          // Auto-fetch Discord username from session - this is verified by Discord OAuth
          if (data.discord_username) setDiscord(data.discord_username);
          else if (data.username) setDiscord(data.username);
          if (data.sub) setDiscordId(data.sub);
        }
      })
      .catch(console.error);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mcUsername.trim()) {
      addToast({ type: 'error', title: 'Required', message: 'Minecraft username is required to play.' });
      return;
    }

    // Validate MC username format (3-16 chars, alphanumeric + underscore)
    if (!/^[a-zA-Z0-9_]{3,16}$/.test(mcUsername.trim())) {
      addToast({ type: 'error', title: 'Invalid Username', message: 'Minecraft username must be 3-16 characters, alphanumeric and underscores only.' });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/users/me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mc_username: mcUsername.trim(),
          discord_username: discordUsername, // Auto-fetched from Discord OAuth, not user-editable
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to link account');
      }

      addToast({ type: 'success', title: 'Account Linked!', message: 'Welcome to Hideout SMP.' });
      router.push('/dashboard');
      router.refresh();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Setup Failed', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-full max-w-md"
      >
        <Card variant="glass" padding="lg">
          <div className="text-center mb-8">
            <div className="size-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mx-auto mb-4 shadow-[0_0_30px_rgba(20,184,166,0.3)]">
              <span className="text-2xl font-black text-white">H</span>
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight mb-2">Almost There</h1>
            <p className="text-white/40 text-sm">
              To play on Hideout SMP, you must link your Minecraft username.
            </p>
          </div>

          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl mb-6 flex items-start gap-3">
            <AlertTriangle className="size-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-400/80">
              <strong>Important:</strong> Your Minecraft username cannot be changed after setup without admin approval.
              Make sure it matches your actual Minecraft Java Edition username.
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="Minecraft Username *"
              value={mcUsername}
              onChange={e => setMcName(e.target.value)}
              placeholder="Notch"
              required
              icon={<Gamepad2 className="size-4" />}
            />

            {/* Discord username - auto-fetched from OAuth, non-editable */}
            <div>
              <label className="text-sm text-white/60 block mb-1.5 flex items-center gap-1.5">
                <MessageSquare className="size-4" />
                Discord Username
                <Lock className="size-3 text-white/30" />
              </label>
              <div className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2.5 text-white/70 text-sm flex items-center justify-between">
                <span>{discordUsername || 'Loading...'}</span>
                <span className="text-[10px] text-white/25 bg-white/5 px-2 py-0.5 rounded-full">Verified by Discord</span>
              </div>
              <p className="text-[11px] text-white/25 mt-1">Auto-fetched from your Discord account. Cannot be changed.</p>
            </div>

            <Button
              type="submit"
              loading={loading}
              className="w-full"
              size="lg"
              icon={<Check className="size-5" />}
            >
              Complete Setup
            </Button>
          </form>

          <p className="text-center text-xs text-white/20 mt-6">
            By creating an account you agree to our rules and terms of service.
          </p>
        </Card>
      </motion.div>
    </div>
  );
}
