import { draftPosts, homepageData, posts, unlistedPosts, type Post } from '#lib/content.ts';
import { postSegments, readingTime, type Segment } from '#lib/post-segments.ts';
import { join } from 'node:path';
import sharp from 'sharp';
import { error, redirect } from '@sveltejs/kit';
import type { EntryGenerator, PageServerLoad } from './$types';

// Every post with a page here, linked or not: an unlisted post is reachable
// only by its URL, so the crawler would never find it. The paper launch page
// has its own route.
export const entries: EntryGenerator = () =>
    [...posts, ...unlistedPosts]
        .filter((post) => post.id !== 'who-wrote-this')
        .map((post) => ({ slug: post.id }));

// A server load (run at build time; the page is prerendered), so the browser
// gets this post's data rather than a script holding every post.
// The post footer's ways to write back.
const social = { email: homepageData.social.email, twitter: homepageData.social.twitter };

// The post as the page needs it: its body already rendered (the Markdown source stays here), and each of its
// images with its size, so the page holds the image's place before it arrives.
async function page(post: Post) {
    const { content, ...meta } = post;
    const segments = await withSizes(postSegments(content));
    // The prose-diff explainer's sample travels with its own post only.
    const proseDiffSample = segments.some((seg) => seg.type === 'prose-diff')
        ? (await import('#lib/prose-diff/sample.json')).default
        : null;
    return { post: meta, segments, readingTime: readingTime(content), proseDiffSample };
}

function withSizes(segments: Segment[]) {
    return Promise.all(
        segments.map(async (seg) => {
            if (seg.type !== 'image' || !seg.src.startsWith('/')) return seg;
            const { width, height } = await sharp(join('static', seg.src)).metadata();
            return { ...seg, width, height };
        }),
    );
}

export const load: PageServerLoad = async ({ params }) => {
    const index = posts.findIndex((p) => p.id === params.slug);
    if (index === -1) {
        const unlisted = unlistedPosts.find((post) => post.id === params.slug);
        if (unlisted) {
            if (unlisted.externalUrl) throw redirect(307, unlisted.externalUrl, { external: true });
            return { ...(await page(unlisted)), prevPost: null, nextPost: null, social };
        }
        const draft = draftPosts.find((post) => post.id === params.slug);
        if (draft) return { ...(await page(draft)), prevPost: null, nextPost: null, social };
        throw error(404, 'Post not found');
    }
    if (posts[index].externalUrl) {
        // A post that lives on another site (externalUrl) sends readers there.
        throw redirect(307, posts[index].externalUrl, { external: true });
    }
    return {
        ...(await page(posts[index])),
        prevPost: findAdjacentInternalPost(index, 1),
        nextPost: findAdjacentInternalPost(index, -1),
        social,
    };
};

function findAdjacentInternalPost(index: number, direction: 1 | -1) {
    for (let candidate = index + direction; candidate >= 0 && candidate < posts.length; candidate += direction) {
        if (!posts[candidate].externalUrl) {
            return { id: posts[candidate].id, title: posts[candidate].title };
        }
    }
    return null;
}
