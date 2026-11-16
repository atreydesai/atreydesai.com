<script lang="ts">
	// Section 5, Implications for anonymity. Familiar writers are hard to keep anonymous (section 4's groups, the
	// best-known writers in front); refusals are rare (1,258 Reddit posts as tiles, Fable 5.2's written refusals through
	// the batch API the results use, in its clay); paraphrasing lowers accuracy but leaves familiar writers identifiable
	// (Figure rq3_familiarity: 1 tile = 1% of texts in the model's colour, original texts filled, paraphrased hollow squares, the
	// texts paraphrasing lost stay filled, on top). Controls come after the story. Tiles are abstract: no writer is named or implied.
	// Strings and numbers are the paper's (anonymity.json, built in the private llm-detectors repo by
	// docs/launch_20261116/tools/build_familiarity_anonymity_data.py); `ui` and `demo` list the rest.
	//
	// Performance: nothing runs per frame while idle. The canvas is rebuilt only when an input changes (step, a control,
	// hover, size, the stage's position while it scrolls in or out) and, while a tween moves, on animation frames that
	// stop when it ends. Marks are pooled; DotField's own tween moves them.
	import { onMount } from "svelte";
	import Icon from "./Icon.svelte";
	import Reveal from "./Reveal.svelte";
	import Tags, { type Tag } from "./Tags.svelte";
	import { MODEL, GRAY, INK as INKS } from "./palette";
	import { field, chart, type Mark, type Path, type Text } from "./field.svelte";
	import A from "./anonymity.json";

	type Bin = { bin: string; shown: boolean; pct: number; tiles: number; pct_rw: number; tiles_rw: number };
	type Step = { view: string; t: string; more?: { t: string }; items?: { icon: string; t: string }[] };
	type G = { x: number; y: number; cx: number; p: number; gw: number };

	const OWNER = "s5-anonymity";
	const INK = INKS.ink, INK2 = INKS.ink2, OFF = GRAY.unlit;
	const STEPS = A.steps as Step[];
	const LAST = STEPS.length - 1;
	const BINS = A.data.bins.domains as Record<string, Record<string, Bin[]>>;
	const R = A.data.refusals;
	const L = A.labels;
	const DOMS = L.domains as Record<string, string>;
	const MODELS = L.models as Record<string, string>;
	const GROUPS = L.groups as { bin: string; t: string }[];
	const col = (name: string) => MODEL[name] ?? GRAY.strong;
	const CLAY = col(L.fable);
	const pctLabel = (pct: number, tiles: number) => (pct > 0 && pct < 1 ? L.lt1 : `${tiles}%`);
	const est = (t: string) => 30 + t.length * 7.1; // a tag's width, for laying tags side by side
	const FOCUS = 3; // the writers the model knows well
	// abstract positions for the refused posts: a fixed shuffle of the grid, so the marks say how many, not which
	const ORDER = (() => {
		const a = Array.from({ length: R.posts }, (_, i) => i);
		let s = 20261116;
		for (let i = a.length - 1; i > 0; i--) { s = (s * 1664525 + 1013904223) >>> 0; const j = s % (i + 1); [a[i], a[j]] = [a[j], a[i]]; }
		return a;
	})();
	const REFUSED = new Set(ORDER.slice(0, R.refused));

	let step = $state(0);
	let active = $state(false);
	let dom = $state("reddit");
	let model = $state("Opus");
	let para = $state(false);
	let replays = $state(0);
	let sel = $state<number | null>(null);
	let open = $state(false);
	let swept = $state(false); // the paraphrased look is showing (for the labels)
	let W = $state(0), H = $state(0), PH = $state(0);
	let ox = $state(0), oy = $state(0); // the stage's viewport offset
	let owned = $state(false);
	let reduce = false;
	let stage: HTMLElement;
	let root: HTMLElement;

	const st = $derived(STEPS[step]);
	const view = $derived(st.view);
	const kind = $derived(view === "refusals" ? "refusals" : view === "known" ? "known" : "bins");
	const narrow = $derived(W > 0 && W < 860);
	const mcolor = $derived(col(MODELS[model]));
	const bins = $derived(BINS[dom][model]);
	// on a phone there is no room for the chart under open Details: they take its place until closed
	const hide = $derived(narrow && open);

	const geo = $derived.by(() => {
		const g: G[] = [];
		const out = { g, keyX: 0, keyY: 0, numY: 0, size: 22, grid: { x: 0, y: 0, p: 0, cols: 50 } };
		if (!W || !H) return out;
		if (!narrow) {
			const x0 = W * 0.36, x1 = W - 12, y0 = 72, y1 = H - 40, bw = x1 - x0, bh = y1 - y0;
			const p = Math.max(6, Math.min((bw - 90) / 40, 16)), gw = 10 * p, rowW = 4 * gw + 90, gx0 = x0 + (bw - rowW) / 2;
			const top = y0 + Math.max(0, (bh - (26 + 36 + 22 + gw + 48)) / 2);
			out.keyX = gx0; out.keyY = top + 13; out.numY = out.keyY + 36;
			const gy = out.numY + 22;
			for (let i = 0; i < 4; i++) { const x = gx0 + i * (gw + 30); g.push({ x, y: gy, cx: x + gw / 2, p, gw }); }
			const cols = 50, rows = Math.ceil(R.posts / cols), gp = Math.max(3, Math.min(bw / cols, (bh - 90) / rows, 13));
			out.grid = { x: x0 + (bw - cols * gp) / 2, y: y0 + 40 + (bh - 40 - rows * gp) / 2, p: gp, cols };
		} else {
			const x0 = 8, x1 = W - 8, y0 = 16 + PH + 12, y1 = H - 16, bw = x1 - x0;
			out.keyX = x0; out.keyY = y0 + 12; out.size = 18;
			const top = out.keyY + 22 + 28, cw = (bw - 24) / 2;
			const p = Math.max(5, Math.min(cw / 10, (y1 - top - 184) / 20, 16)), gw = 10 * p;
			for (let i = 0; i < 4; i++) {
				const c = i % 2, r = Math.floor(i / 2);
				const x = x0 + c * (cw + 24) + (cw - gw) / 2, y = top + 28 + r * (gw + 100);
				g.push({ x, y, cx: x + gw / 2, p, gw });
			}
			const cols = 34, rows = Math.ceil(R.posts / cols), gp = Math.max(3, Math.min(bw / cols, (y1 - top) / rows, 11));
			out.grid = { x: x0 + (bw - cols * gp) / 2, y: top, p: gp, cols };
		}
		return out;
	});

	// labels on the picture (viewport coordinates): group names under the groups, and every colour shown, named
	const tags = $derived.by(() => {
		const t: Tag[] = [];
		if (!active || !owned || !geo.g.length || hide) return t;
		const key: { t: string; color: string; swatch?: Tag["swatch"]; sub?: string }[] = [];
		if (kind === "refusals") {
			key.push({ t: `${L.fable} ${L.refused}`, color: CLAY, swatch: "square", sub: `${R.refused} ${L.posts}` },
				{ t: L.answered, color: OFF, swatch: "square", sub: L.post_unit });
		} else {
			geo.g.forEach((g, i) => t.push({ id: `g${i}`, x: ox + g.cx, y: oy + g.y + g.gw + 4, t: `“${GROUPS[i].t}”`, sub: GROUPS[i].bin, at: "below",
				alpha: kind === "known" && i !== FOCUS ? 0.55 : 1 }));
			if (kind === "bins" && para && swept) {
				key.push({ t: `${MODELS[model]} ${L.still}`, color: mcolor, swatch: "hollow" }, { t: L.lost, color: mcolor, swatch: "square" });
			} else key.push({ t: `${MODELS[model]} ${L.named}`, color: mcolor, swatch: "square" });
			key.push({ t: L.not_named, color: OFF, swatch: "square" });
		}
		let x = geo.keyX, row = 0;
		const ky = kind === "refusals" ? geo.grid.y - 34 : geo.keyY;
		key.forEach((k, i) => {
			if (i > 0 && x + est(k.t) > W - 8) { row++; x = geo.keyX; } // a second row on a phone
			t.push({ id: `k${i}${kind}${k.swatch}`, x: ox + (kind === "refusals" ? geo.grid.x + (x - geo.keyX) : x) - 10, y: oy + ky + row * (k.sub ? 40 : 28) - (k.sub ? 8 : 0),
				t: k.t, color: k.color, swatch: k.swatch, sub: k.sub });
			x += est(k.t) + 6;
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
	const IDS = Array.from({ length: 4 }, (_, g) => Array.from({ length: 100 }, (_, i) => `${OWNER}:g${g}:${i}`));
	const PIDS = Array.from({ length: R.posts }, (_, i) => `${OWNER}:p:${i}`);
	const marks: Mark[] = [];
	let lastKey = "", lastKind = "", t0 = 0, raf = 0;
	let fromLit = [0, 0, 0, 0], curLit = [0, 0, 0, 0];
	const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

	function tile(g: G, gi: number, i: number) {
		const m = mk(IDS[gi][i]);
		m.x = ox + g.x + (i % 10) * g.p + g.p / 2;
		m.y = oy + g.y + (9 - Math.floor(i / 10)) * g.p + g.p / 2;
		m.square = true; m.r = g.p * 0.36; m.alpha = 1; m.color = OFF; // square tiles, as in sections 2 and 3
		return m;
	}

	function render(now: number): boolean {
		const key = `${kind}|${dom}|${model}|${para}|${replays}`;
		if (key !== lastKey) {
			fromLit = kind !== "refusals" && lastKind !== "refusals" ? curLit.slice() : [0, 0, 0, 0];
			lastKey = key; lastKind = kind; t0 = now;
		}
		const e = reduce ? 1e9 : (now - t0) / 1000;
		let busy = false;
		marks.length = 0;
		const texts: Text[] = [], paths: Path[] = [];
		if (hide) { chart.marks = marks; chart.paths = paths; chart.texts = texts; return false; }
		if (kind === "refusals") {
			// the posts, answered in gray; Fable 5.2's written refusals in its clay, each in a square outline so three tiles can be found
			const gd = geo.grid, k = ease(e / 1.2);
			const on = Math.round(R.refused * k);
			for (let i = 0; i < R.posts; i++) {
				const m = mk(PIDS[i]);
				m.x = ox + gd.x + (i % gd.cols) * gd.p + gd.p / 2; m.y = oy + gd.y + Math.floor(i / gd.cols) * gd.p + gd.p / 2;
				m.square = true; m.r = gd.p * 0.36; m.alpha = 1;
				m.color = REFUSED.has(i) && ORDER.indexOf(i) < on ? CLAY : OFF;
				marks.push(m);
			}
			for (let j = 0; j < on; j++) {
				const i = ORDER[j], cx = ox + gd.x + (i % gd.cols) * gd.p + gd.p / 2, cy = oy + gd.y + Math.floor(i / gd.cols) * gd.p + gd.p / 2, h = Math.max(8, gd.p * 1.4);
				paths.push({ pts: [[cx - h, cy - h], [cx + h, cy - h], [cx + h, cy + h], [cx - h, cy + h], [cx - h, cy - h]], color: CLAY, width: 1.5, progress: 1 });
			}
			busy = e < 1.2;
		} else {
			// original texts fill in (filled tiles), then, when paraphrased, a sweep from the bottom turns the texts still
			// named hollow and leaves the ones paraphrasing lost filled, on top
			const kf = ease(e / 0.9);
			const sweepT = para ? (kind === "bins" ? (e - 0.9) / 1.4 : 1) : 0;
			const sw = para && sweepT >= 0.5;
			if (swept !== sw) swept = sw;
			geo.g.forEach((g, gi) => {
				const b = bins[gi];
				const dim = kind === "known" && gi !== FOCUS ? 0.35 : 1;
				const ny = narrow ? g.y - 16 : geo.numY;
				if (!b.shown) {
					const w = g.gw;
					paths.push({ pts: [[ox + g.x, oy + g.y], [ox + g.x + w, oy + g.y], [ox + g.x + w, oy + g.y + w], [ox + g.x, oy + g.y + w], [ox + g.x, oy + g.y]], color: "rgba(20,32,45,.3)", width: 1, dash: [3, 4], progress: 1 });
					texts.push({ x: ox + g.cx, y: oy + g.y + w / 2, t: L.few, color: INK2, size: 12, align: "center", weight: 500 });
					curLit[gi] = 0;
					return;
				}
				const lit = fromLit[gi] + (b.tiles - fromLit[gi]) * kf;
				curLit[gi] = lit;
				for (let i = 0; i < 100; i++) {
					const m = tile(g, gi, i);
					const row = Math.floor(i / 10);
					const after = para && sweepT >= (row + 1) / 11;
					if (after) {
						if (i < b.tiles_rw) {
							// paraphrased: a hollow square, 1.5 px in the model's colour (the filled tile fades out under it)
							m.color = mcolor; m.alpha = 0;
							const h = m.r - 0.75;
							paths.push({ pts: [[m.x - h, m.y - h], [m.x + h, m.y - h], [m.x + h, m.y + h], [m.x - h, m.y + h], [m.x - h, m.y - h]], color: mcolor, width: 1.5, progress: 1 });
						}
						else if (i < b.tiles) m.color = mcolor; // lost: still the original's filled tile (never a lighter tint)
					} else if (i < lit - 0.001) m.color = mcolor;
					m.alpha = (m.alpha ?? 1) * dim;
					marks.push(m);
				}
				const label = sw ? `${pctLabel(b.pct, b.tiles)} → ${pctLabel(b.pct_rw, b.tiles_rw)}` : pctLabel(b.pct, b.tiles);
				texts.push({ x: ox + g.cx, y: oy + ny, t: label, color: dim < 1 ? INK2 : INK, size: sw ? (narrow ? 15 : 18) : geo.size, weight: 600, align: "center" });
			});
			busy = e < (para ? 2.4 : 0.9);
		}
		if (sel !== null && kind !== "refusals" && geo.g[sel]) {
			const g = geo.g[sel], w = g.gw, x = ox + g.x - 5, y = oy + g.y - 5;
			paths.push({ pts: [[x, y], [x + w + 10, y], [x + w + 10, y + w + 10], [x, y + w + 10], [x, y]], color: INK, width: 1.5, progress: 1 });
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
		void [kind, dom, model, para, replays, geo, sel, ox, oy, active, owned, hide];
		kick();
	});
	// two sections can both sit in the observer's band near their boundary: when the other one leaves and
	// clears the field, this one would get no new intersection event, so it takes the field back here
	$effect(() => {
		if (active && field.mode === "ground") { field.mode = "chart"; field.owner = OWNER; field.dim = 0.75; field.interactive = false; }
		owned = field.owner === OWNER;
	});

	function place() {
		const r = stage.getBoundingClientRect();
		if (r.left !== ox) ox = r.left;
		if (r.top !== oy) oy = r.top;
	}

	// each step sets the scene it narrates; the controls then take over until the next step
	function enter(v: string) {
		dom = "reddit"; model = "Opus"; sel = null; open = false;
		para = v === "para" || v === "defenses";
	}
	function replay() { para = true; replays++; }

	onMount(() => {
		reduce = matchMedia("(prefers-reduced-motion: reduce)").matches || new URLSearchParams(location.search).has("still");
		const onScroll = () => {
			if (!active) return;
			if (active && field.mode === "ground") { field.mode = "chart"; field.owner = OWNER; field.dim = 0.75; field.interactive = false; }
			place();
		};
		addEventListener("scroll", onScroll, { passive: true });
		addEventListener("resize", onScroll, { passive: true });
		const io = new IntersectionObserver((es) => es.forEach((e) => {
			active = e.isIntersecting;
			if (active) { field.mode = "chart"; field.owner = OWNER; field.dim = 0.75; field.interactive = false; place(); }
			else if (field.mode === "chart" && field.owner === OWNER) { field.mode = "ground"; field.dim = 0; field.interactive = false; chart.marks = []; chart.paths = []; chart.texts = []; }
		}), { rootMargin: "-35% 0px -35% 0px" });
		io.observe(root);
		const steps = [...root.querySelectorAll(".step")];
		const so = new IntersectionObserver((es) => es.forEach((e) => {
			if (!e.isIntersecting) return;
			const i = steps.indexOf(e.target);
			if (i !== step) { step = i; enter(STEPS[i].view); }
		}), { rootMargin: "-45% 0px -45% 0px" });
		steps.forEach((s) => so.observe(s));
		return () => { cancelAnimationFrame(raf); io.disconnect(); so.disconnect(); removeEventListener("scroll", onScroll); removeEventListener("resize", onScroll); };
	});

	const tip = $derived.by(() => {
		if (sel === null || kind === "refusals") return null;
		const b = bins[sel];
		if (!b.shown) return { h: `“${GROUPS[sel].t}”`, v: L.few, s: [] as string[] };
		const s = [`${MODELS[model]} ${L.named}`];
		if (para) s.push(`${L.original} ${pctLabel(b.pct, b.tiles)}`);
		return { h: `“${GROUPS[sel].t}”`, v: para ? pctLabel(b.pct_rw, b.tiles_rw) : pctLabel(b.pct, b.tiles), s: para ? [`${L.paraphrased}, ${s[0]}`, s[1]] : s };
	});
	const aria = (i: number) => {
		const b = bins[i];
		if (!b.shown) return `${GROUPS[i].t} (${GROUPS[i].bin}): ${L.few}`;
		return `${GROUPS[i].t} (${GROUPS[i].bin}): ${L.original} ${pctLabel(b.pct, b.tiles)}, ${L.paraphrased} ${pctLabel(b.pct_rw, b.tiles_rw)}`;
	};
</script>

<section class="an" id={A.id} data-rq="0" bind:this={root} style="--steps:{STEPS.length}">
	<div class="stick" bind:this={stage} bind:clientWidth={W} bind:clientHeight={H}>
		<div class="panel" bind:clientHeight={PH}>
			<p class="kick"><span class="badge">{A.n}</span>{A.title.t}</p>
			<h2>{A.takeaway.t}</h2>
			<div class="say" aria-live="polite" data-lag="1">
				<p class="say-n">{#each STEPS as _, i}<i class:on={step === i}></i>{/each}</p>
				{#key step}
					<p class="say-t" class:sr={!!st.items}>{st.t}</p>
					{#if st.more}<p class="say-m">{st.more.t}</p>{/if}
					{#if st.items}
						<ul class="defs">{#each st.items as it}<li><Icon name={it.icon} />{it.t[0].toUpperCase() + it.t.slice(1)}</li>{/each}</ul>
					{/if}
				{/key}
			</div>
			<div data-lag="2">
			<Reveal show={step >= LAST} label={L.explore}>
				<div class="ctrl" role="group" aria-label={L.rewriting}>
					<button type="button" aria-pressed={!para} onclick={() => (para = false)}><i class="sw" style:background={mcolor}></i>{L.original}</button>
					<button type="button" aria-pressed={para} onclick={() => (para = true)}><i class="sw hollow" style:border-color={mcolor}></i>{L.paraphrased}</button>
					<span class="sep"></span>
					<button type="button" onclick={replay} aria-label={L.replay} title={L.replay}><Icon name="replay" /></button>
				</div>
				<div class="ctrl" role="group" aria-label={L.domain}>
					{#each Object.entries(DOMS) as [id, t]}<button type="button" aria-pressed={dom === id} onclick={() => (dom = id)}>{t}</button>{/each}
				</div>
				<div class="row">
					<div class="ctrl" role="group" aria-label={L.model}>
						{#each Object.entries(MODELS) as [id, t]}<button type="button" aria-pressed={model === id} onclick={() => (model = id)}><i class="sw" style:background={col(t)}></i>{t}</button>{/each}
					</div>
					<button type="button" class="more" aria-expanded={open} onclick={() => (open = !open)}>{L.details} <Icon name="arrow" class={open ? "up" : "down"} /></button>
				</div>
				{#if open}<div class="det">{#each A.details as d}<p>{d.t}</p>{/each}</div>{/if}
			</Reveal>
			</div>
		</div>
		<!-- hover and keyboard targets over each tile group; the canvas itself is aria-hidden -->
		{#if kind !== "refusals" && !hide}
			<div class="hits">
				{#each geo.g as g, i}
					<button type="button" class="hit" aria-label={aria(i)}
						style="left:{g.x - 5}px; top:{g.y - 5}px; width:{g.gw + 10}px; height:{g.gw + 10}px"
						onpointerenter={() => (sel = i)} onpointerleave={() => (sel = sel === i ? null : sel)}
						onfocus={() => (sel = i)} onblur={() => (sel = sel === i ? null : sel)}
						onclick={() => (sel = sel === i ? null : i)}></button>
				{/each}
			</div>
		{:else}
			<p class="sr">{L.fable} {L.refused}: {R.refused} {L.posts}</p>
		{/if}
		{#if tip && active && sel !== null && geo.g[sel]}
			{@const g = geo.g[sel]}
			<div class="tip" class:flip={g.x + g.gw > W - 220} style="left:{g.x + g.gw + 12}px; top:{g.y}px; --gw:{g.gw + 24}px" role="status">
				<b>{tip.h}</b><span class="tv">{tip.v}</span>{#each tip.s as s}<span>{s}</span>{/each}
			</div>
		{/if}
	</div>
	{#if active && owned}<Tags items={tags} />{/if}
	<div class="steps" aria-hidden="true">{#each STEPS as _}<div class="step"></div>{/each}</div>
</section>

<style>
	.an { position: relative; margin-top: 40px; height: calc((var(--steps) + 1) * 85vh); }
	.stick { position: sticky; top: 0; height: 100vh; pointer-events: none; }
	.panel { pointer-events: auto; position: absolute; left: 0; top: 64px; width: min(31%, 340px); display: grid; gap: 12px; z-index: 2; }
	.kick { display: flex; align-items: center; gap: 10px; font-size: 14px; font-weight: 600; color: var(--ink2); }
	.badge { display: inline-grid; place-items: center; width: 26px; height: 26px; border-radius: 2px; background: var(--ink); color: #fff; font-size: 13px; }
	h2 { font-size: clamp(22px, 2.4vw, 30px); line-height: 1.15; font-weight: 600; letter-spacing: -0.025em; text-wrap: balance; }
	.say { padding: 14px 16px; background: #fff; border-radius: 3px; }
	.say-n { display: flex; gap: 5px; margin-bottom: 8px; }
	.say-n i { width: 18px; height: 3px; border-radius: 2px; background: var(--rule); }
	.say-n i.on { background: var(--ink); }
	.say-t { font-size: 16px; line-height: 1.5; animation: say .45s var(--ease); }
	.say-m { margin-top: 8px; font-size: 14px; line-height: 1.5; color: var(--ink2); animation: say .45s var(--ease); }
	@keyframes say { from { opacity: 0; transform: translateY(6px); } }
	.say-t.sr, .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
	.defs { display: grid; gap: 8px; animation: say .45s var(--ease); }
	.defs li { display: flex; gap: 9px; font-size: 14.5px; line-height: 1.45; }
	.defs :global(.ic) { flex: none; margin-top: 3px; color: var(--ink); }
	.more { justify-self: start; display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 600; color: var(--ink); padding: 2px 0; }
	.more :global(.down) { transform: rotate(90deg); transition: transform .2s; }
	.more :global(.up) { transform: rotate(-90deg); transition: transform .2s; }
	.row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; }
	.det { display: grid; gap: 8px; font-size: 13px; line-height: 1.5; color: var(--ink2); }
	.ctrl { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 2px; background: var(--chip); border-radius: 3px; padding: 3px; justify-self: start; }
	.ctrl button { display: inline-flex; align-items: center; gap: 6px; padding: 5px 9px; font-size: 12.5px; font-weight: 500; color: var(--ink2); border-radius: 2px; }
	.ctrl button:hover { color: var(--ink); }
	.ctrl button[aria-pressed="true"] { background: var(--ink); color: var(--field); }
	.sw { flex: none; display: inline-block; width: 9px; height: 9px; border-radius: 1px; }
	.sw.hollow { background: transparent; border: 1.5px solid; }

	.ctrl button[aria-pressed="true"] .sw:not(.hollow) { box-shadow: 0 0 0 1.5px var(--field); }
	.sep { width: 1px; align-self: stretch; margin: 3px 4px; background: var(--rule); }
	.hits { position: absolute; inset: 0; pointer-events: none; }
	.hit { position: absolute; pointer-events: auto; border-radius: 2px; background: transparent; cursor: default; }
	.hit:focus-visible { outline: 2px solid var(--ink); outline-offset: 0; }
	.tip { position: absolute; z-index: 5; display: grid; gap: 2px; min-width: 150px; padding: 9px 12px; background: #fff; border-radius: 3px; box-shadow: 0 6px 20px rgba(20, 32, 45, .14); font-size: 12.5px; color: var(--ink2); pointer-events: none; white-space: nowrap; }
	.tip.flip { transform: translateX(calc(-100% - var(--gw))); }
	.tip b { font-size: 13.5px; color: var(--ink); }
	.tv { font-size: 20px; font-weight: 600; color: var(--ink); font-variant-numeric: tabular-nums; }
	.steps { position: absolute; inset: 0; pointer-events: none; }
	.step { height: 85vh; }
	.step:first-child { margin-top: 20vh; }
	@media (max-width: 860px) {
		.panel { width: auto; right: 0; top: 16px; gap: 8px; }
		.say { padding: 12px 14px; }
		.say-t { font-size: 15px; }
		.say-m { font-size: 13px; }
		.defs li { font-size: 13.5px; }
	}
	@media (prefers-reduced-motion: reduce) { .say-t, .say-m, .defs { animation: none; } .more :global(.ic) { transition: none; } }
</style>
