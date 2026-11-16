<script lang="ts">
	// The hero, as a pinned scroll section over the whole page canvas (like the timeline). One fingerprint whose ridges
	// are writing transforms with the reader's scroll: one print (a text by an unknown author), then a human print and an
	// AI print, then one print per lab, then a crowd of writers with one lit. The renderer (print/) draws ink only; every
	// word here is HTML from content.json and hero.json, placed at the anchors the renderer returns. Rows are controls: a
	// click scrolls to that level. The lens is an inspector: wherever it sits (the pointer, a tap, or parked by the
	// renderer on the most telling print), a card on its edge says what that print is at this level, with the paper's
	// evidence and numbers; the renderer brings that print forward.
	import { onMount } from "svelte";
	import Icon from "./Icon.svelte";
	import { field, chart } from "./field.svelte";
	import { createPrint, type Anchor, type Box, type Print } from "./print";
	import C from "./content.json";
	import H from "./hero.json";
	import { MODEL, LAB as LABC, RQ } from "./palette";

	const L = C.levels;
	const LIT = C.art.decipher[2];
	const LABS = ["Anthropic", "OpenAI", "Google", "Alibaba", "DeepSeek", "Moonshot", "Zhipu", "MiniMax", "Mistral", "xAI", "Cohere"];
	const LOGO: Record<string, string> = { Anthropic: "anthropic", OpenAI: "openai", Google: "google" };
	const STEPS = [0, 1, 2, 3];

	let root: HTMLElement, stick: HTMLElement, panel: HTMLElement;
	let pos = $state(0); // scroll position through the section, in steps (0..4.6)
	let lv = $state(0); // the level shown: held for most of each step, morphing to the next over the step's last third
	let active = $state(false);
	let anchors = $state<Anchor[]>([]);
	// what the inspector lens is on: the print's id (writers also get their kind), and the lens circle in viewport px
	let insp = $state<{ id: string; kind: number; x: number; y: number; r: number } | null>(null);
	let vw = $state(1440), vh = $state(900);
	let print: Print;

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
		const y = top + (STEPS.indexOf(n) + 0.3) * innerHeight * 0.9 - innerHeight * 0.5;
		scrollTo({ top: y, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
	}

	onMount(() => {
		const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches || new URLSearchParams(location.search).has("still");
		const text = [
			...C.lede.map((s) => s.t), L.lead.t, ...L.items.flatMap((i) => [i.t, i.fact]),
			(C.sections[0].example?.text ?? []).map((s) => s.t).join(""), ...C.timeline.steps.map((s) => s.t), ...C.art.decipher.map((d) => d.excerpt.t), C.closing.t,
		];
		print = createPrint({
			text, labs: LABS, litText: LIT.excerpt.t,
			colors: { human: "#C85A82", ai: "#461E47", lit: "#437E8E", ink: "#14202D", labs: ["#C85A82", "#437E8E", "#461E47"], other: "#8A8F98" },
		});
		let pointer: { x: number; y: number } | null = null;
		let lastAnchors = 0, anchorKey = "", inspKey = "";
		let lastStage: Box = { x: 0, y: 0, w: 1, h: 1 };
		// the crowd's kinds of writers sit in bands across it, in proportion, so moving the lens explores them
		const bands = (() => { let a = 0; return H.crowd.map((c) => (a += c.layout_share)); })();
		const kindAt = (x: number) => {
			const t = ((x - lastStage.x) / Math.max(1, lastStage.w)) * bands[bands.length - 1];
			const i = bands.findIndex((b) => t <= b);
			return i < 0 ? bands.length - 1 : i;
		};
		const rect = (el: Element): Box => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
		const mast = document.querySelector(".mast");

		chart.paint = (ctx, f) => {
			if (field.owner !== "hero") return;
			const s = rect(stick), p = rect(panel);
			const narrow = f.w < 860;
			const top = Math.max(0, s.y), bottom = Math.min(f.h, s.y + s.h);
			// the art lives beside the panel (wide) or below it (narrow), within the part of the stage on screen
			const stage: Box = narrow
				? { x: 0, y: Math.max(top, p.y + p.h + 8), w: f.w, h: Math.max(0, bottom - Math.max(top, p.y + p.h + 8)) }
				: { x: p.x + p.w + 24, y: top, w: f.w - (p.x + p.w + 24), h: Math.max(0, bottom - top) };
			const enter = Math.max(0, Math.min(1, 1 - Math.max(0, s.y) / f.h, (s.y + s.h) / f.h));
			const quiet = mast ? [p, rect(mast)] : [p];
			lastStage = stage;
			print.draw(ctx, { level: lv, t: f.now / 1000, dt: Math.min(0.05, f.dt), view: { w: f.w, h: f.h, dpr: f.dpr }, stage, quiet, pointer, enter, reduce, focus: insp?.id ?? null });
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
				const id = h?.id ?? null;
				const kind = id?.startsWith("writer:") && L ? kindAt(L.x) : -1;
				const ik = id && L ? `${id}|${kind}|${Math.round(L.x / 3)}|${Math.round(L.y / 3)}|${Math.round(L.r)}` : "";
				if (ik !== inspKey) { inspKey = ik; insp = id && L ? { id, kind, x: L.x, y: L.y, r: L.r } : null; }
			}
			return print.busy?.() ?? true;
		};

		const onMove = (e: PointerEvent) => {
			if (!active) return;
			pointer = { x: e.clientX, y: e.clientY };
			lastAnchors = 0;
		};
		const onLeave = () => { pointer = null; };
		const onSize = () => { vw = innerWidth; vh = innerHeight; };
		onSize();
		addEventListener("resize", onSize, { passive: true });
		addEventListener("pointermove", onMove, { passive: true });
		addEventListener("pointerdown", onMove, { passive: true });
		document.addEventListener("pointerleave", onLeave);

		const own = () => { field.mode = "paint"; field.owner = "hero"; field.dim = 0.55; field.interactive = false; };
		// where the reader is, from the scroll position itself (robust to remounts and jumps); runs on scroll and resize,
		// not every frame. Also retakes the canvas if a neighbour left it on the plain ground while this section is in view.
		const update = () => {
			if (active && field.mode === "ground") own();
			const r = root.getBoundingClientRect();
			const p = Math.max(0, (innerHeight * 0.5 - r.top) / (innerHeight * 0.9));
			if (Math.abs(p - pos) > 0.002) pos = p;
			const k = Math.min(STEPS.length - 1, Math.floor(p));
			const next = k >= STEPS.length - 1 ? STEPS[k] : STEPS[k] + (STEPS[k + 1] - STEPS[k]) * smooth(0.62, 0.98, p - k);
			const want = reduce ? Math.round(next) : next;
			if (Math.abs(want - lv) > 0.001) lv = want;
		};
		addEventListener("scroll", update, { passive: true });
		addEventListener("resize", update, { passive: true });
		update();
		const io = new IntersectionObserver((es) => es.forEach((e) => {
			active = e.isIntersecting;
			if (active) { own(); update(); }
			else if (field.owner === "hero") { field.mode = "ground"; field.dim = 0; field.owner = ""; insp = null; }
		}), { rootMargin: "0px 0px -10% 0px" });
		io.observe(root);
		return () => {
			removeEventListener("pointermove", onMove); removeEventListener("pointerdown", onMove); document.removeEventListener("pointerleave", onLeave); removeEventListener("resize", onSize);
			io.disconnect(); removeEventListener("scroll", update); removeEventListener("resize", update); print.dispose?.();
			if (field.owner === "hero") { field.mode = "ground"; field.dim = 0; field.owner = ""; chart.paint = null; }
		};
	});
</script>

<section class="ph" id="levels" bind:this={root} aria-label={L.lead.t} style="--steps:{STEPS.length}" data-level={lv.toFixed(2)} data-pos={pos.toFixed(2)}>
	<div class="stick" bind:this={stick}>
		<div class="panel" bind:this={panel}>
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
						<a class="go" href="#{it.target}" aria-label="Go to {it.t}"><Icon name="arrow" /></a>
					</li>
				{/each}
			</ol>
			<p class="without" data-lag="2">
				<span class="icons">{#each C.hero.without as w}<span class="struck" title={w.t}><Icon name={w.icon} /><svg viewBox="0 0 24 24" aria-hidden="true"><line x1="3" y1="21" x2="21" y2="3" /></svg></span>{/each}</span>
				{C.hero.without_line.t}
			</p>
			<p class="say-n" aria-hidden="true">{#each STEPS as _, i}<i><b style:width="{Math.max(0, Math.min(1, pos - i)) * 100}%"></b></i>{/each}</p>
		</div>
		{#if active && pos < 0.6}
			<button type="button" class="cue" style:opacity={1 - pos / 0.6} onclick={() => go(1)}><Icon name="arrow" />Scroll</button>
		{/if}
		{#if active}
			<div class="tags" aria-hidden="true">
				{#each tags as a (a.id)}
					{@const lab = a.id.startsWith("lab:") ? a.id.slice(4) : ""}
					<span
						class="tag {a.id === 'lit' ? 'lit' : ''} {lab && !LOGO[lab] ? 'small' : ''}"
						data-k={a.id === "human" ? "human" : a.id === "ai" ? "ai" : lab ? "lab" : "lit"}
						style:left="{a.x}px"
						style:top="{a.y + a.r + 14}px"
						style:opacity={Math.min(1, a.alpha * 1.4)}
					>
						{#if a.id === "human"}<Icon name="human" />Human{/if}
						{#if a.id === "ai"}<Icon name="ai" />AI{/if}
						{#if lab}{#if LOGO[lab]}<Icon name={LOGO[lab]} />{/if}{lab}{/if}
						{#if a.id === "lit"}<span class="who"><Icon name="check" /><b>{LIT.answers[0].verdict}</b></span>{/if}
					</span>
				{/each}
			</div>
			{#if insp && card}
				{@const id = insp.id}
				{@const lab = id.startsWith("lab:") ? id.slice(4) : ""}
				{@const LB = lab ? LABS_H[lab] : null}
				{@const kind = id.startsWith("writer:") ? H.crowd[Math.max(0, insp.kind)] : null}
				<div class="insp" class:right={card.right} style:left="{card.x}px" style:top="{card.y}px" aria-live="polite">
					{#if id === "main"}
						<p class="k">One text</p>
						<h3>{H.main.title.t}</h3>
						<ol class="qs">{#each H.main.items as it, i}<li style:--c={RQ[(i + 1) as 1 | 2 | 3]}><span>{i + 1}</span>{it.t}</li>{/each}</ol>
						<p class="hint">Move the circle over any print</p>
					{:else if id === "human" || id === "ai"}
						{@const E = id === "human" ? H.human : H.ai}
						<p class="k"><Icon name={E.kind === "prose" ? "pen" : "bulb"} />{E.kind === "prose" ? "Prose" : "Ideas"}</p>
						<h3 style:color={id === "human" ? RQ[1] : RQ[2]}><Icon name={id === "human" ? "human" : "ai"} />{E.verdict}</h3>
						<blockquote>“{E.excerpt.t}”</blockquote>
						<p class="ex">{E.explanation.t}</p>
						<p class="stat"><b style:color={FABLE}>{E.stat.v}</b><span>{E.stat.t}<br /><em>Claude Fable 5.2</em></span></p>
					{:else if LB}
						<h3 style:color={LB.rate !== undefined ? labColor(lab) : "#14202D"}>{#if LB.logo}<Icon name={LB.logo} />{/if}{lab}</h3>
						{#if LB.rate !== undefined}<p class="stat"><b style:color={FABLE}>{LB.rate}%</b><span>named correctly<br /><em>Claude Fable 5.2</em></span></p>{/if}
						{#if LB.profile}<p class="ex">{LB.profile.t}</p>{/if}
						<ul class="models">
							{#each LB.models as m}<li><span class="mn">{m.name}</span><i><b style:width="{m.own}%" style:background={LB.rate !== undefined ? labColor(lab) : "#8A8F98"}></b></i><span class="mv">{m.own}%</span></li>{/each}
						</ul>
						<p class="note">attributed to its own lab</p>
						{#if LB.rate === undefined}<p class="ex small">{H.labs_note.t}</p>{/if}
					{:else if kind}
						<p class="k"><Icon name="human" />Kinds of writers</p>
						<h3>{kind.label}</h3>
						<p class="stat"><b style:color={FABLE}>{kind.rate}%</b><span>named correctly<br /><em>Claude Fable 5.2</em></span></p>
						<p class="ex">{kindSentence(kind.t.t)}</p>
						{#if kind.id === "icml" || kind.id === "nature"}<p class="ex small">{H.privacy.t}</p>{/if}
					{:else if id === "lit"}
						<p class="k"><Icon name="book" />{H.lit.source}</p>
						<blockquote>“{H.lit.excerpt.t}”</blockquote>
						<p class="who"><Icon name="check" /><b>{H.lit.name}</b><span>Confidence {H.lit.confidence}%</span></p>
						<p class="ex">{H.lit.explanation.t}</p>
					{/if}
				</div>
			{/if}
		{/if}
	</div>
	<!-- invisible scroll triggers: one per level -->
	<div class="steps" aria-hidden="true">{#each STEPS as _}<div class="step"></div>{/each}</div>
</section>

<style>
	.ph { position: relative; margin-top: 24px; height: calc((var(--steps) + 0.6) * 90vh); }
	.stick { position: sticky; top: 0; height: 100vh; pointer-events: none; }
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
	.go { display: grid; place-items: center; width: 32px; border-radius: 3px; color: var(--ink2); background: rgba(243, 243, 239, .9); text-decoration: none; }
	.go:hover { color: var(--ink); background: #fff; }
	.without { margin-top: 6px; display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; font-size: 12.5px; color: var(--ink2); }
	.icons { display: inline-flex; gap: 8px; font-size: 16px; color: var(--ink); }
	.struck { position: relative; display: inline-flex; }
	.struck svg { position: absolute; inset: -2px; width: calc(100% + 4px); height: calc(100% + 4px); }
	.struck line { stroke: var(--ink); stroke-width: 2.2; stroke-linecap: round; }
	.say-n { display: flex; gap: 5px; margin-top: 4px; }
	.say-n i { position: relative; width: 22px; height: 3px; border-radius: 2px; background: var(--rule); overflow: hidden; }
	.say-n b { position: absolute; inset: 0 auto 0 0; background: var(--ink); }
	.tags { position: fixed; inset: 0; pointer-events: none; z-index: 2; }
	.tag {
		position: fixed; transform: translate(-50%, 0); display: inline-flex; align-items: center; gap: 6px; padding: 4px 9px; white-space: nowrap;
		border-radius: 3px; background: rgba(255, 255, 255, .94); font-size: 13px; font-weight: 600; color: var(--ink);
		box-shadow: 0 4px 14px rgba(20, 32, 45, .12); transition: opacity .3s;
	}
	.tag :global(svg) { width: 14px; height: 14px; }
	.tag[data-k="human"] { color: var(--rq1); } .tag[data-k="ai"] { color: var(--rq2); }
	.tag.small { font-size: 11.5px; font-weight: 500; padding: 2px 7px; color: var(--ink2); }
	.tag.lit { flex-direction: column; align-items: flex-start; gap: 3px; padding: 8px 12px; color: var(--rq3); font-size: 14px; animation: lit-in .6s .2s both; }
	.tag.lit .q { font-weight: 400; font-style: italic; color: var(--ink2); font-size: 13px; }
	.tag.lit .who { display: inline-flex; align-items: center; gap: 6px; color: #046B55; }
	.tag.lit b { color: var(--ink); }
	@keyframes lit-in { from { opacity: 0; transform: translate(-50%, 8px); } }
	/* the inspector card, hung off the lens's edge */
	.insp {
		position: fixed; z-index: 5; width: 330px; transform: translate(-100%, -50%); display: grid; gap: 8px; padding: 14px 16px;
		background: #fff; border-radius: 4px; box-shadow: 0 10px 30px rgba(20, 32, 45, .16); font-size: 13px; line-height: 1.45; color: var(--ink2);
		pointer-events: none; transition: left .25s var(--ease), top .25s var(--ease);
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
	.insp .qs { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
	.insp .qs li { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; color: var(--ink); }
	.insp .qs span { display: inline-grid; place-items: center; width: 20px; height: 20px; border-radius: 2px; background: var(--c); color: #fff; font-size: 11px; }
	.insp .hint { font-size: 12px; color: var(--ink2); }
	.insp .models { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
	.insp .models li { display: grid; grid-template-columns: 9.5em 1fr 2.6em; align-items: center; gap: 8px; font-size: 12px; color: var(--ink); white-space: nowrap; }
	.insp .models i { height: 6px; background: #EDEDED; border-radius: 1px; overflow: hidden; }
	.insp .models b { display: block; height: 100%; }
	.insp .mv { text-align: right; font-variant-numeric: tabular-nums; color: var(--ink2); }
	.insp .note { font-size: 11.5px; color: var(--ink2); }
	.insp .who { display: inline-flex; align-items: center; gap: 6px; font-size: 16px; color: #046B55; }
	.insp .who b { color: var(--ink); }
	.insp .who span { margin-left: 6px; font-size: 12px; color: var(--ink2); }
	.cue { pointer-events: auto; position: absolute; left: calc(min(36%, 430px) + (100% - min(36%, 430px)) / 2); bottom: 22px; transform: translateX(-50%); display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 20px; background: rgba(243, 243, 239, .92); font-size: 12.5px; font-weight: 500; color: var(--ink2); }
	.cue :global(svg) { transform: rotate(90deg); animation: nudge 1.6s ease-in-out infinite; }
	@keyframes nudge { 50% { transform: rotate(90deg) translateX(3px); } }
	.steps { position: absolute; inset: 0; pointer-events: none; }
	.step { height: 90vh; }
	@media (max-width: 860px) {
		.insp { width: min(300px, calc(100vw - 32px)); left: 16px !important; top: auto !important; bottom: 64px; transform: none; }
		.insp::before { display: none; }
		.panel { top: 12px; transform: none; width: auto; right: 0; gap: 6px; }
		.lead { font-size: 16px; }
		.fact, .without { display: none; }
		.row { padding: 8px 10px; grid-template-columns: 26px minmax(0, 1fr); }
		.n { width: 26px; height: 26px; font-size: 13px; }
		.t { font-size: 15px; }
	}
	@media (prefers-reduced-motion: reduce) { .panel li, .row, .tag { transition: none; } .tag.lit, .cue :global(svg) { animation: none; } }
</style>
