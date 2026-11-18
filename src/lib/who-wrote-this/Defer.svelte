<script lang="ts" module>
	// Sections woken after the page's start-up rather than with it: one at a time, in page order, whenever the page has a
	// spare moment (and soon in any case), and at once when the reader comes within a few screens of one.
	type Waker = { wake: () => void; done: () => boolean };
	const queue: Waker[] = [];
	let pumping = false;
	const later = (fn: () => void) =>
		"requestIdleCallback" in window ? requestIdleCallback(fn, { timeout: 400 }) : setTimeout(fn, 60);
	function pump() {
		const next = queue.find((w) => !w.done());
		if (!next) { pumping = false; return; }
		dequeue(next); // (a section that fails to wake isn't tried again here, and doesn't hold up the rest)
		try { next.wake(); } finally { later(pump); } // one per task: each section's start-up stays a short task of its own
	}
	function enqueue(w: Waker) {
		queue.push(w);
		if (!pumping) { pumping = true; later(pump); }
	}
	function dequeue(w: Waker) {
		const i = queue.indexOf(w);
		if (i >= 0) queue.splice(i, 1);
	}
</script>

<script lang="ts">
	// A section of the paper page that hydrates on its own, after the page. The page's start-up hydrated all of its
	// 40,000 pixels in one go, a quarter of a second on a mid-range phone, with only the first screen to show for it. Here
	// a section arrives as the server rendered it (its HTML, its layout, its links all there from the first paint), the
	// page's own hydration passes over it, and it hydrates later (see above), in a short task of its own.
	//
	// The server's render of the section sits in an {@html} block, which hydration never looks inside: on the client the
	// same block holds just the empty wrapper, which a page reached by in-app navigation (nothing server-rendered) mounts
	// the section into at once instead. The wrappers take no space (display: contents).
	import { hydrate, mount, onMount, unmount, type Component } from "svelte";
	import { render } from "svelte/server";

	let { component }: { component: Component } = $props();

	const IN = `<div class="defer-in">`;
	// svelte-ignore state_referenced_locally
	const html = import.meta.env.SSR ? `${IN}${render(component).body}</div>` : `${IN}</div>`;
	let box: HTMLElement;

	onMount(() => {
		const target = box.querySelector<HTMLElement>(":scope > .defer-in");
		if (!target) return;
		let instance: Record<string, unknown> | null = null;
		const wake = () => {
			if (instance) return;
			io?.disconnect();
			dequeue(waker);
			// a failed hydration must not pass for a working page: loud in development, rebuilt in production
			instance = target.firstChild ? hydrate(component, { target, recover: !import.meta.env.DEV }) : mount(component, { target });
			// hydrating puts back what the server rendered, over any later edits to it (the footnote marks' numbers): say so,
			// in the same task, before anything paints
			document.dispatchEvent(new Event("wwt:woke"));
		};
		const waker: Waker = { wake, done: () => !!instance };
		let io: IntersectionObserver | null = null;
		if (!target.firstChild) wake(); // in-app navigation: nothing to hydrate, so it mounts with the page
		else {
			// its first element: the wrappers have no box of their own to observe
			const first = target.firstElementChild;
			if (first) {
				io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) wake(); }, { rootMargin: "300% 0px" });
				io.observe(first);
			}
			enqueue(waker);
		}
		return () => {
			io?.disconnect();
			dequeue(waker);
			if (instance) unmount(instance);
		};
	});
</script>

<div class="defer" bind:this={box}><!-- svelte-ignore hydration_html_changed -->{@html html}</div>

<style>
	.defer, .defer > :global(.defer-in) { display: contents; }
</style>
