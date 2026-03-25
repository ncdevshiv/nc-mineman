import type {Metadata} from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { ThemeProvider } from '@/components/site/ThemeProvider';
import { DebugToaster } from '@/components/ui/error-debug-toast';
import siteConfig from '@/lib/site.config';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: {
    default: siteConfig.seo.title,
    template: siteConfig.seo.titleTemplate,
  },
  description: siteConfig.seo.description,
  keywords: siteConfig.seo.keywords,
  openGraph: {
    title: siteConfig.seo.openGraph.title,
    description: siteConfig.seo.openGraph.description,
    siteName: siteConfig.seo.openGraph.siteName,
    type: 'website',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  const themeKey = siteConfig.auth.themeKey;

  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <head>
        {/* Prevent flash of wrong theme */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function() {
  try {
    var t = localStorage.getItem('${themeKey}');
    if (t) { document.documentElement.setAttribute('data-theme', t); }
    else if (window.matchMedia('(prefers-color-scheme: light)').matches) { document.documentElement.setAttribute('data-theme', 'light'); }
    else { document.documentElement.setAttribute('data-theme', 'dark'); }
  } catch(e) { document.documentElement.setAttribute('data-theme', 'dark'); }
})();
`,
          }}
        />
      </head>
      <body suppressHydrationWarning>
        <ThemeProvider>
          {children}
          <DebugToaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
