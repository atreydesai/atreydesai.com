import type { PageServerLoad } from "./$types";
import photoManifest from "#lib/generated/photo-manifest.json";

// One manifest entry. It holds facts about the photo, not URLs:
// #lib/photo-urls.js turns `filename` and `v` into the rendition and original
// URLs, so the page, its Markdown, and the build script agree on them.
export interface PhotoData {
    filename: string;      // The original's file name; also the download name
    v: string;             // Hash of the original and the rendition settings
    width: number;         // The original's pixel size, upright
    height: number;
    bytes: number;         // The original's file size, shown on the download
    // Human-written title, from a photo-captions.json entry or the photo's
    // IPTC/XMP Title. Absent when the photo has neither.
    caption?: string;
    // A plain description of what the photo shows (photo-alts.json), else the
    // caption, else "": a photo with neither is presentational and shouldn't
    // have its filename read out as a description.
    alt: string;
    orientation: "landscape" | "portrait" | "square";
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
