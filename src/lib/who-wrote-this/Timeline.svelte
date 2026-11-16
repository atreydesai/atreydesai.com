<script lang="ts">
	// "Model accuracy has improved over time": Figure 2's 68 models as the page's own dots. The section pins a
	// full-screen stage; while it is pinned the field turns into the chart (release date across, accuracy up).
	// Guided scroll, one paper sentence per step: the closed-weights frontier traces in, then the open-weights frontier,
	// then both lines are named on the picture, then the trained detectors join (prose, then ideas). On the last step
	// the controls arrive under the card (Reveal): metric, weights and labs, plus a date-window scrubber under the
	// x-axis (two thumbs and a draggable window, copied from the detection-frontiers dashboard). Hover any model.
	// Strings: timeline.json (paper text with src; everything else in `ui`). Data: timeline_rq1.json (read-only).
	//
	// Performance: nothing runs per frame while idle. An input (step, control, hover, size, or the stage scrolling in
	// or out) marks the chart dirty and asks for one frame; the frame loop keeps going only while a line is tracing.
	import { onMount } from "svelte";
	import { field, chart, type Mark, type Path, type Text } from "./field.svelte";
	import { WEIGHTS, MODEL, GRAY, INK } from "./palette";
	import Reveal from "./Reveal.svelte";
	import Tags, { type Tag } from "./Tags.svelte";
	import T from "./timeline.json";
	import D from "./timeline_rq1.json";

	type Metric = "both" | "ideas" | "prose";
	type Line = "closed" | "open";
	type Layer = Line | "ref";
	type Model = (typeof D.models)[number] & { t: number; name: string; when: string };
	type B = { x: number; y: number; w: number; h: number };

	const U: Record<string, string> = Object.fromEntries(T.ui.map((u) => [u.id, u.t]));
	const NAME: Record<string, string> = Object.fromEntries(T.names.map((n) => [n.model, n.t]));
	const LAST = T.steps.length - 1;
	const FABLE = "Claude Fable 5.2";
	const CLAY = MODEL[FABLE];
	const LINES: Line[] = ["closed", "open"];
	const LAYERS: Layer[] = ["closed", "open", "ref"];
	const METRICS: Metric[] = ["both", "ideas", "prose"];
	const WEIGHT_IDS = ["all", "closed", "open"] as const;
	const COLOR: Record<Line, string> = { closed: WEIGHTS.closed.color, open: WEIGHTS.open.color };
	const DASH: Record<Line, number[]> = { closed: [...WEIGHTS.closed.dash], open: [...WEIGHTS.open.dash] };
	const REF_DASH = [3, 4], GRID_DASH = [1, 5];
	const TRACE_S = 1.6; // seconds for a line to trace in
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

	let metric = $state<Metric>("both");
	let weights = $state<"all" | Line>("all");
	let lab = $state<string | null>(null);
	let wa = $state(0), wb = $state(N); // the date window, in days from START
	let step = $state(0);
	let seen = $state(false); // a step has been reached: the lines wait for it
	let active = $state(false);
	let stage: HTMLElement, root: HTMLElement, panel: HTMLElement, track: HTMLElement;
	const explore = $derived(step >= LAST);
	const full = $derived(wa === 0 && wb === N);
	let hovered = $derived(field.hover ? models.find((m) => m.model === field.hover) ?? null : null);
	let tip = $state({ x: 0, y: 0 });
	let tags = $state<Tag[]>([]);
	let xz = $state({ left: 0, top: 0, width: 0 });
	let drag = $state<{ x: number; a: number; b: number; w: number } | null>(null);
	const readout = $derived.by(() => {
		const f = wb - wa > 400 ? F_MON : F_DAY;
		return [f.format(START + wa * DAY), f.format(START + wb * DAY)];
	});

	// how far each line (and the trained detector's line) has traced in, 0..1; `gate` is how far its dots have been
	// revealed, which does not rewind when a new metric traces the lines again
	const trace: Record<Layer, number> = { closed: 0, open: 0, ref: 0 };
	const gate: Record<Line, number> = { closed: 0, open: 0 };
	let traced: Metric = "both";
	let reduce = false;
	const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
	const drawn = () => (!seen ? [] : explore ? T.steps[LAST].draw : T.steps[step].draw);

	/** Moves the traces one frame toward what the step wants. Returns 1 if anything changed, 2 if still moving. */
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
	function boxOf(tg: Tag): B {
		const fs = tg.strong ? 14 : 12.5;
		const sw = tg.color ? (tg.swatch === "line" || tg.swatch === "dash" ? 16 : 10) + 6 : 0;
		const w = (tg.strong ? 20 : 16) + Math.max(sw + tw(tg.t, `600 ${fs}px Inter, system-ui, sans-serif`), tg.sub ? tw(tg.sub, "500 11.5px Inter, system-ui, sans-serif") : 0);
		const h = (tg.strong ? 10 : 6) + fs * LH + (tg.sub ? 1 + 11.5 * LH : 0);
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
	function place(cands: Tag[], self: string | null, S: Scene) {
		let best = cands[0], bestB = boxOf(best), bestC = Infinity;
		cands.forEach((c, i) => {
			const b = boxOf(c);
			let cost = i * 0.3;
			if (b.x < S.bounds.x0 || b.x + b.w > S.bounds.x1 || b.y < S.bounds.y0 || b.y + b.h > S.bounds.y1) cost += 1000; // never off the stage or over the card
			for (const q of S.placed) { const o = overlap(b, q); if (o > 0) cost += 200 + (o / (b.w * b.h)) * 300; }
			for (const m of S.dots) if (m.x > b.x - m.r && m.x < b.x + b.w + m.r && m.y > b.y - m.r && m.y < b.y + b.h + m.r) cost += m.id === self || m.id === FABLE ? 40 : S.key.has(m.id) ? 12 : 1.5;
			for (const s of S.segs) if (Math.max(s[0], s[2]) > b.x + 2 && Math.min(s[0], s[2]) < b.x + b.w - 2 && Math.max(s[1], s[3]) > b.y + 2 && Math.min(s[1], s[3]) < b.y + b.h - 2) cost += 5;
			if (cost < bestC) { bestC = cost; best = c; bestB = b; }
		});
		S.placed.push(bestB);
		return best;
	}
	// a tag for one dot: to its upper left first (the empty side of a rising frontier), then around it
	const around = (tg: Omit<Tag, "x" | "y" | "at">, x: number, y: number): Tag[] => [
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

	// ---- the chart: rebuilt only when an input changed or a line is tracing ----------------------------------------
	const pos = new Map<string, { x: number; y: number }>();
	let tagSig = "";
	function layout(r: DOMRect, p: DOMRect, narrow: boolean) {
		const W = innerWidth;
		const box = narrow
			? { x0: r.left + 40, x1: r.right - 6, y0: p.bottom + 72, y1: r.bottom - 112 }
			: { x0: p.right + 56, x1: Math.min(r.right - 24, W - 196), y0: r.top + 100, y1: r.bottom - 120 }; // wide: room on the right for the line labels, clear of the page's side rail
		const t0 = START + wa * DAY, t1 = START + wb * DAY;
		const inWin = (m: Model) => m.t >= t0 && m.t <= t1;
		const ref = metric === "both" ? null : D.refs[metric];
		let mn = ref ? ref.v : 100;
		for (const m of models) if (inWin(m) && m[metric] < mn) mn = m[metric];
		const lo = Math.max(0, Math.min(80, Math.floor((mn - 4) / 10) * 10));
		const y = (v: number) => box.y1 - ((v - lo) / (100 - lo)) * (box.y1 - box.y0);
		const x = (t: number) => box.x0 + ((t - t0) / (t1 - t0)) * (box.x1 - box.x0);

		// frontier lines inside the window: they start afresh from the models released in it
		const lines: Record<Line, Model[]> = { closed: [], open: [] };
		const top: Record<Line, number> = { closed: -1, open: -1 };
		for (const m of byRelease[metric]) {
			const l = m.line as Line;
			if (inWin(m) && m[metric] > top[l]) { top[l] = m[metric]; lines[l].push(m); }
		}
		const stepPts = (f: Model[]) => {
			const pts: [number, number][] = [];
			for (let i = 0; i < f.length; i++) {
				const px = x(f[i].t), py = y(f[i][metric]);
				if (i) pts.push([px, pts[pts.length - 1][1]]);
				pts.push([px, py]);
			}
			pts.push([box.x1, pts[pts.length - 1][1]]);
			return pts;
		};
		const pts: Record<Line, [number, number][] | null> = { closed: lines.closed.length ? stepPts(lines.closed) : null, open: lines.open.length ? stepPts(lines.open) : null };
		const dotHead = { closed: headX(pts.closed, ease(gate.closed)), open: headX(pts.open, ease(gate.open)) };
		const penHead = { closed: headX(pts.closed, ease(trace.closed)), open: headX(pts.open, ease(trace.open)) };
		const showLine = (l: Line) => weights === "all" || weights === l;
		const off = (m: Model) => (weights !== "all" && m.line !== weights) || (lab !== null && m.lab !== lab);
		const front = new Set([...lines.closed, ...lines.open].map((m) => m.model));
		const focus = !seen || explore ? NONE : FOCUS[step];

		// dots: a model outside the window waits, unseen, at the plot's edge (so scrubbing slides it in)
		const marks: Mark[] = [];
		pos.clear();
		for (const m of models) {
			const l = m.line as Line, inside = inWin(m), fable = m === FAB;
			const mx = inside ? x(m.t) : m.t < t0 ? box.x0 : box.x1;
			const my = Math.max(box.y0, Math.min(box.y1, y(m[metric])));
			const shown = inside && mx <= dotHead[l] + 1;
			marks.push({
				id: m.model, x: mx, y: my,
				r: (front.has(m.model) ? 6 : 4.5) + (focus.has(m.model) ? 2.5 : 0),
				color: fable ? CLAY : COLOR[l], ring: l === "open" && !fable,
				alpha: !shown ? 0 : off(m) ? 0.12 : focus.size && !focus.has(m.model) ? 0.55 : 1,
			});
			pos.set(m.model, { x: mx, y: my });
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

		const segs: number[][] = [];
		for (const l of LINES) {
			const q = pts[l];
			if (!q || !showLine(l) || trace[l] <= 0) continue;
			paths.push({ pts: q, color: COLOR[l], width: 2.2, dash: DASH[l], progress: ease(trace[l]) });
			for (let i = 1; i < q.length; i++) segs.push([q[i - 1][0], q[i - 1][1], q[i][0], q[i][1]]);
		}
		if (ref && trace.ref > 0) {
			paths.push({ pts: [[box.x0, y(ref.v)], [box.x1, y(ref.v)]], color: GRAY.strong, width: 1.6, dash: REF_DASH, progress: ease(trace.ref) });
			segs.push([box.x0, y(ref.v), box.x1, y(ref.v)]);
		}

		// ---- tags: every colour on the picture is named on it ---------------------------------------------------
		const want = drawn();
		const labelsOn = want.includes("labels");
		const S: Scene = {
			placed: [], segs, dots: marks.filter((m) => (m.alpha ?? 1) > 0.3), key: new Set(LINES.map((l) => lines[l][lines[l].length - 1]?.model ?? "")),
			bounds: { x0: box.x0 - 2, x1: narrow ? W - 4 : W - 34, y0: narrow ? p.bottom + 6 : r.top + 40, y1: box.y1 + 4 },
		};
		const items: Tag[] = [];
		const fabX = pos.get(FABLE)!.x;
		const fabOn = inWin(FAB) && !off(FAB) && fabX <= penHead.closed + 1;

		// each line's name at its end, with its best model and score (Fable's own clay tag carries those when it is best)
		const ends: { l: Line; tg: Tag; y: number }[] = [];
		for (const l of LINES) {
			const f = lines[l];
			if (!f.length || !showLine(l)) continue;
			const b = f[f.length - 1];
			const merged = b === FAB && fabOn;
			ends.push({
				l, y: y(b[metric]),
				tg: { id: "line-" + l, x: box.x1 + 2, y: y(b[metric]), at: "right", t: U["weights." + l], sub: merged ? undefined : `${b.name}, ${Math.round(b[metric])}%`, color: COLOR[l], swatch: l === "closed" ? "line" : "dash", strong: !narrow, alpha: labelsOn && trace[l] >= 1 ? 1 : 0 },
			});
		}
		const shownEnds = ends.filter((e) => e.tg.alpha);
		if (!narrow) {
			// wide screens: a column just past the lines' ends, pushed apart where two ends are close, with leaders
			const col = shownEnds.map((e) => ({ e, h: boxOf(e.tg).h, cy: e.y })).sort((a, b) => a.cy - b.cy);
			for (let it = 0; it < 40; it++) {
				let moved = false;
				for (let i = 1; i < col.length; i++) {
					const need = (col[i - 1].h + col[i].h) / 2 + 8 - (col[i].cy - col[i - 1].cy);
					if (need > 0.5) { col[i - 1].cy -= need / 2; col[i].cy += need / 2; moved = true; }
				}
				if (!moved) break;
			}
			// keep the column on the stage: below its top, then nothing overlapping on the way down
			for (let i = 0; i < col.length; i++)
				col[i].cy = Math.max(col[i].cy, i ? col[i - 1].cy + (col[i - 1].h + col[i].h) / 2 + 8 : r.top + 44 + col[i].h / 2);
			for (const c of col) {
				c.e.tg.y = c.cy;
				S.placed.push(boxOf(c.e.tg));
				if (Math.abs(c.cy - c.e.y) > 3) paths.push({ pts: [[box.x1 + 1, c.e.y], [box.x1 + 11, c.cy]], color: COLOR[c.e.l], width: 1.2, progress: 1 });
			}
		} else {
			// narrow screens: right-aligned at the end of the line, above or below it
			for (const e of shownEnds) {
				const h = boxOf(e.tg).h;
				const at = (dy: number): Tag => ({ ...e.tg, x: box.x1 + 10, y: e.y + dy, at: "left" });
				Object.assign(e.tg, place([at(-h / 2 - 5), at(h / 2 + 5), at(-h / 2 - 34), at(h / 2 + 34)], null, S));
			}
		}
		items.push(...ends.map((e) => e.tg));

		// the trained detector's line
		if (ref) {
			const yr = y(ref.v);
			const tg: Tag = { id: "ref", x: box.x0 - 4, y: yr, at: "right", t: ref.t, sub: `${U.trained}, ${Math.round(ref.v)}%`, color: GRAY.strong, swatch: "dash", alpha: trace.ref >= 1 ? 1 : 0 };
			if (tg.alpha) {
				const h = boxOf(tg).h;
				Object.assign(tg, place([
					{ ...tg, x: box.x0 - 4, y: yr - h / 2 - 4, at: "right" }, { ...tg, x: box.x0 - 4, y: yr + h / 2 + 4, at: "right" },
					{ ...tg, x: box.x1 + 10, y: yr - h / 2 - 4, at: "left" }, { ...tg, x: box.x1 + 10, y: yr + h / 2 + 4, at: "left" },
				], null, S));
			}
			items.push(tg);
		}

		// Claude Fable 5.2 in clay, always named; its score only where it is its line's best (the line's number)
		const fp = pos.get(FABLE)!;
		const fabBest = lines.closed[lines.closed.length - 1] === FAB;
		const fab = { id: "fable", t: fabBest ? `${FABLE}, ${Math.round(FAB[metric])}%` : FABLE, color: CLAY, swatch: "dot" as const, alpha: fabOn ? 1 : 0 };
		items.push(fabOn ? place(around(fab, fp.x, fp.y), FABLE, S) : { ...fab, x: fp.x, y: fp.y, at: "left" });

		// the models the step's sentence names (a line's best is already named at the line's end)
		for (const id of focus) {
			if (id === FABLE) continue;
			const m = models.find((k) => k.model === id)!, l = m.line as Line, mp = pos.get(id)!;
			if (labelsOn && lines[l][lines[l].length - 1] === m) continue;
			const on = inWin(m) && !off(m) && mp.x <= penHead[l] + 1;
			const tg = { id: "m-" + id, t: `${m.name}, ${Math.round(m[metric])}%`, color: COLOR[l], swatch: l === "open" ? ("ring" as const) : ("dot" as const), alpha: on ? 1 : 0 };
			items.push(on ? place(around(tg, mp.x, mp.y), id, S) : { ...tg, x: mp.x, y: mp.y, at: "left" });
		}

		chart.marks = marks; chart.paths = paths; chart.texts = texts;
		const sig = items.map((t) => `${t.id}|${Math.round(t.x)}|${Math.round(t.y)}|${t.at}|${t.alpha}|${t.t}|${t.sub ?? ""}`).join(";");
		if (sig !== tagSig) { tagSig = sig; tags = items; }
		const nx = { left: Math.round(box.x0 - r.left - 7), top: Math.round(box.y1 - r.top + 28), width: Math.round(box.x1 - box.x0 + 14) };
		if (nx.left !== xz.left || nx.top !== xz.top || nx.width !== xz.width) xz = nx;
		if (hovered) { const h = pos.get(hovered.model); if (h && (h.x !== tip.x || h.y !== tip.y)) tip = { x: h.x, y: h.y }; }
	}

	// ---- scheduling: one frame per input; more frames only while a line traces -------------------------------------
	let raf = 0, last = 0, dirty = true;
	const prev = [NaN, NaN, NaN, NaN, NaN, NaN];
	const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };
	function tick(now: number) {
		raf = 0;
		const dt = last ? Math.min(1 / 30, (now - last) / 1000) : 1 / 60;
		last = now;
		const moved = advance(dt);
		// retake the canvas if a neighbour left it on the plain ground while this section is in view
		if (active && field.mode === "ground") { field.mode = "chart"; field.owner = "rq1"; field.dim = 0.75; field.interactive = true; }
		if (active && field.owner === "rq1") {
			const r = stage.getBoundingClientRect(), p = panel.getBoundingClientRect(), narrow = innerWidth <= 860;
			const edge = narrow ? p.bottom : p.right;
			const changed = r.left !== prev[0] || r.top !== prev[1] || r.width !== prev[2] || r.height !== prev[3] || edge !== prev[4] || innerWidth !== prev[5];
			if (changed) { prev[0] = r.left; prev[1] = r.top; prev[2] = r.width; prev[3] = r.height; prev[4] = edge; prev[5] = innerWidth; }
			if (dirty || moved || changed) { dirty = false; layout(r, p, narrow); }
		}
		if (moved === 2) kick(); else last = 0;
	}

	// any input marks the chart dirty
	$effect(() => {
		void [step, seen, metric, weights, lab, wa, wb, active, field.mode, field.owner];
		dirty = true;
		kick();
	});
	// hover moves the tooltip only
	$effect(() => {
		const h = hovered && pos.get(hovered.model);
		if (h) tip = { x: h.x, y: h.y };
	});

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
		const steps = [...root.querySelectorAll(".step")];
		const so = new IntersectionObserver((es) => es.forEach((e) => {
			if (!e.isIntersecting) return;
			step = steps.indexOf(e.target);
			seen = true;
			metric = T.steps[step].metric as Metric;
			// the guided steps always show the whole picture
			if (step < LAST) { weights = "all"; lab = null; wa = 0; wb = N; }
		}), { rootMargin: "-45% 0px -45% 0px" });
		steps.forEach((s) => so.observe(s));
		// the stage scrolling in or out, a new size, or the panel growing (Explore opening) asks for one frame
		const ro = new ResizeObserver(kick);
		ro.observe(panel);
		addEventListener("scroll", kick, { passive: true });
		addEventListener("resize", kick, { passive: true });
		// tag widths are measured in Inter: measure again once it has loaded
		document.fonts?.ready.then(() => { widths.clear(); dirty = true; kick(); });
		return () => {
			cancelAnimationFrame(raf); raf = 0;
			io.disconnect(); so.disconnect(); ro.disconnect();
			removeEventListener("scroll", kick); removeEventListener("resize", kick);
		};
	});
</script>

<section class="tl" id={T.id} bind:this={root} style="--steps:{T.steps.length}">
	<div class="stick" bind:this={stage}>
		<div class="panel" bind:this={panel}>
			<h2>{T.title.t}</h2>
			<div class="say" aria-live="polite" data-lag="1">
				<p class="say-n">{#each T.steps as _, i}<i class:on={step === i}></i>{/each}</p>
				{#key step}<p class="say-t">{T.steps[step].t}</p>{/key}
			</div>
			<Reveal show={explore} label={U.explore}>
				<div class="ctl" data-lag="2">
					<div class="seg" role="group" aria-label={U["aria.score"]}>
						{#each METRICS as m}<button type="button" aria-pressed={metric === m} onclick={() => (metric = m)}>{U["metric." + m]}</button>{/each}
					</div>
					<div class="seg" role="group" aria-label={U["aria.weights"]}>
						{#each WEIGHT_IDS as w}<button type="button" aria-pressed={weights === w} onclick={() => (weights = w)}>{U["weights." + w]}</button>{/each}
					</div>
					<div class="labs" role="group" aria-label={U["aria.labs"]}>
						{#each labs as l}<button type="button" aria-pressed={lab === l} onclick={() => (lab = lab === l ? null : l)}>{l}</button>{/each}
					</div>
					<p class="cap">{T.caption.t}</p>
				</div>
			</Reveal>
		</div>
		<!-- the date window, under the x-axis and spanning it; part of Explore -->
		<div class="xz" style:left="{xz.left}px" style:top="{xz.top}px" style:width="{xz.width}px">
			<Reveal show={explore} label={U.dates}>
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
			</Reveal>
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
	<!-- invisible scroll triggers: each one advances the sentence in the panel and what the chart draws -->
	<div class="steps" aria-hidden="true">{#each T.steps as _}<div class="step"></div>{/each}</div>
</section>

<style>
	.tl { position: relative; margin-top: 56px; height: calc(var(--steps) * 65vh + 100vh); }
	.stick { position: sticky; top: 0; height: 100vh; pointer-events: none; }
	.panel { pointer-events: auto; position: absolute; left: 0; top: 64px; width: min(34%, 372px); display: grid; gap: 12px; }
	h2 { font-size: clamp(22px, 2.4vw, 30px); line-height: 1.15; font-weight: 600; letter-spacing: -0.025em; text-wrap: balance; }
	.say { padding: 14px 16px; background: #fff; border-radius: 3px; }
	.say-n { display: flex; gap: 5px; margin-bottom: 8px; }
	.say-n i { width: 18px; height: 3px; border-radius: 2px; background: var(--rule); }
	.say-n i.on { background: var(--ink); }
	.say-t { font-size: 16px; line-height: 1.5; animation: say .45s var(--ease); }
	@keyframes say { from { opacity: 0; transform: translateY(6px); } }

	.ctl { display: grid; gap: 8px; }
	/* controls: one line each; a row that is too wide scrolls inside itself, it never wraps */
	.seg { display: flex; flex-wrap: nowrap; gap: 2px; justify-self: start; max-width: 100%; overflow-x: auto; scrollbar-width: none; background: var(--chip); border-radius: 3px; padding: 3px; }
	.seg::-webkit-scrollbar, .labs::-webkit-scrollbar { display: none; }
	.seg button, .labs button { flex: none; white-space: nowrap; padding: 5px 8px; font-size: 12.5px; font-weight: 500; color: var(--ink2); border-radius: 2px; }
	.seg button:hover, .labs button:hover { color: var(--ink); }
	.seg button[aria-pressed="true"], .labs button[aria-pressed="true"] { background: var(--ink); color: var(--field); }
	.labs { display: flex; flex-wrap: wrap; gap: 4px; }
	.labs button { background: rgba(243, 243, 239, .9); }
	.cap { font-size: 12px; color: var(--ink2); }

	/* the date window (after the detection-frontiers dashboard's .rqx-range) */
	.xz { position: absolute; pointer-events: auto; }
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
	.step { height: 65vh; }
	.step:first-child { margin-top: 40vh; }
	@media (prefers-reduced-motion: reduce) { .say-t { animation: none; } .tl :global(.tags .tag) { transition: none; } }
	@media (max-width: 860px) {
		.panel { width: auto; right: 0; top: 16px; gap: 8px; }
		.labs { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; }
		.cap { display: none; }
		.seg { gap: 1px; }
		.seg button { padding-inline: 6px; }
	}
</style>
