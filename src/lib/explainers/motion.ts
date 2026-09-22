// Shared motion vocabulary for the research explainers.
//
// Every explainer is a GSAP timeline over hand-written inline SVG. The SVG is
// server-rendered in its poster state (the first beat), so the card is
// complete before any script loads; GSAP is imported only once an explainer
// scrolls into view. These helpers keep the three scenes speaking one motion
// language: things arrive with a short rise on the emphasized ease, leave with
// a quicker fade, and lines draw rather than pop.

import type { gsap as GsapInstance } from "gsap";

export type Gsap = typeof GsapInstance;
export type Timeline = gsap.core.Timeline;
type Targets = gsap.TweenTarget;

/** A named moment in the loop: the step chips and the progress rail use these. */
export interface Beat {
	id: string;
	/** Short label for the step chip. */
	label: string;
	/** Seconds from the start of the loop. */
	at: number;
	/** The step's settled frame, for the step chips; defaults to just before the next step. */
	hold?: number;
}

// Type scale, in plate units (the plate is 240 wide; at the 144px card one
// unit is 0.6px). Nothing drops below LABEL, about 8px on the card. Captions
// on the bottom band stay under CAPTION_MAX wide, clear of the card's pause
// control in the bottom-right corner.
export const T = {
	hero: 36,
	body: 21,
	stem: 19.5,
	head: 20,
	caption: 20,
	label: 13.5,
} as const;
export const CAPTION_MAX = 170;

export interface Scene {
	beats: Beat[];
	/** Loop length in seconds; the loop always ends back on the poster. */
	duration: number;
	build: (gsap: Gsap, tl: Timeline, root: SVGSVGElement) => void;
}

// The emphasized site ease, cubic-bezier(0.16, 1, 0.3, 1), is closest to
// power3.out among GSAP's built-ins.
export const EASE = { enter: "power3.out", exit: "power2.in", move: "power2.inOut" } as const;
export const DUR = { enter: 0.45, exit: 0.3, move: 0.6 } as const;

let loader: Promise<Gsap> | null = null;

export function loadGsap(): Promise<Gsap> {
	loader ??= Promise.all([import("gsap"), import("gsap/DrawSVGPlugin")]).then(
		([core, draw]) => {
			core.gsap.registerPlugin(draw.DrawSVGPlugin);
			return core.gsap;
		},
	);
	return loader;
}

/** Fade and rise in. Starts from whatever the markup says (hidden by default).
 *  Captions fade in place: a rise would carry their lower line onto the rail. */
export function enter(tl: Timeline, targets: Targets, at: number | string, vars: gsap.TweenVars = {}) {
	return tl.fromTo(
		targets,
		{ autoAlpha: 0, y: (_: number, el: Element) => (el.classList?.contains("xp-caption") ? 0 : 4) },
		{ autoAlpha: 1, y: 0, duration: DUR.enter, ease: EASE.enter, immediateRender: false, ...vars },
		at,
	);
}

/** Fade out. */
export function exit(tl: Timeline, targets: Targets, at: number | string, vars: gsap.TweenVars = {}) {
	return tl.to(targets, { autoAlpha: 0, duration: DUR.exit, ease: EASE.exit, ...vars }, at);
}

/** Bring back something that was on screen earlier (the poster, at loop end). */
export function restore(tl: Timeline, targets: Targets, at: number | string, vars: gsap.TweenVars = {}) {
	return tl.to(targets, { autoAlpha: 1, y: 0, duration: DUR.enter, ease: EASE.enter, ...vars }, at);
}

/** Replace one caption (or any element) with another in place: the old one
 *  is fully gone before the new one appears, so two texts never share a spot. */
export function swap(tl: Timeline, out: Targets, into: Targets, at: number) {
	exit(tl, out, at);
	enter(tl, into, at + DUR.exit);
}

/** Reveal text left to right by growing a clip rect, as if it were written. */
export function write(tl: Timeline, clipRect: Targets, width: number, at: number | string, duration = 0.5) {
	return tl.fromTo(
		clipRect,
		{ attr: { width: 0 } },
		{ attr: { width }, duration, ease: "power2.out", immediateRender: false },
		at,
	);
}

/** Draw a stroke from its start. */
export function draw(tl: Timeline, path: Targets, at: number | string, duration = 0.8, vars: gsap.TweenVars = {}) {
	return tl.fromTo(
		path,
		{ drawSVG: "0%" },
		{ drawSVG: "100%", duration, ease: EASE.move, immediateRender: false, ...vars },
		at,
	);
}

/** Count a text node up to a number, e.g. "56%". */
export function count(
	tl: Timeline,
	el: Element | null,
	to: number,
	at: number | string,
	format: (n: number) => string,
	duration = 0.8,
) {
	if (!el) return tl;
	const state = { n: 0 };
	return tl.to(
		state,
		{
			n: to,
			duration,
			ease: "power2.out",
			onUpdate: () => (el.textContent = format(state.n)),
		},
		at,
	);
}

// Bars stand on their axis. Each bar runs TUCK units below the baseline and
// sits in a group clipped just above the axis line, so its top corners round,
// its foot is square, and the axis (drawn after the bars) is never covered.
export const TUCK = 3;

/** Markup geometry for a bar of height `h` standing on `base`. */
export function barBox(base: number, h: number) {
	return { y: base - h, height: h + TUCK };
}

/** Grow a bar up from its baseline to height `h`: always bottom to top. */
export function rise(
	tl: Timeline,
	bar: Targets,
	base: number,
	h: number,
	at: number | string,
	duration = 0.7,
	vars: gsap.TweenVars = {},
) {
	return tl.fromTo(
		bar,
		{ attr: { y: base, height: TUCK } },
		{ attr: barBox(base, h), duration, ease: "power3.out", immediateRender: false, ...vars },
		at,
	);
}

/** Retarget a standing bar to height `h`. */
export function resize(tl: Timeline, bar: Targets, base: number, h: number, at: number | string, duration = 0.8) {
	return tl.to(bar, { attr: barBox(base, h), duration, ease: "power3.inOut" }, at);
}
