// Build step for the photography page and the homepage portrait: WebP
// renditions of every photo, an EXIF/caption manifest bundled into the app,
// and the profile.webp hero image. Runs before every production build.
//
// Rendition names are content-addressed (src/lib/photo-urls.js): a file that
// already exists is already correct, so a rebuild only encodes photos that are
// new or changed, and stale files are swept away at the end. Encoded files are
// kept in node_modules/.cache, which Vercel restores between builds, and
// copied into static/ from there.

import sharp from 'sharp';
import { createHash } from 'crypto';
import { access, copyFile, mkdir, readdir, readFile, rename, stat, unlink, writeFile } from 'fs/promises';
import { join } from 'path';
import { extractPhotoMeta } from './photo-exif.mjs';
import {
    AVIF_QUALITY,
    ORIGINALS_DIR,
    RENDITION_QUALITY,
    RENDITION_VERSION,
    renditionFile,
    renditionFormats,
    renditionWidths,
} from '../src/lib/photo-urls.js';

const PHOTOS_DIR = ORIGINALS_DIR;
const THUMBS_DIR = 'static/images/photography/thumbs';
const CACHE_DIR = 'node_modules/.cache/photo-renditions';
const GENERATED_DIR = 'src/lib/generated';
// Per-photo cache of EXIF, dimensions, and the content hash, keyed by mtime
// and size, so a local rebuild doesn't re-read every full-size JPEG. It lives
// outside static/ so it is never deployed.
const META_FILE = 'photo-meta.json';
const META_PATH = join(CACHE_DIR, META_FILE);
const MANIFEST_PATH = join(GENERATED_DIR, 'photo-manifest.json');
// Hand-written captions, keyed by filename. Photos with no IPTC/XMP title and
// no entry here stay untitled rather than falling back to their filename.
const CAPTIONS_PATH = 'scripts/photo-captions.json';
// Plain descriptions of what each photo shows, keyed by filename. These are the
// alt text only (what a screen reader or an AI agent gets); unlike a caption
// they never appear as a visible title.
const ALTS_PATH = 'scripts/photo-alts.json';
// Bump when the cached fields change shape so the cache re-extracts instead
// of serving stale ones.
const META_VERSION = 3;

const isPhoto = (f) => /\.(jpg|jpeg|png|webp)$/i.test(f) && !f.startsWith('.');

async function exists(path) {
    try {
        await access(path);
        return true;
    } catch {
        return false;
    }
}

async function readJson(path, fallback) {
    try {
        return JSON.parse(await readFile(path, 'utf-8'));
    } catch {
        return fallback;
    }
}

/**
 * EXIF, displayed dimensions, byte size, and a content hash for each photo,
 * reusing the cache for files whose mtime and size are unchanged.
 */
async function readPhotos(filenames) {
    const raw = await readJson(META_PATH, {});
    const cache = raw.__version === META_VERSION ? (raw.photos ?? {}) : {};

    const photos = {};
    let extracted = 0;
    for (const filename of filenames) {
        const srcPath = join(PHOTOS_DIR, filename);
        const { mtimeMs, size } = await stat(srcPath);
        const cached = cache[filename];
        if (cached && cached.mtimeMs === mtimeMs && cached.bytes === size) {
            photos[filename] = cached;
            continue;
        }
        const buffer = await readFile(srcPath);
        const { autoOrient } = await sharp(buffer).metadata();
        photos[filename] = {
            mtimeMs,
            bytes: size,
            sha: createHash('sha256').update(buffer).digest('hex'),
            ...extractPhotoMeta(buffer, filename),
            // sharp's upright dimensions are the ones the renditions get, so
            // they win over the EXIF reading.
            width: autoOrient.width,
            height: autoOrient.height,
        };
        extracted++;
    }

    await writeFile(META_PATH, JSON.stringify({ __version: META_VERSION, photos }));
    console.log(`   ✅ Read: ${extracted}   ⏭️  Cached: ${filenames.length - extracted}`);
    return photos;
}

/** The rendition hash: the original's bytes plus the encoding settings. */
function versionOf(sha) {
    return createHash('sha256')
        .update(`${RENDITION_VERSION}:${RENDITION_QUALITY}:${AVIF_QUALITY}:${sha}`)
        .digest('hex')
        .slice(0, 10);
}

/**
 * Make sure every rendition is in static/: copied from the build cache when it
 * was encoded before, encoded into the cache first when it wasn't. Returns the
 * set of file names that should exist.
 */
async function writeRenditions(entries) {
    const expected = new Set();
    const jobs = [];
    for (const photo of entries) {
        for (const width of renditionWidths(photo)) {
            for (const format of renditionFormats(width)) {
                const file = renditionFile(photo, width, format);
                expected.add(file);
                jobs.push({ photo, width, format, file });
            }
        }
    }

    let encoded = 0;
    let copied = 0;
    const errors = [];
    await Promise.all(
        jobs.map(async ({ photo, width, format, file }) => {
            const dest = join(THUMBS_DIR, file);
            if (await exists(dest)) return;
            const cached = join(CACHE_DIR, file);
            try {
                if (await exists(cached)) {
                    copied++;
                } else {
                    // Written aside and renamed into place: the name promises
                    // finished content, so a build killed mid-encode must not
                    // leave a truncated file under it.
                    const partial = `${cached}.partial`;
                    const resized = sharp(join(PHOTOS_DIR, photo.filename))
                        .autoOrient()
                        .resize(width, null, { withoutEnlargement: true });
                    await (format === 'avif'
                        ? resized.avif({ quality: AVIF_QUALITY, effort: 4 })
                        : resized.webp({ quality: RENDITION_QUALITY })
                    ).toFile(partial);
                    await rename(partial, cached);
                    encoded++;
                }
                await copyFile(cached, dest);
            } catch (err) {
                errors.push(`${photo.filename} @${width} ${format}: ${err.message}`);
            }
        }),
    );

    const current = jobs.length - encoded - copied - errors.length;
    console.log(
        `   ✅ Encoded: ${encoded}   📦 From cache: ${copied}   ⏭️  In place: ${current}` +
            (errors.length ? `   ❌ Errors: ${errors.length}` : ''),
    );
    for (const error of errors) console.log(`   - ${error}`);
    if (errors.length) process.exitCode = 1;
    return expected;
}

/** Remove renditions no current photo or setting refers to. */
async function sweep(dir, expected) {
    let removed = 0;
    for (const file of await readdir(dir)) {
        if (expected.has(file) || file === META_FILE || file.startsWith('.')) continue;
        await unlink(join(dir, file));
        removed++;
    }
    if (removed) console.log(`   🧹 Removed ${removed} stale files from ${dir}`);
}

async function optimizePhotography() {
    console.log('📸 Photography renditions and manifest...');
    await mkdir(THUMBS_DIR, { recursive: true });
    await mkdir(CACHE_DIR, { recursive: true });
    const filenames = (await readdir(PHOTOS_DIR)).filter(isPhoto);
    const meta = await readPhotos(filenames);

    // Keys starting with `_` are notes (e.g. `_readme`), not captions.
    const captionOverrides = Object.fromEntries(
        Object.entries(await readJson(CAPTIONS_PATH, {})).filter(([key]) => !key.startsWith('_')),
    );
    const altDescriptions = await readJson(ALTS_PATH, {});

    // Vercel serves files from static/, but a serverless function can't list
    // them at request time, so the manifest is bundled into the app instead.
    // It carries only facts; photo-urls.js turns them into URLs.
    const photos = filenames.map((filename) => {
        const { mtimeMs: _m, sha, caption: embedded, ...photoMeta } = meta[filename];
        // Precedence: hand-written override > embedded IPTC/XMP title > none.
        const caption = (captionOverrides[filename] ?? embedded ?? '').trim();
        // Alt text describes what the photo shows; the caption is a title, so
        // it is only the fallback. A photo with neither gets an empty alt.
        const alt = (altDescriptions[filename] ?? caption).trim();
        return {
            filename,
            v: versionOf(sha),
            caption: caption || undefined,
            alt,
            ...photoMeta,
        };
    });

    photos.sort((a, b) => {
        if (a.exif.date && b.exif.date) return b.exif.date.localeCompare(a.exif.date);
        if (a.exif.date) return -1;
        if (b.exif.date) return 1;
        return a.filename.localeCompare(b.filename);
    });

    const expected = await writeRenditions(photos);
    await sweep(THUMBS_DIR, expected);
    await sweep(CACHE_DIR, expected);

    await mkdir(GENERATED_DIR, { recursive: true });
    await writeFile(MANIFEST_PATH, `${JSON.stringify(photos, null, 2)}\n`);
    console.log(`   📋 Manifest: ${photos.length} photos`);
}

async function optimizeProfile() {
    console.log('\n👤 Profile image...');
    const src = 'static/images/profile.JPG';
    const dest = 'static/images/profile.webp';
    const [srcStat, destStat] = await Promise.all([stat(src), stat(dest).catch(() => null)]);
    if (destStat && destStat.mtime >= srcStat.mtime) {
        console.log('   ⏭️  Up to date');
        return;
    }
    await sharp(src).autoOrient().resize(500, null, { withoutEnlargement: true }).webp({ quality: 82 }).toFile(dest);
    console.log('   ✅ Encoded');
}

async function main() {
    const started = performance.now();
    await optimizePhotography();
    await optimizeProfile();
    console.log(`\n✨ Done in ${((performance.now() - started) / 1000).toFixed(1)}s`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
