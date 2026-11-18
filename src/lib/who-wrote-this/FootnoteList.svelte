<script lang="ts">
	// All of the page's footnotes, at its bottom. Marks are renumbered 1, 2, 3 … in reading order, and pointing at (or
	// focusing) a mark shows the note in a small preview beside it, so nobody has to jump to the bottom to read one.
	import { onMount } from "svelte";
	import { notes } from "./fnstore.svelte";

	type Item = { g: number; key: string; t: string; href?: string };
	let items = $state<Item[]>([]);
	let tip = $state<{ x: number; y: number; w: number; up: boolean; t: string; href?: string } | null>(null);
	// the list is folded away until opened (Atrey, 18 Nov); a click on a mark, or a link to a note, opens it first
	let box = $state<HTMLDetailsElement | null>(null);

	const keyOf = (a: HTMLAnchorElement) => /#fn-(.+)$/.exec(a.getAttribute("data-key") ?? a.getAttribute("href") ?? "")?.[1] ?? "";

	function renumber() {
		const marks = [...document.querySelectorAll<HTMLAnchorElement>(".wwt sup.fnref a")];
		const order: string[] = [];
		for (const a of marks) {
			if (!a.dataset.key) a.dataset.key = a.getAttribute("href") ?? "";
			const k = keyOf(a);
			if (!notes.map[k]) continue;
			if (!order.includes(k)) order.push(k);
			const g = order.indexOf(k) + 1;
			if (a.textContent !== String(g)) a.textContent = String(g);
			a.setAttribute("href", `#fn-${g}`);
			if (!a.id || a.id.startsWith("fnref-")) a.id = `fnref-${g}`;
			a.setAttribute("aria-describedby", `fn-${g}`);
		}
		const next = order.map((k, i) => ({ g: i + 1, key: k, t: notes.map[k].t, href: notes.map[k].href }));
		if (JSON.stringify(next) !== JSON.stringify(items)) items = next;
	}

	onMount(() => {
		let t: ReturnType<typeof setTimeout> | undefined;
		const later = () => { clearTimeout(t); t = setTimeout(renumber, 120); };
		const mo = new MutationObserver(later);
		mo.observe(document.querySelector(".wwt") ?? document.body, { childList: true, subtree: true });
		$effect.root(() => { $effect(() => { void notes.map; later(); }); });
		const show = (e: Event) => {
			const a = (e.target as HTMLElement)?.closest?.(".wwt sup.fnref a") as HTMLAnchorElement | null;
			if (!a) return;
			const it = items.find((i) => `#fn-${i.g}` === a.getAttribute("href"));
			if (!it) return;
			const r = a.getBoundingClientRect(), w = Math.min(320, innerWidth - 32), up = r.bottom > innerHeight * 0.62;
			const x = Math.max(16 + w / 2, Math.min(innerWidth - 16 - w / 2, r.left + r.width / 2));
			tip = { x, y: up ? r.top - 8 : r.bottom + 8, w, up, t: it.t, href: it.href };
		};
		const hide = (e: Event) => { if ((e.target as HTMLElement)?.closest?.(".wwt sup.fnref a")) tip = null; };
		// (capture phase, so the list is open before the link's jump looks for the note)
		const unfold = (e: Event) => { if (box && !box.open && (e.target as HTMLElement)?.closest?.(".wwt sup.fnref a")) box.open = true; };
		const fromHash = () => { if (box && !box.open && /^#fn-\d+$/.test(location.hash)) { box.open = true; document.getElementById(location.hash.slice(1))?.scrollIntoView(); } };
		document.addEventListener("click", unfold, true);
		addEventListener("hashchange", fromHash);
		setTimeout(fromHash, 400);
		// a section that wakes after the page (Defer.svelte) has just put its marks back as the server wrote them
		document.addEventListener("wwt:woke", renumber);
		document.addEventListener("pointerover", show);
		document.addEventListener("focusin", show);
		document.addEventListener("pointerout", hide);
		document.addEventListener("focusout", hide);
		addEventListener("scroll", () => (tip = null), { passive: true });
		renumber();
		return () => { mo.disconnect(); clearTimeout(t); document.removeEventListener("wwt:woke", renumber); document.removeEventListener("pointerover", show); document.removeEventListener("focusin", show); document.removeEventListener("pointerout", hide); document.removeEventListener("focusout", hide); document.removeEventListener("click", unfold, true); removeEventListener("hashchange", fromHash); };
	});
	const host = (h: string) => { try { return new URL(h).hostname.replace(/^www\./, ""); } catch { return h; } };
</script>

{#if items.length}
	<details class="fns fold" bind:this={box}>
		<summary>Notes</summary>
		<ol class="fold-body">
			{#each items as f (f.key)}
				<li id="fn-{f.g}">
					<span class="n">{f.g}</span>
					<span class="t">{f.t}{#if f.href}{" "}<a href={f.href} target="_blank" rel="noopener">{host(f.href)}</a>{/if}</span>
					<a class="back" href="#fnref-{f.g}" aria-label="Back to the text">↩</a>
				</li>
			{/each}
		</ol>
	</details>
{/if}
{#if tip}
	<div class="fn-tip" class:up={tip.up} style:left="{tip.x}px" style:top="{tip.y}px" style:width="{tip.w}px" role="tooltip">
		<span class="tt">{tip.t}</span>{#if tip.href}<span class="h">{host(tip.href)}</span>{/if}
	</div>
{/if}

<style>
	/* a folded row like the acknowledgements and cite below it (their shared look is in +page.svelte), close under the buttons */
	.fns { margin-top: 28px; }
	ol { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
	li { display: grid; grid-template-columns: 1.6em minmax(0, 1fr) auto; gap: 6px; font-size: 13px; line-height: 1.55; color: #5A6270; }
	.n { font-variant-numeric: tabular-nums; font-weight: 600; color: #14202D; }
	a { color: #14202D; }
	.back { text-decoration: none; }
	.fn-tip {
		position: fixed; z-index: 30; display: grid; gap: 4px; transform: translateX(-50%); padding: 10px 12px; border-radius: 4px;
		background: #14202D; color: #F3F3EF; font-size: 13px; line-height: 1.5; box-shadow: 0 10px 28px rgba(20, 32, 45, .25); pointer-events: none;
	}
	.fn-tip.up { transform: translate(-50%, -100%); }
	.fn-tip .tt { display: -webkit-box; -webkit-line-clamp: 9; line-clamp: 9; -webkit-box-orient: vertical; overflow: hidden; }
	.fn-tip .h { color: rgba(243, 243, 239, .6); }
	:global(.wwt sup.fnref) { font-size: .7em; margin-left: 1px; }
	:global(.wwt sup.fnref a) { color: inherit; text-decoration: none; font-weight: 600; padding: 0 1px; border-radius: 2px; }
	:global(.wwt sup.fnref a:hover), :global(.wwt sup.fnref a:focus-visible) { background: rgba(126, 34, 62, .14); }
</style>
