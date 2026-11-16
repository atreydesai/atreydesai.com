<script lang="ts">
	// Hero art, fingerprint variant. The image is Codex filler until Claude Fable 5.2 makes the real art.
	// The print's ridges are writing, and a lens deciphers them. Each level glides the lens to a passage from the
	// paper's example table and shows the model's answer; on hover the lens follows the pointer and reads
	// whatever paper sentence lies under it.
	import { onMount } from "svelte";
	import Icon from "./Icon.svelte";
	import C from "./content.json";

	let { level = 0 }: { level?: number } = $props();

	const D = C.art.decipher;
	const IMG = "/images/who-wrote-this/art/fp_hero_a.webp"; // 830 x 1024, ink on transparent
	const AR = 830 / 1024;
	const MAG = 2.3;
	const LENS = 176;
	// where the lens rests for each level, as a fraction of the print (on dense ridges)
	const SPOTS: [number, number][] = [[0.5, 0.5], [0.33, 0.3], [0.68, 0.5], [0.42, 0.74]];
	const COLORS = ["#14202D", "#C85A82", "#461E47", "#437E8E"];
	// what the lens can read on hover: the page's own paper sentences
	const POOL = [...C.lede.map((s) => s.t), ...C.levels.items.map((i) => i.t + "."), ...D.map((d) => d.excerpt.t), C.levels.lead.t + "."];

	let box: HTMLElement;
	let w = $state(0), h = $state(0);
	let lx = $state(0), ly = $state(0);
	let hover = $state<{ x: number; y: number } | null>(null);
	let typed = $state(0);
	let text = $state("");
	let reduce = false;

	const fit = $derived.by(() => {
		const ih = Math.min(h, w / AR), iw = ih * AR;
		return { iw, ih, ox: (w - iw) / 2, oy: (h - ih) / 2 };
	});
	const now = $derived(level > 0 ? D[level - 1] : null);
	const color = $derived(hover ? COLORS[0] : COLORS[level]);

	// what the lens is reading changes: retype it
	function read(t: string) {
		if (t === text) return;
		text = t;
		typed = reduce ? t.length : 0;
	}
	$effect(() => {
		if (hover) {
			const k = Math.abs(Math.floor(hover.x / 70) * 7 + Math.floor(hover.y / 46) * 13) % POOL.length;
			read(POOL[k]);
		} else read(now ? now.excerpt.t : "");
	});

	onMount(() => {
		reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
		let raf = 0, t0 = performance.now(), lastType = 0;
		const measure = () => {
			w = box.clientWidth; h = box.clientHeight;
			if (!lx && !ly) { lx = w / 2; ly = h / 2; } // start centred, in case frames are slow to come
		};
		measure();
		const ro = new ResizeObserver(measure);
		ro.observe(box);
		const tick = (t: number) => {
			const f = fit;
			let tx: number, ty: number;
			if (hover) { tx = hover.x; ty = hover.y; }
			else if (level > 0) { tx = f.ox + f.iw * SPOTS[level][0]; ty = f.oy + f.ih * SPOTS[level][1]; }
			else { // idle: drift slowly over the print
				const s = (t - t0) / 1000;
				tx = f.ox + f.iw * (0.5 + 0.2 * Math.sin(s * 0.31)); ty = f.oy + f.ih * (0.52 + 0.22 * Math.sin(s * 0.23 + 1));
			}
			const k = reduce ? 1 : hover ? 0.35 : 0.06;
			lx += (tx - lx) * k; ly += (ty - ly) * k;
			if (typed < text.length && t - lastType > 34) { typed++; lastType = t; }
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => { cancelAnimationFrame(raf); ro.disconnect(); };
	});

	function move(e: PointerEvent) {
		const r = box.getBoundingClientRect();
		hover = { x: e.clientX - r.left, y: e.clientY - r.top };
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="fp" bind:this={box} onpointermove={move} onpointerleave={() => (hover = null)} style:--c={color}>
	<img class="print" src={IMG} alt="" style:left="{fit.ox}px" style:top="{fit.oy}px" style:width="{fit.iw}px" style:height="{fit.ih}px" />
	<div class="lens" style:left="{lx - LENS / 2}px" style:top="{ly - LENS / 2}px" style:width="{LENS}px" style:height="{LENS}px">
		<div
			class="mag"
			style:background-image="url({IMG})"
			style:background-size="{fit.iw * MAG}px {fit.ih * MAG}px"
			style:background-position="{-((lx - fit.ox) * MAG - LENS / 2)}px {-((ly - fit.oy) * MAG - LENS / 2)}px"
		></div>
		{#if text}<p class="read">{text.slice(0, typed)}<span class="caret"></span></p>{/if}
	</div>
	{#if now && !hover}
		{#key level}
			<div class="answer" style:left="{Math.min(Math.max(lx - 100, 0), w - 220)}px" style:top="{ly + LENS / 2 + 12}px">
				{#each now.answers as a}
					<span class="chip"><Icon name={a.icon} /><span class="lab">{a.label}</span><b>{a.verdict}</b></span>
				{/each}
			</div>
		{/key}
	{/if}
	<span class="hint">Move over the print</span>
</div>

<style>
	.fp { position: absolute; inset: 0; cursor: none; touch-action: pan-y; }
	.print { position: absolute; user-select: none; pointer-events: none; animation: press 1.8s cubic-bezier(.2, .7, .2, 1) both; }
	@keyframes press {
		from { clip-path: ellipse(0% 0% at 52% 58%); filter: blur(5px); transform: scale(1.04); opacity: .2; }
		60% { filter: blur(0); }
		to { clip-path: ellipse(75% 75% at 52% 58%); filter: none; transform: none; opacity: 1; }
	}
	.lens {
		position: absolute; border-radius: 50%; overflow: hidden; pointer-events: none;
		border: 2.5px solid var(--c); box-shadow: 0 10px 30px rgba(20, 32, 45, .22), inset 0 0 0 6px rgba(255, 255, 255, .55);
		background: #F4F1EA; transition: border-color .4s; animation: lens-in 1s 1.2s both;
	}
	@keyframes lens-in { from { opacity: 0; transform: scale(.6); } to { opacity: 1; transform: none; } }
	.mag { position: absolute; inset: 0; background-repeat: no-repeat; opacity: .55; }
	.read {
		position: absolute; inset: 0; display: grid; place-content: center; padding: 26px 22px; text-align: center;
		font: 600 13.5px/1.45 ui-monospace, "SF Mono", Menlo, monospace; color: var(--c); letter-spacing: -0.01em;
		text-shadow: 0 0 6px #F4F1EA, 0 0 2px #F4F1EA; transition: color .4s;
	}
	.caret { display: inline-block; width: 7px; height: 1.05em; margin-left: 1px; vertical-align: -2px; background: var(--c); animation: blink 1s steps(2) infinite; }
	@keyframes blink { 50% { opacity: 0; } }
	.answer { position: absolute; display: grid; gap: 6px; width: 220px; animation: rise .5s .3s both; pointer-events: none; }
	@keyframes rise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
	.chip {
		display: flex; align-items: center; gap: 8px; padding: 7px 11px; border-radius: 3px; background: #fff;
		border-left: 3px solid var(--c); font-size: 13px; box-shadow: 0 4px 14px rgba(20, 32, 45, .1);
	}
	.chip :global(svg) { width: 15px; height: 15px; color: var(--c); }
	.lab { color: var(--ink2); }
	.chip b { margin-left: auto; font-weight: 600; color: var(--ink); }
	.hint { position: absolute; right: 8px; bottom: 4px; font-size: 12px; color: var(--ink2); opacity: .8; }
	@media (prefers-reduced-motion: reduce) { .print, .lens, .answer { animation: none; } .caret { animation: none; } }
	@media (hover: none) { .fp { cursor: auto; } .hint { display: none; } }
</style>
