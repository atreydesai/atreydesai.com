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
 */

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

    try {
        const tags = ExifReader.load(fileBuffer);

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

        // Extract focal length
        if (tags.FocalLength?.description) {
            exif.focalLength = tags.FocalLength.description;
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

    return { exif, orientation, width, height };
}
