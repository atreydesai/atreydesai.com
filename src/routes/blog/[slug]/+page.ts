import { posts } from '$lib/content';
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const prerender = false;

export const load: PageLoad = ({ params }) => {
    const index = posts.findIndex((p) => p.id === params.slug);
    if (index === -1) {
        throw error(404, 'Post not found');
    }
    return {
        post: posts[index],
        prevPost: index + 1 < posts.length ? { id: posts[index + 1].id, title: posts[index + 1].title } : null,
        nextPost: index - 1 >= 0 ? { id: posts[index - 1].id, title: posts[index - 1].title } : null,
    };
};
