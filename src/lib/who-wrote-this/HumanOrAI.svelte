<script lang="ts">
	// Section 1, Human or AI? Read (question, finding, context) -> See (the paper's Claude Fable 5.2 example, pinned
	// while the scroll walks it: the idea cues and the Ideas verdict, then the prose cue and the Prose verdict, then
	// both, since a text's ideas and its prose can come from different authors; only then the Explore control) ->
	// the four cases (a closed disclosure) -> a full-width Claude Fable 5.2 showcase.
	// Ideas and prose share colours and differ by icon (bulb, pen) and mark (filled, hollow), per palette KIND; each
	// highlight colour is named on the story itself (Tags) while the stage is pinned. Strings: s1.json.
	import { onMount } from "svelte";
	import Icon from "./Icon.svelte";
	import Emblem from "./Emblem.svelte";
	import PrintMark from "./PrintMark.svelte";
	import Reveal from "./Reveal.svelte";
	import Tags, { type Tag } from "./Tags.svelte";
	import { FABLE, KIND, LAB } from "./palette";
	import S from "./s1.json";

	// +page.svelte still passes section={C.sections[0]}; the strings now come from s1.json
	let _props: { section?: unknown } = $props();

	type View = "both" | "ideas" | "prose";
	type Kind = "ideas" | "prose";
	const E = S.example;
	const STEPS = S.steps as View[];
	const LAST = STEPS.length - 1;
	const STEP_VH = 0.42; // scroll per guided step, as a share of the viewport height
	const HOLD_VH = 0.36; // the last step stays pinned this much longer, with Explore open
	// the paper's highlight colours (examples table: cueRose, cueTeal, cueClay), as palette hues
	const CUE: Record<string, string> = { rose: LAB.Anthropic, teal: LAB.OpenAI, clay: FABLE.strong };
	const kindOf: Record<string, Kind> = Object.fromEntries(E.judgments.flatMap((j) => j.cues.map((c) => [c, j.id as Kind])));

	let step = $state(LAST); // the settled final state until mounted (no script, first paint)
	let pick = $state<View>("both"); // the Explore choice
	let cue = $state<string | null>(null);
	let tags = $state<Tag[]>([]);
	let still = $state(false);
	let h = $state(0); // the stage's height now
	let hMax = $state(560); // its tallest state at this width: the stage is centred on it, so steps never shift it
	let vh = $state(900);
	const pinTop = $derived(Math.max(8, Math.round((vh - hMax) / 2)));
	$effect(() => { if (h > hMax) hMax = h; });
	let pin: HTMLElement;
	let stage: HTMLElement;
	let story: HTMLElement;

	const explore = $derived(step >= LAST);
	const view = $derived<View>(explore ? pick : STEPS[step]);
	const shown = (c: string) => view === "both" || kindOf[c] === view;
	const lit = (c: string) => shown(c) && (cue === null || cue === c);
	// a verdict card is on (its step, or the Explore choice), dim (passed, or the other kind) or waiting for its step
	const card = (id: string) => (view === "both" || view === id ? "on" : !explore && STEPS.indexOf(id as View) > step ? "wait" : "dim");
	const choose = (v: View) => { pick = v; cue = null; };
	// cues are inline spans (a <button> cannot wrap across lines), so in Explore they take Enter and Space themselves
	const toggle = (c: string) => { if (explore) cue = cue === c ? null : c; };
	const key = (e: KeyboardEvent, c: string) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(c); } };

	// scrolling back into the guided steps hands control back to the story
	$effect(() => { if (!explore) { pick = "both"; cue = null; } });

	// the colour names sit on the story while it is pinned (fixed tags would trail a moving block), on its lit cues
	function place(): Tag[] {
		const box = story.getBoundingClientRect();
		const out: Tag[] = [];
		for (const tg of S.tags) {
			if (!lit(tg.cue)) continue;
			const r = story.querySelector(`.cue.${tg.cue}`)?.getClientRects()[0];
			if (!r) continue;
			const w = tg.t.length * 7 + 56; // the tag's width, near enough to keep it inside the story card
			const x = Math.min(Math.max(r.left - 4 + w / 2, box.left + 8 + w / 2), box.right - 8 - w / 2);
			const k = KIND[tg.kind as Kind];
			out.push({ id: tg.cue, x, y: r.top + 7, t: tg.t, color: CUE[tg.cue], swatch: k.fill ? "dot" : "ring", icon: k.icon, at: "above" });
		}
		return out;
	}

	// No per-frame work: a passive scroll listener (only while the stage is near the viewport) sets the step, and the
	// tags are placed again only when the pin starts or ends, the lit cues change, or the size changes.
	const NONE: Tag[] = [];
	let raf = 0;
	let near = false;
	let pinned = false;
	let dirty = true;
	function update() {
		raf = 0;
		const scrolled = pinTop - pin.getBoundingClientRect().top;
		const s = Math.max(0, Math.min(LAST, Math.floor(scrolled / (STEP_VH * vh))));
		if (s !== step) step = s;
		const now = near && Math.abs(stage.getBoundingClientRect().top - pinTop) < 1.5;
		if (now !== pinned || (now && dirty)) tags = now ? place() : NONE;
		pinned = now;
		dirty = false;
	}
	const queue = () => { if (!raf) raf = requestAnimationFrame(update); };
	const onScroll = () => { if (near) queue(); };
	// a phone's toolbar resizes the height mid-scroll: re-measure the tallest state only when the width changes
	let vw = 0;
	const onResize = () => { vh = innerHeight; if (innerWidth !== vw) { vw = innerWidth; hMax = stage.offsetHeight; } dirty = true; queue(); };
	// re-place the tags when the lit cues or the stage's resting place change
	$effect(() => { void view; void cue; void pinTop; dirty = true; queue(); });

	onMount(() => {
		still = matchMedia("(prefers-reduced-motion: reduce)").matches || new URLSearchParams(location.search).has("still");
		vh = innerHeight;
		vw = innerWidth;
		hMax = stage.offsetHeight; // measured in the settled final state (both verdicts, Explore open), its tallest
		const io = new IntersectionObserver(([e]) => { near = e.isIntersecting; dirty = true; queue(); }, { rootMargin: "50% 0px" });
		io.observe(pin);
		addEventListener("scroll", onScroll, { passive: true });
		addEventListener("resize", onResize, { passive: true });
		document.fonts?.ready.then(() => { dirty = true; queue(); });
		update();
		return () => { io.disconnect(); removeEventListener("scroll", onScroll); removeEventListener("resize", onResize); cancelAnimationFrame(raf); };
	});
</script>

<section
	class="section s1" class:still id={S.id} data-rq={S.rq}
	style="--cc-rose:{CUE.rose}; --cc-teal:{CUE.teal}; --cc-clay:{CUE.clay}; --f-ink:{FABLE.ink}; --f-strong:{FABLE.strong}; --f-mid:{FABLE.mid}; --f-light:{FABLE.light}; --f-tint:{FABLE.tint}"
>
	<!-- read -->
	<header class="s-head"><Emblem n={1} /><span class="badge">{S.n}</span><h2>{S.title}</h2></header>
	<p class="finding">{S.takeaway.t}</p>
	<p class="context">{S.context[0].t}</p>

	<!-- see: pinned while the scroll walks ideas, then prose, then both -->
	<div class="pin" bind:this={pin} style:--run="{(LAST * STEP_VH + HOLD_VH) * 100}vh">
		<div class="stage" bind:this={stage} bind:clientHeight={h} style:--top="{pinTop}px" data-view={view} ontransitionend={(e) => { if (e.target === stage) { dirty = true; queue(); } }}>
			<blockquote class="story" bind:this={story}>
				<span class="q">“</span>{#each E.text as seg, i}{#if seg.cue}<span style:--k={i} role="button" tabindex={explore ? 0 : -1} aria-pressed={cue === seg.cue} class="cue {seg.cue} {kindOf[seg.cue]}" class:lit={lit(seg.cue)} class:dim={!lit(seg.cue)} onclick={() => toggle(seg.cue)} onkeydown={(e) => key(e, seg.cue)}>{seg.t}</span>{:else}<span class="plain">{seg.t}</span>{/if}{/each}<span class="q">”</span>
			</blockquote>

			<div class="panel">
				<p class="by"><Icon name="anthropic" class="fable" /><span>{E.caption.t}.</span></p>
				<p class="say-n" aria-hidden="true">{#each STEPS as _, i}<i class:on={step === i}></i>{/each}</p>
				<div class="verdicts" data-lag="1">
					{#each E.judgments as j}
						<div class="verdict {j.id} {card(j.id)}">
							<!-- the verdict's print: the AI's for ideas, the human's for prose (the hero's two prints) -->
							<span class="v-print"><PrintMark family={j.verdict === "AI" ? "ai" : "human"} color={j.verdict === "AI" ? "#461E47" : "#C85A82"} px={44} /></span>
							<p class="v-head">
								<span class="kind {j.id}"><Icon name={j.icon} /></span>
								<span class="v-l">{j.label}</span>
								<span class="v-v"><Icon name="check" class="ok" />{j.verdict}</span>
								<span class="v-s">{j.share}</span>
							</p>
							<p class="v-x">“{#each j.explanation as seg}{#if seg.cue}<span role="button" tabindex={explore ? 0 : -1} aria-pressed={cue === seg.cue} class="cue {seg.cue} {kindOf[seg.cue]}" class:lit={lit(seg.cue)} class:dim={!lit(seg.cue)} onclick={() => toggle(seg.cue)} onkeydown={(e) => key(e, seg.cue)}>{seg.t}</span>{:else}{seg.t}{/if}{/each}”</p>
						</div>
					{/each}
				</div>
				<div class="after" data-lag="2">
					<p class="truth" class:on={explore}>
						<span class="pair" aria-hidden="true"><span class="kind ideas"><Icon name="bulb" /></span><Icon name="ai" /><span class="kind prose"><Icon name="pen" /></span><Icon name="human" /></span>
						<span>{E.source}.</span>
					</p>
					<Reveal show={explore}>
						<div class="seg" role="group" aria-label="Show">
							<button type="button" aria-pressed={pick === "both"} onclick={() => choose("both")}>Both</button>
							{#each E.judgments as j}
								<button type="button" aria-pressed={pick === j.id} onclick={() => choose(j.id as View)}><span class="kind {j.id}"><Icon name={j.icon} /></span>{j.label}</button>
							{/each}
						</div>
					</Reveal>
				</div>
			</div>
			<div class="tagbox"><Tags items={tags} /></div>
		</div>
		<div class="runway" aria-hidden="true"></div>
	</div>

	<!-- the four cases, closed until asked for -->
	<details class="cases" data-lag="3">
		<summary>
			<span class="sum-t">{S.cases_intro.t}</span>
			<span class="sum-k">Four cases<i class="chev" aria-hidden="true"></i></span>
		</summary>
		<div class="grid">
			<span class="ax ax-i"><span class="kind ideas"><Icon name="bulb" /></span>Ideas</span>
			<span class="ax ax-p"><span class="kind prose"><Icon name="pen" /></span>Prose</span>
			<span class="hd c-h1"><Icon name="human" />Human</span><span class="hd c-h2"><Icon name="ai" />AI</span>
			<span class="hd r-h1"><Icon name="human" />Human</span><span class="hd r-h2"><Icon name="ai" />AI</span>
			{#each [0, 1, 3, 2] as ci}
				{@const c = S.cases[ci]}
				<div class="case" class:ex={"example" in c} style:--col={c.ideas === "human" ? 3 : 4} style:--row={c.prose === "human" ? 3 : 4}>
					<p class="who" aria-hidden="true">
						<span class="kind ideas"><Icon name="bulb" /></span><Icon name={c.ideas === "ai" ? "ai" : "human"} />
						<span class="kind prose"><Icon name="pen" /></span><Icon name={c.prose === "ai" ? "ai" : "human"} />
					</p>
					<p class="case-t">{c.t}{#if "example" in c}<span class="this">This story</span>{/if}</p>
					<p class="case-d">{c.def}</p>
				</div>
			{/each}
		</div>
	</details>

	<!-- one model's showcase: Claude Fable 5.2 -->
	<aside class="showcase" aria-labelledby="s1-fable">
		<!-- Fable's print, set in the paper's text, behind its numbers -->
		<div class="f-print" aria-hidden="true"><PrintMark family="lab" index={0} color={FABLE.strong} px={300} text /></div>
		<header class="f-head">
			<p class="f-kick">Model showcase</p>
			<h3 id="s1-fable"><Icon name="anthropic" />{S.stats_model}</h3>
			<p class="f-lead">{S.detectors.t}</p>
		</header>
		<ul class="f-stats" data-lag="1">
			{#each S.stats as st}
				<li class={st.kind} style:--v={st.v / 100}>
					<span class="f-big">{st.v}%</span>
					<span class="f-meter"><i></i></span>
					<span class="f-t">
						{#if st.kind !== "prose"}<span class="kind ideas"><Icon name="bulb" /></span>{/if}{#if st.kind !== "ideas"}<span class="kind prose"><Icon name="pen" /></span>{/if}
						<span>{st.t}</span>
					</span>
				</li>
			{/each}
		</ul>
		<figure class="f-climb" data-lag="2">
			<figcaption>{S.climb_label.t}</figcaption>
			<ol>
				{#each S.climb as p}
					{@const fable = p.lab === "Anthropic"}
					<li class:mine={fable} style:--c={fable ? FABLE.strong : LAB.OpenAI} style:--v={p.v / 100}>
						<span class="cl-who"><Icon name={fable ? "anthropic" : "openai"} /><b>{p.t}</b><em>{p.year}</em></span>
						<span class="bar"><i></i></span>
						<span class="cv">{p.v}%</span>
					</li>
				{/each}
			</ol>
		</figure>
	</aside>
</section>

<style>
	/* the pinned stage: centred in the viewport while the runway scrolls under it. The stage grows as steps add its
	   cards; scroll anchoring would answer that by jumping the page, so this section opts out of it. */
	.s1 { overflow-anchor: none; }
	.pin { position: relative; margin-top: 32px; }
	.stage { position: sticky; top: var(--top, 8px); display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); gap: 16px; align-items: start; transition: top .45s var(--ease); }
	.runway { height: var(--run); }

	.story { background: #fff; border-radius: 3px; padding: 34px 26px 22px; font-size: 20px; line-height: 2.5; letter-spacing: -0.01em; }
	/* the tags sit in the gaps between the story's lines: a tighter line inside them than the page's */
	.tagbox { display: contents; line-height: 1.2; }
	.story .q { color: var(--axis); }
	.plain { color: var(--ink); }

	/* cues: the paper's colour-matched highlights; ideas filled, prose hollow (outlined) */
	.cue { display: inline; padding: .08em .14em; margin: 0 -.02em; border-radius: 2px; font: inherit; letter-spacing: inherit; color: var(--ink); transition: background-color .3s, color .3s, box-shadow .3s, opacity .3s; box-decoration-break: clone; -webkit-box-decoration-break: clone; }
	.cue.rose { --cc: var(--cc-rose); --ci: var(--cue-rose); }
	.cue.teal { --cc: var(--cc-teal); --ci: var(--cue-teal); }
	.cue.clay { --cc: var(--cc-clay); --ci: var(--cue-clay); }
	.cue.ideas.lit { color: var(--ci); background: color-mix(in srgb, var(--cc) 20%, #fff); box-shadow: inset 0 -2px 0 var(--cc); }
	.cue.prose.lit { color: var(--ci); background: transparent; box-shadow: inset 0 0 0 1.5px var(--cc); }
	.cue.dim { opacity: .38; }
	/* a step lights its story cues in reading order */
	.story .cue.lit { transition-delay: calc(var(--k, 0) * .07s); }
	.stage[data-view] .cue[tabindex="0"] { cursor: pointer; }
	.stage[data-view] .cue[tabindex="0"]:hover { opacity: 1; }

	/* kind marks: ideas a filled disc with a bulb, prose a hollow ring with a pen */
	.kind { display: inline-grid; place-items: center; flex: none; width: 1.6em; height: 1.6em; border-radius: 50%; font-size: 12px; }
	.kind.ideas { background: var(--ink); color: #fff; }
	.kind.prose { box-shadow: inset 0 0 0 1.5px var(--ink); color: var(--ink); }

	.panel { display: grid; gap: 10px; }
	.by { display: flex; align-items: baseline; gap: 7px; font-size: 13px; line-height: 1.45; color: var(--ink2); }
	.by :global(.fable) { color: var(--f-strong); align-self: center; }
	.say-n { display: flex; gap: 5px; }
	.say-n i { width: 18px; height: 3px; border-radius: 2px; background: var(--rule); transition: background-color .3s; }
	.say-n i.on { background: var(--ink); }
	.verdicts, .after { display: grid; gap: 10px; }
	.verdict { background: var(--field); border-radius: 3px; padding: 14px 16px; transition: opacity .4s, transform .4s var(--ease); }
	.verdict.dim { opacity: .4; }
	.verdict.wait { opacity: 0; transform: translateY(10px); visibility: hidden; }
	.v-head { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 10px; font-size: 15px; }
	.v-l { color: var(--ink2); font-weight: 500; }
	.v-v { display: inline-flex; align-items: center; gap: 4px; font-size: 22px; font-weight: 600; letter-spacing: -0.02em; }
	.v-v :global(.ok) { color: var(--ok); }
	.v-s { font-size: 13px; color: var(--ink2); }
	.v-x { margin-top: 8px; font-size: 15px; line-height: 1.6; color: var(--ink); }
	.truth { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: #fff; border-radius: 3px; font-size: 16px; font-weight: 600; line-height: 1.35; letter-spacing: -0.01em; opacity: 0; transform: translateY(8px); transition: opacity .4s, transform .4s var(--ease); }
	.truth.on { opacity: 1; transform: none; }
	.pair { display: inline-flex; align-items: center; gap: 4px; flex: none; font-size: 15px; }
	.pair .kind.prose { margin-left: 6px; }

	.seg { display: inline-flex; justify-self: start; background: var(--chip); border-radius: 3px; padding: 3px; }
	.seg button { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; font-size: 13px; font-weight: 500; color: var(--ink2); border-radius: 2px; transition: background-color .15s, color .15s; }
	.seg button:hover { color: var(--ink); }
	.seg button[aria-pressed="true"] { background: var(--ink); color: var(--field); }
	.seg .kind { font-size: 10px; }
	.seg button[aria-pressed="true"] .kind.ideas { background: var(--field); color: var(--ink); }
	.seg button[aria-pressed="true"] .kind.prose { box-shadow: inset 0 0 0 1.5px var(--field); color: var(--field); }

	/* the four cases */
	.cases { margin-top: 28px; border-top: 1px solid var(--rule); border-bottom: 1px solid var(--rule); interpolate-size: allow-keywords; }
	.cases summary { list-style: none; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 2px; cursor: pointer; }
	.cases summary::-webkit-details-marker { display: none; }
	.sum-t { font-size: 15px; line-height: 1.5; color: var(--ink); max-width: 44rem; }
	.sum-k { flex: none; display: inline-flex; align-items: center; gap: 10px; padding: 6px 12px; border: 1.25px solid var(--ink); border-radius: 2px; font-size: 13px; font-weight: 500; transition: background-color .15s, color .15s; }
	.cases summary:hover .sum-k { background: var(--ink); color: var(--field); }
	.chev { width: 7px; height: 7px; border-right: 1.5px solid currentColor; border-bottom: 1.5px solid currentColor; transform: translateY(-2px) rotate(45deg); transition: transform .25s var(--ease); }
	.cases[open] .chev { transform: translateY(2px) rotate(-135deg); }
	.cases::details-content { block-size: 0; overflow: clip; transition: block-size .4s var(--ease), content-visibility .4s allow-discrete; }
	.cases[open]::details-content { block-size: auto; }
	.grid { display: grid; grid-template-columns: auto auto minmax(0, 1fr) minmax(0, 1fr); grid-template-rows: auto auto auto auto; gap: 8px; padding: 6px 0 20px; }
	.ax { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; }
	.ax-i { grid-column: 3 / 5; grid-row: 1; justify-self: center; }
	.ax-p { grid-column: 1; grid-row: 3 / 5; writing-mode: vertical-rl; transform: rotate(180deg); align-self: center; }
	.ax-p .kind { transform: rotate(90deg); }
	.hd { display: inline-flex; align-items: center; gap: 5px; font-size: 12.5px; color: var(--ink2); }
	.c-h1, .c-h2 { grid-row: 2; justify-self: center; }
	.c-h1 { grid-column: 3; } .c-h2 { grid-column: 4; }
	.r-h1, .r-h2 { grid-column: 2; align-self: center; padding-right: 4px; }
	.r-h1 { grid-row: 3; } .r-h2 { grid-row: 4; }
	.case { grid-column: var(--col); grid-row: var(--row); display: grid; align-content: start; gap: 6px; padding: 12px 14px; background: var(--field); border-radius: 3px; border: 1.5px solid transparent; }
	.case.ex { background: #fff; border-color: var(--ink); }
	.who { display: flex; align-items: center; gap: 4px; font-size: 15px; }
	.who .kind { font-size: 10.5px; }
	.who .kind.prose { margin-left: 8px; }
	.case-t { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 8px; font-size: 14.5px; font-weight: 600; line-height: 1.3; }
	.this { padding: 1px 6px; border-radius: 2px; background: var(--ink); color: var(--field); font-size: 11px; font-weight: 600; }
	.case-d { font-size: 14px; line-height: 1.5; color: var(--ink2); }

	/* Claude Fable 5.2 showcase: the full content width, in Fable's clay */
	.verdict { position: relative; }
	.v-print { position: absolute; top: 10px; right: 12px; opacity: .9; pointer-events: none; }
	.f-print { position: absolute; right: 18px; top: 50%; transform: translateY(-50%); opacity: .2; pointer-events: none; }
	.showcase > :not(.f-print) { position: relative; }
	.showcase { position: relative; overflow: hidden; margin-top: 28px; display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); gap: 22px 48px; padding: 26px 30px 22px; background: var(--f-tint); border-radius: 3px; border-top: 3px solid var(--f-strong); }
	.f-head { grid-column: 1 / -1; }
	.f-kick { font-size: 11px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--f-ink); }
	.f-head h3 { margin: 4px 0 0; display: flex; align-items: center; gap: 10px; font-size: clamp(24px, 2.6vw, 32px); line-height: 1.1; font-weight: 600; letter-spacing: -0.025em; color: var(--f-ink); }
	.f-head h3 :global(.ic) { color: var(--f-strong); }
	.f-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; align-content: start; }
	.f-stats li { display: grid; gap: 8px; align-content: start; }
	.f-big { font-size: clamp(38px, 4.6vw, 56px); font-weight: 600; line-height: 1; letter-spacing: -0.04em; color: var(--f-strong); font-variant-numeric: tabular-nums; }
	.f-meter { position: relative; height: 10px; border-radius: 1px; background: rgba(180, 80, 28, .14); }
	.f-meter i { position: absolute; inset: 0 auto 0 0; width: calc(var(--v) * 100%); border-radius: 1px; background: var(--f-strong); }
	.f-stats li.prose .f-meter i { background: transparent; box-shadow: inset 0 0 0 2px var(--f-strong); }
	.f-stats li.both .f-meter i { background: var(--f-ink); }
	.f-t { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; font-size: 14px; font-weight: 500; line-height: 1.3; color: var(--ink); }
	.f-t .kind { font-size: 10.5px; }
	.f-climb { margin: 0; display: grid; gap: 10px; align-content: start; }
	.f-climb figcaption { font-size: 15px; font-weight: 600; letter-spacing: -0.01em; }
	.f-climb ol { display: grid; gap: 8px; }
	.f-climb li { display: grid; grid-template-columns: 11.5rem minmax(0, 1fr) 2.8rem; align-items: center; gap: 10px; font-size: 13.5px; }
	.cl-who { white-space: nowrap; }
	.f-climb .cl-who { display: inline-flex; align-items: center; gap: 6px; }
	.f-climb .cl-who :global(.ic) { color: var(--c); }
	.f-climb .cl-who b { font-weight: 500; }
	.f-climb .cl-who em { font-style: normal; color: var(--ink2); }
	.bar { position: relative; height: 14px; background: rgba(20, 32, 45, .07); border-radius: 1px; }
	.bar i { position: absolute; inset: 0 auto 0 0; width: calc(var(--v) * 100%); background: var(--c); border-radius: 1px; }
	.cv { font-weight: 600; font-variant-numeric: tabular-nums; text-align: right; }
	.f-climb li.mine .cl-who b, .f-climb li.mine .cv { color: var(--f-ink); font-weight: 600; }
	.f-lead { margin-top: 8px; max-width: 64rem; font-size: 15px; line-height: 1.5; color: var(--ink); }

	@media (max-width: 860px) {
		.stage { grid-template-columns: minmax(0, 1fr); gap: 10px; }
		.story { font-size: 17px; line-height: 2.62; padding: 30px 16px 12px; }
		.panel { gap: 8px; }
		.by { font-size: 12.5px; }
		.verdict { padding: 10px 12px; }
		.verdict.wait { display: none; }
		.verdict.dim .v-x { display: none; }
		.v-v { font-size: 19px; }
		.v-x { margin-top: 6px; font-size: 14px; line-height: 1.5; }
		.truth { padding: 10px 12px; font-size: 14.5px; }
		.grid { grid-template-columns: minmax(0, 1fr); grid-template-rows: none; }
		.ax, .hd { display: none; }
		.case { grid-column: auto; grid-row: auto; }
		.showcase { grid-template-columns: minmax(0, 1fr); padding: 20px 16px 16px; gap: 18px; }
		.f-stats { gap: 10px; }
		.f-t { font-size: 12.5px; }
		.f-climb li { grid-template-columns: 10.6rem minmax(0, 1fr) 2.6rem; gap: 8px; font-size: 12.5px; }
	}
	@media (max-width: 480px) {
		.sum-t { font-size: 14px; }
		.f-big { font-size: 34px; }
	}
	.still .stage, .still .cue, .still .verdict, .still .truth, .still .say-n i, .still .chev { transition: none !important; }
	.still .cases::details-content { transition: none; }
	@media (prefers-reduced-motion: reduce) {
		.stage, .cue, .verdict, .truth, .say-n i, .chev, .seg button { transition: none !important; }
		.cases::details-content { transition: none; }
	}
</style>
