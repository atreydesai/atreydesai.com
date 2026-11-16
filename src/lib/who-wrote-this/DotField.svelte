<script lang="ts">
	// The page-wide dot field. One canvas pinned to the viewport and mounted on <body> (the site's page layer is
	// transformed during route transitions, which would unpin a fixed child). Its dots sit on the same 18px grid as
	// the CSS ground and scroll with it, so the switch is seamless; near the pointer they swell like a lens.
	// Sections drive it through `field`: the hero's three questions (levels), or marks and lines for a chart.
	import { onMount } from "svelte";
	import { field, chart, hero, labCenters, type Box } from "./field.svelte";

	const PITCH = 18;
	const INK: RGB = [20, 32, 45];
	const ROSE: RGB = [200, 90, 130];
	const AUB: RGB = [70, 30, 71];
	const TEAL: RGB = [67, 126, 142];
	const GRAY: RGB = [137, 137, 137];
	type RGB = [number, number, number];
	type Dot = { gx: number; gy: number; x: number; y: number; r: number; a: number; c: RGB; seed: number; s2: number; s3: number };
	type Live = { x: number; y: number; r: number; a: number };

	const hex = (h: string): RGB => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
	const mix = (p: RGB, q: RGB, t: number): RGB => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];
	const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

	onMount(() => {
		const canvas = document.createElement("canvas");
		canvas.className = "wwt-field";
		canvas.setAttribute("aria-hidden", "true");
		Object.assign(canvas.style, { position: "fixed", inset: "0", width: "100vw", height: "100vh", zIndex: "0", pointerEvents: "none" });
		document.body.prepend(canvas);
		document.documentElement.classList.add("wwt-field-on");
		const ctx = canvas.getContext("2d")!;
		const reduce = matchMedia("(prefers-reduced-motion: reduce)");
		let W = 0, H = 0, dpr = 1, raf = 0, last = performance.now();
		let dots: Dot[] = [];
		const live = new Map<string, Live>();
		const pointer = { x: -999, y: -999 };

		function resize() {
			dpr = Math.min(2, devicePixelRatio || 1);
			W = innerWidth; H = innerHeight;
			canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			dots = [];
			for (let gy = -PITCH; gy < H + PITCH * 2; gy += PITCH)
				for (let gx = 9; gx < W + PITCH; gx += PITCH)
					dots.push({ gx, gy, x: gx, y: gy, r: 1.1, a: 0.07, c: INK, seed: Math.random(), s2: Math.random(), s3: Math.random() });
		}

		// where each dot wants to be, how big, how dark and what colour, for the current mode
		function target(d: Dot, oy: number): { x: number; y: number; r: number; a: number; c: RGB } {
			const x = d.gx, y = d.gy + 9 - oy;
			const tile = field.shape === "tile";
			// mosaic: the ground is tesserae, a few of them in the three questions' colours
			const tint = tile && d.seed < 0.05 ? [ROSE, AUB, TEAL][Math.floor(d.seed * 60) % 3] : null;
			const base = { x, y, r: tile ? 1.5 : 1.1, a: (tint ? 0.22 : tile ? 0.06 : 0.07) * (1 - field.dim * 0.85), c: tint ?? INK };
			if (field.mode !== "levels") return base;
			const inside = (B: Box) => x > B.x && x < B.x + B.w && y > B.y && y < B.y + B.h;
			// settled: each row's band shows its level in small, beside the row it belongs to
			if (field.level === 0) {
				for (let i = 0; i < hero.bands.length; i++) if (inside(hero.bands[i])) return level(i + 1, hero.bands[i], d, x, y, true);
				return base;
			}
			// one level: it fills the whole stage
			return inside(field.anchor) ? level(field.level, field.anchor, d, x, y, false) : base;
		}

		// lab cluster centres per box, worked out once per frame
		const cache = new Map<string, ReturnType<typeof labCenters>>();
		const centers = (B: Box) => {
			const key = `${B.x | 0},${B.y | 0},${B.w | 0},${B.h | 0}`;
			let c = cache.get(key);
			if (!c) { c = labCenters(B); cache.set(key, c); }
			return c;
		};

		function level(n: number, B: Box, d: Dot, x: number, y: number, small: boolean) {
			if (n === 1) {
				// human or AI: the ground divides, human on one side and model on the other
				const t = smooth(0.46, 0.54, (x - B.x) / B.w + (d.s2 - 0.5) * 0.1);
				return { x, y, r: small ? 1.9 : 2.4, a: small ? 0.62 : 0.74, c: mix(ROSE, AUB, t) };
			}
			if (n === 2) {
				// which AI: the dots gather into eleven labs, the big three in colour
				const k = Math.floor(d.seed * 100);
				const lab = k < 22 ? 0 : k < 44 ? 1 : k < 66 ? 2 : 3 + (k % 8);
				const c = centers(B)[lab];
				const ang = d.s2 * 6.2832, rad = c.r * Math.sqrt(d.s3);
				const col = lab === 0 ? ROSE : lab === 1 ? TEAL : lab === 2 ? AUB : GRAY;
				return { x: c.x + Math.cos(ang) * rad, y: c.y + Math.sin(ang) * rad, r: lab < 3 ? (small ? 1.8 : 2.3) : small ? 1.5 : 1.9, a: lab < 3 ? 0.78 : 0.58, c: col };
			}
			// which human: the ground goes quiet and one dot is lit
			const dx = x - (B.x + B.w * 0.62), dy = y - (B.y + B.h * 0.5);
			const lit = dx >= -PITCH / 2 && dx < PITCH / 2 && dy >= -PITCH / 2 && dy < PITCH / 2;
			// everyone else is a quiet crowd of writers
			return lit ? { x, y, r: small ? 6 : 11, a: 1, c: TEAL } : { x, y, r: small ? 1.6 : 2.1, a: small ? 0.26 : 0.34, c: INK };
		}

		function frame(now: number) {
			const dt = Math.min(0.05, (now - last) / 1000);
			last = now;
			const k = reduce.matches ? 1 : 1 - Math.pow(0.0015, dt);
			const oy = scrollY % PITCH;
			cache.clear();
			ctx.clearRect(0, 0, W, H);
			const lens = !reduce.matches && field.mode !== "chart" && field.mode !== "paint";
			for (const d of dots) {
				const t = target(d, oy);
				d.x += (t.x - d.x) * k; d.y += (t.y - d.y) * k;
				d.r += (t.r - d.r) * k; d.a += (t.a - d.a) * k;
				d.c = mix(d.c, t.c, k);
				let r = d.r, a = d.a;
				if (lens) {
					const dist = Math.hypot(d.x - pointer.x, d.y - pointer.y);
					if (dist < 120) { const f = 1 - dist / 120; r += f * f * 1.8; a += f * f * 0.3; }
				}
				if (d.y < -10 || d.y > H + 10 || a < 0.01) continue;
				ctx.fillStyle = `rgba(${d.c[0] | 0},${d.c[1] | 0},${d.c[2] | 0},${a})`;
				if (field.shape === "tile") ctx.fillRect(d.x - r, d.y - r, r * 2, r * 2);
				else { ctx.beginPath(); ctx.arc(d.x, d.y, r, 0, 6.2832); ctx.fill(); }
				if (field.mode === "levels" && r > 5) {
					ctx.strokeStyle = `rgba(67,126,142,${0.35 + 0.25 * Math.sin(now / 300)})`; ctx.lineWidth = 2;
					ctx.beginPath(); ctx.arc(d.x, d.y, r + 8 + 3 * Math.sin(now / 300), 0, 6.2832); ctx.stroke();
				}
			}
			if (field.mode === "chart") drawChart(k, now);
			if (field.mode === "paint" && chart.paint) chart.paint(ctx, { now, dt, w: W, h: H, dpr });
			raf = requestAnimationFrame(frame);
		}

		function drawChart(k: number, now: number) {
			for (const p of chart.paths) {
				if (p.pts.length < 2 || p.progress <= 0) continue;
				const seg = p.pts.slice(1).map((q, i) => Math.hypot(q[0] - p.pts[i][0], q[1] - p.pts[i][1]));
				let left = seg.reduce((s, v) => s + v, 0) * Math.min(1, p.progress);
				ctx.strokeStyle = p.color; ctx.lineWidth = p.width; ctx.setLineDash(p.dash ?? []);
				ctx.beginPath(); ctx.moveTo(...p.pts[0]);
				for (let i = 1; i < p.pts.length && left > 0; i++) {
					const [x0, y0] = p.pts[i - 1], [x1, y1] = p.pts[i], s = seg[i - 1];
					if (left >= s) ctx.lineTo(x1, y1); else ctx.lineTo(x0 + ((x1 - x0) * left) / s, y0 + ((y1 - y0) * left) / s);
					left -= s;
				}
				ctx.stroke(); ctx.setLineDash([]);
			}
			for (const t of chart.texts) {
				ctx.fillStyle = t.color; ctx.textAlign = t.align ?? "left"; ctx.textBaseline = "middle";
				ctx.font = `${t.weight ?? 400} ${t.size}px Inter, system-ui, sans-serif`;
				ctx.fillText(t.t, t.x, t.y);
			}
			const ids = new Set<string>();
			for (const m of chart.marks) {
				ids.add(m.id);
				let l = live.get(m.id);
				if (!l) { // a new mark lifts off the ground near where it is going
					const a = Math.random() * 6.28, d = 140 + Math.random() * 220;
					l = { x: m.x + Math.cos(a) * d, y: m.y + Math.sin(a) * d, r: 1.1, a: 0.1 };
					live.set(m.id, l);
				}
				const hov = field.hover === (m.group ?? m.id);
				const tr = hov ? m.r * 1.7 : m.r, ta = m.alpha ?? 1;
				l.x += (m.x - l.x) * k; l.y += (m.y - l.y) * k; l.r += (tr - l.r) * k; l.a += (ta - l.a) * k;
				ctx.globalAlpha = l.a;
				if (m.square) {
					ctx.fillStyle = m.color; ctx.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2); ctx.globalAlpha = 1;
					continue;
				}
				ctx.beginPath(); ctx.arc(l.x, l.y, l.r, 0, 6.2832);
				if (m.ring) { ctx.fillStyle = "#E8E8E3"; ctx.fill(); ctx.strokeStyle = m.color; ctx.lineWidth = 1.8; ctx.stroke(); }
				else { ctx.fillStyle = m.color; ctx.fill(); }
				if (hov) { ctx.strokeStyle = m.color; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(l.x, l.y, l.r + 5, 0, 6.2832); ctx.stroke(); }
				ctx.globalAlpha = 1;
			}
			// marks that left the chart fade back into the ground
			for (const [id, l] of live) if (!ids.has(id)) { l.a += (0 - l.a) * k; if (l.a < 0.02) live.delete(id); }
		}

		function onMove(e: PointerEvent) {
			pointer.x = e.clientX; pointer.y = e.clientY;
			if (field.mode !== "chart" || !field.interactive) { if (field.hover) field.hover = null; return; }
			let best: string | null = null, bd = 14;
			for (const m of chart.marks) {
				if ((m.alpha ?? 1) < 0.3) continue;
				const d = Math.hypot(m.x - e.clientX, m.y - e.clientY);
				if (d < bd) { bd = d; best = m.group ?? m.id; }
			}
			if (best !== field.hover) field.hover = best;
		}
		const onLeave = () => { pointer.x = pointer.y = -999; };

		resize();
		addEventListener("resize", resize);
		addEventListener("pointermove", onMove, { passive: true });
		document.addEventListener("pointerleave", onLeave);
		raf = requestAnimationFrame(frame);
		return () => {
			cancelAnimationFrame(raf);
			removeEventListener("resize", resize);
			removeEventListener("pointermove", onMove);
			document.removeEventListener("pointerleave", onLeave);
			canvas.remove();
			document.documentElement.classList.remove("wwt-field-on");
			field.mode = "ground"; chart.marks = []; chart.paths = []; chart.texts = []; chart.paint = null; field.hover = null;
		};
	});
</script>
