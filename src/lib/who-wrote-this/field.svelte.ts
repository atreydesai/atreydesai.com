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
	shape: "dot" as "dot" | "tile", // the ground's marks: dots, or tesserae for the mosaic art variant
});

/** What a chart section draws. Plain (not reactive): rewritten every frame, read only by DotField's draw loop. */
export const chart = { marks: [] as Mark[], paths: [] as Path[], texts: [] as Text[] };

export type Box = { x: number; y: number; w: number; h: number };

/** The hero's bands, one per level, lined up with its row (or stacked in the stage on narrow screens). Plain, per frame. */
export const hero = { bands: [] as Box[] };

/** Where the hero's eleven lab clusters sit in a box: in the full stage the three big labs on top and eight more below;
 * in a band, one row with the big three first. Shared by the dot field and the labels over it. */
export function labCenters(B: Box): { x: number; y: number; r: number }[] {
	const out: { x: number; y: number; r: number }[] = [];
	if (B.h >= 160) {
		for (let i = 0; i < 3; i++) out.push({ x: B.x + (B.w * (2 * i + 1)) / 6, y: B.y + B.h * 0.36, r: Math.min(B.w / 6, B.h * 0.24) * 0.82 });
		for (let i = 0; i < 8; i++) out.push({ x: B.x + (B.w * (i + 0.5)) / 8, y: B.y + B.h * 0.8, r: Math.min(B.w / 16, B.h * 0.1) * 0.8 });
	} else {
		let u = 0;
		for (let i = 0; i < 11; i++) {
			const span = i < 3 ? 2 : 1;
			out.push({ x: B.x + (B.w * (u + span / 2)) / 14, y: B.y + B.h / 2, r: Math.min((B.w * span) / 28, B.h / 2) * (i < 3 ? 0.85 : 0.6) });
			u += span;
		}
	}
	return out;
}
