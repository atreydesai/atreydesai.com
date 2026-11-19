<script lang="ts" module>
	// Its footnotes, which the page registers before the section wakes (Defer.svelte), so the notes list and the marks' numbers
	// are complete from the start.
	import S from "./rq3.json";
	export const FOOTNOTES = { id: S.id, notes: S.notes.map((f, i) => ({ n: i + 1, t: f.t })) };
</script>

<script lang="ts">
	// If human, which human? Section 3, in the blocking of the section 1 mock (HumanOrAIB.svelte):
	//   1. the chapter opener (SectionOpener): the question, the takeaway, a crowd of writers' prints with one lit;
	//   2. a pinned stage with a caption band on top (the narration card, its step dashes on top), placed as section 4's
	//      (Familiar.svelte): 76px down and 760px wide on a wide screen, 60px down and full width on a phone. The
	//      picture under the band changes composition by step:
	//        - the demo, a centred column: an illustrative review, then the paper's prompt closing around it, then the
	//          model's answer under a placeholder name (John Doe); the few words that matter are highlighted, the rest
	//          is quiet gray, so the point reads without reading every word;
	//        - the private reviews as a full-width wall of tiles (1 tile = 1 review), the lit share large on it;
	//        - the five models as five columns on one baseline, their shares above them;
	//        - Figure 1's other sets of writers as a skyline of blocks (1 tile = 1 text);
	//        - stated confidence as two blocks side by side (1 tile = 1 answer);
	//        - the paper's Oates example: Fable 5.2's explanation set large, the story and the answer beside it;
	//   3. footnotes (Footnotes, listed at the page's foot): the demo's provenance and placeholder, the aggregate-only
	//      sentence, and the three sets' extra sentences. There is no Explore: every view is in the scroll.
	// Tiles are drawn on the page's field and stand for the paper's aggregate counts only, never individual texts,
	// reviewers or per-review results. Lit tiles fill from the bottom (from the left on a phone) in the colour of the
	// model whose result they show; every colour is named on the picture with Tags. The step follows the scroll position
	// (a passive listener) one step at a time, each shown at least 350 ms, so no step is skipped however fast the scroll;
	// each step has about 60vh of scroll (75vh when it animates). Strings and numbers come from rq3.json, built in the
	// private llm-detectors repo by docs/launch_20261116/tools/build_rq3_data.py.
	import { onMount } from "svelte";
	import { registerSteps, stepShown } from "./steplinks.ts";
	import { fade } from "svelte/transition";
	import Icon from "./Icon.svelte";
	import Tags, { type Tag } from "./Tags.svelte";
	import SectionOpener from "./SectionOpener.svelte";
	import StepDashes from "./StepDashes.svelte";
	import Footnotes from "./Footnotes.svelte";
	import HoverCue from "./HoverCue.svelte";
	import { field, chart, regions, type Mark, type Path } from "./field.svelte";
	import { onScroll as onPageScroll, requestFrame, view as vp, lite } from "./loop";
	import { FABLE, GRAY, INK as TONE, modelColor, deepen, TILE } from "./palette";
	import { printSprite, printAspect, warmTilesNear } from "./print/sprites";

	type View = "review" | "prompt" | "reviews" | "models" | "domains" | "confidence" | "example";
	type Model = (typeof S.models)[number];
	type Dom = (typeof S.domains)[number];
	type Order = "up" | "col"; // lit first: from the bottom row up, or column by column from the left
	type Block = { id: string; n: number; k: number; x: number; y: number; cols: number; rows: number; s: number; alpha: number; color: string; order: Order };
	type Box = { x0: number; x1: number; y0: number; y1: number };
	type Step = (typeof S.steps)[number] & { head?: { t: string } };
	// a label in the picture (a title, a unit, a share): stage px, anchored at (ax, ay) of its own box
	type Lab = { id: string; x: number; y: number; t: string; k: "num" | "knock" | "cap" | "unit"; ax: number; ay: number; size?: number; color?: string; alpha?: number; icon?: string };
	type Bar = { id: string; n: number; k: number; color: string; t: string; sub?: string; icon?: string; swatch?: boolean; strong?: boolean; num?: string; alpha?: number };

	const OWNER = "rq3";
	const UNLIT = GRAY.unlit;
	const FONT = "Inter, system-ui, sans-serif";
	// the opener's prints: the hero's crowd of writers with one lit, in the style guide's light ramp steps that read on
	// the dark band (rose mid #DC89A7, as section 1's opener uses; teal light #8CB5C0)
	const ROSE_L = "#DC89A7", TEAL_L = "#8CB5C0";
	const PRINTS = [
		{ family: "writer" as const, index: 5, color: ROSE_L },
		{ family: "writer" as const, index: 0, color: TEAL_L },
		{ family: "writer" as const, index: 9, color: ROSE_L },
	];
	const STEPS = S.steps as Step[];
	const LAST = STEPS.length - 1;
	// scroll per step, in vh (Atrey, 16 Nov: neither too fast for a fast scroller nor a long still stretch for a slow
	// one): about 60vh a step, 75vh for a step that animates (the tiles ease in); the demo's prompt step has two moves
	// (the prompt closes around the review, then the answer arrives), 75vh each
	const VH = [60, 150, 75, 75, 75, 75, 60];
	const LEN = VH.reduce((a, v) => a + v, 0);
	const ANSWER_AT = 0.5; // share of the prompt step scrolled before the answer arrives
	const LAND = [0.5, 0.75, 0.5, 0.5, 0.5, 0.5, 0.5]; // where a dash click or a footnote's ↩ lands in its step
	const HOLD = 350; // ms: the least time a step is shown when a fast scroll crosses several
	// the beats the stage walks through, in order: each step once, the prompt step twice (before and after its answer)
	const beatOf = (s: number, p: number) => (s === 0 ? 0 : s === 1 ? (p >= ANSWER_AT ? 2 : 1) : s + 1);
	const LAYOUTS = [[["famous", "nature", "papers"], ["active", "inactive"]], [["famous", "nature"], ["papers", "inactive"], ["active"]]];
	const ICON: Record<string, string> = { famous: "book", nature: "nature", papers: "arxiv", active: "reddit", inactive: "reddit" };
	const U: Record<string, string> = Object.fromEntries(S.ui.map((u) => [u.id, u.t]));
	const D: Record<string, string> = Object.fromEntries(S.demo.map((u) => [u.id, u.t]));
	const NOTES = FOOTNOTES.notes;
	const FN: Record<string, number> = Object.fromEntries(S.notes.map((f, i) => [f.id, i + 1]));
	// each footnote's return point: the step whose picture or sentence marks it
	const FN_STEP: Record<number, number> = Object.fromEntries(S.notes.map((f, i) => [i + 1, f.id === "demo" ? 0 : f.id === "placeholder" ? 1 : f.id === "privacy" ? 2 : 4]));
	// a step's sentence cut at its footnote marks
	type Part = { t: string; fn?: number };
	const parts = (s: Step): Part[] => {
		const out: Part[] = [];
		let rest = s.t;
		for (const m of (s as Step & { marks?: { after: string; note: string }[] }).marks ?? []) {
			const i = rest.indexOf(m.after);
			if (i < 0) continue;
			out.push({ t: rest.slice(0, i + m.after.length) }, { t: "", fn: FN[m.note] });
			rest = rest.slice(i + m.after.length);
		}
		if (rest) out.push({ t: rest });
		return out;
	};
	const fill = (t: string, v: Record<string, string | number>) => t.replace(/\{(\w+)\}/g, (_, k) => String(v[k]));
	const pct = (p: number) => fill(U.pct, { pct: Math.round(p) }); // whole percents
	const dom = (id: string) => S.domains.find((d) => d.id === id)!;
	const hue = (m: Model) => modelColor(m.short);
	const FAB = S.models[0];
	const E = S.example;

	let step = $state(0);
	let ans = $state(false); // the demo's answer is in
	let active = $state(false);
	let cue = $state<string | null>(null); // the example's reason the reader picked (its words light, the rest dim)
	let tags = $state<Tag[]>([]);
	let labels = $state<Lab[]>([]);
	let still = $state(false);
	let root: HTMLElement, track: HTMLElement, stick: HTMLElement, band: HTMLElement, card: HTMLElement, says: HTMLElement, sizer: HTMLElement;

	const view = $derived<View>(STEPS[step].view as View);
	const demo = $derived(view === "review" || view === "prompt");
	// the demo's three states (the review alone; the prompt around it; the answer in), each laid out once in its own
	// layer and cross-faded: animating the type's size and the rows' heights laid the demo out every frame. Leaving the
	// demo, the last state stays as it fades out.
	type DemoState = "review" | "prompt" | "answer";
	let lastDemo: DemoState = "review";
	const demoState = $derived.by<DemoState>(() => (lastDemo = view === "review" ? "review" : view === "prompt" ? (ans ? "answer" : "prompt") : lastDemo));
	const tiles = $derived(view !== "review" && view !== "prompt" && view !== "example");
	const lit = (c: string) => cue === null || cue === c;
	let tried = $state(false); // a reason has been picked: the cue that says to pick one goes
	const pick = (c: string) => { cue = cue === c ? null : c; tried = true; };
	const key = (e: KeyboardEvent, c: string) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(c); } };
	let reduce = $state(false);

	// --- drawing ----------------------------------------------------------------------------------------------
	// Work happens only when an input changes (step, a control, size, the stage while it scrolls in or out, or the
	// canvas changing hands) and while a lit count is still easing; otherwise nothing runs. A view's tiles, labels and
	// tags are built once per input; the easing then only recolours the tiles whose state flips, and a scroll of the
	// unpinned stage only shifts the built geometry (DotField then moves the chart as one).
	type Entry = { b: Block; base: number; on: number; edge: Path | null };
	type Geo = { key: string; ox: number; oy: number; marks: Mark[]; paths: Path[]; tags: Tag[]; blocks: Entry[] };
	const blank = (key: string, ox: number, oy: number): Geo => ({ key, ox, oy, marks: [], paths: [], tags: [], blocks: [] });
	const anim: Record<string, number> = {}; // lit tiles shown per block, eased toward the target count
	let used = new Set<string>();
	let geo: Geo | null = null;
	let G: Geo = blank("", 0, 0); // the view being built
	let L: Lab[] = []; // its labels, in viewport px while building
	let meter: CanvasRenderingContext2D | null = null;
	const tw = (t: string, size: number, weight = 400) => {
		if (!meter) return t.length * size * 0.56;
		meter.font = `${weight} ${size}px ${FONT}`;
		return meter.measureText(t).width;
	};
	// a Tag's box (Tags.svelte: 12.5 px words, 3 px 8 px padding; strong 14 px, 5 px 10 px; a 10 px swatch, 6 px gap)
	const TAG_H = 26, STRONG_H = 32, SUB_H = 19;
	const tagW = (t: string, o: { swatch?: boolean; icon?: boolean; strong?: boolean } = {}) =>
		(o.strong ? 20 : 16) + (o.swatch === false ? 0 : 16) + (o.icon ? (o.strong ? 20 : 18.5) : 0) + tw(t, o.strong ? 14 : 12.5, 600);
	const tagH = (strong = false, sub = false) => (strong ? STRONG_H : TAG_H) + (sub ? SUB_H : 0);
	const KEY_GAP = 8; // between tags set side by side
	const HEAD = TAG_H + 14; // the header row (title, keys, unit) and its gap to the tiles

	const ASPECT = printAspect();
	// a tile as named or not: colour, and (at readable sizes) its writer's print, crisp on a solid tile in the model's
	// colour when named, pale when not; used when a tile is placed and when it flips as the count eases
	function dress(m: Mark, id: number, on: boolean, color: string) {
		const ink = on ? color : UNLIT;
		m.color = ink;
		if (!m.sprite && !m.spriteKey) return; // a plain square (too small for a print)
		const px = Math.round(m.r * 2), wi = id % 64;
		m.sprite = printSprite({ family: "writer", index: wi, color: on ? deepen(ink, TILE.inkDepth) : ink, px, clarity: 1, defer: true });
		m.spriteKey = `w${wi}|${ink}|${px}|${on ? 1 : 0}`;
		m.backing = on ? TILE.litBacking : TILE.unlitBacking;
	}
	const cell = (b: Block, i: number): [number, number] =>
		b.order === "col" ? [Math.floor(i / b.rows), i % b.rows] : [i % b.cols, b.rows - 1 - Math.floor(i / b.cols)];
	function place(b: Block, base: number): Entry {
		const cur = anim[b.id] ?? (reduce ? b.k : 0);
		anim[b.id] = cur;
		used.add(b.id);
		const on = Math.round(cur);
		for (let i = 0; i < b.n; i++) {
			const [c, r] = cell(b, i);
			// each tile is a writer's print: solid in the model's colour when it was named, pale when not; prints only
			// where they can be read (14 px and up), smaller tiles stay plain squares
			const lt = i < on, px = Math.max(6, Math.round(b.s * 0.9)), wi = (base + i) % 64;
			const ink = lt ? b.color : UNLIT;
			const pr = px >= 14;
			G.marks.push({
				id: `t${base + i}`, square: true, x: b.x + c * b.s + b.s / 2, y: b.y + r * b.s + b.s / 2, r: pr ? px / 2 : b.s * 0.36, color: ink, alpha: b.alpha,
				...(pr ? { sprite: printSprite({ family: "writer", index: wi, color: lt ? deepen(ink, TILE.inkDepth) : ink, px, clarity: 1, defer: true }), spriteKey: `w${wi}|${ink}|${px}|${lt ? 1 : 0}`, aspect: ASPECT, backing: lt ? TILE.litBacking : TILE.unlitBacking } : {}),
			});
		}
		const e: Entry = { b, base, on, edge: null };
		// the level the lit tiles reach, as a thin ink line (only on blocks in focus)
		if (b.alpha === 1) { e.edge = { pts: edge(b, on), color: TONE.ink, width: 1.25, progress: 1 }; G.paths.push(e.edge); }
		G.blocks.push(e);
		return e;
	}

	// ease each block's lit count toward its target, recolouring only the tiles that flip; true while still moving
	function tween(dt: number) {
		let busy = false;
		for (const e of geo!.blocks) {
			const b = e.b;
			let cur = anim[b.id];
			if (cur !== b.k) {
				const d = b.k - cur, speed = Math.max(Math.abs(d) * 3, b.n * 0.45, 30) * dt;
				cur = reduce || Math.abs(d) <= speed ? b.k : cur + Math.sign(d) * speed;
				anim[b.id] = cur;
				if (cur !== b.k) busy = true;
			}
			const on = Math.round(cur);
			if (on === e.on) continue;
			const ms = geo!.marks;
			for (let i = Math.min(on, e.on), hi = Math.max(on, e.on); i < hi; i++) dress(ms[e.base + i], e.base + i, i < on, b.color);
			e.on = on;
			if (e.edge) e.edge.pts = edge(b, on);
		}
		return busy;
	}

	// the stage moved (scrolling in or out, unpinned): move what is built instead of building it again (labels and
	// hit areas are in the stage, so they move with it)
	function shift(dx: number, dy: number) {
		const g = geo!;
		for (const m of g.marks) { m.x += dx; m.y += dy; }
		for (const p of g.paths) for (const q of p.pts) { q[0] += dx; q[1] += dy; }
		for (const e of g.blocks) { e.b.x += dx; e.b.y += dy; }
		g.tags = g.tags.map((t) => ({ ...t, x: t.x + dx, y: t.y + dy }));
		g.ox += dx; g.oy += dy;
		tags = g.tags;
	}

	// the boundary between the lit tiles and the rest, as a stair line (none when all or none are lit)
	function edge(b: Block, c: number): [number, number][] {
		if (c <= 0 || c >= b.n) return [];
		const s = b.s;
		if (b.order === "col") {
			const full = Math.floor(c / b.rows), rem = c % b.rows, x = (k: number) => b.x + k * s, yb = b.y + b.rows * s;
			return rem === 0 ? [[x(full), b.y], [x(full), yb]] : [[x(full + 1), b.y], [x(full + 1), b.y + rem * s], [x(full), b.y + rem * s], [x(full), yb]];
		}
		const full = Math.floor(c / b.cols), rem = c % b.cols, xr = b.x + b.cols * s, y = (k: number) => b.y + (b.rows - k) * s;
		return rem === 0 ? [[b.x, y(full)], [xr, y(full)]] : [[b.x, y(full + 1)], [b.x + rem * s, y(full + 1)], [b.x + rem * s, y(full)], [xr, y(full)]];
	}

	// the largest tile that fits n tiles in a W x H box
	function fit(n: number, W: number, H: number, max = 19) {
		let s = Math.min(max, Math.sqrt((W * H) / n)), cols = 1;
		for (; s > 2; s -= 0.25) { cols = Math.max(1, Math.floor(W / s)); if (Math.ceil(n / cols) * s <= H) break; }
		return { s, cols, rows: Math.ceil(n / cols) };
	}

	// the colour keys: "Fable 5.2: named correctly" in clay, "Incorrect" in gray; returns the x after them
	function keys(x: number, y: number, wrongOnly = false) {
		if (!wrongOnly) {
			const a = fill(U["key.correct"], { model: FAB.short });
			G.tags.push({ id: "k:correct", x: x - 10, y, at: "right", color: hue(FAB), t: a });
			x += tagW(a) + KEY_GAP;
		}
		G.tags.push({ id: "k:wrong", x: x - 10, y, at: "right", color: UNLIT, t: U["key.wrong"] });
		return x + tagW(U["key.wrong"]) + KEY_GAP;
	}

	// a view's header row: a title or the colour keys on the left, the unit on the right (under them when there is no
	// room); returns where the tiles can start
	function header(A: Box, o: { title?: string; icon?: string; keys?: "all" | "wrong"; unit: string }) {
		const y = A.y0 + TAG_H / 2;
		let x = A.x0;
		if (o.title) {
			L.push({ id: "h:title", x, y, t: o.title, k: "cap", ax: 0, ay: 0.5, icon: o.icon });
			x += (o.icon ? 19 : 0) + tw(o.title.toUpperCase(), 12, 600) + o.title.length * 0.72 + 16;
		}
		if (o.keys) x = keys(x, y, o.keys === "wrong");
		if (x + tw(o.unit, 12.5) + 8 <= A.x1) {
			L.push({ id: "h:unit", x: A.x1, y, t: o.unit, k: "unit", ax: 1, ay: 0.5 });
			return A.y0 + HEAD;
		}
		L.push({ id: "h:unit", x: A.x0, y: y + TAG_H, t: o.unit, k: "unit", ax: 0, ay: 0.5 });
		return A.y0 + HEAD + TAG_H - 4;
	}

	// a phone's layout for a list of groups: one bar each, its tag and share on a line above it, filled from the left
	function bars(A: Box, top: number, items: Bar[], maxS = 14) {
		const W = A.x1 - A.x0, gap = 12;
		const hh = (it: Bar) => tagH(it.strong, !!it.sub) + 6;
		const fixed = items.reduce((a, it) => a + hh(it), 0) + gap * (items.length - 1);
		let s = maxS, cols = 1;
		for (; s > 2; s -= 0.25) { cols = Math.floor(W / s); if (items.reduce((a, it) => a + Math.ceil(it.n / cols) * s, 0) + fixed <= A.y1 - top) break; }
		const total = items.reduce((a, it) => a + Math.ceil(it.n / cols) * s, 0) + fixed;
		let y = top + Math.max(0, (A.y1 - top - total) / 2), base = 0;
		const out: { it: Bar; y: number; h: number }[] = [];
		for (const it of items) {
			if (it.strong && it.num && tagW(it.t, { strong: true, swatch: it.swatch !== false, icon: !!it.icon }) + tw(it.num, 24, 600) + 16 > W) it.strong = false;
			const h = hh(it), rows = Math.ceil(it.n / cols);
			G.tags.push({ id: `b:${it.id}`, x: A.x0 - 10, y: y + (h - 6) / 2, at: "right", color: it.swatch === false ? undefined : it.color, icon: it.icon, t: it.t, sub: it.sub, strong: it.strong, alpha: it.alpha });
			if (it.num) L.push({ id: `n:${it.id}`, x: A.x1, y: y + (h - 6) / 2, t: it.num, k: "num", ax: 1, ay: 0.5, size: 24, color: deepen(it.color, 0.15), alpha: it.alpha });
			place({ id: it.id, n: it.n, k: it.k, x: A.x0, y: y + h, cols: Math.ceil(it.n / rows), rows, s, alpha: it.alpha ?? 1, color: it.color, order: "col" }, base);
			out.push({ it, y, h: h + rows * s });
			base += it.n;
			y += h + rows * s + gap;
		}
		return out;
	}

	// Private reviews: one model's result on the reviews, as a wall of tiles; the lit share large on the lit tiles
	function drawReviews(A: Box, narrow: boolean) {
		const m = FAB;
		const top = header(A, { title: U["title.reviews"], icon: "incognito", unit: U["unit.reviews"] });
		const W = A.x1 - A.x0, f = fit(S.reviews.tiles, W, A.y1 - top, 44); // a few hundred reviews: larger tiles, so the share fits on them
		const gw = f.cols * f.s, gh = f.rows * f.s, gx = A.x0 + (W - gw) / 2, gy = top + Math.max(0, (A.y1 - top - gh) / 2), bottom = gy + gh;
		place({ id: "reviews", n: S.reviews.tiles, k: m.lit, x: gx, y: gy, cols: f.cols, rows: f.rows, s: f.s, alpha: 1, color: hue(m), order: "up" }, 0);
		const litH = (m.lit / f.cols) * f.s, cx = gx + gw / 2, np = Math.round(Math.min(narrow ? 72 : 128, gw / (narrow ? 5.2 : 7)));
		const k = fill(U["key.correct"], { model: m.short });
		const knock = f.s * 0.9 >= 14 && litH >= np + STRONG_H + 40;
		if (knock) {
			// knocked out of the lit tiles, its key under it
			const cy = bottom - litH / 2 - (8 + STRONG_H) / 2;
			L.push({ id: "reviews:num", x: cx, y: cy, t: pct(m.pct), k: "knock", ax: 0.5, ay: 0.5, size: np });
			G.tags.push({ id: "reviews:lit", x: cx, y: cy + np / 2 + 8 + STRONG_H / 2, at: "center", color: hue(m), t: k, strong: true });
		} else {
			// too few lit tiles to hold it, or plain squares with the ground between them: just above the lit tiles, in
			// the model's colour (full size where the pale tiles leave room)
			const ey = bottom - Math.ceil(m.lit / f.cols) * f.s - 10, big = gh - litH >= np + STRONG_H + 90;
			G.tags.push({ id: "reviews:lit", x: cx, y: ey - STRONG_H / 2, at: "center", color: hue(m), t: k, strong: true });
			L.push({ id: "reviews:num", x: cx, y: ey - STRONG_H - 6, t: pct(m.pct), k: "num", ax: 0.5, ay: 1, size: Math.round(np * (big ? 1 : 0.6)), color: deepen(hue(m), 0.15) });
		}
		const uy = gy + (gh - litH) / 2;
		if (uy - gy > TAG_H) G.tags.push({ id: "reviews:unlit", x: cx, y: knock ? uy : gy + (gh - litH) * 0.25, at: "center", color: UNLIT, t: U["key.wrong"] });
	}

	// the five models on the same reviews: five columns on one baseline, each share above its column
	function drawModels(A: Box, narrow: boolean) {
		const top = header(A, { title: U["title.reviews"], icon: "incognito", keys: "wrong", unit: U["unit.reviews"] });
		const n = S.models.length, N = S.reviews.tiles;
		if (narrow) {
			bars(A, top, S.models.map((m, i) => ({ id: i === 0 ? "reviews" : `m:${m.id}`, n: N, k: m.lit, color: hue(m), t: m.short, strong: i === 0, num: pct(m.pct) })), 6);
			return;
		}
		const W = A.x1 - A.x0, gap = Math.round(Math.max(20, W * 0.028)), cw = (W - gap * (n - 1)) / n;
		const np = Math.round(Math.min(60, cw / 3.4)), NUM = np + 12, NAME = STRONG_H + 12;
		const f = fit(N, cw, A.y1 - top - NUM - NAME, 12);
		const ch = f.rows * f.s, y = A.y1 - NAME - ch;
		S.models.forEach((m, i) => {
			const x = A.x0 + i * (cw + gap);
			place({ id: i === 0 ? "reviews" : `m:${m.id}`, n: N, k: m.lit, x, y, cols: f.cols, rows: f.rows, s: f.s, alpha: 1, color: hue(m), order: "up" }, i * N);
			L.push({ id: `n:${m.id}`, x, y: y - 10, t: pct(m.pct), k: "num", ax: 0, ay: 1, size: np, color: deepen(hue(m), 0.15) });
			G.tags.push({ id: `m:${m.id}`, x: x - 10, y: y + ch + 10 + (i === 0 ? STRONG_H : TAG_H) / 2, at: "right", color: hue(m), t: m.short, strong: i === 0 });
		});
	}

	// Figure 1's other sets of writers: a skyline of blocks on one baseline, each share above its block
	function drawDomains(A: Box, narrow: boolean) {
		const top = header(A, { keys: "all", unit: U["unit.text"] });
		if (narrow) {
			bars(A, top, S.domains.map((d) => ({ id: `d:${d.id}`, n: d.n, k: d.k, color: hue(FAB), t: d.label.t, sub: d.sub?.t, icon: ICON[d.id], swatch: false, num: pct(d.pct) })));
		} else {
			const W = A.x1 - A.x0, gap = 40, np = 44, NUM = np + 12;
			const lw = (d: Dom) => Math.max(tagW(d.label.t, { swatch: false, icon: true }), d.sub ? tw(d.sub.t, 11.5, 500) + 16 : 0, tw(pct(d.pct), np, 600));
			const lab = (d: Dom) => 10 + tagH(false, !!d.sub);
			type P = { d: Dom; x: number; y: number; cols: number; rows: number; s: number; w: number; base: number };
			let placed: P[] = [];
			search: for (const rows of [[S.domains.map((d) => d.id)], ...LAYOUTS])
				for (let s = 30; s >= 4; s -= 0.5) {
					const out: P[] = [];
					let y = top, ok = true;
					for (const row of rows) {
						const ds = row.map(dom), cols = ds.map((d) => Math.ceil(Math.sqrt(d.n)));
						const ws = ds.map((d, i) => Math.max(cols[i] * s, lw(d)));
						const tot = ws.reduce((a, v) => a + v, 0) + gap * (row.length - 1);
						if (tot > W) { ok = false; break; }
						const base = y + NUM + Math.max(...ds.map((d, i) => Math.ceil(d.n / cols[i]) * s));
						let x = A.x0 + (W - tot) / 2;
						ds.forEach((d, i) => { const r = Math.ceil(d.n / cols[i]); out.push({ d, x, y: base - r * s, cols: cols[i], rows: r, s, w: ws[i], base }); x += ws[i] + gap; });
						y = base + Math.max(...ds.map(lab)) + 16;
					}
					if (ok && y - 16 <= A.y1) {
						const dy = (A.y1 - (y - 16)) / 2; // centred in the room left
						placed = out.map((p) => ({ ...p, y: p.y + dy, base: p.base + dy }));
						break search;
					}
				}
			let base = 0;
			for (const d of S.domains) {
				const p = placed.find((q) => q.d.id === d.id)!;
				place({ id: `d:${d.id}`, n: d.n, k: d.k, x: p.x, y: p.y, cols: p.cols, rows: p.rows, s: p.s, alpha: 1, color: hue(FAB), order: "up" }, base);
				base += d.n;
				L.push({ id: `n:${d.id}`, x: p.x, y: p.y - 10, t: pct(d.pct), k: "num", ax: 0, ay: 1, size: np, color: FABLE.strong });
				G.tags.push({ id: `d:${d.id}`, x: p.x - 10, y: p.base + 10 + tagH(false, !!d.sub) / 2, at: "right", icon: ICON[d.id], t: d.label.t, sub: d.sub?.t });
			}
		}
	}

	// stated confidence: the two groups of answers side by side on one baseline, the confident group's share above it
	function drawConfidence(A: Box, narrow: boolean) {
		const C = S.confidence, [Lo, Hi] = C.groups as [(typeof C.groups)[0], (typeof C.groups)[1] & { says: { t: string }; share: number; pct: number }];
		const top = header(A, { keys: "all", unit: U["unit.answer"] });
		const share = fill(U["conf.share"], { share: Hi.share });
		if (narrow) {
			bars(A, top, [
				{ id: "c:lo", n: Lo.n, k: Lo.k, color: hue(FAB), t: Lo.label.t, swatch: false },
				{ id: "c:hi", n: Hi.n, k: Hi.k, color: hue(FAB), t: Hi.label.t, sub: share, swatch: false, strong: true, num: pct(Hi.pct) },
			], 9);
			return;
		}
		const W = A.x1 - A.x0, gap = 48, np = 60, NUM = np + 12, LAB = 10 + tagH(true, true);
		const H = A.y1 - top - NUM - LAB;
		let s = 18, rows = 1, ca = 1, cb = 1;
		for (; s > 2; s -= 0.25) { rows = Math.floor(H / s); ca = Math.ceil(Lo.n / rows); cb = Math.ceil(Hi.n / rows); if ((ca + cb) * s + gap <= W) break; }
		const ra = Math.ceil(Lo.n / ca), rb = Math.ceil(Hi.n / cb), tall = Math.max(ra, rb) * s;
		const x0 = A.x0 + (W - (ca + cb) * s - gap) / 2, xb = x0 + ca * s + gap;
		const base = top + NUM + tall + Math.max(0, (A.y1 - top - NUM - tall - LAB) / 2);
		place({ id: "c:lo", n: Lo.n, k: Lo.k, x: x0, y: base - ra * s, cols: ca, rows: ra, s, alpha: 1, color: hue(FAB), order: "up" }, 0);
		place({ id: "c:hi", n: Hi.n, k: Hi.k, x: xb, y: base - rb * s, cols: cb, rows: rb, s, alpha: 1, color: hue(FAB), order: "up" }, Lo.n);
		L.push({ id: "n:conf", x: xb, y: base - rb * s - 10, t: pct(Hi.pct), k: "num", ax: 0, ay: 1, size: np, color: FABLE.strong });
		G.tags.push({ id: "c:lo", x: x0 - 10, y: base + 10 + TAG_H / 2, at: "right", t: Lo.label.t });
		G.tags.push({ id: "c:hi", x: xb - 10, y: base + 10 + tagH(true, true) / 2, at: "right", t: Hi.label.t, sub: share, strong: true });
	}

	// build the current view's tiles, labels and tags once for these inputs
	function build(rs: DOMRect, narrow: boolean, k: string, top: number, h: number) {
		G = blank(k, rs.left, rs.top);
		L = [];
		used = new Set();
		const A: Box = { x0: rs.left, x1: rs.right, y0: rs.top + top, y1: rs.top + top + h };
		if (view === "reviews") drawReviews(A, narrow);
		else if (view === "models") drawModels(A, narrow);
		else if (view === "domains") drawDomains(A, narrow);
		else if (view === "confidence") drawConfidence(A, narrow);
		// the demo and the example draw no tiles: every tile settles back into the ground
		// blocks that left the view start from zero when they come back
		for (const id in anim) if (!used.has(id)) delete anim[id];
		geo = G;
		tags = G.tags;
		labels = L.map((l) => ({ ...l, x: l.x - rs.left, y: l.y - rs.top }));
	}

	// one frame of work; true while a lit count is still easing
	let padT = 0, padB = 0, gapY = 0;
	// the picture starts under the caption card as it is at each step (the card on top hugs its sentence, and each step
	// is its own view, so a view's tiles never move while it is shown): the card's height with each step's sentence,
	// measured when the card's size changes (a ResizeObserver, after layout), not every frame
	let rooms: number[] = [];
	const roomsOf = () => {
		const base = card.offsetHeight - says.offsetHeight; // the padding and the dashes
		return [...sizer.children].map((p) => base + (p as HTMLElement).offsetHeight);
	};
	function layout(dt: number) {
		const rs = stick.getBoundingClientRect();
		const narrow = rs.width < 700;
		if (!rooms.length) rooms = roomsOf();
		const top = padT + (rooms[step] ?? 0) + gapY;
		const h = Math.max(120, rs.height - padB - top);
		const k = `${view}|${rs.width | 0}x${h | 0}|${top | 0}`;
		if (!geo || geo.key !== k) build(rs, narrow, k, top, h);
		else if (geo.ox !== rs.left || geo.oy !== rs.top) shift(rs.left - geo.ox, rs.top - geo.oy);
		if (chart.marks !== geo!.marks) { chart.marks = geo!.marks; chart.paths = geo!.paths; chart.texts = []; }
		return tween(dt);
	}

	// frames run on demand: an input change kicks one, and an easing count asks for the next (in the page's loop,
	// loop.ts: after every section has read the scroll, before the canvas draws)
	let last = 0, alive = true;
	function kick() { if (stick && alive) requestFrame(frame); }
	function frame(now: number) {
		if (!alive) return;
		const dt = Math.min(0.05, (now - last) / 1000); last = now;
		// retake the canvas if a neighbour left it on the plain ground while this section is in view
		if (active && field.mode === "ground") { field.mode = "chart"; field.owner = OWNER; field.dim = 0.75; field.interactive = false; field.hover = null; }
		if (active && field.owner === OWNER && layout(dt)) kick();
	}
	// inputs: the view and its controls, the section coming into view, and the canvas changing hands
	$effect(() => { void [view, active, field.mode, field.owner]; kick(); });

	// --- scroll: the stage follows the scroll one beat at a time -------------------------------------------------
	// The scroll position names a beat (want). The shown beat walks to it one beat at a time and holds each at least
	// HOLD, so a fast scroll never skips a step and a slow one sees each step arrive where its stretch starts. Off
	// screen, or back on screen after being off (a jump), the stage takes the right beat at once. A dash click or a
	// footnote's ↩ shows its step at once and holds it while the page scrolls there (pin).
	let starts: number[] = [];
	let end = 0;
	let y = 0; // how far the track has scrolled, px
	let prog = $state(0); // 0 to 1 through the shown step's stretch (StepDashes fills the next dash with it)
	let shown = 0, want = 0, since = -1e9, away = true, pin = -1;
	let timer: ReturnType<typeof setTimeout> | undefined, pinT: ReturnType<typeof setTimeout> | undefined, endT: ReturnType<typeof setTimeout> | undefined;
	let moved = 0; // when the page last scrolled
	function measure() {
		const els = [...track.querySelectorAll<HTMLElement>(".step")];
		starts = els.map((e) => e.offsetTop);
		end = starts[LAST] + els[LAST].offsetHeight;
		const cs = getComputedStyle(stick);
		padT = parseFloat(cs.paddingTop) || 0; padB = parseFloat(cs.paddingBottom) || 0; gapY = parseFloat(cs.rowGap) || 0;
	}
	// the beat the scroll position names; true while the track is off screen
	function read() {
		const r = track.getBoundingClientRect();
		y = -r.top;
		let s = 0;
		for (let i = 1; i <= LAST; i++) if (y >= starts[i]) s = i;
		want = beatOf(s, (y - starts[s]) / ((s < LAST ? starts[s + 1] : end) - starts[s]));
		return r.bottom <= 0 || r.top >= (vp.h || innerHeight);
	}
	function fillDash() {
		const a = starts[step], b = step < LAST ? starts[step + 1] : end;
		const p = Math.round(Math.max(0, Math.min(1, (y - a) / (b - a))) * 1000) / 1000;
		if (p !== prog) prog = p;
	}
	function show(b: number) {
		shown = b; since = performance.now();
		const s = b <= 1 ? b : b - 1, an = b >= 2;
		if (s !== step) step = s;
		if (an !== ans) ans = an;
		fillDash();
		if (active) kick();
	}
	// one beat toward the goal once the shown one has had its time, then wait for the next
	function pump() {
		clearTimeout(timer); timer = undefined;
		const goal = pin >= 0 ? pin : want;
		if (shown === goal) return;
		const wait = since + HOLD - performance.now();
		if (wait > 0) { timer = setTimeout(pump, wait); return; }
		show(shown + Math.sign(goal - shown));
		if (shown !== goal) timer = setTimeout(pump, HOLD);
	}
	function unpin() { if (pin < 0) return; pin = -1; clearTimeout(pinT); pump(); }
	function hold(b: number) {
		pin = b; clearTimeout(pinT); pinT = setTimeout(unpin, 2500); clearTimeout(timer);
		if (b !== shown) show(b);
		if (want === b) unpin();
	}
	function onScroll() {
		moved = performance.now();
		// (the lighter mode for phones: the step follows the scroll directly; a momentum scroll is not held back)
		const off = read(), snap = off || away || still || lite.on;
		away = off;
		if (pin >= 0 && want === pin) { pin = -1; clearTimeout(pinT); }
		if (snap) { clearTimeout(timer); const goal = pin >= 0 ? pin : want; if (goal !== shown) show(goal); }
		else pump();
		fillDash();
		if (active) kick();
	}
	// a dash scrolls to the middle of its step (the dev route's ?step=N does the same), showing that step at once
	// links to a step (steplinks.ts): #{id}/<step>, and the address bar follows the step in view
	onMount(() => registerSteps(S.id, STEPS.map((s) => s.view), (i, instant) => go(i, instant)));
	$effect(() => stepShown(S.id, step));

	function go(i: number, instant = false) {
		const a = starts[i], b = i < LAST ? starts[i + 1] : end;
		hold(beatOf(i, LAND[i]));
		scrollTo({ top: track.getBoundingClientRect().top + scrollY + a + (b - a) * LAND[i], behavior: instant || reduce ? "instant" : "smooth" });
	}

	onMount(() => {
		still = new URLSearchParams(location.search).has("still");
		reduce = matchMedia("(prefers-reduced-motion: reduce)").matches || still;
		meter = document.createElement("canvas").getContext("2d");
		const stopWarm = warmTilesNear(root, "writer", 64, 14, 20); // the tiles' prints' ridges, traced ahead in idle moments
		last = performance.now();
		// (the steps are measured, and the step the scroll names shown, in the loop's first frame: away is true until
		// then, so that frame shows it at once)
		const release = () => {
			if (field.owner !== OWNER) return;
			if (field.mode === "chart") field.mode = "ground";
			field.dim = 0; field.interactive = false; chart.marks = []; chart.paths = []; chart.texts = [];
		};
		const io = new IntersectionObserver((es) => es.forEach((e) => {
			active = e.isIntersecting;
			if (active) { field.mode = "chart"; field.owner = OWNER; field.dim = 0.75; field.interactive = false; field.hover = null; }
			else release();
		}), { rootMargin: "-35% 0px -35% 0px" });
		io.observe(track);
		// scroll and resize, in the page's loop (loop.ts); a new viewport size measures the steps again first
		let vw = -1, vh = -1;
		const stopScroll = onPageScroll(() => {
			if (vp.w !== vw || vp.h !== vh) { vw = vp.w; vh = vp.h; measure(); kick(); }
			onScroll();
		});
		regions[OWNER] = track;
		// the card's height sets the picture's top
		const ro = new ResizeObserver(() => { rooms = roomsOf(); kick(); });
		for (const el of [band, card, says, sizer]) ro.observe(el);
		document.fonts?.ready.then(() => { geo = null; rooms = []; kick(); });
		// the page's footnote list renumbers every mark and sends its back link to "#fnref-<number>"; a mark here sits on
		// a pinned stage (wherever the stage is when the reader returns), so the back link goes to the step that shows
		// it instead: that step's anchor takes the id
		const back = () => {
			for (const a of root.querySelectorAll<HTMLAnchorElement>("sup.fnref a[data-n]")) {
				const g = /^#fn-(\d+)$/.exec(a.getAttribute("href") ?? "")?.[1];
				const at = track.querySelector<HTMLElement>(`.fnback[data-n="${a.dataset.n}"]`);
				if (g && at && at.id !== `fnref-${g}`) at.id = `fnref-${g}`;
			}
		};
		const fo = new MutationObserver(back);
		fo.observe(root, { subtree: true, attributes: true, attributeFilter: ["href"] });
		back();
		// a ↩ to one of those anchors: show its step at once and hold it while the page scrolls there (the link itself
		// does the scrolling)
		const onBack = (e: MouseEvent) => {
			const a = (e.target as HTMLElement)?.closest?.("a.back");
			const at = a ? document.getElementById(a.getAttribute("href")?.slice(1) ?? "") : null;
			if (!at?.classList.contains("fnback") || !track.contains(at)) return;
			const i = FN_STEP[Number(at.dataset.n)];
			if (i >= 0) hold(beatOf(i, LAND[i]));
		};
		document.addEventListener("click", onBack);
		// the page coming to rest lets a held step go (also when the reader's own scroll cut the jump short); a wheel
		// tick mid-jump ends its own scroll while the jump goes on, so only a page that has stopped moving counts
		const ended = () => { clearTimeout(endT); endT = setTimeout(() => { if (performance.now() - moved > 90) unpin(); }, 120); };
		addEventListener("scrollend", ended, { passive: true });
		return () => {
			alive = false; stopWarm();
			clearTimeout(timer); clearTimeout(pinT);
			io.disconnect(); ro.disconnect(); fo.disconnect();
			stopScroll();
			document.removeEventListener("click", onBack);
			removeEventListener("scrollend", ended); clearTimeout(endT);
			release(); if (field.owner === OWNER) field.owner = "";
		};
	});
</script>

<!-- a footnote mark: numbered for the whole page by FootnoteList; data-n ties it to its step's return anchor -->
{#snippet mark(n: number, copy = "")}<sup class="fnref"><a href="#fn-{S.id}-{n}" id={copy ? `wh-fn-${n}-${copy}` : `wh-fn-${n}`} data-n={copy ? undefined : n}>{n}</a></sup>{/snippet}
<!-- one of the demo's states, laid out once (its footnote marks are the real ones in the state that cites them; in the
     other layers they are look-alikes with no return anchor) -->
{#snippet demoLayer(st: DemoState)}
	{@const pr = st !== "review"}
	<div class="d-col" class:prompt={pr} class:cur={demoState === st} inert={demoState !== st} aria-hidden={demoState !== st}>
		<div class="d-prompt">
			<div class="fold top" class:open={pr}><div>
				<p class="d-head"><Icon name="list" />{D["prompt.head"]}</p>
				<p class="d-task">{#each S.prompt.task as seg}{#if seg.hl}<span class="hl">{seg.t}</span>{:else if seg.b}<b>{seg.t}</b>{:else}{seg.t}{/if}{/each}</p>
			</div></div>
			<article class="d-review">
				<p class="d-head"><Icon name="incognito" /><span class="d-rh">{D["review.head"]}</span><span class="d-sh">{D["prompt.slot"]}</span>{@render mark(FN.demo, st === "review" ? "" : st)}</p>
				<p class="d-par"><b>{D["review.k1"]}.</b> {D["review.t1"]}</p>
				<p class="d-par"><b>{D["review.k2"]}.</b> {D["review.t2"]}</p>
				<div class="fold" class:open={!pr}><div>
					<p class="d-par"><b>{D["review.k3"]}.</b> {D["review.t3"]}</p>
					<p class="d-who">{D["review.who"]} <span class="hl">{D["review.anon"]}</span></p>
				</div></div>
			</article>
			<div class="fold bot" class:open={pr}><div>
				<p class="d-fields">{#each S.prompt.fields as f}<span class:hl={f.hl}><b>{f.k}</b> &lt;{f.v}&gt;</span>{/each}</p>
			</div></div>
		</div>
		<div class="fold ans" class:open={st === "answer"}><div>
			<p class="d-arrow" aria-hidden="true"><Icon name="arrow" /></p>
			<div class="d-answer">
				<p class="d-head"><Icon name="ai" class="fable" />{D["answer.head"]}<span class="d-by">{FAB.name}</span></p>
				<p class="d-name"><b>{S.prompt.fields[1].k}</b> <span class="hl">{D["answer.name"]}</span>{@render mark(FN.placeholder, st === "answer" ? "" : st)}</p>
				<p class="d-ok"><Icon name="check" class="ok" />{D["answer.verdict"]}</p>
			</div>
		</div></div>
	</div>
{/snippet}

<section class="wh" class:still id={S.id} data-rq={S.rq} data-step={step} data-answer={ans ? 1 : 0} bind:this={root}>
	<SectionOpener n={S.n} title={S.title.t} takeaway={S.takeaway.t} context={S.context.t} accent={TEAL_L} prints={PRINTS} />

	<div class="track" bind:this={track} style="--len:{LEN}">
		<div class="stick" bind:this={stick}>
			<!-- the picture: the demo and the example are page text; the tiles are on the field behind, their words here -->
			<div class="area">
				<!-- the demo: the few words that carry the point are highlighted (.hl); the rest is quiet gray -->
				<div class="demo" class:on={demo} inert={!demo} aria-hidden={!demo}>
					{@render demoLayer("review")}{@render demoLayer("prompt")}{@render demoLayer("answer")}
				</div>

				<!-- the worked example: Fable 5.2's explanation first and largest; the story it explains and the answer beside it.
				     A reason and the words it describes share a colour; picking one lights only that pair -->
				<figure class="ex" class:on={view === "example"} inert={view !== "example"} aria-hidden={view !== "example"}>
					<div class="ex-grid">
						<div class="ex-why">
							<p class="ex-k"><Icon name="ai" class="fable" />{E.model}</p>
							<blockquote class="ex-x">“{#each E.explanation as seg}{#if seg.cue}<span role="button" tabindex="0" class="cue {seg.cue}" class:dim={!lit(seg.cue)} aria-pressed={cue === seg.cue} onclick={() => pick(seg.cue!)} onkeydown={(e) => key(e, seg.cue!)}>{seg.t}</span>{:else}{seg.t}{/if}{/each}”</blockquote>
							<p class="ex-note">{E.note.t}</p>
						</div>
						<div class="ex-side">
							<!-- the cue at the row's right end, the figure's top right (the highlights take a click or a tap, not a hover) -->
							<p class="ex-src"><Icon name="book" />{E.kind.t}: <em>{E.title.t}</em><HoverCue inline hover="Click a highlight" tap="Tap a highlight" show={!tried} style="margin-left:auto; margin-block:-4px" /></p>
							<blockquote class="ex-text">“{#each E.text as seg}{#if seg.cue}<span role="button" tabindex="0" class="cue {seg.cue}" class:dim={!lit(seg.cue)} aria-pressed={cue === seg.cue} onclick={() => pick(seg.cue!)} onkeydown={(e) => key(e, seg.cue!)}>{seg.t}</span>{:else}{seg.t}{/if}{/each}”</blockquote>
							<div class="ex-pred">
								<span class="ex-role">{U.role}</span>
								<span class="ex-ans"><Icon name="check" class="ok" />{E.answer}</span>
								<span class="ex-conf">{fill(U.conf, { n: E.confidence })}</span>
							</div>
						</div>
					</div>
				</figure>
			</div>

			{#if active && tiles}
				<div class="labs" aria-hidden="true">
					{#each labels as l (l.id)}
						<span class="lab {l.k}" style:left="{l.x}px" style:top="{l.y}px" style:transform="translate({-l.ax * 100}%, {-l.ay * 100}%)" style:font-size={l.size ? `${l.size}px` : undefined} style:color={l.color} style:opacity={l.alpha ?? 1} transition:fade={{ duration: reduce ? 0 : 220 }}>{#if l.icon}<Icon name={l.icon} />{/if}{l.t}</span>
					{/each}
				</div>
			{/if}

			<!-- the caption band, on top of the stage (its grid row; it stays last here so the tab order is unchanged): the
			     narration card, its step dashes on top -->
			<div class="band" bind:this={band}>
				<div class="card" bind:this={card}>
					<StepDashes count={STEPS.length} current={step} {go} progress={prog} />
					<div class="says" bind:this={says}>
						<!-- every sentence stays mounted (only the current one shown), so its footnote marks keep their page numbers -->
						<div aria-live="polite">
							{#each STEPS as s, i}
								<p class="say" hidden={i !== step}>{#if s.head}<b>{s.head.t}</b>{" "}{/if}{#each parts(s) as pt}{#if pt.fn}{@render mark(pt.fn)}{:else}{pt.t}{/if}{/each}</p>
							{/each}
						</div>
						<!-- every sentence in one cell, unseen: each one's height sets the room its step's picture leaves for
						     the card (read when the card resizes, not every frame) -->
						<div class="sizer" aria-hidden="true" bind:this={sizer}>
							{#each STEPS as s}<p class="say">{#if s.head}<b>{s.head.t}</b>{" "}{/if}{#each parts(s) as pt}{#if pt.fn}<sup class="fnref">{pt.fn}</sup>{:else}{pt.t}{/if}{/each}</p>{/each}
						</div>
					</div>
				</div>
			</div>
		</div>
		{#if active}<Tags items={tags} />{/if}
		<!-- the scroll track's steps (layout only); each footnote's back link returns to the step that shows its mark -->
		<div class="steps" aria-hidden="true">
			{#each VH as h, i}
				<div class="step" style:height="calc({h} * var(--vh, 1vh))">
					{#each NOTES.filter((f) => FN_STEP[f.n] === i) as f}<span class="fnback" data-n={f.n} style:top="{LAND[i] * 100}%"></span>{/each}
				</div>
			{/each}
		</div>
	</div>

	<Footnotes id={S.id} notes={NOTES} />
</section>

<style>
	.wh { position: relative; }
	.track { position: relative; height: calc((var(--len) + 100) * var(--vh, 1vh)); }
	/* the caption band on top (76px down, as section 4's card), the picture under it. Above the tags' layer (Tags.svelte,
	   z-index 3; the stage itself is see-through), so a tag still sliding from its last place never shows over the card
	   as the card grows at a step change */
	.stick { position: sticky; top: 0; z-index: 4; height: calc(100 * var(--vh, 1vh)); display: grid; grid-template-rows: auto minmax(0, 1fr); gap: 18px; padding: 76px 0 22px; pointer-events: none; }
	.area { grid-row: 2; position: relative; min-height: 0; }
	.steps { position: absolute; inset: 0 0 auto; pointer-events: none; }
	.step { position: relative; }
	.fnback { position: absolute; left: 0; width: 1px; height: 1px; }

	/* words on the tiles (titles, units, shares): Inter, the mock's sizes */
	.labs { position: absolute; inset: 0; pointer-events: none; z-index: 2; }
	.lab { position: absolute; display: inline-flex; align-items: center; gap: 7px; white-space: nowrap; transition: opacity .3s; }
	.lab.cap { font-size: 12px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--ink2); }
	.lab.cap :global(svg) { width: 13px; height: 13px; color: var(--ink); }
	.lab.unit { font-size: 12.5px; color: var(--ink2); }
	.lab.num { line-height: .9; font-weight: 600; letter-spacing: -0.045em; font-variant-numeric: tabular-nums; }
	.lab.knock { line-height: .9; font-weight: 600; letter-spacing: -0.05em; color: #fff; font-variant-numeric: tabular-nums; text-shadow: 0 0 1px rgba(20, 32, 45, .55), 0 1px 4px rgba(20, 32, 45, .4), 0 2px 22px rgba(20, 32, 45, .3); }

	/* the caption band */
	.band { grid-row: 1; align-self: start; pointer-events: auto; position: relative; z-index: 2; display: grid; justify-self: center; width: min(100%, 760px); }
	.card { display: grid; gap: 8px; padding: 14px 18px 16px; background: #fff; border-radius: 3px; box-shadow: 0 2px 14px rgba(20, 32, 45, .06); }
	.says { position: relative; }
	.say { font-size: 19px; line-height: 1.5; letter-spacing: -0.008em; color: var(--ink); text-wrap: pretty; animation: say .45s var(--ease); }
	.say b { font-weight: 600; }
	/* (each sentence at its own height, start-aligned in the shared cell, so its step's room reads true) */
	.sizer { position: absolute; inset: 0 0 auto; display: grid; align-items: start; visibility: hidden; pointer-events: none; }
	.sizer .say { grid-area: 1 / 1; animation: none; }
	@keyframes say { from { opacity: 0; transform: translateY(6px); } }

	/* highlighted words (the point) against quiet gray (the rest) */
	.hl { color: var(--ink); font-weight: 600; background: color-mix(in srgb, var(--ink) 8%, transparent); padding: 0 .16em; margin: 0 -.04em; border-radius: 2px; box-decoration-break: clone; -webkit-box-decoration-break: clone; }

	/* folding rows: a row opens or closes in place, so the column re-centres as it changes */
	.fold { display: grid; grid-template-rows: 0fr; opacity: 0; }
	.fold > div { overflow: hidden; min-height: 0; }
	.fold.open { grid-template-rows: 1fr; opacity: 1; }

	/* the demo: the review alone, then the prompt closing around it, then the answer */
	/* contain: the demo's rows fold and its type eases between sizes over .6s, which lays it out every frame; as a layout
	   root (it is absolute and fills the area, so its size never depends on its content) only it is laid out, not the page */
	.demo, .ex { position: absolute; inset: 0; display: grid; place-items: center; opacity: 0; visibility: hidden; transition: opacity .4s, visibility 0s .4s; contain: layout size; }
	.demo.on, .ex.on { opacity: 1; visibility: visible; pointer-events: auto; transition: opacity .4s; }
	/* the three states share one place in the area and cross-fade (opacity only: nothing is laid out as they change) */
	.d-col { grid-area: 1 / 1; width: min(100%, 46rem); display: grid; opacity: 0; transition: opacity .5s var(--ease); }
	.d-col.cur { opacity: 1; }
	.d-prompt { display: grid; padding: 0; background: transparent; border: 1px solid transparent; border-radius: 3px; }
	.prompt .d-prompt { padding: 16px 18px; background: var(--field); border-color: var(--rule); }
	.d-head { display: flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--ink2); }
	.d-head :global(.fable) { color: var(--fable); }
	.d-head sup { letter-spacing: 0; color: var(--ink); }
	.fold.top > div { display: grid; gap: 10px; padding-bottom: 12px; }
	.d-task { font-size: 16px; line-height: 1.55; color: var(--gray); }
	.d-task b, .d-fields b, .d-par b { font-weight: 600; }
	.d-review { display: grid; gap: 10px; padding: 20px 22px; background: #fff; border-radius: 3px; }
	.prompt .d-review { gap: 4px; padding: 10px 12px; box-shadow: 0 1px 0 var(--rule); }
	.d-sh { display: none; }
	.prompt .d-rh { display: none; }
	.prompt .d-sh { display: inline; }
	.d-par { font-size: 22px; line-height: 1.5; letter-spacing: -0.006em; color: var(--gray); }
	.prompt .d-par { font-size: 14px; line-height: 1.45; letter-spacing: 0; }
	.d-review .fold > div { display: grid; gap: 10px; }
	.d-who { padding-top: 12px; border-top: 1px solid var(--rule); font-size: 16px; color: var(--gray); }
	.fold.bot > div { padding-top: 12px; }
	.d-fields { display: flex; flex-wrap: wrap; gap: 2px 14px; font-size: 13.5px; color: var(--gray); }
	.d-fields span { white-space: nowrap; }
	.fold.ans > div { padding-bottom: 2px; } /* the card's bottom border, clear of the fold's clip */
	.d-arrow { display: grid; place-items: center; padding: 8px 0; font-size: 16px; color: var(--ink2); }
	.d-arrow :global(svg) { transform: rotate(90deg); }
	.d-answer { display: grid; gap: 10px; padding: 16px 18px; background: var(--field); border: 1px solid var(--rule); border-radius: 3px; }
	.d-by { margin-left: auto; font-size: 13px; font-weight: 500; letter-spacing: 0; text-transform: none; color: var(--ink2); }
	.d-name { font-size: 20px; line-height: 1.3; }
	.d-name b { font-weight: 600; }
	.d-ok { display: inline-flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 500; color: var(--ink2); }
	.d-ok :global(.ok), .ex-ans :global(.ok) { color: var(--ok); }

	/* the worked example: the explanation large on the left, the story in a card and the answer on the right */
	.ex { margin: 0; }
	.ex-grid { width: 100%; max-height: 100%; overflow: auto; display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr); align-items: center; gap: 56px; }
	.ex-why, .ex-side { display: grid; gap: 14px; align-content: center; }
	.ex-k { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; color: var(--ink); }
	.ex-k :global(.fable) { color: var(--fable); }
	.ex-x { font-size: clamp(22px, 2.1vw, 29px); line-height: 1.45; letter-spacing: -0.014em; color: var(--ink); text-wrap: pretty; }
	.ex-note { font-size: 13px; line-height: 1.5; color: var(--ink2); }
	.ex-src { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--ink2); }
	.ex-text { padding: 16px 18px; background: #fff; border-radius: 3px; font-size: 16px; line-height: 1.6; color: var(--ink); }
	.ex-pred { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 14px; padding-top: 4px; }
	.ex-role { width: 100%; font-size: 12px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--ink2); }
	/* plain inline text, so the name and "Confidence 93%" share a baseline (the icon sits in the text) */
	.ex-ans { font-size: 24px; font-weight: 600; letter-spacing: -0.02em; color: var(--ink); }
	.ex-ans :global(.ok) { margin-right: 8px; vertical-align: -0.1em; }
	.ex-conf { font-size: 14px; color: var(--ink2); font-variant-numeric: tabular-nums; }
	.cue { cursor: pointer; padding: 0 .12em; margin: 0 -.02em; border-radius: 2px; box-decoration-break: clone; -webkit-box-decoration-break: clone; transition: background-color .25s, color .25s, opacity .25s; }
	/* each reason's colour also has its own underline (solid, dashed, dotted), so a reason and its words still pair up
	   without colour (grayscale) */
	.cue { text-decoration-line: underline; text-decoration-thickness: 1.5px; text-underline-offset: .2em; }
	.cue.rose { color: var(--cue-rose); background: var(--cue-rose-bg); text-decoration-style: solid; }
	.cue.teal { color: var(--cue-teal); background: var(--cue-teal-bg); text-decoration-style: dashed; }
	.cue.clay { color: var(--cue-clay); background: var(--cue-clay-bg); text-decoration-style: dotted; text-decoration-thickness: 2px; }
	.cue[aria-pressed="true"] { text-decoration-thickness: 2.5px; }
	.cue.dim { background: transparent; color: var(--ink); opacity: .55; text-decoration-color: transparent; }

	@media (min-width: 701px) and (max-height: 780px) {
		.stick { gap: 12px; }
		.say { font-size: 17px; }
		.d-par { font-size: 18px; }
		.ex-x { font-size: 21px; }
	}
	@media (max-width: 700px) {
		.stick { padding: 60px 0 12px; gap: 12px; }
		.card { padding: 12px 14px 14px; gap: 6px; }
		.say { font-size: 15px; line-height: 1.45; }
		.d-review { padding: 14px 16px; gap: 8px; }
		.d-par { font-size: 15.5px; line-height: 1.5; }
		.prompt .d-par { font-size: 12.5px; }
		.prompt .d-prompt { padding: 12px 14px; }
		.d-task { font-size: 13.5px; }
		.d-who { font-size: 14px; }
		.fold.top > div { gap: 8px; padding-bottom: 10px; }
		.fold.bot > div { padding-top: 10px; }
		.d-fields { font-size: 12px; }
		.d-arrow { padding: 6px 0; }
		.d-answer { padding: 12px 14px; gap: 8px; }
		.d-name { font-size: 17px; }
		.ex-grid { grid-template-columns: 1fr; gap: 18px; align-content: center; }
		.ex-why, .ex-side { gap: 10px; }
		.ex-x { font-size: 17.5px; }
		.ex-text { padding: 12px 14px; font-size: 14px; }
		.ex-ans { font-size: 20px; }
	}
	@media (prefers-reduced-motion: reduce) {
		.d-col, .demo, .ex, .lab, .cue { transition: none; }
		.say { animation: none; }
	}
	.still :is(.d-col, .demo, .ex, .lab) { transition: none; }
	.still .say { animation: none; }
</style>
