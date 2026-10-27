<script lang="ts">
  import { onMount } from "svelte";
  import { afterNavigate } from "$app/navigation";
  import { page } from "$app/state";
  import DarkModeToggle from "./DarkModeToggle.svelte";
  import {
    MONOGRAM_A,
    MONOGRAM_D,
    WORDMARK_LETTERS,
    WORDMARK_SPLIT,
    WORDMARK_VIEWBOX,
  } from "$lib/wordmark";

  const links = [
    { name: "about", href: "/about/" },
    { name: "research", href: "/research/" },
    { name: "cv", href: "/cv/" },
    { name: "blog", href: "/blog/" },
    { name: "photography", href: "/photography/" },
    { name: "bookshelf", href: "/bookshelf/" },
  ];

  function isActive(href: string, pathname: string): boolean {
    const normalizedHref = href === "/" ? href : href.replace(/\/$/, "");
    const normalizedPath = pathname === "/" ? pathname : pathname.replace(/\/$/, "");
    return (
      normalizedPath === normalizedHref ||
      normalizedPath.startsWith(`${normalizedHref}/`)
    );
  }

  // The wordmark spells the full name at the top of every page and morphs
  // into the AD monogram once the page scrolls. Modelled on anthropic.com's
  // ANTHROPIC -> A\ header: same 15px threshold, and phones settle on the
  // monogram shortly after load. The home page opens with "hi, i'm atrey
  // desai" right under it, so there it stays on the monogram throughout.
  const COLLAPSE_AT_PX = 15;
  const PHONE_QUERY = "(max-width: 767px)";
  const PHONE_COLLAPSE_DELAY_MS = 400;

  // A true shape morph (GSAP MorphSVG). The a and the d are the anchors: each
  // bends into its capital, the a into the A and the d into the D, the d
  // travelling left as it goes. The rest of each word is absorbed into its
  // anchor: "trey" and "esai" ride in with it and squeeze to nothing,
  // so nothing crossfades. At the very end the two morphed letters hand over
  // to the monogram paths, which are identical, so the swap is invisible.
  // Expanding is the same timeline reversed, so turning around mid-way just
  // carries on from wherever it is.
  const MORPH_S = 0.46;
  const MORPH_DELAY_S = 0;
  // Share of the morph over which the absorbed letters squeeze to nothing.
  const SQUEEZE_SHARE = 0.7;
  const EXPAND_SPEED = 1.15; // a touch quicker on the way back out
  const A_INDEX = 0;
  const D_INDEX = WORDMARK_SPLIT;
  // The monogram is traced standing on the baseline, but it is taller than
  // the nav's capitals, so there it rode high. Collapsing lowers it by this
  // much (1/100 em, the outline units) to centre it on the nav's cap height,
  // the line the theme toggle's icon is centred on too.
  const MARK_DROP = 10.5;

  let scrollY = 0;
  let phoneCollapsed = false;
  let svgEl: SVGSVGElement;
  let timeline: gsap.core.Timeline | null = null;
  let reduceMotion = false;
  // Tracked by hand: a legacy `$:` statement does not see page changes.
  let pathname = page.url.pathname;
  afterNavigate(() => (pathname = page.url.pathname));

  $: collapsed = pathname === "/" || phoneCollapsed || scrollY > COLLAPSE_AT_PX;
  $: if (timeline) play(collapsed);

  function play(collapse: boolean) {
    if (!timeline) return;
    if (reduceMotion) {
      timeline.progress(collapse ? 1 : 0).pause();
    } else if (collapse) {
      timeline.timeScale(1).play();
    } else {
      timeline.timeScale(EXPAND_SPEED).reverse();
    }
  }

  onMount(() => {
    reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let disposed = false;

    // GSAP only loads after the page is up; until then (and without script)
    // the SVG shows the full name, or the still monogram where the header
    // starts collapsed.
    Promise.all([import("gsap"), import("gsap/MorphSVGPlugin")]).then(
      ([{ gsap }, { MorphSVGPlugin }]) => {
        if (disposed) return;
        gsap.registerPlugin(MorphSVGPlugin);
        const letters = [...svgEl.querySelectorAll<SVGPathElement>(".wordmark-letter")];
        const marks = [...svgEl.querySelectorAll<SVGPathElement>(".wordmark-mark")];
        const centre = (el: SVGGraphicsElement) => {
          const box = el.getBBox();
          return box.x + box.width / 2;
        };
        const targets = marks.map(centre);
        const morph = { duration: MORPH_S, ease: "power3.inOut" };
        const tl = gsap.timeline({ paused: true });
        letters.forEach((letter, i) => {
          const word = i < WORDMARK_SPLIT ? 0 : 1;
          if (i === A_INDEX || i === D_INDEX) {
            tl.to(
              letter,
              { morphSVG: { shape: marks[word], shapeIndex: "auto" }, ...morph },
              MORPH_DELAY_S,
            );
          } else {
            // Travel in lockstep with the anchor (same timing and curve), so
            // these letters ride into the a or the d rather than overtaking
            // it, and squeeze out before they arrive.
            tl.to(
              letter,
              { x: targets[word] - centre(letter), ...morph },
              MORPH_DELAY_S,
            ).to(
              letter,
              {
                scaleX: 0,
                scaleY: 0.6,
                transformOrigin: "50% 70%",
                duration: MORPH_S * SQUEEZE_SHARE,
                ease: "power2.in",
              },
              MORPH_DELAY_S,
            );
          }
        });
        tl.to(svgEl, { "--mark-drop": 1, ...morph }, MORPH_DELAY_S);
        tl.set(letters, { autoAlpha: 0 }).set(marks, { autoAlpha: 1 }, "<");
        timeline = tl;
        // A page that loads already scrolled starts collapsed, without playing.
        if (collapsed) tl.progress(1);
      },
    );

    const phone = window.matchMedia(PHONE_QUERY);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const syncPhone = () => {
      clearTimeout(timer);
      if (phone.matches) {
        timer = setTimeout(() => (phoneCollapsed = true), PHONE_COLLAPSE_DELAY_MS);
      } else {
        phoneCollapsed = false;
      }
    };
    syncPhone();
    phone.addEventListener("change", syncPhone);
    return () => {
      disposed = true;
      clearTimeout(timer);
      phone.removeEventListener("change", syncPhone);
      timeline?.kill();
    };
  });
</script>

<svelte:window bind:scrollY />

<!-- Full-width so the sticky band covers wide pages too; the inner shell keeps
     the usual measure. Sticky only from md up: on phones the nav wraps under
     the wordmark and a pinned header would eat too much of the screen. -->
<header
  class="site-header layer-sticky w-full md:sticky"
  data-sveltekit-preload-code="eager"
>
  <div class="page-shell-standard pt-7 md:pb-3 md:pt-8">
    <div class="flex flex-col gap-2 md:flex-row md:items-baseline md:justify-between md:gap-6">
      <!-- Just the wordmark: the page's own title and the highlighted nav item
           already say where you are. -->
      <a
        href="/"
        aria-label="atrey desai, home"
        class="wordmark w-fit shrink-0 text-base leading-none text-ink-900 transition-colors duration-200 hover:text-accent-dark dark:text-cream-100 dark:hover:text-accent"
      >
        <!-- Invisible live text under the drawing: it gives the link the same
             baseline as the nav, so the two line up exactly as before. -->
        <span class="wordmark-text" aria-hidden="true">atrey desai</span>
        <svg
          class="wordmark-svg"
          viewBox={WORDMARK_VIEWBOX}
          aria-hidden="true"
          focusable="false"
          class:wordmark-still-mark={collapsed && !timeline}
          style="--mark-shift: {MARK_DROP / 100}em"
          bind:this={svgEl}
        >
          <g class="wordmark-letters">
            {#each WORDMARK_LETTERS as d}
              <path class="wordmark-letter" {d} />
            {/each}
          </g>
          <path class="wordmark-mark" d={MONOGRAM_A} />
          <path class="wordmark-mark" d={MONOGRAM_D} />
          <!-- The monogram before GSAP arrives, for a header that starts
               collapsed (the home page). Kept apart from the morph's own paths
               so the timeline reads their true resting state. -->
          <g class="wordmark-still" transform="translate(0 {MARK_DROP})">
            <path d={MONOGRAM_A} />
            <path d={MONOGRAM_D} />
          </g>
        </svg>
      </a>

      <div class="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-3 md:flex md:w-auto md:items-center">
        <nav
          aria-label="Site pages"
          class="type-nav flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1"
        >
          {#each links as link (link.href)}
            {@const active = isActive(link.href, page.url.pathname)}
            <a
              href={link.href}
              aria-current={active ? "page" : undefined}
              class="whitespace-nowrap transition-colors duration-200 {active ? 'text-accent-dark dark:text-accent-light' : 'text-ink-500 hover:text-accent-dark dark:text-cream-400 dark:hover:text-accent'}"
            >
              {link.name}
            </a>
          {/each}
        </nav>
        <DarkModeToggle />
      </div>
    </div>
  </div>
</header>

<style>
  /* Pinned band in the page colour, with no rule under it, so it reads as part
     of the page. It sticks at a negative offset: the first 1.25rem of its top
     padding scrolls away before it pins, so the pinned bar is slimmer than the
     resting header without changing the page's layout. */
  @media (min-width: 768px) {
    .site-header {
      top: -1.25rem;
      background-color: var(--color-surface-page);
    }
  }

  /* The text and the drawing share one grid cell. The text is set exactly as
     the outlines were traced (NHG Text 500, -0.01em), so its baseline is the
     drawing's baseline. */
  .wordmark {
    display: inline-grid;
    font-family: var(--font-ui);
    font-weight: 500;
    letter-spacing: -0.01em;
  }

  .wordmark-text,
  .wordmark-svg {
    grid-area: 1 / 1;
  }

  .wordmark-text {
    color: transparent;
    white-space: nowrap;
    user-select: none;
  }

  /* 1em tall to match the line box the outlines were traced in; the
     descender of the y hangs just below it. */
  .wordmark-svg {
    --mark-drop: 0;
    align-self: start;
    height: 1em;
    width: auto;
    overflow: visible;
    fill: currentColor;
    /* The morph carries --mark-drop from 0 to 1, lowering the monogram onto
       the nav's centre line (MARK_DROP). */
    transform: translateY(calc(var(--mark-drop) * var(--mark-shift)));
  }

  .wordmark-mark,
  .wordmark-still {
    opacity: 0;
    visibility: hidden;
  }

  /* Only until the timeline takes over; it then sets the collapsed state on
     the morph's own paths. */
  .wordmark-still-mark .wordmark-letters {
    opacity: 0;
  }

  .wordmark-still-mark .wordmark-still {
    opacity: 1;
    visibility: visible;
  }
</style>
