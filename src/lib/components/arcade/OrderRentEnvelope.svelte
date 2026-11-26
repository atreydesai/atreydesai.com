<script lang="ts">
  interface Props {
    state: "paid" | "closed" | "open";
    size?: number;
  }

  let { state, size = 128 }: Props = $props();
  const ink = "#513b34";
</script>

<svg viewBox="0 0 128 82" width={size} height={size * 82 / 128} aria-hidden="true" focusable="false" shape-rendering="crispEdges">
  <path d="M17 70h93v-1h8v2h6v3h-8v2H21v-1H8v-3h9z" fill="#392f2c" opacity=".4" />

  {#if state === "paid"}
    <path d="M68 9h16V6h17v2h6v4h3v25H66V17h2z" fill={ink} />
    <path d="M70 11h16V8h14v2h5v4h3v21H68V19h2z" fill="#d1a35c" />
    <path d="M72 11h27v4h5v17H72z" fill="#ebc377" />
    <path d="M99 10h5v4h-5zm-24 2h20v2H75zm0 5h17v3H75z" fill="#f9de98" />
    <path d="M91 23h11v7H91z" fill="#b78553" />
  {:else}
    <path d="M17 20h9v-4h72v2h10v4h-5v13H17z" fill={ink} />
    <path d="M23 21h6v-3h68v2h8v4H23z" fill="#bc9164" />
    <path d="M29 18h67v1H29z" fill="#d9b47b" />
  {/if}

  <!-- The front paper bevels fold over the two side seams. -->
  <path d="M12 25h4v-3h7v-2h86v2h7v4h4v37h-2v6h-6v3H17v-2h-5v-4H9V29h3z" fill={ink} />
  <path d="M15 27h4v-3h6v-2h83v2h6v4h4v34h-2v5h-6v3H18v-2h-4v-4h-2V30h3z" fill="#cb9f6d" />
  <path d="M16 28h4v-3h6v-2h79v2h7v4h4v32h-2v4h-6v2H20v-2h-4v-4h-2V32h2z" fill="#eed5a4" />
  <path d="M17 32h3v25h2v6h-3v-4h-2zm77-7h12v2H94zM23 63h15v2H23zm63 0h19v2H86z" fill="#fff0c8" />
  <path d="M15 62h5v-5h5v-4h5v-3h5v-3h5v-4h5v3h-4v4h-5v3h-5v3h-5v4h-5v4h-6zm99-1h-4v-4h-5v-4h-5v-3h-5v-3h-5v-4h-5v3h4v4h5v3h5v3h5v4h5v4h5z" fill="#c09a6c" />

  <!-- The stepped flap meets the wax or tie at the center. -->
  <path d="M18 25h8v-2h80v2h7v4h-4v4h-6v4h-7v4h-7v4h-8v4h-8v4H57v-3h-9v-4h-8v-4h-7v-4h-6v-4h-5v-4h-4z" fill="#bd8d64" />
  <path d="M20 25h7v-2h75v2h8v3h-4v3h-6v4h-7v4h-7v4h-8v4h-8v4H58v-3h-8v-4h-8v-4h-7v-4h-6v-4h-5v-4h-4z" fill="#f3dbad" />
  <path d="M28 24h71v2H29v2h-5v-1h4zm2 9h4v3h5v2h-6v-2h-3zm8 7h5v3h4v1h-5v-2h-4z" fill="#ffefc7" />
  <path d="M103 30h3v2h-4v3h-6v-1h5v-2h2zm-9 7h3v2h-7v2h-4v-1h3v-2h5zm-65 20h4v1h-4zm72 5h5v1h-5z" fill="#d9b682" />

  {#if state === "paid"}
    <path d="M59 41h13v2h4v4h3v10h-3v4h-4v2H59v-2h-4v-4h-3V47h3v-4h4z" fill="#58624b" />
    <path d="M59 43h13v2h3v3h2v8h-3v4H58v-2h-3V48h2v-3h2z" fill="#80936a" />
    <path d="M59 44h11v2H59zm-3 4h2v6h-2zm13 10h5v2h-5z" fill="#a6ac79" />
    <path d="M58 51h4v3h3v-3h3v-3h5v3h-3v3h-3v4h-5v-3h-4z" fill="#f6dfa8" />
  {:else if state === "closed"}
    <path d="M93 26h16v3h-4v4h-6v4h-7v3h-7v4h-8v-4h5v-4h7v-4h4z" fill="#a25f54" />
    <path d="M94 28h12v1h-6v3h-5v3h-6v-2h5zm-9 8h4v2h-4zm-7 4h5v1h-5z" fill="#c3826b" />
    <path d="M60 46h11v2h3v10h-3v3H60v-2h-4V48h4z" fill="#84534a" />
    <path d="M60 48h10v2h2v7h-2v2H60v-2h-2v-7h2z" fill="#b97260" />
    <path d="M61 52h8v3h-8z" fill="#f0c193" />
  {:else}
    <path d="M60 43h11v2h2v7h-4v4h4v7h-2v2H60v-2h-2v-7h4v-4h-4v-7h2z" fill="#866344" />
    <path d="M61 45h9v2h1v3H60v-3h1zm0 13h9v2h1v3H60v-3h1z" fill="#c29b60" />
    <path d="M62 46h6v2h-6zm0 14h6v2h-6zm1-11h3v9h-3zm4 3h3v4h-3z" fill="#ebc488" />
  {/if}
</svg>

<style>
  svg {
    display: block;
    max-width: 100%;
    height: auto;
  }
</style>
