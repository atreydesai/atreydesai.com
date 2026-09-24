// The site's two small marks, drawn for it instead of borrowed from a font: a
// disclosure caret (where ▸ used to be) and a separator (where · used to be).
//
// Both are the riso recipe of the banner and the interest loops, shrunk to
// text size: an ink outline over a paper fill, with the accent plate printed
// a touch off register, down and to the right. Colours live in app.css
// (`.mark-*`), so the ink follows the text colour and dark mode swaps the
// paper and plate there.
//
// Shapes sit in a 12×12 box. Unlike the interest loops, each path closes on
// itself: at this size an overshooting tail reads as a stray stroke. The
// plate's offset has to clear half the ink's stroke (0.9) by a good margin,
// or at text size the plate hides under the ink and the mark reads as plain
// grey.

export type MarkKind = "caret" | "dot";

const SHAPES: Record<MarkKind, { d: string; offset: number }> = {
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
};

export function markSvg(kind: MarkKind): string {
    const { d, offset } = SHAPES[kind];
    return (
        `<svg class="mark-svg" viewBox="0 0 12 12" aria-hidden="true" focusable="false">` +
        `<g transform="translate(${offset} ${offset})"><path class="mark-plate mark-turn" d="${d}"/></g>` +
        `<path class="mark-paper mark-turn" d="${d}"/>` +
        `<path class="mark-ink mark-turn" d="${d}"/>` +
        `</svg>`
    );
}

/**
 * The complete mark. `text` is what it stands for in copied text and to a
 * screen reader: a separator keeps its "·", a purely visual mark (a caret, a
 * selected-option marker) passes "".
 */
export function markHtml(kind: MarkKind, text = kind === "dot" ? "·" : ""): string {
    const label = text ? `<span class="sr-only">${text}</span>` : "";
    return `<span class="mark mark-${kind}">${markSvg(kind)}${label}</span>`;
}

/** Swap spaced middle-dot separators in trusted HTML for the drawn mark. */
export function withMarks(html: string): string {
    return html.replace(/ · /g, ` ${markHtml("dot")} `);
}
