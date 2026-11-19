// The photography page has one hard promise: anyone can download every photo
// at full resolution, byte for byte as uploaded. Everything it *displays* is a
// smaller rendition, and these tests hold both halves: the download is the
// original, and nothing on screen is.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, readdir, readFile, stat } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

import {
  AVIF_QUALITY,
  ORIGINALS_BASE,
  ORIGINALS_DIR,
  PHOTOS_ORIGIN,
  RENDITIONS_BASE,
  RENDITIONS_DIR,
  RENDITION_QUALITY,
  RENDITION_VERSION,
  RENDITION_WIDTHS,
  originalUrl,
  renditionSrcset,
  renditionFile,
  renditionFormats,
  renditionUrl,
  renditionWidths,
} from "../src/lib/photo-urls.js";

const root = new URL("../", import.meta.url);
const staticFile = (url) => new URL(`static${url}`, root);
const originalFile = (photo) => new URL(ORIGINALS_DIR + photo.filename, root);
const renditionPath = (photo, width, format) => new URL(RENDITIONS_DIR + renditionFile(photo, width, format), root);
const manifest = JSON.parse(
  await readFile(new URL("src/lib/generated/photo-manifest.json", root), "utf8"),
);
const page = await readFile(new URL("src/routes/photography/+page.svelte", root), "utf8");

const exists = (url) =>
  access(url).then(
    () => true,
    () => false,
  );

test("every original in photos/ is in the manifest, and only those", async () => {
  const onDisk = (await readdir(new URL(ORIGINALS_DIR, root)))
    .filter((f) => /\.(jpe?g|png|webp)$/i.test(f) && !f.startsWith("."))
    .sort();
  assert.deepEqual(manifest.map((p) => p.filename).sort(), onDisk);
});

test("pinned photos lead the page, in their order, then newest first", async () => {
  const { pinned } = JSON.parse(await readFile(new URL("scripts/photo-pins.json", root), "utf8"));
  assert.deepEqual(manifest.slice(0, pinned.length).map((p) => p.filename), pinned);
  const rest = manifest.slice(pinned.length).map((p) => p.exif.date).filter(Boolean);
  assert.deepEqual(rest, [...rest].sort().reverse(), "after the pins, newest first");
});

test("the download link is the original at its full size", async () => {
  for (const photo of manifest) {
    const file = originalFile(photo);
    const { autoOrient } = await sharp(fileURLToPath(file)).metadata();
    assert.deepEqual(
      [autoOrient.width, autoOrient.height],
      [photo.width, photo.height],
      `${photo.filename}: manifest size differs from the original's pixels`,
    );
    assert.equal((await stat(file)).size, photo.bytes, `${photo.filename}: byte count`);
  }
  // The lightbox's download anchor is built from originalUrl, with the
  // original's name, and never from a rendition.
  assert.match(page, /href=\{originalUrl\(currentPhoto\)\}\s+download=\{currentPhoto\.filename\}/);
  assert.equal(originalUrl(manifest[0]), ORIGINALS_BASE + manifest[0].filename);
});

test("no photo file is deployed: every one is served from the R2 photo host", async () => {
  // Photos in static/ would be copied into every Vercel deployment.
  assert.equal(await exists(staticFile("/images/photography/")), false, "static/images/photography/ is back");
  assert.ok(ORIGINALS_BASE.startsWith(`${PHOTOS_ORIGIN}/`));
  assert.ok(RENDITIONS_BASE.startsWith(`${PHOTOS_ORIGIN}/`));
  for (const photo of manifest.slice(0, 3)) {
    assert.ok(originalUrl(photo).startsWith(PHOTOS_ORIGIN));
    assert.ok(renditionUrl(photo, 400).startsWith(PHOTOS_ORIGIN));
  }
  // The page opens the photo host's connection with its first-photo preload.
  assert.match(page, /<link rel="preconnect" href=\{PHOTOS_ORIGIN\} data-hoist \/>/);
});

test("the manifest's rendition hashes match the originals on disk", async () => {
  // A stale manifest would point the page at renditions of an older edit.
  for (const photo of manifest) {
    const bytes = await readFile(originalFile(photo));
    const sha = createHash("sha256").update(bytes).digest("hex");
    const v = createHash("sha256")
      .update(`${RENDITION_VERSION}:${RENDITION_QUALITY}:${AVIF_QUALITY}:${sha}`)
      .digest("hex")
      .slice(0, 10);
    assert.equal(photo.v, v, `${photo.filename}: run npm run optimize-photos`);
  }
});

test("nothing the page displays is an original", () => {
  const top = RENDITION_WIDTHS[RENDITION_WIDTHS.length - 1];
  for (const photo of manifest) {
    const original = originalUrl(photo);
    const candidates = [renditionSrcset(photo), renditionSrcset(photo, Infinity, "avif")]
      .join(", ")
      .split(", ")
      .map((entry) => entry.split(" "));
    assert.ok(candidates.length > 0);
    for (const [url, descriptor] of candidates) {
      assert.notEqual(url, original);
      assert.ok(/\.(webp|avif)$/.test(url), url);
      assert.ok(parseInt(descriptor) <= top, `${url} is wider than ${top}px`);
    }
  }
  // The grid and the lightbox both draw from the renditions, and the only
  // reference to an original in the page is the download.
  assert.equal(page.match(/originalUrl\(/g)?.length, 1, "the download is the one place the page links an original");
  assert.doesNotMatch(page, /\.src\b/, "a photo's displayed src must come from renditionUrl");
});

test("built renditions are on disk and much smaller than the originals", async (t) => {
  const first = manifest[0];
  if (!(await exists(renditionPath(first, renditionWidths(first)[0])))) {
    t.skip("renditions not built: run npm run optimize-photos");
    return;
  }
  for (const photo of manifest) {
    const widths = renditionWidths(photo);
    for (const width of widths) {
      for (const format of renditionFormats(width)) {
        const file = renditionPath(photo, width, format);
        assert.ok(await exists(file), `missing ${renditionFile(photo, width, format)}`);
      }
    }
    // The biggest file the lightbox can pick is a fraction of the original.
    const largest = (await stat(renditionPath(photo, widths.at(-1)))).size;
    assert.ok(
      largest < photo.bytes / 3,
      `${photo.filename}: ${largest} B rendition vs ${photo.bytes} B original`,
    );
  }
});
