<script lang="ts">
  // The homepage banner as a log. Its first row is the pinned sentence (the
  // `pinned` slot), dated the day it went up, with the drawn pushpin as its
  // key. It stays first whatever its date. Beneath it, the dated updates
  // scroll in a short window: about three rows show, and a paper-coloured
  // fade at the bottom edge says there is more.
  // Each row is [date] [text], with a key hanging in the margin ahead of the
  // date for the pin and the kinds that have one; written things take none.
  import { onMount } from "svelte";
  import { markHtml, type UpdateMarkKind } from "$lib/marks";
  import { parseInline } from "$lib/utils/text";
  import type { BannerUpdate, BannerUpdateKind } from "$lib/content";

  export let updates: BannerUpdate[] = [];
  /** "YYYY-MM-DD": when the pinned sentence went up. */
  export let pinnedDate: string | undefined = undefined;

  const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  // The drawn key for each kind. `paper` has none: written things are the
  // log's usual business and read fine with only a date.
  const MARKS: Record<BannerUpdateKind, UpdateMarkKind | null> = {
    paper: null,
    read: "read",
    talk: "talk",
    milestone: "milestone",
    note: "note",
  };
  // Said before the text so the kind isn't carried by the drawn key alone.
  const KIND_WORDS: Record<BannerUpdateKind, string> = {
    paper: "Paper:",
    read: "Reading:",
    talk: "Talk:",
    milestone: "Milestone:",
    note: "",
  };

  // Newest first. ISO dates sort as strings, which also keeps a date from
  // ever passing through a timezone.
  $: sorted = [...updates].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  $: newestYear = String(sorted[0]?.date ?? pinnedDate ?? "").split("-")[0];

  // "nov 12" within the newest entry's year, "nov ’25" outside it: the short
  // year keeps every label inside the one date column, so an old entry never
  // widens it and pushes the whole log's text over. Split from the string,
  // never through Date, so an entry can't shift a day.
  function formatDate(date: string, newest: string): string {
    const [year, month, day] = String(date).split("-");
    const name = MONTHS[Number(month) - 1];
    if (!name || !day) return String(date);
    return year === newest ? `${name} ${Number(day)}` : `${name} ’${year.slice(-2)}`;
  }

  $: pinnedLabel = pinnedDate ? formatDate(pinnedDate, newestYear) : "";

  $: rows = sorted.map((update) => {
    const kind: BannerUpdateKind =
      update.kind && update.kind in MARKS ? update.kind : "note";
    const mark = MARKS[kind];
    return {
      date: String(update.date),
      label: formatDate(update.date, newestYear),
      mark: mark ? markHtml(mark) : "",
      word: KIND_WORDS[kind],
      html: parseInline(update.text ?? "", { internalSameTab: true }),
    };
  });

  // Which edges have more behind them. Before hydration a long log assumes
  // more below, so the bottom fade is there on first paint.
  let scroller: HTMLElement | undefined;
  let overflows = updates.length > 3;
  let moreAbove = false;
  let moreBelow = overflows;

  function measure() {
    if (!scroller) return;
    const { scrollTop, scrollHeight, clientHeight } = scroller;
    overflows = scrollHeight > clientHeight + 1;
    moreAbove = scrollTop > 1;
    moreBelow = scrollTop + clientHeight < scrollHeight - 1;
  }

  onMount(() => {
    measure();
    // Text-size changes, reflow, and fonts arriving all change the height.
    const observer = new ResizeObserver(measure);
    if (scroller) {
      observer.observe(scroller);
      if (scroller.firstElementChild) observer.observe(scroller.firstElementChild);
    }
    return () => observer.disconnect();
  });
</script>

<div class="updates relative z-10">
  {#if $$slots.pinned}
    <div class="updates-row updates-row-pinned type-body-small">
      <span class="updates-when"
        ><span class="updates-key updates-pin" aria-hidden="true">{@html markHtml("pin")}</span
        >{#if pinnedDate}<time class="type-meta updates-date" datetime={pinnedDate}>{pinnedLabel}</time
          >{/if}</span
      >
      <div class="updates-text">
        <span class="sr-only">Pinned: </span>
        <slot name="pinned" />
      </div>
    </div>
  {/if}

  {#if rows.length}
    <div
      class="updates-window"
      class:updates-more-above={moreAbove}
      class:updates-more-below={moreBelow}
    >
      <!-- A scroll container a keyboard can reach only when it scrolls. -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div
        bind:this={scroller}
        class="updates-scroller"
        role="region"
        aria-label="Updates"
        tabindex={overflows ? 0 : undefined}
        on:scroll={measure}
      >
        <ul class="updates-list">
          {#each rows as row}
            <li class="updates-row type-body-small">
              <span class="updates-when"
                >{#if row.mark}<span class="updates-key" aria-hidden="true">{@html row.mark}</span
                  >{/if}<time class="type-meta updates-date" datetime={row.date}>{row.label}</time
                ></span
              >
              <span class="updates-text">{#if row.word}<span class="sr-only">{row.word} </span>{/if}{@html row.html}</span>
            </li>
          {/each}
        </ul>
      </div>
    </div>
  {/if}
</div>

<style>
  /* Every row, the pinned one included, shares one pair of named columns,
     so the dates and the text each start on one edge down the whole log,
     and the dates start on the sheet's own content edge. The date column
     fits the widest label either format makes ("may ’25", 45px at 12px); a
     reader's text-spacing override may widen it (max-content).
     A key (the pin, or an update's kind) hangs ahead of its date in the
     sheet's padding, like a hanging bullet, so it takes no column and never
     indents the log. `--update-hang` is the key plus its gap to the date.
     `--update-line` is one line of type-body-small, which the scrolling
     window is measured in. */
  .updates {
    --update-key: calc(0.95 * 0.95rem);
    --update-hang: calc(var(--update-key) + var(--space-1));
    --update-date-col: 2.875rem;
    --update-line: calc(0.95rem * 1.47);
    --update-row-gap: var(--space-2);
  }

  .updates-row {
    display: grid;
    grid-template-columns:
      [date-start] minmax(var(--update-date-col), max-content)
      [date-end text-start] minmax(0, 1fr) [text-end];
    column-gap: var(--space-2);
    /* Key, date, and text share the first line's baseline; wrapped text
       stays in its own column. */
    align-items: baseline;
  }
  .updates-row + .updates-row {
    margin-top: var(--update-row-gap);
  }
  .updates-when {
    grid-column: date;
    white-space: nowrap;
  }
  .updates-text {
    grid-column: text;
  }
  .updates-row-pinned :global(p) {
    margin: 0;
  }

  /* Below `sm` two columns leave the text too narrow, so each row stacks:
     its date on one line, the text beneath on the same edge. The phone
     sheet's 20px padding is too narrow to hang a key in without touching
     the outline, and the date has a line to itself here, so the key sits
     ahead of it on that line instead; the text below stays on the edge. */
  @media (max-width: 479.98px) {
    .updates-row {
      grid-template-columns: [date-start text-start] minmax(0, 1fr) [date-end text-end];
    }
    .updates-text {
      grid-row: 2;
    }
    .updates .updates-key {
      margin-left: 0;
    }
    .updates .updates-window {
      margin-left: 0;
    }
    .updates .updates-scroller {
      padding-left: 0;
    }
  }

  /* The key hangs: pulled left by its own width plus the gap, so its net
     advance is zero and the date starts on the content edge. It sits in the
     row's font (the date cell isn't type-meta, only the <time> is), so it
     takes the key's 0.95em and centres on the row's x-height. */
  .updates-key {
    margin-left: calc(-1 * var(--update-hang));
    margin-right: var(--space-1);
    user-select: none;
  }
  /* The pin leans like one pushed in by hand. */
  .updates-pin :global(.mark) {
    transform: rotate(-12deg);
  }

  .updates-date {
    color: theme("colors.ink.500");
  }
  :global(.dark) .updates-date {
    color: theme("colors.cream.400");
  }

  /* The scrolling window: three single-line rows, with the top three
     quarters of a fourth showing through the fade. The fades are the
     sheet's own paper (the riso surface's documented hexes) laid over
     whichever edge has more behind it, so rows visibly run under the paper
     rather than sitting in a box with a scrollbar. The bottom fade turns
     solid before the edge, so a row cut by the window never shows a hard
     edge. They sit on the unscrolled wrapper, so they stay put while the
     rows move, and they never cover the scroller's focus ring, which is
     drawn outside it.
     A scroller clips sideways too, so the window reaches left into the
     padding by the hang and the scroller pads it back: hanging keys stay
     inside the clip and under the fades, and the rows don't move. */
  .updates-window {
    position: relative;
    margin-left: calc(-1 * var(--update-hang));
    /* The list's top padding (room for a focus ring) makes up the rest of
       the row gap, so the pinned row sits one ordinary gap above the first
       update. */
    margin-top: calc(var(--update-row-gap) - var(--space-0-5));
    --update-fade: #fbf2e8;
  }
  :global(.dark) .updates-window {
    --update-fade: #2a2422;
  }
  .updates-window::before,
  .updates-window::after {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    z-index: 1;
    pointer-events: none;
    opacity: 0;
    transition: opacity var(--motion-base) var(--ease-standard);
  }
  .updates-window::before {
    top: 0;
    height: var(--space-3);
    background: linear-gradient(to top, transparent, var(--update-fade));
  }
  /* Starts at the peeking row's top, so that row stays legible enough to
     read as "more" rather than as blank padding. */
  .updates-window::after {
    bottom: 0;
    height: calc(0.75 * var(--update-line));
    background: linear-gradient(to bottom, transparent, var(--update-fade) 90%);
  }
  .updates-more-above::before,
  .updates-more-below::after {
    opacity: 1;
  }

  .updates-scroller {
    max-height: calc(
      var(--space-0-5) + 3.75 * var(--update-line) + 3 * var(--update-row-gap)
    );
    overflow-y: auto;
    padding-left: var(--update-hang);
    border-radius: var(--radius-control);
    scrollbar-width: thin;
    scrollbar-color: theme("colors.ink.200") transparent;
  }
  :global(.dark) .updates-scroller {
    scrollbar-color: theme("colors.ink.600") transparent;
  }
  /* Stacked rows run a date line plus one or two text lines on a phone, so
     the window grows to keep about two of them and the start of a third. */
  @media (max-width: 479.98px) {
    .updates-scroller {
      max-height: 9.5rem;
    }
  }
  /* Room inside the clip for a link's focus ring in the first or last row. */
  .updates-list {
    padding-block: var(--space-0-5) var(--space-2);
  }
</style>
