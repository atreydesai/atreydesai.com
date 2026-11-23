// The launch video's results cut (v2) and the tweet thread's images, drawn on a canvas in the launch page's own style:
// the dotted light ground, Inter, the paper's palette (palette.ts: Slop Rose, Aubergine and Teal for labs, Fable clay for
// Fable 5.2, neutrals for the rest), the page's tags and white cards, its deep-rose highlight, and the dark band for the
// closing line. The fingerprint is a faint motif only. Every string is the paper's own words (checked with
// docs/launch_20261116/tools/check_ngrams.py in the private llm-detectors repo) and every number is the paper's, except in
// the square cut's which-lab beat (labSquare, thread image 6's card): its headline is ours and three of its numbers come
// from the lab-confusion record (thread.ts, p5).
//
// Video beats (seconds): opener 0-2.0 · human or AI 2.0-5.0 · which lab 5.0-8.2 · which human 8.2-11.6 · defenses
// 11.6-14.6 · the closing line 14.6-18.4, whose last 0.45 s give way to the opener's first frame, so the loop is seamless.
import { LAB, MODEL, FABLE, VERDICT, GRAY, INK } from "#lib/who-wrote-this/palette.ts";
import icons from "#lib/who-wrote-this/icons.json";
import { printSprite } from "#lib/who-wrote-this/print/sprites.ts";

export const FONT = '"Inter", system-ui, -apple-system, sans-serif';
export const P = {
	ink: INK.ink, ink2: INK.ink2, ground: INK.ground, field: INK.field, rule: "#D3D3CB", card: "#FFFFFF", chip: "#F7F7F3",
	hl: "rgb(126,34,62)", hlTint: "rgba(126,34,62,0.14)", clay: FABLE.strong, ok: VERDICT.correct.strong, okInk: VERDICT.correct.ink,
	no: VERDICT.wrong.strong, gray: GRAY.strong, grayL: GRAY.light, line: "#C9C9C2",
	anthropic: LAB.Anthropic, google: LAB.Google, openai: LAB.OpenAI, carbon: MODEL["Gemini 4 Carbon"], sol: MODEL["GPT-6.1 Sol"],
	opus: MODEL["Opus 5.5"], argon: MODEL["Argon"],
};

// ── assets: icons as images (lab icons from the page's set, venue marks monochrome as on the page), the motif prints
type Img = HTMLImageElement;
export type Assets = { icon: (name: string, color: string) => Img | undefined; motif: HTMLCanvasElement; motifLight: HTMLCanvasElement };
const LABI = icons.lab as Record<string, string>, BRAND = icons.brand as Record<string, string>;
function svgFor(name: string, color: string) {
	if (LABI[name]) return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" fill="${color}">${LABI[name]}</svg>`;
	const b = BRAND[name];
	return b ? b.replace(/<svg([^>]*)>/, `<svg$1><style>path,rect,circle,polygon{fill:${color} !important}</style>`) : "";
}
export async function loadAssets(want: [string, string][]): Promise<Assets> {
	const cache = new Map<string, Img>();
	await Promise.all(want.map(async ([n, c]) => {
		const im = new Image();
		im.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgFor(n, c));
		try { await im.decode(); cache.set(`${n}|${c}`, im); } catch {}
	}));
	const faint = (color: string, px: number) => printSprite({ family: "main", color, px, dpr: 2, text: true });
	return { icon: (n, c) => cache.get(`${n}|${c}`), motif: faint(P.ink, 900), motifLight: faint(P.ground, 1000) };
}
export const ICONS: [string, string][] = [
	["openai", P.openai], ["anthropic", P.anthropic], ["google", P.google], ["openai", "#FFFFFF"], ["anthropic", "#FFFFFF"], ["google", "#FFFFFF"],
	["chat-x", P.ink2], ["eye-off", P.ink2], ["rewrite", P.ink2], ["human", P.ink], ["ai", P.ink], ["bulb", P.ink], ["pen", P.ink],
	["nature", P.ink], ["arxiv", P.ink], ["reddit", P.ink], ["book", P.ink], ["icml", P.ink], ["quote", P.grayL],
];

// ── drawing
type Ctx = CanvasRenderingContext2D;
const cl = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const out3 = (x: number) => 1 - Math.pow(1 - cl(x), 3);
/** an element arriving at `at` (s): alpha and a short rise */
export function arrive(t: number, at: number, dur = 0.32) { const p = out3((t - at) / dur); return { a: p, dy: (1 - p) * 0.5 }; }

export function ground(ctx: Ctx, W: number, H: number, pitch: number) {
	ctx.fillStyle = P.ground; ctx.fillRect(0, 0, W, H);
	ctx.fillStyle = "rgba(20,32,45,0.10)";
	const r = pitch * 0.075;
	for (let y = pitch / 2; y < H; y += pitch) for (let x = pitch / 2; x < W; x += pitch) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
}
export function setFont(ctx: Ctx, px: number, w = 600, ls = -0.02, it = false) { ctx.font = `${it ? "italic " : ""}${w} ${px}px ${FONT}`; (ctx as any).letterSpacing = `${(ls * px).toFixed(2)}px`; }
export function measure(ctx: Ctx, s: string, px: number, w = 600, ls = -0.02) { setFont(ctx, px, w, ls); return ctx.measureText(s).width; }
type TOpt = { w?: number; c?: string; al?: CanvasTextAlign; ls?: number; a?: number; it?: boolean };
export function txt(ctx: Ctx, s: string, x: number, y: number, px: number, o: TOpt = {}) {
	setFont(ctx, px, o.w ?? 600, o.ls ?? -0.02, o.it);
	ctx.fillStyle = o.c ?? P.ink; ctx.textAlign = o.al ?? "left"; ctx.textBaseline = "alphabetic";
	const a0 = ctx.globalAlpha; ctx.globalAlpha = a0 * (o.a ?? 1);
	ctx.fillText(s, x, y);
	ctx.globalAlpha = a0;
	return ctx.measureText(s).width;
}
/** wrap to maxW, then balance (narrowest width with the same number of lines) */
export function wrap(ctx: Ctx, s: string, px: number, maxW: number, w = 600, ls = -0.02) {
	const run = (mw: number) => { setFont(ctx, px, w, ls); const out: string[] = []; let line = ""; for (const word of s.split(" ")) { const n = line ? `${line} ${word}` : word; if (line && ctx.measureText(n).width > mw) { out.push(line); line = word; } else line = n; } if (line) out.push(line); return out; };
	const n = run(maxW).length;
	if (n < 2) return run(maxW);
	let lo = maxW / n, hi = maxW;
	for (let i = 0; i < 14; i++) { const m = (lo + hi) / 2; if (run(m).length > n) lo = m; else hi = m; }
	return run(hi);
}
export function lines(ctx: Ctx, ls: string[], x: number, y: number, px: number, lh: number, o: TOpt = {}) { ls.forEach((s, i) => txt(ctx, s, x, y + i * lh, px, o)); return y + (ls.length - 1) * lh; }
/** the page's highlight: deep rose words on a low tint band */
export function hl(ctx: Ctx, s: string, x: number, y: number, px: number, o: TOpt = {}) {
	const wd = measure(ctx, s, px, o.w ?? 600);
	const x0 = o.al === "center" ? x - wd / 2 : o.al === "right" ? x - wd : x;
	const a0 = ctx.globalAlpha; ctx.globalAlpha = a0 * (o.a ?? 1);
	ctx.fillStyle = P.hlTint; ctx.fillRect(x0 - px * 0.06, y - px * 0.3, wd + px * 0.12, px * 0.46);
	ctx.globalAlpha = a0;
	return txt(ctx, s, x, y, px, { ...o, c: P.hl });
}
function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
/** the page's white card, with its soft shadow */
export function card(ctx: Ctx, x: number, y: number, w: number, h: number, k: number, a = 1) {
	ctx.save(); ctx.globalAlpha *= a;
	ctx.shadowColor = "rgba(20,32,45,0.16)"; ctx.shadowBlur = 30 * k; ctx.shadowOffsetY = 10 * k;
	ctx.fillStyle = P.card; rr(ctx, x, y, w, h, 4 * k); ctx.fill();
	ctx.restore();
}
/** the page's tag: a pale chip with a swatch or an icon, the words in 600 ink */
export function chip(ctx: Ctx, x: number, y: number, s: string, px: number, o: { sw?: string; icon?: Img; a?: number; al?: "left" | "center" | "right"; c?: string; fill?: string; tc?: string } = {}) {
	const pad = px * 0.5, gap = px * 0.38, mark = o.sw || o.icon ? px * (o.icon ? 1.0 : 0.72) + gap : 0;
	const tw = measure(ctx, s, px, 600), w = pad * 2 + mark + tw, h = px * 1.72;
	const x0 = o.al === "center" ? x - w / 2 : o.al === "right" ? x - w : x, y0 = y - h / 2;
	ctx.save(); ctx.globalAlpha *= o.a ?? 1;
	ctx.shadowColor = "rgba(20,32,45,0.10)"; ctx.shadowBlur = px * 0.6; ctx.shadowOffsetY = px * 0.12;
	ctx.fillStyle = o.fill ?? P.chip; rr(ctx, x0, y0, w, h, px * 0.22); ctx.fill();
	ctx.restore();
	ctx.save(); ctx.globalAlpha *= o.a ?? 1;
	let cx = x0 + pad;
	if (o.icon) { const s2 = px * 1.0; ctx.drawImage(o.icon, cx, y - s2 / 2, s2, s2); cx += s2 + gap; }
	else if (o.sw) { const s2 = px * 0.72; ctx.fillStyle = o.sw; rr(ctx, cx, y - s2 / 2, s2, s2, px * 0.08); ctx.fill(); cx += s2 + gap; }
	txt(ctx, s, cx, y + px * 0.36, px, { c: o.tc ?? P.ink });
	ctx.restore();
	return { w, h, x0, y0 };
}
/** a stroke drawn along its points, p of the way */
export function stroke(ctx: Ctx, pts: [number, number][], p: number, c: string, lw: number, a = 1) {
	if (p <= 0) return;
	let total = 0; for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
	let left = total * cl(p);
	ctx.save(); ctx.globalAlpha *= a; ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.lineCap = "round"; ctx.lineJoin = "round";
	ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
	for (let i = 1; i < pts.length && left > 0; i++) {
		const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], d = Math.hypot(x1 - x0, y1 - y0);
		if (left >= d) ctx.lineTo(x1, y1); else ctx.lineTo(x0 + ((x1 - x0) * left) / d, y0 + ((y1 - y0) * left) / d);
		left -= d;
	}
	ctx.stroke(); ctx.restore();
}
export const tick = (ctx: Ctx, x: number, y: number, s: number, p: number, c = P.ok, a = 1) => stroke(ctx, [[x, y + s * 0.5], [x + s * 0.36, y + s * 0.86], [x + s, y + s * 0.08]], p, c, s * 0.17, a);
export function cross(ctx: Ctx, x: number, y: number, s: number, p: number, c = P.no, a = 1) {
	stroke(ctx, [[x, y], [x + s, y + s]], p * 2, c, s * 0.16, a);
	stroke(ctx, [[x + s, y], [x, y + s]], p * 2 - 1, c, s * 0.16, a);
}
export function half(ctx: Ctx, x: number, y: number, s: number, p: number, c = P.no, a = 1) {
	const r = s / 2, cx = x + r, cy = y + r;
	ctx.save(); ctx.globalAlpha *= a * cl(p * 2); ctx.strokeStyle = c; ctx.lineWidth = s * 0.14;
	ctx.beginPath(); ctx.arc(cx, cy, r - s * 0.07, 0, Math.PI * 2); ctx.stroke();
	ctx.globalAlpha = a * cl(p * 2 - 1); ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(cx, cy - r + s * 0.07); ctx.arc(cx, cy, r - s * 0.07, -Math.PI / 2, Math.PI / 2); ctx.closePath(); ctx.fill();
	ctx.restore();
}
/** a bar on a faint track, growing from the left to `frac` of the track, p of the way */
export function hbar(ctx: Ctx, x: number, y: number, w: number, h: number, p: number, c: string, a = 1, frac = 1) {
	ctx.save(); ctx.globalAlpha *= a;
	ctx.fillStyle = "rgba(20,32,45,0.08)"; rr(ctx, x, y, w, h, h / 2); ctx.fill();
	if (p > 0) { ctx.fillStyle = c; rr(ctx, x, y, Math.max(h, w * frac * out3(p)), h, h / 2); ctx.fill(); }
	ctx.restore();
}
/** a review card: grey text lines, then "Reviewer:" and a slot that is blank (dashed, "anonymous"), redacted, or named (a tick) */
export function review(ctx: Ctx, x: number, y: number, w: number, h: number, k: number, st: { a?: number; redact?: number; ok?: number; tickP?: number; tag?: string; anon?: number }) {
	const a = st.a ?? 1;
	card(ctx, x, y, w, h, k, a);
	ctx.save(); ctx.globalAlpha *= a;
	const pad = 34 * k, lh = 26 * k;
	if (st.tag) txt(ctx, st.tag, x + pad, y + pad + 26 * k, 34 * k, { w: 600, c: P.ink2 });
	ctx.strokeStyle = P.line; ctx.lineWidth = 9 * k; ctx.lineCap = "round";
	const top = y + pad + (st.tag ? 66 * k : 8 * k), rows = Math.max(1, Math.floor((h - (top - y) - 110 * k) / lh));
	for (let i = 0; i < rows; i++) { const ww = (w - pad * 2) * (i === rows - 1 ? 0.55 : 0.92 + 0.08 * Math.sin(i * 2.1)); ctx.beginPath(); ctx.moveTo(x + pad, top + i * lh); ctx.lineTo(x + pad + ww, top + i * lh); ctx.stroke(); }
	const by = y + h - pad - 6 * k, px = 40 * k;
	const lw = txt(ctx, "Reviewer:", x + pad, by, px, { c: P.ink2, w: 500 });
	const sx = x + pad + lw + 18 * k, sw = w - pad - (sx - x) - 64 * k, sh = 58 * k, sy = by - sh * 0.72;
	ctx.setLineDash([10 * k, 8 * k]); ctx.strokeStyle = P.gray; ctx.lineWidth = 2.5 * k; rr(ctx, sx, sy, sw, sh, 4 * k); ctx.stroke(); ctx.setLineDash([]);
	if ((st.anon ?? 1) > 0) txt(ctx, "anonymous", sx + 18 * k, by, px, { c: P.gray, w: 500, a: st.anon ?? 1 });
	const rp = st.redact ?? 0, ok = st.ok ?? 0;
	if (rp > 0) { ctx.save(); ctx.globalAlpha *= 1 - ok; ctx.fillStyle = P.ink; rr(ctx, sx + 12 * k, sy + 12 * k, (sw - 24 * k) * out3(rp), sh - 24 * k, 4 * k); ctx.fill(); ctx.restore(); }
	if (ok > 0) {
		ctx.save(); ctx.globalAlpha *= ok;
		ctx.fillStyle = "rgba(0,171,137,0.14)"; rr(ctx, sx, sy, sw, sh, 4 * k); ctx.fill();
		ctx.strokeStyle = P.ok; ctx.lineWidth = 2.5 * k; ctx.stroke();
		ctx.fillStyle = "rgba(0,171,137,0.55)"; rr(ctx, sx + 12 * k, sy + 12 * k, sw - 24 * k, sh - 24 * k, 4 * k); ctx.fill();
		ctx.restore();
	}
	if ((st.tickP ?? 0) > 0) tick(ctx, sx + sw + 14 * k, sy + 6 * k, 42 * k, st.tickP!, P.ok);
	ctx.restore();
}
export function motif(ctx: Ctx, im: HTMLCanvasElement, x: number, y: number, h: number, alpha: number) {
	const w = (h * im.width) / im.height;
	ctx.save(); ctx.globalAlpha *= alpha; ctx.drawImage(im, x, y, w, h); ctx.restore();
}

// ── the video
export const BEATS = [0, 2.0, 5.0, 8.2, 11.6, 14.6];
export const T_VIDEO = 18.4;
const SEAM = 0.45, OUT = 0.25;
type V = { ctx: Ctx; W: number; H: number; wide: boolean; t: number; A: Assets };

/** sizes: a 1080 square is seen ~360 px wide in a feed, a 1920 frame ~400 px, so the 16:9 type is about 1.35x */
function sz(W: number, H: number) {
	const wide = W / H > 1.3, f = wide ? 1.35 : 1;
	return { wide, M: wide ? 96 : 72, head: 92 * f, sub: 52 * f, lab: 46 * f, big: 280 * f, k: wide ? 1.3 : 1 };
}

export function frame(ctx: Ctx, W: number, H: number, tl: number, A: Assets, first: HTMLCanvasElement | null) {
	const S = sz(W, H);
	let b = 0; for (let i = 1; i < BEATS.length; i++) if (tl >= BEATS[i] - 1e-9) b = i;
	const t = tl - BEATS[b], dur = (BEATS[b + 1] ?? T_VIDEO) - BEATS[b];
	ground(ctx, W, H, S.wide ? 26 : 22);
	// the motif, faint, from the opener through the defenses
	if (b < 5) motif(ctx, A.motif, S.wide ? W - 560 : W - 460, S.wide ? -40 : -60, S.wide ? 760 : 620, 0.07);
	const fade = b === 0 ? 1 - cl((t - (dur - OUT)) / OUT) : 1 - cl((t - (dur - OUT)) / OUT);
	ctx.save(); ctx.globalAlpha = fade;
	const v: V = { ctx, W, H, wide: S.wide, t, A };
	[opener, detect, lab, human, defenses, closing][b](v, S);
	ctx.restore();
	if (b === 5 && first) {
		const seam = cl((t - (dur - SEAM)) / SEAM);
		if (seam > 0) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = out3(seam); ctx.drawImage(first, 0, 0); ctx.restore(); }
	}
	return b;
}
type Sz = ReturnType<typeof sz>;

function opener({ ctx, W, H, wide, A }: V, S: Sz) {
	// complete from frame 0: the poster
	if (!wide) {
		txt(ctx, "Who wrote this?", S.M, 190, 118);
		txt(ctx, "Fable 5.2 names the reviewer of", S.M, 300, S.sub, { w: 500 });
		txt(ctx, "55%", S.M - 8, 600, 330, { c: P.clay, ls: -0.04 });
		lines(ctx, ["of 15K anonymous", "ICML 2020 reviews"], S.M, 700, S.sub, S.sub * 1.22, { w: 500 });
		hl(ctx, "never made public", S.M, 880, S.sub * 1.12);
	} else {
		lines(ctx, ["Who wrote", "this?"], S.M, 300, 168, 180);
		hl(ctx, "never made public", S.M, 760, S.sub * 1.08);
		const x = 1000;
		lines(ctx, ["Fable 5.2 names", "the reviewer of"], x, 210, S.sub, S.sub * 1.2, { w: 500 });
		txt(ctx, "55%", x - 10, 700, 430, { c: P.clay, ls: -0.04 });
		lines(ctx, ["of 15K anonymous", "ICML 2020 reviews"], x, 830, S.sub, S.sub * 1.2, { w: 500 });
	}
}

function detect({ ctx, wide, t, A }: V, S: Sz) {
	const c1 = arrive(t, 0), h1 = arrive(t, 0.08), nl = arrive(t, 0.3), lo = arrive(t, 1.15), ll = arrive(t, 1.25);
	const grow = (t - 0.4) / 0.7;
	const val = (v: number) => `${Math.round(v * out3(grow))}%`;
	const vis = out3(grow * 3);
	if (!wide) {
		chip(ctx, S.M, 120, "Human or AI?", S.lab * 0.86, { icon: A.icon("ai", P.ink), a: c1.a });
		lines(ctx, ["Frontier models now", "identify AI text"], S.M, 265 + h1.dy * 20, S.head, S.head * 1.08, { a: h1.a });
		const cols = [{ x: S.M, v: 97, c: P.carbon, n: "Gemini 4 Carbon" }, { x: 560, v: 97, c: P.gray, n: "Pangram 4.1" }];
		for (const col of cols) {
			txt(ctx, val(col.v), col.x - 6, 625, 196, { c: col.c, ls: -0.04, a: vis });
			txt(ctx, col.n, col.x, 690, S.lab, { c: col.c, a: nl.a });
			hbar(ctx, col.x, 718, 420, 22, grow, col.c, nl.a, col.v / 100);
		}
		txt(ctx, "of fully AI-generated texts", S.M, 830, S.lab, { w: 500, c: P.ink2, a: lo.a });
		hl(ctx, "as well as specialized detectors", S.M, 940, S.sub, { a: ll.a });
	} else {
		chip(ctx, S.M, 150, "Human or AI?", S.lab * 0.8, { icon: A.icon("ai", P.ink), a: c1.a });
		lines(ctx, ["Frontier models", "now identify", "AI text"], S.M, 330 + h1.dy * 20, S.head * 0.92, S.head, { a: h1.a });
		hl(ctx, "as well as", S.M, 760, S.sub, { a: ll.a });
		hl(ctx, "specialized detectors", S.M, 760 + S.sub * 1.3, S.sub, { a: ll.a });
		const rows = [{ y: 330, v: 97, c: P.carbon, n: "Gemini 4 Carbon" }, { y: 700, v: 97, c: P.gray, n: "Pangram 4.1" }];
		for (const r of rows) {
			txt(ctx, val(r.v), 1000, r.y, 300, { c: r.c, ls: -0.04, a: vis });
			txt(ctx, r.n, 1004, r.y + 80, S.lab, { c: r.c, a: nl.a });
			hbar(ctx, 1004, r.y + 108, 760, 26, grow, r.c, nl.a, r.v / 100);
		}
		txt(ctx, "of fully AI-generated texts", 1004, 1000, S.lab * 0.86, { w: 500, c: P.ink2, a: lo.a });
	}
}

/** the square cut's which-lab beat: thread image 6's card (thread.ts p5) stacked for a square, in the beat's same 3.2 s.
 * Top: 98% for the three big labs. Below: two releases each from Moonshot and Alibaba, the earlier one named for its
 * own lab and the newest one taken for Claude or GPT (Fable 5.2's answers; numbers as on the card). */
function labSquare({ ctx, t, A }: V, S: Sz) {
	const M = S.M, R = 1080 - S.M;
	const h1 = arrive(t, 0), big = arrive(t, 0.12), acc = arrive(t, 0.3), rule = arrive(t, 0.55), hd1 = arrive(t, 0.6), hd2 = arrive(t, 0.66);
	txt(ctx, "If AI, which lab?", M, 150 + h1.dy * 20, 84, { a: h1.a });
	txt(ctx, "98%", M - 10, 440 + big.dy * 20, 270, { ls: -0.045, a: big.a });
	// beside the 98%: what it is and for whom
	const X = 680;
	lines(ctx, ["accuracy", "or more on"], X, 250 + acc.dy * 16, 38, 44, { w: 500, c: P.ink2, a: acc.a });
	const labs = [{ n: "OpenAI", i: "openai", c: P.openai }, { n: "Anthropic", i: "anthropic", c: P.anthropic }, { n: "Google", i: "google", c: P.google }];
	labs.forEach((l, i) => {
		const la = arrive(t, 0.38 + i * 0.05), y = 352 + i * 46 + la.dy * 16;
		ctx.save(); ctx.globalAlpha *= la.a;
		const ic = A.icon(l.i, l.c); if (ic) ctx.drawImage(ic, X, y - 30, 38, 38);
		ctx.restore();
		txt(ctx, l.n, X + 50, y, 38, { c: l.c, a: la.a });
	});
	ctx.save(); ctx.globalAlpha *= rule.a; ctx.fillStyle = P.rule; ctx.fillRect(M, 512, (R - M) * out3((t - 0.55) / 0.4), 2); ctx.restore();
	hl(ctx, "Fable 5.2 mistakes other labs’", M, 574 + hd1.dy * 16, 46, { a: hd1.a });
	hl(ctx, "newest models for Claude or GPT", M, 630 + hd2.dy * 16, 46, { a: hd2.a });
	const rows = [
		{ g: "Moonshot", from: "Kimi K2.6", to: "Moonshot", v: "77%", c: P.ink, y: 722 },
		{ from: "Kimi K3", to: "Claude", i: "anthropic", v: "97%", c: P.anthropic, y: 804 },
		{ g: "Alibaba", from: "Qwen3.6", to: "Alibaba", v: "89%", c: P.ink, y: 902 },
		{ from: "Qwen3.8 Max", to: "GPT", i: "openai", v: "95%", c: P.openai, y: 984 },
	];
	const RX = M + 186; // the rows, right of the lab names
	rows.forEach((r, i) => {
		const at = 0.85 + i * 0.14, ra = arrive(t, at), ta = arrive(t, at + 0.24), va = arrive(t, at + 0.3);
		if (r.g) txt(ctx, r.g, M, r.y + 14, 36, { w: 500, c: P.ink2, a: ra.a });
		const a = chip(ctx, RX, r.y, r.from, 40, { a: ra.a });
		const x0 = RX + a.w + 12, x1 = x0 + 44, p = (t - at - 0.08) / 0.2;
		stroke(ctx, [[x0, r.y], [x1, r.y]], p, r.c, 4.5);
		stroke(ctx, [[x1 - 15, r.y - 14], [x1, r.y], [x1 - 15, r.y + 14]], p * 2 - 1, r.c, 4.5);
		chip(ctx, x1 + 12, r.y, r.to, 40, { icon: r.i ? A.icon(r.i, r.c) : undefined, tc: r.c, a: ta.a });
		txt(ctx, r.v, R, r.y + 21, 60, { c: r.c, al: "right", ls: -0.03, a: va.a });
	});
}

function lab(v: V, S: Sz) {
	if (!v.wide) return labSquare(v, S);
	const { ctx, wide, t, A } = v;
	const h1 = arrive(t, 0), cd = arrive(t, 0.12), big = arrive(t, 1.45), acc = arrive(t, 1.55);
	const labs = [{ n: "OpenAI", i: "openai", c: P.openai }, { n: "Anthropic", i: "anthropic", c: P.anthropic }, { n: "Google", i: "google", c: P.google }];
	const models = [{ n: "Fable 5.2", c: P.clay }, { n: "Opus 5.5", c: P.opus }, { n: "Argon", c: P.argon }];
	const k = S.k;
	const L = wide
		? { hx: S.M, hy: 230, card: [1000, 150, 260, 380], chipX: 1340, chipY: [200, 340, 480], bigX: S.M - 10, bigY: 780, accY: 870, mY: 990 }
		: { hx: S.M, hy: 160, card: [S.M, 230, 270, 330], chipX: 560, chipY: [270, 395, 520], bigX: S.M - 8, bigY: 860, accY: 700, mY: 960 };
	if (wide) lines(ctx, ["If an AI,", "which lab"], L.hx, L.hy + h1.dy * 20, S.head * 1.1, S.head * 1.2, { a: h1.a });
	else txt(ctx, "If an AI, which lab", L.hx, L.hy + h1.dy * 20, S.head * 0.95, { a: h1.a });
	const [cx, cy, cw, ch] = L.card;
	card(ctx, cx, cy, cw, ch, k, cd.a);
	ctx.save(); ctx.globalAlpha *= cd.a; ctx.strokeStyle = P.line; ctx.lineWidth = 10 * k; ctx.lineCap = "round";
	for (let i = 0; i < 7; i++) { const y = cy + 50 * k + i * 38 * k; if (y > cy + ch - 30 * k) break; ctx.beginPath(); ctx.moveTo(cx + 34 * k, y); ctx.lineTo(cx + cw - (i === 6 ? 120 : 34) * k, y); ctx.stroke(); }
	ctx.restore();
	labs.forEach((l, i) => {
		const y = L.chipY[i], ca = arrive(t, 0.45 + i * 0.04);
		stroke(ctx, [[cx + cw + 6, cy + ch / 2], [cx + cw + (L.chipX - cx - cw) * 0.5, cy + ch / 2], [cx + cw + (L.chipX - cx - cw) * 0.5, y], [L.chipX - 14, y]], (t - 0.3 - i * 0.04) / 0.4, P.gray, 3 * k);
		const c = chip(ctx, L.chipX, y, l.n, S.lab * 1.02, { icon: A.icon(l.i, l.c), a: ca.a });
		tick(ctx, L.chipX + c.w + 22 * k, y - 22 * k, 44 * k, (t - 0.85 - i * 0.2) / 0.2);
	});
	txt(ctx, "98%", L.bigX, L.bigY, S.big * 1.0, { a: big.a, ls: -0.04 });
	if (wide) txt(ctx, "accuracy or more", S.M, L.accY, S.lab, { w: 500, c: P.ink2, a: acc.a });
	else lines(ctx, ["accuracy", "or more"], 700, 760, S.lab, S.lab * 1.2, { w: 500, c: P.ink2, a: acc.a });
	let mx = S.M;
	models.forEach((m, i) => { const ma = arrive(t, 1.65 + i * 0.04); const c = chip(ctx, mx, L.mY, m.n, S.lab * 0.86, { sw: m.c, a: ma.a }); mx += c.w + 18 * k; });
}

function human({ ctx, wide, t, A }: V, S: Sz) {
	const h1 = arrive(t, 0), cd = arrive(t, 0.12), ch = arrive(t, 0.32), big = arrive(t, 1.6), s1 = arrive(t, 1.7), s2 = arrive(t, 1.8);
	const k = S.k;
	const anon = 1 - cl((t - 0.8) / 0.2), redact = cl((t - 0.8) / 0.4), ok = cl((t - 1.3) / 0.2), tk = (t - 1.35) / 0.25;
	if (!wide) {
		lines(ctx, ["If a human,", "often exactly who"], S.M, 150 + h1.dy * 20, S.head * 0.95, S.head * 1.05, { a: h1.a });
		review(ctx, S.M, 300, 936, 270, k, { a: cd.a, anon, redact, ok, tickP: tk, tag: "ICML 2020" });
		const c = chip(ctx, 1008, 300, "Claude Fable 5.2", S.lab * 0.86, { sw: P.clay, a: ch.a, al: "right" });
		stroke(ctx, [[1008 - c.w / 2, 300 + c.h / 2], [1008 - c.w / 2, 470]], (t - 0.5) / 0.3, P.clay, 3, ch.a);
		txt(ctx, "55%", S.M - 8, 800, S.big, { c: P.clay, a: big.a, ls: -0.04 });
		txt(ctx, "of 15K anonymous ICML 2020 reviews", S.M, 880, S.lab, { w: 500, a: s1.a });
		hl(ctx, "never made public", S.M, 980, S.sub, { a: s2.a });
	} else {
		lines(ctx, ["If a human,", "often", "exactly who"], S.M, 230 + h1.dy * 20, S.head, S.head * 1.08, { a: h1.a });
		review(ctx, 960, 110, 860, 330, k * 0.95, { a: cd.a, anon, redact, ok, tickP: tk, tag: "ICML 2020" });
		const c = chip(ctx, 1820, 110, "Claude Fable 5.2", S.lab * 0.8, { sw: P.clay, a: ch.a, al: "right" });
		stroke(ctx, [[1820 - c.w / 2, 110 + c.h / 2], [1820 - c.w / 2, 330]], (t - 0.5) / 0.3, P.clay, 4, ch.a);
		txt(ctx, "55%", 950, 850, S.big * 1.05, { c: P.clay, a: big.a, ls: -0.04 });
		hl(ctx, "never made public", S.M, 780, S.sub, { a: s2.a });
		lines(ctx, ["of 15K anonymous", "ICML 2020 reviews"], 960, 960, S.lab * 0.9, S.lab * 1.12, { w: 500, a: s1.a });
	}
}

function defenses({ ctx, W, wide, t, A }: V, S: Sz) {
	const h1 = arrive(t, 0), k = S.k;
	const rows = [
		{ i: "chat-x", s: "models rarely refuse", m: "x" },
		{ i: "eye-off", s: "writing cannot be deleted from existing weights", m: "x" },
		{ i: "rewrite", s: "AI rewriting only partly helps", m: "half" },
	];
	const X0 = wide ? 960 : S.M, X1 = wide ? W - S.M : W - S.M, top = wide ? 150 : 290, pitch = wide ? 290 : 235;
	if (wide) lines(ctx, ["Defenses", "are limited"], S.M, 420 + h1.dy * 20, S.head * 1.15, S.head * 1.25, { a: h1.a });
	else txt(ctx, "Defenses are limited", S.M, 170 + h1.dy * 20, S.head, { a: h1.a });
	rows.forEach((r, i) => {
		const at = 0.3 + i * 0.45, ra = arrive(t, at), y = top + i * pitch;
		const isz = 70 * k, tx = X0 + isz + 34 * k, mark = 70 * k, maxW = X1 - tx - mark - 40 * k;
		ctx.save(); ctx.globalAlpha *= ra.a;
		const ic = A.icon(r.i, P.ink2); if (ic) ctx.drawImage(ic, X0, y + 6 * k, isz, isz);
		const ls = wrap(ctx, r.s, S.sub * 1.05, maxW, 500);
		lines(ctx, ls, tx, y + 58 * k, S.sub * 1.05, S.sub * 1.2, { w: 500 });
		ctx.fillStyle = P.rule; ctx.fillRect(X0, y + pitch - 40 * k, X1 - X0, 2 * k);
		ctx.restore();
		const mp = (t - at - 0.18) / 0.3;
		if (r.m === "x") cross(ctx, X1 - mark, y + 12 * k, mark * 0.86, mp); else half(ctx, X1 - mark, y + 8 * k, mark, mp);
	});
}

function closing({ ctx, W, H, wide, t, A }: V, S: Sz) {
	const band = cl(t / 0.18);
	ctx.save(); ctx.globalAlpha *= band; ctx.fillStyle = P.ink; ctx.fillRect(0, 0, W, H); ctx.restore();
	motif(ctx, A.motifLight, wide ? W - 900 : W - 640, wide ? -60 : 120, wide ? 1200 : 1000, 0.09 * band);
	const px = wide ? 104 : 78, maxW = W - 2 * S.M;
	const ls = wrap(ctx, "Anyone who has published enough writing online can no longer assume that an unsigned text keeps them anonymous.", px, maxW);
	const lh = px * 1.16, y0 = (H - ls.length * lh) / 2 + px * 0.8;
	ls.forEach((s, i) => { const a = arrive(t, 0.12 + i * 0.04); txt(ctx, s, S.M, y0 + i * lh + a.dy * 16, px, { c: "#FFFFFF", a: a.a * band }); });
}
