import { dev } from "$app/env";
import { error } from "@sveltejs/kit";

// Development only: never built (it answers 404 outside `vite dev`).
export const prerender = false;
import { posts, unlistedPosts, draftPosts } from "#lib/content.ts";
import type { PageLoad } from "./$types";

// Share-card layouts for `npm run og`; never part of the built site.
export const load: PageLoad = ({ params }) => {
	if (!dev) error(404, "Not found");
	const post = [...posts, ...unlistedPosts, ...draftPosts].find((p) => p.id === params.slug);
	if (!post) error(404, "Post not found");
	return { post };
};
