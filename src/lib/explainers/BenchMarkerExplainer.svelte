<script lang="ts" module>
	// BenchMarker: An Education-Inspired Toolkit for Highlighting Flaws in
	// Multiple-Choice Benchmarks (Balepur et al. 2026)
	//
	// Beats: the three flaws LLM judges flag -> how many items are found
	// online -> how many have 2+ writing errors -> what dropping those items
	// does to the leaderboard.
	//
	// Bar values are the printed labels of Fig. 2 (contamination; writing
	// flaws violating 2+ rules), the four student assessments first. Ranks are
	// Table 5, "2+ Writing Errors": All vs No Flaw. On-plate wording follows
	// the paper (Fig. 1's report card, Fig. 2's caption, the abstract).
	import type { Beat } from "./motion";

	export const BEATS: Beat[] = [
		{ id: "checks", label: "checks", at: 0 },
		{ id: "online", label: "online", at: 2.6 },
		{ id: "written", label: "writing", at: 6.4 },
		{ id: "ranks", label: "ranks", at: 10.2, hold: 14.2 },
	];
	export const DURATION = 15.6;

	// Twelve bars on the 14..226 plate: pitch 17, a wider gap between groups.
	export const BAR_W = 13;
	const PITCH = 17;
	const GROUP_X = [14, 94];

	export const DATASETS = [
		{ name: "AQuA", exam: true, online: 0.17, rules: 0.44 },
		{ name: "ARC", exam: true, online: 0.39, rules: 0.43 },
		{ name: "MMLU", exam: true, online: 0.45, rules: 0.64 },
		{ name: "SAT", exam: true, online: 0.24, rules: 0.25 },
		{ name: "CommonsenseQA", exam: false, online: 0.06, rules: 0.96 },
		{ name: "HellaSwag", exam: false, online: 0.0, rules: 1.0 },
		{ name: "OpenBookQA", exam: false, online: 0.04, rules: 0.9 },
		{ name: "PIQA", exam: false, online: 0.05, rules: 0.93 },
		{ name: "QASC", exam: false, online: 0.06, rules: 0.97 },
		{ name: "SocialIQA", exam: false, online: 0.0, rules: 0.95 },
		{ name: "SuperGPQA", exam: false, online: 0.06, rules: 0.77 },
		{ name: "TruthfulQA", exam: false, online: 0.47, rules: 0.97 },
	].map((d, i) => ({ ...d, x: d.exam ? GROUP_X[0] + i * PITCH : GROUP_X[1] + (i - 4) * PITCH }));

	export const BASE = 160;
	export const H = 100;
	// The smallest visible bar, so a 0% dataset still reads as present.
	export const MIN_H = 1.5;

	// Fig. 1's report card: "found online", "has a shortcut", writing errors.
	export const CHECKS = [
		{ text: "found online?", y: 74 },
		{ text: "has a shortcut?", y: 110 },
		{ text: "writing errors?", y: 146 },
	];

	// Top four models; [rank on all items, rank once items with 2+ writing
	// errors are removed].
	export const RANKS = [
		{ name: "GPT-5", from: 1, to: 2 },
		{ name: "Claude 4.5 Sonnet", from: 2, to: 4 },
		{ name: "Gemini 2.5 Pro", from: 3, to: 1, mover: true },
		{ name: "GPT-5 Mini", from: 4, to: 3 },
	];
	export const rankY = (rank: number) => 58 + rank * 25;
</script>

<script lang="ts">
	import ExplainerFrame from "./ExplainerFrame.svelte";
	import { DUR, EASE, T, barBox, draw, enter, exit, resize, restore, rise, type Scene } from "./motion";

	let { size = "card", paused = false, resting = false, label }: {
		size?: "card" | "stage";
		paused?: boolean;
		resting?: boolean;
		label: string;
	} = $props();

	const uid = $props.id();
	const height = (v: number) => Math.max(MIN_H, v * H);

	const scene: Scene = {
		beats: BEATS,
		duration: DURATION,
		build(gsap, tl, root) {
			const bars = root.querySelectorAll<SVGRectElement>(".b-bar");
			const rows = root.querySelectorAll<SVGTextElement>(".b-row");
			const nums = root.querySelectorAll(".b-rank-n");
			const rules = root.querySelectorAll(".b-rank-rule");
			const poster = [".b-kicker", ".b-check", ".b-cap-q"];
			// Text replaced in place leaves before its successor arrives, so two
			// strings never share a spot mid-fade.
			const handoff = (out: string | string[], into: string, at: number) => {
				exit(tl, out, at);
				enter(tl, into, at + DUR.exit);
			};

			// 2 · how many items are found online
			exit(tl, ".b-check", "online");
			handoff(".b-kicker", ".b-title-o", 2.6);
			handoff(".b-cap-q", ".b-cap-o", 2.6);
			// The axis draws, the groups are named, then the bars rise left to
			// right from the axis; the one number comes after every bar is up.
			tl.set(".b-base", { autoAlpha: 1 }, 2.95);
			draw(tl, ".b-base", 2.95, 0.5);
			enter(tl, ".b-groups", 3.05);
			bars.forEach((bar, i) => {
				tl.set(bar, { autoAlpha: 1 }, 3.2);
				rise(tl, bar, BASE, height(DATASETS[i].online), 3.2 + i * 0.05);
			});
			enter(tl, ".b-val-o", 4.5);

			// 3 · how many have two or more writing errors
			exit(tl, ".b-val-o", "written");
			handoff(".b-title-o", ".b-title-w", 6.4);
			handoff(".b-cap-o", ".b-cap-w", 6.4);
			bars.forEach((bar, i) => resize(tl, bar, BASE, height(DATASETS[i].rules), 6.75 + i * 0.05));
			enter(tl, ".b-val-w", 8.15);

			// 4 · the leaderboard, with and without items with 2+ writing errors
			exit(tl, [".b-val-w", ".b-bar", ".b-groups", ".b-base", ".b-cap-w"], "ranks");
			handoff(".b-title-w", ".b-title-r", 10.2);
			enter(tl, ".b-sub-all", 10.6);
			// Row by row, top to bottom: rank, name and rule together.
			RANKS.forEach((_, i) => enter(tl, [nums[i], rows[i], rules[i]], 10.7 + i * 0.08));
			handoff(".b-sub-all", ".b-sub-clean", 11.7);

			// The reshuffle, with no row ever passing over another: the two
			// models that drop sink out of their rows, the risers climb into the
			// cleared slots, then the droppers settle into their new rows.
			const drop = (r: (typeof RANKS)[number]) => r.to > r.from;
			const shift = (r: (typeof RANKS)[number]) => rankY(r.to) - rankY(r.from);
			RANKS.forEach((r, i) => {
				if (!drop(r)) return;
				tl.to(rows[i], { autoAlpha: 0, y: 4, duration: DUR.exit, ease: EASE.exit }, 12.3);
			});
			RANKS.forEach((r, i) => {
				if (drop(r)) return;
				tl.to(rows[i], { y: shift(r), duration: 0.8, ease: "power3.inOut" }, r.mover ? 12.45 : 12.52);
			});
			enter(tl, ".b-cap-r", 12.45);
			RANKS.filter(drop)
				.sort((a, b) => a.to - b.to)
				.forEach((r, k) => {
					const i = RANKS.indexOf(r);
					tl.fromTo(
						rows[i],
						{ autoAlpha: 0, y: shift(r) - 4 },
						{ autoAlpha: 1, y: shift(r), duration: DUR.enter, ease: EASE.enter, immediateRender: false },
						13.2 + k * 0.1,
					);
				});

			// Back to the poster.
			exit(tl, [".b-title-r", ".b-rank-n", ".b-rank-rule", ".b-row", ".b-sub-clean", ".b-cap-r"], 14.5);
			tl.set(".b-row", { y: 0 }, 14.85);
			tl.set(bars, { attr: barBox(BASE, 0) }, 14.85);
			restore(tl, poster, 14.9);
		},
	};
</script>

<ExplainerFrame {scene} {label} {size} {paused} {resting}>
	<defs>
		<clipPath id="{uid}-bars">
			<rect x="0" y="0" width="240" height={BASE - 0.6} />
		</clipPath>
	</defs>

	<!-- 1 · poster: the three flaws, per item -->
	<text class="xp-mono b-kicker" x="14" y="32" font-size={T.label}>LLM judges flag 3 flaws</text>
	{#each CHECKS as check}
		<g class="b-check">
			<text class="xp-prose" x="14" y={check.y} font-size={T.body}>{check.text}</text>
			<rect x="208" y={check.y - 15} width="18" height="18" rx="2" fill="none" stroke="var(--xp-soft)" stroke-width="1.4" />
			<line class="xp-rule" x1="14" x2="226" y1={check.y + 10} y2={check.y + 10} />
		</g>
	{/each}
	<text class="xp-prose xp-caption b-cap-q" style="color: var(--xp-accent-text)"><tspan x="14" y="205">a report card</tspan><tspan x="14" y="226">for benchmarks</tspan></text>

	<!-- 2 & 3 · twelve benchmarks -->
	<text class="xp-prose xp-later b-title-o" x="14" y="32" font-size={T.head}>found online</text>
	<text class="xp-prose xp-later b-title-w" x="14" y="32" font-size={T.head}>2+ writing errors</text>
	<g clip-path="url(#{uid}-bars)">
		{#each DATASETS as d}
			<rect
				class="xp-later b-bar"
				x={d.x}
				{...barBox(BASE, 0)}
				width={BAR_W}
				rx="1.5"
				fill={d.exam ? "var(--xp-human)" : "var(--xp-accent)"}
			>
				<title>{d.name}: {Math.round(d.online * 100)}% found online, {Math.round(d.rules * 100)}% violate 2+ writing rules</title>
			</rect>
		{/each}
	</g>
	<line class="xp-later b-base" x1="14" x2="226" y1={BASE} y2={BASE} stroke="var(--xp-soft)" stroke-width="1.2" />
	<text class="xp-mono xp-later b-val-o" x={DATASETS[2].x + BAR_W / 2} y={BASE - DATASETS[2].online * H - 7} font-size={T.label} text-anchor="middle" style="color: var(--xp-human)">45%</text>
	<text class="xp-mono xp-later b-val-w" x={DATASETS[5].x + BAR_W / 2} y={BASE - H - 7} font-size={T.label} text-anchor="middle" style="color: var(--xp-accent-text)">100%</text>
	<g class="xp-later b-groups">
		<text class="xp-mono" x={GROUP_X[0]} y="180" font-size={T.label} style="color: var(--xp-human)">student</text>
		<text class="xp-mono" x={GROUP_X[1]} y="180" font-size={T.label} style="color: var(--xp-accent-text)">non-student</text>
	</g>
	<text class="xp-prose xp-caption xp-later b-cap-o" style="color: var(--xp-human)"><tspan x="14" y="205">exam MCQs are</tspan><tspan x="14" y="226">more contaminated</tspan></text>
	<text class="xp-prose xp-caption xp-later b-cap-w" style="color: var(--xp-human)"><tspan x="14" y="205">exams have far</tspan><tspan x="14" y="226">fewer writing flaws</tspan></text>

	<!-- 4 · the leaderboard reshuffles -->
	<text class="xp-prose xp-later b-title-r" x="14" y="32" font-size={T.head}>LLM rankings</text>
	<text class="xp-mono xp-later b-sub-all" x="14" y="52" font-size={T.label}>all items</text>
	<text class="xp-mono xp-later b-sub-clean" x="14" y="52" font-size={T.label} style="color: var(--xp-accent-text)">2+ writing errors removed</text>
	{#each RANKS as r}
		<text class="xp-mono xp-later b-rank-n" x="14" y={rankY(r.from)} font-size={T.label}>{r.from}</text>
		<line class="xp-rule xp-later b-rank-rule" x1="14" x2="226" y1={rankY(r.from) + 9} y2={rankY(r.from) + 9} />
	{/each}
	{#each RANKS as r}
		<text
			class="xp-prose xp-later b-row"
			x="36"
			y={rankY(r.from)}
			font-size={T.stem}
			style={r.mover ? "color: var(--xp-accent-text)" : undefined}>{r.name}</text
		>
	{/each}
	<text class="xp-prose xp-caption xp-later b-cap-r" style="color: var(--xp-accent-text)"><tspan x="14" y="205">writing errors</tspan><tspan x="14" y="226">change rankings</tspan></text>
</ExplainerFrame>
