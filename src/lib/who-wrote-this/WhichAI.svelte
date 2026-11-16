<script lang="ts">
	// If AI, which AI? Every text Claude Fable 5.2 judged becomes a tile on the page's field: one pile per writing
	// model, grouped by lab, stacked bottom-up like the paper's distillation figure (Anthropic, OpenAI, another lab,
	// then the writer's own lab). Scrolling colours the piles by Fable's answer, spotlights the distillation cases,
	// then lays the open labs' piles along their release dates under the reports the paper cites.
	// Model names, lab names and the colour tags sit on the picture as HTML in the stage's own coordinates, so they
	// scroll with it. The layout is built only when an input changes (step, view, size, panel, fonts); while the stage
	// scrolls in or out the built marks are only shifted, and DotField tweens them.
	import { onMount, untrack } from "svelte";
	import Icon from "./Icon.svelte";
	import Emblem from "./Emblem.svelte";
	import Reveal from "./Reveal.svelte";
	import Tags, { type Tag } from "./Tags.svelte";
	import { field, chart, type Mark, type Path } from "./field.svelte";
	import { LAB, GRAY } from "./palette";
	import S from "./which_ai.json";
	import R from "./rq2_writers.json";

	type W = (typeof R.writers)[number];
	type K = "anthropic" | "openai" | "other" | "own";
	type Step = { layout: string; color: boolean; focus?: string[] };
	type Rect = { x: number; y: number; w: number; h: number };
	type Label = { id: string; x: number; y: number; lines: string[]; kind: "head" | "name" | "tick"; align: "left" | "center" | "right"; on?: boolean; dim?: boolean };
	type Pile = { w: W; left: number; bottom: number; c: number; s: number; head?: number; row?: [number, number] };
	type Geo = { marks: Mark[]; paths: Path[]; labels: Label[]; tags: Tag[]; title: { x: number; y: number; w: number }; tips: Record<string, { x: number; y: number }> };

	// every displayed string that is not paper text is listed in which_ai.json's ui
	const u = (t: string) => (S.ui.includes(t) ? t : (console.warn("which_ai: ui string not listed:", t), t));
	const ORDER = ["Anthropic", "Google", "OpenAI", "Moonshot", "Zhipu", "Alibaba", "MiniMax", "xAI", "DeepSeek", "Mistral", "Cohere"];
	const ROWS_WIDE = [["Anthropic", "Google", "OpenAI"], ["Moonshot", "Zhipu", "Alibaba"], ["MiniMax", "xAI", "DeepSeek", "Mistral", "Cohere"]];
	const ROWS_NARROW = [["Anthropic", "Google", "OpenAI"], ["Moonshot", "Zhipu"], ["Alibaba", "MiniMax"], ["xAI", "DeepSeek", "Mistral", "Cohere"]];
	const BIG = new Set(["Anthropic", "Google", "OpenAI"]);
	const STACK: K[] = ["anthropic", "openai", "other", "own"];
	// which lab Fable named: the lab colours (palette.ts LAB); the data has no Google answers for other labs' texts
	const COL: Record<K, string> = { anthropic: LAB.Anthropic, openai: LAB.OpenAI, other: LAB.other, own: LAB.own };
	const NAME = Object.fromEntries(S.legend.map((l) => [l.k, l.t])) as Record<K, string>;
	const UNLIT = GRAY.strong;
	const LAST = S.steps.length - 1;
	const SAY = S.steps.map((x) => x.t.replace(/-(?=\d)/g, "\u2011"));
	const MAXN = Math.max(...R.writers.map((w) => w.n));
	const groups = ORDER.map((lab) => ({ lab, ws: R.writers.filter((w) => w.lab === lab).sort((a, b) => (a.release ?? "").localeCompare(b.release ?? "")) }));
	const byLab = Object.fromEntries(groups.map((g) => [g.lab, g.ws])) as Record<string, W[]>;
	// a model's name as the writer table gives it, without the snapshot date in brackets ("Kimi K2 (0905)" -> "Kimi K2")
	const nameOf = (w: W) => w.writer.replace(/\s*\(\d{4}\)$/, "");
	// on a phone's timeline the row already names the lab and there is no room for sizes: "MiniMax M3.1 Flash" -> "M3.1 Flash"
	const shortOf = (w: W) => nameOf(w).replace(new RegExp(`^${w.lab} `), "").replace(/ \d+B$/, "");
	// the timeline: the labs the cited reports name, from July 2025 as in paper/figures/ty_rq2_distill_timeline.pdf
	const NAMED = new Set(R.events.flatMap((e) => e.labs));
	const TIME_LABS = ORDER.filter((l) => NAMED.has(l));
	const T0 = Date.UTC(2025, 5, 15), T1 = Date.UTC(2026, 10, 30);
	const day = (d: string) => { const [y, m, dd] = d.split("-").map(Number); return Date.UTC(y, m - 1, dd ?? 1); };
	const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
	const rgba = (hex: string, a: number) => `rgba(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(",")},${a})`;
	const F = (wt: number, px: number) => `${wt} ${px}px Inter, system-ui, sans-serif`;
	const TAG_F = F(600, 12.5), TAG_H = 26;
	const hit = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
	const within = (a: Rect, b: Rect) => a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h;
	const grow = (r: Rect, d: number) => ({ x: r.x - d, y: r.y - d, w: r.w + 2 * d, h: r.h + 2 * d });

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
	const tagW = (t: string, icon?: string) => 16 + 10 + 6 + (icon ? 18.5 : 0) + tw(t, TAG_F);

	// rows (from the bottom) at the middle of a colour's block in a pile, and whether the pile's top rows are that colour
	function block(w: W, k: K, c: number) {
		let a = 0;
		for (const q of STACK) { if (q === k) break; a += w[q]; }
		return (Math.floor(a / c) + Math.floor((a + w[k] - 1) / c)) / 2 + 0.5;
	}
	function topIs(w: W, k: K, c: number) {
		const from = Math.max(0, (Math.ceil(w.n / c) - 3) * c);
		let a = 0, n = 0;
		for (const q of STACK) { if (q === k) n = Math.max(0, a + w[q] - Math.max(a, from)); a += w[q]; }
		return n * 2 > w.n - from;
	}
	function tiles(marks: Mark[], p: Pile, color: boolean, alpha: number) {
		let i = 0;
		for (const k of STACK) for (let j = 0; j < p.w[k]; j++, i++)
			marks.push({ id: `${p.w.writer}#${i}`, group: p.w.writer, square: true, x: p.left + (i % p.c) * p.s + p.s / 2, y: p.bottom - Math.floor(i / p.c) * p.s - p.s / 2, r: p.s * 0.42, color: color ? COL[k] : UNLIT, alpha });
	}
	const pileRect = (p: Pile): Rect => { const h = Math.ceil(p.w.n / p.c) * p.s; return { x: p.left, y: p.bottom - h, w: p.c * p.s, h }; };
	const labelRect = (l: Label, font: string, lh: number): Rect => {
		const w = linesW(l.lines, font), h = l.lines.length * lh;
		return { x: l.align === "center" ? l.x - w / 2 : l.align === "right" ? l.x - w : l.x, y: l.y, w, h };
	};

	// Each colour is named on the picture at the first pile (in reading or date order) where it forms a block and its
	// tag fits: in the band over the pile when the pile's top is that colour, else beside the block.
	function colourTags(piles: Pile[], obst: Rect[], bounds: Rect, band: boolean, key: Rect): { tags: Tag[]; missed: number } {
		const out: Tag[] = [], placed: Rect[] = [];
		let kx = key.x, ky = key.y + TAG_H / 2, missed = 0;
		for (const k of ["own", "anthropic", "openai", "other"] as K[]) {
			const t = NAME[k], w = tagW(t), h = TAG_H;
			const tag = { id: `c-${k}`, t, color: COL[k], swatch: "square" as const };
			let got: Tag | null = null;
			for (const p of piles) {
				if (p.w[k] < Math.max(8, 0.15 * p.w.n)) continue;
				const pw = p.c * p.s, by = p.bottom - block(p.w, k, p.c) * p.s;
				const cands: [Rect, Partial<Tag>][] = [];
				if (band && p.head !== undefined && p.w[k] >= 0.3 * p.w.n && topIs(p.w, k, p.c)) {
					cands.push([{ x: p.left + pw / 2 - w / 2, y: p.head - h / 2, w, h }, { x: p.left + pw / 2, y: p.head, at: "center" }]);
					cands.push([{ x: p.left, y: p.head - h / 2, w, h }, { x: p.left - 10, y: p.head, at: "right" }]);
					cands.push([{ x: p.left + pw - w, y: p.head - h / 2, w, h }, { x: p.left + pw + 10, y: p.head, at: "left" }]);
				}
				cands.push([{ x: p.left + pw + 4, y: by - h / 2, w, h }, { x: p.left + pw - 6, y: by, at: "right" }]);
				cands.push([{ x: p.left - 4 - w, y: by - h / 2, w, h }, { x: p.left + 6, y: by, at: "left" }]);
				for (const [r, pos] of cands)
					if (within(r, bounds) && (!p.row || (r.y >= p.row[0] - 4 && r.y + r.h <= p.row[1] + 4)) && !obst.some((o) => hit(r, o)) && !placed.some((o) => hit(r, o))) { got = { ...tag, ...pos } as Tag; placed.push(grow(r, 3)); break; }
				if (got) break;
			}
			// nowhere free beside a pile (a phone's dense rows): a key on the picture, under its top line
			if (!got) {
				if (kx > key.x && kx + w > key.x + key.w) { kx = key.x; ky += 30; }
				if (ky > key.y + key.h) missed++;
				got = { ...tag, x: kx - 10, y: ky, at: "right" };
				kx += w + 8;
			}
			out.push(got);
		}
		return { tags: out, missed };
	}
	// rows a key needs for the colour tags that found no pile
	const keyRows = (n: number, w: number) => (n ? Math.ceil(([...STACK].slice(0, n).reduce((a, k) => a + tagW(NAME[k]) + 8, 0)) / w) : 0);
	// the picture's top line wraps on a phone
	const titleHOf = (w: number) => (titleW(true) > w ? 48 : 30);

	function labsGeo(box: Rect, narrow: boolean, st: Step, keyH = 0): Geo {
		const rows = narrow ? ROWS_NARROW : ROWS_WIDE;
		const hf = F(600, narrow ? 11 : 12.5), nf = F(500, narrow ? 9.5 : 10.5), nlh = narrow ? 11.4 : 12.6;
		const g = narrow ? 3 : 8, G0 = narrow ? 12 : 24;
		const titleH = titleHOf(box.w) + keyH, headH = narrow ? 22 : 32, nameH = narrow ? 0 : 31, rowGap = narrow ? 8 : 14;
		// a lab's names wrap together: if one needs two lines, all of them take two
		const label = (w: W, room: number) => wrap(nameOf(w), nf, byLab[w.lab].some((v) => tw(nameOf(v), nf) > room) ? 0 : room);
		const inner = (w: W, c: number, s: number) => (narrow ? c * s : Math.max(c * s, linesW(label(w, c * s + g - 6), nf) + 6 - g));
		const rowW = (row: string[], c: number, s: number, G = G0) =>
			row.reduce((t, lab, i) => {
				const ws = byLab[lab];
				return t + (i ? G : 0) + Math.max(ws.reduce((a, w) => a + inner(w, c, s), 0) + (ws.length - 1) * g, tw(lab, hf));
			}, 0);
		const height = (c: number, s: number) => titleH + rows.length * (headH + Math.ceil(MAXN / c) * s + nameH) + (rows.length - 1) * rowGap;
		// the largest tiles that fit, over a few pile widths
		let c = 5, s = 2;
		for (const cc of [3, 4, 5, 6])
			for (let ss = 16; ss > s; ss -= 0.25)
				if (height(cc, ss) <= box.h && rows.every((r) => rowW(r, cc, ss) <= box.w)) { c = cc; s = ss; break; }
		const pileH = Math.ceil(MAXN / c) * s;
		// width the tiles leave over goes between the labs, so the groups read apart
		const G = Math.min(narrow ? 22 : 48, G0 + Math.min(...rows.map((r) => (r.length > 1 ? (box.w - rowW(r, c, s)) / (r.length - 1) : Infinity))));
		const focus = new Set(st.focus ?? []);
		const marks: Mark[] = [], labels: Label[] = [], piles: Pile[] = [], obst: Rect[] = [], tips: Geo["tips"] = {};
		let y = box.y + titleH + Math.max(0, Math.min(24, (box.h - height(c, s)) / 2));
		for (const row of rows) {
			const head = y + headH / 2, bottom = y + headH + pileH;
			let x = box.x;
			for (const lab of row) {
				const gx = x;
				const hl: Label = { id: `h-${lab}`, x: gx, y: head - (narrow ? 7 : 8), lines: [lab], kind: "head", align: "left" };
				labels.push(hl);
				obst.push(grow(labelRect(hl, hf, narrow ? 14 : 16), 4));
				for (const w of byLab[lab]) {
					const iw = inner(w, c, s), p: Pile = { w, left: x + (iw - c * s) / 2, bottom, c, s, head };
					piles.push(p);
					tiles(marks, p, st.color, focus.size ? (focus.has(w.writer) ? 1 : 0.35) : st.color ? 1 : 0.6);
					const pr = pileRect(p);
					obst.push(grow(pr, 2));
					tips[w.writer] = { x: pr.x + pr.w, y: pr.y };
					if (!narrow) {
						const nl: Label = { id: `n-${w.writer}`, x: p.left + (c * s) / 2, y: bottom + 5, lines: label(w, c * s + g - 6), kind: "name", align: "center", on: focus.has(w.writer), dim: focus.size > 0 && !focus.has(w.writer) };
						labels.push(nl);
						obst.push(labelRect(nl, nf, nlh));
					}
					x += iw + g;
				}
				x = Math.max(x - g, gx + tw(lab, hf)) + G;
			}
			y = bottom + nameH + rowGap;
		}
		const title = { x: box.x, y: box.y, w: box.w };
		obst.push({ x: box.x, y: box.y, w: box.w, h: titleH - 4 });
		const ct = st.color ? colourTags(piles, obst, box, true, { x: box.x, y: box.y + titleHOf(box.w) - 2, w: box.w, h: keyH }) : { tags: [], missed: 0 };
		if (ct.missed && !keyH) return labsGeo(box, narrow, st, keyRows(ct.missed, box.w) * 30);
		return { marks, paths: [], labels, tags: ct.tags, title, tips };
	}

	function timeGeo(box: Rect, narrow: boolean, st: Step, spill: number, keyH = 0): Geo {
		const hf = F(600, narrow ? 11 : 12.5), nf = F(500, narrow ? 9.5 : 11), tf = F(400, narrow ? 10.5 : 11.5);
		const titleH = titleHOf(box.w) + keyH, axisH = narrow ? 28 : 34, nameH = narrow ? 13 : 16;
		const labW = Math.max(...TIME_LABS.map((l) => tw(l, hf))) + (narrow ? 8 : 16);
		const lx = box.x + labW, rx = box.x + box.w - 6;
		const X = (t: number) => lx + ((t - T0) / (T1 - T0)) * (rx - lx);
		const focus = new Set(st.focus ?? []);
		const marks: Mark[] = [], paths: Path[] = [], labels: Label[] = [], tags: Tag[] = [], obst: Rect[] = [], tips: Geo["tips"] = {};

		// the reports: their tags take the first free level above the rows, beside their line (never overlapping)
		const evs = R.events.map((e) => {
			const month = e.date.length === 7, a = day(e.date);
			const b = month ? Date.UTC(new Date(a).getUTCFullYear(), new Date(a).getUTCMonth() + 1, 1) : a;
			const col = e.name.startsWith("Anthropic") ? LAB.Anthropic : LAB.OpenAI;
			return { e, x: (X(a) + X(b)) / 2, band: month ? X(b) - X(a) : 0, col, t: u((S.events as Record<string, string>)[e.name]) };
		});
		// report tags may run into the page's right margin; a tag never covers another report's line below that line's tag
		const band = { x: box.x, y: box.y + titleH, w: box.w + spill, h: 4 * 30 };
		// a report's tag prefers the side away from its nearest neighbour
		const gap = (i: number, j: number) => (j < 0 || j >= evs.length ? Infinity : Math.abs(evs[j].x - evs[i].x));
		const pref = evs.map((_, i) => (gap(i, i + 1) < gap(i, i - 1) ? "left" : "right"));
		// every placing order and side; each tag takes the lowest free level; fewest levels win, then preferred sides
		let best: { levels: number; miss: number; sum: number; placed: Rect[]; lv: number[]; sides: ("left" | "right")[] } | null = null;
		const perms = (a: number[]): number[][] => (a.length < 2 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map((r) => [x, ...r])));
		for (const order of perms(evs.map((_, i) => i)))
			for (let m = 0; m < 1 << evs.length; m++) {
				const sides = evs.map((_, i) => ((m >> i) & 1 ? "left" : "right") as "left" | "right");
				const rects: (Rect | null)[] = evs.map(() => null), lv = evs.map(() => -1);
				let levels = 1, ok = true;
				for (const i of order) {
					const ev = evs[i], w = tagW(ev.t), r = { x: sides[i] === "right" ? ev.x + 10 : ev.x - 10 - w, y: 0, w, h: TAG_H };
					let l = 0;
					for (; l < 4; l++) {
						r.y = band.y + 2 + l * 30;
						if (!within(r, band)) { l = 4; break; }
						const free = rects.every((q, j) => !q || (!hit(r, grow(q, 3)) && !(lv[j] <= l && evs[j].x > r.x - 3 && evs[j].x < r.x + w + 3) && !(lv[j] >= l && ev.x > q.x - 3 && ev.x < q.x + q.w + 3)));
						if (free) break;
					}
					if (l === 4) { ok = false; break; }
					rects[i] = { ...r }; lv[i] = l; levels = Math.max(levels, l + 1);
				}
				if (!ok) continue;
				const miss = sides.filter((sd, i) => sd !== pref[i]).length, sum = lv.reduce((a, b) => a + b, 0);
				if (!best || levels < best.levels || (levels === best.levels && (miss < best.miss || (miss === best.miss && sum < best.sum)))) best = { levels, miss, sum, placed: rects.map((q) => grow(q!, 3)), lv, sides };
			}
		const levels = best?.levels ?? 1, placed = best?.placed ?? [];
		const evY = evs.map((_, i) => band.y + 15 + (best?.lv[i] ?? 0) * 30);
		if (best) evs.forEach((ev, i) => tags.push({ id: `e-${ev.e.name}`, x: ev.x, y: evY[i], t: ev.t, color: ev.col, swatch: ev.band ? "square" : "line", at: best!.sides[i] }));
		const top = band.y + levels * 30 + 6, bot = box.y + box.h - axisH, rh = (bot - top) / TIME_LABS.length;

		// tiles as large as the rows allow, in piles narrow enough to sit near their dates
		const maxPH = rh - nameH - 8;
		let c = 6, s = 2;
		for (const cc of [5, 6, 7, 8, 9]) {
			const ss = Math.min(narrow ? 6 : 11, maxPH / Math.ceil(MAXN / cc));
			if (cc * ss <= (narrow ? 34 : 62) && ss > s + 0.05) { c = cc; s = ss; }
		}
		const piles: Pile[] = [];
		TIME_LABS.forEach((lab, ri) => {
			const rt = top + ri * rh, bottom = rt + rh - 4;
			if (ri % 2 === 0) paths.push({ pts: [[box.x, rt + rh / 2], [rx, rt + rh / 2]], color: "rgba(20,32,45,.035)", width: rh, progress: 1 });
			const hl: Label = { id: `h-${lab}`, x: box.x + 2, y: rt + rh / 2 - 8, lines: [lab], kind: "head", align: "left" };
			labels.push(hl);
			obst.push(grow(labelRect(hl, hf, 16), 3));
			paths.push({ pts: [[lx, bottom + 0.5], [rx, bottom + 0.5]], color: "rgba(20,32,45,.18)", width: 1, progress: 1 });
			// releases too close to stand side by side are pushed apart; a tick on the baseline keeps the true date
			const items = byLab[lab].filter((w) => w.release && day(w.release) >= T0).map((w) => {
				const name = narrow ? shortOf(w) : nameOf(w), tx = X(day(w.release!));
				return { w, name, tx, x: tx, half: Math.max(c * s, tw(name, nf) + 10) / 2 };
			});
			for (let it = 0; it < 40; it++) {
				let moved = false;
				for (let i = 1; i < items.length; i++) {
					const a = items[i - 1], b = items[i], d = a.half + b.half - (b.x - a.x);
					if (d > 0.5) { a.x -= d / 2; b.x += d / 2; moved = true; }
				}
				if (items.length) {
					items[0].x = Math.max(items[0].x, lx + (c * s) / 2);
					const z = items[items.length - 1];
					z.x = Math.min(z.x, rx - Math.max((c * s) / 2, z.half - 4));
				}
				if (!moved) break;
			}
			for (const it of items) {
				const p: Pile = { w: it.w, left: it.x - (c * s) / 2, bottom, c, s, row: [rt, rt + rh] };
				piles.push(p);
				const on = focus.has(it.w.writer);
				tiles(marks, p, st.color, 1);
				const pr = pileRect(p);
				obst.push(grow(pr, 3));
				tips[it.w.writer] = { x: pr.x + pr.w, y: pr.y };
				paths.push({ pts: [[it.tx, bottom + 1], [it.tx, bottom + 6]], color: "rgba(20,32,45,.55)", width: 1.5, progress: 1 });
				if (Math.abs(it.x - it.tx) > 1.5) paths.push({ pts: [[it.x, bottom + 1], [it.tx, bottom + 6]], color: "rgba(20,32,45,.3)", width: 1, progress: 1 });
				const nl: Label = { id: `n-${it.w.writer}`, x: it.x, y: pr.y - nameH + 1, lines: [it.name], kind: "name", align: "center", on };
				labels.push(nl);
				obst.push(labelRect(nl, nf, nameH - 2));
			}
		});

		// each report: a faint line from its tag down, strong on the rows of the labs it names (a band for a month)
		evs.forEach((ev, i) => {
			paths.push({ pts: [[ev.x, evY[i]], [ev.x, bot]], color: rgba(ev.col, 0.5), width: 1, dash: [2, 4], progress: 1 });
			TIME_LABS.forEach((lab, ri) => {
				if (!ev.e.labs.includes(lab)) return;
				const rt = top + ri * rh;
				if (ev.band) paths.push({ pts: [[ev.x, rt + 2], [ev.x, rt + rh - 2]], color: rgba(ev.col, 0.16), width: ev.band, progress: 1 });
				else paths.push({ pts: [[ev.x, rt + 3], [ev.x, rt + rh - 3]], color: ev.col, width: 2.5, progress: 1 });
				obst.push({ x: ev.x - Math.max(3, ev.band / 2), y: rt, w: Math.max(6, ev.band), h: rh });
			});
		});

		// the date axis: a tick every three months (six on a phone)
		const stepM = (rx - lx) / 17 < 26 ? 6 : 3;
		paths.push({ pts: [[lx, bot + 2], [rx, bot + 2]], color: "rgba(20,32,45,.45)", width: 1, progress: 1 });
		for (let k = 0; ; k += stepM) {
			const t = Date.UTC(2025, 6 + k, 1);
			if (t > T1) break;
			const d = new Date(t), x = X(t);
			paths.push({ pts: [[x, bot + 2], [x, bot + 7]], color: "rgba(20,32,45,.45)", width: 1, progress: 1 });
			labels.push({ id: `t-${k}`, x, y: bot + 9, lines: [`${MON[d.getUTCMonth()]} ’${String(d.getUTCFullYear()).slice(2)}`], kind: "tick", align: "center" });
		}
		// the axis name, in the labs' column when it clears the first month
		if (box.x + 2 + tw(S.x_label, tf) + 6 < X(Date.UTC(2025, 6, 1)) - tw("Jul ’25", tf) / 2)
			labels.push({ id: "t-axis", x: box.x + 2, y: bot + 9, lines: [u(S.x_label)], kind: "tick", align: "left" });

		const title = { x: box.x, y: box.y, w: box.w };
		if (st.color) {
			const order = [...piles].sort((a, b) => a.w.release!.localeCompare(b.w.release!));
			const ct = colourTags(order, [...obst, ...placed], { x: lx, y: top, w: rx - lx, h: bot - top }, false, { x: box.x, y: box.y + titleHOf(box.w) - 2, w: box.w, h: keyH });
			if (ct.missed && !keyH) return timeGeo(box, narrow, st, spill, keyRows(ct.missed, box.w) * 30);
			tags.push(...ct.tags);
		}
		return { marks, paths, labels, tags, title, tips };
	}
	// width of the picture's top line (the key words), to start a fallback key after it
	const titleW = (color: boolean) => 16 + tw(u("1 tile = 1 text"), F(500, 12.5)) + (color ? 24 + 18 + tw(u("Colour: the lab Claude Fable 5.2 named"), F(500, 12.5)) : 0);

	let step = $state(0);
	let pick = $state<"labs" | "time" | null>(null);
	let active = $state(false);
	let still = $state(false);
	let size = $state({ w: 0, h: 0 });
	let panelBox = $state({ right: 0, bottom: 0 });
	let fontsV = $state(0);
	let labels = $state.raw<Label[]>([]);
	let tags = $state.raw<Tag[]>([]);
	let tips = $state.raw<Geo["tips"]>({});
	let title = $state.raw({ x: 0, y: 0, w: 0 });
	let narrow = $state(false);
	let stageLeft = $state(0);
	let stage: HTMLElement;
	let root: HTMLElement;
	let panel: HTMLElement;

	const st = $derived((step >= LAST && pick === "labs" ? { layout: "labs", color: true } : step >= LAST && pick === "time" ? S.steps[LAST] : S.steps[step]) as Step);
	const shown = $derived(active && field.owner === "rq2");
	const hovered = $derived(field.hover && field.owner === "rq2" ? R.writers.find((w) => w.writer === field.hover) ?? null : null);
	const tip = $derived(hovered ? tips[hovered.writer] ?? null : null);
	$effect(() => { if (step < LAST) pick = null; });

	// the built layout in stage coordinates, and what was last handed to the canvas
	let geo: Geo | null = null;
	let lastL = NaN, lastT = NaN, sent: Mark[] | null = null, vpaths: Path[] = [];

	function rebuild() {
		if (!stage || !size.w) return;
		const w = stage.clientWidth, h = stage.clientHeight;
		narrow = innerWidth <= 860;
		stageLeft = stage.getBoundingClientRect().left;
		const box = narrow
			? { x: 2, y: panelBox.bottom + 12, w: w - 4, h: h - panelBox.bottom - 12 - 14 }
			: { x: panelBox.right + 36, y: 64, w: w - panelBox.right - 36 - 2, h: h - 64 - 22 };
		const spill = Math.max(0, size.w - stage.getBoundingClientRect().left - w - 10);
		geo = st.layout === "time" ? timeGeo(box, narrow, st, spill) : labsGeo(box, narrow, st);
		labels = geo.labels; tags = geo.tags; tips = geo.tips; title = geo.title;
		sent = geo.marks.map((m) => ({ ...m }));
		vpaths = geo.paths.map((q) => ({ ...q, pts: q.pts.map(([x, y]) => [x, y] as [number, number]) }));
		push(true);
	}

	// hand the marks to the canvas in viewport coordinates; only when the stage moved, the layout changed, or another
	// section replaced the chart
	function push(force = false) {
		if (!geo || !active || field.owner !== "rq2") return;
		const r = stage.getBoundingClientRect();
		if (!sent || (!force && r.left === lastL && r.top === lastT && chart.marks === sent)) return;
		lastL = r.left; lastT = r.top;
		const dx = r.left, dy = r.top, gm = geo.marks, gp = geo.paths;
		for (let i = 0; i < gm.length; i++) { sent[i].x = gm[i].x + dx; sent[i].y = gm[i].y + dy; }
		for (let i = 0; i < gp.length; i++) for (let j = 0; j < gp[i].pts.length; j++) { vpaths[i].pts[j][0] = gp[i].pts[j][0] + dx; vpaths[i].pts[j][1] = gp[i].pts[j][1] + dy; }
		chart.marks = sent;
		chart.paths = vpaths;
		if (chart.texts.length) chart.texts = [];
	}

	function sync() {
		// retake the canvas if a neighbour left it on the plain ground while this section is in view
		if (active && field.mode === "ground") { field.mode = "chart"; field.owner = "rq2"; field.dim = 0.75; field.interactive = true; }
		if (active && field.owner === "rq2") push();
	}

	// rebuild when an input changes
	$effect(() => {
		void [st, active, size.w, size.h, panelBox.right, panelBox.bottom, fontsV];
		untrack(rebuild);
	});
	// a neighbour leaving the field, or taking it, between scroll events
	$effect(() => {
		void [field.mode, field.owner, active];
		untrack(sync);
	});

	onMount(() => {
		still = matchMedia("(prefers-reduced-motion: reduce)").matches || new URLSearchParams(location.search).has("still");
		const onResize = () => (size = { w: innerWidth, h: innerHeight });
		onResize();
		addEventListener("resize", onResize, { passive: true });
		addEventListener("scroll", sync, { passive: true });
		const ro = new ResizeObserver(() => {
			const next = { right: panel.offsetLeft + panel.offsetWidth, bottom: panel.offsetTop + panel.offsetHeight };
			// a phone's picture starts under the panel; a wide one beside it
			if (Math.abs(next.right - panelBox.right) > 0.5 || (innerWidth <= 860 && Math.abs(next.bottom - panelBox.bottom) > 0.5)) panelBox = next;
		});
		ro.observe(panel);
		document.fonts?.ready.then(() => { widths.clear(); fontsV++; });
		const io = new IntersectionObserver((es) => es.forEach((e) => {
			active = e.isIntersecting;
			if (active) { field.mode = "chart"; field.owner = "rq2"; field.dim = 0.75; field.interactive = true; }
			else if (field.mode === "chart" && field.owner === "rq2") { field.mode = "ground"; field.dim = 0; field.interactive = false; chart.marks = []; chart.paths = []; chart.texts = []; }
		}), { rootMargin: "-35% 0px -35% 0px" });
		io.observe(root);
		const steps = [...root.querySelectorAll(".step")];
		const so = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) step = steps.indexOf(e.target); }), { rootMargin: "-45% 0px -45% 0px" });
		steps.forEach((s) => so.observe(s));
		return () => { removeEventListener("resize", onResize); removeEventListener("scroll", sync); ro.disconnect(); io.disconnect(); so.disconnect(); };
	});
</script>

<section class="wa" class:still class:narrow id={S.id} bind:this={root} style="--steps:{S.steps.length}">
	<div class="stick" bind:this={stage}>
		<div class="over" aria-hidden="true">
			{#if shown}
				<p class="title" style="left:{title.x}px; top:{title.y}px; max-width:{title.w}px">
					<span><i class="sw"></i>{u("1 tile = 1 text")}</span>
					{#if st.color}<span><Icon name="ai" class="fable" />{u("Colour: the lab Claude Fable 5.2 named")}</span>{/if}
				</p>
				{#each labels as l (l.id)}
					<span class="lb {l.kind}" class:on={l.on} class:dim={l.dim} data-a={l.align} style="left:{l.x}px; top:{l.y}px">{#each l.lines as t}<span>{t}</span>{/each}</span>
				{/each}
				<div class="tagbox"><Tags items={tags} /></div>
			{/if}
		</div>
		<div class="panel" bind:this={panel}>
			<p class="kick"><Emblem n={2} /><span class="badge">{S.n}</span>{S.title}</p>
			<h2>{S.takeaway.t}</h2>
			<div class="say" aria-live="polite" data-lag="1">
				<p class="say-n">{#each S.steps as _, i}<i class:on={step === i}></i>{/each}</p>
				{#key step}<p class="say-t">{SAY[step]}</p>{/key}
			</div>
			<div data-lag="2"><Reveal show={step >= LAST} label={u("Explore")}>
				<div class="seg" role="group" aria-label={u("Explore")}>
					<button aria-pressed={st.layout === "labs"} onclick={() => (pick = "labs")}>{u("By lab")}</button>
					<button aria-pressed={st.layout === "time"} onclick={() => (pick = "time")}>{u("By release date")}</button>
				</div>
				<p class="hint">{u("Point at a pile for details")}</p>
			</Reveal></div>
		</div>
		{#if hovered && shown && tip}
			<div class="tip" class:flip={stageLeft + tip.x > size.w - 320} style="left:{tip.x}px; top:{tip.y}px">
				<b>{hovered.writer}</b>
				<span>{hovered.lab}{hovered.release ? `, ${new Date(day(hovered.release)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}` : ""}</span>
				{#each S.legend as l}
					{@const v = hovered[l.k as K]}
					{#if v}<span class="row"><i style="background:{COL[l.k as K]}"></i>{l.t}<em>{Math.round((v / hovered.n) * 100)}%</em></span>{/if}
				{/each}
				{#if BIG.has(hovered.lab) && S.profiles[hovered.lab as keyof typeof S.profiles]}<span class="prof">{S.profiles[hovered.lab as keyof typeof S.profiles].t}</span>{/if}
			</div>
		{/if}
	</div>
	<div class="steps" aria-hidden="true">{#each S.steps as _}<div class="step"></div>{/each}</div>
</section>

<style>
	.wa { position: relative; margin-top: 40px; height: calc((var(--steps) + 1) * 85vh); }
	.stick { position: sticky; top: 0; height: 100vh; pointer-events: none; }
	.panel { pointer-events: auto; position: absolute; left: 0; top: 64px; width: min(31%, 340px); display: grid; gap: 12px; z-index: 4; }
	.kick { display: flex; align-items: center; gap: 10px; font-size: 14px; font-weight: 600; color: var(--ink2); }
	.badge { display: inline-grid; place-items: center; width: 26px; height: 26px; border-radius: 2px; background: var(--rq2); color: #fff; font-size: 13px; }
	h2 { font-size: clamp(22px, 2.4vw, 30px); line-height: 1.15; font-weight: 600; letter-spacing: -0.025em; text-wrap: balance; }
	.say { padding: 14px 16px; background: #fff; border-radius: 3px; }
	.say-n { display: flex; gap: 5px; margin-bottom: 8px; }
	.say-n i { width: 18px; height: 3px; border-radius: 2px; background: var(--rule); }
	.say-n i.on { background: var(--ink); }
	.say-t { font-size: 16px; line-height: 1.5; animation: say .45s var(--ease); }
	@keyframes say { from { opacity: 0; transform: translateY(6px); } }
	.seg { display: inline-flex; width: fit-content; border: 1.25px solid var(--ink); border-radius: 2px; overflow: hidden; }
	.seg button { padding: 6px 12px; font-size: 13px; font-weight: 500; transition: background-color .15s, color .15s; }
	.seg button + button { border-left: 1.25px solid var(--ink); }
	.seg button[aria-pressed="true"] { background: var(--ink); color: var(--field); }
	.seg button:not([aria-pressed="true"]):hover { background: var(--chip); }
	.hint { font-size: 12px; color: var(--ink2); }
	.narrow .hint { display: none; }

	/* the words on the picture: stage coordinates, under the panel and over the canvas */
	.over { position: absolute; inset: 0; pointer-events: none; }
	.tagbox { position: absolute; inset: 0; transform: translateZ(0); } /* Tags are fixed-position: this box is their frame */
	.title { position: absolute; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 18px; font-size: 12.5px; font-weight: 500; color: var(--ink); white-space: nowrap; }
	.title span { display: inline-flex; align-items: center; gap: 6px; }
	.title .sw { width: 10px; height: 10px; border-radius: 1px; border: 1.5px solid var(--ink2); }
	.title :global(.fable) { color: var(--fable); }
	.lb { position: absolute; display: grid; white-space: nowrap; line-height: 1.2; color: var(--ink2); text-shadow: 0 0 3px var(--ground), 0 0 2px var(--ground); transition: left .45s var(--ease), top .45s var(--ease), opacity .3s; animation: lb-in .4s var(--ease) both; }
	@keyframes lb-in { from { opacity: 0; } }
	.lb[data-a="center"] { transform: translateX(-50%); text-align: center; }
	.lb[data-a="right"] { transform: translateX(-100%); text-align: right; }
	.head { font-size: 12.5px; font-weight: 600; color: var(--ink); line-height: 16px; }
	.name { font-size: 10.5px; font-weight: 500; line-height: 12.6px; }
	.name.on { color: var(--ink); font-weight: 600; }
	.name.dim { opacity: .75; }
	.tick { font-size: 11.5px; color: var(--ink2); }
	.narrow .head { font-size: 11px; line-height: 14px; }
	.narrow .name { font-size: 9.5px; line-height: 11.4px; }
	.narrow .tick { font-size: 10.5px; }

	.tip { position: absolute; z-index: 5; transform: translate(12px, -10%); display: grid; gap: 3px; width: max-content; max-width: 280px; padding: 10px 12px; background: #fff; border-radius: 3px; box-shadow: 0 6px 20px rgba(20, 32, 45, .14); font-size: 12.5px; color: var(--ink2); pointer-events: none; }
	.tip.flip { transform: translate(calc(-100% - 12px), -10%); }
	.tip b { font-size: 14px; color: var(--ink); }
	.row { display: flex; align-items: center; gap: 6px; }
	.row i { flex: none; display: inline-block; width: 9px; height: 9px; }
	.row { white-space: nowrap; }
	.row em { margin-left: auto; padding-left: 12px; font-style: normal; font-weight: 600; color: var(--ink); font-variant-numeric: tabular-nums; }
	.prof { margin-top: 4px; padding-top: 6px; border-top: 1px solid var(--rule); white-space: normal; color: var(--ink); line-height: 1.4; }
	.steps { position: absolute; inset: 0; pointer-events: none; }
	.step { height: 85vh; }
	.step:first-child { margin-top: 20vh; }
	@media (max-width: 860px) {
		.panel { width: auto; right: 0; top: 16px; gap: 8px; }
		h2 { font-size: 21px; }
		.say { padding: 10px 12px; }
		.say-t { font-size: 15px; }
	}
	.still .say-t, .still .lb { animation: none; }
	.still .lb, .still .seg button { transition: none; }
	@media (prefers-reduced-motion: reduce) { .say-t, .lb { animation: none; } .lb { transition: none; } }
</style>
