<script lang="ts" module>
	// Its footnotes, which the page registers before the section wakes (Defer.svelte), so the notes list and the marks' numbers
	// are complete from the start.
	import S from "./which_ai.json";
	export const FOOTNOTES = { id: "wa", notes: S.notes };
</script>

<script lang="ts">
	// If AI, which AI? (fourth pass, after Atrey's user testing, 16 Nov: "collapse square blocks into bars", "bring the
	// hovered info out", "emphasize timeline x axis is model releases", "there's no headline number", "threads like in a
	// crime scene"). Three blocks, top to bottom:
	//   1. the chapter opener (SectionOpener);
	//   2. bars: one bar per writing model, the share of its texts Claude Fable 5.2 credits to the model's own lab, in a
	//      row per lab along a model release date axis, with the number above every bar; the narration is a caption band
	//      above, with the headline 98% at chapter size on its step;
	//   3. a thread map: the models the steps name, pinned, a thread from each to the lab Fable mistakes it for (thicker
	//      for a larger share, the share on the thread), then a step that says what the reports are (paper text), and the
	//      four reports pinned beside them as evidence, one a step (the three reports labelled as such).
	// DOM and SVG inside sticky stages, so nothing follows the scroll in script. Geometry depends on the size and fonts
	// only, never the step; steps change colour, opacity and which labels show. The shown step follows the scroll one
	// step at a time, each held at least HOLD ms, and snaps when the section is off screen or a dash is clicked.
	import { onMount } from "svelte";
	import Icon from "./Icon.svelte";
	import Tags, { type Tag } from "./Tags.svelte";
	import SectionOpener from "./SectionOpener.svelte";
	import StepDashes from "./StepDashes.svelte";
	import Footnotes from "./Footnotes.svelte";
	import HoverCue from "./HoverCue.svelte";
	import { field, chart, regions } from "./field.svelte";
	import { onScroll as onPageScroll, view as vp, lite, deliberate } from "./loop";
	import { LAB, INK, GRAY } from "./palette";
	import R from "./rq2_writers.json";

	type W = (typeof R.writers)[number];
	type K = "anthropic" | "openai" | "other" | "own";
	type Hub = "anthropic" | "openai";
	type Step = { part: string; color?: boolean; big?: string; focus?: string[]; event?: string; t: string };
	type BarIt = { w: W; tx: number; x: number; half: number; own: number; name: string; phoneName: boolean };
	type BarRow = { lab: string; top: number; base: number; items: BarIt[] };
	type BarsGeo = { rows: BarRow[]; lx: number; rx: number; rh: number; trackH: number; barW: number; numH: number; axisY: number; ticks: { x: number; t: string }[]; brk: number; h: number };
	type BNode = { w: W; x: number; y: number; nw: number; nh: number };
	type BHub = { k: Hub; x: number; y: number; hw: number; hh: number };
	type BThread = { id: string; w: W; k: Hub; pct: number; d: string; sw: number; x0: number; y0: number; x1: number; y1: number; lx: number; ly: number; lw: number };
	type BoardGeo = { nodes: BNode[]; hubs: BHub[]; threads: BThread[]; lh: number };

	// every displayed string that is not paper text is listed in which_ai.json's ui
	const u = (t: string) => (S.ui.includes(t) ? t : (console.warn("which_ai: ui string not listed:", t), t));
	const ORDER = ["Anthropic", "Google", "OpenAI", "Moonshot", "Zhipu", "Alibaba", "MiniMax", "xAI", "DeepSeek", "Mistral", "Cohere"];
	const BIG = new Set(["Anthropic", "Google", "OpenAI"]);
	const STEPS = S.steps as Step[];
	const NB = STEPS.filter((s) => s.part === "bars").length, LAST = STEPS.length - 1;
	// scroll per step, in viewport heights: 0.6, or 0.75 where the step animates (the bars grow, the threads draw)
	const LEN = STEPS.map((s, i) => ((s.color && !STEPS[i - 1]?.color) || i === NB ? 0.75 : 0.6));
	const starts = (a: number, b: number) => LEN.slice(a, b).reduce((c, l) => [...c, c[c.length - 1] + l], [0]);
	const BC = starts(0, NB), KC = starts(NB, STEPS.length); // each block's step boundaries, in viewport heights
	const HOLD = 350; // ms: the least time a step stays on screen while the reader scrolls fast
	const SAY = STEPS.map((x) => x.t.replace(/-(?=\d)/g, "‑"));
	// which lab Fable named: the lab colours (palette.ts LAB)
	const COL: Record<K | "google", string> = { anthropic: LAB.Anthropic, openai: LAB.OpenAI, google: LAB.Google, other: LAB.other, own: LAB.own };
	const NAME = Object.fromEntries(S.legend.map((l) => [l.k, l.t])) as Record<K, string>;
	const byLab = Object.fromEntries(ORDER.map((lab) => [lab, R.writers.filter((w) => w.lab === lab).sort((a, b) => (a.release ?? "").localeCompare(b.release ?? ""))])) as Record<string, W[]>;
	// a model's name as the writer table gives it, without the snapshot date in brackets ("Kimi K2 (0905)" -> "Kimi K2")
	const nameOf = (w: W) => w.writer.replace(/\s*\(\d{4}\)$/, "");
	const pct = (w: W, k: K) => Math.round((w[k] / w.n) * 100);
	// a bar takes the colour of the lab Fable names when it is right: Anthropic, Google and OpenAI in their own hues,
	// every other lab as "the writer's own lab"
	const barCol = (w: W) => (BIG.has(w.lab) ? LAB[w.lab as "Anthropic" | "Google" | "OpenAI"] : LAB.own);
	const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
	const day = (d: string) => { const [y, m, dd] = d.split("-").map(Number); return Date.UTC(y, m - 1, dd ?? 1); };
	const monthYear = (d: string) => new Date(day(d)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
	const monYear = (d: string) => { const [y, m] = d.split("-").map(Number); return `${MON[m - 1]} ${y}`; };
	const dateLabel = (d: string) => { const [y, m, dd] = d.split("-").map(Number); return `${dd ? dd + " " : ""}${MON[m - 1]} ${y}`; };
	const tick = (t: number) => { const d = new Date(t); return `${MON[d.getUTCMonth()]} ’${String(d.getUTCFullYear()).slice(2)}`; };
	const F = (wt: number, px: number) => `${wt} ${px}px Inter, system-ui, sans-serif`;
	const TAG_F = F(600, 12.5);
	const hit = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
	// a dimmed bar: its colour mostly washed into the ground
	const wash = (hex: string, t = 0.28) => { const a = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)), g = [1, 3, 5].map((i) => parseInt(INK.ground.slice(i, i + 2), 16)); return "#" + a.map((v, i) => Math.round(g[i] + (v - g[i]) * t).toString(16).padStart(2, "0")).join(""); };

	// the release axis: one linear scale from mid-February 2025, and a stub before a break for the one earlier release
	// (Qwen2.5 72B, September 2024), so all 34 models are on it without half the width going to an empty year
	const A0 = Date.UTC(2025, 1, 15), A1 = Date.UTC(2026, 10, 20);
	const EARLY = R.writers.filter((w) => w.release && day(w.release) < A0).map((w) => w.release!).sort()[0];

	// the reports, in date order: the date and named labs from rq2_writers.json, the card's words from which_ai.json
	const SRC = Object.fromEntries(S.sources.map((s) => [s.id, s])) as Record<string, (typeof S.sources)[number] & { cut?: boolean }>;
	const EVS = S.reports.map((r) => {
		const e = R.events.find((x) => x.name === r.event)!;
		const step = STEPS.findIndex((s) => s.event === r.event);
		return { ...r, date: e.date, labs: e.labs, col: r.by === "anthropic" ? LAB.Anthropic : LAB.OpenAI, dash: r.by === "openai", src: SRC[r.source], step };
	});
	// the board: the models the steps name (their focus lists), by lab, the labs Fable most often mistakes for Claude on
	// top; a thread to Anthropic or OpenAI wherever Fable credits that lab with 10% or more of the model's texts
	const NAMED = new Set(STEPS.flatMap((s) => s.focus ?? []));
	const BAR_NAMED = new Set(STEPS.slice(0, NB).flatMap((s) => s.focus ?? [])); // the models a bars step names
	const meanA = (lab: string) => { const ws = byLab[lab].filter((w) => NAMED.has(w.writer)); return ws.reduce((t, w) => t + w.anthropic / w.n, 0) / ws.length; };
	const BOARD_LABS = ORDER.filter((l) => byLab[l].some((w) => NAMED.has(w.writer))).sort((a, b) => meanA(b) - meanA(a) || ORDER.indexOf(a) - ORDER.indexOf(b));
	const BOARD = BOARD_LABS.flatMap((l) => byLab[l].filter((w) => NAMED.has(w.writer)));
	const LINKS = BOARD.flatMap((w) => (["anthropic", "openai"] as Hub[]).filter((k) => pct(w, k) >= 10).map((k) => ({ w, k, pct: pct(w, k) })));
	const HUB = { anthropic: { t: u("Claude"), lab: u("Anthropic"), icon: "anthropic" }, openai: { t: u("GPT"), lab: u("OpenAI"), icon: "openai" } };
	// the hero's three big-lab prints for the opener, in their light steps so they read on the dark band
	const PRINTS = [
		{ family: "lab" as const, index: 0, color: "#DC89A7", label: u("Anthropic"), icon: "anthropic" },
		{ family: "lab" as const, index: 1, color: "#8CB5C0", label: u("OpenAI"), icon: "openai" },
		{ family: "lab" as const, index: 2, color: "#9A82B4", label: u("Google"), icon: "google" },
	];

	// text widths for layout, measured once per string and font
	const widths = new Map<string, number>();
	let mctx: CanvasRenderingContext2D | null = null, mfont = "";
	function tw(t: string, font: string) {
		const key = font + "|" + t;
		let v = widths.get(key);
		if (v === undefined) {
			mctx ??= document.createElement("canvas").getContext("2d")!;
			if (font !== mfont) { mctx.font = font; mfont = font; } // (setting a font parses it, even the same one)
			v = mctx.measureText(t).width;
			widths.set(key, v);
		}
		return v;
	}
	// a Tags chip's width: padding, swatch, gap and words
	const tagW = (t: string) => 16 + 10 + 6 + tw(t, TAG_F);

	// items in a row pushed apart until none overlaps, inside [lo, hi]; each keeps its true place for a tick
	function spread<T extends { x: number; half: number }>(items: T[], lo: number, hi: number) {
		for (let it = 0; it < 60; it++) {
			let moved = false;
			for (let i = 1; i < items.length; i++) {
				const a = items[i - 1], b = items[i], d = a.half + b.half - (b.x - a.x);
				if (d > 0.5) { a.x -= d / 2; b.x += d / 2; moved = true; }
			}
			if (items.length) {
				items[0].x = Math.max(items[0].x, lo + items[0].half);
				const z = items[items.length - 1];
				z.x = Math.min(z.x, hi - z.half);
			}
			if (!moved) break;
		}
	}

	// ---- 1. the bars: a row per lab, a bar per model at its release date ---------------------------------------------
	function barsLayout(w: number, h: number, narrow: boolean): BarsGeo {
		const hf = F(600, narrow ? 11 : 12.5), nf = F(600, narrow ? 9.5 : 11), mf = F(500, narrow ? 9 : 10.5);
		// a wide screen names every model under its bar; a phone names a model only on the step that names it, over its
		// number, so a name and its number read as one label
		const axisH = narrow ? 40 : 42, numH = narrow ? 22 : 14, nameH = narrow ? 5 : 14;
		const lx = Math.max(...ORDER.map((l) => tw(l, hf))) + (narrow ? 8 : 20), rx = w - (narrow ? 2 : 6);
		const stub = narrow ? 24 : 36, gap = narrow ? 14 : 22, x0 = lx + stub + gap;
		const X = (t: number) => (t < A0 ? lx + stub / 2 : x0 + ((t - A0) / (A1 - A0)) * (rx - x0));
		const rh = (h - axisH) / ORDER.length, trackH = Math.max(10, rh - numH - nameH - 2), barW = narrow ? 7 : 18;
		const rows: BarRow[] = ORDER.map((lab, ri) => {
			const top = ri * rh, base = top + numH + trackH;
			// a phone names only the models the steps name (one at a time), a wider screen every model
			const items = byLab[lab].filter((x) => x.release).map((x) => {
				const own = pct(x, "own"), name = nameOf(x), phoneName = BAR_NAMED.has(x.writer);
				const nw = narrow ? (phoneName ? tw(name, mf) : 0) : tw(name, mf);
				const tx = X(day(x.release!));
				return { w: x, tx, x: tx, half: Math.max(barW, tw(`${own}%`, nf), nw) / 2 + (narrow ? 2.5 : 5), own, name, phoneName };
			});
			spread(items, lx, rx);
			return { lab, top, base, items };
		});
		const axisY = rows.length * rh + 2, ticks: BarsGeo["ticks"] = [];
		if (EARLY) ticks.push({ x: lx + stub / 2, t: tick(day(EARLY)) });
		for (let k = 0; ; k += narrow ? 6 : 3) {
			const t = Date.UTC(2025, 3 + k + (narrow ? 3 : 0), 1);
			if (t > A1) break;
			ticks.push({ x: X(t), t: tick(t) });
		}
		return { rows, lx, rx, rh, trackH, barW, numH, axisY, ticks, brk: lx + stub + gap / 2, h };
	}

	// ---- 2. the board: models on the left, Claude and GPT on the right, threads between ------------------------------
	function boardLayout(w: number, h: number, narrow: boolean): BoardGeo {
		const nw = narrow ? Math.min(150, w * 0.42) : 200, nh = narrow ? 34 : 46, hw = narrow ? 96 : 184, hh = narrow ? 48 : 66;
		const lf = F(600, narrow ? 10 : 11.5), lh = narrow ? 16 : 19;
		// the cards, in lab groups: a little room between groups, less within
		let gIn = narrow ? 5 : 9, gOut = narrow ? 11 : 20;
		const groups = BOARD.map((x, i) => (i && x.lab !== BOARD[i - 1].lab ? 1 : 0) as number);
		const need = () => BOARD.length * nh + groups.reduce((t, g, i) => t + (i ? (g ? gOut : gIn) : 0), 0);
		if (need() > h) { const k = Math.max(0, (h - BOARD.length * nh) / (need() - BOARD.length * nh)); gIn *= k; gOut *= k; }
		let y = Math.max(0, (h - need()) / 2);
		const nodes: BNode[] = BOARD.map((x, i) => { if (i) y += groups[i] ? gOut : gIn; const n = { w: x, x: 0, y, nw, nh }; y += nh; return n; });
		const cy = (n: BNode) => n.y + n.nh / 2;
		// each hub level with the middle of the models threaded to it, apart from the other
		const hubs: BHub[] = (["anthropic", "openai"] as Hub[]).map((k) => {
			const src = LINKS.filter((l) => l.k === k).map((l) => cy(nodes[BOARD.indexOf(l.w)]));
			return { k, x: w - hw, y: src.reduce((a, b) => a + b, 0) / src.length - hh / 2, hw, hh };
		});
		const [ha, ho] = hubs, room = narrow ? 18 : 40;
		if (ha.y + hh + room > ho.y) { const d = (ha.y + hh + room - ho.y) / 2; ha.y -= d; ho.y += d; }
		for (const b of hubs) b.y = Math.max(0, Math.min(h - hh, b.y));
		if (ho.y < ha.y + hh + 8) ho.y = Math.min(h - hh, ha.y + hh + 8);
		// threads: from the right edge of a model's card to the hub's left edge, the ends spread down the hub; a slight
		// sag, like string between pins
		const threads: BThread[] = [];
		const placed: { x: number; y: number; w: number; h: number }[] = [...nodes.map((n) => ({ x: n.x, y: n.y, w: n.nw, h: n.nh })), ...hubs.map((b) => ({ x: b.x, y: b.y, w: b.hw, h: b.hh }))];
		for (const b of hubs) {
			const ls = LINKS.filter((l) => l.k === b.k);
			ls.forEach((l, j) => {
				const n = nodes[BOARD.indexOf(l.w)], src = LINKS.filter((m) => m.w === l.w);
				const x0 = n.x + n.nw, y0 = cy(n) + (src.length > 1 ? (src.indexOf(l) - (src.length - 1) / 2) * (narrow ? 8 : 12) : 0);
				const x1 = b.x, y1 = b.y + b.hh * (ls.length > 1 ? 0.2 + (0.6 * j) / (ls.length - 1) : 0.5);
				const dx = x1 - x0, sag = Math.min(narrow ? 10 : 26, dx * 0.08);
				const c1 = [x0 + dx * 0.45, y0 + sag], c2 = [x1 - dx * 0.45, y1 + sag];
				const at = (t: number) => { const m = 1 - t; return [m * m * m * x0 + 3 * m * m * t * c1[0] + 3 * m * t * t * c2[0] + t * t * t * x1, m * m * m * y0 + 3 * m * m * t * c1[1] + 3 * m * t * t * c2[1] + t * t * t * y1]; };
				// the share sits on the thread where it hides no card and no other share
				const lw = tw(`${l.pct}%`, lf) + (narrow ? 8 : 12);
				let best = at(0.3);
				for (const t of [0.3, 0.4, 0.22, 0.5, 0.6, 0.16, 0.7, 0.8]) {
					const [px, py] = at(t), r = { x: px - lw / 2 - 2, y: py - lh / 2 - 2, w: lw + 4, h: lh + 4 };
					if (!placed.some((q) => hit(r, q))) { best = [px, py]; break; }
				}
				placed.push({ x: best[0] - lw / 2, y: best[1] - lh / 2, w: lw, h: lh });
				threads.push({ id: `${l.w.writer}>${l.k}`, w: l.w, k: l.k, pct: l.pct, d: `M${x0},${y0} C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${x1},${y1}`, sw: (narrow ? 1 : 1.25) + (l.pct / 100) * (narrow ? 3.2 : 5.5), x0, y0, x1, y1, lx: best[0], ly: best[1], lw });
			});
		}
		return { nodes, hubs, threads, lh };
	}

	// ---- state -----------------------------------------------------------------------------------------------------
	let step = $state(0); // the step shown
	let prog = $state(0); // 0..1 through the shown step's stretch of scroll, for the dashes
	let active = $state(false);
	let still = $state(false);
	let narrow = $state(false);
	let fontsV = $state(0);
	let bw = $state(0), bh = $state(0), kw = $state(0), kh = $state(0), fw = $state(0);
	let hov = $state.raw<BarIt | null>(null); // raw: the leave test compares it with the bar itself (a proxy never equals it)
	let tapType = "mouse";
	let root: HTMLElement, body: HTMLElement, barsBlk: HTMLElement, boardBlk: HTMLElement;

	const bs = $derived(Math.min(step, NB - 1)); // the bars' step (it stays put while the board is in view)
	const ks = $derived(Math.max(step, NB)); // the board's step
	const barSt = $derived(STEPS[bs]);
	const barFocus = $derived(new Set(barSt.focus ?? []));
	const grown = $derived(bs >= 1 && !!barSt.color);
	// the hover cue (beside the key) goes once a bar's card has been seen: a bar hovered or tapped while the bars are up
	let tried = $state(false);
	$effect(() => { if (hov && grown) tried = true; });
	const curEv = $derived(EVS.find((e) => e.step === ks) ?? null);
	const kFocus = $derived(new Set(STEPS[ks].focus ?? []));
	// the bars lit at a step: the step's models where it names some, else Anthropic, Google and OpenAI once the colour is on
	const barLit = (x: W) => (barFocus.size ? barFocus.has(x.writer) : BIG.has(x.lab));
	// on the board, a report lights the models of the labs it names; the first step lights them all
	const nodeLit = (x: W) => !curEv || curEv.labs.includes(x.lab);
	// and of their threads only those to the lab the report is about (Anthropic's reports: Claude; OpenAI's memo and
	// the testimony about OpenAI models: GPT)
	const threadLit = (t: BThread) => !curEv || (curEv.labs.includes(t.w.lab) && t.k === curEv.by);
	const evState = (i: number) => (ks === EVS[i].step ? "on" : ks > EVS[i].step ? "past" : "hide");

	const barsG = $derived.by(() => { void fontsV; return bw > 0 && bh > 0 ? barsLayout(bw, bh, narrow) : null; });
	const boardG = $derived.by(() => { void fontsV; return kw > 0 && kh > 0 ? boardLayout(kw, kh, narrow) : null; });

	// the colour key: one row of Tags chips (a phone shortens "Writer's own lab")
	const keyTags = $derived.by(() => {
		void fontsV;
		const items: Tag[] = [];
		if (!fw) return { items, h: 26 }; // measured in the browser only (also keeps the server render free of canvas)
		let x = 0, row = 0;
		(["anthropic", "google", "openai", "own"] as const).forEach((k) => {
			const t = k === "google" ? u("Google") : k === "own" && narrow ? u("Own lab") : NAME[k], w = tagW(t);
			if (x > 0 && x + w > fw) { x = 0; row++; }
			items.push({ id: `k-${k}`, x: x - 10, y: row * 30 + 13, t, color: COL[k], swatch: "square", at: "right" });
			x += w + 6;
		});
		return { items, h: (row + 1) * 30 - 4 };
	});

	// what Fable named for a model's texts, largest share first; the model's own lab by its name
	const tipRows = $derived(hov ? (["anthropic", "openai", "other", "own"] as K[]).filter((k) => hov!.w[k] > 0).map((k) => ({ k, t: k === "own" ? `${hov!.w.lab} (own lab)` : k === "other" ? u("Another lab") : NAME[k], pct: pct(hov!.w, k) })).sort((a, b) => b.pct - a.pct) : []);

	// ---- the step: the scroll position asks for one; the shown step walks there one at a time ----------------------
	let want = 0, shownAt = 0, goal = -1, wasOn = false;
	let holdT: ReturnType<typeof setTimeout> | undefined, goalT: ReturnType<typeof setTimeout> | undefined;
	const at = (c: number[], q: number) => { let i = 0; while (i < c.length - 2 && q >= c[i + 1]) i++; return i; };
	function show(s: number) { if (s !== step) { step = s; shownAt = performance.now(); } }
	function onScreen() { const r = body.getBoundingClientRect(); return r.bottom > 0 && r.top < (vp.h || innerHeight); }
	function settle(snap = false) {
		clearTimeout(holdT); holdT = undefined;
		if (want === step) return;
		// off screen, just arrived on screen in one jump (a link, a reload) or settled motion: no queue, the shown
		// step is the asked one
		// (the lighter mode for phones: the step follows the scroll directly; a momentum scroll is not held back)
		if (snap || still || lite.on || !onScreen()) { show(want); return; }
		const wait = HOLD - (performance.now() - shownAt);
		if (wait > 0) { holdT = setTimeout(settle, wait); return; }
		show(step + Math.sign(want - step));
		if (want !== step) holdT = setTimeout(settle, HOLD);
	}
	// the bars' steps while they are pinned, the board's once its stage is half up
	function readStep() {
		if (!barsBlk) return;
		const H = vp.h || innerHeight, rb = barsBlk.getBoundingClientRect(), rk = boardBlk.getBoundingClientRect();
		const board = rk.top < H * 0.5, c = board ? KC : BC, q = Math.max(0, -(board ? rk.top : rb.top) / H), k = at(c, q);
		want = (board ? NB : 0) + k;
		// a dash or footnote jump shows its step at once; the positions the scroll passes on the way are not steps
		const on = onScreen(), arrived = on && !wasOn;
		wasOn = on;
		if (goal >= 0) { if (want !== goal) return; goal = -1; clearTimeout(goalT); }
		settle(arrived);
		const p = Math.max(0, Math.min(1, (q - c[k]) / (c[k + 1] - c[k])));
		prog = want === step ? p : want > step ? 1 : 0;
	}
	// a dash (or a footnote's ↩) scrolls to the middle of its step and shows it at once
	function go(i: number, instant = false) {
		const board = i >= NB, c = board ? KC : BC, k = board ? i - NB : i, blk = board ? boardBlk : barsBlk;
		goal = i; clearTimeout(goalT); clearTimeout(holdT);
		goalT = setTimeout(() => { goal = -1; readStep(); }, 2500);
		show(i); prog = 0;
		scrollTo({ top: blk.getBoundingClientRect().top + scrollY + ((c[k] + c[k + 1]) / 2) * innerHeight, behavior: instant || still ? "instant" : "smooth" });
	}

	function sync() {
		// retake the canvas if a neighbour left it on the plain ground while this section is in view
		if (active && field.mode === "ground") { field.mode = "chart"; field.owner = "rq2"; field.dim = 0.75; field.interactive = true; }
		// the canvas is only the dimmed ground here: the pictures are the page's own SVG
		if (active && field.owner === "rq2" && (chart.marks.length || chart.paths.length || chart.texts.length)) { chart.marks = []; chart.paths = []; chart.texts = []; }
	}
	$effect(() => {
		void [field.mode, field.owner, active];
		sync();
	});

	onMount(() => {
		still = matchMedia("(prefers-reduced-motion: reduce)").matches || new URLSearchParams(location.search).has("still");
		narrow = (vp.w || innerWidth) <= 860; // the loop's width where it has one: innerWidth lays a phone's page out
		// scroll and resize, in the page's loop (loop.ts)
		const onScroll = () => { if ((vp.w <= 860) !== narrow) narrow = vp.w <= 860; readStep(); sync(); if (hov && tapType !== "mouse") hov = null; };
		// a reader's own scroll ends a jump at once
		const own = () => { if (goal >= 0) { goal = -1; clearTimeout(goalT); readStep(); } };
		const stopScroll = onPageScroll(onScroll);
		addEventListener("wheel", own, { passive: true });
		addEventListener("touchstart", own, { passive: true });
		// a mouse leaving the page (or the window losing focus) closes a bar's details: the bar's own pointerleave
		// does not always fire when the pointer exits the window
		const unhover = () => (hov = null);
		const outOfPage = (e: MouseEvent) => { if (!e.relatedTarget) hov = null; };
		document.addEventListener("mouseout", outOfPage);
		addEventListener("blur", unhover);
		document.documentElement.addEventListener("mouseleave", unhover);
		// measured again once the face has loaded (not when it already has: the layouts would all be worked out twice)
		if (document.fonts && document.fonts.status !== "loaded") document.fonts.ready.then(() => { widths.clear(); mfont = ""; fontsV++; });
		// the canvas is this section's while it is on screen (the dimmed ground behind its pictures)
		const io = new IntersectionObserver((es) => es.forEach((e) => {
			active = e.isIntersecting;
			if (active) { field.mode = "chart"; field.owner = "rq2"; field.dim = 0.75; field.interactive = true; }
			else if (field.mode === "chart" && field.owner === "rq2") { field.mode = "ground"; field.dim = 0; field.interactive = false; chart.marks = []; chart.paths = []; chart.texts = []; }
		}), { rootMargin: "0px" });
		io.observe(body);
		regions.rq2 = body;
		const onGo = (e: Event) => go((e as CustomEvent<{ i: number; instant?: boolean }>).detail.i, (e as CustomEvent<{ i: number; instant?: boolean }>).detail.instant);
		root.addEventListener("wa-go", onGo);
		// a footnote's ↩ (the page's list renumbers every mark, so it points at "#fnref-<n>", not this section's own id):
		// if the mark it points at sits on one of this section's cards, go to the step that shows that card (the cards
		// share places in the pinned stage, so the browser's own jump would land on whichever step is there)
		const onBack = (e: MouseEvent) => {
			const a = (e.target as Element).closest?.("a.back");
			const id = a?.getAttribute("href")?.slice(1);
			const mark = id ? document.getElementById(id) : null;
			if (!mark || !root.contains(mark)) return;
			const i = Number(mark.closest<HTMLElement>("[data-i]")?.dataset.i);
			if (!(i >= 0 && i <= LAST)) return;
			e.preventDefault();
			go(i);
		};
		document.addEventListener("click", onBack);
		// dev only: the asked and shown steps, for checking the pacing
		if (import.meta.env.DEV) (window as unknown as { __wa: () => unknown }).__wa = () => ({ step, want, goal, prog });
		return () => {
			stopScroll(); removeEventListener("wheel", own); removeEventListener("touchstart", own);
			document.removeEventListener("mouseout", outOfPage); removeEventListener("blur", unhover); document.documentElement.removeEventListener("mouseleave", unhover);
			io.disconnect(); root.removeEventListener("wa-go", onGo); document.removeEventListener("click", onBack); clearTimeout(holdT); clearTimeout(goalT);
		};
	});

	const host = (url: string) => new URL(url).hostname.replace(/^www\./, "");
</script>

{#snippet dashes()}
	<StepDashes count={STEPS.length} current={step} go={(i) => go(i)} progress={prog} />
{/snippet}
{#snippet caption(from: number, to: number, cur: number)}
	<div class="cap">
		{@render dashes()}
		<div class="stack" aria-live="polite">
			{#each STEPS.slice(from, to) as s, j}
				{@const k = from + j}
				<div class="cap-t" class:on={cur === k} class:big={!!s.big} aria-hidden={cur !== k}>{#if s.big}<b class="num">{s.big}</b>{/if}<p>{SAY[k]}</p></div>
			{/each}
		</div>
	</div>
{/snippet}

<section class="wa" class:still class:narrow id={S.id} data-rq={S.rq} data-step={step} bind:this={root}>
	<SectionOpener n={S.n} title={S.title} takeaway={S.takeaway.t} context={S.context.t} accent="#9A82B4" prints={PRINTS} />

	<div class="wa-body" bind:this={body}>
		<!-- 1. the bars: a row per lab along the model release date axis, the number above every bar -->
		<div class="blk" bind:this={barsBlk} style="--len:{BC[NB]}">
			<div class="stage">
				<div class="frame" bind:clientWidth={fw}>
					{@render caption(0, NB, bs)}
					<div class="keyw" class:on={grown}>
						<div class="key" style:height="{keyTags.h}px"><Tags items={keyTags.items} follow /></div>
						<p class="measure">{u("Bar height: the share of a model’s texts that Claude Fable 5.2 credits to the model’s own lab")}</p>
						<!-- the hover cue: at the key row's right end, over the chart's top right (always in the flow, so the
						     chart's height never changes when it fades) -->
						<HoverCue inline hover="Hover over a bar" tap="Tap a bar" show={grown && !tried} style="margin-left:auto; margin-block:-1px" />
					</div>
					<div class="chart" bind:clientWidth={bw} bind:clientHeight={bh}>
						{#if barsG}
							{@const G = barsG}
							<svg class="bars" width={bw} height={bh} aria-hidden="true" style:--slot={GRAY.strong}>
								{#each G.rows as r, ri (r.lab)}
									{#if ri % 2 === 0}<rect class="stripe" x="0" y={r.top} width={G.rx} height={G.rh} />{/if}
									<text class="head" x="2" y={r.base - G.trackH / 2 + 4}>{r.lab}</text>
									<line class="base" x1={G.lx} x2={G.rx} y1={r.base + 0.5} y2={r.base + 0.5} />
									{#each r.items as it (it.w.writer)}
										{@const lit = grown && barLit(it.w)}
										{@const y0 = r.base - G.trackH}
										<g class="it" class:lit class:dim={grown && !lit}>
											<!-- the true date on the baseline, and a lead to the bar where its neighbours pushed it aside -->
											<line class="tk" x1={it.tx} x2={it.tx} y1={r.base + 1} y2={r.base + 4} />
											{#if Math.abs(it.x - it.tx) > 1.5}<line class="lead" x1={it.x} y1={r.base + 1} x2={it.tx} y2={r.base + 4} />{/if}
											<rect class="track" class:full={!grown} x={it.x - G.barW / 2} y={y0} width={G.barW} height={G.trackH} />
											<rect class="bv" class:up={grown} x={it.x - G.barW / 2} y={r.base - (G.trackH * it.own) / 100} width={G.barW} height={(G.trackH * it.own) / 100} fill={lit ? barCol(it.w) : wash(barCol(it.w))} />
											<text class="n" class:on={grown} x={it.x} y={r.top + G.numH - 3}>{it.own}%</text>
											{#if !narrow || it.phoneName}<text class="nm" class:on={!narrow || barFocus.has(it.w.writer)} class:strong={barFocus.has(it.w.writer)} x={it.x} y={narrow ? r.top + 9 : r.base + 14}>{it.name}</text>{/if}
											<rect class="hit" x={it.x - it.half} y={r.top} width={it.half * 2} height={G.rh} role="presentation" onpointerenter={(e) => e.pointerType === "mouse" && (hov = it)} onpointerleave={(e) => e.pointerType === "mouse" && hov === it && (hov = null)} onpointerdown={(e) => (tapType = e.pointerType)} onclick={(e) => tapType !== "mouse" && deliberate(e) && (hov = hov === it ? null : it)} />
										</g>
									{/each}
								{/each}
								<!-- the model release date axis, with a break after the one 2024 release -->
								<line class="axis" x1={G.lx} x2={G.brk - 4} y1={G.axisY} y2={G.axisY} />
								<line class="axis" x1={G.brk + 4} x2={G.rx} y1={G.axisY} y2={G.axisY} />
								<path class="brkm" d="M{G.brk - 7},{G.axisY + 4} l5,-8 M{G.brk + 2},{G.axisY + 4} l5,-8" />
								{#each G.ticks as t}
									<line class="axis" x1={t.x} x2={t.x} y1={G.axisY} y2={G.axisY + 4} />
									<text class="tick" x={t.x} y={G.axisY + 16}>{t.t}</text>
								{/each}
								<text class="atitle" x={(G.lx + G.rx) / 2} y={G.axisY + (narrow ? 33 : 35)}>{u(S.x_label)}</text>
							</svg>
							{#if hov && grown}
								{@const w = hov.w}
								{@const r = G.rows[ORDER.indexOf(w.lab)]}
								<div class="tip" style="left:{hov.x + 12 + 300 <= bw ? hov.x + 12 : Math.max(0, hov.x - 312)}px; top:{Math.max(0, Math.min(r.top, bh - 200))}px">
									<b>{nameOf(w)}</b>
									<span>{w.lab}{w.release ? `, released ${monthYear(w.release)}` : ""}</span>
									<span class="t-k">Of its {w.n} texts, Claude Fable 5.2 named:</span>
									{#each tipRows as q (q.k)}
										{@const c = q.k === "own" ? barCol(w) : COL[q.k]}
										<span class="row"><i style:background={c}></i>{q.t}<span class="bar"><span style:width="{q.pct}%" style:background={c}></span></span><em>{q.pct}%</em></span>
									{/each}
								</div>
							{/if}
						{/if}
					</div>
				</div>
			</div>
		</div>

		<!-- 2. the board: each named model threaded to the lab Fable takes it for; the reports pinned as evidence -->
		<div class="blk" bind:this={boardBlk} style="--len:{KC[KC.length - 1]}">
			<div class="stage">
				<div class="frame kb">
					{@render caption(NB, STEPS.length, ks)}
					<div class="kbody">
						<div class="board" bind:clientWidth={kw} bind:clientHeight={kh}>
							{#if boardG}
								{@const G = boardG}
								<svg class="threads" width={kw} height={kh} aria-hidden="true">
									<defs>
										{#each G.threads as t, i (t.id)}
											<mask id="wa-th-{i}" maskUnits="userSpaceOnUse" x="0" y="0" width={kw} height={kh}>
												<path class="draw" class:on={step >= NB} style:transition-delay="{i * 70}ms" d={t.d} pathLength="1" stroke="#fff" stroke-width={t.sw + 6} fill="none" />
											</mask>
										{/each}
									</defs>
									{#each G.threads as t, i (t.id)}
										<path class="th" class:dim={!threadLit(t)} class:strong={kFocus.has(t.w.writer)} d={t.d} mask="url(#wa-th-{i})" stroke={COL[t.k]} stroke-width={t.sw} stroke-dasharray={t.k === "openai" ? (narrow ? "5 4" : "8 5") : undefined} fill="none" />
									{/each}
									{#each G.threads as t (t.id)}
										<circle class="pin" class:dim={!threadLit(t)} cx={t.x0} cy={t.y0} r={narrow ? 2.5 : 3.5} />
										<circle class="pin" cx={t.x1} cy={t.y1} r={narrow ? 2.5 : 3.5} />
									{/each}
								</svg>
								{#each G.threads as t (t.id)}
									<span class="share" class:on={step >= NB} class:dim={!threadLit(t)} style="left:{t.lx}px; top:{t.ly}px; width:{t.lw}px; height:{G.lh}px; --c:{COL[t.k]}">{t.pct}%</span>
								{/each}
								{#each G.nodes as n (n.w.writer)}
									<div class="node" class:dim={!nodeLit(n.w)} class:focus={kFocus.has(n.w.writer)} style="left:{n.x}px; top:{n.y}px; width:{n.nw}px; height:{n.nh}px">
										<b>{nameOf(n.w)}</b><span>{n.w.lab}, {monYear(n.w.release ?? "")}</span>
									</div>
								{/each}
								{#each G.hubs as b (b.k)}
									<div class="hub" style="left:{b.x}px; top:{b.y}px; width:{b.hw}px; height:{b.hh}px; --c:{COL[b.k]}">
										<b><Icon name={HUB[b.k].icon} />{HUB[b.k].t}</b><span><i class="ln" class:dash={b.k === "openai"}></i>{HUB[b.k].lab}</span>
									</div>
								{/each}
							{/if}
						</div>
						<!-- the evidence: one report a step, pinned beside the threads (a phone keeps only the current one) -->
						<div class="evs">
							{#each EVS as e, i}
								{@const sr = e.src}
								{@const st = evState(i)}
								<article class="ev {st}" data-i={e.step} inert={st === "hide" || (narrow && st !== "on")}>
									{#if e.kind}<p class="c-k">{u(e.kind)}</p>{/if}
									<p class="c-h"><i class="ln" class:dash={e.dash} style:--c={e.col}></i>{#if e.icon}<Icon name={e.icon} />{/if}<b>{u(e.label)}</b><span>{dateLabel(e.date)}</span></p>
									<div class="c-m" class:has-ph={!sr.url}>
										{#if !sr.url}<figure class="ph photo"><img src="/images/who-wrote-this/musk_royal_society.webp" alt={u("Elon Musk (photo: Debbie Rowe / The Royal Society, CC BY-SA 3.0)")} width="420" height="556" loading="lazy" /><sup class="fnref"><a href="#fn-wa-5" id="fnref-wa-5">5</a></sup></figure>{/if}
										<div class="c-qs">
											{#if sr.url}<blockquote class="c-q">“{sr.quote}{sr.cut ? "…" : ""}”</blockquote>
											{:else}<blockquote class="c-q">{S.musk_quote.before}<em>“{sr.quote}”</em>{S.musk_quote.after}</blockquote>{/if}
											<p class="c-s">{u(sr.by_line ?? "")}{#if sr.url}{" "}<a href={sr.url} target="_blank" rel="noopener">{host(sr.url)} ↗</a>{/if}<sup class="fnref"><a href="#fn-wa-{e.note}" id="fnref-wa-{e.note}">{e.note}</a></sup></p>
										</div>
									</div>
									<p class="c-n"><span>{u("Names")}</span>{#each e.labs as l}<em>{l}</em>{/each}</p>
								</article>
							{/each}
						</div>
					</div>
				</div>
			</div>
		</div>

		<Footnotes id="wa" notes={S.notes} />
	</div>
</section>

<style>
	.wa { position: relative; --gut: max(16px, calc(50vw - 40rem)); }
	.wa-body { position: relative; padding-bottom: calc(8 * var(--vh, 1vh)); }
	/* each picture: a tall block whose stage pins for its steps (LEN viewport heights each, summed in --len) */
	.blk { position: relative; width: 100vw; margin-left: calc(50% - 50vw); height: calc((var(--len) + 1) * 100 * var(--vh, 1vh)); }
	.stage { position: sticky; top: 0; height: calc(100 * var(--vh, 1vh)); pointer-events: none; }
	.frame { position: absolute; left: var(--gut); right: var(--gut); top: 28px; bottom: 16px; display: flex; flex-direction: column; }

	/* the caption band, with the headline numeral on its step */
	.cap { pointer-events: auto; display: grid; gap: 8px; max-width: 62rem; flex: none; }
	.stack { display: grid; }
	.cap-t { grid-area: 1 / 1; display: flex; align-items: center; gap: 22px; opacity: 0; transform: translateY(6px); transition: opacity .4s, transform .45s var(--ease); }
	.cap-t.on { opacity: 1; transform: none; }
	.cap-t p { max-width: 46rem; font-size: clamp(20px, 1.9vw, 26px); line-height: 1.3; font-weight: 500; letter-spacing: -0.018em; color: var(--ink); text-wrap: pretty; }
	.kb .cap-t p { max-width: 54rem; font-size: clamp(18px, 1.6vw, 22px); line-height: 1.34; }
	.num { flex: none; font-size: clamp(56px, 6vw, 92px); line-height: .9; font-weight: 600; letter-spacing: -0.04em; color: var(--ink); font-variant-numeric: tabular-nums; }

	/* the key: four chips (Tags are fixed-position: this box is their frame) and what a bar's height is */
	.keyw { flex: none; margin-top: 14px; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 18px; opacity: 0; transition: opacity .4s; }
	.keyw.on { opacity: 1; }
	.key { position: relative; flex: none; width: 31rem; max-width: 100%; transform: translateZ(0); }
	.measure { font-size: 12.5px; line-height: 1.35; color: var(--ink2); }

	/* the bars */
	.chart { position: relative; flex: 1 1 0; min-height: 0; margin-top: 12px; }
	.bars { position: absolute; inset: 0; overflow: visible; }
	.bars text { font-family: inherit; paint-order: stroke; stroke: var(--ground); stroke-width: 3px; stroke-linejoin: round; }
	.stripe { fill: rgba(20, 32, 45, .035); }
	.head { font-size: 12.5px; font-weight: 600; fill: var(--ink); }
	.base { stroke: rgba(20, 32, 45, .16); stroke-width: 1; }
	.track { fill: rgba(20, 32, 45, .075); transition: fill .5s; }
	.track.full { fill: var(--slot); }
	.bv { transform-box: fill-box; transform-origin: 50% 100%; transform: scaleY(0); transition: transform .7s var(--ease), fill .35s; }
	.bv.up { transform: none; }
	.tk { stroke: rgba(20, 32, 45, .5); stroke-width: 1.25; }
	.lead { stroke: rgba(20, 32, 45, .28); stroke-width: 1; }
	.n { font-size: 11px; font-weight: 600; fill: var(--ink); text-anchor: middle; font-variant-numeric: tabular-nums; opacity: 0; transition: opacity .35s; }
	.n.on { opacity: 1; }
	.it.dim .n.on { opacity: .38; }
	.nm { font-size: 10.5px; font-weight: 500; fill: var(--ink2); text-anchor: middle; opacity: 0; transition: opacity .35s; }
	.nm.on { opacity: 1; }
	.it.dim .nm.on { opacity: .45; }
	.nm.strong { font-weight: 700; fill: var(--ink); }
	.hit { fill: transparent; pointer-events: auto; cursor: default; }
	.axis { stroke: rgba(20, 32, 45, .45); stroke-width: 1; }
	.brkm { stroke: rgba(20, 32, 45, .55); stroke-width: 1.25; fill: none; }
	.tick { font-size: 11.5px; fill: var(--ink2); text-anchor: middle; }
	.atitle { font-size: 13px; font-weight: 600; fill: var(--ink); text-anchor: middle; letter-spacing: .01em; }

	/* a model's own numbers, on hover (or a tap) */
	.tip { position: absolute; z-index: 5; display: grid; gap: 4px; width: 300px; padding: 12px 14px; background: #fff; border-radius: 3px; box-shadow: 0 6px 20px rgba(20, 32, 45, .14); font-size: 12.5px; color: var(--ink2); pointer-events: none; }
	.tip b { font-size: 15px; color: var(--ink); }
	.t-k { margin-top: 6px; padding-top: 8px; border-top: 1px solid var(--rule); font-size: 12.5px; color: var(--ink); }
	.row { display: grid; grid-template-columns: 10px max-content minmax(24px, 1fr) 34px; align-items: center; gap: 8px; white-space: nowrap; color: var(--ink); }
	.row i { width: 9px; height: 9px; border-radius: 1px; }
	.tip .bar { height: 5px; background: var(--ground); border-radius: 1px; overflow: hidden; }
	.tip .bar span { display: block; height: 100%; }
	.row em { font-style: normal; font-weight: 600; text-align: right; font-variant-numeric: tabular-nums; }

	/* the board: the threads under the cards, the shares on the threads */
	.kbody { flex: 1 1 0; min-height: 0; margin-top: 16px; display: grid; grid-template-columns: minmax(0, 1fr) 25rem; gap: 44px; }
	.board { position: relative; min-height: 0; }
	.threads { position: absolute; inset: 0; overflow: visible; }
	.draw { stroke-dasharray: 1 1; stroke-dashoffset: 1; transition: stroke-dashoffset 1s var(--ease); }
	.draw.on { stroke-dashoffset: 0; }
	.th { stroke-linecap: round; transition: opacity .35s; }
	.th.dim { opacity: .2; }
	.pin { fill: var(--ink); stroke: #fff; stroke-width: 1.25; transition: opacity .35s; }
	.pin.dim { opacity: .3; }
	.share { position: absolute; transform: translate(-50%, -50%); display: grid; place-items: center; border-radius: 3px; background: #fff; box-shadow: 0 0 0 1.5px var(--c); font-size: 11.5px; font-weight: 600; color: var(--ink); font-variant-numeric: tabular-nums; opacity: 0; transition: opacity .4s .5s; }
	.share.on { opacity: 1; }
	.share.on.dim { opacity: .3; transition-delay: 0s; }
	.node, .hub { position: absolute; display: grid; align-content: center; gap: 1px; padding: 0 12px; background: #fff; border-radius: 3px; box-shadow: 0 3px 12px rgba(20, 32, 45, .1); transition: opacity .35s, box-shadow .35s; }
	.ev::before { content: ""; position: absolute; left: 50%; top: -4px; width: 9px; height: 9px; margin-left: -4.5px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #fff 0 16%, var(--ink) 30%); box-shadow: 0 1px 2px rgba(20, 32, 45, .3); }
	.node b { font-size: 13.5px; font-weight: 600; color: var(--ink); white-space: nowrap; }
	.node span { font-size: 11.5px; color: var(--ink2); white-space: nowrap; }
	.node.focus { box-shadow: 0 0 0 2px var(--ink), 0 3px 12px rgba(20, 32, 45, .14); }
	.node.dim { opacity: .38; }
	.hub { box-shadow: 0 0 0 2px var(--c), 0 4px 16px rgba(20, 32, 45, .12); }
	.hub b { display: flex; align-items: center; gap: 8px; font-size: 20px; font-weight: 600; color: var(--ink); }
	.hub b :global(svg) { color: var(--c); }
	.hub span { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--ink2); }
	.ln { flex: none; display: inline-block; width: 18px; height: 2px; background: var(--c); }
	.ln.dash { background: repeating-linear-gradient(90deg, var(--c) 0 5px, transparent 5px 9px); }

	/* the evidence: a column of reports, pinned one a step; the current one in full, the earlier ones faded */
	.evs { display: flex; flex-direction: column; gap: 12px; min-height: 0; }
	.ev { position: relative; display: grid; gap: 8px; padding: 14px 16px; background: #fff; border-radius: 3px; box-shadow: 0 6px 22px rgba(20, 32, 45, .08); transition: opacity .35s, transform .4s var(--ease), visibility 0s; }
	.ev.on { pointer-events: auto; box-shadow: 0 8px 26px rgba(20, 32, 45, .16); }
	.ev.past { pointer-events: auto; opacity: .55; }
	.ev.past .c-m { display: none; }
	.ev.hide { opacity: 0; visibility: hidden; transform: translateY(6px); transition: opacity .35s, transform .4s var(--ease), visibility 0s .35s; }
	/* what the card is (the three reports): a small label over its header */
	.c-k { margin-bottom: -2px; font-size: 11px; line-height: 1.2; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--ink2); }
	.ev.past .c-k { display: none; }
	.c-h { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--ink2); }
	.c-h b { font-size: 14.5px; font-weight: 600; color: var(--ink); }
	.c-h span { margin-left: auto; font-variant-numeric: tabular-nums; }
	.c-m { display: flex; align-items: center; gap: 14px; }
	.c-qs { display: grid; gap: 5px; min-width: 0; }
	.c-q { margin: 0; font-size: 14.5px; line-height: 1.38; font-weight: 500; letter-spacing: -0.006em; color: var(--ink); }
	.c-q em { font-style: normal; font-weight: 600; }
	.c-s { font-size: 12px; line-height: 1.4; color: var(--ink2); }
	.c-s a { color: var(--ink); text-underline-offset: 2px; }
	.c-n { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 6px; font-size: 11.5px; color: var(--ink2); }
	.c-n em { font-style: normal; font-weight: 600; color: var(--ink); padding: 1px 6px; border-radius: 3px; background: var(--chip); }
	.ph { flex: none; margin: 0; }
	.ph.photo { position: relative; width: 56px; height: 74px; padding: 0; }
	.ph.photo img { width: 100%; height: 100%; object-fit: cover; border-radius: 3px; filter: grayscale(.15); }
	.ph.photo :global(sup) { position: absolute; right: -8px; top: -6px; }

	@media (max-width: 860px) {
		.frame { top: 14px; bottom: 10px; }
		.cap-t { gap: 14px; }
		.cap-t p, .kb .cap-t p { font-size: 16.5px; line-height: 1.38; }
		.num { font-size: 46px; }
		.keyw { margin-top: 10px; gap: 2px 0; }
		.measure { font-size: 11px; }
		.chart { margin-top: 8px; }
		.head { font-size: 11px; }
		.n { font-size: 9.5px; }
		.nm { font-size: 9px; }
		.tick { font-size: 10px; }
		.atitle { font-size: 11.5px; }
		.kbody { margin-top: 10px; grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(0, 1fr) auto; gap: 12px; }
		.share { font-size: 10px; }
		.node, .hub { padding: 0 8px; }
		.node b { font-size: 11.5px; }
		.node span { font-size: 9.5px; }
		.hub b { font-size: 15px; gap: 6px; }
		.hub span { font-size: 10px; gap: 5px; }
		.hub .ln { width: 12px; }
		/* a phone keeps only the current report, all in one cell so nothing below moves between steps */
		.evs { display: grid; }
		.ev { grid-area: 1 / 1; align-self: end; padding: 12px 14px; gap: 7px; }
		.ev.past { opacity: 0; visibility: hidden; transition: opacity .35s, visibility 0s .35s; }
		.c-q { font-size: 13.5px; }
		.ph.photo { width: 46px; height: 61px; }
	}
	/* tablets: the section rail (SectionNav, 10 px up, 57 px tall) sits bottom-left; keep the frame clear of it */
	@media (min-width: 601px) and (max-width: 979px) { .frame { bottom: 74px; } }
	.still .cap-t, .still .ev, .still .keyw, .still .track, .still .bv, .still .n, .still .nm, .still .draw, .still .share, .still .th, .still .node { transition: none; }
	@media (prefers-reduced-motion: reduce) { .cap-t, .ev, .keyw, .track, .bv, .n, .nm, .draw, .share, .th, .node { transition: none; } }
</style>
