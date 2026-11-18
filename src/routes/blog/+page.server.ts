import { posts } from "#lib/content.ts";
import type { PageServerLoad } from "./$types";

// The list needs each post's metadata, not its body: read at build time (the
// page is prerendered) and sent without `content`.
export const load: PageServerLoad = () => ({
    posts: posts.map(({ content: _content, ...meta }) => meta),
});
