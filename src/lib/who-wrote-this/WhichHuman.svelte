<script lang="ts">
	// If human, which human? Section 3, in the blocking of the section 1 mock (HumanOrAIB.svelte):
	//   1. the chapter opener (SectionOpener): the question, the takeaway, a crowd of writers' prints with one lit;
	//   2. a pinned stage with a caption band at its foot (the narration card, its step dashes on top). The picture
	//      above the band changes composition by step:
	//        - the demo, a centred column: an illustrative review, then the paper's prompt closing around it, then the
	//          model's answer, whose name is a row of soft blank blocks (never a name);
	//        - the ICML 2020 reviews as a full-width wall of tiles (1 tile = 10 reviews), the lit share large on it;
	//        - the five models as five columns on one baseline, their shares above them;
	//        - Figure 1's other sets of writers as a skyline of blocks (1 tile = 1 text);
	//        - stated confidence as two blocks side by side (1 tile = 1 answer);
	//        - the paper's Oates example, set large and centred like a manuscript;
	//      then Explore (Reveal) under the card on the last step;
	//   3. footnotes (Footnotes): the demo's provenance, the withheld name, the aggregate-only sentence.
	// Tiles are drawn on the page's field and stand for the paper's aggregate counts only, never individual texts,
	// reviewers or per-review results. Lit tiles fill from the bottom (from the left on a phone) in the colour of the
	// model whose result they show; every colour is named on the picture with Tags. The step comes from the scroll
	// position (a passive listener), so no step is skipped; each step has a screen or more of scroll. Strings and
	// numbers come from rq3.json, built in the private llm-detectors repo by docs/launch_20261116/tools/build_rq3_data.py.
	import { onMount } from "svelte";
	import { fade } from "svelte/transition";
	import Icon from "./Icon.svelte";
	import Reveal from "./Reveal.svelte";
	import Tags, { type Tag } from "./Tags.svelte";
	import SectionOpener from "./SectionOpener.svelte";
	import StepDashes from "./StepDashes.svelte";
	import Footnotes from "./Footnotes.svelte";
	import { field, chart, type Mark, type Path } from "./field.svelte";
	import { FABLE, GRAY, INK as TONE, modelColor, deepen, TILE } from "./palette";
	import S from "./rq3.json";
	import { printSprite, printAspect } from "./print/sprites";

	type View = "review" | "prompt" | "icml" | "models" | "domains" | "confidence" | "example";
	type XView = "example" | "icml" | "domains" | "confidence";
	type Model = (typeof S.models)[number];
	type Dom = (typeof S.domains)[number];
	type Order = "up" | "col"; // lit first: from the bottom row up, or column by column from the left
	type Block = { id: string; n: number; k: number; x: number; y: number; cols: number; rows: number; s: number; alpha: number; color: string; order: Order };
	type Hit = { id: string; x: number; y: number; w: number; h: number };
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
	// scroll per step, in vh: a screen or more each; the demo's prompt step (the prompt closes around the review, then
	// the answer arrives) and the last step (Explore opens) get more
	const VH = [110, 180, 100, 100, 100, 100, 110];
	const LEN = VH.reduce((a, v) => a + v, 0);
	const ANSWER_AT = 0.5; // share of the prompt step scrolled before the answer arrives (90vh of the prompt alone)
	const LAND = [0.5, 0.75, 0.5, 0.5, 0.5, 0.5, 0.4]; // where a dash click lands in its step
	const XVIEWS: XView[] = ["example", "icml", "domains", "confidence"];
	// Explore's sentence for each view (on the ICML wall any model can be shown, so the card carries the model sentence)
	const XSAY: Record<XView, View> = { example: "example", icml: "models", domains: "domains", confidence: "confidence" };
	const LAYOUTS = [[["famous", "nature", "papers"], ["active", "inactive"]], [["famous", "nature"], ["papers", "inactive"], ["active"]]];
	const ICON: Record<string, string> = { famous: "book", nature: "nature", papers: "arxiv", active: "reddit", inactive: "reddit" };
	const U: Record<string, string> = Object.fromEntries(S.ui.map((u) => [u.id, u.t]));
	const D: Record<string, string> = Object.fromEntries(S.demo.map((u) => [u.id, u.t]));
	const NOTES = S.notes.map((f, i) => ({ n: i + 1, t: f.t }));
	const FN: Record<string, number> = Object.fromEntries(S.notes.map((f, i) => [f.id, i + 1]));
	// each footnote's return point: the step that marks it
	const FN_STEP: Record<number, number> = { [FN.demo]: 0, [FN.withheld]: 1, [FN.privacy]: 2 };
	const fill = (t: string, v: Record<string, string | number>) => t.replace(/\{(\w+)\}/g, (_, k) => String(v[k]));
	const pct = (p: number) => fill(U.pct, { pct: Math.round(p) }); // whole percents
	const dom = (id: string) => S.domains.find((d) => d.id === id)!;
	const hue = (m: Model) => modelColor(m.short);
	const FAB = S.models[0];
	const E = S.example;

	let step = $state(0);
	let ans = $state(false); // the demo's answer is in
	let active = $state(false);
	let xview = $state<XView | null>(null); // Explore: the view the reader picked after the guided steps
	let xmodel = $state("fable52");
	let dsel = $state<string | null>(null);
	let dpeek = $state<string | null>(null);
	let open = $state(false);
	let cue = $state<string | null>(null);
	let hits = $state<Hit[]>([]);
	let tags = $state<Tag[]>([]);
	let labels = $state<Lab[]>([]);
	let still = $state(false);
	let root: HTMLElement, track: HTMLElement, stick: HTMLElement, band: HTMLElement, card: HTMLElement, says: HTMLElement, sizer: HTMLElement;

	const explore = $derived(step >= LAST);
	const view = $derived<View>((explore && xview) || (STEPS[step].view as View));
	const sayAt = $derived(explore && xview ? STEPS.findIndex((s) => s.view === XSAY[xview!]) : step);
	const demo = $derived(view === "review" || view === "prompt");
	const tiles = $derived(view !== "review" && view !== "prompt" && view !== "example");
	const focusD = $derived(dpeek ?? dsel);
	const lit = (c: string) => open && (cue === null || cue === c);
	const pick = (c: string) => { if (open) cue = cue === c ? null : c; };
	const key = (e: KeyboardEvent, c: string) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(c); } };
	const choose = (x: XView) => { xview = x === "example" ? null : x; dsel = null; dpeek = null; };
	function reset() { xview = null; xmodel = "fable52"; dsel = null; dpeek = null; open = false; cue = null; }
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
		m.sprite = printSprite({ family: "writer", index: wi, color: on ? deepen(ink, TILE.inkDepth) : ink, px, clarity: 1 });
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
				...(pr ? { sprite: printSprite({ family: "writer", index: wi, color: lt ? deepen(ink, TILE.inkDepth) : ink, px, clarity: 1 }), spriteKey: `w${wi}|${ink}|${px}|${lt ? 1 : 0}`, aspect: ASPECT, backing: lt ? TILE.litBacking : TILE.unlitBacking } : {}),
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

	// ICML 2020: one model's result on the reviews, as a wall of tiles; the lit share large on the lit tiles
	function drawIcml(A: Box, narrow: boolean) {
		const m = S.models.find((q) => q.id === (explore ? xmodel : "fable52"))!;
		const top = header(A, { title: U["title.icml"], icon: "icml", unit: U["unit.icml"] });
		const W = A.x1 - A.x0, f = fit(S.icml.tiles, W, A.y1 - top, 22);
		const gw = f.cols * f.s, gh = f.rows * f.s, gx = A.x0 + (W - gw) / 2, gy = top + Math.max(0, (A.y1 - top - gh) / 2), bottom = gy + gh;
		place({ id: "icml", n: S.icml.tiles, k: m.lit, x: gx, y: gy, cols: f.cols, rows: f.rows, s: f.s, alpha: 1, color: hue(m), order: "up" }, 0);
		const litH = (m.lit / f.cols) * f.s, cx = gx + gw / 2, np = Math.round(Math.min(narrow ? 72 : 128, gw / (narrow ? 5.2 : 7)));
		const k = fill(U["key.correct"], { model: m.short });
		const knock = f.s * 0.9 >= 14 && litH >= np + STRONG_H + 40;
		if (knock) {
			// knocked out of the lit tiles, its key under it
			const cy = bottom - litH / 2 - (8 + STRONG_H) / 2;
			L.push({ id: "icml:num", x: cx, y: cy, t: pct(m.pct), k: "knock", ax: 0.5, ay: 0.5, size: np });
			G.tags.push({ id: "icml:lit", x: cx, y: cy + np / 2 + 8 + STRONG_H / 2, at: "center", color: hue(m), t: k, strong: true });
		} else {
			// too few lit tiles to hold it, or plain squares with the ground between them: just above the lit tiles, in
			// the model's colour (full size where the pale tiles leave room)
			const ey = bottom - Math.ceil(m.lit / f.cols) * f.s - 10, big = gh - litH >= np + STRONG_H + 90;
			G.tags.push({ id: "icml:lit", x: cx, y: ey - STRONG_H / 2, at: "center", color: hue(m), t: k, strong: true });
			L.push({ id: "icml:num", x: cx, y: ey - STRONG_H - 6, t: pct(m.pct), k: "num", ax: 0.5, ay: 1, size: Math.round(np * (big ? 1 : 0.6)), color: deepen(hue(m), 0.15) });
		}
		const uy = gy + (gh - litH) / 2;
		if (uy - gy > TAG_H) G.tags.push({ id: "icml:unlit", x: cx, y: knock ? uy : gy + (gh - litH) * 0.25, at: "center", color: UNLIT, t: U["key.wrong"] });
	}

	// the five models on the same reviews: five columns on one baseline, each share above its column
	function drawModels(A: Box, narrow: boolean) {
		const top = header(A, { title: U["title.icml"], icon: "icml", keys: "wrong", unit: U["unit.icml"] });
		const n = S.models.length, N = S.icml.tiles;
		if (narrow) {
			bars(A, top, S.models.map((m, i) => ({ id: i === 0 ? "icml" : `m:${m.id}`, n: N, k: m.lit, color: hue(m), t: m.short, strong: i === 0, num: pct(m.pct) })), 6);
			return;
		}
		const W = A.x1 - A.x0, gap = Math.round(Math.max(20, W * 0.028)), cw = (W - gap * (n - 1)) / n;
		const np = Math.round(Math.min(60, cw / 3.4)), NUM = np + 12, NAME = STRONG_H + 12;
		const f = fit(N, cw, A.y1 - top - NUM - NAME, 12);
		const ch = f.rows * f.s, y = A.y1 - NAME - ch;
		S.models.forEach((m, i) => {
			const x = A.x0 + i * (cw + gap);
			place({ id: i === 0 ? "icml" : `m:${m.id}`, n: N, k: m.lit, x, y, cols: f.cols, rows: f.rows, s: f.s, alpha: 1, color: hue(m), order: "up" }, i * N);
			L.push({ id: `n:${m.id}`, x, y: y - 10, t: pct(m.pct), k: "num", ax: 0, ay: 1, size: np, color: deepen(hue(m), 0.15) });
			G.tags.push({ id: `m:${m.id}`, x: x - 10, y: y + ch + 10 + (i === 0 ? STRONG_H : TAG_H) / 2, at: "right", color: hue(m), t: m.short, strong: i === 0 });
		});
	}

	// Figure 1's other sets of writers: a skyline of blocks on one baseline, each share above its block
	function drawDomains(A: Box, rs: DOMRect, narrow: boolean) {
		const top = header(A, { keys: "all", unit: U["unit.text"] });
		const nh: Hit[] = [];
		const on = (d: Dom) => !focusD || focusD === d.id;
		if (narrow) {
			const rows = bars(A, top, S.domains.map((d) => ({ id: `d:${d.id}`, n: d.n, k: d.k, color: hue(FAB), t: d.label.t, sub: d.sub?.t, icon: ICON[d.id], swatch: false, num: pct(d.pct), alpha: on(d) ? 1 : 0.2 })));
			rows.forEach(({ it, y, h }, i) => nh.push({ id: S.domains[i].id, x: A.x0 - rs.left - 4, y: y - rs.top - 4, w: A.x1 - A.x0 + 8, h: h + 8 }));
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
				const p = placed.find((q) => q.d.id === d.id)!, a = on(d) ? 1 : 0.2;
				place({ id: `d:${d.id}`, n: d.n, k: d.k, x: p.x, y: p.y, cols: p.cols, rows: p.rows, s: p.s, alpha: a, color: hue(FAB), order: "up" }, base);
				base += d.n;
				L.push({ id: `n:${d.id}`, x: p.x, y: p.y - 10, t: pct(d.pct), k: "num", ax: 0, ay: 1, size: np, color: FABLE.strong, alpha: on(d) ? 1 : 0.3 });
				G.tags.push({ id: `d:${d.id}`, x: p.x - 10, y: p.base + 10 + tagH(false, !!d.sub) / 2, at: "right", icon: ICON[d.id], t: d.label.t, sub: d.sub?.t, alpha: on(d) ? 1 : 0.4 });
				nh.push({ id: d.id, x: p.x - rs.left - 10, y: p.y - NUM - rs.top, w: p.w + 20, h: p.base - p.y + NUM + lab(d) + 6 });
			}
		}
		const sig = (hs: Hit[]) => hs.map((h) => `${h.id}${h.x | 0},${h.y | 0},${h.w | 0},${h.h | 0}`).join();
		if (sig(nh) !== sig(hits)) hits = nh;
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
	function build(rs: DOMRect, narrow: boolean, k: string, h: number) {
		G = blank(k, rs.left, rs.top);
		L = [];
		used = new Set();
		const A: Box = { x0: rs.left, x1: rs.right, y0: rs.top + padT, y1: rs.top + padT + h };
		if (view === "icml") drawIcml(A, narrow);
		else if (view === "models") drawModels(A, narrow);
		else if (view === "domains") drawDomains(A, rs, narrow);
		else if (view === "confidence") drawConfidence(A, narrow);
		// the demo and the example draw no tiles: every tile settles back into the ground
		// blocks that left the view start from zero when they come back
		for (const id in anim) if (!used.has(id)) delete anim[id];
		if ((view !== "domains" || !explore) && hits.length) hits = [];
		geo = G;
		tags = G.tags;
		labels = L.map((l) => ({ ...l, x: l.x - rs.left, y: l.y - rs.top }));
	}

	// one frame of work; true while a lit count is still easing
	let padT = 0, padB = 0;
	function layout(dt: number) {
		const rs = stick.getBoundingClientRect();
		const narrow = rs.width < 700, gap = narrow ? 12 : 18;
		// the picture ends above the caption card at its tallest; in Explore, above the card and its open controls (in
		// the guided steps neither a shorter sentence nor the controls' closing moves the tiles)
		const room = card.offsetHeight + Math.max(0, sizer.offsetHeight - says.offsetHeight);
		const bot = explore ? band.getBoundingClientRect().top - rs.top - gap : rs.height - padB - room - gap;
		const h = Math.max(120, bot - padT);
		const k = `${view}|${explore ? xmodel : ""}|${focusD}|${explore}|${rs.width | 0}x${h | 0}`;
		if (!geo || geo.key !== k) build(rs, narrow, k, h);
		else if (geo.ox !== rs.left || geo.oy !== rs.top) shift(rs.left - geo.ox, rs.top - geo.oy);
		if (chart.marks !== geo!.marks) { chart.marks = geo!.marks; chart.paths = geo!.paths; chart.texts = []; }
		return tween(dt);
	}

	// frames run on demand: an input change kicks one, and an easing count asks for the next
	let raf = 0, last = 0;
	function kick() { if (!raf && stick) raf = requestAnimationFrame(frame); }
	function frame(now: number) {
		raf = 0;
		const dt = Math.min(0.05, (now - last) / 1000); last = now;
		// retake the canvas if a neighbour left it on the plain ground while this section is in view
		if (active && field.mode === "ground") { field.mode = "chart"; field.owner = OWNER; field.dim = 0.75; field.interactive = false; field.hover = null; }
		if (active && field.owner === OWNER && layout(dt)) kick();
	}
	// inputs: the view and its controls, the section coming into view, and the canvas changing hands
	$effect(() => { void [view, xmodel, focusD, explore, active, field.mode, field.owner]; kick(); });

	// --- scroll: the step is a function of how far the track has scrolled, so no step can be skipped ----------------
	let starts: number[] = [];
	let end = 0;
	function measure() {
		const els = [...track.querySelectorAll<HTMLElement>(".step")];
		starts = els.map((e) => e.offsetTop);
		end = starts[LAST] + els[LAST].offsetHeight;
		const cs = getComputedStyle(stick);
		padT = parseFloat(cs.paddingTop) || 0; padB = parseFloat(cs.paddingBottom) || 0;
	}
	function onScroll() {
		const y = -track.getBoundingClientRect().top;
		let s = 0;
		for (let i = 1; i <= LAST; i++) if (y >= starts[i]) s = i;
		const a = starts[s], b = s < LAST ? starts[s + 1] : end;
		const p = (y - a) / (b - a);
		if (s !== step) { step = s; if (s < LAST) reset(); }
		const an = s > 1 || (s === 1 && p >= ANSWER_AT);
		if (an !== ans) ans = an;
		if (active) kick();
	}
	// a dash scrolls to the middle of its step (the inverse of onScroll; the dev route's ?step=N does the same)
	function go(i: number) {
		const a = starts[i], b = i < LAST ? starts[i + 1] : end;
		scrollTo({ top: track.getBoundingClientRect().top + scrollY + a + (b - a) * LAND[i], behavior: reduce ? "instant" : "smooth" });
	}

	onMount(() => {
		still = new URLSearchParams(location.search).has("still");
		reduce = matchMedia("(prefers-reduced-motion: reduce)").matches || still;
		meter = document.createElement("canvas").getContext("2d");
		last = performance.now();
		measure();
		onScroll();
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
		const onResize = () => { measure(); onScroll(); kick(); };
		addEventListener("scroll", onScroll, { passive: true });
		addEventListener("resize", onResize, { passive: true });
		// the card's and the open controls' heights set the picture's foot
		const ro = new ResizeObserver(() => kick());
		ro.observe(band);
		document.fonts?.ready.then(() => { geo = null; kick(); });
		return () => {
			cancelAnimationFrame(raf); raf = 0;
			io.disconnect(); ro.disconnect();
			removeEventListener("scroll", onScroll); removeEventListener("resize", onResize);
			release(); if (field.owner === OWNER) field.owner = "";
		};
	});
</script>

<section class="wh" class:still id={S.id} data-rq={S.rq} data-step={step} data-answer={ans ? 1 : 0} bind:this={root}>
	<SectionOpener n={S.n} title={S.title.t} takeaway={S.takeaway.t} context={S.context.t} accent={TEAL_L} prints={PRINTS} />

	<div class="track" bind:this={track} style="--len:{LEN}">
		<div class="stick" bind:this={stick}>
			<!-- the picture: the demo and the example are page text; the tiles are on the field behind, their words here -->
			<div class="area">
				<div class="demo" class:on={demo} class:prompt={view === "prompt"} inert={!demo} aria-hidden={!demo}>
					<div class="d-col">
						<div class="d-prompt">
							<div class="fold top" class:open={view === "prompt"}><div>
								<p class="d-head"><Icon name="list" />{D["prompt.head"]}</p>
								<p class="d-task">{#each S.prompt.task as seg}{#if seg.b}<b>{seg.t}</b>{:else}{seg.t}{/if}{/each}</p>
							</div></div>
							<article class="d-review">
								<p class="d-head"><Icon name="incognito" /><span class="d-rh">{D["review.head"]}</span><span class="d-sh">{D["prompt.slot"]}</span><sup class="fnref"><a href="#fn-{S.id}-{FN.demo}">{FN.demo}</a></sup></p>
								<p class="d-par"><b>{D["review.k1"]}.</b> {D["review.t1"]}</p>
								<p class="d-par"><b>{D["review.k2"]}.</b> {D["review.t2"]}</p>
								<div class="fold" class:open={view === "review"}><div>
									<p class="d-par"><b>{D["review.k3"]}.</b> {D["review.t3"]}</p>
									<p class="d-who">{D["review.who"]}</p>
								</div></div>
							</article>
							<div class="fold bot" class:open={view === "prompt"}><div>
								<p class="d-fields">{#each S.prompt.fields as f}<span><b>{f.k}</b> &lt;{f.v}&gt;</span>{/each}</p>
							</div></div>
						</div>
						<div class="fold ans" class:open={ans && view === "prompt"}><div>
							<p class="d-arrow" aria-hidden="true"><Icon name="arrow" /></p>
							<div class="d-answer">
								<p class="d-head"><Icon name="ai" class="fable" />{D["answer.head"]}<span class="d-by">{FAB.name}</span></p>
								<p class="d-name"><b>{S.prompt.fields[1].k}</b><span class="veil" role="img" aria-label={NOTES[FN.withheld - 1].t}><i></i><i></i></span><sup class="fnref"><a href="#fn-{S.id}-{FN.withheld}">{FN.withheld}</a></sup></p>
								<p class="d-ok"><Icon name="check" class="ok" />{D["answer.verdict"]}</p>
							</div>
						</div></div>
					</div>
				</div>

				<figure class="ex" class:on={view === "example"} inert={view !== "example"} aria-hidden={view !== "example"}>
					<div class="ex-col">
						<p class="ex-src"><Icon name="book" />{E.kind.t}: <em>{E.title.t}</em></p>
						<blockquote class="ex-text" class:open>
							“{#each E.text as seg}{#if seg.cue && open}<span role="button" tabindex="0" class="cue {seg.cue}" class:dim={!lit(seg.cue)} aria-pressed={cue === seg.cue} onclick={() => pick(seg.cue!)} onkeydown={(e) => key(e, seg.cue!)}>{seg.t}</span>{:else}{seg.t}{/if}{/each}”
						</blockquote>
						<div class="ex-pred">
							<span class="ex-role">{U.role}</span>
							<span class="ex-ans"><Icon name="check" class="ok" />{E.answer}</span>
							<span class="ex-conf">{fill(U.conf, { n: E.confidence })}</span>
							<span class="ex-by"><Icon name="ai" class="fable" />{E.model}</span>
						</div>
						<div id="wh-why" class="ex-x" hidden={!open}>
							<p>“{#each E.explanation as seg}{#if seg.cue}<span role="button" tabindex="0" class="cue {seg.cue}" class:dim={!lit(seg.cue)} aria-pressed={cue === seg.cue} onclick={() => pick(seg.cue!)} onkeydown={(e) => key(e, seg.cue!)}>{seg.t}</span>{:else}{seg.t}{/if}{/each}”</p>
							<p class="ex-note">{E.note.t}</p>
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

			{#if active && view === "domains" && explore}
				{#each hits as h (h.id)}
					{@const d = dom(h.id)}
					<button type="button" class="hit" class:on={dsel === h.id} style="left:{h.x}px; top:{h.y}px; width:{h.w}px; height:{h.h}px" aria-pressed={dsel === h.id} aria-label="{d.label.t}, {pct(d.pct)}" onclick={() => (dsel = dsel === h.id ? null : h.id)} onpointerenter={() => (dpeek = h.id)} onpointerleave={() => (dpeek = null)} onfocus={() => (dpeek = h.id)} onblur={() => (dpeek = null)}></button>
				{/each}
			{/if}

			<!-- the caption band: the narration card (its step dashes on top), then Explore under it on the last step -->
			<div class="band" class:xtiles={explore && tiles} bind:this={band}>
				<div class="card" bind:this={card}>
					<StepDashes count={STEPS.length} current={step} {go} />
					<div class="says" bind:this={says}>
						<div aria-live="polite">
							{#key sayAt}
								{@const s = STEPS[sayAt]}
								<p class="say">{#if s.head}<b>{s.head.t}</b>{" "}{/if}{s.t}{#if s.view === "icml"}<sup class="fnref"><a href="#fn-{S.id}-{FN.privacy}">{FN.privacy}</a></sup>{/if}</p>
							{/key}
						</div>
						<!-- every sentence in one cell, unseen: the tallest sets the room the picture leaves for the card, so
						     the tiles never move when the sentence changes -->
						<div class="sizer" aria-hidden="true" bind:this={sizer}>
							{#each STEPS as s}<p class="say">{#if s.head}<b>{s.head.t}</b>{" "}{/if}{s.t}{#if s.view === "icml"}<sup class="fnref">{FN.privacy}</sup>{/if}</p>{/each}
						</div>
					</div>
				</div>
				<div class="xwrap" class:on={explore}><Reveal show={explore} label={U.explore}>
					<div class="xrow">
						<div class="seg" role="group" aria-label={U["x.aria"]}>
							{#each XVIEWS as x}<button type="button" aria-pressed={view === x} onclick={() => choose(x)}>{U[`x.${x}`]}</button>{/each}
						</div>
						{#if view === "example"}
							<button type="button" class="c-why" aria-expanded={open} aria-controls="wh-why" onclick={() => { open = !open; cue = null; }}>{U.explain}<Icon name="arrow" class="c-arrow" /></button>
						{:else if view === "icml"}
							<div class="seg models" role="group" aria-label={U["x.models"]}>
								{#each S.models as m}<button type="button" aria-pressed={xmodel === m.id} style:--c={hue(m)} onclick={() => (xmodel = m.id)}><i class="sw"></i>{m.short}<b>{pct(m.pct)}</b></button>{/each}
							</div>
						{:else if view === "domains"}
							<div class="seg" role="group" aria-label={U["x.domains"]}>
								<button type="button" aria-pressed={dsel === null} onclick={() => (dsel = null)}>{U.all}</button>
								{#each S.domains as d}
									<button type="button" aria-pressed={dsel === d.id} onclick={() => (dsel = dsel === d.id ? null : d.id)} onpointerenter={() => (dpeek = d.id)} onpointerleave={() => (dpeek = null)} onfocus={() => (dpeek = d.id)} onblur={() => (dpeek = null)}><Icon name={ICON[d.id]} />{d.label.t}</button>
								{/each}
							</div>
						{/if}
					</div>
					{#if view === "domains"}
						<!-- one slot as tall as the longest set's sentence: hovering a set never resizes the band (which would
						     move the chips and the sets out from under the pointer) -->
						<div class="mores">{#each S.domains as d}<p class="more" class:on={focusD === d.id} aria-hidden={focusD !== d.id}>{d.more.t}</p>{/each}</div>
					{/if}
				</Reveal></div>
			</div>
		</div>
		{#if active}<Tags items={tags} />{/if}
		<!-- the scroll track's steps (layout only); each footnote returns to the step that marks it -->
		<div class="steps" aria-hidden="true">
			{#each VH as h, i}
				<div class="step" style:height="{h}vh">
					{#each NOTES.filter((f) => FN_STEP[f.n] === i) as f}<span class="fnback" id="fnref-{S.id}-{f.n}" style:top="{LAND[i] * 100}%"></span>{/each}
				</div>
			{/each}
		</div>
	</div>

	<Footnotes id={S.id} notes={NOTES} />
</section>

<style>
	.wh { position: relative; }
	.track { position: relative; height: calc(var(--len) * 1vh + 100vh); }
	.stick { position: sticky; top: 0; z-index: 1; height: 100vh; display: grid; grid-template-rows: minmax(0, 1fr) auto; gap: 18px; padding: 28px 0 22px; pointer-events: none; }
	.area { position: relative; min-height: 0; }
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

	/* hit areas over the drawn sets in Explore: hover previews, click selects (the tiles take no pointer events) */
	.hit { position: absolute; z-index: 2; pointer-events: auto; border-radius: 3px; cursor: pointer; }
	.hit:hover { box-shadow: inset 0 0 0 1px rgba(20, 32, 45, .14); }

	/* the caption band */
	.band { pointer-events: auto; position: relative; z-index: 2; display: grid; justify-self: center; width: min(100%, 52rem); }
	.card { display: grid; gap: 8px; padding: 14px 18px 16px; background: #fff; border-radius: 3px; }
	.says { position: relative; }
	.say { font-size: 19px; line-height: 1.5; letter-spacing: -0.008em; color: var(--ink); text-wrap: pretty; animation: say .45s var(--ease); }
	.say b { font-weight: 600; }
	.sizer { position: absolute; inset: 0 0 auto; display: grid; visibility: hidden; pointer-events: none; }
	.sizer .say { grid-area: 1 / 1; animation: none; }
	.xwrap { transition: padding-top .45s var(--ease); }
	.xwrap.on { padding-top: 10px; }
	.xrow { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
	.seg { display: inline-flex; flex-wrap: wrap; gap: 2px; padding: 3px; background: var(--chip); border-radius: 3px; }
	.seg button, .c-why { display: inline-flex; align-items: center; gap: 6px; padding: 4px 8px; font-size: 12.5px; font-weight: 500; color: var(--ink2); border-radius: 2px; transition: background-color .15s, color .15s; }
	.seg button b { font-weight: 600; font-variant-numeric: tabular-nums; color: var(--ink); }
	.seg button:hover { color: var(--ink); }
	.seg button[aria-pressed="true"] { background: var(--ink); color: var(--field); }
	.seg button[aria-pressed="true"] b { color: var(--field); }
	.models .sw { flex: none; width: 10px; height: 10px; border-radius: 1px; background: var(--c); }
	.models button[aria-pressed="true"] .sw { box-shadow: 0 0 0 1.5px var(--field); }
	.c-why { padding: 6px 10px; border: 1.25px solid var(--ink); color: var(--ink); }
	.c-why:hover { background: var(--ink); color: var(--field); }
	.c-why :global(.c-arrow) { transition: transform .25s var(--ease); }
	.c-why[aria-expanded="true"] :global(.c-arrow) { transform: rotate(90deg); }
	.mores { display: grid; margin-top: 8px; }
	.more { grid-area: 1 / 1; font-size: 14px; line-height: 1.5; color: var(--ink2); visibility: hidden; opacity: 0; transition: opacity .25s; }
	.more.on { visibility: visible; opacity: 1; }
	@keyframes say { from { opacity: 0; transform: translateY(6px); } }

	/* folding rows: a row opens or closes in place, so the column re-centres as it changes */
	.fold { display: grid; grid-template-rows: 0fr; opacity: 0; transition: grid-template-rows .6s var(--ease), opacity .35s; }
	.fold > div { overflow: hidden; min-height: 0; }
	.fold.open { grid-template-rows: 1fr; opacity: 1; transition: grid-template-rows .6s var(--ease), opacity .45s .12s; }

	/* the demo: the review alone, then the prompt closing around it, then the answer */
	.demo, .ex { position: absolute; inset: 0; display: grid; place-items: center; opacity: 0; visibility: hidden; transition: opacity .4s, visibility 0s .4s; }
	.demo.on, .ex.on { opacity: 1; visibility: visible; pointer-events: auto; transition: opacity .4s; }
	.d-col { width: min(100%, 46rem); display: grid; }
	.d-prompt { display: grid; padding: 0; background: transparent; border: 1px solid transparent; border-radius: 3px; transition: padding .6s var(--ease), background-color .5s, border-color .5s; }
	.demo.prompt .d-prompt { padding: 16px 18px; background: var(--field); border-color: var(--rule); }
	.d-head { display: flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--ink2); }
	.d-head :global(.fable) { color: var(--fable); }
	.d-head sup { letter-spacing: 0; color: var(--ink); }
	.fold.top > div { display: grid; gap: 10px; padding-bottom: 12px; }
	.d-task { font-size: 16px; line-height: 1.5; }
	.d-task b, .d-fields b, .d-par b { font-weight: 600; }
	.d-review { display: grid; gap: 10px; padding: 20px 22px; background: #fff; border-radius: 3px; transition: padding .6s var(--ease), gap .6s var(--ease); }
	.demo.prompt .d-review { gap: 4px; padding: 10px 12px; box-shadow: 0 1px 0 var(--rule); }
	.d-sh { display: none; }
	.demo.prompt .d-rh { display: none; }
	.demo.prompt .d-sh { display: inline; }
	.d-par { font-size: 22px; line-height: 1.5; letter-spacing: -0.006em; transition: font-size .6s var(--ease), line-height .6s var(--ease); }
	.demo.prompt .d-par { font-size: 14px; line-height: 1.45; letter-spacing: 0; }
	.d-review .fold > div { display: grid; gap: 10px; }
	.d-who { padding-top: 10px; border-top: 1px solid var(--rule); font-size: 13px; color: var(--ink2); }
	.fold.bot > div { padding-top: 12px; }
	.d-fields { display: flex; flex-wrap: wrap; gap: 2px 16px; font-size: 13.5px; color: var(--ink2); }
	.d-fields span { white-space: nowrap; }
	.d-arrow { display: grid; place-items: center; padding: 8px 0; font-size: 16px; color: var(--ink2); }
	.d-arrow :global(svg) { transform: rotate(90deg); }
	.d-answer { display: grid; gap: 10px; padding: 16px 18px; background: var(--field); border: 1px solid var(--rule); border-radius: 3px; }
	.d-by { margin-left: auto; font-size: 13px; font-weight: 500; letter-spacing: 0; text-transform: none; color: var(--ink2); }
	.d-name { display: flex; align-items: center; gap: 10px; font-size: 17px; }
	.d-name b { font-weight: 600; }
	.d-name sup { margin-left: -6px; transform: translateY(-5px); }
	/* the name: soft blank blocks the width of a name, no text in them */
	.veil { display: inline-flex; gap: 6px; }
	.veil i { display: block; height: 15px; border-radius: 3px; background: color-mix(in srgb, var(--ink) 11%, transparent); }
	.veil i:first-child { width: 62px; } .veil i:last-child { width: 92px; }
	.d-ok { display: inline-flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 500; color: var(--ink2); }
	.d-ok :global(.ok), .ex-ans :global(.ok) { color: var(--ok); }

	/* the worked example: the story set large and centred, the model's answer under a rule */
	.ex { margin: 0; }
	.ex-col { width: min(100%, 44rem); max-height: 100%; overflow: auto; display: grid; gap: 18px; }
	.ex-src { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--ink2); }
	.ex-text { font-size: clamp(22px, 2.2vw, 30px); line-height: 1.5; letter-spacing: -0.012em; color: var(--ink); }
	.ex-pred { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 16px; padding-top: 14px; border-top: 1px solid var(--rule); }
	.ex-role { width: 100%; font-size: 12px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--ink2); }
	.ex-ans { display: inline-flex; align-items: center; gap: 8px; font-size: 26px; font-weight: 600; letter-spacing: -0.02em; }
	.ex-conf { font-size: 13px; color: var(--ink2); font-variant-numeric: tabular-nums; }
	.ex-by { display: inline-flex; align-items: center; gap: 6px; margin-left: auto; font-size: 13px; font-weight: 500; color: var(--ink2); }
	.ex-by :global(.fable) { color: var(--fable); }
	.ex-x { display: grid; gap: 8px; padding: 14px 16px; background: #fff; border-radius: 3px; font-size: 15px; line-height: 1.55; }
	.ex-x[hidden] { display: none; }
	.ex-note { font-size: 12.5px; color: var(--ink2); }
	.cue { cursor: pointer; padding: 0 .12em; margin: 0 -.02em; border-radius: 2px; box-decoration-break: clone; -webkit-box-decoration-break: clone; transition: background-color .25s, color .25s, opacity .25s; }
	.cue.rose { color: var(--cue-rose); background: var(--cue-rose-bg); }
	.cue.teal { color: var(--cue-teal); background: var(--cue-teal-bg); }
	.cue.clay { color: var(--cue-clay); background: var(--cue-clay-bg); }
	.cue[aria-pressed="true"] { box-shadow: inset 0 -2px 0 currentColor; }
	.cue.dim { background: transparent; color: var(--ink); opacity: .55; }

	@media (min-width: 701px) and (max-height: 780px) {
		.stick { padding-top: 18px; gap: 12px; }
		.say { font-size: 17px; }
		.d-par { font-size: 17px; }
		.ex-text { font-size: 21px; }
	}
	@media (max-width: 700px) {
		.stick { padding: 14px 0 12px; gap: 12px; }
		.card { padding: 12px 14px 14px; gap: 6px; }
		.say { font-size: 15px; line-height: 1.45; }
		/* Explore on a phone: the field needs the room, and the guided sentence was read already */
		.band.xtiles .card { display: none; }
		.xrow { margin-top: 6px; }
		.d-review { padding: 14px 16px; gap: 8px; }
		.d-par { font-size: 15.5px; line-height: 1.5; }
		.demo.prompt .d-par { font-size: 12.5px; }
		.demo.prompt .d-prompt { padding: 12px 14px; }
		.d-task { font-size: 13px; }
		.fold.top > div { gap: 8px; padding-bottom: 10px; }
		.fold.bot > div { padding-top: 10px; }
		.d-fields { font-size: 12px; }
		.d-arrow { padding: 6px 0; }
		.d-answer { padding: 12px 14px; gap: 8px; }
		.d-name { font-size: 15px; }
		.veil i:first-child { width: 48px; } .veil i:last-child { width: 72px; }
		.ex-col { gap: 14px; }
		.ex-text { font-size: 18px; }
		.ex-ans { font-size: 21px; }
		.ex-x { font-size: 14px; padding: 12px 14px; }
	}
	@media (prefers-reduced-motion: reduce) {
		.fold, .d-prompt, .d-review, .d-par, .demo, .ex, .lab, .xwrap, .cue, .c-why :global(.c-arrow) { transition: none; }
		.say { animation: none; }
		.more { transition: none; }
	}
	.still :is(.fold, .d-prompt, .d-review, .d-par, .demo, .ex, .lab, .xwrap) { transition: none; }
	.still .say { animation: none; }
	.still .more { transition: none; }
</style>
