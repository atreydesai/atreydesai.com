<script lang="ts">
	// Section 1, Human or AI? Read (question, finding, context) -> See (the paper's Claude Fable 5.2 example, a
	// TwiceTold story whose ideas came from a model and whose prose came from a person) -> Explore (the four
	// cases, Fable 5.2's accuracy, the climb over time). Cues are buttons: choosing one lights its words in the
	// story and in the explanation.
	import { onMount } from "svelte";
	import Icon from "./Icon.svelte";
	import Emblem from "./Emblem.svelte";

	let { section }: { section: any } = $props();
	const S = section;
	const E = S.example;

	let view = $state<"both" | "ideas" | "prose">("both");
	let cue = $state<string | null>(null);
	let caseIdx = $state(S.cases.findIndex((c: any) => c.example));
	// settled by default (no script, reduced motion); onMount arms the entrance, which plays once on first view
	let armed = $state(false);
	let entering = $state(false);
	let root: HTMLElement;

	const shown = (c: string) => view === "both" || E.judgments.find((j: any) => j.id === view).cues.includes(c);
	const lit = (c: string) => shown(c) && (cue === null || cue === c);
	const pick = (c: string) => (cue = cue === c ? null : c);
	// cues are inline spans (a <button> cannot wrap across lines), so they take Enter and Space themselves
	const key = (e: KeyboardEvent, c: string) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(c); } };
	const kase = $derived(S.cases[caseIdx]);

	onMount(() => {
		const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches || new URLSearchParams(location.search).has("still");
		if (reduce) return;
		const see = root.querySelector(".see")!;
		if (see.getBoundingClientRect().top < innerHeight * 0.8) return; // already on screen: leave it settled
		armed = true;
		let t: ReturnType<typeof setTimeout>;
		const io = new IntersectionObserver((es) => es.forEach((e) => {
			if (!e.isIntersecting) return;
			io.disconnect();
			entering = true;
			armed = false;
			t = setTimeout(() => (entering = false), 2400);
		}), { threshold: 0.35 });
		io.observe(see);
		return () => { io.disconnect(); clearTimeout(t); };
	});
</script>

<section class="section s1" id={S.id} data-rq={S.rq} bind:this={root}>
	<!-- read -->
	<header class="s-head"><Emblem n={1} /><span class="badge">{S.n}</span><h2>{S.title}</h2></header>
	<p class="finding">{S.takeaway.t}</p>
	<p class="context">{S.context[0].t}</p>

	<!-- see -->
	<div class="see" class:armed class:entering>
		<div class="see-bar">
			<p class="src"><Icon name="book" />{E.source}</p>
			<div class="seg" role="group" aria-label="Judgment">
				<button type="button" aria-pressed={view === "both"} onclick={() => { view = "both"; cue = null; }}>Both</button>
				{#each E.judgments as j}
					<button type="button" aria-pressed={view === j.id} onclick={() => { view = j.id; cue = null; }}><Icon name={j.icon} />{j.label}</button>
				{/each}
			</div>
		</div>
		<div class="scene">
			<blockquote class="story">
				<span class="q">“</span>{#each E.text as seg, i}{#if seg.cue}<span role="button" tabindex="0" aria-pressed={cue === seg.cue} class="cue {seg.cue}" class:lit={lit(seg.cue)} class:dim={!lit(seg.cue)} style="--k:{i}" onclick={() => pick(seg.cue)} onkeydown={(e) => key(e, seg.cue)}>{seg.t}</span>{:else}<span class="plain">{seg.t}</span>{/if}{/each}<span class="q">”</span>
			</blockquote>
			<div class="verdicts">
				{#each E.judgments as j, ji}
					<div class="verdict" class:off={view !== "both" && view !== j.id} style="--j:{ji}">
						<p class="v-head">
							<span class="v-l"><Icon name={j.icon} />{j.label}</span>
							<span class="v-v"><Icon name="check" class="ok" />{j.verdict}</span>
							<span class="v-s">{j.share}</span>
						</p>
						<p class="v-x">
							“{#each j.explanation as seg}{#if seg.cue}<span role="button" tabindex="0" aria-pressed={cue === seg.cue} class="cue {seg.cue}" class:lit={lit(seg.cue)} class:dim={!lit(seg.cue)} onclick={() => pick(seg.cue)} onkeydown={(e) => key(e, seg.cue)}>{seg.t}</span>{:else}{seg.t}{/if}{/each}”
						</p>
					</div>
				{/each}
			</div>
		</div>
		<p class="see-cap"><img src="/images/who-wrote-this/claude_symbol.svg" alt="" width="14" height="14" />{E.caption.t}.</p>
	</div>

	<!-- explore -->
	<div class="explore">
		<div class="cases-block">
			<p class="lead">{S.cases_intro.t}</p>
			<div class="grid-wrap">
				<span class="axis-x"><Icon name="bulb" /> Ideas</span>
				<span class="axis-y"><Icon name="pen" /> Prose</span>
				<span class="col-h">Human</span><span class="col-h">AI</span>
				<ul class="cases" role="radiogroup" aria-label="Cases">
					{#each [0, 1, 3, 2] as ci}
						{@const c = S.cases[ci]}
						<li>
							<button type="button" role="radio" aria-checked={caseIdx === ci} class="case" onclick={() => (caseIdx = ci)}>
								<span class="who">
									<Icon name="bulb" class="what" /><Icon name={c.ideas === "ai" ? "ai" : "human"} class={c.ideas === "ai" ? "is-ai" : "is-human"} />
									<Icon name="pen" class="what" /><Icon name={c.prose === "ai" ? "ai" : "human"} class={c.prose === "ai" ? "is-ai" : "is-human"} />
								</span>
								<span class="case-t">{c.t}</span>
							</button>
						</li>
					{/each}
				</ul>
			</div>
			<div class="case-detail" aria-live="polite">
				<p class="case-def">{kase.def}</p>
				<p class="case-model"><Icon name="ai" class="fable" />{S.case_note}</p>
				<p class="case-nums">
					<span><Icon name="bulb" /><b>{kase.ideas_v}%</b> ideas</span>
					<span><Icon name="pen" /><b>{kase.prose_v}%</b> prose</span>
				</p>
			</div>
		</div>

		<div class="nums-block">
			<p class="nums-label"><Icon name="ai" class="fable" /><span class="m">{S.stats_model}</span>{S.stats_note}</p>
			<ul class="nums">
				{#each S.stats as st}<li><span class="big">{st.v}%</span><span class="nt"><Icon name={st.icon} />{st.t}</span></li>{/each}
			</ul>
			<p class="lead small">{S.climb_title.t}</p>
			<p class="climb-label">{S.climb_label}</p>
			<ol class="climb">
				{#each S.climb as p, i}
					<li class:fable={i === S.climb.length - 1} style="--v:{p.v / 100}">
						<span class="cv">{p.v}%</span><span class="cb"></span><span class="ct">{p.t}</span><span class="cy">{p.year}</span>
					</li>
				{/each}
			</ol>
			<p class="detectors"><Icon name="check2" class="ok" />{S.detectors.t}</p>
		</div>
	</div>
</section>

<style>
	.see { margin-top: 32px; }
	.see-bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px 16px; margin-bottom: 12px; }
	.src { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: var(--ink2); }
	.seg { display: inline-flex; background: var(--chip); border-radius: 3px; padding: 3px; }
	.seg button { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; font-size: 13px; font-weight: 500; color: var(--ink2); border-radius: 2px; transition: background-color .15s, color .15s; }
	.seg button:hover { color: var(--ink); }
	.seg button[aria-pressed="true"] { background: var(--ink); color: var(--field); }

	.scene { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr); gap: 16px; align-items: stretch; }
	.story { background: #fff; border-radius: 3px; padding: 24px 26px; font-size: 21px; line-height: 1.6; letter-spacing: -0.01em; }
	.story .q { color: var(--axis); }
	.plain { color: var(--ink); }
	.verdicts { display: grid; gap: 12px; align-content: start; }
	.verdict { background: var(--field); border-radius: 3px; padding: 16px 18px; transition: opacity .3s; }
	.verdict.off { opacity: .35; }
	.v-head { display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px 12px; font-size: 15px; }
	.v-l { display: inline-flex; align-items: center; gap: 6px; color: var(--ink2); font-weight: 500; }
	.v-v { display: inline-flex; align-items: center; gap: 4px; font-size: 22px; font-weight: 600; letter-spacing: -0.02em; }
	.v-v :global(.ok) { color: var(--ok); }
	.v-s { font-size: 13px; color: var(--ink2); }
	.v-x { margin-top: 8px; font-size: 15px; line-height: 1.55; color: var(--ink); }
	.see-cap { margin-top: 12px; font-size: 14px; line-height: 1.5; color: var(--ink2); max-width: 52rem; }
	.see-cap .model { display: inline-flex; align-items: center; gap: 5px; font-style: italic; font-weight: 500; color: var(--ink); margin-right: 4px; }
	.see-cap img { width: 14px; height: 14px; vertical-align: -2px; margin-right: 6px; }

	/* cues: the paper's colour-matched highlights; each is a button */
	.cue { display: inline; cursor: pointer; padding: 0 .12em; margin: 0 -.02em; border-radius: 2px; font: inherit; letter-spacing: inherit; text-align: left; transition: background-color .25s, color .25s, opacity .25s; box-decoration-break: clone; -webkit-box-decoration-break: clone; }
	.cue.rose { color: var(--cue-rose); background: var(--cue-rose-bg); }
	.cue.teal { color: var(--cue-teal); background: var(--cue-teal-bg); }
	.cue.clay { color: var(--cue-clay); background: var(--cue-clay-bg); }
	.cue.lit { box-shadow: inset 0 -2px 0 currentColor; }
	.cue.dim { background: transparent; color: var(--ink); opacity: .55; }
	.cue:hover { opacity: 1; }
	/* first view only: the cues light in order, then the verdicts land; afterwards every control answers at once */
	.see.armed .story .cue { background: transparent; color: var(--ink); box-shadow: none; }
	.see.armed .verdict { opacity: 0; transform: translateY(8px); }
	.see.entering .story .cue { transition-delay: calc(.3s + var(--k) * .12s); }
	.see.entering .verdict { transition: opacity .45s var(--ease), transform .45s var(--ease); transition-delay: calc(.9s + var(--j) * .5s); }

	/* explore */
	.explore { margin-top: 40px; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 40px; align-items: start; }
	.lead { font-size: 15px; line-height: 1.55; max-width: 34rem; }
	.lead.small { margin-top: 24px; font-weight: 500; }
	.grid-wrap { margin-top: 14px; display: grid; grid-template-columns: auto 1fr 1fr; grid-template-rows: auto auto 1fr; column-gap: 8px; row-gap: 6px; }
	.axis-x { grid-column: 2 / 4; grid-row: 1; display: inline-flex; align-items: center; justify-content: center; gap: 6px; font-size: 12px; color: var(--ink2); }
	.col-h { grid-row: 2; font-size: 12px; color: var(--ink2); text-align: center; }
	.col-h:nth-of-type(3) { grid-column: 2; } .col-h:nth-of-type(4) { grid-column: 3; }
	.axis-y { grid-column: 1; grid-row: 3; writing-mode: vertical-rl; transform: rotate(180deg); display: inline-flex; align-items: center; justify-content: center; gap: 6px; font-size: 12px; color: var(--ink2); }
	.cases { grid-column: 2 / 4; grid-row: 3; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
	.case { width: 100%; height: 100%; display: grid; gap: 8px; text-align: left; padding: 12px 14px; background: var(--field); border-radius: 3px; border: 1.5px solid transparent; transition: border-color .15s, background-color .15s; }
	.case:hover { border-color: var(--axis); }
	.case[aria-checked="true"] { border-color: var(--ink); background: #fff; }
	.who { display: flex; align-items: center; gap: 3px; font-size: 17px; }
	.who :global(.what) { color: var(--ink2); }
	.who :global(.what:nth-child(3)) { margin-left: 8px; }
	.who :global(.is-human) { color: var(--human); }
	.who :global(.is-ai) { color: var(--model); }
	.case-t { font-size: 14px; font-weight: 500; line-height: 1.3; }
	.case-detail { margin-top: 12px; padding: 14px 16px; background: #fff; border-radius: 3px; }
	.case-def { font-size: 15px; line-height: 1.5; }
	.case-model { margin-top: 10px; display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--ink2); }
	.case-model :global(.fable) { color: var(--fable); }
	.climb-label { font-size: 12.5px; color: var(--ink2); }
	.case-nums { margin-top: 8px; display: flex; gap: 18px; font-size: 13px; color: var(--ink2); }
	.case-nums span { display: inline-flex; align-items: baseline; gap: 6px; }
	.case-nums b { font-size: 24px; font-weight: 600; letter-spacing: -0.02em; color: var(--ink); }

	.nums-label { display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--ink2); }
	.nums-label :global(.fable) { color: var(--fable); }
	.nums-label .m { font-style: italic; font-weight: 500; color: var(--ink); }
	.nums { margin-top: 10px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
	.nums li { display: grid; gap: 4px; padding: 12px 14px; background: var(--field); border-radius: 3px; }
	.big { font-size: 34px; font-weight: 600; line-height: 1; letter-spacing: -0.035em; color: var(--rq1-ink); font-variant-numeric: tabular-nums; }
	.nt { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; line-height: 1.3; color: var(--ink2); }
	.climb { margin-top: 12px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; align-items: end; height: 150px; }
	.climb li { display: grid; grid-template-rows: auto 1fr auto auto; justify-items: center; height: 100%; text-align: center; font-size: 12.5px; }
	.cv { align-self: end; font-size: 15px; font-weight: 600; font-variant-numeric: tabular-nums; margin-bottom: 4px; }
	.cb { width: 30px; height: calc(var(--v) * 84px); align-self: end; background: var(--gray-mid); }
	.climb li:nth-child(2) .cb { background: var(--gray); }
	.climb li.fable .cb { background: var(--fable); }
	.climb li.fable .cv { color: var(--fable); }
	.ct { margin-top: 6px; font-weight: 500; }
	.cy { color: var(--ink2); }
	.detectors { margin-top: 20px; display: flex; gap: 8px; font-size: 14px; line-height: 1.5; color: var(--ink2); }
	.detectors :global(.ok) { color: var(--ok); flex: none; margin-top: 4px; }

	@media (max-width: 860px) {
		.scene, .explore { grid-template-columns: minmax(0, 1fr); }
		.story { font-size: 19px; padding: 20px; }
	}
	@media (max-width: 480px) { .nums { gap: 6px; } .nums li { padding: 10px; } .big { font-size: 26px; } .nt { font-size: 12px; } }
	@media (prefers-reduced-motion: reduce) { .cue, .verdict, .case { transition: none !important; } }
</style>
