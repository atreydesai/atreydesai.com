<script lang="ts">
	// The hero, as a pinned scroll section over the whole page canvas (like the timeline). One fingerprint whose ridges
	// are writing transforms with the reader's scroll: one print (a text by an unknown author), then a human print and an
	// AI print, then one print per lab, then a crowd of writers with one lit. The renderer (print/) draws ink only; every
	// word here is HTML from content.json and hero.json, placed at the anchors the renderer returns. Rows are controls: a
	// click scrolls to that level. The lens is an inspector: wherever the pointer (or a tap) puts it, a card on its edge
	// says what that print is at this level, with the paper's evidence and numbers; the renderer brings that print
	// forward. With no pointer on the art there is no lens, only a hover cue on the level's most telling print.
	import { onMount } from "svelte";
	import Icon from "./Icon.svelte";
	import HoverCue from "./HoverCue.svelte";
	import StepDashes from "./StepDashes.svelte";
	import { field, chart, regions } from "./field.svelte";
	import { onScroll, view as vp, lite, onTap, requestDraw, requestPaint, scrolling } from "./loop";
	import { createPrint, type Anchor, type Box, type Print } from "./print";
	import RIDGE from "./print_text.json";
	import C from "./content.json";
	import H from "./hero.json";
	import { MODEL, LAB as LABC, RQ } from "./palette";

	const L = C.levels;
	const LIT = C.art.decipher[2];
	const LABS = ["Anthropic", "OpenAI", "Google", "Alibaba", "DeepSeek", "Moonshot", "Zhipu", "MiniMax", "Mistral", "xAI", "Cohere"];
	const LOGO: Record<string, string> = { Anthropic: "anthropic", OpenAI: "openai", Google: "google" };
	const STEPS = [0, 1, 2, 3];
	// scroll per level, in viewport heights: short enough that a slow scroller sees the prints change soon, while the
	// renderer paces each division on its own clock so a fast scroller still sees every one (Atrey, 16 Nov)
	const STEP = 0.65;
	// the first split waits until the hero has the whole screen (Atrey, 17 Nov: it began with the section only partly
	// on screen): LEAD steps of extra scroll before level 0 starts counting, so the split begins once the section is
	// pinned and a little further; and LAG_MS, so a fast scroll that lands past that still sees the whole print for a
	// moment before it divides
	const LEAD = 0.3;
	const LAG_MS = 450;
	// level 3: each set of texts has its own colour, in hero.json's crowd order (icml, active, famous, papers, nature,
	// inactive). Three families of two from the page palette: teal for reviews, rose for Reddit, aubergine for published
	// writing; the writer the model finds is in ink, like the one print at level 0 (Atrey, 16 Nov: different fingerprint
	// colours for different sets of texts; one teal ramp read as one grey crowd)
	// which kind each crowd writer is: the kinds mixed evenly through the crowd in proportion to their shares, not in bands
	// (Jenna, 16 Nov: spread the datasets instead of all ICML on the left). A golden-ratio walk spreads each kind out.
	const CROWD_N = 400;
	const CROWD_KIND = (() => {
		const tot = H.crowd.reduce((a, c) => a + c.layout_share, 0);
		return Array.from({ length: CROWD_N }, (_, i) => {
			const u = ((i * 0.6180339887) % 1) * tot;
			let a = 0;
			for (let k = 0; k < H.crowd.length; k++) { a += H.crowd[k].layout_share; if (u < a) return k; }
			return H.crowd.length - 1;
		});
	})();
	const KIND_COLORS = ["#437E8E", "#C85A82", "#461E47", "#9A82B4", "#8CB5C0", "#DC89A7"];

	let root: HTMLElement, stick: HTMLElement, panel: HTMLElement;
	let pos = $state(0); // scroll position through the section, in steps (0..4.6)
	let lv = $state(0); // the level shown: held for most of each step, morphing to the next over the step's last third
	let active = $state(false);
	let anchors = $state<Anchor[]>([]);
	// what the inspector lens is on: the print's id (writers also get their kind), and the lens circle in viewport px
	let insp = $state<{ id: string; kind: number; x: number; y: number; r: number } | null>(null);
	// the hover cue: where it points (viewport px), and the levels where the reader has already used the lens
	let hint = $state<{ x: number; y: number } | null>(null);
	let tried = $state([false, false, false, false]);
	let vw = $state(1440), vh = $state(900);
	let print = $state.raw() as Print;

	const level = $derived(Math.round(lv)); // the level the copy and controls point at
	const step = $derived(Math.max(0, Math.min(STEPS.length - 1, Math.floor(pos))));
	const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
	// labels shown at anchors: the two kinds, the labs (big three with logos), and the lit writer
	const tags = $derived(
		anchors.filter((a) => a.alpha > 0.25 && (a.id === "human" || a.id === "ai" || a.id.startsWith("lab:") || a.id === "lit")),
	);
	const FABLE = MODEL["Claude Fable 5.2"];
	const LABS_H = H.labs as Record<string, { logo?: string | null; rate?: number; profile?: { t: string }; family?: string; models: { name: string; own: number }[] }>;
	const labColor = (lab: string) => (LABC as Record<string, string>)[lab] ?? "#8A8F98";
	const lower = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);
	// a kind's paper clause reads as a sentence: whole sentences stay, clauses get "Claude Fable 5.2 names …"
	const kindSentence = (t: string) => (/^(Fable|Claude)/.test(t) ? t : `${H.names_prefix.t} ${lower(t)}`);
	// the card hangs off the lens's edge, on whichever side has room
	const card = $derived.by(() => {
		if (!insp) return null;
		const W = 330, gap = 18;
		const right = insp.x + insp.r + gap + W < vw - 36;
		return { x: right ? insp.x + insp.r + gap : insp.x - insp.r - gap, y: Math.max(170, Math.min(vh - 170, insp.y)), right };
	});

	// a row click scrolls to where that level is held, so the print morphs there with the scroll
	function go(n: number) {
		const top = root.getBoundingClientRect().top + scrollY;
		const H = vp.h || innerHeight;
		const y = top + (STEPS.indexOf(n) + 0.3 + LEAD) * H * STEP - H * 0.5;
		scrollTo({ top: y, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
	}

	onMount(() => {
		const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches || new URLSearchParams(location.search).has("still");
		const text = [
			...C.lede.map((s) => s.t), L.lead.t, ...L.items.flatMap((i) => [i.t, i.fact]),
			(C.sections[0].example?.text ?? []).map((s) => s.t).join(""), ...C.timeline.steps.map((s) => s.t), ...C.art.decipher.map((d) => d.excerpt.t), C.closing.t,
		];
		print = createPrint({
			text, labs: LABS, litText: LIT.excerpt.t, ridge: RIDGE,
			crowdColors: CROWD_KIND.map((k) => KIND_COLORS[k]),
			colors: { human: "#C85A82", ai: "#461E47", lit: "#14202D", ink: "#14202D", labs: ["#C85A82", "#437E8E", "#461E47"], other: "#8A8F98" },
		});
		let pointer: { x: number; y: number } | null = null;
		let lastAnchors = 0, anchorKey = "", inspKey = "";
		let lastStage: Box = { x: 0, y: 0, w: 1, h: 1 };
		const rect = (el: Element): Box => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
		const mast = document.querySelector(".mast");

		chart.paint = (ctx, f) => {
			if (field.owner !== "hero") return;
			const s = rect(stick), p = rect(panel);
			const narrow = f.w < 860;
			// the art lives beside the panel (wide) or below it (narrow); the box keeps one size and moves with the section,
			// so the prints never re-set or shrink while it scrolls in or out (that jitter is what "gyrating" was)
			const top = s.y, pb = p.y + p.h + 8 - s.y;
			const stage: Box = narrow
				? { x: 0, y: top + pb, w: f.w, h: Math.max(160, f.h - pb) }
				: { x: p.x + p.w + 24, y: top, w: f.w - (p.x + p.w + 24), h: f.h };
			const enter = Math.max(0, Math.min(1, 1 - Math.max(0, s.y) / f.h, (s.y + s.h) / f.h));
			const quiet = mast ? [p, rect(mast)] : [p];
			lastStage = stage;
			print.draw(ctx, { level: lv, t: f.now / 1000, dt: Math.min(0.05, f.dt), view: { w: f.w, h: f.h, dpr: f.dpr }, stage, quiet, pointer, enter, reduce, focus: insp?.id ?? null, follow: lite.on, calm: lite.on && scrolling() });
			if (f.now - lastAnchors > 50) {
				lastAnchors = f.now;
				// labels re-render only when a print moved or faded, not on every painted frame
				const next = print.anchors();
				let k = "";
				for (const a of next) k += `${a.id}${Math.round(a.x)},${Math.round(a.y)},${Math.round(a.r)},${Math.round(a.alpha * 40)};`;
				if (k !== anchorKey) {
					anchorKey = k;
					anchors = next;
				}
				// the inspector: what the lens is on now (it may be parked by the renderer when there is no pointer)
				const L = print.lens?.() ?? (pointer ? { x: pointer.x, y: pointer.y, r: 56 } : null);
				const h = L ? print.hit(L.x, L.y) : null;
				let id = h?.id ?? null;
				// level 0 has no card: the one print speaks for itself (Atrey, 16 Nov: remove the preview)
				if (id === "main") id = null;
				const kind = id?.startsWith("writer:") ? CROWD_KIND[(Number(id.slice(7)) || 0) % CROWD_N] : -1;
				const ik = id && L ? `${id}|${kind}|${Math.round(L.x / 3)}|${Math.round(L.y / 3)}|${Math.round(L.r)}` : "";
				if (ik !== inspKey) { inspKey = ik; insp = id && L ? { id, kind, x: L.x, y: L.y, r: L.r } : null; }
				// once the reader has the lens out at a level, that level's cue has done its job
				if (pointer && L && !tried[level]) tried[level] = true;
				const c = print.cue?.() ?? null;
				const hk = c ? `${Math.round(c.x / 2)},${Math.round(c.y / 2)}` : "";
				if (hk !== (hint ? `${Math.round(hint.x / 2)},${Math.round(hint.y / 2)}` : "")) hint = c ? { x: c.x, y: c.y } : null;
			}
			return print.busy?.() ?? true;
		};

		const onMove = (e: PointerEvent) => {
			// the lighter mode (phones): the lens stays parked while a finger scrolls; a deliberate tap moves it (onTap)
			if (!active || (lite.on && e.pointerType !== "mouse")) return;
			pointer = { x: e.clientX, y: e.clientY };
			lastAnchors = 0;
		};
		const stopTap = onTap((x, y) => { if (active && lite.on) { pointer = { x, y }; lastAnchors = 0; requestPaint(); } });
		regions.hero = root;
		// only a mouse leaving the page parks the lens: a finger lifting also fires pointerleave, which used to undo every tap
		// (a Pixel could not open the human print's card)
		const onLeave = (e: PointerEvent) => { if (e.pointerType === "mouse") pointer = null; };
		vw = innerWidth; vh = innerHeight; // (then from the page's loop, which keeps a phone's height steady)
		addEventListener("pointermove", onMove, { passive: true });
		addEventListener("pointerdown", onMove, { passive: true });
		document.addEventListener("pointerleave", onLeave);

		const own = () => { field.mode = "paint"; field.owner = "hero"; field.dim = 0.55; field.interactive = false; };
		// where the reader is, from the scroll position itself (robust to remounts and jumps); runs in the page's loop
		// (loop.ts) on scroll and resize, not every frame. Also retakes the canvas if a neighbour left it on the plain
		// ground while this section is in view. Past the section the position stops counting (it would only rewrite
		// this section's attributes on every scroll further down the page).
		const update = () => {
			if (active && field.mode === "ground") own();
			if (lite.on && pointer && scrolling()) { pointer = null; lastAnchors = 0; } // a scroll parks a tapped lens again
			if (vp.w !== vw) vw = vp.w;
			if (vp.h !== vh) vh = vp.h;
			const r = root.getBoundingClientRect(), H = vp.h;
			const p = Math.min(STEPS.length + 1, Math.max(0, (H * 0.5 - r.top) / (H * STEP) - LEAD));
			if (Math.abs(p - pos) > 0.002) pos = p;
			const k = Math.min(STEPS.length - 1, Math.floor(p));
			// past two thirds of a step the next level starts, and the renderer plays the whole division smoothly
			let want = k >= STEPS.length - 1 ? STEPS[k] : p - k > 0.66 ? STEPS[k + 1] : STEPS[k];
			// the lag: the first split waits until the section has been pinned for LAG_MS (re-checked by a timer)
			const now = performance.now();
			if (r.top > 0.5) pinAt = 0;
			else if (!pinAt) pinAt = now;
			if (lv < 0.5 && want > 0) {
				const left = pinAt ? pinAt + LAG_MS - now : LAG_MS;
				if (left > 0) {
					want = 0;
					// (no scroll event comes with the timer, so it asks the canvas for a frame itself)
					if (!lagT) lagT = window.setTimeout(() => { lagT = 0; update(); requestPaint(); }, left + 16);
				}
			}
			if (Math.abs(want - lv) > 0.001) lv = want;
		};
		let pinAt = 0, lagT = 0;
		const stopScroll = onScroll(update);
		const io = new IntersectionObserver((es) => es.forEach((e) => {
			active = e.isIntersecting;
			if (active) { own(); update(); }
			else if (field.owner === "hero") { field.mode = "ground"; field.dim = 0; field.owner = ""; insp = null; }
		}), { rootMargin: "0px 0px -10% 0px" });
		io.observe(root);
		return () => {
			removeEventListener("pointermove", onMove); removeEventListener("pointerdown", onMove); stopTap(); document.removeEventListener("pointerleave", onLeave); 
			io.disconnect(); stopScroll(); print.dispose?.(); clearTimeout(lagT);
			if (field.owner === "hero") { field.mode = "ground"; field.dim = 0; field.owner = ""; chart.paint = null; }
		};
	});
</script>

<section class="ph" id="levels" bind:this={root} aria-label={L.lead.t} style="--steps:{STEPS.length}; --lead:{LEAD}" data-level={lv.toFixed(2)} data-pos={pos.toFixed(2)}>
	<div class="stick" bind:this={stick}>
		<div class="panel" bind:this={panel}>
			<StepDashes count={STEPS.length} current={level} go={(i) => go(STEPS[i])} progress={step < STEPS.length - 1 ? Math.min(1, (pos - step) / 0.66) : -1} />
			<p class="lead">{L.lead.t}:</p>
			<ol data-lag="1">
				{#each L.items as it}
					<li class:on={level === 0 || level === it.n} class:now={level === it.n} data-rq={it.rq}>
						<button type="button" class="row" aria-pressed={level === it.n} onclick={() => go(level === it.n ? 0 : it.n)}>
							<span class="n">{it.n}</span>
							<span class="body">
								<span class="t">{it.t}</span>
								<span class="fact">{#if it.v}<b>{it.v}</b>{" "}{/if}{it.fact}</span>
							</span>
						</button>
					</li>
				{/each}
			</ol>
			<!-- level 3's key: what each shade of the crowd is, and how often Claude Fable 5.2 names its writers (space kept at every level so the art never moves) -->
			<ul class="kinds" class:show={level === 3} aria-hidden={level !== 3}>
				{#each H.crowd as c, i}<li><i style:background={KIND_COLORS[i]}></i>{c.label}<b>{c.rate}%</b></li>{/each}
			</ul>
			<p class="without" data-lag="2">
				<span class="icons">{#each C.hero.without as w}<span class="struck" title={w.t}><Icon name={w.icon} /><svg viewBox="0 0 24 24" aria-hidden="true"><line x1="3" y1="21" x2="21" y2="3" /></svg></span>{/each}</span>
				{C.hero.without_line.t}
			</p>
		</div>
		{#if active && pos < 0.5}
			<!-- an unmissable cue to scroll (Atrey, 16 Nov): it fades as the reader starts -->
			<button type="button" class="cue" style:opacity={1 - pos / 0.5} onclick={() => go(1)}>
				<span class="mouse" aria-hidden="true"><i></i></span>Scroll to see all three levels
				<span class="chev" aria-hidden="true"><Icon name="arrow" /><Icon name="arrow" /></span>
			</button>
		{/if}
		{#if active}
			<div class="tags" aria-hidden="true">
				{#each tags as a (a.id)}
					{@const lab = a.id.startsWith("lab:") ? a.id.slice(4) : ""}
					<!-- placed by a transform on a wrapper (no layout as the prints move); the tag keeps its own offset -->
					<span class="tpos" style:transform="translate({a.x}px, {a.y + a.r + 14}px)">
						<span
							class="tag {a.id === 'lit' ? 'lit' : ''} {lab && !LOGO[lab] ? 'small' : ''}"
							data-k={a.id === "human" ? "human" : a.id === "ai" ? "ai" : lab ? "lab" : "lit"}
							style:opacity={Math.min(1, a.alpha * 1.4)}
						>
							{#if a.id === "human"}<Icon name="human" />Human{/if}
							{#if a.id === "ai"}<Icon name="ai" />AI{/if}
							{#if lab}{#if LOGO[lab]}<Icon name={LOGO[lab]} />{/if}{lab}{/if}
							{#if a.id === "lit"}<span class="who"><Icon name="check" /><b>{LIT.answers[0].verdict}</b></span>{/if}
						</span>
					</span>
				{/each}
			</div>
			{#if hint}
				<!-- the hover cue (Atrey, 17 Nov): on the telling print, until the reader has used the lens at this level -->
				<span class="hpos" style:transform="translate({Math.min(hint.x, vw - 210)}px, {hint.y}px)">
					<HoverCue hover={level === 0 ? "Hover over the print" : "Hover over a print"} tap={level === 0 ? "Tap the print" : "Tap a print"} show={!tried[level] && !insp} style="left:-16px; top:0; transform:translateY(-50%)" />
				</span>
			{/if}
			{#if insp && card}
				{@const id = insp.id}
				{@const lab = id.startsWith("lab:") ? id.slice(4) : ""}
				{@const LB = lab ? LABS_H[lab] : null}
				{@const kind = id.startsWith("writer:") ? H.crowd[Math.max(0, insp.kind)] : null}
				<!-- the card glides after the lens by a transform on its wrapper, so following the pointer needs no layout -->
				<div class="ipos" style:transform="translate({card.x}px, {card.y}px)">
				<div class="insp" class:right={card.right} aria-live="polite">
					{#if id === "main"}
						<blockquote class="reads">“{print.lensText?.()}”</blockquote>
					{:else if id === "human" || id === "ai"}
						{@const E = id === "human" ? H.human : H.ai}
						<p class="k"><Icon name={E.kind === "prose" ? "pen" : "bulb"} />{E.kind === "prose" ? "Prose" : "Ideas"}</p>
						<h3 style:color={id === "human" ? RQ[1] : RQ[2]}><Icon name={id === "human" ? "human" : "ai"} />{E.verdict}</h3>
						<blockquote>“{E.excerpt.t}”</blockquote>
						<p class="ex">{E.explanation.t}</p>
						<p class="stat"><b style:color={FABLE}>{E.stat.v}</b><span>{E.stat.t}<br />named correctly by <em>Claude Fable 5.2</em></span></p>
					{:else if LB}
						<h3 style:color={LB.rate !== undefined ? labColor(lab) : "#14202D"}>{#if LB.logo}<Icon name={LB.logo} />{/if}{lab}</h3>
						{#if LB.rate !== undefined}<p class="stat"><b style:color={FABLE}>{LB.rate}%</b><span>named correctly by<br /><em>Claude Fable 5.2</em></span></p>{/if}
						{#if LB.profile}<p class="ex">{LB.profile.t}</p>{/if}
						<ul class="models">
							{#each LB.models as m}<li><span class="mn">{m.name}</span><i><b style:width="{m.own}%" style:background={LB.rate !== undefined ? labColor(lab) : "#8A8F98"}></b></i><span class="mv">{m.own}%</span></li>{/each}
						</ul>
						<p class="note">attributed to its own lab</p>
						{#if LB.rate === undefined}<p class="ex small">{H.labs_note.t}</p>{/if}
					{:else if kind}
						<p class="k"><Icon name="human" />Kinds of writers</p>
						<h3>{kind.label}</h3>
						<p class="stat"><b style:color={FABLE}>{kind.rate}%</b><span>named correctly by<br /><em>Claude Fable 5.2</em></span></p>
						<p class="ex">{kindSentence(kind.t.t)}</p>
						{#if kind.id === "icml" || kind.id === "nature"}<p class="ex small">{H.privacy.t}</p>{/if}
					{:else if id === "lit"}
						<p class="k"><Icon name="book" />{H.lit.source}</p>
						<blockquote>“{H.lit.excerpt.t}”</blockquote>
						<p class="who"><Icon name="check" /><b>{H.lit.name}</b><span>Confidence {H.lit.confidence}%</span></p>
						<p class="ex">{H.lit.explanation.t}</p>
					{/if}
				</div>
				</div>
			{/if}
		{/if}
	</div>
	<!-- invisible scroll triggers: one per level -->
	<div class="steps" aria-hidden="true">{#each STEPS as _}<div class="step"></div>{/each}</div>
</section>

<style>
	.ph { position: relative; margin-top: 24px; height: calc((var(--steps) + 0.6 + var(--lead)) * 65 * var(--vh, 1vh)); }
	.stick { position: sticky; top: 0; height: calc(100 * var(--vh, 1vh)); pointer-events: none; }
	.panel { pointer-events: auto; position: absolute; left: 0; top: 50%; transform: translateY(-50%); width: min(36%, 430px); display: grid; gap: 10px; }
	.lead { font-size: clamp(19px, 1.9vw, 23px); line-height: 1.3; font-weight: 500; letter-spacing: -0.015em; text-wrap: balance; }
	.panel ol { margin-top: 10px; display: grid; gap: 8px; }
	.panel li { --c: var(--rq1); display: flex; align-items: stretch; gap: 6px; opacity: .4; transition: opacity .4s var(--ease); }
	.panel li[data-rq="2"] { --c: var(--rq2); } .panel li[data-rq="3"] { --c: var(--rq3); }
	.panel li.on { opacity: 1; }
	.row { flex: 1; display: grid; grid-template-columns: 34px minmax(0, 1fr); gap: 12px; align-items: start; text-align: left; padding: 12px 14px; border-radius: 3px; background: rgba(243, 243, 239, .9); border: 1.5px solid transparent; transition: border-color .2s, background-color .2s; }
	.row:hover { border-color: var(--c); }
	.panel li.now .row { border-color: var(--c); background: #fff; }
	.n { display: inline-grid; place-items: center; width: 34px; height: 34px; border-radius: 2px; background: var(--c); color: #fff; font-weight: 600; font-size: 16px; }
	.body { display: grid; gap: 3px; }
	.t { font-size: clamp(17px, 1.6vw, 20px); font-weight: 600; letter-spacing: -0.02em; line-height: 1.2; }
	.fact { font-size: 13.5px; line-height: 1.45; color: var(--ink2); }
	.fact b { font-size: 15.5px; font-weight: 600; color: var(--ink); font-variant-numeric: tabular-nums; }
	.without { margin-top: 6px; display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; font-size: 12.5px; color: var(--ink2); }
	.icons { display: inline-flex; gap: 8px; font-size: 16px; color: var(--ink); }
	.struck { position: relative; display: inline-flex; }
	.struck svg { position: absolute; inset: -2px; width: calc(100% + 4px); height: calc(100% + 4px); }
	.struck line { stroke: var(--ink); stroke-width: 2.2; stroke-linecap: round; }
	.tags { position: fixed; inset: 0; pointer-events: none; z-index: 2; }
	.tpos { position: fixed; left: 0; top: 0; }
	.tag {
		position: relative; transform: translate(-50%, 0); display: inline-flex; align-items: center; gap: 6px; padding: 4px 9px; white-space: nowrap;
		border-radius: 3px; background: rgba(255, 255, 255, .94); font-size: 13px; font-weight: 600; color: var(--ink);
		box-shadow: 0 4px 14px rgba(20, 32, 45, .12); transition: opacity .3s;
	}
	.tag :global(svg) { width: 14px; height: 14px; }
	.tag[data-k="human"] { color: var(--rq1); } .tag[data-k="ai"] { color: var(--rq2); }
	.tag.small { font-size: 11.5px; font-weight: 500; padding: 2px 7px; color: var(--ink2); }
	.tag.lit { flex-direction: column; align-items: flex-start; gap: 3px; padding: 8px 12px; color: var(--rq3); font-size: 14px; animation: lit-in .6s .2s both; }
	.tag.lit .who { display: inline-flex; align-items: center; gap: 6px; color: #046B55; }
	.tag.lit b { color: var(--ink); }
	@keyframes lit-in { from { opacity: 0; transform: translate(-50%, 8px); } }
	.hpos { position: fixed; left: 0; top: 0; z-index: 4; pointer-events: none; transition: transform .3s var(--ease); }
	/* the inspector card, hung off the lens's edge */
	.ipos { position: fixed; left: 0; top: 0; z-index: 5; pointer-events: none; transition: transform .25s var(--ease); }
	.insp {
		position: relative; width: 330px; transform: translate(-100%, -50%); display: grid; gap: 8px; padding: 14px 16px;
		background: #fff; border-radius: 4px; box-shadow: 0 10px 30px rgba(20, 32, 45, .16); font-size: 13px; line-height: 1.45; color: var(--ink2);
		pointer-events: none;
	}
	.insp.right { transform: translate(0, -50%); }
	.insp::before { content: ""; position: absolute; top: 50%; width: 18px; border-top: 1.5px solid var(--ink); right: -18px; }
	.insp.right::before { left: -18px; right: auto; }
	.insp .k { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--ink2); }
	.insp h3 { display: inline-flex; align-items: center; gap: 8px; font-size: 22px; line-height: 1.1; font-weight: 600; letter-spacing: -0.02em; color: var(--ink); }
	.insp h3 :global(svg) { width: 20px; height: 20px; }
	.insp blockquote { margin: 0; font-size: 15px; line-height: 1.4; font-style: italic; color: var(--ink); }
	.insp .ex { color: var(--ink2); }
	.insp .ex.small { font-size: 12px; }
	.insp .stat { display: flex; align-items: center; gap: 10px; }
	.insp .stat b { font-size: 34px; line-height: 1; font-weight: 600; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }
	.insp .stat span { font-size: 12.5px; line-height: 1.3; color: var(--ink2); }
	.insp .stat em { font-style: normal; font-weight: 600; color: #B4501C; }
	.insp .reads { margin: 0; font-size: 14.5px; line-height: 1.45; font-style: italic; color: var(--ink); }
	.insp .models { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
	.insp .models li { display: grid; grid-template-columns: 9.5em 1fr 2.6em; align-items: center; gap: 8px; font-size: 12px; color: var(--ink); white-space: nowrap; }
	.insp .models i { height: 6px; background: #EDEDED; border-radius: 1px; overflow: hidden; }
	.insp .models b { display: block; height: 100%; }
	.insp .mv { text-align: right; font-variant-numeric: tabular-nums; color: var(--ink2); }
	.insp .note { font-size: 11.5px; color: var(--ink2); }
	.insp .who { display: inline-flex; align-items: center; gap: 6px; font-size: 16px; color: #046B55; }
	.insp .who b { color: var(--ink); }
	.insp .who span { margin-left: 6px; font-size: 12px; color: var(--ink2); }
	.kinds { list-style: none; margin: 2px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 5px 14px; font-size: 12.5px; line-height: 1.3; color: var(--ink2); opacity: 0; transition: opacity .4s var(--ease); }
	.kinds.show { opacity: 1; }
	.panel .kinds li { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; opacity: 1; }
	.kinds i { width: 10px; height: 10px; border-radius: 2px; }
	.kinds b { font-weight: 600; color: var(--ink); font-variant-numeric: tabular-nums; }
	.cue {
		pointer-events: auto; position: fixed; z-index: 6; left: 50%; bottom: 28px; transform: translateX(-50%);
		display: inline-flex; align-items: center; gap: 12px; padding: 12px 20px 12px 16px; border-radius: 999px; background: #14202D; color: #fff;
		font-size: 15px; font-weight: 600; letter-spacing: -0.005em; white-space: nowrap; box-shadow: 0 10px 30px rgba(20, 32, 45, .28); animation: cue-in .6s .4s both;
	}
	.cue::after { content: ""; position: absolute; inset: -6px; border-radius: inherit; border: 2px solid #14202D; opacity: 0; animation: ring 2s 1s ease-out infinite; }
	.mouse { position: relative; width: 16px; height: 24px; border: 2px solid #fff; border-radius: 9px; }
	.mouse i { position: absolute; left: 50%; top: 4px; width: 2px; height: 5px; margin-left: -1px; border-radius: 1px; background: #fff; animation: wheel 1.4s ease-in-out infinite; }
	.chev { display: grid; line-height: 0; }
	.chev :global(svg) { width: 14px; height: 14px; transform: rotate(90deg); animation: drop 1.4s ease-in-out infinite; }
	.chev :global(svg + svg) { margin-top: -7px; animation-delay: .15s; }
	@keyframes wheel { 0% { transform: translateY(0); opacity: 1; } 70% { transform: translateY(8px); opacity: 0; } 100% { opacity: 0; } }
	@keyframes drop { 0%, 100% { transform: rotate(90deg) translateX(-2px); opacity: .5; } 50% { transform: rotate(90deg) translateX(3px); opacity: 1; } }
	@keyframes ring { 0% { opacity: .5; transform: scale(1); } 100% { opacity: 0; transform: scale(1.18); } }
	@keyframes cue-in { from { opacity: 0; transform: translate(-50%, 12px); } }
	.steps { position: absolute; inset: 0; pointer-events: none; }
	.step { height: calc(65 * var(--vh, 1vh)); }
	@media (max-width: 860px) {
		.cue { bottom: 24px; font-size: 14px; padding: 10px 16px 10px 12px; }
		.kinds { font-size: 11px; gap: 3px 10px; }
		/* on a phone the card is a compact strip docked under the prints (clear of the rail's arrows at the left), holding
		   only the name and the number, or the quote and the writer, so it never covers a print's name (Atrey, 16 Nov) */
		.ipos { transform: none !important; transition: none; }
		.insp {
			position: fixed; width: auto; left: 48px; right: 12px; top: auto; bottom: 10px; transform: none;
			display: flex; flex-wrap: wrap; align-items: center; gap: 2px 12px; padding: 8px 12px; transition: none;
		}
		.insp::before { display: none; }
		.insp .k, .insp .ex, .insp .models, .insp .note, .insp blockquote:not(.reads) { display: none; }
		.insp h3 { font-size: 17px; }
		.insp h3 :global(svg) { width: 16px; height: 16px; }
		.insp .stat { gap: 7px; }
		.insp .stat b { font-size: 24px; }
		.insp .stat span { font-size: 11px; }
		.insp .who { font-size: 14px; }
		.insp .reads { font-size: 13px; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
		.panel { top: 12px; transform: none; width: auto; right: 0; gap: 6px; }
		.lead { font-size: 16px; }
		.fact, .without { display: none; }
		.row { padding: 8px 10px; grid-template-columns: 26px minmax(0, 1fr); }
		.n { width: 26px; height: 26px; font-size: 13px; }
		.t { font-size: 15px; }
	}
	@media (prefers-reduced-motion: reduce) { .panel li, .row, .tag { transition: none; } .tag.lit, .cue, .cue::after, .mouse i, .chev :global(svg) { animation: none; } }
</style>
