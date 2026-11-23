<script lang="ts">
	// A share control at the foot of each section: a share icon; hovering it offers two links, the blog or this section;
	// a click without hovering first (a tap, a keyboard press) shares this section (/blog/who-wrote-this/#which-ai, which
	// the page follows to the section's top). On a touch screen with a share sheet it opens that; otherwise it copies
	// the link and says so. Icons: Bootstrap Icons (MIT), the paper's
	// icon family. Names are sh-* so the site's Tailwind utilities never style them.
	//   <ShareBlock url={url} id="which-ai" name="Which AI" />
	let { url, id, name }: { url: string; id: string; name: string } = $props();

	let open = $state(false);
	let said = $state("");
	let openT = 0, closeT = 0, sayT = 0;
	const coarse = () => typeof matchMedia !== "undefined" && matchMedia("(hover: none), (pointer: coarse)").matches;

	function enter(e: PointerEvent) {
		if (e.pointerType !== "mouse") return;
		clearTimeout(closeT);
		openT = window.setTimeout(() => (open = true), 90);
	}
	function leave(e: PointerEvent) {
		if (e.pointerType !== "mouse") return;
		clearTimeout(openT);
		closeT = window.setTimeout(() => (open = false), 220);
	}
	function say(t: string) {
		said = t;
		clearTimeout(sayT);
		sayT = window.setTimeout(() => (said = ""), 2200);
	}
	async function share(section: boolean) {
		const link = section ? `${url}#${id}` : url;
		const what = section ? `“${name}”` : "the blog";
		open = false;
		if (coarse() && navigator.share) {
			try { await navigator.share({ url: link }); } catch { /* closed the sheet */ }
			return;
		}
		try {
			await navigator.clipboard.writeText(link);
			say(`Link to ${what} copied`);
		} catch {
			say(link); // no clipboard: show the link so it can be copied by hand
		}
	}
	function keys(e: KeyboardEvent) {
		if (e.key === "Escape" && open) { open = false; (e.currentTarget as HTMLElement).querySelector<HTMLElement>(".sh-main")?.focus(); }
	}
	function blur(e: FocusEvent) {
		if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) open = false;
	}
</script>

<!-- The group itself isn't a control: its handlers catch what bubbles up from the buttons inside (Escape and leaving
     focus close the menu) and let a mouse hover over the button or the menu keep it open. Every action has a button. -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div class="sh" role="group" aria-label="Share" onpointerenter={enter} onpointerleave={leave} onkeydown={keys} onfocusout={blur}>
	<button type="button" class="sh-main" aria-haspopup="menu" aria-expanded={open} onclick={() => share(true)} onfocus={() => (open = !coarse())}>
		<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13.5 1a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3M11 2.5a2.5 2.5 0 1 1 .603 1.628l-6.718 3.12a2.5 2.5 0 0 1 0 1.504l6.718 3.12a2.5 2.5 0 1 1-.488.876l-6.718-3.12a2.5 2.5 0 1 1 0-3.256l6.718-3.12A2.5 2.5 0 0 1 11 2.5m-8.5 4a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3m11 5.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3" /></svg>
		Share
	</button>
	<!-- after the button, so Tab moves from it into the options; drawn above it -->
	{#if open}
		<div class="sh-menu" role="menu" aria-label="Share a link">
			<button type="button" role="menuitem" onclick={() => share(false)}>
				<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.715 6.542 3.343 7.914a3 3 0 1 0 4.243 4.243l1.828-1.829A3 3 0 0 0 8.586 5.5L8 6.086a1 1 0 0 0-.154.199 2 2 0 0 1 .861 3.337L6.88 11.45a2 2 0 1 1-2.83-2.83l.793-.792a4 4 0 0 1-.128-1.287z" /><path d="M6.586 4.672A3 3 0 0 0 7.414 9.5l.775-.776a2 2 0 0 1-.896-3.346L9.12 3.55a2 2 0 1 1 2.83 2.83l-.793.792c.112.42.155.855.128 1.287l1.372-1.372a3 3 0 1 0-4.243-4.243z" /></svg>
				<span><b>The blog</b><i>The whole page</i></span>
			</button>
			<button type="button" role="menuitem" onclick={() => share(true)}>
				<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8.39 12.648a1 1 0 0 0-.015.18c0 .305.21.508.5.508.266 0 .492-.172.555-.477l.554-2.703h1.204c.421 0 .617-.234.617-.547 0-.312-.188-.53-.617-.53h-.985l.516-2.524h1.265c.43 0 .618-.227.618-.547 0-.313-.188-.524-.618-.524h-1.046l.476-2.304a1 1 0 0 0 .016-.164.51.51 0 0 0-.516-.516.54.54 0 0 0-.539.43l-.523 2.554H7.617l.477-2.304c.008-.04.015-.118.015-.164a.51.51 0 0 0-.523-.516.54.54 0 0 0-.531.43L6.53 5.484H5.414c-.43 0-.617.22-.617.532s.187.539.617.539h.906l-.515 2.523H4.609c-.421 0-.609.219-.609.531s.188.547.61.547h.976l-.516 2.492c-.008.04-.015.125-.015.18 0 .305.21.508.5.508.265 0 .492-.172.554-.477l.555-2.703h2.242zm-1-6.109h2.266l-.515 2.563H6.859l.532-2.563z" /></svg>
				<span><b>This section</b><i>{name}</i></span>
			</button>
		</div>
	{/if}
	<p class="sh-said" aria-live="polite">{said}</p>
</div>

<style>
	.sh { position: relative; display: flex; flex-direction: column; align-items: center; gap: 6px; max-width: 72rem; margin: 28px auto 0; }
	.sh-main {
		display: inline-flex; align-items: center; gap: 7px; padding: 7px 13px; border: 1.25px solid var(--rule, #D3D3CB); border-radius: 2px;
		font-size: 13px; font-weight: 500; color: var(--ink2, #5A6270); background: rgba(243, 243, 239, .9); transition: border-color .15s, color .15s;
	}
	.sh:hover .sh-main, .sh-main:focus-visible, .sh-main[aria-expanded="true"] { border-color: var(--ink, #14202D); color: var(--ink, #14202D); }
	svg { width: 14px; height: 14px; fill: currentColor; flex: none; }
	.sh-menu {
		position: absolute; bottom: calc(100% - 2px); left: 50%; transform: translateX(-50%); z-index: 8; display: grid; gap: 2px; min-width: 230px;
		padding: 6px; padding-bottom: 6px; margin-bottom: 0; background: #fff; border-radius: 4px; box-shadow: 0 10px 30px rgba(20, 32, 45, .16);
		animation: sh-in .18s cubic-bezier(.16, 1, .3, 1) both;
	}
	/* (a bridge under the menu, so the pointer can travel from the button to it without closing it) */
	.sh-menu::after { content: ""; position: absolute; left: 0; right: 0; top: 100%; height: 10px; }
	.sh-menu button { display: flex; align-items: center; gap: 10px; width: 100%; padding: 8px 10px; border-radius: 3px; text-align: left; color: var(--ink, #14202D); }
	.sh-menu button:hover, .sh-menu button:focus-visible { background: var(--field, #F3F3EF); }
	.sh-menu span { display: grid; gap: 1px; }
	.sh-menu b { font-size: 13.5px; font-weight: 600; }
	.sh-menu i { font-style: normal; font-size: 12px; color: var(--ink2, #5A6270); }
	.sh-said { min-height: 1.2em; font-size: 12px; color: var(--ink2, #5A6270); overflow-wrap: anywhere; text-align: center; }
	@keyframes sh-in { from { opacity: 0; transform: translate(-50%, 4px); } }
	@media (prefers-reduced-motion: reduce) { .sh-menu { animation: none; } }
</style>
