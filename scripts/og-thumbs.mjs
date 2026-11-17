// Homepage thumbnails of the post artwork that `npm run og` crops. The crops
// stay 1200px wide for the share cards; the homepage's "lately" row shows the
// art at most 244×183 CSS px, cropped to fill 4:3, so a 560px-wide WebP is
// sharp on 2x screens at a fraction of the size (prose-diff: 154 KB → ~40 KB).
// `npm run og` calls this after cropping; it also runs on its own:
//
//   node scripts/og-thumbs.mjs                 # every crop in static/images/og/art
//   node scripts/og-thumbs.mjs prose-diff      # one post

import { mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ART_DIR = "static/images/og/art";
const THUMB_DIR = join(ART_DIR, "thumbs");
const WIDTH = 560;

/** @param {string[]} [ids] posts to thumbnail; every crop when empty */
export async function makeThumbs(ids = []) {
  const all = readdirSync(ART_DIR)
    .filter((f) => f.endsWith(".jpg"))
    .map((f) => f.slice(0, -4));
  const posts = ids.length ? ids.filter((id) => all.includes(id)) : all;
  mkdirSync(THUMB_DIR, { recursive: true });
  for (const id of posts) {
    const out = join(THUMB_DIR, `${id}.webp`);
    const { size } = await sharp(join(ART_DIR, `${id}.jpg`))
      .resize({ width: WIDTH, withoutEnlargement: true })
      .webp({ quality: 80, effort: 6 })
      .toFile(out);
    console.log(`  ${out} (${Math.round(size / 1024)} KB)`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await makeThumbs(process.argv.slice(2).filter((a) => !a.startsWith("--")));
}
