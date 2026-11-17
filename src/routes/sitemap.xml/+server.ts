import { posts } from '$lib/content';
import { SITE_URL } from '$lib/seo';
import { execFileSync } from 'child_process';
import { SITE_PAGES as pages } from '$lib/server/site-pages';
import type { RequestHandler } from './$types';

export const prerender = true;

const postModules = import.meta.glob<Record<string, unknown>>('/src/content/posts/*.md', {
    eager: true,
});
const postSourcesById = Object.fromEntries(
    Object.entries(postModules).map(([path, mod]) => [String(mod.id), toGitPath(path)])
);

export const GET: RequestHandler = () => {
    const staticUrls = pages.map(
        (page) => `
  <url>
    <loc>${SITE_URL}${page.path}</loc>
    <lastmod>${lastModified(page.sources)}</lastmod>
  </url>`
    );

    const postUrls = posts.filter((post) => !post.externalUrl).map(
        (post) => `
  <url>
    <loc>${SITE_URL}/blog/${post.id}/</loc>
    <lastmod>${lastModified([postSourcesById[post.id]].filter(Boolean), post.date)}</lastmod>
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

function toGitPath(path: string): string {
    return path.replace(/^\/+/, '');
}

function dateOnly(value: string): string {
    return new Date(value).toISOString().slice(0, 10);
}

function lastModified(paths: string[], fallback = __BUILD_DATE__): string {
    if (paths.length === 0) return dateOnly(fallback);

    try {
        const output = execFileSync('git', ['log', '-1', '--format=%cI', '--', ...paths], {
            encoding: 'utf-8',
        }).trim();
        if (output) return dateOnly(output.split('\n')[0]);
    } catch {
        // Git may be unavailable in non-repository build environments.
    }

    return dateOnly(fallback);
}
