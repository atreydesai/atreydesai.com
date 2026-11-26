<script lang="ts">
  interface Props {
    packed: number;
    size?: number;
  }

  let { packed, size = 150 }: Props = $props();

  const ink = "#4a332d";
  const wheat = "#f0c98a";
  const cups = [
    { x: 38, y: 0, top: "#e6a776", body: "#b86c52", side: "#8b5147", cap: "#a75350" },
    { x: 74, y: -2, top: "#d0c993", body: "#8c9f6b", side: "#5e7758", cap: "#637b64" },
    { x: 110, y: -4, top: "#d1aeb9", body: "#a07b94", side: "#745971", cap: "#85596c" },
  ];
</script>

<svg viewBox="0 0 150 80" width={size} height={size * 80 / 150} aria-hidden="true" focusable="false" shape-rendering="crispEdges">
  <path d="M24 73h95v-1h15v1h8v2h-8v2H21v-1H8v-2h16z" fill="#332823" opacity=".42" />

  <!-- The folded rear handle and its cutout sit behind the cups. -->
  <path d="M41 41v-9h5v-7h4v-7h4v-5h6V9h6V6h25v2h7v3h5v5h4v7h4v8h5v8h-5v5H42v-3zm24-25v3h-4v5h-4v7h43v-4h-4v-7h-4v-4z" fill={ink} fill-rule="evenodd" />
  <path d="M45 40v-6h5v-8h4v-7h4v-4h6v-4h6V8h20v2h7v3h5v5h4v7h3v8h5v6h-6v3H45zm18-27v4h-4v5h-4v8h-2v3h50v-6h-4v-8h-4v-4h-4v-2z" fill="#af7958" fill-rule="evenodd" />
  <path d="M48 34h4v-8h4v-6h4v-5h5v-3h5V9h20v2H72v3h-6v3h-5v4h-4v8h-4v8h-5z" fill="#e3b379" />
  <path d="M73 9h12v6H73zm-5 2h3v4h-3z" fill="#d7a46d" />
  <path d="M74 8h3v8h-3zm6 0h3v8h-3z" fill="#f3d4a1" />
  <path d="M85 9h4v6h-3v4h-2v-5h1z" fill="#694a39" />

  <!-- The rear flap and inner platform; the empty openings read through the whole tray. -->
  <path d="M21 39h5v-5h6v-4h8v-2h91v2h6v4h4v6h4v18h-4v5h-7v5h-8v5H27v-2h-9v-3h-6v-4H8V52h4v-6h4v-5h5z" fill={ink} />
  <path d="M28 38h6v-4h7v-3h89v2h6v4h4v6h-8v5h-7v6H17v-5h4v-5h4v-4h3z" fill="#b17653" />
  <path d="M30 36h7v-3h92v2h6v4h5v5h-11v6h-10v6H12v-4h5v-6h6v-5h7z" fill="#d69c6b" />
  <path d="M40 33h76v1H40zm-7 4h14v1H33zm20 1h7v1h-7zm15-2h17v1H68zm41 1h10v1h-10zm10 15h7v1h-7z" fill="#f0c58a" />
  <path d="M19 47h6v-5h5v-2h94v2h5v4h-4v5h-8v4H17v-6h2z" fill="#a77655" />

  {#each cups as cup (cup.x)}
    <g transform="translate({cup.x} {cup.y})">
      <path d="M-12 44h5v-2H8v1h5v3h2v6h-3v3H6v2H-9v-1h-5v-3h-2v-4h2v-3h2z" fill="#714f41" />
      <path d="M-11 47h4v-2H8v1h4v3h2v3h-3v2H6v1H-9v-1h-5v-4h3z" fill="#594036" />
      <path d="M-13 54h4v2H7v-1h6v1H8v2H-8v-1h-5z" fill={wheat} />
    </g>
  {/each}

  {#each cups as cup, index (cup.x)}
    {#if index < packed}
      <g transform="translate({cup.x} {cup.y})">
        <path d="M-11 22h5v-2H7v2h5v2h3v6h-2v11h-2v6H9v5h-3v3H-7v-1h-3v-5h-2v-6h-1V31h-2v-6h2v-2h2z" fill={ink} />
        <path d="M-11 30h22v10h-2v7H7v5H5v1H-7v-1h-2v-5h-1v-6h-1z" fill={cup.body} />
        <path d="M-11 30h22v6H6v2H0v-1h-6v-1h-5z" fill={cup.top} />
        <path d="M8 32h3v8H9v7H7v5H5v1H0v-2h4v-7h2v-8h2z" fill={cup.side} />
        <path d="M-10 32h2v8h-2zm1 10h2v4h-2z" fill="#f6d9a6" opacity=".85" />
        <path d="M-6 46h3v3h-3zm5 3h3v3h-3zm3-5h3v3H2zm-8 7h2v2h-2z" fill="#563936" />
        <path d="M-12 25h4v-1h4v-2H6v1h5v2h2v3H9v2H-9v-1h-4v-3h1z" fill={cup.cap} />
        <path d="M-10 25h5v-2H6v1h5v2H7v1H-9v-1h-1z" fill="#f0c796" />
        <path d="M-4 24h7v1h-7zm-6 4h15v1h-15z" fill="#ffe6b7" opacity=".85" />
      </g>
    {/if}
  {/each}

  <!-- The folded ends and front apron overlap the bottom of each cup. -->
  <path d="M17 52h8v3h8v2h84v-3h8v-5h7v-5h7v-6h4v18h-4v6h-7v4h-8v5H27v-2h-7v-3h-6v-4h-4V54h7z" fill="#c68c5e" />
  <path d="M11 55h7v2h6v3h7v8h-6v-2h-6v-3h-5v-3h-3z" fill="#a96f50" />
  <path d="M30 59h89v10H30z" fill="#bc8058" />
  <path d="M34 60h84v4H34zm-2 7h65v1H32z" fill="#d29463" />
  <path d="M118 57h8v-6h7v-5h6v-6h3v15h-4v6h-7v4h-8v5h-5z" fill="#a76c52" />
  <path d="M121 58h7v-5h6v-4h3v4h-3v5h-7v3h-6z" fill="#db9e6a" />
  <path d="M11 53h10v3h8v2h91v-2h6v-4h5v-4h4v3h-3v4h-6v4h-5v1H29v-2h-8v-2H11z" fill="#f3c88d" />
  <path d="M34 64h12v1H34zm10-3h8v1h-8zm5 5h8v1h-8zm46-4h6v1h-6zm5 4h9v1h-9zm13-2h5v1h-5z" fill="#975f4b" />

  <!-- A worn green delivery stamp sits across the middle face. -->
  <path d="M63 60h26v1h3v6h-3v1H63v-1h-3v-6h3z" fill="#d8af76" />
  <path d="M63 61h25v1H64v4h24v1H63zm25 1h2v4h-2z" fill="#627456" />
  <path d="M71 63h6v-1h3v1h2v2h-2v1h-3v-1h-6z" fill="#5b6e52" />
</svg>

<style>
  svg {
    display: block;
    max-width: 100%;
    height: auto;
  }
</style>
