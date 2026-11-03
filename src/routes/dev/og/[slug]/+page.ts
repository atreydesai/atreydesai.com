import { dev } from "$app/environment";
import { error } from "@sveltejs/kit";
import { posts, unlistedPosts, draftPosts } from "$lib/content";
import type { PageLoad } from "./$types";

// Share-card layouts for `npm run og`; never part of the built site.
export const load: PageLoad = ({ params }) => {
	if (!dev) error(404, "Not found");
	const post = [...posts, ...unlistedPosts, ...draftPosts].find((p) => p.id === params.slug);
	if (!post) error(404, "Post not found");
	return { post };
};
