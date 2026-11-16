<script lang="ts">
	// The hero, as a pinned scroll section over the whole page canvas (like the timeline). One fingerprint whose ridges
	// are writing transforms with the reader's scroll: one print (a text by an unknown author), then a human print and an
	// AI print, then one print per lab, then a crowd of writers with one lit. The renderer (print/) draws ink only; every
	// word here is HTML from content.json, placed at the anchors the renderer returns. Rows are controls: a click scrolls
	// to that level. Hover any print to see whose it is; the lens deciphers whatever is under the pointer.
	import { onMount } from "svelte";
	import Icon from "./Icon.svelte";
	import { field, chart } from "./field.svelte";
	import { createPrint, type Anchor, type Box, type Print } from "./print";
	import C from "./content.json";

	const L = C.levels;
	const LIT = C.art.decipher[2];
	const PROFILES = C.which_ai.profiles as Record<string, { name: string; t: string }>;
	const LABS = ["Anthropic", "OpenAI", "Google", "Alibaba", "DeepSeek", "Moonshot", "Zhipu", "MiniMax", "Mistral", "xAI", "Cohere"];
	const LOGO: Record<string, string> = { Anthropic: "anthropic", OpenAI: "openai", Google: "google" };
	const STEPS = [0, 1, 2, 3];

	let root: HTMLElement, stick: HTMLElement, panel: HTMLElement;
	let step = $state(0);
	let active = $state(false);
	let anchors = $state<Anchor[]>([]);
	let hover = $state<{ id: string; x: number; y: number } | null>(null);
	let print: Print;

	const level = $derived(STEPS[step]);
	// labels shown at anchors: the two kinds, the labs (big three with logos), and the lit writer
	const tags = $derived(
		anchors.filter((a) => a.alpha > 0.25 && (a.id === "human" || a.id === "ai" || a.id.startsWith("lab:") || a.id === "lit")),
	);
	const hoverInfo = $derived.by(() => {
		if (!hover) return null;
		const id = hover.id;
		if (id === "human") return { title: "Human", body: "" };
		if (id === "ai") return { title: "AI", body: "" };
		if (id.startsWith("lab:")) { const lab = id.slice(4); return { title: lab, body: PROFILES[lab]?.t ?? "" }; }
		if (id === "lit") return { title: LIT.answers[0].verdict, body: `“${LIT.excerpt.t}”` };
		return null;
	});

	function go(n: number) {
		const el = root.querySelectorAll(".step")[STEPS.indexOf(n)] as HTMLElement | undefined;
		el?.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
	}

	onMount(() => {
		const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches || new URLSearchParams(location.search).has("still");
		const text = [
			...C.lede.map((s) => s.t), L.lead.t, ...L.items.flatMap((i) => [i.t, i.fact]),
			C.sections[0].example.text.map((s) => s.t).join(""), ...C.timeline.steps.map((s) => s.t), ...C.art.decipher.map((d) => d.excerpt.t), C.closing.t,
		];
		print = createPrint({
			text, labs: LABS, litText: LIT.excerpt.t,
			colors: { human: "#C85A82", ai: "#461E47", lit: "#437E8E", ink: "#14202D", labs: ["#C85A82", "#437E8E", "#461E47"], other: "#8A8F98" },
		});
		let pointer: { x: number; y: number } | null = null;
		let lastAnchors = 0;
		const rect = (el: Element): Box => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };

		chart.paint = (ctx, f) => {
			if (field.owner !== "hero") return;
			const s = rect(stick), p = rect(panel);
			const narrow = f.w < 860;
			const top = Math.max(0, s.y), bottom = Math.min(f.h, s.y + s.h);
			// the art lives beside the panel (wide) or below it (narrow), within the part of the stage on screen
			const stage: Box = narrow
				? { x: 0, y: Math.max(top, p.y + p.h + 8), w: f.w, h: Math.max(0, bottom - Math.max(top, p.y + p.h + 8)) }
				: { x: p.x + p.w + 24, y: top, w: f.w - (p.x + p.w + 24), h: Math.max(0, bottom - top) };
			const enter = Math.max(0, Math.min(1, 1 - Math.max(0, s.y) / f.h, (s.y + s.h) / f.h));
			const mast = document.querySelector(".mast");
			const quiet = [p, ...(mast ? [rect(mast)] : [])];
			print.draw(ctx, { level, t: f.now / 1000, dt: Math.min(0.05, f.dt), view: { w: f.w, h: f.h, dpr: f.dpr }, stage, quiet, pointer, enter, reduce });
			if (f.now - lastAnchors > 50) {
				lastAnchors = f.now;
				anchors = print.anchors();
				// the prints move under a still pointer as the level changes: keep the tooltip honest
				if (pointer) { const h = print.hit(pointer.x, pointer.y); hover = h ? { id: h.id, x: pointer.x, y: pointer.y } : null; }
			}
		};

		const onMove = (e: PointerEvent) => {
			if (!active) return;
			pointer = { x: e.clientX, y: e.clientY };
			const h = print.hit(e.clientX, e.clientY);
			hover = h ? { id: h.id, x: e.clientX, y: e.clientY } : null;
			lastAnchors = 0;
		};
		const onLeave = () => { pointer = null; hover = null; };
		addEventListener("pointermove", onMove, { passive: true });
		addEventListener("pointerdown", onMove, { passive: true });
		document.addEventListener("pointerleave", onLeave);

		const own = () => { field.mode = "paint"; field.owner = "hero"; field.dim = 0.55; field.interactive = false; };
		// retake the canvas if a neighbour left it on the plain ground while this section is in view
		let watch = 0;
		const check = () => { if (active && field.mode === "ground") own(); watch = requestAnimationFrame(check); };
		watch = requestAnimationFrame(check);
		const io = new IntersectionObserver((es) => es.forEach((e) => {
			active = e.isIntersecting;
			if (active) own();
			else if (field.owner === "hero") { field.mode = "ground"; field.dim = 0; field.owner = ""; hover = null; }
		}), { rootMargin: "0px 0px -10% 0px" });
		io.observe(root);
		const steps = [...root.querySelectorAll(".step")];
		const so = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) step = steps.indexOf(e.target); }), { rootMargin: "-45% 0px -45% 0px" });
		steps.forEach((s) => so.observe(s));
		return () => {
			removeEventListener("pointermove", onMove); removeEventListener("pointerdown", onMove); document.removeEventListener("pointerleave", onLeave);
			io.disconnect(); so.disconnect(); cancelAnimationFrame(watch); print.dispose?.();
			if (field.owner === "hero") { field.mode = "ground"; field.dim = 0; field.owner = ""; chart.paint = null; }
		};
	});
</script>

<section class="ph" bind:this={root} aria-label={L.lead.t} style="--steps:{STEPS.length}">
	<div class="stick" bind:this={stick}>
		<div class="panel" bind:this={panel}>
			<p class="lead">{L.lead.t}:</p>
			<ol>
				{#each L.items as it}
					<li class:on={level === 0 || level === it.n} class:now={level === it.n} data-rq={it.rq}>
						<button type="button" class="row" aria-pressed={level === it.n} onclick={() => go(level === it.n ? 0 : it.n)}>
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
			<p class="say-n" aria-hidden="true">{#each STEPS as _, i}<i class:on={step === i}></i>{/each}</p>
		</div>
		{#if active}
			<div class="tags" aria-hidden="true">
				{#each tags as a (a.id)}
					{@const lab = a.id.startsWith("lab:") ? a.id.slice(4) : ""}
					<span
						class="tag {a.id === 'lit' ? 'lit' : ''} {lab && !LOGO[lab] ? 'small' : ''}"
						data-k={a.id === "human" ? "human" : a.id === "ai" ? "ai" : lab ? "lab" : "lit"}
						style:left="{a.x}px"
						style:top="{a.y + a.r + 14}px"
						style:opacity={Math.min(1, a.alpha * 1.4)}
					>
						{#if a.id === "human"}<Icon name="human" />Human{/if}
						{#if a.id === "ai"}<Icon name="ai" />AI{/if}
						{#if lab}{#if LOGO[lab]}<Icon name={LOGO[lab]} />{/if}{lab}{/if}
						{#if a.id === "lit"}<Icon name="human" /><b>{LIT.answers[0].verdict}</b>{/if}
					</span>
				{/each}
			</div>
			{#if hover && hoverInfo}
				<div class="tip" class:flip={hover.x > innerWidth - 300} style:left="{hover.x}px" style:top="{hover.y}px">
					<b>{hoverInfo.title}</b>
					{#if hoverInfo.body}<span>{hoverInfo.body}</span>{/if}
				</div>
			{/if}
		{/if}
	</div>
	<!-- invisible scroll triggers: one per level -->
	<div class="steps" aria-hidden="true">{#each STEPS as _}<div class="step"></div>{/each}</div>
</section>

<style>
	.ph { position: relative; margin-top: 24px; height: calc((var(--steps) + 0.6) * 90vh); }
	.stick { position: sticky; top: 0; height: 100vh; pointer-events: none; }
	.panel { pointer-events: auto; position: absolute; left: 0; top: 50%; transform: translateY(-50%); width: min(36%, 430px); display: grid; gap: 10px; }
	.lead { font-size: clamp(19px, 1.9vw, 23px); line-height: 1.3; font-weight: 500; letter-spacing: -0.015em; text-wrap: balance; }
	ol { margin-top: 10px; display: grid; gap: 8px; }
	li { --c: var(--rq1); display: flex; align-items: stretch; gap: 6px; opacity: .4; transition: opacity .4s var(--ease); }
	li[data-rq="2"] { --c: var(--rq2); } li[data-rq="3"] { --c: var(--rq3); }
	li.on { opacity: 1; }
	.row { flex: 1; display: grid; grid-template-columns: 34px minmax(0, 1fr); gap: 12px; align-items: start; text-align: left; padding: 12px 14px; border-radius: 3px; background: rgba(243, 243, 239, .9); border: 1.5px solid transparent; transition: border-color .2s, background-color .2s; }
	.row:hover { border-color: var(--c); }
	li.now .row { border-color: var(--c); background: #fff; }
	.n { display: inline-grid; place-items: center; width: 34px; height: 34px; border-radius: 2px; background: var(--c); color: #fff; font-weight: 600; font-size: 16px; }
	.body { display: grid; gap: 3px; }
	.t { font-size: clamp(17px, 1.6vw, 20px); font-weight: 600; letter-spacing: -0.02em; line-height: 1.2; }
	.fact { font-size: 13.5px; line-height: 1.45; color: var(--ink2); }
	.fact b { font-size: 15.5px; font-weight: 600; color: var(--ink); font-variant-numeric: tabular-nums; }
	.go { display: grid; place-items: center; width: 32px; border-radius: 3px; color: var(--ink2); background: rgba(243, 243, 239, .9); text-decoration: none; }
	.go:hover { color: var(--ink); background: #fff; }
	.without { margin-top: 6px; display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; font-size: 12.5px; color: var(--ink2); }
	.icons { display: inline-flex; gap: 8px; font-size: 16px; color: var(--ink); }
	.struck { position: relative; display: inline-flex; }
	.struck svg { position: absolute; inset: -2px; width: calc(100% + 4px); height: calc(100% + 4px); }
	.struck line { stroke: var(--ink); stroke-width: 2.2; stroke-linecap: round; }
	.say-n { display: flex; gap: 5px; margin-top: 4px; }
	.say-n i { width: 18px; height: 3px; border-radius: 2px; background: var(--rule); }
	.say-n i.on { background: var(--ink); }
	.tags { position: fixed; inset: 0; pointer-events: none; z-index: 2; }
	.tag {
		position: fixed; transform: translate(-50%, 0); display: inline-flex; align-items: center; gap: 6px; padding: 4px 9px; white-space: nowrap;
		border-radius: 3px; background: rgba(255, 255, 255, .94); font-size: 13px; font-weight: 600; color: var(--ink);
		box-shadow: 0 4px 14px rgba(20, 32, 45, .12); transition: opacity .3s;
	}
	.tag :global(svg) { width: 14px; height: 14px; }
	.tag[data-k="human"] { color: var(--rq1); } .tag[data-k="ai"] { color: var(--rq2); }
	.tag.small { font-size: 11.5px; font-weight: 500; padding: 2px 7px; color: var(--ink2); }
	.tag.lit { color: var(--rq3); font-size: 14px; }
	.tag.lit b { color: var(--ink); }
	.tip { position: fixed; z-index: 5; transform: translate(16px, -50%); display: grid; gap: 4px; max-width: 280px; padding: 10px 12px; background: #fff; border-radius: 3px; box-shadow: 0 6px 20px rgba(20, 32, 45, .14); font-size: 13px; line-height: 1.45; color: var(--ink2); pointer-events: none; }
	.tip.flip { transform: translate(calc(-100% - 16px), -50%); }
	.tip b { font-size: 14px; color: var(--ink); }
	.steps { position: absolute; inset: 0; pointer-events: none; }
	.step { height: 90vh; }
	@media (max-width: 860px) {
		.panel { top: 12px; transform: none; width: auto; right: 0; gap: 6px; }
		.lead { font-size: 16px; }
		.fact, .without { display: none; }
		.row { padding: 8px 10px; grid-template-columns: 26px minmax(0, 1fr); }
		.n { width: 26px; height: 26px; font-size: 13px; }
		.t { font-size: 15px; }
	}
	@media (prefers-reduced-motion: reduce) { li, .row, .tag { transition: none; } }
</style>
