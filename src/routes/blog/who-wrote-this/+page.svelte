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
	import SectionNav from "$lib/who-wrote-this/SectionNav.svelte";
	import FootnoteList from "$lib/who-wrote-this/FootnoteList.svelte";
	import PrintMark from "$lib/who-wrote-this/PrintMark.svelte";
	import ScrollHint from "$lib/who-wrote-this/ScrollHint.svelte";
	import { field } from "$lib/who-wrote-this/field.svelte";
	import Levels from "$lib/who-wrote-this/Levels.svelte";
	import PrintHero from "$lib/who-wrote-this/PrintHero.svelte";
	import Timeline from "$lib/who-wrote-this/Timeline.svelte";
	import HumanOrAIB from "$lib/who-wrote-this/HumanOrAIB.svelte";
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

	// the side rail's stops, and the scroll-speed spacing (elastic.ts) for every [data-lag] block on the page
	const stops = [
		{ id: "levels", short: "Intro", label: C.meta.title.t },
		{ id: C.timeline.id, short: "Over time", label: C.timeline.title.t.replace(/\.$/, "") },
		{ id: "human-or-ai", short: "Human or AI", label: C.sections[0].title },
		{ id: "which-ai", short: "Which AI", label: C.sections[1].title },
		{ id: "which-human", short: "Which human", label: C.sections[2].title },
		{ id: "who-can-be-identified", short: "Familiarity", label: C.sections[3].title },
		{ id: "anonymity", short: "Anonymity", label: C.sections[4].title },
	];
	// the lede's key phrases, highlighted (Atrey, 16 Nov)
	const HL = ["Frontier models now identify AI text as well as specialized detectors", "given a single text", "even the specific person"];
	const lede = C.lede.map((s) => s.t).join(" ");
	const ledeParts = (() => {
		const out: { t: string; hl: boolean }[] = [];
		let rest = lede;
		while (rest.length) {
			let at = -1, hit = "";
			for (const h of HL) { const i = rest.indexOf(h); if (i >= 0 && (at < 0 || i < at)) { at = i; hit = h; } }
			if (at < 0) { out.push({ t: rest, hl: false }); break; }
			if (at > 0) out.push({ t: rest.slice(0, at), hl: false });
			out.push({ t: hit, hl: true });
			rest = rest.slice(at + hit.length);
		}
		return out;
	})();


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
	noindex={post.unlisted === true || post.published === false}
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
		html ::selection { background: rgb(126, 34, 62); color: #fff; }
	</style>`}
</svelte:head>

<DotField />

<div class="wwt" data-justify="off">
	<header class="top">
		<a class="brand" href="/">Atrey Desai</a>
		<SectionNav {stops} />
		<nav aria-label="Site">
			{#each nav as link}<a href={link.href}>{link.name}</a>{/each}
		</nav>
	</header>

	<article>
		<header class="mast">
			<a class="back" href="/blog/"><Icon name="back" /> Back to blog</a>
			<h1>{C.meta.title.t}</h1>
			<p class="deck" data-lag="1">{C.meta.deck.t}</p>
			<p class="byline" data-lag="2">
				{#each C.meta.authors as a, i}
					<span class="author">{a.name}<sup>{#each a.aff as k}{affIndex[k]}{/each}{#if a.equal}*{/if}{#if a.corresponding}†{/if}</sup>{#if i < C.meta.authors.length - 1}{", "}{/if}</span>
				{/each}
			</p>
			<p class="affs" data-lag="2">
				{#each C.meta.affiliations as aff, i}<span><sup>{i + 1}</sup>{aff.t}</span>{/each}
				<span><sup>*</sup>{C.meta.equal_note}</span>
				<span><sup>†</sup>{C.meta.corresponding_note}</span>
			</p>
			<div class="links" data-lag="3">
				{#each C.meta.links as l}
					<a class="btn" href={l.href} target="_blank" rel="noopener"><Icon name={l.icon} /> {l.t}</a>
				{/each}
				<time datetime={C.meta.date}>{new Date(C.meta.date + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</time>
			</div>
		</header>

		{#key art}{#if art === "print"}<PrintHero />{:else}<Levels {art} />{/if}{/key}

		<!-- the lede has a screen of its own: it is the paper's argument in one paragraph, so nothing above or below shares
		     the view with it (Atrey, 16 Nov) -->
		<section class="lede-wrap" aria-label="Introduction">
			<div class="lede">
				{#each ledeParts as p}{#if p.hl}<mark class="hl">{p.t}</mark>{:else}{p.t}{/if}{/each}
			</div>
		</section>

		<Timeline />
		<div class="breath" aria-hidden="true"></div>
		<HumanOrAIB />
		<div class="breath" aria-hidden="true"></div>
		<WhichAI />
		<div class="breath" aria-hidden="true"></div>
		<WhichHuman />
		<div class="breath" aria-hidden="true"></div>
		<Familiar />
		<div class="breath" aria-hidden="true"></div>
		<Anonymity />
		<div class="breath" aria-hidden="true"></div>

		<!-- the last word: the paper's closing line, as the page's final chapter -->
		<!-- the band is taller than the screen and the line is pinned in it, so the page stays on the dark a while
		     before the byline and notes come up (Atrey, 16 Nov) -->
		<section class="finale" aria-label={C.closing.t}>
			<div class="finale-in">
				<PrintMark family="main" color="#E8E8E3" px={300} text />
				<p class="closing">{C.closing.t}</p>
			</div>
		</section>
		<footer class="end">
			<p class="byline small">
				{#each C.meta.authors as a, i}<span>{a.name}{#if a.equal}*{/if}{#if i < C.meta.authors.length - 1}{", "}{/if}</span>{/each}
			</p>
			<div class="links">
				{#each C.meta.links as l}<a class="btn" href={l.href} target="_blank" rel="noopener"><Icon name={l.icon} /> {l.t}</a>{/each}
			</div>
			<FootnoteList />
		</footer>
	</article>

	<ScrollHint />
	<footer class="site-foot">
		<a href="/">Atrey Desai</a>
		<span>{#each nav as link}<a href={link.href}>{link.name}</a>{/each}</span>
	</footer>
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
	/* the header as it was (name left, site links right), with the section names centred between them; once the reader
	   scrolls past it, the names fly into the dot rail on the left (SectionNav) */
	.top { display: grid; grid-template-columns: 1fr auto 1fr; align-items: baseline; gap: 16px; padding-block: 22px 0; }
	.top > nav { justify-self: end; }
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
	/* a short pause of empty ground between scenes: long gaps left slow scrollers wondering whether the page had ended */
	.breath { height: calc(18 * var(--vh, 1vh)); }
	.lede-wrap { min-height: calc(100 * var(--vh, 1vh)); padding-block: calc(22 * var(--vh, 1vh)); display: grid; align-content: center; }
	.lede { margin-top: 0; max-width: 44rem; font-size: 22px; line-height: 1.6; letter-spacing: -0.005em; }
	/* a book's drop cap: the opening "I" spans three lines */
	.lede::first-letter { float: left; font-family: Georgia, "Times New Roman", serif !important; font-size: calc(22px * 1.6 * 3 * 0.86); line-height: .8; font-weight: 400; margin: 6px 12px 0 -2px; color: var(--ink); }
	@supports (initial-letter: 3) { .lede::first-letter { float: none; initial-letter: 3; margin: 0 12px 0 0; font-size: inherit; line-height: inherit; } }

	.body { display: grid; grid-template-columns: 13rem minmax(0, 1fr); gap: 40px; margin-top: 24px; }

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

	/* the finale: full bleed and dark, the closing line at chapter size with the one print */
	.finale { width: 100vw; margin-left: calc(50% - 50vw); height: calc(175 * var(--vh, 1vh)); background: #14202D; color: #fff; }
	.finale-in {
		position: sticky; top: 0; min-height: calc(100 * var(--vh, 1vh)); padding: calc(12 * var(--vh, 1vh)) max(16px, calc(50vw - 36rem));
		display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: 6vw;
	}
	.closing { max-width: 18ch; font-size: clamp(36px, 5.2vw, 80px); line-height: 1.04; font-weight: 600; letter-spacing: -0.04em; text-wrap: balance; color: #fff; }
	.end { padding-block: 64px 32px; }
	/* the lede's highlights, and selection, in a deep rose (rgb 126 34 62) */
	.lede :global(mark.hl) { color: rgb(126, 34, 62); background: linear-gradient(transparent 58%, rgba(126, 34, 62, .14) 58%); padding: 0 1px; font-weight: 500; }
	.byline.small { font-size: 13px; color: var(--ink2); margin-top: 24px; max-width: 52rem; }
	.site-foot { display: flex; justify-content: space-between; gap: 16px; padding-block: 28px 40px; border-top: 1px solid var(--rule); font-size: 13px; color: var(--ink2); }
	.site-foot span { display: flex; gap: 16px; }
	.site-foot a { text-decoration: none; }
	.site-foot a:hover { color: var(--ink); }

	@media (max-width: 1100px) {
		.body { grid-template-columns: minmax(0, 1fr); }
	}
	@media (max-width: 760px) {
		.finale { height: calc(160 * var(--vh, 1vh)); }
		.finale-in { grid-template-columns: 1fr; align-content: center; gap: calc(6 * var(--vh, 1vh)); padding-block: calc(10 * var(--vh, 1vh)); }
		.top { grid-template-columns: auto 1fr auto; gap: 8px; }
	}
	@media (max-width: 600px) {
		.mast { padding-top: 32px; }
		.lede { font-size: 18px; }
		.lede-wrap { padding-block: calc(16 * var(--vh, 1vh)); }
		.breath { height: calc(12 * var(--vh, 1vh)); }
		.lede::first-letter { font-size: calc(18px * 1.6 * 3 * 0.86); }
		.top nav { gap: 14px; }
	}
</style>
