import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About',
};

export default function AboutPage() {
  return (
    <div style={{ padding: '40px 0 100px' }}>
      <div className="site-container" style={{ maxWidth: '900px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '64px' }}>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(32px, 5vw, 48px)',
            fontWeight: 900,
            marginBottom: '16px',
          }}>
            About <span className="gradient-text">Hideout SMP</span>
          </h1>
          <p style={{ fontSize: '17px', color: 'var(--text-secondary)', maxWidth: '500px', margin: '0 auto' }}>
            The story behind the server and the community that makes it special
          </p>
        </div>

        {/* Story Section */}
        <div style={{
          padding: '40px',
          borderRadius: 'var(--radius-xl)',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          marginBottom: '32px',
        }}>
          <h2 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '28px',
            fontWeight: 800,
            marginBottom: '20px',
          }}>
            Our Story 📖
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '15px', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
            <p>
              Hideout SMP was born from a simple idea: create a Minecraft server where <strong style={{ color: 'var(--text-primary)' }}>everyone gets a fair shot</strong>. No pay-to-win. No unfair advantages. Just pure survival gameplay where your dedication and skill determine your success.
            </p>
            <p>
              Backed by <a href="https://youtube.com/@SrishtiPlayz" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>SrishtiPlayz</a>, we built this server for the community — by the community. Whether you're a long-time fan or a new player discovering us for the first time, Hideout SMP is your place to call home.
            </p>
            <p>
              We believe that the best gaming experiences come from equal opportunities. That's why our grind-to-upgrade system ensures every player progresses based on their own effort, not their spending power.
            </p>
          </div>
        </div>

        {/* Values */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '20px',
          marginBottom: '32px',
        }}>
          {[
            { icon: '⚖️', title: 'Fair Play', desc: 'Equal starting conditions for everyone. No advantages can be bought — only earned through gameplay.' },
            { icon: '🤝', title: 'Community First', desc: 'Every decision we make prioritizes the community. Player feedback shapes the server.' },
            { icon: '🏆', title: 'Grind to Greatness', desc: 'Progress through dedication. Our ranking and economy systems reward time and skill.' },
            { icon: '🛡️', title: 'Safe Environment', desc: 'Zero tolerance for toxicity, cheating, and griefing. Everyone deserves to feel welcome.' },
          ].map((value) => (
            <div
              key={value.title}
              className="card-hover"
              style={{
                padding: '28px',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
              }}
            >
              <div style={{ fontSize: '36px', marginBottom: '16px' }}>{value.icon}</div>
              <h3 style={{
                fontFamily: 'var(--font-display)',
                fontSize: '18px',
                fontWeight: 700,
                marginBottom: '8px',
                color: 'var(--text-primary)',
              }}>
                {value.title}
              </h3>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {value.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Team */}
        <div style={{
          padding: '40px',
          borderRadius: 'var(--radius-xl)',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          marginBottom: '32px',
        }}>
          <h2 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '28px',
            fontWeight: 800,
            marginBottom: '24px',
            textAlign: 'center',
          }}>
            The Team 👥
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '20px',
          }}>
            {[
              { name: 'SrishtiPlayz', role: 'Founder & Content Creator', color: '#f59e0b' },
              { name: 'Admin Team', role: 'Server Management & Moderation', color: '#ef4444' },
              { name: 'Builders', role: 'Spawn, Arenas & World Design', color: '#3b82f6' },
              { name: 'Developers', role: 'Plugins, Systems & Website', color: '#22c55e' },
            ].map((member) => (
              <div
                key={member.name}
                style={{
                  padding: '24px',
                  borderRadius: 'var(--radius-lg)',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  textAlign: 'center',
                }}
              >
                <div style={{
                  width: 56,
                  height: 56,
                  borderRadius: 'var(--radius-full)',
                  background: `${member.color}20`,
                  border: `2px solid ${member.color}50`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px',
                  fontSize: '24px',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  color: member.color,
                }}>
                  {member.name[0]}
                </div>
                <h3 style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '16px',
                  fontWeight: 700,
                  marginBottom: '4px',
                  color: 'var(--text-primary)',
                }}>
                  {member.name}
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{member.role}</p>
              </div>
            ))}
          </div>
        </div>

        {/* SrishtiPlayz Connection */}
        <div style={{
          padding: '32px',
          borderRadius: 'var(--radius-xl)',
          background: 'rgba(239, 68, 68, 0.06)',
          border: '1px solid rgba(239, 68, 68, 0.15)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎬</div>
          <h2 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '24px',
            fontWeight: 800,
            marginBottom: '12px',
          }}>
            Part of the SrishtiPlayz Universe
          </h2>
          <p style={{
            fontSize: '15px',
            color: 'var(--text-secondary)',
            maxWidth: '500px',
            margin: '0 auto 20px',
            lineHeight: 1.7,
          }}>
            SrishtiPlayz members and subscribers get priority access during whitelist events. Subscribe and be part of the adventure!
          </p>
          <a
            href="https://youtube.com/@SrishtiPlayz"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-block',
              padding: '12px 28px',
              borderRadius: 'var(--radius-full)',
              background: '#ef4444',
              color: '#fff',
              fontWeight: 700,
              fontSize: '15px',
            }}
          >
            Subscribe to SrishtiPlayz ↗
          </a>
        </div>
      </div>
    </div>
  );
}
