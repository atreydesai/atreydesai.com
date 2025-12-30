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
const THUMB_WIDTH = 800;  // Width for grid thumbnails
const THUMB_QUALITY = 80; // WebP quality (0-100)

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
    const destPath = join(THUMBS_DIR, `${name}.webp`);

    // Check if thumbnail exists and is up-to-date
    if (!(await needsUpdate(srcPath, destPath))) {
        return { filename, status: 'skipped' };
    }

    try {
        await sharp(srcPath)
            .resize(THUMB_WIDTH, null, {
                withoutEnlargement: true,
                fit: 'inside'
            })
            .webp({ quality: THUMB_QUALITY })
            .toFile(destPath);

        return { filename, status: 'optimized' };
    } catch (err) {
        return { filename, status: 'error', error: err.message };
    }
}

async function main() {
    console.log('📸 Optimizing photography thumbnails...\n');

    await ensureDir(THUMBS_DIR);

    const files = await readdir(PHOTOS_DIR);
    const imageFiles = files.filter(f =>
        /\.(jpg|jpeg|png|webp)$/i.test(f) && !f.startsWith('.')
    );

    console.log(`Found ${imageFiles.length} images\n`);

    const results = await Promise.all(imageFiles.map(optimizePhoto));

    const optimized = results.filter(r => r.status === 'optimized');
    const skipped = results.filter(r => r.status === 'skipped');
    const errors = results.filter(r => r.status === 'error');

    console.log(`✅ Optimized: ${optimized.length}`);
    console.log(`⏭️  Skipped (up-to-date): ${skipped.length}`);

    if (errors.length > 0) {
        console.log(`❌ Errors: ${errors.length}`);
        errors.forEach(e => console.log(`   - ${e.filename}: ${e.error}`));
    }

    console.log('\n✨ Done! Thumbnails saved to:', THUMBS_DIR);
}

main().catch(console.error);
