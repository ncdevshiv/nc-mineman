import type { Metadata } from 'next';

export interface SiteConfig {
  name: { short: string; full: string; domain: string };
  brand: {
    tagline: string;
    description: string;
    serverIp: string;
    logo: { letter: string; colors: { from: string; to: string } };
  };
  urls: { app: string; server: string; store: string; youtube: string; discord: string; support: string };
  social: { youtube: string; discord: string; discordInvite: string };
  contact: { email: string };
  auth: { cookieName: string; themeKey: string };
  seo: {
    title: string;
    titleTemplate: string;
    description: string;
    keywords: string[];
    openGraph: { title: string; description: string; siteName: string };
  };
  roles: { name: string; color: string; description: string }[];
  ports: { serverStats: number; websocket: number };
}

const DEFAULTS = {
  SITE_NAME_SHORT: 'Hideout',
  SITE_NAME_FULL: 'Hideout SMP',
  SITE_DOMAIN: 'hideoutsmp.com',
  SITE_TAGLINE: 'Free-to-Play Minecraft Server',
  SITE_DESCRIPTION: 'Join our Minecraft server for an amazing multiplayer experience.',
  SERVER_IP: 'play.hideoutsmp.com',
  LOGO_LETTER: 'H',
  LOGO_COLOR_FROM: '#10b981',
  LOGO_COLOR_TO: '#059669',
  YOUTUBE_URL: 'https://youtube.com/@YourChannel',
  DISCORD_URL: 'https://discord.gg/your-invite',
  DISCORD_INVITE: 'your-invite',
  STORE_URL: 'https://store.hideoutsmp.com',
  SUPPORT_EMAIL: 'support@hideoutsmp.com',
  COOKIE_NAME: 'app_session',
  THEME_KEY: 'app-theme',
  SERVER_STATS_PORT: '8088',
  WEBSOCKET_PORT: '8089',
  SPACETIMEDB_PORT: '3001',
};

function getEnv(key: keyof typeof DEFAULTS): string {
  return process.env[key] || DEFAULTS[key];
}

function getPort(key: keyof typeof DEFAULTS): number {
  return parseInt(getEnv(key));
}

const siteConfig: SiteConfig = {
  name: {
    short: getEnv('SITE_NAME_SHORT'),
    full: getEnv('SITE_NAME_FULL'),
    domain: getEnv('SITE_DOMAIN'),
  },
  brand: {
    tagline: getEnv('SITE_TAGLINE'),
    description: getEnv('SITE_DESCRIPTION'),
    serverIp: getEnv('SERVER_IP'),
    logo: {
      letter: getEnv('LOGO_LETTER'),
      colors: {
        from: getEnv('LOGO_COLOR_FROM'),
        to: getEnv('LOGO_COLOR_TO'),
      },
    },
  },
  urls: {
    app: process.env.APP_URL || `https://${getEnv('SITE_DOMAIN')}`,
    server: process.env.SERVER_URL || `https://${getEnv('SITE_DOMAIN')}`,
    store: getEnv('STORE_URL'),
    youtube: getEnv('YOUTUBE_URL'),
    discord: getEnv('DISCORD_URL'),
    support: getEnv('DISCORD_URL'),
  },
  social: {
    youtube: getEnv('YOUTUBE_URL'),
    discord: getEnv('DISCORD_URL'),
    discordInvite: getEnv('DISCORD_INVITE'),
  },
  contact: {
    email: getEnv('SUPPORT_EMAIL'),
  },
  auth: {
    cookieName: getEnv('COOKIE_NAME'),
    themeKey: getEnv('THEME_KEY'),
  },
  seo: {
    title: `${getEnv('SITE_NAME_FULL')} — ${getEnv('SITE_TAGLINE')}`,
    titleTemplate: `%s | ${getEnv('SITE_NAME_FULL')}`,
    description: getEnv('SITE_DESCRIPTION'),
    keywords: ['Minecraft', 'SMP', 'server', getEnv('SITE_NAME_FULL'), 'free to play', 'survival multiplayer'],
    openGraph: {
      title: `${getEnv('SITE_NAME_FULL')} — ${getEnv('SITE_TAGLINE')}`,
      description: getEnv('SITE_DESCRIPTION'),
      siteName: getEnv('SITE_NAME_FULL'),
    },
  },
  roles: [
    { name: 'owner', color: 'red', description: 'Full system control' },
    { name: 'admin', color: 'amber', description: 'Full authorization' },
    { name: 'god', color: 'purple', description: 'Ceremonial with moderation' },
    { name: 'helper', color: 'blue', description: 'Ticket management, QA' },
    { name: 'youtuber', color: 'pink', description: 'Creator role' },
    { name: 'member', color: 'gray', description: 'Default member access' },
  ],
  ports: {
    serverStats: getPort('SERVER_STATS_PORT'),
    websocket: getPort('WEBSOCKET_PORT'),
  },
};

export function getSiteName(): string {
  return siteConfig.name.full;
}

export function getServerIp(): string {
  return siteConfig.brand.serverIp;
}

export function getBaseUrl(): string {
  return siteConfig.urls.app;
}

export function getThemeKey(): string {
  return siteConfig.auth.themeKey;
}

export function getCookieName(): string {
  return siteConfig.auth.cookieName;
}

export function getRoleColor(role: string): string {
  const roleConfig = siteConfig.roles.find(r => r.name === role);
  return roleConfig?.color || 'gray';
}

export function getRoleDescription(role: string): string {
  const roleConfig = siteConfig.roles.find(r => r.name === role);
  return roleConfig?.description || '';
}

export function generateMetadata(): Metadata {
  return {
    title: { default: siteConfig.seo.title, template: siteConfig.seo.titleTemplate },
    description: siteConfig.seo.description,
    keywords: siteConfig.seo.keywords,
    openGraph: {
      title: siteConfig.seo.openGraph.title,
      description: siteConfig.seo.openGraph.description,
      siteName: siteConfig.seo.openGraph.siteName,
      type: 'website',
    },
  };
}

export default siteConfig;
