<script lang="ts">
  interface Props {
    kind: string;
    size?: number;
    lit?: boolean;
  }

  let { kind, size = 27, lit = false }: Props = $props();

  const ink = "#4a322d";
  const cream = "#f8dfaa";
  const brass = "#d6a367";
  const iron = "#8c9a7f";
  const rose = "#b76058";

  const kettleColors: Record<string, readonly [string, string, string]> = {
    black: ["#bb694b", "#8f4a3b", "#e39662"],
    jasmine: ["#879465", "#5d694e", "#b7bc79"],
    taro: ["#a47c8f", "#735465", "#ce9fa9"],
    brew: ["#879383", "#596a60", "#b8bda0"],
    kettle: ["#879383", "#596a60", "#b8bda0"],
  };
  const jarColors: Record<string, readonly [string, string, string]> = {
    pearls: ["#9c6e52", "#714d45", "#513635"],
    popping: ["#d69856", "#a96348", "#f7c37e"],
    pudding: ["#edbd71", "#ac7a46", "#fce0a0"],
    "grass-jelly": ["#6c625e", "#45454c", "#36383d"],
  };
  const pumpColors: Record<string, readonly [string, string]> = {
    "brown-sugar": ["#9e603e", "#723f35"],
    honey: ["#dd9d43", "#a86b38"],
    vanilla: ["#e7c48b", "#ac8057"],
    "sesame-syrup": ["#545155", "#38373b"],
  };
  const kettle = $derived(Object.hasOwn(kettleColors, kind) ? kettleColors[kind] : null);
  const jar = $derived(Object.hasOwn(jarColors, kind) ? jarColors[kind] : null);
  const pump = $derived(Object.hasOwn(pumpColors, kind) ? pumpColors[kind] : null);
</script>

<svg class="kitchen-item" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false" shape-rendering="crispEdges">
  {#if kettle}
    <path d="M10 3h5v2h2v2h1v5h2v-2h3v3h-1v2h-2v2h-2v3h-2v1H7v-1H5v-3H3v-1H1v-6h1V9h4V7h1V5h3zm-7 8v4h2v-4z" fill={ink} />
    <path d="M7 7h9v2H7zm4-3h3v1h-3z" fill={cream} />
    <path d="M8 9h8v2h1v8h-2v1H8v-1H6v-7h1v-2h1z" fill={kettle[0]} />
    <path d="M15 10h1v1h1v8h-2v1h-5v-1h4v-2h1zm3 4h2v-2h2v1h-1v1h-1v1h-1v1h-1z" fill={kettle[1]} />
    <path d="M8 11h3v1H9v3H8zm1 7h3v1H9z" fill={kettle[2]} />
    <path d="M11 12h3v1h1v3h-1v1h-3v-1h-1v-3h1z" fill={ink} />
    <path d="M11 13h3v3h-3z" fill={cream} />
    <path d="M12 14h1v1h1v1h-2z" fill={lit ? "#e77e53" : kettle[1]} />
  {:else if kind === "milk" || kind === "oat"}
    {@const dairy = kind === "milk"}
    <path d="M8 2h7v2h2v2h1v13h-2v2H7v-1H5V6h1V4h2z" fill={ink} />
    <path d="M8 3h6v2H8zm0 3h7v2H6V7h2z" fill={cream} />
    <path d="M6 8h8v12H7v-1H6z" fill={dairy ? "#f0d9ab" : "#e8b676"} />
    <path d="M14 8h2V7h1v11h-1v1h-2z" fill={dairy ? "#a4a589" : "#ae8455"} />
    <path d="M7 10h6v7H7z" fill={dairy ? "#738d7e" : "#a16a48"} />
    {#if dairy}
      <path d="M9 12h2v2h1v2H8v-2h1z" fill="#fff0cb" />
    {:else}
      <path d="M11 11h1v2h-1v2h-1v1H8v-1h1v-2H8v-1h2v1h1z" fill={cream} />
    {/if}
    <path d="M7 8h1v2H7zm0 10h5v1H7z" fill="#fff0c0" />
  {:else if kind === "plain" || kind === "no-milk"}
    <path d="M5 6h14v3h-1v9h-1v2h-2v1H9v-1H7v-2H6V9H5z" fill={ink} />
    <path d="M6 7h12v1H6zm2 2h8v2h-1v6h-1v2h-4v-1h-1v-4H8z" fill="#d1b492" />
    <path d="M8 9h1v5H8zm2 9h3v1h-3z" fill={cream} />
    <path d="M7 16h2v-2h2v-2h2v-2h2V8h2v2h-1v2h-2v2h-2v2h-2v2H8v2H6v-2h1z" fill={rose} />
  {:else if jar}
    <path d="M6 3h11v1h2v4h-1v2h1v2h1v7h-1v2h-2v1H7v-1H5v-2H4v-7h1v-2h1V8H5V4h1z" fill={ink} />
    <path d="M6 5h12v2H6z" fill={brass} />
    <path d="M7 5h8v1H7zm0 4h10v2H7z" fill={cream} />
    <path d="M6 11h12v2h1v6h-2v2H7v-1H5v-7h1z" fill={jar[0]} />
    <path d="M16 12h2v1h1v6h-2v2H8v-1h7v-1h1z" fill={jar[1]} />
    <path d="M7 12h2v1H8v4H7zm0 6h1v1H7z" fill="#f8d6a3" />
    {#if kind === "pudding"}
      <path d="M10 12h4v3h-4zm4 4h3v2h-3zm-5 1h3v2H9z" fill={jar[2]} />
    {:else if kind === "grass-jelly"}
      <path d="M9 13l4-2 4 2v5l-4 2-4-2z" fill={jar[2]} />
      <path d="M10 13l3-1 3 1-3 2z" fill="#92918b" />
    {:else}
      <path d="M10 13h2v2h-2zm4 0h2v2h-2zm-5 4h2v2H9zm4-1h2v2h-2zm3 2h2v2h-2z" fill={jar[2]} />
    {/if}
  {:else if kind === "strawberry"}
    <path d="M11 2h3v2h2v1h2v2h2v2h1v6h-2v2h-2v2h-2v2h-4v-1H8v-2H6v-2H4v-2H3V9h2V7h2V5h3V4h1z" fill={ink} />
    <path d="M5 9h2V8h10v1h2v6h-2v2h-2v2h-2v1h-2v-1H9v-2H7v-2H5z" fill="#c86661" />
    <path d="M18 10h1v5h-2v2h-2v2h-2v1h-2v-1H9v-1h4v-2h2v-2h2v-2h1z" fill="#94474a" />
    <path d="M11 4h2v2h4v2h-4v2h-2V8H7V7h3V6h1z" fill="#91a16d" />
    <path d="M6 10h2v2H6zm7 1h1v2h-1zm3 1h1v1h-1zm-7 2h1v1H9zm2 2h1v1h-1z" fill="#f5b680" />
  {:else if kind === "mango"}
    <path d="M13 3h6v2h2v7h-1v4h-2v3h-3v2H7v-1H4v-3H3v-5h2V8h3V6h5z" fill={ink} />
    <path d="M13 5h6v2h1v4h-1v4h-2v3h-3v2H7v-2H5v-5h2V9h3V7h3z" fill="#ecad4e" />
    <path d="M16 6h3v6h-1v4h-2v3h-5v-2h3v-3h2z" fill="#c37b49" />
    <path d="M10 9h4v2h-3v3H8v-2h2z" fill="#ffda85" />
    <path d="M17 2h4v1h2v3h-5V5h-2V3h1z" fill="#718457" />
  {:else if kind === "yuzu"}
    <path d="M4 2h7v1h3v2h2V4h2v3h2v2h2v3h1v4h-1v3h-2v2h-4v1H8v-1H5v-2H3v-3H1v-3h2v-3h2V8h3V6H6V5H4z" fill={ink} />
    <path d="M6 3h5v1h2v2h2v1h-4V6H8V5H6z" fill="#849761" />
    <path d="M7 4h4v1h2v1h-3V5H7z" fill="#b8ba76" />
    <path d="M9 8h8v1h3v2h1v2h1v3h-2v3h-4v2H8v-1H5v-2H4v-3H2v-1h2v-3h2V9h3z" fill="#edc052" />
    <path d="M18 10h2v2h1v1h1v3h-2v3h-4v2H8v-1H6v-2h7v-1h3v-2h2z" fill="#c58c46" />
    <path d="M7 10h5v2H8v2H6v-2h1zm-2 5h2v2H5zm7-1h2v2h-2z" fill="#fce28b" />
    <path d="M15 11h2v1h-2zm-6 5h2v2H9zm8 1h2v1h-2z" fill="#c7913d" />
  {:else if kind === "banana"}
    <path d="M17 3h4v2h1v7h-1v3h-2v2h-2v2h-3v1H6v-1H3v-2H1v-4h2v-2h4v1h4v-1h2V9h2V7h1V4h1z" fill={ink} />
    <path d="M18 5h2v2h1v5h-1v3h-2v2h-2v1h-3v1H7v-1H4v-2H2v-2h2v-2h2v1h6v-1h2v-2h2V8h1V6h1z" fill="#e3ad53" />
    <path d="M18 8h2v4h-1v2h-2v2h-3v1H6v-1H4v-1h2v-1h6v-1h3v-2h2v-2h1z" fill="#f4d782" />
    <path d="M3 14h2v2H3zm15-9h2v2h-2z" fill="#7c6e4e" />
    <path d="M7 14h5v1H7zm6-1h2v1h-2zm4-2h1v1h-1z" fill="#fff0b6" />
  {:else if pump}
    {@const sesame = kind === "sesame-syrup"}
    <path d="M10 2h10v2h1v3h-3V6h-4v3h2v2h2v2h1v7h-1v2H7v-1H5v-9h1v-1h2V9h2V6H8V4h2z" fill={ink} />
    <path d="M10 4h9v1h-6v4h-2V5h-1zm-1 6h6v1H9z" fill={brass} />
    <path d="M7 12h10v2h1v6h-1v1H7v-1H6v-6h1z" fill={cream} />
    <path d={sesame ? "M7 14h10v6H7z" : "M7 15h10v5H7z"} fill={pump[0]} />
    <path d="M15 13h2v7h-2z" fill={pump[1]} />
    {#if sesame}
      <path d="M7 13h1v4H7zm2 2h2v2H9zm3 2h2v2h-2z" fill="#f8d39a" />
    {:else}
      <path d="M7 13h1v5H7zm2 3h4v2H9z" fill="#f8d39a" />
    {/if}
  {:else if kind === "ice"}
    <path d="M9 3h6v1h3v1h3v1h2v11h-2v2h-3v1h-2v1H8v-1H6v-1H3v-2H1V7h2V6h3V5h3z" fill={ink} />
    <path d="M9 5h6v1h3v1h3v1h-3v1h-3v1H9V9H6V8H3V7h3V6h3z" fill="#c8dfcd" />
    <path d="M3 9h3v1h3v1h2v8H8v-1H6v-1H4v-1H2v-5h1z" fill="#a9c6bb" />
    <path d="M20 9h2v7h-2v2h-3v1h-5v-8h3v-1h3V9z" fill="#749d96" />
    <path d="M8 6h5v1H8zm-3 5h2v1H5zm1 2h2v1H6zm2 2h1v2H8zm6-3h3v1h-3z" fill="#e5eac4" />
  {:else if kind === "seltzer"}
    <path d="M8 2h7v2h4v1h2v1h2v4h-4V8h-2V7h-2v2h2v2h1v9h-2v2H7v-1H5v-2H4v-8h1V9h2V7H6V4h2z" fill={ink} />
    <path d="M9 3h5v2h4v1h2v1h2v2h-2V7h-2V6h-4v1H8V5h1z" fill={brass} />
    <path d="M9 4h4v1H9zm6 1h3v1h-3z" fill={cream} />
    <path d="M8 8h6v2h2v2h1v7h-2v2H8v-1H6v-2H5v-6h1v-2h2z" fill="#a7d2c5" />
    <path d="M13 9h1v1h2v2h1v7h-2v2H8v-1h5v-2h2v-5h-1v-2h-1z" fill="#5d918c" />
    <path d="M8 10h3v1H8v2H7v4H6v-5h1v-1h1zm0 8h2v1H8zm3-6h2v2h-2zm-2 3h2v2H9zm4 1h1v2h-1z" fill="#e4f4d8" />
    <path d="M20 11h2v3h-2v-1h-1v-1h1z" fill="#81b1a5" />
  {:else if kind === "waffle" || kind === "prep-waffles"}
    <path d="M6 4h12v2h3v3h1v8h-2v3h-3v2H7v-2H4v-3H2V9h1V6h3z" fill={ink} />
    <path d="M6 6h12v2h2v9h-2v3H6v-2H4V9h2z" fill="#cd8851" />
    <path d="M6 6h12v2h2v7h-2v3H6v-2H4V9h2z" fill={lit ? "#ffd68e" : "#efb773"} />
    <path d="M7 8h3v3H7zm5 0h3v3h-3zm5 1h2v2h-2zM7 13h3v3H7zm5 0h3v3h-3zm5 0h2v3h-2z" fill="#9f5c3c" />
    <path d="M9 6h2v1H9zm6 6h2v1h-2zm-4 5h2v1h-2z" fill="#ffdea5" />
  {:else if kind === "bun" || kind === "prep-buns"}
    <path d="M9 5h7v1h3v2h2v2h1v3h1v5h-2v2h-4v1H7v-1H3v-2H1v-4h1v-3h2V9h2V7h3z" fill={ink} />
    <path d="M9 7h7v1h3v2h2v4h1v3h-2v2h-4v1H7v-1H4v-1H2v-4h1v-3h2V9h2V8h2z" fill="#edbb73" />
    <path d="M3 15h3v1h12v-1h3v-1h1v3h-2v2h-4v1H7v-1H4v-1H2v-2h1z" fill="#bd804d" />
    <path d="M6 10h2V9h3V8h4v1h2v1h2v2h1v1h-3v-2h-2V9h-2v2h1v3h-2v-3h-2v2H8v1H5v-1h1z" fill="#ffe4a0" />
    <path d="M9 12h1v2H9zm6 0h1v2h-1zm-8 2h1v1H7zm11 0h1v1h-1z" fill="#ac7049" />
  {:else if kind === "prep" || kind === "prep-pearls"}
    <path d="M7 5h10v2h3v2h2v3h1v4h-3v4h-2v2H6v-2H4v-4H1v-4h2V9h2V7h2z" fill={ink} />
    <path d="M7 8h10v1h2v2H5V9h2zm2-2h6v1H9z" fill={cream} />
    <path d="M5 12h14v7h-2v2H7v-2H5z" fill={iron} />
    <path d="M16 12h3v7h-2v2h-6v-2h5z" fill="#54675a" />
    <path d="M3 13h1v2H3zm17 0h2v2h-2zM7 13h1v5H7zm2 0h4v1H9z" fill={brass} />
    <path d="M10 16h4v2h-4z" fill={lit ? "#ffd185" : "#b57558"} />
  {:else if kind === "shake" || kind === "shaker"}
    <path d="M12 2h6v2h2v3h2v4h-2v3h-2v3h-2v3h-2v2H7v-2H4v-2H3v-4h2v-3h2V8h2V5h3z" fill={ink} />
    <path d="M13 3h4v2h2v2h-2V6h-4z" fill={cream} />
    <path d="M11 6h3v1h4v1h2v2h-3v-1h-4V8h-3V7h1z" fill={brass} />
    <path d="M9 9h3v1h4v1h3v2h-2v3h-2v3h-2v2H8v-2H5v-2H4v-2h2v-3h2v-2h1z" fill={iron} />
    <path d="M15 11h4v2h-2v3h-2v3h-2v2h-3v-2h2v-3h2v-2h1z" fill="#586d60" />
    <path d="M9 11h2v2H9v3H8v2H6v-3h2v-3h1zM2 9h3v1H2zm-1 2h3v1H1zm17 8h4v1h-4zm-2 2h3v1h-3z" fill={cream} />
  {:else if kind === "seal" || kind === "sealer"}
    <path d="M8 2h8v2h4v2h2v6h-3v6h2v4H3v-4h2v-6H2V6h2V4h4z" fill={ink} />
    <path d="M5 5h14v2H5zm4-2h6v1H9z" fill={brass} />
    <path d="M3 7h18v4H3z" fill={rose} />
    <path d="M4 7h13v1H4zM6 12h2v6H6zm10 0h2v6h-2z" fill={cream} />
    <path d="M10 12h4v2h2v1h-8v-1h2zm-1 4h6v3H9z" fill={iron} />
    <path d="M4 19h16v2H4z" fill="#8a634e" />
    <path d="M5 19h12v1H5zm12-10h3v1h-3z" fill={lit ? "#ffecaa" : brass} />
  {:else if kind === "banana-scoop" || kind === "vanilla-scoop"}
    {@const banana = kind === "banana-scoop"}
    <path d="M7 3h10v2h3v4h2v5h-2v4h-2v3H7v-2H5v-3H3v-3H2V9h2V6h3z" fill={ink} />
    <path d="M6 11h13v5h-2v3H8v-2H6z" fill="#7f9383" />
    <path d="M8 5h8v2h3v3h1v3h-4v2h-4v-2H7v1H4v-4h2V7h2z" fill={banana ? "#f6cd81" : "#f4e4c2"} />
    <path d="M14 7h4v3h2v3h-4v2h-4v-2H8v-1h6z" fill={banana ? "#d8a356" : "#c5a886"} />
    <path d="M8 7h4v1h-2v2H8z" fill="#fff1ca" />
  {:else if kind === "carafe"}
    <path d="M9 2h6v2h2v3h1v2h3v2h1v7h-2v2h-3v1h-2v2H7v-2H5v-2H4V8h2V5h2V3h1zm9 9v7h1v-2h1v-4h-1v-1z" fill={ink} />
    <path d="M8 4h7v2h2v2H6V6h2z" fill={brass} />
    <path d="M7 9h8v2h2v8h-2v2H7v-2H6V11h1z" fill={iron} />
    <path d="M13 9h2v2h2v8h-2v2h-4v-2h2z" fill="#63766d" />
    <path d="M8 11h5v7H8z" fill="#594a43" />
    <path d="M9 12h3v5H9z" fill={lit ? "#dda16a" : "#ae9c7f"} />
    <path d="M7 10h1v8H7zM9 4h5v1H9z" fill={cream} />
  {:else if kind === "foam"}
    <path d="M4 9h14l3-3h2v3h-1v9h-2v3h-3v1H7v-1H5v-4H2V10h2zm0 3v3h1v-3z" fill={ink} />
    <path d="M6 11h14v7h-2v2H7v-2H6z" fill={iron} />
    <path d="M16 12h4v6h-2v2h-4v-2h2z" fill="#577268" />
    <path d="M6 10h2V8h4V6h3v2h3v2h2v2H6z" fill={cream} />
    <path d="M8 13h2v4H8z" fill="#e3cea7" />
  {:else if kind === "stock"}
    <path d="M2 8l10-5 10 5v11l-10 4-10-4z" fill={ink} />
    <path d="M4 8l8-4 8 4-8 4z" fill="#dfaf77" />
    <path d="M4 10l7 3v8l-7-3z" fill="#bd875d" />
    <path d="M13 13l7-3v8l-7 3z" fill="#9a654b" />
    <path d="M8 6l8 4-3 2-8-4zm5 6 3-2v6l-3 1z" fill={lit ? cream : brass} />
    <path d="M5 14l4 2v2l-4-2z" fill="#f2d198" />
  {:else if kind === "serve" || kind === "bell" || kind === "quiet"}
    <path d="M9 3h6v3h2v2h2v2h1v5h2v2h1v4H1v-4h1v-2h2v-5h1V8h2V6h2z" fill={ink} />
    <path d="M10 4h4v1h-4zM8 8h8v1h2v2h1v4H5v-4h1V9h2z" fill={brass} />
    <path d="M15 9h2v1h1v2h1v3h-6v-2h2zm-7 1h5v1H9v1H8v2H6v-2h1v-1h1z" fill="#a96b49" />
    <path d="M8 9h6v1H9v1H8v1H6v-1h1v-1h1zm-5 7h18v2H3z" fill={cream} />
    <path d="M2 19h20v1H2z" fill="#9c6851" />
  {:else if kind === "warm-shelf"}
    <path d="M3 3h18v2h1v6H2V5h1zM2 18h20v3H2zM5 11h2v7H5zm12 0h2v7h-2z" fill={ink} />
    <path d="M4 5h16v4H4zM4 19h16v1H4z" fill="#a37e55" />
    <path d="M6 7h12v2H6zm3 5h2v3H9zm4 0h2v3h-2z" fill={lit ? "#ffe6a7" : "#d6a269"} />
    <path d="M8 17h8v2H8z" fill="#bc8154" />
  {:else if kind === "reorder"}
    <path d="M9 3h7v2h3v3h3v1l-5 5-5-5V8h3V7H9v1H7v3H3V8h2V5h4zM7 10l5 5v1H9v1h6v-1h2v-3h4v4h-2v3h-4v1H8v-2H5v-3H2v-1z" fill={ink} />
    <path d="M9 4h7v2h2v3h2l-3 3-3-3h2V6H9v1H7v3H5V8h1V6h3zM7 12l3 3H8v3h7v-1h2v-3h2v3h-1v2h-3v1H9v-2H6v-3H4z" fill={lit ? "#d3ab65" : "#92a380"} />
    <path d="M9 4h7v1H9zm0 15h6v1H9z" fill="#ecd299" />
  {:else if kind === "clip" || kind === "ticket" || kind === "quality"}
    <path d="M8 2h8v2h3v2h2v13h-2v2h-3v1H5v-2H3V5h2V4h3z" fill={ink} />
    <path d="M5 6h14v12h-3v3H5z" fill={cream} />
    <path d="M17 7h2v11h-3v3h-3v-1h2v-3h2z" fill="#c89666" />
    <path d="M8 4h2V3h4v1h2v3H8z" fill={iron} />
    <path d="M11 4h2v1h-2z" fill={cream} />
    {#if kind === "quality"}
      <path d="M10 9h2v2h3v2h-2v3h-2v-2h-1v2H8v-3H7v-2h3z" fill={rose} />
    {:else}
      <path d="M7 10h9v1H7zm0 3h7v1H7zm0 3h5v1H7z" fill="#a47753" />
    {/if}
  {:else if kind === "rush"}
    <path d="M11 2h9v3h-2v3h-2v2h5v3h-2v2h-3v3h-3v3h-3v2H7v-5h1v-3H4v-3h2V9h2V6h2V3h1z" fill={ink} />
    <path d="M11 4h7v1h-1v2h-2v3h-2v2h6v1h-2v2h-2v2h-2v2h-2v2H9v-3h1v-3h2v-2H6v-1h1V9h2V6h2z" fill="#e5a64e" />
    <path d="M12 5h3v1h-2v2h-2v2H9V9h1V7h2zm2 8h3v1h-2v2h-2v1h-1v-2h2z" fill="#ffdc87" />
    <path d="M2 5h4v1H2zm0 2h3v1H2zm17 10h3v1h-3zm-2 2h3v1h-3z" fill={rose} />
  {:else if kind === "patience"}
    <path d="M4 2h16v5h-2v3h-2v2h2v4h2v5H4v-5h2v-4h2v-2H6V7H4z" fill={ink} />
    <path d="M6 3h12v2H6zm0 15h12v2H6z" fill={brass} />
    <path d="M7 6h10v3h-2v2h-2v3h2v2h2v1H7v-2h2v-2h2v-2H9V9H7z" fill="#bbc3a2" />
    <path d="M9 8h6v1h-2v2h-2V9H9zm2 6h2v1h2v2H9v-1h2z" fill="#c38257" />
    <path d="M8 6h1v2H8zm2 6h1v1h-1z" fill={cream} />
  {:else if kind === "assist"}
    <path d="M8 3h8v2h4v2h2v8h-2v2h-3v5H7v-5H4v-2H2V7h2V5h4z" fill={ink} />
    <path d="M9 4h6v2h4v2h2v6h-3v2H6v-2H3V8h2V6h4z" fill={cream} />
    <path d="M17 7h3v7h-3v2h-3v-3h3zm-9 9h8v5H8z" fill="#aab39a" />
    <path d="M8 17h8v2H8zm-3-5h3v2H5z" fill={rose} />
    <path d="M11 7h2v2h2v2h-2v2h-2v-2H9V9h2z" fill={iron} />
  {:else if kind === "supplies"}
    <path d="M3 6h2V4h14v2h2v14h-2v2H5v-2H3z" fill={ink} />
    <path d="M5 7h14v12h-2v1H7v-1H5zm1-2h12v2H6z" fill={brass} />
    <path d="M5 8h14v2H5zm2 9h10v2H7zm9-6h3v6h-3z" fill="#986144" />
    <path d="M10 10h4v2h2v4H8v-4h2z" fill={cream} />
    <path d="M11 11h2v2h2v1h-2v1h-2v-1H9v-1h2z" fill={rose} />
  {:else if kind === "special"}
    <path d="M8 4h8v2h2v2h2v3h1v8h-2v2H5v-2H3v-8h1V8h2V6h2z" fill={ink} />
    <path d="M9 5h6v2h2v2h2v3H5V9h2V7h2z" fill={iron} />
    <path d="M5 13h14v5h-2v2H7v-2H5z" fill={brass} />
    <path d="M10 7h4v2h2v1h-2v1h-4v-1H8V9h2zm-2 7h3v1H9v3H8z" fill={cream} />
    <path d="M13 14h4v3h-1v2h-4v-1h-1v-3h2z" fill="#f0cb79" />
    <path d="M14 15h1v3h-1z" fill="#9e6043" />
  {:else if kind === "cozy-seats"}
    <path d="M3 6h18v2h2v10h-2v3h-4v-3H7v3H3v-3H1V8h2z" fill={ink} />
    <path d="M4 7h16v3h1v4H3v-4h1zm-1 8h18v2H3z" fill={iron} />
    <path d="M6 8h5v4H5V9h1zm7 0h5v1h1v3h-6z" fill="#b8ba8f" />
    <path d="M5 16h14v1H5z" fill={brass} />
  {:else if kind === "street-sign"}
    <path d="M4 3h16v2h2v14h-2v3h-4v-3H8v3H4v-3H2V5h2z" fill={ink} />
    <path d="M4 5h16v13H4z" fill={brass} />
    <path d="M6 7h12v9H6z" fill="#526759" />
    <path d="M12 8h2v2h-1v2h2v1h-1v2h-4v-2H9v-1h3z" fill={cream} />
  {:else if kind === "remake"}
    <path d="M3 3h5v2h3V4h5v1h3v2h2v3h1v6h-1v2h-2v2h-3v1H8v-1H5v-2H3v-4h5v2h3v1h4v-1h2v-2h1v-3h-1V9h-3V8h-3v1h2v5H3z" fill={ink} />
    <path d="M4 4h3v3h3V6h2V5h3v1h3v2h2v3h1v4h-1v2h-2v2h-3v1H9v-1H6v-2H4v-2h3v2h3v1h5v-1h3v-2h1v-4h-1V8h-3V7h-3v1H9v2h3v3H4z" fill={rose} />
    <path d="M5 6h1v5h4v1H5zm11 12h2v1h-2z" fill={brass} />
  {:else if kind === "collect"}
    <path d="M10 2h4v8h2V8h4v4h-2v2h-2v2h-2v3h8v3H2v-3h8v-3H8v-2H6v-2H4V8h4v2h2z" fill={ink} />
    <path d="M11 3h2v10h2v-2h2V9h2v2h-2v2h-2v2h-2v2h-2v-2H9v-2H7v-2H5V9h2v2h2v2h2zm-8 17h18v1H3z" fill={iron} />
    <path d="M11 4h1v9h-1zm-4 7h1v2H7z" fill={cream} />
  {:else}
    <path d="M13 2h5v2h-2v3h4v3h-1v8h-2v3H7v-1H6v-2H5v-8H4V7h8V5h1z" fill={ink} />
    <path d="M14 3h3v1h-2v4h-2V5h1z" fill={rose} />
    <path d="M5 8h14v1H5zm2 2h10v2H7z" fill={cream} />
    <path d="M6 11h12v7h-2v2H8v-1H7v-2H6z" fill="#d2a67b" />
    <path d="M16 12h2v6h-2v2h-5v-1h4v-2h1z" fill="#a57658" />
    <path d="M8 12h1v4H8zm2 6h2v1h-2zm3-2h2v2h-2z" fill={ink} />
    <path d="M8 11h1v3H8z" fill={cream} />
  {/if}
  {#if lit}
    <path d="M2 4h2v1H2zm2-2h1v2H4zm16 18h2v1h-2zm-1 1h1v2h-1z" fill="#fff2b5" />
  {/if}
</svg>

<style>
  .kitchen-item {
    display: block;
    flex: none;
    pointer-events: none;
  }
</style>
