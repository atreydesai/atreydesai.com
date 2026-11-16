// Small cached prints for the rest of the page: the hero's own patterns (same source, same order), drawn once to a
// canvas and blitted. A section can stamp thousands of them a frame, so building one costs well under a few ms and
// every distinct sprite is built once. `clarity` is how well the print took: 1 crisp, 0.5 broken ridges, 0 a smudge.
import { FONT, HW, TYPE, fieldOf, patternSpec, rng, setType, sharedText, traceRidges, type Spec } from "./fingerprint";

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
function geometry(family: SpriteOpts["family"], index: number, ds: number): Geo {
	// quantised like the hero's, so nearby sizes share one tracing
	const q = Math.pow(1.18, Math.round(Math.log(ds) / Math.log(1.18)));
	const i = family === "writer" ? ((index % WRITERS) + WRITERS) % WRITERS : family === "lab" ? index : 0;
	const key = `${family}|${i}|${q.toFixed(4)}`;
	let g = geos.get(key);
	if (!g) { const spec = patternSpec(family, i); g = { spec, ds: q, ridges: traceRidges(spec, q), field: fieldOf(spec) }; geos.set(key, g); }
	return g;
}

/** A print as a canvas, cached by every field. Draw it with drawImage at (px * printAspect()) by px. */
export function printSprite(o: SpriteOpts): HTMLCanvasElement {
	const px = Math.max(4, Math.round(o.px)), index = o.index ?? 0;
	const dpr = Math.min(2, o.dpr ?? (typeof devicePixelRatio === "number" ? devicePixelRatio : 1));
	const clarity = Math.round(Math.max(0, Math.min(1, o.clarity ?? 1)) * 10) / 10;
	const body = spriteText || sharedText;
	const text = !!o.text && px >= 60 && body.length > 0;
	const key = `${o.family}|${index}|${o.color}|${px}|${dpr}|${clarity}|${text ? "t" : "l"}`;
	const hit = cache.get(key);
	if (hit) return hit;

	const r = px / 2; // half-height in CSS px
	// the ridge gap grows slowly with size: a 16 px tile keeps four or five bold ridges, a large print many fine ones
	const gap = text ? Math.max(4.4, Math.min(6, px * 0.036)) : Math.max(1.9, Math.min(4.2, 1.35 + px * 0.021));
	const G = geometry(o.family, index, gap / r);
	const R = rng(((index + 1) * 7919) ^ (px * 31) ^ (o.family.charCodeAt(0) << 8));
	const cv = document.createElement("canvas");
	cv.width = Math.max(1, Math.ceil(px * HW * dpr)); cv.height = Math.max(1, Math.ceil(px * dpr));
	const g = cv.getContext("2d")!;
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
		g.font = `500 ${G.ds * TYPE * k}px ${FONT}`; g.textAlign = "center"; g.textBaseline = "middle";
		// a hairline under the type keeps each ridge whole (it goes first as the print degrades)
		g.lineWidth = Math.max(0.5, G.ds * TYPE * k * (0.07 + 0.3 * lost)); g.globalAlpha = Math.max(0.16 * c * c, floor); g.lineCap = "round"; g.lineJoin = "round";
		g.beginPath();
		for (const rd of G.ridges) { g.moveTo(ox + rd[0] * k, oy + rd[1] * k); for (let i = 2; i < rd.length; i += 2) g.lineTo(ox + rd[i] * k, oy + rd[i + 1] * k); }
		g.stroke();
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
			}
		}
	}
	g.globalAlpha = 1;
	cache.set(key, cv);
	return cv;
}

/** Build a list of sprites ahead of use, a few at a time in idle moments, so first use never stalls a frame. */
export function warm(list: SpriteOpts[]) {
	if (typeof window === "undefined") return;
	let i = 0;
	const idle: (cb: (d?: { timeRemaining(): number }) => void) => void =
		(window as any).requestIdleCallback ? (cb) => (window as any).requestIdleCallback(cb, { timeout: 500 }) : (cb) => setTimeout(() => cb(), 16);
	const work = (d?: { timeRemaining(): number }) => {
		const until = performance.now() + 6;
		while (i < list.length && (d ? d.timeRemaining() > 2 : true) && performance.now() < until) printSprite(list[i++]);
		if (i < list.length) idle(work);
	};
	idle(work);
}
