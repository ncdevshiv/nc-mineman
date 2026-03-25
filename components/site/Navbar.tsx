'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from './ThemeProvider';
import { motion, AnimatePresence } from 'motion/react';
import siteConfig from '@/lib/site.config';

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/rules', label: 'Rules' },
  { href: '/wiki', label: 'Wiki' },
  { href: '/store', label: 'Store' },
  { href: '/social', label: 'Social' },
  { href: '/status', label: 'Status' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

export function Navbar() {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [user, setUser] = useState<{ email: string; role: string; roles?: string[] } | null>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  return (
    <>
      <nav className={`fixed top-0 left-0 right-0 z-50 px-4 md:px-6 transition-all duration-300 ${scrolled ? 'py-2' : 'py-4'}`}>
        <div className="site-container flex items-center justify-between glass-effect rounded-[1.25rem] px-6 py-3 border border-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
          {/* Logo */}
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 'var(--radius-sm)',
            background: `linear-gradient(135deg, ${siteConfig.brand.logo.colors.from} 0%, ${siteConfig.brand.logo.colors.to} 100%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: '16px',
            color: '#fff',
            letterSpacing: '-0.02em',
            boxShadow: '0 0 20px rgba(16, 185, 129, 0.4)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
          }}>
            {siteConfig.brand.logo.letter}
          </div>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: '20px',
            color: 'var(--text-primary)',
            letterSpacing: '-0.02em',
          }}>
            {siteConfig.name.short}<span style={{ color: 'var(--color-primary)' }}>{siteConfig.name.full.replace(siteConfig.name.short, '')}</span>
          </span>
        </Link>

          {/* Desktop Nav */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} className="nav-desktop">
            {NAV_LINKS.map((link) => {
              const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '14px',
                    fontWeight: 500,
                    color: isActive ? 'var(--color-primary)' : 'var(--text-secondary)',
                    background: isActive ? 'var(--color-primary-glow)' : 'transparent',
                    transition: 'all var(--transition-fast)',
                    position: 'relative',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.color = 'var(--text-primary)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.color = 'var(--text-secondary)';
                  }}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          {/* Right Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Theme Toggle */}
            <button
              onClick={toggle}
              aria-label="Toggle theme"
              style={{
                width: 40,
                height: 40,
                borderRadius: 'var(--radius-full)',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-card)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
                color: 'var(--text-secondary)',
                fontSize: '18px',
              }}
            >
              <motion.span
                key={theme}
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                {theme === 'dark' ? '☀️' : '🌙'}
              </motion.span>
            </button>

            {/* Auth Button */}
            {user ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} className="nav-desktop">
                {(user.role === 'admin' || user.roles?.some(r => ['admin', 'owner'].includes(r))) && (
                  <>
                    <Link
                      href="/admin/visual-editor"
                      style={{
                        padding: '8px 16px',
                        borderRadius: 'var(--radius-full)',
                        fontSize: '14px',
                        fontWeight: 600,
                        background: 'var(--gradient-accent)',
                        color: '#fff',
                        transition: 'all var(--transition-fast)',
                      }}
                    >
                      Store CMS
                    </Link>
                    <Link
                      href="/admin/roles"
                      style={{
                        padding: '8px 16px',
                        borderRadius: 'var(--radius-full)',
                        fontSize: '14px',
                        fontWeight: 600,
                        background: 'var(--gradient-accent)',
                        color: '#fff',
                        transition: 'all var(--transition-fast)',
                      }}
                    >
                      Roles
                    </Link>
                  </>
                )}
                <Link
                  href="/profile"
                  style={{
                    padding: '8px 16px',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '14px',
                    fontWeight: 500,
                    border: '1px solid var(--color-primary)',
                    color: 'var(--color-primary)',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  Profile
                </Link>
                <a
                  href="/api/auth/logout"
                  style={{
                    padding: '8px 16px',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '14px',
                    fontWeight: 500,
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-secondary)',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  Logout
                </a>
              </div>
            ) : (
              <button
                onClick={() => { window.location.href = '/api/auth/login'; }}
                className="nav-desktop"
                style={{
                  padding: '8px 20px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '14px',
                  fontWeight: 600,
                  background: 'var(--gradient-primary)',
                  color: '#fff',
                  transition: 'all var(--transition-fast)',
                  textDecoration: 'none',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Login
              </button>
            )}

            {/* Mobile Hamburger */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="nav-mobile-btn glass-effect"
              aria-label="Toggle menu"
              style={{
                display: 'none',
                width: 44,
                height: 44,
                borderRadius: '14px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                background: 'rgba(255, 255, 255, 0.05)',
                cursor: 'pointer',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
                backdropFilter: 'blur(8px)',
              }}
            >
              <span style={{
                width: 18,
                height: 2,
                background: 'var(--text-primary)',
                borderRadius: 2,
                transition: 'all var(--transition-fast)',
                transform: menuOpen ? 'rotate(45deg) translate(2.5px, 2.5px)' : 'none',
              }} />
              <span style={{
                width: 18,
                height: 2,
                background: 'var(--text-primary)',
                borderRadius: 2,
                transition: 'all var(--transition-fast)',
                opacity: menuOpen ? 0 : 1,
              }} />
              <span style={{
                width: 18,
                height: 2,
                background: 'var(--text-primary)',
                borderRadius: 2,
                transition: 'all var(--transition-fast)',
                transform: menuOpen ? 'rotate(-45deg) translate(2.5px, -2.5px)' : 'none',
              }} />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 99,
              background: 'rgba(0,0,0,0.5)',
            }}
            onClick={() => setMenuOpen(false)}
          >
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-strong"
              style={{
                position: 'absolute',
                right: '12px',
                top: '12px',
                bottom: '12px',
                width: 'calc(100% - 24px)',
                maxWidth: '320px',
                borderRadius: '24px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                padding: '80px 24px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              }}
            >
              {NAV_LINKS.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    style={{
                      padding: '14px 16px',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '16px',
                      fontWeight: 500,
                      color: isActive ? 'var(--color-primary)' : 'var(--text-primary)',
                      background: isActive ? 'var(--color-primary-glow)' : 'transparent',
                    }}
                  >
                    {link.label}
                  </Link>
                );
              })}
              <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '16px', paddingTop: '16px' }}>
                {user ? (
                  <>
                    {(user.role === 'admin' || user.roles?.some(r => ['admin', 'owner'].includes(r))) && (
                      <>
                        <Link
                          href="/admin/visual-editor"
                          style={{
                            display: 'block',
                            padding: '14px 16px',
                            borderRadius: 'var(--radius-md)',
                            fontSize: '16px',
                            fontWeight: 600,
                            background: 'var(--gradient-accent)',
                            color: '#fff',
                            textAlign: 'center',
                            marginBottom: '8px',
                          }}
                        >
                          Store CMS
                        </Link>
                        <Link
                          href="/admin/roles"
                          style={{
                            display: 'block',
                            padding: '14px 16px',
                            borderRadius: 'var(--radius-md)',
                            fontSize: '16px',
                            fontWeight: 600,
                            background: 'var(--gradient-accent)',
                            color: '#fff',
                            textAlign: 'center',
                            marginBottom: '8px',
                          }}
                        >
                          Roles
                        </Link>
                      </>
                    )}
                    <Link
                      href="/profile"
                      style={{
                        display: 'block',
                        padding: '14px 16px',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '16px',
                        fontWeight: 500,
                        border: '1px solid var(--color-primary)',
                        color: 'var(--color-primary)',
                        textAlign: 'center',
                        marginBottom: '8px',
                      }}
                    >
                      Profile
                    </Link>
                    <a
                      href="/api/auth/logout"
                      style={{
                        display: 'block',
                        padding: '14px 16px',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '16px',
                        fontWeight: 500,
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-secondary)',
                        textAlign: 'center',
                      }}
                    >
                      Logout
                    </a>
                  </>
                ) : (
                  <button
                    onClick={() => { window.location.href = '/api/auth/login'; }}
                    style={{
                      display: 'block',
                      padding: '14px 16px',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '16px',
                      fontWeight: 600,
                      background: 'var(--gradient-primary)',
                      color: '#fff',
                      textAlign: 'center',
                      border: 'none',
                      cursor: 'pointer',
                      width: '100%',
                    }}
                  >
                    Login
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Responsive CSS */}
      <style>{`
        @media (max-width: 768px) {
          .nav-desktop { display: none !important; }
          .nav-mobile-btn { display: flex !important; }
        }
      `}</style>
    </>
  );
}
