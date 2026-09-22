<script lang="ts" module>
	// Test-Time Reasoners Are Strategic Multiple-Choice Test-Takers
	// (Balepur, Desai & Rudinger 2026)
	//
	// Beats: hide the question -> the model names properties of the choices,
	// infers the original question and picks C -> accuracy with no question ->
	// takeaway.
	//
	// The item is the paper's own INFER Q example (Trace A.5): ARC-Challenge,
	// gold C. The tags are that trace's own grouping ("three are non-renewable",
	// "grouped as 'finite resources'", "one, trees, is renewable"), and the
	// question is the one it writes: "Which of the following is a renewable
	// resource?". The captions are the paper's names for the two strategies
	// ("naming properties of choices", Sec. 1; "Inferring the Original
	// Question", Trace A.5). 56% is GPT-5's choices-only accuracy on ARC (0.557,
	// Sec. 3.1); random is 0.25.
	import type { Beat } from "./motion";

	export const BEATS: Beat[] = [
		{ id: "question", label: "hidden", at: 0 },
		{ id: "reason", label: "inferred", at: 2.2 },
		{ id: "accuracy", label: "accuracy", at: 7.0 },
		{ id: "takeaway", label: "takeaway", at: 10.8 },
	];
	export const DURATION = 14;

	// Question bar: 14..60, two lines of the inferred question.
	export const QBAR = { y: 14, height: 46 };
	export const QLINES = [
		{ text: "which of the following", y: 33, clip: { x: 30, y: 14, height: 25, width: 180 } },
		{ text: "is a renewable resource?", y: 54, clip: { x: 22, y: 39, height: 21, width: 196 } },
	];

	// Rows 27 apart; each rule sits 8 under its row's baseline.
	export const CHOICES = [
		{ letter: "A", text: "oil", tag: "finite", y: 88 },
		{ letter: "B", text: "coal", tag: "finite", y: 115 },
		{ letter: "C", text: "trees", tag: "renewable", y: 142, gold: true },
		{ letter: "D", text: "aluminum", tag: "finite", y: 169 },
	];
	export const RULE = 8;

	// Bars: 100% accuracy would stand 120 units tall on a baseline at y=178.
	// The pair is centred on the plate (48..108, 132..192).
	export const BASE = 178;
	export const SCALE = 1.2;
	export const BAR_W = 60;
	export const BARS = [
		{ name: "random", value: 25, x: 48 },
		{ name: "GPT-5", value: 55.7, x: 132 },
	];
</script>

<script lang="ts">
	import ExplainerFrame from "./ExplainerFrame.svelte";
	import { DUR, EASE, T, barBox, draw, enter, exit, restore, rise, write, type Scene } from "./motion";

	let { size = "card", paused = false, resting = false, label }: {
		size?: "card" | "stage";
		paused?: boolean;
		resting?: boolean;
		label: string;
	} = $props();

	const uid = $props.id();
	const gold = CHOICES.find((c) => c.gold)!;
	const above = CHOICES[CHOICES.indexOf(gold) - 1];
	// The picked word and tag: their own ink, mixed toward sage as --pick
	// runs 0% -> 100%. Theme-safe, since both ends stay variables.
	const mix = (ink: string) => `color: color-mix(in srgb, var(--xp-truth) var(--pick, 0%), var(${ink}))`;

	const scene: Scene = {
		beats: BEATS,
		duration: DURATION,
		build(gsap, tl, root) {
			const wipes = [...root.querySelectorAll(".r-wipe")];
			const poster = [".r-qbar", ".r-hidden", ".r-row", ".r-cap-q"];

			// Captions hand over in sequence: the next one starts only once the
			// last has gone, so two captions never share the band. It fades in
			// place rather than rising, since a rise would carry the second
			// line's descenders (the g and q of "original question") across
			// the card's progress rail.
			const handover = (out: string, into: string, at: number) => {
				exit(tl, out, at);
				tl.fromTo(
					into,
					{ autoAlpha: 0 },
					{ autoAlpha: 1, duration: DUR.enter, ease: EASE.enter, immediateRender: false },
					at + 0.3,
				);
			};

			// 2 · it names properties of the choices, top to bottom ...
			handover(".r-cap-q", ".r-cap-p", 2.2);
			enter(tl, ".r-tag", 2.75, { stagger: 0.28 });
			// ... infers the original question, one line at a time ...
			exit(tl, ".r-hidden", 4.1);
			handover(".r-cap-p", ".r-cap-i", 4.1);
			tl.set(".r-guess", { autoAlpha: 1 }, 4.5);
			write(tl, wipes[0], QLINES[0].clip.width, 4.5, 0.5);
			write(tl, wipes[1], QLINES[1].clip.width, 5.0, 0.55);
			// ... then answers it: C's word and tag turn sage in place (a
			// colour mix, so the glyphs never double), the rest step back.
			const pick = 5.8;
			tl.fromTo(".r-hl", { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.35, ease: "power2.out", immediateRender: false }, pick);
			tl.fromTo(".r-pick", { "--pick": "0%" }, { "--pick": "100%", duration: 0.35, ease: "power2.out", immediateRender: false }, pick);
			tl.to(".r-dim", { opacity: 0.35, duration: 0.4, ease: "power2.out" }, pick);
			tl.set(".r-check", { autoAlpha: 1 }, pick + 0.2);
			draw(tl, ".r-check", pick + 0.2, 0.35);

			// 3 · accuracy with no question at all
			exit(tl, [".r-qbar", ".r-guess", ".r-row", ".r-tag", ".r-hl", ".r-check", ".r-cap-i"], "accuracy");
			enter(tl, ".r-title", 7.35);
			tl.set(".r-axis", { autoAlpha: 1 }, 7.55);
			draw(tl, ".r-axis", 7.55, 0.4, { ease: "power2.out" });
			// Each bar rises from the axis with its name; its number follows
			// once the bar has arrived.
			BARS.forEach((bar, i) => {
				const at = 7.95 + i * 0.8;
				tl.set(`.r-col-${i}`, { autoAlpha: 1 }, at);
				rise(tl, `.r-col-${i}`, BASE, bar.value * SCALE, at);
				enter(tl, `.r-name-${i}`, at);
				enter(tl, `.r-num-${i}`, at + 0.7);
			});

			// 4 · takeaway
			exit(tl, [".r-title", ".r-axis", ".r-col", ".r-num", ".r-name"], "takeaway");
			enter(tl, ".r-glyph", 11.15, { stagger: 0.08 });
			enter(tl, ".r-take", 11.35, { stagger: 0.12 });

			// Back to the poster: reset what hides under the rows while they
			// are away, then bring the poster back.
			exit(tl, [".r-glyph", ".r-take"], 13.1);
			tl.set(".r-dim", { opacity: 1 }, 13.35);
			tl.set(".r-pick", { "--pick": "0%" }, 13.35);
			tl.set(wipes, { attr: { width: 0 } }, 13.35);
			restore(tl, poster, 13.4);
		},
	};
</script>

<ExplainerFrame {scene} {label} {size} {paused} {resting}>
	<defs>
		<clipPath id="{uid}-guess">
			{#each QLINES as line}
				<rect class="r-wipe" x={line.clip.x} y={line.clip.y} width="0" height={line.clip.height} />
			{/each}
		</clipPath>
		<clipPath id="{uid}-bars">
			<rect x="0" y="0" width="240" height={BASE - 0.7} />
		</clipPath>
	</defs>

	<!-- 1 · poster: the question is hidden -->
	<rect class="r-qbar" x="14" y={QBAR.y} width="212" height={QBAR.height} rx="2" fill="var(--xp-bar)" />
	<text class="xp-mono r-hidden" x="120" y="43" font-size="18" text-anchor="middle" style="color: var(--xp-bar-text)">? ? ?</text>
	<text
		class="xp-prose xp-later r-guess"
		font-size="18"
		font-style="italic"
		text-anchor="middle"
		clip-path="url(#{uid}-guess)"
		style="color: var(--xp-bar-text)"
		>{#each QLINES as line}<tspan x="120" y={line.y}>{line.text}</tspan>{/each}</text
	>

	<!-- The picked row's cell, between its rule and the one above. -->
	<rect
		class="xp-later r-hl"
		x="14"
		y={above.y + RULE}
		width="212"
		height={gold.y - above.y}
		fill="var(--xp-truth)"
		fill-opacity="0.1"
	/>
	{#each CHOICES as choice}
		<!-- Outer groups fade in and out; inner ones dim, so the two never
		     fight over one element's opacity. -->
		<g class="r-row">
			<g class:r-dim={!choice.gold}>
				<text class="xp-mono" x="14" y={choice.y} font-size="14">{choice.letter}</text>
				<text
					class="xp-prose"
					class:r-pick={choice.gold}
					x="36"
					y={choice.y}
					font-size={T.body}
					style={choice.gold ? mix("--xp-strong") : undefined}>{choice.text}</text
				>
				<line class="xp-rule" x1="14" x2="226" y1={choice.y + RULE} y2={choice.y + RULE} />
			</g>
		</g>
		<g class="xp-later r-tag">
			<text
				class="xp-mono"
				class:r-dim={!choice.gold}
				class:r-pick={choice.gold}
				x="226"
				y={choice.y}
				font-size={T.label}
				text-anchor="end"
				style={choice.gold ? mix("--xp-soft") : undefined}>{choice.tag}</text
			>
		</g>
	{/each}
	<path
		class="xp-later r-check"
		d="M86 {gold.y - 6} l5 5 l9 -11"
		fill="none"
		stroke="var(--xp-truth)"
		stroke-width="2.2"
		stroke-linecap="round"
		stroke-linejoin="round"
	/>

	<text class="xp-prose xp-caption r-cap-q" style="color: var(--xp-accent-text)"><tspan x="14" y="205">answer it without</tspan><tspan x="14" y="226">the question?</tspan></text>
	<text class="xp-prose xp-caption xp-later r-cap-p" style="color: var(--xp-accent-text)"><tspan x="14" y="205">naming properties</tspan><tspan x="14" y="226">of choices</tspan></text>
	<text class="xp-prose xp-caption xp-later r-cap-i" style="color: var(--xp-accent-text)"><tspan x="14" y="205">inferring the</tspan><tspan x="14" y="226">original question</tspan></text>

	<!-- 3 · accuracy with no question -->
	<g class="xp-later r-title">
		<text class="xp-prose" x="14" y="32" font-size={T.head}>choices-only accuracy</text>
		<text class="xp-mono" x="14" y="54" font-size={T.label}>ARC, without the question</text>
	</g>
	<g clip-path="url(#{uid}-bars)">
		{#each BARS as bar, i}
			<rect
				class="xp-later r-col r-col-{i}"
				x={bar.x}
				{...barBox(BASE, bar.value * SCALE)}
				width={BAR_W}
				rx="2"
				fill={i === 0 ? "var(--xp-faint)" : "var(--xp-accent)"}
			/>
		{/each}
	</g>
	<line class="xp-later r-axis" x1="14" x2="226" y1={BASE} y2={BASE} stroke="var(--xp-soft)" stroke-width="1.4" />
	{#each BARS as bar, i}
		<text
			class="xp-display xp-later r-num r-num-{i}"
			x={bar.x + BAR_W / 2}
			y={BASE - bar.value * SCALE - 9}
			font-size={T.hero}
			text-anchor="middle"
			style="color: {i === 0 ? 'var(--xp-soft)' : 'var(--xp-accent-text)'}">{Math.round(bar.value)}%</text
		>
		<text class="xp-mono xp-later r-name r-name-{i}" x={bar.x + BAR_W / 2} y={BASE + 20} font-size="15" text-anchor="middle">{bar.name}</text>
	{/each}

	<!-- 4 · takeaway: a hidden question, still answered -->
	<rect class="xp-later r-glyph" x="85.5" y="34" width="48" height="24" rx="2" fill="var(--xp-bar)" />
	<text class="xp-mono xp-later r-glyph" x="109.5" y="51" font-size="15" text-anchor="middle" style="color: var(--xp-bar-text)">?</text>
	<path class="xp-later r-glyph" d="M140.5 45 l5 5 l9 -11" fill="none" stroke="var(--xp-truth)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
	<text class="xp-prose xp-later r-take" x="120" y="104" font-size={T.body} text-anchor="middle">Not always a flaw.</text>
	<text class="xp-prose xp-later r-take" x="120" y="140" font-size={T.body} text-anchor="middle" style="color: var(--xp-accent-text)">Reasoning traces</text>
	<text class="xp-prose xp-later r-take" x="120" y="165" font-size={T.body} text-anchor="middle" style="color: var(--xp-accent-text)">reveal strategies.</text>
</ExplainerFrame>
