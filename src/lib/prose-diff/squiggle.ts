// A pen squiggle down the margin, marking the passage being read: the same
// hand-drawn riso idea as the site's drawn marks, but drawn to whatever
// height the passage has, so it is generated rather than fixed. The wave
// never settles into a rhythm: its width, its pitch and its centre all
// wander. Each squiggle is seeded by its passage, so it keeps its shape when
// the text reflows and it is redrawn.

const STEP = 1.25;

function hash(text: string): number {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

// mulberry32: small, fast, and good enough for wobble.
function random(seed: string): () => number {
    let a = hash(seed);
    return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
const round = (value: number) => Math.round(value * 10) / 10;

/**
 * The squiggle as an SVG path in a `width` × `height` box.
 *
 * The pen moves down the margin while circling: x swings side to side and y
 * swings back against the direction of travel by `loop`. While `loop` is
 * small the line is a loose wave; once it passes the wave's own radius the
 * pen doubles back and the wave curls into small loops, the way a scribble
 * in the margin does. Every parameter takes a random walk, so the line
 * drifts between the two and never repeats.
 */
export function squigglePath(height: number, seed: string, width = 10): string {
    const rand = random(seed);
    const centre = width / 2;
    const raw: [number, number][] = [];
    let phase = rand() * Math.PI * 2;
    let amplitude = 2 + rand() * 1.5;
    let wavelength = 9 + rand() * 5;
    let loop = rand() * 2;
    let drift = 0;

    for (let s = 0; s <= height; s += STEP) {
        wavelength = clamp(wavelength + (rand() - 0.5) * 1.4, 7, 17);
        amplitude = clamp(amplitude + (rand() - 0.5) * 0.6, 1.2, 3.8);
        loop = clamp(loop + (rand() - 0.5) * 0.5, 0, 3);
        drift = clamp(drift + (rand() - 0.5) * 0.35, -1, 1);
        phase += (Math.PI * 2 * STEP) / wavelength;
        raw.push([
            centre + drift + amplitude * Math.sin(phase) + (rand() - 0.5) * 0.4,
            s - loop * Math.cos(phase) + (rand() - 0.5) * 0.4,
        ]);
    }
    if (raw.length < 2) raw.push([centre, height]);

    // Loops overshoot the ends, so fit the line back into the box.
    const ys = raw.map(([, y]) => y);
    const top = Math.min(...ys);
    const span = Math.max(...ys) - top || 1;
    const points = raw.map(([x, y]): [number, number] => [clamp(x, 0.8, width - 0.8), ((y - top) / span) * height]);

    // Catmull-Rom through the points, as cubic Béziers.
    let d = `M${round(points[0][0])} ${round(points[0][1])}`;
    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i - 1] ?? points[i];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[i + 2] ?? p2;
        const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
        const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
        d += `C${round(c1[0])} ${round(c1[1])} ${round(c2[0])} ${round(c2[1])} ${round(p2[0])} ${round(p2[1])}`;
    }
    return d;
}

const SVG_NS = "http://www.w3.org/2000/svg";

// One observer for every squiggle on the page: a long chapter can mark
// hundreds of passages. Its first report, for every box at once, is also the
// first draw, so placing a squiggle never forces a layout of its own (reading
// each box's size as it went in cost a layout per passage).
type Redraw = (width: number, height: number) => void;
const redraws = new Map<Element, Redraw>();
let observer: ResizeObserver | undefined;

function watch(box: Element, redraw: Redraw) {
    observer ??= new ResizeObserver((entries) => {
        for (const { target, contentRect } of entries) redraws.get(target)?.(contentRect.width, contentRect.height);
    });
    redraws.set(box, redraw);
    observer.observe(box);
}

function unwatch(box: Element) {
    redraws.delete(box);
    observer?.unobserve(box);
}

/**
 * Draw a squiggle filling `box` (a positioned element sized by CSS), and keep
 * it drawn to the box's height as it resizes. Returns a cleanup function.
 *
 * By default it is two strokes, as in the riso marks: the accent plate, and
 * the same line printed again a touch off register. A `quiet` squiggle is the
 * single pencil line every changed passage gets; the accent one is drawn over
 * it, on the same path, for the passage being read.
 */
export function drawSquiggle(box: HTMLElement, seed: string, { quiet = false } = {}): () => void {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", quiet ? "squiggle-svg squiggle-quiet" : "squiggle-svg");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    const paths: SVGPathElement[] = [];
    for (const name of quiet ? ["squiggle-line"] : ["squiggle-ghost", "squiggle-line"]) {
        const path = document.createElementNS(SVG_NS, "path");
        path.setAttribute("class", name);
        path.setAttribute("pathLength", "1");
        paths.push(path);
    }
    svg.append(...paths);
    box.append(svg);

    let drawn = -1;
    watch(box, (width, height) => {
        height = Math.round(height);
        if (!width || !height || height === drawn) return;
        drawn = height;
        svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
        const d = squigglePath(height, seed, width);
        for (const path of paths) path.setAttribute("d", d);
    });
    return () => {
        unwatch(box);
        svg.remove();
    };
}

/** Svelte action: `<span class="…" use:squiggle={seed}>`. */
export function squiggle(node: HTMLElement, seed: string) {
    let cleanup = drawSquiggle(node, seed);
    return {
        update(next: string) {
            cleanup();
            cleanup = drawSquiggle(node, next);
        },
        destroy() {
            cleanup();
        },
    };
}
