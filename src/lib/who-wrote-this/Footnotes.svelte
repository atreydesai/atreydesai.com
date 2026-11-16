<script lang="ts" module>
	export type Note = { n: number; t: string; src?: string; href?: string };
</script>

<script lang="ts">
	// A section's footnotes, at its end: small print for whatever the picture should not carry (an illustrative
	// example's provenance, a definition, a source link). Mark the spot in the section with
	//   <sup class="fnref"><a href="#fn-{id}-{n}" id="fnref-{id}-{n}">{n}</a></sup>
	let { id, notes }: { id: string; notes: Note[] } = $props();
</script>

{#if notes.length}
	<aside class="fns" aria-label="Notes">
		<ol>
			{#each notes as f}
				<li id="fn-{id}-{f.n}" value={f.n}>
					{f.t}{#if f.href}{" "}<a href={f.href} target="_blank" rel="noopener">{new URL(f.href).hostname.replace(/^www\./, "")}</a>{/if}
					<a class="back" href="#fnref-{id}-{f.n}" aria-label="Back to the text">↩</a>
				</li>
			{/each}
		</ol>
	</aside>
{/if}

<style>
	.fns { max-width: 72rem; margin: 6vh auto 0; padding-top: 14px; border-top: 1px solid #C9C9C9; }
	ol { margin: 0; padding-left: 1.4em; list-style: decimal outside !important; display: grid; gap: 6px; font-size: 12.5px; line-height: 1.5; color: #5A6270; }
	li { display: list-item; }
	li::marker { font-variant-numeric: tabular-nums; color: #14202D; }
	a { color: #14202D; }
	.back { margin-left: 4px; text-decoration: none; }
	:global(.wwt sup.fnref) { font-size: .7em; margin-left: 1px; }
	:global(.wwt sup.fnref a) { color: inherit; text-decoration: none; font-weight: 600; }
</style>
