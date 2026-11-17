<script lang="ts">
	// The lede's hold: the paragraph is pinned, centred on the screen, for a stretch of scroll (HOLD_VH, an invisible
	// buffer like the one the timeline's headline has before its steps), and the stretch adapts to the reader's speed.
	// A slow reader gets the plain hold and nothing else. A reader who would reach its end sooner than MIN_MS after the
	// lede settled (a fast scroll) gets it lengthened by what that speed covers in the rest of MIN_MS, up to the room
	// below the lede before the next section: a fast scroll takes a little more scrolling, the lede pausing before the
	// page goes on (Atrey, 17 Nov).
	//
	// How: the pinned stage (position: sticky) sits in a run box absolutely positioned in the wrap. A longer hold is the
	// run box reaching further down (`extra`), into the empty top of the next section, so the browser's own sticky
	// positioning keeps holding the lede: no transform chases the scroll (no shudder on a phone's momentum scroll or a
	// threaded wheel scroll), and nothing in the page's flow moves (the next section and everything after stay where they
	// are). The heading of the next section never comes closer than GAP under the held lede. In the page's loop, on
	// scroll frames only: the lengthening is decided once per pass, just before the plain hold would end, and set back to
	// 0 only where that moves nothing on screen. Nothing runs while idle but one timer per pass. The scroll is never
	// taken over (no wheel handling, no scrollTo). Under prefers-reduced-motion: the plain hold.
	import { onMount, type Snippet } from "svelte";
	import { onScroll, docBox, view } from "./loop";

	let { label, children }: { label: string; children: Snippet } = $props();

	const HOLD_VH = 35; // the plain hold: this much scroll (in hundredths of the viewport's height) with the lede in place
	const MIN_MS = 600; // a fast reader still has the lede in place this long after it settled, as far as the room allows
	const GAP = 24; // px kept between the held lede's bottom and the top of the next section
	const LEAST = 24; // px: a smaller lengthening is not made (a slow reader's rounding)
	const JUMP = 0.8; // a move of more than this many screens in one frame is a jump (a nav link, a restored scroll)

	let wrap: HTMLElement;
	let ledeH = $state(0);
	let extra = $state(0); // px the hold is lengthened by, this pass

	onMount(() => {
		const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
		let prevY = NaN, prevT = 0, v = 0; // v: scroll speed, px per ms (down is positive), lightly smoothed
		let armT = -1, decided = false, timer = 0, rel = Infinity;
		const forget = () => { armT = -1; decided = false; clearTimeout(timer); timer = 0; if (extra) extra = 0; };
		// MIN_MS after the lede settled: no more lengthening this pass; if the reader is still within the plain hold, the
		// lengthening goes (the stage is pinned either way there, so nothing moves)
		const expire = () => { timer = 0; armT = -1; if (extra && view.y <= rel) extra = 0; };

		const read = (now: number) => {
			const y = view.y, H = view.h, dy = y - prevY, dt = now - prevT, before = prevY;
			const jump = !(Math.abs(dy) < JUMP * H); // (NaN on the first frame: a jump)
			if (jump || dt <= 0) v = 0;
			else { const vi = dy / dt; v = dt > 120 ? vi : v + (vi - v) * 0.5; }
			prevY = y; prevT = now;

			const { top, h } = docBox(wrap);
			rel = top + h - H; // where the plain hold ends: the stage's bottom meets the wrap's
			// well away from the hold, or back above it (the stage is not pinned): the lengthening shows nowhere
			if (y < top || y > rel + extra + H) { if (armT >= 0 || extra) forget(); return; }
			// the lede settles (the stage pins) on a scroll down from above, not on a jump into the hold
			if (!jump && before < top && !reduce) {
				forget();
				armT = now;
				timer = window.setTimeout(expire, MIN_MS);
			}
			if (armT < 0) { if (extra && y <= rel) extra = 0; return; }
			// decide once, a little before the plain hold would end (far enough ahead that the longer hold is in place
			// before the browser reaches the end of the shorter one), and only while the lede is still pinned
			const ahead = Math.max(0.06 * H, v * 50);
			if (decided || y < rel - ahead) return;
			decided = true;
			if (y >= rel - 2 || v <= 0) return;
			const next = wrap.nextElementSibling;
			const below = next ? docBox(next).top - (top + h) : 0; // the next section's own top margin
			// the room under the lede; and never so far that the next section's top passes 65% of the screen, where the
			// timeline (its observer's -35% margins) would start its chart under a lede that is still held
			const room = Math.max(0, Math.min((H - ledeH) / 2, 0.35 * H) + below - GAP);
			const want = Math.min(room, v * (armT + MIN_MS - now) - (rel - y));
			if (want >= LEAST) extra = Math.round(want);
		};
		const stop = onScroll(read);
		return () => { stop(); clearTimeout(timer); };
	});
</script>

<section class="lede-wrap" aria-label={label} bind:this={wrap} style="--hold:{HOLD_VH}">
	<div class="run" style:bottom="{-extra}px">
		<div class="stage">
			<div class="box" bind:clientHeight={ledeH}>{@render children()}</div>
		</div>
	</div>
</section>

<style>
	/* a screen of its own plus the hold; the run box is the stage's sticky range (the wrap, or further when lengthened) */
	.lede-wrap { position: relative; height: calc((100 + var(--hold)) * var(--vh, 1vh)); }
	.run { position: absolute; top: 0; left: 0; right: 0; pointer-events: none; }
	.stage { position: sticky; top: 0; box-sizing: border-box; min-height: calc(100 * var(--vh, 1vh)); padding-block: 24px; display: grid; align-content: center; }
	.box { pointer-events: auto; }
	/* a screen too short to hold the whole paragraph: it scrolls with the page, with its screen of ground around it */
	@media (max-height: 520px) {
		.lede-wrap { height: auto; }
		.run { position: static; }
		.stage { position: static; min-height: calc(100 * var(--vh, 1vh)); padding-block: calc(16 * var(--vh, 1vh)); }
	}
</style>
