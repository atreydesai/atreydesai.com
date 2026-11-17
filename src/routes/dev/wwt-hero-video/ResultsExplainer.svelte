<script lang="ts" module>
	// "Who wrote this?" (Desai, Bölöni-Turgut, Brassington, Choi, Russell, Rajendhran et al. 2026): the launch video's
	// results cut, drawn on the research-explainer plate (docs/style-guide.md, "Research explainers") and recorded frame
	// by frame by docs/launch_20261116/tools/record_hero.mjs --cut results (private llm-detectors repo).
	//
	// Three results, the defenses, and the closing line, one beat each. Every string is the paper's own words (checked
	// with that repo's tools/check_ngrams.py) and every number is the paper's:
	//   1. detect: "Frontier models now identify AI text as well as specialized detectors" (02_introduction.tex);
	//      "Gemini 4 Carbon detects 97% of fully AI-generated texts vs. 96% for Pangram 4" (02_introduction.tex)
	//   2. lab: "Fable 5.2, Opus 5.5 and Argon can identify text from OpenAI, Anthropic, and Google with 98% accuracy or
	//      more" (04_rq2_ai_vs_ai.tex)
	//   3. human: "Claude Fable 5.2 names the reviewer of 55% of 15K anonymous ICML 2020 reviews" (02_introduction.tex);
	//      the name never shows: a redacted bar resolves to a tick
	//   4. defenses: "Defenses are limited, since models rarely refuse, writing cannot be deleted from existing weights, and
	//      AI rewriting only partly helps" (08_conclusion.tex); the second row is cut to "writing cannot be deleted"
	//   5. the closing line (08_conclusion.tex), on the dark plate (ink-800)
	// The fingerprint is a quiet motif only: a faint print in the corner, and behind the closing line.
	import type { Beat } from "#lib/explainers/motion.ts";

	// beat starts; each beat's last element lands about 1.2 s before the next begins
	const B2 = 2.2, B3 = 6.3, B4 = 10.5, B5 = 14.4, BACK = 17.9;
	export const BEATS: Beat[] = [
		{ id: "detect", label: "human or AI", at: 0, hold: 2.0 },
		{ id: "lab", label: "which lab", at: B2, hold: B3 - 0.35 },
		{ id: "human", label: "which human", at: B3, hold: B4 - 0.35 },
		{ id: "defenses", label: "defenses", at: B4, hold: B5 - 0.35 },
		{ id: "close", label: "anonymity", at: B5, hold: BACK - 0.35 },
	];
	export const DURATION = 19.4;

	// 1 · two bars on one axis, 97% and 96% (fully AI-generated texts detected)
	const BASE = 168, PER = 0.62;
	const BARS = [
		{ name: "Gemini 4 Carbon", v: 97, x: 22, color: "var(--xp-accent)" },
		{ name: "Pangram 4", v: 96, x: 128, color: "var(--xp-human)" },
	];
	const BAR_W = 90;
	// 2 · the three labs, in the paper's order
	const LABS = [
		{ name: "OpenAI", icon: "openai", y: 70 },
		{ name: "Anthropic", icon: "anthropic", y: 96 },
		{ name: "Google", icon: "google", y: 122 },
	];
	// 4 · the three defenses
	const ROWS = [
		{ icon: "chat-x", lines: ["models rarely", "refuse"], mark: "x", y: 64 },
		{ icon: "eye-off", lines: ["writing cannot", "be deleted"], mark: "x", y: 114 },
		{ icon: "rewrite", lines: ["AI rewriting only", "partly helps"], mark: "part", y: 164 },
	];
	// 5 · the closing line, set to the plate's measure
	const CLOSE = ["Anyone who has", "published enough", "writing online can", "no longer assume", "that an unsigned", "text keeps them", "anonymous."];
</script>

<script lang="ts">
	import { onMount } from "svelte";
	import ExplainerFrame from "#lib/explainers/ExplainerFrame.svelte";
	import { T, barBox, draw, enter, exit, restore, rise, write, type ExplainerProps, type Scene } from "#lib/explainers/motion.ts";
	import { printSprite } from "#lib/who-wrote-this/print/sprites.ts";
	import icons from "#lib/who-wrote-this/icons.json";

	let { size = "card", paused = false, resting = false, label }: ExplainerProps = $props();
	const uid = $props.id();
	const ICON = icons.lab as Record<string, string>;
	const DARK = { surface: "#383838", strong: "#fdf8f3" }; // the plate's dark tokens (ink-800, cream)
	const HERO = 50; // hero numbers, plate units (225 px on the 1080 plate)

	// the motif: a faint print, its alpha baked into the image (the timeline owns opacity)
	let motif = $state(""), closeMotif = $state("");
	function faint(color: string, px: number, alpha: number) {
		const s = printSprite({ family: "main", color, px, dpr: 2, text: true });
		const c = document.createElement("canvas");
		c.width = s.width; c.height = s.height;
		const g = c.getContext("2d")!;
		g.globalAlpha = alpha; g.drawImage(s, 0, 0);
		return c.toDataURL("image/png");
	}
	onMount(() => {
		motif = faint("#1a1a1a", 420, 0.1);
		closeMotif = faint("#fdf8f3", 900, 0.12);
	});

	const scene: Scene = {
		beats: BEATS,
		duration: DURATION,
		build(tl) {
			const b1 = [".d-kick", ".d-head", ".d-title", ".d-label", ".d-cap", ".d-axis", ".d-num", ".d-bar"];

			// 2 · which lab: one text, three labs, each ticked, then 98%
			exit(tl, b1, B2 - 0.3);
			enter(tl, ".l-head", B2);
			enter(tl, ".l-card", B2 + 0.15);
			enter(tl, ".l-line", B2 + 0.25, { stagger: 0.035 });
			LABS.forEach((_, i) => {
				tl.set(`.l-arrow-${i}`, { autoAlpha: 1 }, B2 + 0.5 + i * 0.035);
				draw(tl, `.l-arrow-${i}`, B2 + 0.5 + i * 0.035, 0.45);
			});
			enter(tl, ".l-chip", B2 + 0.7, { stagger: 0.035 });
			LABS.forEach((_, i) => {
				tl.set(`.l-tick-${i}`, { autoAlpha: 1 }, B2 + 1.2 + i * 0.3);
				draw(tl, `.l-tick-${i}`, B2 + 1.2 + i * 0.3, 0.3);
			});
			enter(tl, ".l-hero", B2 + 2.2);
			enter(tl, ".l-acc", B2 + 2.3);
			enter(tl, ".l-cap", B2 + 2.35);

			// 3 · which human: the model reads an anonymous review, and the blank reviewer resolves (never to a name)
			exit(tl, [".l-head", ".l-card", ".l-line", ".l-arrow", ".l-chip", ".l-tick", ".l-hero", ".l-acc", ".l-cap"], B3 - 0.3);
			enter(tl, ".h-head", B3);
			enter(tl, ".h-card", B3 + 0.15);
			enter(tl, ".h-model", B3 + 0.35);
			tl.set(".h-arrow", { autoAlpha: 1 }, B3 + 0.65);
			draw(tl, ".h-arrow", B3 + 0.65, 0.35);
			exit(tl, ".h-anon", B3 + 1.0, { duration: 0.2 });
			tl.set(".h-redact", { autoAlpha: 1 }, B3 + 1.0);
			write(tl, `#${uid}-redact rect`, 106, B3 + 1.0, 0.5);
			exit(tl, ".h-redact", B3 + 1.6);
			enter(tl, ".h-ok", B3 + 1.6, { y: 0 });
			tl.set(".h-tick", { autoAlpha: 1 }, B3 + 1.7);
			draw(tl, ".h-tick", B3 + 1.7, 0.3);
			enter(tl, ".h-lead", B3 + 2.0);
			enter(tl, ".h-hero", B3 + 2.1);
			enter(tl, ".h-cap", B3 + 2.15);

			// 4 · the defenses, one row at a time, each marked
			exit(tl, [".h-head", ".h-card", ".h-arrow", ".h-model", ".h-ok", ".h-tick", ".h-lead", ".h-hero", ".h-cap"], B4 - 0.3);
			enter(tl, ".f-head", B4);
			ROWS.forEach((r, i) => {
				const at = B4 + 0.3 + i * 0.6;
				enter(tl, `.f-row-${i}`, at);
				tl.set(`.f-mark-${i}`, { autoAlpha: 1 }, at + 0.3);
				if (r.mark === "x") {
					draw(tl, `.f-mark-${i} .a`, at + 0.3, 0.16);
					draw(tl, `.f-mark-${i} .b`, at + 0.46, 0.16);
				} else {
					draw(tl, `.f-mark-${i} .a`, at + 0.3, 0.3);
					tl.fromTo(`.f-mark-${i} .b`, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.25, immediateRender: false }, at + 0.5);
				}
			});

			// 5 · the closing line, on the dark plate
			exit(tl, [".f-head", ".f-row", ".f-mark"], B5 - 0.3);
			tl.fromTo(".c-dark", { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3, ease: "power2.out", immediateRender: false }, B5);
			tl.fromTo(".c-motif", { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.45, ease: "power2.out", immediateRender: false }, B5 + 0.15);
			exit(tl, ".motif", B5);
			enter(tl, ".c-line", B5 + 0.25, { stagger: 0.035 });

			// back to the poster: the plate lightens, beat 1 builds again, bars before their numbers
			exit(tl, [".c-line", ".c-motif"], BACK - 0.3);
			tl.to(".c-dark", { autoAlpha: 0, duration: 0.3, ease: "power2.in" }, BACK);
			restore(tl, ".motif", BACK + 0.1);
			enter(tl, [".d-kick", ".d-head"], BACK + 0.1, { stagger: 0.035 });
			enter(tl, ".d-title", BACK + 0.25);
			BARS.forEach((b, i) => {
				tl.set(`.d-bar-${i}`, { autoAlpha: 1 }, BACK + 0.35 + i * 0.035);
				rise(tl, `.d-bar-${i}`, BASE, b.v * PER, BACK + 0.35 + i * 0.035, 0.6);
			});
			tl.set(".d-axis", { autoAlpha: 1 }, BACK + 0.35);
			enter(tl, ".d-label", BACK + 0.45, { stagger: 0.035 });
			enter(tl, ".d-num", BACK + 0.95, { stagger: 0.035 });
			enter(tl, ".d-cap", BACK + 1.0);
		},
	};
</script>

{#snippet icon(name: string, x: number, y: number, s: number, color: string)}
	<svg {x} {y} width={s} height={s} viewBox="0 0 12 12" fill={color} style="color: {color}" aria-hidden="true">{@html ICON[name] ?? ""}</svg>
{/snippet}

<ExplainerFrame {scene} {label} {size} {paused} {resting}>
	<defs>
		<clipPath id="{uid}-bars"><rect x="0" y="0" width="240" height={BASE - 0.6} /></clipPath>
		<clipPath id="{uid}-redact"><rect x="90" y="112" width="106" height="19" /></clipPath>
	</defs>

	<!-- the motif: a faint print in the corner (beats 1-4) -->
	{#if motif}<image class="motif" href={motif} x="170" y="-14" width="84" height="105" />{/if}

	<!-- 1 · human or AI: the poster -->
	<text class="xp-mono d-kick" x="14" y="26" font-size={T.label} style="color: var(--xp-accent-text)">Human or AI?</text>
	<text class="xp-prose d-head" font-size={T.body}><tspan x="14" y="52">Frontier models now</tspan><tspan x="14" y="76">identify AI text</tspan></text>
	<text class="xp-mono d-title" x="14" y="100" font-size={T.label}>fully AI-generated texts</text>
	<g clip-path="url(#{uid}-bars)">
		{#each BARS as b, i}
			<rect class="d-bar d-bar-{i}" x={b.x} {...barBox(BASE, b.v * PER)} width={BAR_W} rx="2" fill={b.color} />
		{/each}
	</g>
	<line class="d-axis" x1="14" x2="226" y1={BASE} y2={BASE} stroke="var(--xp-soft)" stroke-width="1.2" />
	{#each BARS as b}
		<text class="xp-display d-num" x={b.x + BAR_W / 2} y={BASE - b.v * PER + 30} font-size="28" text-anchor="middle" style="color: var(--xp-surface)">{b.v}%</text>
		<text class="xp-mono d-label" x={b.x + BAR_W / 2} y={BASE + 16} font-size={T.label} text-anchor="middle" style="color: {b.color === 'var(--xp-accent)' ? 'var(--xp-accent-text)' : 'var(--xp-human)'}">{b.name}</text>
	{/each}
	<text class="xp-prose xp-caption d-cap" style="color: var(--xp-accent-text)"><tspan x="14" y="205">as well as</tspan><tspan x="14" y="226">specialized detectors</tspan></text>

	<!-- 2 · which lab -->
	<text class="xp-prose xp-later l-head" x="14" y="34" font-size={T.body}>If an AI, which lab</text>
	<rect class="xp-later l-card" x="14" y="56" width="62" height="76" rx="2" fill="none" stroke="var(--xp-soft)" stroke-width="1.2" />
	{#each [70, 82, 94, 106, 118] as y, k}
		<line class="xp-later l-line" x1="22" x2={k === 4 ? 50 : 68} y1={y} y2={y} stroke="var(--xp-faint)" stroke-width="2.4" stroke-linecap="round" />
	{/each}
	{#each LABS as lab, i}
		<path class="xp-later l-arrow l-arrow-{i}" d="M78 94 C 100 94, 98 {lab.y - 4}, 118 {lab.y - 4}" fill="none" stroke="var(--xp-soft)" stroke-width="1.2" />
		<g class="xp-later l-chip">
			{@render icon(lab.icon, 122, lab.y - 12, 13, "var(--xp-strong)")}
			<text class="xp-mono" x="141" y={lab.y} font-size={T.label} style="color: var(--xp-strong)">{lab.name}</text>
			<line class="xp-rule" x1="120" x2="226" y1={lab.y + 9} y2={lab.y + 9} />
		</g>
		<path class="xp-later l-tick l-tick-{i}" d="M210 {lab.y - 5} l4 4 l8 -9" fill="none" stroke="var(--xp-truth)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
	{/each}
	<text class="xp-display xp-later l-hero" x="12" y="190" font-size={HERO}>98%</text>
	<text class="xp-mono xp-later l-acc" x="122" y="188" font-size={T.label}>accuracy or more</text>
	<text class="xp-prose xp-caption xp-later l-cap" style="color: var(--xp-accent-text)"><tspan x="14" y="210">Fable 5.2, Opus 5.5</tspan><tspan x="14" y="230">and Argon</tspan></text>

	<!-- 3 · which human -->
	<text class="xp-prose xp-later h-head" font-size={T.body}><tspan x="14" y="30">If a human, often</tspan><tspan x="14" y="54">exactly who</tspan></text>
	<g class="xp-later h-model">
		<circle cx="150" cy="70" r="5.5" fill="var(--xp-accent)" />
		<text class="xp-mono" x="160" y="75" font-size={T.label} style="color: var(--xp-accent-text)">Fable 5.2</text>
	</g>
	<path class="xp-later h-arrow" d="M150 77 L 146 110" fill="none" stroke="var(--xp-soft)" stroke-width="1.2" />
	<g class="xp-later h-card">
		<rect x="14" y="82" width="212" height="54" rx="2" fill="none" stroke="var(--xp-soft)" stroke-width="1.2" />
		<line x1="22" x2="218" y1="93" y2="93" stroke="var(--xp-faint)" stroke-width="2.4" stroke-linecap="round" />
		<line x1="22" x2="80" y1="102" y2="102" stroke="var(--xp-faint)" stroke-width="2.4" stroke-linecap="round" />
		<text class="xp-mono" x="22" y="126" font-size={T.label}>Reviewer:</text>
		<!-- the reviewer is blank: dashed -->
		<rect x="88" y="112" width="112" height="19" rx="2" fill="none" stroke="var(--xp-soft)" stroke-width="1.2" stroke-dasharray="3.5 3" />
		<text class="xp-mono h-anon" x="95" y="126" font-size={T.label} style="color: var(--xp-faint)">anonymous</text>
	</g>
	<g class="xp-later h-redact" clip-path="url(#{uid}-redact)">
		<rect x="92" y="115.5" width="104" height="12" rx="2" fill="var(--xp-strong)" />
	</g>
	<g class="xp-later h-ok">
		<rect x="88" y="112" width="112" height="19" rx="2" fill="var(--xp-truth)" fill-opacity="0.14" stroke="var(--xp-truth)" stroke-width="1.2" />
		<rect x="92" y="115.5" width="104" height="12" rx="2" fill="var(--xp-truth)" fill-opacity="0.6" />
	</g>
	<path class="xp-later h-tick" d="M206 120 l4 4 l8 -9" fill="none" stroke="var(--xp-truth)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
	<text class="xp-mono xp-later h-lead" x="14" y="152" font-size={T.label}>names the reviewer of</text>
	<text class="xp-display xp-later h-hero" x="12" y="191" font-size={HERO} style="color: var(--xp-accent-text)">55%</text>
	<text class="xp-prose xp-caption xp-later h-cap" style="color: var(--xp-accent-text)"><tspan x="14" y="212">of 15K anonymous</tspan><tspan x="14" y="231">ICML 2020 reviews</tspan></text>

	<!-- 4 · defenses -->
	<text class="xp-prose xp-later f-head" x="14" y="34" font-size={T.body}>Defenses are limited</text>
	{#each ROWS as r, i}
		<g class="xp-later f-row f-row-{i}">
			{@render icon(r.icon, 14, r.y - 13, 16, "var(--xp-soft)")}
			{#each r.lines as line, k}
				<text class="xp-prose" x="40" y={r.y + k * 22} font-size={T.stem}>{line}</text>
			{/each}
			<line class="xp-rule" x1="14" x2="226" y1={r.y + 32} y2={r.y + 32} />
		</g>
		<g class="xp-later f-mark f-mark-{i}" fill="none" stroke="var(--xp-accent)" stroke-width="2.6" stroke-linecap="round">
			{#if r.mark === "x"}
				<line class="a" x1="208" y1={r.y - 9} x2="222" y2={r.y + 5} />
				<line class="b" x1="222" y1={r.y - 9} x2="208" y2={r.y + 5} />
			{:else}
				<circle class="a" cx="215" cy={r.y - 2} r="7" />
				<path class="b" d="M215 {r.y - 9} A 7 7 0 0 1 215 {r.y + 5} Z" fill="var(--xp-accent)" stroke="none" />
			{/if}
		</g>
	{/each}

	<!-- 5 · the closing line, on the dark plate -->
	<rect class="xp-later c-dark" x="0" y="0" width="240" height="240" fill={DARK.surface} />
	{#if closeMotif}<image class="xp-later c-motif" href={closeMotif} x="56" y="6" width="182" height="228" />{/if}
	{#each CLOSE as line, i}
		<text class="xp-prose xp-later c-line" x="14" y={40 + i * 25} font-size={T.body} style="color: {DARK.strong}; --xp-weight: 0.75">{line}</text>
	{/each}
</ExplainerFrame>
