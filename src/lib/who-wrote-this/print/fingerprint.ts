// The hero's fingerprint, drawn in code. Every print is a set of evenly spaced streamlines through an orientation
// field with singular points (cores and deltas), the way real ridge flow is modelled; ridge endings and forks fall
// out of the spacing test. The ridges are then set as lines of the paper's own text. One eased scalar (0..3) drives
// everything: the single print unravels into threads that re-knit as a human and an AI print, the AI print into one
// print per lab, the human print into a crowd of writers with one lit. A lens redraws whatever is under the pointer
// as vectors, large enough to read.
import type { Anchor, Box, CreatePrint, Hit, Print, PrintInput, PrintOptions } from "./contract";

export const FONT = '"Inter", system-ui, -apple-system, "Segoe UI", sans-serif';
export const HW = 0.8; // a print's half-width when its half-height is 1
const TAU = Math.PI * 2;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const ss = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const ease = (t: number) => { t = clamp01(t); return t * t * t * (t * (t * 6 - 15) + 10); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const hexRgb = (h: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
const mixRgb = (p: number[], q: number[], t: number) => `rgb(${Math.round(lerp(p[0], q[0], t))},${Math.round(lerp(p[1], q[1], t))},${Math.round(lerp(p[2], q[2], t))})`;

export function rng(seed: number) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

// ───────────────────────────────────────────────────────────── pattern

/** A ridge-flow field in unit space: x in [-HW, HW], y in [-1, 1], y down. */
export type Spec = {
	seed: number;
	cores: number[]; // flat xy; each turns the flow by +half a turn
	deltas: number[]; // flat xy; each by -half a turn
	twist: number; // local rotation around the first core: turns rings into a spiral
	arch: number; archW: number; archY: number; // a singularity-free rise in the middle
	wob: number; // organic unevenness, radians
	tilt: number;
	sq: number; // outline: 2 is an ellipse, higher is squarer
};
const spec = (seed: number, p: Partial<Spec>): Spec => ({ seed, cores: [], deltas: [], twist: 0, arch: 0, archW: 0.5, archY: 0, wob: 0.08, tilt: 0, sq: 2.25, ...p });

export function fieldOf(s: Spec) {
	const R = rng(s.seed * 2654435761 + 17);
	const p1 = R() * TAU, p2 = R() * TAU, p3 = R() * TAU, p4 = R() * TAU;
	const e1 = 0.018 + R() * 0.02, e2 = 0.012 + R() * 0.014;
	const theta = (x: number, y: number) => {
		let th = s.tilt;
		for (let i = 0; i < s.cores.length; i += 2) th += 0.5 * Math.atan2(y - s.cores[i + 1], x - s.cores[i]);
		for (let i = 0; i < s.deltas.length; i += 2) th -= 0.5 * Math.atan2(y - s.deltas[i + 1], x - s.deltas[i]);
		if (s.twist) { const dx = x - (s.cores[0] ?? 0), dy = y - (s.cores[1] ?? 0); th += s.twist * Math.exp(-(dx * dx + dy * dy) / 0.45); }
		if (s.arch) th += Math.atan(s.arch * x * Math.exp(-(x * x) / (s.archW * s.archW)) * Math.exp(-((y - s.archY) * (y - s.archY)) / 0.6));
		if (s.wob) th += s.wob * (Math.sin(2.3 * x + 3.1 * y + p1) + 0.6 * Math.sin(-4.7 * x + 2.9 * y + p2));
		return th;
	};
	// the inked outline: a fingertip's oval with an uneven edge. Returns 0 at the centre, 1 on the edge.
	const edge = (x: number, y: number) => {
		const a = Math.atan2(y, x);
		const rim = 1 + e1 * Math.sin(3 * a + p3) + e2 * Math.sin(7 * a + p4);
		const q = y > 0 ? s.sq + 0.5 : s.sq;
		return Math.pow(Math.pow(Math.abs(x) / HW, q) + Math.pow(Math.abs(y), q), 1 / q) / rim;
	};
	// how much ink took: thinner toward the edge, and unevenly pressed
	const ink = (x: number, y: number) => {
		const m = edge(x, y);
		const blot = 0.8 + 0.2 * Math.sin(5.1 * x + p2) * Math.sin(4.3 * y + p1);
		return (1 - ss(0.8, 1.02, m) * 0.75) * blot;
	};
	return { theta, edge, ink };
}

/** Evenly spaced streamlines (Jobard and Lefer): a ridge stops where it would crowd another, which is where real ridges
 * end. A generator: step it (next()) until done; its value is the ridges. */
export function* traceSteps(s: Spec, ds: number): Generator<void, Float32Array[], void> {
	const { theta, edge } = fieldOf(s);
	const h = ds * 0.3, dtest = ds * 0.6, guard = Math.ceil(dtest / h) + 3;
	const gx0 = -HW - ds * 3, gy0 = -1 - ds * 3;
	const cols = Math.ceil((2 * HW + 6 * ds) / ds), rows = Math.ceil((2 + 6 * ds) / ds);
	const cells: (number[] | undefined)[] = new Array(cols * rows);
	const PX: number[] = [], PY: number[] = [], PID: number[] = [], PK: number[] = [];
	const dead: boolean[] = [];
	const inside = (x: number, y: number) => edge(x, y) < 1;
	const free = (x: number, y: number, d: number, id: number, k: number) => {
		const cx = Math.floor((x - gx0) / ds), cy = Math.floor((y - gy0) / ds), d2 = d * d;
		for (let j = cy - 1; j <= cy + 1; j++) for (let i = cx - 1; i <= cx + 1; i++) {
			if (i < 0 || j < 0 || i >= cols || j >= rows) continue;
			const cell = cells[j * cols + i];
			if (!cell) continue;
			for (let n = 0; n < cell.length; n++) {
				const q = cell[n];
				if (dead[PID[q]]) continue;
				const ex = PX[q] - x, ey = PY[q] - y;
				if (ex * ex + ey * ey < d2 && (PID[q] !== id || Math.abs(PK[q] - k) > guard)) return false;
			}
		}
		return true;
	};
	const put = (x: number, y: number, id: number, k: number) => {
		const ci = Math.floor((y - gy0) / ds) * cols + Math.floor((x - gx0) / ds);
		(cells[ci] ??= []).push(PX.length);
		PX.push(x); PY.push(y); PID.push(id); PK.push(k);
	};
	let nextId = 0;
	const grow = (sx: number, sy: number): Float32Array | null => {
		const id = nextId++;
		const halves: number[][] = [[], []];
		put(sx, sy, id, 0);
		for (let side = 0; side < 2; side++) {
			const out = halves[side];
			let x = sx, y = sy;
			const t0 = theta(x, y);
			let vx = Math.cos(t0) * (side ? -1 : 1), vy = Math.sin(t0) * (side ? -1 : 1);
			for (let n = 1; n < 5000; n++) {
				let t = theta(x, y), c = Math.cos(t), sn = Math.sin(t);
				if (c * vx + sn * vy < 0) { c = -c; sn = -sn; }
				t = theta(x + c * h * 0.5, y + sn * h * 0.5);
				let c2 = Math.cos(t), s2 = Math.sin(t);
				if (c2 * c + s2 * sn < 0) { c2 = -c2; s2 = -s2; }
				if (c2 * vx + s2 * vy < 0.55) break; // the flow turns too sharply: a core
				const nx = x + c2 * h, ny = y + s2 * h, k = side ? -n : n;
				if (!inside(nx, ny) || !free(nx, ny, dtest, id, k)) break;
				put(nx, ny, id, k);
				out.push(nx, ny);
				x = nx; y = ny; vx = c2; vy = s2;
			}
		}
		const [f, b] = halves;
		const n = (f.length + b.length) / 2 + 1;
		if (n * h < ds * 1.1) { dead[id] = true; return null; }
		const pts = new Float32Array(n * 2);
		let o = 0;
		for (let i = b.length - 2; i >= 0; i -= 2) { pts[o++] = b[i]; pts[o++] = b[i + 1]; }
		pts[o++] = sx; pts[o++] = sy;
		for (let i = 0; i < f.length; i++) pts[o++] = f[i];
		// text reads along the ridge, so run it left to right
		if (pts[o - 2] < pts[0]) for (let i = 0, j = n - 1; i < j; i++, j--) {
			const ax = pts[i * 2], ay = pts[i * 2 + 1];
			pts[i * 2] = pts[j * 2]; pts[i * 2 + 1] = pts[j * 2 + 1]; pts[j * 2] = ax; pts[j * 2 + 1] = ay;
		}
		return pts;
	};
	const ridges: Float32Array[] = [], queue: Float32Array[] = [];
	/** true when a ridge was grown (the moment a caller may pause) */
	const trySeed = (x: number, y: number) => {
		if (!inside(x, y) || !free(x, y, ds * 0.98, -1, 0)) return false;
		const r = grow(x, y);
		if (r) { ridges.push(r); queue.push(r); }
		return true;
	};
	// the same seeds in the same order as one uninterrupted pass; it pauses after each ridge it grows (and every few
	// hundred seeds tried), so a large print can be traced a few ms at a time
	function* drain() {
		while (queue.length) {
			const r = queue.shift()!;
			for (let i = 2; i < r.length - 2; i += 4) {
				const tx = r[i + 2] - r[i - 2], ty = r[i + 3] - r[i - 1], l = Math.hypot(tx, ty) || 1;
				const nx = (-ty / l) * ds, ny = (tx / l) * ds;
				if (trySeed(r[i] + nx, r[i + 1] + ny)) yield;
				if (trySeed(r[i] - nx, r[i + 1] - ny)) yield;
			}
		}
	}
	trySeed(0.02, 0.62);
	yield* drain();
	let tried = 0;
	for (let y = -1; y <= 1; y += ds * 0.7) for (let x = -HW; x <= HW; x += ds * 0.7) {
		if (trySeed(x, y) || ++tried % 256 === 0) yield;
		yield* drain();
	}
	return ridges;
}

/** Evenly spaced streamlines (Jobard and Lefer), traced in one go. traceSteps is the same tracing, resumable. */
export function traceRidges(s: Spec, ds: number): Float32Array[] {
	const g = traceSteps(s, ds);
	for (;;) { const r = g.next(); if (r.done) return r.value; }
}

// ───────────────────────────────────────────────────────────── type on the ridges

export type Glyphs = {
	n: number;
	x: Float32Array; y: Float32Array; c: Float32Array; s: Float32Array; a: Float32Array; q: Uint8Array;
	ch: string[];
	ti: Int32Array; // per glyph: where its letter sits in the text (not wrapped)
	start: Int32Array; // per ridge: first glyph, plus one past the end
	box: Float32Array; // per ridge: minx, miny, maxx, maxy
};

let measureCtx: CanvasRenderingContext2D | null = null;
let widths = new Map<string, number>();
function widthOf(ch: string) {
	let w = widths.get(ch);
	if (w === undefined) {
		measureCtx ??= document.createElement("canvas").getContext("2d")!;
		measureCtx.font = `500 100px ${FONT}`;
		w = measureCtx.measureText(ch).width / 100;
		widths.set(ch, w);
	}
	return w;
}

// A canvas records its drawing and rasterises it when it is first used, so a print of thousands of letters set over
// many frames would spend the whole cost in the one frame that first shows it. Drawing it onto a 1 px canvas after each
// slice of work uses it at once, so the cost is paid slice by slice.
// Rasterising costs several times the drawing calls that recorded it, so a slice of work gives the drawing only its
// share of the time: rasterK (measured as it goes) is how many times longer rasterising takes than drawing.
let probe: CanvasRenderingContext2D | null = null;
export const raster = { k: 5 };
/** the time to spend drawing, out of a budget that must also cover rasterising it */
export const drawShare = (budget: number) => budget / (1 + raster.k);
export function settleCanvas(cv: HTMLCanvasElement, drewMs = 0) {
	if (!probe) { const c = document.createElement("canvas"); c.width = c.height = 1; probe = c.getContext("2d"); }
	if (!probe || !cv.width || !cv.height) return;
	const t = performance.now();
	probe.drawImage(cv, 0, 0, 1, 1);
	probe.canvas.width = 1; // drop the probe's own record of it
	if (drewMs > 0.3) raster.k = Math.max(0.5, Math.min(20, raster.k + ((performance.now() - t) / drewMs - raster.k) * 0.3));
}

// Glyph angles snap to 3° steps: a rasteriser caches each letter per angle, so this is what makes setting type fast.
const STEPS = 120;
const COS = new Float32Array(STEPS), SIN = new Float32Array(STEPS);
for (let i = 0; i < STEPS; i++) { COS[i] = Math.cos((i / STEPS) * TAU); SIN[i] = Math.sin((i / STEPS) * TAU); }
export const TYPE = 0.76; // type size as a share of the ridge gap

export function setType(ridges: Float32Array[], ds: number, text: string, offset: number, ink: (x: number, y: number) => number): Glyphs {
	const f = ds * TYPE;
	const X: number[] = [], Y: number[] = [], C: number[] = [], S: number[] = [], A: number[] = [], Q: number[] = [], CH: string[] = [];
	const start = new Int32Array(ridges.length + 1), box = new Float32Array(ridges.length * 4);
	const L = text.length, TI: number[] = [];
	let ti = offset % L; // counts on without wrapping; the letter is text[ti % L]
	ridges.forEach((r, ri) => {
		start[ri] = X.length;
		let minx = 9, miny = 9, maxx = -9, maxy = -9;
		for (let i = 0; i < r.length; i += 2) { if (r[i] < minx) minx = r[i]; if (r[i] > maxx) maxx = r[i]; if (r[i + 1] < miny) miny = r[i + 1]; if (r[i + 1] > maxy) maxy = r[i + 1]; }
		box.set([minx, miny, maxx, maxy], ri * 4);
		// begin each ridge on a word
		for (let g = 0; g < 40 && text[ti % L] !== " "; g++) ti++;
		while (text[ti % L] === " ") ti++;
		const n = r.length / 2;
		let seg = 0, segStart = 0, segLen = Math.hypot(r[2] - r[0], r[3] - r[1]), at = f * 0.3;
		for (;;) {
			const ch = text[ti % L];
			const adv = (widthOf(ch) + 0.045) * f, mid = at + adv / 2;
			while (seg < n - 2 && mid > segStart + segLen) { segStart += segLen; seg++; segLen = Math.hypot(r[seg * 2 + 2] - r[seg * 2], r[seg * 2 + 3] - r[seg * 2 + 1]); }
			if (mid + adv / 2 > segStart + segLen && seg >= n - 2) break;
			if (ch !== " ") {
				const u = (mid - segStart) / (segLen || 1);
				const x0 = r[seg * 2], y0 = r[seg * 2 + 1], dx = r[seg * 2 + 2] - x0, dy = r[seg * 2 + 3] - y0, l = Math.hypot(dx, dy) || 1;
				const x = x0 + dx * u, y = y0 + dy * u;
				const q = ((Math.round((Math.atan2(dy, dx) / TAU) * STEPS) % STEPS) + STEPS) % STEPS;
				X.push(x); Y.push(y); C.push(COS[q]); S.push(SIN[q]); Q.push(q); A.push(ink(x, y)); CH.push(ch); TI.push(ti);
			}
			at += adv;
			ti++;
		}
	});
	start[ridges.length] = X.length;
	return { n: X.length, x: Float32Array.from(X), y: Float32Array.from(Y), c: Float32Array.from(C), s: Float32Array.from(S), a: Float32Array.from(A), q: Uint8Array.from(Q), ch: CH, ti: Int32Array.from(TI), start, box };
}

// ───────────────────────────────────────────────────────────── the cast

type Pose = { x: number; y: number; r: number; rot: number; a: number };
type Item = {
	id: string;
	spec: Spec;
	gap: number; // ridge gap in px at full size
	rgb: [number, number, number];
	color: string;
	text: string;
	offset: number;
	phase: number;
	// built lazily
	ds: number;
	ridges: Float32Array[] | null;
	trace: { q: number; run: Generator<void, Float32Array[], void> } | null; // a tracing under way (geometry, a few ms at a time)
	field: ReturnType<typeof fieldOf> | null;
	glyphs: Glyphs | null;
	glyphEpoch: number;
	lines: boolean; // always drawn as ink lines, never type (the crowd)
	solid?: boolean; // with lines: every ridge at full ink and a little heavier (PrintOptions.litLines)
	sprite: (CanvasImageSource & { width: number; height: number }) | null;
	spriteR: number; spriteDpr: number; spriteEpoch: number; // the size, scale and face the sprite was set at (spriteEpoch -1: still being set)
	full: number; // the size it is drawn at when it is the subject
	edge: number; // 0..1: fades a print that has been pushed off the stage
	cap: number; // the tallest its sprite may be, device px
	lensPx: number; lensFont: string; // the last face set for it in the lens
	hit: { id: string };
	aim: number; // the ink it settles at once formed (threads end at this strength, so there is no jump to the sprite)
	fo: number; // 0..1: how far it has come forward as the print being inspected
	rest: Pose; // where it sits and how present it is, for the frame just drawn
};

const LAB_SPECS: Partial<Spec>[] = [
	/* plain whorl: rings */ { cores: [0, -0.1, 0, 0.02], deltas: [-0.56, 0.6, 0.56, 0.6], wob: 0.03 },
	/* loop */ { cores: [-0.06, -0.16], deltas: [0.46, 0.44], wob: 0.05, tilt: 0.1 },
	/* double loop: an S */ { cores: [-0.2, -0.2, 0.2, 0.2], deltas: [-0.62, 0.66, 0.62, 0.66], wob: 0.04 },
	/* plain arch */ { arch: 1.7, archW: 0.55, archY: 0.05, wob: 0.03 },
	/* spiral */ { cores: [0, -0.06, 0, -0.04], deltas: [-0.6, 0.7, 0.6, 0.7], twist: 0.62, wob: 0.02 },
	/* tented arch */ { cores: [0, -0.2], deltas: [0, 0.34], wob: 0.03 },
	/* loop, the other hand, leaning */ { cores: [0.1, 0.02], deltas: [-0.46, 0.5], wob: 0.05, tilt: -0.28 },
	/* central pocket */ { cores: [0, -0.3, 0, -0.16], deltas: [0.52, 0.5, -0.16, 0.14], wob: 0.04 },
	/* long whorl */ { cores: [0, -0.46, 0, 0.3], deltas: [-0.6, 0.8, 0.6, 0.8], wob: 0.03 },
	/* twin cores side by side */ { cores: [-0.3, -0.02, 0.3, 0.02], deltas: [0, 0.62, 0, -0.66], wob: 0.03 },
	/* peaked arch, counter-twisted */ { arch: 3.4, archW: 0.26, archY: -0.1, wob: 0.03, tilt: 0.0 },
];

function writerSpec(seed: number): Spec {
	const R = rng(seed * 977 + 5);
	const k = R(), side = R() < 0.5 ? -1 : 1, j = () => (R() - 0.5);
	const base = { wob: 0.07 + R() * 0.1, tilt: j() * 0.5, sq: 2 + R() * 0.7 };
	if (k < 0.5) return spec(seed, { ...base, cores: [side * -0.05 + j() * 0.2, -0.15 + j() * 0.3], deltas: [side * (0.36 + R() * 0.2), 0.3 + R() * 0.35] });
	if (k < 0.72) return spec(seed, { ...base, cores: [j() * 0.1, -0.2 + j() * 0.2, j() * 0.1, 0.0 + R() * 0.3], deltas: [-0.5 - R() * 0.15, 0.55 + j() * 0.2, 0.5 + R() * 0.15, 0.55 + j() * 0.2], twist: R() < 0.5 ? 0 : j() * 1.4 });
	if (k < 0.84) return spec(seed, { ...base, arch: 1.2 + R() * 2.4, archW: 0.28 + R() * 0.35, archY: j() * 0.4 });
	if (k < 0.93) return spec(seed, { ...base, cores: [j() * 0.1, -0.25 + j() * 0.2], deltas: [j() * 0.12, 0.25 + R() * 0.25] });
	return spec(seed, { ...base, cores: [-0.22 * side, -0.2, 0.22 * side, 0.2], deltas: [-0.62, 0.66, 0.62, 0.66] });
}

/** the hero's ridge text, once a hero exists (sprites.ts falls back to it) */
export let sharedText = "";
export const DEFAULT_SEED = 20261116, MAX_CROWD = 220;
/** The one source of patterns: the hero's cast and the small prints elsewhere on the page (sprites.ts) both ask here,
 * so lab 2 is the same print wherever it appears. */
export function patternSpec(family: "main" | "human" | "ai" | "lab" | "writer" | "lit", index = 0, seed = DEFAULT_SEED): Spec {
	if (family === "main") return spec(seed + 1, { cores: [-0.05, -0.2, 0.06, 0.08], deltas: [-0.58, 0.52, 0.52, 0.62], twist: 0.22, wob: 0.09 });
	if (family === "human") return spec(seed + 2, { cores: [-0.05, -0.18], deltas: [0.47, 0.46], wob: 0.13, tilt: 0.06 });
	if (family === "ai") return spec(seed + 3, { cores: [0, -0.08, 0, -0.02], deltas: [-0.58, 0.62, 0.58, 0.62], wob: 0, sq: 2.6 });
	if (family === "lit") return spec(seed + 99, { cores: [0.03, -0.14], deltas: [-0.45, 0.42], wob: 0.11, tilt: -0.08 });
	if (family === "lab") { const i = ((index % LAB_SPECS.length) + LAB_SPECS.length) % LAB_SPECS.length; return spec(seed + 10 + index, { ...LAB_SPECS[i], sq: 2.1 + ((index * 7) % 5) * 0.14 }); }
	const i = ((index % MAX_CROWD) + MAX_CROWD) % MAX_CROWD;
	return writerSpec(seed + 100 + i);
}

type Layout = {
	key: string; sx: number; sy: number; sw: number; sh: number; wide: boolean;
	main: number[]; // x, y, r
	human1: number[]; ai1: number[]; human2: number[]; crowd0: number[];
	lab2: number[][]; lab3: number[][];
	crowd: number[][]; // x, y, r, rot
	lit: number; litR: number;
};

// ───────────────────────────────────────────────────────────── renderer

export const createPrint: CreatePrint = (opts: PrintOptions): Print => {
	const seed = opts.seed ?? DEFAULT_SEED;
	const body = opts.text.join("   ") + "   ";
	sharedText = body; // the small prints elsewhere on the page set the same text
	const litBody = opts.litText + "   ";
	// each print's own passage (a lab's prose on its print, human prose on the human print and the crowd); the paper's
	// text wherever there is none
	const own = (t: string | undefined) => { const c = (t ?? "").replace(/\s+/g, " ").trim(); return c.length > 20 ? c + "   " : body; };
	const ridge = opts.ridge ?? {};
	const C = opts.colors;
	const R0 = rng(seed);

	const make = (id: string, sp: Spec, gap: number, color: string, text = body): Item => ({
		id, spec: sp, gap, color, rgb: hexRgb(color), text, offset: Math.floor(R0() * text.length), phase: R0() * TAU,
		lines: false, edge: 1, cap: 2600, lensPx: 0, lensFont: "", hit: { id }, aim: 1, fo: 0, ds: 0, ridges: null, trace: null, field: null, glyphs: null, glyphEpoch: -1, sprite: null, spriteR: 0, spriteDpr: 1, spriteEpoch: -1, full: 0,
		rest: { x: 0, y: 0, r: 0, rot: 0, a: 0 },
	});

	const main = make("main", patternSpec("main", 0, seed), 7.4, C.ink);
	const human = make("human", patternSpec("human", 0, seed), 6.6, C.human, own(ridge.human));
	const ai = make("ai", patternSpec("ai", 0, seed), 6.6, C.ai, own(ridge.ai));
	const labs = opts.labs.map((name, i) => make(`lab:${name}`, patternSpec("lab", i, seed), i < 3 ? 5.2 : 4.6, C.labs[i] ?? C.other, own(ridge.labs?.[name])));
	for (const it of labs) it.cap = 640;
	const writerText = ridge.writers?.length ? ridge.writers.map(own) : [body];
	const crowd: Item[] = [];
	for (let i = 0; i < MAX_CROWD; i++) { const it = make(`writer:${i}`, patternSpec("writer", i, seed), 3.7, C.human, writerText[i % writerText.length]); it.lines = true; it.cap = 200; crowd.push(it); }
	const lit = make("lit", patternSpec("lit", 0, seed), 5.8, C.lit, litBody);
	lit.offset = 0;
	if (opts.litLines) { lit.lines = true; lit.solid = true; } // opt-in (the launch video): the found writer as solid ink
	const cast = [main, human, ai, lit, ...labs];
	const byId = new Map<string, Item>();
	for (const it of [...cast, ...crowd]) byId.set(it.id, it);
	let litIndex = -1;

	let e = -1; // eased level
	let fontEpoch = 0, fontAsked = false, fontReady = false, firstT = 0;
	let tile: HTMLCanvasElement | null = null, tg: CanvasRenderingContext2D | null = null; // for the few prints that touch a quiet box
	let L: Layout | null = null;
	let lensMag = 3, lensA = 0, lensX = 0, lensY = 0;
	const drawn: Item[] = [];
	const onStage = new Set<Item>(); // the same prints as drawn, for lookups
	let poseE = NaN, poseL: Layout | null = null;
	let active = true, dirty = false; // busy(): something is still moving; something changed between frames
	let lastPX = NaN, lastPY = NaN, anyFo = false;
	let aimX = 0, aimY = 0; // where the glass looks, relative to where it sits
	let stillNow = true, dprNow = 1;
	// breathing: each print drifts a hair on its own clock. The clock ticks 20 times a second, so when breathing is the
	// only motion two frames in three have nothing new to draw; it stops when the art is off stage or motion is reduced.
	const BREATH_HZ = 20;
	let breathTick = 0, bt = 0, breathing = false;
	const swell = (it: Item) => (breathing ? 1 + 0.007 * Math.sin(bt * 0.55 + it.phase) : 1) * (1 + 0.04 * it.fo);
	// inspection: the print under the lens comes forward to full ink and lifts a little, the others step back
	let focusItem: Item | null = null, focusTwin: Item | null = null, dim = 0;
	const RECEDE = 0.6;
	const inkOf = (it: Item) => { const a = it.rest.a; return a * lerp(1 - (1 - RECEDE) * dim, 1, it.fo) + it.fo * (1 - a) * ss(0.1, 0.4, a); };
	let lensR = 0, lensShown = false, lensTop: Item | null = null;
	let readKey = "", readText: string | null = null;
	const sway = (it: Item) => (breathing ? 0.008 * Math.sin(bt * 0.37 + it.phase * 1.7) : 0);
	let disposed = false;
	let lastGoal = 0, leap: { from: number; to: number; t: number; dur: number } | null = null;
	let movedT = -1; // when the stage last changed
	let traced = false; // every print on the cast has its ridges

	// ── geometry and sprites, built on demand

	/** true once the print's ridges suit its size; otherwise traces on until the deadline (a large print takes tens of
	 * ms, so it is traced over several frames) and returns false */
	function geometry(it: Item, deadline = Infinity): boolean {
		// the ridge gap is fixed in px, so smaller prints have fewer, bolder ridges; quantised so a resize rarely retraces
		const want = it.gap / Math.max(8, it.full);
		const q = Math.pow(1.18, Math.round(Math.log(want) / Math.log(1.18)));
		// ridges already traced are kept unless the print's size has changed a good deal (two steps): a stage that settles
		// a little larger or smaller re-sets the sprite from the same ridges
		if (it.ridges && Math.abs(Math.log(q / it.ds)) < 0.36) { it.trace = null; return true; }
		if (!it.trace || it.trace.q !== q) it.trace = { q, run: traceSteps(it.spec, q) };
		let r = it.trace.run.next();
		while (!r.done && performance.now() < deadline) r = it.trace.run.next();
		if (!r.done) return false;
		it.trace = null;
		it.ds = q;
		it.field = fieldOf(it.spec);
		it.ridges = r.value;
		it.glyphs = null; it.lensPx = 0; splits.length = 0; // the old sprite stays up until the new one is whole
		return true;
	}
	function glyphsOf(it: Item): Glyphs {
		if (!it.glyphs || it.glyphEpoch !== fontEpoch) { it.glyphs = setType(it.ridges!, it.ds, it.text, it.offset, it.field!.ink); it.glyphEpoch = fontEpoch; }
		return it.glyphs;
	}
	const typePx = (it: Item, r: number) => it.ds * TYPE * r;

	// Sprites are set a few ms at a time, so a large print inks in over several frames instead of stalling one: first
	// the hairline under the type (or the ink lines), a batch of ridges at a time, then the letters.
	type Job = { it: Item; cv: HTMLCanvasElement; g: CanvasRenderingContext2D; epoch: number; dpr: number; r: number; ox: number; oy: number; k: number; i: number; G: Glyphs | null; ri: number; lw: number };
	let job: Job | null = null; // a print on stage being set (in the frame loop)
	let bgJob: Job | null = null; // a print off stage being set (in idle moments)

	/** sprite pixels per px: the screen's, but never above 2, nor past the print's cap */
	const scaleOf = (it: Item, dpr: number) => Math.min(dpr, 2, it.cap / (2 * it.full + 6));

	function begin(it: Item, screenDpr: number): Job {
		geometry(it); // (already traced: the caller waits for geometry first)
		const r = it.full, dpr = scaleOf(it, screenDpr);
		const pad = 3, w = Math.ceil((2 * HW * r + pad * 2) * dpr), h = Math.ceil((2 * r + pad * 2) * dpr);
		const cv = document.createElement("canvas");
		cv.width = w; cv.height = h;
		const g = cv.getContext("2d")!;
		const ox = (HW * r + pad) * dpr, oy = (r + pad) * dpr, k = r * dpr;
		const fpx = typePx(it, r);
		let G: Glyphs | null = null;
		g.fillStyle = g.strokeStyle = it.color;
		let lw = 0;
		if (fpx >= 2.7 && !it.lines) {
			// a hairline under the type keeps each ridge whole (laid in step(), a batch of ridges at a time)
			g.lineWidth = Math.max(0.5, fpx * 0.07) * dpr; g.globalAlpha = 0.16; g.lineJoin = "round";
			G = glyphsOf(it);
		} else {
			// too small for type: the ridges as ink lines, pressed unevenly (in step())
			g.lineCap = "round"; g.lineJoin = "round";
			lw = it.ds * k * 0.4;
		}
		// a print with nothing to show yet shows its sprite as it is set; one being re-set keeps the old until the new is whole
		if (!it.sprite) { it.sprite = cv; it.spriteR = r; it.spriteDpr = dpr; it.spriteEpoch = -1; }
		return { it, cv, g, epoch: fontEpoch, dpr, r, ox, oy, k, i: 0, G, ri: 0, lw };
	}

	/** set more of the job's ridges, then its type; true when the sprite is finished */
	function step(j: Job, deadline: number): boolean {
		const { g, G, ox, oy, k } = j;
		const rs = j.it.ridges!;
		if (j.ri < rs.length) {
			// the same strokes as one pass over every ridge, in batches (the hairline under type is one path per batch:
			// its strokes are one colour and alpha, so the batches read as one)
			const it = j.it;
			while (j.ri < rs.length) {
				const end = Math.min(rs.length, j.ri + 24);
				if (G) {
					g.beginPath();
					for (; j.ri < end; j.ri++) { const rd = rs[j.ri]; g.moveTo(ox + rd[0] * k, oy + rd[1] * k); for (let i = 2; i < rd.length; i += 2) g.lineTo(ox + rd[i] * k, oy + rd[i + 1] * k); }
					g.stroke();
				} else for (; j.ri < end; j.ri++) {
					const rd = rs[j.ri], mid = (rd.length >> 2) << 1;
					g.globalAlpha = it.solid ? 1 : 0.55 + 0.4 * it.field!.ink(rd[mid], rd[mid + 1]);
					g.lineWidth = j.lw * (it.solid ? 1.3 : 0.8 + 0.4 * it.field!.ink(rd[0], rd[1]));
					g.beginPath(); g.moveTo(ox + rd[0] * k, oy + rd[1] * k);
					for (let i = 2; i < rd.length; i += 2) g.lineTo(ox + rd[i] * k, oy + rd[i + 1] * k);
					g.stroke();
				}
				if (j.ri < rs.length && performance.now() > deadline) return false;
			}
			if (G) { g.font = `500 ${typePx(it, j.r) * j.dpr}px ${FONT}`; g.textAlign = "center"; g.textBaseline = "middle"; }
		}
		if (G) {
			while (j.i < G.n) {
				for (const end = Math.min(G.n, j.i + 48); j.i < end; j.i++) {
					const i = j.i;
					g.globalAlpha = G.a[i];
					g.setTransform(G.c[i], G.s[i], -G.s[i], G.c[i], ox + G.x[i] * k, oy + G.y[i] * k);
					g.fillText(G.ch[i], 0, 0);
				}
				if (j.i < G.n && performance.now() > deadline) { g.setTransform(1, 0, 0, 1, 0, 0); return false; }
			}
			g.setTransform(1, 0, 0, 1, 0, 0);
		}
		const it = j.it;
		if (it.sprite !== j.cv) (it.sprite as any)?.close?.();
		// keep it as an immutable bitmap where the browser has one: it blits much faster than a live canvas
		if (typeof OffscreenCanvas !== "undefined") {
			const oc = new OffscreenCanvas(j.cv.width, j.cv.height);
			oc.getContext("2d")!.drawImage(j.cv, 0, 0);
			it.sprite = oc.transferToImageBitmap();
			j.cv.width = j.cv.height = 0;
		} else it.sprite = j.cv;
		it.spriteR = j.r; it.spriteDpr = j.dpr; it.spriteEpoch = j.epoch;
		return true;
	}

	// ── where everything sits at each level, from the stage alone

	function layout(S: Box): Layout {
		if (L && L.sx === (S.x | 0) && L.sy === (S.y | 0) && L.sw === (S.w | 0) && L.sh === (S.h | 0)) return L;
		const key = `${S.x | 0},${S.y | 0},${S.w | 0},${S.h | 0}`;
		const wide = S.w > S.h * 0.9;
		if (L && (L.wide !== wide)) splits.length = 0;
		const cx = S.x + S.w / 2, cy = S.y + S.h / 2;
		const r0 = Math.min(S.h * 0.455, S.w * 0.55);
		const r1 = Math.min(S.h * 0.33, S.w * 0.275);
		const human2 = wide ? [S.x + S.w * 0.095, cy, Math.min(S.h, S.w) * 0.115] : [S.x + S.w * 0.12, S.y + S.h * 0.925, S.h * 0.065];
		// level 2 shows the labs alone (the human print has gone), so they take the whole stage, centred
		const G = wide ? { x: S.x + S.w * 0.03, y: S.y + S.h * 0.045, w: S.w * 0.94, h: S.h * 0.9 } : { x: S.x + S.w * 0.02, y: S.y, w: S.w * 0.96, h: S.h * 0.84 };
		const rBig = Math.min(G.h * 0.2, G.w / 6.1), rSmall = Math.min(G.h * 0.105, G.w / 10.2);
		const J = rng(seed + 7);
		const lab2 = labs.map((_, i) => {
			if (i < 3) return [G.x + G.w * ((i + 0.5) / 3), G.y + G.h * 0.235 + (i === 1 ? G.h * 0.012 : 0), rBig];
			const k = i - 3, row = Math.floor(k / 4), col = k % 4;
			return [G.x + G.w * ((col + 0.5) / 4) + (J() - 0.5) * G.w * 0.012, G.y + G.h * (row ? 0.865 : 0.61) + (J() - 0.5) * G.h * 0.014, rSmall];
		});
		const n = labs.length;
		const x0 = S.x + S.w * (wide ? 0.3 : 0.06), x1 = S.x + S.w * (wide ? 0.965 : 0.94);
		const r3 = Math.min(S.h * 0.034, ((x1 - x0) / Math.max(1, n - 1)) * 0.5);
		const lab3 = labs.map((_, i) => [lerp(x0, x1, n > 1 ? i / (n - 1) : 0.5), S.y + S.h * 0.05, r3 * (i < 3 ? 1 : 0.82)]);
		// the crowd: a loose hex packing under the row of labs
		const K = { x: S.x + S.w * 0.01, y: S.y + S.h * 0.125, w: S.w * 0.98, h: S.h * 0.865 };
		const pitch = Math.max(30, Math.min(66, Math.sqrt((K.w * K.h) / (wide ? 165 : 84)))); // fewer, larger writers on a phone
		const rowH = pitch * 0.96, cols = Math.max(2, Math.floor(K.w / pitch)), rws = Math.max(2, Math.floor(K.h / rowH));
		const padX = (K.w - (cols - 0.5) * pitch) / 2, padY = (K.h - (rws - 1) * rowH) / 2;
		const P = rng(seed + 8);
		const pts: number[][] = [];
		for (let j = 0; j < rws; j++) for (let i = 0; i < cols; i++) {
			if (pts.length >= MAX_CROWD) break;
			pts.push([K.x + padX + (i + (j % 2) * 0.5) * pitch + (P() - 0.5) * pitch * 0.14, K.y + padY + j * rowH + (P() - 0.5) * pitch * 0.14, pitch * (0.36 + P() * 0.09), (P() - 0.5) * 0.5]);
		}
		// the lit writer: the one nearest a point right of centre
		const tx = K.x + K.w * (wide ? 0.56 : 0.5), ty = K.y + K.h * 0.47;
		let best = 0, bd = 1e9;
		pts.forEach((p, i) => { const d = (p[0] - tx) ** 2 + (p[1] - ty) ** 2; if (d < bd) { bd = d; best = i; } });
		const litR = Math.min(K.h * 0.19, K.w * 0.23);
		L = { key, sx: S.x | 0, sy: S.y | 0, sw: S.w | 0, sh: S.h | 0, wide, main: [cx, cy, r0], human1: [cx - S.w * 0.25, cy, r1], ai1: [cx + S.w * 0.25, cy, r1], human2, crowd0: [K.x + K.w / 2, K.y + K.h / 2, Math.min(K.h * 0.34, K.w * 0.34)], lab2, lab3, crowd: pts, lit: best, litR };
		// full sizes decide ridge counts and sprite sizes
		main.full = r0; human.full = r1; ai.full = r1;
		labs.forEach((it, i) => (it.full = lab2[i][2]));
		crowd.forEach((it, i) => (it.full = pts[i] ? pts[i][2] : 0));
		// each writer takes the colour of the band of the stage it stands in (the kinds of text, left to right)
		// (or, with crowdColors, the colour given for that writer: the kinds mixed through the crowd)
		const bands = opts.crowdBands, per = opts.crowdColors;
		if (per?.length || bands?.length) for (let i = 0; i < pts.length; i++) {
			let color: string;
			if (per?.length) color = per[i % per.length];
			else {
				const u = (pts[i][0] - S.x) / (S.w || 1);
				color = bands![bands!.length - 1].color;
				for (let b = 0; b < bands!.length; b++) if (u <= bands![b].to) { color = bands![b].color; break; }
			}
			const it = crowd[i];
			if (it.color === color) continue;
			// a new colour is a new sprite, and new thread colours for the division it forms in
			it.color = color; it.rgb = hexRgb(color);
			(it.sprite as any)?.close?.(); it.sprite = null; it.spriteEpoch = -1;
			splits[2] = null;
		}
		lit.full = litR;
		litIndex = best; traced = false;
		return L;
	}

	const set = (it: Item, x: number, y: number, r: number, rot: number, a: number) => { const p = it.rest; p.x = x; p.y = y; p.r = r; p.rot = rot; p.a = a; };
	const M3 = [0, 0, 0];
	const mix3 = (a: number[], b: number[], t: number) => { M3[0] = lerp(a[0], b[0], t); M3[1] = lerp(a[1], b[1], t); M3[2] = lerp(a[2], b[2], t); return M3; };

	function pose(l: Layout, S: Box) {
		const p1 = clamp01(e), p2 = clamp01(e - 1), p3 = clamp01(e - 2);
		const q1 = ease(p1), q2 = ease(p2);
		// each division is drawn as threads (see Split); the cached prints only hold the two ends of it
		const IN = (p: number) => ss(0.84, 1, p), OUT = (p: number) => 1 - ss(0, 0.12, p);
		set(main, l.main[0], l.main[1], l.main[2], 0, OUT(p1));
		// the human print steps out as the labs form (it does not travel); at 3 it returns in the middle of the stage,
		// only as the threads the crowd blooms from
		const hp = p3 > 0 ? l.crowd0 : l.human1;
		// level 2 is about the labs only: the human print leaves (Atrey, 16 Nov), and the crowd re-forms from its place at 3
		set(human, hp[0], hp[1], hp[2], 0, IN(p1) * (1 - ss(0, 0.22, p2)) * OUT(p3));
		set(ai, l.ai1[0], l.ai1[1], l.ai1[2], 0, IN(p1) * OUT(p2));
		// 2 → 3: the labs draw up into a row and step back
		labs.forEach((it, i) => {
			const t3 = ease(clamp01(p3 * 2.3 - i * 0.03)); // gone to their row before the crowd forms
			const p = mix3(l.lab2[i], l.lab3[i], t3);
			set(it, p[0], p[1], p[2], 0, IN(p2) * lerp(1, 0.42, t3));
		});
		// 2 → 3: the lit writer grows and the rest make room
		const grow = ease(clamp01((p3 - 0.55) / 0.45));
		const lp = l.crowd[l.lit];
		const push = (l.litR + lp[2]) * 1.02 * grow;
		for (let i = 0; i < crowd.length; i++) {
			const c = l.crowd[i], it = crowd[i];
			if (!c) { it.rest.a = 0; continue; }
			let x = c[0], y = c[1], room = 1;
			if (i !== l.lit && push > 0) {
				// those it would cover step out; those beside it shift a little
				const dx = (x - lp[0]) / (HW * 1.12), dy = y - lp[1], d = Math.hypot(dx, dy) || 1, d2 = Math.sqrt(d * d + push * push * 0.3);
				x = lp[0] + (dx / d) * d2 * HW * 1.12; y = lp[1] + (dy / d) * d2;
				room = 1 - grow * (1 - ss(0.86, 1.06, d2 / (l.litR + c[2])));
			}
			const out = Math.min(ss(S.x - c[2], S.x + c[2] * 0.5, x), 1 - ss(S.x + S.w - c[2] * 0.5, S.x + S.w + c[2], x), 1 - ss(S.y + S.h - c[2] * 0.4, S.y + S.h + c[2], y));
			it.edge = out * room;
			if (i === l.lit) {
				set(it, x, y, lerp(c[2], l.litR, grow), c[3] * (1 - grow), IN(p3) * (1 - ss(0.25, 0.8, grow)));
				set(lit, x, y, it.rest.r, it.rest.rot, ss(0.1, 0.7, grow));
			} else set(it, x, y, c[2], c[3], IN(p3) * out * room * lerp(0.86, 0.62, grow));
			it.aim = lerp(0.86, 0.62, grow);
		}
	}

	// ── divisions: the parent's ridges, cut into threads, travel and re-form as the children's ridges

	type Split = {
		parent: Item; kids: Item[];
		first: Int32Array; // per child: its first thread
		off: Int32Array; // per thread: its first point
		src: Float32Array; dst: Float32Array; // the thread on the parent, and as the child's ridge (unit space of each)
		hue: string[][]; // per child: the colours from the parent's to its own
		cx: Float32Array; cy: Float32Array; cs: Float32Array; // per child: its piece of the parent (centre, and the scale that fits it to the child)
		kd: Float32Array; // per child: when it leaves
		td: Float32Array; // per thread: when it re-forms
	};
	const splits: (Split | null)[] = [];

	/** Cut the parent into one compact piece per child, laid out the way the children will sit, and pair every child
	 * ridge with a stretch of parent ridge from its piece. */
	function buildSplit(parent: Item, kids: Item[], home: number[], homes: number[][]): Split | null {
		if (!parent.ridges || kids.some((k) => !k.ridges)) return null;
		const R = rng(seed + 31 + kids.length), nk = kids.length;
		// where each child's piece is centred inside the parent: the children's own arrangement, shrunk to fit
		let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
		for (const h of homes) { x0 = Math.min(x0, h[0]); x1 = Math.max(x1, h[0]); y0 = Math.min(y0, h[1]); y1 = Math.max(y1, h[1]); }
		const seedX = new Float32Array(nk), seedY = new Float32Array(nk);
		for (let k = 0; k < nk; k++) {
			let u = x1 > x0 ? ((homes[k][0] - x0) / (x1 - x0)) * 2 - 1 : 0, v = y1 > y0 ? ((homes[k][1] - y0) / (y1 - y0)) * 2 - 1 : 0;
			// a square of seats into the oval
			const sq = Math.sqrt(Math.max(1e-6, u * u + v * v - u * u * v * v)) / Math.max(1e-6, Math.hypot(u, v));
			u *= sq; v *= sq;
			seedX[k] = u * HW * 0.8; seedY[k] = v * 0.82;
		}
		// the parent's ridges in short runs, each given to the nearest seat
		const hp = parent.ds * 0.3, cell = Math.sqrt((HW * 4) / nk);
		const M = Math.max(4, Math.round(Math.max(0.09, Math.min(0.6, cell * 0.8)) / hp));
		type Run = { r: Float32Array; i0: number; i1: number; x: number; y: number };
		const share: Run[][] = kids.map(() => []), runs: Run[] = [];
		for (const r of parent.ridges) {
			const n = r.length / 2;
			for (let i0 = 0; i0 < n - 2; i0 += M) {
				const i1 = Math.min(n - 1, i0 + M), m = (i0 + i1) >> 1;
				const run = { r, i0, i1, x: r[m * 2], y: r[m * 2 + 1] };
				let best = 0, bd = 1e9;
				for (let k = 0; k < nk; k++) { const d = (run.x - seedX[k]) ** 2 + (run.y - seedY[k]) ** 2; if (d < bd) { bd = d; best = k; } }
				share[best].push(run); runs.push(run);
			}
		}
		const cx = new Float32Array(nk), cy = new Float32Array(nk), cs = new Float32Array(nk), kd = new Float32Array(nk);
		let far = 1;
		const dist = homes.map((h) => Math.hypot(h[0] - home[0], h[1] - home[1]));
		for (const d of dist) far = Math.max(far, d);
		const first = new Int32Array(nk + 1), off: number[] = [0], src: number[] = [], dst: number[] = [], td: number[] = [];
		kids.forEach((kid, ki) => {
			first[ki] = off.length - 1;
			const mine = share[ki];
			if (!mine.length) { // a seat no run fell in: borrow the nearest one
				let best = runs[0], bd = 1e9;
				for (const run of runs) { const d = (run.x - seedX[ki]) ** 2 + (run.y - seedY[ki]) ** 2; if (d < bd) { bd = d; best = run; } }
				mine.push(best);
			}
			mine.sort((a, b) => a.y - b.y);
			let sx = 0, sy = 0, np = 0, rad = 0.02;
			for (const run of mine) for (let i = run.i0; i <= run.i1; i++) { sx += run.r[i * 2]; sy += run.r[i * 2 + 1]; np++; }
			cx[ki] = sx / np; cy[ki] = sy / np;
			for (const run of mine) for (let i = run.i0; i <= run.i1; i += 2) rad = Math.max(rad, Math.hypot((run.r[i * 2] - cx[ki]) / HW, run.r[i * 2 + 1] - cy[ki]));
			cs[ki] = 0.92 / rad;
			kd[ki] = clamp01((dist[ki] / far) * 0.75 + R() * 0.25);
			// the child's ridges top to bottom take the piece's runs top to bottom
			const rs = kid.ridges!, nr = rs.length;
			const order = rs.map((r, j) => [r[((r.length >> 2) << 1) + 1], j]).sort((a, b) => a[0] - b[0]);
			order.forEach(([, j], rank) => {
				const r = rs[j], n = r.length / 2, N = Math.max(2, Math.round(n / 3));
				const run = mine[Math.min(mine.length - 1, Math.floor(((rank + 0.5) / nr) * mine.length))];
				const at = dst.length;
				for (let q = 0; q < N; q++) { const i = Math.round((q / (N - 1)) * (n - 1)); dst.push(r[i * 2], r[i * 2 + 1]); }
				const s0 = src.length;
				// take only as much parent ridge as the child ridge is long (at the piece's scale): a short child ridge
				// stretched over a whole run drew a long straight chord across the print mid-division (Atrey, 16 Nov)
				const span = Math.max(1, Math.min(run.i1 - run.i0, ((n - 1) * kid.ds) / (cs[ki] * parent.ds)));
				const a0 = run.i0 + (run.i1 - run.i0 - span) * R();
				for (let q = 0; q < N; q++) {
					const u = a0 + (q / (N - 1)) * span, i = Math.min(run.i1 - 1, Math.floor(u)), f = u - i;
					src.push(lerp(run.r[i * 2], run.r[i * 2 + 2], f), lerp(run.r[i * 2 + 1], run.r[i * 2 + 3], f));
				}
				// run the thread the way that twists least
				const e0 = s0 + N * 2 - 2, e1 = at + N * 2 - 2, k = cs[ki];
				const ax = (src[s0] - cx[ki]) * k, ay = (src[s0 + 1] - cy[ki]) * k, bx = (src[e0] - cx[ki]) * k, by = (src[e0 + 1] - cy[ki]) * k;
				if ((ax - dst[at]) ** 2 + (ay - dst[at + 1]) ** 2 + (bx - dst[e1]) ** 2 + (by - dst[e1 + 1]) ** 2 > (ax - dst[e1]) ** 2 + (ay - dst[e1 + 1]) ** 2 + (bx - dst[at]) ** 2 + (by - dst[at + 1]) ** 2)
					for (let a = 0, b = N - 1; a < b; a++, b--) for (let c = 0; c < 2; c++) { const t = src[s0 + a * 2 + c]; src[s0 + a * 2 + c] = src[s0 + b * 2 + c]; src[s0 + b * 2 + c] = t; }
				off.push(dst.length / 2);
				td.push(clamp01((rank / nr) * 0.9 + R() * 0.1));
			});
		});
		first[nk] = off.length - 1;
		const hue = kids.map((k) => Array.from({ length: HUES }, (_, i) => mixRgb(parent.rgb, k.rgb, i / (HUES - 1))));
		return { parent, kids, hue, first, off: Int32Array.from(off), src: Float32Array.from(src), dst: Float32Array.from(dst), cx, cy, cs, kd, td: Float32Array.from(td) };
	}

	const BINS = 5, HUES = 12;
	const DASH = [0, 0, 0, 0, 0, 0], SOLID: number[] = [];
	/** One division at progress p. The parent comes apart into its pieces, each piece travels to its child's place,
	 * and there its threads re-form, top to bottom, into the child's own ridges. */
	function weave(g: CanvasRenderingContext2D, sp: Split, p: number, aFrom: number, dashed: boolean, gain: number) {
		const env = ss(0, 0.14, p) * (1 - ss(0.88, 1, p)) * gain;
		if (env < 0.01) return;
		const P = sp.parent.rest, wp = sp.parent.ds * P.r * 0.27;
		g.lineCap = "butt"; g.lineJoin = "round";
		for (let ki = 0; ki < sp.kids.length; ki++) {
			const kid = sp.kids[ki], K = kid.rest, edge = kid.edge;
			if (K.r < 0.5 || edge < 0.01) continue;
			const c = Math.cos(K.rot) * K.r, sn = Math.sin(K.rot) * K.r;
			const d = sp.kd[ki] * 0.16;
			const m = ease((p - 0.02 - d) / 0.38); // the piece travels
			// the piece at rest in the parent, and carried to the child: it grows or shrinks to the child's size and turns
			// to the child's tilt on the way, as one rigid piece, so that re-forming is not also a twist
			const k0 = lerp(P.r, K.r * sp.cs[ki], m), pcx = sp.cx[ki], pcy = sp.cy[ki];
			const ox = lerp(P.x + pcx * P.r, K.x, m), oy = lerp(P.y + pcy * P.r, K.y, m);
			const rc = Math.cos(K.rot * m) * k0, rs = Math.sin(K.rot * m) * k0;
			// threads end as heavy as the cached print they hand over to
			const wk = kid.ds * K.r * (kid.lines ? 0.4 : 0.2), aTo = (kid.lines ? 0.8 : 0.62) * kid.aim;
			const hue = sp.hue[ki][Math.round(ss(0.1, 0.8, m) * (HUES - 1))];
			for (let b = 0; b < BINS; b++) {
				let any = false;
				for (let th = sp.first[ki], end = sp.first[ki + 1]; th < end; th++) {
					const f = ease((p - 0.3 - d - sp.td[th] * 0.3) / 0.14); // the thread re-forms, one after another down the print
					if (Math.min(BINS - 1, Math.floor(f * BINS)) !== b) continue;
					if (!any) { any = true; g.beginPath(); }
					const u = 1 - f;
					for (let i = sp.off[th], e2 = sp.off[th + 1], i0 = i; i < e2; i++) {
						const sx = sp.src[i * 2] - pcx, sy = sp.src[i * 2 + 1] - pcy, dx = sp.dst[i * 2], dy = sp.dst[i * 2 + 1];
						const x = u * (ox + sx * rc - sy * rs) + f * (K.x + dx * c - dy * sn);
						const y = u * (oy + sx * rs + sy * rc) + f * (K.y + dx * sn + dy * c);
						if (i === i0) g.moveTo(x, y); else g.lineTo(x, y);
					}
				}
				if (!any) continue;
				const tb = b / (BINS - 1), mix = (m + tb) / 2;
				const lw = Math.max(0.4, lerp(lerp(wp, wk, m * 0.5), wk, tb));
				g.strokeStyle = hue;
				g.lineWidth = lw;
				if (dashed) { DASH[0] = lw * 9; DASH[1] = lw * 1.6; DASH[2] = lw * 4; DASH[3] = lw * 1.6; DASH[4] = lw * 13; DASH[5] = lw * 2.2; g.setLineDash(DASH); }
				g.globalAlpha = env * lerp(aFrom, aTo * edge, mix);
				g.stroke();
			}
		}
		if (dashed) g.setLineDash(SOLID);
		g.globalAlpha = 1;
	}

	function weaveAll(g: CanvasRenderingContext2D, l: Layout, gain: number) {
		const p1 = clamp01(e), p2 = clamp01(e - 1), p3 = clamp01(e - 2);
		const live = l.crowd.length;
		if (splits[2] && splits[2].kids.length !== live) splits[2] = null;
		if (p1 > 0 && p1 < 1) { splits[0] ??= buildSplit(main, [human, ai], l.main, [l.human1, l.ai1]); if (splits[0]) weave(g, splits[0], p1, 0.8, true, gain); }
		if (p2 > 0 && p2 < 1) { splits[1] ??= buildSplit(ai, labs, l.ai1, l.lab2); if (splits[1]) weave(g, splits[1], p2, 0.8, true, gain); }
		if (p3 > 0 && p3 < 1) { splits[2] ??= buildSplit(human, crowd.slice(0, live), l.crowd0, l.crowd); if (splits[2]) weave(g, splits[2], clamp01((p3 - 0.1) / 0.9), 0.5, false, gain); } // the labs start for their row first
	}

	// ── drawing

	/** a cached print, straight onto the page's canvas; (ox, oy) shifts it and `a` is its opacity */
	function stamp(g: CanvasRenderingContext2D, it: Item, sc: number, ox: number, oy: number, a: number) {
		const p = it.rest, sp = it.sprite!, rot = p.rot + sway(it);
		const k = (p.r * swell(it)) / it.spriteR, w = sp.width / it.spriteDpr, h = sp.height / it.spriteDpr;
		g.globalAlpha = a;
		if (rot) {
			const c = Math.cos(rot) * k * sc, s = Math.sin(rot) * k * sc;
			g.setTransform(c, s, -s, c, (p.x - ox) * sc, (p.y - oy) * sc);
			g.drawImage(sp, -w / 2, -h / 2, w, h);
			g.setTransform(sc, 0, 0, sc, -ox * sc, -oy * sc);
		} else g.drawImage(sp, p.x - (w * k) / 2, p.y - (h * k) / 2, w * k, h * k);
	}

	const FEATHER = 44;
	/** Ink fades to near nothing inside the quiet boxes, softly at their edges. Almost every print is clear of them and
	 * is stamped directly; one that touches a box is stamped onto a tile its own size, faded there, and that is placed. */
	function stampFaded(ctx: CanvasRenderingContext2D, it: Item, quiet: Box[], dpr: number, a: number) {
		const p = it.rest, bw = p.r * HW * 2.3, bh = p.r * 2.3, bx = p.x - bw / 2, by = p.y - bh / 2;
		const sc = Math.min(dpr, 2), pw = Math.ceil(bw * sc), ph = Math.ceil(bh * sc);
		if (!tile) { tile = document.createElement("canvas"); tg = tile.getContext("2d")!; }
		if (tile.width < pw || tile.height < ph) { tile.width = Math.max(tile.width, pw); tile.height = Math.max(tile.height, ph); }
		const g = tg!;
		g.setTransform(1, 0, 0, 1, 0, 0);
		g.globalCompositeOperation = "source-over";
		g.clearRect(0, 0, pw, ph);
		g.setTransform(sc, 0, 0, sc, -bx * sc, -by * sc);
		stamp(g, it, sc, bx, by, 1);
		g.globalCompositeOperation = "destination-out";
		g.globalAlpha = 0.2; g.fillStyle = "#000";
		// feathered by stacking insets: soft on every side, no filters
		for (let qi = 0; qi < quiet.length; qi++) {
			const q = quiet[qi];
			for (let i = 0; i < 12; i++) { const o = FEATHER * (1 - i / 11); g.fillRect(q.x - o, q.y - o, q.w + o * 2, q.h + o * 2); }
		}
		ctx.globalAlpha = a;
		ctx.drawImage(tile, 0, 0, pw, ph, bx, by, pw / sc, ph / sc);
	}
	const touches = (it: Item, quiet: Box[]) => {
		const p = it.rest, hw = p.r * HW * 1.15 + FEATHER, hh = p.r * 1.15 + FEATHER;
		for (let i = 0; i < quiet.length; i++) { const q = quiet[i]; if (p.x + hw > q.x && p.x - hw < q.x + q.w && p.y + hh > q.y && p.y - hh < q.y + q.h) return true; }
		return false;
	};

	/** One print's ridges as live type: what lies around (px, py), magnified and drawn around (lx, ly). Only the glyphs
	 * under the glass are set. */
	function decipher(g: CanvasRenderingContext2D, it: Item, px: number, py: number, mag: number, rad: number, dpr: number, gain: number, lx: number, ly: number) {
		const p = it.rest;
		if (p.a < 0.02 || !it.ridges) return;
		const pr = p.r * swell(it), prot = p.rot + sway(it);
		const cr = Math.cos(prot), sr = Math.sin(prot);
		const dx = (px - p.x) / pr, dy = (py - p.y) / pr;
		const ux = dx * cr + dy * sr, uy = -dx * sr + dy * cr;
		const f = it.ds * TYPE, ru = rad / mag / pr + f;
		if (Math.abs(ux) > HW + ru || Math.abs(uy) > 1 + ru) return;
		const G = glyphsOf(it), ru2 = ru * ru, k = pr * mag;
		g.fillStyle = it.color;
		// sizes from the resting size, and snapped angles, so the glass reuses cached letters while prints breathe
		const size = Math.max(1, Math.round(f * p.r * mag * dpr)) / dpr; // whole device px: few distinct sizes while things grow or the glass refocuses
		if (size !== it.lensPx) { it.lensPx = size; it.lensFont = `500 ${size}px ${FONT}`; }
		g.font = it.lensFont; g.textAlign = "center"; g.textBaseline = "middle";
		const rq = Math.round((prot / TAU) * STEPS) + STEPS * 4;
		const nr = it.ridges.length, pa = inkOf(it) * gain;
		for (let ri = 0; ri < nr; ri++) {
			const b = ri * 4;
			if (G.box[b] > ux + ru || G.box[b + 2] < ux - ru || G.box[b + 1] > uy + ru || G.box[b + 3] < uy - ru) continue;
			for (let i = G.start[ri], end = G.start[ri + 1]; i < end; i++) {
				const ex = G.x[i] - ux, ey = G.y[i] - uy;
				if (ex * ex + ey * ey > ru2) continue;
				const qi = (G.q[i] + rq) % STEPS, c = COS[qi], s = SIN[qi];
				g.globalAlpha = Math.min(1, pa * (0.35 + 0.75 * G.a[i]));
				g.setTransform(c * dpr, s * dpr, -s * dpr, c * dpr, (lx + (ex * cr - ey * sr) * k) * dpr, (ly + (ex * sr + ey * cr) * k) * dpr);
				g.fillText(G.ch[i], 0, 0);
			}
		}
		g.setTransform(dpr, 0, 0, dpr, 0, 0);
		g.globalAlpha = 1;
	}

	const within = (it: Item, x: number, y: number) => {
		const p = it.rest;
		if (p.a < 0.12 || p.r < 1) return false;
		const dx = (x - p.x) / (p.r * HW), dy = (y - p.y) / p.r;
		return dx * dx + dy * dy < 1;
	};
	function under(x: number, y: number): Item | null {
		for (let i = drawn.length - 1; i >= 0; i--) if (within(drawn[i], x, y)) return drawn[i];
		return null;
	}

	/** the print a point is on, or failing that the nearest one within reach (the lens is never quite between prints) */
	function nearest(x: number, y: number, reach: number): Item | null {
		const on = under(x, y);
		if (on) return on;
		let best: Item | null = null, bd = reach;
		for (let i = 0; i < drawn.length; i++) {
			const p = drawn[i].rest;
			if (p.a < 0.12 || p.r < 1) continue;
			const n = Math.hypot((x - p.x) / (p.r * HW), (y - p.y) / p.r), d = (n - 1) * p.r * (n > 0 ? Math.hypot(x - p.x, y - p.y) / (n * p.r) : 1);
			if (d < bd) { bd = d; best = drawn[i]; }
		}
		return best;
	}

	// a sprite is kept (and scaled) while the stage is moving, and set again at its true size once it has been still
	function stale(it: Item) {
		if (it.full <= 0 || !(it.lines || fontReady)) return false;
		if (!it.sprite) return true;
		if (it.spriteEpoch < 0) return false;
		const ratio = (it.full * scaleOf(it, dprNow)) / (it.spriteR * it.spriteDpr);
		return stillNow ? Math.abs(ratio - 1) > 0.08 || (!it.lines && it.spriteEpoch !== fontEpoch) : ratio > 1.6 || ratio < 0.4;
	}
	function nextStale(l: Layout, all: boolean): Item | null {
		for (let i = 0; i < drawn.length; i++) if (stale(drawn[i])) return drawn[i];
		if (!all) return null;
		for (let i = 0; i < cast.length; i++) if (stale(cast[i])) return cast[i];
		for (let i = 0; i < l.crowd.length; i++) if (stale(crowd[i])) return crowd[i];
		return null;
	}

	// ── the background: ridges for the whole cast, then the sprites of prints not on stage, so that every division has
	// its threads and every print its sprite before the reader scrolls to it. This runs in idle moments (not in the
	// frame loop), so an idle hero redraws only when something on screen changes, and it never adds to a frame.
	let bgAsked = false, bgOff = false;
	function bgNext(l: Layout): Item | null {
		for (let i = 0; i < cast.length; i++) { const it = cast[i]; if (!onStage.has(it) && it !== job?.it && stale(it)) return it; }
		for (let i = 0; i < l.crowd.length; i++) { const it = crowd[i]; if (!onStage.has(it) && it !== job?.it && stale(it)) return it; }
		return null;
	}
	/** a few ms of background work; true while more remains */
	function bgWork(deadline: number): boolean {
		const l = L;
		if (!l || disposed || bgOff) return false;
		if (!traced) {
			traced = true;
			for (let i = 0; i < cast.length && traced; i++) if (!cast[i].ridges && cast[i].full > 0 && (!geometry(cast[i], deadline) || performance.now() > deadline)) traced = false;
			for (let i = 0; i < l.crowd.length && traced; i++) if (!crowd[i].ridges && crowd[i].full > 0 && (!geometry(crowd[i], deadline) || performance.now() > deadline)) traced = false;
			if (!traced) return true;
		}
		for (;;) {
			if (!bgJob) {
				const next = bgNext(l);
				if (!next) return false;
				if (!geometry(next, deadline)) return true;
				bgJob = begin(next, dprNow);
			}
			const j = bgJob, t0 = performance.now();
			if (!step(j, t0 + drawShare(deadline - t0))) {
				// rasterise what this slice drew now (a print off stage is not drawn to do it)
				settleCanvas(j.cv, performance.now() - t0);
				return true;
			}
			bgJob = null;
			if (performance.now() > deadline) return true;
		}
	}
	function askIdle() {
		if (bgAsked || disposed || bgOff) return;
		bgAsked = true;
		const w = window as unknown as { requestIdleCallback?: (cb: (d: { timeRemaining(): number }) => void, o?: { timeout: number }) => number };
		const run = (d?: { timeRemaining(): number }) => {
			bgAsked = false;
			const until = performance.now() + Math.min(8, d ? Math.max(2, d.timeRemaining() - 1) : 5);
			if (bgWork(until)) askIdle();
		};
		if (w.requestIdleCallback) w.requestIdleCallback(run, { timeout: 400 }); else setTimeout(run, 30);
	}

	function draw(ctx: CanvasRenderingContext2D, s: PrintInput) {
		if (disposed) return;
		const { view, stage, quiet } = s, dpr = view.dpr;
		dirty = false;
		if (!fontAsked) {
			// type is set once the page's face has loaded (or has had its chance), so it is not set twice
			fontAsked = true; firstT = s.t;
			const ready = () => { fontReady = true; widths = new Map(); fontEpoch++; dirty = true; };
			if (document.fonts?.load) document.fonts.load(`500 12px ${FONT}`).then(ready, ready); else ready();
		}
		const goal = Math.max(0, Math.min(3, s.reduce ? Math.round(s.level) : s.level));
		if (s.reduce || e < 0) e = goal;
		else {
			const dt = Math.min(0.05, Math.max(0, s.dt));
			// a level that slides (scroll) is followed closely, with about 120 ms of smoothing; one that leaps (a click,
			// a key) is paced over 1.2 to 1.8 s so every division on the way plays
			// (the lighter mode follows the scroll however fast it moves: a fling is not a leap)
			if (Math.abs(goal - lastGoal) > 0.2 && !s.follow) leap = { from: e, to: goal, t: 0, dur: Math.max(1.2, Math.min(1.8, 0.9 + 0.3 * Math.abs(goal - e))) };
			else if (leap) leap.to = goal;
			if (leap) {
				leap.t += dt;
				const u = Math.min(1, leap.t / leap.dur);
				e = lerp(leap.from, leap.to, 0.5 * u + 0.5 * u * u * (3 - 2 * u));
				if (u >= 1) leap = null;
			} else e = Math.abs(goal - e) < 0.0005 ? goal : e + (goal - e) * (1 - Math.exp(-dt / 0.12));
		}
		lastGoal = goal;
		const l = layout(stage);
		if (l !== poseL) movedT = s.t;
		if (l !== poseL || e !== poseE) {
			poseL = l; poseE = e;
			pose(l, stage);
			// who is on stage, back to front
			drawn.length = 0; onStage.clear();
			const p3 = clamp01(e - 2);
			if (main.rest.a > 0.004) drawn.push(main);
			if (p3 > 0.5) for (const it of labs) if (it.rest.a > 0.004) drawn.push(it);
			if (human.rest.a > 0.004) drawn.push(human);
			if (ai.rest.a > 0.004) drawn.push(ai);
			if (p3 <= 0.5) for (const it of labs) if (it.rest.a > 0.004) drawn.push(it);
			for (let i = 0; i < l.crowd.length; i++) if (crowd[i].rest.a > 0.004) drawn.push(crowd[i]);
			if (lit.rest.a > 0.004) drawn.push(lit);
			for (const it of drawn) onStage.add(it);
		}

		// set what is missing, a few ms a frame: what is on stage first, then the rest of the cast, so that every
		// division has its threads ready (when motion is reduced: what is on stage, at once)
		if (!fontReady && s.t - firstT > 1.2) fontReady = true;
		// wall-clock, so a slow machine does less per frame, not longer frames; the letters drawn get only their share of
		// it, since rasterising them (this frame) costs several times as much
		const t0 = performance.now(), deadline = t0 + 4.5, drawUntil = t0 + drawShare(4.5);
		stillNow = s.t - movedT > 0.2; dprNow = dpr;
		let pending = false;
		// (the rest of the cast, and every print's ridges, are set in idle moments: bgWork)
		bgOff = s.reduce;
		if (!s.reduce) askIdle();
		for (;;) {
			if (!job) {
				const next = nextStale(l, false);
				if (!next) break;
				// a print that came on stage while it was being set in the background goes on from where it was
				if (bgJob && bgJob.it === next) { job = bgJob; bgJob = null; }
				else {
					if (!geometry(next, s.reduce ? Infinity : deadline)) { pending = true; break; }
					job = begin(next, dpr);
				}
			}
			// with motion reduced there is no inking in: a print with nothing to show yet is set at once
			const first = job.it.sprite === job.cv, ts = performance.now();
			if (!step(job, s.reduce && first ? Infinity : drawUntil)) {
				pending = true;
				// a print being re-set stays off screen until it is whole: rasterise this slice now (one being inked in
				// is rasterised as it is stamped below)
				if (!first) settleCanvas(job.cv, performance.now() - ts);
				break;
			}
			job = null;
			if (performance.now() > drawUntil) { pending = true; break; }
		}

		// the lens: where it is and how strongly it magnifies. It follows the pointer (on touch, the last tap); with no
		// pointer, or with the pointer over the panel's copy, it rests on the most telling print of the level
		const ptr = s.pointer;
		let free = ptr !== null;
		if (ptr) for (let i = 0; i < quiet.length; i++) { const q = quiet[i]; if (ptr.x > q.x && ptr.x < q.x + q.w && ptr.y > q.y && ptr.y < q.y + q.h) free = false; }
		const lv = Math.round(e);
		const rest = lv <= 0 ? main : lv === 1 ? ai : lv === 2 ? labs[0] : lit;
		const want = (free || rest.rest.r > 4) && stage.w > 40 && stage.h > 40 ? 1 : 0;
		// (at level 2 it rests high on the print, so a card hung beside it stays above the row of names)
		const tx = free ? ptr!.x : rest.rest.x + rest.rest.r * HW * (lv === 2 ? 0.1 : 0.36), ty = free ? ptr!.y : rest.rest.y + rest.rest.r * (lv === 2 ? -0.42 : 0.34);
		let lensMoving = false;
		if (s.reduce || free || lensA < 0.02) { lensX = tx; lensY = ty; }
		else {
			// gliding to rest, or with the print it rests on as the level changes
			const k = 1 - Math.exp(-Math.min(0.05, s.dt) / 0.09);
			lensX += (tx - lensX) * k; lensY += (ty - lensY) * k;
			if (Math.abs(tx - lensX) + Math.abs(ty - lensY) < 0.3) { lensX = tx; lensY = ty; } else lensMoving = true;
		}
		lensA = s.reduce ? want : lensA + (want - lensA) * Math.min(1, s.dt * 10);
		if (Math.abs(want - lensA) < 0.004) lensA = want;
		// a smaller, quieter lens (Atrey, 16 Nov: "slightly smaller, less intrusive")
		const rad = Math.min(70, Math.max(44, Math.min(stage.w, stage.h) * 0.098)) * (0.9 + 0.1 * lensA);
		if (lensA !== want) lensMoving = true;
		if (lensA > 0.01) {
			// magnify the print under the glass; between prints, look at the edge of the nearest one within reach
			const top = nearest(lensX, lensY, rad * 0.6);
			lensTop = top;
			let ax = 0, ay = 0;
			if (top && !within(top, lensX, lensY)) {
				const p = top.rest, n = Math.hypot((lensX - p.x) / (p.r * HW), (lensY - p.y) / p.r) || 1;
				ax = (lensX - p.x) * (0.8 / n - 1); ay = (lensY - p.y) * (0.8 / n - 1);
			}
			if (s.reduce) { aimX = ax; aimY = ay; }
			else if (aimX !== ax || aimY !== ay) {
				const k = 1 - Math.exp(-Math.min(0.05, s.dt) / 0.05);
				aimX += (ax - aimX) * k; aimY += (ay - aimY) * k;
				if (Math.abs(ax - aimX) + Math.abs(ay - aimY) < 0.3) { aimX = ax; aimY = ay; } else lensMoving = true;
			}
			const target = top ? Math.min(6.5, Math.max(2.1, 11 / Math.max(0.5, typePx(top, top.rest.r)))) : lensMag;
			lensMag = s.reduce || Math.abs(target - lensMag) < 0.004 ? target : lensMag + (target - lensMag) * Math.min(1, s.dt * 9);
			if (lensMag !== target) lensMoving = true;
		}
		const px = ptr ? ptr.x : NaN, py = ptr ? ptr.y : NaN;
		if (px !== lastPX && !(px !== px && lastPX !== lastPX)) lensMoving = true;
		if (py !== lastPY && !(py !== py && lastPY !== lastPY)) lensMoving = true;
		lastPX = px; lastPY = py;
		lensR = rad;

		// inspection: ease the inspected print forward and the rest back, over about 200 ms
		const fid = s.focus ?? null;
		const next = fid ? (byId.get(fid) ?? null) : null;
		if (next !== focusItem) {
			focusItem = next;
			// the lit writer is two prints in one place: the crowd's own, and the one that grows
			focusTwin = next === lit && litIndex >= 0 ? crowd[litIndex] : litIndex >= 0 && next === crowd[litIndex] ? lit : null;
		}
		const fk = s.reduce ? 1 : 1 - Math.exp(-Math.min(0.05, s.dt) / 0.06);
		const dimTo = focusItem && focusItem.rest.a > 0.1 ? 1 : 0;
		let focusMoving = false;
		if (dim !== dimTo) { dim += (dimTo - dim) * fk; if (Math.abs(dimTo - dim) < 0.01) dim = dimTo; else focusMoving = true; }
		if (focusMoving || dim > 0 || anyFo) {
			anyFo = false;
			for (let i = 0; i < drawn.length; i++) {
				const it = drawn[i], to = it === focusItem || it === focusTwin ? 1 : 0;
				if (it.fo !== to) { it.fo += (to - it.fo) * fk; if (Math.abs(to - it.fo) < 0.01) it.fo = to; else focusMoving = true; }
				if (it.fo > 0) anyFo = true;
			}
		}

		const gain = clamp01(s.enter);
		breathing = !s.reduce && !s.calm && gain >= 0.003;
		breathTick = Math.floor(s.t * BREATH_HZ); bt = breathTick / BREATH_HZ;
		// nothing below changes state: the same inputs give the same frame, whenever the host asks for it
		active = e !== goal || leap !== null || pending || job !== null || !fontReady || !stillNow || lensMoving || focusMoving;
		lensShown = lensA > 0.01 && gain >= 0.003;
		if (gain < 0.003) return;
		ctx.save();
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.globalCompositeOperation = "source-over";
		for (let i = 0; i < drawn.length; i++) {
			const it = drawn[i], a = inkOf(it) * gain;
			if (a < 0.004 || !it.sprite) continue;
			if (quiet.length && touches(it, quiet)) stampFaded(ctx, it, quiet, dpr, a);
			else stamp(ctx, it, dpr, 0, 0, a);
		}
		ctx.globalAlpha = 1;
		const weaving = !s.reduce && e > 0 && e < 3 && e !== Math.round(e);
		if (weaving) {
			if (quiet.length) {
				// threads stay out of the quiet boxes
				ctx.save();
				ctx.beginPath(); ctx.rect(0, 0, view.w, view.h);
				for (let i = 0; i < quiet.length; i++) { const q = quiet[i]; ctx.rect(q.x, q.y, q.w, q.h); }
				ctx.clip("evenodd");
				weaveAll(ctx, l, gain);
				ctx.restore();
			} else weaveAll(ctx, l, gain);
		}

		if (lensA > 0.01) {
			const la = lensA * gain;
			ctx.save();
			ctx.globalAlpha = la;
			ctx.beginPath(); ctx.arc(lensX, lensY, rad, 0, TAU);
			ctx.fillStyle = "#F4F4F0"; ctx.fill();
			ctx.clip();
			for (let i = 0; i < drawn.length; i++) decipher(ctx, drawn[i], lensX + aimX, lensY + aimY, lensMag, rad, dpr, gain, lensX, lensY);
			if (weaving) {
				ctx.setTransform(dpr * lensMag, 0, 0, dpr * lensMag, dpr * (lensX - (lensX + aimX) * lensMag), dpr * (lensY - (lensY + aimY) * lensMag));
				weaveAll(ctx, l, gain);
				ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			}
			ctx.restore();
			// the glass: a fine rim, a hairline inside it, four ticks
			ctx.globalAlpha = la; ctx.strokeStyle = C.ink; ctx.setLineDash(SOLID); ctx.lineCap = "butt";
			ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(lensX, lensY, rad, 0, TAU); ctx.stroke();
			ctx.lineWidth = 0.5; ctx.globalAlpha = la * 0.45; ctx.beginPath(); ctx.arc(lensX, lensY, rad - 4, 0, TAU); ctx.stroke();
			ctx.globalAlpha = la * 0.8; ctx.lineWidth = 1; ctx.beginPath();
			for (let i = 0; i < 4; i++) { const a = (i * TAU) / 4, c = Math.cos(a), sn = Math.sin(a); ctx.moveTo(lensX + c * (rad - 4), lensY + sn * (rad - 4)); ctx.lineTo(lensX + c * (rad + 5), lensY + sn * (rad + 5)); }
			ctx.stroke();
		}
		ctx.restore();
	}

	/** true while anything is still moving or being set, or a breath is due; when false, a redraw would give the frame
	 * already on the canvas */
	function busy() { return active || dirty || (breathing && Math.floor((performance.now() / 1000) * BREATH_HZ) !== breathTick); }

	function anchors(): Anchor[] {
		const out: Anchor[] = [];
		const add = (id: string, it: Item, a = it.rest.a) => out.push({ id, x: it.rest.x, y: it.rest.y, r: it.rest.r, alpha: clamp01(a) });
		add("human", human, human.rest.a / 0.55);
		add("ai", ai);
		const gone = 1 - ss(0, 0.4, e - 2); // at level 3 the labs stay as a faint row, without names
		for (const it of labs) add(it.id, it, it.rest.a * gone);
		add("lit", lit);
		return out;
	}

	const LIT_HIT = { id: "lit" };
	function hit(x: number, y: number): Hit {
		const it = nearest(x, y, lensR * 0.6);
		if (!it) return null;
		if (litIndex >= 0 && it === crowd[litIndex]) return LIT_HIT;
		return it.hit;
	}

	function dispose() {
		disposed = true;
		for (const it of [...cast, ...crowd]) { (it.sprite as any)?.close?.(); it.sprite = null; it.ridges = null; it.glyphs = null; }
		tile = null; tg = null; job = null; bgJob = null; splits.length = 0;
	}

	/** where the lens is this frame, for the host's card; null when it is not shown */
	function lens() { return lensShown ? { x: lensX, y: lensY, r: lensR } : null; }

	/** The words the lens is on: the nearest ridge's text around the point it looks at, as whole words (up to 12). */
	function lensText(): string | null {
		const it = lensTop;
		if (!lensShown || !it || !it.ridges || it.rest.r < 1) return null;
		const p = it.rest, cr = Math.cos(p.rot), sr = Math.sin(p.rot);
		const dx = (lensX + aimX - p.x) / p.r, dy = (lensY + aimY - p.y) / p.r;
		const ux = dx * cr + dy * sr, uy = -dx * sr + dy * cr;
		const G = glyphsOf(it);
		let best = -1, bd = 1e9, ridgeOf = 0;
		for (let ri = 0, nr = it.ridges.length; ri < nr; ri++) {
			const b = ri * 4, ox = Math.max(G.box[b] - ux, 0, ux - G.box[b + 2]), oy = Math.max(G.box[b + 1] - uy, 0, uy - G.box[b + 3]);
			if (ox * ox + oy * oy >= bd) continue;
			for (let i = G.start[ri], end = G.start[ri + 1]; i < end; i++) {
				const ex = G.x[i] - ux, ey = G.y[i] - uy, d = ex * ex + ey * ey;
				if (d < bd) { bd = d; best = i; ridgeOf = ri; }
			}
		}
		if (best < 0) return null;
		const key = it.id + "|" + fontEpoch + "|" + best;
		if (key === readKey) return readText;
		readKey = key;
		// the ridge's stretch of text, cut back to whole words, and a window of them around the letter under the glass
		const T = it.text, n = T.length, a = G.ti[G.start[ridgeOf]], b = G.ti[G.start[ridgeOf + 1] - 1];
		const at = (i: number) => T[((i % n) + n) % n];
		let from = a, to = b;
		if (at(a - 1) !== " ") { while (from <= b && at(from) !== " ") from++; }
		if (at(b + 1) !== " ") { while (to >= from && at(to) !== " ") to--; }
		const words: string[] = [];
		let cur = "", mine = 0;
		for (let i = from; i <= to + 1; i++) {
			const ch = i <= to ? at(i) : " ";
			if (ch === " ") { if (cur) { words.push(cur); cur = ""; } } else { cur += ch; if (i <= G.ti[best]) mine = words.length; }
		}
		if (words.length < 3) return (readText = null);
		const take = Math.min(12, words.length), first = Math.max(0, Math.min(words.length - take, mine - (take >> 1)));
		return (readText = words.slice(first, first + take).join(" "));
	}

	return { draw, anchors, hit, dispose, busy, lens, lensText };
};
