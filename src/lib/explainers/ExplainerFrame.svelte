<script lang="ts">
	// The plate every research explainer is drawn on: a 240-unit square SVG,
	// a progress rail on the card, and numbered step chips at stage size.
	//
	// Playback is live by default. The loop runs while the plate is on screen
	// and the tab is visible, pauses offscreen, and never autoplays under
	// Reduce Motion (the poster, the loop's first frame, is server-rendered, so
	// a still plate is always complete). GSAP loads on first view only.
	//
	// The step chips are the only stage control: choosing a step holds the
	// plate on that step's settled frame, and choosing it again lets the loop
	// carry on from there.
	import { onMount, type Snippet } from "svelte";
	import { prefersReducedMotion } from "svelte/motion";
	import { dev } from "$app/environment";
	import { loadGsap, type Scene, type Timeline } from "./motion";

	interface Props {
		scene: Scene;
		/** Accessible description of the whole animation. */
		label: string;
		/** "card" is the thumbnail; "stage" adds the step chips (lightbox). */
		size?: "card" | "stage";
		/** Held by the parent: the card's pause control, or an open lightbox. */
		paused?: boolean;
		/** Another card is being pointed at or focused: rest on the first frame. */
		resting?: boolean;
		children: Snippet;
	}

	let { scene, label, size = "card", paused = false, resting = false, children }: Props = $props();

	const RAIL_Y = 237.5;
	const RAIL_X0 = 14;
	const RAIL_X1 = 226;
	const RAIL_GAP = 3;
	/** How long the poster holds before the first step moves, on first play
	 *  and after resting. Later loops keep the full first beat as a breather. */
	const POSTER_HOLD = 0.5;

	let svg: SVGSVGElement;
	let tl = $state.raw<Timeline | null>(null);
	let visible = $state(false);
	let pageHidden = $state(false);
	/** The step the viewer chose to hold on, if any. */
	let held = $state<number | null>(null);
	let frozen = $state(false);
	let time = $state(0);

	const reduce = $derived(prefersReducedMotion.current);
	const playing = $derived(
		!!tl && visible && !pageHidden && !reduce && held === null && !frozen && !paused && !resting,
	);

	const spans = $derived(
		scene.beats.map((beat, i) => {
			const end = scene.beats[i + 1]?.at ?? scene.duration;
			return { start: beat.at, end, fill: Math.min(1, Math.max(0, (time - beat.at) / (end - beat.at))) };
		}),
	);

	// Rail segments: one per beat, sized to the beat's share of the loop.
	const segments = $derived(
		spans.map(({ start, end, fill }) => {
			const span = RAIL_X1 - RAIL_X0;
			const x1 = RAIL_X0 + (start / scene.duration) * span;
			const x2 = RAIL_X0 + (end / scene.duration) * span - RAIL_GAP;
			return { x1, x2, fill };
		}),
	);

	const current = $derived.by(() => {
		let index = 0;
		scene.beats.forEach((beat, i) => {
			if (time >= beat.at) index = i;
		});
		return index;
	});

	// Every first beat is the still poster, so starting there would look like
	// nothing is animating; start just before the first change instead.
	const lead = $derived(Math.max(0, (scene.beats[1]?.at ?? 0) - POSTER_HOLD));

	let context: gsap.Context | null = null;
	let building = false;

	async function ensureTimeline() {
		if (tl || building) return;
		building = true;
		const gsap = await loadGsap();
		if (!svg?.isConnected) return;
		let built: Timeline | null = null;
		context = gsap.context(() => {
			const timeline = gsap.timeline({
				paused: true,
				repeat: -1,
				onUpdate: () => (time = timeline.time()),
			});
			for (const beat of scene.beats) timeline.addLabel(beat.id, beat.at);
			scene.build(gsap, timeline, svg);
			// Pad to the declared length so every loop is the same duration.
			if (timeline.duration() < scene.duration) {
				timeline.set({}, {}, scene.duration);
			}
			built = timeline;
		}, svg);
		tl = built;
		(tl as Timeline | null)?.seek(lead, false);
		// Dev-only: ?xp-t=<seconds> freezes every plate on one frame, for
		// visual QA and for exporting the static poster images.
		const freeze = dev ? new URLSearchParams(location.search).get("xp-t") : null;
		if (freeze !== null && tl) {
			frozen = true;
			(tl as Timeline).seek(Number(freeze), false);
		}
		// Dev-only handle for visual QA: scripts drive every plate through any
		// time, or through each step's settled frame.
		if (dev && tl) {
			const timeline = tl as Timeline;
			const w = window as unknown as { __xp?: unknown[] };
			devHandle = {
				svg,
				size,
				duration: scene.duration,
				beats: scene.beats.map((_, i) => settled(i)),
				starts: scene.beats.map((b) => b.at),
				seek: (t: number) => {
					frozen = true;
					timeline.seek(t, false);
				},
			};
			(w.__xp ??= []).push(devHandle);
		}
	}

	let devHandle: object | null = null;

	onMount(() => {
		const onVisibility = () => (pageHidden = document.hidden);
		onVisibility();
		document.addEventListener("visibilitychange", onVisibility);

		// Load a little before the plate arrives; play only while it's on screen.
		const near = new IntersectionObserver(
			([entry]) => {
				// A still card under Reduce Motion never needs GSAP; the
				// stage always does, for its step chips.
				if (entry.isIntersecting && (size === "stage" || !reduce)) void ensureTimeline();
			},
			{ rootMargin: "200px" },
		);
		const onScreen = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting));
		near.observe(svg);
		onScreen.observe(svg);

		return () => {
			near.disconnect();
			onScreen.disconnect();
			document.removeEventListener("visibilitychange", onVisibility);
			context?.revert();
			if (devHandle) {
				const w = window as unknown as { __xp?: unknown[] };
				w.__xp = w.__xp?.filter((h) => h !== devHandle);
			}
		};
	});

	// Turning Reduce Motion off mid-session should start the loop.
	$effect(() => {
		if (!reduce && visible) void ensureTimeline();
	});

	// While another card has the viewer's attention, this one goes back to
	// its first frame and waits there.
	$effect(() => {
		if (tl && resting) tl.pause().seek(lead, false);
	});

	$effect(() => {
		if (!tl) return;
		if (playing) tl.play();
		else tl.pause();
	});

	/** The fully composed frame of a step: just before the next step begins. */
	function settled(index: number) {
		const beat = scene.beats[index];
		if (beat.hold !== undefined) return beat.hold;
		const next = scene.beats[index + 1]?.at;
		return next !== undefined ? next - 0.3 : beat.at + 1.6;
	}

	function choose(index: number) {
		if (!tl) return;
		if (held === index && !reduce) {
			// Second press: let the loop carry on from this step.
			held = null;
			return;
		}
		held = index;
		tl.seek(settled(index), false);
	}
</script>

<figure class="xp xp-{size}">
	<svg
		bind:this={svg}
		class="xp-plate"
		viewBox="0 0 240 240"
		role="img"
		aria-label={label}
	>
		{@render children()}

		{#if size === "card"}
			<g class="xp-rail" aria-hidden="true">
				{#each segments as seg}
					<line class="xp-rail-track" x1={seg.x1} x2={seg.x2} y1={RAIL_Y} y2={RAIL_Y} />
					{#if seg.fill > 0}
						<line
							class="xp-rail-fill"
							x1={seg.x1}
							x2={seg.x1 + (seg.x2 - seg.x1) * seg.fill}
							y1={RAIL_Y}
							y2={RAIL_Y}
						/>
					{/if}
				{/each}
			</g>
		{/if}
	</svg>

	{#if size === "stage"}
		<ol class="xp-steps" aria-label="Steps">
			{#each scene.beats as beat, i}
				{@const isCurrent = i === current}
				<li class:xp-step-item-current={isCurrent}>
					<button
						type="button"
						class="xp-step"
						class:xp-step-current={isCurrent}
						class:xp-step-held={held === i}
						style="--fill: {held === null ? spans[i].fill : isCurrent ? 1 : 0}"
						aria-current={isCurrent ? "step" : undefined}
						aria-pressed={held === i}
						aria-label="Step {i + 1}: {beat.label}{held === i && !reduce ? ', held; press again to play on' : ''}"
						disabled={!tl}
						onclick={() => choose(i)}
					>
						<span class="xp-step-index" aria-hidden="true">{i + 1}</span>
						<span class="xp-step-label" aria-hidden="true">{beat.label}</span>
					</button>
				</li>
			{/each}
		</ol>
	{/if}
</figure>

<style>
	/* Explainer palette: the site's cream/ink ramps plus one accent, with the
	   support hues carrying fixed meanings across every explainer:
	     accent  the paper's subject (the LLM, the model, the claim)
	     steel   the human / reference side
	     sage    ground truth (the correct answer, the child benchmark)
	   Dark values use the -light shades, which clear 4.5:1 on ink-800. */
	.xp {
		--xp-surface: #fffdfb; /* cream-50, surface-raised */
		--xp-strong: #1a1a1a; /* ink-900 */
		--xp-text: #434343; /* ink-700 */
		--xp-soft: #515151; /* ink-600 */
		--xp-faint: #a4a4a4; /* ink-300, decorative */
		--xp-rule: #c8c8c8; /* ink-200 */
		--xp-wash: #faf0e6; /* cream-200 */
		--xp-accent: #e85d4c;
		--xp-accent-text: #c9462f;
		--xp-human: #3a6a91;
		--xp-truth: #3d7a55;
		--xp-bar: #1a1a1a;
		--xp-bar-text: #fdf8f3;
		margin: 0;
	}

	:global(.dark) .xp {
		--xp-surface: #383838; /* ink-800 */
		--xp-strong: #fdf8f3;
		--xp-text: #faf0e6;
		--xp-soft: #e8d5c4; /* cream-400 */
		--xp-faint: #818181;
		--xp-rule: #515151; /* ink-600 */
		--xp-wash: #434343;
		--xp-accent: #e85d4c;
		--xp-accent-text: #f18272;
		--xp-human: #779bbe;
		--xp-truth: #7bae8c;
		--xp-bar: #fdf8f3;
		--xp-bar-text: #1a1a1a;
	}

	.xp-plate {
		display: block;
		width: 100%;
		height: auto;
		aspect-ratio: 1;
		background: var(--xp-surface);
		/* Old-style figures would wobble in labels and axes. */
		font-variant-numeric: lining-nums tabular-nums;
	}

	/* Type roles inside the plate (user units; the plate is 240 wide, so at
	   the 144px card one unit is 0.6px). Nothing is set below 13 units. */
	/* Text is coloured with `color` so a stroke in the same colour, painted
	   under the fill, can thicken the glyphs: Optima has no medium weight, and
	   its regular reads thin at card size. Dark text on the light plate gets a
	   touch more than light text on the dark one. */
	.xp {
		--xp-weight: 1;
	}
	:global(.dark) .xp {
		--xp-weight: 0.75;
	}
	.xp :global(text) {
		fill: currentColor;
		stroke: currentColor;
		stroke-width: calc(var(--xp-stroke, 0px) * var(--xp-weight));
		stroke-linejoin: round;
		paint-order: stroke fill;
	}
	.xp :global(.xp-prose) {
		font-family: var(--font-prose);
		color: var(--xp-strong);
		--xp-stroke: 0.7px;
	}
	.xp :global(.xp-caption) {
		font-family: var(--font-prose);
		font-style: italic;
		font-size: 20px;
	}
	.xp :global(.xp-mono) {
		font-family: var(--font-mono);
		color: var(--xp-soft);
		--xp-stroke: 0.45px;
	}
	.xp :global(.xp-display) {
		font-family: var(--font-display);
		font-weight: 500;
		letter-spacing: -0.02em;
		--xp-stroke: 0px;
	}
	.xp :global(.xp-rule) {
		stroke: var(--xp-rule);
		stroke-width: 1.2;
		fill: none;
	}
	/* Present in the markup for later beats, revealed by the timeline. */
	.xp :global(.xp-later) {
		opacity: 0;
		visibility: hidden;
	}

	.xp-rail-track {
		stroke: var(--xp-rule);
		stroke-width: 1.6;
	}
	.xp-rail-fill {
		stroke: var(--xp-accent);
		stroke-width: 1.6;
	}

	/* Stage: the plate plus one row of step chips, on the lightbox's dark
	   overlay in either theme. */
	.xp-stage {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		width: 100%;
		container-type: inline-size;
	}
	.xp-stage .xp-plate {
		border-radius: var(--radius-media);
	}
	.xp-steps {
		display: flex;
		flex-wrap: nowrap;
		gap: var(--space-1);
		margin: 0;
		padding: 0;
		list-style: none;
		font-family: var(--font-mono);
		font-size: 0.75rem;
	}
	.xp-steps li {
		flex: 0 1 auto;
		min-width: 0;
	}
	.xp-steps li.xp-step-item-current {
		flex-shrink: 0;
	}
	.xp-step {
		position: relative;
		display: inline-flex;
		align-items: baseline;
		gap: var(--space-1-5);
		max-width: 100%;
		min-height: 1.75rem;
		padding: var(--space-1) var(--space-2);
		overflow: hidden;
		border-radius: var(--radius-control);
		background: rgb(253 248 243 / 0.08);
		color: theme("colors.cream.300");
		white-space: nowrap;
		transition:
			background-color var(--motion-fast) var(--ease-standard),
			color var(--motion-fast) var(--ease-standard);
	}
	/* The current chip fills as its step plays; held, it stays full. */
	.xp-step::after {
		content: "";
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		height: 2px;
		background: theme("colors.accent.light");
		transform: scaleX(var(--fill, 0));
		transform-origin: left;
	}
	.xp-step:hover:not(:disabled) {
		background: rgb(253 248 243 / 0.16);
		color: theme("colors.cream.100");
	}
	.xp-step-current {
		background: rgb(232 93 76 / 0.2);
		color: theme("colors.cream.100");
	}
	.xp-step-held {
		background: rgb(232 93 76 / 0.32);
	}
	.xp-step-index {
		color: theme("colors.accent.light");
	}
	.xp-step-label {
		overflow: hidden;
		text-overflow: ellipsis;
	}
	/* Narrow stage: only the current step keeps its words, so the row still
	   fits on one line. */
	@container (max-width: 34rem) {
		.xp-step:not(.xp-step-current) .xp-step-label {
			display: none;
		}
	}
	.xp-step:disabled {
		cursor: default;
		opacity: 0.5;
	}
</style>
