<script lang="ts">
	// Section 1, restructured (a composition mock, ?mock=s1). Same paper text and data as HumanOrAI.svelte (s1.json); a
	// different blocking, so this section stops looking like every other one (card on the left, picture on the right):
	//   1. an opener: a full-bleed dark band, the chapter number and question set very large, the two prints
	//      (ideas, prose) it is about: the page's first real dark mass;
	//   2. a manuscript: the story set large and centred like a book page, pinned while the reader scrolls; the two
	//      verdicts are margin notes in the gutters, ideas on the left and prose on the right, with leader lines to the
	//      words they cite; they light one at a time, then together with the conclusion under the story;
	//   3. a showcase: Claude Fable 5.2's three numbers as giant numerals across the full width, its print behind.
	// DOM only (no canvas); the step comes from a passive scroll listener; the leaders are measured only when the step
	// or the size changes.
	import { onMount } from "svelte";
	import Icon from "./Icon.svelte";
	import PrintMark from "./PrintMark.svelte";
	import { FABLE, KIND, LAB } from "./palette";
	import S from "./s1.json";

	type Kind = "ideas" | "prose";
	const E = S.example;
	const CUE: Record<string, string> = { rose: LAB.Anthropic, teal: LAB.OpenAI, clay: FABLE.strong };
	const kindOf: Record<string, Kind> = Object.fromEntries(E.judgments.flatMap((j) => j.cues.map((c) => [c, j.id as Kind])));
	const J = Object.fromEntries(E.judgments.map((j) => [j.id, j])) as Record<Kind, (typeof E.judgments)[number]>;
	const STEPS = ["read", "ideas", "prose", "both"] as const;
	const STEP_VH = 0.62;

	let step = $state(STEPS.length - 1); // settled until mounted
	let ms: HTMLElement, pin: HTMLElement, page: HTMLElement;
	let notes: Record<Kind, HTMLElement> = $state({} as Record<Kind, HTMLElement>);
	let leaders = $state<{ id: string; d: string; color: string; kind: Kind }[]>([]);
	let wide = $state(true);

	const view = $derived(STEPS[step]);
	const lit = (c: string) => view === "both" || kindOf[c] === view;
	const noteOn = (k: Kind) => view === "both" || view === k;
	const noteSeen = (k: Kind) => STEPS.indexOf(view) >= STEPS.indexOf(k);

	function measure() {
		wide = innerWidth >= 980;
		if (!wide || !pin) { leaders = []; return; }
		const P = pin.getBoundingClientRect();
		const out: typeof leaders = [];
		for (const el of page.querySelectorAll<HTMLElement>(".cue")) {
			const c = el.dataset.cue!, k = kindOf[c], n = notes[k];
			if (!n) continue;
			const rs = el.getClientRects(), r = k === "ideas" ? rs[0] : rs[rs.length - 1], nr = n.getBoundingClientRect();
			// from the note's inner edge to the cited words: a soft horizontal S
			const x0 = k === "ideas" ? nr.right - P.left : nr.left - P.left, y0 = nr.top - P.top + 28;
			const x1 = k === "ideas" ? r.left - P.left - 4 : r.right - P.left + 4, y1 = r.top - P.top + r.height / 2;
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
	<!-- 1. the opener: dark, full bleed, the question at chapter size -->
	<header class="opener">
		<div class="o-text">
			<p class="o-n">{S.n}</p>
			<h2 class="o-q">{S.title}</h2>
			<p class="o-t">{S.takeaway.t}</p>
			<p class="o-d">{S.context[0].t}</p>
		</div>
		<div class="o-prints" aria-hidden="true">
			<figure class="o-p ideas">
				<PrintMark family="ai" color="#9A82B4" px={wide ? 300 : 170} text />
				<figcaption><Icon name={KIND.ideas.icon} />{KIND.ideas.label}</figcaption>
			</figure>
			<figure class="o-p prose">
				<PrintMark family="human" color="#DC89A7" px={wide ? 300 : 170} text />
				<figcaption><Icon name={KIND.prose.icon} />{KIND.prose.label}</figcaption>
			</figure>
		</div>
	</header>

	<!-- 2. the manuscript: the story as the page, the verdicts in the margins -->
	<div class="ms" bind:this={ms} style="--steps:{STEPS.length}">
		<div class="pin" bind:this={pin}>
			<aside class="note ideas" class:on={noteOn("ideas")} class:seen={noteSeen("ideas")} bind:this={notes.ideas}>
				<p class="n-k"><span class="kind fill"><Icon name="bulb" /></span>{J.ideas.label}</p>
				<p class="n-v"><Icon name="check" />{J.ideas.verdict}<span>{J.ideas.share}</span></p>
				<p class="n-x">“{#each J.ideas.explanation as seg}{#if seg.cue}<span class="ref" style:--c={CUE[seg.cue]}>{seg.t}</span>{:else}{seg.t}{/if}{/each}”</p>
			</aside>

			<div class="page" bind:this={page}>
				<p class="p-cap"><Icon name="anthropic" />{E.caption.t}</p>
				<blockquote class="story">“{#each E.text as seg}{#if seg.cue}<span class="cue {kindOf[seg.cue]}" data-cue={seg.cue} class:lit={lit(seg.cue)} style:--c={CUE[seg.cue]}>{seg.t}</span>{:else}{seg.t}{/if}{/each}”</blockquote>
				<p class="concl" class:on={view === "both"}>
					<span class="pair"><span class="kind fill"><Icon name="bulb" /></span><Icon name="ai" /><span class="kind"><Icon name="pen" /></span><Icon name="human" /></span>
					{E.source}.
				</p>
			</div>

			<aside class="note prose" class:on={noteOn("prose")} class:seen={noteSeen("prose")} bind:this={notes.prose}>
				<p class="n-k"><span class="kind"><Icon name="pen" /></span>{J.prose.label}</p>
				<p class="n-v"><Icon name="check" />{J.prose.verdict}<span>{J.prose.share}</span></p>
				<p class="n-x">“{#each J.prose.explanation as seg}{#if seg.cue}<span class="ref hollow" style:--c={CUE[seg.cue]}>{seg.t}</span>{:else}{seg.t}{/if}{/each}”</p>
			</aside>

			{#if wide}
				<svg class="leaders" aria-hidden="true">
					{#each leaders as l (l.id)}
						<path d={l.d} stroke={l.color} class:on={noteOn(l.kind)} />
					{/each}
				</svg>
			{/if}
			<p class="dots" aria-hidden="true">{#each STEPS as _, i}<i class:on={step === i}></i>{/each}</p>
		</div>
	</div>

	<!-- the four cases, on request -->
	<details class="cases">
		<summary>{S.cases_intro.t} <span class="sum-b">{S.ui[6]}</span></summary>
		<ul>
			{#each S.cases as c}
				<li class:this={c.example}>
					<b>{c.t}</b><span>{c.def}</span>
					{#if c.example}<em>{S.ui[7]}</em>{/if}
				</li>
			{/each}
		</ul>
	</details>

	<!-- 3. the showcase: one model, three numbers, as large as the page allows -->
	<aside class="sc" aria-labelledby="hb-fable">
		<div class="sc-print" aria-hidden="true"><PrintMark family="lab" index={0} color={FABLE.strong} px={wide ? 520 : 300} text /></div>
		<p class="sc-k">{S.ui[8]}</p>
		<h3 id="hb-fable"><Icon name="anthropic" />{S.stats_model}</h3>
		<div class="sc-nums">
			{#each S.stats as st}
				<div class="num">
					<b>{st.v}%</b>
					<span>{#if st.kind !== "both"}<Icon name={st.kind === "ideas" ? "bulb" : "pen"} />{/if}{st.t}</span>
				</div>
			{/each}
		</div>
		<p class="sc-d">{S.detectors.t}</p>
		<div class="climb" aria-label={S.climb_label.t}>
			<p class="cl-k">{S.climb_label.t}</p>
			<div class="cl-track">
				{#each S.climb as c}
					<span class="cl-pt" class:fable={c.lab === "Anthropic"} style:left="{c.v}%"><b>{c.v}%</b><i></i><em>{c.t}<br />{c.year}</em></span>
				{/each}
			</div>
		</div>
	</aside>
</section>

<style>
	.hb { --f: #B4501C; position: relative; }
	/* 1. opener */
	.opener {
		width: 100vw; margin-left: calc(50% - 50vw); min-height: 92vh; padding: 12vh max(16px, calc(50vw - 36rem)) 10vh;
		background: #14202D; color: #F3F3EF; display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); align-items: center; gap: 4vw;
	}
	.o-n { font-size: clamp(64px, 9vw, 140px); line-height: .8; font-weight: 600; letter-spacing: -0.05em; color: #C85A82; }
	.o-q { margin-top: 18px; font-size: clamp(48px, 7.4vw, 112px); line-height: .95; font-weight: 600; letter-spacing: -0.045em; color: #fff; }
	.o-t { margin-top: 28px; max-width: 22ch; font-size: clamp(22px, 2.3vw, 32px); line-height: 1.2; font-weight: 500; letter-spacing: -0.02em; color: #F3F3EF; text-wrap: balance; }
	.o-d { margin-top: 18px; max-width: 46ch; font-size: 16px; line-height: 1.55; color: rgba(243, 243, 239, .62); }
	.o-prints { display: flex; justify-content: center; align-items: center; gap: 2vw; }
	.o-p { display: grid; justify-items: center; gap: 14px; margin: 0; }
	.o-p.prose { margin-top: 18vh; }
	.o-p figcaption { display: inline-flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 600; letter-spacing: .02em; color: #F3F3EF; }
	.o-p.ideas figcaption :global(svg) { color: #9A82B4; } .o-p.prose figcaption :global(svg) { color: #DC89A7; }

	/* 2. manuscript */
	.ms { position: relative; height: calc((var(--steps) + 0.5) * 62vh + 100vh); }
	.pin { position: sticky; top: 0; height: 100vh; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 38rem) minmax(0, 1fr); grid-template-rows: 1fr; align-items: center; align-content: center; gap: 48px; }
	.page { grid-column: 2; display: grid; gap: 22px; }
	.p-cap { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: var(--ink2); }
	.p-cap :global(svg) { color: var(--f); }
	.story { margin: 0; font-size: clamp(24px, 2.4vw, 34px); line-height: 1.55; letter-spacing: -0.012em; color: var(--ink); }
	.cue { padding: 0 2px; border-radius: 2px; transition: background-color .45s, color .45s, box-shadow .45s; box-shadow: inset 0 -2px 0 rgba(20, 32, 45, .14); }
	.cue.lit.ideas { background: color-mix(in srgb, var(--c) 24%, transparent); box-shadow: inset 0 -2.5px 0 var(--c); }
	.cue.lit.prose { box-shadow: inset 0 0 0 2px var(--c); }
	.concl { display: flex; align-items: center; gap: 14px; font-size: clamp(18px, 1.6vw, 22px); font-weight: 600; letter-spacing: -0.015em; color: var(--ink); opacity: 0; transform: translateY(8px); transition: opacity .5s, transform .5s; }
	.concl.on { opacity: 1; transform: none; }
	.pair { display: inline-flex; align-items: center; gap: 4px; font-size: 18px; }
	.note { display: grid; gap: 8px; align-self: center; padding: 18px 0; opacity: .14; transform: translateY(10px); transition: opacity .5s, transform .5s; }
	.note.seen { opacity: .38; transform: none; }
	.note.on { opacity: 1; }
	.note.ideas { grid-column: 1; text-align: right; justify-items: end; }
	.note.prose { grid-column: 3; }
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
	.dots { position: absolute; left: 50%; bottom: 7vh; transform: translateX(-50%); display: flex; gap: 6px; }
	.dots i { width: 22px; height: 3px; border-radius: 2px; background: var(--rule, #c9c9c9); transition: background-color .3s; }
	.dots i.on { background: var(--ink); }

	/* the four cases */
	.cases { max-width: 72rem; margin: 0 auto; border-top: 1px solid var(--rule, #c9c9c9); border-bottom: 1px solid var(--rule, #c9c9c9); }
	.cases summary { display: flex; justify-content: space-between; align-items: center; gap: 24px; padding: 18px 0; cursor: pointer; font-size: 15px; color: var(--ink2); list-style: none; }
	.cases summary::-webkit-details-marker { display: none; }
	.sum-b { flex: none; padding: 6px 12px; border: 1px solid var(--ink); border-radius: 3px; color: var(--ink); font-weight: 500; }
	.cases ul { list-style: none; margin: 0 0 22px; padding: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
	.cases li { display: grid; gap: 4px; padding: 14px 16px; background: var(--field); border-radius: 3px; font-size: 14px; color: var(--ink2); }
	.cases li b { color: var(--ink); font-size: 16px; }
	.cases li.this { outline: 2px solid var(--ink); }
	.cases li em { font-style: normal; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; color: var(--ink); }

	/* 3. showcase */
	.sc { position: relative; overflow: hidden; margin: 14vh 0 0; padding: 8vh 0 6vh; border-top: 4px solid var(--f); }
	.sc > :not(.sc-print) { position: relative; }
	.sc-print { position: absolute; right: -4%; top: 50%; transform: translateY(-50%); opacity: .14; pointer-events: none; }
	.sc-k { font-size: 12px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: var(--f); }
	.sc h3 { margin-top: 10px; display: inline-flex; align-items: center; gap: 12px; font-size: clamp(30px, 3.4vw, 46px); font-weight: 600; letter-spacing: -0.03em; color: #7A3410; }
	.sc-nums { margin-top: 5vh; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 2vw; }
	.num { display: grid; gap: 10px; border-top: 1.5px solid #7A3410; padding-top: 12px; }
	.num b { font-size: clamp(80px, 13vw, 200px); line-height: .82; font-weight: 600; letter-spacing: -0.06em; color: var(--f); font-variant-numeric: tabular-nums; }
	.num span { display: inline-flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 500; color: var(--ink); }
	.sc-d { margin-top: 5vh; max-width: 48ch; font-size: 18px; line-height: 1.5; color: var(--ink2); }
	.climb { margin-top: 5vh; max-width: 46rem; }
	.cl-k { font-size: 12px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--ink2); }
	.cl-track { position: relative; height: 92px; margin-top: 42px; border-top: 1.5px solid var(--ink2); }
	.cl-pt { position: absolute; top: 0; transform: translateX(-50%); display: grid; justify-items: center; }
	.cl-pt b { position: absolute; bottom: calc(100% + 8px); font-size: 22px; font-weight: 600; color: var(--ink); }
	.cl-pt i { width: 12px; height: 12px; margin-top: -6.5px; border-radius: 50%; background: var(--ink2); }
	.cl-pt.fable b { color: var(--f); font-size: 30px; } .cl-pt.fable i { background: var(--f); width: 16px; height: 16px; margin-top: -8.5px; }
	.cl-pt em { margin-top: 8px; font-style: normal; font-size: 12.5px; line-height: 1.3; text-align: center; color: var(--ink2); white-space: nowrap; }

	@media (max-width: 979px) {
		.opener { grid-template-columns: 1fr; min-height: 0; padding-top: 10vh; gap: 8vh; }
		.o-p.prose { margin-top: 10vh; }
		.ms { height: auto; }
		.pin { position: static; height: auto; grid-template-columns: 1fr; gap: 24px; padding: 8vh 0; }
		.page, .note.ideas, .note.prose { grid-column: 1; }
		.page { order: -1; }
		.note, .note.ideas { opacity: 1; transform: none; text-align: left; justify-items: start; }
		.concl { opacity: 1; transform: none; }
		.cue.ideas { background: color-mix(in srgb, var(--c) 24%, transparent); box-shadow: inset 0 -2.5px 0 var(--c); }
		.cue.prose { box-shadow: inset 0 0 0 2px var(--c); }
		.dots { display: none; }
		.cases ul { grid-template-columns: 1fr; }
		.sc-nums { grid-template-columns: 1fr; gap: 28px; }
	}
	@media (prefers-reduced-motion: reduce) { .cue, .note, .concl, .leaders path { transition: none; } }
</style>
