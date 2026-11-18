// Every URL for a photograph comes from here: the build script
// (scripts/optimize-photos.mjs) names its files with these functions and the
// photography page, its Markdown, and the tests read them back through them,
// so the two can never disagree.
//
// No photo file is part of a Vercel deployment: every deploy used to carry
// ~500 MB of them and filled the free tier's deployment storage. They live in
// the Cloudflare R2 bucket PHOTOS_BUCKET, served (and cached by Cloudflare) at
// PHOTOS_ORIGIN, and `npm run upload-photos` puts them there. A photo has two
// kinds of file:
// - Its original, the untouched full-resolution JPEG in ORIGINALS_DIR, offered
//   as the download. It is stored with `Content-Disposition: attachment`:
//   browsers ignore the `download` attribute on cross-origin links.
// - Its renditions: WebP/AVIF copies at fixed widths, made by
//   `npm run optimize-photos` into RENDITIONS_DIR and stored under thumbs/,
//   used for everything the page displays. Their names carry a hash of the
//   original's bytes and of the settings below, so a file at a given URL never
//   changes and is stored as immutable.

export const PHOTOS_BUCKET = "atreydesai-photos";
export const PHOTOS_ORIGIN = "https://photos.atreydesai.com";
// The bucket's own r2.dev address: not cached by Cloudflare, so the upload
// script and the build check what is really in the bucket here.
export const PHOTOS_BUCKET_URL = "https://pub-7a2d51110a214e50909387543cac65e7.r2.dev";
export const ORIGINALS_DIR = "photos/";
export const RENDITIONS_DIR = "node_modules/.cache/photo-renditions/";
export const ORIGINALS_KEY = "";
export const RENDITIONS_KEY = "thumbs/";
export const ORIGINALS_BASE = `${PHOTOS_ORIGIN}/${ORIGINALS_KEY}`;
export const RENDITIONS_BASE = `${PHOTOS_ORIGIN}/${RENDITIONS_KEY}`;

// Grid tiles use 400–1200; the lightbox goes up to 2048, which covers a
// landscape photo at the lightbox's 992px cap on a 2x display. The 600 step
// is for phones: a half-width tile on a 1.75x screen needs ~410 px, which
// without it rounds up to the 800 (twice the pixels).
export const RENDITION_WIDTHS = [400, 600, 800, 1200, 2048];
export const RENDITION_QUALITY = 80;
// The grid's sizes also come as AVIF, about 40% smaller than WebP for the same
// look; browsers that can't read it fall back to the WebP. The lightbox's
// 2048 stays WebP only: AVIF that large is slow to encode for a view that is
// opened one photo at a time.
export const AVIF_QUALITY = 60;
export const AVIF_MAX_WIDTH = 1200;
// Part of every rendition's hash: bump it when the encoding changes (format,
// quality, resizing) so every URL changes with it.
export const RENDITION_VERSION = 1;

/**
 * @typedef {object} PhotoFiles
 * @property {string} filename the original's file name, e.g. `51-183A8137-1.jpg`
 * @property {string} v hash of the original's bytes and the rendition settings
 * @property {number} width the original's displayed width in pixels
 * @property {number} height the original's displayed height in pixels
 */

/** @param {string} filename */
export function photoStem(filename) {
  return filename.replace(/\.[^.]+$/, "");
}

/**
 * The widths this photo is rendered at, smallest first. A photo narrower than
 * a step ends at its own width instead of being enlarged.
 *
 * @param {Pick<PhotoFiles, "width">} photo
 * @returns {number[]}
 */
export function renditionWidths(photo) {
  const top = Math.min(photo.width, RENDITION_WIDTHS[RENDITION_WIDTHS.length - 1]);
  return [...RENDITION_WIDTHS.filter((w) => w < top), top];
}

/** @typedef {"webp" | "avif"} RenditionFormat */

/**
 * The formats a rendition of this width comes in.
 *
 * @param {number} width
 * @returns {RenditionFormat[]}
 */
export function renditionFormats(width) {
  return width <= AVIF_MAX_WIDTH ? ["webp", "avif"] : ["webp"];
}

/**
 * @param {Pick<PhotoFiles, "filename" | "v">} photo
 * @param {number} width
 * @param {RenditionFormat} [format]
 */
export function renditionFile(photo, width, format = "webp") {
  return `${photoStem(photo.filename)}-${width}.${photo.v}.${format}`;
}

/**
 * @param {Pick<PhotoFiles, "filename" | "v">} photo
 * @param {number} width
 * @param {RenditionFormat} [format]
 */
export function renditionUrl(photo, width, format = "webp") {
  return RENDITIONS_BASE + renditionFile(photo, width, format);
}

/**
 * A `srcset` of this photo's renditions up to `maxWidth`, in one format.
 *
 * @param {PhotoFiles} photo
 * @param {number} [maxWidth]
 * @param {RenditionFormat} [format]
 */
export function renditionSrcset(photo, maxWidth = Infinity, format = "webp") {
  return renditionWidths(photo)
    .filter((w, i) => i === 0 || w <= maxWidth)
    .filter((w) => renditionFormats(w).includes(format))
    .map((w) => `${renditionUrl(photo, w, format)} ${w}w`)
    .join(", ");
}

/**
 * The full-resolution original, exactly as uploaded. This is the download.
 *
 * @param {Pick<PhotoFiles, "filename">} photo
 */
export function originalUrl(photo) {
  return ORIGINALS_BASE + photo.filename;
}
