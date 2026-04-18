import { execSync } from 'child_process';
import type { PageServerLoad } from './$types';

export const prerender = true;

export const load: PageServerLoad = () => {
    let cvLastUpdated = '';
    try {
        cvLastUpdated = execSync(
            'git log --follow --format="%ad" --date=format:"%B %Y" -- static/cv.pdf',
            { encoding: 'utf-8' }
        ).split('\n')[0].trim();
    } catch {
        cvLastUpdated = '';
    }
    return { cvLastUpdated };
};
