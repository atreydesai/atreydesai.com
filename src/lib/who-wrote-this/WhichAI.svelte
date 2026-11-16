<script lang="ts">
	// If AI, which AI? (second rework, after the section 1 composition mock). Three blocks, top to bottom:
	//   1. the chapter opener (SectionOpener): dark, full bleed, the question, the takeaway, three lab prints;
	//   2. a wall: every text Claude Fable 5.2 judged is a tile, one pile per writing model, grouped by lab, the full
	//      width of the page; the narration is a caption band above it, the colour key one row under "1 tile = 1 text";
	//   3. a release timeline of the labs the distillation reports name, one guided step per report: its line and the
	//      labs it names light, the rest dims, and a callout card on the line gives the report's name, date, a short
	//      excerpt, its link and the paper's sentence.
	// Tiles never move while the page scrolls: each picture's layout is built in its own stage coordinates from the
	// viewport size and fonts only (never from the step), every tile snaps to its place (only alpha eases), and the
	// two pictures use separate mark ids, so no tile ever flies from one to the other. Steps change colour and alpha.
	import { onMount, untrack } from "svelte";
	import Icon from "./Icon.svelte";
	import Tags, { type Tag } from "./Tags.svelte";
	import SectionOpener from "./SectionOpener.svelte";
	import StepDashes from "./StepDashes.svelte";
	import Footnotes from "./Footnotes.svelte";
	import { field, chart, type Mark, type Path } from "./field.svelte";
	import { LAB, GRAY, INK, deepen, TILE } from "./palette";
	import S from "./which_ai.json";
	import { printSprite, printAspect } from "./print/sprites";
	import R from "./rq2_writers.json";

	type W = (typeof R.writers)[number];
	type K = "anthropic" | "openai" | "other" | "own";
	type Rect = { x: number; y: number; w: number; h: number };
	type Label = { id: string; x: number; y: number; lines: string[]; kind: "head" | "name" | "tick"; align: "left" | "center" | "right"; w?: string; lab?: string };
	type Pile = { w: W; left: number; bottom: number; c: number; s: number };
	type Ev = (typeof EVS)[number];
	type Lane = { side: "left" | "right"; level: number; short: boolean; hidden?: boolean };
	type WallGeo = { piles: Pile[]; labels: Label[]; tips: Record<string, { x: number; y: number }> };
	type TimeGeo = WallGeo & { base: Path[]; xs: number[]; lanes: Lane[]; laneTop: number; laneLv: number; bot: number; rows: Record<string, [number, number]> };
	type View = { kind: "intro" } | { kind: "event"; i: number };

	// every displayed string that is not paper text is listed in which_ai.json's ui
	const u = (t: string) => (S.ui.includes(t) ? t : (console.warn("which_ai: ui string not listed:", t), t));
	const ORDER = ["Anthropic", "Google", "OpenAI", "Moonshot", "Zhipu", "Alibaba", "MiniMax", "xAI", "DeepSeek", "Mistral", "Cohere"];
	const ROWS_WIDE = [["Anthropic", "Google", "OpenAI"], ["Moonshot", "Zhipu", "Alibaba"], ["MiniMax", "xAI", "DeepSeek", "Mistral", "Cohere"]];
	const ROWS_NARROW = [["Anthropic", "Google", "OpenAI"], ["Moonshot", "Zhipu"], ["Alibaba", "MiniMax"], ["xAI", "DeepSeek", "Mistral", "Cohere"]];
	const STACK: K[] = ["anthropic", "openai", "other", "own"];
	// which lab Fable named: the lab colours (palette.ts LAB); the data has no Google answers for other labs' texts
	const COL: Record<K, string> = { anthropic: LAB.Anthropic, openai: LAB.OpenAI, other: LAB.other, own: LAB.own };
	const NAME = Object.fromEntries(S.legend.map((l) => [l.k, l.t])) as Record<K, string>;
	const UNLIT = GRAY.strong;
	const STEPS = S.steps as { part: string; color?: boolean; focus?: string[]; event?: string; t: string }[];
	const NW = STEPS.filter((s) => s.part === "wall").length, NT = STEPS.length - NW, LAST = STEPS.length - 1;
	const STEP_VH = 0.9; // scroll per guided step, in viewport heights
	const SAY = STEPS.map((x) => x.t.replace(/-(?=\d)/g, "‑"));
	const MAXN = Math.max(...R.writers.map((w) => w.n));
	const byLab = Object.fromEntries(ORDER.map((lab) => [lab, R.writers.filter((w) => w.lab === lab).sort((a, b) => (a.release ?? "").localeCompare(b.release ?? ""))])) as Record<string, W[]>;
	// a model's name as the writer table gives it, without the snapshot date in brackets ("Kimi K2 (0905)" -> "Kimi K2")
	const nameOf = (w: W) => w.writer.replace(/\s*\(\d{4}\)$/, "");
	// on a phone's timeline the row names the lab: the version alone, as in the paper's figure ("Qwen3.8 27B" -> "3.8")
	const verOf = (w: W) => nameOf(w).replace(/^(Kimi |GLM-|Qwen|MiniMax |DeepSeek )/, "").replace(/ \d+B$/, "").trim();
	const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
	const day = (d: string) => { const [y, m, dd] = d.split("-").map(Number); return Date.UTC(y, m - 1, dd ?? 1); };
	const monthYear = (d: string) => new Date(day(d)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
	const dateLabel = (d: string) => { const [y, m, dd] = d.split("-").map(Number); return `${dd ? dd + " " : ""}${MON[m - 1]} ${y}`; };
	const F = (wt: number, px: number) => `${wt} ${px}px Inter, system-ui, sans-serif`;
	const TAG_F = F(600, 12.5);
	const hit = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
	const grow = (r: Rect, d: number) => ({ x: r.x - d, y: r.y - d, w: r.w + 2 * d, h: r.h + 2 * d });
	// a dimmed tile: its colour mostly washed into the ground, drawn opaque so a dimmed pile still answers the pointer
	const wash = (hex: string, t = 0.2) => { const a = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)), g = [1, 3, 5].map((i) => parseInt(INK.ground.slice(i, i + 2), 16)); return "#" + a.map((v, i) => Math.round(g[i] + (v - g[i]) * t).toString(16).padStart(2, "0")).join(""); };
	const rgba = (hex: string, a: number) => `rgba(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(",")},${a})`;

	// the reports, in date order: the date and named labs from rq2_writers.json, the card's words from which_ai.json
	const SRC = Object.fromEntries(S.sources.map((s) => [s.id, s])) as Record<string, (typeof S.sources)[number] & { cut?: boolean }>;
	const EVS = S.reports.map((r) => {
		const e = R.events.find((x) => x.name === r.event)!;
		const step = STEPS.findIndex((s) => s.event === r.event);
		return { ...r, date: e.date, labs: e.labs, col: r.by === "anthropic" ? LAB.Anthropic : LAB.OpenAI, dash: r.by === "openai", src: SRC[r.source], step, focus: STEPS[step]?.focus ?? [], chip: (r as { chip?: string }).chip ?? r.label };
	});
	// the timeline's rows: the labs the reports name, in the paper figure's order (ty_rq2_distill_timeline.pdf)
	const NAMED = new Set(R.events.flatMap((e) => e.labs));
	const TIME_LABS = ["Moonshot", "Zhipu", "Alibaba", "DeepSeek", "MiniMax", "xAI"].filter((l) => NAMED.has(l));
	const T0 = Date.UTC(2025, 5, 15), T1 = Date.UTC(2026, 10, 30);
	const evT = (d: string) => { const a = day(d); if (d.length > 7) return a; const b = new Date(a); return (a + Date.UTC(b.getUTCFullYear(), b.getUTCMonth() + 1, 1)) / 2; };
	// the hero's three big-lab prints for the opener, in their light steps so they read on the dark band
	const PRINTS = [
		{ family: "lab" as const, index: 0, color: "#DC89A7", label: u("Anthropic"), icon: "anthropic" },
		{ family: "lab" as const, index: 1, color: "#8CB5C0", label: u("OpenAI"), icon: "openai" },
		{ family: "lab" as const, index: 2, color: "#9A82B4", label: u("Google"), icon: "google" },
	];

	// text widths for layout, measured once per string and font
	const widths = new Map<string, number>();
	let mctx: CanvasRenderingContext2D | null = null;
	function tw(t: string, font: string) {
		const key = font + "|" + t;
		let v = widths.get(key);
		if (v === undefined) {
			mctx ??= document.createElement("canvas").getContext("2d")!;
			mctx.font = font;
			v = mctx.measureText(t).width;
			widths.set(key, v);
		}
		return v;
	}
	// one line if it fits, else the two-line split with the narrower longest line
	function wrap(t: string, font: string, room: number): string[] {
		if (tw(t, font) <= room) return [t];
		const p = t.split(" ");
		let best = [t], bw = Infinity;
		for (let i = 1; i < p.length; i++) {
			const a = p.slice(0, i).join(" "), b = p.slice(i).join(" "), w = Math.max(tw(a, font), tw(b, font));
			if (w < bw) { bw = w; best = [a, b]; }
		}
		return best;
	}
	const linesW = (ls: string[], font: string) => Math.max(...ls.map((l) => tw(l, font)));
	// a Tags chip's width: padding, swatch, gap and words
	const tagW = (t: string, line = false) => 16 + (line ? 16 : 10) + 6 + tw(t, TAG_F);

	// each tile is a small fingerprint (the hero's own patterns) where it is large enough to read (14 px and up):
	// before colour, the text's true lab's print in gray; with colour, the print of the lab Claude Fable 5.2 named
	const HERO_LABS = ["Anthropic", "OpenAI", "Google", "Alibaba", "DeepSeek", "Moonshot", "Zhipu", "MiniMax", "Mistral", "xAI", "Cohere"];
	const ASPECT = printAspect();
	function tileSprite(w: W, k: K, color: boolean, px: number) {
		const lab = !color || k === "own" ? w.lab : k === "anthropic" ? "Anthropic" : k === "openai" ? "OpenAI" : null;
		const ink = color ? deepen(COL[k], TILE.inkDepth) : UNLIT;
		const sprite = lab ? printSprite({ family: "lab", index: Math.max(0, HERO_LABS.indexOf(lab)), color: ink, px }) : printSprite({ family: "main", color: ink, px });
		return { sprite, spriteKey: `${lab ?? "other"}|${ink}|${px}` };
	}
	// a pile's tiles, bottom-up in the paper figure's order; `snap`: a tile sits exactly at its place, only alpha eases
	function tiles(marks: Mark[], ns: "w" | "t", p: Pile, color: boolean, dim = false) {
		let i = 0;
		const px = Math.max(6, Math.round(p.s * 0.94)), print = px >= 14 && !dim;
		for (const k of STACK) for (let j = 0; j < p.w[k]; j++, i++)
			marks.push({
				id: `${ns}:${p.w.writer}#${i}`, group: `${ns}|${p.w.writer}`, square: true, snap: true,
				...(print ? { ...tileSprite(p.w, k, color, px), aspect: ASPECT, backing: color ? TILE.litBacking : TILE.unlitBacking } : {}),
				x: p.left + (i % p.c) * p.s + p.s / 2, y: p.bottom - Math.floor(i / p.c) * p.s - p.s / 2, r: print ? px / 2 : p.s * 0.42,
				color: dim ? wash(color ? COL[k] : UNLIT) : color ? COL[k] : UNLIT, alpha: color || dim ? 1 : 0.62,
			});
	}
	const pileRect = (p: Pile): Rect => { const h = Math.ceil(p.w.n / p.c) * p.s; return { x: p.left, y: p.bottom - h, w: p.c * p.s, h }; };

	// ---- 1. the wall: piles grouped by lab, rows of labs, the largest tiles that fit ---------------------------------
	function wallLayout(box: Rect, narrow: boolean): WallGeo {
		const rows = narrow ? ROWS_NARROW : ROWS_WIDE;
		const hf = F(600, narrow ? 11 : 12.5), nf = F(500, narrow ? 9.5 : 10.5);
		const g = narrow ? 3 : 8, G0 = narrow ? 12 : 24;
		const headH = narrow ? 22 : 30, nameH = narrow ? 0 : 31, rowGap = narrow ? 8 : 16;
		// a lab's names wrap together: if one needs two lines, all of them take two
		const label = (w: W, room: number) => wrap(nameOf(w), nf, byLab[w.lab].some((v) => tw(nameOf(v), nf) > room) ? 0 : room);
		const inner = (w: W, c: number, s: number) => (narrow ? c * s : Math.max(c * s, linesW(label(w, c * s + g - 6), nf) + 6 - g));
		const rowW = (row: string[], c: number, s: number, G = G0) =>
			row.reduce((t, lab, i) => {
				const ws = byLab[lab];
				return t + (i ? G : 0) + Math.max(ws.reduce((a, w) => a + inner(w, c, s), 0) + (ws.length - 1) * g, tw(lab, hf));
			}, 0);
		const height = (c: number, s: number) => rows.length * (headH + Math.ceil(MAXN / c) * s + nameH) + (rows.length - 1) * rowGap;
		let c = 5, s = 2;
		for (const cc of [3, 4, 5, 6])
			for (let ss = 18; ss > s; ss -= 0.25)
				if (height(cc, ss) <= box.h && rows.every((r) => rowW(r, cc, ss) <= box.w)) { c = cc; s = ss; break; }
		const pileH = Math.ceil(MAXN / c) * s;
		// width the tiles leave over goes between the labs, so the groups read apart
		const G = Math.min(narrow ? 22 : 56, G0 + Math.min(...rows.map((r) => (r.length > 1 ? (box.w - rowW(r, c, s)) / (r.length - 1) : Infinity))));
		const piles: Pile[] = [], labels: Label[] = [], tips: WallGeo["tips"] = {};
		let y = box.y + Math.max(0, Math.min(40, (box.h - height(c, s)) / 2));
		for (const row of rows) {
			const head = y + headH / 2, bottom = y + headH + pileH;
			// each row is centred in the width
			let x = box.x + Math.max(0, (box.w - rowW(row, c, s, G)) / 2);
			for (const lab of row) {
				const gx = x;
				labels.push({ id: `h-${lab}`, x: gx, y: head - (narrow ? 7 : 8), lines: [lab], kind: "head", align: "left", lab });
				for (const w of byLab[lab]) {
					const iw = inner(w, c, s), p: Pile = { w, left: x + (iw - c * s) / 2, bottom, c, s };
					piles.push(p);
					const pr = pileRect(p);
					tips[w.writer] = { x: pr.x + pr.w, y: pr.y };
					if (!narrow) labels.push({ id: `n-${w.writer}`, x: p.left + (c * s) / 2, y: bottom + 5, lines: label(w, c * s + g - 6), kind: "name", align: "center", w: w.writer });
					x += iw + g;
				}
				x = Math.max(x - g, gx + tw(lab, hf)) + G;
			}
			y = bottom + nameH + rowGap;
		}
		return { piles, labels, tips };
	}

	// ---- 2. the timeline ----------------------------------------------------------------------------------------------
	// the date scale depends on the width only, so the cards can sit on their lines before the rest is laid out
	function timeScale(w: number, narrow: boolean) {
		const hf = F(600, narrow ? 11 : 12.5);
		const lx = Math.max(...TIME_LABS.map((l) => tw(l, hf))) + (narrow ? 8 : 18), rx = w - 6;
		return { lx, rx, X: (t: number) => lx + ((t - T0) / (T1 - T0)) * (rx - lx) };
	}
	// each report's name sits beside the top of its line, with no other report's line between them or across it and
	// never over another name; the fewest names left out wins (only where two reports are days apart on a phone), then
	// the fewest levels, full names over short ones, and the side away from the nearest neighbour
	function placeLanes(xs: number[], w: number, narrow: boolean): { lanes: Lane[]; levels: number } {
		const opts: Lane[] = [];
		for (const short of [false, true]) for (const level of [0, 1, 2]) for (const side of ["right", "left"] as const) opts.push({ side, level, short });
		opts.push({ side: "right", level: 0, short: true, hidden: true });
		const ws = EVS.map((e) => [tagW(e.chip, true), tagW(e.short, true)]);
		const rectOf = (i: number, o: Lane): Rect => { const lw = ws[i][o.short ? 1 : 0]; return { x: o.side === "right" ? xs[i] + 10 : xs[i] - 10 - lw, y: o.level * 26, w: lw, h: 24 }; };
		const pref = xs.map((x, i) => { const l = i > 0 ? x - xs[i - 1] : Infinity, r = i < xs.length - 1 ? xs[i + 1] - x : Infinity; return r < l ? "left" : "right"; });
		const best: { score: number[] | null; lanes: Lane[] } = { score: null, lanes: [] };
		const pick: Lane[] = [], rects: Rect[] = [];
		const better = (a: number[], b: number[]) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i]; return false; };
		(function rec(i: number) {
			if (i === xs.length) {
				const shown = pick.filter((o) => !o.hidden);
				const score = [pick.length - shown.length, Math.max(0, ...shown.map((o) => o.level)), shown.filter((o) => o.short).length * (narrow ? 0 : 1), shown.filter((o) => o.side !== pref[pick.indexOf(o)]).length, shown.reduce((a, o) => a + o.level, 0), shown.filter((o) => o.short).length];
				if (!best.score || better(score, best.score)) { best.score = score; best.lanes = pick.map((o) => ({ ...o })); }
				return;
			}
			for (const o of opts) {
				if (o.hidden) { pick.push(o); rec(i + 1); pick.pop(); continue; }
				const r = rectOf(i, o);
				if (r.x < 0 || r.x + r.w > w) continue;
				if (rects.some((q) => hit(grow(r, 3), q))) continue;
				// no other report's line across the name or between it and its own line (lines run the lane's full height)
				const lo = o.side === "right" ? xs[i] : r.x - 4, hi = o.side === "right" ? r.x + r.w + 4 : xs[i];
				if (xs.some((x, j) => j !== i && x >= lo && x <= hi)) continue;
				pick.push(o); rects.push(r);
				rec(i + 1);
				pick.pop(); rects.pop();
			}
		})(0);
		const lanes: Lane[] = best.score ? best.lanes : xs.map(() => ({ side: "right", level: 0, short: true }));
		return { lanes, levels: Math.max(0, ...lanes.filter((l) => !l.hidden).map((l) => l.level)) + 1 };
	}
	function timeLayout(box: Rect, narrow: boolean): TimeGeo {
		const hf = F(600, narrow ? 11 : 12.5), nf = F(500, narrow ? 9.5 : 11), tf = F(400, narrow ? 10.5 : 11.5);
		const axisH = narrow ? 26 : 30, nameH = narrow ? 13 : 16;
		const { lx, rx, X } = timeScale(box.w, narrow);
		const xs = EVS.map((e) => X(evT(e.date)));
		const { lanes, levels } = placeLanes(xs, box.w, narrow);
		const laneTop = box.y, top = laneTop + levels * 26 + 4, bot = box.y + box.h - axisH, rh = (bot - top) / TIME_LABS.length;
		const base: Path[] = [], labels: Label[] = [], piles: Pile[] = [], tips: WallGeo["tips"] = {}, rows: TimeGeo["rows"] = {};
		// tiles as large as the rows allow, in piles narrow enough to sit near their dates
		const maxPH = rh - nameH - 6;
		let c = 6, s = 2;
		for (const cc of [5, 6, 7, 8, 9]) {
			const ss = Math.min(narrow ? 6 : 11, maxPH / Math.ceil(MAXN / cc));
			if (cc * ss <= (narrow ? 32 : 64) && ss > s + 0.05) { c = cc; s = ss; }
		}
		const obst: Rect[] = [];
		TIME_LABS.forEach((lab, ri) => {
			const rt = top + ri * rh, bottom = rt + rh - 3;
			rows[lab] = [rt, rt + rh];
			if (ri % 2 === 0) base.push({ pts: [[0, rt + rh / 2], [rx, rt + rh / 2]], color: "rgba(20,32,45,.035)", width: rh, progress: 1 });
			labels.push({ id: `h-${lab}`, x: 2, y: rt + rh / 2 - 8, lines: [lab], kind: "head", align: "left", lab });
			base.push({ pts: [[lx, bottom + 0.5], [rx, bottom + 0.5]], color: "rgba(20,32,45,.16)", width: 1, progress: 1 });
			// releases too close to stand side by side are pushed apart; a tick on the baseline keeps the true date
			const items = byLab[lab].filter((w) => w.release && day(w.release) >= T0).map((w) => {
				const name = narrow ? verOf(w) : nameOf(w), tx = X(day(w.release!));
				return { w, name, tx, x: tx, half: Math.max(c * s, tw(name, nf) + 10) / 2 };
			});
			for (let it = 0; it < 40; it++) {
				let moved = false;
				for (let i = 1; i < items.length; i++) {
					const a = items[i - 1], b = items[i], d = a.half + b.half - (b.x - a.x);
					if (d > 0.5) { a.x -= d / 2; b.x += d / 2; moved = true; }
				}
				if (items.length) {
					items[0].x = Math.max(items[0].x, lx + Math.max((c * s) / 2, items[0].half - 4));
					const z = items[items.length - 1];
					z.x = Math.min(z.x, rx - Math.max((c * s) / 2, z.half - 4));
				}
				if (!moved) break;
			}
			for (const it of items) {
				const p: Pile = { w: it.w, left: it.x - (c * s) / 2, bottom, c, s };
				piles.push(p);
				const pr = pileRect(p);
				obst.push(pr);
				tips[it.w.writer] = { x: pr.x + pr.w, y: pr.y };
				base.push({ pts: [[it.tx, bottom + 1], [it.tx, bottom + 5]], color: "rgba(20,32,45,.5)", width: 1.25, progress: 1 });
				if (Math.abs(it.x - it.tx) > 1.5) base.push({ pts: [[it.x, bottom + 1], [it.tx, bottom + 5]], color: "rgba(20,32,45,.28)", width: 1, progress: 1 });
				labels.push({ id: `n-${it.w.writer}`, x: it.x, y: pr.y - nameH + 1, lines: [it.name], kind: "name", align: "center", w: it.w.writer });
			}
		});
		// the date axis: a tick every three months (six on a phone)
		const stepM = (rx - lx) / 17 < 26 ? 6 : 3;
		base.push({ pts: [[lx, bot + 2], [rx, bot + 2]], color: "rgba(20,32,45,.45)", width: 1, progress: 1 });
		for (let k = 0; ; k += stepM) {
			const t = Date.UTC(2025, 6 + k, 1);
			if (t > T1) break;
			const d = new Date(t), x = X(t);
			base.push({ pts: [[x, bot + 2], [x, bot + 7]], color: "rgba(20,32,45,.45)", width: 1, progress: 1 });
			labels.push({ id: `t-${k}`, x, y: bot + 9, lines: [`${MON[d.getUTCMonth()]} ’${String(d.getUTCFullYear()).slice(2)}`], kind: "tick", align: "center" });
		}
		// the axis name, in the labs' column when it clears the first month
		if (2 + tw(S.x_label, tf) + 6 < X(Date.UTC(2025, 6, 1)) - tw("Jul ’25", tf) / 2)
			labels.push({ id: "t-axis", x: 2, y: bot + 9, lines: [u(S.x_label)], kind: "tick", align: "left" });
		return { piles, labels, tips, base, xs, lanes, laneTop, laneLv: levels, bot, rows };
	}

	// ---- state -----------------------------------------------------------------------------------------------------
	let step = $state(0);
	let active = $state(false);
	let still = $state(false);
	let narrow = $state(false);
	let size = $state({ w: 0, h: 0 });
	let fontsV = $state(0);
	// where each picture starts and ends inside its frame (measured; they change with the width and fonts, never the step)
	let offs = $state({ wTop: 0, cBot: 0, fw: 0 });
	let fh = $state(800); // a frame's height, to keep the details on screen
	let wallG = $state.raw<WallGeo | null>(null);
	let timeG = $state.raw<TimeGeo | null>(null);
	let keyTags = $state.raw<{ items: Tag[]; h: number }>({ items: [], h: 26 });
	let root: HTMLElement, body: HTMLElement;
	let wallBlk: HTMLElement, timeBlk: HTMLElement, wallFrame: HTMLElement, timeFrame: HTMLElement;
	let wKey: HTMLElement, cardsEl: HTMLElement;

	const wallStep = $derived(Math.min(step, NW - 1));
	const wallSt = $derived(STEPS[wallStep]);
	const wallFocus = $derived(new Set(wallSt.focus ?? []));
	const view = $derived.by((): View => {
		const ev = STEPS[Math.max(step, NW)].event;
		return ev ? { kind: "event", i: EVS.findIndex((e) => e.event === ev) } : { kind: "intro" };
	});
	const curEv = $derived(view.kind === "event" ? EVS[view.i] : null);
	const timeFocus = $derived(new Set(curEv?.focus ?? []));
	// a report's line: the current one, and the earlier ones faint, but only where their name fits beside them (a
	// phone has no room between reports days apart)
	const lineOn = (i: number) => view.kind === "event" && (view.i === i || (i < view.i && !timeG?.lanes[i]?.hidden));
	const rowOn = (lab: string) => !curEv || curEv.labs.includes(lab);

	const shown = $derived(active && field.owner === "rq2");
	const hovered = $derived.by(() => {
		if (!field.hover || field.owner !== "rq2") return null;
		const [ns, name] = field.hover.split("|");
		const w = R.writers.find((x) => x.writer === name);
		return w && (ns === "w" || ns === "t") ? { ns, w } : null;
	});
	const tipAt = $derived(hovered ? (hovered.ns === "w" ? wallG : timeG)?.tips[hovered.w.writer] ?? null : null);
	// what Fable named for this model's texts, largest share first; the model's own lab by its name
	const tipRows = $derived(hovered ? STACK.filter((k) => hovered.w[k] > 0).map((k) => ({ k, t: k === "own" ? `${hovered.w.lab} (own lab)` : k === "other" ? u("Another lab") : NAME[k], pct: Math.round((hovered.w[k] / hovered.w.n) * 100) })).sort((a, b) => b.pct - a.pct) : []);

	// the colour key: one row of Tags chips at the top of each picture (a phone shortens "Writer's own lab")
	function layoutKey(fw: number) {
		const items: Tag[] = [];
		let x = 0, row = 0;
		(["anthropic", "openai", "own", "other"] as K[]).forEach((k) => {
			const t = k === "own" && narrow ? u("Own lab") : NAME[k], w = tagW(t);
			if (x > 0 && x + w > fw) { x = 0; row++; }
			items.push({ id: `k-${k}`, x: x - 10, y: row * 30 + 13, t, color: COL[k], swatch: "square", at: "right" });
			x += w + 6;
		});
		keyTags = { items, h: (row + 1) * 30 - 4 };
	}

	// ---- build: geometry when the size or fonts change; marks when the step changes ----------------------------------
	function layout() {
		if (!wallFrame || !size.w) return;
		narrow = innerWidth <= 860;
		const fw = wallFrame.clientWidth, wh = wallFrame.clientHeight;
		layoutKey(fw);
		wallG = wallLayout({ x: 0, y: offs.wTop + 6, w: fw, h: wh - offs.wTop - 6 }, narrow);
		timeG = timeLayout({ x: 0, y: offs.cBot, w: fw, h: wh - offs.cBot }, narrow);
	}

	// the built marks and paths in frame coordinates, and their viewport copies handed to the canvas
	let wM: Mark[] = [], tM: Mark[] = [], tP: Path[] = [];
	let wV: Mark[] = [], tV: Mark[] = [], tVP: Path[] = [];
	let sent: Mark[] = [];
	let last = { wl: NaN, wt: NaN, tl: NaN, tt: NaN, inW: false, inT: false };

	function dress() {
		if (!wallG || !timeG) return;
		// the wall: grey before colour; with colour, each tile takes the lab Fable named; a focus washes out the rest
		const st = wallSt, focus = wallFocus;
		wM = [];
		for (const p of wallG.piles) tiles(wM, "w", p, !!st.color, focus.size > 0 && !focus.has(p.w.writer));
		// the timeline: the rows a report names stay lit, the rest washes out
		tM = [];
		for (const p of timeG.piles) tiles(tM, "t", p, true, !rowOn(p.w.lab));
		// the reports: one weight for every line; the current one full strength, the earlier ones faint; Anthropic's
		// solid rose, OpenAI's (and the testimony about OpenAI models) dashed teal
		tP = [...timeG.base];
		EVS.forEach((e, i) => {
			if (!lineOn(i)) return;
			const cur = view.kind === "event" && view.i === i, x = timeG!.xs[i];
			tP.push({ pts: [[x, timeG!.laneTop], [x, timeG!.bot + 2]], color: rgba(e.col, cur ? 1 : 0.42), width: 1.5, dash: e.dash ? [5, 4] : undefined, progress: 1 });
		});
		wV = wM.map((m) => ({ ...m }));
		tV = tM.map((m) => ({ ...m }));
		tVP = tP.map((q) => ({ ...q, pts: q.pts.map(([x, y]) => [x, y] as [number, number]) }));
		push(true);
	}

	// hand the marks to the canvas in viewport coordinates: each picture shifted by its frame's place on screen, so a
	// stage moving as a whole moves its tiles and lines together, exactly
	function push(force = false) {
		if (!active || field.owner !== "rq2" || !wallFrame) return;
		const rw = wallFrame.getBoundingClientRect(), rt = timeFrame.getBoundingClientRect(), H = innerHeight;
		const inW = rw.bottom > -H * 0.6 && rw.top < H * 1.6, inT = rt.bottom > -H * 0.6 && rt.top < H * 1.6;
		const same = rw.left === last.wl && rw.top === last.wt && rt.left === last.tl && rt.top === last.tt && inW === last.inW && inT === last.inT;
		if (!force && same && chart.marks === sent) return;
		if (inW) for (let i = 0; i < wM.length; i++) { wV[i].x = wM[i].x + rw.left; wV[i].y = wM[i].y + rw.top; }
		if (inT) {
			for (let i = 0; i < tM.length; i++) { tV[i].x = tM[i].x + rt.left; tV[i].y = tM[i].y + rt.top; }
			for (let i = 0; i < tP.length; i++) for (let j = 0; j < tP[i].pts.length; j++) { tVP[i].pts[j][0] = tP[i].pts[j][0] + rt.left; tVP[i].pts[j][1] = tP[i].pts[j][1] + rt.top; }
		}
		if (force || inW !== last.inW || inT !== last.inT || chart.marks !== sent) sent = [...(inW ? wV : []), ...(inT ? tV : [])];
		last = { wl: rw.left, wt: rw.top, tl: rt.left, tt: rt.top, inW, inT };
		chart.marks = sent;
		chart.paths = inT ? tVP : [];
		if (chart.texts.length) chart.texts = [];
	}

	function sync() {
		// retake the canvas if a neighbour left it on the plain ground while this section is in view
		if (active && field.mode === "ground") { field.mode = "chart"; field.owner = "rq2"; field.dim = 0.75; field.interactive = true; }
		if (active && field.owner === "rq2") push();
	}

	// the step from the scroll position: the wall's steps while it is pinned, the timeline's once it is half up
	function readStep() {
		if (!wallBlk) return;
		const H = innerHeight, D = H * STEP_VH;
		const rw = wallBlk.getBoundingClientRect(), rt = timeBlk.getBoundingClientRect();
		const s = rt.top < H * 0.5 ? NW + Math.max(0, Math.min(NT - 1, Math.floor(-rt.top / D))) : Math.max(0, Math.min(NW - 1, Math.floor(-rw.top / D)));
		if (s !== step) step = s;
	}
	// a dash scrolls to the middle of its step
	function go(i: number, instant = false) {
		const D = innerHeight * STEP_VH, blk = i < NW ? wallBlk : timeBlk, k = i < NW ? i : i - NW;
		scrollTo({ top: blk.getBoundingClientRect().top + scrollY + (k + 0.5) * D, behavior: instant || still ? "instant" : "smooth" });
	}

	function measure() {
		if (!wallFrame) return;
		const next = { wTop: wKey.offsetTop + wKey.offsetHeight, cBot: cardsEl.offsetTop + cardsEl.offsetHeight, fw: wallFrame.clientWidth };
		fh = wallFrame.clientHeight;
		if (Object.keys(next).some((k) => Math.abs(next[k as keyof typeof next] - offs[k as keyof typeof offs]) > 0.5)) offs = next;
	}

	$effect(() => {
		void [size.w, size.h, fontsV, offs.wTop, offs.cBot, offs.fw];
		untrack(layout);
	});
	$effect(() => {
		void [wallG, timeG, wallSt, view, active];
		untrack(dress);
	});
	$effect(() => {
		void [field.mode, field.owner, active];
		untrack(sync);
	});

	onMount(() => {
		still = matchMedia("(prefers-reduced-motion: reduce)").matches || new URLSearchParams(location.search).has("still");
		const onResize = () => { size = { w: innerWidth, h: innerHeight }; measure(); readStep(); };
		onResize();
		const onScroll = () => { readStep(); sync(); };
		addEventListener("resize", onResize, { passive: true });
		addEventListener("scroll", onScroll, { passive: true });
		const ro = new ResizeObserver(measure);
		[wallFrame, wKey, cardsEl].forEach((el) => ro.observe(el));
		document.fonts?.ready.then(() => { widths.clear(); fontsV++; measure(); });
		// the canvas is this section's while any of its pictures is on screen, so tiles never fade out where they stood
		const io = new IntersectionObserver((es) => es.forEach((e) => {
			active = e.isIntersecting;
			if (active) { field.mode = "chart"; field.owner = "rq2"; field.dim = 0.75; field.interactive = true; }
			else if (field.mode === "chart" && field.owner === "rq2") { field.mode = "ground"; field.dim = 0; field.interactive = false; chart.marks = []; chart.paths = []; chart.texts = []; }
		}), { rootMargin: "0px" });
		io.observe(body);
		const onGo = (e: Event) => go((e as CustomEvent<{ i: number; instant?: boolean }>).detail.i, (e as CustomEvent<{ i: number; instant?: boolean }>).detail.instant);
		root.addEventListener("wa-go", onGo);
		// a footnote's back link returns to the step whose card cites it (the cards share one place in the pinned stage)
		const onBack = (e: MouseEvent) => {
			const a = (e.target as Element).closest?.('a[href^="#fnref-wa-"]');
			if (!a) return;
			const ev = EVS.find((x) => `#fnref-wa-${x.note}` === a.getAttribute("href"));
			if (ev) { e.preventDefault(); go(ev.step); }
		};
		document.addEventListener("click", onBack);
		readStep();
		// dev only: the built layout's bounds, for checking that a step never moves a tile
		if (import.meta.env.DEV) (window as unknown as { __wa: () => unknown }).__wa = () => {
			const bb = (ms: Mark[]) => ms.reduce((a, m) => [Math.min(a[0], m.x), Math.min(a[1], m.y), Math.max(a[2], m.x), Math.max(a[3], m.y), a[4] + m.x * 0.37 + m.y * 1.13], [Infinity, Infinity, -Infinity, -Infinity, 0]).map((v) => Math.round(v * 100) / 100);
			return { step, wall: bb(wM), time: bb(tM), n: chart.marks.length, owner: field.owner };
		};
		return () => { removeEventListener("resize", onResize); removeEventListener("scroll", onScroll); ro.disconnect(); io.disconnect(); root.removeEventListener("wa-go", onGo); document.removeEventListener("click", onBack); };
	});

	// the card on a report's line: its left edge just before the line, inside the frame
	const CARD_W = 520;
	const cardLeft = (i: number) => {
		if (narrow || !offs.fw) return 0;
		const x = timeScale(offs.fw, false).X(evT(EVS[i].date));
		return Math.max(0, Math.min(offs.fw - Math.min(CARD_W, offs.fw), x - 28));
	};
	const cardOn = (k: "intro" | number) => (k === "intro" ? view.kind === "intro" : view.kind === "event" && view.i === k);
	const host = (url: string) => new URL(url).hostname.replace(/^www\./, "");
	const laneTags = $derived.by((): Tag[] => {
		const G = timeG;
		if (!G) return [];
		return EVS.flatMap((e, i) => {
			if (!lineOn(i) || (view.kind === "event" && view.i === i)) return [];
			const L = G.lanes[i];
			if (L.hidden) return [];
			return [{ id: `e-${i}`, x: G.xs[i], y: G.laneTop + L.level * 26 + 12, t: u(L.short ? e.short : e.chip), color: e.col, swatch: e.dash ? "dash" : "line", at: L.side, alpha: 0.85 } as Tag];
		});
	});
</script>

{#snippet dashes()}
	<StepDashes count={STEPS.length} current={step} go={(i) => go(i)} />
{/snippet}
{#snippet key(color: boolean)}
	<div class="key" class:on={color} style:height="{keyTags.h}px"><Tags items={keyTags.items} follow /></div>
{/snippet}
{#snippet tip()}
	{#if hovered && tipAt && shown}
		{@const w = hovered.w}
		<div class="tip" style="left:{tipAt.x + 312 <= offs.fw ? tipAt.x + 12 : Math.max(0, tipAt.x - 312)}px; top:{Math.max(4, Math.min(tipAt.y, fh - 214))}px">
			<b>{nameOf(w)}</b>
			<span>{w.lab}{w.release ? `, released ${monthYear(w.release)}` : ""}</span>
			<span class="t-k">Of its {w.n} texts, Claude Fable 5.2 named:</span>
			{#each tipRows as r (r.k)}
				<span class="row"><i style:background={COL[r.k]}></i>{r.t}<span class="bar"><span style:width="{r.pct}%" style:background={COL[r.k]}></span></span><em>{r.pct}%</em></span>
			{/each}
		</div>
	{/if}
{/snippet}

<section class="wa" class:still class:narrow id={S.id} data-rq={S.rq} data-step={step} bind:this={root}>
	<SectionOpener n={S.n} title={S.title} takeaway={S.takeaway.t} context={S.context.t} accent="#9A82B4" prints={PRINTS} />

	<div class="wa-body" bind:this={body}>
		<!-- 1. the wall: the narration as a caption band over a full-width wall of piles -->
		<div class="blk" bind:this={wallBlk} style="--n:{NW}">
			<div class="stage">
				<div class="frame" bind:this={wallFrame}>
					<div class="cap">
						{@render dashes()}
						<div class="stack" aria-live="polite">
							{#each STEPS.slice(0, NW) as _, k}<p class="cap-t" class:on={wallStep === k} aria-hidden={wallStep !== k}>{SAY[k]}</p>{/each}
						</div>
					</div>
					<div class="keyw" bind:this={wKey}>{@render key(!!wallSt.color)}</div>
					<div class="over" aria-hidden="true">
						{#if shown && wallG}
							{#each wallG.labels as l (l.id)}
								<span class="lb {l.kind}" class:on={!!l.w && wallFocus.has(l.w)} class:dim={!!l.w && wallFocus.size > 0 && !wallFocus.has(l.w)} data-a={l.align} style="left:{l.x}px; top:{l.y}px">{#each l.lines as t}<span>{t}</span>{/each}</span>
							{/each}
						{/if}
					</div>
					{#if hovered?.ns === "w"}{@render tip()}{/if}
				</div>
			</div>
		</div>

		<!-- 2. the timeline: one step per report, its card on its line -->
		<div class="blk" bind:this={timeBlk} style="--n:{NT}">
			<div class="stage">
				<div class="frame tl" bind:this={timeFrame}>
					{@render key(true)}
					<div class="cards" bind:this={cardsEl} style:--cw="{Math.min(CARD_W, offs.fw || CARD_W)}px">
						<article class="card" class:on={cardOn("intro")} inert={!cardOn("intro")}>
							{@render dashes()}
							<p class="c-t lead">{SAY[NW]}</p>
						</article>
						{#each EVS as e, i}
							{@const sr = e.src}
							<article class="card" class:on={cardOn(i)} inert={!cardOn(i)} style:margin-left="{cardLeft(i)}px">
								{@render dashes()}
								<!-- one order on every card: the report and its date, its words, where they come from, then the paper -->
								<p class="c-h"><i class="ln" class:dash={e.dash} style:--c={e.col}></i>{#if e.icon}<Icon name={e.icon} />{/if}<b>{u(e.label)}</b><span>{dateLabel(e.date)}</span></p>
								<div class="c-m" class:has-ph={!sr.url}>
									{#if !sr.url}<figure class="ph" aria-label={u("Photo to be supplied")}><Icon name="human" /><figcaption>{u("Photo to be supplied")}</figcaption></figure>{/if}
									<div class="c-qs">
										{#if sr.url}<blockquote class="c-q">“{sr.quote}{sr.cut ? "…" : ""}”</blockquote>
										{:else}<blockquote class="c-q">{S.musk_quote.before}<em>“{sr.quote}”</em>{S.musk_quote.after}</blockquote>{/if}
										<p class="c-s">{u(sr.by_line)}{#if sr.url}{" "}<a href={sr.url} target="_blank" rel="noopener">{host(sr.url)} ↗</a>{/if}<sup class="fnref"><a href="#fn-wa-{e.note}" id="fnref-wa-{e.note}">{e.note}</a></sup></p>
									</div>
								</div>
								<p class="c-t">{SAY[e.step]}</p>
							</article>
						{/each}
					</div>
					<div class="over" aria-hidden="true">
						{#if shown && timeG}
							{#each timeG.labels as l (l.id)}
								<span class="lb {l.kind}" class:on={!!l.w && timeFocus.has(l.w)} class:dim={(!!l.lab && !rowOn(l.lab)) || (!!l.w && !rowOn(R.writers.find((x) => x.writer === l.w)?.lab ?? ""))} data-a={l.align} style="left:{l.x}px; top:{l.y}px">{#each l.lines as t}<span>{t}</span>{/each}</span>
							{/each}
							<div class="tagbox"><Tags items={laneTags} follow /></div>
						{/if}
					</div>
					{#if hovered?.ns === "t"}{@render tip()}{/if}
				</div>
			</div>
		</div>

		<Footnotes id="wa" notes={S.notes} />
	</div>
</section>

<style>
	.wa { position: relative; --gut: max(16px, calc(50vw - 40rem)); }
	.wa-body { position: relative; padding-bottom: 8vh; }
	/* each picture: a tall block whose stage pins for its steps (STEP_VH = 0.9 of the viewport each) */
	.blk { position: relative; width: 100vw; margin-left: calc(50% - 50vw); height: calc(var(--n) * 90vh + 100vh); }
	.stage { position: sticky; top: 0; height: 100vh; pointer-events: none; }
	.frame { position: absolute; left: var(--gut); right: var(--gut); top: 28px; bottom: 16px; display: flex; flex-direction: column; }

	/* the wall's caption band */
	.cap { pointer-events: auto; display: grid; gap: 8px; max-width: 46rem; }
	.stack { display: grid; }
	.cap-t { grid-area: 1 / 1; font-size: clamp(20px, 1.9vw, 26px); line-height: 1.3; font-weight: 500; letter-spacing: -0.018em; color: var(--ink); text-wrap: pretty; opacity: 0; transform: translateY(6px); transition: opacity .4s, transform .45s var(--ease); }
	.cap-t.on { opacity: 1; transform: none; }

	/* the key: the four colours in one row of chips (Tags are fixed-position: this box is their frame) */
	.keyw { margin-top: 16px; }
	.key { position: relative; flex: none; transform: translateZ(0); opacity: 0; transition: opacity .4s; }
	.key.on { opacity: 1; }

	/* words on the pictures: frame coordinates, over the canvas */
	.over { position: absolute; inset: 0; pointer-events: none; }
	.tagbox { position: absolute; inset: 0; transform: translateZ(0); }
	.lb { position: absolute; display: grid; white-space: nowrap; line-height: 1.2; color: var(--ink2); text-shadow: 0 0 3px var(--ground), 0 0 2px var(--ground); transition: opacity .3s, color .3s; animation: lb-in .4s var(--ease) both; }
	@keyframes lb-in { from { opacity: 0; } }
	.lb[data-a="center"] { transform: translateX(-50%); text-align: center; }
	.lb[data-a="right"] { transform: translateX(-100%); text-align: right; }
	.head { font-size: 12.5px; font-weight: 600; color: var(--ink); line-height: 16px; }
	.name { font-size: 10.5px; font-weight: 500; line-height: 12.6px; }
	/* on the timeline a report's line may pass behind a model's name: the name keeps a patch of ground */
	.tl .name { padding: 0 2px; background: rgba(232, 232, 227, .86); border-radius: 2px; text-shadow: none; }
	.lb.on { color: var(--ink); font-weight: 600; }
	.lb.dim { opacity: .28; }
	.tick { font-size: 11.5px; color: var(--ink2); }
	.narrow .head { font-size: 11px; line-height: 14px; }
	.narrow .name { font-size: 9.5px; line-height: 11.4px; }
	.narrow .tick { font-size: 10.5px; }

	/* the report cards: all in one cell, so the row is as tall as the tallest and nothing below moves between steps */
	.cards { margin-top: 12px; display: grid; align-items: end; }
	.card { grid-area: 1 / 1; align-self: end; justify-self: start; width: var(--cw); display: grid; gap: 12px; padding: 16px 18px; background: #fff; border-radius: 3px; box-shadow: 0 6px 22px rgba(20, 32, 45, .08); opacity: 0; visibility: hidden; transform: translateY(6px); transition: opacity .35s, transform .4s var(--ease), visibility 0s .35s; }
	.card.on { opacity: 1; visibility: visible; transform: none; pointer-events: auto; transition: opacity .35s, transform .4s var(--ease); }
	.c-h { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--ink2); }
	.c-h b { font-size: 15px; font-weight: 600; color: var(--ink); }
	.c-h span { margin-left: auto; font-variant-numeric: tabular-nums; }
	.ln { flex: none; display: inline-block; width: 18px; height: 2px; background: var(--c); }
	.ln.dash { background: repeating-linear-gradient(90deg, var(--c) 0 5px, transparent 5px 9px); }
	/* the report's words, then where they come from: one block, one rhythm */
	.c-m { display: flex; align-items: center; gap: 14px; }
	.c-qs { display: grid; gap: 6px; min-width: 0; }
	.c-q { margin: 0; font-size: 16px; line-height: 1.42; font-weight: 500; letter-spacing: -0.008em; color: var(--ink); }
	.c-q em { font-style: normal; font-weight: 600; }
	.c-s { font-size: 12px; line-height: 1.4; color: var(--ink2); }
	.c-s a { color: var(--ink); text-underline-offset: 2px; }
	.ph { flex: none; margin: 0; width: 56px; height: 70px; display: grid; place-items: center; align-content: center; gap: 4px; border: 1.25px dashed var(--gray-mid); border-radius: 3px; background: var(--field); color: var(--gray); font-size: 9.5px; line-height: 1.15; text-align: center; }
	.ph :global(svg) { width: 22px; height: 22px; }
	/* the paper's sentence: the card's conclusion */
	.c-t { font-size: 14.5px; line-height: 1.45; color: var(--ink); }
	.c-t.lead { padding-top: 0; border-top: 0; font-size: 18px; line-height: 1.4; font-weight: 500; letter-spacing: -0.01em; }

	/* a model's own numbers */
	.tip { position: absolute; z-index: 5; display: grid; gap: 4px; width: 300px; padding: 12px 14px; background: #fff; border-radius: 3px; box-shadow: 0 6px 20px rgba(20, 32, 45, .14); font-size: 12.5px; color: var(--ink2); pointer-events: none; }
	.tip b { font-size: 15px; color: var(--ink); }
	.t-k { margin-top: 6px; padding-top: 8px; border-top: 1px solid var(--rule); font-size: 12.5px; color: var(--ink); }
	.row { display: grid; grid-template-columns: 10px max-content minmax(24px, 1fr) 34px; align-items: center; gap: 8px; white-space: nowrap; color: var(--ink); }
	.row i { width: 9px; height: 9px; border-radius: 1px; }
	.bar { height: 5px; background: var(--ground); border-radius: 1px; overflow: hidden; }
	.bar span { display: block; height: 100%; }
	.row em { font-style: normal; font-weight: 600; text-align: right; font-variant-numeric: tabular-nums; }

	/* a dashed swatch as long as Tags' (16 px) draws solid in Chrome: the report lines' own dash, [5, 4], instead */
	.tagbox :global(.sw-dash) { height: 2px; border: 0; background: repeating-linear-gradient(90deg, var(--c) 0 5px, transparent 5px 9px); }

	@media (max-width: 860px) {
		.frame { top: 14px; bottom: 10px; }
		.cap-t { font-size: 17px; line-height: 1.38; }
		.keyw { margin-top: 12px; }
		.cards { margin-top: 10px; }
		.card { padding: 14px; gap: 10px; }
		.c-q { font-size: 14.5px; }
		.c-t { font-size: 13.5px; }
		.c-t.lead { font-size: 15px; }
		.ph { width: 48px; height: 60px; }
	}
	.still .cap-t, .still .card, .still .key, .still .lb { transition: none; animation: none; }
	@media (prefers-reduced-motion: reduce) { .cap-t, .card, .key, .lb { transition: none; animation: none; } }
</style>
