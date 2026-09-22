<script lang="ts" module>
	// Reinforcement Learning As End-User Trigger-Action Programming
	// (Hayhurst, Park, Desai, De Los Santos & Littman 2022)
	//
	// Beats: the task -> trigger-action rules move the robot room by room ->
	// RL is given the goal and the robot finds the way -> takeaway.
	//
	// The house is the paper's Fig. 3 floorplan, redrawn to scale; the rules
	// and the goal are its Fig. 1 and Fig. 2 examples (entry -> kitchen ->
	// dining room, going north). This is a 3-page proposal with no results, so
	// the RL trial run is illustrative only.
	import type { Beat } from "./motion";

	export const BEATS: Beat[] = [
		{ id: "task", label: "task", at: 0 },
		{ id: "tap", label: "rules", at: 2.4 },
		{ id: "rl", label: "goal", at: 7.2 },
		{ id: "takeaway", label: "takeaway", at: 12.0 },
	];
	export const DURATION = 16.6;

	// Fig. 3 is 510 x 430 px; map it onto the plate, centred above the caption.
	const S = 0.39;
	const X = (v: number) => (240 - 510 * S) / 2 + v * S;
	const Y = (v: number) => 11.5 + v * S;
	const room = (x1: number, y1: number, x2: number, y2: number) => ({
		x: X(x1),
		y: Y(y1),
		w: (x2 - x1) * S,
		h: (y2 - y1) * S,
	});
	// Walls, measured off Fig. 3. The hall sits inside the guest bathroom's
	// top edge, as in the figure.
	const PATIO = room(0, 0, 152, 92);
	const GUEST_BED = room(0, 92, 152, 247);
	const DINING_ROOM = room(152, 0, 330, 247);
	const MASTER_BED = room(330, 0, 510, 202);
	const MASTER_BATH = room(330, 202, 510, 430);
	const GUEST_BATH = room(0, 247, 179, 430);
	const HALL_ROOM = room(68, 247, 179, 306);
	const KITCHEN_ROOM = room(179, 247, 330, 369);
	const ENTRY_ROOM = room(179, 369, 330, 430);
	const ROOMS = [PATIO, GUEST_BED, DINING_ROOM, MASTER_BED, MASTER_BATH, GUEST_BATH, HALL_ROOM, KITCHEN_ROOM, ENTRY_ROOM];
	// The rooms the rules and the goal name: steel for a rule's trigger, sage
	// for the goal.
	const TINTS = [
		{ name: "entry", room: ENTRY_ROOM, fill: "var(--xp-human)" },
		{ name: "kitchen", room: KITCHEN_ROOM, fill: "var(--xp-human)" },
		{ name: "dining", room: DINING_ROOM, fill: "var(--xp-truth)" },
	];
	// Doors, the black bars in Fig. 3, at their measured spans.
	const DOORS = [
		[X(152), Y(26), X(152), Y(67)], // patio | dining
		[X(51), Y(92), X(105), Y(92)], // patio | guest bedroom
		[X(330), Y(152), X(330), Y(193)], // dining | master bedroom
		[X(392), Y(202), X(445), Y(202)], // master bedroom | bathroom
		[X(79), Y(247), X(133), Y(247)], // guest bedroom | hall
		[X(215), Y(247), X(268), Y(247)], // dining | kitchen
		[X(179), Y(258), X(179), Y(299)], // hall | kitchen
		[X(98), Y(306), X(151), Y(306)], // hall | guest bathroom
		[X(228), Y(369), X(282), Y(369)], // kitchen | entry
	];
	// Boxes to move around the house (Fig. 3): three red, one blue.
	const BOX = 5;
	const BOXES = [
		{ x: X(213), y: Y(63), red: true },
		{ x: X(151.5), y: Y(258.5), red: true },
		{ x: X(90.5), y: Y(271), red: true },
		{ x: X(384), y: Y(258.5), red: false },
	];

	// The robot's lane: x = 248.5 clears both north doors (entry 228-282,
	// dining 215-268) with the robot's full width. Waypoints in Fig. 3 pixels.
	const R = 4.5;
	const at = (x: number, y: number) => ({ x: X(x), y: Y(y) });
	const START = at(248.5, 399.5); // entry
	const KITCHEN = at(248.5, 308); // TAP: where the second rule fires
	const TURN = at(248.5, 281.3); // RL: level with the hall door (258-299)
	const HALL = at(119, 281.3); // RL: dead end, between the hall's two boxes
	const DINING = at(248.5, 170);
	const FLAG = at(283, 124);
	const LABEL = at(168, 42);
	// The trial run's dashed trail is revealed through masks, one straight
	// segment per move, so it keeps its dashes while it draws. The lane and
	// the hall spur have separate masks so neither uncovers the other.
	const TRAIL = [
		{ from: START, to: TURN, mask: "lane" },
		{ from: TURN, to: HALL, mask: "spur" },
		{ from: TURN, to: DINING, mask: "lane" },
	];
</script>

<script lang="ts">
	import ExplainerFrame from "./ExplainerFrame.svelte";
	import { T, draw, enter, exit, restore, type Scene } from "./motion";

	let { size = "card", paused = false, resting = false, label }: {
		size?: "card" | "stage";
		paused?: boolean;
		resting?: boolean;
		label: string;
	} = $props();

	const uid = $props.id();
	const to = (p: { x: number; y: number }) => ({ x: p.x - START.x, y: p.y - START.y });

	const scene: Scene = {
		beats: BEATS,
		duration: DURATION,
		build(gsap, tl) {
			const poster = [".t-plan", ".t-robot", ".t-flag", ".t-cap-q"];
			const pulse = (t: number) =>
				tl.fromTo(
					".t-flag",
					{ scale: 1 },
					{ scale: 1.25, duration: 0.2, yoyo: true, repeat: 1, ease: "power1.inOut", transformOrigin: "50% 100%", immediateRender: false },
					t,
				);
			// One move of the trial run; its trail segment draws in step with it.
			const walk = (p: { x: number; y: number }, t: number, duration: number, seg?: number) => {
				tl.to(".t-robot", { ...to(p), duration, ease: "power1.inOut" }, t);
				if (seg === undefined) return;
				tl.set(`.t-trail-m${seg}`, { autoAlpha: 1 }, t);
				draw(tl, `.t-trail-m${seg}`, t, duration, { ease: "power1.inOut" });
			};

			// 2 · trigger-action: each rule's trigger room lights as it shows.
			// Text that replaces text in place waits for it to leave, so the two
			// never cross-fade over each other.
			exit(tl, ".t-cap-q", 2.4);
			enter(tl, ".t-cap-tap", 2.7);
			enter(tl, ".t-rule-1", 3.0);
			restore(tl, ".t-tint-entry", 3.0);
			tl.to(".t-robot", { ...to(KITCHEN), duration: 0.75, ease: "power2.inOut" }, 3.55);
			exit(tl, [".t-rule-1", ".t-tint-entry"], 4.6);
			enter(tl, ".t-rule-2", 4.9);
			restore(tl, ".t-tint-kitchen", 4.9);
			tl.to(".t-robot", { ...to(DINING), duration: 0.85, ease: "power2.inOut" }, 5.45);
			pulse(6.35);

			// 3 · RL: a fresh run from the entry, given only the goal
			exit(tl, [".t-cap-tap", ".t-rule-2", ".t-tint-kitchen", ".t-robot"], "rl");
			tl.set(".t-robot", { x: 0, y: 0 }, 7.5);
			enter(tl, ".t-cap-rl", 7.5);
			restore(tl, ".t-robot", 7.55);
			enter(tl, ".t-goal", 7.7);
			restore(tl, ".t-tint-dining", 7.7);
			tl.set(".t-trail", { autoAlpha: 1 }, 8.35);
			walk(TURN, 8.35, 0.6, 0);
			walk(HALL, 9.05, 0.55, 1);
			walk(TURN, 9.8, 0.5); // a dead end: back out of the hall
			walk(DINING, 10.4, 0.6, 2);
			pulse(11.05);

			// 4 · takeaway
			exit(tl, [".t-plan", ".t-robot", ".t-flag", ".t-trail", ".t-tint-dining", ".t-cap-rl", ".t-goal"], "takeaway");
			enter(tl, ".t-take", 12.35, { stagger: 0.12 });

			// Back to the poster.
			exit(tl, ".t-take", 15.6);
			tl.set(".t-robot", { x: 0, y: 0 }, 15.9);
			tl.set(".t-trail-m", { autoAlpha: 0 }, 15.9);
			restore(tl, poster, 15.95);
		},
	};
</script>

<ExplainerFrame {scene} {label} {size} {paused} {resting}>
	<defs>
		{#each ["lane", "spur"] as m}
			<mask id="{uid}-{m}" maskUnits="userSpaceOnUse" x="0" y="0" width="240" height="240">
				{#each TRAIL as seg, i}
					{#if seg.mask === m}
						<path class="xp-later t-trail-m t-trail-m{i}" d="M{seg.from.x} {seg.from.y} L{seg.to.x} {seg.to.y}" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="butt" />
					{/if}
				{/each}
			</mask>
		{/each}
	</defs>

	<!-- The room a rule or the goal names, tinted under the walls. -->
	{#each TINTS as t}
		<rect class="xp-later t-tint-{t.name}" x={t.room.x} y={t.room.y} width={t.room.w} height={t.room.h} fill={t.fill} fill-opacity="0.14" />
	{/each}

	<!-- 1 · poster: the house, the robot at the entry, the goal -->
	<g class="t-plan">
		{#each ROOMS as r}
			<rect x={r.x} y={r.y} width={r.w} height={r.h} fill="none" stroke="var(--xp-rule)" stroke-width="1.2" />
		{/each}
		{#each DOORS as [x1, y1, x2, y2]}
			<line {x1} {y1} {x2} {y2} stroke="var(--xp-soft)" stroke-width="3" stroke-linecap="butt" />
		{/each}
		{#each BOXES as b}
			<rect x={b.x - BOX / 2} y={b.y - BOX / 2} width={BOX} height={BOX} fill={b.red ? "var(--xp-accent)" : "var(--xp-human)"} />
		{/each}
		<text class="xp-mono" x={LABEL.x} y={LABEL.y} font-size={T.label}>dining</text>
	</g>
	<g class="xp-later t-trail" fill="none" stroke="var(--xp-accent)" stroke-width="1.8" stroke-dasharray="3.5 3">
		<path d="M{START.x} {START.y} V{DINING.y}" mask="url(#{uid}-lane)" />
		<path d="M{TURN.x} {TURN.y} H{HALL.x}" mask="url(#{uid}-spur)" />
	</g>
	<g class="t-flag">
		<line x1={FLAG.x} x2={FLAG.x} y1={FLAG.y - 20} y2={FLAG.y} stroke="var(--xp-truth)" stroke-width="1.8" />
		<path d="M{FLAG.x} {FLAG.y - 20} l12 4.5 l-12 4.5 Z" fill="var(--xp-truth)" />
	</g>
	<circle class="t-robot" cx={START.x} cy={START.y} r={R} fill="var(--xp-accent)" />

	<text class="xp-prose xp-caption t-cap-q" style="color: var(--xp-accent-text)"><tspan x="14" y="205">can end users</tspan><tspan x="14" y="226">program a robot?</tspan></text>

	<!-- 2 · trigger-action rules (Fig. 1) -->
	<text class="xp-prose xp-caption xp-later t-cap-tap" x="14" y="205" style="color: var(--xp-human)">trigger-action rules</text>
	<text class="xp-mono xp-later t-rule-1" x="14" y="226" font-size={T.label} style="color: var(--xp-human)">if entry: go north</text>
	<text class="xp-mono xp-later t-rule-2" x="14" y="226" font-size={T.label} style="color: var(--xp-human)">if kitchen: go north</text>

	<!-- 3 · reinforcement learning: the goal (Fig. 2) -->
	<text class="xp-prose xp-caption xp-later t-cap-rl" x="14" y="205" style="color: var(--xp-accent-text)">RL: name the goal</text>
	<text class="xp-mono xp-later t-goal" x="14" y="226" font-size={T.label} style="color: var(--xp-truth)">goal: dining room?</text>

	<!-- 4 · takeaway, in the abstract's words -->
	<text class="xp-prose xp-later t-take" x="120" y="84" font-size={T.body} text-anchor="middle">Consider what</text>
	<text class="xp-prose xp-later t-take" x="120" y="109" font-size={T.body} text-anchor="middle">an agent’s objective is,</text>
	<text class="xp-prose xp-later t-take" x="120" y="146" font-size={T.body} text-anchor="middle" style="color: var(--xp-accent-text)">instead of how it can</text>
	<text class="xp-prose xp-later t-take" x="120" y="171" font-size={T.body} text-anchor="middle" style="color: var(--xp-accent-text)">ultimately be achieved.</text>
</ExplainerFrame>
