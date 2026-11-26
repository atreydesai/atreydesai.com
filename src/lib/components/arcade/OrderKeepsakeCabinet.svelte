<script lang="ts">
  interface Props {
    tier: number;
    size?: number;
  }

  let { tier, size = 176 }: Props = $props();

  const pins = [
    { id: "teacup", x: 15, enamel: "#a6544e", shade: "#79423f", shine: "#d17c69" },
    { id: "window", x: 41, enamel: "#798d67", shade: "#526751", shine: "#a0ac76" },
    { id: "ferry", x: 67, enamel: "#52797b", shade: "#375c61", shine: "#83a09a" },
  ];
  const shield = "M1 1h20v14h-1v3h-2v2h-3v2h-3v2h-2v-2H7v-2H4v-2H2v-3H1z";
</script>

<svg viewBox="0 0 108 72" width={size} height={size * 2 / 3} aria-hidden="true" focusable="false" shape-rendering="crispEdges">
  <path d="M9 66h89v1h7v2h-5v1H8v-1H2v-2h7z" fill="#211e22" opacity=".46" />
  <path d="M7 11h3V8h3V6h5V4h72v2h7v3h5v4h3v49h-3v3h-7v2H8v-2H4v-4H2v-7h3V15h2z" fill="#362a2b" />
  <path d="M19 5h70v2h7v2h4v3h4v46l-8 4V16h-4v-3h-5V9H17V7h2z" fill="#6c463b" />
  <path d="M19 5h70v2h6v2h-7v2H13V9h3V7h3z" fill="#b87950" />
  <path d="M20 6h68v1h-6v1H17V7h3zm68 2h6v1h-6z" fill="#d59c68" />
  <path d="M13 10h79v3h5v43h2v5H6v-7h2V15h2v-3h3z" fill="#975e47" />
  <path d="M13 11h78v2H12v2H9v39H7V15h3v-3h3zm1 6h2v39h-3V18h1z" fill="#c88d5f" />
  <path d="M94 14h4v43h-4zm5 1h3v40h-3z" fill="#563935" />
  <path d="M100 17h2v29h-1v7h-1z" fill="#835440" />
  <path d="M14 16h77v2h3v38H12V18h2z" fill="#492f2e" />
  <path d="M15 18h75v2h2v33H14V20h1z" fill="#6c7357" />
  <path d="M16 20h73v2H18v21h-2zm3 22h11v1H19zm57-21h12v1H76zm0 22h13v1H76z" fill="#8b8c66" />
  <path d="M87 22h4v28H15v-3h65v-1h7z" fill="#555c49" />
  <path d="M16 47h75v3H15v-2h1z" fill="#483d35" />
  <path d="M13 50h80v4H13z" fill="#b29567" />
  <path d="M15 50h75v1H15zm-1 2h24v1H14zm62 0h14v1H76z" fill="#d5ac77" />

  {#each pins as pin, index (pin.id)}
    <g transform="translate({pin.x} 23)">
      <path d="M3 1h20v17h-2v2h-3v2h-3v2h-3v1H9v-2H7v-2H4v-3H2V4h1z" fill="#363b34" />
      {#if index < tier}
        <path d={shield} fill="#efc98a" />
        <path d="M3 3h16v12h-1v2h-2v2h-3v2H9v-2H6v-2H4v-2H3z" fill={pin.enamel} />
        <path d="M17 4h2v11h-1v2h-2v2h-3v2h-2v-2h2v-2h2v-2h1V9h1z" fill={pin.shade} />
        <path d="M3 4h2v1H4v5H3zm1 8h1v2H4z" fill={pin.shine} />
        <path d="M2 1h10v1H3v2H2zm15 1h2v1h-2z" fill="#ffebb9" />
        {#if pin.id === "teacup"}
          <path d="M9 5h2v3H9zm3 0h1v2h-1zm-5 5h10v3h-2v2h-2v1H9v-1H8v-2H7zm8 1v1h1v-1zm-8 6h8v1H7z" fill="#fbdfad" />
          <path d="M9 11h5v1H9zm4 2h1v1h-1z" fill="#b47558" />
        {:else if pin.id === "window"}
          <path d="M9 6h4v1h2v2h1v7h1v2H5v-2h1V9h1V7h2z" fill="#eed99c" />
          <path d="M8 10h2V8h2v2h2v5H8z" fill="#475e50" />
          <path d="M10 8h2v8h-2zm-2 4h6v1H8zm-1 4h8v1H7z" fill="#f1ce88" />
        {:else}
          <path d="M10 5h2v3h3v3h2v2h-2v2H8v-1H6v-2H5v-1h3V9h2zm-2 7v1h7v-1z" fill="#f7dca0" />
          <path d="M6 16h4v1h4v-1h3v1h-3v1h-4v-1H6z" fill="#b4c5a9" />
        {/if}
      {:else}
        <path d={shield} fill="#424c3e" />
        <path d="M3 3h16v1H4v10H3zm13 14h3v1h-2v2h-3v2h-3v-1h2v-2h3z" fill="#5a6250" />
        <path d="M9 8h4v4H9z" fill="#303a34" />
        <path d="M10 9h2v1h-2z" fill="#858269" />
      {/if}
    </g>
  {/each}

  <path d="M14 20h13v1h-8v1h-3v11h-1V23h-1zm20 1h7v1h-7zm58 12v9h-1v7h-6v-1h5v-6h1v-9z" fill="#def0bf" opacity=".5" />
  <path d="M12 54h81v3H12zm-3 4h88v3H9z" fill="#c48857" />
  <path d="M15 55h75v1H15zM9 58h84v1H9z" fill="#e4ad72" />
  <path d="M8 61h90v3H8z" fill="#754a3e" />
  <path d="M5 60h3v3h90v-2h5v2h-3v1h-6v2H8v-2H5z" fill="#4a3430" />
  <path d="M15 63h15v1H15zm29 0h20v1H44zm34 0h12v1H78z" fill="#a56c4d" />
  <path d="M9 19h2v3H9zm0 28h2v3H9zm85-28h2v3h-2zm0 28h2v3h-2z" fill="#64453a" />
  <path d="M9 19h1v1H9zm0 28h1v1H9zm85-28h1v1h-1zm0 28h1v1h-1z" fill="#e1ae6e" />
  <path d="M44 53h17v5H44z" fill="#50382e" />
  <path d="M45 54h15v3H45z" fill="#c5965e" />
  <path d="M46 54h11v1H46zm1 2h1v1h-1zm10 0h1v1h-1z" fill="#f1c780" />
</svg>

<style>
  svg {
    display: block;
    max-width: 100%;
    height: auto;
  }
</style>
