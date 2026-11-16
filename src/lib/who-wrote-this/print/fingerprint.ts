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
	x: Float32Array; y: Float32Array; c: Float32Array; s: Float32Array; a: Float32Array;
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

const TYPE = 0.76; // type size as a share of the ridge gap

function setType(ridges: Float32Array[], ds: number, text: string, offset: number, ink: (x: number, y: number) => number): Glyphs {
	const f = ds * TYPE;
	const X: number[] = [], Y: number[] = [], C: number[] = [], S: number[] = [], A: number[] = [], CH: string[] = [];
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
				X.push(x); Y.push(y); C.push(dx / l); S.push(dy / l); A.push(ink(x, y)); CH.push(ch);
			}
			at += adv;
			ti = (ti + 1) % text.length;
		}
	});
	start[ridges.length] = X.length;
	return { n: X.length, x: Float32Array.from(X), y: Float32Array.from(Y), c: Float32Array.from(C), s: Float32Array.from(S), a: Float32Array.from(A), ch: CH, start, box };
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
	spriteR: number; spriteKey: string;
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
	key: string;
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
		lines: false, edge: 1, ds: 0, ridges: null, field: null, glyphs: null, glyphEpoch: -1, sprite: null, spriteR: 0, spriteKey: "", full: 0,
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
	let fontEpoch = 0, fontAsked = false;
	let scratch: HTMLCanvasElement | null = null, sg: CanvasRenderingContext2D | null = null;
	let mask: HTMLCanvasElement | null = null, maskKey = "";
	let L: Layout | null = null;
	let lensMag = 3, lensA = 0, lensX = 0, lensY = 0;
	let drawn: Item[] = [];
	let lastView = { w: 0, h: 0, dpr: 1 };
	let disposed = false;

	// ── geometry and sprites, built on demand

	function geometry(it: Item) {
		// the ridge gap is fixed in px, so smaller prints have fewer, bolder ridges; quantised so a resize rarely retraces
		const want = it.gap / Math.max(8, it.full);
		const q = Math.pow(1.18, Math.round(Math.log(want) / Math.log(1.18)));
		if (it.ridges && it.ds === q) return;
		it.ds = q;
		it.field = fieldOf(it.spec);
		it.ridges = traceRidges(it.spec, q);
		it.glyphs = null; (it.sprite as any)?.close?.(); it.sprite = null; splits.length = 0;
	}
	function glyphsOf(it: Item): Glyphs {
		if (!it.glyphs || it.glyphEpoch !== fontEpoch) { it.glyphs = setType(it.ridges!, it.ds, it.text, it.offset, it.field!.ink); it.glyphEpoch = fontEpoch; }
		return it.glyphs;
	}
	const typePx = (it: Item, r: number) => it.ds * TYPE * r;

	function bake(it: Item, dpr: number) {
		geometry(it);
		const r = it.full, key = `${Math.round(r * dpr)}|${fontEpoch}|${it.ds}`;
		if (it.sprite && it.spriteKey === key) return;
		const pad = 3, w = Math.ceil((2 * HW * r + pad * 2) * dpr), h = Math.ceil((2 * r + pad * 2) * dpr);
		// an immutable bitmap where the browser has one: it blits faster than a live canvas
		const off = typeof OffscreenCanvas !== "undefined";
		const cv: any = off ? new OffscreenCanvas(w, h) : Object.assign(document.createElement("canvas"), { width: w, height: h });
		const g = cv.getContext("2d") as CanvasRenderingContext2D;
		const ox = (HW * r + pad) * dpr, oy = (r + pad) * dpr, k = r * dpr;
		const fpx = typePx(it, r);
		g.fillStyle = g.strokeStyle = it.color;
		if (fpx >= 2.7 && !it.lines) {
			// a hairline under the type keeps each ridge whole
			g.lineWidth = Math.max(0.5, fpx * 0.07) * dpr; g.globalAlpha = 0.16; g.lineJoin = "round";
			g.beginPath();
			for (const rd of it.ridges!) { g.moveTo(ox + rd[0] * k, oy + rd[1] * k); for (let i = 2; i < rd.length; i += 2) g.lineTo(ox + rd[i] * k, oy + rd[i + 1] * k); }
			g.stroke();
			const G = glyphsOf(it);
			g.font = `500 ${fpx * dpr}px ${FONT}`; g.textAlign = "center"; g.textBaseline = "middle";
			for (let i = 0; i < G.n; i++) {
				g.globalAlpha = G.a[i];
				g.setTransform(G.c[i], G.s[i], -G.s[i], G.c[i], ox + G.x[i] * k, oy + G.y[i] * k);
				g.fillText(G.ch[i], 0, 0);
			}
			g.setTransform(1, 0, 0, 1, 0, 0);
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
		g.globalAlpha = 1;
		(it.sprite as any)?.close?.();
		it.sprite = off ? cv.transferToImageBitmap() : cv; it.spriteR = r; it.spriteKey = key;
	}

	// ── where everything sits at each level, from the stage alone

	function layout(S: Box): Layout {
		const key = `${S.x | 0},${S.y | 0},${S.w | 0},${S.h | 0}`;
		if (L && L.key === key) return L;
		const wide = S.w > S.h * 0.9;
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
		const pitch = Math.max(30, Math.min(66, Math.sqrt((K.w * K.h) / 165)));
		const rowH = pitch * 0.96, cols = Math.max(2, Math.floor(K.w / pitch)), rws = Math.max(2, Math.floor(K.h / rowH));
		const padX = (K.w - (cols - 0.5) * pitch) / 2, padY = (K.h - (rws - 1) * rowH) / 2;
		const P = rng(seed + 8);
		const pts: number[][] = [];
		for (let j = 0; j < rws; j++) for (let i = 0; i < cols; i++) {
			if (pts.length >= MAX_CROWD) break;
			pts.push([K.x + padX + (i + (j % 2) * 0.5) * pitch + (P() - 0.5) * pitch * 0.2, K.y + padY + j * rowH + (P() - 0.5) * pitch * 0.2, pitch * (0.36 + P() * 0.09), (P() - 0.5) * 0.5]);
		}
		// the lit writer: the one nearest a point right of centre
		const tx = K.x + K.w * (wide ? 0.56 : 0.5), ty = K.y + K.h * 0.47;
		let best = 0, bd = 1e9;
		pts.forEach((p, i) => { const d = (p[0] - tx) ** 2 + (p[1] - ty) ** 2; if (d < bd) { bd = d; best = i; } });
		const litR = Math.min(K.h * 0.19, K.w * 0.23);
		splits.length = 0;
		L = { key, main: [cx, cy, r0], human1: [cx - S.w * 0.25, cy, r1], ai1: [cx + S.w * 0.25, cy, r1], human2, lab2, lab3, crowd: pts, lit: best, litR };
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
		const IN = (p: number) => ss(0.8, 1, p), OUT = (p: number) => 1 - ss(0, 0.16, p);
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
		const grow = ease(clamp01((p3 - 0.5) / 0.5));
		const lp = l.crowd[l.lit];
		const push = (l.litR + lp[2]) * 1.02 * grow;
		for (let i = 0; i < crowd.length; i++) {
			const c = l.crowd[i], it = crowd[i];
			if (!c) { it.rest.a = 0; continue; }
			let x = c[0], y = c[1];
			if (i !== l.lit && push > 0) {
				const dx = (x - lp[0]) / (HW * 1.12), dy = y - lp[1], d = Math.hypot(dx, dy) || 1, d2 = Math.sqrt(d * d + push * push);
				x = lp[0] + (dx / d) * d2 * HW * 1.12; y = lp[1] + (dy / d) * d2;
			}
			const out = Math.min(ss(S.x - c[2], S.x + c[2] * 0.5, x), 1 - ss(S.x + S.w - c[2] * 0.5, S.x + S.w + c[2], x), 1 - ss(S.y + S.h - c[2] * 0.4, S.y + S.h + c[2], y));
			it.edge = out;
			if (i === l.lit) {
				set(it, x, y, lerp(c[2], l.litR, grow), c[3] * (1 - grow), IN(p3) * (1 - ss(0.25, 0.8, grow)));
				set(lit, x, y, it.rest.r, it.rest.rot, ss(0.1, 0.7, grow));
			} else set(it, x, y, c[2], c[3], IN(p3) * out * lerp(0.86, 0.6, grow));
		}
	}

	// ── divisions: the parent's ridges, cut into threads, travel and re-form as the children's ridges

	type Split = { parent: Item; kids: Item[]; first: Int32Array; off: Int32Array; src: Float32Array; dst: Float32Array; delay: Float32Array; bend: Float32Array };
	const splits: (Split | null)[] = [];

	function buildSplit(parent: Item, kids: Item[], home: number[], homes: number[][]): Split | null {
		if (!parent.ridges || kids.some((k) => !k.ridges)) return null;
		const R = rng(seed + 31 + kids.length);
		// the parent's ridges in short pieces, each with a bearing from the centre
		const hp = parent.ds * 0.3, M = Math.max(6, Math.round(0.5 / hp));
		const pieces: { r: Float32Array; i0: number; i1: number; ang: number; len: number }[] = [];
		for (const r of parent.ridges) {
			const n = r.length / 2;
			for (let i0 = 0; i0 < n - 1; i0 += M) {
				const i1 = Math.min(n - 1, i0 + M), m = (i0 + i1) >> 1;
				if (i1 - i0 < 2) continue;
				pieces.push({ r, i0, i1, ang: Math.atan2(r[m * 2 + 1], r[m * 2] / HW), len: (i1 - i0) * hp });
			}
		}
		// children take pie slices of the parent, in the order they sit around it
		const bearing = kids.map((_, i) => Math.atan2(homes[i][1] - home[1], homes[i][0] - home[0]));
		const sorted = [...bearing].sort((a, b) => a - b);
		let cut = sorted[0] - 0.01, gap = 0;
		for (let i = 0; i < sorted.length; i++) {
			const nx = i + 1 < sorted.length ? sorted[i + 1] : sorted[0] + TAU;
			if (nx - sorted[i] > gap) { gap = nx - sorted[i]; cut = sorted[i] + gap / 2; }
		}
		const turn = (a: number) => (((a - cut) % TAU) + TAU) % TAU;
		pieces.sort((a, b) => turn(a.ang) - turn(b.ang));
		const order = kids.map((_, i) => i).sort((a, b) => turn(bearing[a]) - turn(bearing[b]));
		const need = kids.map((k) => { let t = 0; for (const r of k.ridges!) t += r.length; return t * k.ds * Math.max(1, k.full); });
		const total = need.reduce((a, b) => a + b, 0), all = pieces.reduce((a, b) => a + b.len, 0);
		const share: (typeof pieces)[] = kids.map(() => []);
		let pi = 0, acc = 0, goal = 0;
		for (const k of order) {
			goal += (need[k] / total) * all;
			while (pi < pieces.length && (acc + pieces[pi].len / 2 <= goal || share[k].length === 0)) { share[k].push(pieces[pi]); acc += pieces[pi].len; pi++; }
			if (!share[k].length) share[k].push(pieces[Math.min(pieces.length - 1, Math.floor(R() * pieces.length))]);
		}
		let far = 1;
		const dist = kids.map((_, i) => Math.hypot(homes[i][0] - home[0], homes[i][1] - home[1]));
		for (const d of dist) far = Math.max(far, d);
		const first = new Int32Array(kids.length + 1), off: number[] = [0], src: number[] = [], dst: number[] = [], delay: number[] = [], bend: number[] = [];
		kids.forEach((kid, ki) => {
			first[ki] = off.length - 1;
			const nr = kid.ridges!.length, mine = share[ki], kr = Math.max(1, kid.full), swing = (R() - 0.5) * 0.3;
			kid.ridges!.forEach((r, j) => {
				const n = r.length / 2, N = Math.max(2, Math.round(n / 3));
				const pc = mine[Math.min(mine.length - 1, Math.floor(((j + R()) / nr) * mine.length))];
				const at = dst.length;
				for (let q = 0; q < N; q++) { const i = Math.round((q / (N - 1)) * (n - 1)); dst.push(r[i * 2], r[i * 2 + 1]); }
				const s0 = src.length;
				for (let q = 0; q < N; q++) {
					const u = pc.i0 + (q / (N - 1)) * (pc.i1 - pc.i0), i = Math.min(pc.i1 - 1, Math.floor(u)), f = u - i;
					src.push(lerp(pc.r[i * 2], pc.r[i * 2 + 2], f), lerp(pc.r[i * 2 + 1], pc.r[i * 2 + 3], f));
				}
				// run the thread the way that twists least
				const ax = home[0] + src[s0] * parent.full, ay = home[1] + src[s0 + 1] * parent.full, bx = home[0] + src[s0 + N * 2 - 2] * parent.full, by = home[1] + src[s0 + N * 2 - 1] * parent.full;
				const cx = homes[ki][0] + dst[at] * kr, cy = homes[ki][1] + dst[at + 1] * kr, ex = homes[ki][0] + dst[at + N * 2 - 2] * kr, ey = homes[ki][1] + dst[at + N * 2 - 1] * kr;
				if ((ax - cx) ** 2 + (ay - cy) ** 2 + (bx - ex) ** 2 + (by - ey) ** 2 > (ax - ex) ** 2 + (ay - ey) ** 2 + (bx - cx) ** 2 + (by - cy) ** 2)
					for (let a = 0, b = N - 1; a < b; a++, b--) for (let c = 0; c < 2; c++) { const t = src[s0 + a * 2 + c]; src[s0 + a * 2 + c] = src[s0 + b * 2 + c]; src[s0 + b * 2 + c] = t; }
				off.push(dst.length / 2);
				// nearer children go first, and within one the ridges follow each other
				delay.push(clamp01((dist[ki] / far) * 0.5 + (j / nr) * 0.38 + R() * 0.12));
				bend.push(swing + (R() - 0.5) * 0.1);
			});
		});
		first[kids.length] = off.length - 1;
		return { parent, kids, first, off: Int32Array.from(off), src: Float32Array.from(src), dst: Float32Array.from(dst), delay: Float32Array.from(delay), bend: Float32Array.from(bend) };
	}

	const BINS = 6;
	/** the threads of one division at progress p; `lod` thins the points when the pieces are tiny */
	function weave(g: CanvasRenderingContext2D, sp: Split, p: number, aFrom: number) {
		const env = ss(0, 0.14, p) * (1 - ss(0.86, 1, p));
		if (env < 0.01) return;
		const P = sp.parent.rest, wp = sp.parent.ds * P.r * 0.3;
		g.lineCap = "round"; g.lineJoin = "round";
		for (let ki = 0; ki < sp.kids.length; ki++) {
			const kid = sp.kids[ki], K = kid.rest, edge = kid.edge;
			if (K.r < 0.5 || edge < 0.01) continue;
			const c = Math.cos(K.rot) * K.r, sn = Math.sin(K.rot) * K.r;
			const mx = K.x - P.x, my = K.y - P.y;
			const wk = kid.ds * K.r * (kid.lines ? 0.4 : 0.3), aTo = kid.lines ? 0.8 : 0.9;
			for (let b = 0; b < BINS; b++) {
				let any = false;
				for (let th = sp.first[ki], end = sp.first[ki + 1]; th < end; th++) {
					const t = ease((p - 0.07 - sp.delay[th] * 0.36) / 0.46);
					if (Math.min(BINS - 1, Math.floor(t * BINS)) !== b) continue;
					if (!any) { any = true; g.beginPath(); }
					const sw = Math.sin(Math.PI * t) * sp.bend[th], ox = -my * sw, oy = mx * sw, u = 1 - t;
					for (let i = sp.off[th], e2 = sp.off[th + 1], i0 = i; i < e2; i++) {
						const x = u * (P.x + sp.src[i * 2] * P.r) + t * (K.x + sp.dst[i * 2] * c - sp.dst[i * 2 + 1] * sn) + ox;
						const y = u * (P.y + sp.src[i * 2 + 1] * P.r) + t * (K.y + sp.dst[i * 2] * sn + sp.dst[i * 2 + 1] * c) + oy;
						if (i === i0) g.moveTo(x, y); else g.lineTo(x, y);
					}
				}
				if (!any) continue;
				const tb = b / (BINS - 1);
				g.strokeStyle = mixRgb(sp.parent.rgb, kid.rgb, ss(0.05, 0.75, tb));
				g.lineWidth = Math.max(0.35, lerp(wp, wk, tb));
				g.globalAlpha = env * lerp(aFrom, aTo * edge, tb);
				g.stroke();
			}
		}
		g.globalAlpha = 1;
	}

	function weaveAll(g: CanvasRenderingContext2D, l: Layout) {
		const p1 = clamp01(e), p2 = clamp01(e - 1), p3 = clamp01(e - 2);
		const live = l.crowd.length;
		if (p1 > 0 && p1 < 1) { splits[0] ??= buildSplit(main, [human, ai], l.main, [l.human1, l.ai1]); if (splits[0]) weave(g, splits[0], p1, 0.85); }
		if (p2 > 0 && p2 < 1) { splits[1] ??= buildSplit(ai, labs, l.ai1, l.lab2); if (splits[1]) weave(g, splits[1], p2, 0.85); }
		if (p3 > 0 && p3 < 1) { splits[2] ??= buildSplit(human, crowd.slice(0, live), l.human2, l.crowd); if (splits[2]) weave(g, splits[2], p3, 0.5); }
	}

	// ── drawing

	function stamp(g: CanvasRenderingContext2D, it: Item, dpr: number) {
		const p = it.pose;
		if (p.a < 0.004 || !it.sprite) return;
		const k = p.r / it.spriteR, w = it.sprite.width / dpr, h = it.sprite.height / dpr;
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
		g.font = `500 ${f * k * dpr}px ${FONT}`; g.textAlign = "center"; g.textBaseline = "middle";
		const nr = it.ridges.length;
		for (let ri = 0; ri < nr; ri++) {
			const b = ri * 4;
			if (G.box[b] > ux + ru || G.box[b + 2] < ux - ru || G.box[b + 1] > uy + ru || G.box[b + 3] < uy - ru) continue;
			for (let i = G.start[ri], end = G.start[ri + 1]; i < end; i++) {
				const ex = G.x[i] - ux, ey = G.y[i] - uy;
				if (ex * ex + ey * ey > ru2) continue;
				const c = G.c[i] * cr - G.s[i] * sr, s = G.s[i] * cr + G.c[i] * sr;
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
			fontAsked = true;
			const refresh = () => { widths = new Map(); fontEpoch++; };
			document.fonts?.load(`500 12px ${FONT}`).then(refresh, () => {});
		}
		// the one piece of state: the eased level
		const goal = Math.max(0, Math.min(3, s.level));
		if (s.reduce) e = Math.round(goal);
		else if (e < 0) e = goal;
		else {
			// close to the scroll when it scrubs (about 120 ms of smoothing); a jump is paced to take a second or two
			const d = goal - e, dt = Math.min(0.05, Math.max(0, s.dt));
			const cap = (0.85 + 0.55 * Math.max(0, Math.abs(d) - 1)) * dt;
			e = Math.abs(d) < 0.0005 ? goal : e + Math.max(-cap, Math.min(cap, d * (1 - Math.exp(-dt / 0.12))));
		}
		pose(stage);
		const l = L!;

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

		// build what is missing, a few ms a frame: what is on stage first, then the rest of the cast, so that every
		// division has its threads ready (everything on stage at once when motion is reduced)
		const t0 = performance.now(), budget = s.reduce ? 4000 : 6;
		let first = true;
		const need = (it: Item) => {
			if (it.full <= 0) return;
			if (it.sprite && it.spriteKey.startsWith(`${Math.round(it.full * dpr)}|${fontEpoch}|`)) return;
			if (!first && performance.now() - t0 > budget) return;
			bake(it, dpr); first = false;
		};
		for (const it of drawn) need(it);
		if (!s.reduce) { need(main); need(human); need(ai); need(lit); for (const it of labs) need(it); for (let i = 0; i < l.crowd.length; i++) need(crowd[i]); }

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
			const top = under(lensX, lensY);
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
