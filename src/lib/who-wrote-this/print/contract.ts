// The contract between the hero's scroll section (PrintHero.svelte) and the fingerprint renderer.
// The renderer draws ink only; every label, answer and tooltip is HTML placed at the anchors it returns.
// Do not change this file without changing PrintHero.svelte with it.

export type Box = { x: number; y: number; w: number; h: number };

export type PrintInput = {
	/** The level to show; the renderer eases toward it and must be reversible (scrolling up, or a row click, jumps back).
	 * 0: one print (the text whose author is unknown)
	 * 1: human or AI: the print divides into a human print and an AI print
	 * 2: which AI: the AI print divides into one print per lab, each with its own unique pattern
	 * 3: which human: the human print divides into a crowd of unique writers' prints, and one of them is lit */
	level: number;
	/** seconds (performance.now() / 1000) and seconds since the last frame */
	t: number;
	dt: number;
	/** the canvas covers the whole viewport; ctx arrives already scaled by dpr, in viewport px */
	view: { w: number; h: number; dpr: number };
	/** where the art lives (wide: right ~62% of the viewport; narrow: the lower part) */
	stage: Box;
	/** regions where ink must fade to near nothing (the panel's copy) */
	quiet: Box[];
	/** pointer in viewport px, or null when not over the page (touch: last tap) */
	pointer: { x: number; y: number } | null;
	/** 0..1: how far the section is pinned; fade in and out with it */
	enter: number;
	reduce: boolean;
};

export type Anchor = {
	/** "human" | "ai" | "lab:<name>" | "writer:<i>" | "lit" */
	id: string;
	x: number;
	y: number;
	/** radius of the print the anchor belongs to, viewport px */
	r: number;
	/** 0..1, how present the print is right now (labels fade with it) */
	alpha: number;
};

export type Hit = { id: string } | null;

export interface Print {
	/** draw one frame; do not clear the canvas (the page's dot ground is underneath) */
	draw(ctx: CanvasRenderingContext2D, s: PrintInput): void;
	/** where labels go, for the frame just drawn */
	anchors(): Anchor[];
	/** which print is under a viewport point, for hover and tap */
	hit(x: number, y: number): Hit;
	dispose?(): void;
}

export type PrintOptions = {
	/** ridge text: paper sentences already vetted for the page */
	text: string[];
	/** the lab prints in level 2, in this order; the first three are drawn larger and in colour */
	labs: string[];
	/** colours: rq1 human #C85A82, rq2 AI #461E47, rq3 #437E8E, ink #14202D; lab colours for the first three */
	colors: { human: string; ai: string; lit: string; ink: string; labs: string[]; other: string };
	/** the lit writer's ridge text in level 3 (readable in the lens) */
	litText: string;
	seed?: number;
};

export type CreatePrint = (opts: PrintOptions) => Print;
