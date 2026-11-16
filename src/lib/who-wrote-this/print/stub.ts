// A plain stand-in for the fingerprint renderer: same contract, simple rings. Used only until fingerprint.ts exists,
// so the scroll section, labels, hover and quiet regions can be tested on their own.
import type { Anchor, Box, CreatePrint, PrintInput } from "./contract";

export const createStub: CreatePrint = (opts) => {
	let anchors: Anchor[] = [];
	let eased = 0;
	const rings = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, a: number) => {
		ctx.strokeStyle = color; ctx.globalAlpha = a; ctx.lineWidth = Math.max(0.6, r / 40);
		for (let k = 1; k <= 8; k++) { ctx.beginPath(); ctx.ellipse(x, y, (r * k) / 8, (r * k * 1.2) / 8, 0, 0, 6.2832); ctx.stroke(); }
		ctx.globalAlpha = 1;
	};
	const quietAt = (q: Box[], x: number, y: number) => q.some((b) => x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h);
	return {
		draw(ctx, s: PrintInput) {
			eased += (s.level - eased) * (s.reduce ? 1 : Math.min(1, s.dt * 3));
			const L = Math.round(eased);
			const { x, y, w, h } = s.stage;
			const cx = x + w / 2, cy = y + h / 2, R = Math.min(w, h) * 0.36;
			const out: Anchor[] = [];
			const put = (id: string, px: number, py: number, r: number, color: string, a: number) => {
				if (quietAt(s.quiet, px, py)) a *= 0.1;
				rings(ctx, px, py, r, color, a * s.enter);
				out.push({ id, x: px, y: py, r, alpha: a * s.enter });
			};
			if (L === 0) put("one", cx, cy, R, opts.colors.ink, 0.8);
			if (L === 1) { put("human", cx - R * 0.6, cy, R * 0.6, opts.colors.human, 0.9); put("ai", cx + R * 0.6, cy, R * 0.6, opts.colors.ai, 0.9); }
			if (L === 2) {
				put("human", x + w * 0.1, y + h * 0.85, R * 0.2, opts.colors.human, 0.3);
				opts.labs.forEach((lab, i) => {
					const big = i < 3;
					const px = big ? x + (w * (2 * i + 1)) / 6 : x + (w * (i - 3 + 0.5)) / 8;
					const py = big ? y + h * 0.35 : y + h * 0.78;
					put(`lab:${lab}`, px, py, big ? R * 0.42 : R * 0.15, big ? opts.colors.labs[i] : opts.colors.other, 0.9);
				});
			}
			if (L === 3) {
				for (let i = 0; i < 60; i++) {
					const px = x + w * (0.08 + 0.84 * ((i % 10) / 9)), py = y + h * (0.15 + 0.7 * (Math.floor(i / 10) / 5));
					put(`writer:${i}`, px, py, 12, opts.colors.ink, 0.35);
				}
				put("lit", x + w * 0.62, y + h * 0.5, R * 0.35, opts.colors.lit, 1);
			}
			anchors = out;
		},
		anchors: () => anchors,
		hit(px, py) {
			let best: Anchor | null = null;
			for (const a of anchors) if (a.alpha > 0.2 && Math.hypot(a.x - px, a.y - py) < a.r && (!best || a.r < best.r)) best = a;
			return best ? { id: best.id } : null;
		},
	};
};
