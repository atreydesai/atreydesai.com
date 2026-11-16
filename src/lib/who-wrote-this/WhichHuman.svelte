<script lang="ts">
	// If human, which human? Section 3 draws counts as square tiles on the page's field. Tiles are a drawing of the
	// paper's aggregate counts (lit ones fill from the top-left as one block): never individual texts, reviewers or
	// per-review results. Scrolling moves the same tiles (stable ids, so DotField tweens them) through five views:
	// the ICML 2020 reviews (1 tile = 10 reviews), Fable 5.2 against Opus 5.5 on them, Figure 1's other sets
	// (1 tile = 1 text), stated confidence on public texts (1 tile = 1 answer), then the paper's Oates example.
	// The on-demand layer is DOM controls only (the canvas takes no pointer events). Strings and numbers come from
	// rq3.json, built in the private llm-detectors repo by docs/launch_20261116/tools/build_rq3_data.py.
	import { onMount } from "svelte";
	import Icon from "./Icon.svelte";
	import { field, chart, type Mark, type Path, type Text } from "./field.svelte";
	import S from "./rq3.json";

	type View = "icml" | "models" | "domains" | "confidence" | "example";
	type Dom = (typeof S.domains)[number];
	type Block = { id: string; n: number; k: number; x: number; y: number; cols: number; s: number; alpha: number };
	type Hit = { id: string; x: number; y: number; w: number; h: number };
	type Box = { x0: number; x1: number; y0: number; y1: number };

	const OWNER = "rq3";
	const TEAL = "#437E8E", GRAY = "#B7B8B1", INK = "#14202D", INK2 = "#5A6270", TINK = "#0A2B34", FAINT = "#A3A7AC";
	const FONT = "Inter, system-ui, sans-serif";
	const LAYOUTS = [[["famous", "nature", "papers"], ["active", "inactive"]], [["famous", "nature"], ["papers", "inactive"], ["active"]]];
	const ICON: Record<string, string> = { famous: "book", nature: "nature", papers: "arxiv", active: "reddit", inactive: "reddit" };
	const dom = (id: string) => S.domains.find((d) => d.id === id)!;
	const fmt = (v: number) => v.toLocaleString("en-US");

	let step = $state(0);
	let active = $state(false);
	let match = $state<"lenient" | "exact">("lenient");
	let model = $state<"fable52" | "opus">("fable52");
	let dsel = $state<string | null>(null);
	let dpeek = $state<string | null>(null);
	let cmode = $state<"groups" | "bins">("groups");
	let open = $state(false);
	let cue = $state<string | null>(null);
	let hits = $state<Hit[]>([]);
	let stage: HTMLElement;
	let panel: HTMLElement;
	let root: HTMLElement;

	const privacy = (S.steps[0] as { more?: { t: string } }).more?.t;
	const view = $derived(S.steps[step].view as View);
	const focusD = $derived(dpeek ?? dsel);
	const st = $derived(S.steps[step] as (typeof S.steps)[number] & { more?: { t: string }; alt?: { t: string } });
	const more = $derived(
		view === "icml" ? (match === "exact" ? st.alt?.t : null)
		: view === "domains" ? (focusD ? dom(focusD).more.t : null)
		: st.more?.t ?? null,
	);
	const lit = (c: string) => open && (cue === null || cue === c);
	const pick = (c: string) => { if (open) cue = cue === c ? null : c; };
	const key = (e: KeyboardEvent, c: string) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(c); } };

	// --- drawing ----------------------------------------------------------------------------------------------
	const anim: Record<string, number> = {}; // lit tiles shown per block, eased toward the target count
	let reduce = false;
	let meter: CanvasRenderingContext2D | null = null;
	const tw = (t: string, size: number, weight = 400) => {
		if (!meter) return t.length * size * 0.56;
		meter.font = `${weight} ${size}px ${FONT}`;
		return meter.measureText(t).width;
	};

	function place(b: Block, marks: Mark[], base: number, dt: number) {
		let cur = anim[b.id] ?? (reduce ? b.k : 0);
		const d = b.k - cur, speed = Math.max(Math.abs(d) * 3, b.n * 0.45, 30) * dt;
		cur = reduce || Math.abs(d) <= speed ? b.k : cur + Math.sign(d) * speed;
		anim[b.id] = cur;
		const on = Math.round(cur);
		for (let i = 0; i < b.n; i++)
			marks.push({ id: `t${base + i}`, square: true, x: b.x + (i % b.cols) * b.s + b.s / 2, y: b.y + Math.floor(i / b.cols) * b.s + b.s / 2, r: b.s * 0.36, color: i < on ? TEAL : GRAY, alpha: b.alpha });
		return base + b.n;
	}

	// the lower edge of the first c tiles of a block, as a stair line
	function edge(b: Block, c: number): [number, number][] {
		const full = Math.floor(c / b.cols), rem = c % b.cols, xr = b.x + b.cols * b.s, y = (r: number) => b.y + r * b.s;
		return rem === 0 ? [[b.x, y(full)], [xr, y(full)]] : [[b.x, y(full + 1)], [b.x + rem * b.s, y(full + 1)], [b.x + rem * b.s, y(full)], [xr, y(full)]];
	}

	const icmlLabel = (o: { t: string }) => o.t;
	const ICML_LABELS = [...S.icml.match.map((m) => `${m.label} · ${m.pct}%`), ...S.models.map((m) => `${m.short} · ${m.pct}%`)];

	// on a phone the toggle carries the numbers and the field takes the full width
	const tight = (box: Box) => box.x1 - box.x0 < 520;

	function icmlBlock(box: Box, k: number): Block {
		const room = tight(box) ? 0 : Math.max(...ICML_LABELS.map((t) => tw(t, 13, 600))) + 16;
		const n = S.icml.tiles, W = box.x1 - box.x0 - room, H = box.y1 - box.y0 - 30;
		let s = Math.min(19, Math.sqrt((W * H) / n)), cols = 0;
		for (; s > 3; s -= 0.25) { cols = Math.floor(W / s); if (Math.ceil(n / cols) * s <= H) break; }
		return { id: "icml", n, k, x: box.x0, y: box.y0 + 30, cols, s, alpha: 1 };
	}

	function drawIcml(box: Box, marks: Mark[], paths: Path[], texts: Text[], dt: number) {
		const opts = view === "models"
			? S.models.map((m) => ({ id: m.id, t: `${m.short} · ${m.pct}%`, lit: m.lit }))
			: S.icml.match.map((m) => ({ id: m.id, t: `${m.label} · ${m.pct}%`, lit: m.lit }));
		const sel = view === "models" ? model : match;
		const cur = opts.find((o) => o.id === sel)!;
		const b = icmlBlock(box, cur.lit);
		place(b, marks, 0, dt);
		texts.push({ x: b.x, y: box.y0 + 8, t: "ICML 2020 reviews", color: INK, size: 13, weight: 600 });
		texts.push({ x: b.x + b.cols * b.s, y: box.y0 + 8, t: S.steps[step].cap, color: INK2, size: 11.5, align: "right" });
		// the selected answer is lit; in the model view the other model's count is marked too
		const shown = view === "models" ? opts : opts.filter((o) => o.id === sel || match === "exact");
		for (const o of shown) {
			const on = o.id === sel;
			const pts = edge(b, on ? Math.round(anim.icml) : o.lit);
			paths.push({ pts, color: on ? INK : INK2, width: on ? 1.6 : 1.3, dash: on ? undefined : [3, 3], progress: 1 });
			const [ex, ey] = pts[pts.length - 1];
			if (!tight(box)) texts.push({ x: ex + 8, y: ey, t: icmlLabel(o), color: on ? INK : INK2, size: on ? 13 : 12, weight: on ? 600 : 500 });
		}
	}

	function drawDomains(box: Box, marks: Mark[], texts: Text[], dt: number, r: DOMRect) {
		const W = box.x1 - box.x0, H = box.y1 - box.y0, top = 50, gap = 34, rowGap = 26;
		const count = (d: Dom) => `${d.k} of ${d.n} ${d.unit}`;
		const lw = (d: Dom) => Math.max(tw(d.label.t, 13, 600), tw(count(d), 11.5), d.sub ? tw(d.sub.t, 11.5) : 0) + 6;
		const bottom = (d: Dom) => (d.sub ? 40 : 24);
		let placed: { d: Dom; x: number; y: number; cols: number; rows: number; s: number }[] = [];
		search: for (const rows of LAYOUTS)
			for (let s = 20; s >= 4; s -= 0.5) {
				const out: typeof placed = [];
				let y = box.y0, ok = true;
				for (const row of rows) {
					const ds = row.map(dom), cols = ds.map((d) => Math.ceil(Math.sqrt(d.n * 1.5)));
					const slots = ds.map((d, i) => Math.max(cols[i] * s, lw(d)));
					if (slots.reduce((a, v) => a + v, 0) + gap * (row.length - 1) > W) ok = false;
					const h = Math.max(...ds.map((d, i) => Math.ceil(d.n / cols[i]) * s + bottom(d)));
					let x = box.x0;
					ds.forEach((d, i) => { out.push({ d, x, y: y + top, cols: cols[i], rows: Math.ceil(d.n / cols[i]), s }); x += slots[i] + gap; });
					y += top + h + rowGap;
				}
				placed = out;
				if (ok && y - rowGap <= box.y0 + H) break search;
			}
		let base = 0;
		const nh: Hit[] = [];
		for (const p of S.domains.map((d) => placed.find((q) => q.d.id === d.id)!)) {
			const d = p.d, on = !focusD || focusD === d.id;
			base = place({ id: `d:${d.id}`, n: d.n, k: d.k, x: p.x, y: p.y, cols: p.cols, s: p.s, alpha: on ? 1 : 0.2 }, marks, base, dt);
			const yb = p.y + p.rows * p.s;
			texts.push({ x: p.x, y: p.y - 38, t: d.label.t, color: on ? INK : FAINT, size: 13, weight: 600 });
			texts.push({ x: p.x, y: p.y - 15, t: `${d.pct}%`, color: on ? TINK : FAINT, size: 22, weight: 600 });
			texts.push({ x: p.x, y: yb + 13, t: count(d), color: on ? INK2 : FAINT, size: 11.5 });
			if (d.sub) texts.push({ x: p.x, y: yb + 29, t: d.sub.t, color: on ? INK2 : FAINT, size: 11.5 });
			nh.push({ id: d.id, x: p.x - r.left - 8, y: p.y - 50 - r.top, w: Math.max(p.cols * p.s, lw(d)) + 16, h: yb - p.y + 50 + bottom(d) + 4 });
		}
		const sig = (hs: Hit[]) => hs.map((h) => `${h.id}${h.x | 0},${h.y | 0},${h.w | 0},${h.h | 0}`).join();
		if (sig(nh) !== sig(hits)) hits = nh;
	}

	function drawConfidence(box: Box, marks: Mark[], texts: Text[], dt: number) {
		const C = S.confidence, bins = cmode === "bins";
		type G = { id: string; label: string; n: number; k: number; pct?: number; share?: number };
		const list: G[] = (bins ? C.bins : C.groups).map((g) => ({ ...g, id: `c:${g.id}` }));
		const top = 52, gap = bins ? 26 : 36, W = box.x1 - box.x0;
		const big = (g: G) => !bins && g.pct !== undefined;
		const line2 = (g: G) => (big(g) ? `${g.pct}% correct` : `${fmt(g.k)} of ${fmt(g.n)} correct`);
		const lw = (g: G) => Math.max(tw(g.label, 13, 600), tw(line2(g), big(g) ? 20 : 11.5, 600)) + 6;
		let placed: { g: G; x: number; y: number; cols: number; s: number }[] = [];
		if (!bins) {
			// two fields side by side, as tall as the stage
			let s = 18, cols: number[] = [];
			for (; s > 3; s -= 0.25) {
				const R = Math.max(1, Math.floor((box.y1 - box.y0 - top - 40) / s));
				cols = list.map((g) => Math.ceil(g.n / R));
				if (list.reduce((a, g, i) => a + Math.max(cols[i] * s, lw(g)), 0) + gap * (list.length - 1) <= W) break;
			}
			let x = box.x0;
			placed = list.map((g, i) => { const p = { g, x, y: box.y0 + top, cols: cols[i], s }; x += Math.max(cols[i] * s, lw(g)) + gap; return p; });
		} else {
			// five near-square sets, wrapped in rows like the text sets
			for (let s = 16; s > 3; s -= 0.25) {
				let x = box.x0, y = box.y0, rowH = 0, ok = true;
				placed = [];
				for (const g of list) {
					const cols = Math.ceil(Math.sqrt(g.n * 1.4)), w = Math.max(cols * s, lw(g)), h = top + Math.ceil(g.n / cols) * s + 12;
					if (x > box.x0 && x + w > box.x1) { x = box.x0; y += rowH + 22; rowH = 0; }
					if (x + w > box.x1) ok = false;
					placed.push({ g, x, y: y + top, cols, s });
					x += w + gap; rowH = Math.max(rowH, h);
				}
				if (ok && y + rowH <= box.y1) break;
			}
		}
		let base = 0;
		for (const { g, x, y, cols, s } of placed) {
			base = place({ id: g.id, n: g.n, k: g.k, x, y, cols, s, alpha: 1 }, marks, base, dt);
			texts.push({ x, y: y - 38, t: g.label, color: INK, size: 13, weight: 600 });
			texts.push({ x, y: y - 15, t: line2(g), color: big(g) ? TINK : INK2, size: big(g) ? 20 : 11.5, weight: big(g) ? 600 : 400 });
			const yb = y + Math.ceil(g.n / cols) * s;
			if (!bins) texts.push({ x, y: yb + 14, t: big(g) ? `${fmt(g.k)} of ${fmt(g.n)} correct` : `${fmt(g.n)} answers`, color: INK2, size: 11.5 });
			if (big(g)) texts.push({ x, y: yb + 30, t: `${g.share}% of responses`, color: INK2, size: 11.5 });
		}
	}

	function layout(dt: number) {
		const r = stage.getBoundingClientRect();
		const narrow = r.width < 860;
		const box: Box = narrow
			? { x0: r.left + 8, x1: r.right - 8, y0: Math.max(panel.getBoundingClientRect().bottom + 28, r.top + r.height * 0.3), y1: r.bottom - 28 }
			: { x0: r.left + r.width * 0.36, x1: r.right - 24, y0: r.top + 72, y1: r.bottom - 48 };
		const marks: Mark[] = [], paths: Path[] = [], texts: Text[] = [];
		if (view === "icml" || view === "models") drawIcml(box, marks, paths, texts, dt);
		else if (view === "domains") drawDomains(box, marks, texts, dt, r);
		else if (view === "confidence") drawConfidence(box, marks, texts, dt);
		// the example: every tile settles back into the ground
		if (view !== "domains" && hits.length) hits = [];
		// blocks that left the view start from zero when they come back
		const keep = new Set(marks.length ? (view === "domains" ? S.domains.map((d) => `d:${d.id}`) : view === "confidence" ? [...S.confidence.bins, ...S.confidence.groups].map((g) => `c:${g.id}`) : ["icml"]) : []);
		for (const k in anim) if (!keep.has(k)) delete anim[k];
		chart.marks = marks; chart.paths = paths; chart.texts = texts;
	}

	function go(i: number) {
		const el = root.querySelectorAll(".step")[i];
		if (el) scrollTo({ top: el.getBoundingClientRect().top + scrollY - innerHeight * 0.3, behavior: reduce ? "instant" : "smooth" });
	}

	onMount(() => {
		reduce = matchMedia("(prefers-reduced-motion: reduce)").matches || new URLSearchParams(location.search).has("still");
		meter = document.createElement("canvas").getContext("2d");
		let raf = 0, last = performance.now();
		const loop = (now: number) => {
			const dt = Math.min(0.05, (now - last) / 1000); last = now;
			// retake the canvas if a neighbour left it on the plain ground while this section is in view
			if (active && field.mode === "ground") { field.mode = "chart"; field.owner = OWNER; field.dim = 0.75; field.interactive = false; field.hover = null; }
			if (active && field.owner === OWNER) layout(dt);
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		const release = () => {
			if (field.owner !== OWNER) return;
			if (field.mode === "chart") field.mode = "ground";
			field.dim = 0; field.interactive = false; chart.marks = []; chart.paths = []; chart.texts = [];
		};
		const io = new IntersectionObserver((es) => es.forEach((e) => {
			active = e.isIntersecting;
			if (active) { field.mode = "chart"; field.owner = OWNER; field.dim = 0.75; field.interactive = false; field.hover = null; }
			else release();
		}), { rootMargin: "-35% 0px -35% 0px" });
		io.observe(root);
		const steps = [...root.querySelectorAll(".step")];
		const so = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) step = steps.indexOf(e.target); }), { rootMargin: "-45% 0px -45% 0px" });
		steps.forEach((s) => so.observe(s));
		return () => { cancelAnimationFrame(raf); io.disconnect(); so.disconnect(); release(); if (field.owner === OWNER) field.owner = ""; };
	});
</script>

<section class="wh" id={S.id} data-rq={S.rq} bind:this={root} style="--steps:{S.steps.length}">
	<div class="stick" bind:this={stage}>
		<div class="panel" bind:this={panel}>
			<p class="kick"><span class="badge">{S.n}</span>{S.title.t}</p>
			<h2>{S.takeaway.t}</h2>
			<p class="ctx">{S.context.t}</p>
			<p class="key">
				<span><i class="k-yes"></i>{S.legend[0].t}</span><span><i class="k-no"></i>{S.legend[1].t}</span>
			</p>
			<p class="by"><Icon name="ai" class="fable" /><em>{S.model}</em></p>
			<div class="say">
				<p class="say-n">
					{#each S.steps as _, i}<button type="button" class:on={step === i} aria-label="Step {i + 1} of {S.steps.length}" aria-current={step === i ? "step" : undefined} onclick={() => go(i)}><i></i></button>{/each}
				</p>
				<div aria-live="polite">{#key step}<p class="say-t">{st.t}</p>{/key}</div>

				{#if view === "icml"}
					<div class="seg" role="group" aria-label="Name match">
						{#each S.icml.match as m}<button type="button" aria-pressed={match === m.id} onclick={() => (match = m.id as typeof match)}>{m.label}<b>{m.pct}%</b></button>{/each}
					</div>
				{:else if view === "models"}
					<div class="seg" role="group" aria-label="Model">
						{#each S.models as m}<button type="button" aria-pressed={model === m.id} onclick={() => (model = m.id as typeof model)}><Icon name="ai" class={m.id === "fable52" ? "fable" : ""} />{m.short}<b>{m.pct}%</b></button>{/each}
					</div>
				{:else if view === "domains"}
					<div class="chips" role="group" aria-label="Texts">
						<button type="button" aria-pressed={dsel === null} onclick={() => (dsel = null)}>All</button>
						{#each S.domains as d}
							<button type="button" aria-pressed={dsel === d.id} onclick={() => (dsel = dsel === d.id ? null : d.id)} onpointerenter={() => (dpeek = d.id)} onpointerleave={() => (dpeek = null)} onfocus={() => (dpeek = d.id)} onblur={() => (dpeek = null)}><Icon name={ICON[d.id]} />{d.label.t}</button>
						{/each}
					</div>
				{:else if view === "confidence"}
					<div class="seg" role="group" aria-label="Confidence">
						<button type="button" aria-pressed={cmode === "groups"} onclick={() => (cmode = "groups")}>2 groups</button>
						<button type="button" aria-pressed={cmode === "bins"} onclick={() => (cmode = "bins")}>5 bins</button>
					</div>
				{/if}
				{#if more}<p class="more" aria-live="polite">{more}</p>{/if}
			</div>
			{#if view === "icml" || view === "models"}<p class="cap"><Icon name="icml" />{privacy}</p>
			{:else if st.cap}<p class="cap scale"><i></i>{st.cap}</p>{/if}
		</div>

		{#if active && view === "domains"}
			{#each hits as h (h.id)}
				{@const d = dom(h.id)}
				<button type="button" class="hit" class:on={dsel === h.id} style="left:{h.x}px; top:{h.y}px; width:{h.w}px; height:{h.h}px" aria-pressed={dsel === h.id} aria-label="{d.label.t}, {d.pct}%" onclick={() => (dsel = dsel === h.id ? null : h.id)} onpointerenter={() => (dpeek = h.id)} onpointerleave={() => (dpeek = null)} onfocus={() => (dpeek = h.id)} onblur={() => (dpeek = null)}></button>
			{/each}
		{/if}

		{#if view === "example"}
			{@const E = S.example}
			<figure class="card">
				<p class="c-src"><Icon name="book" />{E.kind.t}: <em>{E.title.t}</em></p>
				<blockquote class="c-text" class:open>
					“{#each E.text as seg}{#if seg.cue && open}<span role="button" tabindex="0" class="cue {seg.cue}" class:dim={!lit(seg.cue)} aria-pressed={cue === seg.cue} onclick={() => pick(seg.cue!)} onkeydown={(e) => key(e, seg.cue!)}>{seg.t}</span>{:else}{seg.t}{/if}{/each}”
				</blockquote>
				<div class="c-pred">
					<span class="c-role">{E.role}</span>
					<span class="c-ans"><Icon name="check" class="ok" />{E.answer}</span>
					<span class="c-conf">Confidence {E.confidence}%</span>
					<span class="c-by"><Icon name="ai" class="fable" />{E.model}</span>
				</div>
				<button type="button" class="c-why" aria-expanded={open} aria-controls="wh-why" onclick={() => { open = !open; cue = null; }}>Explanation<Icon name="arrow" class="c-arrow" /></button>
				<div id="wh-why" class="c-x" hidden={!open}>
					<p>“{#each E.explanation as seg}{#if seg.cue}<span role="button" tabindex="0" class="cue {seg.cue}" class:dim={!lit(seg.cue)} aria-pressed={cue === seg.cue} onclick={() => pick(seg.cue!)} onkeydown={(e) => key(e, seg.cue!)}>{seg.t}</span>{:else}{seg.t}{/if}{/each}”</p>
					<p class="c-note">{E.note.t}</p>
				</div>
			</figure>
		{/if}
	</div>
	<!-- invisible scroll triggers: each one advances the sentence in the panel and what the field draws -->
	<div class="steps" aria-hidden="true">{#each S.steps as _}<div class="step"></div>{/each}</div>
</section>

<style>
	.wh { position: relative; margin-top: 40px; height: calc((var(--steps) + 1) * 85vh); }
	.stick { position: sticky; top: 0; height: 100vh; pointer-events: none; }
	.panel { pointer-events: auto; position: absolute; left: 0; top: 56px; width: min(33%, 350px); display: grid; gap: 11px; }
	.kick { display: flex; align-items: center; gap: 10px; font-size: 14px; font-weight: 600; color: var(--ink2); }
	.badge { display: inline-grid; place-items: center; width: 26px; height: 26px; border-radius: 2px; background: var(--rq3); color: #fff; font-size: 13px; }
	h2 { font-size: clamp(22px, 2.3vw, 29px); line-height: 1.15; font-weight: 600; letter-spacing: -0.025em; text-wrap: balance; }
	.ctx { font-size: 14px; line-height: 1.45; color: var(--ink2); }
	.key { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 12px; color: var(--ink2); }
	.key span { display: inline-flex; align-items: center; gap: 6px; }
	.key i { display: inline-block; width: 9px; height: 9px; }
	.k-yes { background: var(--rq3); } .k-no { background: #B7B8B1; }
	.by { display: flex; align-items: center; gap: 6px; font-size: 12.5px; }
	.by em, .c-by { font-style: italic; font-weight: 500; }
	.by :global(.fable), .seg :global(.fable), .c-by :global(.fable) { color: var(--fable); }
	.say { display: grid; gap: 12px; padding: 14px 16px; background: #fff; border-radius: 3px; }
	.say-n { display: flex; gap: 1px; margin: -6px 0 -6px -5px; }
	.say-n button { padding: 6px 5px; }
	.say-n i { display: block; width: 18px; height: 3px; border-radius: 2px; background: var(--rule); transition: background-color .2s; }
	.say-n button:hover i { background: var(--axis); }
	.say-n button.on i { background: var(--ink); }
	.say-t { font-size: 16px; line-height: 1.5; animation: say .45s var(--ease); }
	@keyframes say { from { opacity: 0; transform: translateY(6px); } }
	.seg { display: inline-flex; flex-wrap: wrap; gap: 2px; justify-self: start; padding: 3px; background: var(--chip); border-radius: 3px; }
	.seg button, .chips button { display: inline-flex; align-items: center; gap: 6px; padding: 5px 9px; font-size: 12.5px; font-weight: 500; color: var(--ink2); border-radius: 2px; transition: background-color .15s, color .15s; }
	.seg button b { font-weight: 600; font-variant-numeric: tabular-nums; color: var(--ink); }
	.seg button:hover, .chips button:hover { color: var(--ink); }
	.seg button[aria-pressed="true"] { background: var(--ink); color: var(--field); }
	.seg button[aria-pressed="true"] b { color: var(--field); }
	.seg button[aria-pressed="true"] :global(.fable) { color: #F0A67C; }
	.chips { display: flex; flex-wrap: wrap; gap: 4px; }
	.chips button { background: var(--field); }
	.chips button[aria-pressed="true"] { background: var(--ink); color: var(--field); }
	.more { font-size: 13.5px; line-height: 1.5; color: var(--ink2); animation: say .35s var(--ease); }
	.cap { display: flex; gap: 7px; font-size: 12px; line-height: 1.45; color: var(--ink2); }
	.cap :global(.ic) { flex: none; margin-top: 2px; }
	.scale { align-items: center; }
	.scale i { width: 8px; height: 8px; background: var(--rq3); }

	/* hit areas over the drawn sets: hover previews, click selects (the tiles themselves take no pointer events) */
	.hit { position: absolute; pointer-events: auto; border-radius: 3px; cursor: pointer; }
	.hit:hover { box-shadow: inset 0 0 0 1px rgba(20, 32, 45, .14); }

	/* the worked example */
	.card { pointer-events: auto; position: absolute; left: 40%; right: 24px; top: 50%; transform: translateY(-50%); max-width: 600px; display: grid; gap: 14px; padding: 22px 24px; background: #fff; border-radius: 3px; animation: card .5s var(--ease); }
	@keyframes card { from { opacity: 0; transform: translateY(calc(-50% + 10px)); } }
	.c-src { display: flex; align-items: center; gap: 7px; font-size: 13px; color: var(--ink2); }
	.c-text { font-size: 20px; line-height: 1.55; letter-spacing: -0.01em; color: var(--ink); }
	.c-pred { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 14px; padding-top: 12px; border-top: 1px solid var(--rule); }
	.c-role { width: 100%; font-size: 11px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--ink2); }
	.c-ans { display: inline-flex; align-items: center; gap: 6px; font-size: 22px; font-weight: 600; letter-spacing: -0.02em; }
	.c-ans :global(.ok) { color: var(--ok); }
	.c-conf { font-size: 13px; color: var(--ink2); font-variant-numeric: tabular-nums; }
	.c-by { display: inline-flex; align-items: center; gap: 5px; margin-left: auto; font-size: 12.5px; }
	.c-why { justify-self: start; display: inline-flex; align-items: center; gap: 7px; padding: 7px 12px; border: 1.25px solid var(--ink); border-radius: 2px; font-size: 13px; font-weight: 500; transition: background-color .15s, color .15s; }
	.c-why:hover { background: var(--ink); color: var(--field); }
	.c-why :global(.c-arrow) { transition: transform .25s var(--ease); }
	.c-why[aria-expanded="true"] :global(.c-arrow) { transform: rotate(90deg); }
	.c-x { display: grid; gap: 8px; padding: 14px 16px; background: var(--field); border-radius: 3px; font-size: 15px; line-height: 1.55; }
	.c-x[hidden] { display: none; }
	.c-note { font-size: 12px; color: var(--ink2); }
	.cue { cursor: pointer; padding: 0 .12em; margin: 0 -.02em; border-radius: 2px; box-decoration-break: clone; -webkit-box-decoration-break: clone; transition: background-color .25s, color .25s, opacity .25s; }
	.cue.rose { color: var(--cue-rose); background: var(--cue-rose-bg); }
	.cue.teal { color: var(--cue-teal); background: var(--cue-teal-bg); }
	.cue.clay { color: var(--cue-clay); background: var(--cue-clay-bg); }
	.cue[aria-pressed="true"] { box-shadow: inset 0 -2px 0 currentColor; }
	.cue.dim { background: transparent; color: var(--ink); opacity: .55; }

	.steps { position: absolute; inset: 0; pointer-events: none; }
	.step { height: 85vh; }
	.step:first-child { margin-top: 20vh; }
	@media (min-width: 861px) and (max-height: 780px) {
		.panel { top: 36px; gap: 8px; }
		.panel .ctx, .panel .key, .panel .by { display: none; }
		h2 { font-size: 22px; }
		.say { gap: 9px; padding: 12px 14px; }
		.say-t { font-size: 15px; }
		.more { font-size: 12.5px; }
	}
	@media (max-width: 860px) {
		.panel { width: auto; right: 0; top: 14px; gap: 8px; }
		.panel .ctx, .panel .key, .panel .by, .panel .cap:not(.scale), .panel .more { display: none; }
		h2 { font-size: 20px; }
		.say { padding: 10px 12px; gap: 8px; }
		.say-t { font-size: 14.5px; }
		.card { left: 0; right: 0; top: auto; bottom: 16px; transform: none; max-height: 54vh; overflow: auto; padding: 16px; }
		@keyframes card { from { opacity: 0; } }
		.c-text { font-size: 17px; }
	}
	@media (prefers-reduced-motion: reduce) { .say-t, .more, .card { animation: none; } .cue, .c-why :global(.c-arrow) { transition: none; } }
</style>
