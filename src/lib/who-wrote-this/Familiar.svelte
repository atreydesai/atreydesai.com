<script lang="ts">
	// Section 4, Who can be identified? A short demo for a reader with no background: the familiarity question as the
	// model sees it (the Reddit probe, quoted from the prompt file), the model's answer, its writers' texts sorted into
	// four groups by that answer, and each group lit to how often the model named the writer (Figure rq3_familiarity,
	// 1 tile = 1% of texts, in the model's colour). Explore, after the story: other domains and models, and the Reddit
	// table of reasoning effort (lowest and highest effort, the gain in the signed "higher" teal). Tiles are abstract: no
	// writer is named or implied. Strings and numbers are the paper's (familiarity.json, built in the private
	// llm-detectors repo by docs/launch_20261116/tools/build_familiarity_anonymity_data.py); `ui` and `demo` list the rest.
	//
	// Performance: nothing runs per frame while idle. The canvas is rebuilt only when an input changes (step, a control,
	// hover, size, the stage's position while it scrolls in or out) and, while a tween moves, on animation frames that
	// stop when it ends. Marks are pooled; DotField's own tween moves them.
	import { onMount } from "svelte";
	import Icon from "./Icon.svelte";
	import Reveal from "./Reveal.svelte";
	import Tags, { type Tag } from "./Tags.svelte";
	import { MODEL, GRAY, INK as INKS, SIGNED, deepen, TILE } from "./palette";
	import { printSprite, printAspect } from "./print/sprites";
	import { field, chart, type Mark, type Path, type Text } from "./field.svelte";
	import F from "./familiarity.json";

	type Bin = { bin: string; shown: boolean; pct: number; tiles: number };
	type ERow = { familiarity: string; low: number; high: number; low_tiles: number; high_tiles: number };
	type EM = { efforts: string[]; rows: ERow[] };
	type G = { x: number; y: number; cx: number; p: number; gw: number };

	const OWNER = "s4-familiar";
	const INK = INKS.ink, INK2 = INKS.ink2, OFF = GRAY.unlit, UP = SIGNED.higher, DOWN = SIGNED.lower;
	const STEPS = F.steps as { view: string; t: string }[];
	const LAST = STEPS.length - 1;
	const BINS = F.data.bins.domains as Record<string, Record<string, Bin[]>>;
	const EFF = F.data.effort.models as Record<string, EM>;
	const L = F.labels;
	const DOMS = L.domains as Record<string, string>;
	const MODELS = L.models as Record<string, string>;
	const EMODELS = L.effort_models as string[];
	const GROUPS = L.groups as { bin: string; t: string }[];
	const PROBE = F.probe;
	const col = (name: string) => MODEL[name] ?? GRAY.strong;
	const pctLabel = (pct: number, tiles: number) => (pct > 0 && pct < 1 ? L.lt1 : `${tiles}%`);
	const ANSWER = 3; // the demo's answer: its writer's texts go to the last group
	const WRITER = [97, 98, 99]; // the slots the writer's texts take in that group (top row, right)
	const est = (t: string) => 30 + t.length * 7.1; // a tag's width, for laying tags side by side

	let step = $state(0);
	let active = $state(false);
	let xv = $state<"fam" | "effort">("fam");
	let dom = $state("reddit");
	let model = $state("Opus");
	let emodel = $state("Fable 5.2");
	let sel = $state<number | null>(null);
	let W = $state(0), H = $state(0), PH = $state(0), cardH = $state(0);
	let ox = $state(0), oy = $state(0); // the stage's viewport offset
	let landed = $state(false); // the demo's writer texts have reached their group
	let owned = $state(false); // this section draws the field (mirrors field.owner, for the tags)
	let reduce = false;
	let stage: HTMLElement;
	let root: HTMLElement;

	const view = $derived(STEPS[step].view);
	const kind = $derived(view === "result" && xv === "effort" ? "effort" : view);
	const narrow = $derived(W > 0 && W < 860);
	const cardOn = $derived(xv === "fam" && dom === "reddit" && (view === "ask" || !narrow));
	const bubbleOn = $derived(xv === "fam" && dom === "reddit" && model === "Opus" && (view === "sort" || (view === "result" && !narrow)));
	const mcolor = $derived(kind === "effort" ? col(emodel) : col(MODELS[model]));

	// where everything sits, in stage coordinates; recomputed only when the size, the step or a control changes
	const geo = $derived.by(() => {
		const g: G[] = [];
		const out = { g, cardX: 0, cardY: 0, cardW: 0, bubX: 0, bubY: 0, keyX: 0, keyY: 0, numY: 0, labY: 0, size: 22 };
		if (!W || !H) return out;
		const ch = cardH || 260;
		if (!narrow) {
			const x0 = W * 0.36, x1 = W - 12, y0 = 72, y1 = H - 40, bw = x1 - x0, bh = y1 - y0;
			const p = Math.max(6, Math.min((bw - 90) / 40, 16)), gw = 10 * p, rowW = 4 * gw + 90, gx0 = x0 + (bw - rowW) / 2;
			const total = ch + 12 + 34 + 26 + 36 + 22 + gw + 48;
			const top = y0 + Math.max(0, (bh - total) / 2);
			out.cardX = gx0; out.cardW = Math.min(rowW, 600);
			out.cardY = view === "ask" ? y0 + Math.max(0, (bh - ch) / 2 - 24) : top;
			out.bubY = top + ch + 12;
			out.keyY = out.bubY + 34 + 26;
			out.numY = out.keyY + 36;
			const gy = out.numY + 22;
			for (let i = 0; i < 4; i++) { const x = gx0 + i * (gw + 30); g.push({ x, y: gy, cx: x + gw / 2, p, gw }); }
			out.bubX = g[ANSWER].x + g[ANSWER].gw; out.keyX = gx0; out.labY = gy + gw + 4;
		} else {
			const x0 = 8, x1 = W - 8, y0 = 16 + PH + 12, y1 = H - 16, bw = x1 - x0;
			out.cardX = x0; out.cardW = bw; out.cardY = y0;
			out.bubY = y0; out.bubX = W / 2;
			out.keyY = view === "sort" ? y0 + 34 + 22 : y0 + 12;
			out.keyX = x0;
			const top = out.keyY + 22 + 28, cw = (bw - 24) / 2; // two rows of colour names
			const p = Math.max(5, Math.min(cw / 10, (y1 - top - 184) / 20, 16)), gw = 10 * p;
			for (let i = 0; i < 4; i++) {
				const c = i % 2, r = Math.floor(i / 2);
				const x = x0 + c * (cw + 24) + (cw - gw) / 2, y = top + 28 + r * (gw + 100);
				g.push({ x, y, cx: x + gw / 2, p, gw });
			}
			out.numY = 0; out.labY = 0; out.size = 18;
		}
		return out;
	});

	const bins = $derived(BINS[dom][model]);
	const erows = $derived(EFF[emodel].rows);

	// labels on the picture (viewport coordinates): group names under each group, and every colour shown, named
	const tags = $derived.by(() => {
		const t: Tag[] = [];
		if (!active || !owned || kind === "ask" || !geo.g.length) return t;
		const below = (g: G) => g.y + g.gw + 4;
		geo.g.forEach((g, i) => {
			if (kind === "effort") t.push({ id: `g${i}`, x: ox + g.cx, y: oy + below(g), t: erows[i].familiarity, at: "below" });
			else t.push({ id: `g${i}`, x: ox + g.cx, y: oy + below(g), t: `“${GROUPS[i].t}”`, sub: GROUPS[i].bin, at: "below" });
		});
		const key: { t: string; color: string; swatch?: Tag["swatch"] }[] = [];
		if (kind === "sort") key.push({ t: L.unit, color: OFF, swatch: "square" });
		else if (kind === "result") key.push({ t: `${MODELS[model]} ${L.named}`, color: mcolor, swatch: "square" }, { t: L.not_named, color: OFF, swatch: "square" });
		else if (kind === "effort") {
			key.push({ t: `${emodel}, ${L.low}`, color: mcolor, swatch: "square" }, { t: L.gain, color: UP, swatch: "square" });
			if (erows.some((r) => r.high_tiles < r.low_tiles)) key.push({ t: L.loss, color: DOWN, swatch: "square" });
			key.push({ t: L.not_named, color: OFF, swatch: "square" });
		}
		let x = geo.keyX, row = 0;
		key.forEach((k, i) => {
			if (i > 0 && x + est(k.t) > W - 8) { row++; x = geo.keyX; } // a second row on a phone
			t.push({ id: `k${i}${kind}`, x: ox + x - 10, y: oy + geo.keyY + row * 28, t: k.t, color: k.color, swatch: k.swatch });
			x += est(k.t) + 6;
		});
		if (kind === "sort" && landed) {
			const g = geo.g[ANSWER];
			t.push({ id: "writer", x: ox + Math.min(g.x + 8.5 * g.p, W - est(L.writer) / 2 - 6), y: oy + g.y - 2, t: L.writer, color: INK, swatch: "square", at: "above" });
		}
		return t;
	});

	// ---- drawing: pooled marks, rebuilt only on input changes and while a tween moves --------------------------
	const pool = new Map<string, Mark>();
	const mk = (id: string) => {
		let m = pool.get(id);
		if (!m) { m = { id, x: 0, y: 0, r: 1, color: OFF }; pool.set(id, m); }
		return m;
	};
	const CLARITY = [0.1, 0.4, 0.7, 1]; // legibility of the prints in each familiarity group, least to most familiar
	const ASPECT = printAspect();
	const IDS = Array.from({ length: 4 }, (_, g) => Array.from({ length: 100 }, (_, i) => `${OWNER}:g${g}:${i}`));
	const marks: Mark[] = [];
	let lastKey = "", lastKind = "", t0 = 0, raf = 0;
	let fromLit = [0, 0, 0, 0], curLit = [0, 0, 0, 0], appear = false;
	const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

	function tile(g: G, gi: number, i: number) {
		const m = mk(IDS[gi][i]);
		m.x = ox + g.x + (i % 10) * g.p + g.p / 2;
		m.y = oy + g.y + (9 - Math.floor(i / 10)) * g.p + g.p / 2;
		m.square = true; m.r = g.p * 0.36; m.alpha = 1; // square tiles, as in sections 2 and 3
		return m;
	}

	function render(now: number): boolean {
		const key = `${kind}|${dom}|${model}|${emodel}`;
		if (key !== lastKey) {
			appear = kind === "sort" && (lastKind === "ask" || lastKind === "");
			fromLit = kind === lastKind || (kind === "result" && lastKind === "sort") ? curLit.slice() : [0, 0, 0, 0];
			lastKey = key; lastKind = kind; t0 = now;
		}
		const e = reduce ? 1e9 : (now - t0) / 1000;
		let busy = false;
		marks.length = 0;
		const texts: Text[] = [], paths: Path[] = [];
		const G4 = geo.g;
		if (kind === "sort" && G4.length) {
			// the answer, then this writer's texts drop into the group it names; everyone else's texts fill the groups
			const land = e >= 1.1;
			if (landed !== land) landed = land;
			G4.forEach((g, gi) => {
				const shown = !appear || e >= 1.5 + 0.22 * gi;
				for (let i = 0; i < 100; i++) {
					const writer = gi === ANSWER && WRITER.includes(i);
					if (writer && e < 0.45 && appear) continue;
					if (!writer && !shown) continue;
					const m = tile(g, gi, i);
					m.color = writer ? INK : OFF;
					if (writer && e < 1.1) { m.x = ox + geo.bubX + (narrow ? 0 : -g.gw / 2) + (i - 98) * g.p; m.y = oy + (narrow ? geo.bubY + 40 : geo.bubY + 46); }
					marks.push(m);
				}
			});
			curLit = [0, 0, 0, 0];
			busy = e < 2.5;
		} else if (kind === "result" && G4.length) {
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
				const ny = narrow ? g.y - 16 : geo.numY;
				texts.push({ x: ox + g.cx, y: oy + ny, t: pctLabel(b.pct, b.tiles), color: INK, size: geo.size, weight: 600, align: "center" });
			});
			busy = e < 1.2;
		} else if (kind === "effort" && G4.length) {
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
				const ny = narrow ? g.y - 16 : geo.numY;
				texts.push({ x: ox + g.cx, y: oy + ny, t: `${pctLabel(r.low, r.low_tiles)} → ${pctLabel(r.high, r.high_tiles)}`, color: INK, size: narrow ? 15 : 18, weight: 600, align: "center" });
			});
			busy = e < 1.6;
		}
		if (sel !== null && G4[sel] && kind !== "ask") {
			const g = G4[sel], w = g.gw, x = ox + g.x - 5, y = oy + g.y - 5;
			paths.push({ pts: [[x, y], [x + w + 10, y], [x + w + 10, y + w + 10], [x, y + w + 10], [x, y]], color: INK, width: 1.5, progress: 1 });
		}
		// the motif: every tile is a writer's print, and how legible it is follows the group's familiarity: smudged
		// where the model does not recognize the writer, crisp where it knows them well (named tiles solid, in the
		// model's colour, with the print in a deeper ink; the rest pale)
		for (const m of marks) {
			const gi = m.id.startsWith(`${OWNER}:g`) ? +m.id.charAt(OWNER.length + 2) : -1;
			const pitch = geo.g[gi]?.p ?? 0;
			if (gi < 0 || !m.square || pitch < 15) { m.sprite = undefined; m.backing = undefined; continue; }
			const lit = m.color !== OFF, px = Math.round(pitch * 0.9), clarity = CLARITY[gi], idx = +m.id.slice(m.id.lastIndexOf(":") + 1);
			const ink = lit ? deepen(m.color, TILE.inkDepth) : m.color;
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
		void [kind, dom, model, emodel, geo, sel, ox, oy, active, owned];
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

	// each step sets the scene it narrates; the controls then take over
	function enter() { xv = "fam"; dom = "reddit"; model = "Opus"; emodel = "Fable 5.2"; sel = null; }

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
			if (i !== step) { step = i; enter(); }
		}), { rootMargin: "-45% 0px -45% 0px" });
		steps.forEach((s) => so.observe(s));
		return () => { cancelAnimationFrame(raf); io.disconnect(); so.disconnect(); removeEventListener("scroll", onScroll); removeEventListener("resize", onScroll); };
	});

	const tip = $derived.by(() => {
		if (sel === null || kind === "ask" || kind === "sort") return null;
		if (kind === "effort") { const r = erows[sel]; return { h: r.familiarity, v: `${pctLabel(r.low, r.low_tiles)} → ${pctLabel(r.high, r.high_tiles)}`, s: emodel }; }
		const b = bins[sel];
		return { h: `“${GROUPS[sel].t}”`, v: b.shown ? pctLabel(b.pct, b.tiles) : L.few, s: `${MODELS[model]} ${L.named}` };
	});
	const aria = (i: number) => {
		if (kind === "effort") { const r = erows[i]; return `${emodel}, ${r.familiarity}: ${pctLabel(r.low, r.low_tiles)} → ${pctLabel(r.high, r.high_tiles)}`; }
		const b = bins[i];
		return `${GROUPS[i].t} (${GROUPS[i].bin}): ${b.shown ? pctLabel(b.pct, b.tiles) : L.few}`;
	};
</script>

<section class="fa" id={F.id} data-rq="0" bind:this={root} style="--steps:{STEPS.length}">
	<div class="stick" bind:this={stage} bind:clientWidth={W} bind:clientHeight={H}>
		<div class="panel" bind:clientHeight={PH}>
			<p class="kick"><span class="badge">{F.n}</span>{F.title.t}</p>
			<h2>{F.takeaway.t}</h2>
			<div class="say" aria-live="polite" data-lag="1">
				<p class="say-n">{#each STEPS as _, i}<i class:on={step === i}></i>{/each}</p>
				{#key step}<p class="say-t">{STEPS[step].t}</p>{/key}
			</div>
			<div data-lag="2">
			<Reveal show={step >= LAST} label={L.explore}>
				<div class="ctrl" role="group" aria-label={L.view}>
					<button type="button" aria-pressed={xv === "fam"} onclick={() => { xv = "fam"; sel = null; }}><Icon name="familiar" />{L.view_fam}</button>
					<button type="button" aria-pressed={xv === "effort"} onclick={() => { xv = "effort"; sel = null; }}><Icon name="effort" />{L.view_effort}</button>
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
					<p class="cap">{F.explore.effort.t}</p>
				{/if}
			</Reveal>
			</div>
		</div>

		<!-- the demo: the question as the model sees it, and its answer (HTML on the stage, over the canvas) -->
		<div class="card" class:on={cardOn} class:answered={view !== "ask"} aria-hidden={!cardOn}
			style="left:{geo.cardX}px; top:{geo.cardY}px; width:{geo.cardW}px; --c:{col(MODELS.Opus)}" bind:clientHeight={cardH}>
			<p class="card-h"><Icon name="reddit" />{L.ask_head}</p>
			<div class="q">
				<p>{PROBE.task.t}</p>
				<p class="gap">{PROBE.scale_head.t}</p>
				{#each PROBE.scale as s, i}<p class="sc" class:end={i === 0 || i === 3} class:pick={i === ANSWER}>{s.t}</p>{/each}
				<p class="gap user">{PROBE.platform.t}</p>
				<p class="user">{L.account}</p>
			</div>
		</div>
		{#if bubbleOn}
			{#key step}
				<div class="bubble" class:right={!narrow} style="left:{geo.bubX}px; top:{geo.bubY}px; --c:{col(MODELS.Opus)}">
					<span class="who"><i class="sw" style:background={col(MODELS.Opus)}></i>{MODELS.Opus}</span>
					<code>{L.answer}</code>
				</div>
			{/key}
		{/if}

		<!-- hover and keyboard targets over each tile group; the canvas itself is aria-hidden -->
		{#if kind === "result" || kind === "effort"}
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
	{#if active && owned}<Tags items={tags} />{/if}
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
	@keyframes say { from { opacity: 0; transform: translateY(6px); } }
	.ctrl { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 2px; background: var(--chip); border-radius: 3px; padding: 3px; justify-self: start; }
	.ctrl button { display: inline-flex; align-items: center; gap: 6px; padding: 5px 9px; font-size: 12.5px; font-weight: 500; color: var(--ink2); border-radius: 2px; }
	.ctrl button:hover { color: var(--ink); }
	.ctrl button[aria-pressed="true"] { background: var(--ink); color: var(--field); }
	.sw { flex: none; display: inline-block; width: 9px; height: 9px; border-radius: 1px; }
	.ctrl button[aria-pressed="true"] .sw { box-shadow: 0 0 0 1.5px var(--field); }
	.cap { font-size: 12.5px; line-height: 1.45; color: var(--ink2); }

	.card { position: absolute; z-index: 1; padding: 12px 16px 14px; background: #fff; border-radius: 3px; box-shadow: 0 2px 14px rgba(20, 32, 45, .06);
		opacity: 0; transform: translateY(10px); pointer-events: none; transition: opacity .4s, transform .5s var(--ease), top .6s var(--ease); }
	.card.on { opacity: 1; transform: none; }
	.card-h { display: flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 600; color: var(--ink2); margin-bottom: 8px; }
	.card-h :global(.ic) { color: var(--ink2); }
	.q { font-size: 13px; line-height: 1.5; color: var(--ink); }
	.q p { margin: 0; }
	.q .gap { margin-top: 8px; }
	.q .sc { color: var(--ink2); padding-left: 8px; border-left: 2px solid transparent; transition: border-color .4s, color .4s; }
	.q .sc.end { color: var(--ink); font-weight: 600; }
	.card.answered .sc.pick { border-left-color: var(--c); color: var(--ink); }
	.q .user { color: var(--ink2); }
	.q .gap.user { padding-top: 8px; border-top: 1px solid var(--rule); }
	.bubble { position: absolute; z-index: 1; transform: translateX(-50%); display: inline-flex; align-items: center; gap: 10px; padding: 6px 12px; background: #fff;
		border-radius: 3px; border-left: 3px solid var(--c); box-shadow: 0 2px 14px rgba(20, 32, 45, .08); white-space: nowrap; animation: pop .5s var(--ease); }
	.bubble .who { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 600; color: var(--ink); }
	.bubble code { font-family: inherit; font-size: 15px; font-weight: 700; color: var(--ink); }
	.bubble.right { transform: translateX(-100%); animation-name: pop-r; }
	@keyframes pop { from { opacity: 0; transform: translate(-50%, 8px); } }
	@keyframes pop-r { from { opacity: 0; transform: translate(-100%, 8px); } }

	.hits { position: absolute; inset: 0; pointer-events: none; }
	.hit { position: absolute; pointer-events: auto; border-radius: 2px; background: transparent; cursor: default; }
	.hit:focus-visible { outline: 2px solid var(--ink); outline-offset: 0; }
	.tip { position: absolute; z-index: 5; display: grid; gap: 2px; min-width: 140px; padding: 9px 12px; background: #fff; border-radius: 3px; box-shadow: 0 6px 20px rgba(20, 32, 45, .14); font-size: 12.5px; color: var(--ink2); pointer-events: none; white-space: nowrap; }
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
		.q { font-size: 12px; }
		.card { padding: 10px 12px 12px; }
		.bubble { padding: 5px 10px; }
	}
	@media (prefers-reduced-motion: reduce) { .say-t, .bubble { animation: none; } .card { transition: none; } }
</style>
