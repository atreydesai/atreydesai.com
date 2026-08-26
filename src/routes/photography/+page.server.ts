import type { PageServerLoad } from "./$types";
import photoManifest from "$lib/generated/photo-manifest.json";

interface PhotoData {
    src: string;           // Original full-size path for lightbox
    thumbSrc: string;      // Optimized thumbnail for grid (default width)
    thumbSrcset?: string;  // Responsive candidate set for the grid <img>
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

// The manifest is generated before every production build by
// scripts/optimize-photos.mjs. Importing it makes the data part of the server
// bundle instead of attempting to enumerate static/ inside a Vercel function.
export const load: PageServerLoad = () => ({
    photos: photoManifest as PhotoData[],
});
