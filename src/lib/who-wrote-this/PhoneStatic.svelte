<script lang="ts">
	// One scrollytelling section on phones (screens up to 600 px wide; +page.svelte decides), as a column of still
	// slides in plain native scroll: no pinning, no canvas, no script (Atrey, 16 Nov: "a super static option for phones",
	// after coauthors found the pinned sections janky there). Each slide is the live section at one step, shot at 390x844
	// by build_phone_slides.mjs in the private llm-detectors repo (docs/launch_20261116/tools), which also writes the
	// manifest (phone_slides.json). The step's words stay text: the image's alt is the narration. A slide whose picture
	// shows a footnote mark gets a small link to that note under it, since a mark in a picture cannot be tapped.
	// The group keeps the live section's id, so the header's section links land on it.
	type Slide = { src: string; w: number; h: number; kind: string; step?: number; of?: number; text: string; notes?: number[] };
	let { id, title, slides, eager = false }: { id: string; title: string; slides: Slide[]; eager?: boolean } = $props();
</script>

<section class="ps" {id} aria-labelledby="{id}-ps-h">
	<h2 class="vh" id="{id}-ps-h">{title}</h2>
	{#each slides as s, i}
		<figure class="slide" class:band={s.kind !== "step"}>
			<img
				src={s.src} width={s.w} height={s.h} alt={s.text} decoding="async"
				loading={eager && i === 0 ? "eager" : "lazy"}
			/>
			{#if s.notes?.length}
				<figcaption class="nts">{#each s.notes as n}<a href="#fn-{n}">Note {n}</a>{/each}</figcaption>
			{/if}
		</figure>
	{/each}
</section>

<style>
	/* full bleed: a slide is the whole phone screen, its own 16px gutters included */
	.ps { width: 100vw; margin-left: calc(50% - 50vw); display: grid; justify-items: center; }
	.slide { margin: 0; width: 100%; max-width: 480px; }
	img { display: block; width: 100%; height: auto; background: #E8E8E3; }
	.band img { background: #14202D; }
	/* consecutive steps read as separate pictures: a hairline between them */
	.slide:not(.band) + .slide:not(.band) { margin-top: 12px; padding-top: 12px; border-top: 1px solid #D3D3CB; }
	.band + .slide, .slide + .band { margin-top: 12px; }
	.nts { display: flex; justify-content: flex-end; gap: 4px; padding: 0 12px; }
	.nts a { padding: 6px 4px; font-size: 12px; line-height: 1; color: #5A6270; text-decoration: underline; text-underline-offset: 3px; text-decoration-color: #B0B0B0; }
	.vh { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
</style>
