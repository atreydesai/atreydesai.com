<script lang="ts">
	// If human, which human? Section 3 opens with an illustrative demo (a synthetic review goes into the paper's RQ3
	// prompt and the model names its writer, shown only as a redaction bar), then draws the paper's aggregate counts as
	// square tiles on the page's field: never individual texts, reviewers or per-review results. Scrolling moves the
	// same tiles (stable ids, so DotField tweens them) through the ICML 2020 reviews (1 tile = 10 reviews), the five
	// models on them, Figure 1's other sets (1 tile = 1 text) and stated confidence (1 tile = 1 answer), then the
	// paper's Oates example. Lit tiles take the colour of the model whose result they show; every colour is named on
	// the picture with Tags. Controls arrive only after the guided steps (Reveal). Strings and numbers come from
	// rq3.json, built in the private llm-detectors repo by docs/launch_20261116/tools/build_rq3_data.py.
	import { onMount } from "svelte";
	import { fade, fly } from "svelte/transition";
	import { cubicInOut } from "svelte/easing";
	import Icon from "./Icon.svelte";
	import Reveal from "./Reveal.svelte";
	import Tags, { type Tag } from "./Tags.svelte";
	import { field, chart, type Mark, type Path, type Text } from "./field.svelte";
	import { FABLE, GRAY, INK as TONE, modelColor } from "./palette";
	import S from "./rq3.json";
	import { printSprite, printAspect } from "./print/sprites";

	type View = "review" | "prompt" | "icml" | "models" | "domains" | "confidence" | "example";
	type XView = "example" | "icml" | "domains" | "confidence";
	type Model = (typeof S.models)[number];
	type Dom = (typeof S.domains)[number];
	type Block = { id: string; n: number; k: number; x: number; y: number; cols: number; s: number; alpha: number; color: string; order: "row" | "col" };
	type Hit = { id: string; x: number; y: number; w: number; h: number };
	type Box = { x0: number; x1: number; y0: number; y1: number };
	type Step = (typeof S.steps)[number] & { head?: { t: string }; more?: { t: string } };

	const OWNER = "rq3";
	const INK = TONE.ink, INK2 = TONE.ink2, FAINT = "#A3A7AC", UNLIT = GRAY.unlit;
	const FONT = "Inter, system-ui, sans-serif";
	const LAYOUTS = [[["famous", "nature", "papers"], ["active", "inactive"]], [["famous", "nature"], ["papers", "inactive"], ["active"]]];
	const ICON: Record<string, string> = { famous: "book", nature: "nature", papers: "arxiv", active: "reddit", inactive: "reddit" };
	const XVIEWS: XView[] = ["example", "icml", "domains", "confidence"];
	const U: Record<string, string> = Object.fromEntries(S.ui.map((u) => [u.id, u.t]));
	const D: Record<string, string> = Object.fromEntries(S.demo.map((u) => [u.id, u.t]));
	const fill = (t: string, v: Record<string, string | number>) => t.replace(/\{(\w+)\}/g, (_, k) => String(v[k]));
	const dom = (id: string) => S.domains.find((d) => d.id === id)!;
	const hue = (m: Model) => modelColor(m.short);
	const FAB = S.models[0];
	const LAST = S.steps.length - 1;
	const STEPS = S.steps as Step[];

	let step = $state(0);
	let active = $state(false);
	let xview = $state<XView | null>(null); // Explore: the view the reader picked after the guided steps
	let xmodel = $state("fable52");
	let dsel = $state<string | null>(null);
	let dpeek = $state<string | null>(null);
	let open = $state(false);
	let cue = $state<string | null>(null);
	let hits = $state<Hit[]>([]);
	let tags = $state<Tag[]>([]);
	let priv = $state<{ x: number; y: number; w: number } | null>(null);
	let stage: HTMLElement;
	let panel: HTMLElement;
	let root: HTMLElement;

	const explore = $derived(step >= LAST);
	const view = $derived<View>((explore && xview) || (S.steps[step].view as View));
	// the narration card follows the view on screen (in Explore, the picked view's sentence)
	const st = $derived(STEPS[Math.max(0, STEPS.findIndex((s) => s.view === view))]);
	// in Explore's ICML view the card carries the paper's five-model sentence, since any model can be shown there
	const say = $derived(explore && view === "icml" && st.more ? st.more.t : st.t);
	const focusD = $derived(dpeek ?? dsel);
	const lit = (c: string) => open && (cue === null || cue === c);
	const pick = (c: string) => { if (open) cue = cue === c ? null : c; };
	const key = (e: KeyboardEvent, c: string) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(c); } };
	const choose = (x: XView) => { xview = x === "example" ? null : x; dsel = null; dpeek = null; };
	function reset() { xview = null; xmodel = "fable52"; dsel = null; dpeek = null; open = false; cue = null; }

	// --- the demo's motion: the review card flies into the prompt's slot (translate + one scale, so text never squashes)
	let reduce = false;
	const T = (ms: number) => (reduce ? 0 : ms);
	const rect: { out: DOMRect | null; in: DOMRect | null } = { out: null, in: null };
	function into(node: Element, { dir }: { dir: "in" | "out" }) {
		const r = node.getBoundingClientRect();
		rect[dir] = r;
		setTimeout(() => (rect[dir] = null), 60);
		return () => {
			const o = dir === "in" ? rect.out : rect.in;
			if (!o || reduce) return { duration: T(220), css: (t: number) => `opacity: ${t}` };
			if (dir === "out") return { duration: 200, css: (t: number) => `opacity: ${t * t}` };
			// the incoming copy starts where the outgoing card was, at its width, and travels opaque to its own place
			const dx = o.left - r.left, dy = o.top - r.top, k = o.width / r.width;
			return { duration: 900, easing: cubicInOut, css: (t: number, u: number) => `transform-origin: 0 0; transform: translate(${u * dx}px, ${u * dy}px) scale(${t + u * k}); position: relative; z-index: 2; box-shadow: 0 ${6 * u}px ${18 * u}px rgba(20, 32, 45, ${0.12 * u})` };
		};
	}

	// --- drawing ----------------------------------------------------------------------------------------------
	// Work happens only when an input changes (step, a control, size, the panel, the stage while it scrolls in or out,
	// or the canvas changing hands) and while a lit count is still easing; otherwise nothing runs. A view's tiles,
	// labels and tags are built once per input; the easing then only recolours the tiles whose state flips, and a
	// scroll of the unpinned stage only shifts the built geometry. DotField tweens the marks themselves.
	type Entry = { b: Block; base: number; on: number };
	type Geo = { key: string; ox: number; oy: number; marks: Mark[]; paths: Path[]; texts: Text[]; tags: Tag[]; blocks: Entry[]; edge: Path | null; edgeOf: Entry | null };
	const blank = (key: string, ox: number, oy: number): Geo => ({ key, ox, oy, marks: [], paths: [], texts: [], tags: [], blocks: [], edge: null, edgeOf: null });
	const anim: Record<string, number> = {}; // lit tiles shown per block, eased toward the target count
	let used = new Set<string>();
	let geo: Geo | null = null;
	let G: Geo = blank("", 0, 0); // the view being built
	let meter: CanvasRenderingContext2D | null = null;
	const tw = (t: string, size: number, weight = 400) => {
		if (!meter) return t.length * size * 0.56;
		meter.font = `${weight} ${size}px ${FONT}`;
		return meter.measureText(t).width;
	};
	// a Tag's width (padding, swatch and words), to set tags side by side
	const tagW = (t: string) => 16 + 16 + tw(t, 12.5, 600);

	const ASPECT = printAspect();
	function place(b: Block, base: number): Entry {
		const cur = anim[b.id] ?? (reduce ? b.k : 0);
		anim[b.id] = cur;
		used.add(b.id);
		const on = Math.round(cur), rows = Math.ceil(b.n / b.cols);
		for (let i = 0; i < b.n; i++) {
			const c = b.order === "row" ? i % b.cols : Math.floor(i / rows), r = b.order === "row" ? Math.floor(i / b.cols) : i % rows;
			// each tile is a writer's print: crisp in the model's colour when it was named, smudged gray when not
			const lit = i < on, px = Math.max(6, Math.round(b.s * 0.9)), wi = (base + i) % 64;
			const ink = lit ? b.color : UNLIT;
			G.marks.push({
				id: `t${base + i}`, square: true, x: b.x + c * b.s + b.s / 2, y: b.y + r * b.s + b.s / 2, r: px / 2, color: ink, alpha: b.alpha,
				sprite: printSprite({ family: "writer", index: wi, color: ink, px, clarity: lit ? 1 : 0.35 }), spriteKey: `w${wi}|${ink}|${px}|${lit ? 1 : 0}`, aspect: ASPECT, backing: lit ? 0.34 : 0.2,
			});
		}
		const e = { b, base, on };
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
			for (let i = Math.min(on, e.on), hi = Math.max(on, e.on); i < hi; i++) ms[e.base + i].color = i < on ? b.color : UNLIT;
			e.on = on;
			if (geo!.edgeOf === e) geo!.edge!.pts = edge(b, on);
		}
		return busy;
	}

	// the stage moved (scrolling in or out, unpinned): move what is built instead of building it again
	function shift(dx: number, dy: number) {
		const g = geo!;
		for (const m of g.marks) { m.x += dx; m.y += dy; }
		for (const t of g.texts) { t.x += dx; t.y += dy; }
		for (const p of g.paths) for (const q of p.pts) { q[0] += dx; q[1] += dy; }
		for (const e of g.blocks) { e.b.x += dx; e.b.y += dy; }
		g.tags = g.tags.map((t) => ({ ...t, x: t.x + dx, y: t.y + dy }));
		g.ox += dx; g.oy += dy;
		tags = g.tags;
	}

	// the lower edge of the first c tiles of a row-filled block, as a stair line
	function edge(b: Block, c: number): [number, number][] {
		const full = Math.floor(c / b.cols), rem = c % b.cols, xr = b.x + b.cols * b.s, y = (r: number) => b.y + r * b.s;
		return rem === 0 ? [[b.x, y(full)], [xr, y(full)]] : [[b.x, y(full + 1)], [b.x + rem * b.s, y(full + 1)], [b.x + rem * b.s, y(full)], [xr, y(full)]];
	}

	// the largest tile that fits n tiles in a W x H box
	function fit(n: number, W: number, H: number, max = 19) {
		let s = Math.min(max, Math.sqrt((W * H) / n)), cols = 1;
		for (; s > 2; s -= 0.25) { cols = Math.max(1, Math.floor(W / s)); if (Math.ceil(n / cols) * s <= H) break; }
		return { s, cols, rows: Math.ceil(n / cols) };
	}

	function head(box: Box, unit: string, title?: string) {
		if (title) G.texts.push({ x: box.x0, y: box.y0 + 8, t: title, color: INK, size: 13, weight: 600 });
		G.texts.push({ x: box.x1, y: box.y0 + 8, t: unit, color: INK2, size: 11.5, align: "right" });
	}

	// a row of colour keys: "Fable 5.2: correct" in clay, "Incorrect" in gray
	function keys(x: number, y: number, id: string) {
		const a = fill(U["key.correct"], { model: FAB.short });
		G.tags.push({ id: `${id}:k1`, x: x - 10, y, at: "right", color: hue(FAB), t: a });
		G.tags.push({ id: `${id}:k2`, x: x - 10 + tagW(a) + 8, y, at: "right", color: UNLIT, t: U["key.wrong"] });
	}

	function drawIcml(box: Box) {
		const m = S.models.find((q) => q.id === (explore ? xmodel : "fable52"))!;
		head(box, U["unit.icml"], U["title.icml"]);
		const top = box.y0 + 26, f = fit(S.icml.tiles, box.x1 - box.x0, box.y1 - top);
		const b: Block = { id: "icml", n: S.icml.tiles, k: m.lit, x: box.x0, y: top, cols: f.cols, s: f.s, alpha: 1, color: hue(m), order: "row" };
		const e = place(b, 0);
		G.edge = { pts: edge(b, e.on), color: INK, width: 1.4, progress: 1 };
		G.edgeOf = e;
		G.paths.push(G.edge);
		const gw = f.cols * f.s, litH = Math.ceil(m.lit / f.cols) * f.s, allH = f.rows * f.s;
		// the abstract's 55% in the guided step; the paper's one-decimal figures in Explore
		const pct = explore ? m.pct : Math.round(m.pct);
		G.tags.push({ id: "icml:lit", x: box.x0 + gw / 2, y: top + litH / 2, at: "center", color: hue(m), t: fill(U["key.correct"], { model: m.short }), sub: fill(U.pct, { pct }), strong: true });
		G.tags.push({ id: "icml:unlit", x: box.x0 + gw / 2, y: top + (litH + allH) / 2, at: "center", color: UNLIT, t: U["key.wrong"] });
		return { x: box.x0, y: top + allH + 12, w: gw };
	}

	// five models on the same reviews: one bar of tiles each, filled from the left in the model's colour
	function drawModels(box: Box, narrow: boolean) {
		head(box, U["unit.icml"], U["title.icml"]);
		G.tags.push({ id: "models:unlit", x: box.x0 + tw(U["title.icml"], 13, 600) + 4, y: box.y0 + 8, at: "right", color: UNLIT, t: U["key.wrong"] });
		const n = S.models.length, lab = 30, gap = narrow ? 8 : 14, top = box.y0 + 28, W = box.x1 - box.x0;
		const f = fit(S.icml.tiles, W, (box.y1 - top - n * (lab + gap) + gap) / n, 12);
		let y = top, base = 0;
		S.models.forEach((m, i) => {
			place({ id: i === 0 ? "icml" : `m:${m.id}`, n: S.icml.tiles, k: m.lit, x: box.x0, y: y + lab, cols: f.cols, s: f.s, alpha: 1, color: hue(m), order: "col" }, base);
			base += S.icml.tiles;
			G.tags.push({ id: `models:${m.id}`, x: box.x0 - 10, y: y + lab / 2 - 1, at: "right", color: hue(m), t: `${m.short} · ${fill(U.pct, { pct: m.pct })}`, strong: i < 2 });
			y += lab + f.rows * f.s + gap;
		});
		return { x: box.x0, y: y - gap + 12, w: W };
	}

	function drawDomains(box: Box, r: DOMRect, narrow: boolean) {
		keys(box.x0, box.y0 + 8, "dom");
		// on a phone the unit takes its own line under the keys
		if (narrow) G.texts.push({ x: box.x0, y: box.y0 + 32, t: U["unit.text"], color: INK2, size: 11.5 });
		else head(box, U["unit.text"]);
		const y0 = box.y0 + (narrow ? 50 : 34), W = box.x1 - box.x0, H = box.y1 - y0, top = 50, gap = 34, rowGap = 22;
		const lw = (d: Dom) => Math.max(tw(d.label.t, 13, 600), d.sub ? tw(d.sub.t, 11.5) : 0) + 6;
		const bottom = (d: Dom) => (d.sub ? 22 : 4);
		let placed: { d: Dom; x: number; y: number; cols: number; rows: number; s: number }[] = [];
		search: for (const rows of LAYOUTS)
			for (let s = 20; s >= 4; s -= 0.5) {
				const out: typeof placed = [];
				let y = y0, ok = true;
				for (const row of rows) {
					const ds = row.map(dom), cols = ds.map((d) => Math.ceil(Math.sqrt(d.n * 1.5)));
					const slots = ds.map((d, i) => Math.max(cols[i] * s, lw(d)));
					if (slots.reduce((a, v) => a + v, 0) + gap * (row.length - 1) > W) ok = false;
					const h = Math.max(...ds.map((d, i) => Math.ceil(d.n / cols[i]) * s + bottom(d)));
					let x = box.x0;
					ds.forEach((d, i) => { out.push({ d, x, y: y + top, cols: cols[i], rows: Math.ceil(d.n / cols[i]), s }); x += slots[i] + gap; });
					y += top + h + rowGap;
				}
				placed = out;
				if (ok && y - rowGap <= y0 + H) break search;
			}
		let base = 0;
		const nh: Hit[] = [];
		for (const p of S.domains.map((d) => placed.find((q) => q.d.id === d.id)!)) {
			const d = p.d, on = !focusD || focusD === d.id;
			place({ id: `d:${d.id}`, n: d.n, k: d.k, x: p.x, y: p.y, cols: p.cols, s: p.s, alpha: on ? 1 : 0.2, color: hue(FAB), order: "row" }, base);
			base += d.n;
			const yb = p.y + p.rows * p.s;
			G.texts.push({ x: p.x, y: p.y - 38, t: d.label.t, color: on ? INK : FAINT, size: 13, weight: 600 });
			G.texts.push({ x: p.x, y: p.y - 15, t: fill(U.pct, { pct: d.pct }), color: on ? FABLE.ink : FAINT, size: 22, weight: 600 });
			if (d.sub) G.texts.push({ x: p.x, y: yb + 13, t: d.sub.t, color: on ? INK2 : FAINT, size: 11.5 });
			nh.push({ id: d.id, x: p.x - r.left - 8, y: p.y - 50 - r.top, w: Math.max(p.cols * p.s, lw(d)) + 16, h: yb - p.y + 50 + bottom(d) + 8 });
		}
		const sig = (hs: Hit[]) => hs.map((h) => `${h.id}${h.x | 0},${h.y | 0},${h.w | 0},${h.h | 0}`).join();
		if (sig(nh) !== sig(hits)) hits = nh;
	}

	// stated confidence: two stacked groups of answers, each filled from the left with the correct ones
	function drawConfidence(box: Box, narrow: boolean) {
		const C = S.confidence, [A, B] = C.groups as [(typeof C.groups)[0], (typeof C.groups)[1] & { says: { t: string }; share: number }];
		let y = box.y0 + 8;
		G.tags.push({ id: "conf:what", x: box.x0 - 10, y, at: "right", t: C.what.t, strong: !narrow });
		if (!narrow) G.texts.push({ x: box.x1, y, t: U["unit.answer"], color: INK2, size: 11.5, align: "right" });
		y += 30;
		keys(box.x0, y, "conf");
		if (narrow) { y += 24; G.texts.push({ x: box.x0, y, t: U["unit.answer"], color: INK2, size: 11.5 }); }
		y += 22;
		const labA = 30, labB = 50, gap = 16, W = box.x1 - box.x0, H = box.y1 - y - labA - labB - gap;
		let s = 18, cols = 1;
		for (; s > 2; s -= 0.25) { cols = Math.floor(W / s); if ((Math.ceil(A.n / cols) + Math.ceil(B.n / cols)) * s <= H) break; }
		const yA = y + labA, yB = yA + Math.ceil(A.n / cols) * s + gap + labB;
		place({ id: "c:lo", n: A.n, k: A.k, x: box.x0, y: yA, cols, s, alpha: 1, color: hue(FAB), order: "col" }, 0);
		place({ id: "c:hi", n: B.n, k: B.k, x: box.x0, y: yB, cols, s, alpha: 1, color: hue(FAB), order: "col" }, A.n);
		G.tags.push({ id: "conf:lo", x: box.x0 - 10, y: yA - labA / 2, at: "right", t: A.label.t });
		G.tags.push({ id: "conf:hi", x: box.x0 - 10, y: yB - labB / 2, at: "right", t: B.label.t, sub: B.says.t, strong: true });
		if (!narrow) G.texts.push({ x: box.x1, y: yB - labB / 2, t: fill(U["conf.share"], { share: B.share }), color: INK2, size: 11.5, align: "right" });
	}

	// build the current view's tiles, labels and tags once for these inputs
	function build(r: DOMRect, narrow: boolean, k: string) {
		G = blank(k, r.left, r.top);
		used = new Set();
		const box: Box = narrow
			? { x0: r.left + 8, x1: r.right - 8, y0: Math.max(panel.getBoundingClientRect().bottom + 24, r.top + r.height * 0.3), y1: r.bottom - 24 }
			: { x0: r.left + r.width * 0.36, x1: r.right - 24, y0: r.top + 72, y1: r.bottom - 48 };
		let pv: { x: number; y: number; w: number } | null = null;
		// room for the aggregate-only sentence under the ICML tiles
		if (view === "icml" || view === "models") box.y1 -= narrow ? 44 : 30;
		if (view === "icml") pv = drawIcml(box);
		else if (view === "models") pv = drawModels(box, narrow);
		else if (view === "domains") drawDomains(box, r, narrow);
		else if (view === "confidence") drawConfidence(box, narrow);
		// the demo and the example draw no tiles: every tile settles back into the ground
		// blocks that left the view start from zero when they come back
		for (const id in anim) if (!used.has(id)) delete anim[id];
		priv = pv && { x: pv.x - r.left, y: pv.y - r.top, w: pv.w };
		if ((view !== "domains" || !explore) && hits.length) hits = [];
		geo = G;
		tags = G.tags;
	}

	// one frame of work; true while a lit count is still easing
	function layout(dt: number) {
		const r = stage.getBoundingClientRect();
		const narrow = r.width < 860;
		const pb = narrow ? panel.getBoundingClientRect().bottom - r.top : 0;
		const k = `${view}|${explore ? xmodel : ""}|${focusD}|${explore}|${r.width | 0}x${r.height | 0}|${pb | 0}`;
		if (!geo || geo.key !== k) build(r, narrow, k);
		else if (geo.ox !== r.left || geo.oy !== r.top) shift(r.left - geo.ox, r.top - geo.oy);
		if (chart.marks !== geo!.marks) { chart.marks = geo!.marks; chart.paths = geo!.paths; chart.texts = geo!.texts; }
		return tween(dt);
	}

	// frames run on demand: an input change kicks one, and an easing count asks for the next
	let raf = 0, last = 0;
	function kick() { if (!raf && stage) raf = requestAnimationFrame(frame); }
	function frame(now: number) {
		raf = 0;
		const dt = Math.min(0.05, (now - last) / 1000); last = now;
		// retake the canvas if a neighbour left it on the plain ground while this section is in view
		if (active && field.mode === "ground") { field.mode = "chart"; field.owner = OWNER; field.dim = 0.75; field.interactive = false; field.hover = null; }
		if (active && field.owner === OWNER && layout(dt)) kick();
	}
	// inputs: the view and its controls, the section coming into view, and the canvas changing hands
	$effect(() => { void [view, xmodel, focusD, explore, active, field.mode, field.owner]; kick(); });

	function go(i: number) {
		const el = root.querySelectorAll(".step")[i];
		if (el) scrollTo({ top: el.getBoundingClientRect().top + scrollY - innerHeight * 0.3, behavior: reduce ? "instant" : "smooth" });
	}

	onMount(() => {
		reduce = matchMedia("(prefers-reduced-motion: reduce)").matches || new URLSearchParams(location.search).has("still");
		meter = document.createElement("canvas").getContext("2d");
		last = performance.now();
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
		io.observe(root);
		const steps = [...root.querySelectorAll(".step")];
		const so = new IntersectionObserver((es) => es.forEach((e) => {
			if (!e.isIntersecting) return;
			step = steps.indexOf(e.target);
			// leaving Explore (scrolling back into the guided steps) clears what the reader picked there
			if (step < LAST) reset();
		}), { rootMargin: "-45% 0px -45% 0px" });
		steps.forEach((s) => so.observe(s));
		// the stage moves while it scrolls in or out; the panel's height sets the field's top on a phone
		const onScroll = () => { if (active) kick(); };
		addEventListener("scroll", onScroll, { passive: true });
		addEventListener("resize", kick, { passive: true });
		const ro = new ResizeObserver(() => kick());
		ro.observe(panel);
		return () => {
			cancelAnimationFrame(raf); raf = 0;
			io.disconnect(); so.disconnect(); ro.disconnect();
			removeEventListener("scroll", onScroll); removeEventListener("resize", kick);
			release(); if (field.owner === OWNER) field.owner = "";
		};
	});
</script>

<section class="wh" id={S.id} data-rq={S.rq} bind:this={root} style="--steps:{S.steps.length}">
	<div class="stick" bind:this={stage}>
		<div class="panel" class:xtiles={explore && view !== "example"} bind:this={panel}>
			<p class="kick"><span class="badge">{S.n}</span>{S.title.t}</p>
			<h2>{S.takeaway.t}</h2>
			<p class="ctx">{S.context.t}</p>
			<!-- data-lag: elastic.ts opens space under the heading while scrolling fast (transforms only; never on the stage) -->
			<div class="say" data-lag="1">
				<p class="say-n">
					{#each S.steps as s, i}<button type="button" class:on={s.view === view} aria-label={fill(U.step, { i: i + 1, n: S.steps.length })} aria-current={s.view === view ? "step" : undefined} onclick={() => go(i)}><i></i></button>{/each}
				</p>
				<div aria-live="polite">{#key say}<p class="say-t">{#if st.head}<b>{st.head.t}</b>{" "}{/if}{say}</p>{/key}</div>
			</div>

			<!-- controls arrive only after the guided steps, under the card -->
			<div data-lag="2"><Reveal show={explore} label={U.explore}>
				<div class="seg" role="group" aria-label={U["x.aria"]}>
					{#each XVIEWS as x}<button type="button" aria-pressed={view === x} onclick={() => choose(x)}>{U[`x.${x}`]}</button>{/each}
				</div>
				{#if view === "example"}
					<button type="button" class="c-why" aria-expanded={open} aria-controls="wh-why" onclick={() => { open = !open; cue = null; }}>{U.explain}<Icon name="arrow" class="c-arrow" /></button>
				{:else if view === "icml"}
					<div class="seg models" role="group" aria-label={U["x.models"]}>
						{#each S.models as m}<button type="button" aria-pressed={xmodel === m.id} style:--c={hue(m)} onclick={() => (xmodel = m.id)}><i class="sw"></i>{m.short}<b>{fill(U.pct, { pct: m.pct })}</b></button>{/each}
					</div>
				{:else if view === "domains"}
					<div class="chips" role="group" aria-label={U["x.domains"]}>
						<button type="button" aria-pressed={dsel === null} onclick={() => (dsel = null)}>{U.all}</button>
						{#each S.domains as d}
							<button type="button" aria-pressed={dsel === d.id} onclick={() => (dsel = dsel === d.id ? null : d.id)} onpointerenter={() => (dpeek = d.id)} onpointerleave={() => (dpeek = null)} onfocus={() => (dpeek = d.id)} onblur={() => (dpeek = null)}><Icon name={ICON[d.id]} />{d.label.t}</button>
						{/each}
					</div>
					{#if focusD}<p class="more">{dom(focusD).more.t}</p>{/if}
				{:else if view === "confidence" && st.more}
					<p class="more">{st.more.t}</p>
				{/if}
			</Reveal></div>
		</div>

		{#if active && view === "domains" && explore}
			{#each hits as h (h.id)}
				{@const d = dom(h.id)}
				<button type="button" class="hit" class:on={dsel === h.id} style="left:{h.x}px; top:{h.y}px; width:{h.w}px; height:{h.h}px" aria-pressed={dsel === h.id} aria-label="{d.label.t}, {fill(U.pct, { pct: d.pct })}" onclick={() => (dsel = dsel === h.id ? null : h.id)} onpointerenter={() => (dpeek = h.id)} onpointerleave={() => (dpeek = null)} onfocus={() => (dpeek = h.id)} onblur={() => (dpeek = null)}></button>
			{/each}
		{/if}

		<!-- the demo: an illustrative review, the paper's prompt, and an answer whose name is never shown -->
		{#if view === "review" || view === "prompt"}
			<figure class="demo" in:fade={{ duration: T(300) }} out:fade={{ duration: T(250) }}>
				<p class="d-label"><span class="d-chip">{D.label}</span><span class="d-note">{D["label.sub"]}</span></p>
				<div class="d-stack">
					{#if view === "review"}
						<article class="d-review" in:into={{ dir: "in" }} out:into={{ dir: "out" }}>
							<p class="d-head"><Icon name="incognito" />{D["review.head"]}</p>
							{#each [1, 2, 3] as i}<p class="d-par"><b>{D[`review.k${i}`]}.</b> {D[`review.t${i}`]}</p>{/each}
							<p class="d-who">{D["review.who"]}</p>
						</article>
					{:else}
						<div class="d-flow">
							<div class="d-prompt" in:fade={{ duration: T(160) }}>
								<p class="d-head"><Icon name="list" />{D["prompt.head"]}</p>
								<p class="d-task">{#each S.prompt.task as seg}{#if seg.b}<b>{seg.t}</b>{:else}{seg.t}{/if}{/each}</p>
								<div class="d-slot" in:into={{ dir: "in" }} out:into={{ dir: "out" }}>
									<p class="d-slot-k"><Icon name="incognito" />{D["prompt.slot"]}</p>
									<p class="d-slot-t"><b>{D["review.k1"]}.</b> {D["review.t1"]} <b>{D["review.k2"]}.</b> {D["review.t2"]}</p>
								</div>
								<p class="d-fields">{#each S.prompt.fields as f}<span><b>{f.k}</b> &lt;{f.v}&gt;</span>{/each}</p>
							</div>
							<div class="d-answer" in:fly={{ y: 10, duration: T(420), delay: T(1000) }}>
								<p class="d-by"><Icon name="ai" class="fable" />{FAB.name}</p>
								<p class="d-ans">
									<b>{S.prompt.fields[1].k}</b>
									<span class="redact" role="img" aria-label={D["answer.hidden"]}><span class="redact-t">{D["answer.hidden"]}</span></span>
									<span class="d-ok"><Icon name="check" class="ok" />{D["answer.verdict"]}</span>
								</p>
							</div>
						</div>
					{/if}
				</div>
				<p class="d-priv"><Icon name="eye-off" />{S.privacy.t}</p>
			</figure>
		{/if}

		{#if priv && active}
			<p class="priv" style="left:{priv.x}px; top:{priv.y}px; width:{priv.w}px" transition:fade={{ duration: T(250) }}><Icon name="eye-off" />{S.privacy.t}</p>
		{/if}

		{#if view === "example"}
			{@const E = S.example}
			<figure class="card">
				<p class="c-src"><Icon name="book" />{E.kind.t}: <em>{E.title.t}</em></p>
				<blockquote class="c-text" class:open>
					“{#each E.text as seg}{#if seg.cue && open}<span role="button" tabindex="0" class="cue {seg.cue}" class:dim={!lit(seg.cue)} aria-pressed={cue === seg.cue} onclick={() => pick(seg.cue!)} onkeydown={(e) => key(e, seg.cue!)}>{seg.t}</span>{:else}{seg.t}{/if}{/each}”
				</blockquote>
				<div class="c-pred">
					<span class="c-role">{U.role}</span>
					<span class="c-ans"><Icon name="check" class="ok" />{E.answer}</span>
					<span class="c-conf">{fill(U.conf, { n: E.confidence })}</span>
					<span class="c-by"><Icon name="ai" class="fable" />{E.model}</span>
				</div>
				<div id="wh-why" class="c-x" hidden={!open}>
					<p>“{#each E.explanation as seg}{#if seg.cue}<span role="button" tabindex="0" class="cue {seg.cue}" class:dim={!lit(seg.cue)} aria-pressed={cue === seg.cue} onclick={() => pick(seg.cue!)} onkeydown={(e) => key(e, seg.cue!)}>{seg.t}</span>{:else}{seg.t}{/if}{/each}”</p>
					<p class="c-note">{E.note.t}</p>
				</div>
			</figure>
		{/if}
	</div>
	{#if active}<Tags items={tags} />{/if}
	<!-- invisible scroll triggers: each one advances the sentence in the panel and what the field draws -->
	<div class="steps" aria-hidden="true">{#each S.steps as _}<div class="step"></div>{/each}</div>
</section>

<style>
	.wh { position: relative; margin-top: 40px; height: calc(var(--steps) * 62vh + 70vh); }
	.stick { position: sticky; top: 0; height: 100vh; pointer-events: none; }
	.panel { pointer-events: auto; position: absolute; left: 0; top: 56px; width: min(33%, 350px); display: grid; gap: 11px; }
	.kick { display: flex; align-items: center; gap: 10px; font-size: 14px; font-weight: 600; color: var(--ink2); }
	.badge { display: inline-grid; place-items: center; width: 26px; height: 26px; border-radius: 2px; background: var(--rq3); color: #fff; font-size: 13px; }
	h2 { font-size: clamp(22px, 2.3vw, 29px); line-height: 1.15; font-weight: 600; letter-spacing: -0.025em; text-wrap: balance; }
	.ctx { font-size: 14px; line-height: 1.45; color: var(--ink2); }
	.say { display: grid; gap: 12px; padding: 14px 16px; background: #fff; border-radius: 3px; }
	.say-n { display: flex; gap: 1px; margin: -6px 0 -6px -5px; }
	.say-n button { padding: 6px 5px; }
	.say-n i { display: block; width: 18px; height: 3px; border-radius: 2px; background: var(--rule); transition: background-color .2s; }
	.say-n button:hover i { background: var(--axis); }
	.say-n button.on i { background: var(--ink); }
	.say-t { font-size: 16px; line-height: 1.5; animation: say .45s var(--ease); }
	.say-t b { font-weight: 600; }
	@keyframes say { from { opacity: 0; transform: translateY(6px); } }
	.seg { display: inline-flex; flex-wrap: wrap; gap: 2px; justify-self: start; padding: 3px; background: var(--chip); border-radius: 3px; }
	.seg button, .chips button { display: inline-flex; align-items: center; gap: 6px; padding: 5px 9px; font-size: 12.5px; font-weight: 500; color: var(--ink2); border-radius: 2px; transition: background-color .15s, color .15s; }
	.seg button b { font-weight: 600; font-variant-numeric: tabular-nums; color: var(--ink); }
	.seg button:hover, .chips button:hover { color: var(--ink); }
	.seg button[aria-pressed="true"] { background: var(--ink); color: var(--field); }
	.seg button[aria-pressed="true"] b { color: var(--field); }
	.models .sw { flex: none; width: 9px; height: 9px; border-radius: 1px; background: var(--c); }
	.models button[aria-pressed="true"] .sw { box-shadow: 0 0 0 1.5px var(--field); }
	.chips { display: flex; flex-wrap: wrap; gap: 4px; }
	.chips button { background: var(--field); }
	.chips button[aria-pressed="true"] { background: var(--ink); color: var(--field); }
	.more { font-size: 13.5px; line-height: 1.5; color: var(--ink2); animation: say .35s var(--ease); }

	/* hit areas over the drawn sets in Explore: hover previews, click selects (the tiles take no pointer events) */
	.hit { position: absolute; pointer-events: auto; border-radius: 3px; cursor: pointer; }
	.hit:hover { box-shadow: inset 0 0 0 1px rgba(20, 32, 45, .14); }

	/* the demo */
	.demo { position: absolute; left: 40%; right: 24px; top: max(84px, calc(50% - 235px)); max-width: 600px; display: grid; gap: 10px; }
	.d-label { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; }
	.d-chip { padding: 3px 8px; border: 1.25px dashed var(--ink2); border-radius: 2px; font-size: 11px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--ink); }
	.d-note { font-size: 12px; color: var(--ink2); }
	.d-stack { display: grid; }
	.d-stack > :global(*) { grid-area: 1 / 1; align-self: start; }
	.d-review { display: grid; gap: 8px; padding: 18px 20px; background: #fff; border-radius: 3px; }
	.d-head { display: flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--ink2); }
	.d-par { font-size: 16px; line-height: 1.5; }
	.d-par b, .d-slot-t b { font-weight: 600; }
	.d-who { margin-top: 4px; padding-top: 10px; border-top: 1px solid var(--rule); font-size: 13px; color: var(--ink2); }
	.d-flow { display: grid; gap: 10px; }
	.d-prompt { display: grid; gap: 10px; padding: 16px 18px; background: var(--field); border: 1px solid var(--rule); border-radius: 3px; }
	.d-task { font-size: 14px; line-height: 1.5; }
	.d-task b, .d-fields b { font-weight: 600; }
	.d-slot { display: grid; gap: 3px; padding: 10px 12px; background: #fff; border-radius: 3px; box-shadow: 0 1px 0 var(--rule); }
	.d-slot-k { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--ink2); }
	.d-slot-t { font-size: 13px; line-height: 1.45; color: var(--ink); display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
	.d-fields { display: flex; flex-wrap: wrap; gap: 2px 16px; font-size: 13px; color: var(--ink2); }
	.d-fields span { white-space: nowrap; }
	.d-answer { display: grid; gap: 8px; padding: 14px 18px; background: #fff; border-radius: 3px; border-left: 3px solid var(--fable); }
	.d-by { display: flex; align-items: center; gap: 6px; font-size: 12.5px; font-style: italic; font-weight: 500; }
	.d-by :global(.fable), .c-by :global(.fable) { color: var(--fable); }
	.d-ans { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; font-size: 15px; }
	.d-ans b { font-weight: 600; }
	.redact { display: inline-grid; place-items: center; width: 150px; height: 24px; border-radius: 2px; background: var(--ink); }
	.redact-t { font-size: 10px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: rgba(243, 243, 239, .72); }
	.d-ok { display: inline-flex; align-items: center; gap: 5px; font-size: 14px; font-weight: 600; white-space: nowrap; }
	.d-ok :global(.ok) { color: var(--ok); }
	.d-priv, .priv { display: flex; gap: 7px; font-size: 12px; line-height: 1.45; color: var(--ink2); }
	.d-priv :global(.ic), .priv :global(.ic) { flex: none; margin-top: 2px; }
	.priv { position: absolute; margin: 0; }

	/* the worked example */
	.card { pointer-events: auto; position: absolute; left: 40%; right: 24px; top: 50%; transform: translateY(-50%); max-width: 600px; display: grid; gap: 14px; padding: 22px 24px; background: #fff; border-radius: 3px; animation: card .5s var(--ease); }
	@keyframes card { from { opacity: 0; transform: translateY(calc(-50% + 10px)); } }
	.c-src { display: flex; align-items: center; gap: 7px; font-size: 13px; color: var(--ink2); }
	.c-text { font-size: 20px; line-height: 1.55; letter-spacing: -0.01em; color: var(--ink); }
	.c-pred { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 14px; padding-top: 12px; border-top: 1px solid var(--rule); }
	.c-role { width: 100%; font-size: 11px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--ink2); }
	.c-ans { display: inline-flex; align-items: center; gap: 6px; font-size: 22px; font-weight: 600; letter-spacing: -0.02em; }
	.c-ans :global(.ok) { color: var(--ok); }
	.c-conf { font-size: 13px; color: var(--ink2); font-variant-numeric: tabular-nums; }
	.c-by { display: inline-flex; align-items: center; gap: 5px; margin-left: auto; font-size: 12.5px; font-style: italic; font-weight: 500; }
	.c-why { justify-self: start; display: inline-flex; align-items: center; gap: 7px; padding: 7px 12px; border: 1.25px solid var(--ink); border-radius: 2px; font-size: 13px; font-weight: 500; transition: background-color .15s, color .15s; }
	.c-why:hover { background: var(--ink); color: var(--field); }
	.c-why :global(.c-arrow) { transition: transform .25s var(--ease); }
	.c-why[aria-expanded="true"] :global(.c-arrow) { transform: rotate(90deg); }
	.c-x { display: grid; gap: 8px; padding: 14px 16px; background: var(--field); border-radius: 3px; font-size: 15px; line-height: 1.55; }
	.c-x[hidden] { display: none; }
	.c-note { font-size: 12px; color: var(--ink2); }
	.cue { cursor: pointer; padding: 0 .12em; margin: 0 -.02em; border-radius: 2px; box-decoration-break: clone; -webkit-box-decoration-break: clone; transition: background-color .25s, color .25s, opacity .25s; }
	.cue.rose { color: var(--cue-rose); background: var(--cue-rose-bg); }
	.cue.teal { color: var(--cue-teal); background: var(--cue-teal-bg); }
	.cue.clay { color: var(--cue-clay); background: var(--cue-clay-bg); }
	.cue[aria-pressed="true"] { box-shadow: inset 0 -2px 0 currentColor; }
	.cue.dim { background: transparent; color: var(--ink); opacity: .55; }

	.steps { position: absolute; inset: 0; pointer-events: none; }
	.step { height: 62vh; }
	.step:first-child { margin-top: 20vh; }
	@media (min-width: 861px) and (max-height: 780px) {
		.panel { top: 36px; gap: 8px; }
		.panel .ctx { display: none; }
		h2 { font-size: 22px; }
		.say { gap: 9px; padding: 12px 14px; }
		.say-t { font-size: 15px; }
		.more { font-size: 12.5px; }
		.demo { top: 56px; gap: 8px; }
		.d-par { font-size: 15px; }
	}
	@media (max-width: 860px) {
		.panel { width: auto; right: 0; top: 14px; gap: 8px; }
		.panel .ctx { display: none; }
		/* Explore on a phone: the field needs the room, and the guided sentence was read already; Explore's own
		   sentence (under its controls) describes the view */
		.panel.xtiles .say { display: none; }
		h2 { font-size: 20px; }
		.say { padding: 10px 12px; gap: 8px; }
		.say-t { font-size: 14.5px; }
		.more { font-size: 12.5px; }
		.demo { left: 0; right: 0; top: auto; bottom: 14px; gap: 8px; }
		.d-stack > :global(*) { align-self: end; }
		.d-review { padding: 14px 16px; gap: 6px; }
		.d-par { font-size: 14px; line-height: 1.45; }
		.d-prompt { padding: 12px 14px; gap: 8px; }
		.d-task { font-size: 13px; }
		.d-answer { padding: 10px 14px; }
		.d-ans { font-size: 14px; }
		.redact { width: 110px; }
		.d-priv, .priv { font-size: 11px; }
		.card { left: 0; right: 0; top: auto; bottom: 16px; transform: none; max-height: 54vh; overflow: auto; padding: 16px; }
		@keyframes card { from { opacity: 0; } }
		.c-text { font-size: 17px; }
	}
	@media (prefers-reduced-motion: reduce) { .say-t, .more, .card { animation: none; } .cue, .c-why :global(.c-arrow) { transition: none; } }
</style>
