import type { PageServerLoad } from "./$types";
import { readdir, readFile, access } from "fs/promises";
import { join, parse } from "path";
import ExifReader from "exifreader";

interface PhotoData {
    src: string;           // Original full-size path for lightbox
    thumbSrc: string;      // Optimized thumbnail for grid
    alt: string;
    filename: string;
    orientation: "landscape" | "portrait" | "square";
    width?: number;
    height?: number;
    exif: {
        camera?: string;
        lens?: string;
        aperture?: string;
        shutter?: string;
        iso?: string;
        date?: string;
        focalLength?: string;
    };
}

export const load: PageServerLoad = async () => {
    const photosDir = join(process.cwd(), "static", "images", "photography");

    try {
        const files = await readdir(photosDir);
        const imageFiles = files.filter((file) =>
            /\.(jpg|jpeg|png|webp)$/i.test(file)
        );

        const photos: PhotoData[] = await Promise.all(
            imageFiles.map(async (filename) => {
                const filePath = join(photosDir, filename);
                const fileBuffer = await readFile(filePath);

                let exif: PhotoData["exif"] = {};
                let orientation: PhotoData["orientation"] = "landscape";
                let width: number | undefined;
                let height: number | undefined;

                try {
                    const tags = ExifReader.load(fileBuffer);

                    // Extract camera info
                    const make = tags.Make?.description || "";
                    const model = tags.Model?.description || "";
                    exif.camera = [make, model].filter(Boolean).join(" ").trim() || undefined;

                    // Extract lens
                    exif.lens = tags.LensModel?.description || tags.Lens?.description || undefined;

                    // Extract aperture - avoid double f/ prefix
                    if (tags.FNumber?.description) {
                        const fNum = String(tags.FNumber.description);
                        exif.aperture = fNum.startsWith("f/") ? fNum : `f/${fNum}`;
                    } else if (tags.ApertureValue?.description) {
                        const aperture = String(tags.ApertureValue.description);
                        exif.aperture = aperture.startsWith("f/") ? aperture : `f/${aperture}`;
                    }

                    // Extract shutter speed
                    if (tags.ExposureTime?.description) {
                        const exposure = tags.ExposureTime.description;
                        exif.shutter = typeof exposure === "string" ? exposure : `${exposure}s`;
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
                    const imgWidth = tags["Image Width"]?.value || tags.ImageWidth?.value || tags.PixelXDimension?.value;
                    const imgHeight = tags["Image Height"]?.value || tags.ImageHeight?.value || tags.PixelYDimension?.value;

                    if (imgWidth && imgHeight) {
                        const w = Array.isArray(imgWidth) ? imgWidth[0] : imgWidth;
                        const h = Array.isArray(imgHeight) ? imgHeight[0] : imgHeight;
                        if (typeof w === "number" && typeof h === "number") {
                            width = w;
                            height = h;
                            const ratio = w / h;
                            if (ratio > 1.1) {
                                orientation = "landscape";
                            } else if (ratio < 0.9) {
                                orientation = "portrait";
                            } else {
                                orientation = "square";
                            }
                        }
                    }
                } catch (exifError) {
                    console.warn(`Could not read EXIF from ${filename}:`, exifError);
                }

                // Generate alt text from filename
                const alt = filename
                    .replace(/\.[^.]+$/, "") // Remove extension
                    .replace(/[-_]/g, " ") // Replace dashes/underscores with spaces
                    .replace(/\b\w/g, (c) => c.toUpperCase()); // Capitalize words

                // Check for optimized thumbnail
                const { name } = parse(filename);
                const thumbPath = join(photosDir, "thumbs", `${name}.webp`);
                let thumbSrc = `/images/photography/${filename}`; // Default to original

                try {
                    await access(thumbPath);
                    thumbSrc = `/images/photography/thumbs/${name}.webp`;
                } catch {
                    // Thumbnail doesn't exist, use original
                }

                return {
                    src: `/images/photography/${filename}`,
                    thumbSrc,
                    alt,
                    filename,
                    orientation,
                    width,
                    height,
                    exif,
                };
            })
        );

        // Sort by date (newest first) - photos without dates go to the end
        photos.sort((a, b) => {
            // Both have dates - sort by date descending (newest first)
            if (a.exif.date && b.exif.date) {
                return b.exif.date.localeCompare(a.exif.date);
            }
            // Only a has date - a comes first
            if (a.exif.date && !b.exif.date) {
                return -1;
            }
            // Only b has date - b comes first
            if (!a.exif.date && b.exif.date) {
                return 1;
            }
            // Neither has date - sort by filename
            return a.filename.localeCompare(b.filename);
        });

        return { photos };
    } catch (error) {
        console.error("Error loading photos:", error);
        return { photos: [] };
    }
};
