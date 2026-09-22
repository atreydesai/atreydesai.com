<script lang="ts" module>
	// Language Models Generate Multiple-Choice Questions with Artifacts
	// (Desai, Balepur & Rudinger, MASC-SLL 2025)
	//
	// Beats: an LLM-written question -> strike the question and it is still
	// answered -> accuracy with and without the question -> takeaway.
	//
	// The item is the poster's own Full / Choices-Only Prompt example ("What is
	// the predicate logic translation of 'For all x, if P of x then Q of x'?",
	// gold C), and the takeaway is its headline. The poster (the only published
	// version) leaves its bars unlabeled, so the accuracies are read against its
	// gridlines (about +/-0.01): GPT-4o-mini on human-written MMLU-ARC items,
	// 0.80 with the full prompt vs 0.38 choices only (Fig. 1); on its own
	// question-answer-distractors, comprehension-level items, 0.96 vs 0.96
	// (Fig. 2, left).
	import type { Beat } from "./motion";

	export const BEATS: Beat[] = [
		{ id: "question", label: "question", at: 0 },
		{ id: "struck", label: "choices only", at: 2.8 },
		{ id: "accuracy", label: "accuracy", at: 6.6 },
		{ id: "takeaway", label: "takeaway", at: 10.6 },
	];
	export const DURATION = 13.8;

	export const CHOICES = [
		{ letter: "A", text: "∃x (P(x) ∧ Q(x))", y: 104 },
		{ letter: "B", text: "∀x (P(x) ∧ Q(x))", y: 130 },
		{ letter: "C", text: "∀x (P(x) → Q(x))", y: 156, gold: true },
		{ letter: "D", text: "∃x (P(x) → Q(x))", y: 182 },
	];

	// Bars: 100% would stand H units tall on the axis at y=BASE. Two groups of
	// two bars span the plate margins exactly (14 to 110, 130 to 226).
	export const BASE = 158;
	export const H = 80;
	export const BAR_W = 44;
	export const BAR_GAP = 8;
	export const GROUPS = [
		{ name: "human-written", x: 14, bars: [0.8, 0.38] },
		{ name: "LLM-generated", x: 130, bars: [0.96, 0.96] },
	];
	export const CONDITIONS = ["with", "no Q"];
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
	const gold = CHOICES.find((c) => c.gold)!;
	const GROUP_W = 2 * BAR_W + BAR_GAP;
	// All four bars, in the order they rise: human with/without, LLM with/without.
	const BARS = GROUPS.flatMap((g, gi) =>
		g.bars.map((v, b) => ({ v, b, g: gi, x: g.x + b * (BAR_W + BAR_GAP) })),
	);

	// The two question lines and the strokes that strike them. x2 is a close
	// default for Optima; the build refits it to the rendered text, since the
	// prose face is a system font with fallbacks.
	const STEM = [
		{ text: "‘For all x, if P of x", y: 50, x2: 156.6 },
		{ text: "then Q of x’", y: 73, x2: 113.9 },
	];
	const STRIKE_X1 = 15.1; // round cap reaches back to the x=14 margin
	const CAP = 1.1; // half the strike's width

	const scene: Scene = {
		beats: BEATS,
		duration: DURATION,
		build(gsap, tl, root) {
			const poster = [".a-kicker", ".a-stem", ".a-choice", ".a-gold", ".a-cap-q"];

			// Fit each strike to its line: from the margin to the end of the
			// closing quote, caps included.
			const lines = root.querySelectorAll<SVGTextElement>(".a-stem text");
			const strikes = root.querySelectorAll<SVGLineElement>(".a-strike");
			lines.forEach((line, i) => {
				const b = line.getBBox();
				if (b.width > 0) strikes[i]?.setAttribute("x2", String(b.x + b.width - CAP + 0.4));
			});

			// 2 · choices only: name the condition, strike the question line by
			// line, then show the answer is still found.
			swap(tl, ".a-kicker", ".a-kicker-no", 2.8);
			let at = 3.2;
			strikes.forEach((strike) => {
				const len = Math.max(0, Number(strike.getAttribute("x2")) - STRIKE_X1);
				const dur = 0.12 + len / 480;
				// Shown only as its own stroke starts, so no line waits drawn.
				draw(tl, strike, at, dur);
				tl.set(strike, { autoAlpha: 1 }, at);
				at += dur + 0.05;
			});
			tl.to(".a-stem", { opacity: 0.3, duration: 0.4, ease: "power2.out" }, at);
			tl.fromTo(
				".a-gold-tint",
				{ attr: { "fill-opacity": 0.1 } },
				{ attr: { "fill-opacity": 0.26 }, duration: 0.3, yoyo: true, repeat: 1, ease: "power2.inOut", immediateRender: false },
				at + 0.35,
			);
			swap(tl, ".a-cap-q", ".a-cap-s", at + 0.35);

			// 3 · accuracy with and without the question
			exit(tl, [".a-kicker-no", ".a-stem", ".a-strike", ".a-choice", ".a-gold", ".a-cap-s"], "accuracy");
			enter(tl, ".a-title", 6.9);
			tl.set(".a-axis", { autoAlpha: 1 }, 7.0);
			draw(tl, ".a-axis", 7.0, 0.45, { ease: "power2.out" });
			// Each group's label, then its bars in reading order; a bar's
			// condition rises with it, its number once it has arrived.
			BARS.forEach((bar, k) => {
				const t = 7.3 + k * 0.32 + bar.g * 0.36;
				if (bar.b === 0) enter(tl, `.a-group-${bar.g}`, t - 0.15);
				tl.set(`.a-bar-${k}`, { autoAlpha: 1 }, t);
				rise(tl, `.a-bar-${k}`, BASE, bar.v * H, t);
				enter(tl, `.a-cond-${k}`, t);
				enter(tl, `.a-val-${k}`, t + 0.7);
			});
			enter(tl, ".a-cap-a", 9.75);

			// 4 · takeaway: the poster's headline, in its two halves
			exit(tl, [".a-title", ".a-group", ".a-axis", ".a-bar", ".a-cond", ".a-val", ".a-cap-a"], "takeaway");
			enter(tl, ".a-take-1", 10.85, { stagger: 0.12 });
			enter(tl, ".a-take-2", 11.45, { stagger: 0.12 });

			// Back to the poster.
			exit(tl, [".a-take-1", ".a-take-2"], 12.9);
			restore(tl, poster, 13.2);
		},
	};
</script>

<ExplainerFrame {scene} {label} {size} {paused} {resting}>
	<defs>
		<clipPath id="{uid}-bars">
			<rect x="0" y="0" width="240" height={BASE - 0.6} />
		</clipPath>
	</defs>

	<!-- 1 · poster: an LLM-written question, full prompt -->
	<text class="xp-mono a-kicker" x="14" y="26" font-size={T.label}>logic translation of:</text>
	<text class="xp-mono xp-later a-kicker-no" x="14" y="26" font-size={T.label} style="color: var(--xp-accent-text)">choices only:</text>
	<g class="a-stem">
		{#each STEM as line}
			<text class="xp-prose" x="14" y={line.y} font-size={T.stem} font-style="italic">{line.text}</text>
		{/each}
	</g>
	{#each STEM as line}
		<line class="xp-later a-strike" x1={STRIKE_X1} x2={line.x2} y1={line.y - 5.5} y2={line.y - 5.5} stroke="var(--xp-accent)" stroke-width={CAP * 2} stroke-linecap="round" />
	{/each}

	<rect class="a-gold a-gold-tint" x="14" y={gold.y - 18} width="212" height="26" rx="2" fill="var(--xp-truth)" fill-opacity="0.1" />
	{#each CHOICES as choice}
		<g class="a-choice">
			<text class="xp-mono" x="14" y={choice.y} font-size="14">{choice.letter}</text>
			<text class="xp-mono" x="34" y={choice.y} font-size="15.5" style="color: {choice.gold ? 'var(--xp-truth)' : 'var(--xp-strong)'}">{choice.text}</text>
			<line class="xp-rule" x1="14" x2="226" y1={choice.y + 8} y2={choice.y + 8} />
		</g>
	{/each}
	<path class="a-gold" d="M204 {gold.y - 6} l5 5 l9 -11" fill="none" stroke="var(--xp-truth)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />

	<text class="xp-prose xp-caption a-cap-q" x="14" y="214" style="color: var(--xp-accent-text)">an LLM wrote this</text>
	<text class="xp-prose xp-caption xp-later a-cap-s" x="14" y="214" style="color: var(--xp-accent-text)">still solved</text>

	<!-- 3 · accuracy with and without the question -->
	<text class="xp-prose xp-later a-title" x="14" y="30" font-size={T.head}>GPT-4o-mini accuracy</text>
	{#each GROUPS as group, g}
		<text
			class="xp-prose xp-later a-group a-group-{g}"
			x={group.x + GROUP_W / 2}
			y="54"
			font-size="14.5"
			text-anchor="middle"
			style="color: var(--xp-text)">{group.name}</text
		>
	{/each}
	<g clip-path="url(#{uid}-bars)">
		{#each BARS as bar, k}
			<rect
				class="xp-later a-bar a-bar-{k}"
				x={bar.x}
				{...barBox(BASE, bar.v * H)}
				width={BAR_W}
				rx="2"
				fill={bar.b === 0 ? "var(--xp-faint)" : "var(--xp-accent)"}
			/>
		{/each}
	</g>
	<line class="xp-later a-axis" x1="14" x2="226" y1={BASE} y2={BASE} stroke="var(--xp-soft)" stroke-width="1.2" />
	{#each BARS as bar, k}
		<text class="xp-mono xp-later a-cond a-cond-{k}" x={bar.x + BAR_W / 2} y={BASE + 17} font-size={T.label} text-anchor="middle">{CONDITIONS[bar.b]}</text>
		<text
			class="xp-mono xp-later a-val a-val-{k}"
			x={bar.x + BAR_W / 2}
			y={BASE - bar.v * H - 6}
			font-size="14"
			text-anchor="middle"
			style="color: {bar.b === 0 ? 'var(--xp-soft)' : 'var(--xp-accent-text)'}">{Math.round(bar.v * 100)}%</text
		>
	{/each}
	<text class="xp-prose xp-caption xp-later a-cap-a" style="color: var(--xp-accent-text)"><tspan x="14" y="201">often exceeds 90%</tspan><tspan x="14" y="222">using only choices</tspan></text>

	<!-- 4 · takeaway: the poster's headline -->
	<text class="xp-prose xp-later a-take-1" x="120" y="84" font-size={T.body} text-anchor="middle">LLMs’ questions</text>
	<text class="xp-prose xp-later a-take-1" x="120" y="109" font-size={T.body} text-anchor="middle">look good at first…</text>
	<text class="xp-prose xp-later a-take-2" x="120" y="146" font-size={T.body} text-anchor="middle" style="color: var(--xp-accent-text)">… but they’re full</text>
	<text class="xp-prose xp-later a-take-2" x="120" y="171" font-size={T.body} text-anchor="middle" style="color: var(--xp-accent-text)">of shortcuts!</text>
</ExplainerFrame>
