import { posts } from '$lib/content';
import { SITE_URL } from '$lib/seo';
import { formatUtcDate } from '$lib/utils/date';
import type { RequestHandler } from './$types';

export const prerender = true;

export const GET: RequestHandler = () => {
    const items = posts
        .map(
            (post) => `
    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${SITE_URL}/blog/${post.id}/</link>
      <guid isPermaLink="true">${SITE_URL}/blog/${post.id}/</guid>
      <description>${escapeXml(post.excerpt)}</description>
      <pubDate>${formatUtcDate(post.date)}</pubDate>
      ${post.tags.map((tag) => `<category>${escapeXml(tag)}</category>`).join('\n      ')}
    </item>`
        )
        .join('');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Atrey Desai - Blog</title>
    <link>${SITE_URL}/blog/</link>
    <description>Blog posts and writings by Atrey Desai on AI, research, and more.</description>
    <language>en-us</language>
    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml" />
    ${items}
  </channel>
</rss>`;

    return new Response(xml.trim(), {
        headers: {
            'Content-Type': 'application/xml',
            'Cache-Control': 'max-age=0, s-maxage=3600',
        },
    });
};

function escapeXml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}
