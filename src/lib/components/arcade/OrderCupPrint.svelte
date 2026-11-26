<script lang="ts">
  interface Props {
    kind: "house" | "plum" | "fern" | "ferry";
    size?: number;
  }

  let { kind, size = 28 }: Props = $props();

  const inks = {
    house: { ink: "#984d41", light: "#c97559" },
    plum: { ink: "#a25169", light: "#cb7e87" },
    fern: { ink: "#557257", light: "#80946a" },
    ferry: { ink: "#405974", light: "#739b9b" },
  };
  const tint = $derived(inks[kind]);
</script>

<svg viewBox="0 0 22 22" width={size} height={size} aria-hidden="true" focusable="false" shape-rendering="crispEdges">
  <path d="M6 1h10v1h3v2h2v4h1v7h-1v3h-2v2h-3v1H6v-1H3v-2H1v-3H0V8h1V4h2V2h3z" fill="#523a34" />
  <path d="M6 2h10v1h3v2h1v3h1v7h-1v3h-2v1h-3v1H6v-1H4v-2H2v-3H1V8h1V5h2V3h2z" fill="#e3ba80" />
  <path d="M7 2h8v1h3v2h2v9h-1v3h-2v2H6v-1H4v-2H2V8h1V5h2V3h2z" fill="#f7dfad" />
  <path d="M6 3h7v1H6zm-2 2h2v1H5v2H4zm13 11h2v1h-1v1h-2v-1h1z" fill="#ffefc8" />
  <path d="M3 13h1v1H3zm12 5h1v1h-1zm4-11h1v1h-1z" fill="#c89a69" />

  {#if kind === "house"}
    <path d="M9 5h2v1h-1v2H8V6h1zm4 0h2v2h-1v1h-2V7h1z" fill={tint.light} />
    <path d="M5 9h12v1h2v4h-2v1h-2v1h-2v1H8v-1H7v-1H6v-2H5zm11 3v2h1v-2zM6 17h2v1h7v-1h2v1h-2v1H8v-1H6z" fill={tint.ink} />
    <path d="M7 10h8v1H7zm0 2h1v2H7zm5 2h2v1h-2z" fill={tint.light} />
  {:else if kind === "plum"}
    <path d="M9 4h4v1h1v3h-1v2H9V8H8V5h1zm-4 4h3v1h2v4H8v1H5v-1H4V9h1zm9 0h3v1h1v4h-1v1h-3v-1h-2V9h2zM6 14h2v-1h3v4h-1v1H9v1H6v-1H5v-3h1zm6-1h2v1h2v1h1v3h-1v1h-3v-1h-1v-1h-1v-3h1z" fill={tint.ink} />
    <path d="M9 5h3v1H9zm-3 4h2v1H6zm8 0h2v1h-2zm-7 6h2v1H7zm7 0h2v1h-2z" fill={tint.light} />
    <path d="M10 10h2v3h-2zm-1 1h4v1H9z" fill="#f8c88b" />
  {:else if kind === "fern"}
    <path d="M15 4h2v2h-1v2h-1v2h-1v2h-1v2h-2v2H9v1H7v2H5v-2h1v-1h2v-2h2v-2h2v-2h1V8h1V6h1z" fill={tint.ink} />
    <path d="M12 5h2v1h1v4h-3V8h-1V6h1zm4 3h3v2h-1v1h-2v1h-3v-2h1V9h2zM8 8h2v1h2v4h-2v-1H8v-2H7V9h1zm5 5h4v2h-1v1h-4v-1h-2v-1h3zM5 12h2v1h2v2H8v1H6v-1H4v-2h1z" fill={tint.ink} />
    <path d="M12 6h1v2h-1zm4 3h2v1h-2zm-8 0h2v1H8zm6 5h2v1h-2zm-9-1h2v1H5z" fill={tint.light} />
  {:else}
    <path d="M11 4h2v3h3v3h2v1h1v2h-2v2H7v-1H5v-2H4v-2h4V8h2V7h1zm-2 6v1h2v-1zm3 0v1h2v-1zm3 0v1h2v-1z" fill={tint.ink} />
    <path d="M5 16h3v1h4v-1h4v1h3v1h-4v-1h-2v1H8v-1H5zm5 3h6v1h-6z" fill={tint.light} />
  {/if}
</svg>

<style>
  svg {
    display: block;
    flex: none;
  }
</style>
