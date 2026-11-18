<script lang="ts" module>
	// Its footnotes, which the page registers before the section wakes (Defer.svelte), so the notes list and the marks' numbers
	// are complete from the start.
	import A from "./anonymity.json";
	import type { Note } from "./Footnotes.svelte";
	export const FOOTNOTES = { id: "s5", notes: A.notes as Note[] };
</script>

<script lang="ts">
	// Section 5, Implications for anonymity. A chapter opener (one writer's print, as written and paraphrased), then a
	// pinned stage with its own blocking: the writers a model knows well as one large mass, a giant numeral beside it,
	// and the narration as a caption band along the top (placed as section 4's). One idea per step:
	//   known     the "very familiar" group alone, large: the share of their texts the model names, as a giant numeral
	//   refusals  the same place holds 1,258 Reddit posts, one tile each; Fable 5.2's written refusals in its clay, and one
	//             statement under the numeral in place of colour keys (the count in clay)
	//   rewrite   the paraphrasing test as a small diagram: original → Argon → paraphrased
	//   para      the less familiar groups join; paraphrasing lightens the texts it hid (the lighter tint of the model's
	//             colour), the rest stay solid, the never-named stay gray (Figure rq3_familiarity, 1 tile = 1% of texts)
	//   defenses  the three limits, then Explore (original or paraphrased, domain, model)
	// Every group tile is a writer's print, as legible as the model is familiar with the group (as in section 4). Tiles
	// are abstract: no writer is named or implied. Strings and numbers are the paper's (anonymity.json, built in the
	// private llm-detectors repo by docs/launch_20261116/tools/build_familiarity_anonymity_data.py); `ui` lists the rest.
	// The refusal count's provenance and the paraphrasing method are footnotes.
	//
	// Pacing: each step takes 75vh of scroll where it animates and 60vh where it does not (Atrey, 16 Nov); a fast scroll
	// still shows each step in turn, for at least HOLD_MS, and the current dash fills as the reader scrolls through it.
	//
	// Performance: the step comes from one passive scroll listener; nothing runs per frame while idle. The canvas is
	// rebuilt only when an input changes and, while a tween moves, on animation frames that stop when it ends. Marks
	// are pooled; the geometry depends on the size only, so tiles never re-lay out on scroll.
	import { onMount } from "svelte";
	import Icon from "./Icon.svelte";
	import Reveal from "./Reveal.svelte";
	import Tags, { type Tag } from "./Tags.svelte";
	import SectionOpener from "./SectionOpener.svelte";
	import StepDashes from "./StepDashes.svelte";
	import Footnotes from "./Footnotes.svelte";
	import HoverCue from "./HoverCue.svelte";
	import { MODEL, GRAY, INK as INKS, deepen, TILE } from "./palette";
	import { printSprite, printAspect, warmTilesNear } from "./print/sprites";
	import { field, chart, regions, type Mark, type Path, type Text } from "./field.svelte";
	import { onScroll as onPageScroll, requestFrame, view as vp, lite, deliberate, pointerKind } from "./loop";

	type Bin = { bin: string; shown: boolean; pct: number; tiles: number; pct_rw: number; tiles_rw: number };
	type Step = { view: string; t: string; fn?: number; more?: { t: string }; items?: { icon: string; t: string }[] };
	type G = { x: number; y: number; cx: number; p: number; gw: number };

	const OWNER = "s5-anonymity";
	const INK = INKS.ink, INK2 = INKS.ink2, OFF = GRAY.unlit;
	const STEPS = A.steps as Step[];
	const LAST = STEPS.length - 1;
	// scroll per step, in viewport heights: 75vh where the step animates (the groups filling, the refusals lighting up,
	// the paraphrasing sweep), 60vh where it does not
	const STEP_VH = STEPS.map((s) => (s.view === "rewrite" || s.view === "defenses" ? 0.6 : 0.75));
	// where each step's stretch starts, in viewport heights from the pinned stage's top: step 0 is centred on 0 (the
	// stage just pinned), so AT[0] < 0; step i runs from AT[i] to AT[i + 1]
	const AT = STEP_VH.reduce((a, v, i) => [...a, a[i] + v], [-STEP_VH[0] / 2]);
	const SPAN_VH = STEP_VH.reduce((a, v) => a + v, 0);
	const HOLD_MS = 350; // a fast scroll moves the shown step one at a time, holding each at least this long
	const BINS = A.data.bins.domains as Record<string, Record<string, Bin[]>>;
	const R = A.data.refusals;
	const L = A.labels;
	const DOMS = L.domains as Record<string, string>;
	const MODELS = L.models as Record<string, string>;
	const GROUPS = L.groups as { bin: string; t: string }[];
	// a phone's third of the width is too narrow for "Moderately familiar" on one line: the less familiar groups' names
	// break before their last word there (the tags keep the break; see the style)
	const NAME2 = GROUPS.map((g) => g.t.replace(/ (?=\S+$)/, "\n"));
	const NAME2_H = 6 + 2 * 12.5 * 1.6; // such a name's height: the tag's padding and two lines of its 12.5px type
	const NOTES = FOOTNOTES.notes;
	const col = (name: string) => MODEL[name] ?? GRAY.strong;
	const CLAY = col(L.fable), REWRITER = col(L.rewriter);
	const pctLabel = (pct: number, tiles: number) => (pct > 0 && pct < 1 ? L.lt1 : `${tiles}%`);
	const est = (t: string) => 30 + t.length * 7.1; // a tag's width, for laying tags side by side
	const FOCUS = 3; // the writers the model knows well
	const PRINT = 4; // the opener's print: section 4's demo writer
	const CLARITY = [0.1, 0.4, 0.7, 1]; // legibility of the prints in each familiarity group (as in section 4)
	/** the lighter tint of a model's colour, for the texts paraphrasing hid: opaque, so the key's swatch matches the tile */
	const lighter = (hex: string, t = 0.42) => {
		const a = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)), b = [243, 243, 239];
		return "#" + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, "0")).join("");
	};
	const OPENER = [
		{ family: "writer" as const, index: PRINT, color: INKS.field, clarity: 1, label: L.original },
		{ family: "writer" as const, index: PRINT, color: INKS.field, clarity: 0.4, label: L.paraphrased, icon: "rewrite" },
	];
	// abstract positions for the refused posts: a fixed shuffle of the grid, so the marks say how many, not which
	const ORDER = (() => {
		const a = Array.from({ length: R.posts }, (_, i) => i);
		let s = 20261116;
		for (let i = a.length - 1; i > 0; i--) { s = (s * 1664525 + 1013904223) >>> 0; const j = s % (i + 1); [a[i], a[j]] = [a[j], a[i]]; }
		return a;
	})();
	const RANK = new Map(ORDER.map((p, j) => [p, j]));
	// the refusals step's one statement, in place of colour keys (Atrey, 17 Nov): anonymity.json's template filled from
	// data.refusals, the refused count set in Fable's clay
	const REFUSAL = L.refusal_line.split(/(\{\w+\})/).filter(Boolean).map((p) => {
		const k = /^\{(\w+)\}$/.exec(p)?.[1];
		if (!k) return { t: p, em: false };
		return { t: k === "posts" ? R.posts.toLocaleString("en-US") : String(R[k as "refused" | "refused_pct"]), em: k === "refused" };
	});

	let step = $state(0);
	let progress = $state(0); // how far the scroll is through the shown step, 0..1 (fills the next dash)
	let active = $state(false);
	let owned = $state(false);
	let dom = $state("reddit");
	let model = $state("Opus");
	let para = $state(true); // Explore's original / paraphrased switch
	let replays = $state(0);
	let sel = $state<number | null>(null);
	let swept = $state(false); // the paraphrased look is showing (for the numbers and the key)
	let W = $state(0), H = $state(0), capMax = $state(0);
	let ctlH = $state(0); // the controls' natural height: on a phone they wrap to three rows
	let cap: HTMLElement;
	let capH = $state(0); // the caption band's height: the phone's group card covers it exactly
	let ox = $state(0), oy = $state(0); // the stage's viewport offset
	let reduce = $state(false);
	let stage: HTMLElement;
	let root: HTMLElement; // the pinned part (the opener and footnotes sit outside it)

	const st = $derived(STEPS[step]);
	const view = $derived(st.view);
	const explore = $derived(step >= LAST);
	const paraOn = $derived(view === "para" || (view === "defenses" && para));
	const showHuge = $derived(view !== "refusals");
	const showSmall = $derived(view === "para" || view === "defenses");
	const narrow = $derived(W > 0 && W < 760);
	const mcolor = $derived(col(MODELS[model]));
	const mlight = $derived(lighter(mcolor));
	const bins = $derived(BINS[dom][model]);
	const focus = $derived(bins[FOCUS]);

	// where everything sits, in stage coordinates; it depends on the size only, so nothing moves between steps
	const geo = $derived.by(() => {
		const g: G[] = [];
		const o = { g, cap: { x: 0, y: 0, w: 0 }, num: { x: 0, y: 0, w: 0 }, numSize: 150, keyX: 0, keyY: 0, refY: 0, stackKeys: true,
			wall: { x: 0, y: 0, w: 0, h: 0 }, slot: { x: 0, y: 0, w: 0, h: 0 }, smallNumSize: 20 };
		if (!W || !H) return o;
		// the caption band on top, where section 4 puts its card: 76px down and centred (at most 800px wide, not 760: the
		// Explore controls' one row is 750px); on a phone 60px down, the stage's full width
		const cw = narrow ? W : Math.min(800, W), top = narrow ? 60 : 76;
		o.cap = { x: (W - cw) / 2, y: top, w: cw };
		// the band at its tallest: its tallest text, plus the dashes, gaps and padding around it (capText), plus Explore's
		// rows, which open inside it on the last step (measured; on a phone they wrap to three rows). The picture starts
		// under it, so the band covers nothing at any step; on a desktop the gap holds the hover cue over the very
		// familiar group (28px tall, 8px over it)
		const capText = (capMax || (narrow ? 170 : 110)) + (narrow ? 64 : 68), exploreH = ctlH || (narrow ? 128 : 40);
		let zT = top + capText + exploreH + (narrow ? 10 : 48);
		const zB = H - (narrow ? 8 : 16);
		if (!narrow) {
			// a short screen (under about 650px) would leave the left column too short for the picture (below): the
			// guided steps keep it whole, and Explore's row, once open, covers only the hover cue
			zT = Math.min(zT, Math.max(top + capText + 48, zB - 44 - 260));
			const zh = zB - zT;
			// left: the giant numeral over the less familiar groups; right: the very familiar group, large
			const ph = Math.floor(Math.max(10, Math.min(40, (zh - 44) / 10))), gh = 10 * ph;
			// the left column, within the very familiar group's height: the numeral; the keys, up to two rows (26px tall
			// around their lines, 30px apart, the first 52px under the numeral's baseline); a gap; the less familiar
			// groups' numbers (20px, centred 16px over them); the groups. Where that is short the groups get smaller (and,
			// at the smallest, the numeral, down to 56px: below that height the column is tight, as it was before)
			const COL = 52 + 30 + 13 + 8 + 26, room = (s: number) => Math.floor((gh - s * 0.86 - COL) / 10);
			let numSize = Math.round(Math.min(124, gh * 0.31));
			const ps = Math.max(8, Math.min(16, Math.floor(ph * 0.42), room(numSize))), gs = 10 * ps;
			if (room(numSize) < ps) numSize = Math.max(Math.min(numSize, 56), Math.floor((gh - gs - COL) / 0.86));
			// the column keeps room for the paraphrasing diagram's arrows; smaller groups spread across it
			const LW = Math.max(3 * gs + 2 * 28, 480), gapS = (LW - 3 * gs) / 2, colGap = 72, x0 = (W - (LW + colGap + gh)) / 2;
			const hy = zT + Math.max(0, (zh - 44 - gh) / 2), hx = x0 + LW + colGap;
			for (let i = 0; i < 3; i++) { const x = x0 + i * (gs + gapS); g.push({ x, y: hy + gh - gs, cx: x + gs / 2, p: ps, gw: gs }); }
			g.push({ x: hx, y: hy, cx: hx + gh / 2, p: ph, gw: gh });
			o.numSize = numSize;
			o.num = { x: x0, y: hy - 6, w: LW };
			o.keyX = x0; o.keyY = hy + o.numSize * 0.86 + 52; o.refY = o.keyY - 13;
			o.wall = { x: hx, y: hy, w: gh, h: gh };
			o.slot = { x: x0, y: hy + gh - gs, w: LW, h: gs };
		} else {
			// row 1: the numeral | the very familiar group; row 2: the three less familiar groups; row 3: the key
			const names = 8 + NAME2_H + 3, keysH = 62, row2 = 32 + 70 + names; // the groups' numbers, tiles and names
			// a short phone (667px) has no room for all of it at the smallest tiles: the guided steps keep the whole
			// picture, and only Explore's rows, once open, lie over the top of it (before, they lay over its bottom)
			const fixed = 34 + row2 + keysH;
			zT = Math.min(zT, Math.max(top + capText + 10, zB - fixed - 100));
			const zh = zB - zT;
			const ph = Math.floor(Math.max(10, Math.min(21, (W - 140) / 10, (zh - fixed) / 10))), gh = 10 * ph;
			const hx = W - gh, hy = zT;
			g.length = 0;
			const pitch = W / 3, ps = 7, gs = 70, sy = hy + gh + 34 + 32;
			for (let i = 0; i < 3; i++) { const x = i * pitch + (pitch - gs) / 2; g.push({ x, y: sy, cx: x + gs / 2, p: ps, gw: gs }); }
			g.push({ x: hx, y: hy, cx: hx + gh / 2, p: ph, gw: gh });
			o.numSize = 52; o.smallNumSize = 13;
			o.num = { x: 0, y: hy + 4, w: W - gh - 12 };
			o.stackKeys = false; o.keyY = sy + gs + names + 18;
			o.wall = { x: 140, y: hy, w: W - 140, h: gh + 34 + 32 + gs };
			// the refusals' statement just under the posts (where the groups' names are in the other steps): on a narrow
			// phone it takes three lines, which from the keys' place ran to the screen's edge
			o.refY = o.wall.y + o.wall.h + 24;
			o.slot = { x: 0, y: sy, w: W, h: gs };
		}
		return o;
	});

	// labels on the picture (viewport coordinates): every group named, every colour shown named
	const tags = $derived.by(() => {
		const t: Tag[] = [];
		if (!active || !owned || !geo.g.length) return t;
		const X = (x: number) => ox + x, Y = (y: number) => oy + y;
		geo.g.forEach((g, i) => {
			if (i === FOCUS ? !showHuge : !showSmall) return;
			t.push({ id: `g${i}`, x: X(g.cx), y: Y(g.y + g.gw), t: narrow && i !== FOCUS ? NAME2[i] : GROUPS[i].t, at: "below" });
		});
		if (view === "rewrite") t.push({ id: "rw", x: X(diag.c), y: Y(diag.cy + diag.av / 2 + 2), t: L.rewriter, color: REWRITER, at: "below" });
		// the colour keys (the refusals have none: one statement says it, REFUSAL)
		const key: { t: string; color: string; sub?: string }[] = [];
		if (view !== "refusals") {
			if (paraOn && swept) key.push({ t: `${MODELS[model]} ${L.still}`, color: mcolor }, { t: L.lost, color: mlight }, { t: L.not_named, color: OFF });
			else key.push({ t: `${MODELS[model]} ${L.named}`, color: mcolor }, { t: L.not_named, color: OFF });
		}
		// rows of keys: left-aligned under the numeral (desktop), centred under the groups (phone)
		const span = geo.stackKeys ? geo.num.w : W;
		const rows: (typeof key)[] = [[]];
		let w = 0;
		for (const k of key) { const kw = est(k.t) + 8; if (w + kw > span && rows[rows.length - 1].length) { rows.push([]); w = 0; } rows[rows.length - 1].push(k); w += kw; }
		rows.forEach((r, ri) => {
			let x = geo.stackKeys ? geo.keyX : (W - r.reduce((s, k) => s + est(k.t) + 8, -8)) / 2;
			r.forEach((k, i) => { t.push({ id: `k${ri}${i}${view}${k.color}`, x: X(x) - 10, y: Y(geo.keyY + ri * (k.sub ? 40 : 30)), t: k.t, color: k.color, sub: k.sub }); x += est(k.t) + 8; });
		});
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
	const PIDS = Array.from({ length: R.posts }, (_, i) => `${OWNER}:p:${i}`);
	const GOF = new Map<string, number>(IDS.flatMap((ids, gi) => ids.map((id) => [id, gi] as [string, number])));
	const marks: Mark[] = [];
	let lastKey = "", lastStep = -1, lastReplays = 0, t0 = 0, alive = true, anim: "enter" | "ctrl" | "settle" = "settle", replayed = false;
	let fromLit = [0, 0, 0, 0], curLit = [0, 0, 0, 0];
	const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

	function tile(g: G, gi: number, i: number) {
		const m = mk(IDS[gi][i]);
		m.x = ox + g.x + (i % 10) * g.p + g.p / 2;
		m.y = oy + g.y + (9 - Math.floor(i / 10)) * g.p + g.p / 2;
		m.square = true; m.r = g.p * 0.36; m.alpha = 1; m.color = OFF; m.snap = true; // in place, never flying in
		return m;
	}

	function render(now: number): boolean {
		const key = `${view}|${dom}|${model}|${paraOn}|${replays}`;
		if (key !== lastKey) {
			// an entrance plays only when the reader arrives from the step before; a control change tweens from what is
			// shown; anything else (scrolling back, a dash jump) settles at once
			anim = step === lastStep + 1 ? "enter" : step === lastStep ? "ctrl" : "settle";
			fromLit = anim === "settle" ? [0, 0, 0, 0] : curLit.slice();
			replayed = replays !== lastReplays; // a replay holds the original a moment before the sweep
			lastKey = key; lastStep = step; lastReplays = replays; t0 = now;
		}
		const e = reduce || anim === "settle" ? 1e9 : (now - t0) / 1000;
		let busy = false;
		marks.length = 0;
		const texts: Text[] = [], paths: Path[] = [];
		const G4 = geo.g;
		if (!G4.length) { chart.marks = marks; chart.paths = paths; chart.texts = texts; return false; }
		if (view === "refusals") {
			// the posts, answered in gray; Fable 5.2's written refusals in its clay, each in a square outline so three
			// tiles can be found among 1,258
			const wb = geo.wall, cols = Math.max(10, Math.round(Math.sqrt((R.posts * wb.w) / wb.h)));
			const rows = Math.ceil(R.posts / cols), p = Math.min(wb.w / cols, wb.h / rows);
			const x0 = wb.x + (wb.w - cols * p) / 2, y0 = wb.y + (wb.h - rows * p) / 2;
			const k = ease((e - 0.5) / 0.8), on = Math.round(R.refused * k);
			for (let i = 0; i < R.posts; i++) {
				const m = mk(PIDS[i]);
				m.x = ox + x0 + (i % cols) * p + p / 2; m.y = oy + y0 + Math.floor(i / cols) * p + p / 2;
				m.square = true; m.r = p * 0.36; m.alpha = 1; m.snap = true; m.sprite = undefined; m.backing = undefined;
				const j = RANK.get(i)!;
				m.color = j < on ? CLAY : OFF;
				marks.push(m);
				if (j < on) { const h = Math.max(9, p * 1.5), cx = m.x, cy = m.y; paths.push({ pts: [[cx - h, cy - h], [cx + h, cy - h], [cx + h, cy + h], [cx - h, cy + h], [cx - h, cy - h]], color: CLAY, width: 1.5, progress: 1 }); }
			}
			curLit = [0, 0, 0, 0];
			if (swept) swept = false;
			busy = e < 1.4;
		} else {
			// the groups fill with what the model named (solid, its colour); paraphrased, a sweep from the top of each
			// stack lightens the texts paraphrasing hid to the lighter tint, and the still-named stay solid
			const kf = ease(e / 0.9);
			const sweepAt = anim === "enter" && view === "para" ? 1.0 : replayed ? 0.8 : 0.25;
			const sw = paraOn && e >= sweepAt;
			if (swept !== sw) swept = sw;
			G4.forEach((g, gi) => {
				if (gi === FOCUS ? !showHuge : !showSmall) { curLit[gi] = 0; return; }
				const b = bins[gi];
				if (!b.shown) {
					const w = g.gw;
					paths.push({ pts: [[ox + g.x, oy + g.y], [ox + g.x + w, oy + g.y], [ox + g.x + w, oy + g.y + w], [ox + g.x, oy + g.y + w], [ox + g.x, oy + g.y]], color: "rgba(20,32,45,.3)", width: 1, dash: [3, 4], progress: 1 });
					texts.push({ x: ox + g.cx, y: oy + g.y + w / 2, t: L.few, color: INK2, size: 11, align: "center", weight: 500 });
					curLit[gi] = 0;
					return;
				}
				const lit = fromLit[gi] + (b.tiles - fromLit[gi]) * kf;
				curLit[gi] = lit;
				const lost = Math.max(1, b.tiles - b.tiles_rw);
				for (let i = 0; i < 100; i++) {
					const m = tile(g, gi, i);
					if (i < lit - 0.001) {
						m.color = mcolor;
						// the texts paraphrasing hid, from the top of the stack down
						if (paraOn && i >= b.tiles_rw && i < b.tiles && e >= sweepAt + ((b.tiles - 1 - i) / lost) * 0.9) m.color = mlight;
					}
					marks.push(m);
				}
				if (gi !== FOCUS) texts.push({ x: ox + g.cx, y: oy + g.y - 16, t: sw ? `${pctLabel(b.pct, b.tiles)} → ${pctLabel(b.pct_rw, b.tiles_rw)}` : pctLabel(b.pct, b.tiles), color: INK, size: geo.smallNumSize, weight: 600, align: "center" });
			});
			busy = e < (paraOn ? sweepAt + 1.0 : 0.9);
		}
		if (sel !== null && G4[sel] && view !== "refusals" && (sel === FOCUS || showSmall)) {
			const g = G4[sel], w = g.gw, x = ox + g.x - 5, y = oy + g.y - 5;
			paths.push({ pts: [[x, y], [x + w + 10, y], [x + w + 10, y + w + 10], [x, y + w + 10], [x, y]], color: INK, width: 1.5, progress: 1 });
		}
		// the motif, as in section 4: each tile is a writer's print, as legible as the model is familiar with the
		// group (named tiles solid in the model's colour with the print in a deeper ink; hidden by paraphrasing, the
		// lighter tint with a lighter print; never named, pale)
		for (const m of marks) {
			const gi = GOF.get(m.id), pitch = gi === undefined ? 0 : G4[gi].p;
			if (gi === undefined || pitch < 15) { if (gi !== undefined) { m.sprite = undefined; m.backing = undefined; } continue; }
			const lit = m.color !== OFF, px = Math.round(pitch * 0.9), clarity = CLARITY[gi], idx = +m.id.slice(m.id.lastIndexOf(":") + 1);
			const ink = !lit ? m.color : m.color === mlight ? deepen(m.color, TILE.inkDepth * 0.6) : deepen(m.color, TILE.inkDepth);
			m.sprite = printSprite({ family: "writer", index: idx % 48, color: ink, px, clarity, defer: true });
			m.spriteKey = `a${idx % 48}|${ink}|${px}|${clarity}`;
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
		void [view, dom, model, paraOn, replays, geo, sel, ox, oy, active, owned, step];
		kick();
	});
	// two sections can both sit in the observer's band near their boundary: when the other one leaves and
	// clears the field, this one would get no new intersection event, so it takes the field back here
	$effect(() => {
		if (active && field.mode === "ground") { field.mode = "chart"; field.owner = OWNER; field.dim = 0.75; field.interactive = false; }
		owned = field.owner === OWNER;
	});
	// the guided steps always show the paper's default view; the controls take over only once Explore is open
	$effect(() => { if (!explore) { dom = "reddit"; model = "Opus"; para = true; } });
	$effect(() => { void step; sel = null; });

	function place() {
		const r = stage.getBoundingClientRect();
		if (r.left !== ox) ox = r.left;
		if (r.top !== oy) oy = r.top;
	}
	function replay() { para = true; replays++; }
	// a dash click scrolls to the middle of that step's stretch of the pinned stage
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
	function go(i: number) {
		const top = root.getBoundingClientRect().top + scrollY;
		scrollTo({ top: top + (AT[i] + STEP_VH[i] / 2) * innerHeight, behavior: reduce ? "instant" : "smooth" });
	}

	onMount(() => {
		reduce = matchMedia("(prefers-reduced-motion: reduce)").matches || new URLSearchParams(location.search).has("still");
		const stopWarm = warmTilesNear(root, "writer", 48, 14, 26); // the tiles' prints' ridges, traced ahead in idle moments
		// While the stage is on screen the shown step walks toward the scroll's step one at a time, holding each for
		// HOLD_MS (a timer, not a frame loop); off screen, or on arriving from off screen, it jumps there at once.
		let since = 0, hold = 0, seen = false; // when the shown step last changed
		const update = () => {
			const r = root.getBoundingClientRect(), H = vp.h || innerHeight;
			if (r.bottom < -H || r.top > H * 2) { seen = false; return; }
			const y = -r.top / H;
			let goal = 0;
			while (goal < LAST && y >= AT[goal + 1]) goal++;
			const vis = r.bottom > 0 && r.top < H, now = performance.now();
			// (the lighter mode for phones: the step follows the scroll directly; a momentum scroll is not held back)
			if (!vis || !seen || lite.on) {
				clearTimeout(hold); hold = 0;
				if (goal !== step) { step = goal; since = now; }
			} else if (goal !== step && !hold) {
				const wait = since + HOLD_MS - now;
				if (wait <= 0) { step += Math.sign(goal - step); since = now; }
				if (goal !== step) hold = window.setTimeout(() => { hold = 0; update(); }, wait > 0 ? wait : HOLD_MS);
			}
			seen = vis;
			const p = Math.max(0, Math.min(1, (y - AT[step]) / STEP_VH[step]));
			if (p !== progress) progress = p;
		};
		const onScroll = () => {
			update();
			// the lighter mode: a scroll closes a card a finger opened
			if (lite.on && sel !== null && pointerKind() !== "mouse") sel = null;
			if (!active) return;
			if (active && field.mode === "ground") { field.mode = "chart"; field.owner = OWNER; field.dim = 0.75; field.interactive = false; }
			place();
		};
		const stopScroll = onPageScroll(onScroll); // scroll and resize, in the page's loop
		regions[OWNER] = root;
		document.addEventListener("click", back);
		const io = new IntersectionObserver((es) => es.forEach((e) => {
			active = e.isIntersecting;
			if (active) { field.mode = "chart"; field.owner = OWNER; field.dim = 0.75; field.interactive = false; place(); }
			else if (field.mode === "chart" && field.owner === OWNER) { field.mode = "ground"; field.dim = 0; field.interactive = false; chart.marks = []; chart.paths = []; chart.texts = []; }
		}), { rootMargin: "-35% 0px -35% 0px" });
		io.observe(root);
		// the controls' natural height (Reveal holds them collapsed until Explore), measured once laid out and on resize
		const body = cap.querySelector<HTMLElement>(".reveal .inner");
		const measure = () => { const h = body?.scrollHeight ?? 0; if (h !== ctlH) ctlH = h; };
		const ro = new ResizeObserver(measure);
		if (body?.firstElementChild) ro.observe(body.firstElementChild);
		measure();
		return () => { alive = false; stopWarm(); clearTimeout(hold); io.disconnect(); ro.disconnect(); stopScroll(); document.removeEventListener("click", back); };
	});

	const hitIdx = $derived(view === "refusals" ? [] : showSmall ? [0, 1, 2, 3] : [FOCUS]);
	// a group hovered, focused or tapped shows its card; the hover cue goes once one has
	let tried = $state(false);
	const open = (i: number) => { sel = i; tried = true; };
	// the hover cue's place (stage px): over the very familiar group (top right), its right edges lined up; on a phone
	// beside it on the left, level with its bottom, under the numeral (over it, the caption band's Explore rows would
	// cover it, and the room it needs there would shrink every tile)
	const cueAt = $derived.by(() => {
		const g = geo.g[FOCUS];
		if (!g) return null;
		return narrow ? { right: W - g.x + 10, top: g.y + g.gw - 28 } : { right: W - (g.x + g.gw), top: g.y - 8 - 28 };
	});
	const tip = $derived.by(() => {
		if (sel === null || !hitIdx.includes(sel)) return null;
		const b = bins[sel];
		if (!b.shown) return { h: GROUPS[sel].t, v: L.few, s: [] as string[] };
		if (!paraOn) return { h: GROUPS[sel].t, v: pctLabel(b.pct, b.tiles), s: [`${MODELS[model]} ${L.named}`, L.original] };
		return { h: GROUPS[sel].t, v: `${pctLabel(b.pct, b.tiles)} → ${pctLabel(b.pct_rw, b.tiles_rw)}`, s: [`${MODELS[model]} ${L.named}`, `${L.original} → ${L.paraphrased}`] };
	});
	const aria = (i: number) => {
		const b = bins[i];
		if (!b.shown) return `${GROUPS[i].t}: ${L.few}`;
		return `${GROUPS[i].t}: ${L.original} ${pctLabel(b.pct, b.tiles)}, ${L.paraphrased} ${pctLabel(b.pct_rw, b.tiles_rw)}`;
	};
	const arrow = (x1: number, y1: number, x2: number, y2: number) => `M${x1},${y1} L${x2},${y2} M${x2 - 6},${y2 - 4.5} L${x2},${y2} L${x2 - 6},${y2 + 4.5}`;
	// the paraphrasing diagram, in the bottom-left slot: original → the rewriting model → paraphrased
	const diag = $derived.by(() => {
		const s = geo.slot, cy = s.y + s.h / 2 - (narrow ? 0 : 14), nw = narrow ? 108 : 150, av = narrow ? 40 : 52;
		const a1 = s.x + nw + 10, b1 = s.x + s.w / 2 - av / 2 - 10, a2 = s.x + s.w / 2 + av / 2 + 10, b2 = s.x + s.w - nw - 10;
		return { cy, nw, av, l: s.x, r: s.x + s.w - nw, c: s.x + s.w / 2, arrows: [arrow(a1, cy, b1, cy), arrow(a2, cy, b2, cy)] };
	});
</script>

<section class="an" id={A.id} data-rq="0" data-step={step}>
	<SectionOpener n={A.n} title={A.title.t} takeaway={A.takeaway.t} context={A.context.t} accent={GRAY.mid} prints={OPENER} />

	<div class="scrolly" class:still={reduce} bind:this={root} style="--span:calc({SPAN_VH * 100} * var(--vh, 1vh))">
		<div class="stick" bind:this={stage} bind:clientWidth={W} bind:clientHeight={H}>
			<!-- the giant numeral: the one number each frame is about -->
			<div class="num" style="left:{geo.num.x}px; top:{geo.num.y}px; width:{geo.num.w}px; --size:{geo.numSize}px" aria-hidden="true">
				{#key `${view === "refusals"}|${paraOn && swept}|${dom}|${model}`}
					{#if view === "refusals"}
						<p class="big" style:color={CLAY}><b>{R.refused}</b><span class="unit">{L.posts}</span></p>
					{:else if paraOn && swept}
						<p class="from">{pctLabel(focus.pct, focus.tiles)} →</p>
						<p class="big" style:color={mcolor}><b>{pctLabel(focus.pct_rw, focus.tiles_rw)}</b></p>
					{:else}
						<p class="big" style:color={mcolor}><b>{pctLabel(focus.pct, focus.tiles)}</b></p>
					{/if}
				{/key}
			</div>

			<!-- the paraphrasing test: original → the rewriting model → paraphrased -->
			<div class="diag" class:on={view === "rewrite"} aria-hidden={view !== "rewrite"}>
				<p class="node" style="left:{diag.l}px; top:{diag.cy}px; width:{diag.nw}px">{L.original}</p>
				<span class="av" style="left:{diag.c - diag.av / 2}px; top:{diag.cy - diag.av / 2}px; width:{diag.av}px; height:{diag.av}px; color:{REWRITER}"><Icon name="google" /></span>
				<p class="node" style="left:{diag.r}px; top:{diag.cy}px; width:{diag.nw}px"><Icon name="rewrite" />{L.paraphrased}</p>
				<svg class="lines" aria-hidden="true">{#each diag.arrows as d}<path {d} />{/each}</svg>
			</div>

			<!-- hover and keyboard targets over each tile group; the canvas itself is aria-hidden. Focus opens a card
			     only from the keyboard: a tap focuses the button too, and its click would then close the card it opened -->
			<div class="hits">
				{#each hitIdx as i (i)}
					{@const g = geo.g[i]}
					{#if g}
						<button type="button" class="hit" aria-label={aria(i)}
							style="left:{g.x - 5}px; top:{g.y - 5}px; width:{g.gw + 10}px; height:{g.gw + 10}px"
							onpointerenter={(e) => e.pointerType === "mouse" && open(i)} onpointerleave={(e) => e.pointerType === "mouse" && (sel = sel === i ? null : sel)}
							onfocus={(e) => e.currentTarget.matches(":focus-visible") && open(i)} onblur={() => (sel = sel === i ? null : sel)}
							onclick={(e) => { if (deliberate(e)) { if (sel === i) sel = null; else open(i); } }}></button>
					{/if}
				{/each}
			</div>
			<!-- the hover cue, by the very familiar group while the groups take a hover (not on the refusals) -->
			<HoverCue hover="Hover over a group" tap="Tap a group" show={hitIdx.length > 0 && active && !!cueAt && !tried} style={cueAt ? `right:${cueAt.right}px; top:${cueAt.top}px` : "visibility:hidden"} />
			<!-- the refusals in one statement, where the other steps' colour keys sit (on a phone, just under the posts; the
		     count in Fable's clay) -->
			<p class="refuse" class:on={view === "refusals"} class:mid={!geo.stackKeys} aria-hidden={view !== "refusals"}
				style="left:{geo.stackKeys ? geo.keyX : 0}px; top:{geo.refY}px; width:{geo.stackKeys ? geo.num.w : W}px">{#each REFUSAL as p}{#if p.em}<b style:color={CLAY}>{p.t}</b>{:else}{p.t}{/if}{/each}</p>
			{#if tip && active && sel !== null && geo.g[sel]}
				{@const g = geo.g[sel]}
				<!-- on a narrow screen the card docks over the caption band at the top, covering it exactly (never the groups):
				     beside a middle group it ran off the screen's edge, and under the groups the keys' layer covered it -->
				{@const below = W < 600}
				<div class="tip" class:flip={!below && g.x + g.gw > W - 220} class:below style={below ? `left:${geo.cap.x}px; top:${geo.cap.y}px; width:${geo.cap.w}px; min-height:${capH}px` : `left:${g.x + g.gw + 12}px; top:${g.y}px; --gw:${g.gw + 24}px`} role="status">
					<b>{tip.h}</b><span class="tv">{tip.v}</span>{#each tip.s as s}<span>{s}</span>{/each}
				</div>
			{/if}

			<!-- the narration: a caption band along the top; the dashes jump to a step; the controls open inside it -->
			<div class="cap" class:unsized={!W} style="left:{geo.cap.x}px; top:{geo.cap.y}px; width:{geo.cap.w}px" bind:this={cap} bind:clientHeight={capH}>
				<StepDashes count={STEPS.length} current={step} {progress} {go} />
				<div class="say" aria-live="polite" bind:clientHeight={capMax}>
					{#each STEPS as s, i}
						<div class="say-in" class:on={i === step} aria-hidden={i !== step} data-i={i}>
							<p class="say-t">{s.t}{#if s.fn}<sup class="fnref"><a href="#fn-s5-{s.fn}" id="fnref-s5-{s.fn}" tabindex={i === step ? 0 : -1}>{s.fn}</a></sup>{/if}</p>
							{#if s.more}<p class="say-m">{s.more.t}</p>{/if}
							{#if s.items}<ul class="defs">{#each s.items as it}<li><Icon name={it.icon} /><span>{it.t[0].toUpperCase() + it.t.slice(1)}</span></li>{/each}</ul>{/if}
						</div>
					{/each}
				</div>
				<!-- the controls, in one row (sideways on a phone) -->
				<Reveal show={explore}>
					<div class="ctrl" role="group" aria-label={L.rewriting}>
						<button type="button" aria-pressed={!para} onclick={() => (para = false)}><i class="sw" style:background={mcolor}></i>{L.original}</button>
						<button type="button" aria-pressed={para} onclick={() => (para = true)}><i class="sw" style:background={mlight}></i>{L.paraphrased}</button>
						<span class="sep"></span>
						<button type="button" onclick={replay} aria-label={L.replay} title={L.replay}><Icon name="replay" /></button>
					</div>
					<div class="ctrl" role="group" aria-label={L.domain}>
						{#each Object.entries(DOMS) as [id, t]}<button type="button" aria-pressed={dom === id} onclick={() => (dom = id)}>{t}</button>{/each}
					</div>
					<div class="ctrl" role="group" aria-label={L.model}>
						{#each Object.entries(MODELS) as [id, t]}<button type="button" aria-pressed={model === id} onclick={() => (model = id)}><i class="sw" style:background={col(t)}></i>{t}</button>{/each}
					</div>
				</Reveal>
			</div>
		</div>
	</div>
	{#if active && owned}<Tags items={tags} follow />{/if}

	<Footnotes id="s5" notes={NOTES} />
</section>

<style>
	.an { position: relative; }
	.scrolly { position: relative; height: calc(var(--span) + calc(100 * var(--vh, 1vh))); }
	.stick { position: sticky; top: 0; height: calc(100 * var(--vh, 1vh)); pointer-events: none; }

	/* the caption band, along the top (placed by geo.cap; before the stage is measured, where it will be on a desktop); over
	   the hover cue, which only a short phone's open Explore rows reach */
	.cap { position: absolute; z-index: 4; pointer-events: auto; padding: 14px 18px 16px; background: #fff; border-radius: 3px; box-shadow: 0 2px 14px rgba(20, 32, 45, .06); display: grid; gap: 10px; }
	.cap.unsized { left: 50% !important; top: 76px !important; width: min(800px, 100%) !important; transform: translateX(-50%); }
	.say { display: grid; margin-top: 4px; }
	.say-in { grid-area: 1 / 1; display: grid; align-content: start; gap: 6px; opacity: 0; visibility: hidden; transform: translateY(6px); transition: opacity .4s, transform .45s var(--ease), visibility 0s .4s; }
	.say-in.on { opacity: 1; visibility: visible; transform: none; transition: opacity .4s, transform .45s var(--ease), visibility 0s; }
	@keyframes say { from { opacity: 0; transform: translateY(6px); } }
	.say-t { font-size: 19px; line-height: 1.45; letter-spacing: -0.01em; color: var(--ink); }
	.say-m { font-size: 15px; line-height: 1.5; color: var(--ink2); }
	.defs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin-top: 4px; }
	.defs li { display: flex; gap: 9px; font-size: 14.5px; line-height: 1.45; color: var(--ink); }
	.defs :global(.ic) { flex: none; margin-top: 3px; font-size: 16px; }
	.ctrl { flex: none; display: inline-flex; flex-wrap: nowrap; align-items: center; gap: 2px; background: var(--chip); border-radius: 3px; padding: 3px; }
	.ctrl button { display: inline-flex; align-items: center; gap: 6px; padding: 5px 8px; font-size: 12.5px; font-weight: 500; color: var(--ink2); border-radius: 2px; white-space: nowrap; }
	.ctrl button:hover { color: var(--ink); }
	.ctrl button[aria-pressed="true"] { background: var(--ink); color: var(--field); }
	.sw { flex: none; display: inline-block; width: 9px; height: 9px; border-radius: 1px; }
	.ctrl button[aria-pressed="true"] .sw { box-shadow: 0 0 0 1.5px var(--field); }
	.sep { width: 1px; align-self: stretch; margin: 3px 4px; background: var(--rule); }

	/* the giant numeral */
	.num { position: absolute; display: grid; align-content: start; }
	.from { font-size: calc(var(--size) * .2); line-height: 1.2; font-weight: 600; color: var(--ink2); font-variant-numeric: tabular-nums; animation: say .45s var(--ease); }
	.big { display: flex; align-items: baseline; gap: .12em; line-height: .86; animation: say .5s var(--ease); }
	.big b { font-size: var(--size); font-weight: 600; letter-spacing: -0.055em; font-variant-numeric: tabular-nums; }
	.big .unit { font-size: calc(var(--size) * .2); font-weight: 600; letter-spacing: 0; color: var(--ink); }

	/* the paraphrasing diagram */
	.diag { position: absolute; inset: 0; opacity: 0; transition: opacity .45s; }
	.diag.on { opacity: 1; }
	.node { position: absolute; transform: translateY(-50%); display: flex; align-items: center; justify-content: center; gap: 8px; padding: 14px 16px; background: #fff; border-radius: 3px; box-shadow: 0 2px 14px rgba(20, 32, 45, .06); font-size: 16px; font-weight: 600; color: var(--ink); }
	.node :global(.ic) { color: var(--ink2); }
	.av { position: absolute; display: grid; place-items: center; border-radius: 50%; background: #fff; box-shadow: 0 2px 14px rgba(20, 32, 45, .1); font-size: 24px; }
	.lines { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
	.lines path { fill: none; stroke: var(--ink2); stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }

	/* a group's name on a phone keeps its line break (NAME2), centred under the group; one-line tags are unchanged */
	.an :global(.tags .tag.at-below .t) { white-space: pre; text-align: center; }

	/* the refusals' statement: one sentence under the numeral (centred under the posts on a phone) */
	.refuse { position: absolute; margin: 0; font-size: 17px; line-height: 1.45; font-weight: 500; letter-spacing: -0.008em; color: var(--ink); text-wrap: pretty; opacity: 0; visibility: hidden; transition: opacity .4s, visibility 0s .4s; }
	.refuse.on { opacity: 1; visibility: visible; transition: opacity .4s; }
	.refuse.mid { text-align: center; }
	.refuse b { font-weight: 700; }
	.hits { position: absolute; inset: 0; pointer-events: none; }
	.hit { position: absolute; pointer-events: auto; border-radius: 2px; background: transparent; cursor: default; }
	.hit:focus-visible { outline: 2px solid var(--ink); outline-offset: 0; }
	.tip { position: absolute; z-index: 5; display: grid; gap: 2px; min-width: 150px; padding: 9px 12px; background: #fff; border-radius: 3px; box-shadow: 0 6px 20px rgba(20, 32, 45, .14); font-size: 12.5px; color: var(--ink2); pointer-events: none; white-space: nowrap; }
	.tip.flip { transform: translateX(calc(-100% - var(--gw))); }
	.tip.below { z-index: 40; align-content: start; min-width: 0; padding: 12px 16px; white-space: normal; box-shadow: 0 8px 26px rgba(20, 32, 45, .18); }
	.tip b { font-size: 13.5px; color: var(--ink); }
	.tv { font-size: 20px; font-weight: 600; color: var(--ink); font-variant-numeric: tabular-nums; }
	@media (max-width: 759px) {
		.cap { padding: 12px 14px 14px; }
		.say-t { font-size: 15.5px; }
		.say-m { font-size: 13.5px; }
		.refuse { font-size: 15px; }
		.defs { grid-template-columns: 1fr; gap: 6px; }
		.defs li { font-size: 13.5px; }
		.node { padding: 10px 10px; font-size: 13.5px; gap: 6px; }
		.av { font-size: 18px; }
	}
	.still .say-in, .still .from, .still .big, .still .diag, .still .refuse { animation: none; transition: none; }
	@media (prefers-reduced-motion: reduce) { .from, .big { animation: none; } .say-in, .diag, .refuse { transition: none; } }
</style>
