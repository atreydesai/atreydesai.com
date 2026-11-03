// Share cards for blog posts. Needs the dev server (`npm run dev`) and a
// local Chrome; run it after adding a post or changing its art:
//
//   npm run og                        # every post in ART
//   npm run og -- fruit-studies       # one post
//   npm run og -- --out=/tmp/og       # write the cards somewhere else
//   npm run og -- --no-art            # re-lay the cards over existing crops
//
// Two passes: the post's own artwork is cropped from its live page into
// static/images/og/art/, then /dev/og/<id> lays it out at 1200×630 and that
// is saved as static/images/og/<id>.jpg. Point the post's `image` field at it.

import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { capture } from "./capture.mjs";

const BASE = process.env.OG_BASE ?? "http://localhost:5173";

// Where each post's artwork lives on its page. `index` picks among matches;
// `maxHeight` cuts a tall tool down to its most telling first screen.
const ART = {
  // The fruit iframe paints its pigment marks some seconds after load, so
  // the crop is retried until it has real detail in it (`minDetail`).
  // A negative pad trims the stage's rounded corners, so the art's flat
  // ground can fill the card frame around it (see cardFit in $lib/og-art).
  "fruit-studies": { selector: ".fruit-studies iframe", maxHeight: 400, pad: -10, wait: 6000, minDetail: 20 },
  "shader-wallpapers": { selector: ".shader-figure canvas", index: 1, wait: 3000 },
  "prose-diff": { selector: ".pdv-main", maxHeight: 520, width: 1400 },
};

const args = process.argv.slice(2);
const flag = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const outDir = flag("out") ?? "static/images/og";
const ids = args.filter((a) => !a.startsWith("--"));
const posts = ids.length ? ids : Object.keys(ART);

for (const id of posts) {
  if (!ART[id]) throw new Error(`No artwork configured for ${id}; add it to ART in scripts/og.mjs.`);
}

mkdirSync(join(outDir), { recursive: true });

const recrop = !args.includes("--no-art");
if (recrop) console.log("Cropping artwork");
// The spread of the crop's pixel values: a stage that hasn't painted yet is
// one flat colour.
async function detail(png) {
  const { channels } = await sharp(png).stats();
  return Math.max(...channels.slice(0, 3).map((c) => c.stdev));
}

for (const id of recrop ? posts : []) {
  const { minDetail = 0, ...art } = ART[id];
  const shot = {
    url: `${BASE}/blog/${id}/`,
    out: `static/images/og/art/${id}.png`,
    width: art.width ?? 1200,
    height: 1600,
    scale: 2,
    ...art,
  };
  for (let attempt = 1; ; attempt++) {
    await capture([shot]);
    if ((await detail(shot.out)) >= minDetail) break;
    if (attempt === 4) throw new Error(`${id}: the artwork never finished drawing; try again.`);
    console.log(`  ${id}: not drawn yet, retrying`);
  }
}

// The crops stay in static/ as JPEGs: the cards read them, and so can any
// page that wants a thumbnail of the post.
for (const id of recrop ? posts : []) {
  const png = `static/images/og/art/${id}.png`;
  await sharp(png)
    .resize({ width: 1200, withoutEnlargement: true })
    .jpeg({ quality: 84, mozjpeg: true })
    .toFile(png.replace(/\.png$/, ".jpg"));
  rmSync(png);
}

console.log("Laying out cards");
const pngs = posts.map((id) => ({ id, png: join(outDir, `${id}.png`) }));
await capture(
  pngs.map(({ id, png }) => ({
    url: `${BASE}/dev/og/${id}/`,
    out: png,
    width: 1200,
    height: 630,
    scale: 1,
    wait: 600,
  })),
);

// JPEG keeps a grainy shader card well under the share-preview size limits.
for (const { id, png } of pngs) {
  await sharp(png).jpeg({ quality: 86, mozjpeg: true }).toFile(join(outDir, `${id}.jpg`));
  rmSync(png);
  console.log(`  ${join(outDir, `${id}.jpg`)}`);
}
