<script lang="ts">
	// Dev preview of section 2 (If AI, which AI?) on the launch page's field and base styles.
	// ?step=N scrolls to scroll step N (0-based) on load, for screenshots; ?still (or reduced motion) settles animation.
	import { onMount } from "svelte";
	import DotField from "$lib/who-wrote-this/DotField.svelte";
	import WhichAI from "$lib/who-wrote-this/WhichAI.svelte";

	onMount(() => {
		const n = new URLSearchParams(location.search).get("step");
		if (n === null) return;
		const el = document.querySelectorAll("#which-ai .step")[Number(n)];
		// after the route transition settles; the field's observers then pick the step up
		// (instant: the site's html has scroll-behavior: smooth)
		const t = setTimeout(() => el && scrollTo({ top: el.getBoundingClientRect().top + scrollY - innerHeight * 0.3, behavior: "instant" }), 600);
		return () => clearTimeout(t);
	});
</script>

<svelte:head>
	<title>WWT section 2 preview</title>
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
		<WhichAI />
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
	.lead-in { height: 70vh; }
	.lead-out { height: 60vh; }
</style>
