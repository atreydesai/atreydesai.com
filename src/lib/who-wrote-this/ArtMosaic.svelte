<script lang="ts">
	// Hero art, mosaic variant. The image is Codex filler until Claude Fable 5.2 makes the real art.
	// Three nested arches are the three levels, from the widest question (human or AI?) to the narrowest
	// (which human?), with one lit figure at the centre. The tesserae are laid from the light outward; each level
	// lights its arch and dims the rest. Hovering an arch lifts it; clicking it plays that level.
	import { onMount } from "svelte";
	import M from "./art_mosaic.json";
	import C from "./content.json";

	let { level = 0, onpick }: { level?: number; onpick?: (n: number) => void } = $props();

	const BASE = "/images/who-wrote-this/art/mo_hero.webp";
	const [IW, IH] = M.size;
	const COLORS = ["", "#C85A82", "#7A3E7B", "#4FA3B8"];
	const LAYERS = ([1, 2, 3] as const).map((n) => ({ n, ...M.layers[String(n) as "1" | "2" | "3"], t: C.levels.items[n - 1].t }));

	let box: HTMLElement, canvas: HTMLCanvasElement;
	let w = $state(0), h = $state(0);
	let hot = $state(0);

	const fit = $derived.by(() => {
		const s = Math.min(w / IW, h / IH);
		return { s, iw: IW * s, ih: IH * s, ox: (w - IW * s) / 2, oy: (h - IH * s) / 2 };
	});
	const pct = (v: number, of: number) => `${(v / of) * 100}%`;

	// which arch is under the pointer: the arches nest, so the innermost box that contains it
	function archAt(e: MouseEvent) {
		const r = box.getBoundingClientRect(), f = fit;
		const x = (e.clientX - r.left - f.ox) / f.s, y = (e.clientY - r.top - f.oy) / f.s;
		for (const L of [...LAYERS].reverse()) if (x > L.x - 12 && x < L.x + L.w + 12 && y > L.y - 12 && y < M.horizon + 60) return L.n;
		return 0;
	}

	onMount(() => {
		const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
		const measure = () => { w = box.clientWidth; h = box.clientHeight; };
		measure();
		const ro = new ResizeObserver(measure);
		ro.observe(box);
		if (reduce) { canvas.remove(); return () => ro.disconnect(); }
		// lay the tesserae: the frame starts as bare ground and the tiles appear from the lit figure outward
		const ctx = canvas.getContext("2d")!;
		let raf = 0;
		const t0 = performance.now();
		let cells: { x: number; y: number; at: number }[] = [];
		let size = 0;
		const build = () => {
			const f = fit, dpr = Math.min(2, devicePixelRatio || 1);
			canvas.width = Math.round(f.iw * dpr); canvas.height = Math.round(f.ih * dpr);
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			size = Math.max(10, f.iw / 46);
			cells = [];
			const cx = 460 * f.s, cy = 535 * f.s, far = Math.hypot(f.iw, f.ih) * 0.62;
			for (let y = 0; y < f.ih; y += size)
				for (let x = 0; x < f.iw; x += size)
					cells.push({ x, y, at: (Math.hypot(x - cx, y - cy) / far) * 1500 + Math.random() * 380 });
		};
		const draw = (t: number) => {
			if (!cells.length || size !== Math.max(10, fit.iw / 46)) build();
			canvas.style.opacity = "1";
			const el = t - t0 - 250;
			ctx.clearRect(0, 0, fit.iw, fit.ih);
			let left = 0;
			for (const c of cells) {
				const a = 1 - Math.min(1, Math.max(0, (el - c.at) / 260));
				if (a <= 0) continue;
				left++;
				ctx.fillStyle = `rgba(232,232,227,${a})`;
				const g = (1 - a) * size * 0.35;
				ctx.fillRect(c.x - 0.5 + g / 2, c.y - 0.5 + g / 2, size + 1 - g, size + 1 - g);
			}
			if (left === 0 && el > 0) { canvas.remove(); return; }
			raf = requestAnimationFrame(draw);
		};
		raf = requestAnimationFrame(draw);
		// the cover only shows once a frame has drawn it, and goes regardless after the entrance would have ended
		const done = setTimeout(() => { cancelAnimationFrame(raf); canvas.remove(); }, 3200);
		return () => { cancelAnimationFrame(raf); clearTimeout(done); ro.disconnect(); };
	});
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div
	class="mo"
	bind:this={box}
	onpointermove={(e) => (hot = archAt(e))}
	onpointerleave={() => (hot = 0)}
	onclick={(e) => { const n = archAt(e); if (n) onpick?.(n); }}
	class:pointer={hot > 0}
>
	<div class="frame" class:lit={level > 0} style:left="{fit.ox}px" style:top="{fit.oy}px" style:width="{fit.iw}px" style:height="{fit.ih}px">
		<img class="base" src={BASE} alt="" />
		<div class="water" style:top={pct(M.horizon, IH)}></div>
		<div class="dim"></div>
		{#each LAYERS as L}
			<img
				class="arch"
				class:on={level === L.n}
				class:hot={hot === L.n && level !== L.n}
				src="/images/who-wrote-this/art/mo_arch_{L.n}.webp"
				alt=""
				style:--g={COLORS[L.n]}
				style:left={pct(L.x, IW)}
				style:top={pct(L.y, IH)}
				style:width={pct(L.w, IW)}
				style:height={pct(L.h, IH)}
			/>
		{/each}
		<div class="glow" style:left={pct(461, IW)} style:top={pct(532, IH)}></div>
		{#each LAYERS as L}
			{#if level === L.n || (hot === L.n && level === 0)}
				<span class="tag" style:--g={COLORS[L.n]} style:left={pct(L.x + L.w / 2, IW)} style:top={pct(L.y, IH)}><b>{L.n}</b>{L.t}</span>
			{/if}
		{/each}
		<canvas bind:this={canvas}></canvas>
	</div>
</div>

<style>
	.mo { position: absolute; inset: 0; }
	.mo.pointer { cursor: pointer; }
	.frame { position: absolute; border-radius: 4px; overflow: hidden; isolation: isolate; box-shadow: 0 18px 50px rgba(20, 32, 45, .25), 0 0 0 1px rgba(20, 32, 45, .08); }
	.base { position: absolute; inset: 0; width: 100%; height: 100%; }
	canvas { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; }
	.water {
		position: absolute; left: 0; right: 0; bottom: 0; mix-blend-mode: screen; opacity: .5;
		background: repeating-linear-gradient(100deg, transparent 0 40px, rgba(255, 214, 120, .12) 52px, transparent 70px);
		background-size: 200% 100%; animation: shimmer 9s linear infinite;
	}
	@keyframes shimmer { to { background-position: -400px 0; } }
	.dim { position: absolute; inset: 0; background: rgba(16, 12, 28, .5); opacity: 0; transition: opacity .6s; }
	.frame.lit .dim { opacity: 1; }
	.arch { position: absolute; opacity: 0; transition: opacity .6s, filter .6s; pointer-events: none; }
	.arch.on { opacity: 1; filter: brightness(1.18) drop-shadow(0 0 6px var(--g)) drop-shadow(0 0 18px var(--g)); }
	.arch.hot { opacity: 1; filter: brightness(1.1) drop-shadow(0 0 8px var(--g)); }
	.glow {
		position: absolute; width: 9%; aspect-ratio: 1; transform: translate(-50%, -50%); border-radius: 50%; pointer-events: none;
		background: radial-gradient(circle, rgba(255, 236, 170, .75), rgba(255, 210, 120, 0) 70%); mix-blend-mode: screen;
		animation: breathe 3.4s ease-in-out infinite;
	}
	@keyframes breathe { 50% { opacity: .45; transform: translate(-50%, -50%) scale(.85); } }
	.tag {
		position: absolute; transform: translate(-50%, calc(-100% - 8px)); display: inline-flex; align-items: center; gap: 8px; white-space: nowrap;
		padding: 5px 10px 5px 5px; border-radius: 3px; background: rgba(255, 255, 255, .94); color: var(--ink); font-size: 13px; font-weight: 600;
		box-shadow: 0 6px 18px rgba(0, 0, 0, .25); animation: rise .4s both; pointer-events: none;
	}
	.tag b { display: inline-grid; place-items: center; width: 20px; height: 20px; border-radius: 2px; background: var(--g); color: #fff; font-size: 11px; }
	@keyframes rise { from { opacity: 0; transform: translate(-50%, calc(-100% - 2px)); } }
	@media (prefers-reduced-motion: reduce) { .water, .glow, .tag { animation: none; } .dim, .arch { transition: none; } }
</style>
