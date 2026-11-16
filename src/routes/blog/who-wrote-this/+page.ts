import { posts, unlistedPosts, draftPosts } from "$lib/content";
import { error } from "@sveltejs/kit";
import type { PageLoad } from "./$types";

// The paper launch page has its own route (its own chrome and theme) but keeps the post entry's gating:
// while the entry is a draft it exists only in development, like any draft post.
export const load: PageLoad = () => {
    const post = [...posts, ...unlistedPosts, ...draftPosts].find((p) => p.id === "who-wrote-this");
    if (!post) throw error(404, "Post not found");
    return { post };
};
