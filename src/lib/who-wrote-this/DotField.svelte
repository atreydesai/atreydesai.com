<script lang="ts">
	// The page-wide field: one canvas pinned to the viewport and mounted on <body> (the site's page layer is transformed
	// during route transitions, which would unpin a fixed child). Sections draw into it through `field` and `chart`.
	//
	// Performance: the dotted ground itself is the page's CSS background (free to scroll). The canvas draws only what
	// changes: a dimming veil over the ground while a section owns it, the lens of swollen dots under the pointer, a
	// section's chart marks (tweened toward their targets), or a section's own painting. It redraws only when something
	// changed (scroll, pointer, size, the field's state, the chart's content, or a tween or painting still moving);
	// otherwise a frame costs a few property reads and the last picture stays on the canvas.
	//
	// The legacy hero variants (?art=dots|mosaic) still move every ground dot, so they draw the whole grid here.
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
	type Live = { x: number; y: number; r: number; a: number; tx: number; ty: number };

	const mix = (p: RGB, q: RGB, t: number): RGB => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];
	const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

	onMount(() => {
		const canvas = document.createElement("canvas");
		canvas.className = "wwt-field";
		canvas.setAttribute("aria-hidden", "true");
		Object.assign(canvas.style, { position: "fixed", inset: "0", width: "100vw", height: "100vh", zIndex: "0", pointerEvents: "none" });
		document.body.prepend(canvas);
		const ctx = canvas.getContext("2d")!;
		const reduceMQ = matchMedia("(prefers-reduced-motion: reduce)");
		let W = 0, H = 0, dpr = 1, raf = 0, last = performance.now();
		let dots: Dot[] = [];
		const live = new Map<string, Live>();
		const pointer = { x: -999, y: -999 };
		let pointerMoved = false, resized = true, lastScroll = -1, lastKey = "", lastSig = NaN;
		let dimE = 0, animating = false, paintBusy = false, lensDrawn = false, legacyOn = false;
		// this frame's view of the field (one read each, not one per dot)
		const F = { mode: "ground" as string, level: 0, dim: 0, shape: "dot" as string, hover: null as string | null, anchor: field.anchor };

		function resize() {
			dpr = Math.min(2, devicePixelRatio || 1);
			W = innerWidth; H = innerHeight;
			canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			if (legacyOn) buildDots();
			resized = true;
		}
		function buildDots() {
			dots = [];
			for (let gy = -PITCH; gy < H + PITCH * 2; gy += PITCH)
				for (let gx = 9; gx < W + PITCH; gx += PITCH)
					dots.push({ gx, gy, x: gx, y: gy, r: 1.1, a: 0.07, c: INK, seed: Math.random(), s2: Math.random(), s3: Math.random() });
		}
		function setLegacy(on: boolean) {
			if (on === legacyOn) return;
			legacyOn = on;
			document.documentElement.classList.toggle("wwt-field-on", on); // hides the CSS ground while the canvas draws it
			if (on) buildDots(); else dots = [];
		}

		// ---- legacy hero variants: every ground dot moves -------------------------------------------------------------
		function target(d: Dot, oy: number): { x: number; y: number; r: number; a: number; c: RGB } {
			const x = d.gx, y = d.gy + 9 - oy;
			const tile = F.shape === "tile";
			// mosaic: the ground is tesserae, a few of them in the three questions' colours
			const tint = tile && d.seed < 0.05 ? [ROSE, AUB, TEAL][Math.floor(d.seed * 60) % 3] : null;
			const base = { x, y, r: tile ? 1.5 : 1.1, a: (tint ? 0.22 : tile ? 0.06 : 0.07) * (1 - F.dim * 0.85), c: tint ?? INK };
			if (F.mode !== "levels") return base;
			const inside = (B: Box) => x > B.x && x < B.x + B.w && y > B.y && y < B.y + B.h;
			if (F.level === 0) {
				for (let i = 0; i < hero.bands.length; i++) if (inside(hero.bands[i])) return level(i + 1, hero.bands[i], d, x, y, true);
				return base;
			}
			return inside(F.anchor) ? level(F.level, F.anchor, d, x, y, false) : base;
		}
		const cache = new Map<string, ReturnType<typeof labCenters>>();
		const centers = (B: Box) => {
			const key = `${B.x | 0},${B.y | 0},${B.w | 0},${B.h | 0}`;
			let c = cache.get(key);
			if (!c) { c = labCenters(B); cache.set(key, c); }
			return c;
		};
		function level(n: number, B: Box, d: Dot, x: number, y: number, small: boolean) {
			if (n === 1) {
				const t = smooth(0.46, 0.54, (x - B.x) / B.w + (d.s2 - 0.5) * 0.1);
				return { x, y, r: small ? 1.9 : 2.4, a: small ? 0.62 : 0.74, c: mix(ROSE, AUB, t) };
			}
			if (n === 2) {
				const k = Math.floor(d.seed * 100);
				const lab = k < 22 ? 0 : k < 44 ? 1 : k < 66 ? 2 : 3 + (k % 8);
				const c = centers(B)[lab];
				const ang = d.s2 * 6.2832, rad = c.r * Math.sqrt(d.s3);
				const col = lab === 0 ? ROSE : lab === 1 ? TEAL : lab === 2 ? AUB : GRAY;
				return { x: c.x + Math.cos(ang) * rad, y: c.y + Math.sin(ang) * rad, r: lab < 3 ? (small ? 1.8 : 2.3) : small ? 1.5 : 1.9, a: lab < 3 ? 0.78 : 0.58, c: col };
			}
			const dx = x - (B.x + B.w * 0.62), dy = y - (B.y + B.h * 0.5);
			const lit = dx >= -PITCH / 2 && dx < PITCH / 2 && dy >= -PITCH / 2 && dy < PITCH / 2;
			return lit ? { x, y, r: small ? 6 : 11, a: 1, c: TEAL } : { x, y, r: small ? 1.6 : 2.1, a: small ? 0.26 : 0.34, c: INK };
		}
		function drawLegacy(k: number, now: number, sy: number, lens: boolean) {
			const oy = sy % PITCH;
			cache.clear();
			let moving = false;
			for (const d of dots) {
				const t = target(d, oy);
				const ex = t.x - d.x, ey = t.y - d.y, er = t.r - d.r, ea = t.a - d.a;
				if (Math.abs(ex) + Math.abs(ey) + Math.abs(er) > 0.05 || Math.abs(ea) > 0.003) moving = true;
				d.x += ex * k; d.y += ey * k; d.r += er * k; d.a += ea * k;
				d.c = mix(d.c, t.c, k);
				let r = d.r, a = d.a;
				if (lens) {
					const dist = Math.hypot(d.x - pointer.x, d.y - pointer.y);
					if (dist < 120) { const f = 1 - dist / 120; r += f * f * 1.8; a += f * f * 0.3; }
				}
				if (d.y < -10 || d.y > H + 10 || a < 0.01) continue;
				ctx.fillStyle = `rgba(${d.c[0] | 0},${d.c[1] | 0},${d.c[2] | 0},${a})`;
				if (F.shape === "tile") ctx.fillRect(d.x - r, d.y - r, r * 2, r * 2);
				else { ctx.beginPath(); ctx.arc(d.x, d.y, r, 0, 6.2832); ctx.fill(); }
				if (F.mode === "levels" && r > 5) {
					moving = true; // the lit dot's ring pulses
					ctx.strokeStyle = `rgba(67,126,142,${0.35 + 0.25 * Math.sin(now / 300)})`; ctx.lineWidth = 2;
					ctx.beginPath(); ctx.arc(d.x, d.y, r + 8 + 3 * Math.sin(now / 300), 0, 6.2832); ctx.stroke();
				}
			}
			return moving;
		}

		// ---- the lens: only the dots near the pointer, drawn over the CSS ground -------------------------------------
		function drawLens(sy: number) {
			const R = 120, px = pointer.x, py = pointer.y;
			const y0 = 9 - (sy % PITCH);
			const j0 = Math.floor((py - R - y0) / PITCH), j1 = Math.ceil((py + R - y0) / PITCH);
			const i0 = Math.max(0, Math.floor((px - R - 9) / PITCH)), i1 = Math.ceil((px + R - 9) / PITCH);
			ctx.fillStyle = "rgb(20,32,45)";
			for (let j = j0; j <= j1; j++) {
				const y = y0 + j * PITCH;
				for (let i = i0; i <= i1; i++) {
					const x = 9 + i * PITCH, dist = Math.hypot(x - px, y - py);
					if (dist >= R) continue;
					const f = 1 - dist / R;
					ctx.globalAlpha = 0.05 + f * f * 0.3;
					ctx.beginPath(); ctx.arc(x, y, 1.1 + f * f * 1.8, 0, 6.2832); ctx.fill();
				}
			}
			ctx.globalAlpha = 1;
		}

		// ---- charts: a cheap fingerprint of the content, so an unchanged chart is not redrawn ------------------------
		function chartSig() {
			let s = chart.marks.length * 7919 + chart.paths.length * 104729 + chart.texts.length * 1299709;
			for (const m of chart.marks) {
				const c = m.color;
				s += m.x * 1.13 + m.y * 2.71 + m.r * 3.3 + (m.alpha ?? 1) * 5.9 + (m.ring ? 11 : 0) + (m.square ? 13 : 0)
					+ c.charCodeAt(1) + c.charCodeAt(3) * 3 + c.charCodeAt(5) * 7;
				if (m.backing) s += m.backing * 23;
				if (m.snap) s += 29;
				if (m.spriteKey) { const q = m.spriteKey; s += q.length * 17 + q.charCodeAt(0) + q.charCodeAt(q.length - 1) * 5 + q.charCodeAt(q.length >> 1) * 9; }
			}
			for (const p of chart.paths) {
				const n = p.pts.length;
				s += p.progress * 97 + n * 3 + (n ? p.pts[0][0] + p.pts[0][1] * 1.7 + p.pts[n - 1][0] * 2.3 + p.pts[n - 1][1] * 2.9 : 0) + p.width;
			}
			for (const t of chart.texts) s += t.x + t.y * 1.7 + t.t.length * 5 + t.t.charCodeAt(0);
			return s;
		}
		function drawChart(k: number) {
			let moving = false;
			for (const p of chart.paths) {
				if (p.pts.length < 2 || p.progress <= 0) continue;
				let total = 0;
				for (let i = 1; i < p.pts.length; i++) total += Math.hypot(p.pts[i][0] - p.pts[i - 1][0], p.pts[i][1] - p.pts[i - 1][1]);
				let left = total * Math.min(1, p.progress);
				ctx.strokeStyle = p.color; ctx.lineWidth = p.width; ctx.setLineDash(p.dash ?? []);
				ctx.beginPath(); ctx.moveTo(p.pts[0][0], p.pts[0][1]);
				for (let i = 1; i < p.pts.length && left > 0; i++) {
					const x0 = p.pts[i - 1][0], y0 = p.pts[i - 1][1], x1 = p.pts[i][0], y1 = p.pts[i][1];
					const s = Math.hypot(x1 - x0, y1 - y0);
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
			const seen = new Set<string>();
			// a chart that moved as a whole (its stage scrolling in or out) moves at once: only real changes tween, so
			// tiles never drift behind their lines and labels while the page scrolls
			let tdx = NaN, tdy = NaN, uniform = true, any = false;
			for (const m of chart.marks) {
				const l = live.get(m.id);
				if (!l) continue;
				const dx = m.x - l.tx, dy = m.y - l.ty;
				if (!any) { tdx = dx; tdy = dy; any = true; }
				else if (Math.abs(dx - tdx) > 0.5 || Math.abs(dy - tdy) > 0.5) { uniform = false; break; }
			}
			if (any && uniform && (Math.abs(tdx) > 0.01 || Math.abs(tdy) > 0.01))
				for (const m of chart.marks) { const l = live.get(m.id); if (l) { l.x += tdx; l.y += tdy; } }
			// hover: square tiles and prints keep their size (they would overlap); the group gets one outline instead
			let hx0 = Infinity, hy0 = Infinity, hx1 = -Infinity, hy1 = -Infinity, hcol = "";
			for (const m of chart.marks) {
				seen.add(m.id);
				let l = live.get(m.id);
				if (!l) { // a new mark lifts off the ground near where it is going (or appears in place, if it snaps)
					const a = Math.random() * 6.28, d = m.snap ? 0 : 140 + Math.random() * 220;
					l = { x: m.x + Math.cos(a) * d, y: m.y + Math.sin(a) * d, r: m.snap ? m.r : 1.1, a: 0.1, tx: m.x, ty: m.y };
					live.set(m.id, l);
				}
				l.tx = m.x; l.ty = m.y;
				if (m.snap) { l.x = m.x; l.y = m.y; }
				const hov = F.hover !== null && F.hover === (m.group ?? m.id);
				const flat = m.square || !!m.sprite;
				if (hov && flat) { hx0 = Math.min(hx0, m.x - m.r); hy0 = Math.min(hy0, m.y - m.r); hx1 = Math.max(hx1, m.x + m.r); hy1 = Math.max(hy1, m.y + m.r); hcol = m.color; }
				const tr = hov && !flat ? m.r * 1.3 : m.r, ta = m.alpha ?? 1; // a modest lift: hovered dots should not cover neighbours
				const ex = m.x - l.x, ey = m.y - l.y, er = tr - l.r, ea = ta - l.a;
				if (Math.abs(ex) + Math.abs(ey) + Math.abs(er) > 0.05 || Math.abs(ea) > 0.003) moving = true;
				l.x += ex * k; l.y += ey * k; l.r += er * k; l.a += ea * k;
				ctx.globalAlpha = l.a;
				ctx.fillStyle = m.color;
				if (m.sprite) { // a small fingerprint, on a square of its colour so the tile keeps its weight
					const h = l.r * 2, w = h * (m.aspect ?? 0.8);
					if (m.backing) { ctx.globalAlpha = l.a * m.backing; ctx.fillRect(l.x - h / 2, l.y - h / 2, h, h); ctx.globalAlpha = l.a; }
					ctx.drawImage(m.sprite, l.x - w / 2, l.y - h / 2, w, h);
					continue;
				}
				if (m.square) { ctx.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2); continue; }
				ctx.beginPath(); ctx.arc(l.x, l.y, l.r, 0, 6.2832);
				if (m.ring) { ctx.fillStyle = "#E8E8E3"; ctx.fill(); ctx.strokeStyle = m.color; ctx.lineWidth = 1.8; ctx.stroke(); }
				else ctx.fill();
				if (hov) { ctx.strokeStyle = m.color; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(l.x, l.y, l.r + 5, 0, 6.2832); ctx.stroke(); }
			}
			ctx.globalAlpha = 1;
			if (hcol) { ctx.strokeStyle = "#14202D"; ctx.lineWidth = 1.5; ctx.strokeRect(hx0 - 4, hy0 - 4, hx1 - hx0 + 8, hy1 - hy0 + 8); }
			// marks that left the chart fade back into the ground
			for (const [id, l] of live) if (!seen.has(id)) { moving = true; l.a += (0 - l.a) * k; if (l.a < 0.02) live.delete(id); }
			return moving;
		}

		function frame(now: number) {
			raf = requestAnimationFrame(frame);
			// the viewport can change size without a resize event (device emulation, zoom): keep the canvas matched
			if (innerWidth !== W || innerHeight !== H) resize();
			const dt = Math.min(0.05, (now - last) / 1000);
			last = now;
			const reduce = reduceMQ.matches;
			F.mode = field.mode; F.level = field.level; F.dim = field.dim; F.shape = field.shape; F.hover = field.hover;
			const legacy = F.mode === "levels" || F.shape === "tile";
			setLegacy(legacy);
			if (legacy) F.anchor = field.anchor;
			const sy = scrollY, scrolled = sy !== lastScroll;
			lastScroll = sy;
			const moved = pointerMoved;
			pointerMoved = false;
			const k = reduce ? 1 : 1 - Math.pow(0.0015, dt);
			const dimWas = dimE;
			dimE += (F.dim - dimE) * k;
			if (Math.abs(F.dim - dimE) < 0.002) dimE = F.dim;
			const key = `${F.mode}|${F.level}|${F.shape}|${F.hover}|${F.dim}`;
			const stateChanged = key !== lastKey;
			lastKey = key;
			let chartChanged = false;
			if (F.mode === "chart") { const sig = chartSig(); chartChanged = sig !== lastSig; lastSig = sig; } else lastSig = NaN;
			const lensWanted = !reduce && !legacy && F.mode === "ground" && pointer.x > -900;
			const dirty = resized || stateChanged || dimWas !== dimE || animating || chartChanged
				|| (F.mode === "paint" && paintBusy)
				|| (scrolled && (legacy || lensDrawn || lensWanted || F.mode === "paint"))
				|| (moved && (legacy || lensDrawn || lensWanted || F.mode === "paint"));
			resized = false;
			if (!dirty) return;

			ctx.clearRect(0, 0, W, H);
			animating = false;
			lensDrawn = false;
			if (legacy) animating = drawLegacy(k, now, sy, !reduce && F.mode !== "chart" && F.mode !== "paint");
			else {
				// a veil of the ground colour dims the CSS dots behind a section's chart or painting
				if (dimE > 0.004) { ctx.fillStyle = `rgba(232,232,227,${(dimE * 0.85).toFixed(3)})`; ctx.fillRect(0, 0, W, H); }
				if (lensWanted) { drawLens(sy); lensDrawn = true; }
			}
			if (F.mode === "chart") animating = drawChart(k) || animating;
			paintBusy = F.mode === "paint" && chart.paint ? chart.paint(ctx, { now, dt, w: W, h: H, dpr }) !== false : false;
		}

		function onMove(e: PointerEvent) {
			pointer.x = e.clientX; pointer.y = e.clientY;
			pointerMoved = true;
			if (field.mode !== "chart" || !field.interactive) { if (field.hover) field.hover = null; return; }
			let best: string | null = null, bd = 14;
			for (const m of chart.marks) {
				if ((m.alpha ?? 1) < 0.3) continue;
				const d = Math.hypot(m.x - e.clientX, m.y - e.clientY);
				if (d < bd) { bd = d; best = m.group ?? m.id; }
			}
			if (best !== field.hover) field.hover = best;
		}
		const onLeave = () => { pointer.x = pointer.y = -999; pointerMoved = true; };

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
