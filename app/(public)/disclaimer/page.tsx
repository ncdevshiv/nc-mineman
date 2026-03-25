import type { Metadata } from 'next';
import siteConfig from '@/lib/site.config';

export const metadata: Metadata = {
title: 'Disclaimer & Legal',
};

export default function DisclaimerPage() {
  const sectionStyle = {
    marginBottom: '48px',
  };

  const headingStyle = {
    fontFamily: 'var(--font-display)',
    fontSize: '24px',
    fontWeight: 800 as const,
    marginBottom: '16px',
    color: 'var(--text-primary)',
  };

  const paraStyle = {
    fontSize: '15px',
    color: 'var(--text-secondary)',
    lineHeight: 1.8,
    marginBottom: '12px',
  };

  return (
    <div style={{ padding: '40px 0 100px' }}>
      <div className="site-container" style={{ maxWidth: '800px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(32px, 5vw, 48px)',
            fontWeight: 900,
            marginBottom: '16px',
          }}>
            Legal & <span className="gradient-text">Disclaimer</span>
          </h1>
          <p style={{ fontSize: '15px', color: 'var(--text-muted)' }}>
            Last updated: March 2026
          </p>
        </div>

        <div style={{
          padding: '32px',
          borderRadius: 'var(--radius-xl)',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
        }}>
          {/* Disclaimer */}
          <div style={sectionStyle}>
            <h2 style={headingStyle}>📋 Disclaimer</h2>
            <p style={paraStyle}>
              Hideout SMP is an independently operated Minecraft server. <strong>We are NOT affiliated with, endorsed by, or associated with Mojang Studios, Microsoft Corporation, or any of their subsidiaries.</strong>
            </p>
            <p style={paraStyle}>
              "Minecraft" is a trademark of Mojang Studios. All game content and materials referenced are property of their respective owners.
            </p>
            <p style={paraStyle}>
              Hideout SMP is backed by the YouTube channel <a href="https://youtube.com/@SrishtiPlayz" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)' }}>SrishtiPlayz</a> and operates independently as a community project.
            </p>
          </div>

          {/* Terms of Service */}
          <div style={sectionStyle}>
            <h2 style={headingStyle}>📜 Terms of Service</h2>
            <p style={paraStyle}>By using Hideout SMP services (including the game server, website, and store), you agree to the following:</p>
            <ul style={{ paddingLeft: '24px', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
              {[
                'You must be at least 13 years old to use our services.',
                'You agree to follow all server rules posted on our Rules page.',
                'We reserve the right to ban, mute, or restrict any player at any time for rule violations.',
                'We may modify these terms at any time. Continued use constitutes acceptance.',
                'We are not responsible for any data loss, griefing, or in-game disputes between players.',
                'Chargebacks or fraudulent payment disputes may result in a permanent ban.',
                'Content you create on the server (builds, chat messages) may be featured in YouTube videos or promotional materials.',
              ].map((item, i) => (
                <li key={i} style={paraStyle}>{item}</li>
              ))}
            </ul>
          </div>

          {/* Privacy Policy */}
          <div style={sectionStyle}>
            <h2 style={headingStyle}>🔒 Privacy Policy</h2>
            <p style={paraStyle}>We take your privacy seriously. Here's what we collect and why:</p>

            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 700, marginTop: '20px', marginBottom: '8px', color: 'var(--text-primary)' }}>
              Information We Collect
            </h3>
            <ul style={{ paddingLeft: '24px', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              {[
                'Minecraft username and UUID (required for server access)',
                'IP address (for security and anti-cheat purposes)',
                'Email address (only if you create an account on our website or store)',
                'Chat logs and in-game activity (for moderation)',
                'Purchase history (if you buy from the store)',
              ].map((item, i) => (
                <li key={i} style={paraStyle}>{item}</li>
              ))}
            </ul>

            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 700, marginTop: '20px', marginBottom: '8px', color: 'var(--text-primary)' }}>
              How We Use Your Data
            </h3>
            <p style={paraStyle}>
              Your data is used solely for server operation, moderation, and security. We do <strong>not</strong> sell, share, or trade your personal information with third parties. Data may be shared with payment processors (for store purchases) and with law enforcement if required by law.
            </p>
          </div>

          {/* Refund Policy */}
          <div style={{ marginBottom: 0 }}>
            <h2 style={headingStyle}>💳 Refund Policy</h2>
            <p style={paraStyle}>
              All purchases made through <strong>{siteConfig.urls.store.replace('https://', '')}</strong> are final. However, we understand mistakes happen:
            </p>
            <ul style={{ paddingLeft: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                'Refund requests must be submitted within 48 hours of purchase.',
                'Refunds are only issued if the purchased item was not delivered or is not functioning as described.',
                'Duplicate purchases will be refunded.',
                'Refunds for change of mind are not guaranteed but may be considered on a case-by-case basis.',
                'Chargebacks without contacting us first will result in a permanent ban.',
              ].map((item, i) => (
                <li key={i} style={paraStyle}>{item}</li>
              ))}
            </ul>
          </div>
        </div>

        <p style={{ textAlign: 'center', marginTop: '32px', fontSize: '13px', color: 'var(--text-muted)' }}>
          Questions about our policies? <a href="/contact" style={{ color: 'var(--color-primary)' }}>Contact us</a>
        </p>
      </div>
    </div>
  );
}
