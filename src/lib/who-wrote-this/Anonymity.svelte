<script lang="ts">
	// Section 5, Implications for anonymity. Defenses are limited: refusals are rare (1,258 Reddit posts as tiles,
	// the written refusals marked; the batch API the results use against Claude Code), and paraphrasing lowers
	// accuracy but leaves familiar writers identifiable (Figure rq3_familiarity: per familiarity group, 1 tile = 1%
	// of texts; "Paraphrased" turns off the tiles the two Argon rewrites lose, on average, and the familiar group stays
	// lit). Deleting writing is the paper's claim in its own words, not an animation. Tiles are abstract: no writer is
	// named or implied. Strings and numbers are the paper's (anonymity.json, built in the private llm-detectors repo by
	// docs/launch_20261116/tools/build_familiarity_anonymity_data.py).
	import { onMount } from "svelte";
	import Icon from "./Icon.svelte";
	import { field, chart, type Mark, type Path, type Text } from "./field.svelte";
	import A from "./anonymity.json";

	type Bin = { bin: string; n: number; shown: boolean; k: number; pct: number; tiles: number; k_rw: number; pct_rw: number; tiles_rw: number; k_rw1: number; k_rw2: number };
	type Step = { view: string; t: string; more?: { t: string }; details?: { t: string }[]; items?: { icon: string; t: string }[] };
	type Group = { id: string; x: number; y: number; p: number; cols: number; n: number; alpha: number; bin?: Bin; tip: string[]; aria: string };

	const OWNER = "s5-anonymity";
	const TEAL = "#437E8E", OFF = "#C3C4BD", INK = "#14202D", INK2 = "#5A6270", CLAY = "#B4501C";
	const STEPS = A.steps as Step[];
	const BINS = A.data.bins.domains as Record<string, Record<string, Bin[]>>;
	const RW = A.data.rewrite_table.rows as Record<string, Record<string, { n: number; original: number; rewrite1: number; rewrite2: number }>>;
	const R = A.data.refusals;
	const L = A.labels;
	const DOMS = L.domains as Record<string, string>;
	const MODELS = L.models as Record<string, string>;
	const pct = (v: number) => `${v.toFixed(1)}%`;
	const whole = (v: number, tiles: number) => (tiles === 0 && v > 0 ? "<1%" : `${tiles}%`); // the label is the tile count
	const half = (v: number) => (Number.isInteger(v) ? `${v}` : v.toFixed(1));
	// abstract positions for the refused posts: a fixed shuffle of the grid, so the marks say how many, not which
	const ORDER = (() => {
		const a = Array.from({ length: R.posts }, (_, i) => i);
		let s = 20261116;
		for (let i = a.length - 1; i > 0; i--) { s = (s * 1664525 + 1013904223) >>> 0; const j = s % (i + 1); [a[i], a[j]] = [a[j], a[i]]; }
		return a;
	})();

	let step = $state(0);
	let active = $state(false);
	let dom = $state("reddit");
	let model = $state("Opus");
	let para = $state(false);
	let via = $state<"api" | "cc">("api");
	let sel = $state<string | null>(null);
	let open = $state(false);
	let W = $state(0), H = $state(0);
	let stage: HTMLElement;
	let root: HTMLElement;
	const st = $derived(STEPS[step]);
	const view = $derived(st.view);
	const tilesView = $derived(view !== "refusals");
	const rwRow = $derived(dom === "public_reviews" ? null : RW[DOMS[dom]]?.[model] ?? null);

	// each step sets the scene it narrates; the controls then take over until the next step
	function enter(v: string) {
		if (v === "known") { dom = "reddit"; model = "Opus"; para = false; }
		else if (v === "refusals") via = "api";
		else if (v === "para_setup") para = false;
		else if (v === "para") { dom = "reddit"; model = "Opus"; para = true; } // the narration's own case
		else if (v === "stories") { dom = "stories"; model = "Opus"; para = true; }
	}

	function boxOf(w: number, h: number) {
		const narrow = w < 860;
		return narrow ? { x0: 8, x1: w - 8, y0: h * 0.54, y1: h - 24, narrow } : { x0: w * 0.36, x1: w - 12, y0: 92, y1: h - 64, narrow };
	}

	const geo = $derived.by(() => {
		const groups: Group[] = [], texts: Text[] = [], paths: Path[] = [];
		if (!W || !H) return { groups, texts, paths };
		const b = boxOf(W, H);
		const bw = b.x1 - b.x0, bh = b.y1 - b.y0;
		if (view === "refusals") {
			const cols = b.narrow ? 34 : 50, rows = Math.ceil(R.posts / cols);
			const p = Math.max(3, Math.min(bw / cols, (bh - 70) / rows, 13));
			const x = b.x0 + (bw - cols * p) / 2, y = b.y0 + (bh - rows * p) / 2;
			const k = via === "api" ? R.batch_api : R.claude_code;
			const share = via === "api" ? `${R.batch_api} (${R.batch_api_pct}%)` : `${R.claude_code} of ${R.posts.toLocaleString("en-US")}`;
			groups.push({ id: "posts", x, y, p, cols, n: R.posts, alpha: 1, tip: [`${R.posts.toLocaleString("en-US")} ${L.posts}`, share, `${L.refusal}, ${via === "api" ? L.batch : L.claude_code}`],
				aria: `${R.posts.toLocaleString("en-US")} ${L.posts}, Claude Fable 5.2, ${via === "api" ? L.batch : L.claude_code}: ${share} ${L.refusal}` });
			texts.push({ x: x, y: y - 36, t: `${R.posts.toLocaleString("en-US")} ${L.posts}`, color: INK, size: 13, weight: 600 });
			texts.push({ x: x, y: y - 18, t: L.fable, color: CLAY, size: 12.5, weight: 500 });
			texts.push({ x: x, y: y + rows * p + 22, t: `${L.refusal}: ${share}`, color: INK, size: 13, weight: 600 });
			if (k <= 10) for (let j = 0; j < k; j++) {
				const i = ORDER[j], cx = x + (i % cols) * p + p / 2, cy = y + Math.floor(i / cols) * p + p / 2, rr = p * 1.5;
				paths.push({ pts: Array.from({ length: 25 }, (_, a) => [cx + rr * Math.cos((a / 24) * 6.2832), cy + rr * Math.sin((a / 24) * 6.2832)] as [number, number]), color: INK, width: 1.5, progress: 1 });
			}
			return { groups, texts, paths };
		}
		// four familiarity groups, as in section 4, with the original or the paraphrased share lit
		const gap = b.narrow ? 10 : 30;
		const p = Math.max(4, Math.min((bw - 3 * gap) / 40, (bh - 120) / 10, 17));
		const gw = 10 * p, x0 = b.x0 + (bw - (4 * gw + 3 * gap)) / 2, y = b.y0 + (bh - gw) * 0.4 + 10;
		const focus = view === "known" || view === "stories" ? 3 : -1;
		BINS[dom][model].forEach((bn, s) => {
			const x = x0 + s * (gw + gap), cx = x + gw / 2;
			const alpha = focus >= 0 && s !== focus ? 0.35 : 1;
			texts.push({ x: cx, y: y + gw + 18, t: bn.bin, color: INK, size: 13, weight: 600, align: "center" });
			if (!bn.shown) {
				paths.push({ pts: [[x, y], [x + gw, y], [x + gw, y + gw], [x, y + gw], [x, y]], color: "rgba(20,32,45,.25)", width: 1, dash: [3, 4], progress: 1 });
				texts.push({ x: cx, y: y + gw / 2, t: `n = ${bn.n}`, color: INK2, size: 11.5, align: "center" });
				return;
			}
			groups.push({ id: `b${s}`, x, y, p, cols: 10, n: 100, alpha, bin: bn,
				tip: [`${L.familiarity_axis} ${bn.bin}`, `${L.original}: ${bn.k} of ${bn.n} (${pct(bn.pct)})`, `${L.rewrite1}: ${bn.k_rw1}, ${L.rewrite2}: ${bn.k_rw2}`, `${L.paraphrased}: ${half(bn.k_rw)} of ${bn.n} (${pct(bn.pct_rw)})`],
				aria: `${L.familiarity_axis} ${bn.bin}: ${L.original} ${pct(bn.pct)}, ${L.paraphrased} ${pct(bn.pct_rw)}` });
			const on = alpha === 1;
			texts.push({ x: cx, y: y - 30, t: para ? whole(bn.pct_rw, bn.tiles_rw) : whole(bn.pct, bn.tiles), color: on ? INK : INK2, size: 22, weight: 600, align: "center" });
			texts.push({ x: cx, y: y - 11, t: para ? `${L.original} ${bn.tiles}%` : `${bn.k} of ${bn.n}`, color: INK2, size: 11.5, align: "center" });
			if (s === focus) paths.push({ pts: [[x - 7, y - 50], [x + gw + 7, y - 50], [x + gw + 7, y + gw + 30], [x - 7, y + gw + 30], [x - 7, y - 50]], color: TEAL, width: 1.6, progress: 1 });
		});
		texts.push({ x: x0 + (4 * gw + 3 * gap) / 2, y: y + gw + 42, t: `${L.familiarity_axis} →`, color: INK2, size: 12, align: "center" });
		if (!b.narrow || view === "known") { // on narrow screens the panel's chips name them, right above
			texts.push({ x: x0, y: y - 92, t: DOMS[dom], color: INK, size: 13, weight: 600 });
			texts.push({ x: x0, y: y - 74, t: `${MODELS[model]}, ${para ? L.paraphrased : L.original}`, color: INK2, size: 12.5, weight: 500 });
		}
		return { groups, texts, paths };
	});
	const hovered = $derived(sel ? geo.groups.find((g) => g.id === sel) ?? null : null);

	let grow = 1, fade = 1; // grow: tiles fill in; fade: the paraphrase loss, top tile first
	let lastKey = "", lastPara = false;
	function replay() { fade = 0; }
	function draw(dt: number, reduce: boolean) {
		const key = view === "refusals" ? `r|${via}` : geo.groups.map((g) => `${g.id}:${g.bin?.tiles}`).join("|"); // refill only when the lit counts change
		if (key !== lastKey) { lastKey = key; grow = reduce ? 1 : 0; fade = 1; }
		if (para !== lastPara) { lastPara = para; fade = para && !reduce ? 0 : 1; }
		if (reduce) fade = 1;
		grow = Math.min(1, grow + dt / 1.2);
		fade = Math.min(1, fade + dt / 1.6);
		const r = stage.getBoundingClientRect();
		const ox = r.left, oy = r.top;
		const marks: Mark[] = [];
		const ease = 1 - Math.pow(1 - grow, 3);
		for (const g of geo.groups) {
			const rows = Math.ceil(g.n / g.cols);
			if (!g.bin) {
				// the refusal grid: answered posts quiet, written refusals in ink
				const k = via === "api" ? R.batch_api : R.claude_code;
				const refused = new Set(ORDER.slice(0, Math.round(k * ease)));
				for (let i = 0; i < g.n; i++) marks.push({
					id: `${OWNER}:p:${i}`, square: true, x: ox + g.x + (i % g.cols) * g.p + g.p / 2, y: oy + g.y + Math.floor(i / g.cols) * g.p + g.p / 2,
					r: g.p * 0.36, color: refused.has(i) ? INK : OFF, alpha: 1,
				});
				continue;
			}
			const orig = g.bin.tiles * ease, kept = g.bin.tiles_rw, lost = Math.max(0, g.bin.tiles - kept);
			for (let i = 0; i < g.n; i++) {
				let color = OFF, alpha = g.alpha;
				if (i < orig) {
					color = TEAL;
					// paraphrased: the lost tiles fade from the top of the stack down to what the rewrites keep
					if (para && i >= kept && lost > 0 && fade > (g.bin.tiles - 1 - i) / lost) alpha = g.alpha * 0.26;
				} else if (para && i < kept) color = TEAL;
				const col = i % 10, row = Math.floor(i / 10);
				marks.push({ id: `${OWNER}:${g.id}:${i}`, square: true, x: ox + g.x + col * g.p + g.p / 2, y: oy + g.y + (rows - 1 - row) * g.p + g.p / 2, r: g.p * 0.38, color, alpha });
			}
		}
		const paths = geo.paths.map((p) => ({ ...p, pts: p.pts.map(([x, y]) => [x + ox, y + oy] as [number, number]) }));
		if (hovered && hovered.bin) {
			const g = hovered, w = g.cols * g.p, h = Math.ceil(g.n / g.cols) * g.p, x = ox + g.x - 4, y = oy + g.y - 4;
			paths.push({ pts: [[x, y], [x + w + 8, y], [x + w + 8, y + h + 8], [x, y + h + 8], [x, y]], color: INK, width: 1.5, progress: 1 });
		}
		chart.marks = marks;
		chart.paths = paths;
		chart.texts = geo.texts.map((t) => ({ ...t, x: t.x + ox, y: t.y + oy }));
	}

	onMount(() => {
		const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches || new URLSearchParams(location.search).has("still");
		let raf = 0, last = performance.now();
		const loop = (now: number) => {
			const dt = Math.min(0.05, (now - last) / 1000); last = now;
			// two sections can both sit in the observer's band near their boundary: when the other one leaves and
			// clears the field, this one would get no new intersection event, so it takes the field back here
			if (active && field.mode === "ground") { field.mode = "chart"; field.owner = OWNER; field.dim = 0.75; field.interactive = false; }
			if (active && field.owner === OWNER) draw(dt, reduce);
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		const io = new IntersectionObserver((es) => es.forEach((e) => {
			active = e.isIntersecting;
			if (active) { field.mode = "chart"; field.owner = OWNER; field.dim = 0.75; field.interactive = false; }
			else if (field.mode === "chart" && field.owner === OWNER) { field.mode = "ground"; field.dim = 0; field.interactive = false; chart.marks = []; chart.paths = []; chart.texts = []; }
		}), { rootMargin: "-35% 0px -35% 0px" });
		io.observe(root);
		const steps = [...root.querySelectorAll(".step")];
		const so = new IntersectionObserver((es) => es.forEach((e) => {
			if (!e.isIntersecting) return;
			const i = steps.indexOf(e.target);
			if (i !== step) { step = i; sel = null; open = false; enter(STEPS[i].view); }
		}), { rootMargin: "-45% 0px -45% 0px" });
		steps.forEach((s) => so.observe(s));
		return () => { cancelAnimationFrame(raf); io.disconnect(); so.disconnect(); };
	});
</script>

<section class="an" id={A.id} data-rq="0" bind:this={root} style="--steps:{STEPS.length}">
	<div class="stick" bind:this={stage} bind:clientWidth={W} bind:clientHeight={H}>
		<div class="panel">
			<p class="kick"><span class="badge">{A.n}</span>{A.title.t}</p>
			<h2>{A.takeaway.t}</h2>
			<div class="say" aria-live="polite">
				<p class="say-n">{#each STEPS as _, i}<i class:on={step === i}></i>{/each}</p>
				{#key step}
					<p class="say-t" class:sr={!!st.items}>{st.t}</p>
					{#if st.more}<p class="say-m">{st.more.t}</p>{/if}
					{#if st.items}
						<ul class="defs">{#each st.items as it}<li><Icon name={it.icon} />{it.t[0].toUpperCase() + it.t.slice(1)}</li>{/each}</ul>
					{/if}
				{/key}
				{#if st.details}
					<button type="button" class="more" aria-expanded={open} onclick={() => (open = !open)}>Details <Icon name="arrow" class={open ? "up" : "down"} /></button>
					{#if open}<div class="det">{#each st.details as d}<p>{d.t}</p>{/each}</div>{/if}
				{/if}
			</div>
			{#if view === "refusals"}
				<div class="ctrl" role="group" aria-label="Route">
					<button type="button" aria-pressed={via === "api"} onclick={() => (via = "api")}>{L.batch}</button>
					<button type="button" aria-pressed={via === "cc"} onclick={() => (via = "cc")}>{L.claude_code}</button>
				</div>
				<p class="key"><span><i class="k-ref"></i>{L.refusal}</span><span><i class="k-off"></i>1 tile = 1 post</span></p>
			{:else if view !== "known"}
				<div class="ctrl" role="group" aria-label="Rewriting">
					<button type="button" aria-pressed={!para} onclick={() => (para = false)}>{L.original}</button>
					<button type="button" aria-pressed={para} onclick={() => (para = true)}><Icon name="rewrite" />{L.paraphrased}</button>
					<span class="sep"></span>
					<button type="button" onclick={() => { para = true; replay(); }} aria-label="Replay" title="Replay"><Icon name="replay" /></button>
				</div>
				{#if view !== "defenses"}
					<div class="ctrl" role="group" aria-label="Domain">
						{#each Object.entries(DOMS) as [id, t]}<button type="button" aria-pressed={dom === id} onclick={() => (dom = id)}>{t}</button>{/each}
					</div>
					<div class="ctrl" role="group" aria-label="Model">
						{#each Object.entries(MODELS) as [id, t]}<button type="button" aria-pressed={model === id} onclick={() => (model = id)}>{t}</button>{/each}
					</div>
					{#if rwRow}
						<p class="rw"><span>{L.original}<b>{rwRow.original.toFixed(1)}%</b></span><span>{L.rewrite1}<b>{rwRow.rewrite1.toFixed(1)}%</b></span><span>{L.rewrite2}<b>{rwRow.rewrite2.toFixed(1)}%</b></span><em>n = {rwRow.n.toLocaleString("en-US")}</em></p>
					{/if}
				{/if}
				<p class="key"><span><i class="k-lit"></i>{L.legend_kept}</span>{#if para}<span><i class="k-lost"></i>{L.legend_lost}</span>{/if}<span><i class="k-off"></i>1 tile = 1% of texts</span></p>
			{:else}
				<p class="key"><span><i class="k-lit"></i>{L.legend_kept}</span><span><i class="k-off"></i>1 tile = 1% of texts</span></p>
			{/if}
			<p class="cap">
				{#if view === "refusals"}{A.captions.refusals.t}
				{:else if view === "known"}{A.captions.bins.t}
				{:else if dom === "public_reviews"}{A.captions.rewrite.t} {A.captions.public_reviews.t}
				{:else}{A.captions.rewrite.t} {A.captions.bins.t}{/if}
			</p>
		</div>
		<div class="hits">
			{#each geo.groups as g (g.id)}
				<button type="button" class="hit" aria-label={g.aria}
					style="left:{g.x - 4}px; top:{g.y - 4}px; width:{g.cols * g.p + 8}px; height:{Math.ceil(g.n / g.cols) * g.p + 8}px"
					onpointerenter={() => (sel = g.id)} onpointerleave={() => (sel = sel === g.id ? null : sel)}
					onfocus={() => (sel = g.id)} onblur={() => (sel = sel === g.id ? null : sel)}
					onclick={() => (sel = sel === g.id ? null : g.id)}></button>
			{/each}
		</div>
		{#if hovered && active && hovered.bin}
			{@const gw = hovered.cols * hovered.p}
			<div class="tip" class:flip={hovered.x + gw > W - 260} style="left:{hovered.x + gw + 12}px; top:{hovered.y}px; --gw:{gw + 24}px" role="status">
				<b>{hovered.tip[0]}</b>
				<span class="tv">{para ? pct(hovered.bin.pct_rw) : pct(hovered.bin.pct)}</span>
				{#each hovered.tip.slice(1) as t}<span>{t}</span>{/each}
			</div>
		{/if}
	</div>
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
	.say-t.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
	.defs { display: grid; gap: 8px; animation: say .45s var(--ease); }
	.defs li { display: flex; gap: 9px; font-size: 14.5px; line-height: 1.45; }
	.defs :global(.ic) { flex: none; margin-top: 3px; color: var(--rq3); }
	.more { margin-top: 10px; display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 600; color: var(--ink); padding: 4px 0; }
	.more :global(.down) { transform: rotate(90deg); transition: transform .2s; }
	.more :global(.up) { transform: rotate(-90deg); transition: transform .2s; }
	.det { margin-top: 6px; display: grid; gap: 8px; font-size: 13px; line-height: 1.5; color: var(--ink2); }
	.ctrl { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 2px; background: var(--chip); border-radius: 3px; padding: 3px; justify-self: start; }
	.ctrl button { display: inline-flex; align-items: center; gap: 6px; padding: 5px 9px; font-size: 12.5px; font-weight: 500; color: var(--ink2); border-radius: 2px; }
	.ctrl button:hover { color: var(--ink); }
	.ctrl button[aria-pressed="true"] { background: var(--ink); color: var(--field); }
	.sep { width: 1px; align-self: stretch; margin: 3px 4px; background: var(--rule); }
	.rw { display: grid; grid-template-columns: repeat(3, auto) 1fr; align-items: end; gap: 2px 16px; font-size: 12px; color: var(--ink2); justify-self: start; }
	.rw span { display: grid; gap: 0; }
	.rw b { font-size: 16px; font-weight: 600; color: var(--ink); font-variant-numeric: tabular-nums; }
	.rw em { font-style: normal; align-self: end; }
	.key { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 12px; color: var(--ink2); }
	.key span { display: inline-flex; align-items: center; gap: 6px; }
	.key i { display: inline-block; width: 10px; height: 10px; }
	.k-lit { background: #437E8E; } .k-lost { background: rgba(67, 126, 142, .26); } .k-off { background: #C3C4BD; } .k-ref { background: #14202D; }
	.cap { font-size: 12px; line-height: 1.45; color: var(--ink2); }
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
		.panel .cap, .panel .key, .panel .rw { display: none; }
		.say-m { font-size: 13px; }
	}
	@media (prefers-reduced-motion: reduce) { .say-t, .say-m, .defs { animation: none; } .more :global(.ic) { transition: none; } }
</style>
