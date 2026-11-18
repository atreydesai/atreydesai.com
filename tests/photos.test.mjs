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
  RENDITION_QUALITY,
  RENDITION_VERSION,
  RENDITION_WIDTHS,
  originalUrl,
  renditionSrcset,
  renditionFormats,
  renditionUrl,
  renditionWidths,
} from "../src/lib/photo-urls.js";

const root = new URL("../", import.meta.url);
const staticFile = (url) => new URL(`static${url}`, root);
const manifest = JSON.parse(
  await readFile(new URL("src/lib/generated/photo-manifest.json", root), "utf8"),
);
const page = await readFile(new URL("src/routes/photography/+page.svelte", root), "utf8");

const exists = (url) =>
  access(url).then(
    () => true,
    () => false,
  );

test("every original in static/ is in the manifest, and only those", async () => {
  const onDisk = (await readdir(staticFile(ORIGINALS_BASE)))
    .filter((f) => /\.(jpe?g|png|webp)$/i.test(f) && !f.startsWith("."))
    .sort();
  assert.deepEqual(manifest.map((p) => p.filename).sort(), onDisk);
});

test("the download link is the original at its full size", async () => {
  for (const photo of manifest) {
    const file = staticFile(originalUrl(photo));
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
});

test("the manifest's rendition hashes match the originals on disk", async () => {
  // A stale manifest would point the page at renditions of an older edit.
  for (const photo of manifest) {
    const bytes = await readFile(staticFile(originalUrl(photo)));
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
  if (!(await exists(staticFile(renditionUrl(first, renditionWidths(first)[0]))))) {
    t.skip("renditions not built: run npm run optimize-photos");
    return;
  }
  for (const photo of manifest) {
    const widths = renditionWidths(photo);
    for (const width of widths) {
      for (const format of renditionFormats(width)) {
        const url = renditionUrl(photo, width, format);
        assert.ok(await exists(staticFile(url)), `missing ${url}`);
      }
    }
    // The biggest file the lightbox can pick is a fraction of the original.
    const largest = (await stat(staticFile(renditionUrl(photo, widths.at(-1))))).size;
    assert.ok(
      largest < photo.bytes / 3,
      `${photo.filename}: ${largest} B rendition vs ${photo.bytes} B original`,
    );
  }
});
