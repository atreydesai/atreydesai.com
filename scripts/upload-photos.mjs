// Puts every photo file the site links into the Cloudflare R2 bucket it serves
// them from (PHOTOS_ORIGIN in src/lib/photo-urls.js): each original from
// photos/ and each rendition from RENDITIONS_DIR. Run it after adding or
// re-exporting a photo, before pushing:
//
//   npm run optimize-photos && npm run upload-photos
//
// It lists the bucket (Cloudflare API, with Wrangler's sign-in) for the files it lacks (an original also counts as missing
// when its size differs) and uploads only those, a few at a time, so a rerun
// is cheap. It never deletes: pages cached before a re-export still point at
// the old renditions. Needs `npx wrangler login` once. The Vercel build never
// runs this (it has no Cloudflare credentials); it only checks the bucket.

import { execFile } from 'child_process';
import { access, readFile } from 'fs/promises';
import { promisify } from 'util';
import { bucketListing, expectedObjects, mapLimit, missingFromListing } from './photo-bucket.mjs';
import { PHOTOS_BUCKET } from '../src/lib/photo-urls.js';

const run = promisify(execFile);
const manifest = JSON.parse(await readFile('src/lib/generated/photo-manifest.json', 'utf-8'));
const objects = expectedObjects(manifest);
const missing = missingFromListing(objects, await bucketListing());
console.log(`☁️  ${objects.length - missing.length} of ${objects.length} files already in ${PHOTOS_BUCKET}`);

const absent = [];
for (const o of missing) await access(o.file).catch(() => absent.push(o.file));
if (absent.length) {
    console.error(`❌ ${absent.length} files to upload aren't on disk (first: ${absent[0]}). Run npm run optimize-photos first.`);
    process.exit(1);
}

let done = 0;
await mapLimit(missing, 8, async (o) => {
    const headers = o.original
        ? [
              '--content-disposition',
              `attachment; filename="${o.key.split('/').pop()}"`,
              '--cache-control',
              'public, max-age=86400, stale-while-revalidate=2592000',
          ]
        : ['--cache-control', 'public, max-age=31536000, immutable'];
    await run('npx', [
        '-y',
        'wrangler@4',
        'r2',
        'object',
        'put',
        `${PHOTOS_BUCKET}/${o.key}`,
        '--remote',
        '--file',
        o.file,
        '--content-type',
        o.type,
        ...headers,
    ]);
    done++;
    if (done % 25 === 0 || done === missing.length) console.log(`⬆️  ${done}/${missing.length}`);
});

const still = missingFromListing(missing, await bucketListing());
if (still.length) {
    console.error(`❌ ${still.length} files still missing after upload (first: ${still[0].key})`);
    process.exit(1);
}
console.log(`✨ ${missing.length} uploaded; the bucket holds all ${objects.length} files`);
