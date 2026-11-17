<script lang="ts">
	// The launch video, as a page: the paper's findings one beat at a time over the hero's fingerprint art, for
	// docs/launch_20261116/tools/record_hero.mjs (private llm-detectors repo), plus the blog post's link card (?card=1).
	// One canvas: the hero's dimmed dot ground, the renderer (print/, set up as PrintHero.svelte does), small prints from
	// print/sprites.ts, and the captions. No site header, no panel, no HTML labels.
	//
	// Beats (paper words, checked with tools/check_ngrams.py; type sized for a phone feed, 360-400 px wide):
	//   1 Who wrote this?                     the one main print
	//   2 Whether an AI or human wrote it      it divides into the human and AI prints
	//   3 If an AI, which lab                  one print per lab
	//   4 If a human, often exactly who        the crowd, coloured by kind of text, and the found writer in solid ink
	//   5 Familiarity with the writer ...      four prints from faint to clear
	//   6 Defenses are limited                 its three reasons one at a time, over a faint print
	//   7 the closing line                     white on a full-bleed dark band, the main print in light ink; then the
	//                                          band gives way to beat 1's first frame, so the loop is seamless
	//
	// ?w=1080&h=1080   canvas size in CSS px (default: the window); wider than 1.3:1 puts the captions on the left
	// ?dpr=2           backing scale (default: devicePixelRatio)
	// ?clock=manual    no animation loop: window.__step(dt) advances the clock by dt seconds and draws one frame;
	//                  window.__ready resolves once Inter has loaded, window.__warm() runs a lead-in so every print is
	//                  set before frame 0. A clock injected before load (window.__manualClock) is kept in step.
	// ?lens=park|hide  the renderer's lens parked on its print (pointer null), or moved off the canvas
	// ?card=1          the link card: title and deck on the left, the level-0 print on the right, nothing moving
	// ?veil=0          the page's plain dot ground instead of the hero's dimmed one
	// ?cut=results     the results cut instead (ResultsExplainer.svelte): three results, the defenses and the closing line
	//                  as typographic diagrams on the site's research-explainer plate, the fingerprint only a motif. The
	//                  square plate fills a square frame; a wider frame centres it. With ?clock=manual, __step seeks the
	//                  plate's own timeline (the explainer's dev handle, window.__xp), so every frame is exact.
	import { onMount, flushSync } from "svelte";
	import { createPrint, type Box } from "$lib/who-wrote-this/print";
	import ResultsExplainer, { BEATS as R_BEATS, DURATION as R_DUR } from "./ResultsExplainer.svelte";
	import * as V2 from "./v2";
	import { THREAD, drawThread } from "./thread";
	import { printSprite, printAspect } from "$lib/who-wrote-this/print/sprites";
	import RIDGE from "$lib/who-wrote-this/print_text.json";
	import C from "$lib/who-wrote-this/content.json";
	import HERO from "$lib/who-wrote-this/hero.json";

	const L = C.levels;
	const LIT = C.art.decipher[2];
	const LABS = ["Anthropic", "OpenAI", "Google", "Alibaba", "DeepSeek", "Moonshot", "Zhipu", "MiniMax", "Mistral", "xAI", "Cohere"];
	// level 3's colours, one per set of texts in hero.json's crowd order (PrintHero.svelte KIND_COLORS)
	const KIND_COLORS = ["#437E8E", "#C85A82", "#461E47", "#9A82B4", "#8CB5C0", "#DC89A7"];
	const FONT = '"Inter", system-ui, -apple-system, sans-serif';
	const INK = "#14202D", INK2 = "#5A6270", GROUND = "#E8E8E3", WHITE = "#FFFFFF", LIGHT = "#E8E8E3";

	type Art = "print" | "clarity" | "defenses" | "close";
	type Beat = { dur: number; head: string; sub?: string; lines?: string[]; art: Art; level?: number };
	// Paper text (tools/check_ngrams.py): beats 1-4 heads are the abstract's three levels (content.json); subs are the
	// introduction's (beat 4 drops "15K"); beat 5 is the introduction's "Familiarity with the writer predicts accuracy";
	// beat 6 is the conclusion's "Defenses are limited, since models rarely refuse, writing cannot be deleted from existing
	// weights, and AI rewriting only partly helps"; beat 7 is the conclusion's last line (content.json closing).
	const BEATS: Beat[] = [
		{ dur: 1.6, head: C.hero.ask, art: "print", level: 0 },
		{ dur: 2.6, head: L.items[0].t, sub: "as well as specialized detectors", art: "print", level: 1 },
		{ dur: 2.6, head: L.items[1].t, sub: "they can often name the lab behind an AI-generated text", art: "print", level: 2 },
		{ dur: 3.2, head: L.items[2].t, sub: "names the reviewer of 55% of anonymous ICML 2020 reviews", art: "print", level: 3 },
		{ dur: 2.6, head: "Familiarity with the writer predicts accuracy", art: "clarity" },
		{ dur: 3.3, head: "Defenses are limited", lines: ["models rarely refuse", "writing cannot be deleted from existing weights", "AI rewriting only partly helps"], art: "defenses" },
		{ dur: 3.8, head: C.closing.t, art: "close" },
	];
	const START = BEATS.map((_, i) => BEATS.slice(0, i).reduce((a, b) => a + b.dur, 0));
	const T = START[BEATS.length - 1] + BEATS[BEATS.length - 1].dur; // 19.7 s
	const CAP_IN = 0.12, CAP_OUT = 0.15; // a caption is in within 150 ms of its beat starting, and out in its last 150 ms
	const RSPEED = 1.5; // the renderer's divisions run 1.5x (a one-level leap: 1.2 s of its time, 0.8 s here)
	const CLARITY = [0.1, 0.4, 0.7, 1]; // beat 5's prints, faint to clear (section 4's clarity)
	const SEAM = 0.5; // the last 0.5 s: the dark band gives way to beat 1's first frame
	const FPS = 30;

	let canvas: HTMLCanvasElement;
	// the results cut
	let cut = $state(""), frameW = $state(1080), frameH = $state(1080), dark = $state(0);
	const plate = $derived(Math.min(frameW, frameH));

	// the v2 cut (v2.ts) and the thread's images (thread.ts): the launch page's own style, on one canvas
	function setupV2(q: URLSearchParams) {
		const g = window as any;
		g.__mounts = (g.__mounts ?? 0) + 1;
		const shot = q.get("thread");
		const W = +(q.get("w") ?? 0) || innerWidth, H = +(q.get("h") ?? 0) || innerHeight;
		const dpr = +(q.get("dpr") ?? 0) || devicePixelRatio || 1;
		canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
		canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
		const ctx = canvas.getContext("2d")!;
		let A: V2.Assets | null = null, first: HTMLCanvasElement | null = null;
		let units = 0;
		const now = () => units / 3000;
		const T = shot ? 1 : V2.T_VIDEO;
		const faces = () => [...document.fonts].filter((f) => f.family.replace(/["']/g, "") === "Inter").map((f) => ({ weight: f.weight, style: f.style, status: f.status }));
		const draw = (tl: number) => {
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			ctx.globalAlpha = 1;
			if (shot) { drawThread(ctx, shot, W, H, A!); return -1; }
			return V2.frame(ctx, W, H, tl, A!, first);
		};
		const ready = (async () => {
			try { await Promise.all(["500 12px Inter", "600 12px Inter", "400 12px Inter"].map((f) => document.fonts.load(f))); } catch {}
			await document.fonts.ready;
			A = await V2.loadAssets(V2.ICONS);
			// beat 1's first frame, kept for the loop's seam
			draw(0);
			if (!shot) { first = document.createElement("canvas"); first.width = canvas.width; first.height = canvas.height; first.getContext("2d")!.drawImage(canvas, 0, 0); }
			return { W, H, dpr, T, fps: 30, fonts: faces() };
		})();
		g.__ready = ready;
		g.__info = shot ? { T: 1 / 30, start: [0], keyframes: [0], leaps: [], leap: 0, fade: 0, fps: 30, poster: 0 } : { T: V2.T_VIDEO, start: V2.BEATS, keyframes: V2.BEATS.map((b, i) => (i === 0 ? 1.0 : (V2.BEATS[i + 1] ?? V2.T_VIDEO) - (i === 5 ? 1.4 : 0.6))), leaps: [], leap: 0, fade: 0.45, fps: 30, poster: 0 };
		g.__warm = async () => { await ready; units = 0; draw(0); return { busy: false, t0: 0, fonts: faces() }; };
		g.__step = (dt: number) => { units += Math.round(dt * 3000); const tl = ((now() % T) + T) % T; const b = draw(tl); return { t: +now().toFixed(4), tl: +tl.toFixed(4), beat: b, enter: 0 }; };
		g.__ground = () => { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); V2.ground(ctx, W, H, 22); return true; };
		if (q.get("clock") !== "manual") {
			let last = performance.now(), raf = 0;
			const loop = (ts: number) => { raf = requestAnimationFrame(loop); units += Math.round(Math.min(0.05, (ts - last) / 1000) * 3000); last = ts; draw(((now() % T) + T) % T); };
			ready.then(() => { last = performance.now(); raf = requestAnimationFrame(loop); });
		}
	}

	function setupResults(q: URLSearchParams) {
		const g = window as any;
		g.__mounts = (g.__mounts ?? 0) + 1;
		frameW = +(q.get("w") ?? 0) || innerWidth; frameH = +(q.get("h") ?? 0) || innerHeight;
		cut = "results";
		const manual = q.get("clock") === "manual";
		let units = 0; // the clock, in 1/3000 s
		const now = () => units / 3000;
		const handle = () => (g.__xp ?? [])[0] as { seek(t: number): void; duration: number } | undefined;
		const faces = () => [...document.fonts].filter((f) => f.status === "loaded").map((f) => `${f.family.replace(/["']/g, "")} ${f.style} ${f.weight}`);
		const ready = (async () => {
			// NHG from the site's Typekit kit; Optima is the system's
			try { await Promise.all(['500 40px "neue-haas-grotesk-display"', '400 20px "neue-haas-grotesk-text"', "20px Optima", "italic 20px Optima"].map((f) => document.fonts.load(f))); } catch {}
			await document.fonts.ready;
			for (let i = 0; i < 300 && !handle(); i++) await new Promise((r) => setTimeout(r, 50));
			if (!handle()) throw new Error("the explainer's timeline never came up");
			return { W: frameW, H: frameH, T: R_DUR, fonts: faces(), nhg: document.fonts.check('500 40px "neue-haas-grotesk-display"') && faces().some((f) => f.startsWith("neue-haas-grotesk")) };
		})();
		function show() {
			handle()!.seek(((now() % R_DUR) + R_DUR) % R_DUR);
			flushSync();
			// a wider frame's sides follow the plate's dark closing beat
			const d = document.querySelector(".c-dark");
			dark = d ? +getComputedStyle(d).opacity || 0 : 0;
			flushSync();
		}
		const beatOf = (t: number) => { let k = 0; R_BEATS.forEach((b, i) => { if (t >= b.at - 1e-9) k = i; }); return k; };
		g.__ready = ready;
		g.__info = { T: R_DUR, start: R_BEATS.map((b) => b.at), keyframes: R_BEATS.map((b) => b.hold ?? b.at), leaps: [], leap: 0, fade: 0, fps: 30, poster: R_BEATS[2].hold };
		if (manual) {
			g.__warm = async () => {
				await ready;
				// the motif prints are images: let them decode before frame 0
				await Promise.all([...document.querySelectorAll(".xp image")].map((im) => { const i = new Image(); i.src = im.getAttribute("href") ?? ""; return i.decode().catch(() => {}); }));
				await new Promise((r) => setTimeout(r, 200));
				units = 0; show();
				return { busy: false, t0: 0, fonts: faces() };
			};
			g.__step = (dt: number) => { units += Math.round(dt * 3000); show(); const tl = now() % R_DUR; return { t: +now().toFixed(4), tl: +tl.toFixed(4), beat: beatOf(tl), enter: 0 }; };
		}
	}

	const sm = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
	const beatAt = (t: number) => { let k = 0; for (let i = 1; i < BEATS.length; i++) if (t >= START[i] - 1e-9) k = i; return k; };

	onMount(() => {
		const q = new URLSearchParams(location.search);
		if (q.get("cut") === "results") { setupResults(q); return; }
		if (q.get("cut") === "v2" || q.has("thread")) { setupV2(q); return; }
		const manual = q.get("clock") === "manual", card = q.has("card"), veil = q.get("veil") !== "0";
		const hide = q.get("lens") === "hide";
		const W = +(q.get("w") ?? 0) || innerWidth, H = +(q.get("h") ?? 0) || innerHeight;
		const dpr = +(q.get("dpr") ?? 0) || devicePixelRatio || 1;
		canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
		canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
		const ctx = canvas.getContext("2d")!;
		const g = window as any;
		g.__mounts = (g.__mounts ?? 0) + 1;

		// PrintHero's options (as of site commit 2934510), and the found writer in solid ink (litLines, opt-in)
		const text = [
			...C.lede.map((s) => s.t), L.lead.t, ...L.items.flatMap((i) => [i.t, i.fact]),
			(C.sections[0].example?.text ?? []).map((s) => s.t).join(""), ...C.timeline.steps.map((s) => s.t), ...C.art.decipher.map((d) => d.excerpt.t), C.closing.t,
		];
		const print = createPrint({
			text, labs: LABS, litText: LIT.excerpt.t, ridge: RIDGE, litLines: true,
			crowdBands: (() => { const tot = HERO.crowd.reduce((a, c) => a + c.layout_share, 0); let a = 0; return HERO.crowd.map((c, i) => ({ to: (a += c.layout_share) / tot, color: KIND_COLORS[i] })); })(),
			colors: { human: "#C85A82", ai: "#461E47", lit: "#14202D", ink: "#14202D", labs: ["#C85A82", "#437E8E", "#461E47"], other: "#8A8F98" },
		});

		// two clocks, in 1/3000 s (exact for steps of 1/30, 1/60, 1/24 and 1/15 s): the page's, which an injected page clock
		// follows, and the renderer's, which runs RSPEED times faster
		const clock = g.__manualClock as { set(ms: number): void } | undefined;
		let units = 0, runits = 0;
		const now = () => units / 3000, rnow = () => runits / 3000;
		const advance = (dt: number) => { units += Math.round(dt * 3000); runits += Math.round(dt * RSPEED * 3000); clock?.set(now() * 1000); };

		// the ground, set once: the page's dots (CSS radial-gradient, 18 px pitch) under the hero's veil (DotField at dim 0.55)
		const layer = () => { const c = document.createElement("canvas"); c.width = canvas.width; c.height = canvas.height; return c; };
		const ground = layer();
		{
			const gg = ground.getContext("2d")!;
			gg.setTransform(dpr, 0, 0, dpr, 0, 0);
			gg.fillStyle = GROUND; gg.fillRect(0, 0, W, H);
			gg.fillStyle = "rgba(20,32,45,0.07)";
			for (let y = 9; y < H + 18; y += 18) for (let x = 9; x < W + 18; x += 18) { gg.beginPath(); gg.arc(x, y, 1.1, 0, Math.PI * 2); gg.fill(); }
			if (veil) { gg.fillStyle = `rgba(232,232,227,${0.55 * 0.85})`; gg.fillRect(0, 0, W, H); }
		}

		// ── type
		const spacing = (size: number, em = -0.02) => `${(em * size).toFixed(2)}px`;
		function setFont(weight: number, size: number, em = -0.02) { ctx.font = `${weight} ${size}px ${FONT}`; (ctx as any).letterSpacing = spacing(size, em); }
		function wrap(s: string, weight: number, size: number, maxW: number, em = -0.02) {
			setFont(weight, size, em);
			const out: string[] = [];
			let line = "";
			for (const w of s.split(" ")) {
				const next = line ? `${line} ${w}` : w;
				if (line && ctx.measureText(next).width > maxW) { out.push(line); line = w; } else line = next;
			}
			if (line) out.push(line);
			return out;
		}
		/** wrap, then balance: the narrowest width that keeps the same number of lines, so no line ends on one word */
		function balanced(s: string, weight: number, size: number, maxW: number, em = -0.02) {
			const n = wrap(s, weight, size, maxW, em).length;
			if (n < 2) return wrap(s, weight, size, maxW, em);
			let lo = maxW / n, hi = maxW;
			for (let i = 0; i < 14; i++) { const mid = (lo + hi) / 2; if (wrap(s, weight, size, mid, em).length > n) lo = mid; else hi = mid; }
			return wrap(s, weight, size, hi, em);
		}

		type Block = { head: string[]; sub: string[]; lines: string[][]; h: number[] }; // h: block height with each line (or the sub)
		type Lay = {
			wide: boolean; stage: Box; x: number; top: number | null; colW: number;
			head: { px: number; lh: number }; sub: { px: number; lh: number }; gap: number; rise: number;
			blocks: Block[]; clarity: { x: number; y: number; h: number }[];
			close: { px: number; lh: number; lines: string[]; y: number; print: { x: number; y: number; h: number; a: number } };
			card: { x: number; title: { size: number; y: number }; deck: { size: number; lines: string[]; y: number; lh: number } } | null;
		};
		let lay: Lay | null = null;
		function layout(): Lay {
			const u = Math.min(W, H) / 1080, wide = W / H > 1.3;
			if (card) {
				// title and deck in the left half, vertically centred; the print in the right half
				const x = Math.round(W * 0.06), colW = W * 0.5 - x;
				setFont(600, 100);
				const tSize = Math.min(H * 0.125, (colW * 100) / ctx.measureText(C.meta.title.t).width);
				const dSize = Math.round(tSize * 0.4);
				const lines = wrap(C.meta.deck.t, 500, dSize, colW * 0.98);
				const lh = dSize * 1.3, gap = tSize * 0.42;
				const block = tSize * 0.73 + gap + lh * (lines.length - 1) + dSize * 0.73;
				const top = (H - block) / 2;
				return {
					wide, stage: { x: W * 0.52, y: H * 0.025, w: W * 0.46, h: H * 0.95 }, x, top, colW,
					head: { px: 0, lh: 0 }, sub: { px: 0, lh: 0 }, gap: 0, rise: 0, blocks: [], clarity: [],
					close: { px: 0, lh: 0, lines: [], y: 0, print: { x: 0, y: 0, h: 0, a: 0 } },
					card: { x, title: { size: tSize, y: top + tSize * 0.73 }, deck: { size: dSize, lines, y: top + tSize * 0.73 + gap + dSize * 0.73, lh } },
				};
			}
			// sizes for a phone feed: a 1080 square is seen ~360 px wide (x0.33), a 1920 frame ~400 px wide (x0.21), so the
			// 16:9 type is about 1.6 times the square's to read the same: headlines >= 72 px and sub-lines >= 44 px at 1080
			const head = { px: Math.round((wide ? 116 : 72) * u), lh: 0 }, sub = { px: Math.round((wide ? 70 : 44) * u), lh: 0 };
			head.lh = head.px * 1.08; sub.lh = sub.px * 1.2;
			const gap = (wide ? 26 : 18) * u;
			const x = (wide ? 84 : 50) * u, colW = wide ? W * 0.47 - x : W - 2 * x;
			const blocks: Block[] = BEATS.map((b) => {
				if (b.art === "close") return { head: [], sub: [], lines: [], h: [0] };
				const hd = balanced(b.head, 600, head.px, colW);
				const sb = b.sub ? balanced(b.sub, 500, sub.px, colW, -0.01) : [];
				const ln = (b.lines ?? []).map((s) => balanced(s, 500, sub.px, colW, -0.01));
				const base = hd.length * head.lh;
				const h = ln.length ? ln.map((l) => base + gap + l.length * sub.lh) : [base + (sb.length ? gap + sb.length * sub.lh : 0)];
				return { head: hd, sub: sb, lines: ln, h };
			});
			// the art: below the captions on the square (the stage stays put through beats 1-4 so the prints are never re-set),
			// right of them on 16:9
			let stage: Box, top: number | null;
			if (wide) {
				top = null; // captions centred on the frame's height, beat by beat
				const sx = W * 0.49;
				stage = { x: sx, y: 34 * u, w: W - sx - 24 * u, h: H - 68 * u };
			} else {
				top = 56 * u;
				const band = top + Math.max(...blocks.slice(0, 4).map((b) => Math.max(...b.h))) + 26 * u;
				stage = { x: 24 * u, y: band, w: W - 48 * u, h: H - band - 20 * u };
			}
			// beat 5: four prints, faint to clear, in a row (square) or two by two (16:9, so they stay large)
			const clarity: { x: number; y: number; h: number }[] = [];
			const A = printAspect(), cg = 26 * u;
			if (wide) {
				const h = Math.min((stage.h - cg) / 2, (stage.w - cg) / (2 * A));
				const x0 = stage.x + (stage.w - (2 * A * h + cg)) / 2, y0 = stage.y + (stage.h - (2 * h + cg)) / 2;
				for (let i = 0; i < 4; i++) clarity.push({ x: x0 + (i % 2) * (A * h + cg), y: y0 + Math.floor(i / 2) * (h + cg), h });
			} else {
				const below = top! + blocks[4].h[0] + 30 * u, sh = H - below - 30 * u;
				const h = Math.min(sh, (stage.w - 3 * cg) / (4 * A));
				const x0 = stage.x + (stage.w - (4 * A * h + 3 * cg)) / 2, y0 = below + (sh - h) / 2;
				for (let i = 0; i < 4; i++) clarity.push({ x: x0 + i * (A * h + cg), y: y0, h });
			}
			// beat 7: the closing line as large as fits in at most four lines (three on 16:9), centred over the light print
			const cw = W - 2 * x, maxLines = wide ? 3 : 4;
			let cpx = Math.round((wide ? 100 : 80) * u), cl = balanced(C.closing.t, 600, cpx, cw);
			while (cl.length > maxLines && cpx > 40) { cpx -= 2; cl = balanced(C.closing.t, 600, cpx, cw); }
			const clh = cpx * 1.12;
			const ph = H * 0.94;
			return {
				wide, stage, x, top, colW, head, sub, gap, rise: 10 * u, blocks, clarity,
				close: { px: cpx, lh: clh, lines: cl, y: (H - cl.length * clh) / 2 + cpx * 0.8, print: { x: W / 2 - (A * ph) / 2, y: (H - ph) / 2, h: ph, a: wide ? 0.2 : 0.16 } },
				card: null,
			};
		}

		// ── the prints that are not the renderer's: beat 5's four, beat 7's light main print (set during the lead-in)
		let sprites: { clarity: HTMLCanvasElement[]; light: HTMLCanvasElement } | null = null;
		function makeSprites() {
			const l = lay!;
			sprites = {
				clarity: CLARITY.map((c, i) => printSprite({ family: "writer", index: 3, color: INK, px: l.clarity[i].h, dpr, clarity: c })),
				light: printSprite({ family: "main", color: LIGHT, px: l.close.print.h, dpr, text: true }),
			};
		}

		const OFF = { x: -1e4, y: -1e4 };
		let t0 = 0, cycle = -1, snapped = false, raf = 0, disposed = false;
		const first = layer(); // beat 1's first frame without its caption: where the loop closes

		function ink(level: number, enter: number, dt: number, reduce: boolean) {
			print.draw(ctx, { level, t: rnow(), dt: Math.min(0.05, dt * RSPEED), view: { w: W, h: H, dpr }, stage: lay!.stage, quiet: [], pointer: hide || card ? OFF : null, enter, reduce, focus: null });
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		}

		function caption(k: number, since: number, alpha: number) {
			const b = BEATS[k], l = lay!, bl = l.blocks[k];
			const dur = b.dur;
			const shown = (a: number, z: number) => sm(a, a + CAP_IN, since) * (1 - sm(z - CAP_OUT, z, since));
			const head = shown(0, dur) * alpha;
			// beat 6's three reasons, one at a time
			let line = -1, la = 0;
			if (bl.lines.length) {
				const slot = (dur - 0.1) / bl.lines.length;
				line = Math.min(bl.lines.length - 1, Math.floor(Math.max(0, since - 0.1) / slot));
				const a = 0.1 + line * slot, z = line === bl.lines.length - 1 ? dur : a + slot;
				la = shown(a, z) * alpha;
			}
			const h = bl.lines.length ? bl.h[Math.max(0, line)] : bl.h[0];
			let y = (l.top ?? (H - h) / 2) + l.head.px * 0.78;
			ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.fillStyle = INK;
			setFont(600, l.head.px);
			ctx.globalAlpha = head;
			const dy = (1 - sm(0, CAP_IN, since)) * l.rise;
			for (const s of bl.head) { ctx.fillText(s, l.x, y + dy); y += l.head.lh; }
			y += l.gap - l.head.lh + l.head.px * 0.22 + l.sub.px * 0.78;
			setFont(500, l.sub.px, -0.01);
			if (bl.sub.length) for (const s of bl.sub) { ctx.fillText(s, l.x, y + dy); y += l.sub.lh; }
			if (line >= 0) {
				ctx.globalAlpha = la;
				const ldy = (1 - sm(0.1 + line * ((dur - 0.1) / bl.lines.length), 0.1 + line * ((dur - 0.1) / bl.lines.length) + CAP_IN, since)) * l.rise;
				for (const s of bl.lines[line]) { ctx.fillText(s, l.x, y + ldy); y += l.sub.lh; }
			}
			ctx.globalAlpha = 1;
		}

		function cardText() {
			const cd = lay!.card!;
			ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
			ctx.fillStyle = INK; setFont(600, cd.title.size);
			ctx.fillText(C.meta.title.t, cd.x, cd.title.y);
			ctx.fillStyle = INK2; setFont(500, cd.deck.size);
			cd.deck.lines.forEach((s, i) => ctx.fillText(s, cd.x, cd.deck.y + i * cd.deck.lh));
		}

		/** one frame at the clock's current time */
		function frame(dt: number) {
			const tc = now() - t0, c = Math.floor(tc / T + 1e-9), tl = Math.max(0, tc - c * T);
			if (c !== cycle) { cycle = c; snapped = false; }
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
			ctx.drawImage(ground, 0, 0);
			if (card) { ink(0, 1, dt, false); cardText(); return { t: +now().toFixed(4), tl: 0, beat: -1, enter: 1 }; }
			const k = beatAt(tl), b = BEATS[k], since = tl - START[k], l = lay!, sp = sprites!;
			// the renderer: beats 1-4 at their level; out at the start of beat 5, then set back to level 0 at zero ink (one
			// frame with motion reduced, so no reverse division plays); faint under beat 6; away for beat 7
			let level = 0, enter = 0, reduce = false;
			if (b.art === "print") { level = b.level!; enter = 1; }
			else if (b.art === "clarity") {
				enter = 1 - sm(0, 0.25, since); level = 3;
				if (enter <= 0) { level = 0; if (!snapped) { snapped = true; reduce = true; } }
			} else if (b.art === "defenses") enter = 0.42 * sm(0, 0.3, since) * (1 - sm(b.dur - 0.3, b.dur, since));
			ink(level, enter, dt, reduce);
			if (b.art === "clarity") {
				const out = 1 - sm(b.dur - 0.2, b.dur, since), A = printAspect();
				l.clarity.forEach((p, i) => {
					ctx.globalAlpha = sm(0.12 + i * 0.22, 0.42 + i * 0.22, since) * out;
					ctx.drawImage(sp.clarity[i], p.x, p.y, A * p.h, p.h);
				});
				ctx.globalAlpha = 1;
			}
			if (b.art === "close") {
				// the band comes in fast; in the last SEAM seconds it gives way to beat 1's first frame
				const seam = sm(b.dur - SEAM, b.dur, since), band = sm(0, 0.18, since) * (1 - seam);
				if (seam > 0) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = seam; ctx.drawImage(first, 0, 0); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
				ctx.globalAlpha = band; ctx.fillStyle = INK; ctx.fillRect(0, 0, W, H);
				const P = l.close.print;
				ctx.globalAlpha = band * P.a; ctx.drawImage(sp.light, P.x, P.y, printAspect() * P.h, P.h);
				const ta = sm(0, CAP_IN, since) * (1 - sm(b.dur - SEAM - CAP_OUT, b.dur - SEAM, since));
				ctx.globalAlpha = ta * band; ctx.fillStyle = WHITE; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
				setFont(600, l.close.px);
				l.close.lines.forEach((s, i) => ctx.fillText(s, W / 2, l.close.y + i * l.close.lh + (1 - sm(0, CAP_IN, since)) * l.rise));
				ctx.globalAlpha = 1;
			} else caption(k, since, 1);
			return { t: +now().toFixed(4), tl: +tl.toFixed(4), beat: k, enter: +enter.toFixed(4) };
		}

		const interFaces = () => [...document.fonts].filter((f) => f.family.replace(/["']/g, "") === "Inter").map((f) => ({ weight: f.weight, style: f.style, status: f.status }));
		const ready = (async () => {
			try { await Promise.all([document.fonts.load(`500 12px ${FONT}`), document.fonts.load(`600 12px ${FONT}`)]); } catch {}
			await document.fonts.ready;
			lay = layout();
			return { W, H, dpr, T, fps: FPS, start: START, fonts: interFaces() };
		})();
		/** the lead-in: the renderer runs at zero ink (level 0) so every print is traced and set and the font has landed;
		 * the small prints are set; then beat 1's first frame is kept for the loop's seam, and frame 0 is the loop's first */
		async function warm(sec = 1.5) {
			await ready;
			if (!card) makeSprites();
			const n = Math.round(sec * FPS);
			for (let i = 0; i < n && !disposed; i++) {
				advance(1 / FPS);
				ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(ground, 0, 0);
				ink(0, 0, 1 / FPS, false);
				await new Promise((r) => setTimeout(r, 0)); // lets the renderer's font promise land between frames
			}
			const busy = print.busy?.() ?? null;
			ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(ground, 0, 0);
			if (!card) { ink(0, 1, 0, false); const fg = first.getContext("2d")!; fg.drawImage(canvas, 0, 0); }
			t0 = now(); cycle = -1;
			return { busy, t0, fonts: interFaces() };
		}

		g.__ready = ready;
		// keyframes: a moment in every beat (and each of beat 6's lines) when its words are all in, for the contact sheet
		const keys = BEATS.flatMap((b, i) => (b.lines ? b.lines.map((_, j) => START[i] + 0.1 + (j + 0.6) * ((b.dur - 0.1) / b.lines!.length)) : [START[i] + b.dur * (b.art === "close" ? 0.5 : 0.8)]));
		g.__info = { T, start: START, beats: BEATS.map((b) => b.head), leaps: [START[1], START[2], START[3]], leap: 1.2 / RSPEED, fade: SEAM, fps: FPS, keyframes: keys, poster: START[3] + 2.6 };
		if (manual) {
			g.__warm = warm;
			g.__step = (dt: number) => { advance(dt); return frame(dt); };
			g.__busy = () => print.busy?.() ?? null;
			// the bare ground, for the recorder's blank-frame check (the next __step draws the frame again)
			g.__ground = () => { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.drawImage(ground, 0, 0); return true; };
		} else {
			let last = performance.now();
			const loop = (ts: number) => {
				raf = requestAnimationFrame(loop);
				const dt = Math.min(0.05, Math.max(0, (ts - last) / 1000));
				last = ts;
				advance(dt);
				frame(dt);
			};
			warm().then(() => { if (!disposed) { last = performance.now(); raf = requestAnimationFrame(loop); } });
		}
		return () => {
			disposed = true;
			cancelAnimationFrame(raf);
			print.dispose?.();
			for (const k of ["__ready", "__info", "__warm", "__step", "__busy", "__ground"]) delete g[k];
		};
	});
</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,400;0,14..32,500;0,14..32,600;1,14..32,400;1,14..32,500&display=swap" />
	{@html `<style>html,body{margin:0;overflow:hidden;height:100%;background:#E8E8E3}</style>`}
</svelte:head>

{#if cut === "results"}
	<div class="rroot" data-justify="off" style:width="{frameW}px" style:height="{frameH}px">
		<div class="rdark" style:opacity={dark}></div>
		<div class="rplate" style:width="{plate}px" style:left="{(frameW - plate) / 2}px" style:top="{(frameH - plate) / 2}px">
			<ResultsExplainer size="card" label="Who wrote this? Frontier models identify AI text as well as specialized detectors, name the lab behind 98% of texts from OpenAI, Anthropic and Google, and the reviewer of 55% of anonymous ICML 2020 reviews; defenses are limited." />
		</div>
	</div>
{:else}
	<div class="root" data-justify="off"><canvas bind:this={canvas}></canvas></div>
{/if}

<style>
	.root { position: fixed; inset: 0; z-index: 1000; background: #E8E8E3; }
	canvas { position: absolute; left: 0; top: 0; display: block; }
	.rroot { position: fixed; left: 0; top: 0; z-index: 1000; overflow: hidden; background: #fffdfb; }
	.rdark { position: absolute; inset: 0; background: #383838; }
	.rplate { position: absolute; }
</style>
