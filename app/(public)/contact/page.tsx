'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import siteConfig from '@/lib/site.config';

export default function ContactPage() {
const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' });
const [submitted, setSubmitted] = useState(false);

const handleSubmit = (e: React.FormEvent) => {
e.preventDefault();
setSubmitted(true);
};

const contactInfo = [
{ icon: '📺', title: 'YouTube', desc: siteConfig.social.youtube.replace('https://youtube.com/', ''), link: siteConfig.social.youtube },
{ icon: '🎮', title: 'Server Address', desc: siteConfig.brand.serverIp, link: null },
{ icon: '🛒', title: 'Store', desc: siteConfig.urls.store.replace('https://', ''), link: siteConfig.urls.store },
{ icon: '📧', title: 'Email', desc: siteConfig.contact.email, link: `mailto:${siteConfig.contact.email}` },
];

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
            <span className="gradient-text">Contact</span> Us
          </h1>
          <p style={{ fontSize: '17px', color: 'var(--text-secondary)', maxWidth: '500px', margin: '0 auto' }}>
            Have a question, suggestion, or need help? We'd love to hear from you.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '48px',
        }} className="contact-grid">

          {/* Contact Form */}
          <div>
            {submitted ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{
                  padding: '48px',
                  borderRadius: 'var(--radius-xl)',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 800, marginBottom: '12px' }}>
                  Message Sent!
                </h2>
                <p style={{ fontSize: '15px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
                  Thank you for reaching out. We'll get back to you as soon as possible.
                </p>
                <button
                  onClick={() => { setSubmitted(false); setFormData({ name: '', email: '', subject: '', message: '' }); }}
                  style={{
                    padding: '10px 24px',
                    borderRadius: 'var(--radius-full)',
                    background: 'var(--gradient-primary)',
                    color: '#fff',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '14px',
                  }}
                >
                  Send Another Message
                </button>
              </motion.div>
            ) : (
              <form
                onSubmit={handleSubmit}
                style={{
                  padding: '32px',
                  borderRadius: 'var(--radius-xl)',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '20px',
                }}
              >
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-tertiary)',
                      color: 'var(--text-primary)',
                      fontSize: '15px',
                      fontFamily: 'inherit',
                      transition: 'border-color var(--transition-fast)',
                      outline: 'none',
                    }}
                    placeholder="Your name"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-tertiary)',
                      color: 'var(--text-primary)',
                      fontSize: '15px',
                      fontFamily: 'inherit',
                      transition: 'border-color var(--transition-fast)',
                      outline: 'none',
                    }}
                    placeholder="your@email.com"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Subject
                  </label>
                  <select
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-tertiary)',
                      color: 'var(--text-primary)',
                      fontSize: '15px',
                      fontFamily: 'inherit',
                      cursor: 'pointer',
                      outline: 'none',
                    }}
                  >
                    <option value="">Select a subject...</option>
                    <option value="general">General Inquiry</option>
                    <option value="appeal">Ban Appeal</option>
                    <option value="report">Player Report</option>
                    <option value="partnership">Partnership/Collab</option>
                    <option value="bug">Bug Report</option>
                    <option value="store">Store Issue</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Message
                  </label>
                  <textarea
                    required
                    rows={5}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-tertiary)',
                      color: 'var(--text-primary)',
                      fontSize: '15px',
                      fontFamily: 'inherit',
                      resize: 'vertical',
                      outline: 'none',
                    }}
                    placeholder="Tell us what's on your mind..."
                  />
                </div>

                <button
                  type="submit"
                  style={{
                    padding: '14px 32px',
                    borderRadius: 'var(--radius-full)',
                    background: 'var(--gradient-primary)',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '16px',
                    fontFamily: 'var(--font-display)',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                    boxShadow: '0 4px 20px rgba(13, 148, 136, 0.3)',
                  }}
                >
                  Send Message
                </button>
              </form>
            )}
          </div>

{/* Contact Info Sidebar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {contactInfo.map((item) => (
      <div
      key={item.title}
      style={{
      padding: '24px',
      borderRadius: 'var(--radius-lg)',
      background: 'var(--bg-card)',
      border: '1px solid var(--border-color)',
      }}
      >
      <div style={{ fontSize: '28px', marginBottom: '12px' }}>{item.icon}</div>
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 700, marginBottom: '4px', color: 'var(--text-primary)' }}>
      {item.title}
      </h3>
      {item.link ? (
      <a
      href={item.link}
      target={item.link.startsWith('http') ? '_blank' : undefined}
      rel={item.link.startsWith('http') ? 'noopener noreferrer' : undefined}
      style={{ fontSize: '14px', color: 'var(--color-primary)', fontWeight: 500 }}
      >
      {item.desc}
      </a>
      ) : (
      <p style={{ fontSize: '14px', color: 'var(--text-secondary)', fontFamily: 'var(--font-code)' }}>{item.desc}</p>
      )}
      </div>
      ))}

            {/* Response Time */}
            <div style={{
              padding: '20px 24px',
              borderRadius: 'var(--radius-lg)',
              background: 'rgba(13, 148, 136, 0.06)',
              border: '1px solid rgba(13, 148, 136, 0.15)',
            }}>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                <strong style={{ color: 'var(--color-primary)' }}>⏱ Response Time:</strong> We typically respond within 24-48 hours. For urgent issues (e.g. server down), ping us on Discord.
              </p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .contact-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
