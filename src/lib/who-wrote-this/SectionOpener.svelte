<script lang="ts">
	// A section's chapter opener (from the section 1 mock Atrey chose): a full-bleed dark band with the chapter number,
	// the question at chapter size, the takeaway and one sentence of context, and the section's prints. Every section
	// starts with one, so each reads as its own chapter and the page has real dark masses between its light frames.
	//   <SectionOpener n={2} title="If AI, which AI?" takeaway={...} context={...} accent="#C85A82"
	//      prints={[{ family: "lab", index: 0, color: "#DC89A7", label: "Anthropic", icon: "anthropic" }, …]} />
	import Icon from "./Icon.svelte";
	import PrintMark from "./PrintMark.svelte";
	import type { SpriteOpts } from "./print/sprites";

	type P = { family: SpriteOpts["family"]; index?: number; color: string; label?: string; icon?: string; clarity?: number };
	let { n, title, takeaway, context = "", marks = [], accent = "#C85A82", prints = [] }:
		{ n: number | string; title: string; takeaway: string; context?: string; marks?: string[]; accent?: string; prints?: P[] } = $props();
	// the context sentence, with its key phrases highlighted
	const parts = $derived.by(() => {
		const out: { t: string; hl: boolean }[] = [];
		let rest = context;
		while (rest.length) {
			let at = -1, hit = "";
			for (const m of marks) { const i = rest.indexOf(m); if (i >= 0 && (at < 0 || i < at)) { at = i; hit = m; } }
			if (at < 0) { out.push({ t: rest, hl: false }); break; }
			if (at > 0) out.push({ t: rest.slice(0, at), hl: false });
			out.push({ t: hit, hl: true });
			rest = rest.slice(at + hit.length);
		}
		return out;
	});
	// prints are sized for the screen they land on (drawn after mount, so a phone never gets the desktop size)
	let mounted = $state(false);
	$effect(() => { mounted = true; });

	let wide = $state(true);
	$effect(() => { wide = innerWidth >= 980; });
	const px = $derived(prints.length > 3 ? (wide ? 150 : 96) : prints.length > 2 ? (wide ? 190 : 110) : wide ? 300 : 160);
</script>

<header class="opener" style:--accent={accent}>
	<div class="o-text">
		<p class="o-n">{n}</p>
		<h2 class="o-q">{title}</h2>
		<p class="o-t">{takeaway}</p>
		{#if context}<p class="o-d">{#each parts as p}{#if p.hl}<mark>{p.t}</mark>{:else}{p.t}{/if}{/each}</p>{/if}
	</div>
	{#if prints.length && mounted}
		<div class="o-prints" class:many={prints.length > 2} style:--cols={prints.length} aria-hidden="true">
			{#each prints as p, i}
				<figure class="o-p" style:--drop="{prints.length <= 2 && i % 2 ? 18 : 0}vh">
					<PrintMark family={p.family} index={p.index ?? 0} color={p.color} {px} clarity={p.clarity ?? 1} text={px >= 120} />
					{#if p.label}<figcaption>{#if p.icon}<Icon name={p.icon} />{/if}{p.label}</figcaption>{/if}
				</figure>
			{/each}
		</div>
	{/if}
</header>

<style>
	.opener {
		width: 100vw; margin-left: calc(50% - 50vw); min-height: 92vh; padding: 12vh max(16px, calc(50vw - 36rem)) 10vh;
		background: #14202D; color: #F3F3EF; display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); align-items: center; gap: 4vw;
	}
	.o-n { font-size: clamp(64px, 9vw, 140px); line-height: .8; font-weight: 600; letter-spacing: -0.05em; color: var(--accent); }
	.o-q { margin-top: 18px; font-size: clamp(44px, 7vw, 108px); line-height: .95; font-weight: 600; letter-spacing: -0.045em; color: #fff; text-wrap: balance; }
	.o-t { margin-top: 28px; max-width: 22ch; font-size: clamp(22px, 2.3vw, 32px); line-height: 1.2; font-weight: 500; letter-spacing: -0.02em; color: #F3F3EF; text-wrap: balance; }
	.o-d { margin-top: 18px; max-width: 46ch; font-size: 16px; line-height: 1.55; color: rgba(243, 243, 239, .62); }
	.o-prints { display: flex; justify-content: center; align-items: center; gap: 2vw; }
	.o-prints.many { display: grid; grid-template-columns: repeat(var(--cols), auto); justify-content: center; gap: 2vw; }
	.o-d :global(mark) { color: #fff; background: linear-gradient(transparent 55%, rgba(220, 137, 167, .35) 55%); font-weight: 500; }
	.o-p { display: grid; justify-items: center; gap: 14px; margin: var(--drop) 0 0; }
	.o-p figcaption { display: inline-flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 600; letter-spacing: .02em; color: #F3F3EF; }
	@media (max-width: 979px) {
		.opener { grid-template-columns: 1fr; min-height: 0; padding-top: 10vh; gap: 8vh; }
		.o-p { margin-top: calc(var(--drop) / 2); }
		.o-prints.many { grid-template-columns: repeat(min(var(--cols), 2), auto); }
	}
</style>
