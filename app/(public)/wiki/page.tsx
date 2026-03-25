'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import siteConfig from '@/lib/site.config';

/* ─── Data ─── */
const COMMANDS = [
  { cmd: '/help', desc: 'Shows all available commands', perm: 'Everyone' },
  { cmd: '/spawn', desc: 'Teleport to the server spawn', perm: 'Everyone' },
  { cmd: '/home set', desc: 'Set your home location', perm: 'Everyone' },
  { cmd: '/home', desc: 'Teleport to your home', perm: 'Everyone' },
  { cmd: '/tpa <player>', desc: 'Request to teleport to a player', perm: 'Everyone' },
  { cmd: '/msg <player>', desc: 'Send a private message', perm: 'Everyone' },
  { cmd: '/bal', desc: 'Check your in-game balance', perm: 'Everyone' },
  { cmd: '/pay <player> <amt>', desc: 'Pay another player', perm: 'Everyone' },
  { cmd: '/shop', desc: 'Open the server shop', perm: 'Everyone' },
  { cmd: '/clan create <name>', desc: 'Create a clan', perm: 'Everyone' },
  { cmd: '/clan invite <player>', desc: 'Invite a player to your clan', perm: 'Clan Leader' },
  { cmd: '/kit', desc: 'Claim your daily kit', perm: 'Everyone' },
  { cmd: '/vote', desc: 'Vote for the server and earn rewards', perm: 'Everyone' },
  { cmd: '/report <player>', desc: 'Report a rule-breaking player', perm: 'Everyone' },
];

const RANKS = [
  { name: 'Newcomer', color: '#94a3b8', req: 'Join the server', perks: ['Basic commands', 'Survival access', '1 home'] },
  { name: 'Explorer', color: '#22c55e', req: '10 hours playtime', perks: ['2 homes', 'Colored chat', '/back command'] },
  { name: 'Adventurer', color: '#3b82f6', req: '50 hours playtime', perks: ['3 homes', 'Nickname command', 'Extra claim blocks'] },
  { name: 'Veteran', color: '#a855f7', req: '200 hours playtime', perks: ['5 homes', 'Particle effects', 'Priority queue'] },
  { name: 'Legend', color: '#f59e0b', req: '500 hours playtime', perks: ['10 homes', 'Custom title', 'Exclusive cosmetics', 'Legend chat channel'] },
  { name: 'Mythic', color: '#ef4444', req: '1000 hours playtime', perks: ['Unlimited homes', 'All cosmetics', 'Staff advisory role', 'Special events access'] },
];

const FAQ = [
  { q: 'Is the server cracked/offline mode?', a: 'No, Hideout SMP is a premium Minecraft server. You need a legitimate Minecraft account (Java or Bedrock) to play.' },
  { q: 'What version should I use?', a: 'We support the latest Minecraft version. We recommend always updating to the newest version for the best experience.' },
  { q: 'Can I use mods?', a: 'Cosmetic mods (like OptiFine, shaders, minimaps) are allowed. Any mod that gives gameplay advantages is banned.' },
  { q: 'How do I get unbanned?', a: 'If you believe your ban was unjust, submit an appeal through our Contact page with your username and explanation.' },
  { q: 'Is it Java or Bedrock?', a: 'Primarily Java Edition, but we also support Bedrock Edition through Geyser crossplay.' },
  { q: 'How do I earn money?', a: 'You can earn in-game currency by mining, farming, selling items at the shop, completing quests, and voting daily.' },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--border-color)',
      overflow: 'hidden',
      background: 'var(--bg-card)',
    }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%',
          padding: '16px 20px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-display)',
          fontSize: '15px',
          fontWeight: 600,
          textAlign: 'left',
        }}
      >
        {q}
        <motion.span animate={{ rotate: open ? 180 : 0 }} style={{ color: 'var(--text-muted)', fontSize: '14px' }}>▼</motion.span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} style={{ overflow: 'hidden' }}>
            <p style={{ padding: '0 20px 16px', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── TABS ─── */
const TABS = ['Getting Started', 'Commands', 'Ranks', 'Economy', 'FAQ'] as const;

export default function WikiPage() {
  const [tab, setTab] = useState<typeof TABS[number]>('Getting Started');

  return (
    <div style={{ padding: '40px 0 100px' }}>
      <div className="site-container" style={{ maxWidth: '900px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(32px, 5vw, 48px)',
            fontWeight: 900,
            marginBottom: '16px',
          }}>
            Server <span className="gradient-text">Wiki</span>
          </h1>
          <p style={{ fontSize: '17px', color: 'var(--text-secondary)' }}>
            Everything you need to know about Hideout SMP
          </p>
        </div>

        {/* Tab Bar */}
        <div style={{
          display: 'flex',
          gap: '6px',
          marginBottom: '40px',
          padding: '6px',
          borderRadius: 'var(--radius-full)',
          background: 'var(--bg-tertiary)',
          overflowX: 'auto',
        }}>
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '10px 20px',
                borderRadius: 'var(--radius-full)',
                border: 'none',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 600,
                fontFamily: 'var(--font-display)',
                whiteSpace: 'nowrap',
                transition: 'all var(--transition-fast)',
                background: tab === t ? 'var(--gradient-primary)' : 'transparent',
                color: tab === t ? '#fff' : 'var(--text-secondary)',
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
          >
            {tab === 'Getting Started' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div style={{ padding: '32px', borderRadius: 'var(--radius-lg)', background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                  <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 800, marginBottom: '16px' }}>
                    Welcome to Hideout SMP! 🎮
                  </h2>
<p style={{ fontSize: '15px', color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: '16px' }}>
{siteConfig.name.full} is a survival multiplayer server where everyone starts equal and progresses through dedication and skill. Here's how to get started:
</p>
                  <ol style={{ paddingLeft: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {[
                      { title: 'Launch Minecraft', desc: 'Open Minecraft Java Edition (1.20+) or Bedrock Edition.' },
                      { title: 'Go to Multiplayer', desc: 'Click "Multiplayer" from the main menu, then "Add Server".' },
                      { title: 'Enter Server Address', desc: `Type ${siteConfig.brand.serverIp} in the server address field.` },
                      { title: 'Connect & Read Rules', desc: 'Join the server! You\'ll spawn in our welcome area. Read the rules board before heading out.' },
                      { title: 'Start Your Journey', desc: 'Pick a direction, find a spot, and begin building your story.' },
                    ].map((step, i) => (
                      <li key={i} style={{ fontSize: '15px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                        <strong style={{ color: 'var(--text-primary)' }}>{step.title}</strong> — {step.desc}
                      </li>
                    ))}
                  </ol>
                </div>

                <div style={{
                  padding: '20px 24px',
                  borderRadius: 'var(--radius-lg)',
                  background: 'var(--color-primary-glow)',
                  border: '1px solid rgba(20, 184, 166, 0.2)',
                }}>
                  <p style={{ fontSize: '15px', color: 'var(--color-primary)', fontWeight: 600 }}>
                    💡 Pro Tip: Subscribe to <a href={siteConfig.social.youtube} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline' }}>our YouTube channel</a> for server event announcements and a chance to be featured!
                  </p>
                </div>
              </div>
            )}

            {tab === 'Commands' && (
              <div style={{
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-color)',
                overflow: 'hidden',
              }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-tertiary)' }}>
                        <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Command</th>
                        <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Description</th>
                        <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Permission</th>
                      </tr>
                    </thead>
                    <tbody>
                      {COMMANDS.map((cmd, i) => (
                        <tr key={i} style={{ borderTop: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '12px 20px' }}>
                            <code style={{
                              padding: '4px 10px',
                              borderRadius: 'var(--radius-sm)',
                              background: 'var(--bg-tertiary)',
                              fontSize: '13px',
                              fontFamily: 'var(--font-code)',
                              color: 'var(--color-primary)',
                            }}>{cmd.cmd}</code>
                          </td>
                          <td style={{ padding: '12px 20px', fontSize: '14px', color: 'var(--text-secondary)' }}>{cmd.desc}</td>
                          <td style={{ padding: '12px 20px', fontSize: '13px', color: 'var(--text-muted)' }}>{cmd.perm}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {tab === 'Ranks' && (
              <div style={{ display: 'grid', gap: '16px' }}>
                {RANKS.map((rank) => (
                  <div
                    key={rank.name}
                    style={{
                      padding: '24px',
                      borderRadius: 'var(--radius-lg)',
                      border: '1px solid var(--border-color)',
                      borderLeft: `4px solid ${rank.color}`,
                      background: 'var(--bg-card)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '8px' }}>
                      <h3 style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '20px',
                        fontWeight: 800,
                        color: rank.color,
                      }}>
                        {rank.name}
                      </h3>
                      <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{rank.req}</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {rank.perks.map((p) => (
                        <span key={p} style={{
                          padding: '4px 12px',
                          borderRadius: 'var(--radius-full)',
                          background: `${rank.color}15`,
                          border: `1px solid ${rank.color}30`,
                          fontSize: '13px',
                          color: rank.color,
                          fontWeight: 500,
                        }}>
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab === 'Economy' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div style={{ padding: '32px', borderRadius: 'var(--radius-lg)', background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                  <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 800, marginBottom: '16px' }}>
                    Economy System 💰
                  </h2>
                  <p style={{ fontSize: '15px', color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: '20px' }}>
                    Hideout SMP has a balanced economy designed for fair gameplay. Every player earns through effort — there are no pay-to-win shortcuts.
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                    {[
                      { icon: '⛏️', title: 'Mining', desc: 'Sell ores and minerals at the server shop. Rarer ores = more money.' },
                      { icon: '🌾', title: 'Farming', desc: 'Grow crops and sell them. Set up automatic farms for passive income.' },
                      { icon: '🗳️', title: 'Voting', desc: 'Vote daily at /vote to earn vote tokens and in-game currency.' },
                      { icon: '📦', title: 'Trading', desc: 'Set up player shops and trade with other players for profit.' },
                      { icon: '🎯', title: 'Quests', desc: 'Complete daily and weekly quests for bonus rewards and XP.' },
                      { icon: '🏆', title: 'Events', desc: 'Win server-wide events for large prize pools and exclusive items.' },
                    ].map((item) => (
                      <div key={item.title} style={{
                        padding: '20px',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--border-color)',
                      }}>
                        <div style={{ fontSize: '32px', marginBottom: '8px' }}>{item.icon}</div>
                        <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: 700, marginBottom: '4px', color: 'var(--text-primary)' }}>{item.title}</h4>
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{item.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {tab === 'FAQ' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {FAQ.map((f) => <FAQItem key={f.q} {...f} />)}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
