<script lang="ts">
	// "Model accuracy has improved over time": Figure 2's 68 models as the page's own dots. The section pins a
	// full-screen stage; while it is pinned the field turns into the chart (release date across, accuracy up).
	//
	// Blocking: the chart runs the full width of the stage. The headline is set large above its empty upper-left
	// corner and the narration card sits in that corner, under the headline (the guided steps' pictures are checked to
	// keep clear of it; where they would not, the plot starts right of the card instead). Reveal order: the headline
	// alone while the stage arrives, then the card with the guided steps, then on the last step the controls (metric,
	// weights, a labs menu, date window: one row, no heading) slide in under the card and the plot starts under them.
	// Guided scroll, one or two paper sentences per step: the closed-weights frontier traces in, then the open-weights
	// frontier, then the trained detectors join (prose, then ideas). Each line is named at its end as soon as it is
	// drawn (on a phone, in a band right over the plot's end, so the names never sit on a dot or a line). The step
	// comes from the scroll position (no gaps: every position maps to one step, each step 75vh, as every step traces a
	// line); a fast scroll still shows each step in turn, for at least HOLD_MS, and the current dash fills as the reader
	// scrolls through it. The dashes on the card are buttons that scroll to their step. Hover any model.
	//
	// Exact marks: every mark snaps (DotField moves it at once, only its alpha eases), and the lines are built from the
	// marks' own coordinates, so a ring always sits on its corner of the dashed line. A ring's radius is shortened by
	// half its stroke so its outer edge matches a filled dot of the same size. Each step of a line is its own path from
	// one mark's edge to the next, so the dash pattern starts fresh at every ring.
	// Strings: timeline.json (paper text with src; everything else in `ui`). Data: timeline_rq1.json (read-only).
	//
	// Performance: nothing runs per frame while idle. An input (step, control, hover, size, or the stage scrolling in
	// or out) marks the chart dirty and asks for one frame; the frame loop keeps going only while a line is tracing or
	// the plot is moving over for Explore.
	import { onMount } from "svelte";
	import { registerSteps, stepShown } from "./steplinks.ts";
	import { field, chart, type Mark, type Path, type Text } from "./field.svelte";
	import { onScroll as onPageScroll, requestFrame, view as vp, lite } from "./loop";
	import { regions } from "./field.svelte";
	import { WEIGHTS, MODEL, GRAY, INK, FABLE as CLAY_RAMP } from "./palette";
	import Icon from "./Icon.svelte";
	import Reveal from "./Reveal.svelte";
	import StepDashes from "./StepDashes.svelte";
	import Tags, { type Tag } from "./Tags.svelte";
	import HoverCue from "./HoverCue.svelte";
	import T from "./timeline.json";
	import D from "./timeline_rq1.json";

	type Metric = "both" | "ideas" | "prose";
	type Line = "closed" | "open";
	type Layer = Line | "ref";
	type Model = (typeof D.models)[number] & { t: number; name: string; when: string };
	type B = { x: number; y: number; w: number; h: number };
	type Box = { x0: number; x1: number; y0: number; y1: number };
	type Lbl = Tag & { plain?: boolean }; // plain: canvas text with no box (Claude Fable 5.2's name)

	const U: Record<string, string> = Object.fromEntries(T.ui.map((u) => [u.id, u.t]));
	const NAME: Record<string, string> = Object.fromEntries(T.names.map((n) => [n.model, n.t]));
	const LAST = T.steps.length - 1;
	const FABLE = "Claude Fable 5.2";
	const CLAY = MODEL[FABLE];
	const LINES: Line[] = ["closed", "open"];
	const LAYERS: Layer[] = ["closed", "open", "ref"];
	const METRICS: Metric[] = ["both", "ideas", "prose"];
	const GUIDED = [...new Set(T.steps.slice(0, LAST).map((s) => s.metric as Metric))]; // the metrics drawn under the card
	const WEIGHT_IDS = ["all", "closed", "open"] as const;
	const COLOR: Record<Line, string> = { closed: WEIGHTS.closed.color, open: WEIGHTS.open.color };
	const DASH: Record<Line, number[]> = { closed: [...WEIGHTS.closed.dash], open: [...WEIGHTS.open.dash] };
	const REF_DASH = [3, 4], GRID_DASH = [1, 5];
	const TRACE_S = 1.3; // seconds for a line to trace in
	const SIDE_S = 0.6; // seconds for the plot to move over when Explore opens
	const STEP_VH = 0.75, LEAD_VH = 0.55, TRIG = 0.5; // scroll per step, where step 0 starts, the trigger line (viewport heights)
	const HOLD_MS = 350; // a fast scroll moves the shown step one at a time, holding each at least this long
	const R_FRONT = 6, R_DOT = 4.5, R_FOCUS = 2.5; // outer radii: a frontier model, any other model, extra for a named one
	const RING_W = 1.8; // DotField's ring stroke: a ring is drawn at r - RING_W / 2 so its outer edge is r
	const LINE_W = 2.2, CASE_W = 6.5; // a line, and the ground-coloured casing under it
	const AX = 40; // px from the stage's left edge to the plot (the y labels hang in this margin)
	const PLAIN_FONT = "600 13px Inter, system-ui, sans-serif";
	const ink2 = INK.ink2, rule = "rgba(20,32,45,.14)";
	const PCT = Array.from({ length: 11 }, (_, i) => `${i * 10}%`);
	// the hover cue (HoverCue): on a wide screen over the plot's right edge, beside the headline; on a phone (where the
	// lines' names fill the plot's top right) in the card's top row, right of the dashes. Never on a name, a line or a dot.
	const CUE_HOVER = "Hover over a model", CUE_TAP = "Tap a model";
	const CUE_H = 28, CUE_LIFT = 40; // its height; its top over the headline's foot (its foot near the last line's baseline)

	// dates at local noon, so a tick on the 1st never reads as the month before
	const DAY = 864e5;
	const day = (d: string) => Date.parse(d + "T12:00:00");
	const START = day("2024-07-01"), END = day("2026-12-01");
	const N = Math.round((END - START) / DAY); // the date window counts days from START
	const GAP = 30; // the narrowest window, in days (as in the dashboard)
	const F_LONG = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });
	const F_MON = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" });
	const F_DAY = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
	const F_TICK = new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit" });

	// worked out once: each model's date, display name and tooltip date; the models in release order for each metric;
	// the month starts with their tick labels
	const models: Model[] = D.models.map((m) => ({ ...m, t: day(m.release), name: NAME[m.model] ?? m.model, when: F_LONG.format(day(m.release)) }));
	const FAB = models.find((m) => m.model === FABLE)!;
	const byRelease = Object.fromEntries(METRICS.map((k) => [k, [...models].sort((a, b) => a.t - b.t || b[k] - a[k])])) as Record<Metric, Model[]>;
	const MONTHS: { t: number; m: number; s: string }[] = [];
	for (let d = new Date(START); +d <= END; d.setMonth(d.getMonth() + 1)) MONTHS.push({ t: +d, m: d.getMonth(), s: F_TICK.format(d).replace(" ", " ’") });
	const FOCUS = T.steps.map((s) => new Set(s.focus));
	const NONE = new Set<string>();
	const labs = [...new Set(D.models.map((m) => m.lab))].sort();

	let metric = $state<Metric>(T.steps[0].metric as Metric);
	let weights = $state<"all" | Line>("all");
	let lab = $state<string | null>(null);
	let wa = $state(0), wb = $state(N); // the date window, in days from START
	let step = $state(-1); // -1: the headline alone, before the first step
	let progress = $state(0); // how far the scroll is through the shown step, 0..1 (fills the next dash)
	let active = $state(false);
	let stage: HTMLElement, root: HTMLElement, head: HTMLElement, col: HTMLElement, card: HTMLElement, bar: HTMLElement, track: HTMLElement;
	const explore = $derived(step >= LAST);
	const full = $derived(wa === 0 && wb === N);
	let hovered = $derived(field.hover ? models.find((m) => m.model === field.hover) ?? null : null);
	let tip = $state({ x: 0, y: 0 });
	// the hover cue: where it sits (its right edge and top, stage px; set by layout) and whether a model's card has been seen
	let cueAt = $state<{ right: number; top: number } | null>(null);
	let tried = $state(false);
	$effect(() => { if (hovered && active) tried = true; });
	let tags = $state<Tag[]>([]);
	let drag = $state<{ x: number; a: number; b: number; w: number } | null>(null);
	const readout = $derived.by(() => {
		const f = wb - wa > 400 ? F_MON : F_DAY;
		return [f.format(START + wa * DAY), f.format(START + wb * DAY)];
	});

	// how far each line (and the trained detector's line) has traced in, 0..1; `gate` is how far its dots have been
	// revealed, which does not rewind when a new metric traces the lines again
	const trace: Record<Layer, number> = { closed: 0, open: 0, ref: 0 };
	const gate: Record<Line, number> = { closed: 0, open: 0 };
	let traced = T.steps[0].metric as Metric; // the metric the lines last traced for
	// where the plot is: side 1 = it starts right of the card (only where the guided pictures would run under the card);
	// down 1 = it starts under the control row (Explore, the last step); 0 = the full stage with the card in its corner
	let side = 0, sideGoal = 0, down = 0, downGoal = 0, laidW = 0;
	let reduce = false;
	const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
	const drawn = () => (step < 0 ? [] : T.steps[step].draw);

	/** Moves the traces (and the plot's edge) one frame toward what the step wants. 1 if anything changed, 2 if still moving. */
	function advance(dt: number) {
		let out = 0;
		if (metric !== traced) {
			traced = metric;
			if (!reduce) for (const k of LAYERS) if (trace[k]) { trace[k] = 0; out = 1; }
		}
		const want = drawn();
		for (const k of LAYERS) {
			const g = want.includes(k) ? 1 : 0, was = trace[k];
			if (was === g) continue;
			trace[k] = reduce ? g : g > was ? Math.min(g, was + dt / TRACE_S) : Math.max(g, was - dt / TRACE_S);
			out = trace[k] === g ? Math.max(out, 1) : 2;
		}
		for (const l of LINES) gate[l] = want.includes(l) ? Math.max(gate[l], trace[l]) : trace[l];
		const toward = (v: number, g: number) => (reduce ? g : g > v ? Math.min(g, v + dt / SIDE_S) : Math.max(g, v - dt / SIDE_S));
		if (side !== sideGoal) { side = toward(side, sideGoal); out = side === sideGoal ? Math.max(out, 1) : 2; }
		if (down !== downGoal) { down = toward(down, downGoal); out = down === downGoal ? Math.max(out, 1) : 2; }
		return out;
	}

	// where the tracing pen is along a step line, as an x position (dots and tags appear once it has passed them)
	function headX(pts: [number, number][] | null, p: number) {
		if (!pts || p <= 0) return -Infinity;
		if (p >= 1) return Infinity;
		let total = 0;
		for (let i = 1; i < pts.length; i++) total += Math.abs(pts[i][0] - pts[i - 1][0]) + Math.abs(pts[i][1] - pts[i - 1][1]);
		let left = total * p;
		for (let i = 1; i < pts.length; i++) {
			const s = Math.abs(pts[i][0] - pts[i - 1][0]) + Math.abs(pts[i][1] - pts[i - 1][1]);
			if (left <= s) return pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * (s ? left / s : 1);
			left -= s;
		}
		return pts[pts.length - 1][0];
	}

	// ---- the frontiers: each line steps up at every new best model released in the window ----------------------
	function frontier(k: Metric, t0: number, t1: number) {
		const out: Record<Line, Model[]> = { closed: [], open: [] };
		const top: Record<Line, number> = { closed: -1, open: -1 };
		for (const m of byRelease[k]) {
			const l = m.line as Line;
			if (m.t >= t0 && m.t <= t1 && m[k] > top[l]) { top[l] = m[k]; out[l].push(m); }
		}
		return out;
	}
	// the y axis starts at the 10% below the lowest score in the window (or the trained detector's)
	function lowOf(k: Metric, t0: number, t1: number) {
		let mn = k === "both" ? 100 : D.refs[k].v;
		for (const m of models) if (m.t >= t0 && m.t <= t1 && m[k] < mn) mn = m[k];
		return Math.max(0, Math.min(80, Math.floor((mn - 4) / 10) * 10));
	}
	/** True if the guided steps' pictures (all dates) keep clear of the card when the plot runs the full width. */
	function clearOf(b: Box, c: DOMRect) {
		const P = 12, cx0 = c.left - P, cx1 = c.right + P, cy0 = c.top - P, cy1 = c.bottom + P;
		const hit = (xa: number, ya: number, xb: number, yb: number) => Math.max(xa, xb) > cx0 && Math.min(xa, xb) < cx1 && Math.max(ya, yb) > cy0 && Math.min(ya, yb) < cy1;
		const X = (t: number) => b.x0 + ((t - START) / (END - START)) * (b.x1 - b.x0);
		for (const k of GUIDED) {
			const lo = lowOf(k, START, END);
			const Y = (v: number) => b.y1 - ((v - lo) / (100 - lo)) * (b.y1 - b.y0);
			for (const m of models) if (hit(X(m.t), Y(m[k]), X(m.t), Y(m[k]))) return false;
			const f = frontier(k, START, END);
			for (const l of LINES) {
				const q = f[l];
				for (let i = 0; i < q.length; i++) {
					const ya = Y(q[i][k]), xb = i + 1 < q.length ? X(q[i + 1].t) : b.x1;
					if (hit(X(q[i].t), ya, xb, ya)) return false;
					if (i + 1 < q.length && hit(xb, ya, xb, Y(q[i + 1][k]))) return false;
				}
			}
		}
		return true;
	}
	// a dash pattern stretched so a leg between two marks starts AND ends on a dash (both rings touch the line); a leg
	// too short for two dashes is drawn solid; the last leg (to the plot's edge) keeps the plain pattern
	function fit(d: number[], len: number, both: boolean): number[] {
		if (!d.length || !both) return d;
		const [on, gap] = d;
		let n = Math.round((len - on) / (on + gap));
		while (n >= 1 && (len - (n + 1) * on) / n < gap * 0.5) n--; // gaps never shrink below half their size
		return n < 1 ? [] : [on, (len - (n + 1) * on) / n];
	}
	// a polyline of axis-aligned legs, less `a` px at its start and `b` px at its end (null if nothing is left)
	function trim(pts: [number, number][], a: number, b: number): [number, number][] | null {
		const len = (p: [number, number], q: [number, number]) => Math.abs(q[0] - p[0]) + Math.abs(q[1] - p[1]);
		let total = 0;
		for (let i = 1; i < pts.length; i++) total += len(pts[i - 1], pts[i]);
		if (total - a - b < 1) return null;
		const at = (d: number): [number, number] => {
			for (let i = 1; i < pts.length; i++) {
				const s = len(pts[i - 1], pts[i]);
				if (d <= s) { const t = s ? d / s : 0; return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t]; }
				d -= s;
			}
			return pts[pts.length - 1];
		};
		const out: [number, number][] = [at(a)];
		let d = 0;
		for (let i = 1; i < pts.length - 1; i++) { d += len(pts[i - 1], pts[i]); if (d > a && d < total - b) out.push(pts[i]); }
		out.push(at(total - b));
		return out;
	}

	// ---- tags on the picture: their sizes (measured once per string) and a small placer that avoids dots and lines --
	let mctx: CanvasRenderingContext2D | null = null;
	const widths = new Map<string, number>();
	function tw(s: string, font: string) {
		const k = font + "|" + s;
		let w = widths.get(k);
		if (w === undefined) {
			mctx ??= document.createElement("canvas").getContext("2d")!;
			mctx.font = font;
			w = mctx.measureText(s).width;
			widths.set(k, w);
		}
		return w;
	}
	const LH = 1.6; // the page's line height, which the tags inherit
	function boxOf(tg: Lbl): B {
		const fs = tg.strong ? 14 : 12.5;
		const sw = tg.color ? (tg.swatch === "line" || tg.swatch === "dash" ? 16 : 10) + 6 : 0;
		const w = tg.plain ? tw(tg.t, PLAIN_FONT) : (tg.strong ? 20 : 16) + Math.max(sw + tw(tg.t, `600 ${fs}px Inter, system-ui, sans-serif`), tg.sub ? tw(tg.sub, "500 11.5px Inter, system-ui, sans-serif") : 0);
		const h = tg.plain ? 16 : (tg.strong ? 10 : 6) + fs * LH + (tg.sub ? 1 + 11.5 * LH : 0);
		switch (tg.at ?? "right") {
			case "left": return { x: tg.x - 10 - w, y: tg.y - h / 2, w, h };
			case "above": return { x: tg.x - w / 2, y: tg.y - 8 - h, w, h };
			case "below": return { x: tg.x - w / 2, y: tg.y + 8, w, h };
			case "center": return { x: tg.x - w / 2, y: tg.y - h / 2, w, h };
			default: return { x: tg.x + 10, y: tg.y - h / 2, w, h };
		}
	}
	const overlap = (a: B, b: B) =>
		Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
	type Scene = { placed: B[]; dots: Mark[]; key: Set<string>; segs: number[][]; bounds: { x0: number; x1: number; y0: number; y1: number } };
	/** Picks the candidate position that covers the fewest dots, lines and other tags; the first wins a tie. */
	function place<L extends Lbl>(cands: L[], self: string | null, S: Scene): L {
		let best = cands[0], bestB = boxOf(best), bestC = Infinity;
		cands.forEach((c, i) => {
			const b = boxOf(c);
			let cost = i * 0.3;
			if (b.x < S.bounds.x0 || b.x + b.w > S.bounds.x1 || b.y < S.bounds.y0 || b.y + b.h > S.bounds.y1) cost += 1000; // never off the stage
			for (const q of S.placed) { const o = overlap(b, q); if (o > 0) cost += 200 + (o / (b.w * b.h)) * 300; }
			// plain canvas words sit under the dots (which are drawn last), so a dot costs them more; a line less, as
			// a ground-coloured band under the words hides it
			// a boxed tag keeps a clear gap (P) from every line and dot, so it never reads as touching them
			const P = c.plain ? 0 : 5;
			for (const m of S.dots) if (m.x > b.x - m.r - P && m.x < b.x + b.w + m.r + P && m.y > b.y - m.r - P && m.y < b.y + b.h + m.r + P) cost += m.id === self || m.id === FABLE ? 40 : c.plain ? 25 : S.key.has(m.id) ? 12 : 1.5;
			for (const s of S.segs) if (Math.max(s[0], s[2]) > b.x - P && Math.min(s[0], s[2]) < b.x + b.w + P && Math.max(s[1], s[3]) > b.y - P && Math.min(s[1], s[3]) < b.y + b.h + P) cost += c.plain ? 3 : 30;
			if (cost < bestC) { bestC = cost; best = c; bestB = b; }
		});
		S.placed.push(bestB);
		return best;
	}
	// a tag for one dot: to its upper left first (the empty side of a rising frontier), then around it
	const around = <L extends Omit<Lbl, "x" | "y" | "at">>(tg: L, x: number, y: number): (L & { x: number; y: number; at: Tag["at"] })[] => [
		{ ...tg, x: x - 2, y: y - 12, at: "left" },
		{ ...tg, x: x - 2, y, at: "left" },
		{ ...tg, x, y: y - 6, at: "above" },
		{ ...tg, x: x + 2, y: y - 14, at: "right" },
		{ ...tg, x: x + 2, y, at: "right" },
		{ ...tg, x, y: y + 6, at: "below" },
		{ ...tg, x: x - 2, y: y + 16, at: "left" },
		{ ...tg, x: x + 2, y: y - 28, at: "right" },
		{ ...tg, x: x + 2, y: y + 30, at: "right" },
		{ ...tg, x: x - 2, y: y - 34, at: "left" },
		{ ...tg, x: x - 2, y: y + 38, at: "left" },
		{ ...tg, x: x + 2, y: y - 46, at: "right" },
		{ ...tg, x: x + 2, y: y + 48, at: "right" },
		{ ...tg, x: x - 2, y: y - 58, at: "left" },
		{ ...tg, x: x - 2, y: y + 62, at: "left" },
	];
	const rect = (d: DOMRect, p = 0): B => ({ x: d.left - p, y: d.top - p, w: d.width + 2 * p, h: d.height + 2 * p });
	/** Phones: the lines' names side by side, right-aligned at `right`, the first at the end; a new row where the next
	 * would pass `left`. Each slot's right edge and row. */
	function bandSlots(tgs: Tag[], right: number, left: number) {
		let xr = right, row = 0;
		return tgs.map((tg) => {
			const w = boxOf(tg).w;
			if (xr - w < left && xr < right) { xr = right; row++; }
			const s = { xr, row };
			xr -= w + 6;
			return s;
		});
	}

	// ---- the chart: rebuilt only when an input changed or a line is tracing ----------------------------------------
	const pos = new Map<string, { x: number; y: number }>();
	let tagSig = "";
	type Geo = { r: DOMRect; hb: DOMRect; cr: DOMRect; cl: DOMRect; foot: number; narrow: boolean };
	function layout({ r, hb, cr, cl, foot, narrow }: Geo) {
		const W = vp.w || innerWidth;
		const t0 = START + wa * DAY, t1 = START + wb * DAY;
		// frontier lines inside the window: they start afresh from the models released in it
		const lines = frontier(metric, t0, t1);
		const showLine = (l: Line) => weights === "all" || weights === l;
		// a line's name, with its best model and score (placed at its end once the line is drawn)
		const endTag = (l: Line): Tag => {
			const b = lines[l][lines[l].length - 1];
			return { id: "line-" + l, x: 0, y: 0, at: "left", t: U["weights." + l], sub: `${b.name}, ${Math.round(b[metric])}%`, color: COLOR[l], swatch: l === "closed" ? "line" : "dash", strong: !narrow, alpha: trace[l] >= 1 ? 1 : 0 };
		};
		const ref = metric === "both" ? null : D.refs[metric];
		const refTag: Tag | null = ref && { id: "ref", x: 0, y: 0, at: "right", t: ref.t, sub: `${U.trained}, ${Math.round(ref.v)}%`, color: GRAY.strong, swatch: "dash", alpha: trace.ref >= 1 ? 1 : 0 };
		const lo = lowOf(metric, t0, t1);
		let box: Box;
		const band = foot + 6; // narrow screens: the top of the band that holds the lines' names
		let refBand = false; // narrow screens: the trained detector's name sits in the band too
		if (narrow) {
			// stacked: the plot under the column, sized for the column's final height (so Explore opening does not
			// re-lay the chart out on every frame of its slide). Between the column and the plot, a band for the lines'
			// names (bandSlots), kept clear of the largest dot at 100% by the tags' gap (P), so a name never sits on a
			// dot or a line; a second row only where one does not fit. The trained detector's name joins the band where
			// its line runs so near the plot's top (Pangram 4 on prose) that the name has no room over it.
			const bh = boxOf({ id: "", x: 0, y: 0, t: "", sub: " ", color: COLOR.closed }).h; // a name's height (any text)
			const gap = R_FRONT + R_FOCUS + 5, y0 = band + bh + gap, y1 = r.bottom - 56;
			refBand = !!ref && ((100 - ref.v) / (100 - lo)) * (y1 - y0) < bh + 6 + gap;
			const all = [...LINES.filter((l) => lines[l].length).map(endTag), ...(refBand && refTag ? [refTag] : [])];
			const rows = all.length ? Math.max(...bandSlots(all, r.right - 6, r.left).map((s) => s.row)) + 1 : 1;
			box = { x0: r.left + 34, x1: r.right - 6, y0: y0 + (rows - 1) * (bh + 6), y1 };
			sideGoal = 0; side = 0; downGoal = 0; down = 0;
		} else {
			const over: Box = { x0: r.left + AX, x1: Math.min(r.right - 24, W - 196), y0: hb.bottom + 44, y1: r.bottom - 64 }; // room on the right for the line labels, clear of the page's side rail
			sideGoal = !explore && !clearOf(over, cr) ? 1 : 0;
			downGoal = explore ? 1 : 0;
			if (laidW !== W) { side = sideGoal; down = downGoal; } // first drawing, or a new size: no slide
			box = { ...over, x0: over.x0 + (cl.right + 52 - over.x0) * ease(side), y0: over.y0 + (foot + 34 - over.y0) * ease(down) };
		}
		laidW = W;
		// the hover cue on a wide screen: its right edge on the plot's, level with the headline's last line (well over the
		// plot, where the frontiers reach 100% on prose); the tags keep clear of it. A phone has its own in the card.
		let cueBox: B | null = null;
		if (!narrow) {
			const top = hb.bottom - CUE_LIFT, w = tw(CUE_HOVER, "600 12.5px Inter, system-ui, sans-serif") + 43; // words + ring, gap, padding
			cueBox = { x: box.x1 - w, y: top, w, h: CUE_H };
			const right = Math.round(r.right - box.x1), at = Math.round(top - r.top);
			if (!cueAt || cueAt.right !== right || cueAt.top !== at) cueAt = { right, top: at };
		}
		const inWin = (m: Model) => m.t >= t0 && m.t <= t1;
		const y = (v: number) => box.y1 - ((v - lo) / (100 - lo)) * (box.y1 - box.y0);
		const x = (t: number) => box.x0 + ((t - t0) / (t1 - t0)) * (box.x1 - box.x0);

		const off = (m: Model) => (weights !== "all" && m.line !== weights) || (lab !== null && m.lab !== lab);
		const front = new Set([...lines.closed, ...lines.open].map((m) => m.model));
		const focus = step < 0 || explore ? NONE : FOCUS[step];
		const outer = (m: Model) => (m === FAB ? R_FRONT : (front.has(m.model) ? R_FRONT : R_DOT) + (focus.has(m.model) ? R_FOCUS : 0));

		// every model's point (a model outside the window waits at the plot's edge, so scrubbing slides it in)
		pos.clear();
		for (const m of models) pos.set(m.model, { x: m.t < t0 ? box.x0 : m.t > t1 ? box.x1 : x(m.t), y: Math.max(box.y0, Math.min(box.y1, y(m[metric]))) });

		// each line as legs, one per step, built from the marks' own points: across to the next model's date, then up
		// to it. A leg starts and ends at the marks' edges, so the dash pattern starts fresh at every ring.
		type Leg = { pts: [number, number][]; s: number; e: number; dash: number[] };
		const legs: Record<Line, Leg[]> = { closed: [], open: [] };
		const poly: Record<Line, [number, number][] | null> = { closed: null, open: null };
		const total: Record<Line, number> = { closed: 0, open: 0 };
		for (const l of LINES) {
			const f = lines[l];
			if (!f.length) continue;
			const p0 = pos.get(f[0].model)!;
			const all: [number, number][] = [[p0.x, p0.y]];
			let acc = 0;
			f.forEach((m, i) => {
				const a = pos.get(m.model)!, nx = f[i + 1] ? pos.get(f[i + 1].model)! : null;
				const pts: [number, number][] = nx ? [[a.x, a.y], [nx.x, a.y], [nx.x, nx.y]] : [[a.x, a.y], [box.x1, a.y]];
				const len = Math.abs(pts[1][0] - pts[0][0]) + (nx ? Math.abs(nx.y - a.y) : 0);
				const ra = outer(m), rb = nx ? outer(f[i + 1]) : 0;
				const cut = trim(pts, ra, rb);
				if (cut) legs[l].push({ pts: cut, s: acc + ra, e: acc + len - rb, dash: fit(DASH[l], len - ra - rb, !!nx) });
				all.push(...pts.slice(1));
				acc += len;
			});
			poly[l] = all; total[l] = acc;
		}
		const dotHead = { closed: headX(poly.closed, ease(gate.closed)), open: headX(poly.open, ease(gate.open)) };
		const penHead = { closed: headX(poly.closed, ease(trace.closed)), open: headX(poly.open, ease(trace.open)) };

		// dots: every one snaps (no flying in, no lag behind the lines); a ring is drawn half its stroke smaller. The
		// frontier's marks (and Fable's) are drawn last, over the others; another model sitting under one of them (Beam 1.0
		// a day after Kimi K3.1 Pro, 1 point lower) is left out, so no sliver of a second ring reads as the line's ring
		// sitting off its corner.
		// Two other models drawn almost on top of each other (Kimi K3.1 Pro and Beam 1.0 on ideas) would read as one ring
		// drawn twice, off centre: the lower-scoring one is left out too (hover reaches the one kept).
		const key = (m: Model) => m === FAB || front.has(m.model);
		// (under a frontier mark: any centre inside its ring plus half a dot. A mark dimmed by a filter never hides one the
		// filter picked out.)
		const kept = models.filter((m) => key(m) && inWin(m) && !off(m)).map((m) => ({ p: pos.get(m.model)!, d: outer(m) + R_DOT * 0.5, l: "" }));
		const hidden = new Set<string>();
		for (const m of models.filter((k) => !key(k) && inWin(k)).sort((a, b) => +off(a) - +off(b) || b[metric] - a[metric])) {
			const p = pos.get(m.model)!;
			// two marks of the same style overlapping by more than about half; a ring and a dot only when nearly coincident
			if (kept.some((q) => Math.hypot(q.p.x - p.x, q.p.y - p.y) < (q.l === "" ? q.d : q.l === m.line ? q.d * 1.4 : q.d * 0.8))) hidden.add(m.model);
			else kept.push({ p, d: outer(m), l: m.line });
		}
		const marks: Mark[] = [];
		for (const m of [...models.filter((k) => !key(k)), ...models.filter(key)]) {
			const l = m.line as Line, fable = m === FAB, p = pos.get(m.model)!;
			const shown = inWin(m) && p.x <= dotHead[l] + 1;
			const R = outer(m), ring = l === "open" && !fable;
			const under = hidden.has(m.model);
			marks.push({
				id: m.model, x: p.x, y: p.y, r: ring ? R - RING_W / 2 : R, snap: true,
				color: fable ? CLAY : COLOR[l], ring,
				alpha: !shown || under ? 0 : off(m) ? 0.12 : key(m) || focus.has(m.model) ? 1 : 0.42,
			});
		}

		const paths: Path[] = [];
		const texts: Text[] = [];
		for (let v = lo; v <= 100; v += 10) {
			paths.push({ pts: [[box.x0, y(v)], [box.x1, y(v)]], color: rule, width: 1, dash: GRID_DASH, progress: 1 });
			if (v % 20 === 0 || lo % 20 !== 0) texts.push({ x: box.x0 - 10, y: y(v), t: PCT[v / 10], color: ink2, size: 11.5, align: "right" });
		}
		// month ticks every 1, 2, 3, 6 or 12 months, whichever keeps them apart in this window
		const span = (t1 - t0) / (30.44 * DAY), most = narrow ? 5 : 7;
		const every = [1, 2, 3, 6, 12].find((k) => span / k <= most) ?? 12;
		for (const mo of MONTHS) if (mo.t >= t0 && mo.t <= t1 && mo.m % every === 0) texts.push({ x: x(mo.t), y: box.y1 + 18, t: mo.s, color: ink2, size: 11.5, align: "center" });
		// the x axis's title, set larger and in ink so the dates read as the models' release dates at a glance
		texts.push({ x: box.x1, y: box.y1 + 40, t: U.x_label, color: INK.ink, size: 13, weight: 600, align: "right" });

		// the trained detector's line, under the frontiers; it starts past the card where it would run behind it
		const segs: number[][] = [];
		let rx = box.x0;
		if (ref && trace.ref > 0) {
			const yr = y(ref.v);
			if (!narrow && yr > cr.top - 8 && yr < cr.bottom + 8 && cr.right + 14 > rx) rx = cr.right + 14;
			paths.push({ pts: [[rx, yr], [box.x1, yr]], color: GRAY.strong, width: 1.6, dash: REF_DASH, progress: ease(trace.ref) });
			segs.push([rx, yr, box.x1, yr]);
		}
		// the frontiers: open first, closed on top, each on a casing of the ground colour, so where they cross one
		// line reads cleanly over the other
		for (const l of ["open", "closed"] as Line[]) {
			if (!poly[l] || !showLine(l) || trace[l] <= 0) continue;
			const pen = ease(trace[l]) * total[l];
			const prog = (g: Leg) => Math.max(0, Math.min(1, (pen - g.s) / Math.max(1e-6, g.e - g.s)));
			for (const g of legs[l]) if (prog(g) > 0) paths.push({ pts: g.pts, color: INK.ground, width: CASE_W, progress: prog(g) });
			for (const g of legs[l]) if (prog(g) > 0) paths.push({ pts: g.pts, color: COLOR[l], width: LINE_W, dash: g.dash, progress: prog(g) });
			const q = poly[l]!;
			for (let i = 1; i < q.length; i++) segs.push([q[i - 1][0], q[i - 1][1], q[i][0], q[i][1]]);
		}

		// ---- tags: every colour on the picture is named on it ---------------------------------------------------
		const S: Scene = {
			placed: narrow ? [] : [rect(hb, 4), rect(cl, 8), ...(cueBox ? [cueBox] : [])], segs, dots: marks.filter((m) => (m.alpha ?? 1) > 0.3), key: new Set(LINES.map((l) => lines[l][lines[l].length - 1]?.model ?? "")),
			bounds: { x0: box.x0 - 2, x1: narrow ? W - 4 : W - 34, y0: narrow || explore ? foot + 6 : r.top + 40, y1: box.y1 + 4 },
		};
		const items: Tag[] = [];

		// each line's name at its end, with its best model and score, as soon as the line is drawn
		const ends: { l: Line; tg: Tag; y: number }[] = [];
		for (const l of LINES) {
			const f = lines[l];
			if (!f.length || !showLine(l)) continue;
			const yb = pos.get(f[f.length - 1].model)!.y;
			ends.push({ l, y: yb, tg: { ...endTag(l), x: box.x1 + 2, y: yb, at: "right" } });
		}
		const shownEnds = ends.filter((e) => e.tg.alpha);
		if (!narrow) {
			// wide screens: a column just past the lines' ends, pushed apart where two ends are close, with leaders
			const colm = shownEnds.map((e) => ({ e, h: boxOf(e.tg).h, cy: e.y })).sort((a, b) => a.cy - b.cy);
			for (let it = 0; it < 40; it++) {
				let moved = false;
				for (let i = 1; i < colm.length; i++) {
					const need = (colm[i - 1].h + colm[i].h) / 2 + 8 - (colm[i].cy - colm[i - 1].cy);
					if (need > 0.5) { colm[i - 1].cy -= need / 2; colm[i].cy += need / 2; moved = true; }
				}
				if (!moved) break;
			}
			// keep the column on the stage: below its top, then nothing overlapping on the way down
			for (let i = 0; i < colm.length; i++)
				colm[i].cy = Math.max(colm[i].cy, i ? colm[i - 1].cy + (colm[i - 1].h + colm[i].h) / 2 + 8 : (explore ? foot + 8 : r.top + 44) + colm[i].h / 2);
			for (const c of colm) {
				c.e.tg.y = c.cy;
				S.placed.push(boxOf(c.e.tg));
				if (Math.abs(c.cy - c.e.y) > 3) paths.push({ pts: [[box.x1 + 1, c.e.y], [box.x1 + 11, c.cy]], color: COLOR[c.e.l], width: 1.2, progress: 1 });
			}
		} else {
			// narrow screens: in the band over the plot, right-aligned at the lines' end, the closed line's last (so it
			// keeps its place when the open line joins), then the trained detector's where it joins the band; every slot
			// is fixed whether or not its line has finished tracing
			const inBand = [...ends.map((e) => e.tg), ...(refBand && refTag ? [refTag] : [])];
			const slots = bandSlots(inBand, box.x1, r.left);
			inBand.forEach((tg, i) => {
				const h = boxOf(tg).h;
				Object.assign(tg, { x: slots[i].xr + 10, y: band + slots[i].row * (h + 6) + h / 2, at: "left" });
				if (tg.alpha) S.placed.push(boxOf(tg));
			});
		}
		items.push(...ends.map((e) => e.tg));

		// the trained detector's line, named where it starts (on a phone, 6px clear of it, as every name keeps 5px)
		if (ref && refTag) {
			const yr = y(ref.v), g = narrow ? 6 : 4;
			const tg: Tag = refBand ? refTag : { ...refTag, x: rx - 4, y: yr, at: "right" };
			if (tg.alpha && !refBand) {
				const h = boxOf(tg).h;
				Object.assign(tg, place([
					{ ...tg, x: rx - 4, y: yr - h / 2 - g, at: "right" }, { ...tg, x: rx - 4, y: yr + h / 2 + g, at: "right" },
					{ ...tg, x: box.x1 + 10, y: yr - h / 2 - g, at: "left" }, { ...tg, x: box.x1 + 10, y: yr + h / 2 + g, at: "left" },
				], null, S));
			}
			items.push(tg);
		}

		// Claude Fable 5.2: a clay dot and its name in plain text (no box, no score: its line's label carries the number)
		const fp = pos.get(FABLE)!;
		if (inWin(FAB) && !off(FAB) && fp.x <= dotHead.closed + 1) {
			// around the dot, or (where the frontiers crowd it, as on prose) a little further off with a hairline to it
			const lb = place([...around({ id: "fable", t: FABLE, plain: true }, fp.x, fp.y), ...[[-30, -12], [-30, 14], [-14, 90], [-14, -86], [-14, 120], [-14, -116]].map(([dx, dy]) => ({ id: "fable", t: FABLE, plain: true, x: fp.x + dx, y: fp.y + dy, at: "left" as const }))], FABLE, S);
			const at = lb.at ?? "right", bb = boxOf(lb);
			const nx = Math.max(bb.x, Math.min(bb.x + bb.w, fp.x)), ny = Math.max(bb.y, Math.min(bb.y + bb.h, fp.y)), dist = Math.hypot(nx - fp.x, ny - fp.y);
			if (dist > 16) paths.push({ pts: [[fp.x + ((nx - fp.x) / dist) * (R_FRONT + 2), fp.y + ((ny - fp.y) / dist) * (R_FRONT + 2)], [nx, ny]], color: CLAY_RAMP.mid, width: 1, progress: 1 });
			// a ground-coloured band under the words, so a line passing behind them never runs through the letters
			paths.push({ pts: [[bb.x - 3, bb.y + bb.h / 2], [bb.x + bb.w + 3, bb.y + bb.h / 2]], color: INK.ground, width: bb.h + 2, progress: 1 });
			texts.push({
				x: at === "left" ? lb.x - 10 : at === "right" ? lb.x + 10 : lb.x,
				y: at === "above" ? lb.y - 16 : at === "below" ? lb.y + 16 : lb.y,
				t: FABLE, color: CLAY_RAMP.ink, size: 13, weight: 600, align: at === "left" ? "right" : at === "right" ? "left" : "center",
			});
		}

		// the models the step's sentence names (a line's best is already named at the line's end)
		for (const id of focus) {
			if (id === FABLE) continue;
			const m = models.find((k) => k.model === id)!, l = m.line as Line, mp = pos.get(id)!;
			if (lines[l][lines[l].length - 1] === m && showLine(l)) continue;
			const on = inWin(m) && !off(m) && mp.x <= penHead[l] + 1;
			const tg = { id: "m-" + id, t: `${m.name}, ${Math.round(m[metric])}%`, color: COLOR[l], swatch: l === "open" ? ("ring" as const) : ("dot" as const), alpha: on ? 1 : 0 };
			items.push(on ? place(around(tg, mp.x, mp.y), id, S) : { ...tg, x: mp.x, y: mp.y, at: "left" });
		}

		chart.marks = marks; chart.paths = paths; chart.texts = texts;
		const sig = items.map((t) => `${t.id}|${Math.round(t.x)}|${Math.round(t.y)}|${t.at}|${t.alpha}|${t.t}|${t.sub ?? ""}`).join(";");
		if (sig !== tagSig) { tagSig = sig; tags = items; }
		if (hovered) { const h = pos.get(hovered.model); if (h && (h.x !== tip.x || h.y !== tip.y)) tip = { x: h.x, y: h.y }; }
	}

	// ---- scheduling: one frame per input; more frames only while a line traces or the plot moves over ---------------
	// (frames run in the page's loop, loop.ts: after every section has read the scroll, before the canvas draws)
	let last = 0, dirty = true, alive = true;
	let prevSig = "";
	const kick = () => { if (alive) requestFrame(tick); };
	function tick(now: number) {
		if (!alive) return;
		const dt = last ? Math.min(1 / 30, (now - last) / 1000) : 1 / 60;
		last = now;
		let moved = advance(dt);
		// retake the canvas if a neighbour left it on the plain ground while this section is in view
		if (active && field.mode === "ground") { field.mode = "chart"; field.owner = "rq1"; field.dim = 0.75; field.interactive = true; }
		if (active && field.owner === "rq1") {
			const narrow = vp.w <= 860;
			const g: Geo = { r: stage.getBoundingClientRect(), hb: head.getBoundingClientRect(), cr: card.getBoundingClientRect(), cl: col.getBoundingClientRect(), foot: 0, narrow };
			// where the card and the control row end once Explore has fully opened (its natural height, not the sliding one)
			const inner = bar.querySelector<HTMLElement>(".inner");
			g.foot = explore && inner ? bar.getBoundingClientRect().top + inner.scrollHeight : g.cr.bottom;
			const s = [g.r.left, g.r.top, g.r.width, g.r.height, g.hb.bottom, g.cr.left, g.cr.top, g.cr.right, g.cr.bottom, g.cl.right, g.foot, vp.w].join(",");
			const changed = s !== prevSig;
			prevSig = s;
			if (dirty || moved || changed) { dirty = false; layout(g); }
			if (side !== sideGoal || down !== downGoal) moved = 2;
		}
		if (moved === 2) kick(); else last = 0;
	}

	// any input marks the chart dirty
	$effect(() => {
		void [step, metric, weights, lab, wa, wb, active, field.mode, field.owner];
		dirty = true;
		kick();
	});
	// hover moves the tooltip only
	$effect(() => {
		const h = hovered && pos.get(hovered.model);
		if (h) tip = { x: h.x, y: h.y };
	});

	// ---- the step: from the scroll position, so every position is exactly one step and none can be jumped ---------
	function setStep(s: number) {
		if (s === step) return;
		step = s;
		metric = T.steps[Math.max(0, s)].metric as Metric;
		// the guided steps always show the whole picture
		if (s < LAST) { weights = "all"; lab = null; wa = 0; wb = N; }
	}
	// While the section is on screen the shown step walks toward the scroll's step one at a time, holding each for
	// HOLD_MS (a timer, not a frame loop); off screen, or on arriving from off screen, it jumps there at once.
	let since = 0, hold = 0, seen = false; // when the shown step last changed
	function follow() {
		const r = root.getBoundingClientRect(), H = vp.h;
		if (r.bottom < -H || r.top > 2 * H) { seen = false; return; }
		const q = (TRIG * H - r.top - LEAD_VH * H) / (STEP_VH * H);
		const goal = Math.max(-1, Math.min(LAST, Math.floor(q)));
		const vis = r.bottom > 0 && r.top < H, now = performance.now();
		// (the lighter mode for phones: the step follows the scroll directly; a momentum scroll is not held back)
		if (!vis || !seen || lite.on) {
			clearTimeout(hold); hold = 0;
			if (goal !== step) { setStep(goal); since = now; }
		} else if (goal !== step && !hold) {
			const wait = since + HOLD_MS - now;
			if (wait <= 0) { setStep(step + Math.sign(goal - step)); since = now; }
			if (goal !== step) hold = window.setTimeout(() => { hold = 0; follow(); }, wait > 0 ? wait : HOLD_MS);
		}
		seen = vis;
		const p = Math.max(0, Math.min(1, q - step));
		if (p !== progress) progress = p;
	}
	// a dash scrolls to the middle of its step
	// links to a step (steplinks.ts): #{id}/<step>, and the address bar follows the step in view
	onMount(() => registerSteps(T.id, T.steps.map((_, i) => String(i + 1)), (i, instant) => go(i, instant)));
	$effect(() => stepShown(T.id, step));

	function go(i: number, instant = false) {
		const el = root.querySelectorAll<HTMLElement>(".step")[i];
		if (el) scrollTo({ top: el.getBoundingClientRect().top + scrollY + el.offsetHeight / 2 - TRIG * innerHeight, behavior: instant || reduce ? "instant" : "smooth" });
	}

	// ---- the date window: two thumbs on one track, and the window between them can be dragged or moved by keys ----
	const setLo = (v: number, el: HTMLInputElement) => { wa = Math.max(0, Math.min(v, wb - GAP)); el.value = String(wa); };
	const setHi = (v: number, el: HTMLInputElement) => { wb = Math.min(N, Math.max(v, wa + GAP)); el.value = String(wb); };
	const shift = (a0: number, b0: number, by: number) => {
		const k = Math.max(-a0, Math.min(N - b0, Math.round(by)));
		wa = a0 + k; wb = b0 + k;
	};
	function grab(e: PointerEvent) {
		if (full) return;
		drag = { x: e.clientX, a: wa, b: wb, w: track.getBoundingClientRect().width };
		const el = e.currentTarget as HTMLElement;
		el.setPointerCapture(e.pointerId);
		e.preventDefault(); // no text selection; so focus by hand, and the arrow keys then move the window
		el.focus({ preventScroll: true });
	}
	const slide = (e: PointerEvent) => { if (drag) shift(drag.a, drag.b, ((e.clientX - drag.x) / drag.w) * N); };
	const drop = () => (drag = null);
	function keys(e: KeyboardEvent) {
		const by = ({ ArrowLeft: -7, ArrowRight: 7, PageDown: -30, PageUp: 30 } as Record<string, number>)[e.key];
		if (!by || full) return;
		e.preventDefault();
		shift(wa, wb, e.shiftKey ? by * 4 : by);
	}

	onMount(() => {
		reduce = matchMedia("(prefers-reduced-motion: reduce)").matches || new URLSearchParams(location.search).has("still");
		const io = new IntersectionObserver((es) => es.forEach((e) => {
			active = e.isIntersecting;
			if (active) { field.mode = "chart"; field.owner = "rq1"; field.dim = 0.75; field.interactive = true; }
			else if (field.mode === "chart" && field.owner === "rq1") { field.mode = "ground"; field.dim = 0; field.interactive = false; chart.marks = []; chart.paths = []; chart.texts = []; }
		}), { rootMargin: "-35% 0px -35% 0px" });
		io.observe(root);
		const onScroll = () => { follow(); kick(); };
		// the stage scrolling in or out, a new size, or the column growing (Explore opening) asks for one frame
		const ro = new ResizeObserver(kick);
		ro.observe(col);
		ro.observe(head);
		ro.observe(bar);
		const stopScroll = onPageScroll(onScroll); // scroll and resize, in the page's loop
		regions.rq1 = root;
		// a transform that settles (the route transition) moves the stage without a scroll or resize: check once more
		const settle = () => { if (active) kick(); };
		document.addEventListener("transitionend", settle, { passive: true });
		document.addEventListener("animationend", settle, { passive: true });
		// tag widths are measured in Inter: measure again once it has loaded
		document.fonts?.ready.then(() => { widths.clear(); dirty = true; kick(); });
		return () => {
			alive = false;
			clearTimeout(hold); hold = 0;
			io.disconnect(); ro.disconnect();
			stopScroll();
			document.removeEventListener("transitionend", settle); document.removeEventListener("animationend", settle);
		};
	});
</script>

<section class="tl" id={T.id} bind:this={root} data-step={step} style="--steps:{T.steps.length}; --step:calc({STEP_VH * 100} * var(--vh, 1vh)); --lead:calc({LEAD_VH * 100} * var(--vh, 1vh)); --tail:calc({(1 - TRIG) * 100} * var(--vh, 1vh))">
	<div class="stick" bind:this={stage}>
		<div class="lead">
			<h2 bind:this={head}>{T.title.t}</h2>
			<div class="col" bind:this={col}>
				<div class="say" class:on={step >= 0} bind:this={card} aria-live="polite">
					<StepDashes count={T.steps.length} current={step} {progress} {go} label={U.step} />
					{#key step}<p class="say-t">{T.steps[Math.max(0, step)].t}</p>{/key}
					<HoverCue class="tl-cue-narrow" hover={CUE_HOVER} tap={CUE_TAP} show={step >= 0 && !tried} style="right:12px; top:4px" />
				</div>
			</div>
			<!-- the controls, on the last step: one row under the card (it scrolls sideways where it does not fit) -->
			<div class="bar" bind:this={bar}>
				<Reveal show={explore}>
					<div class="ctl">
						<div class="seg" role="group" aria-label={U["aria.score"]}>
							{#each METRICS as m}<button type="button" aria-pressed={metric === m} onclick={() => (metric = m)}>{#if m !== "both"}<Icon name={m === "ideas" ? "bulb" : "pen"} />{/if}{U["metric." + m]}</button>{/each}
						</div>
						<div class="seg" role="group" aria-label={U["aria.weights"]}>
							{#each WEIGHT_IDS as w}<button type="button" aria-pressed={weights === w} onclick={() => (weights = w)}>{U["weights." + w]}</button>{/each}
						</div>
						<select class="lab" class:on={lab !== null} aria-label={U["aria.labs"]} value={lab ?? ""} onchange={(e) => (lab = e.currentTarget.value || null)}>
							<option value="">{U["labs.all"]}</option>
							{#each labs as l}<option value={l}>{l}</option>{/each}
						</select>
						<!-- the date window -->
						<div class="dates" role="group" aria-label={U.dates}>
							<div class="range">
								<div class="track" bind:this={track}>
									<div class="fill" style:left="{(wa / N) * 100}%" style:width="{((wb - wa) / N) * 100}%"></div>
									<div
										class="win" class:all={full} class:drag={drag !== null}
										style:left="{(wa / N) * 100}%" style:width="{((wb - wa) / N) * 100}%"
										tabindex={full ? -1 : 0} role="slider" aria-label={U["aria.window"]}
										aria-valuemin={0} aria-valuemax={N} aria-valuenow={wa} aria-valuetext="{readout[0]} {U['aria.to']} {readout[1]}"
										onpointerdown={grab} onpointermove={slide} onpointerup={drop} onpointercancel={drop} onkeydown={keys}
									></div>
								</div>
								<input type="range" min="0" max={N} step="1" value={wa} style:z-index={wa > N / 2 ? 2 : 1} aria-label={U["aria.lo"]} oninput={(e) => setLo(+e.currentTarget.value, e.currentTarget)} />
								<input type="range" min="0" max={N} step="1" value={wb} aria-label={U["aria.hi"]} oninput={(e) => setHi(+e.currentTarget.value, e.currentTarget)} />
							</div>
							<p class="xzinfo">
								<span class="val">{readout[0]} – {readout[1]}</span>
								{#if !full}<button type="button" class="reset" onclick={() => { wa = 0; wb = N; }}>{U["dates.reset"]}</button>{/if}
							</p>
						</div>
					</div>
				</Reveal>
			</div>
		</div>
		<!-- the hover cue on a wide screen, beside the headline over the plot's right edge (layout() places it) -->
		<HoverCue class="tl-cue-wide" hover={CUE_HOVER} tap={CUE_TAP} show={!!cueAt && step >= 0 && active && field.owner === "rq1" && !tried} style={cueAt ? `right:${cueAt.right}px; top:${cueAt.top}px` : "visibility:hidden"} />
	</div>
	{#if active && field.owner === "rq1"}<Tags items={tags} />{/if}
	<!-- outside the sticky stage (its own stacking context), so the tooltip sits above the tags -->
	{#if hovered && active}
		<div class="tip" class:flip={tip.x > innerWidth - 260} style="left:{tip.x}px; top:{tip.y}px">
			<b>{hovered.model}</b>
			<span>{hovered.lab}, {U[hovered.line === "open" ? "tip.open" : "tip.closed"]}</span>
			<span>{hovered.when}</span>
			<span class="tv">{Math.round(hovered[metric])}% <em>{U["metric." + metric]}</em></span>
		</div>
	{/if}
	<!-- the steps' scroll zones (the step itself is worked out from the scroll position; these are for go() and ?step=) -->
	<div class="steps" aria-hidden="true">{#each T.steps as _}<div class="step"></div>{/each}</div>
</section>

<style>
	/* lead + every step + the part of the stage below the trigger line: the last step keeps a full step of pinned scroll */
	.tl { position: relative; margin-top: 56px; height: calc(var(--lead) + var(--steps) * var(--step) + var(--tail)); }
	.stick { position: sticky; top: 0; height: calc(100 * var(--vh, 1vh)); pointer-events: none; }
	/* the headline over the chart's empty upper left, the card under it (lined up with the plot's left edge) */
	.lead { position: absolute; left: 40px; right: 0; top: 56px; display: grid; justify-items: start; align-content: start; gap: 18px; }
	h2 { max-width: 11.5em; font-size: clamp(34px, min(4.4vw, calc(6.8 * var(--vh, 1vh))), 60px); line-height: 1.02; font-weight: 600; letter-spacing: -0.035em; text-wrap: balance; }
	.col { pointer-events: auto; width: 300px; display: grid; gap: 12px; }
	.say { position: relative; padding: 14px 16px 16px; background: #fff; border-radius: 3px; opacity: 0; transform: translateY(8px); transition: opacity .45s var(--ease), transform .45s var(--ease); }
	.say.on { opacity: 1; transform: none; }
	.say-t { margin-top: 6px; font-size: 16px; line-height: 1.5; animation: say .45s var(--ease); }
	@keyframes say { from { opacity: 0; transform: translateY(6px); } }
	/* the hover cue: over the plot on a wide screen, in the card's top row on a phone */
	.tl :global(.tl-cue-narrow) { display: none; }

	/* the controls: all on one row; where the row is too wide it scrolls sideways, it never wraps */
	.bar { pointer-events: auto; max-width: 100%; min-width: 0; }
	.ctl { display: flex; flex-wrap: nowrap; align-items: center; gap: 10px; max-width: 100%; overflow-x: auto; scrollbar-width: none; }
	.ctl::-webkit-scrollbar { display: none; }
	.seg { flex: none; display: flex; flex-wrap: nowrap; gap: 2px; background: var(--chip); border-radius: 3px; padding: 3px; }
	.seg button { flex: none; display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; padding: 5px 8px; font-size: 12.5px; font-weight: 500; color: var(--ink2); border-radius: 2px; }
	.seg button:hover { color: var(--ink); }
	.seg button[aria-pressed="true"] { background: var(--ink); color: var(--field); }
	.lab { flex: none; height: 32px; padding: 0 26px 0 10px; font: inherit; font-size: 12.5px; font-weight: 500; color: var(--ink2); border: 0; border-radius: 3px; cursor: pointer; -webkit-appearance: none; appearance: none;
		background: var(--chip) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%235A6270' stroke-width='1.5'/%3E%3C/svg%3E") no-repeat right 10px center; }
	.lab:hover { color: var(--ink); }
	.lab.on { background-color: var(--ink); color: var(--field); }

	/* the date window (after the detection-frontiers dashboard's .rqx-range) */
	.dates { flex: none; display: flex; align-items: center; gap: 4px; }
	.range { position: relative; height: 22px; width: 180px; }
	.track { position: absolute; left: 7px; right: 7px; top: 10px; height: 2px; border-radius: 1px; background: var(--rule); }
	.fill { position: absolute; top: -1px; height: 4px; border-radius: 2px; background: var(--ink); }
	.win { position: absolute; top: -9px; height: 20px; cursor: grab; touch-action: none; border-radius: 3px; }
	.win:hover, .win.drag { background: rgba(20, 32, 45, .08); }
	.win.drag { cursor: grabbing; }
	.win.all { cursor: default; background: none; }
	.win:focus-visible { outline: 2px solid var(--ink); outline-offset: 1px; }
	.range input { position: absolute; inset: 0; width: 100%; height: 22px; margin: 0; background: none; pointer-events: none; -webkit-appearance: none; appearance: none; }
	.range input::-webkit-slider-runnable-track { height: 22px; background: none; }
	.range input::-moz-range-track { background: none; }
	.range input::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; pointer-events: auto; width: 14px; height: 14px; margin-top: 4px; border-radius: 50%; background: var(--field); border: 2px solid var(--ink); cursor: grab; }
	.range input::-moz-range-thumb { pointer-events: auto; width: 10px; height: 10px; border-radius: 50%; background: var(--field); border: 2px solid var(--ink); cursor: grab; }
	.range input:active::-webkit-slider-thumb { cursor: grabbing; background: var(--ink); }
	.range input:active::-moz-range-thumb { cursor: grabbing; background: var(--ink); }
	.range input:focus-visible { outline: none; }
	.range input:focus-visible::-webkit-slider-thumb { box-shadow: 0 0 0 3px rgba(20, 32, 45, .2); }
	.range input:focus-visible::-moz-range-thumb { box-shadow: 0 0 0 3px rgba(20, 32, 45, .2); }
	.xzinfo { display: flex; align-items: center; gap: 8px; min-height: 26px; white-space: nowrap; }
	.val { font-size: 12px; font-weight: 500; font-variant-numeric: tabular-nums; }
	.reset { padding: 2px 8px; font-size: 12px; font-weight: 500; color: var(--ink2); background: var(--chip); border-radius: 2px; }
	.reset:hover { color: var(--ink); }

	.tip { position: fixed; z-index: 5; transform: translate(14px, -50%); display: grid; gap: 2px; padding: 9px 12px; background: #fff; border-radius: 3px; box-shadow: 0 6px 20px rgba(20, 32, 45, .14); font-size: 12.5px; color: var(--ink2); pointer-events: none; white-space: nowrap; }
	.tip.flip { transform: translate(calc(-100% - 14px), -50%); }
	.tip b { font-size: 14px; color: var(--ink); }
	.tv { font-size: 18px; font-weight: 600; color: var(--ink); }
	.tv em { font-style: normal; font-size: 12px; font-weight: 400; color: var(--ink2); }
	/* tags follow the chart at once (scrubbing redraws at once); they still fade in and out */
	.tl :global(.tags .tag) { transition: opacity .3s; }
	.tl :global(.tags .pos) { transition: none; }

	.steps { position: absolute; inset: 0; pointer-events: none; }
	.step { height: var(--step); }
	.step:first-child { margin-top: var(--lead); }
	@media (prefers-reduced-motion: reduce) { .say, .say-t { transition: none; animation: none; } .tl :global(.tags .tag), .tl :global(.tags .pos) { transition: none; } }
	@media (max-width: 860px) {
		.lead { left: 0; top: 16px; gap: 10px; }
		h2 { font-size: clamp(28px, 8.4vw, 36px); }
		.col, .bar { width: 100%; }
		.ctl { gap: 8px; }
		.seg { gap: 1px; }
		.seg button { padding-inline: 6px; }
		.tl :global(.tl-cue-narrow) { display: inline-flex; }
		.tl :global(.tl-cue-wide) { display: none; }
	}
</style>
