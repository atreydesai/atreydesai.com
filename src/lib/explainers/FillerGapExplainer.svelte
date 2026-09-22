<script lang="ts" module>
	// Filling in the Mechanisms: How do LMs Learn Filler-Gap Dependencies
	// under Developmental Constraints? (Desai & Nair 2026)
	//
	// Beats: the dependency -> inject the learned filler-gap feature (DAS) into
	// a sentence without a filler -> the causal effect across training ->
	// takeaway.
	//
	// The base/source pair is the paper's Fig. 1 wh-question pair: implanting
	// the feature should "shift the prediction of the model from the base label
	// (him) toward the source label (?)". DAS learns a direction in the
	// representation space (a 1-D subspace), not a single unit, so the
	// injection tints the whole row of units.
	// The curve is Wh->Wh MAX ODDS at all 19 BabyLM checkpoints, extracted from
	// the vector data of Fig. 3 (1M: 0.82, 10M: 3.34, 100M: 10.58). "Strong" is
	// the paper's threshold, MAX ODDS > 8 (Sec. 4.3.2). The 10M checkpoint
	// corresponds to children aged 2-5 (Sec. 6), who already show sensitivity
	// to the dependency (by 18 months; robust between 3 and 5).
	// Captions and the takeaway are the paper's wording: "children's input",
	// "the learned filler-gap DAS feature", "increasing with training tokens"
	// (Sec. 5.4), "but still requires far more data than children would"
	// (Sec. 6).
	import type { Beat } from "./motion";

	export const BEATS: Beat[] = [
		{ id: "dependency", label: "dependency", at: 0 },
		{ id: "inject", label: "inject", at: 2.4 },
		{ id: "emerge", label: "emerges", at: 7.6 },
		{ id: "takeaway", label: "takeaway", at: 12.6 },
	];
	export const DURATION = 16;

	// [training tokens in millions, MAX ODDS]
	const WH_WH: [number, number][] = [
		[1, 0.82], [2, 0.93], [3, 1.47], [4, 2.01], [5, 2.21], [6, 2.77], [7, 2.77],
		[8, 3.07], [9, 3.28], [10, 3.34], [20, 4.98], [30, 7.22], [40, 7.01],
		[50, 7.7], [60, 8.83], [70, 9.46], [80, 9.58], [90, 9.28], [100, 10.58],
	];

	// The y axis sits on the plate margin; the data run from 1M, whose label
	// starts on that margin, to 100M, whose label ends on the right margin.
	export const AXIS_X = 14;
	export const X0 = 22;
	export const X1 = 210;
	export const Y0 = 162;
	const YTOP = 48;
	const VMAX = 11;
	export const px = (millions: number) => X0 + (Math.log10(millions) / 2) * (X1 - X0);
	export const py = (odds: number) => Y0 - (odds / VMAX) * (Y0 - YTOP);

	type Pt = [number, number];
	const r1 = (n: number) => Math.round(n * 10) / 10;

	// Smooth the checkpoints with a monotone cubic in x (Steffen's method, as
	// in d3's curveMonotoneX) so the line reads as a trajectory: it passes
	// through every measured point, never overshoots one, and never doubles
	// back, even where the log axis packs 9M and 10M 4 units apart. (A
	// Catmull-Rom spline looped just before the 10M point.)
	const points: Pt[] = WH_WH.map(([t, v]) => [r1(px(t)), r1(py(v))]);
	const h = points.slice(1).map((p, k) => p[0] - points[k][0]);
	const secant = points.slice(1).map((p, k) => (p[1] - points[k][1]) / h[k]);
	const slopes = points.map((_, i) => {
		if (i === 0) return (3 * secant[0] - (slopes3(1) ?? secant[0])) / 2;
		if (i === points.length - 1) return (3 * secant[i - 1] - (slopes3(i - 1) ?? secant[i - 1])) / 2;
		return slopes3(i) as number;
	});
	function slopes3(i: number) {
		if (i <= 0 || i >= points.length - 1) return undefined;
		const [h0, h1, s0, s1] = [h[i - 1], h[i], secant[i - 1], secant[i]];
		const p = (s0 * h1 + s1 * h0) / (h0 + h1);
		return (Math.sign(s0) + Math.sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p)) || 0;
	}
	const segments = points.slice(1).map((p, k) => {
		const p1 = points[k];
		const third = h[k] / 3;
		const c1: Pt = [r1(p1[0] + third), r1(p1[1] + slopes[k] * third)];
		const c2: Pt = [r1(p[0] - third), r1(p[1] - slopes[k + 1] * third)];
		return [p1, c1, c2, p] as const;
	});
	export const CURVE =
		`M${points[0][0]} ${points[0][1]} ` +
		segments.map(([, c1, c2, p]) => `C${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${p[0]} ${p[1]}`).join(" ");

	// Arc length of each cubic, so the line can stop exactly on the 10M point.
	const cubicLength = ([a, b, c, d]: readonly [Pt, Pt, Pt, Pt]) => {
		let length = 0;
		let prev = a;
		for (let s = 1; s <= 64; s++) {
			const t = s / 64;
			const u = 1 - t;
			const q: Pt = [
				u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0],
				u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1],
			];
			length += Math.hypot(q[0] - prev[0], q[1] - prev[1]);
			prev = q;
		}
		return length;
	};
	const lengths = segments.map(cubicLength);
	const TEN = WH_WH.findIndex(([t]) => t === 10);
	/** Share of the line's length from 1M to the 10M checkpoint, in percent. */
	export const TO_10M =
		(100 * lengths.slice(0, TEN).reduce((a, b) => a + b, 0)) / lengths.reduce((a, b) => a + b, 0);

	export const END = points[points.length - 1];
	export const AT_10M = points[TEN];

	export const NEURONS = [40, 80, 120, 160, 200];
	// A learned direction loads on every unit, not one: each unit is tinted by
	// its share of the injected feature.
	const LOADINGS = [0.4, 0.75, 1, 0.55, 0.85];
</script>

<script lang="ts">
	import { onMount } from "svelte";
	import ExplainerFrame from "./ExplainerFrame.svelte";
	import { EASE, T, draw, enter, exit, restore, type Scene, type Timeline } from "./motion";

	let { size = "card", paused = false, resting = false, label }: {
		size?: "card" | "stage";
		paused?: boolean;
		resting?: boolean;
		label: string;
	} = $props();

	// The poster sentence is laid out from measured word widths so the arc
	// leaves "Who" and lands in the gap. These are Optima's widths at 17 units;
	// the browser re-measures on mount in case another face is in use. The
	// sentence starts on the left margin and ends by the right one.
	const SENTENCE = 17;
	const SENTENCE_Y = 108;
	const SPACE = 4.34;
	const GAP = 18;
	let whoWidth = $state(35.9);
	let midWidth = $state(140.5);
	let markWidth = $state(6.6);
	let whoEl: SVGTextElement;
	let midEl: SVGTextElement;
	let markEl: SVGTextElement;

	const layout = $derived.by(() => {
		const x0 = 14;
		const mid = x0 + whoWidth + SPACE;
		const gap = mid + midWidth + SPACE;
		const a = x0 + whoWidth / 2;
		const b = gap + GAP / 2;
		// Leave just above the cap height of "Who"; land inside the empty slot,
		// just above the gap's rule.
		const from = SENTENCE_Y - 18;
		const to = SENTENCE_Y - 5;
		const peak = SENTENCE_Y - 84;
		const c = (a + b) / 2;
		// Arrowhead along the curve's end tangent (from the control point).
		const angle = Math.atan2(to - peak, b - c);
		const head = (spread: number) =>
			`${(b - 8 * Math.cos(angle - spread)).toFixed(1)} ${(to - 8 * Math.sin(angle - spread)).toFixed(1)}`;
		// The one quadratic is split (de Casteljau) where the gap's rule
		// begins, so the long span's box stays above the words and the landing
		// sits beside them: layout checks work on bounding boxes.
		const s = (gap - 1 - a) / (b - a);
		const q1 = [a + s * (c - a), from + s * (peak - from)];
		const q2 = [c + s * (b - c), peak + s * (to - peak)];
		const split = [q1[0] + s * (q2[0] - q1[0]), q1[1] + s * (q2[1] - q1[1])];
		const f = (p: number[]) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
		return {
			x0,
			mid,
			gap,
			a,
			b,
			arc: `M${a.toFixed(1)} ${from} Q${f(q1)} ${f(split)}`,
			landing: `M${f(split)} Q${f(q2)} ${b.toFixed(1)} ${to}`,
			tip: `M${head(0.45)} L${b.toFixed(1)} ${to} L${head(-0.45)}`,
		};
	});

	onMount(() => {
		const measure = () => {
			whoWidth = whoEl.getComputedTextLength() || whoWidth;
			midWidth = midEl.getComputedTextLength() || midWidth;
			markWidth = markEl.getComputedTextLength() || markWidth;
		};
		measure();
		document.fonts?.ready.then(measure);
	});

	// Captions sit just above the progress rail, so they fade in place: a
	// rise would carry their descenders across the rail.
	const fadeIn = (tl: Timeline, targets: gsap.TweenTarget, at: number, vars: gsap.TweenVars = {}) =>
		tl.fromTo(
			targets,
			{ autoAlpha: 0 },
			{ autoAlpha: 1, duration: 0.45, ease: EASE.enter, immediateRender: false, ...vars },
			at,
		);

	const scene: Scene = {
		beats: BEATS,
		duration: DURATION,
		build(gsap, tl) {
			// 2 · inject the learned filler-gap feature into a sentence without a filler
			exit(tl, [".f-sentence", ".f-arc", ".f-labels", ".f-cap-q"], "inject");
			fadeIn(tl, ".f-cap-i", 2.7);
			enter(tl, ".f-base", 2.7);
			enter(tl, ".f-neuron", 2.95, { stagger: 0.06 });
			enter(tl, ".f-chip", 3.5);
			tl.set(".f-inject", { autoAlpha: 1 }, 4.0);
			draw(tl, ".f-inject", 4.0, 0.45);
			// The feature lands in the middle and spreads across the row.
			fadeIn(tl, ".f-hit", 4.45, { duration: 0.3, stagger: { each: 0.08, from: "center" } });
			tl.set(".f-strike", { autoAlpha: 1 }, 5.2);
			draw(tl, ".f-strike", 5.2, 0.3);
			exit(tl, [".f-him", ".f-strike"], 5.75, { y: -6 });
			fadeIn(tl, ".f-gapmark", 6.05);

			// 3 · the effect across training: context first, then the line,
			// which stops on 10M for the reading there before going on.
			exit(tl, [".f-base", ".f-neuron", ".f-hit", ".f-chip", ".f-inject", ".f-gapmark", ".f-cap-i"], "emerge");
			enter(tl, ".f-axes", 7.9);
			fadeIn(tl, ".f-cap-e", 7.9);
			enter(tl, ".f-strong", 8.2);
			enter(tl, ".f-kid", 8.5);
			tl.set(".f-curve", { autoAlpha: 1 }, 8.95);
			tl.fromTo(
				".f-curve",
				{ drawSVG: "0% 0%" },
				{ drawSVG: `0% ${TO_10M.toFixed(2)}%`, duration: 1.1, ease: "power1.inOut", immediateRender: false },
				8.95,
			);
			enter(tl, ".f-weak", 10.05);
			tl.to(".f-curve", { drawSVG: "0% 100%", duration: 1.2, ease: "power1.inOut" }, 10.4);
			enter(tl, ".f-end", 11.6);

			// 4 · takeaway
			exit(tl, [".f-axes", ".f-strong", ".f-curve", ".f-kid", ".f-weak", ".f-end", ".f-cap-e"], "takeaway");
			tl.set(".f-glyph-curve", { autoAlpha: 1 }, 12.95);
			draw(tl, ".f-glyph-curve", 12.95, 0.6);
			enter(tl, ".f-take", 13.1, { stagger: 0.12 });

			// Back to the poster, in reading order, settled before the loop ends.
			exit(tl, [".f-glyph-curve", ".f-take"], 15.1);
			tl.set(".f-him", { autoAlpha: 1, y: 0 }, 15.4);
			restore(tl, ".f-sentence", 15.4);
			restore(tl, ".f-arc", 15.46);
			restore(tl, [".f-labels", ".f-cap-q"], 15.5);
		},
	};
</script>

<ExplainerFrame {scene} {label} {size} {paused} {resting}>
	<!-- 1 · poster: the filler and its gap -->
	<g class="f-sentence">
		<text bind:this={whoEl} class="xp-prose" x={layout.x0} y={SENTENCE_Y} font-size={SENTENCE} style="color: var(--xp-human)">Who</text>
		<text bind:this={midEl} class="xp-prose" x={layout.mid} y={SENTENCE_Y} font-size={SENTENCE}>did the teacher like</text>
		<line x1={layout.gap} x2={layout.gap + GAP} y1={SENTENCE_Y + 2} y2={SENTENCE_Y + 2} stroke="var(--xp-soft)" stroke-width="1.6" />
		<text bind:this={markEl} class="xp-prose" x={layout.gap + GAP + 1} y={SENTENCE_Y} font-size={SENTENCE}>?</text>
	</g>
	<g class="f-arc">
		<path d={layout.arc} fill="none" stroke="var(--xp-accent)" stroke-width="2.2" stroke-linecap="round" />
		<path d={layout.landing} fill="none" stroke="var(--xp-accent)" stroke-width="2.2" stroke-linecap="round" />
		<path d={layout.tip} fill="none" stroke="var(--xp-accent)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
	</g>
	<g class="f-labels">
		<text class="xp-mono" x={layout.x0} y={SENTENCE_Y + 26} font-size="15" style="color: var(--xp-human)">filler</text>
		<text class="xp-mono" x={layout.b} y={SENTENCE_Y + 26} font-size="15" text-anchor="middle">gap</text>
	</g>
	<text class="xp-prose xp-caption f-cap-q" style="color: var(--xp-accent-text)"><tspan x="14" y="205">learnable from</tspan><tspan x="14" y="226">children’s input?</tspan></text>

	<!-- 2 · inject the learned filler-gap feature -->
	<g class="xp-later f-base">
		<text class="xp-prose" x="14" y="42" font-size={T.stem}>Did the teacher like</text>
		<rect x="184" y="20" width="42" height="30" rx="2" fill="none" stroke="var(--xp-rule)" stroke-width="1.2" stroke-dasharray="3.5 3" />
		<text class="xp-prose f-him" x="205" y="42" font-size={T.stem} text-anchor="middle" style="color: var(--xp-soft)">him</text>
		<text class="xp-mono" x="226" y="68" font-size={T.label} text-anchor="end">next word</text>
	</g>
	<line class="xp-later f-strike" x1="191" x2="219" y1="36" y2="36" stroke="var(--xp-accent)" stroke-width="2.2" stroke-linecap="round" />
	<text class="xp-prose xp-later f-gapmark" x="205" y="44" font-size="23" text-anchor="middle" style="color: var(--xp-accent-text)">?</text>

	{#each NEURONS as x}
		<circle class="xp-later f-neuron" cx={x} cy="110" r="14" fill="var(--xp-surface)" stroke="var(--xp-rule)" stroke-width="1.6" />
	{/each}
	{#each NEURONS as x, i}
		<circle class="xp-later f-hit" cx={x} cy="110" r="14.8" fill="var(--xp-human)" fill-opacity={LOADINGS[i]} />
	{/each}
	<path class="xp-later f-inject" d="M120 150 L120 127 M113.5 133.5 L120 127 L126.5 133.5" fill="none" stroke="var(--xp-human)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
	<g class="xp-later f-chip">
		<rect x="82" y="152" width="76" height="28" rx="2" fill="var(--xp-human)" />
		<text class="xp-mono" x="120" y="171" font-size="15" text-anchor="middle" style="color: var(--xp-surface)">filler</text>
	</g>
	<text class="xp-prose xp-caption xp-later f-cap-i" style="color: var(--xp-text)"><tspan x="14" y="205">inject the learned</tspan><tspan x="14" y="226">filler-gap feature</tspan></text>

	<!-- 3 · the effect across training -->
	<g class="xp-later f-axes">
		<line x1={AXIS_X} x2="226" y1={Y0} y2={Y0} stroke="var(--xp-soft)" stroke-width="1.4" />
		<line x1={AXIS_X} x2={AXIS_X} y1={Y0} y2="42" stroke="var(--xp-soft)" stroke-width="1.4" />
		<text class="xp-mono" x={AXIS_X} y="30" font-size={T.label}>causal effect</text>
		<text class="xp-mono" x={px(1)} y={Y0 + 18} font-size={T.label} text-anchor="middle">1M</text>
		<text class="xp-mono" x={px(10)} y={Y0 + 18} font-size={T.label} text-anchor="middle">10M</text>
		<text class="xp-mono" x={px(100)} y={Y0 + 18} font-size={T.label} text-anchor="middle">100M</text>
	</g>
	<g class="xp-later f-strong">
		<line x1={AXIS_X} x2="226" y1={py(8)} y2={py(8)} stroke="var(--xp-faint)" stroke-width="1.2" stroke-dasharray="3 3.5" />
		<text class="xp-mono" x={X0} y={py(8) - 6} font-size={T.label}>strong</text>
	</g>
	<g class="xp-later f-kid">
		<line x1={px(10)} x2={px(10)} y1={Y0} y2="42" stroke="var(--xp-truth)" stroke-width="1.6" stroke-dasharray="3.5 3" />
		<text class="xp-mono" x={px(10) + 6} y="50" font-size="14.5" style="color: var(--xp-truth)">kids ✓</text>
		<text class="xp-mono" x={px(10) + 6} y="65" font-size={T.label} style="color: var(--xp-truth)">age 2–5</text>
	</g>
	<path class="xp-later f-curve" d={CURVE} fill="none" stroke="var(--xp-accent)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" />
	<g class="xp-later f-weak">
		<circle cx={AT_10M[0]} cy={AT_10M[1]} r="4" fill="var(--xp-surface)" stroke="var(--xp-accent)" stroke-width="2" />
		<text class="xp-mono" x={AT_10M[0] + 8} y={AT_10M[1] + 18} font-size={T.label}>LM: weak</text>
	</g>
	<g class="xp-later f-end">
		<circle cx={END[0]} cy={END[1]} r="4.4" fill="var(--xp-accent)" />
		<text class="xp-mono" x={END[0]} y={END[1] - 10} font-size="14.5" text-anchor="middle" style="color: var(--xp-accent-text)">LM</text>
	</g>
	<text class="xp-prose xp-caption xp-later f-cap-e" style="color: var(--xp-text)"><tspan x="14" y="205">increasing with</tspan><tspan x="14" y="226">training tokens</tspan></text>

	<!-- 4 · takeaway -->
	<path class="xp-later f-glyph-curve" d="M92 56 C110 55 124 49 132 40 S144 24 149 20" fill="none" stroke="var(--xp-accent)" stroke-width="2.6" stroke-linecap="round" />
	<text class="xp-prose xp-later f-take" x="120" y="98" font-size={T.body} text-anchor="middle">It emerges,</text>
	<text class="xp-prose xp-later f-take" x="120" y="132" font-size={T.body} text-anchor="middle" style="color: var(--xp-accent-text)">but still requires</text>
	<text class="xp-prose xp-later f-take" x="120" y="157" font-size={T.body} text-anchor="middle" style="color: var(--xp-accent-text)">far more data than</text>
	<text class="xp-prose xp-later f-take" x="120" y="182" font-size={T.body} text-anchor="middle" style="color: var(--xp-accent-text)">children would.</text>
</ExplainerFrame>
