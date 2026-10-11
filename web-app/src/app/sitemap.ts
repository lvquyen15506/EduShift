import type { MetadataRoute } from 'next';
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  return ['', '/pricing', '/login', '/register', '/terms', '/privacy', '/support'].map(path => ({ url: base + path, lastModified: new Date(), changeFrequency: path === '' ? 'daily' : 'monthly', priority: path === '' ? 1 : 0.5 }));
}
