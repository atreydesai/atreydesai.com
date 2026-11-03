import { posts } from "$lib/content";
import { artPosition } from "$lib/og-art";
import type { PageServerLoad } from "./$types";

// The homepage's "lately" section: the three newest posts, with only the
// fields it renders.
export const load: PageServerLoad = () => ({
    lately: posts.slice(0, 3).map((post) => ({
        id: post.id,
        title: post.title,
        date: post.date,
        href: post.externalUrl ?? `/blog/${post.id}/`,
        externalSite: post.externalSite ?? null,
        // `npm run og` crops the art alongside the share card, so a post with
        // a card has a thumbnail; one without gets a plain tile.
        art: post.image ? `/images/og/art/${post.id}.jpg` : null,
        artPosition: artPosition(post.id),
    })),
});
