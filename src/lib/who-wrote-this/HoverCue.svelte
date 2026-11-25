<script lang="ts">
	// The page's one hover cue (Atrey, 17 Nov: "have some indicator to hover over it (as with all the figures)"): a small
	// dark pill with a pointer and a pulsing ring that says what to hover with a mouse, or what to tap on a touch screen.
	// Each figure places it (absolute by default; `inline` puts it in the flow, e.g. under a caption) and hides it with
	// `show={false}` once the reader has tried, so it fades instead of popping. Purely visual: aria-hidden, no pointer events.
	// (hc-* names: the site's Tailwind utilities, .ring among them, would otherwise style these)
	//   <HoverCue hover="Hover over a print" tap="Tap a print" show={!tried} style="left:12px; top:12px" />
	let { hover, tap = "", show = true, inline = false, class: cls = "", style = "" }:
		{ hover: string; tap?: string; show?: boolean; inline?: boolean; class?: string; style?: string } = $props();
</script>

<span class="hc {cls}" class:off={!show} class:hc-inline={inline} {style} aria-hidden="true">
	<span class="hc-ring"><svg viewBox="0 0 16 16"><path d="M3.5 1.5v11.2l3-2.7 2 4.6 2.1-.9-2-4.5h4.1z" /></svg></span>
	<span class="m">{hover}</span><span class="t">{tap || hover}</span>
</span>

<style>
	.hc {
		/* squared like every control on the page (radius 2 to 3 px, no pills) and flat (no shadow) */
		position: absolute; z-index: 3; display: inline-flex; align-items: center; gap: 7px; padding: 6px 10px 6px 8px; border-radius: 3px;
		background: #14202D; color: #fff; font-size: 12.5px; font-weight: 600; line-height: 1; letter-spacing: -0.005em; white-space: nowrap;
		pointer-events: none; transition: opacity .35s ease, transform .35s ease;
	}
	.hc.hc-inline { position: relative; z-index: auto; vertical-align: middle; }
	.hc.off { opacity: 0; transform: translateY(4px); }
	.hc-ring { position: relative; display: grid; place-items: center; width: 16px; height: 16px; }
	.hc-ring::before { content: ""; position: absolute; inset: -3px; border-radius: 50%; border: 1.5px solid currentColor; opacity: 0; animation: ping 1.8s ease-out infinite; }
	svg { width: 13px; height: 13px; fill: currentColor; }
	.t { display: none; }
	@media (hover: none), (pointer: coarse) { .m { display: none; } .t { display: inline; } }
	@keyframes ping { 0% { transform: scale(.6); opacity: .8; } 100% { transform: scale(1.7); opacity: 0; } }
	@media (prefers-reduced-motion: reduce) { .hc-ring::before { animation: none; } .hc { transition: none; } }
</style>
