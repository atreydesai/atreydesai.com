<script lang="ts">
	// The whole project in one board: one text, one prompt, three increasingly specific questions. Each lane reads
	// left to right: the question, the paper's own Claude Fable 5.2 example answer, then how often it is right.
	// The settled board is the first frame (and the tweet header); the build plays once when it scrolls into view.
	import { onMount } from "svelte";
	import Icon from "./Icon.svelte";
	import C from "./content.json";

	let { poster = "", step = "" }: { poster?: string; step?: string } = $props();
	const H = C.hero;

	let board: HTMLDivElement;
	let wires = $state<string[]>(["", "", ""]);
	let viewBox = $state("0 0 100 100");
	let current = $state(3);
	let tl: any = null;
	let replay = () => {};
	let seekTo = (_: string) => {};

	function layoutWires() {
		if (!board) return;
		const b = board.getBoundingClientRect();
		viewBox = `0 0 ${b.width} ${b.height}`;
		const art = board.querySelector(".art")!.getBoundingClientRect();
		const ax = art.right - b.left - art.width * 0.06;
		const ay = art.top - b.top + art.height * 0.5;
		wires = [...board.querySelectorAll(".ribbon")].map((r) => {
			const rr = r.getBoundingClientRect();
			const bx = rr.left - b.left - 6;
			const by = rr.top - b.top + rr.height / 2;
			const mx = ax + (bx - ax) * 0.55;
			return `M${ax},${ay} C${mx},${ay} ${mx},${by} ${bx},${by}`;
		});
	}

	onMount(() => {
		let disposed = false;
		const reduce = matchMedia("(prefers-reduced-motion: reduce)");
		const still = new URLSearchParams(location.search).has("still") || !!poster;
		let io: IntersectionObserver | null = null;
		const ro = new ResizeObserver(() => { const p = tl?.progress() ?? 1; layoutWires(); if (tl && !tl.isActive()) build().progress(p); });

		let gsap: any;
		const labels = ["text", "rq1", "rq2", "rq3", "end"];
		function build() {
			if (tl) { tl.progress(1); tl.kill(); }
			const t = gsap.timeline({ paused: true, onUpdate: sync });
			const q = (s: string) => board.querySelectorAll(s);
			t.addLabel("text")
				.from(q(".art"), { autoAlpha: 0, y: 8, duration: 0.5, ease: "power3.out" })
				.fromTo(q(".art"), { rotate: -2 }, { rotate: 0, duration: 1.1, ease: "elastic.out(1, 0.5)" }, 0.1)
				.from(q(".ask"), { autoAlpha: 0, scale: 0.85, transformOrigin: "20% 100%", duration: 0.45, ease: "back.out(2)" }, 0.35)
				.from(q(".model"), { autoAlpha: 0, y: 4, duration: 0.35 }, "<0.1")
				.from(q(".without li"), { autoAlpha: 0, y: 6, stagger: 0.12, duration: 0.35, ease: "power3.out" }, "<0.15")
				.from(q(".without-t"), { autoAlpha: 0, duration: 0.4 }, "<0.2")
				.from(q(".strike line"), { drawSVG: 0, stagger: 0.12, duration: 0.3, ease: "power2.out" }, "<0.25")
				.to({}, { duration: 0.25 });
			[0, 1, 2].forEach((i) => {
				const lane = board.querySelectorAll(".lane")[i];
				const L = (s: string) => lane.querySelectorAll(s);
				t.addLabel(labels[i + 1])
					.from(board.querySelectorAll(".wire")[i], { drawSVG: 0, duration: 0.55, ease: "power2.inOut" })
					.from(L(".lane-link"), { autoAlpha: 0, x: -12, duration: 0.45, ease: "power3.out" }, ">-0.25")
					.from(L(".src"), { autoAlpha: 0, duration: 0.3 }, "<0.15")
					.from(L(".ans"), { autoAlpha: 0, y: 6, stagger: 0.25, duration: 0.35, ease: "power3.out" }, "<0.1")
					.from(L(".ans .ok"), { scale: 0, transformOrigin: "50% 50%", stagger: 0.25, duration: 0.3, ease: "back.out(3)" }, "<0.25")
					.from(L(".stat"), { autoAlpha: 0, y: 6, stagger: 0.12, duration: 0.4, ease: "power3.out" }, ">0.05")
					.from(L(".stat-note, .logos"), { autoAlpha: 0, duration: 0.3 }, "<0.2")
					.to({}, { duration: 0.35 });
			});
			t.addLabel("end").from(q(".punch"), { autoAlpha: 0, y: 8, duration: 0.5, ease: "power3.out" }).to({}, { duration: 0.4 });
			tl = t;
			return t;
		}
		function settle(id: string) {
			const i = labels.indexOf(id);
			return i < labels.length - 1 ? tl.labels[labels[i + 1]] - 0.001 : tl.duration();
		}
		function sync() {
			if (!tl) return;
			let cur = 0;
			labels.slice(0, 4).forEach((l, i) => { if (tl.time() >= tl.labels[l]) cur = i; });
			current = tl.progress() === 1 ? 3 : cur;
		}

		(async () => {
			const [{ gsap: g }, { DrawSVGPlugin }] = await Promise.all([import("gsap"), import("gsap/DrawSVGPlugin")]);
			if (disposed) return;
			gsap = g;
			gsap.registerPlugin(DrawSVGPlugin);
			await document.fonts?.ready;
			layoutWires();
			await new Promise((r) => requestAnimationFrame(r));
			build();
			if (step) { tl.seek(settle(step)); sync(); return; }
			tl.progress(1);
			sync();
			ro.observe(board);
			replay = () => tl.restart();
			seekTo = (id: string) => { tl.pause(); tl.seek(settle(id)); sync(); };
			if (still) return;
			let played = false;
			io = new IntersectionObserver((es) => es.forEach((e) => {
				if (e.isIntersecting && !played && !reduce.matches) { played = true; setTimeout(() => tl.restart(), 450); }
			}), { threshold: 0.5 });
			io.observe(board);
		})();
		return () => { disposed = true; io?.disconnect(); ro.disconnect(); tl?.kill(); };
	});
</script>

<section class="hero" class:poster={!!poster} data-poster={poster} aria-label={H.caption.t}>
	<div class="board" bind:this={board}>
		{#if poster}
			<div class="ptitle"><p class="pt">{C.meta.deck.t}</p><p class="pd">{H.caption.t}</p></div>
		{/if}
		<div class="hub">
			<p class="ask">{H.ask}</p>
			<img class="art" src="/images/who-wrote-this/detective.png" alt="" width="1354" height="790" draggable="false" />
			<p class="model"><img src="/images/who-wrote-this/claude_symbol.svg" alt="" width="20" height="20" />{H.model}</p>
			<div class="without">
				<ul>
					{#each H.without as w}
						<li title={w.t}><span class="struck"><Icon name={w.icon} /><svg class="strike" viewBox="0 0 24 24" aria-hidden="true"><line x1="3" y1="21" x2="21" y2="3" /></svg></span></li>
					{/each}
				</ul>
				<p class="without-t">{H.without_line.t}</p>
			</div>
		</div>

		<ol class="lanes">
			{#each H.columns as col}
				<li class="lane" data-rq={col.rq}>
					<a href="#{col.target}" class="lane-link" aria-label="{col.title} {col.answers.map((a) => a.verdict).join(', ')}">
						<span class="ribbon">{col.title}</span>
						<span class="example">
							<span class="src">{col.source}</span>
							{#each col.answers as a}
								<span class="ans">
									<span class="ans-l"><Icon name={a.icon} />{a.label}</span>
									<span class="ans-v"><Icon name="check" class="ok" />{a.verdict}</span>
									{#if a.note}<span class="ans-n">{a.note}</span>{/if}
								</span>
							{/each}
						</span>
						<span class="how">
							{#each col.stats as s}
								<span class="stat"><span class="stat-v">{s.v}</span><span class="stat-t">{s.t}</span></span>
								{#if s.logos}<span class="logos">{#each s.logos as l}<Icon name={l} />{/each}</span>{/if}
							{/each}
							{#if col.stat_note}<span class="stat-note">{col.stat_note}</span>{/if}
						</span>
					</a>
				</li>
			{/each}
		</ol>

		<p class="punch"><Icon name="eye-off" /><span class="punch-v">{H.punchline.v}</span><span class="punch-t">{H.punchline.t}</span></p>

		<svg class="wires" {viewBox} aria-hidden="true">
			{#each wires as d, i}<path class="wire" data-rq={i + 1} {d} />{/each}
		</svg>
	</div>

	{#if !poster}
		<div class="controls">
			<div class="steps" role="group" aria-label="Steps">
				{#each H.steps as s, i}
					<button type="button" aria-pressed={current === i} onclick={() => seekTo(s.id)}><span class="sn">{i + 1}</span>{s.t}</button>
				{/each}
				<button type="button" class="replay" aria-label="Replay" onclick={() => replay()}><Icon name="replay" /></button>
			</div>
			<p class="caption">{H.caption.t}</p>
		</div>
	{/if}
</section>

<style>
	.hero { margin-top: 36px; }
	.board {
		position: relative; container-type: inline-size; aspect-ratio: 16 / 9;
		display: grid; grid-template-columns: 31% minmax(0, 1fr); grid-template-rows: 1fr auto; column-gap: 6%;
		grid-template-areas: "hub lanes" "hub punch";
		padding: 3.2% 3.6% 2.8%; background: var(--field); border-radius: 4px;
	}
	.hub { grid-area: hub; align-self: center; position: relative; display: flex; flex-direction: column; align-items: flex-start; }
	.art { display: block; width: 100%; height: auto; user-select: none; }
	.ask { position: absolute; z-index: 2; top: -1.4cqw; left: 40%; white-space: nowrap; padding: .5em .75em; font: 500 max(12px, 1.9cqw)/1.1 var(--font); background: #fff; border-radius: 3px; }
	.ask::after { content: ""; position: absolute; left: 1.1em; bottom: -.5em; border: .5em solid transparent; border-top-color: #fff; border-bottom: 0; }
	.model { display: flex; align-items: center; gap: .45em; margin: 1cqw 0 0 32%; font: italic 500 max(12px, 1.75cqw)/1.2 var(--font); }
	.model img { width: 1.05em; height: 1.05em; }
	.without { margin-top: 2.4cqw; color: var(--ink2); }
	.without ul { display: flex; gap: 1.1cqw; font-size: max(15px, 2.1cqw); color: var(--ink); margin-bottom: .6cqw; }
	.without-t { font-size: max(12px, 1.45cqw); line-height: 1.3; max-width: 22em; text-wrap: balance; }
	.struck { position: relative; display: inline-flex; width: 1.25em; height: 1.25em; align-items: center; justify-content: center; }
	.strike { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
	.strike line { stroke: var(--ink); stroke-width: 2.2; stroke-linecap: round; }

	.lanes { grid-area: lanes; align-self: center; display: grid; gap: 1.6cqw; position: relative; z-index: 1; }
	.lane { --lane: var(--rq1); --tint: var(--rq1-tint); --lane-ink: var(--rq1-ink); }
	.lane[data-rq="2"] { --lane: var(--rq2); --tint: var(--rq2-tint); --lane-ink: var(--rq2-ink); }
	.lane[data-rq="3"] { --lane: var(--rq3); --tint: var(--rq3-tint); --lane-ink: var(--rq3-ink); }
	.lane-link {
		display: grid; grid-template-columns: 30% minmax(0, 1fr) 31%; align-items: center; column-gap: 1.8cqw;
		padding: 1.1cqw 1.4cqw 1.1cqw 0; text-decoration: none; border-radius: 3px; background: #fff;
		transition: background-color .15s;
	}
	.lane-link:hover { background: var(--tint); }
	/* Figure 1's ribbon: white lettering on the question colour, notched tail */
	.ribbon { align-self: stretch; display: flex; align-items: center; padding: 0 1.8em 0 .8em; margin-block: -1.1cqw; border-radius: 3px 0 0 3px; color: #fff; background: var(--lane); font: 600 max(14px, 1.75cqw)/1.15 var(--font); text-wrap: balance; clip-path: polygon(0 0, 100% 0, calc(100% - .75em) 50%, 100% 100%, 0 100%); }
	.example { display: grid; gap: .45cqw; min-width: 0; }
	.src { font-size: max(11px, 1.2cqw); color: var(--ink2); }
	.ans { display: flex; align-items: baseline; flex-wrap: wrap; gap: 0 .55em; font-size: max(13px, 1.65cqw); line-height: 1.25; }
	.ans-l { display: inline-flex; align-items: center; gap: .3em; color: var(--ink2); }
	.ans-v { display: inline-flex; align-items: center; gap: .25em; font-weight: 600; }
	.ans-v :global(.ok) { color: var(--ok); }
	.ans-n { font-size: .82em; color: var(--ink2); }
	.how { display: flex; flex-wrap: wrap; align-items: flex-start; gap: .5cqw 1.6cqw; }
	.stat { display: grid; gap: .3em; max-width: 13em; }
	.stat-v { font: 600 max(18px, 2.9cqw)/1 var(--font); letter-spacing: -0.03em; font-variant-numeric: tabular-nums; color: var(--lane-ink); white-space: nowrap; }
	.stat-t { font-size: max(11px, 1.2cqw); line-height: 1.25; color: var(--ink2); }
		.logos { flex-basis: 100%; display: flex; gap: .5em; font-size: max(12px, 1.4cqw); color: var(--ink); }
	.stat-note { flex-basis: 100%; font-size: max(11px, 1.1cqw); color: var(--ink2); }
	.punch { grid-area: punch; display: flex; align-items: center; gap: .7em; margin-top: 1.6cqw; padding: 1cqw 1.4cqw; border-radius: 3px; background: var(--ink); color: var(--field); font-size: max(13px, 1.55cqw); line-height: 1.3; }
	.punch-v { font: 600 max(18px, 2.6cqw)/1 var(--font); letter-spacing: -0.03em; }
	.punch :global(.ic) { font-size: 1.2em; opacity: .85; }
	.wires { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 0; }
	.wire { fill: none; stroke-width: 1.6; stroke-linecap: round; }
	.wire[data-rq="1"] { stroke: var(--rq1); } .wire[data-rq="2"] { stroke: var(--rq2); } .wire[data-rq="3"] { stroke: var(--rq3); }

	.controls { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px 20px; margin-top: 10px; }
	.steps { display: inline-flex; flex-wrap: wrap; background: var(--chip); border-radius: 3px; padding: 3px; }
	.steps button { display: inline-flex; align-items: center; gap: .45em; padding: 6px 11px; font-size: 13px; font-weight: 500; color: var(--ink2); border-radius: 2px; transition: background-color .15s, color .15s; }
	.steps button:hover { color: var(--ink); }
	.steps button[aria-pressed="true"] { background: var(--ink); color: var(--field); }
	.sn { opacity: .7; font-variant-numeric: tabular-nums; }
	.caption { font-size: 13px; color: var(--ink2); }

	/* poster: the settled board at an exact size (header 1600x900, share card 1200x630) */
	.poster .board { aspect-ratio: auto; grid-template-rows: auto 1fr auto; grid-template-areas: "title title" "hub lanes" "hub punch"; border-radius: 0; background: var(--ground); }
	.poster[data-poster="header"] .board { width: 1600px; height: 900px; padding: 46px 60px 40px; }
	.poster[data-poster="og"] .board { width: 1200px; height: 630px; padding: 30px 44px 26px; }
	.ptitle { grid-area: title; margin-bottom: 1.2cqw; }
	.pt { font: 600 2.7cqw/1.05 var(--font); letter-spacing: -0.03em; }
	.pd { font: 400 1.7cqw/1.25 var(--font); color: var(--ink2); margin-top: .3em; }
	.poster .lane-link { background: var(--field); }

	@media (max-width: 760px) {
		.board { aspect-ratio: auto; grid-template-columns: 1fr; grid-template-areas: "hub" "lanes" "punch"; row-gap: 22px; padding: 22px 16px; }
		.wires { display: none; }
		.ask { font-size: 15px; top: -8px; }
		.model { font-size: 14px; margin-left: 28%; }
		.without ul { font-size: 18px; gap: 10px; }
		.without-t { font-size: 13px; }
		.lanes { gap: 12px; }
		.lane-link { grid-template-columns: 1fr; row-gap: 10px; padding: 0 14px 14px; }
		.ribbon { margin: 0 -14px; padding: 10px 2em 10px 14px; font-size: 17px; border-radius: 3px 3px 0 0; clip-path: none; }
		.ans { font-size: 15px; } .src, .stat-t, .stat-note { font-size: 12.5px; }
		.stat-v { font-size: 26px; }
		.punch { font-size: 14px; padding: 12px 14px; }
		.punch-v { font-size: 24px; }
	}
	@media (prefers-reduced-motion: reduce) { .lane-link { transition: none; } }
</style>
