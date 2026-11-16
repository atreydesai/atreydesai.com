<script lang="ts">
	// If AI, which AI? Every text Claude Fable 5.2 judged becomes a tile on the page's field: one pile per writing
	// model, grouped by lab, stacked bottom-up like the paper's distillation figure (Anthropic, OpenAI, another lab,
	// then the writer's own lab). Scrolling colours the piles by Fable's answer, spotlights the distillation cases,
	// then lays the open labs' piles along their release dates under the reports the paper cites.
	import { onMount } from "svelte";
	import Icon from "./Icon.svelte";
	import { field, chart, type Mark, type Path, type Text } from "./field.svelte";
	import C from "./content.json";
	import R from "./rq2_writers.json";

	const S = C.which_ai;
	type W = (typeof R.writers)[number];
	const ORDER = ["Anthropic", "Google", "OpenAI", "Moonshot", "Zhipu", "Alibaba", "MiniMax", "xAI", "DeepSeek", "Mistral", "Cohere"];
	const BIG = new Set(["Anthropic", "Google", "OpenAI"]);
	const COL = { anthropic: "#C85A82", openai: "#437E8E", other: "#B9B9B4", own: "#2B2B2B" } as const;
	const STACK = ["anthropic", "openai", "other", "own"] as const;
	const groups = ORDER.map((lab) => ({ lab, ws: R.writers.filter((w) => w.lab === lab).sort((a, b) => (a.release ?? "").localeCompare(b.release ?? "")) }));
	// the paper figure's pile labels: the version, or the model's own short name where there is none
	const tag = (w: string) => (w.match(/(?:^|[\s-])(?:K|M|V)?(\d+(?:\.\d+)?)/)?.[0].trim().replace(/^-/, "") ?? w.split(" ").pop()!).replace(/^(\d)/, "$1");

	let step = $state(0);
	let active = $state(false);
	let stage: HTMLElement;
	let root: HTMLElement;
	let tip = $state({ x: 0, y: 0 });
	const hovered = $derived(field.hover && field.owner === "rq2" ? R.writers.find((w) => w.writer === field.hover) ?? null : null);
	const day = (d: string) => Date.parse((d.length === 7 ? d + "-15" : d) + "T12:00:00");
	const month = (t: number) => new Date(t).toLocaleDateString("en-US", { month: "short", year: "2-digit" }).replace(" ", " ’");

	function layout() {
		const st = S.steps[step];
		const r = stage.getBoundingClientRect();
		const narrow = r.width < 860;
		const box = narrow
			? { x0: r.left + 8, x1: r.right - 8, y0: r.top + r.height * 0.4, y1: r.bottom - 40 }
			: { x0: r.left + r.width * 0.34, x1: r.right - 24, y0: r.top + 86, y1: r.bottom - 70 };
		const marks: Mark[] = [], paths: Path[] = [], texts: Text[] = [];
		const ink2 = "#5A6270";
		const focus = new Set((st as { focus?: string[] }).focus ?? []);
		const color = (k: (typeof STACK)[number]) => (st.color ? COL[k] : "#14202D");
		const place = (w: W, left: number, bottom: number, s: number, cols: number, alpha: number) => {
			let i = 0;
			for (const k of STACK) for (let j = 0; j < w[k]; j++, i++) {
				marks.push({ id: `${w.writer}#${i}`, group: w.writer, square: true, x: left + (i % cols) * s + s / 2, y: bottom - Math.floor(i / cols) * s - s / 2, r: s * 0.36, color: color(k), alpha });
			}
		};
		if (st.layout === "labs") {
			// two rows of labs (the big three and the first two open labs, then the rest), piles stacked bottom-up
			const rowsOf = [groups.slice(0, 5), groups.slice(5)];
			const pitch = (row: typeof groups) => row.reduce((t, g) => t + g.ws.length * 3.9 + 2.7, 0);
			const s = Math.min(6.4, (box.x1 - box.x0) / Math.max(...rowsOf.map(pitch)), (box.y1 - box.y0 - 120) / 54);
			rowsOf.forEach((row, ri) => {
				let x = box.x0;
				const bottom = box.y0 + 40 + (ri + 1) * (25 * s + 40) - 30 + ri * 10;
				for (const g of row) {
					const gx = x;
					for (const w of g.ws) {
						const a = focus.size ? (focus.has(w.writer) ? 1 : 0.22) : st.color ? 1 : 0.55;
						place(w, x, bottom, s, 3, a);
						texts.push({ x: x + 1.5 * s, y: bottom + 11, t: tag(w.writer), color: focus.has(w.writer) ? "#14202D" : ink2, size: 10, weight: focus.has(w.writer) ? 600 : 400, align: "center" });
						x += s * 3.9;
					}
					texts.push({ x: gx, y: bottom - 25 * s - 12, t: g.lab, color: BIG.has(g.lab) ? "#14202D" : ink2, size: 12, weight: 600 });
					x += s * 2.7;
				}
			});
		} else {
			// the open labs along their release dates, with the reports the paper cites
			const rows = groups.filter((g) => !BIG.has(g.lab));
			const t0 = day("2024-09-01"), t1 = day("2026-11-15");
			const lx = box.x0 + 70;
			const X = (t: number) => lx + ((t - t0) / (t1 - t0)) * (box.x1 - lx);
			const rh = (box.y1 - box.y0) / rows.length, s = Math.min(3.2, rh / 27);
			rows.forEach((g, ri) => {
				const bottom = box.y0 + (ri + 1) * rh - 4;
				texts.push({ x: box.x0, y: bottom - rh / 2 + 2, t: g.lab, color: "#14202D", size: 11.5, weight: 600 });
				paths.push({ pts: [[lx, bottom + 2], [box.x1, bottom + 2]], color: "rgba(20,32,45,.12)", width: 1, progress: 1 });
				for (const w of g.ws) place(w, X(day(w.release!)) - 1.5 * s, bottom, s, 3, 1);
			});
			for (const yr of ["2025-01-01", "2025-07-01", "2026-01-01", "2026-07-01"])
				texts.push({ x: X(day(yr)), y: box.y1 + 16, t: month(day(yr)), color: ink2, size: 11.5, align: "center" });
			R.events.forEach((e, i) => {
				const ex = X(day(e.date));
				const anthropic = e.name.startsWith("Anthropic");
				paths.push({ pts: [[ex, box.y0 - 6], [ex, box.y1]], color: anthropic ? "rgba(200,90,130,.7)" : "rgba(67,126,142,.7)", width: 1.4, dash: [3, 4], progress: 1 });
				const label = e.name.startsWith("Musk") ? "Musk’s testimony" : `${anthropic ? "Anthropic" : "OpenAI"}, ${month(day(e.date))}`;
				// close-together reports: the earlier one reads to the left of its line, later ones to the right, on staggered rows
				const left = i < R.events.length - 1 && day(R.events[i + 1].date) - day(e.date) < 40 * 864e5;
				texts.push({ x: ex + (left ? -5 : 5), y: box.y0 - 12 - (i % 3) * 14, t: label, color: anthropic ? "#6E2042" : "#0A2B34", size: 11, weight: 500, align: left ? "right" : "left" });
			});
		}
		chart.marks = marks; chart.paths = paths; chart.texts = texts;
		if (hovered) {
			const ms = marks.filter((m) => m.group === hovered.writer);
			if (ms.length) tip = { x: Math.max(...ms.map((m) => m.x)), y: Math.min(...ms.map((m) => m.y)) };
		}
	}

	onMount(() => {
		let raf = 0;
		const loop = () => { if (active && field.owner === "rq2") layout(); raf = requestAnimationFrame(loop); };
		raf = requestAnimationFrame(loop);
		const io = new IntersectionObserver((es) => es.forEach((e) => {
			active = e.isIntersecting;
			if (active) { field.mode = "chart"; field.owner = "rq2"; field.dim = 0.75; field.interactive = true; }
			else if (field.mode === "chart" && field.owner === "rq2") { field.mode = "ground"; field.dim = 0; field.interactive = false; chart.marks = []; chart.paths = []; chart.texts = []; }
		}), { rootMargin: "-35% 0px -35% 0px" });
		io.observe(root);
		const steps = [...root.querySelectorAll(".step")];
		const so = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) step = steps.indexOf(e.target); }), { rootMargin: "-45% 0px -45% 0px" });
		steps.forEach((s) => so.observe(s));
		return () => { cancelAnimationFrame(raf); io.disconnect(); so.disconnect(); };
	});
</script>

<section class="wa" id={S.id} bind:this={root} style="--steps:{S.steps.length}">
	<div class="stick" bind:this={stage}>
		<div class="panel">
			<p class="kick"><span class="badge">{S.n}</span>{S.title}</p>
			<h2>{S.takeaway.t}</h2>
			<p class="key">
				{#each S.legend as l}<span><i style="background:{COL[l.k as keyof typeof COL]}"></i>{l.t}</span>{/each}
			</p>
			<p class="by"><Icon name="ai" class="fable" /><em>{S.model}</em></p>
			<div class="say" aria-live="polite">
				<p class="say-n">{#each S.steps as _, i}<i class:on={step === i}></i>{/each}</p>
				{#key step}<p class="say-t">{S.steps[step].t}</p>{/key}
			</div>
			<p class="cap">{S.caption.t}</p>
		</div>
		{#if hovered && active}
			<div class="tip" class:flip={tip.x > innerWidth - 300} style="left:{tip.x}px; top:{tip.y}px">
				<b>{hovered.writer}</b>
				<span>{hovered.lab}{hovered.release ? `, ${new Date(hovered.release + "T12:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" })}` : ""}</span>
				{#each S.legend as l}
					{@const v = hovered[l.k as "own" | "anthropic" | "openai" | "other"]}
					{#if v}<span class="row"><i style="background:{COL[l.k as keyof typeof COL]}"></i>{l.t}<em>{v} of {hovered.n}</em></span>{/if}
				{/each}
				{#if S.profiles[hovered.lab as keyof typeof S.profiles]}<span class="prof">{S.profiles[hovered.lab as keyof typeof S.profiles].t}</span>{/if}
			</div>
		{/if}
	</div>
	<div class="steps" aria-hidden="true">{#each S.steps as _}<div class="step"></div>{/each}</div>
</section>

<style>
	.wa { position: relative; margin-top: 40px; height: calc((var(--steps) + 1) * 85vh); }
	.stick { position: sticky; top: 0; height: 100vh; pointer-events: none; }
	.panel { pointer-events: auto; position: absolute; left: 0; top: 64px; width: min(31%, 340px); display: grid; gap: 12px; }
	.kick { display: flex; align-items: center; gap: 10px; font-size: 14px; font-weight: 600; color: var(--ink2); }
	.badge { display: inline-grid; place-items: center; width: 26px; height: 26px; border-radius: 2px; background: var(--rq2); color: #fff; font-size: 13px; }
	h2 { font-size: clamp(22px, 2.4vw, 30px); line-height: 1.15; font-weight: 600; letter-spacing: -0.025em; text-wrap: balance; }
	.key { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 12px; color: var(--ink2); }
	.key span { display: inline-flex; align-items: center; gap: 5px; }
	.key i, .row i { display: inline-block; width: 9px; height: 9px; }
	.by { display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--ink); }
	.by :global(.fable) { color: var(--fable); }
	.say { padding: 14px 16px; background: #fff; border-radius: 3px; }
	.say-n { display: flex; gap: 5px; margin-bottom: 8px; }
	.say-n i { width: 18px; height: 3px; border-radius: 2px; background: var(--rule); }
	.say-n i.on { background: var(--ink); }
	.say-t { font-size: 16px; line-height: 1.5; animation: say .45s var(--ease); }
	@keyframes say { from { opacity: 0; transform: translateY(6px); } }
	.cap { font-size: 12px; line-height: 1.45; color: var(--ink2); }
	.tip { position: fixed; z-index: 5; transform: translate(12px, -10%); display: grid; gap: 3px; max-width: 300px; padding: 10px 12px; background: #fff; border-radius: 3px; box-shadow: 0 6px 20px rgba(20, 32, 45, .14); font-size: 12.5px; color: var(--ink2); pointer-events: none; }
	.tip.flip { transform: translate(calc(-100% - 12px), -10%); }
	.tip b { font-size: 14px; color: var(--ink); }
	.row { display: flex; align-items: center; gap: 6px; }
	.row em { margin-left: auto; padding-left: 12px; font-style: normal; font-weight: 600; color: var(--ink); font-variant-numeric: tabular-nums; }
	.prof { margin-top: 4px; padding-top: 6px; border-top: 1px solid var(--rule); white-space: normal; color: var(--ink); line-height: 1.4; }
	.steps { position: absolute; inset: 0; pointer-events: none; }
	.step { height: 85vh; }
	.step:first-child { margin-top: 20vh; }
	@media (max-width: 860px) {
		.panel { width: auto; right: 0; top: 16px; gap: 8px; }
		.panel .cap, .panel .key { display: none; }
	}
	@media (prefers-reduced-motion: reduce) { .say-t { animation: none; } }
</style>
