<script lang="ts">
	// The paper launch page. It brings its own chrome and theme (the llm-detectors house style: warm gray
	// dotted ground, Inter, Figure 1's question colours) in place of the site's header, footer and palette.
	// All copy is paper text, from content.json (built in the private llm-detectors repo, docs/launch_20261116).
	import { onMount, setContext, tick } from "svelte";
	import { browser, dev } from "$app/environment";
	import Seo from "$lib/components/Seo.svelte";
	import { SITE_URL } from "$lib/seo";
	import Icon from "$lib/who-wrote-this/Icon.svelte";
	import DotField from "$lib/who-wrote-this/DotField.svelte";
	import SectionNav from "$lib/who-wrote-this/SectionNav.svelte";
	import FootnoteList from "$lib/who-wrote-this/FootnoteList.svelte";
	import PrintMark from "$lib/who-wrote-this/PrintMark.svelte";
	import ScrollHint from "$lib/who-wrote-this/ScrollHint.svelte";
	import { field, chart } from "$lib/who-wrote-this/field.svelte";
	import PhoneStatic from "$lib/who-wrote-this/PhoneStatic.svelte";
	import P from "$lib/who-wrote-this/phone_slides.json";
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


	// Phones (screens up to 600 px wide) get the static page: the summary video for the hero and each section as still
	// slides (PhoneStatic, phone_slides.json), in plain native scroll. None of the live sections or the field canvas is
	// mounted there, so none of their script runs (Atrey, 16 Nov, after coauthors found the pinned sections janky on
	// phones: hover cards opening under a scrolling thumb, one section's chart over another in a fast flick, pins jumping
	// with the address bar). ?live forces the live page at any width (the slides are shot from it).
	// The head script below sets html[data-phone] before first paint, so the server-rendered live page never shows on a
	// phone; the component reads the same test (a client-side navigation here does not run head scripts) and swaps
	// versions when a resize or rotation crosses 600 px.
	const PHONE_MQ = "(max-width: 600px)";
	const wantPhone = () => matchMedia(PHONE_MQ).matches && !new URLSearchParams(location.search).has("live");
	const phoneAtLoad = browser ? wantPhone() : false;
	let phone = $state(phoneAtLoad);
	if (browser) document.documentElement.toggleAttribute("data-phone", phoneAtLoad);
	const PHONE_HEAD = `<script>(function(){try{if(matchMedia(${JSON.stringify(PHONE_MQ)}).matches&&!new URLSearchParams(location.search).has("live"))document.documentElement.setAttribute("data-phone","")}catch(e){}})()<\/script>`;
	// the video's name: the paper's three levels, as the video shows them
	const heroLabel = `${C.levels.lead.t}: ${C.levels.items.map((l) => l.t).join("; ")}.`;
	let heroVideo = $state<HTMLVideoElement>();
	let heroPaused = $state(false);
	$effect(() => {
		const v = heroVideo;
		if (!v) return;
		// muted as a property too (autoplay needs it), and no autoplay for readers who asked for less motion
		v.muted = true;
		if (matchMedia("(prefers-reduced-motion: reduce)").matches) { v.removeAttribute("autoplay"); v.pause(); heroPaused = true; }
		else v.play().catch(() => (heroPaused = true));
	});
	const toggleHero = () => {
		if (!heroVideo) return;
		if (heroVideo.paused) { heroVideo.play().catch(() => {}); heroPaused = false; } else { heroVideo.pause(); heroPaused = true; }
	};

	onMount(() => {
		const mq = matchMedia(PHONE_MQ);
		// where the reader is (a section and how far through it), kept as they scroll: by the time a rotation reports
		// the new width, the page has already been laid out at it
		let spot: { id: string; f: number } | null = null, raf = 0;
		const where = () => {
			spot = null;
			for (const s of stops) {
				const r = document.getElementById(s.id)?.getBoundingClientRect();
				if (r && r.top <= innerHeight * 0.4) spot = { id: s.id, f: Math.max(0, Math.min(1, -r.top / Math.max(1, r.height))) };
			}
		};
		const onScroll = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; where(); }); };
		const swap = async () => {
			const next = wantPhone();
			if (next === phone) return;
			const here = spot;
			phone = next;
			document.documentElement.toggleAttribute("data-phone", next);
			await tick();
			// the live sections are gone: leave the shared field clean for the next time they mount
			if (next) { field.mode = "ground"; field.dim = 0; field.interactive = false; field.owner = ""; field.hover = null; chart.marks = []; chart.paths = []; chart.texts = []; chart.paint = null; }
			const el = here && document.getElementById(here.id);
			if (el) { const r = el.getBoundingClientRect(); scrollTo({ top: r.top + scrollY + here.f * r.height - (here.f ? 0 : 4), behavior: "instant" }); }
		};
		// a link to a section or a note (#which-ai, #fn-5): on a phone its target is only drawn now, after the browser
		// looked for it, so go there once
		if (phone && location.hash.length > 1) {
			const el = document.getElementById(decodeURIComponent(location.hash.slice(1)));
			if (el) scrollTo({ top: el.getBoundingClientRect().top + scrollY - (el.matches("li") ? 24 : 4), behavior: "instant" });
		}
		where();
		addEventListener("scroll", onScroll, { passive: true });
		mq.addEventListener("change", swap);
		return () => { cancelAnimationFrame(raf); removeEventListener("scroll", onScroll); mq.removeEventListener("change", swap); document.documentElement.removeAttribute("data-phone"); };
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
		html[data-phone] .wwt-live { display: none !important; }
	</style>`}
	<!-- phone or live, decided before first paint -->
	{@html PHONE_HEAD}
</svelte:head>

{#if !phone}<DotField />{/if}

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

		<!-- on phones the summary video; its box is kept from first paint (shown by html[data-phone]), so the lede does not move -->
		<div class="phone-hero">
			{#if phone && P.hero}
				<figure id="levels" class="ph-video">
					<video bind:this={heroVideo} src={P.hero.src} poster={P.hero.poster} width={P.hero.w} height={P.hero.h} autoplay muted loop playsinline preload="metadata" aria-label={heroLabel}></video>
					<button type="button" class="ph-play" onclick={toggleHero} aria-label={heroPaused ? "Play the video" : "Pause the video"}>
						{#if heroPaused}<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3.5 2.2v7.6L9.8 6z" /></svg>{:else}<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3.2 2.2h1.9v7.6H3.2zM6.9 2.2h1.9v7.6H6.9z" /></svg>{/if}
					</button>
				</figure>
			{/if}
		</div>
		{#if !phone}
			<div class="wwt-live">{#key art}{#if art === "print"}<PrintHero />{:else}<Levels {art} />{/if}{/key}</div>
		{/if}

		<!-- empty ground between scenes, so only one thing is on screen at a time -->
		<div class="breath" aria-hidden="true"></div>

		<div class="lede" data-lag="1">
			{#each ledeParts as p}{#if p.hl}<mark class="hl">{p.t}</mark>{:else}{p.t}{/if}{/each}
		</div>

		<div class="breath" aria-hidden="true"></div>
		{#if phone}
			<div class="phone-sections">
				{#each P.sections as s, i (s.id)}<PhoneStatic id={s.id} title={s.title} slides={s.slides} eager={i === 0} />{/each}
			</div>
		{:else}
			<div class="wwt-live">
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
			</div>
		{/if}
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
			{#if phone}
				<!-- the live page's notes list, as the slides' build saved it (the marks are in the pictures) -->
				{#if P.notes}<section class="fns-phone" aria-label="Notes">{@html P.notes}</section>{/if}
			{:else}
				<FootnoteList />
			{/if}
		</footer>
	</article>

	{#if !phone}<ScrollHint />{/if}
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
	.breath { height: 18vh; }
	.lede { margin-top: 0; max-width: 46rem; font-size: 19px; line-height: 1.6; }
	/* a book's drop cap: the opening "I" spans three lines */
	.lede::first-letter { float: left; font-family: Georgia, "Times New Roman", serif !important; font-size: calc(19px * 1.6 * 3 * 0.86); line-height: .8; font-weight: 400; margin: 6px 12px 0 -2px; color: var(--ink); }
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
	.finale { width: 100vw; margin-left: calc(50% - 50vw); height: 175vh; background: #14202D; color: #fff; }
	.finale-in {
		position: sticky; top: 0; min-height: 100vh; padding: 12vh max(16px, calc(50vw - 36rem));
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

	/* the live sections' wrapper adds no box (on a phone the head style hides it until the swap) */
	.wwt-live { display: contents; }
	/* phones: the summary video in the hero's place, full bleed and square, with a pause button (it loops) */
	.phone-hero { display: none; }
	:global(html[data-phone]) .phone-hero { display: block; width: 100vw; margin: 28px 0 0 calc(50% - 50vw); aspect-ratio: 1; }
	.ph-video { position: relative; margin: 0; height: 100%; scroll-margin-top: 0; }
	.ph-video video { display: block; width: 100%; height: 100%; object-fit: cover; }
	.ph-play { position: absolute; right: 12px; bottom: 12px; display: grid; place-items: center; width: 36px; height: 36px; border-radius: 50%; background: rgba(20, 32, 45, .7); color: #fff; }
	.ph-play svg { width: 12px; height: 12px; fill: currentColor; }
	.phone-sections { display: grid; gap: 12vh; }
	/* phones: the live page's notes, as the slides' build saved them (FootnoteList's look, without the back links) */
	.fns-phone { max-width: 46rem; margin: 10vh 0 0; padding-top: 18px; border-top: 1px solid #C9C9C9; }
	.fns-phone :global(h2) { font-size: 13px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--ink2); margin: 0 0 12px; }
	.fns-phone :global(ol) { display: grid; gap: 8px; }
	.fns-phone :global(li) { display: grid; grid-template-columns: 1.6em minmax(0, 1fr); gap: 6px; font-size: 13px; line-height: 1.55; color: var(--ink2); scroll-margin-top: 24px; border-radius: 2px; }
	.fns-phone :global(li:target) { background: rgba(126, 34, 62, .08); }
	.fns-phone :global(.n) { font-variant-numeric: tabular-nums; font-weight: 600; color: var(--ink); }
	.fns-phone :global(a) { color: var(--ink); overflow-wrap: anywhere; }

	@media (max-width: 1100px) {
		.body { grid-template-columns: minmax(0, 1fr); }
	}
	@media (max-width: 760px) {
		.finale { height: 160vh; }
		.finale-in { grid-template-columns: 1fr; align-content: center; gap: 6vh; padding-block: 10vh; }
		.top { grid-template-columns: auto 1fr auto; gap: 8px; }
	}
	@media (max-width: 600px) {
		.mast { padding-top: 32px; }
		.lede { font-size: 17px; }
		.breath { height: 12vh; }
		.lede::first-letter { font-size: calc(17px * 1.6 * 3 * 0.86); }
		.top nav { gap: 14px; }
	}
</style>
