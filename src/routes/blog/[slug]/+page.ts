import { posts } from '$lib/content';
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => {
    const post = posts.find((p) => p.id === params.slug);
    if (!post) {
        throw error(404, 'Post not found');
    }
    return { post };
};
