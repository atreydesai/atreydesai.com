// What the R2 photo bucket should hold for the current manifest, and what it
// is missing. Shared by optimize-photos (which fails a Vercel build that would
// link a file the bucket doesn't have) and upload-photos (which fills it).

import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import {
    ORIGINALS_DIR,
    ORIGINALS_KEY,
    PHOTOS_BUCKET,
    PHOTOS_ORIGIN,
    RENDITIONS_DIR,
    RENDITIONS_KEY,
    renditionFile,
    renditionFormats,
    renditionWidths,
} from '../src/lib/photo-urls.js';

const TYPES = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', avif: 'image/avif' };

/**
 * Every object the bucket must hold: each original (with its byte count, so a
 * re-export under the same name counts as missing) and each rendition.
 */
export function expectedObjects(photos) {
    const objects = [];
    for (const photo of photos) {
        objects.push({
            key: ORIGINALS_KEY + photo.filename,
            file: join(ORIGINALS_DIR, photo.filename),
            bytes: photo.bytes,
            original: true,
        });
        for (const width of renditionWidths(photo)) {
            for (const format of renditionFormats(width)) {
                const file = renditionFile(photo, width, format);
                objects.push({ key: RENDITIONS_KEY + file, file: join(RENDITIONS_DIR, file) });
            }
        }
    }
    return objects.map((o) => ({ ...o, type: TYPES[o.key.split('.').pop().toLowerCase()] }));
}

/** Run `fn` over `items`, `limit` at a time. */
export async function mapLimit(items, limit, fn) {
    const results = new Array(items.length);
    let next = 0;
    await Promise.all(
        Array.from({ length: Math.min(limit, items.length) }, async () => {
            while (next < items.length) {
                const i = next++;
                results[i] = await fn(items[i], i);
            }
        }),
    );
    return results;
}

const ACCOUNT_ID = '904a2fda60a7be759d343e4c20ada187';

/**
 * Wrangler's OAuth token, refreshed first (any wrangler command refreshes an
 * expired one), or CLOUDFLARE_API_TOKEN when set.
 */
function cloudflareToken() {
    if (process.env.CLOUDFLARE_API_TOKEN) return process.env.CLOUDFLARE_API_TOKEN;
    execFileSync('npx', ['-y', 'wrangler@4', 'whoami'], { stdio: 'ignore' });
    for (const dir of [join(homedir(), 'Library/Preferences/.wrangler'), join(homedir(), '.config/.wrangler'), join(homedir(), '.wrangler')]) {
        try {
            const toml = readFileSync(join(dir, 'config/default.toml'), 'utf-8');
            const token = toml.match(/^oauth_token\s*=\s*"([^"]+)"/m)?.[1];
            if (token) return token;
        } catch {}
    }
    throw new Error('Not signed in to Cloudflare: run `npx wrangler login`.');
}

/** Every key in the bucket and its size, from the Cloudflare API. */
export async function bucketListing() {
    const token = cloudflareToken();
    const sizes = new Map();
    let cursor = '';
    do {
        const url = new URL(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/r2/buckets/${PHOTOS_BUCKET}/objects`);
        url.searchParams.set('per_page', '1000');
        if (cursor) url.searchParams.set('cursor', cursor);
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        const body = await res.json();
        if (!body.success) throw new Error(`Listing ${PHOTOS_BUCKET}: ${JSON.stringify(body.errors)}`);
        for (const o of body.result) sizes.set(o.key, o.size);
        cursor = body.result_info?.is_truncated ? body.result_info.cursor : '';
    } while (cursor);
    return sizes;
}

/** The objects the bucket lacks, or holds at a different size, per a listing. */
export function missingFromListing(objects, sizes) {
    return objects.filter(({ key, bytes }) => !sizes.has(key) || (bytes !== undefined && sizes.get(key) !== bytes));
}

/**
 * The objects the site's photo host doesn't serve. For the Vercel build, which
 * has no Cloudflare credentials: it asks PHOTOS_ORIGIN (r2.dev rate-limits a
 * burst of requests) and checks presence only, since Cloudflare's cache can
 * hold an older size for a day.
 */
export async function missingFromHost(objects, limit = 16) {
    const present = await mapLimit(objects, limit, async ({ key }) => {
        for (let attempt = 0; ; attempt++) {
            try {
                const res = await fetch(`${PHOTOS_ORIGIN}/${encodeURI(key)}`, { method: 'HEAD' });
                if (res.status === 404) return false;
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return true;
            } catch (err) {
                if (attempt === 3) throw new Error(`${key}: ${err.message}`);
                await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
            }
        }
    });
    return objects.filter((_, i) => !present[i]);
}
