// Elastic spacing driven by scroll speed: so the eye lands on a section's words before what sits below them.
// Any element with data-lag="n" (n = 1, 2, 3 …, deeper = later) is pushed down by a spring whose target grows with
// the scroll velocity, but only while it is entering the viewport (its top in the lower part of the screen); once it
// has risen into the reading zone it sits exactly where the layout puts it. Fast scrolling opens space between a
// heading (no data-lag) and the blocks under it; slowing down closes it.
//
// Rules for authors: put data-lag only on text and card blocks, never on a sticky stage, a canvas anchor, or any
// ancestor of position: fixed elements (a transform would re-anchor them). Transforms only, no layout; the loop
// runs while scrolling or settling and stops when everything is at rest. Off under prefers-reduced-motion.

const MAX = 64; // px, the most space a block can open
const GAIN = 14; // px of offset per (px/ms of scroll speed) per depth step

export function startElastic(root: ParentNode = document): () => void {
	if (typeof window === "undefined" || matchMedia("(prefers-reduced-motion: reduce)").matches) return () => {};
	type Item = { el: HTMLElement; depth: number; off: number };
	let items: Item[] = [];
	const collect = () => {
		const els = [...root.querySelectorAll<HTMLElement>("[data-lag]")];
		const prev = new Map(items.map((it) => [it.el, it]));
		items = els.map((el) => prev.get(el) ?? { el, depth: Math.max(0, Number(el.dataset.lag) || 1), off: 0 });
		for (const [el, it] of prev) if (!els.includes(el)) { el.style.transform = ""; void it; }
	};
	collect();
	const mo = new MutationObserver(() => { clearTimeout(moT); moT = setTimeout(collect, 200); });
	let moT: ReturnType<typeof setTimeout> | undefined;
	mo.observe(root instanceof Document ? root.body : (root as Element), { childList: true, subtree: true, attributes: true, attributeFilter: ["data-lag"] });

	let lastY = scrollY, lastT = performance.now(), vel = 0, raf = 0, running = false;
	const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

	function frame(now: number) {
		const dt = Math.max(1, now - lastT);
		const y = scrollY;
		const v = (y - lastY) / dt; // px per ms, positive when scrolling down
		lastY = y; lastT = now;
		vel += (v - vel) * 0.35; // a little smoothing so a single jump does not kick
		const H = innerHeight;
		// read every position first, then write every transform (no layout thrash)
		const tops = items.map((it) => it.el.getBoundingClientRect().top - it.off);
		let moving = Math.abs(vel) > 0.01;
		items.forEach((it, i) => {
			const enter = smooth(0.4, 0.95, tops[i] / H); // 0 in the reading zone, 1 near the bottom edge
			const target = Math.max(-MAX * 0.4, Math.min(MAX, vel * GAIN * it.depth * enter));
			it.off += (target - it.off) * 0.18;
			if (Math.abs(it.off) < 0.05 && Math.abs(target) < 0.05) it.off = 0;
			else moving = true;
		});
		items.forEach((it) => { it.el.style.transform = it.off ? `translate3d(0,${it.off.toFixed(2)}px,0)` : ""; });
		if (moving) raf = requestAnimationFrame(frame);
		else { running = false; vel = 0; }
	}
	const wake = () => {
		if (running) return;
		running = true; lastY = scrollY; lastT = performance.now();
		raf = requestAnimationFrame(frame);
	};
	addEventListener("scroll", wake, { passive: true });
	return () => {
		removeEventListener("scroll", wake);
		cancelAnimationFrame(raf);
		mo.disconnect();
		clearTimeout(moT);
		for (const it of items) it.el.style.transform = "";
	};
}
