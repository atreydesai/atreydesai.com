<script lang="ts" module>
	// Longitudinal Phonetic Adaptation in YouTube BookTube Creators
	// (Desai 2025, LING320)
	//
	// Beats: ten creators' early videos -> the same creators' late videos ->
	// the averages -> takeaway.
	//
	// Per-creator values (vocal fry %, engagement = likes/views x 100) are read
	// from the paper's per-creator bar charts (Figs. 1 and 5); they reproduce
	// Table 1's means and SDs (fry 15.0 ± 8.7 -> 8.7 ± 3.9, engagement
	// 4.38 ± 1.23 -> 7.31 ± 1.93). The averages beat is Table 1.
	import type { Beat } from "./motion";

	export const BEATS: Beat[] = [
		{ id: "early", label: "early", at: 0 },
		{ id: "late", label: "late", at: 2.6 },
		{ id: "averages", label: "averages", at: 7.4 },
		{ id: "takeaway", label: "takeaway", at: 11.4 },
	];
	export const DURATION = 14.6;

	// [creator, early fry %, late fry %, early engagement, late engagement]
	const CREATORS: [string, number, number, number, number][] = [
		["abookolive", 29.6, 9.8, 5.0, 10.5],
		["BooksandLala", 29.5, 14.4, 4.7, 7.4],
		["Emma Snyder", 20.0, 11.2, 3.6, 5.1],
		["gabbyreads", 6.4, 3.9, 4.0, 7.1],
		["Hailey in Bookland", 14.8, 8.3, 3.1, 6.5],
		["Haley Pham", 8.5, 5.2, 4.0, 4.3],
		["Katytastic", 14.3, 12.4, 2.7, 9.2],
		["onceuponanemilyreads", 10.2, 10.7, 6.5, 7.2],
		["Sara Carrolli", 8.0, 2.0, 4.1, 6.3],
		["Syd BookWorrom", 8.7, 9.1, 6.1, 9.4],
	];

	// A paired early/late chart, one panel per measure, as in the paper's
	// Figs. 1 and 5. Time runs left to right in both panels: every creator's
	// line spans the same width, from the early column to the late one, so
	// all twenty draw together as one sweep and land at once (both measures
	// come from the same videos). Dots sit with their outer edge on the
	// panel's edge, at the ends of the axis rule; each line stops the same
	// small gap short of its two dots, so no line runs under any dot.
	export const R = 4;
	const GAP = R + 1.5;
	const TOP = 46;
	const BOT = 152;
	export const AXIS_Y = 162;
	export const PANELS = [
		{ key: "fry", label: "vocal fry", x0: 14, x1: 106, lo: 0, hi: 30, col: 1, unit: (v: number) => `${v}% vocal fry` },
		{ key: "eng", label: "engagement", x0: 134, x1: 226, lo: 2, hi: 11, col: 3, unit: (v: number) => `engagement rate ${v}` },
	].map((p) => {
		const y = (v: number) => BOT - ((v - p.lo) / (p.hi - p.lo)) * (BOT - TOP);
		const ex = p.x0 + R;
		const lx = p.x1 - R;
		return {
			...p,
			ex,
			lx,
			rows: CREATORS.map((c) => {
				const early = c[p.col] as number;
				const late = c[p.col + 1] as number;
				const ye = y(early);
				const yl = y(late);
				const len = Math.hypot(lx - ex, yl - ye);
				const ux = (lx - ex) / len;
				const uy = (yl - ye) / len;
				return {
					name: c[0],
					early,
					late,
					ye,
					yl,
					line: { x1: ex + ux * GAP, y1: ye + uy * GAP, x2: lx - ux * GAP, y2: yl - uy * GAP },
				};
			}),
		};
	});

	// Table 1: labels carry the units, early values sit on the margin, the
	// arrows share one column and the late values the next.
	export const STATS = [
		{ name: "vocal fry (%)", from: "15.0", to: "8.7", y: 62 },
		{ name: "pitch range (Hz)", from: "290.9", to: "319.3", y: 122 },
		{ name: "engagement rate", from: "4.38", to: "7.31", y: 182 },
	];
	export const VALUE_DY = 27;
	export const COL_ARROW = 88;
	export const COL_TO = 124;
</script>

<script lang="ts">
	import ExplainerFrame from "./ExplainerFrame.svelte";
	import { T, draw, enter, exit, restore, swap, type Scene } from "./motion";

	let { size = "card", paused = false, resting = false, label }: {
		size?: "card" | "stage";
		paused?: boolean;
		resting?: boolean;
		label: string;
	} = $props();

	const scene: Scene = {
		beats: BEATS,
		duration: DURATION,
		build(gsap, tl) {
			const poster = [".k-chart", ".k-early", ".k-cap-q"];

			// 2 · the same creators, late: one sweep from the early column to
			// the late one in both panels, every late dot landing as its line
			// arrives.
			swap(tl, ".k-cap-q", ".k-cap-r", 2.6);
			tl.set(".k-move", { autoAlpha: 1 }, 2.9);
			draw(tl, ".k-move", 2.9, 1.2, { ease: "power1.inOut" });
			enter(tl, ".k-late", 4.05, { y: 0, duration: 0.25 });

			// 3 · the averages
			exit(tl, [".k-chart", ".k-early", ".k-move", ".k-late", ".k-cap-r"], "averages");
			enter(tl, ".k-title", 7.7);
			enter(tl, ".k-stat", 7.9, { stagger: 0.2 });

			// 4 · takeaway
			exit(tl, [".k-title", ".k-stat"], "takeaway");
			enter(tl, ".k-take", 11.7, { stagger: 0.12 });

			// Back to the poster.
			exit(tl, ".k-take", 13.7);
			restore(tl, poster, 14.0);
		},
	};
</script>

<ExplainerFrame {scene} {label} {size} {paused} {resting}>
	<!-- 1 · poster: early videos, one panel per measure -->
	{#each PANELS as p}
		<g class="k-chart">
			<text class="xp-mono" x={p.x0} y="30" font-size={T.label}>{p.label}</text>
			<line class="xp-rule" x1={p.x0} x2={p.x1} y1={AXIS_Y} y2={AXIS_Y} />
			<text class="xp-mono" x={p.x0} y={AXIS_Y + 16} font-size={T.label} style="color: var(--xp-human)">early</text>
			<text class="xp-mono" x={p.x1} y={AXIS_Y + 16} font-size={T.label} text-anchor="end" style="color: var(--xp-accent-text)">late</text>
		</g>
	{/each}
	{#each PANELS as p}
		{#each p.rows as row}
			<line
				class="xp-later k-move"
				x1={row.line.x1}
				y1={row.line.y1}
				x2={row.line.x2}
				y2={row.line.y2}
				stroke="var(--xp-faint)"
				stroke-width="1.3"
				stroke-linecap="round"
			/>
		{/each}
	{/each}
	{#each PANELS as p}
		{#each p.rows as row}
			<circle class="k-early" cx={p.ex} cy={row.ye} r={R} fill="var(--xp-human)" stroke="var(--xp-surface)" stroke-width="1">
				<title>{row.name}, early videos, {p.unit(row.early)}</title>
			</circle>
		{/each}
	{/each}
	{#each PANELS as p}
		{#each p.rows as row}
			<circle class="xp-later k-late" cx={p.lx} cy={row.yl} r={R} fill="var(--xp-accent)" stroke="var(--xp-surface)" stroke-width="1">
				<title>{row.name}, late videos, {p.unit(row.late)}</title>
			</circle>
		{/each}
	{/each}

	<text class="xp-prose xp-caption k-cap-q" style="color: var(--xp-human)"><tspan x="14" y="205">ten BookTubers’</tspan><tspan x="14" y="226">earliest uploads</tspan></text>
	<text class="xp-prose xp-caption xp-later k-cap-r" style="color: var(--xp-accent-text)"><tspan x="14" y="205">vocal fry decreased</tspan><tspan x="14" y="226">engagement rose</tspan></text>

	<!-- 3 · the averages (Table 1) -->
	<text class="xp-prose xp-later k-title" x="14" y="30" font-size={T.head}>On average</text>
	{#each STATS as s, i}
		<g class="xp-later k-stat">
			<text class="xp-mono" x="14" y={s.y} font-size={T.label}>{s.name}</text>
			<text class="xp-display" x="14" y={s.y + VALUE_DY} font-size="26" style="color: var(--xp-human)">{s.from}</text>
			<text class="xp-display" x={COL_ARROW} y={s.y + VALUE_DY} font-size="26" style="color: var(--xp-faint)">→</text>
			<text class="xp-display" x={COL_TO} y={s.y + VALUE_DY} font-size="26" style="color: var(--xp-accent-text)">{s.to}</text>
			{#if i < STATS.length - 1}
				<line class="xp-rule" x1="14" x2="226" y1={s.y + VALUE_DY + 12} y2={s.y + VALUE_DY + 12} />
			{/if}
		</g>
	{/each}

	<!-- 4 · takeaway -->
	<text class="xp-prose xp-later k-take" x="120" y="90" font-size={T.body} text-anchor="middle">Instead of becoming</text>
	<text class="xp-prose xp-later k-take" x="120" y="115" font-size={T.body} text-anchor="middle">more informal,</text>
	<text class="xp-prose xp-later k-take" x="120" y="152" font-size={T.body} text-anchor="middle" style="color: var(--xp-accent-text)">creators tend to</text>
	<text class="xp-prose xp-later k-take" x="120" y="177" font-size={T.body} text-anchor="middle" style="color: var(--xp-accent-text)">professionalize.</text>
</ExplainerFrame>
