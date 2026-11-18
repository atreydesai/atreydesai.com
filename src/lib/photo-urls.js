// Every URL for a photograph comes from here: the build script
// (scripts/optimize-photos.mjs) names its files with these functions and the
// photography page, its Markdown, and the tests read them back through them,
// so the two can never disagree.
//
// A photo has two kinds of file:
// - Its original, the untouched full-resolution JPEG, offered as the
//   download. Only ORIGINALS_BASE says where originals live, so moving them
//   to another host (Cloudflare R2, say) is a one-line change here, plus a
//   `Content-Disposition: attachment` header on that host: browsers ignore
//   the `download` attribute on cross-origin links.
// - Its renditions: WebP copies at fixed widths, made at build time, used for
//   everything the page displays. Their names carry a hash of the original's
//   bytes and of the settings below, so a file at a given URL never changes
//   and is cached as immutable (vercel.json).

export const ORIGINALS_BASE = "/images/photography/";
export const RENDITIONS_BASE = "/images/photography/thumbs/";

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
