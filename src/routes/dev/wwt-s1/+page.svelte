<script lang="ts">
	// Dev preview of section 1 (Human or AI?) on the launch page's field and base styles.
	// ?step=N scrolls to guided step N (0-based) on load, for screenshots; ?still settles every animation.
	import { onMount } from "svelte";
	import DotField from "#lib/who-wrote-this/DotField.svelte";
	import HumanOrAI from "#lib/who-wrote-this/HumanOrAI.svelte";
	import { startElastic } from "#lib/who-wrote-this/elastic.ts";

	// the page's scroll-speed spacing for [data-lag] blocks, as on the launch page
	onMount(() => startElastic());

	onMount(() => {
		const n = new URLSearchParams(location.search).get("step");
		if (n === null) return;
		// after the route transition settles (instant: the site's html has scroll-behavior: smooth)
		const t = setTimeout(() => {
			const pin = document.querySelector<HTMLElement>("#human-or-ai .pin");
			const stage = pin?.querySelector<HTMLElement>(".stage");
			if (!pin || !stage) return;
			const top = parseFloat(getComputedStyle(stage).top) || 0;
			scrollTo({ top: pin.getBoundingClientRect().top + scrollY - top + (Number(n) * 0.42 + 0.21) * innerHeight, behavior: "instant" });
		}, 600);
		return () => clearTimeout(t);
	});
</script>

<svelte:head>
	<title>WWT section 1 preview</title>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,400;0,14..32,500;0,14..32,600;1,14..32,400;1,14..32,500&display=swap" />
	{@html `<style>
		html, html.dark { color-scheme: light; }
		html body, html.dark body {
			background-color: #E8E8E3;
			background-image: radial-gradient(rgba(20, 32, 45, .07) 1px, transparent 1.2px);
			background-size: 18px 18px;
			color: #14202D;
		}
		html.wwt-field-on body, html.wwt-field-on.dark body { background-image: none; }
	</style>`}
</svelte:head>

<DotField />

<div class="wwt" data-justify="off">
	<article>
		<div class="lead-in" aria-hidden="true"></div>
		<HumanOrAI />
		<div class="lead-out" aria-hidden="true"></div>
	</article>
</div>

<style>
	/* copied from src/routes/blog/who-wrote-this/+page.svelte so the preview matches the page */
	.wwt {
		--ground: #E8E8E3; --field: #F3F3EF; --chip: #DDDDD6; --rule: #D3D3CB;
		--ink: #14202D; --ink2: #5A6270; --axis: #8E9189;
		--rq1: #C85A82; --rq1-ink: #6E2042; --rq1-tint: #FBEBF1;
		--rq2: #461E47; --rq2-ink: #27132A; --rq2-tint: #EFEBF5;
		--rq3: #437E8E; --rq3-ink: #0A2B34; --rq3-tint: #E3EFF2;
		--fable: #B4501C; --fable-tint: #FBEDE4; --cue-rose: #6E2042; --cue-rose-bg: #FBEBF1;
		--cue-teal: #0A2B34; --cue-teal-bg: #DCEBEF; --cue-clay: #7A3410; --cue-clay-bg: #FBEDE4;
		--human: #C85A82; --model: #461E47; --ok: #046B55; --gray: #898989; --gray-mid: #B0B0B0;
		--ease: cubic-bezier(0.16, 1, 0.3, 1);
		--font: "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;
		color: var(--ink);
		font: 400 16px/1.6 var(--font);
		font-kerning: normal;
		color-scheme: light;
		padding-inline: max(16px, env(safe-area-inset-left, 0px)) max(16px, env(safe-area-inset-right, 0px));
		position: relative;
		z-index: 1;
	}
	.wwt :global(*) { font-family: inherit; }
	:where(.wwt) :global(a) { color: inherit; }
	:where(.wwt) :global(:focus-visible) { outline: 2px solid var(--ink); outline-offset: 2px; border-radius: 2px; }
	:where(.wwt) :global(:is(p, h1, h2, h3, figure, blockquote)) { margin: 0; }
	:where(.wwt) :global(:is(ul, ol)) { list-style: none; margin: 0; padding: 0; }
	:where(.wwt) :global(button) { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }
	article { max-width: 72rem; margin-inline: auto; }
	/* the shared section rhythm (badge, finding, context) */
	.wwt :global(.section) { padding-block: 72px 24px; border-top: 1px solid var(--rule); scroll-margin-top: 16px; }
	.wwt :global(.section:first-child) { border-top: 0; }
	.wwt :global(.s-head) { display: flex; align-items: center; gap: 12px; }
	.wwt :global(.badge) { display: inline-grid; place-items: center; width: 30px; height: 30px; flex: none; border-radius: 2px; color: #fff; font-weight: 600; font-size: 15px; background: var(--ink); }
	.wwt :global(.section[data-rq="1"] .badge) { background: var(--rq1); }
	.wwt :global(.section[data-rq="2"] .badge) { background: var(--rq2); }
	.wwt :global(.section[data-rq="3"] .badge) { background: var(--rq3); }
	.wwt :global(.s-head h2) { font-size: 15px; font-weight: 600; letter-spacing: 0.01em; color: var(--ink2); }
	.wwt :global(.finding) { margin-top: 10px; font-size: clamp(26px, 3.2vw, 36px); line-height: 1.12; font-weight: 600; letter-spacing: -0.025em; max-width: 24ch; text-wrap: balance; }
	.wwt :global(.context) { margin-top: 14px; max-width: 44rem; font-size: 17px; line-height: 1.6; color: var(--ink); }
	.lead-in { height: 70vh; }
	.lead-out { height: 60vh; }
</style>
