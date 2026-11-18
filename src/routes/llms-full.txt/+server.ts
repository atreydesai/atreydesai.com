import { posts } from '#lib/content.ts';
import { SITE_URL } from '#lib/seo.ts';
import { htmlToMarkdown, markdownPath } from '#lib/server/content-negotiation.js';
import { PAGE_CDN_CACHE } from '#lib/server/page-cache.js';
import { pageMarkdown } from '#lib/server/page-markdown.ts';
import { SITE_PAGES } from '#lib/server/site-pages.ts';
import type { RequestHandler } from './$types';

// Every public page as Markdown in one file, for agents that want the whole
// site in one request (the llms-full.txt companion to /llms.txt). Built from
// the same pages as the sitemap, once per deploy, like the pages themselves.
export const prerender = true;
export const trailingSlash = 'ignore';

// Who Atrey is and what he works on first; the long lists last, in their
// short forms (each points to its full Markdown).
const ORDER = ['/', '/about/', '/research/', '/cv/', '/blog/', '/bookshelf/', '/photography/'];

function fullSitePaths(): string[] {
    const pages = SITE_PAGES.map((page) => page.path).filter((path) => path.endsWith('/'));
    pages.sort((a, b) => rank(a) - rank(b));
    const postPaths = posts.filter((post) => !post.externalUrl).map((post) => `/blog/${post.id}/`);
    const blog = pages.indexOf('/blog/');
    return [...new Set([...pages.slice(0, blog + 1), ...postPaths, ...pages.slice(blog + 1)])];
}

function rank(path: string): number {
    const i = ORDER.indexOf(path);
    return i === -1 ? ORDER.length : i;
}

export const GET: RequestHandler = async ({ fetch }) => {
    const sections = await Promise.all(
        fullSitePaths().map(async (path) => {
            const url = `${SITE_URL}${path}`;
            let markdown = pageMarkdown(path, { brief: true });
            if (!markdown) {
                const response = await fetch(path, { headers: { accept: 'text/html' } });
                if (!response.ok) return null;
                markdown = htmlToMarkdown(await response.text(), url, { footer: false });
            }
            return `URL: ${url}\nMarkdown: ${SITE_URL}${markdownPath(path)}\n\n${markdown}`;
        })
    );

    const body = `# Atrey Desai: full site

> Every public page of atreydesai.com as Markdown, in one file: the homepage, about, research, CV, the blog and each post, then the bookshelf and the photography portfolio in short form. Each page starts with its URL. For a short index with guidance on which page answers what, read ${SITE_URL}/llms.txt instead.

${sections.filter(Boolean).join('\n\n---\n\n')}
`;

    return new Response(body, {
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'public, max-age=0, must-revalidate',
            'Vercel-CDN-Cache-Control': PAGE_CDN_CACHE,
            Link: `<${SITE_URL}/llms.txt>; rel="describedby"; type="text/plain"`,
        },
    });
};
