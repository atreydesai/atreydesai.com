<script lang="ts" module>
	// Quick, Create a Distractor! (Desai, Balepur & Rudinger 2026)
	//
	// Beats: the question -> humans write the wrong answers -> LLMs create
	// them, fast -> both scored on the paper's three metrics -> takeaway.
	//
	// The scored beat plots every LLM distractor set (3 generators x 3
	// benchmarks, distractor generation) against its human-guided original,
	// which sits at the centre of each axis. Values are read from the vector
	// marks of Fig. 2 (left panel): difficulty and discriminability from
	// marker positions, writing quality from marker colour against the
	// colour bar (RdBu, +/-0.597). Each axis is scaled to its own largest
	// change; only direction is read off.
	import type { Beat } from "./motion";

	export const BEATS: Beat[] = [
		{ id: "question", label: "question", at: 0 },
		{ id: "humans", label: "humans", at: 2.4 },
		{ id: "llm", label: "LLMs", at: 5.2 },
		{ id: "scored", label: "scored", at: 7.4 },
		{ id: "takeaway", label: "takeaway", at: 12.4 },
	];
	export const DURATION = 16.1;

	type Set = { gen: string; data: string; diff: number; disc: number; wq: number };
	const SETS: Set[] = [
		{ gen: "GPT-5.2", data: "MMLU", diff: 0.308, disc: 0.054, wq: -0.209 },
		{ gen: "GPT-5.2", data: "ARC", diff: 0.359, disc: 0.036, wq: -0.597 },
		{ gen: "Gemini-3.1 Pro", data: "MMLU", diff: 0.141, disc: 0.027, wq: 0.406 },
		{ gen: "Gemini-3.1 Pro", data: "ARC", diff: 0.219, disc: 0.012, wq: 0.061 },
		{ gen: "Qwen-3.5 397B", data: "MMLU", diff: 0.0, disc: 0.005, wq: 0.286 },
		{ gen: "GPT-5.2", data: "GPQA", diff: 0.14, disc: -0.016, wq: -0.162 },
		{ gen: "Qwen-3.5 397B", data: "ARC", diff: 0.2, disc: -0.014, wq: -0.037 },
		{ gen: "Gemini-3.1 Pro", data: "GPQA", diff: 0.104, disc: -0.049, wq: 0.127 },
		{ gen: "Qwen-3.5 397B", data: "GPQA", diff: -0.048, disc: -0.064, wq: 0.131 },
	];

	const CX = 120;
	const HALF = 100;
	const DOT_R = 4.6;
	// Sets that land almost on top of each other (e.g. GPT and Gemini on
	// difficulty, 0.3 units apart) would read as one dot. Nudge neighbours
	// apart along the axis to this spacing, so each dot's outline shows;
	// no dot moves more than 3 units, and none crosses the human centre.
	const MIN_GAP = 6;

	const spread = (xs: number[]) => {
		const order = xs.map((x, i) => ({ x, i })).sort((a, b) => a.x - b.x);
		for (let pass = 0; pass < 40; pass++) {
			for (let k = 1; k < order.length; k++) {
				const gap = order[k].x - order[k - 1].x;
				if (gap < MIN_GAP) {
					const push = (MIN_GAP - gap) / 2;
					order[k - 1].x -= push;
					order[k].x += push;
				}
			}
		}
		const out = [...xs];
		for (const { x, i } of order) out[i] = x;
		return out;
	};

	const axis = (key: "diff" | "disc" | "wq", label: string, y: number) => {
		const max = Math.max(...SETS.map((s) => Math.abs(s[key])));
		const xs = spread(SETS.map((s) => CX + (s[key] / max) * HALF));
		const dots = SETS.map((s, i) => ({
			x: xs[i],
			y,
			title: `${s.gen} on ${s.data}: ${label} ${
				Math.abs(s[key]) < 0.002 ? "level with" : s[key] > 0 ? "above" : "below"
			} human-guided`,
		}));
		// Every dot sits on its axis (its value is its x); dots are translucent
		// and outlined, and the axis line is drawn over them.
		return { label, y, dots };
	};

	export const AXES = [
		axis("diff", "difficulty", 72),
		axis("disc", "discriminability", 116),
		axis("wq", "writing quality", 160),
	];

	export const ROWS = [
		{ letter: "A", y: 74 },
		{ letter: "B", y: 104 },
		{ letter: "C", y: 134 },
		{ letter: "D", y: 164 },
	];
	export const HUMAN = ["stiff", "brittle", "hard"];
	// Widths of streamed "token" dashes for each LLM-written distractor.
	export const TOKENS = [
		[30, 20, 24],
		[38, 22],
		[24, 34, 16],
	];
</script>

<script lang="ts">
	import ExplainerFrame from "./ExplainerFrame.svelte";
	import { T, enter, exit, restore, write, type Scene } from "./motion";

	let { size = "card", paused = false, resting = false, label }: {
		size?: "card" | "stage";
		paused?: boolean;
		resting?: boolean;
		label: string;
	} = $props();

	const uid = $props.id();

	const scene: Scene = {
		beats: BEATS,
		duration: DURATION,
		build(gsap, tl, root) {
			const q = (sel: string) => root.querySelectorAll(sel);
			const poster = [".d-stem", ".d-row", ".d-answer", ".d-blank", ".d-cap-q"];

			// Captions hand over in sequence: the old one is gone before the new
			// one arrives, so two captions never share the band.
			const handover = (out: string, into: string, at: number) => {
				exit(tl, out, at);
				enter(tl, into, at + 0.3);
			};

			// 2 · humans write them, one blank at a time, top to bottom
			handover(".d-cap-q", ".d-cap-h", 2.4);
			const blanks = q(".d-blank");
			const clips = q(".d-human-clip rect");
			q(".d-human").forEach((word, i) => {
				const at = 2.5 + i * 0.6;
				exit(tl, blanks[i], at, { duration: 0.25 });
				tl.set(word, { autoAlpha: 1 }, at + 0.22);
				// Clip from x=30 to just past the word's end, so the wipe spans the
				// whole write rather than finishing early on empty space.
				const width = (word as SVGTextElement).getBBox().width + 9;
				write(tl, clips[i], width, at + 0.22, 0.55);
				// Then open the clip fully, so no measurement can leave a word cut.
				tl.set(clips[i], { attr: { width: 160 } }, at + 0.8);
			});

			// 3 · LLMs create them: distractors stream in as tokens, fast
			exit(tl, ".d-human", "llm");
			handover(".d-cap-h", ".d-cap-l", 5.2);
			tl.fromTo(
				".d-token",
				{ autoAlpha: 0, x: -3 },
				{ autoAlpha: 1, x: 0, duration: 0.18, ease: "power3.out", stagger: 0.05, immediateRender: false },
				5.55,
			);

			// 4 · scored on three metrics
			exit(tl, [".d-stem", ".d-row", ".d-answer", ".d-token", ".d-cap-l"], "scored");
			enter(tl, ".d-title", 7.7);
			enter(tl, ".d-axis-label", 7.85, { stagger: 0.1 });
			tl.set(".d-axis-line", { autoAlpha: 1 }, 7.85);
			tl.fromTo(
				".d-axis-line",
				{ drawSVG: "50% 50%" },
				{ drawSVG: "0% 100%", duration: 0.6, ease: "power2.out", stagger: 0.1, immediateRender: false },
				7.85,
			);
			enter(tl, ".d-human-ring", 8.35, { stagger: 0.08 });
			// The scale names the ring and the directions before any dot moves.
			enter(tl, ".d-scale", 8.5);
			// LLM sets leave the human baseline and settle where they scored.
			q(".d-axis").forEach((axisEl, a) => {
				axisEl.querySelectorAll(".d-dot").forEach((dot, i) => {
					const cx = Number(dot.getAttribute("cx"));
					tl.fromTo(
						dot,
						{ autoAlpha: 0, x: CX - cx },
						{ autoAlpha: 1, x: 0, duration: 0.75, ease: "power3.out", immediateRender: false },
						8.85 + a * 0.3 + i * 0.03,
					);
				});
			});
			// The reading comes once every dot has landed (last lands at 10.44).
			enter(tl, ".d-cap-g", 10.45);

			// 5 · takeaway
			exit(tl, [".d-title", ".d-axis-label", ".d-axis-line", ".d-human-ring", ".d-dot", ".d-scale", ".d-cap-g"], "takeaway");
			enter(tl, ".d-glyph", 12.7, { stagger: 0.08 });
			enter(tl, ".d-take", 12.9, { stagger: 0.12 });

			// Back to the poster so the loop closes on its first frame.
			exit(tl, [".d-glyph", ".d-take"], 15.3);
			restore(tl, poster, 15.6);
			// Clip rects must be empty again before the next pass writes them.
			tl.set(clips, { attr: { width: 0 } }, 15.65);
		},
	};
</script>

<ExplainerFrame {scene} {label} {size} {paused} {resting}>
	<defs>
		{#each HUMAN as _, i}
			<clipPath id="{uid}-h{i}" class="d-human-clip">
				<rect x="30" y={ROWS[i + 1].y - 19} width="0" height="27" />
			</clipPath>
		{/each}
	</defs>

	<!-- 1 · poster -->
	<!-- 19, not T.stem: at 19.5 the stem runs 3 units past the right margin. -->
	<text class="xp-prose d-stem" x="14" y="36" font-size="19">What best describes skin?</text>

	{#each ROWS as row}
		<g class="d-row">
			<text class="xp-mono" x="14" y={row.y} font-size="14">{row.letter}</text>
			<line class="xp-rule" x1="14" x2="226" y1={row.y + 9} y2={row.y + 9} />
		</g>
	{/each}

	<!-- The correct answer's chip: the answer cell, inside the margins and
	     clear of the row's rule. -->
	<g class="d-answer">
		<rect x="14" y={ROWS[0].y - 19} width="212" height="26" rx="2" fill="var(--xp-truth)" fill-opacity="0.1" />
		<text class="xp-prose" x="36" y={ROWS[0].y} font-size={T.body} style="color: var(--xp-truth)">flexible</text>
		<path d="M204 {ROWS[0].y - 6} l5 5 l9 -11" fill="none" stroke="var(--xp-truth)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
	</g>

	{#each ROWS.slice(1) as row}
		<line
			class="d-blank"
			x1="36"
			x2="132"
			y1={row.y + 2}
			y2={row.y + 2}
			stroke="var(--xp-faint)"
			stroke-width="1.4"
			stroke-dasharray="4 3.5"
		/>
	{/each}

	<text class="xp-prose xp-caption d-cap-q" style="color: var(--xp-accent-text)"><tspan x="14" y="203">who writes the</tspan><tspan x="14" y="224">wrong answers?</tspan></text>

	<!-- 2 · humans write them -->
	{#each HUMAN as word, i}
		<text
			class="xp-prose xp-later d-human"
			x="36"
			y={ROWS[i + 1].y}
			font-size={T.body}
			clip-path="url(#{uid}-h{i})"
			style="color: var(--xp-human)">{word}</text
		>
	{/each}
	<text class="xp-prose xp-caption xp-later d-cap-h" x="14" y="214" style="color: var(--xp-human)">humans write them</text>

	<!-- 3 · LLMs create them -->
	{#each TOKENS as widths, r}
		{#each widths as w, t}
			<rect
				class="xp-later d-token"
				x={36 + widths.slice(0, t).reduce((a, b) => a + b + 4, 0)}
				y={ROWS[r + 1].y - 12}
				width={w}
				height="11"
				rx="2"
				fill="var(--xp-accent)"
				fill-opacity="0.85"
			/>
		{/each}
	{/each}
	<text class="xp-prose xp-caption xp-later d-cap-l" style="color: var(--xp-accent-text)"><tspan x="14" y="203">or LLMs create</tspan><tspan x="14" y="224">wrong answers</tspan></text>

	<!-- 4 · scored on three metrics -->
	<text class="xp-prose xp-later d-title" x="14" y="30" font-size={T.head}>scored on three metrics</text>
	{#each AXES as ax}
		<g class="d-axis">
			<text class="xp-prose xp-later d-axis-label" x="14" y={ax.y - 14} font-size="16.5" style="color: var(--xp-text)">{ax.label}</text>
			{#each ax.dots as dot}
				<circle class="xp-later d-dot" cx={dot.x} cy={dot.y} r={DOT_R} fill="var(--xp-accent)" fill-opacity="0.72" stroke="var(--xp-surface)" stroke-width="1">
					<title>{dot.title}</title>
				</circle>
			{/each}
			<!-- The human-guided original: an open ring over the dots, so a set
			     that lands next to it never cuts it, and one level with it
			     shows inside it. -->
			<circle class="xp-later d-human-ring" cx={CX} cy={ax.y} r="6" fill="none" stroke="var(--xp-human)" stroke-width="2" />
			<!-- Drawn last, so no ring or dot is ever painted over the axis. -->
			<line class="xp-rule xp-later d-axis-line" x1="14" x2="226" y1={ax.y} y2={ax.y} />
		</g>
	{/each}
	<g class="xp-later d-scale">
		<text class="xp-mono" x="14" y="182" font-size={T.label}>← worse</text>
		<text class="xp-mono" x={CX} y="182" font-size={T.label} text-anchor="middle" style="color: var(--xp-human)">human</text>
		<text class="xp-mono" x="226" y="182" font-size={T.label} text-anchor="end">better →</text>
	</g>
	<text class="xp-prose xp-caption xp-later d-cap-g" style="color: var(--xp-accent-text)"><tspan x="14" y="203">LLM distractors</tspan><tspan x="14" y="224">have trade-offs</tspan></text>

	<!-- 5 · takeaway -->
	<circle class="xp-later d-glyph" cx="102" cy="44" r="7" fill="var(--xp-accent)" />
	<text class="xp-mono xp-later d-glyph" x="120" y="49" font-size="15" text-anchor="middle">+</text>
	<circle class="xp-later d-glyph" cx="138" cy="44" r="6.3" fill="var(--xp-surface)" stroke="var(--xp-human)" stroke-width="2" />
	<text class="xp-prose xp-later d-take" x="120" y="90" font-size={T.body} text-anchor="middle" style="color: var(--xp-accent-text)">LLMs scale</text>
	<text class="xp-prose xp-later d-take" x="120" y="115" font-size={T.body} text-anchor="middle" style="color: var(--xp-accent-text)">MCQA benchmarks.</text>
	<text class="xp-prose xp-later d-take" x="120" y="152" font-size={T.body} text-anchor="middle" style="color: var(--xp-human)">Humans can</text>
	<text class="xp-prose xp-later d-take" x="120" y="177" font-size={T.body} text-anchor="middle" style="color: var(--xp-human)">help monitor.</text>
</ExplainerFrame>
