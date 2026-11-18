import { posts, unlistedPosts, draftPosts } from "#lib/content.ts";
import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

// The paper launch page has its own route (its own chrome and theme) but keeps the post entry's gating:
// while the entry is a draft it exists only in development, like any draft post.
// A server load (run at build time; the page is prerendered), so the browser
// gets this post's metadata rather than a script holding every post.
export const load: PageServerLoad = () => {
    const post = [...posts, ...unlistedPosts, ...draftPosts].find((p) => p.id === "who-wrote-this");
    if (!post) throw error(404, "Post not found");
    return { post };
};
