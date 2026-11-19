// The tweet thread's images, posts 2-9: one point each, at 1600x900 (X shows 16:9 uncropped), in the launch page's style
// (v2.ts). Sized for a phone feed, where an image is about 600 px wide: nothing below 34 px here (about 13 px there).
// Every string is the paper's own words (check_ngrams.py) and every number is the paper's, except post 3's closing line
// (p2), which is ours, and post 6's card (p5), whose headline and note are ours and three of whose numbers come from the
// lab-confusion record (see p5).
import { P, type Assets, ground, txt, lines, wrap, hl, card, chip, cross, half, hbar, review, motif, stroke, measure } from "./v2";

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
	txt(ctx, "56%", M - 16, 600, 450, { c: P.clay, ls: -0.045 });
	txt(ctx, "of 398 private peer reviews", M, 705, 58, { w: 600 });
	hl(ctx, "never made public", M, 820, 68);
	review(ctx, 1040, 205, 464, 400, 1.0, { anon: 0, redact: 1, ok: 1, tickP: 1, tag: "Peer review" });
	lines(ctx, ["A study across thousands of anonymous", "peer reviews is underway."], 1504, 776, SMALL, SMALL * 1.3, { w: 500, c: P.ink2, al: "right" });
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
	pair(ctx, { v: 97, n: "Gemini 4 Carbon", c: P.carbon }, { v: 97, n: "Pangram 4.1", c: P.gray }, 560);
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

// 5 · which lab, and the newest open models taken for Claude or GPT. Two strings are ours, not the paper's: the
// right-hand headline and the note under it (thread.md, Non-paper text). The 77% is the paper's (Kimi K2.6); 97%, 89% and 95% are Fable
// 5.2's answers in the lab-confusion record (E7 rq2_lab_confusion_20261114 results/confusion.json, per_writer, 75 texts
// a writer; "Qwen Max" there is the paper's Qwen3.8 Max).
function p5(ctx: Ctx, W: number, H: number, A: Assets) {
	const R = W - 92; // the right edge (a little closer than the others' 96, for the longest row)
	// left: the three big labs
	txt(ctx, "If AI, which lab?", M, 152, 62);
	txt(ctx, "98%", M - 12, 566, 318, { ls: -0.045 });
	txt(ctx, "accuracy or more on", M, 745, 38, { w: 500, c: P.ink2 });
	const labs = [{ n: "OpenAI", i: "openai", c: P.openai }, { n: "Anthropic", i: "anthropic", c: P.anthropic }, { n: "Google", i: "google", c: P.google }];
	let x = M;
	labs.forEach((l, i) => {
		const ic = A.icon(l.i, l.c); if (ic) ctx.drawImage(ic, x, 788 - 17, 34, 34);
		x += 34 + 11;
		x += txt(ctx, l.n, x, 800, 36, { c: l.c }) + 13;
		if (i < labs.length - 1) x += txt(ctx, "·", x, 800, 36, { c: P.ink2, w: 500 }) + 13;
	});
	ctx.fillStyle = P.rule; ctx.fillRect(800, 96, 2, 708);
	// right: two Moonshot and two Alibaba releases, the earlier one named for its own lab and the newest one not
	const X = 856;
	hl(ctx, "Fable 5.2 mistakes other labs’", X, 140, 42);
	hl(ctx, "newest models for Claude or GPT", X, 194, 42);
	const groups = [
		{ lab: "Moonshot", y: 296, rows: [
			{ from: "Kimi K2.6", to: "Moonshot", v: "77%", c: P.ink },
			{ from: "Kimi K3", to: "Claude", i: "anthropic", v: "97%", c: P.anthropic },
		] },
		{ lab: "Alibaba", y: 534, rows: [
			{ from: "Qwen3.6", to: "Alibaba", v: "89%", c: P.ink },
			{ from: "Qwen3.8 Max", to: "GPT", i: "openai", v: "95%", c: P.openai },
		] },
	];
	for (const g of groups) {
		txt(ctx, g.lab, X, g.y, 34, { w: 500, c: P.ink2 });
		g.rows.forEach((r, j) => {
			const y = g.y + 56 + j * 80;
			const a = chip(ctx, X, y, r.from, 36, {});
			const x0 = X + a.w + 12, x1 = x0 + 42;
			stroke(ctx, [[x0, y], [x1, y]], 1, r.c, 4);
			stroke(ctx, [[x1 - 14, y - 13], [x1, y], [x1 - 14, y + 13]], 1, r.c, 4);
			chip(ctx, x1 + 12, y, r.to, 36, { icon: "i" in r && r.i ? A.icon(r.i, r.c) : undefined, tc: r.c });
			txt(ctx, r.v, R, y + 19, 54, { c: r.c, al: "right", ls: -0.03 });
		});
	}
	lines(ctx, ["This is despite Fable recognizing", "the earlier releases."], X, 762, SMALL, 42, { w: 500, c: P.ink2 });
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

// 7 · beyond the private reviews, after the training cutoff (the post drops the Redditors line, so the image keeps it)
function p7(ctx: Ctx, W: number, H: number, A: Assets) {
	const c = chip(ctx, M, 120, "Claude Fable 5.2", LAB, { sw: P.clay });
	hl(ctx, "after its training cutoff", M + c.w + 30, 134, 58);
	const cells = [
		{ i: "nature", v: "78%", t: ["Nature-family reviews"] },
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
	txt(ctx, "87%", M - 10, 600, 310, { c: P.clay, ls: -0.04 });
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
