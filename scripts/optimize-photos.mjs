#!/usr/bin/env node

/**
 * Generate optimized thumbnails for photography page
 * Run with: node scripts/optimize-photos.mjs
 */

import sharp from 'sharp';
import { readdir, mkdir, stat, readFile, writeFile } from 'fs/promises';
import { join, parse } from 'path';
import { extractPhotoMeta } from './photo-exif.mjs';

const PHOTOS_DIR = 'static/images/photography';
const THUMBS_DIR = 'static/images/photography/thumbs';
const GENERATED_DIR = 'src/lib/generated';
// EXIF/dimension cache used to avoid re-reading every full-size JPG when the
// build regenerates the production-safe photo manifest.
const META_PATH = join(THUMBS_DIR, 'photo-meta.json');
const MANIFEST_PATH = join(GENERATED_DIR, 'photo-manifest.json');
// Hand-written captions, keyed by filename. Photos with no IPTC/XMP title and
// no entry here stay untitled rather than falling back to their filename.
const CAPTIONS_PATH = 'scripts/photo-captions.json';
// Bump when extractPhotoMeta's output shape changes so the mtime-keyed cache
// re-extracts instead of serving stale fields.
const META_VERSION = 2;

// Thumbnail settings
const THUMB_WIDTH = 800;  // Default grid thumbnail width (keeps the bare name)
const THUMB_QUALITY = 80; // WebP quality (0-100)
// Extra widths emitted for the responsive srcset (named `${name}-${w}.webp`).
const SRCSET_WIDTHS = [400, 1200];

async function ensureDir(dir) {
    try {
        await mkdir(dir, { recursive: true });
    } catch (err) {
        if (err.code !== 'EEXIST') throw err;
    }
}

async function needsUpdate(srcPath, destPath) {
    try {
        const [srcStat, destStat] = await Promise.all([
            stat(srcPath),
            stat(destPath)
        ]);
        return srcStat.mtime > destStat.mtime;
    } catch {
        return true; // Destination doesn't exist
    }
}

async function optimizePhoto(filename) {
    const srcPath = join(PHOTOS_DIR, filename);
    const { name } = parse(filename);

    // The 800px default keeps its bare name (used as the <img> src); the other
    // widths get a `-${w}` suffix and feed the responsive srcset.
    const targets = [
        { dest: join(THUMBS_DIR, `${name}.webp`), width: THUMB_WIDTH },
        ...SRCSET_WIDTHS.map((w) => ({
            dest: join(THUMBS_DIR, `${name}-${w}.webp`),
            width: w,
        })),
    ];

    let optimized = 0;
    for (const { dest, width } of targets) {
        if (!(await needsUpdate(srcPath, dest))) continue;
        try {
            await sharp(srcPath)
                .resize(width, null, { withoutEnlargement: true, fit: 'inside' })
                .webp({ quality: THUMB_QUALITY })
                .toFile(dest);
            optimized++;
        } catch (err) {
            return { filename, status: 'error', error: err.message };
        }
    }

    return { filename, status: optimized > 0 ? 'optimized' : 'skipped' };
}

// Resize + webp conversion for a single source file.
// width: target width (won't enlarge); quality: webp quality 0-100.
async function toWebp(srcPath, destPath, width, quality) {
    if (!(await needsUpdate(srcPath, destPath))) {
        return { src: srcPath, status: 'skipped' };
    }
    try {
        await sharp(srcPath)
            .resize(width, null, { withoutEnlargement: true, fit: 'inside' })
            .webp({ quality })
            .toFile(destPath);
        return { src: srcPath, status: 'optimized' };
    } catch (err) {
        return { src: srcPath, status: 'error', error: err.message };
    }
}

async function optimizePhotography() {
    console.log('📸 Optimizing photography thumbnails...');
    await ensureDir(THUMBS_DIR);
    const files = await readdir(PHOTOS_DIR);
    const imageFiles = files.filter(f =>
        /\.(jpg|jpeg|png|webp)$/i.test(f) && !f.startsWith('.')
    );
    const results = await Promise.all(imageFiles.map(optimizePhoto));
    summarize(results);
}

async function optimizeProfile() {
    console.log('\n👤 Optimizing profile image...');
    const src = 'static/images/profile.JPG';
    const dest = 'static/images/profile.webp';
    const result = await toWebp(src, dest, 500, 82);
    summarize([{ filename: 'profile.webp', ...result }]);
}

async function optimizePapers() {
    console.log('\n📄 Optimizing paper preview images...');
    const PAPERS_DIR = 'static/images/papers';
    const files = await readdir(PAPERS_DIR);
    const imageFiles = files.filter(f =>
        /\.(jpg|jpeg|png)$/i.test(f) && !f.startsWith('.')
    );
    const results = await Promise.all(imageFiles.map(async (filename) => {
        const srcPath = join(PAPERS_DIR, filename);
        const { name } = parse(filename);
        const destPath = join(PAPERS_DIR, `${name}.webp`);
        const r = await toWebp(srcPath, destPath, 800, 70);
        return { filename, ...r };
    }));
    summarize(results);
}

async function extractMetadata() {
    console.log('\n🏷️  Extracting photo metadata...');
    const files = await readdir(PHOTOS_DIR);
    const imageFiles = files.filter(f =>
        /\.(jpg|jpeg|png|webp)$/i.test(f) && !f.startsWith('.')
    );

    /** @type {Record<string, import('./photo-exif.mjs').PhotoMeta & { mtimeMs: number }>} */
    let cache = {};
    try {
        const raw = JSON.parse(await readFile(META_PATH, 'utf-8'));
        if (raw.__version === META_VERSION) cache = raw.photos ?? {};
    } catch {
        // no cache yet — extract everything
    }

    /** @type {Record<string, string>} */
    let captionOverrides = {};
    try {
        const raw = JSON.parse(await readFile(CAPTIONS_PATH, 'utf-8'));
        // Keys starting with `_` are notes (e.g. `_readme`), not captions.
        captionOverrides = Object.fromEntries(
            Object.entries(raw).filter(([key]) => !key.startsWith('_')),
        );
    } catch {
        // no overrides file — captions come from embedded metadata only
    }

    /** @type {typeof cache} */
    const meta = {};
    let extracted = 0;
    for (const filename of imageFiles) {
        const srcPath = join(PHOTOS_DIR, filename);
        const { mtimeMs } = await stat(srcPath);
        const cached = cache[filename];
        if (cached && cached.mtimeMs === mtimeMs) {
            meta[filename] = cached;
            continue;
        }
        const buffer = await readFile(srcPath);
        meta[filename] = { mtimeMs, ...extractPhotoMeta(buffer, filename) };
        extracted++;
    }

    await writeFile(META_PATH, JSON.stringify({ __version: META_VERSION, photos: meta }));
    console.log(`   ✅ Extracted: ${extracted}   ⏭️  Cached: ${imageFiles.length - extracted}`);

    // Vercel serves files from static/, but they are not available for a
    // serverless function to enumerate at request time. Bundle a manifest
    // into the app so the photography route never depends on runtime disk
    // access.
    const photos = imageFiles.map((filename) => {
        const { name } = parse(filename);
        const { mtimeMs: _mtimeMs, caption: embedded, ...photoMeta } = meta[filename];
        // Precedence: hand-written override > embedded IPTC/XMP title > none.
        // A missing caption means the photo is presentational: it gets an empty
        // alt and no visible title, rather than a filename dressed up as one.
        const caption = (captionOverrides[filename] ?? embedded ?? '').trim();

        return {
            src: `/images/photography/${filename}`,
            thumbSrc: `/images/photography/thumbs/${name}.webp`,
            thumbSrcset: [
                `/images/photography/thumbs/${name}-400.webp 400w`,
                `/images/photography/thumbs/${name}.webp 800w`,
                `/images/photography/thumbs/${name}-1200.webp 1200w`,
            ].join(', '),
            caption: caption || undefined,
            alt: caption,
            filename,
            ...photoMeta,
        };
    });

    photos.sort((a, b) => {
        if (a.exif.date && b.exif.date) return b.exif.date.localeCompare(a.exif.date);
        if (a.exif.date) return -1;
        if (b.exif.date) return 1;
        return a.filename.localeCompare(b.filename);
    });

    await ensureDir(GENERATED_DIR);
    await writeFile(MANIFEST_PATH, `${JSON.stringify(photos, null, 2)}\n`);
    console.log(`   📋 Manifest: ${photos.length} photos`);
}

function summarize(results) {
    const optimized = results.filter(r => r.status === 'optimized');
    const skipped = results.filter(r => r.status === 'skipped');
    const errors = results.filter(r => r.status === 'error');
    console.log(`   ✅ Optimized: ${optimized.length}   ⏭️  Skipped: ${skipped.length}${errors.length ? `   ❌ Errors: ${errors.length}` : ''}`);
    if (errors.length > 0) {
        errors.forEach(e => console.log(`   - ${e.filename || e.src}: ${e.error}`));
    }
}

async function main() {
    await optimizePhotography();
    await extractMetadata();
    await optimizeProfile();
    await optimizePapers();
    console.log('\n✨ Done!');
}

main().catch(console.error);
