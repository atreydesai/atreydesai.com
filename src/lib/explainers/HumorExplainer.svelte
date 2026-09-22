<script lang="ts" module>
	// From LOL to LLM: Measuring Multilingual Multi-Turn Humor Understanding
	// in AI (Desai, Du, van Doorn & Sreepada 2025, CMSC723)
	//
	// Beats: a stand-up bit, labelled line by line -> a model labels it ->
	// how often punchlines are missed -> joke classification by model size.
	//
	// Line labels are from the paper's label set. The model's labels on this
	// bit are illustrative, but follow its error analysis (Sec. 6.5.1): models
	// "tended to guess 'escalation' or 'establishing context' for many of the
	// labels, including for many punchlines", and "Punchline" was the label
	// incorrectly guessed the most (OLMo3.1-32B wrong 97% of the time). Bars
	// are Table 9: English subset, Task 1 (overall joke classification),
	// Pass@5 accuracy. Qwen3-32B is 0.308 there and in Sec. 6.2.3; Sec. 6.2.1
	// says 31.8%, so the table is followed.
	import type { Beat } from "./motion";

	export const BEATS: Beat[] = [
		{ id: "bit", label: "the bit", at: 0 },
		{ id: "model", label: "model", at: 2.6 },
		{ id: "missed", label: "missed", at: 6.4 },
		{ id: "size", label: "size", at: 10.4, hold: 13.8 },
	];
	export const DURATION = 15;

	export const LINES = [
		{ w: 118, human: "context", model: "context", y: 60 },
		{ w: 98, human: "context", model: "context", y: 92 },
		{ w: 40, human: "timing", model: "context", y: 124 },
		{ w: 96, human: "punchline", model: "escalation", y: 156, punch: true },
	].map((line) => ({ ...line, wrong: line.human !== line.model }));

	// 10 x 10: three of a hundred punchlines found. Ring ink (r 4 + half the
	// 1.5 stroke) starts on the x=14 margin.
	const RING = 4.75;
	export const GRID = Array.from({ length: 100 }, (_, i) => ({
		x: 14 + RING + (i % 10) * 13,
		y: 50 + Math.floor(i / 10) * 13,
		found: i === 23 || i === 58 || i === 86,
	}));

	// Seven bars across the full 14-226 axis: 30-unit slots, 22-wide bars,
	// inset 5 at each end so the 32B numbers stay inside the margin.
	export const MODELS = [
		{ name: "OLMo 3 7B", acc: 0.0 },
		{ name: "Apertus 8B", acc: 0.031 },
		{ name: "Ministral 8B", acc: 0.0 },
		{ name: "Qwen3 8B", acc: 0.045 },
		{ name: "Falcon3 10B", acc: 0.08 },
		{ name: "OLMo 3.1 32B", acc: 0.266 },
		{ name: "Qwen3 32B", acc: 0.308 },
	].map((m, i) => ({ ...m, x: 19 + i * 30, big: m.name.includes("32B") }));
	export const BAR_W = 22;
	export const BASE = 162;
	export const SCALE = 280;
	export const barH = (acc: number) => Math.max(1.5, acc * SCALE);
</script>

<script lang="ts">
	import ExplainerFrame from "./ExplainerFrame.svelte";
	import { T, barBox, draw, enter, exit, restore, rise, type Scene } from "./motion";

	let { size = "card", paused = false, resting = false, label }: {
		size?: "card" | "stage";
		paused?: boolean;
		resting?: boolean;
		label: string;
	} = $props();

	const uid = $props.id();
	// How far a mark pushes a wrong label in from the right margin: the mark's
	// 10-unit ink plus a 6-unit gap.
	const PUSH = 16;

	const scene: Scene = {
		beats: BEATS,
		duration: DURATION,
		build(gsap, tl, root) {
			const poster = [".h-kicker", ".h-line", ".h-human", ".h-cap-q"];
			// Words that replace each other in place: the old one is gone
			// before the new one arrives, so the two never cross-fade.
			const replace = (out: string, into: string, at: number) => {
				exit(tl, out, at, { duration: 0.2 });
				enter(tl, into, at + 0.2);
			};

			// 2 · the model labels the same lines. It agrees on the two context
			// lines, so those stay; the timing line and then the punchline get
			// its labels, and the caption answers as the punchline flips.
			replace(".h-human-2", ".h-model-2", 2.6);
			replace(".h-human-3", ".h-model-3", 3.2);
			replace(".h-cap-q", ".h-cap-m", 3.2);
			// Each wrong label is then marked: the mark slides in from behind
			// the right margin and pushes its label over, in step.
			LINES.forEach((line, i) => {
				if (!line.wrong) return;
				const at = i === 2 ? 4.1 : 4.45;
				const push = { duration: 0.45, ease: "power3.out", immediateRender: false };
				tl.set(`.h-wrong-${i}`, { autoAlpha: 1 }, at);
				tl.fromTo(`.h-wrong-${i}`, { x: PUSH }, { x: 0, ...push }, at);
				tl.fromTo(`.h-model-${i}`, { x: 0 }, { x: -PUSH, ...push }, at);
			});

			// 3 · across the benchmark, punchlines are nearly always missed:
			// all hundred arrive as misses, then the three found turn sage
			// (each new head waits for the old one, at the same spot, to clear)
			exit(tl, [".h-kicker", ".h-line", ".h-human", ".h-model", ".h-wrong", ".h-cap-m"], "missed");
			enter(tl, ".h-miss-head", 6.7);
			enter(tl, ".h-dot", 6.9, { y: 0, duration: 0.25, stagger: 0.01 });
			const turn = { duration: 0.4, ease: "power2.inOut", stagger: 0.08 };
			exit(tl, ".h-dot-found", 8.25, turn);
			enter(tl, ".h-found", 8.25, { y: 0, ...turn });
			enter(tl, ".h-miss-num", 8.85);
			enter(tl, ".h-cap-x", 9.05);

			// 4 · joke classification, by model size: the axis draws, bars
			// rise from it smallest model first, then the two 32B numbers
			exit(tl, [".h-miss-head", ".h-dot", ".h-found", ".h-miss-num", ".h-cap-x"], "size");
			enter(tl, ".h-size-head", 10.7);
			tl.set(".h-base", { autoAlpha: 1 }, 10.9);
			draw(tl, ".h-base", 10.9, 0.5);
			enter(tl, ".h-sizes", 11.1);
			MODELS.forEach((m, i) => {
				const at = 11.1 + i * 0.12;
				tl.set(`.h-bar-${i}`, { autoAlpha: 1 }, at);
				rise(tl, `.h-bar-${i}`, BASE, barH(m.acc), at, 0.6);
			});
			enter(tl, ".h-col-val", 12.5, { stagger: 0.1 });
			enter(tl, ".h-cap-s", 12.8);

			// Back to the poster, ending by 14.93.
			exit(tl, [".h-size-head", ".h-base", ".h-sizes", ".h-bar", ".h-col-val", ".h-cap-s"], 14.0);
			tl.set([".h-model", ".h-wrong"], { x: 0 }, 14.3);
			restore(tl, poster, 14.3, { stagger: 0.02 });
		},
	};
</script>

<ExplainerFrame {scene} {label} {size} {paused} {resting}>
	<defs>
		<clipPath id="{uid}-bars">
			<rect x="0" y="0" width="240" height={BASE - 0.6} />
		</clipPath>
		<!-- The marks enter from behind the right margin. -->
		<clipPath id="{uid}-margin">
			<rect x="0" y="0" width="226.5" height="240" />
		</clipPath>
	</defs>

	<!-- 1 · poster: a stand-up bit, labelled line by line -->
	<text class="xp-mono h-kicker" x="14" y="30" font-size={T.label}>stand-up, line by line</text>
	{#each LINES as line, i}
		<g class="h-line">
			<rect x="14" y={line.y - 11} width={line.w} height="10" rx="2" fill="var(--xp-faint)" fill-opacity="0.55" />
			<line class="xp-rule" x1="14" x2="226" y1={line.y + 8} y2={line.y + 8} />
		</g>
		<text
			class="xp-mono h-human h-human-{i}"
			x="226"
			y={line.y - 2}
			font-size="14"
			text-anchor="end"
			style={line.punch ? "color: var(--xp-truth)" : undefined}>{line.human}</text
		>
		{#if line.wrong}
			<text
				class="xp-mono xp-later h-model h-model-{i}"
				x="226"
				y={line.y - 2}
				font-size="14"
				text-anchor="end"
				style="color: var(--xp-accent-text)">{line.model}</text
			>
		{/if}
	{/each}
	<g clip-path="url(#{uid}-margin)">
		{#each LINES as line, i}
			{#if line.wrong}
				<path class="xp-later h-wrong h-wrong-{i}" d="M217 {line.y - 11} l8 8 m0 -8 l-8 8" fill="none" stroke="var(--xp-accent)" stroke-width="2" stroke-linecap="round" />
			{/if}
		{/each}
	</g>
	<text class="xp-prose xp-caption h-cap-q" style="color: var(--xp-truth)"><tspan x="14" y="205">can an LLM find</tspan><tspan x="14" y="226">the punchline?</tspan></text>
	<text class="xp-prose xp-caption xp-later h-cap-m" style="color: var(--xp-accent-text)"><tspan x="14" y="205">calls the punchline</tspan><tspan x="14" y="226">“escalation”</tspan></text>

	<!-- 3 · a hundred punchlines -->
	<text class="xp-mono xp-later h-miss-head" x="14" y="30" font-size={T.label}>OLMo 3.1 32B, punchlines</text>
	{#each GRID as cell}
		<circle class="xp-later h-dot" class:h-dot-found={cell.found} cx={cell.x} cy={cell.y} r="4" fill="none" stroke="var(--xp-accent)" stroke-width="1.5" />
	{/each}
	{#each GRID.filter((c) => c.found) as cell}
		<circle class="xp-later h-found" cx={cell.x} cy={cell.y} r={RING} fill="var(--xp-truth)" />
	{/each}
	<g class="xp-later h-miss-num">
		<text class="xp-display" x="226" y="106" font-size={T.hero} text-anchor="end" style="color: var(--xp-accent-text)">97%</text>
		<text class="xp-mono" x="226" y="126" font-size={T.label} text-anchor="end">missed</text>
	</g>
	<text class="xp-prose xp-caption xp-later h-cap-x" style="color: var(--xp-accent-text)"><tspan x="14" y="205">the label incorrectly</tspan><tspan x="14" y="226">guessed the most</tspan></text>

	<!-- 4 · joke classification, by model size -->
	<g class="xp-later h-size-head">
		<text class="xp-prose" x="14" y="30" font-size={T.head}>joke classification</text>
		<text class="xp-mono" x="14" y="50" font-size={T.label}>English subset, Pass@5</text>
	</g>
	<g clip-path="url(#{uid}-bars)">
		{#each MODELS as m, i}
			<rect
				class="xp-later h-bar h-bar-{i}"
				x={m.x}
				{...barBox(BASE, barH(m.acc))}
				width={BAR_W}
				rx="2"
				fill={m.big ? "var(--xp-accent)" : "var(--xp-faint)"}
			>
				<title>{m.name}: {(m.acc * 100).toFixed(1)}%</title>
			</rect>
		{/each}
	</g>
	<line class="xp-later h-base" x1="14" x2="226" y1={BASE} y2={BASE} stroke="var(--xp-soft)" stroke-width="1.2" />
	{#each MODELS.filter((m) => m.big) as m}
		<text class="xp-mono xp-later h-col-val" x={m.x + BAR_W / 2} y={BASE - barH(m.acc) - 6} font-size={T.label} text-anchor="middle" style="color: var(--xp-accent-text)">{Math.round(m.acc * 100)}%</text>
	{/each}
	<g class="xp-later h-sizes">
		<text class="xp-mono" x="14" y={BASE + 16} font-size={T.label}>7–10B</text>
		<text class="xp-mono" x={MODELS[5].x} y={BASE + 16} font-size={T.label} style="color: var(--xp-accent-text)">32B</text>
	</g>
	<text class="xp-prose xp-caption xp-later h-cap-s" style="color: var(--xp-accent-text)"><tspan x="14" y="205">the 32B models</tspan><tspan x="14" y="226">clearly outperform</tspan></text>
</ExplainerFrame>
