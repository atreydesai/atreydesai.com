// Shared state for the page-wide dot field. Sections write what the field should show; DotField draws it.

export type Mark = {
	id: string;
	x: number; // viewport px
	y: number;
	r: number;
	color: string; // hex
	ring?: boolean; // hollow mark (open weights)
	alpha?: number;
	label?: string;
	group?: string; // hover reports the group (e.g. a writer's pile) instead of the single mark
	square?: boolean; // a tessera instead of a round dot
};

export type Path = { pts: [number, number][]; color: string; width: number; dash?: number[]; progress: number };
export type Text = { x: number; y: number; t: string; color: string; size: number; align?: CanvasTextAlign; weight?: number };

export const field = $state({
	/** ground: the dotted page; levels: the hero's three questions; chart: marks, paths and labels drawn by a section */
	mode: "ground" as "ground" | "levels" | "chart",
	level: 0, // 1 human or AI, 2 which AI, 3 which human
	hover: null as string | null,
	interactive: false, // the canvas takes pointer events (hover on marks)
	dim: 0, // 0..1, how far the ground fades behind a chart
	anchor: { x: 0, y: 0, w: 0, h: 0 }, // viewport box the hero's levels draw into
	owner: "" as string, // which section currently draws the chart (only it may clear it)
});

/** What a chart section draws. Plain (not reactive): rewritten every frame, read only by DotField's draw loop. */
export const chart = { marks: [] as Mark[], paths: [] as Path[], texts: [] as Text[] };
