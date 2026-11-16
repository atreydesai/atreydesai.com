<script lang="ts">
	// All of the page's footnotes, at its bottom. Marks are renumbered 1, 2, 3 … in reading order, and pointing at (or
	// focusing) a mark shows the note in a small preview beside it, so nobody has to jump to the bottom to read one.
	import { onMount } from "svelte";
	import { notes } from "./fnstore.svelte";

	type Item = { g: number; key: string; t: string; href?: string };
	let items = $state<Item[]>([]);
	let tip = $state<{ x: number; y: number; t: string; href?: string; flip: boolean } | null>(null);

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
			const r = a.getBoundingClientRect();
			tip = { x: r.left + r.width / 2, y: r.bottom + 8, t: it.t, href: it.href, flip: r.left > innerWidth - 340 };
		};
		const hide = (e: Event) => { if ((e.target as HTMLElement)?.closest?.(".wwt sup.fnref a")) tip = null; };
		document.addEventListener("pointerover", show);
		document.addEventListener("focusin", show);
		document.addEventListener("pointerout", hide);
		document.addEventListener("focusout", hide);
		addEventListener("scroll", () => (tip = null), { passive: true });
		renumber();
		return () => { mo.disconnect(); clearTimeout(t); document.removeEventListener("pointerover", show); document.removeEventListener("focusin", show); document.removeEventListener("pointerout", hide); document.removeEventListener("focusout", hide); };
	});
	const host = (h: string) => { try { return new URL(h).hostname.replace(/^www\./, ""); } catch { return h; } };
</script>

{#if items.length}
	<section class="fns" aria-label="Notes">
		<h2>Notes</h2>
		<ol>
			{#each items as f (f.key)}
				<li id="fn-{f.g}">
					<span class="n">{f.g}</span>
					<span class="t">{f.t}{#if f.href}{" "}<a href={f.href} target="_blank" rel="noopener">{host(f.href)}</a>{/if}</span>
					<a class="back" href="#fnref-{f.g}" aria-label="Back to the text">↩</a>
				</li>
			{/each}
		</ol>
	</section>
{/if}
{#if tip}
	<div class="fn-tip" class:flip={tip.flip} style:left="{tip.x}px" style:top="{tip.y}px" role="tooltip">
		{tip.t}{#if tip.href}{" "}<span class="h">{host(tip.href)}</span>{/if}
	</div>
{/if}

<style>
	.fns { max-width: 46rem; margin: 10vh 0 0; padding-top: 18px; border-top: 1px solid #C9C9C9; }
	h2 { font-size: 13px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: #5A6270; margin: 0 0 12px; }
	ol { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
	li { display: grid; grid-template-columns: 1.6em minmax(0, 1fr) auto; gap: 6px; font-size: 13px; line-height: 1.55; color: #5A6270; }
	.n { font-variant-numeric: tabular-nums; font-weight: 600; color: #14202D; }
	a { color: #14202D; }
	.back { text-decoration: none; }
	.fn-tip {
		position: fixed; z-index: 30; max-width: 320px; transform: translateX(-50%); padding: 10px 12px; border-radius: 4px;
		background: #14202D; color: #F3F3EF; font-size: 13px; line-height: 1.5; box-shadow: 0 10px 28px rgba(20, 32, 45, .25); pointer-events: none;
	}
	.fn-tip.flip { transform: translateX(calc(-100% + 16px)); }
	.fn-tip .h { color: rgba(243, 243, 239, .6); }
	:global(.wwt sup.fnref) { font-size: .7em; margin-left: 1px; }
	:global(.wwt sup.fnref a) { color: inherit; text-decoration: none; font-weight: 600; padding: 0 1px; border-radius: 2px; }
	:global(.wwt sup.fnref a:hover), :global(.wwt sup.fnref a:focus-visible) { background: rgba(126, 34, 62, .14); }
</style>
