// Shared EXIF extraction for the photography page. Used by
// scripts/optimize-photos.mjs to build the photo-meta.json cache at build
// time, and by src/routes/photography/+page.server.ts as a fallback for
// photos the cache doesn't know about yet (e.g. a new photo in `npm run dev`
// before optimize-photos has run).
import ExifReader from 'exifreader';

/**
 * @typedef {object} PhotoExif
 * @property {string} [camera]
 * @property {string} [lens]
 * @property {string} [aperture]
 * @property {string} [shutter]
 * @property {string} [iso]
 * @property {string} [date]
 * @property {string} [focalLength]
 */

/**
 * @typedef {object} PhotoMeta
 * @property {PhotoExif} exif
 * @property {"landscape" | "portrait" | "square"} orientation
 * @property {number} [width]
 * @property {number} [height]
 * @property {string} [caption] human-written title from IPTC/XMP, if present
 */

// IPTC "Object Name" (Lightroom's Title field), XMP dc:title, and the legacy
// EXIF ImageDescription all carry a human-written name for the photo. Any of
// them is worth showing; the filename never is.
const CAPTION_TAGS = [
    'Object Name',
    'ObjectName',
    'title',
    'Headline',
    'headline',
    'Caption/Abstract',
    'description',
    'ImageDescription',
];

/**
 * @param {Record<string, any>} tags
 * @returns {string | undefined}
 */
function readCaption(tags) {
    for (const key of CAPTION_TAGS) {
        const raw = tags[key]?.description ?? tags[key]?.value;
        const text = typeof raw === 'string' ? raw.trim() : '';
        // Skip generic camera/software strings that aren't real captions.
        if (text && !/^(OLYMPUS|SONY|DSC|IMG|untitled)/i.test(text)) return text;
    }
    return undefined;
}

/**
 * Round a focal length to a whole millimetre. iPhone EXIF stores these as
 * floats, so `6.764999866485596 mm` reaches the UI verbatim without this.
 *
 * @param {unknown} raw
 * @returns {string | undefined}
 */
function formatFocalLength(raw) {
    const text = String(raw ?? '').trim();
    if (!text) return undefined;
    const match = text.match(/-?\d+(?:\.\d+)?/);
    if (!match) return text;
    const mm = Number(match[0]);
    if (!Number.isFinite(mm)) return text;
    // Sub-10mm lenses keep one decimal ("6.8 mm"); longer ones round to whole.
    const rounded = mm < 10 ? Math.round(mm * 10) / 10 : Math.round(mm);
    return `${rounded} mm`;
}

/**
 * Extract camera EXIF fields, orientation, and pixel dimensions from an
 * image buffer. Never throws — parse failures return empty defaults.
 *
 * @param {Buffer} fileBuffer
 * @param {string} filename used only for the parse-failure warning
 * @returns {PhotoMeta}
 */
export function extractPhotoMeta(fileBuffer, filename) {
    /** @type {PhotoExif} */
    const exif = {};
    /** @type {PhotoMeta["orientation"]} */
    let orientation = 'landscape';
    /** @type {number | undefined} */
    let width;
    /** @type {number | undefined} */
    let height;
    /** @type {string | undefined} */
    let caption;

    try {
        const tags = ExifReader.load(fileBuffer);

        caption = readCaption(tags);

        // Extract camera info
        const make = tags.Make?.description || '';
        const model = tags.Model?.description || '';
        exif.camera = [make, model].filter(Boolean).join(' ').trim() || undefined;

        // Extract lens
        exif.lens = tags.LensModel?.description || tags.Lens?.description || undefined;

        // Extract aperture - avoid double f/ prefix
        if (tags.FNumber?.description) {
            const fNum = String(tags.FNumber.description);
            exif.aperture = fNum.startsWith('f/') ? fNum : `f/${fNum}`;
        } else if (tags.ApertureValue?.description) {
            const aperture = String(tags.ApertureValue.description);
            exif.aperture = aperture.startsWith('f/') ? aperture : `f/${aperture}`;
        }

        // Extract shutter speed
        if (tags.ExposureTime?.description) {
            const exposure = tags.ExposureTime.description;
            exif.shutter = typeof exposure === 'string' ? exposure : `${exposure}s`;
        }

        // Extract ISO
        if (tags.ISOSpeedRatings?.description) {
            exif.iso = `ISO ${tags.ISOSpeedRatings.description}`;
        } else if (tags.PhotographicSensitivity?.description) {
            exif.iso = `ISO ${tags.PhotographicSensitivity.description}`;
        }

        // Extract focal length (rounded — raw EXIF floats are unreadable)
        if (tags.FocalLength?.description) {
            exif.focalLength = formatFocalLength(tags.FocalLength.description);
        }

        // Extract date
        if (tags.DateTimeOriginal?.description) {
            // Format: "2024:06:15 14:30:00" -> "2024-06-15"
            const dateStr = tags.DateTimeOriginal.description;
            const match = dateStr.match(/(\d{4}):(\d{2}):(\d{2})/);
            if (match) {
                exif.date = `${match[1]}-${match[2]}-${match[3]}`;
            }
        }

        // Determine orientation from image dimensions
        const imgWidth = tags['Image Width']?.value || tags.ImageWidth?.value || tags.PixelXDimension?.value;
        const imgHeight = tags['Image Height']?.value || tags.ImageHeight?.value || tags.PixelYDimension?.value;
        const orientationTag = tags.Orientation?.value; // EXIF Orientation tag

        if (imgWidth && imgHeight) {
            let w = Array.isArray(imgWidth) ? imgWidth[0] : imgWidth;
            let h = Array.isArray(imgHeight) ? imgHeight[0] : imgHeight;

            // Swap dimensions for 90° rotations (Orientation 6 = Rotate 90° CW, 8 = Rotate 270° CW)
            if (orientationTag === 6 || orientationTag === 8) {
                [w, h] = [h, w];
            }

            if (typeof w === 'number' && typeof h === 'number') {
                width = w;
                height = h;
                const ratio = w / h;
                if (ratio > 1.1) {
                    orientation = 'landscape';
                } else if (ratio < 0.9) {
                    orientation = 'portrait';
                } else {
                    orientation = 'square';
                }
            }
        }
    } catch (exifError) {
        console.warn(`Could not read EXIF from ${filename}:`, exifError);
    }

    return { exif, orientation, width, height, caption };
}
