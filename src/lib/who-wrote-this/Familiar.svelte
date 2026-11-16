<script lang="ts">
	// Section 4, Who can be identified? A model's own rating of how familiar a writer is (0–3) predicts whether it
	// names them. Texts become tiles on the page's field, 100 per familiarity group (1 tile = 1% of texts), lit where
	// the model named the writer: Figure rq3_familiarity's original texts, the two ICML 2020 ratings the paper states,
	// the AUC against posting activity, then the Reddit effort-by-familiarity table as a grid of blocks. Tiles are
	// abstract: no writer is named or implied. Strings and numbers are the paper's (familiarity.json, built in the
	// private llm-detectors repo by docs/launch_20261116/tools/build_familiarity_anonymity_data.py).
	import { onMount } from "svelte";
	import Icon from "./Icon.svelte";
	import { field, chart, type Mark, type Path, type Text } from "./field.svelte";
	import F from "./familiarity.json";

	type Bin = { bin: string; n: number; shown: boolean; k: number; pct: number; tiles: number };
	type Row = { familiarity: string; cells: number[]; gain: number };
	type EM = { efforts: string[]; rows: Row[]; any: { cells: number[]; gain: number }; pooled_gain_ci: number[] };
	type Step = { view: string; t: string; more?: { t: string }; details?: { t: string }[] };
	type Group = { id: string; x: number; y: number; p: number; cols: number; n: number; lit: number; alpha: number; tip: string[]; aria: string; round?: boolean; color?: string };

	const OWNER = "s4-familiar";
	const TEAL = "#437E8E", OFF = "#C3C4BD", INK = "#14202D", INK2 = "#5A6270", CLAY = "#B4501C", GRAY = "#898989";
	const STEPS = F.steps as Step[];
	const BINS = F.data.bins.domains as Record<string, Record<string, Bin[]>>;
	const EFF = F.data.effort.models as Record<string, EM>;
	const L = F.labels;
	const DOMS = L.domains as Record<string, string>;
	const MODELS = L.models as Record<string, string>;
	const EMODELS = Object.keys(EFF);
	const P = F.data.proxies;
	const ICML = F.data.icml;
	const signed = (v: number) => (v < 0 ? `−${Math.abs(v).toFixed(1)}` : `+${v.toFixed(1)}`);
	const pct = (v: number) => `${v.toFixed(1)}%`;

	let step = $state(0);
	let active = $state(false);
	let dom = $state("reddit");
	let model = $state("Opus");
	let emodel = $state("Fable 5.2");
	let sel = $state<string | null>(null);
	let open = $state(false);
	let W = $state(0), H = $state(0);
	let stage: HTMLElement;
	let root: HTMLElement;
	const st = $derived(STEPS[step]);
	const view = $derived(st.view);

	// the chart area beside the panel (below it on narrow screens), in stage coordinates
	function boxOf(w: number, h: number) {
		const narrow = w < 860;
		return narrow ? { x0: 8, x1: w - 8, y0: h * 0.5, y1: h - 24, narrow } : { x0: w * 0.36, x1: w - 12, y0: 92, y1: h - 64, narrow };
	}

	// what the stage shows for a view: tile groups (each a hover target), labels and lines; recomputed only when the
	// view, the size or a control changes. The draw loop adds the stage offset and the fill animation.
	const geo = $derived.by(() => {
		const groups: Group[] = [], texts: Text[] = [], paths: Path[] = [];
		if (!W || !H) return { groups, texts, paths };
		const b = boxOf(W, H);
		const bw = b.x1 - b.x0, bh = b.y1 - b.y0;
		// what the tiles are: domain (or venue) and model, just above the chart
		const title = (top: number, a: string, sub: string, subColor = INK2) => {
			if (b.narrow && (view === "bins" || view.startsWith("effort"))) return; // the panel's chips name them, right above
			texts.push({ x: b.x0, y: top - 36, t: a, color: INK, size: 13, weight: 600 });
			texts.push({ x: b.x0, y: top - 18, t: sub, color: subColor, size: 12.5, weight: 500 });
		};
		if (view === "scale" || view === "bins" || view === "icml") {
			const gap = b.narrow ? 10 : 30;
			const p = Math.max(4, Math.min((bw - 3 * gap) / 40, (bh - 120) / 10, 17));
			const gw = 10 * p, x0 = b.x0 + (bw - (4 * gw + 3 * gap)) / 2, y = b.y0 + (bh - gw) * 0.4 + 10;
			const bins = BINS[dom][model];
			const slots = view === "icml" ? [0, 3] : [0, 1, 2, 3];
			for (const s of slots) {
				const x = x0 + s * (gw + gap), cx = x + gw / 2;
				if (view === "icml") {
					const v = s === 0 ? ICML.rated_0 : ICML.rated_3, label = s === 0 ? "0" : "3";
					groups.push({ id: `b${s}`, x, y, p, cols: 10, n: 100, lit: v, alpha: 1, tip: [`${L.familiarity_axis} ${label}`, `${v}%`, `${F.captions.icml.t}, ${ICML.model}`], aria: `${L.familiarity_axis} ${label}: ${v}%` });
					texts.push({ x: cx, y: y - 22, t: `${v}%`, color: INK, size: 22, weight: 600, align: "center" });
					texts.push({ x: cx, y: y + gw + 18, t: label, color: INK, size: 13, weight: 600, align: "center" });
					continue;
				}
				const bn = bins[s];
				texts.push({ x: cx, y: y + gw + 18, t: bn.bin, color: INK, size: 13, weight: 600, align: "center" });
				if (!bn.shown) {
					paths.push({ pts: [[x, y], [x + gw, y], [x + gw, y + gw], [x, y + gw], [x, y]], color: "rgba(20,32,45,.25)", width: 1, dash: [3, 4], progress: 1 });
					texts.push({ x: cx, y: y + gw / 2, t: `n = ${bn.n}`, color: INK2, size: 11.5, align: "center" });
					continue;
				}
				const lit = view === "scale" ? 0 : bn.tiles;
				groups.push({ id: `b${s}`, x, y, p, cols: 10, n: 100, lit, alpha: 1,
					tip: [`${L.familiarity_axis} ${bn.bin}`, view === "scale" ? `${bn.n} texts` : `${pct(bn.pct)}`, ...(view === "scale" ? [] : [`${bn.k} of ${bn.n} texts`]), `${DOMS[dom]}, ${MODELS[model]}`],
					aria: `${L.familiarity_axis} ${bn.bin}: ${view === "scale" ? `${bn.n} texts` : `${bn.k} of ${bn.n} texts, ${pct(bn.pct)}`}` });
				if (view === "scale") texts.push({ x: cx, y: y - 12, t: `${bn.n} texts`, color: INK2, size: 11.5, align: "center" });
				else {
					texts.push({ x: cx, y: y - 30, t: bn.tiles === 0 && bn.pct > 0 ? "<1%" : `${bn.tiles}%`, color: INK, size: 22, weight: 600, align: "center" });
					texts.push({ x: cx, y: y - 11, t: `${bn.k} of ${bn.n}`, color: INK2, size: 11.5, align: "center" });
				}
			}
			texts.push({ x: x0 + (4 * gw + 3 * gap) / 2, y: y + gw + 42, t: `${L.familiarity_axis} →`, color: INK2, size: 12, align: "center" });
			if (view === "icml") title(y - 56, F.captions.icml.t, ICML.model, CLAY);
			else title(y - 56, DOMS[dom], MODELS[model]);
		} else if (view === "proxies") {
			// AUC on a 0.5–1 line: the model's own rating against posting activity, for the same Reddit accounts
			const ax0 = b.x0 + (b.narrow ? 16 : 40), ax1 = b.x1 - (b.narrow ? 16 : 40), ay = b.y0 + bh * 0.55;
			const X = (v: number) => ax0 + ((v - 0.5) / 0.5) * (ax1 - ax0);
			paths.push({ pts: [[ax0, ay], [ax1, ay]], color: "rgba(20,32,45,.35)", width: 1.2, progress: 1 });
			for (let v = 0.5; v <= 1.0001; v += 0.1) {
				paths.push({ pts: [[X(v), ay - 4], [X(v), ay + 4]], color: "rgba(20,32,45,.35)", width: 1, progress: 1 });
				texts.push({ x: X(v), y: ay + 20, t: v.toFixed(1), color: INK2, size: 11.5, align: "center" });
			}
			texts.push({ x: ax1, y: ay + 42, t: "AUC", color: INK2, size: 12, weight: 600, align: "right" });
			const pts = [
				{ id: "act", v: P.auc_activity, label: L.proxy_activity, color: GRAY, align: "right" as CanvasTextAlign, dx: 8 },
				{ id: "fam", v: P.auc_familiarity, label: L.proxy_familiarity, color: TEAL, align: "left" as CanvasTextAlign, dx: -8 },
			];
			for (const q of pts) {
				const x = X(q.v);
				texts.push({ x: x + q.dx, y: ay - 46, t: q.v.toFixed(2), color: q.id === "fam" ? TEAL : INK, size: 28, weight: 600, align: q.align });
				texts.push({ x: x + q.dx, y: ay - 22, t: q.label, color: INK2, size: 12.5, weight: 500, align: q.align });
				groups.push({ id: q.id, x: x - 10, y: ay - 10, p: 20, cols: 1, n: 1, lit: 1, alpha: 1, round: true, color: q.color,
					tip: [q.label, `AUC ${q.v.toFixed(2)}`, `${P.reddit_accounts.toLocaleString("en-US")} ${DOMS.reddit} accounts, ${MODELS.Opus}`], aria: `${q.label}: AUC ${q.v.toFixed(2)}` });
			}
			title(ay - 90, DOMS.reddit, MODELS.Opus);
		} else {
			// effort x familiarity: one 100-tile block per table cell, familiarity across, effort down
			const em = EFF[emodel];
			const focus = view === "effort_focus";
			const lw = b.narrow ? 38 : 60, head = b.narrow ? 34 : 28, foot = 36;
			const gx = b.narrow ? 6 : 18, gy = b.narrow ? 6 : 12;
			const p = Math.max(2.4, Math.min((bw - lw - 3 * gx) / 40, (bh - head - foot - 3 * gy) / 40, 13));
			const gw = 10 * p, total = lw + 4 * gw + 3 * gx;
			const x0 = b.x0 + (bw - total) / 2 + lw, y0 = b.y0 + (bh - (head + 4 * gw + 3 * gy + foot)) / 2 + head;
			em.rows.forEach((row, c) => {
				const x = x0 + c * (gw + gx), cx = x + gw / 2, on = !focus || c === 1;
				const words = row.familiarity.split(" ");
				const lines = b.narrow && words.length > 1 ? [words.slice(0, -1).join(" "), words[words.length - 1]] : [row.familiarity];
				lines.forEach((t, li) => texts.push({ x: cx, y: y0 - 14 - (lines.length - 1 - li) * 12, t, color: on ? INK : INK2, size: b.narrow ? 10 : 12, weight: 600, align: "center" }));
				row.cells.forEach((v, r) => {
					groups.push({ id: r === 0 ? `b${c}` : `e${c}${r}`, x, y: y0 + r * (gw + gy), p, cols: 10, n: 100, lit: Math.round(v), alpha: on ? 1 : 0.32,
						tip: [`${row.familiarity}, ${em.efforts[r]}`, pct(v), emodel], aria: `${emodel}, ${row.familiarity}, ${em.efforts[r]}: ${pct(v)}` });
				});
				if (focus) texts.push({ x: cx, y: y0 + 4 * gw + 3 * gy + 20, t: signed(row.gain), color: c === 1 ? TEAL : INK2, size: c === 1 ? 16 : 12.5, weight: c === 1 ? 700 : 500, align: "center" });
				if (focus && c === 1) paths.push({ pts: [[x - 7, y0 - 34], [x + gw + 7, y0 - 34], [x + gw + 7, y0 + 4 * gw + 3 * gy + 34], [x - 7, y0 + 4 * gw + 3 * gy + 34], [x - 7, y0 - 34]], color: TEAL, width: 1.6, progress: 1 });
			});
			em.efforts.forEach((e, r) => texts.push({ x: x0 - 10, y: y0 + r * (gw + gy) + gw / 2, t: e, color: INK, size: b.narrow ? 10.5 : 12.5, weight: 500, align: "right" }));
			if (focus) texts.push({ x: x0 - 10, y: y0 + 4 * gw + 3 * gy + 20, t: "Δ", color: INK2, size: 13, weight: 600, align: "right" });
			if (!b.narrow) texts.push({ x: x0 - 10, y: y0 - 14, t: `${L.effort_axis} ↓`, color: INK2, size: 11, align: "right" });
			title(y0 - (b.narrow ? 50 : 44), DOMS.reddit, emodel, emodel === "Fable 5.2" ? CLAY : INK2);
		}
		return { groups, texts, paths };
	});
	const hovered = $derived(sel ? geo.groups.find((g) => g.id === sel) ?? null : null);

	let grow = 1; // fill animation, 0..1, restarts when what the tiles show changes
	let lastKey = "";
	function draw(dt: number, reduce: boolean) {
		const key = geo.groups.map((g) => `${g.id}:${g.lit}`).join("|"); // refill only when the lit counts change
		if (key !== lastKey) { lastKey = key; grow = reduce ? 1 : 0; }
		grow = Math.min(1, grow + dt / 1.2);
		const r = stage.getBoundingClientRect();
		const ox = r.left, oy = r.top;
		const marks: Mark[] = [];
		for (const g of geo.groups) {
			const rows = Math.ceil(g.n / g.cols);
			const lit = g.lit * (1 - Math.pow(1 - grow, 3));
			for (let i = 0; i < g.n; i++) {
				const col = i % g.cols, row = Math.floor(i / g.cols);
				marks.push({
					id: `${OWNER}:${g.id}:${i}`, square: !g.round,
					x: ox + g.x + col * g.p + g.p / 2, y: oy + g.y + (rows - 1 - row) * g.p + g.p / 2,
					r: g.round ? 8 : g.p * 0.38, color: g.color ?? (i < lit ? TEAL : OFF), alpha: g.alpha,
				});
			}
		}
		const paths = geo.paths.map((p) => ({ ...p, pts: p.pts.map(([x, y]) => [x + ox, y + oy] as [number, number]) }));
		if (hovered) {
			const g = hovered, w = g.cols * g.p, h = Math.ceil(g.n / g.cols) * g.p;
			const x = ox + g.x - 4, y = oy + g.y - 4;
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
			if (i !== step) { step = i; sel = null; open = false; }
		}), { rootMargin: "-45% 0px -45% 0px" });
		steps.forEach((s) => so.observe(s));
		return () => { cancelAnimationFrame(raf); io.disconnect(); so.disconnect(); };
	});
</script>

<section class="fa" id={F.id} data-rq="0" bind:this={root} style="--steps:{STEPS.length}">
	<div class="stick" bind:this={stage} bind:clientWidth={W} bind:clientHeight={H}>
		<div class="panel">
			<p class="kick"><span class="badge">{F.n}</span>{F.title.t}</p>
			<h2>{F.takeaway.t}</h2>
			<div class="say" aria-live="polite">
				<p class="say-n">{#each STEPS as _, i}<i class:on={step === i}></i>{/each}</p>
				{#key step}
					<p class="say-t">{st.t}</p>
					{#if st.more}<p class="say-m">{st.more.t}</p>{/if}
				{/key}
				{#if st.details}
					<button type="button" class="more" aria-expanded={open} onclick={() => (open = !open)}>Details <Icon name="arrow" class={open ? "up" : "down"} /></button>
					{#if open}
						<div class="det">
							{#if view === "proxies"}
								<p>{st.details[0].t}</p>
								<p class="rho-h">{F.captions.icml.t}</p>
								<p>{st.details[1].t}.</p>
								<p class="rho-h">ρ, {F.captions.rho.t}</p>
								<ul class="rho">
									<li><b>{P.rho_dolma.toFixed(2)}</b>{L.proxy_dolma}</li>
									<li><b>{P.rho_papers.toFixed(2)}</b>{L.proxy_papers}</li>
									<li><b>{P.rho_citations.toFixed(2)}</b>{L.proxy_cites}</li>
								</ul>
							{:else}
								{#each st.details as d}<p>{d.t}</p>{/each}
							{/if}
						</div>
					{/if}
				{/if}
			</div>
			{#if view === "bins"}
				<div class="ctrl" role="group" aria-label="Domain">
					{#each Object.entries(DOMS) as [id, t]}<button type="button" aria-pressed={dom === id} onclick={() => (dom = id)}>{t}</button>{/each}
				</div>
				<div class="ctrl" role="group" aria-label="Model">
					{#each Object.entries(MODELS) as [id, t]}<button type="button" aria-pressed={model === id} onclick={() => (model = id)}>{t}</button>{/each}
				</div>
			{:else if view === "effort" || view === "effort_focus"}
				<div class="ctrl" role="group" aria-label="Model">
					{#each EMODELS as m}<button type="button" class:fable={m === "Fable 5.2"} aria-pressed={emodel === m} onclick={() => (emodel = m)}>{m}</button>{/each}
				</div>
			{/if}
			{#if view !== "proxies"}
				<p class="key"><span><i class="k-lit"></i>Correct</span><span><i class="k-off"></i>1 tile = 1% of texts</span></p>
			{/if}
			<p class="cap">
				{#if view === "effort" || view === "effort_focus"}{F.captions.effort.t} Δ: {F.captions.gain.t}.
				{:else if view === "bins" && dom === "public_reviews"}{F.captions.bins.t} {F.captions.public_reviews.t}
				{:else}{F.captions.bins.t}{/if}
			</p>
		</div>
		<!-- hover and keyboard targets over each tile group; the canvas itself is aria-hidden -->
		<div class="hits">
			{#each geo.groups as g (g.id)}
				<button type="button" class="hit" aria-label={g.aria}
					style="left:{g.x - 4}px; top:{g.y - 4}px; width:{g.cols * g.p + 8}px; height:{Math.ceil(g.n / g.cols) * g.p + 8}px"
					onpointerenter={() => (sel = g.id)} onpointerleave={() => (sel = sel === g.id ? null : sel)}
					onfocus={() => (sel = g.id)} onblur={() => (sel = sel === g.id ? null : sel)}
					onclick={() => (sel = sel === g.id ? null : g.id)}></button>
			{/each}
		</div>
		{#if hovered && active}
			{@const gw = hovered.cols * hovered.p}
			<div class="tip" class:flip={hovered.x + gw > W - 230} style="left:{hovered.x + gw + 12}px; top:{hovered.y}px; --gw:{gw + 24}px" role="status">
				<b>{hovered.tip[0]}</b>
				<span class="tv">{hovered.tip[1]}</span>
				{#each hovered.tip.slice(2) as t}<span>{t}</span>{/each}
			</div>
		{/if}
	</div>
	<div class="steps" aria-hidden="true">{#each STEPS as _}<div class="step"></div>{/each}</div>
</section>

<style>
	.fa { position: relative; margin-top: 40px; height: calc((var(--steps) + 1) * 85vh); }
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
	.more { margin-top: 10px; display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 600; color: var(--ink); padding: 4px 0; }
	.more :global(.down) { transform: rotate(90deg); transition: transform .2s; }
	.more :global(.up) { transform: rotate(-90deg); transition: transform .2s; }
	.det { margin-top: 6px; display: grid; gap: 8px; font-size: 13px; line-height: 1.5; color: var(--ink2); }
	.rho-h { color: var(--ink); font-weight: 500; }
	.rho { display: flex; flex-wrap: wrap; gap: 4px 14px; }
	.rho li { display: inline-flex; align-items: baseline; gap: 6px; }
	.rho b { font-size: 18px; font-weight: 600; color: var(--ink); font-variant-numeric: tabular-nums; }
	.ctrl { display: inline-flex; flex-wrap: wrap; gap: 2px; background: var(--chip); border-radius: 3px; padding: 3px; justify-self: start; }
	.ctrl button { padding: 5px 9px; font-size: 12.5px; font-weight: 500; color: var(--ink2); border-radius: 2px; }
	.ctrl button:hover { color: var(--ink); }
	.ctrl button.fable { color: var(--fable); }
	.ctrl button[aria-pressed="true"] { background: var(--ink); color: var(--field); }
	.key { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 12px; color: var(--ink2); }
	.key span { display: inline-flex; align-items: center; gap: 6px; }
	.key i { display: inline-block; width: 10px; height: 10px; }
	.k-lit { background: #437E8E; } .k-off { background: #C3C4BD; }
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
		.panel .cap, .panel .key { display: none; }
		.say-m { font-size: 13px; }
	}
	@media (prefers-reduced-motion: reduce) { .say-t, .say-m { animation: none; } .more :global(.ic) { transition: none; } }
</style>
