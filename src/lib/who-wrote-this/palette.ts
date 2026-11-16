// One set of colours for the whole launch page, from the paper's style guide
// (llm-detectors docs/style_guide/index.html, "Assigning colour to models", Atrey 13 Nov 2026).
// One meaning per hue; no new hues. Every section takes its colours from here.

/** Labs, and the judges they make: Slop Rose = Anthropic, Aubergine = Google, Teal = OpenAI. */
export const LAB = {
	Anthropic: "#C85A82",
	Google: "#461E47",
	OpenAI: "#437E8E",
	/** any other lab */
	other: "#C9C9C9",
	/** a writer's own lab, or another non-lab group */
	own: "#2B2B2B",
} as const;

/** Models as judges. Fable 5.2 takes Claude's clay so it stands apart from Opus 5.5 (same lab, Slop Rose). */
export const MODEL: Record<string, string> = {
	"Claude Fable 5.2": "#B4501C",
	"Fable 5.2": "#B4501C",
	"Claude Opus 5.5": "#C85A82",
	"Opus 5.5": "#C85A82",
	"Gemini 4 Carbon": "#32122F",
	Carbon: "#32122F",
	"Gemini 4 Argon": "#6E4B78",
	Argon: "#6E4B78",
	"GPT-6.1 Sol": "#437E8E",
	Sol: "#437E8E",
	"GPT-6.1 Astra": "#0F3640",
	Astra: "#0F3640",
	DeepSeek: "#898989",
	Qwen: "#898989",
};

/** Fable's clay ramp, for a Fable showcase: ink (text), strong, mid, light, tint. */
export const FABLE = { ink: "#7A3410", strong: "#B4501C", mid: "#D4804F", light: "#EDB894", tint: "#FBEDE4" } as const;

/** Figure 1's three questions: a separate class, used for the levels' numbers and section badges only. */
export const RQ = { 1: "#C85A82", 2: "#461E47", 3: "#437E8E" } as const;

/** Closed against open weights: colour plus a line style as the second cue. */
export const WEIGHTS = { closed: { color: "#461E47", dash: [] as number[] }, open: { color: "#C85A82", dash: [7, 5] } } as const;

/** Signed effects: higher in teal, lower in rose. */
export const SIGNED = { higher: "#437E8E", lower: "#C85A82" } as const;

/** Verdicts only, and always with a check or cross icon. Not a general "lit" colour. */
export const VERDICT = {
	correct: { ink: "#046B55", strong: "#00AB89", light: "#9BE3CC", tint: "#CEF6E8" },
	wrong: { ink: "#9E1326", strong: "#B7162D", light: "#F5B3B1", tint: "#FEE4E2" },
} as const;

/** Neutrals: secondary text, axes, comparison series, unlit tiles. */
export const GRAY = { strong: "#898989", mid: "#B0B0B0", light: "#C9C9C9", tint: "#EDEDED", unlit: "#D3D3CC" } as const;
export const INK = { ink: "#14202D", ink2: "#5A6270", field: "#F3F3EF", ground: "#E8E8E3" } as const;

/**
 * Ideas against prose: the same colours, told apart by icon and mark style (no extra hue).
 * Ideas: bulb icon, filled marks. Prose: pen icon, hollow (outlined) marks.
 */
export const KIND = {
	ideas: { icon: "bulb", label: "Ideas", fill: true },
	prose: { icon: "pen", label: "Prose", fill: false },
} as const;

/**
 * How to colour a result: a lit tile, dot or bar takes the colour of the model (or lab) whose result it shows;
 * unlit takes GRAY.unlit. Teal means OpenAI (or Sol), never "correct".
 */
export const modelColor = (name: string) => MODEL[name] ?? GRAY.strong;

/** a colour mixed toward ink by t (0..1): the ridge ink for a print stamped on a tile of that colour */
export function deepen(hex: string, t = 0.5): string {
	const a = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)), b = [20, 32, 45];
	return "#" + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, "0")).join("");
}

/** tiles that show a result: solid enough to read as a mass even in grayscale, with the print as texture on top */
export const TILE = { litBacking: 0.82, unlitBacking: 0.2, inkDepth: 0.55 } as const;
