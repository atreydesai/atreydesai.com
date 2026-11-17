// One loop for the page's scroll-driven work, so a frame lays the page out once.
//
// Each section used to listen for scroll itself and read the layout (getBoundingClientRect, innerHeight, scrollY) in
// its listener. Svelte applies a listener's state changes to the DOM in a microtask as soon as that listener returns,
// so the next section's read found the layout dirty and made the browser lay out the page again: several layouts per
// scroll event, each the cost of a whole frame on an older laptop. Here every reader runs inside one callback, once per
// frame, in phases:
//   1. the scroll position and the viewport's size are read once (`view`), before anything is written;
//   2. readers (onScroll): each section works out where the reader is from `view` and the layout (still clean, since
//      nothing has been written yet), and updates its state;
//   3. frame jobs (requestFrame): a section's own drawing work asked for this frame (a chart's layout, a tween);
//   4. the drawer: the page canvas (DotField) draws last, from what the sections left in `chart`.
// Svelte's DOM updates from all of them land together, after the callback. Nothing runs while nothing changes.
//
// Phones and touch screens get the same page in a lighter mode (`lite`, below): a steady viewport height, steps that
// follow the scroll directly, and cards that open only on a deliberate tap, never because a scroll began on a chart.

export const view = { y: 0, w: 0, h: 0 };

/** The lighter mode, for touch screens (pointer: coarse) and widths of 600 px or less. Plain values: read them when
 * needed. touch: the primary pointer is coarse (a finger). */
export const lite = { on: false, touch: false };

type Fn = (now: number) => void;
const readers = new Set<Fn>();
let jobs: Fn[] = [];
let drawer: Fn | null = null;
let raf = 0, scrolled = true, started = false, before = false; // before: in this loop, the drawer has yet to run

// one section's error must not stop the others (or the loop)
const call = (fn: Fn, now: number) => { try { fn(now); } catch (err) { console.error(err); } };

// The viewport's height. On a touch screen the browser's address bar slides in and out as the reader scrolls, which
// changes innerHeight by 50 to 100 px. Taking that change would move every pinned section's steps, re-lay out its stage
// and resize the page canvas mid-scroll. So a touch screen keeps one height: the largest the viewport can be (the large
// viewport, as CSS's lvh has it, or innerHeight if larger), measured again only when the width changes (a turn of the
// phone) or the height changes by more than a quarter (a split screen). The page's CSS takes the same height through
// --vh (and the small viewport's through --svh), so its pinned stages and scroll lengths hold still too; elsewhere the
// variables are unset and the CSS falls back to plain vh.
let probes: [HTMLElement, HTMLElement] | null = null, measuredW = -1, coarse: MediaQueryList | null = null, varsSet = false;
function viewportHeights(): [number, number] {
	if (!probes) {
		const mk = (unit: string) => {
			const el = document.createElement("div");
			el.setAttribute("aria-hidden", "true");
			el.style.cssText = "position:fixed;left:0;top:0;width:0;height:100vh;visibility:hidden;pointer-events:none";
			el.style.setProperty("height", `100${unit}`); // where supported
			document.body.appendChild(el);
			return el;
		};
		probes = [mk("lvh"), mk("svh")];
	}
	return [probes[0].offsetHeight, probes[1].offsetHeight];
}
function measureView() {
	const w = innerWidth, h = innerHeight;
	lite.touch = coarse?.matches ?? false;
	lite.on = lite.touch || w <= 600;
	view.w = w;
	if (!lite.touch) {
		view.h = h;
		if (varsSet) { varsSet = false; document.documentElement.style.removeProperty("--vh"); document.documentElement.style.removeProperty("--svh"); }
		return;
	}
	if (w !== measuredW || !view.h || Math.abs(h - view.h) > view.h * 0.25) {
		measuredW = w;
		const [large, small] = viewportHeights();
		view.h = Math.max(h, large);
		const root = document.documentElement.style;
		root.setProperty("--vh", `${view.h / 100}px`);
		root.setProperty("--svh", `${Math.min(view.h, small || h) / 100}px`);
		varsSet = true;
	}
	// a height-only change under a quarter (the address bar): ignored
}

function run(now: number) {
	raf = 0;
	before = true;
	view.y = scrollY; measureView();
	if (scrolled) { scrolled = false; for (const fn of readers) call(fn, now); }
	const due = jobs;
	jobs = []; // asked for during this phase: the next frame
	for (const fn of due) call(fn, now);
	before = false;
	if (drawer) call(drawer, now);
}
const schedule = () => { if (!raf) raf = requestAnimationFrame(run); };
let scrollAt = -1e9;
const onScrollEvent = () => { scrolled = true; scrollAt = performance.now(); if (down) down.scrolled = true; schedule(); };
const onResizeEvent = () => { scrolled = true; schedule(); };
function start() {
	if (started || typeof window === "undefined") return;
	started = true;
	coarse = matchMedia("(pointer: coarse)");
	view.y = scrollY; measureView();
	addEventListener("scroll", onScrollEvent, { passive: true });
	addEventListener("resize", onResizeEvent, { passive: true });
	coarse.addEventListener?.("change", onResizeEvent);
	// taps (below)
	addEventListener("pointerdown", onDown, { passive: true, capture: true });
	addEventListener("pointerup", onUp, { passive: true, capture: true });
	addEventListener("pointercancel", onCancel, { passive: true, capture: true });
}

/** true while the page is scrolling (it scrolled within the last `ms`) */
export const scrolling = (ms = 200) => performance.now() - scrollAt < ms;

// ---- deliberate taps ------------------------------------------------------------------------------------------------
// On a touch screen every scroll starts with a finger on something, often a chart. A card opens only on a deliberate
// tap: the finger lifted within 250 ms, having moved under 8 px, with no scroll in between. A mouse is unaffected.
type Tap = (x: number, y: number) => void;
const taps = new Set<Tap>();
let down: { id: number; x: number; y: number; t: number; scrolled: boolean } | null = null;
let tapOK = false, lastType = "mouse";
function onDown(e: PointerEvent) {
	lastType = e.pointerType || "mouse";
	tapOK = false;
	down = e.pointerType === "mouse" ? null : { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), scrolled: false };
}
function onUp(e: PointerEvent) {
	if (!down || e.pointerId !== down.id) return;
	tapOK = !down.scrolled && performance.now() - down.t < 250 && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 8;
	down = null;
	if (tapOK) for (const fn of taps) fn(e.clientX, e.clientY);
}
function onCancel() { down = null; tapOK = false; }
/** Call `fn` on each deliberate tap (touch or pen) with its viewport point. */
export function onTap(fn: Tap): () => void {
	start();
	taps.add(fn);
	return () => { taps.delete(fn); };
}
/** For a click handler: true for a mouse or keyboard click, and for a touch only when it was a deliberate tap. */
export function deliberate(e: Event): boolean {
	const t = (e as PointerEvent).pointerType;
	if (t === "mouse" || (!t && lastType === "mouse")) return true;
	if (!t && (e as MouseEvent).detail === 0) return true; // a keyboard "click"
	return tapOK;
}
/** the kind of pointer the reader last pressed with ("mouse", "touch" or "pen") */
export const pointerKind = () => lastType;

/** Run `fn` once per frame in which the page scrolled or resized (and once soon after it is added). */
export function onScroll(fn: Fn): () => void {
	start();
	readers.add(fn);
	scrolled = true; schedule();
	return () => { readers.delete(fn); };
}

/** Run `fn` once in the coming frame, after the readers (asked for during a reader: this frame). The same function
 * asked for twice runs once. */
export function requestFrame(fn: Fn) {
	start();
	if (!jobs.includes(fn)) jobs.push(fn);
	schedule();
}

/** Ask the drawer to draw in the coming frame. */
export function requestDraw() {
	if (typeof window === "undefined" || before) return; // (inside the loop, before the drawer: it is about to draw)
	start();
	schedule();
}

/** The page canvas: runs at the end of every loop. */
export function setDrawer(fn: Fn | null) {
	drawer = fn;
	if (fn) requestDraw();
}

/** Run the readers in the coming frame although nothing scrolled (a jump, a section's own size change). */
export function rescan() {
	scrolled = true;
	schedule();
}

// ---- where things sit on the page ----------------------------------------------------------------------------------
// A section's place in the document changes only when the page's layout does (a resize, the face loading, content
// changing height), so it is measured once and again only after the page's size has changed. Only for elements in the
// normal flow (not sticky or transformed ones), read during the loop's readers (view.y is current there).
let epoch = 0, watching = false;
const tops = new Map<Element, { e: number; top: number; h: number }>();
function watch() {
	if (watching || typeof window === "undefined") return;
	watching = true;
	const bump = () => { epoch++; rescan(); };
	new ResizeObserver(bump).observe(document.body);
	addEventListener("resize", bump, { passive: true });
	document.fonts?.ready.then(bump);
}
/** the element's top in document px (cached until the page's layout changes) */
export function docBox(el: Element): { top: number; h: number } {
	watch();
	const c = tops.get(el);
	if (c && c.e === epoch) return c;
	const r = el.getBoundingClientRect();
	const v = { e: epoch, top: r.top + scrollY, h: r.height };
	tops.set(el, v);
	return v;
}
