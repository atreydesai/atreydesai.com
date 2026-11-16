<script lang="ts">
	// Dev preview of the hero fingerprint renderer (src/lib/who-wrote-this/print/fingerprint.ts), driven the way the
	// host will drive it. Keys 0-3 or the buttons set the level. ?level=N pins a state, ?still is reduced motion,
	// ?dpr=2 forces the backing scale, ?lens=x,y parks the lens.
	import { onMount } from "svelte";
	import C from "$lib/who-wrote-this/content.json";
	import { createPrint } from "$lib/who-wrote-this/print/fingerprint";
	import type { Anchor, Box } from "$lib/who-wrote-this/print/contract";

	const text: string[] = [
		...C.lede.map((s) => s.t),
		C.levels.lead.t,
		...C.levels.items.flatMap((i) => [i.t + ".", i.fact]),
		C.sections[0].example.text.map((s) => s.t).join(""),
		...C.timeline.steps.map((s) => s.t),
		...C.which_ai.steps.map((s) => s.t),
		...C.art.decipher.map((d) => d.excerpt.t),
		C.closing.t,
	];
	const labs = ["Anthropic", "OpenAI", "Google", "Alibaba", "DeepSeek", "Moonshot", "Zhipu", "MiniMax", "Mistral", "xAI", "Cohere"];
	const litText = C.art.decipher[2].excerpt.t;

	let canvas: HTMLCanvasElement;
	let level = $state(0);
	let anchors = $state<Anchor[]>([]);
	let ms = $state("");
	let hover = $state("");
	let quiet = $state<Box>({ x: 0, y: 0, w: 0, h: 0 });
	let narrow = $state(false);

	onMount(() => {
		const q = new URLSearchParams(location.search);
		level = Math.max(0, Math.min(3, +(q.get("level") ?? 0)));
		const still = q.has("still") || matchMedia("(prefers-reduced-motion: reduce)").matches;
		const forced = +(q.get("dpr") ?? 0);
		const parked = q.get("lens")?.split(",").map(Number);
		const print = createPrint({
			text, labs, litText,
			colors: { human: "#C85A82", ai: "#461E47", lit: "#437E8E", ink: "#14202D", labs: ["#C85A82", "#437E8E", "#461E47"], other: "#8A8F98" },
		});
		const ctx = canvas.getContext("2d")!;
		let W = 0, H = 0, dpr = 1, stage: Box = { x: 0, y: 0, w: 0, h: 0 };
		let pointer: { x: number; y: number } | null = parked ? { x: parked[0], y: parked[1] } : null;
		function resize() {
			dpr = forced || Math.min(2, devicePixelRatio || 1);
			W = innerWidth; H = innerHeight;
			canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
			narrow = W < 760;
			// the host's panel: left ~32% when wide, the top when narrow
			quiet = narrow ? { x: 0, y: 0, w: W, h: H * 0.36 } : { x: 0, y: 0, w: W * 0.32, h: H };
			stage = narrow ? { x: 8, y: H * 0.4, w: W - 16, h: H * 0.57 } : { x: W * 0.36, y: 28, w: W * 0.62, h: H - 56 };
		}
		resize();
		addEventListener("resize", resize);
		const key = (ev: KeyboardEvent) => { if ("0123".includes(ev.key) && ev.key.length === 1) level = +ev.key; };
		addEventListener("keydown", key);
		const move = (ev: PointerEvent) => { pointer = { x: ev.clientX, y: ev.clientY }; };
		const leave = () => { if (!parked) pointer = null; };
		addEventListener("pointermove", move);
		addEventListener("pointerdown", move);
		document.documentElement.addEventListener("pointerleave", leave);

		let raf = 0, last = performance.now(), cpu = 0, gap = 0, worst = 0, n = 0, tick = 0;
		function frame(now: number) {
			const dt = (now - last) / 1000; last = now;
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			ctx.clearRect(0, 0, W, H);
			const t0 = performance.now();
			print.draw(ctx, { level, t: now / 1000, dt, view: { w: W, h: H, dpr }, stage, quiet: [quiet], pointer, enter: 1, reduce: still });
			const c = performance.now() - t0;
			cpu += c; gap += dt * 1000; worst = Math.max(worst, c); n++;
			if (now - tick > 500) {
				ms = `draw ${(cpu / n).toFixed(2)} ms (worst ${worst.toFixed(1)}) · frame ${(gap / n).toFixed(1)} ms · dpr ${dpr}`;
				(window as any).__print = { draw: cpu / n, worst, frame: gap / n, dpr };
				cpu = gap = worst = n = 0; tick = now;
			}
			anchors = print.anchors();
			hover = pointer ? (print.hit(pointer.x, pointer.y)?.id ?? "") : "";
			raf = requestAnimationFrame(frame);
		}
		raf = requestAnimationFrame(frame);
		return () => {
			cancelAnimationFrame(raf); print.dispose?.();
			removeEventListener("resize", resize); removeEventListener("keydown", key);
			removeEventListener("pointermove", move); removeEventListener("pointerdown", move);
			document.documentElement.removeEventListener("pointerleave", leave);
		};
	});

	const label = (id: string) => (id === "human" ? "Human" : id === "ai" ? "AI" : id === "lit" ? "lit" : id.replace("lab:", ""));
</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,400;0,14..32,500;0,14..32,600;1,14..32,400;1,14..32,500&display=swap" />
	{@html `<style>html,body{margin:0;overflow:hidden;height:100%}html body{background-color:#E8E8E3;background-image:radial-gradient(rgba(20,32,45,.07) 1px,transparent 1.2px);background-size:18px 18px}</style>`}
</svelte:head>

<div class="root">
	<canvas bind:this={canvas}></canvas>
	<div class="quiet" style="left:{quiet.x}px; top:{quiet.y}px; width:{quiet.w}px; height:{quiet.h}px">quiet</div>
	{#each anchors as a (a.id)}
		{#if a.alpha > 0.02}
			<span class="tag" class:small={a.r < 40} style="left:{a.x}px; top:{a.y + a.r + (narrow ? 2 : 5)}px; opacity:{a.alpha}">{label(a.id)}</span>
		{/if}
	{/each}
	<div class="bar">
		{#each [0, 1, 2, 3] as n}<button class:on={level === n} onclick={() => (level = n)}>{n}</button>{/each}
		<span>{ms}</span>
		{#if hover}<b>{hover}</b>{/if}
	</div>
</div>

<style>
	.root { position: fixed; inset: 0; z-index: 1000; background: #E8E8E3 radial-gradient(rgba(20, 32, 45, 0.07) 1px, transparent 1.2px) 0 0 / 18px 18px; font-family: Inter, system-ui, sans-serif; color: #14202D; cursor: crosshair; }
	canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
	.quiet { position: absolute; box-sizing: border-box; border: 1px dashed rgba(20, 32, 45, 0.25); font-size: 11px; padding: 6px; color: rgba(20, 32, 45, 0.45); pointer-events: none; }
	.tag { position: absolute; transform: translateX(-50%); font-size: 13px; font-weight: 600; letter-spacing: -0.01em; white-space: nowrap; pointer-events: none; }
	.tag.small { font-size: 10px; font-weight: 500; }
	.bar { position: absolute; left: 10px; bottom: 10px; display: flex; gap: 6px; align-items: center; font-size: 11px; font-variant-numeric: tabular-nums; }
	.bar button { width: 26px; height: 26px; border: 1px solid #14202D; background: #F3F3EF; border-radius: 2px; font: inherit; font-weight: 600; cursor: pointer; }
	.bar button.on { background: #14202D; color: #fff; }
	.bar b { font-weight: 600; }
</style>
