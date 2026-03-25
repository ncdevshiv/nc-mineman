'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface Rule {
  id: number;
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'ban';
}

interface RuleCategory {
  name: string;
  icon: string;
  rules: Rule[];
}

const RULE_CATEGORIES: RuleCategory[] = [
  {
    name: 'General Rules',
    icon: '📋',
    rules: [
      { id: 1, title: 'Be Respectful', description: 'Treat all players with respect. Harassment, bullying, and discrimination of any kind are not tolerated. Everyone deserves a welcoming environment.', severity: 'warning' },
      { id: 2, title: 'No Cheating or Hacking', description: 'Any form of cheating, hacking, exploiting, or using unauthorized modifications is strictly prohibited. This includes x-ray, fly hacks, speed hacks, kill aura, and any other unfair advantages.', severity: 'ban' },
      { id: 3, title: 'English in Global Chat', description: 'Please use English in the global chat to ensure everyone can communicate. You may use other languages in private messages or party chat.', severity: 'info' },
      { id: 4, title: 'Follow Staff Instructions', description: 'Staff members are here to help. Follow their instructions and respect their decisions. If you disagree, you may appeal through the proper channels.', severity: 'warning' },
      { id: 5, title: 'No Bug Exploitation', description: 'If you discover a bug or glitch, report it to staff immediately. Exploiting bugs for personal gain will result in punishment.', severity: 'ban' },
    ],
  },
  {
    name: 'Chat Rules',
    icon: '💬',
    rules: [
      { id: 6, title: 'No Spamming', description: 'Do not flood the chat with repetitive messages, excessive caps, or special characters. This disrupts communication for everyone.', severity: 'warning' },
      { id: 7, title: 'No Advertising', description: 'Advertising other servers, social media, or websites is not allowed without staff permission. This includes DMs to other players.', severity: 'warning' },
      { id: 8, title: 'Keep It Clean', description: 'No excessive profanity, slurs, or NSFW content in any form of communication on the server.', severity: 'ban' },
      { id: 9, title: 'No Impersonation', description: 'Do not impersonate staff members, content creators, or other players. This includes using similar names or skins.', severity: 'ban' },
    ],
  },
  {
    name: 'PvP Rules',
    icon: '⚔️',
    rules: [
      { id: 10, title: 'PvP in Designated Areas', description: 'PvP is only allowed in designated PvP zones unless both parties agree to fight elsewhere. Random killing (RDM) is not allowed in safe zones.', severity: 'warning' },
      { id: 11, title: 'No Combat Logging', description: 'Disconnecting during combat to avoid death is prohibited. If you are in a fight, see it through.', severity: 'warning' },
      { id: 12, title: 'No Spawn Killing', description: 'Camping or killing players at spawn points or safe zones is strictly prohibited.', severity: 'ban' },
    ],
  },
  {
    name: 'Building Rules',
    icon: '🏗️',
    rules: [
      { id: 13, title: 'No Griefing', description: 'Destroying, damaging, or modifying another player\'s builds without their permission is griefing and is strictly prohibited.', severity: 'ban' },
      { id: 14, title: 'Claim Your Land', description: 'Use the land claiming system to protect your builds. Unclaimed builds may not be protected from natural server resets.', severity: 'info' },
      { id: 15, title: 'No Inappropriate Builds', description: 'Buildings that contain offensive, NSFW, or hateful imagery are not allowed and will be removed.', severity: 'ban' },
      { id: 16, title: 'Respect Build Spacing', description: 'Leave reasonable distance between your builds and other players\' builds. Don\'t build too close to someone without their permission.', severity: 'info' },
    ],
  },
  {
    name: 'Punishments',
    icon: '⚠️',
    rules: [
      { id: 17, title: 'Warning System', description: 'Minor infractions result in warnings. After 3 warnings, further action will be taken, including temporary mutes or bans.', severity: 'info' },
      { id: 18, title: 'Temporary Bans', description: 'Moderate offenses may result in a temporary ban (1-30 days depending on severity). Repeat offenders face longer bans.', severity: 'warning' },
      { id: 19, title: 'Permanent Bans', description: 'Severe offenses (hacking, doxxing, extreme harassment) result in an immediate permanent ban with no appeal.', severity: 'ban' },
      { id: 20, title: 'Appeals Process', description: 'If you believe a punishment was unfair, you can appeal through our contact page. Include your username, punishment, and why you think it should be reversed.', severity: 'info' },
    ],
  },
];

const SEVERITY_STYLES = {
  info: { bg: 'rgba(59, 130, 246, 0.1)', border: 'rgba(59, 130, 246, 0.3)', color: '#3b82f6', label: 'Info' },
  warning: { bg: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.3)', color: '#f59e0b', label: 'Warning' },
  ban: { bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.3)', color: '#ef4444', label: 'Bannable' },
};

function RuleAccordion({ category }: { category: RuleCategory }) {
	const [open, setOpen] = useState(false);
	const accordionId = `rules-${category.name.toLowerCase().replace(/\s+/g, '-')}`;

	return (
		<div style={{
			borderRadius: 'var(--radius-lg)',
			border: '1px solid var(--border-color)',
			overflow: 'hidden',
			background: 'var(--bg-card)',
			marginBottom: '12px',
		}}>
			<button
				onClick={() => setOpen(!open)}
				aria-expanded={open}
				aria-controls={accordionId}
				style={{
					width: '100%',
					padding: '20px 24px',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
					background: 'none',
					border: 'none',
					cursor: 'pointer',
					color: 'var(--text-primary)',
					fontFamily: 'var(--font-display)',
					fontSize: '18px',
					fontWeight: 700,
				}}
			>
				<span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
					<span style={{ fontSize: '24px' }} aria-hidden="true">{category.icon}</span>
					{category.name}
					<span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 400 }}>
						({category.rules.length} rules)
					</span>
				</span>
				<motion.span
					animate={{ rotate: open ? 180 : 0 }}
					transition={{ duration: 0.2 }}
					style={{ fontSize: '20px', color: 'var(--text-muted)' }}
					aria-hidden="true"
				>
					▼
				</motion.span>
			</button>

			<AnimatePresence>
				{open && (
					<motion.div
						id={accordionId}
						initial={{ height: 0, opacity: 0 }}
						animate={{ height: 'auto', opacity: 1 }}
						exit={{ height: 0, opacity: 0 }}
						transition={{ duration: 0.3 }}
						style={{ overflow: 'hidden' }}
						role="region"
						aria-labelledby={accordionId}
					>
						<div style={{ padding: '0 24px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
							{category.rules.map((rule) => {
								const sev = SEVERITY_STYLES[rule.severity];
								return (
									<div
										key={rule.id}
										style={{
											padding: '16px 20px',
											borderRadius: 'var(--radius-md)',
											background: sev.bg,
											borderLeft: `3px solid ${sev.color}`,
										}}
									>
										<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
											<h4 style={{
												fontFamily: 'var(--font-display)',
												fontSize: '15px',
												fontWeight: 700,
												color: 'var(--text-primary)',
											}}>
												#{rule.id} — {rule.title}
											</h4>
											<span style={{
												padding: '2px 10px',
												borderRadius: 'var(--radius-full)',
												fontSize: '11px',
												fontWeight: 700,
												textTransform: 'uppercase',
												letterSpacing: '0.05em',
												background: sev.bg,
												border: `1px solid ${sev.border}`,
												color: sev.color,
											}}>
												{sev.label}
											</span>
										</div>
										<p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
											{rule.description}
										</p>
									</div>
								);
							})}
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}

export default function RulesPage() {
  return (
    <div style={{ padding: '40px 0 100px' }}>
      <div className="site-container" style={{ maxWidth: '800px' }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(32px, 5vw, 48px)',
            fontWeight: 900,
            marginBottom: '16px',
          }}>
            Server <span className="gradient-text">Rules</span>
          </h1>
          <p style={{ fontSize: '17px', color: 'var(--text-secondary)', maxWidth: '500px', margin: '0 auto' }}>
            Play fair, be kind, and have fun. Breaking these rules may result in warnings, mutes, or bans.
          </p>
        </div>

        {/* Important Notice */}
        <div style={{
          padding: '20px 24px',
          borderRadius: 'var(--radius-lg)',
          background: 'rgba(245, 158, 11, 0.08)',
          border: '1px solid rgba(245, 158, 11, 0.2)',
          marginBottom: '32px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
        }}>
          <span style={{ fontSize: '24px' }}>⚠️</span>
          <div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: 700, color: 'var(--color-accent)', marginBottom: '4px' }}>
              Important Notice
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              By joining Hideout SMP, you agree to follow all rules listed below. Staff reserves the right to enforce rules not explicitly listed here if behaviour is deemed harmful to the community. Rules may be updated — check back regularly.
            </p>
          </div>
        </div>

        {/* Categories */}
        {RULE_CATEGORIES.map((cat) => (
          <RuleAccordion key={cat.name} category={cat} />
        ))}

        {/* Last updated */}
        <p style={{ textAlign: 'center', marginTop: '32px', fontSize: '13px', color: 'var(--text-muted)' }}>
          Last updated: March 2026 • Questions? <a href="/contact" style={{ color: 'var(--color-primary)' }}>Contact us</a>
        </p>
      </div>
    </div>
  );
}
