<script lang="ts" module>
	export type { Note } from "./fnstore.svelte";
</script>

<script lang="ts">
	// A section's footnotes. They are listed once, at the bottom of the page (FootnoteList.svelte), numbered in reading
	// order, with a preview when the reader points at a mark. In the section, mark the spot with
	//   <sup class="fnref"><a href="#fn-{id}-{n}" id="fnref-{id}-{n}">{n}</a></sup>
	// and register the notes here: <Footnotes id="s3" notes={[{ n: 1, t: "…", href: "…" }]} />
	import { onMount } from "svelte";
	import { register, type Note } from "./fnstore.svelte";

	let { id, notes }: { id: string; notes: Note[] } = $props();
	onMount(() => register(id, notes));
</script>
