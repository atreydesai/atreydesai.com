import { posts } from '$lib/content';
import { error, redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const prerender = false;

export const load: PageLoad = ({ params }) => {
    const index = posts.findIndex((p) => p.id === params.slug);
    if (index === -1) {
        throw error(404, 'Post not found');
    }
    if (posts[index].externalUrl) {
        throw redirect(307, posts[index].externalUrl);
    }
    return {
        post: posts[index],
        prevPost: findAdjacentInternalPost(index, 1),
        nextPost: findAdjacentInternalPost(index, -1),
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
