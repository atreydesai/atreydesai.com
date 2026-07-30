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
  import { bobaMode, openBoba } from "$lib/boba";
  import { sfxBoba, unlockAudio } from "$lib/sfx";

  // Little pixel boba tucked in the photo corner: a random drink + straw
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

  let projectsOpen = false;

  // banner.lead embeds the projects toggle inline as a "{label}" token,
  // e.g. "…about my {ongoing projects}": split it into text around the toggle.
  const bannerLeadMatch = (homepageData.banner?.lead ?? "").match(/^(.*)\{([^}]+)\}(.*)$/);
  const bannerLead = bannerLeadMatch
    ? { pre: bannerLeadMatch[1], label: bannerLeadMatch[2], post: bannerLeadMatch[3] }
    : { pre: homepageData.banner?.lead ?? "", label: "ongoing projects", post: "" };

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

  const interestRows = homepageData.researchInterests.items.map((item) => ({
    ...item,
    citations: item.citations ?? [],
  }));

  let researchExpanded = false;

  function toggleResearchDetails() {
    researchExpanded = !researchExpanded;
  }

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

  const socialLinks = [
    { name: "Google Scholar", href: homepageData.social.scholar },
    { name: "GitHub", href: homepageData.social.github },
    { name: "Twitter", href: homepageData.social.twitter },
  ];
</script>

<Seo
  title="Atrey Desai"
  description="Atrey Desai - undergraduate researcher at University of Maryland studying NLP, AI safety, and computational linguistics. Research on benchmark evaluation and multimodal reasoning."
  url="https://atreydesai.com/"
/>

<div class="page-shell page-shell-standard">
  <section class="section-gap">
    <!-- Mobile: intro and links above the image. Desktop: text and image side by side. -->
    <div
      class="flex flex-col gap-8 md:grid md:grid-cols-[1fr_minmax(0,250px)]"
    >
      <div class="md:col-start-1">
        <h1 class="type-page-title mb-4 text-ink-900 dark:text-cream-100">
          hi, i'm <HyperText class="ml-[0.18em]" text="atrey desai" />
        </h1>

        <div class="type-deck flow-prose text-ink-700 dark:text-cream-300">
          {#each homepageData.intro as paragraph}
            <p>
              {@html parseLinks(paragraph)}
            </p>
          {/each}
        </div>

        <div class="mt-4 flex items-center text-sm">
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

      <div class="md:col-start-2">
        <div class="relative w-full max-w-[250px] mx-auto md:mx-0">
          <div class="aspect-square w-full rounded-lg overflow-hidden">
            <LegoImage
              src="/images/profile.webp"
              alt="Atrey Desai"
              blockSize={48}
            />
          </div>
          <!-- Pixel boba peeking out of the corner: shakes + jingles on hover,
               launches the minigame on click. Hidden while the game is open. -->
          {#if !$bobaMode}
            <button
              type="button"
              class="boba-launcher"
              on:click={openBoba}
              on:mouseenter={sfxBoba}
              aria-label="Play the boba minigame"
              title="boba?"
            >
              <PixelIcon grid={bobaGrid} palette={bobaPal} px={6} />
            </button>
          {/if}
        </div>
      </div>
    </div>
  </section>

  {#if homepageData.banner}
    <ScrollReveal animation="fade-up" delay={40}>
      <section class="section-gap">
        <!-- Filter regions are widened so the displaced edges never clip
             against the default 110% filter box on a short banner. -->
        <svg width="0" height="0" style="position:absolute" aria-hidden="true">
          <filter id="banner-rough" x="-15%" y="-30%" width="130%" height="160%">
            <feTurbulence type="fractalNoise" baseFrequency="0.028" numOctaves="3" seed="3" />
            <feDisplacementMap in="SourceGraphic" scale="6" />
          </filter>
          <filter id="banner-rough-strong" x="-15%" y="-30%" width="130%" height="160%">
            <feTurbulence type="fractalNoise" baseFrequency="0.034" numOctaves="3" seed="7" />
            <feDisplacementMap in="SourceGraphic" scale="9" />
          </filter>
        </svg>
        <div class="banner-riso-sketch-wrap relative">
          <div class="banner-riso-back" aria-hidden="true"></div>
          <div
            class="banner-box banner-riso-front relative select-text px-5 py-4 md:px-6 text-ink-800 dark:text-cream-100"
          >
            <!-- One-line banner: the "{label}" token in banner.lead becomes
                 the click-to-expand projects toggle, inline in the sentence. -->
            <p class="type-body-small relative z-10">
              {@html parseBanner(bannerLead.pre)}<button
                type="button"
                class="banner-toggle link font-[inherit] text-[length:inherit] font-medium cursor-pointer select-none"
                aria-expanded={projectsOpen}
                aria-controls="banner-projects-list"
                on:click={() => (projectsOpen = !projectsOpen)}
              ><span class="banner-toggle-label">{bannerLead.label}</span><span
                  class="banner-caret ml-1"
                  class:banner-caret-open={projectsOpen}
                  aria-hidden="true">▸</span
                ></button>{@html parseBanner(bannerLead.post)}
            </p>
            <div
              id="banner-projects-list"
              class="banner-projects-shell"
              class:banner-projects-shell-open={projectsOpen}
              aria-hidden={!projectsOpen}
              inert={!projectsOpen}
            >
              <div class="banner-projects-inner">
                <ol
                  class="type-body-small relative z-10 mt-2.5 space-y-1.5"
                >
                  {#each homepageData.banner.projects as project, i}
                    <li
                      class="banner-project-item flex items-baseline gap-2.5"
                      style="--project-delay: {i * 40}ms"
                    >
                      <span
                        class="font-mono text-xs text-ink-400 dark:text-cream-500 select-none"
                        aria-hidden="true">{String(i + 1).padStart(2, "0")}</span
                      >
                      <span>{@html parseBanner(project)}</span>
                    </li>
                  {/each}
                </ol>
              </div>
            </div>
          </div>
        </div>
      </section>
    </ScrollReveal>
  {/if}

  <ScrollReveal animation="fade-up" delay={60}>
    <section class="section-gap">
      <div class="section-rule mb-6">
        <h2 class="section-heading mb-0">
          <a href="/about/" class="hover:text-accent dark:hover:text-accent-light transition-colors duration-200">interests</a>
        </h2>
        <div class="section-rule-line"></div>
      </div>

      <div class="space-y-2 text-ink-700 dark:text-cream-300">
        <p>
          {@html parseLinks(homepageData.researchInterests.intro)}
        </p>

        <div>
          <div>
            <button
              type="button"
              class="research-toggle"
              aria-expanded={researchExpanded}
              aria-controls="research-interest-list"
              aria-label={researchExpanded
                ? "Show concise research summaries"
                : "Show full research questions"}
              on:click={toggleResearchDetails}
            >
              <span
                class="research-toggle-caret"
                class:research-toggle-caret-open={researchExpanded}
                aria-hidden="true">▸</span
              >
              <span>{researchExpanded ? "want a summary?" : "want more detail?"}</span>
            </button>
          </div>

          <ol id="research-interest-list">
            {#each interestRows as item, i}
              <li
                class="research-interest-row grid grid-cols-[2.25rem_minmax(0,1fr)] items-baseline gap-3 py-3"
                class:research-interest-row-expanded={researchExpanded}
                style="--interest-delay: {i * 40}ms"
              >
                <button
                  type="button"
                  class="research-interest-index font-mono text-xs text-ink-400 dark:text-cream-500"
                  aria-expanded={researchExpanded}
                  aria-controls="research-interest-list"
                  aria-label={`${researchExpanded ? "Show concise summaries for" : "Show full details for"} all research interests`}
                  on:click={toggleResearchDetails}
                >
                  {String(i + 1).padStart(2, "0")}
                </button>
                <div class="min-w-0">
                  <p class="font-medium text-ink-900 dark:text-cream-100">
                    <button
                      type="button"
                      class="research-interest-title"
                      aria-expanded={researchExpanded}
                      aria-controls="research-interest-list"
                      aria-label={`${researchExpanded ? "Show concise summary for" : "Show full details for"} all research interests`}
                      on:click={toggleResearchDetails}
                    >
                      {item.title}
                    </button>
                  </p>

                  <div
                    class="interest-summary-shell"
                    aria-hidden={researchExpanded}
                  >
                    <div class="interest-copy-inner">
                      <p class="mt-0.5 text-sm leading-snug text-ink-500 dark:text-cream-400">
                        {item.summary}
                      </p>
                    </div>
                  </div>

                  <div
                    class="interest-question-shell"
                    aria-hidden={!researchExpanded}
                    inert={!researchExpanded}
                  >
                    <div class="interest-copy-inner">
                      <p class="mt-0.5 text-sm leading-relaxed text-ink-600 dark:text-cream-300">
                        {@html parseInterestText(item.question)}
                      </p>
                      {#if item.citations.length > 0}
                        <div class="mt-1.5 flex flex-wrap gap-1.5 font-mono text-xs leading-none text-ink-400 dark:text-cream-500">
                          <span class="text-ink-300 dark:text-cream-600">↳</span>
                          {#each item.citations as citation, ci}
                            {#if citation.url}
                              <a
                                href={citation.url}
                                class="transition-colors duration-150 hover:text-accent dark:hover:text-accent-light"
                              >[{citation.label}]</a>
                            {:else}
                              <span class="relative inline-flex">
                                <button
                                  type="button"
                                  on:click={() => showCook(`${i}-${ci}`)}
                                  class="cursor-pointer font-[inherit] text-[length:inherit] leading-none transition-colors duration-150 hover:text-accent dark:hover:text-accent-light"
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
                      {#if i === interestRows.length - 1}
                        <p class="mt-2 font-mono text-xs leading-tight text-ink-400 dark:text-cream-500">
                          [IP] = in progress
                        </p>
                      {/if}
                    </div>
                  </div>
                </div>
              </li>
            {/each}
          </ol>
        </div>
      </div>
    </section>
  </ScrollReveal>

  <ScrollReveal animation="fade-up" delay={60}>
    <section>
      <div class="section-rule mb-6">
        <h2 class="section-heading mb-0">
          <a href="/research/" class="hover:text-accent dark:hover:text-accent-light transition-colors duration-200">selected works</a>
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
  .research-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: flex-start;
    gap: var(--space-1-5);
    border-radius: var(--radius-control);
    color: theme("colors.ink.500");
    font-family: var(--font-mono);
    font-size: 0.75rem;
    font-weight: 500;
    line-height: 1;
    cursor: pointer;
    transition: color var(--motion-base) var(--ease-standard);
  }
  .research-toggle:hover {
    color: theme("colors.accent.dark");
  }
  .research-toggle:focus-visible {
    outline: 2px solid rgb(232 93 76 / 0.4);
    outline-offset: 4px;
  }
  :global(.dark) .research-toggle {
    color: theme("colors.cream.400");
  }
  :global(.dark) .research-toggle:hover {
    color: theme("colors.accent.light");
  }
  .research-toggle-caret {
    display: inline-block;
    transform-origin: center;
    transition: transform var(--motion-slow) var(--ease-emphasized);
  }
  .research-toggle-caret-open {
    transform: rotate(90deg);
  }
  .research-interest-title {
    border-radius: var(--radius-control);
    color: inherit;
    font: inherit;
    cursor: pointer;
    transition: color var(--motion-base) var(--ease-standard);
  }
  .research-interest-index {
    align-self: baseline;
    justify-self: start;
    border-radius: var(--radius-control);
    cursor: pointer;
    transition: color var(--motion-base) var(--ease-standard);
  }
  .research-interest-title:hover,
  .research-interest-index:hover {
    color: theme("colors.accent.dark");
  }
  .research-interest-title:focus-visible,
  .research-interest-index:focus-visible {
    outline: 2px solid rgb(232 93 76 / 0.4);
    outline-offset: 4px;
  }
  :global(.dark) .research-interest-title:hover,
  :global(.dark) .research-interest-index:hover {
    color: theme("colors.accent.light");
  }

  .interest-summary-shell,
  .interest-question-shell,
  .banner-projects-shell {
    display: grid;
    transition:
      grid-template-rows var(--motion-reveal) var(--ease-emphasized),
      opacity var(--motion-base) var(--ease-standard),
      transform var(--motion-reveal) var(--ease-emphasized);
  }
  .interest-summary-shell,
  .interest-question-shell {
    transition-delay: var(--interest-delay, 0ms);
  }
  .interest-summary-shell {
    grid-template-rows: 1fr;
    opacity: 1;
    transform: translateY(0);
  }
  .interest-question-shell {
    grid-template-rows: 0fr;
    opacity: 0;
    transform: translateY(8px);
  }
  .interest-copy-inner,
  .banner-projects-inner {
    min-height: 0;
    overflow: hidden;
  }
  .research-interest-row-expanded .interest-summary-shell {
    grid-template-rows: 0fr;
    opacity: 0;
    transform: translateY(-6px);
  }
  .research-interest-row-expanded .interest-question-shell {
    grid-template-rows: 1fr;
    opacity: 1;
    transform: translateY(0);
  }
  /*
   * The inner wrapper must clip while its row is collapsing, but an expanded
   * question needs to let citation popovers escape its bounds. Without this,
   * the first two rows hide "let me cook :)" below the question; the final row
   * only appears to work because its extra legend gives the popover room.
   */
  .research-interest-row-expanded .interest-question-shell .interest-copy-inner {
    overflow: visible;
  }

  /*
   * Mobile Safari can resolve an animated 1fr track before wrapped copy has
   * reached its final height, leaving the overflow-hidden inner clipped.
   * Let the active panel use normal document flow on small screens instead.
   */
  @media (max-width: 767px) {
    .research-interest-row {
      align-items: start;
    }
    .interest-summary-shell,
    .interest-question-shell,
    .research-interest-row-expanded .interest-summary-shell,
    .research-interest-row-expanded .interest-question-shell {
      grid-template-rows: none;
      transform: none;
      transition: none;
    }
    .interest-summary-shell {
      display: block;
      opacity: 1;
    }
    .interest-question-shell {
      display: none;
    }
    .research-interest-row-expanded .interest-summary-shell {
      display: none;
    }
    .research-interest-row-expanded .interest-question-shell {
      display: block;
      opacity: 1;
    }
    .interest-copy-inner {
      overflow: visible;
    }
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
  /* Mouse/desktop only: the game needs a pointer to play. */
  @media (max-width: 767px), (hover: none), (pointer: coarse) {
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
    z-index: var(--layer-tooltip);
    font-family: var(--font-mono);
    font-size: 0.75rem;
    white-space: nowrap;
    pointer-events: none;
    background: #E85D4C;
    color: #fdf8f3;
    padding: var(--space-1) var(--space-3);
    border-radius: var(--radius-inline);
    animation: tooltip-pop var(--motion-base) var(--ease-emphasized) forwards;
  }

  /* Cook tooltip lives among the mono citation labels: match that font. */
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
    transition: transform var(--motion-slow) var(--ease-emphasized);
  }
  .banner-riso-sketch-wrap:hover {
    transform: translate(-2px, -2px);
  }

  /* Back accent slab: offset down/right, distorted edges */
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
    transition:
      top var(--motion-slow) var(--ease-emphasized),
      left var(--motion-slow) var(--ease-emphasized),
      right var(--motion-slow) var(--ease-emphasized),
      bottom var(--motion-slow) var(--ease-emphasized);
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

  /* Front sheet: cream paper drawn on ::before with the SAME rough filter
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

  /* Hover underline belongs to the label only: never the caret. */
  .banner-toggle:hover {
    text-decoration: none;
  }
  .banner-toggle:hover .banner-toggle-label {
    text-decoration: underline;
    text-decoration-color: currentColor;
    text-underline-offset: 3px;
  }

  /* Disclosure caret for the projects toggle: rotates a quarter turn open. */
  .banner-caret {
    display: inline-block;
    font-size: 0.85em;
    line-height: 1;
    transition: transform var(--motion-base) var(--ease-emphasized);
  }
  .banner-caret-open {
    transform: rotate(90deg);
  }

  .banner-projects-shell {
    grid-template-rows: 0fr;
    opacity: 0;
    transform: translateY(8px);
  }
  .banner-projects-shell-open {
    grid-template-rows: 1fr;
    opacity: 1;
    transform: translateY(0);
  }
  .banner-project-item {
    opacity: 0;
    transform: translateY(8px);
    transition:
      opacity var(--motion-base) var(--ease-standard),
      transform var(--motion-reveal) var(--ease-emphasized);
  }
  .banner-projects-shell-open .banner-project-item {
    opacity: 1;
    transform: translateY(0);
    transition-delay: var(--project-delay, 0ms);
  }

  @media (prefers-reduced-motion: reduce) {
    .banner-caret {
      transition: none;
    }
  }

  /* Darker selection inside the banner so it stands out from the blush bg.
     Use :global so selection applies to all descendants: including @html-rendered
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
