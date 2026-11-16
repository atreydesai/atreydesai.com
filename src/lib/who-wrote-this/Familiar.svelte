<script lang="ts">
	// Section 4, Who can be identified? A chapter opener (the same writer's print at four clarities, one per familiarity
	// group), then a pinned stage with its own blocking: the narration as a caption band on top, a small centred diagram
	// under it (the question → the model → its answer), and the four familiarity groups large and full width below.
	// One idea per step:
	//   ask       the question in a few words, and the 0–3 scale as four rising steps (the groups' footprints)
	//   answer    the model's answer; the step it names lights
	//   sort      this writer's texts drop from the answer into their group (the label rides with them), then every
	//             other text fills the four groups
	//   light     each group lights to how often the model named the writer (Figure rq3_familiarity, 1 tile = 1% of
	//             texts, in the model's colour), with the number large above it
	//   takeaway  a line traces the lit levels: the steps of the scale again, now as accuracy; Explore opens under the
	//             caption (domains, models, reasoning effort)
	// Every tile is a writer's print, as legible as the model is familiar with the group (clarity means familiarity only).
	// Tiles are abstract: no writer is named or implied. Strings and numbers are the paper's (familiarity.json, built in the
	// private llm-detectors repo by docs/launch_20261116/tools/build_familiarity_anonymity_data.py); `ui`, `demo` and
	// `notes_ours` list the rest. The full prompt and the demo's provenance are footnotes.
	//
	// Performance: the step comes from one passive scroll listener; nothing runs per frame while idle. The canvas is
	// rebuilt only when an input changes (step, a control, hover, size, the stage's position while it scrolls in or out)
	// and, while a tween moves, on animation frames that stop when it ends. Marks are pooled; the group geometry never
	// changes with the step, so tiles never re-lay out on scroll.
	import { onMount } from "svelte";
	import Icon from "./Icon.svelte";
	import Reveal from "./Reveal.svelte";
	import Tags, { type Tag } from "./Tags.svelte";
	import SectionOpener from "./SectionOpener.svelte";
	import StepDashes from "./StepDashes.svelte";
	import Footnotes, { type Note } from "./Footnotes.svelte";
	import { MODEL, GRAY, INK as INKS, SIGNED, deepen, TILE } from "./palette";
	import { printSprite, printAspect } from "./print/sprites";
	import { field, chart, type Mark, type Path, type Text } from "./field.svelte";
	import F from "./familiarity.json";

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
	const STEPS = F.steps as Step[];
	const LAST = STEPS.length - 1;
	const STEP_VH = 1; // scroll per step, in viewport heights: an ordinary scroll never skips one
	const BINS = F.data.bins.domains as Record<string, Record<string, Bin[]>>;
	const EFF = F.data.effort.models as Record<string, EM>;
	const L = F.labels;
	const DOMS = L.domains as Record<string, string>;
	const MODELS = L.models as Record<string, string>;
	const EMODELS = L.effort_models as string[];
	const GROUPS = L.groups as { bin: string; t: string }[];
	const NOTES = F.notes as Note[];
	const col = (name: string) => MODEL[name] ?? GRAY.strong;
	const OPUS = col(MODELS.Opus);
	const pctLabel = (pct: number, tiles: number) => (pct > 0 && pct < 1 ? L.lt1 : `${tiles}%`);
	const ANSWER = 3; // the demo's answer: its writer's texts go to the last group
	const WRITER = [3, 4, 5]; // the slots the writer's texts take in that group (bottom row, middle)
	const PRINT = 4; // the demo writer's print (its middle text), also the opener's
	const CLARITY = [0.1, 0.4, 0.7, 1]; // legibility of the prints in each familiarity group, least to most familiar
	const est = (t: string) => 30 + t.length * 7.1; // a tag's width, for laying tags side by side
	const OPENER = GROUPS.map((g, i) => ({ family: "writer" as const, index: PRINT, color: INKS.field, clarity: CLARITY[i], label: g.t }));

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
	// the opener's prints arrive once mounted: SectionOpener sizes them for a wide screen on its first render, and on a
	// phone that overflow would widen the page for a moment, just as the field canvas measures it
	let ready = $state(false);
	let stage: HTMLElement;
	let sec: HTMLElement; // the whole section (its footnotes' ↩ links are redirected)
	let root: HTMLElement; // the pinned part (the opener and footnotes sit outside it)

	const view = $derived(STEPS[step].view);
	const explore = $derived(step >= LAST);
	const mode = $derived(explore && xv === "effort" ? "effort" : view);
	const narrow = $derived(W > 0 && W < 760);
	const mcolor = $derived(mode === "effort" ? col(emodel) : col(MODELS[model]));
	const diagOn = $derived(view === "ask" || view === "answer" || view === "sort");
	const answered = $derived(view === "answer" || view === "sort");
	const stairOn = $derived(view === "ask" || view === "answer");
	const bins = $derived(BINS[dom][model]);
	const erows = $derived(EFF[emodel].rows);

	// where everything sits, in stage coordinates; it depends on the size only (never on the step), so the groups keep
	// their place through the whole section
	const geo = $derived.by(() => {
		const g: G[] = [];
		const o = {
			g, cap: { x: 0, y: 0, w: 0 }, za: 0, numY: [] as number[], keyY: 0, numSize: 44, gap: 56,
			q: { x: 0, y: 0, w: 0, h: 0 }, acct: { x: 0, y: 0 }, av: { x: 0, y: 0, r: 28 }, mdl: { x: 0, y: 0 },
			ans: { x: 0, y: [0, 0], w: 150 }, arrows: [] as [number, number, number, number][],
		};
		if (!W || !H) return o;
		if (!narrow) {
			const top = 76, ch = (capH || 74) + 30; // the card's text block plus its padding
			const cw = Math.min(720, W);
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
			// the four groups, large and full width under it
			const below = o.za + 128, num = 50, lab = 40, key = 44, gap = 56;
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
			o.numSize = 22;
			// two rows of two; a number above each group, its name below, the key under the last row
			// (room above the groups for Explore, which opens under the caption once the diagram has gone)
			const below = Math.max(cy + 34, top + ch + 166), num = 30, lab = 36, key = 34, rgap = 4, gap = 16, cw = (W - gap) / 2;
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

	// the drop: from the answer down into the group it names (a soft S, the leader's own curve)
	const dropFrom = $derived<Pt>({ x: geo.ans.x, y: geo.ans.y[1] + 14 });
	function slot(i: number): Pt {
		const g = geo.g[ANSWER];
		return { x: g.x + (i % 10) * g.p + g.p / 2, y: g.y + (9 - Math.floor(i / 10)) * g.p + g.p / 2 };
	}
	function bez(a: Pt, b: Pt, t: number): Pt {
		const my = a.y + (b.y - a.y) * 0.5, u = 1 - t;
		const c1 = { x: a.x, y: my }, c2 = { x: b.x, y: my };
		return {
			x: u * u * u * a.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * b.x,
			y: u * u * u * a.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * b.y,
		};
	}
	const leader = $derived.by(() => {
		if (!geo.g.length || narrow) return "";
		const a = dropFrom, g = geo.g[ANSWER], b = { x: g.cx, y: g.y + 2 }, my = a.y + (b.y - a.y) * 0.5;
		return `M${a.x},${a.y} C${a.x},${my} ${b.x},${my} ${b.x},${b.y}`;
	});

	// labels on the picture (viewport coordinates): the groups' names, the diagram's chips, every colour shown, named
	const tags = $derived.by(() => {
		const t: Tag[] = [];
		if (!active || !owned || !geo.g.length) return t;
		const X = (x: number) => ox + x, Y = (y: number) => oy + y;
		geo.g.forEach((g, i) => t.push({ id: `g${i}`, x: X(g.cx), y: Y(g.y + g.gw), t: mode === "effort" ? erows[i].familiarity : GROUPS[i].t, at: "below" }));
		if (diagOn) {
			t.push({ id: "acct", x: X(geo.acct.x), y: Y(geo.acct.y), t: L.account, icon: "reddit", at: "right" });
			t.push({ id: "mdl", x: X(geo.mdl.x), y: Y(geo.mdl.y), t: MODELS.Opus, color: OPUS, at: narrow ? "right" : "below" });
			if (answered) geo.ans.y.forEach((y, j) => t.push({ id: `ans${j}`, x: X(geo.ans.x), y: Y(y), t: L.answer, color: OPUS, strong: true, at: "center" }));
		}
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
	let lastKey = "", lastStep = -1, t0 = 0, raf = 0, anim: "enter" | "ctrl" | "settle" = "settle";
	let fromLit = [0, 0, 0, 0], curLit = [0, 0, 0, 0];
	const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
	const inout = (x: number) => { const t = Math.min(1, Math.max(0, x)); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };

	function tile(g: G, gi: number, i: number) {
		const m = mk(IDS[gi][i]);
		m.x = ox + g.x + (i % 10) * g.p + g.p / 2;
		m.y = oy + g.y + (9 - Math.floor(i / 10)) * g.p + g.p / 2;
		m.square = true; m.r = g.p * 0.36; m.alpha = 1; m.snap = undefined;
		return m;
	}
	function setWl(p: Pt | null) {
		if (p === null ? wl !== null : !wl || Math.abs(wl.x - p.x) > 0.3 || Math.abs(wl.y - p.y) > 0.3) wl = p;
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
		if (mode === "sort") {
			// this writer's texts drop from the answer along the leader into their group; then every other text fills in
			const k = inout((e - 0.15) / 1.0);
			const end = slot(WRITER[1]);
			const at = bez(dropFrom, end, k);
			G4.forEach((g, gi) => {
				const shown = e >= 1.2 + 0.16 * gi;
				for (let i = 0; i < 100; i++) {
					const writer = gi === ANSWER && WRITER.includes(i);
					if (!writer && !shown) continue;
					const m = tile(g, gi, i);
					m.color = writer ? INK : OFF;
					if (writer) { m.snap = true; m.x = ox + at.x + (i - WRITER[1]) * g.p; m.y = oy + at.y; }
					marks.push(m);
				}
			});
			setWl({ x: at.x, y: at.y - G4[ANSWER].p / 2 - 2 });
			curLit = [0, 0, 0, 0];
			busy = e < 2.2;
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
		} else {
			setWl(null);
			curLit = [0, 0, 0, 0];
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
			m.sprite = printSprite({ family: "writer", index: idx % 48, color: ink, px, clarity });
			m.spriteKey = `f${idx % 48}|${ink}|${px}|${clarity}`;
			m.aspect = ASPECT; m.r = px / 2; m.backing = lit ? TILE.litBacking : TILE.unlitBacking;
		}
		chart.marks = marks;
		chart.paths = paths;
		chart.texts = texts;
		return busy;
	}

	function tick(now: number) {
		raf = 0;
		if (!active || field.owner !== OWNER) return;
		if (render(now)) raf = requestAnimationFrame(tick);
	}
	const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };

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
	// the guided steps always show the paper's default view; the controls take over only once Explore is open
	$effect(() => { if (!explore) { xv = "fam"; dom = "reddit"; model = "Opus"; emodel = "Fable 5.2"; } });
	$effect(() => { void step; sel = null; });

	function place() {
		const r = stage.getBoundingClientRect();
		if (r.left !== ox) ox = r.left;
		if (r.top !== oy) oy = r.top;
	}
	// a dash click scrolls to the middle of that step's stretch of the pinned stage
	// a footnote's ↩: the citing words live in the pinned stage (and only while their step shows), so go to that step
	function back(e: MouseEvent) {
		const a = (e.target as HTMLElement).closest?.("a.back") as HTMLAnchorElement | null;
		const n = a ? Number(a.getAttribute("href")?.match(/^#fnref-s4-(\d+)$/)?.[1]) : NaN;
		const i = STEPS.findIndex((s) => s.fn === n);
		if (i < 0) return;
		e.preventDefault();
		go(i);
	}
	function go(i: number) {
		const top = root.getBoundingClientRect().top + scrollY;
		scrollTo({ top: top + i * innerHeight * STEP_VH, behavior: reduce ? "instant" : "smooth" });
	}

	onMount(() => {
		reduce = matchMedia("(prefers-reduced-motion: reduce)").matches || new URLSearchParams(location.search).has("still");
		ready = true;
		const update = () => {
			const r = root.getBoundingClientRect();
			if (r.bottom < -innerHeight || r.top > innerHeight * 2) return;
			const q = -r.top / (innerHeight * STEP_VH);
			const s = Math.max(0, Math.min(LAST, Math.floor(q + 0.5)));
			if (s !== step) step = s;
		};
		const onScroll = () => {
			update();
			if (!active) return;
			if (active && field.mode === "ground") { field.mode = "chart"; field.owner = OWNER; field.dim = 0.75; field.interactive = false; }
			place();
		};
		update();
		addEventListener("scroll", onScroll, { passive: true });
		sec.addEventListener("click", back);
		addEventListener("resize", onScroll, { passive: true });
		const io = new IntersectionObserver((es) => es.forEach((e) => {
			active = e.isIntersecting;
			if (active) { field.mode = "chart"; field.owner = OWNER; field.dim = 0.75; field.interactive = false; place(); }
			else if (field.mode === "chart" && field.owner === OWNER) { field.mode = "ground"; field.dim = 0; field.interactive = false; chart.marks = []; chart.paths = []; chart.texts = []; }
		}), { rootMargin: "-35% 0px -35% 0px" });
		io.observe(root);
		return () => { cancelAnimationFrame(raf); io.disconnect(); removeEventListener("scroll", onScroll); removeEventListener("resize", onScroll); sec.removeEventListener("click", back); };
	});

	const hitsOn = $derived(mode === "light" || mode === "takeaway" || mode === "effort");
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

<section class="fa" bind:this={sec} id={F.id} data-rq="0" data-step={step}>
	<SectionOpener n={F.n} title={F.title.t} takeaway={F.takeaway.t} context={F.context.t} accent={GRAY.mid} prints={ready ? OPENER : []} />

	<div class="scrolly" class:still={reduce} bind:this={root} style="--steps:{STEPS.length}; --step-vh:{STEP_VH * 100}vh">
		<div class="stick" bind:this={stage} bind:clientWidth={W} bind:clientHeight={H}>
			<!-- the narration: a caption band on top; the dashes jump to a step; Explore opens under it at the end -->
			<div class="cap" class:unsized={!W} style="left:{geo.cap.x}px; top:{geo.cap.y}px; width:{geo.cap.w}px">
				<div bind:clientHeight={capH}>
					<StepDashes count={STEPS.length} current={step} {go} />
					<div class="say" aria-live="polite">
						{#each STEPS as s, i}
							<p class="say-t" class:on={i === step} aria-hidden={i !== step}>{s.t}{#if s.fn}<sup class="fnref"><a href="#fn-s4-{s.fn}" id="fnref-s4-{s.fn}" tabindex={i === step ? 0 : -1}>{s.fn}</a></sup>{/if}</p>
						{/each}
					</div>
				</div>
				<Reveal show={explore} label={L.explore}>
					<div class="row">
						<div class="ctrl" role="group" aria-label={L.view}>
							<button type="button" aria-pressed={xv === "fam"} onclick={() => { xv = "fam"; sel = null; }}><Icon name="familiar" />{L.view_fam}</button>
							<button type="button" aria-pressed={xv === "effort"} onclick={() => { xv = "effort"; sel = null; }}><Icon name="effort" />{L.view_effort}</button>
						</div>
						{#if xv === "fam"}
							<div class="ctrl" role="group" aria-label={L.domain}>
								{#each Object.entries(DOMS) as [id, t]}<button type="button" aria-pressed={dom === id} onclick={() => (dom = id)}>{t}</button>{/each}
							</div>
						{/if}
					</div>
					{#if xv === "fam"}
						<div class="ctrl" role="group" aria-label={L.model}>
							{#each Object.entries(MODELS) as [id, t]}<button type="button" aria-pressed={model === id} onclick={() => (model = id)}><i class="sw" style:background={col(t)}></i>{t}</button>{/each}
						</div>
					{:else}
						<div class="ctrl" role="group" aria-label={L.model}>
							{#each EMODELS as m}<button type="button" aria-pressed={emodel === m} onclick={() => (emodel = m)}><i class="sw" style:background={col(m)}></i>{m}</button>{/each}
						</div>
						<p class="cap-x">{F.explore.effort.t}</p>
					{/if}
				</Reveal>
			</div>

			<!-- the diagram: the question in a few words → the model → its answer (the chips on it are Tags) -->
			<div class="diag" class:on={diagOn && W > 0} aria-hidden={!diagOn}>
				<div class="q" style="left:{geo.q.x}px; top:{geo.q.y}px; width:{geo.q.w}px; height:{geo.q.h}px"><p>“{L.question}”</p></div>
				<span class="av" style="left:{geo.av.x - geo.av.r}px; top:{geo.av.y - geo.av.r}px; width:{geo.av.r * 2}px; height:{geo.av.r * 2}px; color:{OPUS}"><Icon name="anthropic" /></span>
				<svg class="lines" aria-hidden="true">
					{#each geo.arrows as a, i}<path class="arw" class:on={i === 0 || answered} d={arrow(a)} />{/each}
					{#if leader}<path class="leader" class:on={answered} d={leader} />{/if}
				</svg>
			</div>

			<!-- the scale: four rising steps in the groups' places; the answer lights its step -->
			<div class="stairs" class:on={stairOn} aria-hidden="true">
				{#each geo.g as g, i}
					{@const h = (g.gw * (i + 1)) / 4}
					<div class="stair" class:lit={answered && i === ANSWER} style="left:{g.x}px; top:{g.y + g.gw - h}px; width:{g.gw}px; height:{h}px"><b>{i}</b></div>
				{/each}
			</div>

			<!-- hover and keyboard targets over each tile group; the canvas itself is aria-hidden -->
			{#if hitsOn}
				<div class="hits">
					{#each geo.g as g, i}
						<button type="button" class="hit" aria-label={aria(i)}
							style="left:{g.x - 5}px; top:{g.y - 5}px; width:{g.gw + 10}px; height:{g.gw + 10}px"
							onpointerenter={() => (sel = i)} onpointerleave={() => (sel = sel === i ? null : sel)}
							onfocus={() => (sel = i)} onblur={() => (sel = sel === i ? null : sel)}
							onclick={() => (sel = sel === i ? null : i)}></button>
					{/each}
				</div>
			{/if}
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
	.scrolly { position: relative; height: calc(var(--steps) * var(--step-vh) + 100vh); }
	.stick { position: sticky; top: 0; height: 100vh; pointer-events: none; }

	/* the caption band */
	.cap { position: absolute; z-index: 2; pointer-events: auto; padding: 14px 18px 16px; background: #fff; border-radius: 3px; box-shadow: 0 2px 14px rgba(20, 32, 45, .06); display: grid; gap: 10px; }
	.cap.unsized { left: 50% !important; top: 76px !important; width: min(720px, 100%) !important; transform: translateX(-50%); }
	.say { display: grid; margin-top: 4px; }
	.say-t { grid-area: 1 / 1; font-size: 19px; line-height: 1.45; letter-spacing: -0.01em; color: var(--ink); opacity: 0; visibility: hidden; transform: translateY(6px); transition: opacity .4s, transform .45s var(--ease), visibility 0s .4s; }
	.say-t.on { opacity: 1; visibility: visible; transform: none; transition: opacity .4s, transform .45s var(--ease), visibility 0s; }
	.row { display: flex; flex-wrap: wrap; gap: 8px; }
	.ctrl { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 2px; background: var(--chip); border-radius: 3px; padding: 3px; justify-self: start; }
	.ctrl button { display: inline-flex; align-items: center; gap: 6px; padding: 5px 9px; font-size: 12.5px; font-weight: 500; color: var(--ink2); border-radius: 2px; }
	.ctrl button:hover { color: var(--ink); }
	.ctrl button[aria-pressed="true"] { background: var(--ink); color: var(--field); }
	.sw { flex: none; display: inline-block; width: 9px; height: 9px; border-radius: 1px; }
	.ctrl button[aria-pressed="true"] .sw { box-shadow: 0 0 0 1.5px var(--field); }
	.cap-x { font-size: 13px; line-height: 1.45; color: var(--ink2); }

	/* the diagram */
	.diag { position: absolute; inset: 0; opacity: 0; transition: opacity .45s; }
	.diag.on { opacity: 1; }
	.q { position: absolute; display: flex; align-items: flex-start; padding: 14px 18px; background: #fff; border-radius: 3px; box-shadow: 0 2px 14px rgba(20, 32, 45, .06); }
	.q p { font-size: 20px; line-height: 1.3; font-weight: 600; letter-spacing: -0.015em; color: var(--ink); }
	.av { position: absolute; display: grid; place-items: center; border-radius: 50%; background: #fff; box-shadow: 0 2px 14px rgba(20, 32, 45, .1); font-size: 26px; }
	.lines { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
	.lines path { fill: none; stroke: var(--ink2); stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
	.lines .arw { opacity: 0; transition: opacity .4s; }
	.lines .arw.on { opacity: 1; }
	.lines .leader { stroke: var(--ink); stroke-dasharray: 3 5; opacity: 0; transition: opacity .4s; }
	.lines .leader.on { opacity: .7; }

	/* the scale's four steps */
	.stairs { position: absolute; inset: 0; opacity: 0; transition: opacity .6s; }
	.stairs.on { opacity: 1; }
	.stair { position: absolute; border-radius: 2px; background: #C9C9C9; transition: background-color .4s; }
	.stair b { position: absolute; left: 12px; top: 6px; font-size: 34px; line-height: 1.1; font-weight: 600; letter-spacing: -0.03em; color: var(--ink); transition: color .4s; }
	.stair.lit { background: var(--ink); }
	.stair.lit b { color: #fff; }

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
		.stair b { left: 8px; top: 4px; font-size: 24px; }
	}
	.still .say-t, .still .diag, .still .stairs, .still .stair, .still .stair b, .still .lines path { transition: none; }
	@media (prefers-reduced-motion: reduce) { .say-t, .diag, .stairs, .stair, .stair b, .lines path { transition: none; } }
</style>
