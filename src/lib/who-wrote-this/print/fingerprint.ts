// The hero's fingerprint, drawn in code. Every print is a set of evenly spaced streamlines through an orientation
// field with singular points (cores and deltas), the way real ridge flow is modelled; ridge endings and forks fall
// out of the spacing test. The ridges are then set as lines of the paper's own text. One eased scalar (0..3) drives
// everything: the single print unravels into threads that re-knit as a human and an AI print, the AI print into one
// print per lab, the human print into a crowd of writers with one lit. A lens redraws whatever is under the pointer
// as vectors, large enough to read.
import type { Anchor, Box, CreatePrint, Hit, Print, PrintInput, PrintOptions } from "./contract";

const FONT = '"Inter", system-ui, -apple-system, "Segoe UI", sans-serif';
const HW = 0.8; // a print's half-width when its half-height is 1
const TAU = Math.PI * 2;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const ss = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const ease = (t: number) => { t = clamp01(t); return t * t * t * (t * (t * 6 - 15) + 10); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const hexRgb = (h: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
const mixRgb = (p: number[], q: number[], t: number) => `rgb(${Math.round(lerp(p[0], q[0], t))},${Math.round(lerp(p[1], q[1], t))},${Math.round(lerp(p[2], q[2], t))})`;

function rng(seed: number) {
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
type Spec = {
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

function fieldOf(s: Spec) {
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

/** Evenly spaced streamlines (Jobard and Lefer): a ridge stops where it would crowd another, which is where real ridges end. */
function traceRidges(s: Spec, ds: number): Float32Array[] {
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
	const trySeed = (x: number, y: number) => {
		if (!inside(x, y) || !free(x, y, ds * 0.98, -1, 0)) return;
		const r = grow(x, y);
		if (r) { ridges.push(r); queue.push(r); }
	};
	const drain = () => {
		while (queue.length) {
			const r = queue.shift()!;
			for (let i = 2; i < r.length - 2; i += 4) {
				const tx = r[i + 2] - r[i - 2], ty = r[i + 3] - r[i - 1], l = Math.hypot(tx, ty) || 1;
				const nx = (-ty / l) * ds, ny = (tx / l) * ds;
				trySeed(r[i] + nx, r[i + 1] + ny);
				trySeed(r[i] - nx, r[i + 1] - ny);
			}
		}
	};
	trySeed(0.02, 0.62);
	drain();
	for (let y = -1; y <= 1; y += ds * 0.7) for (let x = -HW; x <= HW; x += ds * 0.7) { trySeed(x, y); drain(); }
	return ridges;
}

// ───────────────────────────────────────────────────────────── type on the ridges

type Glyphs = {
	n: number;
	x: Float32Array; y: Float32Array; c: Float32Array; s: Float32Array; a: Float32Array; q: Uint8Array;
	ch: string[];
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

// Glyph angles snap to 3° steps: a rasteriser caches each letter per angle, so this is what makes setting type fast.
const STEPS = 120;
const COS = new Float32Array(STEPS), SIN = new Float32Array(STEPS);
for (let i = 0; i < STEPS; i++) { COS[i] = Math.cos((i / STEPS) * TAU); SIN[i] = Math.sin((i / STEPS) * TAU); }
const TYPE = 0.76; // type size as a share of the ridge gap

function setType(ridges: Float32Array[], ds: number, text: string, offset: number, ink: (x: number, y: number) => number): Glyphs {
	const f = ds * TYPE;
	const X: number[] = [], Y: number[] = [], C: number[] = [], S: number[] = [], A: number[] = [], Q: number[] = [], CH: string[] = [];
	const start = new Int32Array(ridges.length + 1), box = new Float32Array(ridges.length * 4);
	let ti = offset % text.length;
	ridges.forEach((r, ri) => {
		start[ri] = X.length;
		let minx = 9, miny = 9, maxx = -9, maxy = -9;
		for (let i = 0; i < r.length; i += 2) { if (r[i] < minx) minx = r[i]; if (r[i] > maxx) maxx = r[i]; if (r[i + 1] < miny) miny = r[i + 1]; if (r[i + 1] > maxy) maxy = r[i + 1]; }
		box.set([minx, miny, maxx, maxy], ri * 4);
		// begin each ridge on a word
		for (let g = 0; g < 40 && text[ti] !== " "; g++) ti = (ti + 1) % text.length;
		while (text[ti] === " ") ti = (ti + 1) % text.length;
		const n = r.length / 2;
		let seg = 0, segStart = 0, segLen = Math.hypot(r[2] - r[0], r[3] - r[1]), at = f * 0.3;
		for (;;) {
			const ch = text[ti];
			const adv = (widthOf(ch) + 0.045) * f, mid = at + adv / 2;
			while (seg < n - 2 && mid > segStart + segLen) { segStart += segLen; seg++; segLen = Math.hypot(r[seg * 2 + 2] - r[seg * 2], r[seg * 2 + 3] - r[seg * 2 + 1]); }
			if (mid + adv / 2 > segStart + segLen && seg >= n - 2) break;
			if (ch !== " ") {
				const u = (mid - segStart) / (segLen || 1);
				const x0 = r[seg * 2], y0 = r[seg * 2 + 1], dx = r[seg * 2 + 2] - x0, dy = r[seg * 2 + 3] - y0, l = Math.hypot(dx, dy) || 1;
				const x = x0 + dx * u, y = y0 + dy * u;
				const q = ((Math.round((Math.atan2(dy, dx) / TAU) * STEPS) % STEPS) + STEPS) % STEPS;
				X.push(x); Y.push(y); C.push(COS[q]); S.push(SIN[q]); Q.push(q); A.push(ink(x, y)); CH.push(ch);
			}
			at += adv;
			ti = (ti + 1) % text.length;
		}
	});
	start[ridges.length] = X.length;
	return { n: X.length, x: Float32Array.from(X), y: Float32Array.from(Y), c: Float32Array.from(C), s: Float32Array.from(S), a: Float32Array.from(A), q: Uint8Array.from(Q), ch: CH, start, box };
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
	field: ReturnType<typeof fieldOf> | null;
	glyphs: Glyphs | null;
	glyphEpoch: number;
	lines: boolean; // always drawn as ink lines, never type (the crowd)
	sprite: (CanvasImageSource & { width: number; height: number }) | null;
	spriteR: number; spriteDpr: number; spriteEpoch: number; // the size, scale and face the sprite was set at (spriteEpoch -1: still being set)
	full: number; // the size it is drawn at when it is the subject
	edge: number; // 0..1: fades a print that has been pushed off the stage
	pose: Pose; // as drawn (with breathing)
	rest: Pose; // without
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

type Layout = {
	key: string; wide: boolean;
	main: number[]; // x, y, r
	human1: number[]; ai1: number[]; human2: number[];
	lab2: number[][]; lab3: number[][];
	crowd: number[][]; // x, y, r, rot
	lit: number; litR: number;
};

// ───────────────────────────────────────────────────────────── renderer

export const createPrint: CreatePrint = (opts: PrintOptions): Print => {
	const seed = opts.seed ?? 20261116;
	const body = opts.text.join("   ") + "   ";
	const litBody = opts.litText + "   ";
	const C = opts.colors;
	const inkRgb = hexRgb(C.ink), humanRgb = hexRgb(C.human), aiRgb = hexRgb(C.ai), litRgb = hexRgb(C.lit);
	const R0 = rng(seed);

	const make = (id: string, sp: Spec, gap: number, color: string, text = body): Item => ({
		id, spec: sp, gap, color, rgb: hexRgb(color), text, offset: Math.floor(R0() * text.length), phase: R0() * TAU,
		lines: false, edge: 1, ds: 0, ridges: null, field: null, glyphs: null, glyphEpoch: -1, sprite: null, spriteR: 0, spriteDpr: 1, spriteEpoch: -1, full: 0,
		pose: { x: 0, y: 0, r: 0, rot: 0, a: 0 }, rest: { x: 0, y: 0, r: 0, rot: 0, a: 0 },
	});

	const main = make("main", spec(seed + 1, { cores: [-0.05, -0.2, 0.06, 0.08], deltas: [-0.58, 0.52, 0.52, 0.62], twist: 0.22, wob: 0.09 }), 7.4, C.ink);
	const human = make("human", spec(seed + 2, { cores: [-0.05, -0.18], deltas: [0.47, 0.46], wob: 0.13, tilt: 0.06 }), 6.6, C.human);
	const ai = make("ai", spec(seed + 3, { cores: [0, -0.08, 0, -0.02], deltas: [-0.58, 0.62, 0.58, 0.62], wob: 0, sq: 2.6 }), 6.6, C.ai);
	const labs = opts.labs.map((name, i) => make(`lab:${name}`, spec(seed + 10 + i, { ...LAB_SPECS[i % LAB_SPECS.length], sq: 2.1 + ((i * 7) % 5) * 0.14 }), i < 3 ? 5.2 : 4.6, C.labs[i] ?? C.other));
	const MAX_CROWD = 220;
	const crowd: Item[] = [];
	for (let i = 0; i < MAX_CROWD; i++) { const it = make(`writer:${i}`, writerSpec(seed + 100 + i), 3.7, C.human); it.lines = true; crowd.push(it); }
	const lit = make("lit", spec(seed + 99, { cores: [0.03, -0.14], deltas: [-0.45, 0.42], wob: 0.11, tilt: -0.08 }), 5.8, C.lit, litBody);
	lit.offset = 0;
	let litIndex = -1;

	let e = -1; // eased level
	let fontEpoch = 0, fontAsked = false, fontReady = false, firstT = 0;
	let scratch: HTMLCanvasElement | null = null, sg: CanvasRenderingContext2D | null = null;
	let mask: HTMLCanvasElement | null = null, maskKey = "";
	let L: Layout | null = null;
	let lensMag = 3, lensA = 0, lensX = 0, lensY = 0;
	let drawn: Item[] = [];
	let lastView = { w: 0, h: 0, dpr: 1 };
	let disposed = false;
	let lastGoal = 0, leap: { from: number; to: number; t: number; dur: number } | null = null;
	let movedT = -1; // when the stage last changed

	// ── geometry and sprites, built on demand

	function geometry(it: Item) {
		// the ridge gap is fixed in px, so smaller prints have fewer, bolder ridges; quantised so a resize rarely retraces
		const want = it.gap / Math.max(8, it.full);
		const q = Math.pow(1.18, Math.round(Math.log(want) / Math.log(1.18)));
		if (it.ridges && it.ds === q) return;
		it.ds = q;
		it.field = fieldOf(it.spec);
		it.ridges = traceRidges(it.spec, q);
		it.glyphs = null; splits.length = 0; // the old sprite stays up until the new one is whole
	}
	function glyphsOf(it: Item): Glyphs {
		if (!it.glyphs || it.glyphEpoch !== fontEpoch) { it.glyphs = setType(it.ridges!, it.ds, it.text, it.offset, it.field!.ink); it.glyphEpoch = fontEpoch; }
		return it.glyphs;
	}
	const typePx = (it: Item, r: number) => it.ds * TYPE * r;

	// Sprites are set a few ms at a time, so a large print inks in over several frames instead of stalling one.
	type Job = { it: Item; cv: HTMLCanvasElement; g: CanvasRenderingContext2D; epoch: number; dpr: number; r: number; ox: number; oy: number; k: number; i: number; G: Glyphs | null };
	let job: Job | null = null;

	function begin(it: Item, dpr: number): Job {
		geometry(it);
		const r = it.full;
		const pad = 3, w = Math.ceil((2 * HW * r + pad * 2) * dpr), h = Math.ceil((2 * r + pad * 2) * dpr);
		const cv = document.createElement("canvas");
		cv.width = w; cv.height = h;
		const g = cv.getContext("2d")!;
		const ox = (HW * r + pad) * dpr, oy = (r + pad) * dpr, k = r * dpr;
		const fpx = typePx(it, r);
		let G: Glyphs | null = null;
		g.fillStyle = g.strokeStyle = it.color;
		if (fpx >= 2.7 && !it.lines) {
			// a hairline under the type keeps each ridge whole
			g.lineWidth = Math.max(0.5, fpx * 0.07) * dpr; g.globalAlpha = 0.16; g.lineJoin = "round";
			g.beginPath();
			for (const rd of it.ridges!) { g.moveTo(ox + rd[0] * k, oy + rd[1] * k); for (let i = 2; i < rd.length; i += 2) g.lineTo(ox + rd[i] * k, oy + rd[i + 1] * k); }
			g.stroke();
			G = glyphsOf(it);
			g.font = `500 ${fpx * dpr}px ${FONT}`; g.textAlign = "center"; g.textBaseline = "middle";
		} else {
			// too small for type: the ridges as ink lines, pressed unevenly
			g.lineCap = "round"; g.lineJoin = "round";
			const lw = it.ds * k * 0.4;
			for (const rd of it.ridges!) {
				const mid = (rd.length >> 2) << 1;
				g.globalAlpha = 0.55 + 0.4 * it.field!.ink(rd[mid], rd[mid + 1]);
				g.lineWidth = lw * (0.8 + 0.4 * it.field!.ink(rd[0], rd[1]));
				g.beginPath(); g.moveTo(ox + rd[0] * k, oy + rd[1] * k);
				for (let i = 2; i < rd.length; i += 2) g.lineTo(ox + rd[i] * k, oy + rd[i + 1] * k);
				g.stroke();
			}
		}
		// a print with nothing to show yet shows its sprite as it is set; one being re-set keeps the old until the new is whole
		if (!it.sprite) { it.sprite = cv; it.spriteR = r; it.spriteDpr = dpr; it.spriteEpoch = -1; }
		return { it, cv, g, epoch: fontEpoch, dpr, r, ox, oy, k, i: 0, G };
	}

	/** set more of the job's type; true when the sprite is finished */
	function step(j: Job, deadline: number): boolean {
		const { g, G, ox, oy, k } = j;
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
		const key = `${S.x | 0},${S.y | 0},${S.w | 0},${S.h | 0}`;
		if (L && L.key === key) return L;
		const wide = S.w > S.h * 0.9;
		if (L && (L.wide !== wide)) splits.length = 0;
		const cx = S.x + S.w / 2, cy = S.y + S.h / 2;
		const r0 = Math.min(S.h * 0.455, S.w * 0.55);
		const r1 = Math.min(S.h * 0.33, S.w * 0.275);
		const human2 = wide ? [S.x + S.w * 0.095, cy, Math.min(S.h, S.w) * 0.115] : [S.x + S.w * 0.12, S.y + S.h * 0.925, S.h * 0.065];
		const G = wide ? { x: S.x + S.w * 0.21, y: S.y + S.h * 0.045, w: S.w * 0.77, h: S.h * 0.9 } : { x: S.x + S.w * 0.02, y: S.y, w: S.w * 0.96, h: S.h * 0.84 };
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
		L = { key, wide, main: [cx, cy, r0], human1: [cx - S.w * 0.25, cy, r1], ai1: [cx + S.w * 0.25, cy, r1], human2, lab2, lab3, crowd: pts, lit: best, litR };
		// full sizes decide ridge counts and sprite sizes
		main.full = r0; human.full = r1; ai.full = r1;
		labs.forEach((it, i) => (it.full = lab2[i][2]));
		crowd.forEach((it, i) => (it.full = pts[i] ? pts[i][2] : 0));
		lit.full = litR;
		litIndex = best;
		return L;
	}

	const set = (it: Item, x: number, y: number, r: number, rot: number, a: number) => { const p = it.rest; p.x = x; p.y = y; p.r = r; p.rot = rot; p.a = a; };
	const mix3 = (a: number[], b: number[], t: number) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

	function pose(S: Box) {
		const l = layout(S);
		const p1 = clamp01(e), p2 = clamp01(e - 1), p3 = clamp01(e - 2);
		const q1 = ease(p1), q2 = ease(p2);
		// each division is drawn as threads (see Split); the cached prints only hold the two ends of it
		const IN = (p: number) => ss(0.86, 1, p), OUT = (p: number) => 1 - ss(0, 0.12, p);
		set(main, l.main[0], l.main[1], l.main[2], 0, OUT(p1));
		const hp = mix3(l.human1, l.human2, q2);
		set(human, hp[0], hp[1], hp[2], 0, IN(p1) * lerp(1, 0.55, q2) * OUT(p3));
		set(ai, l.ai1[0], l.ai1[1], l.ai1[2], 0, IN(p1) * OUT(p2));
		// 2 → 3: the labs draw up into a row and step back
		labs.forEach((it, i) => {
			const t3 = ease(clamp01(p3 * 1.25 - i * 0.02));
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
		}
	}

	// ── divisions: the parent's ridges, cut into threads, travel and re-form as the children's ridges

	type Split = {
		parent: Item; kids: Item[];
		first: Int32Array; // per child: its first thread
		off: Int32Array; // per thread: its first point
		src: Float32Array; dst: Float32Array; // the thread on the parent, and as the child's ridge (unit space of each)
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
				for (let q = 0; q < N; q++) {
					const u = run.i0 + (q / (N - 1)) * (run.i1 - run.i0), i = Math.min(run.i1 - 1, Math.floor(u)), f = u - i;
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
		return { parent, kids, first, off: Int32Array.from(off), src: Float32Array.from(src), dst: Float32Array.from(dst), cx, cy, cs, kd, td: Float32Array.from(td) };
	}

	const BINS = 5;
	/** One division at progress p. The parent comes apart into its pieces, each piece travels to its child's place,
	 * and there its threads re-form, top to bottom, into the child's own ridges. */
	function weave(g: CanvasRenderingContext2D, sp: Split, p: number, aFrom: number, dashed: boolean) {
		const env = ss(0, 0.1, p) * (1 - ss(0.9, 1, p));
		if (env < 0.01) return;
		const P = sp.parent.rest, wp = sp.parent.ds * P.r * 0.27;
		g.lineCap = "butt"; g.lineJoin = "round";
		for (let ki = 0; ki < sp.kids.length; ki++) {
			const kid = sp.kids[ki], K = kid.rest, edge = kid.edge;
			if (K.r < 0.5 || edge < 0.01) continue;
			const c = Math.cos(K.rot) * K.r, sn = Math.sin(K.rot) * K.r;
			const d = sp.kd[ki] * 0.16;
			const m = ease((p - 0.02 - d) / 0.38); // the piece travels
			// the piece at rest in the parent, and carried to the child (grown or shrunk to the child's size)
			const k0 = lerp(P.r, K.r * sp.cs[ki], m), ox = lerp(P.x, K.x - sp.cx[ki] * k0, m), oy = lerp(P.y, K.y - sp.cy[ki] * k0, m);
			const wk = kid.ds * K.r * (kid.lines ? 0.4 : 0.27), aTo = kid.lines ? 0.85 : 0.8;
			const hue = mixRgb(sp.parent.rgb, kid.rgb, ss(0.1, 0.8, m));
			for (let b = 0; b < BINS; b++) {
				let any = false;
				for (let th = sp.first[ki], end = sp.first[ki + 1]; th < end; th++) {
					const f = ease((p - 0.3 - d - sp.td[th] * 0.3) / 0.14); // the thread re-forms, one after another down the print
					if (Math.min(BINS - 1, Math.floor(f * BINS)) !== b) continue;
					if (!any) { any = true; g.beginPath(); }
					const u = 1 - f;
					for (let i = sp.off[th], e2 = sp.off[th + 1], i0 = i; i < e2; i++) {
						const sx = sp.src[i * 2], sy = sp.src[i * 2 + 1], dx = sp.dst[i * 2], dy = sp.dst[i * 2 + 1];
						const x = u * (ox + sx * k0) + f * (K.x + dx * c - dy * sn);
						const y = u * (oy + sy * k0) + f * (K.y + dx * sn + dy * c);
						if (i === i0) g.moveTo(x, y); else g.lineTo(x, y);
					}
				}
				if (!any) continue;
				const tb = b / (BINS - 1), mix = (m + tb) / 2;
				const lw = Math.max(0.4, lerp(lerp(wp, wk, m * 0.5), wk, tb));
				g.strokeStyle = hue;
				g.lineWidth = lw;
				if (dashed) g.setLineDash([lw * 9, lw * 1.6, lw * 4, lw * 1.6, lw * 13, lw * 2.2]);
				g.globalAlpha = env * lerp(aFrom, aTo * edge, mix);
				g.stroke();
			}
		}
		if (dashed) g.setLineDash([]);
		g.globalAlpha = 1;
	}

	function weaveAll(g: CanvasRenderingContext2D, l: Layout) {
		const p1 = clamp01(e), p2 = clamp01(e - 1), p3 = clamp01(e - 2);
		const live = l.crowd.length;
		if (splits[2] && splits[2].kids.length !== live) splits[2] = null;
		if (p1 > 0 && p1 < 1) { splits[0] ??= buildSplit(main, [human, ai], l.main, [l.human1, l.ai1]); if (splits[0]) weave(g, splits[0], p1, 0.8, true); }
		if (p2 > 0 && p2 < 1) { splits[1] ??= buildSplit(ai, labs, l.ai1, l.lab2); if (splits[1]) weave(g, splits[1], p2, 0.8, true); }
		if (p3 > 0 && p3 < 1) { splits[2] ??= buildSplit(human, crowd.slice(0, live), l.human2, l.crowd); if (splits[2]) weave(g, splits[2], p3, 0.5, false); }
	}

	// ── drawing

	function stamp(g: CanvasRenderingContext2D, it: Item, dpr: number) {
		const p = it.pose;
		if (p.a < 0.004 || !it.sprite) return;
		const k = p.r / it.spriteR, w = it.sprite.width / it.spriteDpr, h = it.sprite.height / it.spriteDpr;
		g.globalAlpha = p.a;
		if (p.rot) {
			const c = Math.cos(p.rot) * k * dpr, s = Math.sin(p.rot) * k * dpr;
			g.setTransform(c, s, -s, c, p.x * dpr, p.y * dpr);
			g.drawImage(it.sprite, -w / 2, -h / 2, w, h);
			g.setTransform(dpr, 0, 0, dpr, 0, 0);
		} else g.drawImage(it.sprite, p.x - (w * k) / 2, p.y - (h * k) / 2, w * k, h * k);
	}

	/** One print's ridges as live type, magnified about (px, py): only the glyphs under the glass. */
	function decipher(g: CanvasRenderingContext2D, it: Item, px: number, py: number, mag: number, rad: number, dpr: number) {
		const p = it.pose;
		if (p.a < 0.02 || !it.ridges) return;
		const cr = Math.cos(p.rot), sr = Math.sin(p.rot);
		const dx = (px - p.x) / p.r, dy = (py - p.y) / p.r;
		const ux = dx * cr + dy * sr, uy = -dx * sr + dy * cr;
		const f = it.ds * TYPE, ru = rad / mag / p.r + f;
		if (Math.abs(ux) > HW + ru || Math.abs(uy) > 1 + ru) return;
		const G = glyphsOf(it), ru2 = ru * ru, k = p.r * mag;
		g.fillStyle = it.color;
		// whole half-pixel sizes and snapped angles, so the glass reuses cached letters while prints breathe
		g.font = `500 ${Math.round(f * it.rest.r * mag * dpr * 2) / (2 * dpr)}px ${FONT}`; g.textAlign = "center"; g.textBaseline = "middle";
		const rq = Math.round((p.rot / TAU) * STEPS) + STEPS * 4;
		const nr = it.ridges.length;
		for (let ri = 0; ri < nr; ri++) {
			const b = ri * 4;
			if (G.box[b] > ux + ru || G.box[b + 2] < ux - ru || G.box[b + 1] > uy + ru || G.box[b + 3] < uy - ru) continue;
			for (let i = G.start[ri], end = G.start[ri + 1]; i < end; i++) {
				const ex = G.x[i] - ux, ey = G.y[i] - uy;
				if (ex * ex + ey * ey > ru2) continue;
				const qi = (G.q[i] + rq) % STEPS, c = COS[qi], s = SIN[qi];
				g.globalAlpha = Math.min(1, p.a * (0.35 + 0.75 * G.a[i]));
				g.setTransform(c * dpr, s * dpr, -s * dpr, c * dpr, (px + (ex * cr - ey * sr) * k) * dpr, (py + (ex * sr + ey * cr) * k) * dpr);
				g.fillText(G.ch[i], 0, 0);
			}
		}
		g.setTransform(dpr, 0, 0, dpr, 0, 0);
		g.globalAlpha = 1;
	}

	const within = (it: Item, x: number, y: number, slack = 1) => {
		const p = it.rest;
		if (p.a < 0.12 || p.r < 1) return false;
		const dx = (x - p.x) / (p.r * HW * slack), dy = (y - p.y) / (p.r * slack);
		return dx * dx + dy * dy < 1;
	};
	function under(x: number, y: number): Item | null {
		for (let i = drawn.length - 1; i >= 0; i--) if (within(drawn[i], x, y)) return drawn[i];
		return null;
	}

	function quietMask(view: PrintInput["view"], quiet: Box[]) {
		const key = `${view.w}x${view.h}|` + quiet.map((q) => `${q.x | 0},${q.y | 0},${q.w | 0},${q.h | 0}`).join(";");
		if (mask && maskKey === key) return mask;
		maskKey = key;
		mask ??= document.createElement("canvas");
		const sc = 0.25, feather = 44;
		mask.width = Math.ceil(view.w * sc); mask.height = Math.ceil(view.h * sc);
		const m = mask.getContext("2d")!;
		m.setTransform(sc, 0, 0, sc, 0, 0);
		// feathered by stacking insets: soft on every side, no filters
		for (const q of quiet) for (let i = 0; i < 12; i++) {
			const o = feather * (1 - i / 11);
			m.fillStyle = `rgba(0,0,0,${0.2})`;
			m.fillRect(q.x - o, q.y - o, q.w + o * 2, q.h + o * 2);
		}
		return mask;
	}

	function draw(ctx: CanvasRenderingContext2D, s: PrintInput) {
		if (disposed) return;
		const { view, stage } = s, dpr = view.dpr;
		lastView = view;
		if (!fontAsked) {
			// type is set once the page's face has loaded (or has had its chance), so it is not set twice
			fontAsked = true; firstT = s.t;
			const ready = () => { fontReady = true; widths = new Map(); fontEpoch++; };
			if (document.fonts?.load) document.fonts.load(`500 12px ${FONT}`).then(ready, ready); else ready();
		}
		const goal = Math.max(0, Math.min(3, s.level));
		if (s.reduce) e = Math.round(goal);
		else if (e < 0) e = goal;
		else {
			const dt = Math.min(0.05, Math.max(0, s.dt));
			// a level that slides (scroll) is followed closely, with about 120 ms of smoothing; one that leaps (a click,
			// a key) is paced over 1.2 to 1.8 s so every division on the way plays
			if (Math.abs(goal - lastGoal) > 0.2) leap = { from: e, to: goal, t: 0, dur: Math.max(1.2, Math.min(1.8, 0.9 + 0.3 * Math.abs(goal - e))) };
			else if (leap) leap.to = goal;
			if (leap) {
				leap.t += dt;
				const u = Math.min(1, leap.t / leap.dur);
				e = lerp(leap.from, leap.to, 0.5 * u + 0.5 * u * u * (3 - 2 * u));
				if (u >= 1) leap = null;
			} else e = Math.abs(goal - e) < 0.0005 ? goal : e + (goal - e) * (1 - Math.exp(-dt / 0.12));
		}
		lastGoal = goal;
		const before = L?.key;
		pose(stage);
		const l = L!;
		if (l.key !== before) movedT = s.t;

		// who is on stage, back to front
		drawn = [];
		const p3 = clamp01(e - 2);
		if (main.rest.a > 0.004) drawn.push(main);
		if (p3 > 0.5) for (const it of labs) if (it.rest.a > 0.004) drawn.push(it);
		if (human.rest.a > 0.004) drawn.push(human);
		if (ai.rest.a > 0.004) drawn.push(ai);
		if (p3 <= 0.5) for (const it of labs) if (it.rest.a > 0.004) drawn.push(it);
		for (let i = 0; i < l.crowd.length; i++) if (crowd[i].rest.a > 0.004) drawn.push(crowd[i]);
		if (lit.rest.a > 0.004) drawn.push(lit);

		// set what is missing, a few ms a frame: what is on stage first, then the rest of the cast, so that every
		// division has its threads ready (when motion is reduced: what is on stage, at once)
		if (!fontReady && s.t - firstT > 1.2) fontReady = true;
		const soon = performance.now() + 2.5, deadline = soon + 5;
		// a sprite is kept (and scaled) while the stage is moving, and set again at its true size once it has been still
		const still = s.t - movedT > 0.2;
		const stale = (it: Item) => {
			if (it.full <= 0 || !(it.lines || fontReady)) return false;
			if (!it.sprite) return true;
			if (it.spriteEpoch < 0) return false;
			const ratio = (it.full * dpr) / (it.spriteR * it.spriteDpr);
			return still ? Math.abs(ratio - 1) > 0.04 || (!it.lines && it.spriteEpoch !== fontEpoch) : ratio > 1.6 || ratio < 0.4;
		};
		const cast = [main, human, ai, lit, ...labs];
		if (!s.reduce) {
			// ridges first, for the whole cast: the divisions need them, and they are quick to trace
			for (const it of cast) if (!it.ridges && it.full > 0) { geometry(it); if (performance.now() > soon) break; }
			for (let i = 0; i < l.crowd.length && performance.now() <= soon; i++) if (!crowd[i].ridges && crowd[i].full > 0) geometry(crowd[i]);
		}
		for (;;) {
			if (!job) {
				let next = drawn.find(stale);
				if (!next && !s.reduce) next = cast.find(stale) ?? crowd.find((it, i) => i < l.crowd.length && stale(it));
				if (!next) break;
				job = begin(next, dpr);
			}
			// with motion reduced there is no inking in: a print with nothing to show yet is set at once
			const first = job.it.sprite === job.cv;
			if (!step(job, s.reduce && first ? Infinity : deadline)) break;
			job = null;
			if (performance.now() > deadline) break;
		}

		// breathing: each print drifts a hair on its own clock
		for (const it of drawn) {
			const p = it.pose, r = it.rest, live = s.reduce ? 0 : 1;
			p.x = r.x; p.y = r.y; p.a = r.a;
			p.r = r.r * (1 + live * 0.007 * Math.sin(s.t * 0.55 + it.phase));
			p.rot = r.rot + live * 0.008 * Math.sin(s.t * 0.37 + it.phase * 1.7);
		}

		const sw = Math.round(view.w * dpr), sh = Math.round(view.h * dpr);
		if (!scratch) { scratch = document.createElement("canvas"); sg = scratch.getContext("2d")!; }
		if (scratch.width !== sw || scratch.height !== sh) { scratch.width = sw; scratch.height = sh; }
		const g = sg!;
		g.setTransform(dpr, 0, 0, dpr, 0, 0);
		g.clearRect(0, 0, view.w, view.h);
		for (const it of drawn) stamp(g, it, dpr);
		g.globalAlpha = 1;
		if (!s.reduce) weaveAll(g, l);

		// the lens
		const ptr = s.pointer;
		const inQuiet = ptr ? s.quiet.some((q) => ptr.x > q.x && ptr.x < q.x + q.w && ptr.y > q.y && ptr.y < q.y + q.h) : false;
		const want = ptr && !inQuiet ? 1 : 0;
		lensA = s.reduce ? want : lensA + (want - lensA) * Math.min(1, s.dt * 10);
		if (ptr && want) { lensX = ptr.x; lensY = ptr.y; }
		if (lensA > 0.01) {
			const rad = Math.min(92, Math.max(58, Math.min(stage.w, stage.h) * 0.13)) * (0.9 + 0.1 * lensA);
			// magnify for the print under the glass, or failing that the nearest one it touches
			let top = under(lensX, lensY);
			if (!top) {
				let bd = 1e9;
				for (const it of drawn) {
					const p = it.rest;
					if (p.a < 0.12) continue;
					const d = Math.hypot((lensX - p.x) / HW, lensY - p.y) - p.r;
					if (d < rad * 0.6 && d < bd) { bd = d; top = it; }
				}
			}
			const target = top ? Math.min(6.5, Math.max(2.1, 11 / Math.max(0.5, typePx(top, top.rest.r)))) : lensMag;
			lensMag = s.reduce ? target : lensMag + (target - lensMag) * Math.min(1, s.dt * 9);
			g.save();
			g.globalAlpha = lensA;
			g.beginPath(); g.arc(lensX, lensY, rad, 0, TAU);
			g.fillStyle = "#F4F4F0"; g.fill();
			g.clip();
			for (const it of drawn) decipher(g, it, lensX, lensY, lensMag, rad, dpr);
			if (!s.reduce) {
				g.setTransform(dpr * lensMag, 0, 0, dpr * lensMag, dpr * lensX * (1 - lensMag), dpr * lensY * (1 - lensMag));
				weaveAll(g, l);
				g.setTransform(dpr, 0, 0, dpr, 0, 0);
				g.globalAlpha = lensA;
			}
			g.restore();
			// the glass: a fine rim, a hairline inside it, four ticks
			g.globalAlpha = lensA; g.strokeStyle = C.ink;
			g.lineWidth = 1.6; g.beginPath(); g.arc(lensX, lensY, rad, 0, TAU); g.stroke();
			g.lineWidth = 0.5; g.globalAlpha = lensA * 0.45; g.beginPath(); g.arc(lensX, lensY, rad - 4, 0, TAU); g.stroke();
			g.globalAlpha = lensA * 0.8; g.lineWidth = 1; g.beginPath();
			for (let i = 0; i < 4; i++) { const a = (i * TAU) / 4, c = Math.cos(a), sn = Math.sin(a); g.moveTo(lensX + c * (rad - 4), lensY + sn * (rad - 4)); g.lineTo(lensX + c * (rad + 5), lensY + sn * (rad + 5)); }
			g.stroke();
			g.globalAlpha = 1;
		}

		// keep the panel's copy clear
		if (s.quiet.length) {
			g.globalCompositeOperation = "destination-out";
			g.drawImage(quietMask(view, s.quiet), 0, 0, view.w, view.h);
			g.globalCompositeOperation = "source-over";
		}

		const a = clamp01(s.enter);
		if (a > 0.003) {
			ctx.save();
			ctx.globalAlpha *= a;
			ctx.drawImage(scratch, 0, 0, view.w, view.h);
			ctx.restore();
		}
	}

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

	function hit(x: number, y: number): Hit {
		const it = under(x, y);
		if (!it || it === main) return null;
		if (litIndex >= 0 && it === crowd[litIndex]) return { id: "lit" };
		return { id: it.id };
	}

	function dispose() {
		disposed = true;
		for (const it of [main, human, ai, lit, ...labs, ...crowd]) { it.sprite = null; it.ridges = null; it.glyphs = null; }
		scratch = null; sg = null; mask = null;
		void lastView; void inkRgb; void humanRgb; void aiRgb; void litRgb;
	}

	return { draw, anchors, hit, dispose };
};
