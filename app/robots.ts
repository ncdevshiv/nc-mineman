import { MetadataRoute } from 'next';
import siteConfig from '@/lib/site.config';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = siteConfig.urls.app;
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/api'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
