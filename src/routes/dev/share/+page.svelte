<script lang="ts">
  // Every game's share card and text, drawn from sample runs, plus the edge
  // cases: a run that scored nothing and a very long one. Dev only.
  import { onMount } from "svelte";
  import { renderShareCard } from "$lib/arcade/share-card";
  import { shareText, type ShareInput } from "$lib/arcade/share";

  const SAMPLES: ShareInput[] = [
    {
      gameId: "catch", game: "boba catch", expert: false, score: 1240, unit: "points", newBest: true,
      stats: [{ label: "time on shift", value: "3:19" }, { label: "cups caught", value: 141 }, { label: "perfect catches", value: 38 }, { label: "golden cups", value: 6 }, { label: "personal best", value: 1240 }],
      lines: ["🧋🌟🌟💥🌟🌟🧋⚫🌟🧋", "💥🌟💥💥"],
    },
    {
      gameId: "stab", game: "straw stab", expert: true, score: 869, unit: "points", newBest: false,
      stats: [{ label: "cups strawed", value: 212 }, { label: "perfect stabs", value: 120 }, { label: "best combo", value: "×41" }, { label: "personal best", value: 912 }],
      lines: ["🟩🟩🟩🟩🟩🟩", "🟨🟩🟧🟩🟨🟨🟩🟩", "🟩🟩🟥🟩🟧🟧🟩🟩", "🟥🟩"],
    },
    {
      gameId: "orders", game: "order up", expert: false, score: 248, unit: "points", newBest: false,
      stats: [{ label: "drinks served", value: 13 }, { label: "average grade", value: 86 }, { label: "longest streak", value: 6 }, { label: "tip jars filled", value: 2 }, { label: "personal best", value: 301 }],
      lines: ["🤩🙂🤩😮😐🤩😤🙂🤩🤩", "🙂😒🤩", "🫙🫙"],
    },
    {
      gameId: "stack", game: "cup stack", expert: false, score: 38, unit: "cups", newBest: true,
      stats: [{ label: "cups stacked", value: 38 }, { label: "perfect drops", value: 12 }, { label: "best streak", value: "×5" }, { label: "personal best", value: 38 }],
      lines: ["🟧🟧🟨🟧🟥🟧🟧🟧🟨🟧", "🟧🟨🟧🟧🟧🟧🟨🟧🟧🟧"],
    },
    {
      gameId: "lander", game: "tea minus", expert: true, score: 12262, unit: "points", newBest: false,
      stats: [{ label: "landings", value: 7 }, { label: "furthest site", value: 9 }, { label: "best landing", value: 2400 }, { label: "feather landings", value: 2 }, { label: "personal best", value: 13000 }],
      lines: ["🌕 2️⃣💥5️⃣3️⃣💥2️⃣5️⃣", "3️⃣💥", "🪶🪶"],
    },
    {
      gameId: "runner", game: "sugar rush", expert: false, score: 4310, unit: "points", newBest: false,
      stats: [{ label: "deliveries", value: 14 }, { label: "full cups", value: 9 }, { label: "best streak", value: 6 }, { label: "distance", value: "1,234 m" }, { label: "personal best", value: 5100 }],
      lines: ["🏃 1,234 m", "🧋🥤▫️🧋🧋🧋🧋🧋🧋🧋", "📦🕳️ then ⚡ a live wire"],
    },
    {
      gameId: "spill", game: "spill", expert: false, score: 13940, unit: "points", newBest: true,
      stats: [{ label: "rooms cleared", value: 48 }, { label: "stars", value: "131 of 144" }, { label: "three-star rooms", value: 39 }, { label: "tea spilled", value: "12%" }, { label: "personal best", value: 13940 }],
      lines: ["🟩🟩🟨 🟩🟩🟩 🟨🟩🟩 🟩🟧🟩", "🟩🟩🟩 🟩🟩🟨 🟩🟩🟩 🟩🟩🟩", "🟩🟨🟩 🟩🟩🟩 🟩🟩🟩 🟨🟩🟩", "🟩🟩🟩 🟩🟩🟩 🟩🟩🟩 🟩🟩🟩"],
    },
    {
      gameId: "stack", game: "cup stack", expert: true, score: 0, unit: "cups", newBest: false,
      stats: [{ label: "cups stacked", value: 0 }, { label: "perfect drops", value: 0 }, { label: "best streak", value: "×0" }, { label: "personal best", value: 0 }],
      lines: [],
    },
  ];

  let cards: { id: string; url: string; text: string }[] = [];

  onMount(async () => {
    for (const [index, sample] of SAMPLES.entries()) {
      const blob = await renderShareCard(sample);
      cards = [...cards, { id: `${sample.gameId}-${index}`, url: URL.createObjectURL(blob), text: shareText(sample) }];
    }
  });
</script>

<svelte:head>
  <meta name="robots" content="noindex" />
</svelte:head>

<div class="share-qa">
  {#each cards as card (card.id)}
    <figure data-card={card.id}>
      <img src={card.url} alt="" width="600" height="315" />
      <pre>{card.text}</pre>
    </figure>
  {/each}
</div>

<style>
  .share-qa {
    display: grid;
    gap: 2rem;
    padding: 2rem;
  }

  figure {
    display: grid;
    grid-template-columns: 600px 1fr;
    gap: 1.5rem;
    align-items: start;
    margin: 0;
  }

  pre {
    margin: 0;
    font-size: 0.8125rem;
    line-height: 1.45;
    white-space: pre-wrap;
  }
</style>
