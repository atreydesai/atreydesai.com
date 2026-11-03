// Post artwork cropped by `npm run og` (static/images/og/art/<id>.jpg), shown
// in share cards and homepage thumbnails. Text-heavy art reads from its first
// line, so it crops from the top left instead of the centre.
const ART_POSITION: Record<string, string> = { "prose-diff": "left top" };

export const artPosition = (id: string) => ART_POSITION[id] ?? "center";

// Art too tall for the card's wide frame is fitted whole rather than cropped,
// on its own flat ground so the frame reads as one surface. The colour is the
// art's background, sampled from the crop.
const CARD_FIT: Record<string, { background: string }> = {
  "fruit-studies": { background: "#e9edde" },
};

export const cardFit = (id: string) => CARD_FIT[id] ?? null;
