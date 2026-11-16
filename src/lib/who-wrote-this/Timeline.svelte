<script lang="ts">
	// "This is recent": Figure 2's 68 models as the page's own dots. The section pins a full-screen stage; while it is
	// pinned the field turns into the chart (release date across, accuracy up), and the frontier lines draw as the
	// reader scrolls through the paper's sentences. Everything is also a control: metric, weights, dates, labs, and
	// hover on any model. Interactions copied from the detection-frontiers dashboard; data from the paper.
	import { onMount } from "svelte";
	import Icon from "./Icon.svelte";
	import { field, chart, type Mark, type Path, type Text } from "./field.svelte";
	import C from "./content.json";
	import D from "./timeline_rq1.json";

	const T = C.timeline;
	type Metric = "both" | "ideas" | "prose";
	type Model = (typeof D.models)[number];
	let metric = $state<Metric>("both");
	let weights = $state<"all" | "closed" | "open">("all");
	let range = $state<"all" | "2026">("all");
	let lab = $state<string | null>(null);
	let step = $state(0);
	let active = $state(false);
	let stage: HTMLElement;
	let root: HTMLElement;
	const labs = [...new Set(D.models.map((m) => m.lab))].sort();
	const draw = { closed: 0, open: 0, ref: 0 };
	const want = $derived(T.steps[step].draw as string[]);
	const focus = $derived(new Set(T.steps[step].focus as string[]));
	let hovered = $derived(field.hover ? D.models.find((m) => m.model === field.hover) ?? null : null);
	let tip = $state({ x: 0, y: 0 });

	// dates at local noon, so a tick on the 1st never reads as the month before
	const day = (d: string) => Date.parse(d + "T12:00:00");
	const START = { all: day("2024-07-01"), "2026": day("2025-12-15") };
	const END = day("2026-12-01");
	const month = (t: number) => new Date(t).toLocaleDateString("en-US", { month: "short", year: "2-digit" }).replace(" ", " ’");
	const value = (m: Model) => m[metric];

	function frontier(models: Model[]) {
		const out: Model[] = [];
		let best = -1;
		for (const m of [...models].sort((a, b) => a.release.localeCompare(b.release) || value(b) - value(a)))
			if (value(m) > best) { best = value(m); out.push(m); }
		return out;
	}

	function layout() {
		const r = stage.getBoundingClientRect();
		const narrow = r.width < 860;
		const box = narrow
			? { x0: r.left + 44, x1: r.right - 18, y0: r.top + r.height * 0.42, y1: r.bottom - 44 }
			: { x0: r.left + r.width * 0.34, x1: r.right - 28, y0: r.top + 70, y1: r.bottom - 62 };
		const t0 = START[range];
		const shown = D.models.filter((m) => day(m.release) >= t0);
		const lo = Math.floor((Math.min(...shown.map(value)) - 4) / 10) * 10;
		const y = (v: number) => box.y1 - ((v - lo) / (100 - lo)) * (box.y1 - box.y0);
		const x = (t: number) => box.x0 + ((t - t0) / (END - t0)) * (box.x1 - box.x0);
		const ink2 = "#5A6270", rule = "rgba(20,32,45,.14)";

		const marks: Mark[] = [];
		const front = new Set<string>();
		const lines: Record<string, Model[]> = {};
		for (const line of ["closed", "open"]) {
			const f = frontier(shown.filter((m) => m.line === line));
			lines[line] = f;
			f.forEach((m) => front.add(m.model));
		}
		for (const m of shown) {
			const visible = (weights === "all" || m.line === weights) && (!lab || m.lab === lab);
			const fable = m.model === "Claude Fable 5.2";
			marks.push({
				id: m.model, x: x(day(m.release)), y: y(value(m)),
				r: (front.has(m.model) ? 6 : 4.5) + (focus.has(m.model) ? 2.5 : 0),
				color: fable ? "#B4501C" : m.line === "closed" ? "#461E47" : "#C85A82",
				ring: m.line === "open" && !fable, alpha: visible ? (focus.size && !focus.has(m.model) ? 0.55 : 1) : 0.12,
			});
		}
		const paths: Path[] = [];
		const texts: Text[] = [];
		// grid and ticks
		for (let v = lo; v <= 100; v += 10) {
			paths.push({ pts: [[box.x0, y(v)], [box.x1, y(v)]], color: rule, width: 1, dash: [1, 5], progress: 1 });
			if (v % 20 === 0 || lo % 20 !== 0) texts.push({ x: box.x0 - 10, y: y(v), t: `${v}%`, color: ink2, size: 11.5, align: "right" });
		}
		const ticks = range === "all" ? ["2024-07-01", "2025-01-01", "2025-07-01", "2026-01-01", "2026-07-01"] : ["2026-01-01", "2026-04-01", "2026-07-01", "2026-10-01"];
		for (const d of ticks) texts.push({ x: x(day(d)), y: box.y1 + 18, t: month(day(d)), color: ink2, size: 11.5, align: "center" });
		texts.push({ x: box.x1, y: box.y1 + 38, t: T.x_label, color: ink2, size: 11.5, align: "right" });
		// frontier lines: step up at each new best model, then run on to the end of the axis
		const stepPts = (f: Model[]) => {
			const pts: [number, number][] = [];
			f.forEach((m, i) => {
				const px = x(day(m.release)), py = y(value(m));
				if (i) pts.push([px, pts[pts.length - 1][1]]);
				pts.push([px, py]);
			});
			pts.push([box.x1, pts[pts.length - 1][1]]);
			return pts;
		};
		const showLine = (line: string) => weights === "all" || weights === line;
		if (showLine("closed") && lines.closed.length)
			paths.push({ pts: stepPts(lines.closed), color: "#461E47", width: 2.2, progress: draw.closed });
		if (showLine("open") && lines.open.length)
			paths.push({ pts: stepPts(lines.open), color: "#C85A82", width: 2.2, dash: [7, 5], progress: draw.open });
		const ref = metric === "both" ? null : D.refs[metric];
		if (ref && draw.ref > 0.01) {
			paths.push({ pts: [[box.x0, y(ref.v)], [box.x1, y(ref.v)]], color: "#898989", width: 1.6, dash: [3, 4], progress: draw.ref });
			texts.push({ x: box.x0 + 6, y: y(ref.v) - 11, t: `${ref.t} (trained), ${Math.round(ref.v)}%`, color: ink2, size: 12, weight: 500 });
		}
		// direct labels at the best of each line
		for (const line of ["closed", "open"]) {
			const f = lines[line];
			if (!f.length || !showLine(line) || draw[line as "closed" | "open"] < 0.6) continue;
			const b = f[f.length - 1];
			texts.push({ x: x(day(b.release)) - 10, y: y(value(b)) + (line === "closed" ? -16 : 16), t: `${b.model}, ${Math.round(value(b))}%`, color: line === "closed" ? "#27132A" : "#6E2042", size: 12.5, weight: 600, align: "right" });
		}
		chart.marks = marks; chart.paths = paths; chart.texts = texts;
		if (hovered) {
			const m = marks.find((k) => k.id === hovered!.model);
			if (m) tip = { x: m.x, y: m.y };
		}
	}

	onMount(() => {
		const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches || new URLSearchParams(location.search).has("still");
		let raf = 0, last = performance.now();
		const loop = (now: number) => {
			const dt = Math.min(0.05, (now - last) / 1000); last = now;
			for (const k of ["closed", "open", "ref"] as const) {
				const goal = want.includes(k) || reduce ? 1 : 0;
				draw[k] += (goal - draw[k]) * (reduce ? 1 : Math.min(1, dt * 1.6));
			}
			if (active && field.owner === "rq1") layout();
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		const io = new IntersectionObserver((es) => es.forEach((e) => {
			active = e.isIntersecting;
			if (active) { field.mode = "chart"; field.owner = "rq1"; field.dim = 0.75; field.interactive = true; }
			else if (field.mode === "chart" && field.owner === "rq1") { field.mode = "ground"; field.dim = 0; field.interactive = false; chart.marks = []; chart.paths = []; chart.texts = []; }
		}), { rootMargin: "-35% 0px -35% 0px" });
		io.observe(root);
		const steps = [...root.querySelectorAll(".step")];
		const so = new IntersectionObserver((es) => es.forEach((e) => {
			if (!e.isIntersecting) return;
			step = steps.indexOf(e.target);
			metric = T.steps[step].metric as Metric;
		}), { rootMargin: "-45% 0px -45% 0px" });
		steps.forEach((s) => so.observe(s));
		return () => { cancelAnimationFrame(raf); io.disconnect(); so.disconnect(); };
	});
</script>

<section class="tl" id={T.id} bind:this={root} style="--steps:{T.steps.length}">
	<div class="stick" bind:this={stage}>
		<div class="panel">
			<h2>{T.title.t}</h2>
			<div class="ctrl" role="group" aria-label="Score">
				{#each T.metrics as m}<button type="button" aria-pressed={metric === m.id} onclick={() => (metric = m.id as Metric)}>{m.t}</button>{/each}
			</div>
			<div class="ctrl" role="group" aria-label="Weights">
				{#each T.weights as w}<button type="button" aria-pressed={weights === w.id} onclick={() => (weights = w.id as typeof weights)}>{w.t}</button>{/each}
				<span class="sep"></span>
				<button type="button" aria-pressed={range === "all"} onclick={() => (range = "all")}>All dates</button>
				<button type="button" aria-pressed={range === "2026"} onclick={() => (range = "2026")}>2026</button>
			</div>
			<div class="labs" role="group" aria-label="Labs">
				{#each labs as l}<button type="button" aria-pressed={lab === l} onclick={() => (lab = lab === l ? null : l)}>{l}</button>{/each}
			</div>
			<p class="key"><i class="k-closed"></i>Closed weights <i class="k-open"></i>Open weights <i class="k-fable"></i>Claude Fable 5.2</p>
			<p class="cap">{T.caption.t}</p>
			<div class="say" aria-live="polite">
				<p class="say-n">{#each T.steps as _, i}<i class:on={step === i}></i>{/each}</p>
				{#key step}<p class="say-t">{T.steps[step].t}</p>{/key}
			</div>
		</div>
		{#if hovered && active}
			<div class="tip" class:flip={tip.x > innerWidth - 260} style="left:{tip.x}px; top:{tip.y}px">
				<b>{hovered.model}</b>
				<span>{hovered.lab}, {hovered.line === "open" ? "open" : "closed"} weights</span>
				<span>{new Date(hovered.release + "T12:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
				<span class="tv">{Math.round(hovered[metric])}% <em>{T.metrics.find((m) => m.id === metric)?.t}</em></span>
			</div>
		{/if}
	</div>
	<!-- invisible scroll triggers: each one advances the sentence in the panel and what the chart draws -->
	<div class="steps" aria-hidden="true">{#each T.steps as _}<div class="step"></div>{/each}</div>
</section>

<style>
	.tl { position: relative; margin-top: 56px; height: calc((var(--steps) + 1) * 85vh); }
	.stick { position: sticky; top: 0; height: 100vh; pointer-events: none; }
	.panel { pointer-events: auto; position: absolute; left: 0; top: 64px; width: min(31%, 340px); display: grid; gap: 12px; }
	h2 { font-size: clamp(22px, 2.4vw, 30px); line-height: 1.15; font-weight: 600; letter-spacing: -0.025em; text-wrap: balance; }
	.ctrl { display: inline-flex; flex-wrap: wrap; gap: 2px; background: var(--chip); border-radius: 3px; padding: 3px; justify-self: start; }
	.ctrl button, .labs button { padding: 5px 9px; font-size: 12.5px; font-weight: 500; color: var(--ink2); border-radius: 2px; }
	.ctrl button:hover, .labs button:hover { color: var(--ink); }
	.ctrl button[aria-pressed="true"] { background: var(--ink); color: var(--field); }
	.sep { width: 1px; margin: 3px 4px; background: var(--rule); }
	.labs { display: flex; flex-wrap: wrap; gap: 4px; }
	.labs button { background: rgba(243, 243, 239, .9); }
	.labs button[aria-pressed="true"] { background: var(--ink); color: var(--field); }
	.key { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; font-size: 12px; color: var(--ink2); }
	.key i { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-left: 4px; }
	.k-closed { background: #461E47; } .k-open { border: 1.8px solid #C85A82; } .k-fable { background: #B4501C; }
	.cap { font-size: 12px; color: var(--ink2); }
	.tip { position: fixed; z-index: 5; transform: translate(14px, -50%); display: grid; gap: 2px; padding: 9px 12px; background: #fff; border-radius: 3px; box-shadow: 0 6px 20px rgba(20, 32, 45, .14); font-size: 12.5px; color: var(--ink2); pointer-events: none; white-space: nowrap; }
	.tip.flip { transform: translate(calc(-100% - 14px), -50%); }
	.tip b { font-size: 14px; color: var(--ink); }
	.tv { font-size: 18px; font-weight: 600; color: var(--ink); }
	.tv em { font-style: normal; font-size: 12px; font-weight: 400; color: var(--ink2); }
	.steps { position: absolute; inset: 0; pointer-events: none; }
	.step { height: 85vh; }
	.step:first-child { margin-top: 20vh; }
	.say { margin-top: 6px; padding: 14px 16px; background: #fff; border-radius: 3px; }
	.say-n { display: flex; gap: 5px; margin-bottom: 8px; }
	.say-n i { width: 18px; height: 3px; border-radius: 2px; background: var(--rule); }
	.say-n i.on { background: var(--ink); }
	.say-t { font-size: 16px; line-height: 1.5; animation: say .45s var(--ease); }
	@keyframes say { from { opacity: 0; transform: translateY(6px); } }
	@media (prefers-reduced-motion: reduce) { .say-t { animation: none; } }
	@media (max-width: 860px) {
		.panel { width: auto; right: 0; top: 16px; gap: 8px; }
		.panel .labs, .panel .cap { display: none; }
	}
</style>
