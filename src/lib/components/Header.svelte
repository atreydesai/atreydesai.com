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
  } from "#lib/wordmark.ts";
  import { MORPH_A, MORPH_D } from "#lib/wordmark-morph.ts";

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

    return normalizedPath === normalizedHref || normalizedPath.startsWith(`${normalizedHref}/`);
  }

  // The wordmark spells the full name at the top of every page and morphs
  // into the AD monogram once the page scrolls. Modelled on anthropic.com's
  // ANTHROPIC -> A\ header: same 15px threshold, and phones settle on the
  // monogram shortly after load. The home page opens with "hi, i'm atrey
  // desai" right under it, so there it stays on the monogram throughout.
  const COLLAPSE_AT_PX = 15;
  const PHONE_QUERY = "(max-width: 767px)";
  const PHONE_COLLAPSE_DELAY_MS = 400;

  // A true shape morph (designed with GSAP MorphSVG, now precomputed and
  // played natively, see below). The a and the d are the anchors: each
  // bends into its capital, the a into the A and the d into the D, the d
  // travelling left as it goes. The rest of each word is absorbed into its
  // anchor: "trey" and "esai" ride in with it and squeeze to nothing,
  // so nothing crossfades. At the very end the two morphed letters hand over
  // to the monogram paths, which are identical, so the swap is invisible.
  // Expanding is the same morph played back, so turning around mid-way just
  // carries on from wherever it is.
  const MORPH_S = 0.46;
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
  // Set once the morph is wired up on mount; until then (and without script)
  // the SVG shows the full name, or the still monogram where the header
  // starts collapsed.
  let ready = false;
  let reduceMotion = false;
  // Tracked by hand: a legacy `$:` statement does not see page changes.
  let pathname = page.url.pathname;

  afterNavigate(({ shallow, type }) => {
    if (shallow && type === 'goto') return;

    return pathname = page.url.pathname;
  });

  $: collapsed = pathname === "/" || phoneCollapsed || scrollY > COLLAPSE_AT_PX;
  $: if (ready) play(collapsed);

  // The morph was designed in GSAP with power3.inOut (a quartic) for the
  // travel and the shape change, and power2.in (a cubic) for the squeeze; it
  // now runs on its own, with those same curves. MorphSVG's part, rewriting
  // each letter and its capital into matching segments, is precomputed
  // (scripts/wordmark-morph.mjs), which leaves interpolating numbers.
  const easeInOutQuart = (t: number) => (t < 0.5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2);
  const easeInCubic = (t: number) => t ** 3;

  /** A morph between two outlines that share their segments, at 0..1. */
  function interpolator([from, to]: readonly [string, string]) {
    const NUMBER = /-?\d*\.?\d+(?:e-?\d+)?/g;
    const a = (from.match(NUMBER) ?? []).map(Number);
    const b = (to.match(NUMBER) ?? []).map(Number);
    const parts = from.split(NUMBER);
    return (t: number) => {
      let d = parts[0];
      for (let i = 0; i < a.length; i++) d += +(a[i] + (b[i] - a[i]) * t).toFixed(2) + parts[i + 1];
      return d;
    };
  }

  // One number drives the whole morph, like the timeline it replaces:
  // 0 is the full name, 1 the monogram. Collapsing plays it forward over
  // MORPH_S; expanding plays it back, EXPAND_SPEED times as fast, from
  // wherever it is, so turning around mid-way just carries on.
  let progress = 0;
  let goal = 0;
  let frame = 0;
  let last = 0;
  let render: (p: number) => void = () => {};

  function play(collapse: boolean) {
    goal = collapse ? 1 : 0;
    if (reduceMotion) {
      progress = goal;
      render(progress);
    } else if (!frame && progress !== goal) {
      last = performance.now();
      frame = requestAnimationFrame(step);
    }
  }

  function step(now: number) {
    const elapsed = Math.min(0.1, (now - last) / 1000);
    last = now;
    const rate = (goal > progress ? 1 : EXPAND_SPEED) / MORPH_S;
    progress =
      goal > progress ? Math.min(goal, progress + elapsed * rate) : Math.max(goal, progress - elapsed * rate);
    render(progress);
    frame = progress === goal ? 0 : requestAnimationFrame(step);
  }

  onMount(() => {
    reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const letters = [...svgEl.querySelectorAll<SVGPathElement>(".wordmark-letter")];
    const marks = [...svgEl.querySelectorAll<SVGPathElement>(".wordmark-mark")];
    const centre = (box: DOMRect) => box.x + box.width / 2;
    const targets = marks.map((mark) => centre(mark.getBBox()));
    const morphs = [interpolator(MORPH_A), interpolator(MORPH_D)];
    const plans = letters.map((letter, i) => {
      const box = letter.getBBox();
      return {
        letter,
        word: i < WORDMARK_SPLIT ? 0 : 1,
        // The a and the d bend into their capitals; the rest of each word
        // travels in lockstep with its anchor (same timing and curve), so it
        // rides in rather than overtaking it, and squeezes to nothing on the
        // way, about a point 50% across and 70% down its own box.
        anchor: i === A_INDEX || i === D_INDEX,
        outline: letter.getAttribute("d") ?? "",
        dx: targets[i < WORDMARK_SPLIT ? 0 : 1] - centre(box),
        ox: box.x + box.width * 0.5,
        oy: box.y + box.height * 0.7,
      };
    });

    render = (p) => {
      const travel = easeInOutQuart(p);
      const squeeze = easeInCubic(Math.min(1, p / SQUEEZE_SHARE));
      // At the very end the morphed letters hand over to the monogram paths,
      // which are identical, so the swap is invisible.
      const done = p >= 1;
      for (const plan of plans) {
        if (plan.anchor) {
          plan.letter.setAttribute("d", p === 0 ? plan.outline : morphs[plan.word](travel));
        } else if (p === 0) {
          plan.letter.removeAttribute("transform");
        } else {
          plan.letter.setAttribute(
            "transform",
            `translate(${plan.dx * travel + plan.ox} ${plan.oy}) scale(${1 - squeeze} ${1 - 0.4 * squeeze}) translate(${-plan.ox} ${-plan.oy})`,
          );
        }
        plan.letter.style.visibility = done ? "hidden" : "";
        plan.letter.style.opacity = done ? "0" : "";
      }
      for (const mark of marks) {
        mark.style.visibility = done ? "visible" : "";
        mark.style.opacity = done ? "1" : "";
      }
      svgEl.style.setProperty("--mark-drop", String(travel));
    };

    // A page that loads already collapsed (the home page, or scrolled) starts
    // at the monogram, without playing.
    progress = goal = collapsed ? 1 : 0;
    render(progress);
    ready = true;

    const phone = window.matchMedia(PHONE_QUERY);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const syncPhone = () => {
      clearTimeout(timer);
      if (phone.matches) {
        timer = setTimeout(() => phoneCollapsed = true, PHONE_COLLAPSE_DELAY_MS);
      } else {
        phoneCollapsed = false;
      }
    };
    syncPhone();
    phone.addEventListener("change", syncPhone);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      phone.removeEventListener("change", syncPhone);
    };
  });
</script>

<svelte:window bind:scrollY></svelte:window>

<!-- Full-width so the sticky band covers wide pages too; the inner shell keeps
     the usual measure. Sticky only from md up: on phones the nav wraps under
     the wordmark and a pinned header would eat too much of the screen.
     Nav links preload on hover (or touch), like every link via app.html:
     loading every page's code up front cost each first visit ~30 requests. -->
<header class="site-header layer-sticky w-full md:sticky">
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
          class:wordmark-still-mark={collapsed && !ready}
          style="--mark-shift: {MARK_DROP / 100}em"
          bind:this={svgEl}
        >
          <g class="wordmark-letters">
            {#each WORDMARK_LETTERS as d}
              <path class="wordmark-letter" d={d}></path>
            {/each}
          </g>
          <path class="wordmark-mark" d={MONOGRAM_A}></path>
          <path class="wordmark-mark" d={MONOGRAM_D}></path>
          <!-- The monogram before the morph is wired up, for a header that
               starts collapsed (the home page). Kept apart from the morph's own
               paths so it reads their true resting state. -->

          <g
            class="wordmark-still"
            transform="translate(0 {MARK_DROP})"
          >
            <path d={MONOGRAM_A}></path>
            <path d={MONOGRAM_D}></path>
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

  /* Only until the morph is wired up; it then sets the collapsed state on
     the morph's own paths. */
  .wordmark-still-mark .wordmark-letters {
    opacity: 0;
  }

  .wordmark-still-mark .wordmark-still {
    opacity: 1;
    visibility: visible;
  }
</style>
