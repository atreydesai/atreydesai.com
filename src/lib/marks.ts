// The site's small marks, drawn for it instead of borrowed from a font: a
// disclosure caret (where ▸ used to be), a separator (where · used to be),
// the bullet-journal key that leads rows of the homepage banner's updates
// log, and the pushpin on that log's pinned first row.
//
// All of them are the riso recipe of the banner and the interest loops, shrunk
// to text size: an ink outline over a paper fill, with the accent plate printed
// a touch off register, down and to the right. Colours live in app.css
// (`.mark-*`), so the ink follows the text colour and dark mode swaps the
// paper and plate there.
//
// Shapes sit in a 12×12 box. Unlike the interest loops, each path closes on
// itself: at this size an overshooting tail reads as a stray stroke. The
// plate's offset has to clear half the ink's stroke (0.9) by a good margin,
// or at text size the plate hides under the ink and the mark reads as plain
// grey.
//
// `d` is the outline: it is printed three times (plate, paper, ink). `detail`
// holds extra ink-only strokes drawn after the outline, for interior lines
// that should not get a plate or a paper fill of their own (a pin's
// needle).

export type MarkKind =
    | "caret"
    | "dot"
    | "read"
    | "talk"
    | "milestone"
    | "note"
    | "pin";

/** The kinds that lead a row of the banner's updates log. Written things
 *  (`paper` updates) take no key. */
export type UpdateMarkKind = "read" | "talk" | "milestone" | "note";

interface MarkShape {
    d: string;
    offset: number;
    detail?: string[];
}

const SHAPES: Record<MarkKind, MarkShape> = {
    // A pen triangle pointing right. An open disclosure turns it a quarter
    // (see `.mark-turn` in app.css); the plate stays off register the same
    // way while it turns.
    caret: {
        d: "M2.6 2.3C4.9 3.4 7.4 4.8 9.5 5.9C7.3 7.2 4.9 8.5 2.7 9.8C2.5 7.3 2.4 4.6 2.6 2.3Z",
        offset: 1.8,
    },
    // A small drawn loop: the interest markers' circle at separator size.
    dot: {
        d: "M4.0 2.9C5.6 1.9 8.0 2.5 8.8 4.3C9.6 6.1 8.6 8.4 6.6 8.9C4.6 9.4 2.6 8.1 2.3 6.2C2.0 4.5 3.0 3.1 4.0 2.9Z",
        offset: 1.8,
    },

    // Updates-log key: a bullet-journal key, one drawn shape per kind of
    // update. These render larger than the caret (0.95em), so app.css thins
    // their ink to 1.5 to keep the printed stroke the same weight, and the
    // plate's offset comes in to 1.7 with it.

    // Something read: a bookmark ribbon with a V notch at the bottom.
    read: {
        d: "M3.5 1.5C5.2 1.3 6.9 1.3 8.6 1.6C8.8 4.5 8.8 7.6 8.6 10.6C7.7 9.7 6.9 8.8 6.0 7.9C5.1 8.8 4.2 9.8 3.3 10.6C3.1 7.6 3.2 4.5 3.5 1.5Z",
        offset: 1.7,
    },
    // A talk, poster, visit, or conversation: a speech bubble, tail at
    // bottom-left.
    talk: {
        d: "M3.4 2.2C5.3 1.6 7.7 1.7 9.4 2.5C10.4 3.8 10.4 6.0 9.5 7.3C8.2 8.0 6.6 8.1 5.3 7.9C4.5 8.9 3.5 9.9 2.3 10.6C2.7 9.6 2.9 8.6 2.9 7.6C1.7 6.6 1.5 4.9 1.9 3.5C2.2 2.8 2.8 2.4 3.4 2.2Z",
        offset: 1.7,
    },
    // A milestone: a four-point spark, its points a little uneven.
    milestone: {
        d: "M6.0 0.9C6.6 3.5 8.2 5.0 11.0 5.8C8.3 6.6 6.7 8.3 6.1 11.1C5.4 8.4 3.8 6.8 1.0 6.1C3.7 5.2 5.3 3.6 6.0 0.9Z",
        offset: 1.7,
    },
    // Everything else: a drawn loop, the separator's cousin at row size.
    note: {
        d: "M4.7 3.3C6.1 2.6 7.9 3.1 8.6 4.6C9.3 6.1 8.5 8.0 6.8 8.5C5.1 9.0 3.5 8.0 3.2 6.4C3.0 5.0 3.7 3.7 4.7 3.3Z",
        offset: 1.7,
    },

    // The banner's pushpin, seen side-on: a flat cap, a waisted barrel, and
    // a flared collar as one outline, the needle as a `detail` stroke.
    // Upright here; the call site tilts it.
    pin: {
        d: "M3.6 1.3C5.2 1.0 6.9 1.0 8.5 1.3C8.8 1.8 8.7 2.4 8.4 2.9C8.1 3.0 7.9 3.0 7.6 3.0C7.5 3.8 7.6 4.6 7.9 5.3C8.9 5.7 9.6 6.3 9.8 7.2C7.3 7.5 4.8 7.5 2.3 7.2C2.5 6.3 3.2 5.7 4.2 5.3C4.5 4.6 4.6 3.8 4.5 3.0C4.2 3.0 4.0 3.0 3.7 2.9C3.4 2.4 3.3 1.8 3.6 1.3Z",
        offset: 1.4,
        detail: ["M6.0 7.5C6.1 8.8 6.0 10.1 6.0 11.5"],
    },
};

export function markSvg(kind: MarkKind): string {
    const { d, offset, detail = [] } = SHAPES[kind];
    return (
        `<svg class="mark-svg" viewBox="0 0 12 12" aria-hidden="true" focusable="false">` +
        `<g transform="translate(${offset} ${offset})"><path class="mark-plate mark-turn" d="${d}"/></g>` +
        `<path class="mark-paper mark-turn" d="${d}"/>` +
        `<path class="mark-ink mark-turn" d="${d}"/>` +
        detail.map((p) => `<path class="mark-ink mark-turn" d="${p}"/>`).join("") +
        `</svg>`
    );
}

/**
 * The complete mark. `text` is what it stands for in copied text and to a
 * screen reader: a separator keeps its "·", a purely visual mark (a caret, a
 * selected-option marker, an updates-log key) passes "".
 */
export function markHtml(kind: MarkKind, text = kind === "dot" ? "·" : ""): string {
    const label = text ? `<span class="sr-only">${text}</span>` : "";
    return `<span class="mark mark-${kind}">${markSvg(kind)}${label}</span>`;
}

/** Swap spaced middle-dot separators in trusted HTML for the drawn mark. */
export function withMarks(html: string): string {
    return html.replace(/ · /g, ` ${markHtml("dot")} `);
}
