<script lang="ts" module>
	// Asking About Occluded Content Marks Adversarial Multimodal Questions
	// (Han*, Desai*, et al., under ARR review 2026)
	//
	// Beats: a clue asks for the colour the image hides -> the authoring-time
	// model names the colour it can see -> tournament play -> what an author's
	// image edit does to the model's correct answers -> takeaway.
	//
	// The item is the paper's Figure 1 tossup (a Barnett Newman painting, its
	// right side masked; answer yellow). Qwen3-VL answers red at 85% confidence
	// while it is written; in play, humans answer in 3 of 5 games and 0 of 14 AI
	// systems do, 10 of them answering red (Fig. 1, Section 4.3). The edit beat
	// is Section 5.1's 442 probe-edit-probe pairs: of the 227 initially correct
	// probes, 147 stay correct and 80 turn wrong (35.2%, Fig. 6). The takeaway
	// is the abstract's closing finding. The painting is an illustration, not
	// a reproduction, so its colours are fixed rather than themed.
	import type { Beat } from "./motion";

	const BEATS: Beat[] = [
		{ id: "question", label: "question", at: 0 },
		{ id: "probe", label: "probe", at: 2.8 },
		{ id: "play", label: "play", at: 6.8 },
		{ id: "edit", label: "edits", at: 10.8 },
		{ id: "takeaway", label: "takeaway", at: 14.6 },
	];
	const DURATION = 18.2;

	// The painting: a red field with a zip, its right side under a mask.
	const PAINT = { x: 14, y: 38, w: 212, h: 74 };
	const MASK_X = 152;
	const RED = "#c23a2c";
	const YELLOW = "#e6b632";
	const MASK = "#1f1c1b";

	// Tournament play: first human buzz per game, and each AI system's answer.
	const HUMAN_GAMES = [true, true, true, false, false];
	const AI_RED = 10;
	const AI_TOTAL = 14;

	// Initially correct probes after an image edit (CC 147, CW 80 of 227).
	const BASE = 158;
	const H = 100;
	const BAR_W = 64;
	const EDIT_BARS = [
		{ name: "still right", v: 147 / 227, x: 40, fill: "var(--xp-truth)", text: "var(--xp-truth)" },
		{ name: "turned wrong", v: 80 / 227, x: 136, fill: "var(--xp-accent)", text: "var(--xp-accent-text)" },
	];
</script>

<script lang="ts">
	import ExplainerFrame from "./ExplainerFrame.svelte";
	import { T, barBox, draw, enter, exit, restore, rise, swap, type ExplainerProps, type Scene } from "./motion";

	let { size = "card", paused = false, resting = false, label }: ExplainerProps = $props();

	const uid = $props.id();

	const scene: Scene = {
		beats: BEATS,
		duration: DURATION,
		build(tl) {
			const poster = [".o-kicker", ".o-paint", ".o-mask", ".o-clue", ".o-cap-q"];

			// 2 · probe: the author tests the clue, the model names what it sees
			swap(tl, ".o-kicker", ".o-kicker-probe", 2.8);
			exit(tl, ".o-clue", 2.8);
			swap(tl, ".o-cap-q", ".o-cap-p", 2.9);
			enter(tl, ".o-model", 3.2);
			enter(tl, ".o-guess", 3.75);
			tl.set(".o-seen", { autoAlpha: 1 }, 3.75);
			draw(tl, ".o-seen", 3.75, 0.6);
			// Then the mask lifts on the colour it hid.
			exit(tl, ".o-mask", 5.0, { duration: 0.45 });
			enter(tl, ".o-answer", 5.2);

			// 3 · tournament play
			exit(tl, [".o-kicker-probe", ".o-paint", ".o-seen", ".o-model", ".o-guess", ".o-answer", ".o-cap-p"], "play");
			enter(tl, ".o-title-play", 7.1);
			enter(tl, ".o-humans", 7.3);
			enter(tl, ".o-human-pip", 7.45, { stagger: 0.035 });
			enter(tl, ".o-ai", 7.9);
			enter(tl, ".o-ai-pip", 8.05, { stagger: 0.035 });
			enter(tl, ".o-said-red", 8.75);
			enter(tl, ".o-cap-g", 9.1);

			// 4 · an author's image edit, then a second probe
			exit(tl, [".o-title-play", ".o-humans", ".o-human-pip", ".o-ai", ".o-ai-pip", ".o-said-red", ".o-cap-g"], "edit");
			enter(tl, ".o-title-edit", 11.1);
			enter(tl, ".o-sub-edit", 11.2);
			tl.set(".o-axis", { autoAlpha: 1 }, 11.3);
			draw(tl, ".o-axis", 11.3, 0.45, { ease: "power2.out" });
			EDIT_BARS.forEach((bar, k) => {
				const t = 11.6 + k * 0.4;
				tl.set(`.o-bar-${k}`, { autoAlpha: 1 }, t);
				rise(tl, `.o-bar-${k}`, BASE, bar.v * H, t);
				enter(tl, `.o-cond-${k}`, t);
				enter(tl, `.o-val-${k}`, t + 0.7);
			});
			enter(tl, ".o-cap-e", 13.0);

			// 5 · takeaway: the abstract's closing finding, in its two halves
			exit(tl, [".o-title-edit", ".o-sub-edit", ".o-axis", ".o-bar", ".o-cond", ".o-val", ".o-cap-e"], "takeaway");
			enter(tl, ".o-take-1", 14.85, { stagger: 0.12 });
			enter(tl, ".o-take-2", 15.45, { stagger: 0.12 });

			// Back to the poster.
			exit(tl, [".o-take-1", ".o-take-2"], 17.3);
			restore(tl, poster, 17.6);
		},
	};
</script>

<ExplainerFrame {scene} {label} {size} {paused} {resting}>
	<defs>
		<clipPath id="{uid}-bars">
			<rect x="0" y="0" width="240" height={BASE - 0.6} />
		</clipPath>
	</defs>

	<!-- 1 · poster: a clue that asks for what the image hides -->
	<text class="xp-mono o-kicker" x="14" y="26" font-size={T.label}>multimodal quizbowl clue</text>
	<text class="xp-mono xp-later o-kicker-probe" x="14" y="26" font-size={T.label} style="color: var(--xp-accent-text)">the author probes a VLM</text>

	<g class="o-paint">
		<rect x={PAINT.x} y={PAINT.y} width={MASK_X - PAINT.x} height={PAINT.h} rx="2" fill={RED} />
		<rect x={MASK_X} y={PAINT.y} width={PAINT.x + PAINT.w - MASK_X} height={PAINT.h} rx="2" fill={YELLOW} />
		<!-- Newman's zip -->
		<rect x="70" y={PAINT.y} width="3.5" height={PAINT.h} fill="#8e2219" />
	</g>
	<g class="o-mask">
		<rect x={MASK_X} y={PAINT.y} width={PAINT.x + PAINT.w - MASK_X} height={PAINT.h} rx="2" fill={MASK} />
		<text class="xp-prose" x={(MASK_X + PAINT.x + PAINT.w) / 2} y={PAINT.y + PAINT.h / 2 + 7} font-size={T.body} text-anchor="middle" style="color: #fdf8f3">?</text>
	</g>
	<!-- The colour the model names: the field it can still see. -->
	<rect class="xp-later o-seen" x={PAINT.x + 3} y={PAINT.y + 3} width={MASK_X - PAINT.x - 6} height={PAINT.h - 6} rx="2" fill="none" stroke="#fdf8f3" stroke-width="2" stroke-dasharray="5 3.5" />

	<g class="o-clue">
		<text class="xp-prose" x="14" y="146" font-size={T.stem} font-style="italic">“…this color, which has</text>
		<text class="xp-prose" x="14" y="169" font-size={T.stem} font-style="italic">been obscured…”</text>
	</g>

	<text class="xp-prose xp-caption o-cap-q" style="color: var(--xp-accent-text)"><tspan x="14" y="203">it asks for what</tspan><tspan x="14" y="224">the image hides</tspan></text>

	<!-- 2 · probe -->
	<g class="xp-later o-model">
		<circle cx="19" cy="141" r="4.6" fill="var(--xp-accent)" />
		<text class="xp-mono" x="30" y="146" font-size="14" style="color: var(--xp-strong)">Qwen3-VL</text>
		<text class="xp-mono" x="226" y="146" font-size={T.label} text-anchor="end">85% confident</text>
	</g>
	<g class="xp-later o-guess">
		<path d="M15 163 l9 9 M24 163 l-9 9" stroke="var(--xp-accent)" stroke-width="2.2" stroke-linecap="round" />
		<text class="xp-prose" x="32" y="174" font-size={T.body} style="color: var(--xp-accent-text)">red</text>
		<line class="xp-rule" x1="14" x2="226" y1="183" y2="183" />
	</g>
	<g class="xp-later o-answer">
		<text class="xp-mono" x="208" y="174" font-size="14" text-anchor="end" style="color: var(--xp-truth)">answer: yellow</text>
		<path d="M213 168 l4 4 l8 -9" fill="none" stroke="var(--xp-truth)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
	</g>
	<text class="xp-prose xp-caption xp-later o-cap-p" x="14" y="214" style="color: var(--xp-accent-text)">it names what it sees</text>

	<!-- 3 · tournament play -->
	<text class="xp-prose xp-later o-title-play" x="14" y="30" font-size={T.head}>in tournament play</text>
	<g class="xp-later o-humans">
		<text class="xp-prose" x="14" y="62" font-size="16.5" style="color: var(--xp-text)">humans</text>
		<text class="xp-mono" x="226" y="62" font-size={T.label} text-anchor="end" style="color: var(--xp-human)">3/5 games</text>
	</g>
	{#each HUMAN_GAMES as right, i}
		<circle
			class="xp-later o-human-pip"
			cx={21 + i * 20}
			cy="82"
			r="7"
			fill={right ? "var(--xp-human)" : "none"}
			stroke={right ? "var(--xp-human)" : "var(--xp-faint)"}
			stroke-width="1.6"
			stroke-dasharray={right ? undefined : "3 2.5"}
		/>
	{/each}
	<g class="xp-later o-ai">
		<text class="xp-prose" x="14" y="118" font-size="16.5" style="color: var(--xp-text)">AI systems</text>
		<text class="xp-mono" x="226" y="118" font-size={T.label} text-anchor="end" style="color: var(--xp-accent-text)">0/14 systems</text>
	</g>
	{#each Array(AI_TOTAL) as _, i}
		<circle
			class="xp-later o-ai-pip"
			cx={19 + i * 15.5}
			cy="138"
			r="5"
			fill={i < AI_RED ? RED : "var(--xp-faint)"}
			stroke="var(--xp-surface)"
			stroke-width="1"
		/>
	{/each}
	<g class="xp-later o-said-red">
		<rect x="14" y="155" width="10" height="10" rx="2" fill={RED} />
		<text class="xp-mono" x="30" y="164.5" font-size={T.label}>10 of 14 answered red</text>
	</g>
	<text class="xp-prose xp-caption xp-later o-cap-g" style="color: var(--xp-accent-text)"><tspan x="14" y="203">people infer what’s</tspan><tspan x="14" y="224">hidden; models don’t</tspan></text>

	<!-- 4 · an author's edit, then a second probe -->
	<text class="xp-prose xp-later o-title-edit" x="14" y="30" font-size={T.head}>after an image edit</text>
	<text class="xp-mono xp-later o-sub-edit" x="14" y="50" font-size={T.label}>the model’s 227 correct answers</text>
	<g clip-path="url(#{uid}-bars)">
		{#each EDIT_BARS as bar, k}
			<rect class="xp-later o-bar o-bar-{k}" x={bar.x} {...barBox(BASE, bar.v * H)} width={BAR_W} rx="2" fill={bar.fill} />
		{/each}
	</g>
	<line class="xp-later o-axis" x1="14" x2="226" y1={BASE} y2={BASE} stroke="var(--xp-soft)" stroke-width="1.2" />
	{#each EDIT_BARS as bar, k}
		<text class="xp-mono xp-later o-cond o-cond-{k}" x={bar.x + BAR_W / 2} y={BASE + 17} font-size={T.label} text-anchor="middle">{bar.name}</text>
		<text class="xp-mono xp-later o-val o-val-{k}" x={bar.x + BAR_W / 2} y={BASE - bar.v * H - 6} font-size="14" text-anchor="middle" style="color: {bar.text}">{Math.round(bar.v * 100)}%</text>
	{/each}
	<text class="xp-prose xp-caption xp-later o-cap-e" style="color: var(--xp-accent-text)"><tspan x="14" y="201">even when the needed</tspan><tspan x="14" y="222">clues remain</tspan></text>

	<!-- 5 · takeaway -->
	<text class="xp-prose xp-later o-take-1" x="120" y="84" font-size={T.body} text-anchor="middle">Not what an</text>
	<text class="xp-prose xp-later o-take-1" x="120" y="109" font-size={T.body} text-anchor="middle">image shows…</text>
	<text class="xp-prose xp-later o-take-2" x="120" y="146" font-size={T.body} text-anchor="middle" style="color: var(--xp-accent-text)">… but what the</text>
	<text class="xp-prose xp-later o-take-2" x="120" y="171" font-size={T.body} text-anchor="middle" style="color: var(--xp-accent-text)">question asks!</text>
</ExplainerFrame>
