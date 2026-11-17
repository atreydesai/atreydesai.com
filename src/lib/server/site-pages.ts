// The site's public pages, shared by sitemap.xml and llms-full.txt so the
// two can't drift apart. Blog posts come from $lib/content.

export type SitePage = {
    path: string;
    sources: string[];
};

// Static pages. `sources` lists the files/directories that materially change
// each page's rendered content, so <lastmod> is not just the deploy/build date.
// <changefreq> and <priority> are omitted: Google ignores both.
export const SITE_PAGES: SitePage[] = [
    {
        path: '/',
        sources: ['src/routes/+page.svelte', 'src/content/homepage.yaml', 'src/content/papers'],
    },
    {
        path: '/about/',
        sources: ['src/routes/about/+page.svelte', 'src/content/about.yaml'],
    },
    {
        path: '/research/',
        sources: ['src/routes/research/+page.svelte', 'src/content/papers', 'src/content/talks.yaml'],
    },
    {
        path: '/blog/',
        sources: ['src/routes/blog/+page.svelte', 'src/content/posts'],
    },
    {
        path: '/photography/',
        sources: [
            'src/routes/photography/+page.svelte',
            'src/routes/photography/+page.server.ts',
            'static/images/photography',
        ],
    },
    {
        path: '/bookshelf/',
        sources: [
            'src/routes/bookshelf/+page.svelte',
            'src/content/books',
            'src/content/categories.yaml',
        ],
    },
    {
        path: '/atreydesai_cv.pdf',
        sources: ['static/atreydesai_cv.pdf'],
    },
    {
        path: '/cv/',
        sources: [
            'src/routes/cv/+page.svelte',
            'src/routes/cv/+page.server.ts',
            'src/content/cv.yaml',
            'static/atreydesai_cv.pdf',
        ],
    },
];
