#!/usr/bin/env node

/**
 * Generate optimized thumbnails for photography page
 * Run with: node scripts/optimize-photos.mjs
 */

import sharp from 'sharp';
import { readdir, mkdir, stat } from 'fs/promises';
import { join, parse } from 'path';

const PHOTOS_DIR = 'static/images/photography';
const THUMBS_DIR = 'static/images/photography/thumbs';

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
    await optimizeProfile();
    await optimizePapers();
    console.log('\n✨ Done!');
}

main().catch(console.error);
