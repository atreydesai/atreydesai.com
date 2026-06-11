import { posts } from '$lib/content';
import type { RequestHandler } from './$types';

export const prerender = true;

const siteUrl = 'https://atreydesai.com';

// Static pages with their crawl hints; lastmod comes from the last git commit
// (injected at build time), so the sitemap stays current without hand-editing.
const pages: Array<{ path: string; changefreq: string; priority: string }> = [
    { path: '/', changefreq: 'weekly', priority: '1.0' },
    { path: '/about', changefreq: 'monthly', priority: '0.8' },
    { path: '/research', changefreq: 'weekly', priority: '0.9' },
    { path: '/blog', changefreq: 'weekly', priority: '0.8' },
    { path: '/photography', changefreq: 'monthly', priority: '0.7' },
    { path: '/bookshelf', changefreq: 'weekly', priority: '0.7' },
    { path: '/resume', changefreq: 'monthly', priority: '0.6' },
    { path: '/cv', changefreq: 'monthly', priority: '0.6' },
];

export const GET: RequestHandler = () => {
    const buildDate = __BUILD_DATE__.slice(0, 10);

    const staticUrls = pages.map(
        (page) => `
  <url>
    <loc>${siteUrl}${page.path}</loc>
    <lastmod>${buildDate}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`
    );

    const postUrls = posts.map(
        (post) => `
  <url>
    <loc>${siteUrl}/blog/${post.id}</loc>
    <lastmod>${new Date(post.date).toISOString().slice(0, 10)}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`
    );

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${staticUrls.join('')}${postUrls.join('')}
</urlset>`;

    return new Response(xml, {
        headers: {
            'Content-Type': 'application/xml',
            'Cache-Control': 'max-age=0, s-maxage=3600',
        },
    });
};
