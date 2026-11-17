<script lang="ts">
	// Dev preview of the hero fingerprint renderer (src/lib/who-wrote-this/print/fingerprint.ts), driven the way the
	// host will drive it. Keys 0-3 or the buttons set the level. ?level=N pins a state, ?still is reduced motion,
	// ?dpr=2 forces the backing scale, ?lens=x,y parks the lens.
	import { onMount } from "svelte";
	import C from "$lib/who-wrote-this/content.json";
	import RIDGE from "$lib/who-wrote-this/print_text.json";
	import { createPrint } from "$lib/who-wrote-this/print/fingerprint";
	import type { Anchor, Box } from "$lib/who-wrote-this/print/contract";
	import { printSprite, printAspect, setSpriteText, type SpriteOpts } from "$lib/who-wrote-this/print/sprites";

	const text: string[] = [
		...C.lede.map((s) => s.t),
		C.levels.lead.t,
		...C.levels.items.flatMap((i) => [i.t + ".", i.fact]),
		(C.sections[0].example?.text ?? []).map((s) => s.t).join(""),
		...C.timeline.steps.map((s) => s.t),
		...C.which_ai.steps.map((s) => s.t),
		...C.art.decipher.map((d) => d.excerpt.t),
		C.closing.t,
	];
	const labs = ["Anthropic", "OpenAI", "Google", "Alibaba", "DeepSeek", "Moonshot", "Zhipu", "MiniMax", "Mistral", "xAI", "Cohere"];
	const litText = C.art.decipher[2].excerpt.t;

	let canvas = $state() as HTMLCanvasElement;
	let level = $state(0);
	let anchors = $state<Anchor[]>([]);
	let ms = $state("");
	let hover = $state("");
	let quiet = $state<Box>({ x: 0, y: 0, w: 0, h: 0 });
	let narrow = $state(false);
	let card = $state<{ x: number; y: number; r: number; id: string; words: string } | null>(null);
	let gallery = $state(false);
	let shelf: HTMLDivElement | undefined = $state();
	let built = $state("");

	onMount(() => {
		const q = new URLSearchParams(location.search);
		if (q.has("gallery")) {
			// ?gallery: the small prints the other sections reuse (print/sprites.ts), with cold build times
			gallery = true;
			setSpriteText(text);
			const LAB = ["#C85A82", "#437E8E", "#461E47"], times: Record<string, number[]> = {};
			const row = (title: string, items: SpriteOpts[]) => {
				const d = document.createElement("div"); d.className = "row";
				const h = document.createElement("span"); h.textContent = title; d.append(h);
				for (const o of items) {
					const t0 = performance.now(), src = printSprite(o);
					(times[`${o.px}px${o.text ? " text" : ""}`] ??= []).push(performance.now() - t0);
					// a copy for the page: the cached canvas itself may appear in more than one row
					const cv = document.createElement("canvas"); cv.width = src.width; cv.height = src.height; cv.getContext("2d")!.drawImage(src, 0, 0);
					cv.style.width = `${o.px * printAspect()}px`; cv.style.height = `${o.px}px`;
					d.append(cv);
				}
				shelf!.append(d);
			};
			const go = () => {
				shelf!.replaceChildren();
				const CL = [0, 0.25, 0.5, 0.75, 1];
				for (const px of [16, 32]) {
					row(`labs ${px}`, labs.map((_, i) => ({ family: "lab", index: i, color: LAB[i] ?? "#8A8F98", px })));
					row(`writers ${px}`, Array.from({ length: 12 }, (_, i) => ({ family: "writer", index: i, color: "#C85A82", px })));
					for (const [fam, idx, col] of [["writer", 3, "#C85A82"], ["lab", 0, "#14202D"], ["lab", 2, "#461E47"]] as const)
						row(`clarity 0 to 1, ${fam} ${idx}, ${px}`, CL.flatMap((c) => [0, 1, 2].map((k) => ({ family: fam, index: idx + (fam === "writer" ? k : 0), color: col, px, clarity: c }))));
				}
				row("main, human, ai 64", [{ family: "main", color: "#14202D", px: 64 }, { family: "human", color: "#C85A82", px: 64 }, { family: "ai", color: "#461E47", px: 64 }]);
				row("labs 120 text", labs.map((_, i) => ({ family: "lab", index: i, color: LAB[i] ?? "#8A8F98", px: 120, text: true })));
				row("writers 120 text", Array.from({ length: 12 }, (_, i) => ({ family: "writer", index: i, color: "#C85A82", px: 120, text: true })));
				row("clarity 0 to 1, 120 text", CL.map((c) => ({ family: "writer", index: 3, color: "#437E8E", px: 120, text: true, clarity: c })));
				row("clarity 0 to 1, 120 lines", CL.map((c) => ({ family: "lab", index: 2, color: "#14202D", px: 120, clarity: c })));
				built = Object.entries(times).map(([k, v]) => `${k}: ${(v.reduce((a, b) => a + b, 0) / v.length).toFixed(2)} ms avg, ${Math.max(...v).toFixed(1)} worst (${v.length})`).join(" · ");
				(window as any).__sprites = built;
			};
			(document.fonts?.load ? document.fonts.load('500 12px "Inter"') : Promise.resolve()).then(go, go);
			return;
		}
		level = Math.max(0, Math.min(3, +(q.get("level") ?? 0)));
		const still = q.has("still") || matchMedia("(prefers-reduced-motion: reduce)").matches;
		const forced = +(q.get("dpr") ?? 0), nobusy = q.has("nobusy"), nofocus = q.has("nofocus");
		let focus: string | null = null;
		const parked = q.get("lens")?.split(",").map(Number);
		const print = createPrint({
			text, labs, litText, ridge: RIDGE,
			crowdBands: [[0.34, "#0F3640"], [0.54, "#8CB5C0"], [0.62, "#2A5F6E"], [0.78, "#B5D0D7"], [0.9, "#437E8E"], [1, "#6A9AA8"]].map(([to, color]) => ({ to: to as number, color: color as string })),
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
		let seen = "", skipped = 0, total = 0;
		function frame(now: number) {
			const dt = (now - last) / 1000; last = now;
			raf = requestAnimationFrame(frame);
			// the way the host drives it: redraw only while the renderer is busy or an input changed
			const input = `${level}|${pointer?.x}|${pointer?.y}|${W}|${H}|${focus}`;
			total++;
			if (!nobusy && input === seen && print.busy && !print.busy()) { skipped++; (window as any).__skip = skipped / total; return; }
			seen = input;
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			ctx.clearRect(0, 0, W, H);
			const t0 = performance.now();
			print.draw(ctx, { level, t: now / 1000, dt, view: { w: W, h: H, dpr }, stage, quiet: [quiet], pointer, enter: 1, reduce: still, focus });
			const c = performance.now() - t0;
			// the inspector, the way the host will do it: whatever is under the lens is the focus, and gets a card (?nofocus: off)
			const ln = print.lens?.() ?? null;
			const under = ln && !nofocus ? (print.hit(ln.x, ln.y)?.id ?? null) : null;
			const words = print.lensText?.() ?? "";
			if (under !== focus || (ln ? !card || card.x !== ln.x || card.y !== ln.y || card.words !== words : !!card)) { focus = under; card = ln && under ? { ...ln, id: under, words } : null; }
			cpu += c; gap += dt * 1000; worst = Math.max(worst, c); n++;
			if (now - tick > 500) {
				ms = `draw ${(cpu / n).toFixed(2)} ms (worst ${worst.toFixed(1)}) · ${(n * 2)} draws/s · dpr ${dpr}`;
				(window as any).__print = { draw: cpu / n, worst, drawsPerSec: n * 2, dpr };
				cpu = gap = worst = n = 0; tick = now;
				anchors = print.anchors();
			} else if (print.busy?.()) anchors = print.anchors();
			hover = pointer ? (print.hit(pointer.x, pointer.y)?.id ?? "") : "";
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
	{@html `<style>
	.shelf { position: fixed; inset: 0; z-index: 1000; overflow: auto; padding: 14px 18px; background: #E8E8E3 radial-gradient(rgba(20, 32, 45, 0.07) 1px, transparent 1.2px) 0 0 / 18px 18px; font: 11px Inter, system-ui, sans-serif; color: #14202D; }
	.shelf p { margin: 0 0 8px; }
	.shelf :global(.row) { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; flex-wrap: wrap; }
	.shelf :global(.row span) { width: 150px; flex: none; color: #5A6270; }html,body{margin:0;overflow:hidden;height:100%}html body{background-color:#E8E8E3;background-image:radial-gradient(rgba(20,32,45,.07) 1px,transparent 1.2px);background-size:18px 18px}</style>`}
</svelte:head>

{#if gallery}
	<div class="shelf"><p>{built}</p><div bind:this={shelf}></div></div>
{:else}
<div class="root">
	<canvas bind:this={canvas}></canvas>
	<div class="quiet" style="left:{quiet.x}px; top:{quiet.y}px; width:{quiet.w}px; height:{quiet.h}px">quiet</div>
	{#each anchors as a (a.id)}
		{#if a.alpha > 0.02}
			<span class="tag" class:small={a.r < 40} style="left:{a.x}px; top:{a.y + a.r + (narrow ? 2 : 5)}px; opacity:{a.alpha}">{label(a.id)}</span>
		{/if}
	{/each}
	{#if card}<div class="card" style="left:{card.x + card.r + 10}px; top:{card.y}px">{card.id}<i>{card.words}</i></div>{/if}
	<div class="bar">
		{#each [0, 1, 2, 3] as n}<button class:on={level === n} onclick={() => (level = n)}>{n}</button>{/each}
		<span>{ms}</span>
		{#if hover}<b>{hover}</b>{/if}
	</div>
</div>
{/if}

<style>
	.shelf { position: fixed; inset: 0; z-index: 1000; overflow: auto; padding: 14px 18px; background: #E8E8E3 radial-gradient(rgba(20, 32, 45, 0.07) 1px, transparent 1.2px) 0 0 / 18px 18px; font: 11px Inter, system-ui, sans-serif; color: #14202D; }
	.shelf p { margin: 0 0 8px; }
	.shelf :global(.row) { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; flex-wrap: wrap; }
	.shelf :global(.row span) { width: 150px; flex: none; color: #5A6270; }
	.root { position: fixed; inset: 0; z-index: 1000; background: #E8E8E3 radial-gradient(rgba(20, 32, 45, 0.07) 1px, transparent 1.2px) 0 0 / 18px 18px; font-family: Inter, system-ui, sans-serif; color: #14202D; cursor: crosshair; }
	canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
	.quiet { position: absolute; box-sizing: border-box; border: 1px dashed rgba(20, 32, 45, 0.25); font-size: 11px; padding: 6px; color: rgba(20, 32, 45, 0.45); pointer-events: none; }
	.tag { position: absolute; transform: translateX(-50%); font-size: 13px; font-weight: 600; letter-spacing: -0.01em; white-space: nowrap; pointer-events: none; }
	.tag.small { font-size: 10px; font-weight: 500; }
	.bar { position: absolute; left: 10px; bottom: 10px; display: flex; gap: 6px; align-items: center; font-size: 11px; font-variant-numeric: tabular-nums; }
	.bar button { width: 26px; height: 26px; border: 1px solid #14202D; background: #F3F3EF; border-radius: 2px; font: inherit; font-weight: 600; cursor: pointer; }
	.bar button.on { background: #14202D; color: #fff; }
	.bar b { font-weight: 600; }
	.card i { display: block; font-weight: 400; max-width: 260px; white-space: normal; color: #5A6270; }
	.card { position: absolute; transform: translateY(-50%); padding: 6px 10px; background: #fff; border-radius: 3px; box-shadow: 0 6px 20px rgba(20, 32, 45, 0.14); font-size: 12px; font-weight: 600; white-space: nowrap; pointer-events: none; }
</style>
