<script lang="ts">
  import type { BranchId } from "#lib/arcade/orders-campaign.ts";

  interface Props {
    branch: BranchId;
    size?: number;
  }

  let { branch, size = 56 }: Props = $props();
</script>

<svg viewBox="0 0 48 44" width={size} height={size * 44 / 48} aria-hidden="true" focusable="false" shape-rendering="crispEdges">
  <path d="M4 38h40v3H4z" fill="#4b3838" opacity=".6" />
  {#if branch === "corner"}
    <path d="M8 4h32v34H8z" fill="#513b37" />
    <path d="M10 6h28v30H10z" fill="#c79571" />
    <path d="M12 8h24v7H12z" fill="#6e7f69" />
    <path d="M17 10h14v2H17z" fill="#e6c593" />
    <path d="M9 15h30v3h2v8H7v-8h2z" fill="#734a42" />
    <path d="M10 17h28v8H10z" fill="#edd2a4" />
    <path d="M12 17h5v8h-5zm10 0h5v8h-5zm10 0h5v8h-5z" fill="#bc7759" />
    <path d="M12 26h15v9H12zm18 0h6v12h-6z" fill="#655447" />
    <path d="M13 27h13v5H13z" fill="#edae72" />
    <path d="M19 27h1v5h-1zm12 0h4v7h-4z" fill="#93a38a" />
    <path d="M10 35h18v2H10z" fill="#8b6453" />
  {:else if branch === "campus"}
    <path d="M5 13h38v13h-4v12h-4V26H13v12H9V26H5z" fill="#4d4540" />
    <path d="M10 11h28l7 7v5H3v-5z" fill="#678579" />
    <path d="M12 9h23l8 8H5z" fill="#a9ac84" />
    <path d="M17 10h13l5 6H11z" fill="#bbbd95" />
    <path d="M5 18h38v4H5z" fill="#4d665e" />
    <path d="M11 24h26v12H11z" fill="#aa7760" />
    <path d="M12 27h24v5H12z" fill="#d1a070" />
    <path d="M14 25v-5h5v5zm8 0v-7h6v7zm9 0v-4h4v4z" fill="#f0d098" />
    <path d="M8 33h32v5H8z" fill="#735849" />
    <path d="M16 34h16v2H16z" fill="#bc956c" />
    <path d="M37 4h2v7h-2zm2 0h7v4h-7z" fill="#c88369" />
  {:else if branch === "garden"}
    <path d="M6 20h3v-6h4v-3h5V8h12v3h5v3h4v6h3v19H6z" fill="#4c5045" />
    <path d="M8 21h3v-6h5v-3h5V9h6v3h5v3h5v6h3v16H8z" fill="#82977a" />
    <path d="M13 23h4v-6h14v6h4v14H13z" fill="#c6c498" />
    <path d="M20 24h8v14h-8z" fill="#5c756a" />
    <path d="M23 26h2v8h-2z" fill="#e6c996" />
    <path d="M8 24h5v2H8zm27 0h5v2h-5z" fill="#e8d5a1" />
    <path d="M4 34h10v5H4zm30 0h10v5H34z" fill="#a37057" />
    <path d="M8 34v-8H5v-4h4v3h4v3h-3v6zm30 0v-9h-3v-4h4v3h4v4h-3v6z" fill="#60805d" />
    <path d="M6 28h3v3H6zm34 1h3v3h-3z" fill="#aec192" />
  {:else if branch === "night"}
    <path d="M10 10h28l7 8v6H3v-6z" fill="#51404f" />
    <path d="M12 9h24l7 9H5z" fill="#956064" />
    <path d="M17 10h14l6 7H11z" fill="#be7969" />
    <path d="M8 21h32v17H8z" fill="#4e3b40" />
    <path d="M11 23h26v10H11z" fill="#a87755" />
    <path d="M17 25h14v6H17z" fill="#f0bb73" />
    <path d="M19 27h3v4h-3zm7-1h4v5h-4z" fill="#82654e" />
    <path d="M10 33h28v3H10z" fill="#c28c65" />
    <path d="M7 19h2v6H7zm32 0h2v6h-2z" fill="#604448" />
    <path d="M5 24h6v2h2v7h-2v2H5v-2H3v-7h2zm32 0h6v2h2v7h-2v2h-6v-2h-2v-7h2z" fill="#d38c58" />
    <path d="M6 27h4v5H6zm32 0h4v5h-4z" fill="#fbd193" />
  {:else if branch === "harbor"}
    <path d="M0 35h48v7H0z" fill="#83918b" />
    <path d="M1 36h16v1H1zm27 4h16v1H28z" fill="#b4b09a" />
    <path d="M5 15l16-11h10l13 10v18L29 39H6z" fill="#594640" />
    <path d="M8 16h21v20H8z" fill="#b88e73" />
    <path d="M29 14l13-2v18l-13 6z" fill="#778e84" />
    <path d="M5 15l16-11 10 2 13 8-16 5z" fill="#615d59" />
    <path d="M9 14L22 6l9 2-7 4-1 4z" fill="#9e786a" />
    <path d="M26 15l7-7 9 6-14 3z" fill="#ad8d76" />
    <path d="M11 20h13v5H11z" fill="#748878" />
    <path d="M14 21h7v2h-7z" fill="#e2bf8f" />
    <path d="M11 27h13v8H11z" fill="#6b5951" />
    <path d="M12 28h11v4H12z" fill="#d7b185" />
    <path d="M33 20l6-2v6l-6 3z" fill="#b6bfa1" />
    <path d="M35 20h2v5h-2z" fill="#667d73" />
    <path d="M5 35h25l13-6v4l-13 6H5z" fill="#8d7565" />
    <path d="M8 37h3v4H8zm16 0h3v5h-3zm16-4h2v5h-2z" fill="#6f625a" />
  {:else if branch === "loft"}
    <path d="M5 4h38v2h3v31h-3v3H5v-2H2V7h3z" fill="#443945" />
    <path d="M5 5h37v2h3v29h-3v3H6v-2H3V8h2z" fill="#877285" />
    <path d="M7 6h33v1H7zm-3 4h1v24H4zm39 22h1v4h-2v2h-7v-1h6v-2h2z" fill="#af8a91" />
    <path d="M7 8h33v2h2v24h-2v2H7v-2H6V10h1z" fill="#736985" />
    <path d="M6 17h36v17h-2v2H7v-2H6z" fill="#a68192" />
    <path d="M6 21h36v10H6z" fill="#c29893" />
    <path d="M35 10h3v1h1v3h-1v1h-3v-1h-1v-3h1z" fill="#f0ca9a" />
    <path d="M6 25h2v-5h4v3h3v-4h4v4h3v5h7v-5h4v3h3v-7h4v3h2v12h-2v2H6z" fill="#746276" />
    <path d="M6 27h5v3h6v2h17v-4h3v-3h3v4h2v5h-2v2H7v-2H6z" fill="#514a60" />
    <path d="M8 23h2v2H8zm29-2h2v1h-2zm2 9h2v2h-2z" fill="#c7a28f" />

    <!-- The conservatory roof angles back to the slate side wall. -->
    <path d="M11 17l7-9h10l10 7v19l-5 4H11z" fill="#403b47" />
    <path d="M13 18h18v18H13z" fill="#7c7788" />
    <path d="M31 18l5-2v17l-5 3z" fill="#5a566c" />
    <path d="M12 17l7-8h8l9 6-5 3H12z" fill="#73808a" />
    <path d="M15 16l5-6h3l-1 6zm9 0 1-6h2l4 5-2 1z" fill="#b6aea2" />
    <path d="M17 14l3-3h2l-1 3zm8-3h2l1 2h-3z" fill="#f2cc99" />

    <path d="M13 20h18v9H13z" fill="#5e4b4c" />
    <path d="M14 21h16v6H14z" fill="#da9f67" />
    <path d="M14 21h16v3H14z" fill="#f0c888" />
    <path d="M18 20h1v8h-1zm6 0h1v8h-1z" fill="#8e6357" />
    <path d="M15 25h2v2h-2zm5 1h3v1h-3zm7-1h2v2h-2z" fill="#967c5f" />
    <path d="M15 31h4v5h-4zm6 0h4v5h-4zm6 0h2v5h-2z" fill="#5c576a" />
    <path d="M15 31h3v2h-3zm6 0h3v2h-3z" fill="#a28a86" />
    <path d="M12 36h19v1H12zm20-2h2v-1h2v1h-2v1h-2z" fill="#a48888" />

    <path d="M34 18h7v1h-3v2h3v7h-7v-7h2v-2h-2z" fill="#493d4c" />
    <path d="M35 22h5v5h-5z" fill="#a96664" />
    <path d="M36 23h3v2h-1v1h-1v-1h-1z" fill="#f1d19d" />
  {:else}
    <path d="M5 37V15h5v-5h6V6h16v4h6v5h5v22z" fill="#4b4843" />
    <path d="M8 37V17h5v-5h6V9h10v3h6v5h5v20z" fill="#b5a580" />
    <path d="M13 37V21h5v-6h12v6h5v16z" fill="#657b76" />
    <path d="M17 37V24h4v-5h6v5h4v13z" fill="#424f4f" />
    <path d="M21 23h6v5h-6z" fill="#e8ca95" />
    <path d="M19 30h10v2H19z" fill="#869988" />
    <path d="M8 24h3v10H8zm29 0h3v10h-3z" fill="#d7b790" />
    <path d="M22 5h4v2h2v6h-2v2h-4v-2h-2V7h2z" fill="#5a574b" />
    <path d="M22 7h4v6h-4z" fill="#ebd3a1" />
    <path d="M23 8h1v3h2v1h-3z" fill="#5a574b" />
    <path d="M5 36h38v3H5z" fill="#7a6959" />
  {/if}
</svg>
