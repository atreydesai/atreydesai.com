import { defineParams } from "@sveltejs/kit/params";

export const params = defineParams({
    // A post's slug: lowercase words joined by hyphens, never a file name.
    // Without this, /blog/index.md (the blog index's Markdown) matched
    // /blog/[slug], whose trailing-slash redirect sent it to /blog/index.md/,
    // a 404.
    post: (param) => (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(param) ? param : undefined),
});
