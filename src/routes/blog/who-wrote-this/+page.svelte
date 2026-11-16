<script lang="ts">
	// The paper launch page. It brings its own chrome and theme (the llm-detectors house style: warm gray
	// dotted ground, Inter, Figure 1's question colours) in place of the site's header, footer and palette.
	// All copy is paper text, from content.json (built in the private llm-detectors repo, docs/launch_20261116).
	import { onMount, setContext } from "svelte";
	import { dev } from "$app/environment";
	import Seo from "$lib/components/Seo.svelte";
	import { SITE_URL } from "$lib/seo";
	import Icon from "$lib/who-wrote-this/Icon.svelte";
	import DotField from "$lib/who-wrote-this/DotField.svelte";
	import { field } from "$lib/who-wrote-this/field.svelte";
	import Levels from "$lib/who-wrote-this/Levels.svelte";
	import PrintHero from "$lib/who-wrote-this/PrintHero.svelte";
	import Timeline from "$lib/who-wrote-this/Timeline.svelte";
	import HumanOrAI from "$lib/who-wrote-this/HumanOrAI.svelte";
	import WhichAI from "$lib/who-wrote-this/WhichAI.svelte";
	import WhichHuman from "$lib/who-wrote-this/WhichHuman.svelte";
	import Familiar from "$lib/who-wrote-this/Familiar.svelte";
	import Anonymity from "$lib/who-wrote-this/Anonymity.svelte";
	import C from "$lib/who-wrote-this/content.json";
	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();
	const post = data.post;
	const art = $derived(data.art);
	setContext("wwt-art", () => data.art);
	$effect(() => { field.shape = art === "mosaic" ? "tile" : "dot"; });
	const url = `${SITE_URL}/blog/who-wrote-this/`;
	const affIndex = Object.fromEntries(C.meta.affiliations.map((a, i) => [a.key, i + 1]));
	const nav = [
		{ name: "research", href: "/research/" },
		{ name: "blog", href: "/blog/" },
		{ name: "about", href: "/about/" },
	];

	// contents rail: the section in view is marked
	let current = $state(C.sections[0].id);
	onMount(() => {
		const io = new IntersectionObserver(
			(entries) => entries.forEach((e) => { if (e.isIntersecting) current = e.target.id; }),
			{ rootMargin: "-45% 0px -50% 0px" },
		);
		C.sections.forEach((s) => { const el = document.getElementById(s.id); if (el) io.observe(el); });
		return () => io.disconnect();
	});

	const jsonLd = [
		{
			"@type": "BlogPosting",
			"@id": `${url}#article`,
			headline: `${C.meta.title.t} ${C.meta.deck.t}`,
			description: post.seoDescription ?? post.excerpt,
			datePublished: post.date,
			inLanguage: "en-US",
			author: C.meta.authors.map((a) => ({ "@type": "Person", name: a.name })),
		},
	];
</script>

<Seo
	title="{post.seoTitle ?? post.title} | Atrey Desai"
	description={post.seoDescription ?? post.excerpt}
	image={post.image}
	imageAlt={post.imageAlt}
	{url}
	type="article"
	pageType="WebPage"
	published={post.date}
	tags={post.tags}
	{jsonLd}
	noindex={post.published === false}
/>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,400;0,14..32,500;0,14..32,600;1,14..32,400;1,14..32,500&display=swap" />
	<!-- This route owns the whole page: our ground behind everything, light only. -->
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
	<header class="top">
		<a class="brand" href="/">Atrey Desai</a>
		<nav aria-label="Site">
			{#each nav as link}<a href={link.href}>{link.name}</a>{/each}
		</nav>
	</header>

	<article>
		<header class="mast">
			<a class="back" href="/blog/"><Icon name="back" /> Back to blog</a>
			<h1>{C.meta.title.t}</h1>
			<p class="deck">{C.meta.deck.t}</p>
			<p class="byline">
				{#each C.meta.authors as a, i}
					<span class="author">{a.name}<sup>{#each a.aff as k}{affIndex[k]}{/each}{#if a.equal}*{/if}{#if a.corresponding}†{/if}</sup>{#if i < C.meta.authors.length - 1}{", "}{/if}</span>
				{/each}
			</p>
			<p class="affs">
				{#each C.meta.affiliations as aff, i}<span><sup>{i + 1}</sup>{aff.t}</span>{/each}
				<span><sup>*</sup>{C.meta.equal_note}</span>
				<span><sup>†</sup>{C.meta.corresponding_note}</span>
			</p>
			<div class="links">
				{#each C.meta.links as l}
					<a class="btn" href={l.href} target="_blank" rel="noopener"><Icon name={l.icon} /> {l.t}</a>
				{/each}
				<time datetime={C.meta.date}>{new Date(C.meta.date + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</time>
			</div>
		</header>

		{#key art}{#if art === "print"}<PrintHero />{:else}<Levels {art} />{/if}{/key}

		<div class="lede">
			{#each C.lede as s}{s.t + " "}{/each}
		</div>

		<Timeline />

		<HumanOrAI section={C.sections[0]} />

		<WhichAI />

		<WhichHuman />

		<Familiar />

		<Anonymity />

		<footer class="end">
			<p class="closing">{C.closing.t}</p>
			<p class="byline small">
				{#each C.meta.authors as a, i}<span>{a.name}{#if a.equal}*{/if}{#if i < C.meta.authors.length - 1}{", "}{/if}</span>{/each}
			</p>
			<div class="links">
				{#each C.meta.links as l}<a class="btn" href={l.href} target="_blank" rel="noopener"><Icon name={l.icon} /> {l.t}</a>{/each}
			</div>
		</footer>
	</article>

	<footer class="site-foot">
		<a href="/">Atrey Desai</a>
		<span>{#each nav as link}<a href={link.href}>{link.name}</a>{/each}</span>
	</footer>
	{#if dev}
		<!-- art direction preview (development only): the hero art variants, with filler images -->
		<nav class="art-switch" aria-label="Art">
			<span>Art</span>
			{#each [["print", "Print"], ["dots", "Dots"], ["fingerprint", "Fingerprint"], ["mosaic", "Mosaic"]] as [k, label]}
				<a href="?art={k}" data-sveltekit-noscroll aria-current={art === k ? "page" : undefined}>{label}</a>
			{/each}
		</nav>
	{/if}
</div>

<style>
	/* llm-detectors house style, scoped to this page. Tokens follow docs/style_guide (prez + figure guides). */
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
	/* The site's element rules set Optima and NHG on p, h1, li...; inside this page everything inherits Inter.
	   The resets sit under :where(.wwt) so any component rule outranks them. */
	.wwt :global(*) { font-family: inherit; }
	:where(.wwt) :global(a) { color: inherit; }
	:where(.wwt) :global(:focus-visible) { outline: 2px solid var(--ink); outline-offset: 2px; border-radius: 2px; }
	:where(.wwt) :global(:is(p, h1, h2, h3, figure, blockquote)) { margin: 0; }
	:where(.wwt) :global(:is(ul, ol)) { list-style: none; margin: 0; padding: 0; }
	:where(.wwt) :global(button) { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }

	.top, article, .site-foot { max-width: 72rem; margin-inline: auto; }
	.top { display: flex; align-items: baseline; justify-content: space-between; padding-block: 22px 0; }
	.brand { font-weight: 600; font-size: 15px; letter-spacing: -0.01em; text-decoration: none; }
	.top nav { display: flex; gap: 20px; font-size: 14px; color: var(--ink2); }
	.top nav a { text-decoration: none; }
	.top nav a:hover, .brand:hover { color: var(--ink); text-decoration: underline; text-underline-offset: 4px; }

	/* masthead: title, the paper's title, the full byline with the paper's marks */
	.mast { padding-block: 48px 8px; max-width: 52rem; }
	.back { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--ink2); text-decoration: none; margin-bottom: 20px; }
	.back:hover { color: var(--ink); }
	h1 { font-size: clamp(36px, 5vw, 56px); line-height: 1.02; font-weight: 600; letter-spacing: -0.035em; }
	.deck { margin-top: 12px; font-size: clamp(18px, 2vw, 22px); line-height: 1.35; font-weight: 500; letter-spacing: -0.01em; color: var(--ink); text-wrap: balance; }
	.byline { margin-top: 22px; font-size: 15px; line-height: 1.7; }
	.byline sup, .affs sup { font-size: 10px; margin-left: 1px; color: var(--ink2); font-feature-settings: "tnum"; }
	.affs { margin-top: 6px; display: flex; flex-wrap: wrap; gap: 2px 14px; font-size: 12.5px; color: var(--ink2); }
	.links { margin-top: 18px; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
	.btn { display: inline-flex; align-items: center; gap: 7px; padding: 7px 12px; border: 1.25px solid var(--ink); border-radius: 2px; font-size: 13px; font-weight: 500; text-decoration: none; transition: background-color .15s, color .15s; }
	.btn:hover { background: var(--ink); color: var(--field); }
	.links time { margin-left: 8px; font-size: 13px; color: var(--ink2); }
	.lede { margin-top: 64px; max-width: 46rem; font-size: 19px; line-height: 1.6; }

	/* body: contents rail beside the sections on wide screens */
	.body { display: grid; grid-template-columns: 13rem minmax(0, 1fr); gap: 40px; margin-top: 24px; }
	.rail { position: relative; }
	.rail ol { position: sticky; top: 24px; display: grid; gap: 2px; padding-top: 72px; }
	.rail a { display: flex; align-items: baseline; gap: 10px; padding: 6px 8px; font-size: 13px; line-height: 1.35; color: var(--ink2); text-decoration: none; border-radius: 2px; }
	.rail a:hover { color: var(--ink); }
	.rail .n { flex: none; display: inline-grid; place-items: center; width: 18px; height: 18px; font-size: 11px; font-weight: 600; color: #fff; background: var(--axis); border-radius: 2px; }
	.rail a.on { color: var(--ink); font-weight: 500; background: var(--field); }
	.rail a[data-rq="1"].on .n { background: var(--rq1); } .rail a[data-rq="2"].on .n { background: var(--rq2); }
	.rail a[data-rq="3"].on .n { background: var(--rq3); } .rail a[data-rq="0"].on .n { background: var(--ink); }

	.sections { display: grid; gap: 0; min-width: 0; }
	/* shared section rhythm: read (question, finding, context), see (the example), explore (numbers + one control) */
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
	.todo { margin-top: 28px; height: 180px; display: grid; place-items: center; border: 1.5px dashed var(--axis); border-radius: 3px; color: var(--ink2); font-size: 13px; }

	.end { padding-block: 72px 32px; border-top: 1px solid var(--rule); }
	.closing { max-width: 30ch; font-size: clamp(24px, 3vw, 34px); line-height: 1.2; font-weight: 600; letter-spacing: -0.025em; text-wrap: balance; }
	.byline.small { font-size: 13px; color: var(--ink2); margin-top: 24px; max-width: 52rem; }
	.art-switch { position: fixed; left: 16px; bottom: 16px; z-index: 20; display: flex; align-items: center; gap: 2px; padding: 4px; border-radius: 4px; background: rgba(20, 32, 45, .92); font-size: 12.5px; box-shadow: 0 6px 20px rgba(20, 32, 45, .25); }
	.art-switch span { padding: 0 8px; color: rgba(255, 255, 255, .55); }
	.art-switch a { padding: 5px 10px; border-radius: 3px; color: #fff; text-decoration: none; }
	.art-switch a:hover { background: rgba(255, 255, 255, .12); }
	.art-switch a[aria-current] { background: #fff; color: var(--ink); }
	.site-foot { display: flex; justify-content: space-between; gap: 16px; padding-block: 28px 40px; border-top: 1px solid var(--rule); font-size: 13px; color: var(--ink2); }
	.site-foot span { display: flex; gap: 16px; }
	.site-foot a { text-decoration: none; }
	.site-foot a:hover { color: var(--ink); }

	@media (max-width: 1100px) {
		.body { grid-template-columns: minmax(0, 1fr); }
		.rail { display: none; }
	}
	@media (max-width: 600px) {
		.mast { padding-top: 32px; }
		.lede { font-size: 17px; }
		.top nav { gap: 14px; }
	}
</style>
