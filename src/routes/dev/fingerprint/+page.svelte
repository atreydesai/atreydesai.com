<script lang="ts">
	// Prototype: the fingerprint motif in the launch page's hero. Ridge text is the paper's own sentences.
	import Fingerprint from "#lib/who-wrote-this/Fingerprint.svelte";
	import C from "#lib/who-wrote-this/content.json";

	// Only section 1 carries the worked example; the rest are still pending.
	const first = C.sections[0];
	const example = first && "example" in first ? first.example : null;
	const words = [
		C.meta.deck.t, ...C.lede.map((s) => s.t), C.levels.lead.t, ...C.levels.items.map((i) => `${i.t}. ${i.fact}`),
		example?.text.map((s) => s.t).join("") ?? "",
		...(example?.judgments ?? []).map((j) => j.explanation.map((s) => s.t).join("")),
		C.closing.t,
	].join("   ");
</script>

<svelte:head>
	<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" />
	{@html `<style>html body{background-color:#E8E8E3;background-image:radial-gradient(rgba(20,32,45,.07) 1px,transparent 1.2px);background-size:18px 18px}</style>`}
</svelte:head>

<div class="wrap" data-justify="off">
	<div class="copy">
		<h1>{C.meta.title.t}</h1>
		<p class="deck">{C.meta.deck.t}</p>
		<ol>
			{#each C.levels.items as it}<li data-rq={it.rq}><span>{it.n}</span>{it.t}</li>{/each}
		</ol>
		<p class="hint">Move over the fingerprint: its ridges are the paper's sentences.</p>
	</div>
	<Fingerprint text={words} width={560} height={700} />
</div>

<style>
	.wrap { max-width: 72rem; margin: 40px auto; padding: 0 16px; display: grid; grid-template-columns: minmax(0, 1fr) 560px; gap: 40px; align-items: center; font-family: Inter, system-ui, sans-serif; color: #14202D; }
	h1 { font-size: 56px; line-height: 1; letter-spacing: -0.035em; font-weight: 600; margin: 0; font-family: inherit; }
	.deck { font-size: 21px; font-weight: 500; margin-top: 14px; font-family: inherit; }
	ol { list-style: none; padding: 0; margin: 28px 0 0; display: grid; gap: 10px; }
	li { display: flex; align-items: center; gap: 12px; font-size: 21px; font-weight: 600; letter-spacing: -0.02em; font-family: inherit; }
	li span { display: inline-grid; place-items: center; width: 32px; height: 32px; border-radius: 2px; color: #fff; background: #C85A82; font-size: 15px; }
	li[data-rq="2"] span { background: #461E47; } li[data-rq="3"] span { background: #437E8E; }
	.hint { margin-top: 22px; font-size: 13px; color: #5A6270; font-family: inherit; }
	@media (max-width: 900px) { .wrap { grid-template-columns: 1fr; } }
</style>
