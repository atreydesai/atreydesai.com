<script lang="ts">
	// Section 1, restructured (a composition mock, ?mock=s1). Same paper text and data as HumanOrAI.svelte (s1.json); a
	// different blocking, so this section stops looking like every other one (card on the left, picture on the right):
	//   1. an opener: a full-bleed dark band, the chapter number and question set very large, the two prints
	//      (ideas, prose) it is about: the page's first real dark mass;
	//   2. a manuscript: the story set large and centred like a book page, pinned while the reader scrolls; the two
	//      verdicts are margin notes in the gutters, ideas on the left and prose on the right, with leader lines to the
	//      words they cite; they light one at a time, then together with the conclusion under the story;
	//   3. a showcase: Claude Fable 5.2's three numbers as giant numerals across the full width (no box, no extras).
	// DOM only (no canvas); the step comes from a passive scroll listener; the leaders are measured only when the step
	// or the size changes. Reveal order: the opener's headline, then the story's steps (prose first, then ideas).
	import { onMount } from "svelte";
	import Icon from "./Icon.svelte";
	import SectionOpener from "./SectionOpener.svelte";
	import StepDashes from "./StepDashes.svelte";
	import Footnotes from "./Footnotes.svelte";
	import { FABLE, KIND, LAB } from "./palette";
	import S from "./s1.json";

	type Kind = "ideas" | "prose";
	const E = S.example;
	const CUE: Record<string, string> = { rose: LAB.Anthropic, teal: LAB.OpenAI, clay: FABLE.strong };
	const kindOf: Record<string, Kind> = Object.fromEntries(E.judgments.flatMap((j) => j.cues.map((c) => [c, j.id as Kind])));
	const J = Object.fromEntries(E.judgments.map((j) => [j.id, j])) as Record<Kind, (typeof E.judgments)[number]>;
	const STEPS = ["read", "prose", "ideas", "both"] as const; // prose first, as the takeaway reads ("AI prose and ideas")
	const STEP_VH = 0.92; // scroll per step: an ordinary scroll never skips one

	let step = $state(STEPS.length - 1); // settled until mounted
	let ms: HTMLElement, pin: HTMLElement, page: HTMLElement;
	let notes: Record<Kind, HTMLElement> = $state({} as Record<Kind, HTMLElement>);
	let leaders = $state<{ id: string; d: string; color: string; kind: Kind }[]>([]);
	let wide = $state(true);

	const view = $derived(STEPS[step]);
	// a dash click scrolls to that step's place in the pinned story
	function go(i: number) {
		const top = ms.getBoundingClientRect().top + scrollY;
		scrollTo({ top: top + (i + 0.4) * innerHeight * STEP_VH - innerHeight * 0.5, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
	}
	const NOTES = [{ n: 1, t: "The example is the paper's first table entry: a story whose ideas came from a model and whose prose a person wrote." }];
	const lit = (c: string) => view === "both" || kindOf[c] === view;
	const noteOn = (k: Kind) => view === "both" || view === k;
	const noteSeen = (k: Kind) => STEPS.indexOf(view) >= STEPS.indexOf(k);

	function measure() {
		wide = innerWidth >= 980;
		if (!wide || !pin) { leaders = []; return; }
		const P = pin.getBoundingClientRect();
		const out: typeof leaders = [];
		const pg = page.querySelector(".story")!.getBoundingClientRect();
		for (const el of page.querySelectorAll<HTMLElement>(".cue")) {
			const c = el.dataset.cue!, k = kindOf[c], n = notes[k];
			if (!n) continue;
			// the cue's first line: the leader ends in the margin beside it (left notes on the left, right on the right)
			const r = el.getClientRects()[0], nr = n.getBoundingClientRect(), left = nr.right < pg.left;
			const x0 = left ? nr.right - P.left : nr.left - P.left, y0 = nr.top - P.top + 28;
			const x1 = left ? pg.left - P.left - 10 : pg.right - P.left + 10, y1 = r.top - P.top + r.height / 2;
			const mx = (x0 + x1) / 2;
			out.push({ id: c, d: `M${x0},${y0} C${mx},${y0} ${mx},${y1} ${x1},${y1}`, color: CUE[c], kind: k });
		}
		leaders = out;
	}

	onMount(() => {
		const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
		const update = () => {
			const r = ms.getBoundingClientRect();
			if (r.bottom < -innerHeight || r.top > innerHeight * 2) return;
			const p = (innerHeight * 0.5 - r.top) / (innerHeight * STEP_VH);
			const s = Math.max(0, Math.min(STEPS.length - 1, Math.floor(p)));
			if (s !== step) step = s;
		};
		step = 0;
		update();
		addEventListener("scroll", update, { passive: true });
		addEventListener("resize", measure, { passive: true });
		document.fonts?.ready.then(measure);
		void reduce;
		return () => { removeEventListener("scroll", update); removeEventListener("resize", measure); };
	});
	// re-measure when the step changes (the notes and cues change size as they light)
	$effect(() => { void step; requestAnimationFrame(measure); });
</script>

<section class="hb" id={S.id} data-rq={S.rq}>
	<!-- 1. the opener: dark, full bleed, the question at chapter size (shared SectionOpener) -->
	<SectionOpener n={S.n} title={S.title} takeaway={S.takeaway.t} context={S.context[0].t} accent="#C85A82" marks={["its author decided to say", "words used to say it"]}
		prints={[{ family: "human", color: "#DC89A7", label: KIND.prose.label, icon: KIND.prose.icon }, { family: "ai", color: "#9A82B4", label: KIND.ideas.label, icon: KIND.ideas.icon }]} />

	<!-- 2. the manuscript: the story as the page, the verdicts in the margins -->
	<div class="ms" bind:this={ms} style="--steps:{STEPS.length}">
		<div class="pin" bind:this={pin}>
			<aside class="note left prose" class:on={noteOn("prose")} class:seen={noteSeen("prose")} bind:this={notes.prose}>
				<p class="n-k"><span class="kind"><Icon name="pen" /></span>{J.prose.label}</p>
				<p class="n-v"><Icon name="check" />{J.prose.verdict}</p>
				<p class="n-x">“{#each J.prose.explanation as seg}{#if seg.cue}<span class="ref" style:--c={CUE[seg.cue]}>{seg.t}</span>{:else}{seg.t}{/if}{/each}”</p>
			</aside>
			<!-- __IDEAS_PLACEHOLDER__
-->

			<div class="page" bind:this={page}>
				<StepDashes count={STEPS.length} current={step} {go} />
				<p class="p-cap"><Icon name="anthropic" />{E.caption.t}<sup class="fnref"><a href="#fn-s1-1" id="fnref-s1-1">1</a></sup></p>
				<blockquote class="story">“{#each E.text as seg}{#if seg.cue}<span class="cue {kindOf[seg.cue]}" data-cue={seg.cue} class:lit={lit(seg.cue)} style:--c={CUE[seg.cue]}>{seg.t}</span>{:else}{seg.t}{/if}{/each}”</blockquote>
				<p class="concl" class:on={view === "both"}>
					<span class="pair"><span class="kind fill"><Icon name="bulb" /></span><Icon name="ai" /><span class="kind"><Icon name="pen" /></span><Icon name="human" /></span>
					{E.source}.
				</p>
			</div>

			<aside class="note right ideas" class:on={noteOn("ideas")} class:seen={noteSeen("ideas")} bind:this={notes.ideas}>
				<p class="n-k"><span class="kind fill"><Icon name="bulb" /></span>{J.ideas.label}</p>
				<p class="n-v"><Icon name="check" />{J.ideas.verdict}</p>
				<p class="n-x">“{#each J.ideas.explanation as seg}{#if seg.cue}<span class="ref" style:--c={CUE[seg.cue]}>{seg.t}</span>{:else}{seg.t}{/if}{/each}”</p>
			</aside>

			{#if wide}
				<svg class="leaders" aria-hidden="true">
					{#each leaders as l (l.id)}
						<path d={l.d} stroke={l.color} class:on={noteOn(l.kind)} />
					{/each}
				</svg>
			{/if}
		</div>
	</div>

	<!-- 3. the showcase: one model, three numbers, as large as the page allows -->
	<aside class="sc" aria-labelledby="hb-fable">
		<h3 id="hb-fable"><Icon name="anthropic" />{S.stats_model}</h3>
		<div class="sc-nums">
			{#each [...S.stats].sort((a, b) => ["prose", "ideas", "both"].indexOf(a.kind) - ["prose", "ideas", "both"].indexOf(b.kind)) as st}
				<div class="num">
					<b>{st.v}%</b>
					<span>{#if st.kind !== "both"}<Icon name={st.kind === "ideas" ? "bulb" : "pen"} />{/if}{st.t}</span>
				</div>
			{/each}
		</div>
		<p class="sc-d">{S.detectors.t}</p>
	</aside>

	<Footnotes id="s1" notes={NOTES} />
</section>

<style>
	.hb { --f: #B4501C; position: relative; }

	/* 2. manuscript */
	.ms { position: relative; height: calc((var(--steps) + 0.5) * 62vh + 100vh); }
	.pin { position: sticky; top: 0; height: 100vh; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 38rem) minmax(0, 1fr); grid-template-rows: 1fr; align-items: center; align-content: center; gap: 48px; }
	.page { grid-column: 2; display: grid; gap: 22px; }
	.p-cap { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: var(--ink2); }
	.p-cap :global(svg) { color: var(--f); }
	.story { margin: 0; font-size: clamp(24px, 2.4vw, 34px); line-height: 1.55; letter-spacing: -0.012em; color: var(--ink); }
	.cue { padding: 0 2px; border-radius: 2px; transition: background-color .45s, color .45s, box-shadow .45s; box-shadow: inset 0 -2px 0 rgba(20, 32, 45, .14); }
	.cue.lit.ideas { background: color-mix(in srgb, var(--c) 24%, transparent); box-shadow: inset 0 -2.5px 0 var(--c); }
	.cue.lit.prose { background: color-mix(in srgb, var(--c) 24%, transparent); box-shadow: inset 0 -2.5px 0 var(--c); }
	.concl { display: flex; align-items: center; gap: 14px; font-size: clamp(18px, 1.6vw, 22px); font-weight: 600; letter-spacing: -0.015em; color: var(--ink); opacity: 0; transform: translateY(8px); transition: opacity .5s, transform .5s; }
	.concl.on { opacity: 1; transform: none; }
	.pair { display: inline-flex; align-items: center; gap: 4px; font-size: 18px; }
	.note { display: grid; gap: 8px; align-self: center; padding: 18px 0; opacity: .14; transform: translateY(10px); transition: opacity .5s, transform .5s; }
	.note.seen { opacity: .38; transform: none; }
	.note.on { opacity: 1; }
	.note.left { grid-column: 1; text-align: right; justify-items: end; }
	.note.right { grid-column: 3; }
	.n-k { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--ink2); }
	.n-v { display: inline-flex; align-items: baseline; gap: 8px; font-size: clamp(30px, 3vw, 44px); line-height: 1; font-weight: 600; letter-spacing: -0.03em; color: var(--ink); }
	.n-v :global(svg) { width: .6em; height: .6em; color: #046B55; align-self: center; }
	.n-v span { font-size: 14px; font-weight: 500; letter-spacing: 0; color: var(--ink2); }
	.n-x { max-width: 30ch; font-size: 14.5px; line-height: 1.5; color: var(--ink2); }
	.ref { color: var(--ink); background: color-mix(in srgb, var(--c) 22%, transparent); padding: 0 2px; border-radius: 2px; }
	.ref.hollow { background: none; box-shadow: inset 0 0 0 1.5px var(--c); }
	.kind { display: inline-grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; border: 1.5px solid var(--ink); color: var(--ink); font-size: 12px; }
	.kind.fill { background: var(--ink); color: #fff; }
	.leaders { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; overflow: visible; }
	.leaders path { fill: none; stroke-width: 1.4; opacity: 0; transition: opacity .5s; }
	.leaders path.on { opacity: .9; }


	/* 3. showcase */
	.sc { position: relative; margin: 14vh 0 0; padding: 4vh 0 6vh; }
	.sc h3 { margin-top: 10px; display: inline-flex; align-items: center; gap: 12px; font-size: clamp(30px, 3.4vw, 46px); font-weight: 600; letter-spacing: -0.03em; color: #7A3410; }
	.sc-nums { margin-top: 5vh; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4vw; }
	.num { display: grid; gap: 10px; }
	.num b { font-size: clamp(64px, 9.5vw, 148px); line-height: .85; font-weight: 600; letter-spacing: -0.045em; color: var(--f); font-variant-numeric: tabular-nums; }
	.num span { display: inline-flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 500; color: var(--ink); }
	.sc-d { margin-top: 5vh; max-width: 48ch; font-size: 18px; line-height: 1.5; color: var(--ink2); }

	@media (max-width: 979px) {
		.ms { height: auto; }
		.pin { position: static; height: auto; grid-template-columns: 1fr; gap: 24px; padding: 8vh 0; }
		.page, .note.ideas, .note.prose { grid-column: 1; }
		.page { order: -1; }
		.note, .note.ideas { opacity: 1; transform: none; text-align: left; justify-items: start; }
		.concl { opacity: 1; transform: none; }
		.cue.ideas { background: color-mix(in srgb, var(--c) 24%, transparent); box-shadow: inset 0 -2.5px 0 var(--c); }
		.cue.prose { box-shadow: inset 0 0 0 2px var(--c); }
		.sc-nums { grid-template-columns: 1fr; gap: 28px; }
	}
	@media (prefers-reduced-motion: reduce) { .cue, .note, .concl, .leaders path { transition: none; } }
</style>
