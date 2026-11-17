// Small cached prints for the rest of the page: the hero's own patterns (same source, same order), drawn once to a
// canvas and blitted. A section can stamp thousands of them a frame, so building one costs well under a few ms and
// every distinct sprite is built once. `clarity` is how well the print took: 1 crisp, 0.5 broken ridges, 0 a smudge.
//
// Large prints set as type (a section opener's, the closing bookend) cost tens of ms each, more on an older machine, so
// they can also be built a few ms at a time in idle moments (printSpriteLater): the same drawing, in the same order,
// paused between batches of ridges and letters.
import { requestFrame } from "../loop";
import { FONT, HW, TYPE, drawShare, fieldOf, patternSpec, rng, settleCanvas as settle, setType, sharedText, traceSteps, type Spec } from "./fingerprint";

export type SpriteOpts = {
	family: "main" | "human" | "ai" | "lab" | "writer";
	/** lab i = the hero's lab i (the order of its `labs`); writer i = the hero crowd's writer i (any i >= 0, wrapping) */
	index?: number;
	/** ink colour */
	color: string;
	/** CSS px height of the print (its width follows printAspect) */
	px: number;
	/** default devicePixelRatio, capped at 2 */
	dpr?: number;
	/** 1 = crisp ridges (default); 0 = smudged; in between reads as partly legible */
	clarity?: number;
	/** ridges set as paper text (sensible from about 120 px); default: ink-line ridges */
	text?: boolean;
	/** may be handed out blank and filled in within a few frames, once this frame has spent its tracing time (for
	 * sections placing many tiles at once; see printSprite) */
	defer?: boolean;
};

/** width / height of a print */
export function printAspect() { return HW; }

let spriteText = "";
/** the paper text for `text: true` sprites; without it they use the hero's own ridge text */
export function setSpriteText(text: string[]) {
	const next = text.join("   ") + "   ";
	if (next === spriteText) return;
	spriteText = next;
	for (const k of [...cache.keys()]) if (k.endsWith("|t")) cache.delete(k);
}

const cache = new Map<string, HTMLCanvasElement>();
type Geo = { spec: Spec; ds: number; ridges: Float32Array[]; field: ReturnType<typeof fieldOf> };
const geos = new Map<string, Geo>();
let fontWatch = false;

const WRITERS = 220;
// a pause point: the build yields here, and a time-sliced caller decides whether to go on now or in the next slice
type Steps<T> = Generator<void, T, void>;
// quantised like the hero's, so nearby sizes share one tracing
const geoKey = (family: SpriteOpts["family"], index: number, ds: number) => {
	const q = Math.pow(1.18, Math.round(Math.log(ds) / Math.log(1.18)));
	const i = family === "writer" ? ((index % WRITERS) + WRITERS) % WRITERS : family === "lab" ? index : 0;
	return { q, i, key: `${family}|${i}|${q.toFixed(4)}` };
};
function* geometry(family: SpriteOpts["family"], index: number, ds: number): Steps<Geo> {
	const { q, i, key } = geoKey(family, index, ds);
	let g = geos.get(key);
	if (!g) {
		const spec = patternSpec(family, i);
		const ridges = yield* traceSteps(spec, q);
		g = geos.get(key) ?? { spec, ds: q, ridges, field: fieldOf(spec) }; // (another build may have finished it meanwhile)
		geos.set(key, g);
	}
	return g;
}

function keyOf(o: SpriteOpts) {
	const px = Math.max(4, Math.round(o.px)), index = o.index ?? 0;
	const dpr = Math.min(2, o.dpr ?? (typeof devicePixelRatio === "number" ? devicePixelRatio : 1));
	const clarity = Math.round(Math.max(0, Math.min(1, o.clarity ?? 1)) * 10) / 10;
	const body = spriteText || sharedText;
	const text = !!o.text && px >= 60 && body.length > 0;
	return { px, index, dpr, clarity, body, text, key: `${o.family}|${index}|${o.color}|${px}|${dpr}|${clarity}|${text ? "t" : "l"}` };
}

const RUN = 64; // ridges or letters drawn between pauses
// the ridge gap grows slowly with size: a 16 px tile keeps four or five bold ridges, a large print many fine ones
const gapOf = (text: boolean, px: number) => (text ? Math.max(4.4, Math.min(6, px * 0.036)) : Math.max(1.9, Math.min(4.2, 1.35 + px * 0.021)));

/** The drawing itself, with pauses. Run to the end it returns the finished canvas (not yet cached). */
function* paint(o: SpriteOpts, k0: ReturnType<typeof keyOf>, out?: { cv?: HTMLCanvasElement }): Steps<HTMLCanvasElement> {
	const { px, index, dpr, clarity, body, text } = k0;
	const r = px / 2; // half-height in CSS px
	const gap = gapOf(text, px);
	const G = yield* geometry(o.family, index, gap / r);
	const R = rng(((index + 1) * 7919) ^ (px * 31) ^ (o.family.charCodeAt(0) << 8));
	const cv = document.createElement("canvas");
	cv.width = Math.max(1, Math.ceil(px * HW * dpr)); cv.height = Math.max(1, Math.ceil(px * dpr));
	const g = cv.getContext("2d")!;
	if (out) out.cv = cv;
	const k = (r - 0.5) * dpr, ox = cv.width / 2, oy = cv.height / 2;
	const c = clarity, lost = 1 - c;
	g.fillStyle = g.strokeStyle = o.color;

	// a print that took badly leaves a blot: soft, with no structure
	if (lost > 0.05) {
		const steps = px < 40 ? 6 : 14;
		for (let i = 0; i < steps; i++) {
			const u = 0.42 + (0.56 * i) / (steps - 1);
			g.globalAlpha = (lost * lost * 0.3) / steps;
			g.beginPath(); g.ellipse(ox + (R() - 0.5) * k * 0.1, oy + (R() - 0.5) * k * 0.1, k * HW * u, k * u, 0, 0, 6.2832); g.fill();
		}
	}
	// and it smears: the ridges are laid down more than once, slipped along one direction
	const passes = lost > 0.05 ? 3 : 1, slipA = R() * 6.2832, slip = lost * (gap / r) * 1.15;
	const strength = (0.42 + 0.58 * c) / (passes === 1 ? 1 : 1.9);
	// However faint, it is still a whole fingerprint: every ridge is laid once, unbroken and quiet, under whatever
	// broke or smeared. Low clarity takes legibility away, not the print.
	const floor = lost > 0.05 ? 0.2 + 0.2 * lost : 0;

	if (text) {
		if (!fontWatch && typeof document !== "undefined" && document.fonts?.load) {
			// sprites set before the page's face arrived are set again once it has
			fontWatch = true;
			document.fonts.load(`500 12px ${FONT}`).then(() => { for (const key of [...cache.keys()]) if (key.endsWith("|t")) cache.delete(key); }, () => {});
		}
		const T = setType(G.ridges, G.ds, body, Math.floor(R() * body.length), G.field.ink);
		yield;
		g.font = `500 ${G.ds * TYPE * k}px ${FONT}`; g.textAlign = "center"; g.textBaseline = "middle";
		// a hairline under the type keeps each ridge whole (it goes first as the print degrades)
		g.lineWidth = Math.max(0.5, G.ds * TYPE * k * (0.07 + 0.3 * lost)); g.globalAlpha = Math.max(0.16 * c * c, floor); g.lineCap = "round"; g.lineJoin = "round";
		g.beginPath();
		for (const rd of G.ridges) { g.moveTo(ox + rd[0] * k, oy + rd[1] * k); for (let i = 2; i < rd.length; i += 2) g.lineTo(ox + rd[i] * k, oy + rd[i + 1] * k); }
		g.stroke();
		yield;
		for (let p = 0; p < passes; p++) {
			const sx = Math.cos(slipA) * slip * p * k, sy = Math.sin(slipA) * slip * p * k;
			let run = 0, on = true;
			for (let i = 0; i < T.n; i++) {
				// letters drop out in runs, so words go missing rather than a uniform fade
				if (--run <= 0) { on = lost < 0.05 || R() > lost * 0.6; run = on ? 2 + R() * 30 * c * c : 2 + R() * 14 * lost; }
				if (!on) continue;
				g.globalAlpha = T.a[i] * strength * (p ? 0.55 : 1);
				g.setTransform(T.c[i], T.s[i], -T.s[i], T.c[i], ox + T.x[i] * k + sx, oy + T.y[i] * k + sy);
				g.fillText(T.ch[i], 0, 0);
				if (i % RUN === RUN - 1) { g.setTransform(1, 0, 0, 1, 0, 0); yield; }
			}
		}
		g.setTransform(1, 0, 0, 1, 0, 0);
	} else {
		g.lineCap = "round"; g.lineJoin = "round";
		const lw = G.ds * k * 0.42;
		if (floor) {
			g.lineWidth = lw; g.globalAlpha = floor * 0.6; // ink lines are heavier than type, so their floor is lower
			g.beginPath();
			for (const rd of G.ridges) { g.moveTo(ox + rd[0] * k, oy + rd[1] * k); for (let i = 2; i < rd.length; i += 2) g.lineTo(ox + rd[i] * k, oy + rd[i + 1] * k); }
			g.stroke();
		}
		for (let p = 0; p < passes; p++) {
			const sx = Math.cos(slipA) * slip * p * k, sy = Math.sin(slipA) * slip * p * k;
			let ri = 0;
			for (const rd of G.ridges) {
				const n = rd.length / 2, mid = (n >> 1) << 1;
				const ink = G.field.ink(rd[mid], rd[mid + 1]);
				g.globalAlpha = (0.55 + 0.4 * ink) * strength * (p ? 0.55 : 1) * (lost > 0.05 ? 0.7 + R() * 0.3 : 1);
				g.lineWidth = lw * (0.8 + 0.4 * G.field.ink(rd[0], rd[1])) * (1 + lost * 0.5);
				g.beginPath();
				// ridges break into runs of ink and gaps: long runs when clear, short ones when not
				let i = 0, drew = false;
				while (i < n) {
					const len = lost < 0.05 ? n : Math.max(2, Math.round(2 + R() * (3 + 46 * c * c * c)));
					const end = Math.min(n, i + len);
					if (end - i >= 2) { g.moveTo(ox + rd[i * 2] * k + sx, oy + rd[i * 2 + 1] * k + sy); for (let j = i + 1; j < end; j++) g.lineTo(ox + rd[j * 2] * k + sx, oy + rd[j * 2 + 1] * k + sy); drew = true; }
					i = end + (lost < 0.05 ? 0 : Math.round(1 + R() * 9 * lost));
				}
				if (drew) g.stroke();
				if (++ri % RUN === 0) yield;
			}
		}
	}
	g.globalAlpha = 1;
	return cv;
}

// Tracing a small print's ridges is most of its cost, and a section that places hundreds of new prints at once (tiles
// coming into view) would stall that frame on an older machine. So a frame traces new ridges for at most TRACE_MS; past
// that, a print is handed out blank, at its size, and filled in place within the next frames (a few ms each, in the
// page's loop); spritesVersion() tells the canvas to draw again. Tiles grow in from dots as they arrive, so the few
// frames before their prints fill in pass unseen. A print whose ridges are traced already is always drawn at once.
const TRACE_MS = 4;
let frameT = -1e9, spent = 0, version = 0;
const owed: Build[] = [];
/** changes whenever a print handed out blank has been filled in */
export const spritesVersion = () => version;
function fill(now: number) {
	const until = performance.now() + TRACE_MS;
	while (owed.length && owed[0].step(until)) owed.shift();
	if (owed.length) requestFrame(fill);
	void now;
}

/** A print as a canvas, cached by every field. Draw it with drawImage at (px * printAspect()) by px. */
export function printSprite(o: SpriteOpts): HTMLCanvasElement {
	const k = keyOf(o);
	const hit = cache.get(k.key);
	if (hit) return hit;
	const now = performance.now();
	if (now - frameT > 10) { frameT = now; spent = 0; } // a new frame's budget
	const traced = geos.has(geoKey(o.family, k.index, gapOf(k.text, k.px) / (k.px / 2)).key);
	if (o.defer && !traced && spent >= TRACE_MS && typeof window !== "undefined") {
		const cv = document.createElement("canvas");
		cv.width = Math.max(1, Math.ceil(k.px * HW * k.dpr)); cv.height = Math.max(1, Math.ceil(k.px * k.dpr));
		cache.set(k.key, cv);
		const run = paint(o, k);
		owed.push({ key: k.key, step: (deadline) => {
			let r = run.next();
			while (!r.done && performance.now() < deadline) r = run.next();
			if (!r.done) return false;
			cv.getContext("2d")!.drawImage(r.value, 0, 0);
			version++;
			return true;
		} });
		if (owed.length === 1) requestFrame(fill);
		return cv;
	}
	const run = paint(o, k);
	let r = run.next();
	while (!r.done) r = run.next();
	if (!traced) spent += performance.now() - now;
	cache.set(k.key, r.value);
	return r.value;
}

/** The cached print if it has been built, else null (no work). */
export function cachedSprite(o: SpriteOpts): HTMLCanvasElement | null {
	return cache.get(keyOf(o).key) ?? null;
}

// ---- building in idle moments --------------------------------------------------------------------------------------

type Idle = { timeRemaining(): number } | undefined;
// A print wanted soon (near the viewport) is built in the next idle moments, or within 300 ms if there are none; one
// wanted some time (the rest of the page's prints, set ahead) only when the page is truly idle.
const idle = (cb: (d: Idle) => void, soon: boolean) => {
	const w = window as unknown as { requestIdleCallback?: (cb: (d: Idle) => void, o?: { timeout: number }) => number };
	if (w.requestIdleCallback) w.requestIdleCallback(cb, { timeout: soon ? 300 : 4000 });
	else setTimeout(() => cb(undefined), soon ? 16 : 200);
};
type Build = { key: string; step: (deadline: number) => boolean };
const later = new Map<string, { p: Promise<HTMLCanvasElement>; b: Build }>();
const urgent: Build[] = [], spare: Build[] = []; // builds waiting for idle time, oldest first
let askedSoon = false, askedSpare = false;
const SLICE = 5; // ms of work per idle slice
function pump(d: Idle) {
	const until = performance.now() + SLICE;
	for (;;) {
		const q = urgent.length ? urgent : spare;
		if (!q.length) break;
		const budget = d ? Math.min(SLICE, Math.max(1, d.timeRemaining() - 1)) : SLICE;
		if (!q[0].step(performance.now() + budget)) break;
		q.shift();
		if (performance.now() > until) break;
	}
	ask();
}
function ask() {
	if (urgent.length && !askedSoon) { askedSoon = true; idle((d) => { askedSoon = false; pump(d); }, true); }
	else if (spare.length && !askedSoon && !askedSpare) { askedSpare = true; idle((d) => { askedSpare = false; pump(d); }, false); }
}

/** The same print as printSprite, built a few ms at a time in idle moments. Resolves with the cached canvas. `soon`:
 * it is wanted soon (near the viewport), so it goes ahead of prints set ahead of time. */
export function printSpriteLater(o: SpriteOpts, soon = true): Promise<HTMLCanvasElement> {
	const k = keyOf(o);
	const hit = cache.get(k.key);
	if (hit) return Promise.resolve(hit);
	const busy = later.get(k.key);
	if (busy) {
		// wanted sooner now: move it ahead
		const i = spare.indexOf(busy.b);
		if (soon && i >= 0) { spare.splice(i, 1); urgent.push(busy.b); ask(); }
		return busy.p;
	}
	let b!: Build;
	const p = new Promise<HTMLCanvasElement>((resolve) => {
		const out: { cv?: HTMLCanvasElement } = {};
		const run = paint(o, k, out);
		b = { key: k.key, step: (deadline) => {
			const t0 = performance.now(), drawUntil = t0 + drawShare(deadline - t0);
			let r = run.next();
			while (!r.done && performance.now() < drawUntil) r = run.next();
			// use what has been drawn so far, so this slice pays for rasterising it
			if (!r.done) { if (out.cv) settle(out.cv, performance.now() - t0); return false; }
			cache.set(k.key, r.value);
			settle(r.value, performance.now() - t0);
			later.delete(k.key);
			resolve(r.value);
			return true;
		} };
	});
	(soon ? urgent : spare).push(b);
	later.set(k.key, { p, b });
	ask();
	return p;
}

/** Trace the ridges of a family's small prints ahead of time, in idle moments, for tiles from pxFrom to pxTo px tall:
 * a section that stamps hundreds of small prints when it comes into view then only draws them (tracing is most of the
 * cost: about 14 ms for 64 writers on a fast laptop, four times that on an older one). */
/** warmTiles once `el` comes within about three screens of the viewport; returns a function that stops waiting */
export function warmTilesNear(el: Element, family: SpriteOpts["family"], count: number, pxFrom: number, pxTo: number): () => void {
	if (typeof IntersectionObserver === "undefined") return () => {};
	const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); warmTiles(family, count, pxFrom, pxTo); } }, { rootMargin: "300% 0px 300% 0px" });
	io.observe(el);
	return () => io.disconnect();
}
export function warmTiles(family: SpriteOpts["family"], count: number, pxFrom: number, pxTo: number) {
	if (typeof window === "undefined") return;
	const seen = new Set<string>();
	for (let px = pxFrom; px <= pxTo; px++) {
		const gap = Math.max(1.9, Math.min(4.2, 1.35 + px * 0.021)), ds = gap / (px / 2); // as paint() sets an ink-line print
		const q = Math.pow(1.18, Math.round(Math.log(ds) / Math.log(1.18)));
		for (let i = 0; i < count; i++) {
			const key = `${family}|${i}|${q.toFixed(4)}`;
			if (seen.has(key) || geos.has(key)) continue;
			seen.add(key);
			const run = geometry(family, i, ds);
			spare.push({ key, step: (deadline) => { let r = run.next(); while (!r.done && performance.now() < deadline) r = run.next(); return !!r.done; } });
		}
	}
	ask();
}

/** Build a list of sprites ahead of use, a few at a time in idle moments, so first use never stalls a frame. */
export function warm(list: SpriteOpts[]) {
	if (typeof window === "undefined") return;
	for (const o of list) void printSpriteLater(o, false);
}
