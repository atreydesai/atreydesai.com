<script lang="ts" module>
	// A Preview of Computational Animal Linguistics (Dang, Desai, Lekhak,
	// Panunto, Pike, Wang & Zhu 2026)
	//
	// The survey's own structure, one beat per part:
	//   1. "thirteen linguistic properties ... previously thought to be unique
	//      to humans", in "four levels" (Sec. 2, Table 1)
	//   2. the first-listed feature of each level, "more rudimentary" up to
	//      "the most complex" (Table 1)
	//   3. "a 5-step pipeline that generalizes the research process" (Fig. 2);
	//      every stage feeds one Evaluation bar, so evaluation is not a sixth step
	//   4. the curated literature, 55,843 papers (Fig. 3a): "the recent
	//      acceleration of computational work"
	//   5. evidence (Sec. 3.4.1, Table 3): observer-side evidence "may be
	//      established by classification"; animal-side evidence "require[s]
	//      receiver behavior"; accuracy "cannot by itself establish an
	//      animal-side claim"
	// Decade counts are read from Fig. 3a's vector bars (one scale fits both
	// stated totals, 37,712 biological and 18,131 computational or hybrid, to
	// within 0.01%). The last bar is 2020–26, a partial period (to June 2026).
	import type { Beat } from "./motion";

	export const BEATS: Beat[] = [
		{ id: "levels", label: "levels", at: 0 },
		{ id: "properties", label: "properties", at: 2.6 },
		{ id: "pipeline", label: "pipeline", at: 5.6 },
		{ id: "papers", label: "papers", at: 9.8 },
		{ id: "evidence", label: "evidence", at: 13.8, hold: 17.4 },
	];
	export const DURATION = 18.4;

	// Table 1: each level, its number of features, and its first-listed feature.
	export const LEVELS = [
		{ n: "I", name: "signal", count: 2, example: "turn-taking" },
		{ n: "II", name: "token", count: 4, example: "reference" },
		{ n: "III", name: "message", count: 4, example: "syntax" },
		{ n: "IV", name: "language", count: 3, example: "openness" },
	].map((level, i) => ({ ...level, y: 64 + i * 33 }));

	export const STAGES = [
		"data collection",
		"preprocessing",
		"sequence representation",
		"meaning identification",
		"generation",
	].map((name, i) => ({ name, y: 34 + i * 26 }));
	export const EVAL_Y = 166;

	// Papers by decade, in thousands: biological, and computational or hybrid.
	export const DECADES = [
		{ label: "≤79", span: "≤1979", bio: 2.07, comp: 0.34 },
		{ label: "80s", span: "1980s", bio: 2.4, comp: 0.52 },
		{ label: "90s", span: "1990s", bio: 3.61, comp: 1.05 },
		{ label: "00s", span: "2000s", bio: 7.19, comp: 2.83 },
		{ label: "10s", span: "2010s", bio: 12.16, comp: 6.02 },
		{ label: "20s", span: "2020–26", bio: 10.29, comp: 7.38 },
	].map((d, i) => ({ ...d, x: 23 + i * 34 }));
	export const BASE = 164;
	export const PER_K = 5.6;
	export const COL_W = 24;
</script>

<script lang="ts">
	import ExplainerFrame from "./ExplainerFrame.svelte";
	import { T, barBox, draw, enter, exit, restore, rise, swap, type Scene } from "./motion";

	let { size = "card", paused = false, resting = false, label }: {
		size?: "card" | "stage";
		paused?: boolean;
		resting?: boolean;
		label: string;
	} = $props();

	const uid = $props.id();
	const NUM_OFF = "color: var(--xp-soft)";
	const NUM_ON = "color: var(--xp-surface)";

	const scene: Scene = {
		beats: BEATS,
		duration: DURATION,
		build(gsap, tl) {
			const poster = [".c-kicker", ".c-level", ".c-count", ".c-cap-q"];

			// 2 · one feature per level: row by row, top to bottom, the count
			// gives way to the level's first-listed feature.
			swap(tl, ".c-cap-q", ".c-cap-l", 2.6);
			LEVELS.forEach((_, i) => {
				exit(tl, `.c-count-${i}`, 2.6 + i * 0.22, { duration: 0.25 });
				enter(tl, `.c-example-${i}`, 2.85 + i * 0.22);
			});

			// 3 · the five-step pipeline, then the evaluation every step feeds
			exit(tl, [".c-kicker", ".c-level", ".c-example", ".c-cap-l"], "pipeline");
			tl.set(".c-spine", { autoAlpha: 1 }, 5.85);
			draw(tl, ".c-spine", 5.85, 0.6, { ease: "power1.inOut" });
			enter(tl, ".c-stage", 5.85, { stagger: 0.1 });
			enter(tl, ".c-eval", 6.4);
			enter(tl, ".c-cap-p", 6.5);
			STAGES.forEach((_, i) => {
				const at = 6.95 + i * 0.4;
				tl.to(`.c-fill-${i}`, { autoAlpha: 1, duration: 0.25, ease: "power2.out" }, at);
				// One numeral per step, recoloured as its disc fills. Setting the
				// style attribute keeps the theme variable and reverts on seek.
				tl.set(`.c-num-${i}`, { attr: { style: NUM_ON } }, at + 0.08);
			});
			tl.to(".c-eval-on", { autoAlpha: 1, duration: 0.35 }, 9.0);

			// 4 · the literature: biological bars rise, computational stacks on top
			// Whole groups fade, so no part shows through another on the way out.
			exit(tl, [".c-spine", ".c-stage", ".c-eval", ".c-eval-on", ".c-cap-p"], "papers");
			enter(tl, ".c-title", 10.0);
			tl.set(".c-axis", { autoAlpha: 1 }, 10.1);
			draw(tl, ".c-axis", 10.1, 0.45, { ease: "power2.out" });
			enter(tl, ".c-key-bio", 10.35);
			DECADES.forEach((d, i) => {
				const at = 10.4 + i * 0.12;
				tl.set(`.c-bio-${i}`, { autoAlpha: 1 }, at);
				rise(tl, `.c-bio-${i}`, BASE, d.bio * PER_K, at, 0.55);
				enter(tl, `.c-decade-${i}`, at);
			});
			enter(tl, ".c-key-comp", 11.25);
			DECADES.forEach((d, i) => {
				// Each computational segment stands on its biological bar, once that bar is up.
				const at = 11.3 + i * 0.12;
				tl.set(`.c-comp-${i}`, { autoAlpha: 1 }, at);
				rise(tl, `.c-comp-${i}`, BASE - d.bio * PER_K, d.comp * PER_K, at, 0.5);
			});
			enter(tl, ".c-cap-a", 12.35);

			// 5 · what classification accuracy can and cannot establish
			exit(tl, [".c-title", ".c-key", ".c-axis", ".c-decade", ".c-bars", ".c-cap-a"], "evidence");
			enter(tl, ".c-ev-head", 14.0);
			enter(tl, ".c-ev-row", 14.1, { stagger: 0.15 });
			enter(tl, ".c-ev-acc", 14.7);
			tl.set(".c-ev-ok", { autoAlpha: 1 }, 14.9);
			draw(tl, ".c-ev-ok", 14.9, 0.35);
			tl.set(".c-ev-no", { autoAlpha: 1 }, 15.3);
			draw(tl, ".c-ev-no-a", 15.3, 0.18);
			draw(tl, ".c-ev-no-b", 15.48, 0.18);
			enter(tl, ".c-ev-need", 15.75);
			enter(tl, ".c-cap-e", 16.1);

			// Back to the poster.
			exit(tl, [".c-ev-head", ".c-ev-row", ".c-ev-acc", ".c-ev-ok", ".c-ev-no", ".c-ev-need", ".c-cap-e"], 17.6);
			tl.set(".c-fill", { autoAlpha: 0 }, 17.9);
			tl.set(".c-num", { attr: { style: NUM_OFF } }, 17.9);
			restore(tl, poster, 17.95);
		},
	};
</script>

<ExplainerFrame {scene} {label} {size} {paused} {resting}>
	<defs>
		<clipPath id="{uid}-bars">
			<rect x="0" y="0" width="240" height={BASE - 0.6} />
		</clipPath>
	</defs>

	<!-- 1 · thirteen properties in four levels -->
	<text class="xp-mono c-kicker" x="14" y="30" font-size={T.label}>13 linguistic properties</text>
	{#each LEVELS as level, i}
		<g class="c-level">
			<text class="xp-mono" x="14" y={level.y} font-size={T.label}>{level.n}</text>
			<text class="xp-prose" x="46" y={level.y} font-size={T.body}>{level.name}</text>
			<line class="xp-rule" x1="14" x2="226" y1={level.y + 11} y2={level.y + 11} />
		</g>
		<g class="c-count c-count-{i}">
			{#each Array.from({ length: level.count }) as _, k}
				<circle cx={222.4 - k * 11} cy={level.y - 6} r="3.6" fill="var(--xp-accent)" />
			{/each}
		</g>
		<text class="xp-mono xp-later c-example c-example-{i}" x="226" y={level.y} font-size={T.label} text-anchor="end" style="color: var(--xp-accent-text)">{level.example}</text>
	{/each}
	<text class="xp-prose xp-caption c-cap-q" style="color: var(--xp-accent-text)"><tspan x="14" y="205">previously thought</tspan><tspan x="14" y="226">unique to humans</tspan></text>
	<text class="xp-prose xp-caption xp-later c-cap-l" style="color: var(--xp-accent-text)"><tspan x="14" y="205">rudimentary to</tspan><tspan x="14" y="226">most complex</tspan></text>

	<!-- 3 · a five-step pipeline, and the evaluation all five feed -->
	<line class="xp-later c-spine" x1="22" x2="22" y1={STAGES[0].y - 5} y2={STAGES[4].y - 5} stroke="var(--xp-rule)" stroke-width="1.6" />
	{#each STAGES as stage, i}
		<g class="xp-later c-stage">
			<circle cx="22" cy={stage.y - 5} r="9.5" fill="var(--xp-surface)" stroke="var(--xp-soft)" stroke-width="1.4" />
			<circle class="xp-later c-fill c-fill-{i}" cx="22" cy={stage.y - 5} r="9.5" fill="var(--xp-accent)" />
			<text class="xp-mono c-num c-num-{i}" x="22" y={stage.y - 0.5} font-size="13" text-anchor="middle" style={NUM_OFF}>{i + 1}</text>
			<text class="xp-prose" x="40" y={stage.y} font-size="17">{stage.name}</text>
		</g>
	{/each}
	<g class="xp-later c-eval">
		<rect x="14" y={EVAL_Y - 16} width="212" height="24" rx="2" fill="none" stroke="var(--xp-soft)" stroke-width="1.2" stroke-dasharray="3.5 3" />
		<text class="xp-mono" x="120" y={EVAL_Y} font-size={T.label} text-anchor="middle">evaluation</text>
	</g>
	<rect class="xp-later c-eval-on" x="14" y={EVAL_Y - 16} width="212" height="24" rx="2" fill="var(--xp-truth)" fill-opacity="0.12" />
	<text class="xp-prose xp-caption xp-later c-cap-p" x="14" y="214" style="color: var(--xp-text)">a 5-step pipeline</text>

	<!-- 4 · the literature, by decade -->
	<g class="xp-later c-title">
		<text class="xp-prose" x="14" y="30" font-size={T.head}>55,843 papers</text>
		<text class="xp-mono" x="226" y="30" font-size={T.label} text-anchor="end">1950–2026</text>
	</g>
	<text class="xp-mono xp-later c-key c-key-bio" x="14" y="50" font-size={T.label} style="color: var(--xp-human)">biological</text>
	<text class="xp-mono xp-later c-key c-key-comp" x="226" y="50" font-size={T.label} text-anchor="end">+ <tspan style="color: var(--xp-accent-text)">computational</tspan></text>
	<g class="c-bars" clip-path="url(#{uid}-bars)">
		<!-- Computational segments sit behind the biological bars, so each one's
		     tuck is hidden and the seam falls exactly on the biological top. -->
		{#each DECADES as d, i}
			<rect class="xp-later c-comp c-comp-{i}" x={d.x} {...barBox(BASE - d.bio * PER_K, d.comp * PER_K)} width={COL_W} rx="2" fill="var(--xp-accent)">
				<title>{d.span}: about {d.comp.toFixed(1)}k computational papers</title>
			</rect>
		{/each}
		{#each DECADES as d, i}
			<rect class="xp-later c-bio c-bio-{i}" x={d.x} {...barBox(BASE, d.bio * PER_K)} width={COL_W} fill="var(--xp-human)">
				<title>{d.span}: about {d.bio.toFixed(1)}k biological papers</title>
			</rect>
		{/each}
	</g>
	<line class="xp-later c-axis" x1="14" x2="226" y1={BASE} y2={BASE} stroke="var(--xp-soft)" stroke-width="1.2" />
	{#each DECADES as d, i}
		<text class="xp-mono xp-later c-decade c-decade-{i}" x={d.x + COL_W / 2} y={BASE + 17} font-size={T.label} text-anchor="middle">{d.label}</text>
	{/each}
	<text class="xp-prose xp-caption xp-later c-cap-a" style="color: var(--xp-accent-text)"><tspan x="14" y="205">the recent</tspan><tspan x="14" y="226">acceleration</tspan></text>

	<!-- 5 · what classification accuracy can and cannot establish -->
	<text class="xp-mono xp-later c-ev-head" x="14" y="30" font-size={T.label}>evidence</text>
	<text class="xp-mono xp-later c-ev-acc" x="226" y="30" font-size={T.label} text-anchor="end">accuracy</text>
	<g class="xp-later c-ev-row">
		<text class="xp-prose" x="14" y="60" font-size={T.head}>observer-side</text>
		<text class="xp-mono" x="14" y="80" font-size={T.label}>classification</text>
		<line class="xp-rule" x1="14" x2="226" y1="92" y2="92" />
	</g>
	<g class="xp-later c-ev-row">
		<text class="xp-prose" x="14" y="120" font-size={T.head}>animal-side</text>
		<line class="xp-rule" x1="14" x2="226" y1="152" y2="152" />
	</g>
	<text class="xp-mono xp-later c-ev-need" x="14" y="140" font-size={T.label} style="color: var(--xp-truth)">requires receiver behavior</text>
	<path class="xp-later c-ev-ok" d="M186 54 l5 5 l9 -11" fill="none" stroke="var(--xp-truth)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
	<g class="xp-later c-ev-no" stroke="var(--xp-accent)" stroke-width="2.2" stroke-linecap="round">
		<line class="c-ev-no-a" x1="188.5" y1="110" x2="198.5" y2="120" />
		<line class="c-ev-no-b" x1="198.5" y1="110" x2="188.5" y2="120" />
	</g>
	<text class="xp-prose xp-caption xp-later c-cap-e" style="color: var(--xp-accent-text)"><tspan x="14" y="184">accuracy cannot</tspan><tspan x="14" y="205">by itself establish</tspan><tspan x="14" y="226">animal-side claims</tspan></text>
</ExplainerFrame>
