// Puts the photo originals (photos/) in the Cloudflare R2 bucket the site
// links its downloads to (ORIGINALS_BASE in src/lib/photo-urls.js). Run it
// after adding or re-exporting a photo, before pushing:
//
//   npm run upload-photos
//
// It asks the public URL for each file and uploads only the ones missing or a
// different size there, so a rerun is cheap. Needs `npx wrangler login` once.
// The Vercel build never runs this: it has no Cloudflare credentials, and the
// originals are not part of a deployment.

import { execFileSync } from 'child_process';
import { readdir, stat } from 'fs/promises';
import { join } from 'path';
import { ORIGINALS_BASE, ORIGINALS_BUCKET, ORIGINALS_DIR } from '../src/lib/photo-urls.js';

const isPhoto = (f) => /\.(jpe?g|png|webp)$/i.test(f) && !f.startsWith('.');
const TYPES = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

async function remoteSize(filename) {
    const res = await fetch(ORIGINALS_BASE + encodeURIComponent(filename), { method: 'HEAD' });
    if (!res.ok) return null;
    return Number(res.headers.get('content-length'));
}

const files = (await readdir(ORIGINALS_DIR)).filter(isPhoto).sort();
const force = process.argv.includes('--force');
let uploaded = 0;
for (const filename of files) {
    const path = join(ORIGINALS_DIR, filename);
    const { size } = await stat(path);
    if (!force && (await remoteSize(filename)) === size) continue;
    const ext = filename.split('.').pop().toLowerCase();
    console.log(`⬆️  ${filename} (${(size / 1e6).toFixed(1)} MB)`);
    execFileSync(
        'npx',
        [
            '-y',
            'wrangler@4',
            'r2',
            'object',
            'put',
            `${ORIGINALS_BUCKET}/${filename}`,
            '--remote',
            '--file',
            path,
            '--content-type',
            TYPES[ext],
            '--content-disposition',
            `attachment; filename="${filename}"`,
            '--cache-control',
            'public, max-age=86400, stale-while-revalidate=2592000',
        ],
        { stdio: ['ignore', 'ignore', 'inherit'] },
    );
    uploaded++;
}
console.log(`✨ ${uploaded} uploaded, ${files.length - uploaded} already in ${ORIGINALS_BUCKET}`);
