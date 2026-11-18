<script lang="ts">
	// The paper launch page. It brings its own chrome and theme (the llm-detectors house style: warm gray
	// dotted ground, Inter, Figure 1's question colours) in place of the site's header, footer and palette.
	// All copy is paper text, from content.json (built in the private llm-detectors repo, docs/launch_20261116).
	import { dev } from '$app/env';
	import Seo from "#lib/components/Seo.svelte";
	import { SITE_URL } from "#lib/seo.ts";
	import Icon from "#lib/who-wrote-this/Icon.svelte";
	import DotField from "#lib/who-wrote-this/DotField.svelte";
	import SectionNav from "#lib/who-wrote-this/SectionNav.svelte";
	import FootnoteList from "#lib/who-wrote-this/FootnoteList.svelte";
	import PrintMark from "#lib/who-wrote-this/PrintMark.svelte";
	import ScrollHint from "#lib/who-wrote-this/ScrollHint.svelte";
	import ShareBlock from "#lib/who-wrote-this/ShareBlock.svelte";
	import PrintHero from "#lib/who-wrote-this/PrintHero.svelte";
	import Timeline from "#lib/who-wrote-this/Timeline.svelte";
	import HumanOrAIB, { FOOTNOTES as HB_NOTES } from "#lib/who-wrote-this/HumanOrAIB.svelte";
	import WhichAI, { FOOTNOTES as WA_NOTES } from "#lib/who-wrote-this/WhichAI.svelte";
	import WhichHuman, { FOOTNOTES as WH_NOTES } from "#lib/who-wrote-this/WhichHuman.svelte";
	import Familiar, { FOOTNOTES as FA_NOTES } from "#lib/who-wrote-this/Familiar.svelte";
	import Anonymity, { FOOTNOTES as AN_NOTES } from "#lib/who-wrote-this/Anonymity.svelte";
	import { register } from "#lib/who-wrote-this/fnstore.svelte.ts";
	import { onDestroy } from "svelte";
	import LedeHold from "#lib/who-wrote-this/LedeHold.svelte";
	import Defer from "#lib/who-wrote-this/Defer.svelte";
	import C from "#lib/who-wrote-this/content.json";

	const INTER_CSS = "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,400;0,14..32,500;0,14..32,600;1,14..32,400;1,14..32,500&amp;display=swap";
	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();

	// The sections below the lede hydrate after the page, one by one (Defer.svelte). Their footnotes are registered here,
	// before any of them wakes, so the notes list and the marks' numbers are whole from the start.
	if (typeof window !== "undefined") {
		const off = [HB_NOTES, WA_NOTES, WH_NOTES, FA_NOTES, AN_NOTES].map((f) => register(f.id, f.notes));
		onDestroy(() => off.forEach((fn) => fn()));
	}
	const post = $derived(data.post);
	const url = `${SITE_URL}/blog/who-wrote-this/`;
	const affIndex = Object.fromEntries(C.meta.affiliations.map((a, i) => [a.key, i + 1]));
	const nav = [
		{ name: "research", href: "/research/" },
		{ name: "blog", href: "/blog/" },
		{ name: "about", href: "/about/" },
	];

	// the side rail's stops
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


	// the paper's BibTeX (the paper's own title and author order; accents escaped for plain BibTeX). Once the Paper
	// button links an arXiv entry (meta.links, id "paper") it becomes an arXiv citation by itself; until then it points
	// at this page. Keys are padded so the "=" line up.
	const PAPER = C.meta.links.find((l) => l.id === "paper")?.href ?? "";
	const ARXIV = /arxiv\.org\/(?:abs|pdf)\/([\w.\-\/]+?)(?:v\d+)?(?:\.pdf)?\/?$/.exec(PAPER)?.[1] ?? "";
	const AUTHORS = [
		'Desai, Atrey and B{\\"o}l{\\"o}ni-Turgut, Deniz and Brassington, Ty and',
		"Choi, Minjoon and Russell, Jenna and Rajendhran, Rishanth and",
		"Emi, Bradley and Gonen, Hila and Daum{\\'e} III, Hal and",
		"Wieting, John and Karpinska, Marzena and Iyyer, Mohit",
	];
	const BIB = (() => {
		const fields: [string, string][] = [["title", C.meta.deck.t], ["author", AUTHORS.join("\n")], ["year", "2026"]];
		if (ARXIV) fields.push(["eprint", ARXIV], ["archivePrefix", "arXiv"], ["primaryClass", "cs.CL"], ["url", `https://arxiv.org/abs/${ARXIV}`]);
		else fields.push(["howpublished", `\\url{${url}}`]);
		const w = Math.max(...fields.map(([k]) => k.length));
		const lines = fields.map(([k, v]) => `  ${k.padEnd(w)} = {${v.split("\n").join("\n" + " ".repeat(w + 6))}}`);
		return `@misc{desai2026unmasking,\n${lines.join(",\n")}\n}`;
	})();
	let copied = $state(false), bibEl: HTMLElement;
	let copiedT: ReturnType<typeof setTimeout> | undefined;
	async function copyBib() {
		try {
			await navigator.clipboard.writeText(BIB);
			copied = true;
			clearTimeout(copiedT);
			copiedT = setTimeout(() => (copied = false), 1800);
		} catch {
			// no clipboard: select the entry so it can be copied by hand
			const r = document.createRange();
			r.selectNodeContents(bibEl);
			getSelection()?.removeAllRanges();
			getSelection()?.addRange(r);
		}
	}

	const jsonLd = $derived([
		{
			"@type": "BlogPosting",
			"@id": `${url}#article`,
			headline: `${C.meta.title.t} ${C.meta.deck.t}`,
			description: post.seoDescription ?? post.excerpt,
			datePublished: post.date,
			inLanguage: "en-US",
			author: C.meta.authors.map((a) => ({ "@type": "Person", name: a.name })),
		},
	]);
</script>

<Seo
	title="{post.seoTitle ?? post.title} | Atrey Desai"
	description={post.seoDescription ?? post.excerpt}
	image={post.image}
	imageAlt={post.imageAlt}
	url={url}
	type="article"
	pageType="WebPage"
	published={post.date}
	tags={post.tags}
	jsonLd={jsonLd}
	noindex={post.unlisted === true || post.published === false}
/>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<!-- Inter's stylesheet comes from another origin, so as a plain stylesheet it held the first paint for a new connection
	     and a round trip (~900 ms on a slow phone, against ~300 for every other page). Loaded without blocking, the page
	     paints at once in the metric-matched fallback below, and Inter swaps in as it would have anyway (display=swap). -->
	{@html `<link rel="preload" as="style" href="${INTER_CSS}" onload="this.onload=null;this.rel='stylesheet'"><noscript><link rel="stylesheet" href="${INTER_CSS}"></noscript>`}
	<!-- This route owns the whole page: our ground behind everything, light only. -->
	{@html `<style>
	/* Inter arrives from Google Fonts after the page has painted (display=swap).
	   Until then the text is set in local Arial scaled to Inter's metrics, so the
	   swap changes letterforms, not layout: with the plain fallback it reflowed
	   every block on the page (a 0.22 layout shift, and the largest paint moved
	   to the swap at ~2.5 s on a slow phone). The overrides are Inter's own
	   ascent and descent and its average width over Arial's. */
	@font-face {
		font-family: "Inter Fallback";
		src: local("Arial"), local("ArialMT"), local("Helvetica");
		ascent-override: 90.49%;
		descent-override: 22.56%;
		line-gap-override: 0%;
		size-adjust: 107.06%;
	}

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
		<SectionNav stops={stops} />
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
					<span class="author">{a.name}<sup>{#each a.aff as k}{affIndex[k]}{/each}{#if a.equal}*{/if}{#if a.corresponding}<span class="dag">†</span>{/if}</sup>{#if i < C.meta.authors.length - 1}{", "}{/if}</span>
				{/each}
			</p>
			<p class="affs" data-lag="2">
				{#each C.meta.affiliations as aff, i}<span><sup>{i + 1}</sup>{aff.t}</span>{/each}
				<span><sup>*</sup>{C.meta.equal_note}</span>
				<span><sup><span class="dag">†</span></sup>{C.meta.corresponding_note}</span>
			</p>
			<div class="links" data-lag="3">
				{#each C.meta.links as l}
					<a class="btn" href={l.href} target="_blank" rel="noopener"><Icon name={l.icon} class={l.id === "paper" ? "fable" : ""} /> {l.t}</a>
				{/each}
				<time datetime={C.meta.date}>{new Date(C.meta.date + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</time>
			</div>
		</header>

		<PrintHero />

		<!-- the lede has a screen of its own: it is the paper's argument in one paragraph, so nothing above or below shares
		     the view with it (Atrey, 16 Nov); it holds in place for a stretch of scroll, longer for a fast scroll (LedeHold,
		     Atrey, 17 Nov) -->
		<LedeHold label="Introduction">
			<div class="lede">
				{#each ledeParts as p}{#if p.hl}<mark class="hl">{p.t}</mark>{:else}{p.t}{/if}{/each}
			</div>
		</LedeHold>

		<!-- each section ends with a share control: the blog, or a link to that section (Atrey, 17 Nov) -->
		<!-- the sections hydrate after the page, each on its own (Defer.svelte), so one of them takes nothing from the page
		     (no props or context) and its footnotes are registered above, from its module's FOOTNOTES -->
		<Defer component={Timeline} />
		<ShareBlock {url} id={stops[1].id} name={stops[1].short} />
		<div class="breath" aria-hidden="true"></div>
		<Defer component={HumanOrAIB} />
		<ShareBlock {url} id={stops[2].id} name={stops[2].short} />
		<div class="breath" aria-hidden="true"></div>
		<Defer component={WhichAI} />
		<ShareBlock {url} id={stops[3].id} name={stops[3].short} />
		<div class="breath" aria-hidden="true"></div>
		<Defer component={WhichHuman} />
		<ShareBlock {url} id={stops[4].id} name={stops[4].short} />
		<div class="breath" aria-hidden="true"></div>
		<Defer component={Familiar} />
		<ShareBlock {url} id={stops[5].id} name={stops[5].short} />
		<div class="breath" aria-hidden="true"></div>
		<Defer component={Anonymity} />
		<ShareBlock {url} id={stops[6].id} name={stops[6].short} />
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
				{#each C.meta.links as l}<a class="btn" href={l.href} target="_blank" rel="noopener"><Icon name={l.icon} class={l.id === "paper" ? "fable" : ""} /> {l.t}</a>{/each}
			</div>
			<FootnoteList />
			<!-- the notes (above), the paper's acknowledgements, word for word, and how to cite it: each folded away until opened
			     (Atrey, 18 Nov) -->
			<details class="fold thanks">
				<summary>Acknowledgements</summary>
				<p class="fold-body">{C.meta.acknowledgements.t}</p>
			</details>
			<details class="fold cite">
				<summary>Cite</summary>
				<div class="fold-body">
					<button type="button" class="copy" onclick={copyBib} aria-live="polite"><Icon name="files" />{copied ? "Copied" : "Copy"}</button>
					<pre bind:this={bibEl}><code>{BIB}</code></pre>
				</div>
			</details>
		</footer>
	</article>

	<ScrollHint />
	<footer class="site-foot">
		<!-- a pencilled note beside the name, like the homepage's "arcade" one (Atrey, 17 Nov) -->
		<span class="me">
			<a href="/">Atrey Desai</a>
			<a class="phd" href="/">
				<svg viewBox="0 0 26 14" width="26" height="14" aria-hidden="true" focusable="false"><path d="M1.5 9.5C6 11.8 13.5 12 19 7.5" /><path d="M15.6 6.6 19.6 7.1 18.4 10.9" /></svg>
				I'm applying to PhDs
			</a>
		</span>
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
		--font: "Inter", "Inter Fallback", system-ui, -apple-system, "Segoe UI", sans-serif;
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

	.wwt :global(*) {
		font-family: inherit;
	}

	:where(.wwt) :global(a) {
		color: inherit;
	}

	:where(.wwt) :global(:focus-visible) {
		outline: 2px solid var(--ink);
		outline-offset: 2px;
		border-radius: 2px;
	}

	:where(.wwt) :global(:is(p, h1, h2, h3, figure, blockquote)) {
		margin: 0;
	}

	:where(.wwt) :global(:is(ul, ol)) {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	:where(.wwt) :global(button) {
		font: inherit;
		color: inherit;
		background: none;
		border: 0;
		padding: 0;
		cursor: pointer;
	}

	.top,
	article,
	.site-foot {
		max-width: 72rem;
		margin-inline: auto;
	}

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
	/* Google files the dagger under Inter's latin-ext subset, 131 KB to download for one mark: it is set in the
	   metric-matched fallback instead, which every reader already has. */
	.dag { font-family: "Inter Fallback", system-ui, sans-serif; }
	.affs { margin-top: 6px; display: flex; flex-wrap: wrap; gap: 2px 14px; font-size: 12.5px; color: var(--ink2); }
	.links { margin-top: 18px; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
	.btn { display: inline-flex; align-items: center; gap: 7px; padding: 7px 12px; border: 1.25px solid var(--ink); border-radius: 2px; font-size: 13px; font-weight: 500; text-decoration: none; transition: background-color .15s, color .15s; }
	.btn:hover { background: var(--ink); color: var(--field); }
	.links time { margin-left: 8px; font-size: 13px; color: var(--ink2); }
	/* a short pause of empty ground between scenes: long gaps left slow scrollers wondering whether the page had ended */
	.breath { height: calc(18 * var(--vh, 1vh)); }
	/* (the lede's screen and its hold: LedeHold.svelte) */
	.lede { margin-top: 0; max-width: 44rem; font-size: 22px; line-height: 1.6; letter-spacing: -0.005em; }
	/* a book's drop cap: the opening "I" spans three lines */
	.lede::first-letter { float: left; font-family: Georgia, "Times New Roman", serif !important; font-size: calc(22px * 1.6 * 3 * 0.86); line-height: .8; font-weight: 400; margin: 6px 12px 0 -2px; color: var(--ink); }
	@supports (initial-letter: 3) { .lede::first-letter { float: none; initial-letter: 3; margin: 0 12px 0 0; font-size: inherit; line-height: inherit; } }

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
	/* the note: the homepage's arcade arrow, turned to point back at the name */
	.site-foot .me { display: inline-flex; align-items: baseline; gap: 6px; }
	.phd { display: inline-flex; align-items: baseline; gap: 0; font-size: 12px; font-style: italic; line-height: 1; color: var(--ink2); white-space: nowrap; }
	.phd svg { overflow: visible; margin-right: -3px; transform: translateY(2px) scaleX(-1); }
	.phd path { fill: none; stroke: currentColor; stroke-width: 1.1; stroke-linecap: round; stroke-linejoin: round; }
	.site-foot .me:hover .phd, .phd:focus-visible { color: var(--fable); }
	/* the foot's folded rows (notes, acknowledgements, cite): a rule, the name and a chevron; closed by default */
	:global(.wwt details.fold) { max-width: 52rem; border-top: 1px solid var(--rule); }
	.cite { border-bottom: 1px solid var(--rule); }
	:global(.wwt details.fold > summary) {
		display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 2px; cursor: pointer; list-style: none;
		font-size: 15px; font-weight: 600; letter-spacing: -0.01em; color: var(--ink);
	}
	:global(.wwt details.fold > summary::-webkit-details-marker) { display: none; }
	:global(.wwt details.fold > summary::after) {
		content: ""; flex: none; width: 7px; height: 7px; margin-right: 4px; border-right: 1.5px solid currentColor; border-bottom: 1.5px solid currentColor;
		transform: translateY(-2px) rotate(45deg); transition: transform .2s var(--ease);
	}
	:global(.wwt details.fold[open] > summary::after) { transform: translateY(2px) rotate(-135deg); }
	:global(.wwt details.fold > .fold-body) { padding: 0 2px 18px; }
	.thanks .fold-body { font-size: 14px; line-height: 1.6; color: var(--ink2); }
	.cite .fold-body { position: relative; }
	.cite .copy { position: absolute; top: 8px; right: 10px; background: var(--field); }
	.copy { display: inline-flex; align-items: center; gap: 6px; padding: 5px 11px; border: 1.25px solid var(--ink); border-radius: 2px; font-size: 13px; font-weight: 500; transition: background-color .15s, color .15s; }
	.cite .copy:hover { background: var(--ink); color: var(--field); }
	.cite pre { margin: 0; padding: 14px 16px; background: var(--field); border: 1px solid var(--rule); border-radius: 3px; overflow-x: auto; }
	.cite code { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace !important; font-size: 12.5px; line-height: 1.5; color: var(--ink); white-space: pre; }
	/* the paper's icon in Fable's clay, top and bottom (Atrey, 17 Nov) */
	.btn :global(.ic.fable) { color: var(--fable); }

	@media (max-width: 760px) {
		.finale { height: calc(160 * var(--vh, 1vh)); }
		.finale-in { grid-template-columns: 1fr; align-content: center; gap: calc(6 * var(--vh, 1vh)); padding-block: calc(10 * var(--vh, 1vh)); }
		.top { grid-template-columns: auto 1fr auto; gap: 8px; }
	}
	@media (max-width: 600px) {
		.mast { padding-top: 32px; }
		.lede { font-size: 18px; }
		.breath { height: calc(12 * var(--vh, 1vh)); }
		.lede::first-letter { font-size: calc(18px * 1.6 * 3 * 0.86); }
		.top nav { gap: 14px; }
	}
</style>
