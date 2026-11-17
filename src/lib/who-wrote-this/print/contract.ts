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
	/** the print the reader is inspecting (an anchor or hit id, "main" at level 0), or null: the renderer brings it
	 * forward (full ink) and lets the others recede a little, so the lens reads as pointing at one thing */
	focus?: string | null;
	/** the lighter mode (phones): the level follows the scroll as it slides, never paced as a leap, and the prints do
	 * not breathe while `calm` (the page is scrolling) */
	follow?: boolean;
	calm?: boolean;
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

/** "main" at level 0; "human" | "ai" | "lab:<name>" | "writer:<i>" | "lit" otherwise */
export type Hit = { id: string } | null;

export interface Print {
	/** draw one frame; do not clear the canvas (the page's dot ground is underneath) */
	draw(ctx: CanvasRenderingContext2D, s: PrintInput): void;
	/** where labels go, for the frame just drawn */
	anchors(): Anchor[];
	/** which print is under a viewport point, for hover and tap */
	hit(x: number, y: number): Hit;
	dispose?(): void;
	/** true while anything is still moving (easing toward the level, inking in, baking, the lens following the pointer).
	 * When false the host stops redrawing until the input changes, so an idle page costs nothing. */
	busy?(): boolean;
	/** where the lens is drawn this frame (viewport px, radius), or null when it is not shown; the host attaches its
	 * information card to the lens's edge */
	lens?(): { x: number; y: number; r: number } | null;
	/** the ridge sentence under the lens's centre (the text the lens is deciphering), or null */
	lensText?(): string | null;
}

export type PrintOptions = {
	/** ridge text: paper sentences already vetted for the page (the main print, and anything without its own text) */
	text: string[];
	/** each print's own ridge text: a lab's prints carry its models' prose, the AI print model prose, the human print and
	 * the crowd human prose (print_text.json); missing entries fall back to `text` */
	ridge?: { labs?: Record<string, string>; ai?: string; human?: string; writers?: string[] };
	/** the lab prints in level 2, in this order; the first three are drawn larger and in colour */
	labs: string[];
	/** colours: rq1 human #C85A82, rq2 AI #461E47, rq3 #437E8E, ink #14202D; lab colours for the first three */
	colors: { human: string; ai: string; lit: string; ink: string; labs: string[]; other: string };
	/** level 3: the crowd in vertical bands across the stage, left to right, one colour per kind of text. `to` is the
	 * cumulative fraction of the stage width (0..1) where the band ends; a writer takes the colour of the band its place
	 * falls in. Without it the crowd is `colors.human`. The lit writer keeps `colors.lit`. */
	crowdBands?: { to: number; color: string }[];
	/** level 3: a colour per crowd writer, by index (overrides crowdBands), so the kinds of text can be mixed through the
	 * crowd rather than set in bands */
	crowdColors?: string[];
	/** the lit writer's ridge text in level 3 (readable in the lens) */
	litText: string;
	/** level 3: draw the lit writer as solid ink lines at full strength instead of ridges set as text, so the found writer
	 * reads as one dark print at small sizes (the launch video). Off by default: the page sets its ridges as text. */
	litLines?: boolean;
	seed?: number;
};

export type CreatePrint = (opts: PrintOptions) => Print;
