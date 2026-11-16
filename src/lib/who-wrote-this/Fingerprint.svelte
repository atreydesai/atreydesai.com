<script lang="ts">
	// PROTOTYPE of the "decipherable fingerprint" motif (art direction to be finished by Fable 5.2). A fingerprint
	// drawn in code whose ridges are lines of the paper's own sentences set very small, in rose, aubergine and teal.
	// A lens follows the pointer (or drifts on its own when idle) and redraws the ridges under it at reading size,
	// so the identity mark can literally be read.
	import { onMount } from "svelte";

	let { text, width = 560, height = 700 }: { text: string; width?: number; height?: number } = $props();
	let wrap: HTMLDivElement;
	let canvas: HTMLCanvasElement;

	const INKS = ["#C85A82", "#461E47", "#437E8E"];
	const MAG = 3.4;

	onMount(() => {
		const dpr = Math.min(2, devicePixelRatio || 1);
		const W = width, H = height;
		canvas.width = W * dpr; canvas.height = H * dpr;
		const ctx = canvas.getContext("2d")!;
		const base = document.createElement("canvas");
		const hi = document.createElement("canvas");
		base.width = W * dpr; base.height = H * dpr;
		hi.width = Math.round(W * MAG * dpr); hi.height = Math.round(H * MAG * dpr);

		// a seeded random, so the print is the same on every visit
		let seed = 7;
		const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
		const cx = W * 0.52, cy = H * 0.5, RX = W * 0.43, RY = H * 0.46;
		const inside = (x: number, y: number) => {
			const a = Math.atan2(y - cy, x - cx);
			const edge = 1 + 0.035 * Math.sin(a * 7 + 1) + 0.02 * Math.sin(a * 13);
			return ((x - cx) / RX) ** 2 + ((y - cy) / RY) ** 2 < edge * edge * (y > cy ? 1 : 0.97);
		};
		// ridges: nested, gently wobbling loops around an off-centre core that open into a loop pattern
		const ridges: [number, number][][] = [];
		const GAP = 9.2;
		for (let k = 1; k * GAP < Math.max(RX, RY) * 1.25; k++) {
			const s = k * GAP, pts: [number, number][] = [];
			const ph = rnd() * 6.28;
			for (let i = 0; i <= 720; i++) {
				const t = (i / 720) * Math.PI * 2;
				const wob = 1 + 0.06 * Math.sin(2 * t + ph * 0.2) + 0.035 * Math.sin(5 * t + ph) + 0.015 * Math.sin(11 * t);
				const open = Math.max(0, Math.cos(t - 1.9)) ** 6 * s * 0.55; // the loop's open side
				const x = cx - 18 + (s * 0.86 + open) * Math.cos(t) * wob;
				const y = cy + 24 + s * 1.12 * Math.sin(t) * wob - open * 0.6;
				pts.push([x, y]);
			}
			ridges.push(pts);
		}

		function render(c: CanvasRenderingContext2D, scale: number) {
			c.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
			c.clearRect(0, 0, W, H);
			c.textBaseline = "middle";
			let ti = 0;
			ridges.forEach((pts, k) => {
				c.fillStyle = INKS[(k + (k % 4 === 0 ? 1 : 0)) % 3];
				c.font = `500 4.7px Inter, system-ui, sans-serif`;
				let carry = 0;
				for (let i = 1; i < pts.length; i++) {
					const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
					const seg = Math.hypot(x1 - x0, y1 - y0), ang = Math.atan2(y1 - y0, x1 - x0);
					let d = carry;
					while (d < seg) {
						const x = x0 + ((x1 - x0) * d) / seg, y = y0 + ((y1 - y0) * d) / seg;
						const ch = text[ti % text.length];
						const w = c.measureText(ch).width + 0.25;
						if (inside(x, y)) {
							c.save(); c.translate(x, y); c.rotate(ang); c.fillText(ch, 0, 0); c.restore();
							ti++;
						}
						d += w;
					}
					carry = d - seg;
				}
			});
		}
		render(base.getContext("2d")!, 1);
		render(hi.getContext("2d")!, MAG);

		const lens = { x: W * 0.62, y: H * 0.6, r: 78, tx: W * 0.62, ty: H * 0.6, user: false };
		let raf = 0, t0 = performance.now(), idle = 0;
		const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
		function frame(now: number) {
			if (!lens.user && !reduce) { // drift slowly over the print when nobody is steering
				const t = (now - t0) / 1000;
				lens.tx = cx + Math.cos(t * 0.23) * RX * 0.45; lens.ty = cy + Math.sin(t * 0.31) * RY * 0.4;
			}
			lens.x += (lens.tx - lens.x) * 0.18; lens.y += (lens.ty - lens.y) * 0.18;
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			ctx.drawImage(base, 0, 0);
			ctx.save();
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			ctx.beginPath(); ctx.arc(lens.x, lens.y, lens.r, 0, 6.2832); ctx.closePath();
			ctx.fillStyle = "rgba(255,255,255,.93)"; ctx.fill();
			ctx.clip();
			// the lens shows the same spot from the high-resolution copy, MAG times larger
			const sw = 2 * lens.r * dpr;
			ctx.drawImage(hi, lens.x * MAG * dpr - lens.r * dpr, lens.y * MAG * dpr - lens.r * dpr, sw, sw, lens.x - lens.r, lens.y - lens.r, 2 * lens.r, 2 * lens.r);
			ctx.restore();
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			ctx.lineWidth = 3; ctx.strokeStyle = "#14202D";
			ctx.beginPath(); ctx.arc(lens.x, lens.y, lens.r, 0, 6.2832); ctx.stroke();
			ctx.lineWidth = 7; ctx.lineCap = "round";
			ctx.beginPath(); ctx.moveTo(lens.x + lens.r * 0.72, lens.y + lens.r * 0.72); ctx.lineTo(lens.x + lens.r * 1.18, lens.y + lens.r * 1.18); ctx.stroke();
			if (lens.user && now - idle > 4000) lens.user = false;
			raf = requestAnimationFrame(frame);
		}
		raf = requestAnimationFrame(frame);
		const move = (e: PointerEvent) => {
			const r = canvas.getBoundingClientRect();
			lens.tx = e.clientX - r.left; lens.ty = e.clientY - r.top; lens.user = true; idle = performance.now();
		};
		canvas.addEventListener("pointermove", move);
		return () => { cancelAnimationFrame(raf); canvas.removeEventListener("pointermove", move); };
	});
</script>

<div class="fp" bind:this={wrap} style="width:{width}px; max-width:100%; aspect-ratio:{width}/{height}">
	<canvas bind:this={canvas} style="width:100%; height:100%; display:block; cursor:none" aria-label="A fingerprint made of the paper's sentences; a lens makes them readable"></canvas>
</div>
