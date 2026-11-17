// The tweet thread's images, posts 2-9: one point each, at 1600x900 (X shows 16:9 uncropped), in the launch page's style
// (v2.ts). Sized for a phone feed, where an image is about 600 px wide: nothing below 34 px here (about 13 px there).
// Every string is the paper's own words (check_ngrams.py) and every number is the paper's.
import { P, type Assets, ground, txt, lines, wrap, hl, card, chip, tick, cross, half, hbar, review, motif, stroke, measure } from "./v2";

export const THREAD = ["p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9"];
type Ctx = CanvasRenderingContext2D;
const M = 96, HEAD = 84, SUB = 50, LAB = 40, SMALL = 34, BIG = 380;

export function drawThread(ctx: Ctx, id: string, W: number, H: number, A: Assets) {
	ground(ctx, W, H, 26);
	({ p2, p3, p4, p5, p6, p7, p8, p9 } as Record<string, (ctx: Ctx, W: number, H: number, A: Assets) => void>)[id]?.(ctx, W, H, A);
}

// 2 · the headline result, landed hard
function p2(ctx: Ctx, W: number, H: number, A: Assets) {
	motif(ctx, A.motif, -140, 60, 980, 0.05);
	txt(ctx, "Claude Fable 5.2 names the reviewer of", M, 150, SUB, { w: 500 });
	txt(ctx, "55%", M - 16, 600, 450, { c: P.clay, ls: -0.045 });
	txt(ctx, "of 15K anonymous ICML 2020 reviews", M, 705, 58, { w: 600 });
	hl(ctx, "never made public", M, 820, 68);
	review(ctx, 1040, 205, 464, 400, 1.0, { anon: 0, redact: 1, ok: 1, tickP: 1, tag: "ICML 2020" });
	txt(ctx, "studied with IRB approval", 1504, 820, SMALL, { w: 500, c: P.ink2, al: "right" });
}

/** two results side by side: big number, name, a bar */
function pair(ctx: Ctx, a: { v: number; n: string; c: string }, b: { v: number; n: string; c: string }, y: number) {
	[[a, M], [b, 860]].forEach(([r, x]) => {
		const s = r as { v: number; n: string; c: string };
		txt(ctx, `${s.v}%`, (x as number) - 10, y, 300, { c: s.c, ls: -0.04 });
		txt(ctx, s.n, x as number, y + 86, SUB, { c: s.c });
		hbar(ctx, x as number, y + 122, 620, 24, 1, s.c, 1, s.v / 100);
	});
}

// 3 · human or AI: as well as specialized detectors
function p3(ctx: Ctx, W: number, H: number, A: Assets) {
	chip(ctx, M, 112, "Human or AI?", LAB, { icon: A.icon("ai", P.ink) });
	hl(ctx, "as well as specialized detectors", M, 240, 64);
	pair(ctx, { v: 97, n: "Gemini 4 Carbon", c: P.carbon }, { v: 96, n: "Pangram 4", c: P.gray }, 560);
	txt(ctx, "of fully AI-generated texts", M, 790, LAB, { w: 500, c: P.ink });
	txt(ctx, "at the same false positive rate (0.01% of English human texts)", M, 845, SMALL, { w: 500, c: P.ink2 });
}

// 4 · ideas as well as prose
function p4(ctx: Ctx, W: number, H: number, A: Assets) {
	chip(ctx, M, 112, "AI-generated ideas", LAB, { icon: A.icon("bulb", P.ink) });
	hl(ctx, "they exceed the accuracy of IdeaLens", M, 240, 64);
	pair(ctx, { v: 90, n: "GPT-6.1 Sol", c: P.sol }, { v: 87, n: "IdeaLens", c: P.gray }, 560);
	txt(ctx, "accuracy on idea detection", M, 790, LAB, { w: 500, c: P.ink });
}

// 5 · which lab, and what the detectors mistake
function p5(ctx: Ctx, W: number, H: number, A: Assets) {
	txt(ctx, "If an AI, which lab", M, 160, HEAD * 0.9);
	txt(ctx, "98%", M - 10, 500, 300, { ls: -0.04 });
	txt(ctx, "accuracy or more", M, 585, LAB, { w: 500, c: P.ink2 });
	const labs = [{ n: "OpenAI", i: "openai" as const, c: P.openai }, { n: "Anthropic", i: "anthropic", c: P.anthropic }, { n: "Google", i: "google", c: P.google }];
	let y = 675;
	for (const l of labs) {
		const c = chip(ctx, M, y, l.n, LAB, { icon: A.icon(l.i, l.c) });
		tick(ctx, M + c.w + 18, y - 20, 40, 1);
		y += 76;
	}
	// right: the detectors' mistakes
	ctx.fillStyle = P.rule; ctx.fillRect(820, 110, 2, 720);
	hl(ctx, "usually mistaken for", 880, 200, 56);
	const rows = [
		{ from: "Kimi K3", sub: "Moonshot", to: "Claude", i: "anthropic", c: P.anthropic, y: 380 },
		{ from: "Qwen3.8", sub: "Alibaba", to: "GPT", i: "openai", c: P.openai, y: 620 },
	];
	for (const r of rows) {
		const a = chip(ctx, 880, r.y, r.from, SUB, {});
		txt(ctx, r.sub, 880, r.y + 96, SMALL, { w: 500, c: P.ink2 });
		const x0 = 880 + a.w + 24, x1 = 1220;
		stroke(ctx, [[x0, r.y], [x1 - 14, r.y]], 1, r.c, 6);
		stroke(ctx, [[x1 - 36, r.y - 18], [x1 - 12, r.y], [x1 - 36, r.y + 18]], 1, r.c, 6);
		chip(ctx, x1 + 10, r.y, r.to, SUB, { icon: A.icon(r.i, r.c), tc: r.c });
	}
}

// 6 · how the detectors describe each lab's writing (the paper's own sentences)
function p6(ctx: Ctx, W: number, H: number, A: Assets) {
	const cards = [
		{ n: "GPT", i: "openai", c: P.openai, q: "hedges its claims, flags gaps instead of inventing specifics, and leans on aphorisms." },
		{ n: "Claude", i: "anthropic", c: P.anthropic, q: "treats opposing views charitably, writes with dry wit, and ends quietly." },
		{ n: "Gemini", i: "google", c: P.google, q: "stacks adjectives and piles on intensifiers and stock clichés, and invents named sources and quotes in its news articles." },
	];
	const cw = 448, gap = 32, y0 = 90, ch = 720;
	cards.forEach((cd, i) => {
		const x = M + i * (cw + gap);
		card(ctx, x, y0, cw, ch, 1.1);
		const ic = A.icon(cd.i, cd.c); if (ic) ctx.drawImage(ic, x + 40, y0 + 52, 72, 72);
		txt(ctx, cd.n, x + 132, y0 + 112, 76, { c: cd.c });
		const q = A.icon("quote", P.grayL); if (q) ctx.drawImage(q, x + 40, y0 + 168, 52, 52);
		const ls = wrap(ctx, cd.q, 44, cw - 76, 500);
		lines(ctx, ls, x + 40, y0 + 270, 44, 58, { w: 500 });
	});
}

// 7 · beyond ICML, after the training cutoff (the post drops the Redditors line, so the image keeps it)
function p7(ctx: Ctx, W: number, H: number, A: Assets) {
	const c = chip(ctx, M, 120, "Claude Fable 5.2", LAB, { sw: P.clay });
	hl(ctx, "after its training cutoff", M + c.w + 30, 134, 58);
	const cells = [
		{ i: "nature", v: "76%", t: ["Nature-family reviews"] },
		{ i: "book", v: "15/15", t: ["stories by authors with", ">1M Goodreads ratings"] },
		{ i: "arxiv", v: "46%", t: ["arXiv papers", "at least one author"] },
		{ i: "reddit", v: "69%", t: ["comments made by", "active Redditors"] },
	];
	cells.forEach((cell, i) => {
		const x = M + (i % 2) * 720, y = 230 + Math.floor(i / 2) * 320;
		const ic = A.icon(cell.i, P.ink); if (ic) ctx.drawImage(ic, x, y + 4, 60, 60);
		lines(ctx, cell.t, x + 84, y + 44, LAB, LAB * 1.15, { w: 600 });
		txt(ctx, cell.v, x - 6, y + 268, 186, { c: P.clay, ls: -0.04 });
	});
}

// 8 · confidence, and familiarity
function p8(ctx: Ctx, W: number, H: number, A: Assets) {
	lines(ctx, ["When Fable 5.2's confidence", "is 25% or more, its", "predictions are"], M, 150, 46, 58, { w: 500 });
	txt(ctx, "89%", M - 10, 600, 310, { c: P.clay, ls: -0.04 });
	txt(ctx, "correct", M, 700, 64);
	ctx.fillStyle = P.rule; ctx.fillRect(820, 110, 2, 720);
	const x = 880, w = 620;
	lines(ctx, wrap(ctx, "Familiarity with the writer predicts accuracy", 56, w), x, 180, 56, 66, {});
	txt(ctx, "Opus 5.5 names the writer of", x, 370, SMALL, { w: 500, c: P.ink2 });
	const rows = [{ l: "by authors it says it knows well", v: 0.92, s: "92%", sub: "of stories" }, { l: "from authors it says it does not know at all", v: 0.02, s: "<2%", sub: "of texts" }];
	rows.forEach((r, i) => {
		const y = 470 + i * 200;
		txt(ctx, r.s, x, y, 110, { c: P.opus, ls: -0.03 });
		txt(ctx, r.sub, x + measure(ctx, r.s, 110, 600, -0.03) + 18, y, SMALL, { w: 500, c: P.ink2 });
		hbar(ctx, x, y + 26, w, 26, 1, P.opus, 1, Math.max(0.03, r.v));
		lines(ctx, wrap(ctx, r.l, SMALL, w, 500), x, y + 100, SMALL, 42, { w: 500 });
	});
}

// 9 · defenses are limited
function p9(ctx: Ctx, W: number, H: number, A: Assets) {
	txt(ctx, "Defenses are limited", M, 175, HEAD * 1.1);
	const cards = [
		{ i: "chat-x", s: "models rarely refuse", m: "x" },
		{ i: "eye-off", s: "writing cannot be deleted from existing weights", m: "x" },
		{ i: "rewrite", s: "AI rewriting only partly helps", m: "half" },
	];
	const cw = 448, gap = 32, y0 = 270, ch = 520;
	cards.forEach((c, i) => {
		const x = M + i * (cw + gap);
		card(ctx, x, y0, cw, ch, 1.1);
		const ic = A.icon(c.i, P.ink2); if (ic) ctx.drawImage(ic, x + 40, y0 + 44, 96, 96);
		lines(ctx, wrap(ctx, c.s, 48, cw - 80, 600), x + 40, y0 + 230, 48, 60, {});
		if (c.m === "x") cross(ctx, x + cw - 150, y0 + ch - 150, 104, 1); else half(ctx, x + cw - 156, y0 + ch - 156, 116, 1);
	});
}
