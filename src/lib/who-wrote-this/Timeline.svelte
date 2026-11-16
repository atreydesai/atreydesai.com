<script lang="ts">
	// "Model accuracy has improved over time": Figure 2's 68 models as the page's own dots. The section pins a
	// full-screen stage; while it is pinned the field turns into the chart (release date across, accuracy up).
	//
	// Blocking: the chart runs the full width of the stage. The headline is set large above its empty upper-left
	// corner and the narration card sits in that corner, under the headline (the guided steps' pictures are checked to
	// keep clear of it; where they would not, the plot starts right of the card instead). Reveal order: the headline
	// alone while the stage arrives, then the card with the guided steps, then on the last step the Explore controls
	// (metric, weights, labs, date window) slide in under the card and the plot moves over to make room for them.
	// Guided scroll, one or two paper sentences per step: the closed-weights frontier traces in, then the open-weights
	// frontier, then the trained detectors join (prose, then ideas). Each line is named at its end as soon as it is
	// drawn. The step comes from the scroll position (no gaps: every position maps to one step, each step ~95vh);
	// the dashes on the card are buttons that scroll to their step. Hover any model.
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
	import { field, chart, type Mark, type Path, type Text } from "./field.svelte";
	import { WEIGHTS, MODEL, GRAY, INK, FABLE as CLAY_RAMP } from "./palette";
	import Icon from "./Icon.svelte";
	import Reveal from "./Reveal.svelte";
	import StepDashes from "./StepDashes.svelte";
	import Tags, { type Tag } from "./Tags.svelte";
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
	const STEP_VH = 0.95, LEAD_VH = 0.55, TRIG = 0.5; // scroll per step, where step 0 starts, the trigger line (viewport heights)
	const R_FRONT = 6, R_DOT = 4.5, R_FOCUS = 2.5; // outer radii: a frontier model, any other model, extra for a named one
	const RING_W = 1.8; // DotField's ring stroke: a ring is drawn at r - RING_W / 2 so its outer edge is r
	const LINE_W = 2.2, CASE_W = 6.5; // a line, and the ground-coloured casing under it
	const AX = 40; // px from the stage's left edge to the plot (the y labels hang in this margin)
	const PLAIN_FONT = "600 13px Inter, system-ui, sans-serif";
	const ink2 = INK.ink2, rule = "rgba(20,32,45,.14)";
	const PCT = Array.from({ length: 11 }, (_, i) => `${i * 10}%`);

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
	let active = $state(false);
	let stage: HTMLElement, root: HTMLElement, head: HTMLElement, col: HTMLElement, card: HTMLElement, track: HTMLElement;
	const explore = $derived(step >= LAST);
	const full = $derived(wa === 0 && wb === N);
	let hovered = $derived(field.hover ? models.find((m) => m.model === field.hover) ?? null : null);
	let tip = $state({ x: 0, y: 0 });
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
	// where the plot's left edge is: 0 = the full width (the card sits in its corner), 1 = right of the column (Explore)
	let side = 0, sideGoal = 0, laidW = 0;
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
		if (side !== sideGoal) {
			side = reduce ? sideGoal : sideGoal > side ? Math.min(sideGoal, side + dt / SIDE_S) : Math.max(sideGoal, side - dt / SIDE_S);
			out = side === sideGoal ? Math.max(out, 1) : 2;
		}
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
			for (const m of S.dots) if (m.x > b.x - m.r && m.x < b.x + b.w + m.r && m.y > b.y - m.r && m.y < b.y + b.h + m.r) cost += m.id === self || m.id === FABLE ? 40 : c.plain ? 25 : S.key.has(m.id) ? 12 : 1.5;
			for (const s of S.segs) if (Math.max(s[0], s[2]) > b.x + 2 && Math.min(s[0], s[2]) < b.x + b.w - 2 && Math.max(s[1], s[3]) > b.y + 2 && Math.min(s[1], s[3]) < b.y + b.h - 2) cost += c.plain ? 3 : 5;
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
		{ ...tg, x: x - 2, y: y - 34, at: "left" },
		{ ...tg, x: x - 2, y: y + 38, at: "left" },
		{ ...tg, x: x - 2, y: y - 58, at: "left" },
		{ ...tg, x: x - 2, y: y + 62, at: "left" },
	];
	const rect = (d: DOMRect, p = 0): B => ({ x: d.left - p, y: d.top - p, w: d.width + 2 * p, h: d.height + 2 * p });

	// ---- the chart: rebuilt only when an input changed or a line is tracing ----------------------------------------
	const pos = new Map<string, { x: number; y: number }>();
	let tagSig = "";
	type Geo = { r: DOMRect; hb: DOMRect; cr: DOMRect; cl: DOMRect; more: number; narrow: boolean };
	function layout({ r, hb, cr, cl, more, narrow }: Geo) {
		const W = innerWidth;
		let box: Box;
		if (narrow) {
			// stacked: the plot under the column, sized for the column's final height (so Explore opening does not
			// re-lay the chart out on every frame of its slide)
			box = { x0: r.left + 34, x1: r.right - 6, y0: cr.bottom + more + 44, y1: r.bottom - 56 };
			sideGoal = 0; side = 0;
		} else {
			const over: Box = { x0: r.left + AX, x1: Math.min(r.right - 24, W - 196), y0: hb.bottom + 44, y1: r.bottom - 64 }; // room on the right for the line labels, clear of the page's side rail
			sideGoal = explore || !clearOf(over, cr) ? 1 : 0;
			if (laidW !== W) side = sideGoal; // first drawing, or a new size: no slide
			box = { ...over, x0: over.x0 + (cl.right + 52 - over.x0) * ease(side) };
		}
		laidW = W;
		const t0 = START + wa * DAY, t1 = START + wb * DAY;
		const inWin = (m: Model) => m.t >= t0 && m.t <= t1;
		const ref = metric === "both" ? null : D.refs[metric];
		const lo = lowOf(metric, t0, t1);
		const y = (v: number) => box.y1 - ((v - lo) / (100 - lo)) * (box.y1 - box.y0);
		const x = (t: number) => box.x0 + ((t - t0) / (t1 - t0)) * (box.x1 - box.x0);

		// frontier lines inside the window: they start afresh from the models released in it
		const lines = frontier(metric, t0, t1);
		const showLine = (l: Line) => weights === "all" || weights === l;
		const off = (m: Model) => (weights !== "all" && m.line !== weights) || (lab !== null && m.lab !== lab);
		const front = new Set([...lines.closed, ...lines.open].map((m) => m.model));
		const focus = step < 0 || explore ? NONE : FOCUS[step];
		const outer = (m: Model) => (m === FAB ? R_FRONT : (front.has(m.model) ? R_FRONT : R_DOT) + (focus.has(m.model) ? R_FOCUS : 0));

		// every model's point (a model outside the window waits at the plot's edge, so scrubbing slides it in)
		pos.clear();
		for (const m of models) pos.set(m.model, { x: m.t < t0 ? box.x0 : m.t > t1 ? box.x1 : x(m.t), y: Math.max(box.y0, Math.min(box.y1, y(m[metric]))) });

		// each line as legs, one per step, built from the marks' own points: across to the next model's date, then up
		// to it. A leg starts and ends at the marks' edges, so the dash pattern starts fresh at every ring.
		type Leg = { pts: [number, number][]; s: number; e: number };
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
				if (cut) legs[l].push({ pts: cut, s: acc + ra, e: acc + len - rb });
				all.push(...pts.slice(1));
				acc += len;
			});
			poly[l] = all; total[l] = acc;
		}
		const dotHead = { closed: headX(poly.closed, ease(gate.closed)), open: headX(poly.open, ease(gate.open)) };
		const penHead = { closed: headX(poly.closed, ease(trace.closed)), open: headX(poly.open, ease(trace.open)) };

		// dots: every one snaps (no flying in, no lag behind the lines); a ring is drawn half its stroke smaller
		const marks: Mark[] = [];
		for (const m of models) {
			const l = m.line as Line, fable = m === FAB, p = pos.get(m.model)!;
			const shown = inWin(m) && p.x <= dotHead[l] + 1;
			const R = outer(m), ring = l === "open" && !fable;
			marks.push({
				id: m.model, x: p.x, y: p.y, r: ring ? R - RING_W / 2 : R, snap: true,
				color: fable ? CLAY : COLOR[l], ring,
				alpha: !shown ? 0 : off(m) ? 0.12 : fable || front.has(m.model) || focus.has(m.model) ? 1 : 0.42,
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
		texts.push({ x: box.x1, y: box.y1 + 40, t: U.x_label, color: ink2, size: 11.5, align: "right" });

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
			for (const g of legs[l]) if (prog(g) > 0) paths.push({ pts: g.pts, color: COLOR[l], width: LINE_W, dash: DASH[l], progress: prog(g) });
			const q = poly[l]!;
			for (let i = 1; i < q.length; i++) segs.push([q[i - 1][0], q[i - 1][1], q[i][0], q[i][1]]);
		}

		// ---- tags: every colour on the picture is named on it ---------------------------------------------------
		const S: Scene = {
			placed: narrow ? [] : [rect(hb, 4), rect(cl, 8)], segs, dots: marks.filter((m) => (m.alpha ?? 1) > 0.3), key: new Set(LINES.map((l) => lines[l][lines[l].length - 1]?.model ?? "")),
			bounds: { x0: box.x0 - 2, x1: narrow ? W - 4 : W - 34, y0: narrow ? cl.bottom + 6 : r.top + 40, y1: box.y1 + 4 },
		};
		const items: Tag[] = [];

		// each line's name at its end, with its best model and score, as soon as the line is drawn
		const ends: { l: Line; tg: Tag; y: number }[] = [];
		for (const l of LINES) {
			const f = lines[l];
			if (!f.length || !showLine(l)) continue;
			const b = f[f.length - 1], yb = pos.get(b.model)!.y;
			ends.push({ l, y: yb, tg: { id: "line-" + l, x: box.x1 + 2, y: yb, at: "right", t: U["weights." + l], sub: `${b.name}, ${Math.round(b[metric])}%`, color: COLOR[l], swatch: l === "closed" ? "line" : "dash", strong: !narrow, alpha: trace[l] >= 1 ? 1 : 0 } });
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
				colm[i].cy = Math.max(colm[i].cy, i ? colm[i - 1].cy + (colm[i - 1].h + colm[i].h) / 2 + 8 : r.top + 44 + colm[i].h / 2);
			for (const c of colm) {
				c.e.tg.y = c.cy;
				S.placed.push(boxOf(c.e.tg));
				if (Math.abs(c.cy - c.e.y) > 3) paths.push({ pts: [[box.x1 + 1, c.e.y], [box.x1 + 11, c.cy]], color: COLOR[c.e.l], width: 1.2, progress: 1 });
			}
		} else {
			// narrow screens: right-aligned at the end of the line, just above it (clear of its last dot) or below it
			const g = R_FRONT + 3, n0 = S.placed.length;
			for (const e of shownEnds) {
				const h = boxOf(e.tg).h;
				const at = (dy: number): Tag => ({ ...e.tg, x: box.x1 + 10, y: e.y + dy, at: "left" });
				Object.assign(e.tg, place([at(-h / 2 - g), at(h / 2 + g), at(-h / 2 - g - 20), at(h / 2 + g + 20), at(-h / 2 - g - 44), at(h / 2 + g + 44)], null, S));
			}
			// two line ends close together (prose): their tags never overlap each other; the lower one moves down
			const stack = shownEnds.map((e) => e.tg).sort((a, b) => boxOf(a).y - boxOf(b).y);
			for (let i = 1; i < stack.length; i++) { const a = boxOf(stack[i - 1]), b = boxOf(stack[i]), need = a.y + a.h + 6 - b.y; if (need > 0) stack[i].y += need; }
			S.placed.splice(n0, S.placed.length - n0, ...stack.map(boxOf));
		}
		items.push(...ends.map((e) => e.tg));

		// the trained detector's line, named where it starts
		if (ref) {
			const yr = y(ref.v);
			const tg: Tag = { id: "ref", x: rx - 4, y: yr, at: "right", t: ref.t, sub: `${U.trained}, ${Math.round(ref.v)}%`, color: GRAY.strong, swatch: "dash", alpha: trace.ref >= 1 ? 1 : 0 };
			if (tg.alpha) {
				const h = boxOf(tg).h;
				Object.assign(tg, place([
					{ ...tg, x: rx - 4, y: yr - h / 2 - 4, at: "right" }, { ...tg, x: rx - 4, y: yr + h / 2 + 4, at: "right" },
					{ ...tg, x: box.x1 + 10, y: yr - h / 2 - 4, at: "left" }, { ...tg, x: box.x1 + 10, y: yr + h / 2 + 4, at: "left" },
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
	let raf = 0, last = 0, dirty = true;
	let prevSig = "";
	const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };
	function tick(now: number) {
		raf = 0;
		const dt = last ? Math.min(1 / 30, (now - last) / 1000) : 1 / 60;
		last = now;
		let moved = advance(dt);
		// retake the canvas if a neighbour left it on the plain ground while this section is in view
		if (active && field.mode === "ground") { field.mode = "chart"; field.owner = "rq1"; field.dim = 0.75; field.interactive = true; }
		if (active && field.owner === "rq1") {
			const narrow = innerWidth <= 860;
			const g: Geo = { r: stage.getBoundingClientRect(), hb: head.getBoundingClientRect(), cr: card.getBoundingClientRect(), cl: col.getBoundingClientRect(), more: 0, narrow };
			if (narrow && explore) { const inner = col.querySelector<HTMLElement>(".inner"); g.more = inner ? 8 + inner.scrollHeight : 0; }
			const s = [g.r.left, g.r.top, g.r.width, g.r.height, g.hb.bottom, g.cr.left, g.cr.top, g.cr.right, g.cr.bottom, g.cl.right, g.cl.bottom, g.more, innerWidth].join(",");
			const changed = s !== prevSig;
			prevSig = s;
			if (dirty || moved || changed) { dirty = false; layout(g); }
			if (side !== sideGoal) moved = 2;
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
	function follow() {
		const r = root.getBoundingClientRect(), H = innerHeight;
		if (r.bottom < -H || r.top > 2 * H) return;
		setStep(Math.max(-1, Math.min(LAST, Math.floor((TRIG * H - r.top - LEAD_VH * H) / (STEP_VH * H)))));
	}
	// a dash scrolls to the middle of its step
	function go(i: number) {
		const el = root.querySelectorAll<HTMLElement>(".step")[i];
		if (el) scrollTo({ top: el.getBoundingClientRect().top + scrollY + el.offsetHeight / 2 - TRIG * innerHeight, behavior: reduce ? "instant" : "smooth" });
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
		follow();
		// the stage scrolling in or out, a new size, or the column growing (Explore opening) asks for one frame
		const ro = new ResizeObserver(kick);
		ro.observe(col);
		ro.observe(head);
		addEventListener("scroll", onScroll, { passive: true });
		addEventListener("resize", onScroll, { passive: true });
		// a transform that settles (the route transition) moves the stage without a scroll or resize: check once more
		const settle = () => { if (active) kick(); };
		document.addEventListener("transitionend", settle, { passive: true });
		document.addEventListener("animationend", settle, { passive: true });
		// tag widths are measured in Inter: measure again once it has loaded
		document.fonts?.ready.then(() => { widths.clear(); dirty = true; kick(); });
		return () => {
			cancelAnimationFrame(raf); raf = 0;
			io.disconnect(); ro.disconnect();
			removeEventListener("scroll", onScroll); removeEventListener("resize", onScroll);
			document.removeEventListener("transitionend", settle); document.removeEventListener("animationend", settle);
		};
	});
</script>

<section class="tl" id={T.id} bind:this={root} data-step={step} style="--steps:{T.steps.length}; --step:{STEP_VH * 100}vh; --lead:{LEAD_VH * 100}vh; --tail:{(1 - TRIG) * 100}vh">
	<div class="stick" bind:this={stage}>
		<div class="lead">
			<h2 bind:this={head}>{T.title.t}</h2>
			<div class="col" bind:this={col}>
				<div class="say" class:on={step >= 0} bind:this={card} aria-live="polite">
					<StepDashes count={T.steps.length} current={step} {go} label={U.step} />
					{#key step}<p class="say-t">{T.steps[Math.max(0, step)].t}</p>{/key}
				</div>
				<Reveal show={explore} label={U.explore}>
					<div class="ctl">
						<div class="seg" role="group" aria-label={U["aria.score"]}>
							{#each METRICS as m}<button type="button" aria-pressed={metric === m} onclick={() => (metric = m)}>{#if m !== "both"}<Icon name={m === "ideas" ? "bulb" : "pen"} />{/if}{U["metric." + m]}</button>{/each}
						</div>
						<div class="seg" role="group" aria-label={U["aria.weights"]}>
							{#each WEIGHT_IDS as w}<button type="button" aria-pressed={weights === w} onclick={() => (weights = w)}>{U["weights." + w]}</button>{/each}
						</div>
						<div class="labs" role="group" aria-label={U["aria.labs"]}>
							{#each labs as l}<button type="button" aria-pressed={lab === l} onclick={() => (lab = lab === l ? null : l)}>{l}</button>{/each}
						</div>
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
								{#if full}<small>{U["dates.all"]}</small>{:else}<button type="button" class="reset" onclick={() => { wa = 0; wb = N; }}>{U["dates.reset"]}</button>{/if}
							</p>
						</div>
						<p class="cap">{T.caption.t}</p>
					</div>
				</Reveal>
			</div>
		</div>
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
	.stick { position: sticky; top: 0; height: 100vh; pointer-events: none; }
	/* the headline over the chart's empty upper left, the card under it (lined up with the plot's left edge) */
	.lead { position: absolute; left: 40px; right: 0; top: 56px; display: grid; justify-items: start; align-content: start; gap: 18px; }
	h2 { max-width: 11.5em; font-size: clamp(34px, min(4.4vw, 6.8vh), 60px); line-height: 1.02; font-weight: 600; letter-spacing: -0.035em; text-wrap: balance; }
	.col { pointer-events: auto; width: 300px; display: grid; gap: 12px; }
	.say { padding: 14px 16px 16px; background: #fff; border-radius: 3px; opacity: 0; transform: translateY(8px); transition: opacity .45s var(--ease), transform .45s var(--ease); }
	.say.on { opacity: 1; transform: none; }
	.say-t { margin-top: 6px; font-size: 16px; line-height: 1.5; animation: say .45s var(--ease); }
	@keyframes say { from { opacity: 0; transform: translateY(6px); } }

	.ctl { display: grid; gap: 8px; }
	/* controls: one line each; a row that is too wide scrolls inside itself, it never wraps */
	.seg { display: flex; flex-wrap: nowrap; gap: 2px; justify-self: start; max-width: 100%; overflow-x: auto; scrollbar-width: none; background: var(--chip); border-radius: 3px; padding: 3px; }
	.seg::-webkit-scrollbar, .labs::-webkit-scrollbar { display: none; }
	.seg button, .labs button { flex: none; display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; padding: 5px 8px; font-size: 12.5px; font-weight: 500; color: var(--ink2); border-radius: 2px; }
	.seg button:hover, .labs button:hover { color: var(--ink); }
	.seg button[aria-pressed="true"], .labs button[aria-pressed="true"] { background: var(--ink); color: var(--field); }
	.labs { display: flex; flex-wrap: wrap; gap: 4px; }
	.labs button { background: rgba(243, 243, 239, .9); }
	.cap { font-size: 12px; color: var(--ink2); }

	/* the date window (after the detection-frontiers dashboard's .rqx-range) */
	.dates { display: grid; gap: 2px; margin-top: 4px; }
	.range { position: relative; height: 22px; }
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
	.xzinfo { display: flex; align-items: center; gap: 10px; padding-left: 7px; min-height: 26px; white-space: nowrap; }
	.val { font-size: 12px; font-weight: 500; font-variant-numeric: tabular-nums; }
	.xzinfo small { font-size: 11.5px; color: var(--ink2); }
	.reset { padding: 2px 8px; font-size: 12px; font-weight: 500; color: var(--ink2); background: var(--chip); border-radius: 2px; }
	.reset:hover { color: var(--ink); }

	.tip { position: fixed; z-index: 5; transform: translate(14px, -50%); display: grid; gap: 2px; padding: 9px 12px; background: #fff; border-radius: 3px; box-shadow: 0 6px 20px rgba(20, 32, 45, .14); font-size: 12.5px; color: var(--ink2); pointer-events: none; white-space: nowrap; }
	.tip.flip { transform: translate(calc(-100% - 14px), -50%); }
	.tip b { font-size: 14px; color: var(--ink); }
	.tv { font-size: 18px; font-weight: 600; color: var(--ink); }
	.tv em { font-style: normal; font-size: 12px; font-weight: 400; color: var(--ink2); }
	/* tags follow the chart at once (scrubbing redraws at once); they still fade in and out */
	.tl :global(.tags .tag) { transition: opacity .3s; }

	.steps { position: absolute; inset: 0; pointer-events: none; }
	.step { height: var(--step); }
	.step:first-child { margin-top: var(--lead); }
	@media (prefers-reduced-motion: reduce) { .say, .say-t { transition: none; animation: none; } .tl :global(.tags .tag) { transition: none; } }
	@media (max-width: 860px) {
		.lead { left: 0; top: 16px; gap: 10px; }
		h2 { font-size: clamp(28px, 8.4vw, 36px); }
		.col { width: 100%; gap: 8px; }
		.labs { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; }
		.cap { display: none; }
		.seg { gap: 1px; }
		.seg button { padding-inline: 6px; }
		.dates { margin-top: 0; }
	}
</style>
