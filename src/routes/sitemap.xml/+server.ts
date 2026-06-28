import { posts } from '$lib/content';
import { execFileSync } from 'child_process';
import type { RequestHandler } from './$types';

export const prerender = true;

const siteUrl = 'https://atreydesai.com';

type SitemapPage = {
    path: string;
    changefreq: string;
    priority: string;
    sources: string[];
};

const postModules = import.meta.glob<Record<string, unknown>>('/src/content/posts/*.md', {
    eager: true,
});
const postSourcesById = Object.fromEntries(
    Object.entries(postModules).map(([path, mod]) => [String(mod.id), toGitPath(path)])
);

// Static pages with their crawl hints. `sources` lists the files/directories
// that materially change each page's rendered content, so <lastmod> is not just
// the deploy/build date.
const pages: SitemapPage[] = [
    {
        path: '/',
        changefreq: 'weekly',
        priority: '1.0',
        sources: ['src/routes/+page.svelte', 'src/content/homepage.yaml', 'src/content/papers'],
    },
    {
        path: '/about/',
        changefreq: 'monthly',
        priority: '0.8',
        sources: ['src/routes/about/+page.svelte', 'src/content/about.yaml'],
    },
    {
        path: '/research/',
        changefreq: 'weekly',
        priority: '0.9',
        sources: ['src/routes/research/+page.svelte', 'src/content/papers', 'src/content/talks.yaml'],
    },
    {
        path: '/blog/',
        changefreq: 'weekly',
        priority: '0.8',
        sources: ['src/routes/blog/+page.svelte', 'src/content/posts'],
    },
    {
        path: '/photography/',
        changefreq: 'monthly',
        priority: '0.7',
        sources: [
            'src/routes/photography/+page.svelte',
            'src/routes/photography/+page.server.ts',
            'static/images/photography',
        ],
    },
    {
        path: '/bookshelf/',
        changefreq: 'weekly',
        priority: '0.7',
        sources: [
            'src/routes/bookshelf/+page.svelte',
            'src/content/books',
            'src/content/categories.yaml',
        ],
    },
    {
        path: '/resume/',
        changefreq: 'monthly',
        priority: '0.6',
        sources: ['src/routes/resume/+page.svelte', 'static/resume.pdf'],
    },
    {
        path: '/cv/',
        changefreq: 'monthly',
        priority: '0.6',
        sources: [
            'src/routes/cv/+page.svelte',
            'src/routes/cv/+page.server.ts',
            'src/content/cv.yaml',
            'static/cv.pdf',
        ],
    },
];

export const GET: RequestHandler = () => {
    const staticUrls = pages.map(
        (page) => `
  <url>
    <loc>${siteUrl}${page.path}</loc>
    <lastmod>${lastModified(page.sources)}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`
    );

    const postUrls = posts.map(
        (post) => `
  <url>
    <loc>${siteUrl}/blog/${post.id}/</loc>
    <lastmod>${lastModified([postSourcesById[post.id]].filter(Boolean), post.date)}</lastmod>
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
