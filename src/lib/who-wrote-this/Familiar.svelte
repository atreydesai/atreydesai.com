<script lang="ts" module>
	// Its footnotes, which the page registers before the section wakes (Defer.svelte), so the notes list and the marks' numbers
	// are complete from the start.
	import F from "./familiarity.json";
	import type { Note } from "./Footnotes.svelte";
	export const FOOTNOTES = { id: "s4", notes: F.notes as Note[] };
</script>

<script lang="ts">
	// Section 4, Who can be identified? A chapter opener (the same writer's print at four clarities, one per familiarity
	// group, set large and layered), then a pinned stage with its own blocking: the narration as a caption band on top,
	// a small centred diagram under it (the question → the model → its answer), and the four familiarity groups large
	// and full width below. One idea per step, each move starting where the last one ended:
	//   ask       the question card appears, an arrow carries it to the model, and the 0–3 scale rises as four steps
	//             (in the groups' places)
	//   answer    an arrow carries the model's two answers out ("familiarity: 3", named as the two independent calls); a
	//             leader runs from them down to step 3, which lights
	//   sort      the two answers give way to one chip, their average and what it means ("average: 3", "3 = very
	//             familiar"), at the leader's top; this writer's texts leave the account, pass under it and follow the
	//             leader into group 3 (the label rides with them), which is then outlined; each step fills with every
	//             other text, in place, from the bottom, and takes its rating above it ("rated 2.5–3") as its step fades
	//   light     each group lights to how often the model named the writer (Figure rq3_familiarity, 1 tile = 1% of
	//             texts, in the model's colour), with the number large above it
	//   takeaway  a line traces the lit levels: the steps of the scale again, now as accuracy; the controls open in one
	//             row under the caption (domains, models, reasoning effort)
	// Every tile is a writer's print, as legible as the model is familiar with the group (clarity means familiarity only).
	// Tiles are abstract: no writer is named or implied. Strings and numbers are the paper's (familiarity.json, built in the
	// private llm-detectors repo by docs/launch_20261116/tools/build_familiarity_anonymity_data.py); `ui`, `demo` and
	// `notes_ours` list the rest. The full prompt and the demo's provenance are footnotes.
	//
	// The scale's steps are drawn on the canvas (under the tiles), so the writer's texts are never hidden behind them.
	// Pacing: each step has 75vh of scroll (every step here animates in); the shown step follows the scroll one step at a
	// time, each shown at least 350 ms, so a fast scroll never skips one; off screen it takes the right step at once.
	// Performance: the step comes from one passive scroll listener; nothing runs per frame while idle. The canvas is
	// rebuilt only when an input changes (step, a control, hover, size, the stage's position while it scrolls in or out)
	// and, while a tween moves, on animation frames that stop when it ends. Marks are pooled and placed exactly (snap),
	// and the geometry never changes with the step, so tiles never fly or re-lay out on scroll.
	import { onMount, untrack } from "svelte";
	import { registerSteps, stepShown } from "./steplinks.ts";
	import Icon from "./Icon.svelte";
	import Reveal from "./Reveal.svelte";
	import Tags, { type Tag } from "./Tags.svelte";
	import SectionOpener from "./SectionOpener.svelte";
	import StepDashes from "./StepDashes.svelte";
	import PrintMark from "./PrintMark.svelte";
	import Footnotes from "./Footnotes.svelte";
	import HoverCue from "./HoverCue.svelte";
	import { MODEL, GRAY, INK as INKS, SIGNED, deepen, TILE } from "./palette";
	import { printSprite, printAspect, warmTilesNear } from "./print/sprites";
	import { field, chart, regions, type Mark, type Path, type Text } from "./field.svelte";
	import { onScroll as onPageScroll, requestFrame, view as vp, lite, deliberate, pointerKind } from "./loop";

	type Bin = { bin: string; shown: boolean; pct: number; tiles: number };
	type ERow = { familiarity: string; low: number; high: number; low_tiles: number; high_tiles: number };
	type EM = { efforts: string[]; rows: ERow[] };
	type G = { x: number; y: number; cx: number; p: number; gw: number };
	type Step = { view: string; t: string; fn?: number };
	type Pt = { x: number; y: number };

	const OWNER = "s4-familiar";
	/** a lighter tint of a colour (opaque, so a key's swatch matches the tile) */
	const lighter = (hex: string, t = 0.45) => {
		const a = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)), b = [243, 243, 239];
		return "#" + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, "0")).join("");
	};
	// the effort gain (or loss) takes a lighter tint of the signed colour: clay and teal sit within a few gray levels of
	// each other, so the tint is what keeps "lowest effort" and "added" apart in grayscale
	const INK = INKS.ink, INK2 = INKS.ink2, OFF = GRAY.unlit, UP = lighter(SIGNED.higher), DOWN = lighter(SIGNED.lower);
	const STEP_GRAY = GRAY.light; // the scale's steps, before any text fills them
	const STEPS = F.steps as Step[];
	const LAST = STEPS.length - 1;
	// scroll per step, in viewport heights (Atrey, 16 Nov: neither too fast for a fast scroller nor a long still stretch
	// for a slow one): about 60vh a step, 75vh for a step that animates, and every step here plays an entrance
	const STEP_VH = 0.75;
	const LAND = 0.5; // where a dash click or a footnote's ↩ lands in its step
	const HOLD = 350; // ms: the least time a step is shown when a fast scroll crosses several
	const BINS = F.data.bins.domains as Record<string, Record<string, Bin[]>>;
	const EFF = F.data.effort.models as Record<string, EM>;
	const L = F.labels;
	const DOMS = L.domains as Record<string, string>;
	const MODELS = L.models as Record<string, string>;
	const EMODELS = L.effort_models as string[];
	const GROUPS = L.groups as { bin: string; t: string }[];
	const NOTES = FOOTNOTES.notes;
	const SAYS = [...STEPS.map((s) => s.t), F.explore.effort.t]; // the narration, and the effort view's caption last
	const col = (name: string) => MODEL[name] ?? GRAY.strong;
	const OPUS = col(MODELS.Opus);
	const pctLabel = (pct: number, tiles: number) => (pct > 0 && pct < 1 ? L.lt1 : `${tiles}%`);
	const ANSWER = 3; // the demo's answer: its writer's texts go to the last group
	const WRITER = [3, 4, 5]; // the slots the writer's texts take in that group (bottom row, middle)
	const PRINT = 4; // the demo writer's print (its middle text), also the opener's
	const CLARITY = [0.1, 0.4, 0.7, 1]; // legibility of the prints in each familiarity group, least to most familiar
	const est = (t: string) => 30 + t.length * 7.1; // a tag's width, for laying tags side by side
	// the entrance timeline of the diagram (seconds after the reader arrives at the step from the one before)
	// (merge: in the sort step, when the two answers give way to their average)
	const T = { card: 0.1, arrow1: 0.5, model: 0.9, rise: 1.25, arrow2: 0.1, chip: [0.5, 0.9], leader: 1.25, lit: 1.7, merge: 0.1 };
	// the sort: the writer's texts move along the diagram (A), then down the leader (B); each step then fills
	const S = { a0: 0.1, a1: 0.85, b1: 1.75, gone3: 1.2, fill: 1.9, gap: 0.25, row: 0.035 };

	let step = $state(0);
	let active = $state(false);
	let owned = $state(false); // this section draws the field (mirrors field.owner, for the tags)
	let xv = $state<"fam" | "effort">("fam");
	let dom = $state("reddit");
	let model = $state("Opus");
	let emodel = $state("Fable 5.2");
	let sel = $state<number | null>(null);
	let W = $state(0), H = $state(0), capH = $state(0);
	let ox = $state(0), oy = $state(0); // the stage's viewport offset
	let wl = $state<Pt | null>(null); // where the writer's label sits (stage coordinates), while it is shown
	let reduce = $state(false);
	// the opener prints' height, as drawn: 236px, or 150px under the 980px line, by the CSS's own query (which sizes
	// their boxes, so the page arrives at its full height; a media query reads no layout)
	let opx = $state(typeof matchMedia === "function" && matchMedia("(max-width: 979px)").matches ? 150 : 236);
	let phase = $state(99); // seconds since the reader arrived at this step from the one before (99: all shown)
	let stage: HTMLElement;
	let root: HTMLElement; // the pinned part (the opener and footnotes sit outside it)

	const view = $derived(STEPS[step].view);
	const explore = $derived(step >= LAST);
	const mode = $derived(explore && xv === "effort" ? "effort" : view);
	const say = $derived(mode === "effort" ? SAYS.length - 1 : step);
	const narrow = $derived(W > 0 && W < 760);
	const mcolor = $derived(mode === "effort" ? col(emodel) : col(MODELS[model]));
	const diagOn = $derived(view === "ask" || view === "answer" || view === "sort");
	const answered = $derived(view === "answer" || view === "sort");
	const bins = $derived(BINS[dom][model]);
	const erows = $derived(EFF[emodel].rows);
	// each piece of the diagram shows from its moment in its own step, and stays for the steps after
	const from = (v: string, t: number) => view !== v || phase >= t;
	const cardOn = $derived(diagOn && from("ask", T.card));
	const arrow1On = $derived(diagOn && from("ask", T.arrow1));
	const modelOn = $derived(diagOn && from("ask", T.model));
	const arrow2On = $derived(answered && from("answer", T.arrow2));
	// in the sort step the two answers give way to their average, the rating the grouping uses
	const merged = $derived(view === "sort" && from("sort", T.merge));
	const chipOn = $derived(T.chip.map((t) => answered && from("answer", t) && !merged));
	const leaderOn = $derived(answered && from("answer", T.leader));

	// where everything sits, in stage coordinates; it depends on the size only (never on the step), so the groups keep
	// their place through the whole section
	const geo = $derived.by(() => {
		const g: G[] = [];
		const o = {
			g, cap: { x: 0, y: 0, w: 0 }, za: 0, numY: [] as number[], keyY: 0, numSize: 44, gap: 56, stairNum: 34,
			q: { x: 0, y: 0, w: 0, h: 0 }, acct: { x: 0, y: 0 }, av: { x: 0, y: 0, r: 28 }, mdl: { x: 0, y: 0 },
			ans: { x: 0, y: [0, 0], w: 150 }, arrows: [] as [number, number, number, number][], lane: { x0: 0, x1: 0, y: 0 },
		};
		if (!W || !H) return o;
		if (!narrow) {
			const top = 76, ch = (capH || 74) + 30; // the card's text block plus its padding
			const cw = Math.min(760, W);
			o.cap = { x: (W - cw) / 2, y: top, w: cw };
			o.za = top + ch + 26;
			// the diagram, one centred row: the question → the model → its answer
			const qw = 390, qh = 92, a = 72, av = 56, aw = 150, tot = qw + a + av + a + aw;
			const x0 = (W - tot) / 2, cy = o.za + 54;
			o.q = { x: x0, y: cy - qh / 2, w: qw, h: qh };
			o.acct = { x: x0 + 8, y: cy + qh / 2 - 25 };
			o.av = { x: x0 + qw + a + av / 2, y: cy, r: av / 2 };
			o.mdl = { x: o.av.x, y: cy + av / 2 + 2 };
			o.ans = { x: x0 + qw + a + av + a + aw / 2, y: [cy - 17, cy + 17], w: aw };
			o.arrows = [[x0 + qw + 10, cy, o.av.x - av / 2 - 10, cy], [o.av.x + av / 2 + 10, cy, o.ans.x - aw / 2 - 8, cy]];
			// the lane the writer's texts take: under the diagram, from the account to below the answers
			o.lane = { x0: x0 + 70, x1: o.ans.x, y: cy + qh / 2 + 66 };
			// the four groups, large and full width under it
			const below = o.lane.y + 20, num = 30, lab = 40, key = 44, gap = 56;
			const p = Math.floor(Math.max(8, Math.min((W - 3 * gap) / 40, (H - 16 - below - num - lab - key) / 10, 26)));
			const gw = 10 * p, gx0 = (W - (4 * gw + 3 * gap)) / 2;
			const slack = Math.max(0, H - 16 - below - (num + gw + lab + key));
			const gy = below + num + slack * 0.25;
			for (let i = 0; i < 4; i++) { const x = gx0 + i * (gw + gap); g.push({ x, y: gy, cx: x + gw / 2, p, gw }); o.numY.push(gy - 30); }
			o.keyY = gy + gw + lab + 16; o.gap = gap;
		} else {
			const top = 60, ch = (capH || 88) + 26;
			o.cap = { x: 0, y: top, w: W };
			o.za = top + ch + 10;
			// the diagram in two rows: the question, then the model and its answers
			const qh = 66, av = 40, cy = o.za + qh + 36;
			o.q = { x: 0, y: o.za, w: W, h: qh };
			o.acct = { x: 8, y: o.za + qh - 19 };
			o.av = { x: 24, y: cy, r: av / 2 };
			o.mdl = { x: 24 + av / 2 + 2, y: cy };
			o.ans = { x: W - 80, y: [cy - 16, cy + 16], w: 150 };
			o.arrows = [[24, o.za + qh + 3, 24, cy - av / 2 - 5], [24 + av / 2 + 104, cy, W - 80 - 75 - 6, cy]];
			o.lane = { x0: 84, x1: W - 64, y: cy + 66 };
			o.numSize = 22; o.stairNum = 24;
			// two rows of two; a number above each group, its name below, the key under the last row
			const below = Math.max(o.lane.y + 12, top + ch + 64), num = 30, lab = 36, key = 34, rgap = 4, gap = 16, cw = (W - gap) / 2;
			const p = Math.floor(Math.max(6, Math.min(cw / 10, (H - 8 - below - 2 * (num + lab) - rgap - key) / 20, 17)));
			const gw = 10 * p;
			for (let i = 0; i < 4; i++) {
				const c = i % 2, r = Math.floor(i / 2);
				const x = c * (cw + gap) + (cw - gw) / 2, y = below + num + r * (gw + lab + rgap + num);
				g.push({ x, y, cx: x + gw / 2, p, gw }); o.numY.push(y - 16);
			}
			o.keyY = g[3].y + gw + lab + 16; o.gap = gap;
		}
		return o;
	});

	function slot(i: number): Pt {
		const g = geo.g[ANSWER];
		return { x: g.x + (i % 10) * g.p + g.p / 2, y: g.y + (9 - Math.floor(i / 10)) * g.p + g.p / 2 };
	}
	/** a soft S between two points: leaves a straight down and arrives straight down */
	function bez(a: Pt, b: Pt, t: number): Pt {
		const my = a.y + (b.y - a.y) * 0.5, u = 1 - t;
		const c1 = { x: a.x, y: my }, c2 = { x: b.x, y: my };
		return {
			x: u * u * u * a.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * b.x,
			y: u * u * u * a.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * b.y,
		};
	}
	// the leader: from the answers down to the step they name (the writer's texts later take the same way)
	const leader = $derived.by(() => {
		if (!geo.g.length || narrow) return "";
		const a = { x: geo.ans.x, y: geo.ans.y[1] + 14 }, g = geo.g[ANSWER], b = { x: g.cx, y: g.y + g.gw - g.gw + 2 }, my = a.y + (b.y - a.y) * 0.5;
		return `M${a.x},${a.y} C${a.x},${my} ${b.x},${my} ${b.x},${b.y}`;
	});

	// labels on the picture (viewport coordinates): the groups' names, the diagram's chips, every colour shown, named
	const tags = $derived.by(() => {
		const t: Tag[] = [];
		if (!active || !owned || !geo.g.length) return t;
		const X = (x: number) => ox + x, Y = (y: number) => oy + y;
		geo.g.forEach((g, i) => t.push({ id: `g${i}`, x: X(g.cx), y: Y(g.y + g.gw), t: mode === "effort" ? erows[i].familiarity : GROUPS[i].t, at: "below" }));
		t.push({ id: "acct", x: X(geo.acct.x), y: Y(geo.acct.y), t: L.account, icon: "reddit", at: "right", alpha: cardOn ? 1 : 0 });
		t.push({ id: "mdl", x: X(geo.mdl.x), y: Y(geo.mdl.y), t: MODELS.Opus, color: OPUS, at: narrow ? "right" : "below", alpha: modelOn ? 1 : 0 });
		geo.ans.y.forEach((y, j) => t.push({ id: `ans${j}`, x: X(geo.ans.x), y: Y(y), t: L.answer, color: OPUS, strong: true, at: "center", alpha: chipOn[j] ? 1 : 0 }));
		// what the two answers are: beside them where there is room, else under them
		const mid = (geo.ans.y[0] + geo.ans.y[1]) / 2, side = !narrow && geo.ans.x + 62 + est(L.calls) < W;
		t.push({ id: "calls", x: X(side ? geo.ans.x + 62 : geo.ans.x), y: Y(side ? mid : geo.ans.y[1] + 16), t: L.calls, at: side ? "right" : "below", alpha: chipOn[1] ? 1 : 0 });
		// then their average, the rating the grouping uses, with what it means on the scale (it ends where the leader starts)
		t.push({ id: "avg", x: X(geo.ans.x), y: Y(mid), t: L.average, sub: L.scale3, color: OPUS, strong: true, at: "center", alpha: merged ? 1 : 0 });
		const key: { t: string; color: string }[] = [];
		if (mode === "sort") key.push({ t: L.unit, color: OFF });
		else if (mode === "light" || mode === "takeaway") key.push({ t: `${MODELS[model]} ${L.named}`, color: mcolor }, { t: L.not_named, color: OFF });
		else if (mode === "effort") {
			key.push({ t: `${emodel}, ${L.low}`, color: mcolor }, { t: L.gain, color: UP });
			if (erows.some((r) => r.high_tiles < r.low_tiles)) key.push({ t: L.loss, color: DOWN });
			key.push({ t: L.not_named, color: OFF });
		}
		// one centred row (two on a phone when it would not fit)
		const rows: (typeof key)[] = [[]];
		let w = 0;
		for (const k of key) { const kw = est(k.t) + 8; if (w + kw > W && rows[rows.length - 1].length) { rows.push([]); w = 0; } rows[rows.length - 1].push(k); w += kw; }
		rows.forEach((r, ri) => {
			let x = (W - r.reduce((s, k) => s + est(k.t) + 8, -8)) / 2;
			r.forEach((k, i) => { t.push({ id: `k${ri}${i}${mode}`, x: X(x) - 10, y: Y(geo.keyY + ri * 28), t: k.t, color: k.color }); x += est(k.t) + 8; });
		});
		if (wl && mode === "sort") t.push({ id: "writer", x: X(wl.x), y: Y(wl.y), t: L.writer, color: INK, at: "above" });
		return t;
	});

	// ---- drawing: pooled marks, rebuilt only on input changes and while a tween moves --------------------------
	const pool = new Map<string, Mark>();
	const mk = (id: string) => {
		let m = pool.get(id);
		if (!m) { m = { id, x: 0, y: 0, r: 1, color: OFF }; pool.set(id, m); }
		return m;
	};
	const ASPECT = printAspect();
	const IDS = Array.from({ length: 4 }, (_, g) => Array.from({ length: 100 }, (_, i) => `${OWNER}:g${g}:${i}`));
	const marks: Mark[] = [];
	let lastKey = "", lastStep = -1, t0 = 0, alive = true, anim: "enter" | "ctrl" | "settle" = "settle";
	let fromLit = [0, 0, 0, 0], curLit = [0, 0, 0, 0];
	const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
	const inout = (x: number) => { const t = Math.min(1, Math.max(0, x)); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
	const rgba = (hex: string, a: number) => `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${a.toFixed(3)})`;

	function tile(g: G, gi: number, i: number) {
		const m = mk(IDS[gi][i]);
		m.x = ox + g.x + (i % 10) * g.p + g.p / 2;
		m.y = oy + g.y + (9 - Math.floor(i / 10)) * g.p + g.p / 2;
		m.square = true; m.r = g.p * 0.36; m.alpha = 1; m.snap = true; // in place: tiles fade in where they belong
		return m;
	}
	function setWl(p: Pt | null) {
		if (p === null ? wl !== null : !wl || Math.abs(wl.x - p.x) > 0.3 || Math.abs(wl.y - p.y) > 0.3) wl = p;
	}
	/** the scale's four steps, on the canvas under the tiles: rising (0..1 each), the answered one in ink, fading (alpha) */
	function stairs(paths: Path[], texts: Text[], rise: number[], lit: boolean, alpha: number[]) {
		geo.g.forEach((g, i) => {
			const h = (g.gw * (i + 1)) / 4, r = rise[i], a = alpha[i];
			if (r <= 0 || a <= 0.01) return;
			const c = lit && i === ANSWER ? INK : STEP_GRAY, x = ox + g.x + g.gw / 2, y0 = oy + g.y + g.gw;
			// a stroke as wide as the step, drawn upwards (the width carries the state, so a change redraws the canvas)
			paths.push({ pts: [[x, y0], [x, y0 - h]], color: rgba(c, a), width: g.gw + (c === INK ? 0.01 : 0) + a * 0.001, progress: r });
			if (r >= 0.98) texts.push({ x: ox + g.x + (geo.stairNum > 30 ? 12 : 8), y: y0 - h + geo.stairNum * 0.62, t: String(i), color: rgba(c === INK ? "#FFFFFF" : INK, a), size: geo.stairNum, weight: 600 });
		});
	}

	function render(now: number): boolean {
		const key = `${mode}|${dom}|${model}|${emodel}`;
		if (key !== lastKey) {
			// an entrance plays only when the reader arrives from the step before; a control change tweens from what is
			// shown; anything else (scrolling back, a dash jump) settles at once
			anim = step === lastStep + 1 ? "enter" : step === lastStep ? "ctrl" : "settle";
			fromLit = anim === "settle" ? [0, 0, 0, 0] : curLit.slice();
			lastKey = key; lastStep = step; t0 = now;
		}
		const e = reduce || anim === "settle" ? 1e9 : (now - t0) / 1000;
		let busy = false;
		marks.length = 0;
		const texts: Text[] = [], paths: Path[] = [];
		const G4 = geo.g;
		if (!G4.length) { chart.marks = marks; chart.paths = paths; chart.texts = texts; return false; }
		if (mode === "ask") {
			// the scale rises, one step after another, once the question has reached the model
			setWl(null);
			stairs(paths, texts, [0, 1, 2, 3].map((i) => ease((e - T.rise - 0.12 * i) / 0.45)), false, [1, 1, 1, 1]);
			curLit = [0, 0, 0, 0];
			busy = e < T.rise + 0.9;
		} else if (mode === "answer") {
			setWl(null);
			stairs(paths, texts, [1, 1, 1, 1], e >= T.lit, [1, 1, 1, 1]);
			curLit = [0, 0, 0, 0];
			busy = e < T.lit + 0.05;
		} else if (mode === "sort") {
			// this writer's texts leave the account, pass along under the answers (A) and follow the leader down (B) into
			// their group; then every step fills, in place and from the bottom, with everyone else's texts
			const lane = geo.lane, end = slot(WRITER[1]);
			let at: Pt;
			if (e < S.a1) { const k = inout((e - S.a0) / (S.a1 - S.a0)); at = { x: lane.x0 + (lane.x1 - lane.x0) * k, y: lane.y }; }
			else at = bez({ x: lane.x1, y: lane.y }, end, inout((e - S.a1) / (S.b1 - S.a1)));
			const fillAt = (gi: number) => S.fill + S.gap * gi;
			const fade = [0, 1, 2, 3].map((i) => ease((e - (i === ANSWER ? S.gone3 : fillAt(i))) / 0.4));
			stairs(paths, texts, [1, 1, 1, 1], true, fade.map((f) => 1 - f));
			// as each step gives way to its group, the group takes its rating above it (the average of the two calls, as
			// the chip shows it); the alpha rides on y by a hair, so the fade redraws the canvas
			G4.forEach((g, gi) => {
				if (fade[gi] <= 0.01) return;
				texts.push({ x: ox + g.x, y: oy + g.y - (narrow ? 15 : 19) + fade[gi] * 0.001, t: `${L.rated} ${GROUPS[gi].bin}`, color: rgba(INK, fade[gi]), size: narrow ? 13 : 16, weight: 600 });
			});
			// the group this writer's texts land in, outlined once they arrive
			{
				const g = G4[ANSWER], w = g.gw, x = ox + g.x - 5, y = oy + g.y - 5;
				paths.push({ pts: [[x + w / 2 + 5, y], [x + w + 10, y], [x + w + 10, y + w + 10], [x, y + w + 10], [x, y], [x + w / 2 + 5, y]], color: INK, width: 1.5, progress: ease((e - S.b1) / 0.6) });
			}
			G4.forEach((g, gi) => {
				for (let i = 0; i < 100; i++) {
					const writer = gi === ANSWER && WRITER.includes(i);
					if (!writer && e < fillAt(gi) + S.row * Math.floor(i / 10)) continue;
					const m = tile(g, gi, i);
					m.color = writer ? INK : OFF;
					if (writer) { m.x = ox + at.x + (i - WRITER[1]) * g.p; m.y = oy + at.y; }
					marks.push(m);
				}
			});
			setWl({ x: at.x, y: at.y - G4[ANSWER].p / 2 - 2 });
			curLit = [0, 0, 0, 0];
			busy = e < fillAt(3) + S.row * 10 + 0.4;
		} else if (mode === "light" || mode === "takeaway") {
			setWl(null);
			const k = ease(e / 1.2);
			G4.forEach((g, gi) => {
				const b = bins[gi];
				if (!b.shown) {
					const w = g.gw;
					paths.push({ pts: [[ox + g.x, oy + g.y], [ox + g.x + w, oy + g.y], [ox + g.x + w, oy + g.y + w], [ox + g.x, oy + g.y + w], [ox + g.x, oy + g.y]], color: "rgba(20,32,45,.3)", width: 1, dash: [3, 4], progress: 1 });
					texts.push({ x: ox + g.cx, y: oy + g.y + w / 2, t: L.few, color: INK2, size: 12, align: "center", weight: 500 });
					curLit[gi] = 0;
					return;
				}
				const lit = fromLit[gi] + (b.tiles - fromLit[gi]) * k;
				curLit[gi] = lit;
				for (let i = 0; i < 100; i++) { const m = tile(g, gi, i); m.color = i < lit - 0.001 ? mcolor : OFF; marks.push(m); }
				texts.push({ x: ox + g.cx, y: oy + geo.numY[gi], t: pctLabel(b.pct, b.tiles), color: INK, size: geo.numSize, weight: 600, align: "center" });
			});
			busy = e < 1.2;
			// the takeaway: a line along the lit levels, the scale's steps again, now as accuracy (one line per row of groups)
			if (mode === "takeaway" && bins.every((b) => b.shown)) {
				const pr = ease((e - (anim === "enter" ? 0.1 : 0)) / 0.9);
				for (const row of narrow ? [[0, 1], [2, 3]] : [[0, 1, 2, 3]]) {
					const pts: [number, number][] = [];
					row.forEach((gi, j) => {
						const g = G4[gi], y = oy + g.y + g.gw - Math.ceil(curLit[gi] / 10 - 0.001) * g.p - 2;
						if (j > 0) pts.push([ox + g.x - geo.gap / 2, y]);
						pts.push([ox + g.x, y], [ox + g.x + g.gw, y]);
						if (j < row.length - 1) pts.push([ox + g.x + g.gw + geo.gap / 2, y]);
					});
					paths.push({ pts, color: INK, width: 2.5, progress: pr });
				}
				busy = busy || pr < 1;
			}
		} else if (mode === "effort") {
			setWl(null);
			// lowest effort in the model's colour, then what the highest effort adds (teal) or loses (rose)
			const kb = ease(e / 0.8), kg = ease((e - 0.7) / 0.9);
			G4.forEach((g, gi) => {
				const r = erows[gi];
				const base = Math.min(r.low_tiles, r.high_tiles) * kb;
				const top = Math.max(r.low_tiles, r.high_tiles);
				const extra = base + (top - Math.min(r.low_tiles, r.high_tiles)) * kg;
				const loss = r.high_tiles < r.low_tiles;
				for (let i = 0; i < 100; i++) {
					const m = tile(g, gi, i);
					if (i < base - 0.001) m.color = mcolor;
					else if (i < extra - 0.001) m.color = loss ? DOWN : UP;
					else m.color = OFF;
					marks.push(m);
				}
				curLit[gi] = r.high_tiles;
				texts.push({ x: ox + g.cx, y: oy + geo.numY[gi], t: `${pctLabel(r.low, r.low_tiles)} → ${pctLabel(r.high, r.high_tiles)}`, color: INK, size: narrow ? 15 : 22, weight: 600, align: "center" });
			});
			busy = e < 1.6;
		}
		if (sel !== null && G4[sel] && hitsOn) {
			const g = G4[sel], w = g.gw, x = ox + g.x - 5, y = oy + g.y - 5;
			paths.push({ pts: [[x, y], [x + w + 10, y], [x + w + 10, y + w + 10], [x, y + w + 10], [x, y]], color: INK, width: 1.5, progress: 1 });
		}
		// the motif: every tile is a writer's print, as legible as the model is familiar with the group: smudged where it
		// does not know the writer, crisp where it knows them well (named tiles solid in the model's colour with the print
		// in a deeper ink; the rest pale; this writer's texts in ink)
		for (const m of marks) {
			const gi = +m.id.charAt(OWNER.length + 2), pitch = G4[gi]?.p ?? 0;
			if (pitch < 15) { m.sprite = undefined; m.backing = undefined; continue; }
			const lit = m.color !== OFF, px = Math.round(pitch * 0.9), clarity = CLARITY[gi], idx = +m.id.slice(m.id.lastIndexOf(":") + 1);
			const ink = m.color === INK ? GRAY.mid : lit ? deepen(m.color, TILE.inkDepth) : m.color;
			m.sprite = printSprite({ family: "writer", index: idx % 48, color: ink, px, clarity, defer: true });
			m.spriteKey = `f${idx % 48}|${ink}|${px}|${clarity}`;
			m.aspect = ASPECT; m.r = px / 2; m.backing = lit ? TILE.litBacking : TILE.unlitBacking;
		}
		chart.marks = marks;
		chart.paths = paths;
		chart.texts = texts;
		return busy;
	}

	// frames run in the page's loop (loop.ts): after every section has read the scroll, before the canvas draws
	function tick(now: number) {
		if (!alive || !active || field.owner !== OWNER) return;
		if (render(now)) requestFrame(tick);
	}
	const kick = () => { if (alive) requestFrame(tick); };

	// any input that changes the picture asks for one frame (more only while a tween moves)
	$effect(() => {
		void [mode, dom, model, emodel, geo, sel, ox, oy, active, owned, step];
		kick();
	});
	// two sections can both sit in the observer's band near their boundary: when the other one leaves and
	// clears the field, this one would get no new intersection event, so it takes the field back here
	$effect(() => {
		if (active && field.mode === "ground") { field.mode = "chart"; field.owner = OWNER; field.dim = 0.75; field.interactive = false; }
		owned = field.owner === OWNER;
	});
	// the guided steps always show the paper's default view; the controls take over only once they are open
	$effect(() => { if (!explore) { xv = "fam"; dom = "reddit"; model = "Opus"; emodel = "Fable 5.2"; } });
	$effect(() => { void step; sel = null; });
	// the diagram's own clock: when the reader arrives at a step from the one before (or reaches the section from above),
	// its pieces appear in order; any other arrival shows them at once
	let pstep = -1, pt0 = 0, praf = 0;
	$effect(() => {
		const s = step, on = active;
		untrack(() => {
			// left above the section: the next arrival plays its first step again (the canvas's clock too)
			if (!on) { if (root && root.getBoundingClientRect().top > 0) { pstep = -1; lastStep = -1; lastKey = ""; } return; }
			if (s === pstep) return;
			const fwd = s === pstep + 1 && !reduce;
			pstep = s;
			cancelAnimationFrame(praf);
			if (!fwd) { phase = 99; return; }
			pt0 = performance.now(); phase = 0;
			const run = (now: number) => { phase = (now - pt0) / 1000; if (phase < 2) praf = requestAnimationFrame(run); else phase = 99; };
			praf = requestAnimationFrame(run);
		});
	});

	function place() {
		const r = stage.getBoundingClientRect();
		if (r.left !== ox) ox = r.left;
		if (r.top !== oy) oy = r.top;
	}
	// --- scroll: the stage follows the scroll one step at a time ---------------------------------------------------
	// The scroll position names a step (want). The shown step walks to it one step at a time and holds each at least
	// HOLD, so a fast scroll never skips one and a slow one sees each step arrive where its stretch starts. Off screen,
	// or back on screen after being off (a jump), the stage takes the right step at once. A dash click or a footnote's
	// ↩ shows its step at once and holds it while the page scrolls there (pin).
	let y = 0; // how far the pinned part has scrolled, in viewport heights
	let vhPx = 1; // one viewport height in px, as the CSS lays the track out
	let prog = $state(0); // 0 to 1 through the shown step's stretch (StepDashes fills the next dash with it)
	let want = 0, since = -1e9, away = true, pin = -1, still = false;
	let timer: ReturnType<typeof setTimeout> | undefined, pinT: ReturnType<typeof setTimeout> | undefined, endT: ReturnType<typeof setTimeout> | undefined;
	let moved = 0; // when the page last scrolled
	// the step the scroll position names; true while the pinned part is off screen
	function read() {
		const r = root.getBoundingClientRect();
		y = -r.top / vhPx;
		want = Math.max(0, Math.min(LAST, Math.floor(y / STEP_VH)));
		return r.bottom <= 0 || r.top >= (vp.h || innerHeight);
	}
	function fillDash() {
		const p = Math.round(Math.max(0, Math.min(1, y / STEP_VH - step)) * 1000) / 1000;
		if (p !== prog) prog = p;
	}
	function show(s: number) {
		since = performance.now();
		if (s !== step) step = s;
		fillDash();
	}
	// one step toward the goal once the shown one has had its time, then wait for the next
	function pump() {
		clearTimeout(timer); timer = undefined;
		const goal = pin >= 0 ? pin : want;
		if (step === goal) return;
		const wait = since + HOLD - performance.now();
		if (wait > 0) { timer = setTimeout(pump, wait); return; }
		show(step + Math.sign(goal - step));
		if (step !== goal) timer = setTimeout(pump, HOLD);
	}
	function unpin() { if (pin < 0) return; pin = -1; clearTimeout(pinT); pump(); }
	function hold(s: number) {
		pin = s; clearTimeout(pinT); pinT = setTimeout(unpin, 2500); clearTimeout(timer);
		if (s !== step) show(s);
		if (want === s) unpin();
	}
	function sync() {
		moved = performance.now();
		// (the lighter mode for phones: the step follows the scroll directly; a momentum scroll is not held back)
		const off = read(), snap = off || away || still || lite.on;
		away = off;
		if (pin >= 0 && want === pin) { pin = -1; clearTimeout(pinT); }
		if (snap) { clearTimeout(timer); const goal = pin >= 0 ? pin : want; if (goal !== step) show(goal); }
		else pump();
		fillDash();
	}
	// a dash click scrolls to the middle of that step's stretch of the pinned stage, showing that step at once
	// links to a step (steplinks.ts): #{id}/<step>, and the address bar follows the step in view
	onMount(() => registerSteps(F.id, STEPS.map((s) => s.view), (i, instant) => go(i, instant)));
	$effect(() => stepShown(F.id, step));

	function go(i: number, instant = false) {
		hold(i);
		const top = root.getBoundingClientRect().top + scrollY;
		scrollTo({ top: top + (i + LAND) * STEP_VH * vhPx, behavior: instant || reduce ? "instant" : "smooth" });
	}
	// a footnote's ↩ (the page's list): the citing words live in the pinned stage, so go to the step that cites the note
	function back(e: MouseEvent) {
		const a = (e.target as HTMLElement)?.closest?.("a.back") as HTMLAnchorElement | null;
		const id = a?.getAttribute("href")?.slice(1);
		const mark = id ? document.getElementById(id) : null;
		if (!mark || !root?.contains(mark)) return;
		const i = Number(mark.closest<HTMLElement>("[data-i]")?.dataset.i);
		if (!(i >= 0 && i <= LAST)) return;
		e.preventDefault();
		go(i);
	}

	onMount(() => {
		still = new URLSearchParams(location.search).has("still");
		reduce = matchMedia("(prefers-reduced-motion: reduce)").matches || still;
		const stopWarm = warmTilesNear(root, "writer", 48, 14, 26); // the tiles' prints' ridges, traced ahead in idle moments
		const size = () => { opx = matchMedia("(max-width: 979px)").matches ? 150 : 236; vhPx = root.offsetHeight / (STEPS.length * STEP_VH + 1); };
		size();
		const onScroll = () => {
			sync();
			// the lighter mode: a scroll closes a card a finger opened
			if (lite.on && sel !== null && pointerKind() !== "mouse") sel = null;
			if (!active) return;
			if (active && field.mode === "ground") { field.mode = "chart"; field.owner = OWNER; field.dim = 0.75; field.interactive = false; }
			place();
		};
		// scroll and resize, in the page's loop (loop.ts); a new viewport size measures the track again first
		let sw = vp.w, sh = vp.h;
		const stopScroll = onPageScroll(() => { if (vp.w !== sw || vp.h !== sh) { sw = vp.w; sh = vp.h; size(); } onScroll(); });
		regions[OWNER] = root;
		document.addEventListener("click", back);
		// the page coming to rest lets a held step go (also when the reader's own scroll cut the jump short); a wheel
		// tick mid-jump ends its own scroll while the jump goes on, so only a page that has stopped moving counts
		const ended = () => { clearTimeout(endT); endT = setTimeout(() => { if (performance.now() - moved > 90) unpin(); }, 120); };
		addEventListener("scrollend", ended, { passive: true });
		const io = new IntersectionObserver((es) => es.forEach((e) => {
			active = e.isIntersecting;
			if (active) { field.mode = "chart"; field.owner = OWNER; field.dim = 0.75; field.interactive = false; place(); }
			else if (field.mode === "chart" && field.owner === OWNER) { field.mode = "ground"; field.dim = 0; field.interactive = false; chart.marks = []; chart.paths = []; chart.texts = []; }
		}), { rootMargin: "-35% 0px -35% 0px" });
		io.observe(root);
		return () => {
			alive = false; stopWarm(); cancelAnimationFrame(praf); clearTimeout(timer); clearTimeout(pinT); io.disconnect();
			stopScroll(); document.removeEventListener("click", back);
			removeEventListener("scrollend", ended); clearTimeout(endT);
		};
	});

	const hitsOn = $derived(mode === "light" || mode === "takeaway" || mode === "effort");
	// a group hovered, focused or tapped shows its card; the hover cue goes once one has
	let tried = $state(false);
	const open = (i: number) => { sel = i; tried = true; };
	// the hover cue's place: over the top-right group (the last on a wide screen, the second on a phone's 2 x 2), its right
	// edges lined up, clear of the number over the group (stage px)
	const cueAt = $derived.by(() => {
		const i = narrow ? 1 : 3, g = geo.g[i];
		return g ? { right: W - (g.x + g.gw), top: geo.numY[i] - geo.numSize / 2 - 10 - 28 } : null;
	});
	const tip = $derived.by(() => {
		if (sel === null || !hitsOn) return null;
		if (mode === "effort") { const r = erows[sel]; return { h: r.familiarity, v: `${pctLabel(r.low, r.low_tiles)} → ${pctLabel(r.high, r.high_tiles)}`, s: emodel }; }
		const b = bins[sel];
		return { h: GROUPS[sel].t, v: b.shown ? pctLabel(b.pct, b.tiles) : L.few, s: `${MODELS[model]} ${L.named}` };
	});
	const aria = (i: number) => {
		if (mode === "effort") { const r = erows[i]; return `${emodel}, ${r.familiarity}: ${pctLabel(r.low, r.low_tiles)} → ${pctLabel(r.high, r.high_tiles)}`; }
		const b = bins[i];
		return `${GROUPS[i].t}: ${b.shown ? pctLabel(b.pct, b.tiles) : L.few}`;
	};
	const arrow = (a: number[]) => {
		const [x1, y1, x2, y2] = a, ang = Math.atan2(y2 - y1, x2 - x1), h = 7;
		return `M${x1},${y1} L${x2},${y2} M${x2 - h * Math.cos(ang - 0.5)},${y2 - h * Math.sin(ang - 0.5)} L${x2},${y2} L${x2 - h * Math.cos(ang + 0.5)},${y2 - h * Math.sin(ang + 0.5)}`;
	};
</script>

<section class="fa" id={F.id} data-rq="0" data-step={step}>
	<!-- the opener; its prints are this section's own: the demo writer's print at the four clarities, large, each over a
	     second, offset impression for depth -->
	<div class="op">
		<SectionOpener n={F.n} title={F.title.t} takeaway={F.takeaway.t} context={F.context.t} accent={GRAY.mid} />
		<div class="op-prints" aria-hidden="true">
			{#each GROUPS as g, i}
				<figure class="op-p">
					<span class="op-stack">
						<span class="op-under"><PrintMark family="writer" index={PRINT} color={INK2} px={opx} fit clarity={CLARITY[i]} text /></span>
						<PrintMark family="writer" index={PRINT} color={INKS.field} px={opx} fit clarity={CLARITY[i]} text />
					</span>
					<figcaption>{g.t}</figcaption>
				</figure>
			{/each}
		</div>
	</div>

	<div class="scrolly" class:still={reduce} bind:this={root} style="--steps:{STEPS.length}; --step-vh:calc({STEP_VH * 100} * var(--vh, 1vh))">
		<div class="stick" bind:this={stage} bind:clientWidth={W} bind:clientHeight={H}>
			<!-- the narration: a caption band on top; the dashes jump to a step; the controls open under it at the end -->
			<div class="cap" class:unsized={!W} style="left:{geo.cap.x}px; top:{geo.cap.y}px; width:{geo.cap.w}px">
				<div bind:clientHeight={capH}>
					<StepDashes count={STEPS.length} current={step} {go} progress={prog} />
					<div class="say" aria-live="polite">
						{#each SAYS as t, i}
							{@const fn = STEPS[i]?.fn}
							<p class="say-t" class:on={i === say} aria-hidden={i !== say} data-i={i}>{t}{#if fn}<sup class="fnref"><a href="#fn-s4-{fn}" id="fnref-s4-{fn}" tabindex={i === say ? 0 : -1}>{fn}</a></sup>{/if}</p>
						{/each}
					</div>
				</div>
				<Reveal show={explore}>
					<div class="ctrl" role="group" aria-label={L.view}>
						<button type="button" aria-pressed={xv === "fam"} onclick={() => { xv = "fam"; sel = null; }}>{L.view_fam}</button>
						<button type="button" aria-pressed={xv === "effort"} onclick={() => { xv = "effort"; sel = null; }}>{L.view_effort}</button>
					</div>
					{#if xv === "fam"}
						<div class="ctrl" role="group" aria-label={L.domain}>
							{#each Object.entries(DOMS) as [id, t]}<button type="button" aria-pressed={dom === id} onclick={() => (dom = id)}>{t}</button>{/each}
						</div>
						<div class="ctrl" role="group" aria-label={L.model}>
							{#each Object.entries(MODELS) as [id, t]}<button type="button" aria-pressed={model === id} onclick={() => (model = id)}><i class="sw" style:background={col(t)}></i>{t}</button>{/each}
						</div>
					{:else}
						<div class="ctrl" role="group" aria-label={L.model}>
							{#each EMODELS as m}<button type="button" aria-pressed={emodel === m} onclick={() => (emodel = m)}><i class="sw" style:background={col(m)}></i>{m}</button>{/each}
						</div>
					{/if}
				</Reveal>
			</div>

			<!-- the diagram: the question in a few words → the model → its answers (the chips on it are Tags) -->
			<div class="diag" class:on={diagOn && W > 0} aria-hidden={!diagOn}>
				<div class="q" class:on={cardOn} style="left:{geo.q.x}px; top:{geo.q.y}px; width:{geo.q.w}px; height:{geo.q.h}px"><p>{L.question}</p></div>
				<span class="av" class:on={modelOn} style="left:{geo.av.x - geo.av.r}px; top:{geo.av.y - geo.av.r}px; width:{geo.av.r * 2}px; height:{geo.av.r * 2}px; color:{OPUS}"><Icon name="anthropic" /></span>
				<svg class="lines" aria-hidden="true">
					{#each geo.arrows as a, i}<path class="arw" class:on={i === 0 ? arrow1On : arrow2On} pathLength="1" d={arrow(a)} />{/each}
					{#if leader}
						<mask id="s4-leader" maskUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}><path class="lm" class:on={leaderOn} pathLength="1" d={leader} /></mask>
						<path class="leader" class:on={answered} mask="url(#s4-leader)" d={leader} />
					{/if}
				</svg>
			</div>

			<!-- hover and keyboard targets over each tile group; the canvas itself is aria-hidden. Focus opens a card
			     only from the keyboard: a tap focuses the button too, and its click would then close the card it opened -->
			{#if hitsOn}
				<div class="hits">
					{#each geo.g as g, i}
						<button type="button" class="hit" aria-label={aria(i)}
							style="left:{g.x - 5}px; top:{g.y - 5}px; width:{g.gw + 10}px; height:{g.gw + 10}px"
							onpointerenter={(e) => e.pointerType === "mouse" && open(i)} onpointerleave={(e) => e.pointerType === "mouse" && (sel = sel === i ? null : sel)}
							onfocus={(e) => e.currentTarget.matches(":focus-visible") && open(i)} onblur={() => (sel = sel === i ? null : sel)}
							onclick={(e) => { if (deliberate(e)) { if (sel === i) sel = null; else open(i); } }}></button>
					{/each}
				</div>
			{/if}
			<!-- the hover cue, over the top-right group while the groups take a hover -->
			<HoverCue hover="Hover over a group" tap="Tap a group" show={hitsOn && active && !!cueAt && !tried} style={cueAt ? `right:${cueAt.right}px; top:${cueAt.top}px` : "visibility:hidden"} />
			{#if tip && active && sel !== null && geo.g[sel]}
				{@const g = geo.g[sel]}
				<div class="tip" class:flip={g.x + g.gw > W - 200} style="left:{g.x + g.gw + 12}px; top:{g.y}px; --gw:{g.gw + 24}px" role="status">
					<b>{tip.h}</b><span class="tv">{tip.v}</span><span>{tip.s}</span>
				</div>
			{/if}
		</div>
	</div>
	{#if active && owned}<Tags items={tags} follow />{/if}

	<Footnotes id="s4" notes={NOTES} />
</section>

<style>
	.fa { position: relative; }
	/* the opener's prints: in the opener's right column (its grid is 1.1fr : 1fr with a 4vw gap); under it on a phone */
	.op { position: relative; }
	.op-prints { --pm: 236px; position: absolute; top: 0; bottom: 0; right: 0; width: calc((100% - 4vw) / 2.1); display: grid; grid-template-columns: repeat(2, auto); place-content: center; gap: calc(4 * var(--vh, 1vh)) 3.4vw; pointer-events: none; }
	.op-p { display: grid; justify-items: center; gap: 14px; margin: 0; }
	.op-stack { position: relative; display: block; }
	.op-under { position: absolute; left: 7px; top: 8px; opacity: .6; }
	.op-p figcaption { position: relative; font-size: 15px; font-weight: 600; letter-spacing: .02em; color: #F3F3EF; white-space: nowrap; }
	@media (max-width: 979px) {
		.op-prints { --pm: 150px; position: relative; width: 100vw; margin: calc(-4 * var(--vh, 1vh)) 0 0 calc(50% - 50vw); padding: 0 16px calc(10 * var(--vh, 1vh)); background: #14202D; gap: 28px 24px; }
		.op-under { left: 5px; top: 6px; }
		.op-p figcaption { font-size: 14px; }
	}

	.scrolly { position: relative; height: calc(var(--steps) * var(--step-vh) + calc(100 * var(--vh, 1vh))); }
	.stick { position: sticky; top: 0; height: calc(100 * var(--vh, 1vh)); pointer-events: none; }

	/* the caption band */
	.cap { position: absolute; z-index: 2; pointer-events: auto; padding: 14px 18px 16px; background: #fff; border-radius: 3px; box-shadow: 0 2px 14px rgba(20, 32, 45, .06); display: grid; gap: 10px; }
	.cap.unsized { left: 50% !important; top: 76px !important; width: min(760px, 100%) !important; transform: translateX(-50%); }
	.say { display: grid; margin-top: 4px; }
	.say-t { grid-area: 1 / 1; font-size: 19px; line-height: 1.45; letter-spacing: -0.01em; color: var(--ink); opacity: 0; visibility: hidden; transform: translateY(6px); transition: opacity .4s, transform .45s var(--ease), visibility 0s .4s; }
	.say-t.on { opacity: 1; visibility: visible; transform: none; transition: opacity .4s, transform .45s var(--ease), visibility 0s; }
	.ctrl { flex: none; display: inline-flex; flex-wrap: nowrap; align-items: center; gap: 2px; background: var(--chip); border-radius: 3px; padding: 3px; }
	.ctrl button { display: inline-flex; align-items: center; gap: 6px; padding: 5px 8px; font-size: 12.5px; font-weight: 500; color: var(--ink2); border-radius: 2px; white-space: nowrap; }
	.ctrl button:hover { color: var(--ink); }
	.ctrl button[aria-pressed="true"] { background: var(--ink); color: var(--field); }
	.sw { flex: none; display: inline-block; width: 9px; height: 9px; border-radius: 1px; }
	.ctrl button[aria-pressed="true"] .sw { box-shadow: 0 0 0 1.5px var(--field); }

	/* the diagram: each piece fades or draws in at its moment */
	.diag { position: absolute; inset: 0; opacity: 0; transition: opacity .45s; }
	.diag.on { opacity: 1; }
	.q { position: absolute; display: flex; align-items: flex-start; padding: 14px 18px; background: #fff; border-radius: 3px; box-shadow: 0 2px 14px rgba(20, 32, 45, .06); opacity: 0; transform: translateY(8px); transition: opacity .4s, transform .5s var(--ease); }
	.q.on { opacity: 1; transform: none; }
	.q p { font-size: 20px; line-height: 1.3; font-weight: 600; letter-spacing: -0.015em; color: var(--ink); }
	.av { position: absolute; display: grid; place-items: center; border-radius: 50%; background: #fff; box-shadow: 0 2px 14px rgba(20, 32, 45, .1); font-size: 26px; opacity: 0; transform: scale(.85); transition: opacity .35s, transform .45s var(--ease); }
	.av.on { opacity: 1; transform: none; }
	.lines { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
	.lines path { fill: none; stroke: var(--ink2); stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
	.lines .arw { stroke-dasharray: 1; stroke-dashoffset: 1; transition: stroke-dashoffset .4s ease-out; }
	.lines .arw.on { stroke-dashoffset: 0; }
	.lines .leader { stroke: var(--ink); stroke-dasharray: 3 5; opacity: 0; transition: opacity .3s; }
	.lines .leader.on { opacity: .7; }
	.lines .lm { stroke: #fff; stroke-width: 8; stroke-dasharray: 1; stroke-dashoffset: 1; transition: stroke-dashoffset .45s ease-in-out; }
	.lines .lm.on { stroke-dashoffset: 0; }

	.hits { position: absolute; inset: 0; pointer-events: none; }
	.hit { position: absolute; pointer-events: auto; border-radius: 2px; background: transparent; cursor: default; }
	.hit:focus-visible { outline: 2px solid var(--ink); outline-offset: 0; }
	.tip { position: absolute; z-index: 5; display: grid; gap: 2px; min-width: 140px; padding: 9px 12px; background: #fff; border-radius: 3px; box-shadow: 0 6px 20px rgba(20, 32, 45, .14); font-size: 12.5px; color: var(--ink2); pointer-events: none; white-space: nowrap; }
	.tip.flip { transform: translateX(calc(-100% - var(--gw))); }
	.tip b { font-size: 13.5px; color: var(--ink); }
	.tv { font-size: 20px; font-weight: 600; color: var(--ink); font-variant-numeric: tabular-nums; }
	@media (max-width: 759px) {
		.cap { padding: 12px 14px 14px; }
		.say-t { font-size: 15px; }
		.q { padding: 10px 14px; }
		.q p { font-size: 16px; }
		.av { font-size: 20px; }
	}
	.still .say-t, .still .diag, .still .q, .still .av, .still .lines path { transition: none; }
	@media (prefers-reduced-motion: reduce) { .say-t, .diag, .q, .av, .lines path { transition: none; } }
</style>
