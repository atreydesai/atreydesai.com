<script lang="ts">
  import Seo from "$lib/components/Seo.svelte";
  import ResearchCard from "$lib/components/ResearchCard.svelte";
  import LegoImage from "$lib/components/LegoImage.svelte";
  import { papers, homepageData } from "$lib/content";
  import { parseInline } from "$lib/utils/text";
  import ScrollReveal from "$lib/components/ScrollReveal.svelte";
  import HyperText from "$lib/components/HyperText.svelte";
  import PixelIcon from "$lib/components/PixelIcon.svelte";
  import { onMount } from "svelte";
  import { bobaMode } from "$lib/boba";
  import { sfxBoba, unlockAudio } from "$lib/sfx";

  // Little pixel boba tucked in the photo corner — a random drink + straw
  // orientation on each page load. Click to play the minigame.
  const CUP_BODY = [
    "OOOOOOO",
    ".OLLLO.",
    ".OLLLO.",
    ".ObLbO.",
    ".OLbLO.",
    "..OOO..",
  ];
  const STRAWS = [
    ["...S...", "...S..."], // straight
    ["....S..", "...S..."], // lean right
    [".....S.", "....S.."], // lean right (more)
    ["..S....", "...S..."], // lean left
    [".S.....", "..S...."], // lean left (more)
  ];
  const DRINKS = [
    "#b388e0", "#8bbf5a", "#c79a6b", "#f47ba0",
    "#f4b942", "#6aa6e0", "#9fd17a", "#e76f8e",
  ];
  // Deterministic default for SSR / first paint; randomized in onMount so each
  // load varies without a hydration mismatch.
  let bobaGrid = [...STRAWS[0], ...CUP_BODY];
  let bobaPal: Record<string, string> = {
    O: "#2b2320",
    L: "#c79a6b",
    b: "#2b1a12",
    S: "#ff5277",
  };

  onMount(() => {
    // Random straw + drink colour each load.
    const straw = STRAWS[Math.floor(Math.random() * STRAWS.length)];
    bobaGrid = [...straw, ...CUP_BODY];
    bobaPal = { ...bobaPal, L: DRINKS[Math.floor(Math.random() * DRINKS.length)] };

    // Resume audio on the first click anywhere, so the boba's hover jingle plays.
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  });

  const parseBanner = (text: string) => parseInline(text, { copyButton: true });

  $: featuredPapers = papers
    .filter((p) => p.featured)
    .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99))
    .slice(0, 3);

  const parseLinks = (text: string) => parseInline(text, { italic: true });
  const parseInterestText = (text: string) =>
    parseInline(
      text.replace(
        /\(([^)]+)\)/g,
        '<span class="text-[0.94em] italic">($1)</span>',
      ),
      { italic: true },
    );

  let emailCopied = false;
  let copyTimeout: ReturnType<typeof setTimeout>;

  function copyEmail() {
    navigator.clipboard.writeText(homepageData.social.email);
    emailCopied = true;
    clearTimeout(copyTimeout);
    copyTimeout = setTimeout(() => (emailCopied = false), 1000);
  }

  let cookKey: string | null = null;
  let cookTimeout: ReturnType<typeof setTimeout>;

  function showCook(key: string) {
    cookKey = key;
    clearTimeout(cookTimeout);
    cookTimeout = setTimeout(() => (cookKey = null), 1000);
  }

  let bannerCopied = false;
  let bannerCopyTimeout: ReturnType<typeof setTimeout>;
  let bannerTooltipLeft = 0;
  let bannerTooltipTop = 0;
  let bannerWrapperEl: HTMLDivElement;

  function handleBannerClick(e: MouseEvent) {
    const target = (e.target as HTMLElement)?.closest("[data-banner-copy]") as HTMLElement | null;
    if (!target || !bannerWrapperEl) return;
    navigator.clipboard.writeText(homepageData.social.email);
    const btnRect = target.getBoundingClientRect();
    const wrapRect = bannerWrapperEl.getBoundingClientRect();
    bannerTooltipLeft = btnRect.left - wrapRect.left + btnRect.width / 2;
    bannerTooltipTop = btnRect.bottom - wrapRect.top + 3;
    bannerCopied = true;
    clearTimeout(bannerCopyTimeout);
    bannerCopyTimeout = setTimeout(() => (bannerCopied = false), 1000);
  }

  const socialLinks = [
    { name: "Google Scholar", href: homepageData.social.scholar },
    { name: "GitHub", href: homepageData.social.github },
    { name: "Twitter", href: homepageData.social.twitter },
  ];
</script>

<Seo
  title="Atrey Desai"
  description="Atrey Desai - undergraduate researcher at University of Maryland studying NLP, AI safety, and computational linguistics. Research on benchmark evaluation and multimodal reasoning."
  url="https://atreydesai.com"
/>

<div class="layout-main py-8 md:py-12">
  <section class="mb-8 md:mb-10">
    <!-- Mobile: flex-col. Desktop: grid with image spanning both rows so icons bottom = image bottom -->
    <div
      class="flex flex-col gap-8 md:grid md:grid-cols-[1fr_minmax(0,250px)] md:grid-rows-[1fr_auto]"
    >
      <!-- Text: col 1, row 1 -->
      <div class="md:col-start-1 md:row-start-1">
        <h1
          class="heading-display home-hero-heading text-3xl md:text-4xl text-ink-900 dark:text-cream-100 mb-4"
        >
          hi, i'm <HyperText text="atrey desai" />
        </h1>

        <div class="home-intro-copy space-y-4 text-ink-700 dark:text-cream-300">
          {#each homepageData.intro as paragraph}
            <p>
              {@html parseLinks(paragraph)}
            </p>
          {/each}
        </div>
      </div>

      <!-- Image: col 2, spans both rows -->
      <div class="md:col-start-2 md:row-start-1 md:row-span-2">
        <div class="relative w-full max-w-[250px] mx-auto md:mx-0">
          <div class="aspect-square w-full rounded-lg overflow-hidden">
            <LegoImage
              src="/images/profile.webp"
              alt="Atrey Desai"
              blockSize={48}
            />
          </div>
          <!-- Pixel boba peeking out of the corner — shakes + jingles on hover,
               launches the minigame on click. Hidden while the game is open. -->
          {#if !$bobaMode}
            <button
              type="button"
              class="boba-launcher"
              on:click={() => bobaMode.set(true)}
              on:mouseenter={sfxBoba}
              aria-label="Play the boba minigame"
              title="boba?"
            >
              <PixelIcon grid={bobaGrid} palette={bobaPal} px={6} />
            </button>
          {/if}
        </div>
      </div>

      <!-- Links: col 1, row 2 — bottom aligns with image bottom -->
      <div class="md:col-start-1 md:row-start-2 -mt-4 flex items-center text-sm">
        {#each socialLinks as link, i}
          {#if i > 0}
            <span class="mx-2 text-ink-700 dark:text-cream-300" aria-hidden="true">·</span>
          {/if}
          <a
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            title={link.name}
            class="link font-medium"
          >
            {link.name}
          </a>
        {/each}

        <span class="mx-2 text-ink-700 dark:text-cream-300" aria-hidden="true">·</span>
        <div class="relative inline-flex">
          <button
            type="button"
            on:click={copyEmail}
            title="Copy email"
            class="link font-[inherit] text-[length:inherit] font-medium cursor-pointer"
          >
            Email
          </button>
          {#if emailCopied}
            <span class="copied-tooltip">
              <span class="copied-triangle"></span>
              copied!
            </span>
          {/if}
        </div>
      </div>
    </div>
  </section>

  {#if homepageData.banner}
    <ScrollReveal animation="fade-up" delay={40}>
      <section class="mb-10 md:mb-12">
        <svg width="0" height="0" style="position:absolute" aria-hidden="true">
          <filter id="banner-rough">
            <feTurbulence type="fractalNoise" baseFrequency="0.028" numOctaves="3" seed="3" />
            <feDisplacementMap in="SourceGraphic" scale="6" />
          </filter>
          <filter id="banner-rough-strong">
            <feTurbulence type="fractalNoise" baseFrequency="0.034" numOctaves="3" seed="7" />
            <feDisplacementMap in="SourceGraphic" scale="9" />
          </filter>
        </svg>
        <div class="banner-riso-sketch-wrap relative">
          <div class="banner-riso-back" aria-hidden="true"></div>
          <div
            bind:this={bannerWrapperEl}
            role="presentation"
            on:click={handleBannerClick}
            on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleBannerClick(e as unknown as MouseEvent); }}
            class="banner-box banner-riso-front relative select-text px-5 py-4 md:px-6 md:py-5 text-ink-800 dark:text-cream-100"
          >
          <p class="relative z-10 text-sm md:text-base leading-relaxed">
            {@html parseBanner(homepageData.banner.lead)}
          </p>
          <p class="relative z-10 mt-2 text-sm md:text-base leading-relaxed">
            {@html parseBanner(homepageData.banner.body)}
          </p>
          {#if bannerCopied}
            <span
              class="banner-copied-tooltip"
              style="left: {bannerTooltipLeft}px; top: {bannerTooltipTop}px;"
            >
              <span class="copied-triangle"></span>
              copied!
            </span>
          {/if}
          </div>
        </div>
      </section>
    </ScrollReveal>
  {/if}

  <ScrollReveal animation="fade-up" delay={60}>
    <section class="mb-8">
      <div class="section-rule mb-6">
        <h2 class="section-heading mb-0">
          <a href="/about" class="hover:text-accent dark:hover:text-accent-light transition-colors duration-200">interests</a>
        </h2>
        <div class="section-rule-line"></div>
      </div>

      <div class="space-y-4 text-ink-700 dark:text-cream-300">
        <p>
          {@html parseLinks(homepageData.researchInterests.intro)}
        </p>
        <div class="space-y-3">
          {#each homepageData.researchInterests.items as item, i}
            <div>
              <p>{@html parseInterestText(item.text)}</p>
              {#if item.citations && item.citations.length > 0}
                <div class="mt-0.5 ml-6 flex gap-1.5 text-xs font-mono text-ink-400 dark:text-cream-500 leading-none">
                  <span class="text-ink-300 dark:text-cream-600">↳</span>
                  {#each item.citations as citation, ci}
                    {#if citation.url}
                      <a
                        href={citation.url}
                        class="hover:text-accent dark:hover:text-accent-light transition-colors duration-150"
                      >[{citation.label}]</a>
                    {:else}
                      <span class="relative inline-flex">
                        <button
                          type="button"
                          on:click={() => showCook(`${i}-${ci}`)}
                          class="cursor-pointer font-[inherit] text-[length:inherit] leading-none hover:text-accent dark:hover:text-accent-light transition-colors duration-150"
                        >[{citation.label}]</button>
                        {#if cookKey === `${i}-${ci}`}
                          <span class="copied-tooltip cook-tooltip">
                            <span class="copied-triangle"></span>
                            let me cook :)
                          </span>
                        {/if}
                      </span>
                    {/if}
                  {/each}
                </div>
              {/if}
            </div>
          {/each}
        </div>
        <div class="mt-4 text-xs leading-tight text-ink-400 dark:text-cream-500">
          <p class="font-mono">[IP] = in progress</p>
        </div>
      </div>
    </section>
  </ScrollReveal>

  <ScrollReveal animation="fade-up" delay={60}>
    <section class="mb-8">
      <div class="section-rule mb-6">
        <h2 class="section-heading mb-0">
          <a href="/research" class="hover:text-accent dark:hover:text-accent-light transition-colors duration-200">selected works</a>
        </h2>
        <div class="section-rule-line"></div>
      </div>

      <div class="space-y-1 stagger-children">
        {#each featuredPapers as paper (paper.id)}
          <ResearchCard {paper} variant="preview" />
        {/each}
      </div>
    </section>
  </ScrollReveal>
</div>

<style>
  .home-hero-heading {
    font-weight: 700;
    letter-spacing: -0.015em;
    line-height: 0.95;
  }

  .home-intro-copy {
    font-size: 1.125rem;
    line-height: 1.45;
  }

  /* Pixel boba sitting diagonally in the photo's bottom-right corner. */
  .boba-launcher {
    position: absolute;
    right: -14px;
    bottom: -14px;
    z-index: 5;
    padding: 0;
    border: 0;
    background: none;
    line-height: 0;
    cursor: pointer;
    transform: rotate(16deg);
    transition: transform 0.2s cubic-bezier(0.22, 1, 0.36, 1);
    filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.28));
  }
  .boba-launcher:hover {
    animation: boba-shake 0.4s ease-in-out infinite;
  }
  @keyframes boba-shake {
    0%,
    100% {
      transform: rotate(16deg) scale(1.08);
    }
    25% {
      transform: rotate(7deg) translateY(-1px) scale(1.08);
    }
    75% {
      transform: rotate(25deg) translateY(-1px) scale(1.08);
    }
  }
  /* Mouse/desktop only — the game needs a pointer to play. */
  @media (hover: none), (pointer: coarse) {
    .boba-launcher {
      display: none;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .boba-launcher:hover {
      animation: none;
      transform: rotate(16deg) scale(1.08);
    }
  }

  .copied-tooltip {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    top: calc(100% + 3px);
    z-index: 30;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    white-space: nowrap;
    pointer-events: none;
    background: #E85D4C;
    color: #fdf8f3;
    padding: 4px 11px;
    border-radius: 8px;
    animation: tooltip-pop 0.22s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  }

  /* Cook tooltip lives among the mono citation labels — match that font. */
  .cook-tooltip {
    font-family: var(--font-mono);
  }

  .copied-triangle {
    position: absolute;
    top: -3px;
    left: 50%;
    width: 8px;
    height: 8px;
    background: #E85D4C;
    border-radius: 2px;
    transform: translateX(-50%) rotate(45deg);
  }

  /* Riso + sketchy combo: a wobbly accent slab sits offset behind a wobbly
     bordered cream card. Both wobbles share the same SVG turbulence filter,
     so the misregister has a hand-printed feel. */
  .banner-riso-sketch-wrap {
    transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .banner-riso-sketch-wrap:hover {
    transform: translate(-2px, -2px);
  }

  /* Back accent slab — offset down/right, distorted edges */
  .banner-riso-back {
    position: absolute;
    top: 6px;
    left: 6px;
    right: -6px;
    bottom: -6px;
    background: #E85D4C;
    border-radius: 22px 6px 14px 8px;
    filter: url(#banner-rough-strong);
    pointer-events: none;
    z-index: 0;
    transition: top 0.3s cubic-bezier(0.22, 1, 0.36, 1),
      left 0.3s cubic-bezier(0.22, 1, 0.36, 1),
      right 0.3s cubic-bezier(0.22, 1, 0.36, 1),
      bottom 0.3s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .banner-riso-sketch-wrap:hover .banner-riso-back {
    top: 8px;
    left: 8px;
    right: -8px;
    bottom: -8px;
  }
  :global(.dark) .banner-riso-back {
    background: #F07563;
  }

  /* Front sheet — cream paper drawn on ::before with the SAME rough filter
     as the back slab, so both fills wobble together (no straight edge where
     cream meets accent). The sketchy outline lives on ::after. */
  .banner-riso-front {
    background: transparent;
    z-index: 1;
    isolation: isolate;
  }
  .banner-riso-front::before {
    content: "";
    position: absolute;
    inset: 0;
    background: #FBF2E8;
    border-radius: 14px 20px 14px 18px;
    filter: url(#banner-rough-strong);
    pointer-events: none;
    z-index: 0;
  }
  .banner-riso-front::after {
    content: "";
    position: absolute;
    inset: 0;
    border: 2.25px solid #1A1A1A;
    border-radius: 14px 20px 14px 18px;
    filter: url(#banner-rough-strong);
    pointer-events: none;
    z-index: 2;
  }
  :global(.dark) .banner-riso-front::before {
    background: #2a2422;
  }
  :global(.dark) .banner-riso-front::after {
    border-color: #fdf8f3;
  }

  :global(.banner-copy-btn) {
    font: inherit;
    background: none;
    border: 0;
    padding: 0;
    margin: 0;
    cursor: pointer;
    user-select: text;
    -webkit-user-select: text;
  }

  .banner-copied-tooltip {
    position: absolute;
    transform: translateX(-50%);
    z-index: 30;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    white-space: nowrap;
    pointer-events: none;
    background: #E85D4C;
    color: #fdf8f3;
    padding: 4px 11px;
    border-radius: 8px;
    animation: tooltip-pop 0.22s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  }

  /* Darker selection inside the banner so it stands out from the blush bg.
     Use :global so selection applies to all descendants — including @html-rendered
     <strong>/<a>/<button> which don't carry Svelte's scoping hash. */
  :global(.banner-box *::selection),
  :global(.banner-box::selection) {
    background: #E8B8A8;
    color: #1A1A1A;
  }
  :global(.dark .banner-box *::selection),
  :global(.dark .banner-box::selection) {
    background: #C94B3D;
    color: #fdf8f3;
  }

  @keyframes tooltip-pop {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(-8px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }
</style>
