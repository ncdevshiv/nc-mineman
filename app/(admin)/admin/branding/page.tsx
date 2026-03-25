'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '@/hooks/use-auth';
import { AppShell } from '@/components/layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/error-debug-toast';
import {
  Palette, Type, Globe, Server, Image, Link2, Mail,
  Shield, Settings, Save, RotateCcw, Eye, Code,
  ArrowLeft, Check, AlertCircle, Loader2
} from 'lucide-react';

interface ConfigItem {
  value: string;
  description: string;
  source: 'db' | 'default';
}

interface ConfigState {
  [key: string]: ConfigItem;
}

const CONFIG_GROUPS = [
  {
    id: 'branding',
    title: 'Branding',
    icon: Palette,
    color: 'text-purple-400',
    keys: ['SITE_NAME_SHORT', 'SITE_NAME_FULL', 'SITE_TAGLINE', 'LOGO_LETTER', 'LOGO_COLOR_FROM', 'LOGO_COLOR_TO'],
  },
  {
    id: 'server',
    title: 'Server',
    icon: Server,
    color: 'text-emerald-400',
    keys: ['SERVER_IP', 'SITE_DOMAIN', 'SITE_DESCRIPTION'],
  },
  {
    id: 'social',
    title: 'Social Links',
    icon: Link2,
    color: 'text-blue-400',
    keys: ['YOUTUBE_URL', 'DISCORD_URL', 'DISCORD_INVITE', 'STORE_URL', 'SUPPORT_EMAIL'],
  },
  {
    id: 'technical',
    title: 'Technical',
    icon: Settings,
    color: 'text-amber-400',
    keys: ['COOKIE_NAME', 'THEME_KEY', 'SERVER_STATS_PORT', 'WEBSOCKET_PORT'],
  },
  {
    id: 'payments',
    title: 'Payments (Polar.sh)',
    icon: Shield,
    color: 'text-cyan-400',
    keys: ['POLAR_ACCESS_TOKEN', 'POLAR_WEBHOOK_SECRET', 'POLAR_SERVER'],
  },
];

export default function BrandingAdminPage() {
  const { isAdmin } = useAuth();
  const addToast = useToast(s => s.addToast);

  const [config, setConfig] = useState<ConfigState>({});
  const [originalConfig, setOriginalConfig] = useState<ConfigState>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeGroup, setActiveGroup] = useState('branding');
  const [viewMode, setViewMode] = useState<'visual' | 'code'>('visual');
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  useEffect(() => {
    const changed = Object.keys(config).some(key => config[key]?.value !== originalConfig[key]?.value);
    setHasChanges(changed);
  }, [config, originalConfig]);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
        setOriginalConfig(JSON.parse(JSON.stringify(data)));
      }
    } catch (err) {
      addToast({ type: 'error', title: 'Error', message: 'Failed to load configuration' });
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      const changes: Record<string, string> = {};
      for (const key of Object.keys(config)) {
        if (config[key].value !== originalConfig[key]?.value) {
          changes[key] = config[key].value;
        }
      }

      const res = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      });

      if (!res.ok) throw new Error('Failed to save');

      addToast({ type: 'success', title: 'Saved', message: 'Configuration updated. Changes will appear after page refresh.' });
      setOriginalConfig(JSON.parse(JSON.stringify(config)));
      setHasChanges(false);
    } catch (err) {
      addToast({ type: 'error', title: 'Error', message: 'Failed to save configuration' });
    } finally {
      setSaving(false);
    }
  };

  const resetConfig = async (key: string) => {
    setConfig(prev => ({
      ...prev,
      [key]: { ...prev[key], value: originalConfig[key]?.value || prev[key].value },
    }));
  };

  const updateValue = useCallback((key: string, value: string) => {
    setConfig(prev => ({
      ...prev,
      [key]: { ...prev[key], value },
    }));
  }, []);

  const exportConfig = () => {
    const envContent = Object.entries(config)
      .map(([key, data]) => `${key}="${data.value}"`)
      .join('\n');
    
    const blob = new Blob([envContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '.env.local';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="size-8 animate-spin text-emerald-500" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col lg:flex-row lg:items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <Link href="/admin">
              <Button variant="ghost" size="sm" icon={<ArrowLeft className="size-4" />}>
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                <Palette className="size-7 text-purple-400" />
                Branding & Configuration
              </h1>
              <p className="text-white/40 mt-1">Customize site branding, social links, and technical settings</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex rounded-xl overflow-hidden border border-white/10">
              <button
                onClick={() => setViewMode('visual')}
                className={`px-4 py-2 text-sm font-medium flex items-center gap-2 ${viewMode === 'visual' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/[0.02] text-white/60 hover:bg-white/[0.05]'}`}
              >
                <Eye className="size-4" /> Visual
              </button>
              <button
                onClick={() => setViewMode('code')}
                className={`px-4 py-2 text-sm font-medium flex items-center gap-2 ${viewMode === 'code' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/[0.02] text-white/60 hover:bg-white/[0.05]'}`}
              >
                <Code className="size-4" /> Code
              </button>
            </div>

            <Button variant="secondary" onClick={exportConfig} icon={<Settings className="size-4" />}>
              Export .env
            </Button>

            <Button
              onClick={saveConfig}
              loading={saving}
              disabled={!hasChanges}
              icon={<Save className="size-4" />}
            >
              Save Changes
            </Button>
          </div>
        </motion.div>

        {/* Changes indicator */}
        {hasChanges && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Card variant="glass" padding="sm" className="flex items-center gap-3 bg-amber-500/10 border-amber-500/30">
              <AlertCircle className="size-5 text-amber-400" />
              <span className="text-amber-200 text-sm">You have unsaved changes</span>
              <Button variant="ghost" size="sm" onClick={() => setConfig(JSON.parse(JSON.stringify(originalConfig)))}>
                Discard
              </Button>
            </Card>
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-2">
            {CONFIG_GROUPS.map(group => (
              <button
                key={group.id}
                onClick={() => setActiveGroup(group.id)}
                className={`w-full flex items-center gap-3 p-4 rounded-xl transition-all ${
                  activeGroup === group.id
                    ? 'bg-emerald-500/10 border border-emerald-500/30'
                    : 'bg-white/[0.02] border border-white/5 hover:bg-white/[0.04]'
                }`}
              >
                <group.icon className={`size-5 ${group.color}`} />
                <span className="font-medium text-white">{group.title}</span>
                <Badge variant="default" size="sm" className="ml-auto">
                  {group.keys.filter(k => config[k]?.source === 'db').length}/{group.keys.length}
                </Badge>
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="lg:col-span-3">
            {viewMode === 'visual' ? (
              <div className="space-y-6">
                {CONFIG_GROUPS.filter(g => g.id === activeGroup).map(group => (
                  <motion.div
                    key={group.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-4"
                  >
                    {group.keys.map(key => {
                      const item = config[key];
                      if (!item) return null;
                      const isChanged = item.value !== originalConfig[key]?.value;

                      return (
                        <Card key={key} variant="glass" padding="md" className={isChanged ? 'border-amber-500/30' : ''}>
                          <div className="flex flex-col md:flex-row md:items-start gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h3 className="font-bold text-white">{key}</h3>
                                <Badge variant={item.source === 'db' ? 'success' : 'default'} size="sm">
                                  {item.source === 'db' ? 'Custom' : 'Default'}
                                </Badge>
                                {isChanged && <Badge variant="warning" size="sm">Modified</Badge>}
                              </div>
                              <p className="text-sm text-white/50 mb-3">{item.description}</p>
                              <Input
                                value={item.value}
                                onChange={e => updateValue(key, e.target.value)}
                                placeholder={`Enter ${key}...`}
                              />
                            </div>
                            <div className="flex gap-2">
                              {isChanged && (
                                <Button variant="ghost" size="sm" onClick={() => resetConfig(key)} icon={<RotateCcw className="size-4" />}>
                                  Reset
                                </Button>
                              )}
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </motion.div>
                ))}
              </div>
            ) : (
              <Card variant="glass" padding="md">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-white">Environment Variables Preview</h3>
                  <Button variant="secondary" size="sm" onClick={exportConfig}>
                    Download .env.local
                  </Button>
                </div>
                <pre className="bg-black/40 rounded-xl p-4 overflow-x-auto text-sm font-mono text-white/80">
                  {Object.entries(config).map(([key, data]) => (
                    <div key={key} className={`${data.value !== originalConfig[key]?.value ? 'text-amber-400' : ''}`}>
                      {`${key}="${data.value}"`}
                    </div>
                  ))}
                </pre>
              </Card>
            )}
          </div>
        </div>

        {/* Live Preview */}
        <Card variant="glass" padding="lg">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Eye className="size-5 text-emerald-400" />
            Live Preview
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Logo Preview */}
            <div className="text-center">
              <p className="text-xs text-white/40 uppercase tracking-wider mb-3">Logo</p>
              <div
                className="size-16 rounded-xl mx-auto flex items-center justify-center font-black text-white text-2xl shadow-lg"
                style={{
                  background: `linear-gradient(135deg, ${config.LOGO_COLOR_FROM?.value || '#10b981'} 0%, ${config.LOGO_COLOR_TO?.value || '#059669'} 100%)`,
                }}
              >
                {config.LOGO_LETTER?.value || 'H'}
              </div>
            </div>

            {/* Name Preview */}
            <div className="text-center">
              <p className="text-xs text-white/40 uppercase tracking-wider mb-3">Brand Name</p>
              <div className="text-2xl font-black text-white">
                {config.SITE_NAME_SHORT?.value || 'Hideout'}
                <span className="text-emerald-400">{(config.SITE_NAME_FULL?.value || 'Hideout SMP').replace(config.SITE_NAME_SHORT?.value || '', '')}</span>
              </div>
              <p className="text-sm text-white/50 mt-1">{config.SITE_TAGLINE?.value}</p>
            </div>

            {/* Server Preview */}
            <div className="text-center">
              <p className="text-xs text-white/40 uppercase tracking-wider mb-3">Server IP</p>
              <div className="font-mono text-lg text-emerald-400 bg-white/5 rounded-lg px-4 py-2 inline-block">
                {config.SERVER_IP?.value || 'play.example.com'}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
