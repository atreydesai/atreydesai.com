<script lang="ts">
	// The hero: the paper's three levels, in the abstract's own words, played on the page-wide dot field.
	// Level 1 divides the ground into human and model; level 2 gathers it into labs; level 3 lights one writer.
	// The rows are buttons (replay a level) and each links to its section. Settled frame: each row has its level
	// drawn small beside it, so the stage is never empty.
	import { onMount } from "svelte";
	import Icon from "./Icon.svelte";
	import { field, hero, labCenters } from "./field.svelte";
	import ArtFingerprint from "./ArtFingerprint.svelte";
	import ArtMosaic from "./ArtMosaic.svelte";
	import C from "./content.json";

	// art: "dots" plays the levels on the page-wide dot field; "fingerprint" and "mosaic" play them in the hero art
	let { art = "dots" }: { art?: string } = $props();
	const onField = art === "dots";
	const L = C.levels;
	let active = $state(0); // 0 = all three settled
	let stage: HTMLElement;
	let root: HTMLElement;
	const rowEls: HTMLElement[] = [];
	let sw = $state(0), sh = $state(0); // stage size, for the labels over the dots
	const labs = $derived(labCenters({ x: 0, y: 0, w: sw, h: sh }).slice(0, 3));
	const LABS = [["anthropic", "Anthropic"], ["openai", "OpenAI"], ["google", "Google"]];
	let timers: ReturnType<typeof setTimeout>[] = [];

	function show(n: number) {
		active = n;
		if (!onField) return;
		field.mode = "levels";
		field.level = n;
	}
	function play() {
		timers.forEach(clearTimeout);
		timers = [1, 2, 3, 0].map((n, i) => setTimeout(() => show(n), 400 + i * 3200));
	}
	function pick(n: number) {
		timers.forEach(clearTimeout);
		show(active === n ? 0 : n);
	}

	onMount(() => {
		const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches || new URLSearchParams(location.search).has("still");
		let raf = 0;
		const track = () => {
			const r = stage.getBoundingClientRect();
			field.anchor = { x: r.left, y: r.top, w: r.width, h: r.height };
			if (r.width !== sw) sw = r.width;
			if (r.height !== sh) sh = r.height;
			// settled bands: beside each row on wide screens, stacked in the stage on narrow ones
			const beside = rowEls[0] && rowEls[0].getBoundingClientRect().right <= r.left;
			hero.bands = rowEls.map((el, i) => {
				if (!beside) return { x: r.left, y: r.top + (r.height * i) / 3, w: r.width, h: r.height / 3 };
				const q = el.getBoundingClientRect();
				return { x: r.left, y: q.top, w: r.width, h: q.height };
			});
			raf = requestAnimationFrame(track);
		};
		raf = requestAnimationFrame(track);
		let played = false;
		const io = new IntersectionObserver((es) => es.forEach((e) => {
			if (e.isIntersecting) {
				if (onField && field.mode !== "levels") { field.mode = "levels"; field.level = active; }
				if (!played && !reduce) { played = true; play(); }
			} else if (field.mode === "levels") {
				field.mode = "ground"; field.level = 0;
			}
		}), { threshold: 0.25 });
		io.observe(root);
		return () => { cancelAnimationFrame(raf); io.disconnect(); timers.forEach(clearTimeout); };
	});
</script>

<section class="levels" bind:this={root} aria-label={L.lead.t}>
	<div class="copy">
		<p class="lead">{L.lead.t}:</p>
		<ol>
			{#each L.items as it, i}
				<li bind:this={rowEls[i]} class:on={active === 0 || active === it.n} class:now={active === it.n} data-rq={it.rq}>
					<button type="button" class="row" aria-pressed={active === it.n} onclick={() => pick(it.n)}>
						<span class="n">{it.n}</span>
						<span class="body">
							<span class="t">{it.t}</span>
							<span class="fact">{#if it.v}<b>{it.v}</b>{" "}{/if}{it.fact}</span>
						</span>
					</button>
					<a class="go" href="#{it.target}" aria-label="Go to {it.t}"><Icon name="arrow" /></a>
				</li>
			{/each}
		</ol>
		<p class="without">
			<span class="icons">{#each C.hero.without as w}<span class="struck" title={w.t}><Icon name={w.icon} /><svg viewBox="0 0 24 24" aria-hidden="true"><line x1="3" y1="21" x2="21" y2="3" /></svg></span>{/each}</span>
			{C.hero.without_line.t}
		</p>
		<button type="button" class="replay" onclick={play}><Icon name="replay" /> Replay</button>
	</div>
	<!-- the field draws the three levels into this box, or the art plays them -->
	<div class="stage" class:art={!onField} bind:this={stage} aria-hidden="true">
		{#if onField && sw}
			<!-- a few words over the dots, so each level reads at a glance -->
			{#key active}
				{#if active === 1}
					<span class="tag" style:--c="var(--rq1)" style:left="25%" style:top="50%"><Icon name="human" />Human</span>
					<span class="tag" style:--c="var(--rq2)" style:left="75%" style:top="50%"><Icon name="ai" />AI</span>
				{:else if active === 2}
					{#each labs as c, i}
						<span class="tag lab" style:left="{c.x}px" style:top="{c.y + c.r + 18}px"><Icon name={LABS[i][0]} />{LABS[i][1]}</span>
					{/each}
				{:else if active === 3}
					<span class="tag" style:--c="var(--rq3)" style:left="62%" style:top="calc(50% - 40px)"><Icon name="human" /></span>
				{/if}
			{/key}
		{/if}
		{#if art === "fingerprint"}<ArtFingerprint level={active} />{/if}
		{#if art === "mosaic"}<ArtMosaic level={active} onpick={pick} />{/if}
	</div>
</section>

<style>
	.levels { margin-top: 40px; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 0.9fr); gap: 32px; align-items: stretch; min-height: 520px; }
	.lead { font-size: clamp(20px, 2.2vw, 26px); line-height: 1.3; font-weight: 500; letter-spacing: -0.015em; max-width: 38ch; text-wrap: balance; }
	ol { margin-top: 22px; display: grid; gap: 10px; }
	li { --c: var(--rq1); display: flex; align-items: stretch; gap: 6px; opacity: .38; transition: opacity .4s var(--ease); }
	li[data-rq="2"] { --c: var(--rq2); } li[data-rq="3"] { --c: var(--rq3); }
	li.on { opacity: 1; }
	.row { flex: 1; display: grid; grid-template-columns: 36px minmax(0, 1fr); gap: 14px; align-items: start; text-align: left; padding: 14px 16px; border-radius: 3px; background: rgba(243, 243, 239, .86); border: 1.5px solid transparent; transition: border-color .2s, background-color .2s; }
	.row:hover { border-color: var(--c); }
	li.now .row { border-color: var(--c); background: #fff; }
	.n { display: inline-grid; place-items: center; width: 36px; height: 36px; border-radius: 2px; background: var(--c); color: #fff; font-weight: 600; font-size: 17px; }
	.body { display: grid; gap: 4px; }
	.t { font-size: clamp(19px, 2vw, 23px); font-weight: 600; letter-spacing: -0.02em; line-height: 1.2; }
	.fact { font-size: 14.5px; line-height: 1.5; color: var(--ink2); }
	.fact b { font-size: 17px; font-weight: 600; color: var(--ink); font-variant-numeric: tabular-nums; }
	.go { display: grid; place-items: center; width: 34px; border-radius: 3px; color: var(--ink2); background: rgba(243, 243, 239, .86); text-decoration: none; }
	.go:hover { color: var(--ink); background: #fff; }
	.without { margin-top: 18px; display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; font-size: 13px; color: var(--ink2); }
	.icons { display: inline-flex; gap: 8px; font-size: 17px; color: var(--ink); }
	.struck { position: relative; display: inline-flex; }
	.struck svg { position: absolute; inset: -2px; width: calc(100% + 4px); height: calc(100% + 4px); }
	.struck line { stroke: var(--ink); stroke-width: 2.2; stroke-linecap: round; }
	.replay { margin-top: 14px; display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 500; color: var(--ink2); }
	.replay:hover { color: var(--ink); }
	.stage { min-height: 360px; border-radius: 4px; position: relative; }
	.stage.art { min-height: 480px; }
	.tag {
		position: absolute; transform: translate(-50%, -50%); display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px;
		border-radius: 3px; background: rgba(255, 255, 255, .92); color: var(--c, var(--ink)); font-size: 14px; font-weight: 600;
		box-shadow: 0 4px 14px rgba(20, 32, 45, .12); pointer-events: none; animation: tag-in .5s .35s both;
	}
	.tag :global(svg) { width: 15px; height: 15px; }
	.tag.lab { font-size: 13px; color: var(--ink); }
	@keyframes tag-in { from { opacity: 0; transform: translate(-50%, -30%); } }
	@media (max-width: 860px) {
		.levels { grid-template-columns: 1fr; min-height: 0; }
		.stage { min-height: 240px; order: -1; }
		.stage.art { min-height: 380px; }
	}
	@media (prefers-reduced-motion: reduce) { li, .row { transition: none; } .tag { animation: none; } }
</style>
