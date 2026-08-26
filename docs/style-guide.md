# Atrey Desai website style guide

Version: 1.2  
Status: canonical and implemented, including the focus system and dark-theme
contrast. Light-theme contrast and pointer-target sizing remain deferred by
direction and are marked as such below.  
Companion document: [Website design-system audit](./design-audit.md)

## Purpose

This guide defines the website’s visual language and the rules for applying it.
It is intentionally more specific than a mood board: it names the available
tokens, explains their roles, defines component states, and records the few
places where expressive exceptions are allowed.

The typography, spacing, layout, surface, motion, icon, and component rules are
implemented in the current working tree, as are the focus system and the
dark-theme color mappings.

Two items in the accessibility chapter remain deliberately unimplemented, and
are called out where they appear:

- **Light-theme contrast.** The light palette is unchanged by direction.
  Several light-theme pairs still fall below `4.5:1`; the audit lists them.
- **Pointer target size.** Navigation links and interactive pills are still
  smaller than the `24px` minimum.

Everything else in the chapter is implemented and verified.

## Design character

The site should feel like a well-used research notebook: warm, precise,
editorial, personal, and lightly playful. It should not feel like a corporate
dashboard or a generic portfolio template.

### Principles

1. **Reading comes first.** Body copy, research descriptions, and notes should
   be comfortable before they are decorative.
2. **Structure through rhythm.** Repeated spacing, type, rules, and alignment
   should provide hierarchy without adding containers around everything.
3. **Warm paper, dark ink, one primary accent.** Cream and ink carry the
   interface. Orange marks interaction and emphasis. Support hues convey
   category or data meaning, not decoration.
4. **Quiet interface, expressive moments.** Navigation and controls should stay
   restrained. The riso banner, research media, photography, and boba game may
   be more characterful.
5. **Density follows the task.** Long-form reading is relaxed; the bookshelf is
   compact; primary actions remain comfortably sized.
6. **Every exception is named.** Optical adjustments are allowed when they are
   component-scoped, documented, and tested.
7. **Accessibility is a design constraint.** Contrast, focus, text
   customization, keyboard operation, target size, and reduced motion are part
   of the visual system.

## System architecture

The system has three layers:

1. **Primitive tokens** are raw values: palette steps, spacing values, font
   families, breakpoints, and motion durations.
2. **Semantic roles** name a purpose: `text-primary`, `surface-page`,
   `link-default`, `space-section`, or `motion-fast`. Global inherited roles
   may be CSS variables; component roles use the documented primitive mapping
   directly to avoid a duplicate value source.
3. **Component recipes** combine semantic tokens into a complete style:
   `type-page-title`, `control-compact`, `surface-ledger-row`, or
   `page-header-with-meta`.

Rules:

- Routes should use documented semantic mappings and component recipes, not
  raw hex values.
- A typography recipe owns family, size, weight, leading, tracking, and wrap.
  Do not add a `text-*`, `leading-*`, or `tracking-*` utility to it.
- Component variants should be explicit props or named classes. Do not pass
  arbitrary margin classes through a public component API.
- Primitive values may appear directly only in illustrations, canvas code,
  media-derived colors, or a documented optical exception.

## Typography

### Font families

| Role      | Stack                                                                                                            | Use                                                  |
| --------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Display   | `"neue-haas-grotesk-display"`, metric-matched Helvetica/Arial fallback, sans-serif                               | Page and hero titles above 20px                      |
| Prose     | `Optima`, `Candara`, `"URW Classico"`, sans-serif                                                                | Body copy, decks, section headings, card titles      |
| Interface | `ui-monospace`, `SFMono-Regular`, `Menlo`, `Monaco`, `Consolas`, `"Liberation Mono"`, `"Courier New"`, monospace | Navigation, buttons, filters, metadata, labels, data |

Neue Haas Grotesk Display is normally reserved for digital type above `20px`,
following the [MIT typography guidance](https://brand.mit.edu/typography).
The 16px header wordmark is an approved brand-mark exception and must be tested
against the fallback font.

Optima is a system font rather than a served web font. Cross-platform visual QA
is required because the fallback changes metrics and character across Apple,
Windows, Linux, and Android.

### Type roles

All sizes assume the browser’s default `16px` root. Every size in this table,
and the `body` size that unclassed text inherits, is expressed in `rem`, so text
scales with the reader’s browser font-size preference. Never set a text size in
`px`: it silently opts that text out of the reader’s setting.

| Token                  | Family       |                                       Size | Line height | Weight |   Tracking | Use                                        |
| ---------------------- | ------------ | -----------------------------------------: | ----------: | -----: | ---------: | ------------------------------------------ |
| `type-hero-title`      | Display      |      `clamp(3.75rem, 2.25rem + 6vw, 6rem)` |       `0.9` |    700 | `-0.025em` | Rare landing or error display              |
| `type-page-title`      | Display      |                          `1.875rem` / 30px |         `1` |    700 | `-0.015em` | Ordinary page titles                       |
| `type-article-title`   | Display      | `clamp(1.875rem, 1.6rem + 1.1vw, 2.25rem)` |      `1.05` |    700 | `-0.015em` | Titles likely to wrap                      |
| `section-heading`      | Prose italic |                          `1.2rem` / 19.2px |       `1.4` |    400 |        `0` | Editorial section labels                   |
| `type-item-heading`    | Prose        |                           `1.25rem` / 20px |     `1.375` |    600 |        `0` | Research, book, and list titles            |
| `type-deck`            | Prose        |                          `1.125rem` / 18px |       `1.5` |    400 |        `0` | Introductory copy up to two paragraphs     |
| `type-body`            | Prose        |                         `1.0625rem` / 17px |      `1.55` |    400 |        `0` | Default body copy                          |
| `type-longform`        | Prose        |                          `1.125rem` / 18px |       `1.7` |    400 |        `0` | Blog posts and sustained essays            |
| `type-body-small`      | Prose        |                         `0.95rem` / 15.2px |      `1.47` |    400 |        `0` | Secondary descriptions and compact records |
| `type-meta`            | Interface    |                           `0.75rem` / 12px |     `1.333` |    400 |        `0` | Dates, counts, captions, table metadata    |
| `type-label`           | Interface    |                           `0.75rem` / 12px |      `1.25` |    500 |   `0.12em` | Short uppercase labels only                |

### Leading rules

- Large display type uses `0.95–1.05`, depending on expected wrapping.
- Short headings use `1.3–1.4`.
- Body copy uses `1.5–1.6`.
- Sustained long-form copy uses `1.65–1.7`.
- Metadata uses `1.25–1.35`.
- Single-line controls may use `1`, but target height comes from padding or
  `min-height`, not exaggerated line-height.
- Use unitless line-height except where a component must align to a fixed
  baseline grid.

The body and long-form values intentionally exceed MIT’s NHG body guidance
because the site uses Optima for prose and follows the longer-text guidance in
[USWDS Typography](https://designsystem.digital.gov/components/typography/).

### Measure

| Role                            | Maximum | Use                                         |
| ------------------------------- | ------: | ------------------------------------------- |
| Reading (`measure-reading`)     |  `68ch` | Blog posts, About prose, and long notes      |
| Standard measure guideline      |  `75ch` | Shorter page copy and research descriptions |
| Compact measure guideline       |  `58ch` | Decks, alerts, empty states                  |
| Caption measure guideline       |  `45ch` | Captions, helper text, tooltips              |

The structural container may be wider than the reading measure. Apply measure
to the text block, not indiscriminately to its media, table, or layout parent.
Only the repeatedly consumed reading measure has a shared utility; contextual
limits should stay local until they have more than one consumer.

### Hierarchy and flow

- A page has one `h1`.
- Do not skip heading levels for visual styling.
- Page titles and short headings use `text-wrap: balance`.
- Body paragraphs use `text-wrap: pretty` where supported.
- Space above an in-flow heading should be at least 1.5 times the space below
  it.
- Long-form paragraphs use `1–1.25em` space after the paragraph.
- Lists use at least `0.5em` between multi-line items.
- Use old-style figures in running prose.
- Use lining, tabular figures for dates, times, tables, scores, and changing
  counters.

### Casing and emphasis

- Page titles, navigation labels, footer labels, and editorial section headings
  use lowercase as part of the site voice.
- Task actions use sentence case: “Download PDF,” “Clear filters,” “View
  source.”
- Acronyms retain conventional capitalization: “PDF,” “CV,” “TLDR,” “AI.”
- Uppercase is limited to short metadata labels and always uses positive
  tracking.
- Use `500` and `600` to create hierarchy before reaching for `700`.
- Do not use long passages of bold, italic, uppercase, or centered text.
- Avoid title case for every heading.

## Color

### Core primitive palette

#### Cream

| Token       | Value     |
| ----------- | --------- |
| `cream-50`  | `#FFFDFB` |
| `cream-100` | `#FDF8F3` |
| `cream-200` | `#FAF0E6` |
| `cream-300` | `#F5E6D3` |
| `cream-400` | `#E8D5C4` |
| `cream-500` | `#D4C4B0` |

#### Ink

| Token     | Value     |
| --------- | --------- |
| `ink-50`  | `#F7F7F7` |
| `ink-100` | `#E3E3E3` |
| `ink-200` | `#C8C8C8` |
| `ink-300` | `#A4A4A4` |
| `ink-400` | `#818181` |
| `ink-500` | `#666666` |
| `ink-600` | `#515151` |
| `ink-700` | `#434343` |
| `ink-800` | `#383838` |
| `ink-900` | `#1A1A1A` |

#### Accent and highlight

| Token          | Value     | Use                                                 |
| -------------- | --------- | --------------------------------------------------- |
| `accent`       | `#E85D4C` | Graphical accent, hover wash, large dark-theme text |
| `accent-light` | `#F18272` | Dark-theme links, focus, and interactive text       |
| `accent-dark`  | `#C9462F` | Light-theme links, focus, and interactive text      |
| `accent-muted` | `#D4847A` | Decorative or data use, not ordinary text           |
| `blush-50`     | `#FFF9F7` | Very subtle warm layer                              |
| `blush-100`    | `#FFF0EB` | Hover or selection layer                            |
| `blush-200`    | `#FFE4DB` | Text selection                                      |
| `blush-300`    | `#FFD4C7` | Emphasis layer                                      |
| `blush-400`    | `#E8B8A8` | Strong highlight                                    |

Do not place small cream text on `accent`: the current contrast is only
`3.26:1`. Primary filled buttons use ink and cream instead.

### Support palette

Support hues carry category or data meaning. They are not additional brand
accents.

| Family | Default   | Light     | Dark      | Approved meaning                 |
| ------ | --------- | --------- | --------- | -------------------------------- |
| Sage   | `#3D7A55` | `#7BAE8C` | `#1F5234` | Positive, complete, success      |
| Ochre  | `#946410` | `#DBA84D` | `#704A05` | Caution, in progress, importance |
| Wine   | `#8A3251` | `#C68098` | `#5E1F37` | Personal, favorite, affective    |
| Steel  | `#3A6A91` | `#779BBE` | `#1F4567` | Informational, analytical        |
| Plum   | `#6F4476` | `#AA89B1` | `#4A2A50` | Special or cross-category        |

Use the dark shade for ordinary text on light surfaces and the light shade for
ordinary text on dark surfaces.

The `-light` shades exist only for dark surfaces; no light-theme component uses
them. Each was chosen to clear `4.5:1` on **both** the page (`ink-900`) and the
raised dark surfaces where these colors actually appear — the sheet, the note
sidebar, the select dropdown, a selected row — and to clear it again once the
family’s own `-dark` tint is composited underneath as a pill fill.

A value that passes on `ink-900` alone is not sufficient. `accent-light` at
`#F07563` measured `6.16:1` on the page but only `4.15:1` on `ink-800`, which
is exactly where it carries the selected state in a dropdown.

The `mist` family is reserved. It must not be introduced until it has a named
semantic role.

### Semantic color tokens

| Role             | Light theme                   | Dark theme        |
| ---------------- | ----------------------------- | ----------------- |
| `surface-page`   | `cream-100`                   | `ink-900`         |
| `surface-raised` | `cream-50`                    | `ink-800`         |
| `surface-subtle` | `cream-200`                   | `ink-800`         |
| `surface-hover`  | `blush-100` or `accent` at 6% | `cream-100` at 5% |
| `text-strong`    | `ink-900`                     | `cream-100`       |
| `text-primary`   | `ink-700`                     | `cream-200`       |
| `text-secondary` | `ink-500`                     | `cream-400`       |
| `text-muted`     | `ink-400`                     | `cream-500`      |
| `text-disabled`  | `ink-400`                     | `ink-300`        |
| `link-default`   | `accent-dark`                 | `accent-light`   |
| `link-hover`     | `ink-900`                     | `cream-100`       |
| `border-subtle`  | `ink-200`                     | `ink-700`         |
| `border-strong`  | `ink-500`                     | `cream-400`       |
| `focus-ring`     | `accent-dark`                 | `accent-light`    |
| `selection`      | `blush-200`                   | `ink-600`         |

Dark-theme secondary text descends the **cream** ramp
(`cream-100` → `cream-400` → `cream-500`); it never uses the ink ramp, whose
values are all near-black and therefore near-invisible on `ink-900`. `ink-300`
and `ink-400` appear in the dark theme only as decorative glyphs and
"no value recorded" placeholders, where the `3:1` graphical threshold applies
rather than `4.5:1`.

Color roles remain the same across themes even when the primitive value
changes. This follows the role-based token model documented by
[IBM Carbon](https://carbondesignsystem.com/elements/color/overview/).

The table records the canonical role mappings. `surface-page`, `text-primary`,
and `focus-ring` are CSS variables because they are inherited or read by a
single global rule; every other component-scoped role uses the matching
Tailwind primitive so the palette remains the single source of truth.

The dark theme is verified. Every route and every interactive state — the
sheet, the note sidebar, both select dropdowns, the lightbox, the empty state,
an expanded homepage — measures at or above `4.5:1` for ordinary text and `3:1`
for large text and essential graphics, computed against the **composited**
background rather than the declared one. The light theme is unchanged by
direction and still contains failing pairs; see the audit.

### Color-use rules

- Ordinary text must reach `4.5:1`.
- Large text and essential graphical objects must reach `3:1`.
- Do not round a near-pass upward.
- Do not communicate state by hue alone; pair it with text, icon, underline,
  fill, or shape.
- `ink-300`, `ink-400`, and low-opacity text colors are decorative or disabled
  unless the tested background and size qualify.
- Accent hover states must remain readable; a hover state cannot reduce
  contrast below the default state. This is why the dark-theme link hover is
  `cream-100` rather than `accent`: `accent` is *less* legible on `ink-900`
  than the `accent-light` resting state, so hovering would have dimmed it.
- Measure contrast against the composited background, not the declared one. A
  translucent fill (`bg-accent/[0.08]`), a translucent surface
  (`bg-ink-900/95`), and an ancestor’s `opacity` all change what the text is
  actually sitting on.
- `opacity` on a text element is a contrast change. A resting state expressed
  as an opacity must meet its threshold *at that opacity*, not at `1`.
- Hard-coded colors belong only to the boba sprites, canvas rendering,
  media-derived art, or the documented riso treatment.

## Spacing

### Primitive scale

The site uses a 4px foundation with 2px intermediate precision and a limited
set of dense values.

| Token       |  Value | Typical use                          |
| ----------- | -----: | ------------------------------------ |
| `space-0`   |    `0` | Reset                                |
| `space-0.5` |  `2px` | Optical inset, pill padding          |
| `space-1`   |  `4px` | Icon/text micro-gap                  |
| `space-1.5` |  `6px` | Dense label gap                      |
| `space-2`   |  `8px` | Compact gap                          |
| `space-2.5` | `10px` | Dense control padding                |
| `space-3`   | `12px` | Related elements                     |
| `space-4`   | `16px` | Default content gap                  |
| `space-5`   | `20px` | Card padding, control bands          |
| `space-6`   | `24px` | Heading group, tablet gutter         |
| `space-8`   | `32px` | Page top on mobile, compact section  |
| `space-10`  | `40px` | Regular control or medium separation |
| `space-12`  | `48px` | Page section, desktop page top       |
| `space-16`  | `64px` | Major separation                     |
| `space-20`  | `80px` | Rare hero or display separation      |

Use `1px` only for hairlines and borders. Values outside the table require a
comment describing the optical or technical reason.

### Semantic spacing recipes

| Relationship            |    Mobile |                                  Desktop |
| ----------------------- | --------: | ---------------------------------------: |
| Page top                |    `32px` |                                   `48px` |
| Page bottom             |    `48px` |                                   `48px` |
| Page gutter             |    `16px` | `24px`; `32px` on wide layouts from `lg` |
| Header to first content | `24–32px` |                                   `32px` |
| Major page section      |    `40px` |                                   `48px` |
| Compact page section    |    `32px` |                                   `32px` |
| Heading to content      |    `12px` |                                   `16px` |
| Content to next heading |    `24px` |                                   `32px` |
| Body paragraph          |    `16px` |                                   `16px` |
| Long-form paragraph     |  `1.25em` |                                 `1.25em` |
| Related rows            |  `8–12px` |                                   `12px` |
| Card/panel padding      |    `16px` |                                   `20px` |
| Control group           |     `8px` |                                   `12px` |
| Rule to content         |    `20px` |                                   `24px` |

### Flow utilities

- `flow-prose`: `16px` between prose siblings.
- `section-gap`: `48px` after a major page section.
- `section-stack`: `48px` between major section siblings.

Flow utilities apply to sibling relationships. Avoid placing persistent bottom
margins on reusable headings, paragraphs, or buttons. Add another named flow
only after the same relationship appears in multiple components.

### Negative spacing

Negative margins are permitted only for:

- optical alignment of media within a known card;
- an intentional overlap or paper/print effect;
- counteracting a wrapper’s documented inset.

Each use must be component-scoped and commented. Do not use negative margins
to repair an unclear page-flow API.

## Layout

### Breakpoints

| Token |    Width |
| ----- | -------: |
| `xs`  |  `375px` |
| `sm`  |  `480px` |
| `md`  |  `768px` |
| `lg`  | `1024px` |
| `xl`  | `1280px` |
| `2xl` | `1536px` |

Design mobile first. Breakpoints respond to available width, not a presumed
device.

### Containers

| Variant    |                    Maximum width | Gutters          | Use                                |
| ---------- | -------------------------------: | ---------------- | ---------------------------------- |
| `reading`  |                           `68ch` | inherited        | Long-form text only                |
| `standard` |                          `820px` | `16 / 24px`      | Home, Research, Blog, CV, Resume   |
| `wide`     |                         `1152px` | `16 / 24 / 32px` | Photography and Bookshelf          |
| `overlay`  | `1280px` or viewport-constrained | `16–32px`        | Media lightboxes and game panels   |

Header and footer use the standard container even when the page body is wide.
That preserves a consistent site frame while letting task-specific content
expand.

### Grid rules

- Start with one column.
- Use Grid for page-level multi-column layouts and Flexbox for small
  one-dimensional relationships.
- Maintain a `16px` minimum content gap on mobile and `20–24px` on desktop.
- Do not force prose to fill a wide data or media container.
- About is an approved editorial grid at `xl`: a fixed `68ch` reading measure
  inside a guttered main track, a `32px` column gap, and a sidenote column up
  to `224px` wide. The main column stays anchored to the standard page
  position while the sidenotes extend right without recentering it. The
  compound wrapper expands to fit both columns; the reading track must never
  shrink to accommodate the sidenotes. Near the `xl` boundary only the
  sidenote column may narrow to prevent horizontal overflow. Below `xl`,
  footnotes move below the main content.
- The Photography grid may use dense masonry-like placement.
- The Bookshelf may use horizontal table overflow, but controls and pagination
  must remain usable without horizontal page scrolling.
- Align related baselines and repeated control heights optically.

### Page shell and page header

Every page selects a container variant and page-header variant.

Page-header variants:

- `title-only`: title, then `24px` to content.
- `title-deck`: `12px` title-to-deck, then `32px` to content.
- `title-meta`: `12px` title-to-meta, then `32px` to content.
- `title-action`: title and action share a row from `sm`; `16px` stacked gap on
  smaller screens; `32px` to content.

The page title itself has no external margin. The page-header recipe owns the
relationship.

## Surfaces, borders, radius, and shadow

### Surface model

1. Page: warm paper or near-black.
2. Subtle layer: a small value shift for control bands or grouped content.
3. Raised layer: dropdown, tooltip, drawer, or dialog.
4. Expressive layer: riso banner or game UI.

Do not add a card merely to group content. Prefer whitespace, a hairline, or a
subtle background wash.

### Borders

| Token             | Value                                     | Use                                   |
| ----------------- | ----------------------------------------- | ------------------------------------- |
| `border-hairline` | `1px solid border-subtle`                 | Rules, table rows, quiet panels       |
| `border-control`  | `1px solid border-strong` on focus/active | Inputs and compact controls           |
| `border-emphasis` | `2px solid text-strong`                   | Riso outline or strong selected state |
| `border-focus`    | `2px solid focus-ring`                    | Keyboard focus only                   |

`border-focus` is not applied by hand. It is the shape of the one global
`:focus-visible` rule described under [Focus](#focus); components inherit it.

### Radius

| Token            |  Value | Use                                     |
| ---------------- | -----: | --------------------------------------- |
| `radius-control` |  `2px` | Buttons, filters, pills                 |
| `radius-inline`  |  `4px` | Inline code and small highlights        |
| `radius-media`   |  `8px` | Images, media frames, standard panels   |
| `radius-panel`   | `12px` | Large dialogs or special media surfaces |

The riso banner’s asymmetric radii are an approved exception.

### Shadow

| Token            | Value                             | Use                              |
| ---------------- | --------------------------------- | -------------------------------- |
| `shadow-none`    | none                              | Ledger rows and ordinary content |
| `shadow-popover` | `0 10px 28px rgb(81 81 81 / 12%)` | Dropdowns and tooltips           |
| `shadow-dialog`  | `0 12px 36px rgb(81 81 81 / 10%)` | Drawers and modal panels         |

Dark-theme shadows use black at no more than 32% and must be paired with a
visible boundary where adjacent surfaces are similar.

### Layer scale

| Token           | z-index | Use              |
| --------------- | ------: | ---------------- |
| `layer-base`    |     `0` | Normal content   |
| `layer-raised`  |    `10` | Local decoration |
| `layer-sticky`  |    `20` | Sticky panels    |
| `layer-tooltip` |    `30` | Tooltip          |
| `layer-popover` |    `40` | Dropdown         |
| `layer-overlay` |    `50` | Backdrop         |
| `layer-modal`   |    `60` | Dialog content   |
| `layer-cursor`  |    `70` | Custom cursor    |

No component should invent a z-index above this scale.

## Iconography

- Use `@jis3r/icons` for expressive or animated controls when an appropriate
  icon exists.
- Use a small local SVG component for a branded or genuinely missing symbol.
- Do not add a second general-purpose icon dependency for one glyph. If a
  second family becomes necessary, document the gap and check its optical
  weight before adoption.
- Keep a consistent apparent stroke and box size:

| Context               |   Size |
| --------------------- | -----: |
| Dense inline metadata | `12px` |
| Standard metadata     | `14px` |
| Control icon          | `16px` |
| Navigation/social     | `18px` |
| Heading/support       | `20px` |
| Standalone action     | `24px` |
| Modal close           | `32px` |

- Icons that convey information need an accessible name, visible label, or
  equivalent text.
- Decorative icons use `aria-hidden="true"`.
- Apply a `1–2px` optical translation only when documented in the component.

## Imagery and illustration

- Use real photography and project media rather than stock imagery.
- Preserve source aspect ratio unless the component is explicitly a cropped
  thumbnail.
- Standard media radius is `8px`.
- Captions use `type-meta` or `type-body-small`, `text-secondary`, and a maximum
  `45ch` measure.
- Every meaningful image needs descriptive alt text.
- A filename is never alt text and never a caption. An image with no
  human-written description is presentational: give it `alt=""`, render no
  title line, and put the accessible name on the control that wraps it. A
  derived string like `152 IDG 20251109 145157 722 103` is worse than nothing,
  because it is announced as though it described the picture.
- Photography captions come from the photo’s IPTC/XMP Title (Lightroom’s
  **Title** field) or from an entry in `scripts/photo-captions.json`, in that
  order of precedence.
- Format metadata before displaying it. Raw EXIF is not display copy: a focal
  length arrives as `6.764999866485596 mm` and must be rounded.
- Animated research media must have a useful static first frame.
- Hover-only media behavior must also respond to keyboard focus.
- The paper texture stays subtle enough that it does not affect contrast.

## Motion

### Tokens

| Token            | Duration | Use                                |
| ---------------- | -------: | ---------------------------------- |
| `motion-instant` |  `100ms` | Press or tiny state response       |
| `motion-fast`    |  `150ms` | Color and underline                |
| `motion-base`    |  `200ms` | Hover, active, icon response       |
| `motion-slow`    |  `300ms` | Popover, tooltip, small disclosure |
| `motion-reveal`  |  `400ms` | Page or section entrance           |

Approved easing:

- `ease-standard`: `cubic-bezier(0.4, 0, 0.2, 1)`;
- `ease-emphasized`: `cubic-bezier(0.16, 1, 0.3, 1)`.

#### Page transitions

Route changes are the one animation that fires on every interaction, so they
get their own, shorter budget. All of it lives in `src/lib/motion.ts`:

| Constant                       |  Value | Note                                     |
| ------------------------------ | -----: | ---------------------------------------- |
| `PAGE_TRANSITIONS_ENABLED`     | `true` | Master switch                            |
| `PAGE_TRANSITION_DURATION_MS`  | `180`  | Both directions                          |
| `PAGE_TRANSITION_IN_DELAY_MS`  |   `0`  | New content paints immediately           |
| `PAGE_TRANSITION_IN_X`         | `-8px` | Enter travel                             |
| `PAGE_TRANSITION_OUT_Y`        |  `4px` | Exit travel                              |

`motion-reveal` (`400ms`) is for a section entering an already-visible page,
not for the page itself. A route change at `motion-reveal` plus an enter delay
put roughly half a second of animation between one page of text and the next.

The outgoing and incoming pages occupy the same single-cell grid inside one
stable `<main>`, so they overlap during the transition instead of stacking and
briefly doubling the page height. The `<main>` landmark and the skip-link
target are never duplicated.

### Motion rules

- Animate `transform` and `opacity` where possible.
- Color transitions use `motion-fast` or `motion-base`.
- A press state uses `translateY(1px)` or `scale(0.98)`.
- Staggers use `30–40ms` steps and stop increasing after ten items.
- Page transitions use `motion-reveal` and no more than `10px` movement.
- Disclosures may animate height only when content remains accessible and no
  clipping occurs under text-spacing overrides.
- `prefers-reduced-motion: reduce` removes decorative travel, shake, stagger,
  pulse, and smooth scrolling. State changes remain immediate.
- Read `prefers-reduced-motion`, `prefers-color-scheme`, input type, and
  breakpoint through a **live** `matchMedia` listener, never through a single
  read at module scope. All of them can change while the page is open — a
  trackpad is attached, the window is resized, the system setting is flipped —
  and a value captured once at import silently goes stale until reload.
- Detect input type with `(hover: none) and (pointer: coarse)`, not by sniffing
  the user-agent string. A UA test reads iPad and touch laptops as desktop.
- The boba game may use bespoke physical timing, but menus and controls still
  honor reduced motion.

## Components

### Links

Default inline link:

- `link-default` color;
- no permanent underline in short navigation-like copy;
- underline on hover and focus, `3px` offset;
- focus ring uses the shared focus recipe;
- visited color may remain unchanged on this personal site.

Long-form links should remain underlined by default. Never rely only on an
accent color to distinguish a link inside a paragraph.

Subtle links use `text-secondary`, become `link-default` on hover, and do not
move vertically unless the entire component family uses the same treatment.

### Buttons

Variants:

- Primary: ink background, cream text; inverted in dark mode.
- Secondary: transparent or subtle surface, one-pixel strong border.
- Tertiary: text link with an icon; no container.
- Destructive: reserved for destructive actions, with explicit wording and a
  support color tested for contrast.

Density:

| Variant | Minimum height | Horizontal padding |
| ------- | -------------: | -----------------: |
| Dense   |         `28px` |           `8–10px` |
| Compact |         `32px` |             `12px` |
| Regular |         `40px` |             `16px` |

Rules:

- Primary calls to action use Regular.
- Toolbars and tables may use Dense or Compact.
- Pointer targets are at least `24 × 24px` or have WCAG-compliant separation.
- All buttons have default, hover, focus-visible, active, and disabled states.
- Buttons use the interface font at `500`.
- Icon and label gaps are `6–8px`.

### Form controls

- Regular input height: `40px`; dense data input: `36px`.
- Horizontal padding: `12px`.
- Input and select text: `type-body-small` or `type-meta` for dense controls.
- Default border: subtle; hover border: secondary; focus: solid semantic focus
  ring plus a stronger field border.
- Placeholder text uses `text-secondary`, not a failing muted color.
- Errors appear inline below the field with text and icon; color alone is not
  sufficient.
- Dropdown rows are at least `32px` high.
- Control groups use `8–12px` gaps and wrap on narrow screens.

### Pills and tags

- Pills are metadata, not primary actions.
- Use interface `12px / 1.1–1.25`, `6px` horizontal and `2px` vertical padding,
  `4px` internal gap, and `2px` radius.
- Neutral pills use a 5–8% ink/cream fill and secondary text.
- Status pills use one approved support family.
- Interactive pills must meet the same focus and target-spacing rules as other
  controls.
- Do not add a second `text-xs` utility to a pill recipe; the pill owns its
  leading.

### Section heading with rule

- Heading: `section-heading`.
- Rule begins `16px` after the heading.
- The rule fades away from the heading and is decorative.
- The wrapper owns the bottom gap, normally `20–24px`.
- A page should not mix ruled and unruled section headings at the same
  hierarchy level without a content reason.

### Ledger row and research card

- Default surface is transparent.
- Padding: `16px` mobile, `20px` desktop.
- Sibling gap: `12px`.
- Hover uses a subtle warm wash; no elevation or lift.
- Title uses `type-item-heading`.
- Authors and venue use `type-body-small`.
- Links and tags begin `12px` after metadata.
- Media is `144px` square on desktop and full width on mobile.
- Highlight corners are decorative and cannot be the only indication of a
  highlighted item.

### Tables and dense data

- Header uses `type-meta`, sentence case unless a short system label requires
  uppercase.
- Cell padding: `12px` horizontal and `10px` vertical.
- Row boundaries use `border-hairline`.
- Numeric columns use lining tabular figures.
- Sort state uses `aria-sort`, text, and an icon.
- Hover, selected, and keyboard-focus states remain distinct.
- **A row is a click target, not a control.** Never put `role="button"` and
  `tabindex` on a `<tr>` that contains its own buttons or links: nested
  interactive content inside a widget role is invalid, keyboard users tab into
  controls the row claims to own, and a screen reader flattens the row’s name
  into the concatenation of every cell. Give the row a real `<button>` — the
  title cell is the natural place — and keep whole-row click as a convenience
  that ignores clicks landing on any other control inside it.
- **A table that needs a minimum width has a width below which it is not a
  table.** Above that width, use the table. Below it, render the same records
  as a stacked list rather than a horizontal scroll of a `1080px` grid on a
  `390pt` screen. The bookshelf switches at `md`.
- When columns disappear in the stacked form, their headers disappear with
  them. Any icon-only column must regain a label inline.

### Companion detail panels

A record list paired with a detail view has two presentations, chosen by
available width, sharing one component:

- **Sidebar** (`xl` and up): a sticky column beside the list. Not modal; the
  list stays usable.
- **Sheet** (below `xl`): a modal bottom sheet over a dimmed backdrop. Focus
  moves in, is trapped, Escape closes, and focus returns to the row that opened
  it. Stacking the panel underneath a wide scrolling table is not an
  alternative — it puts the content a long scroll away from the tap.

Lock background scrolling by pinning `<body>` at its current offset and
restoring it on close. `overflow: hidden` alone does not hold on iOS Safari and
loses scroll position.

### Disclosures

- Prefer a native `<details>`/`<summary>` for optional supporting content. It
  is keyboard-operable, touch-operable, and announced correctly with no
  scripting, which a hover tooltip is not.
- Replace the default marker with the site’s `▸` caret, rotated on `[open]`,
  and honour reduced motion on the rotation. `::marker` can only be sized and
  coloured, never positioned, so the native triangle sits on the text baseline
  rather than its centre.
- If the disclosure lives inside a status line, anchor its panel to that line
  and take it out of flow, so opening it does not reflow the content below.

### Tooltips and popovers

- Tooltip text uses `type-meta` and a maximum `45ch`.
- Padding: `8px 12px`.
- Tooltip radius: `4px`; popover radius: `2–8px` according to its parent
  component.
- Tooltips supplement an accessible name; they do not contain essential
  interaction.
- Popovers support keyboard entry, escape dismissal, focus return, and viewport
  collision handling.

### Dialogs and lightboxes

- Backdrop uses `ink-900` at 95% for media or 56–70% for a panel dialog.
- Dialog layer uses `layer-modal`.
- Close target is at least `32px`, preferably `40px`.
- Focus moves into the dialog, is trapped while open, and returns to the
  trigger.
- Escape closes the dialog.
- Media is constrained by both `max-width` and `max-height`.
- Caption sits `16px` below media.
- **Give media its intrinsic `width` and `height`.** Without them the frame has
  no size until the file decodes, so the loading placeholder covers a
  zero-height box and the panel jumps when the image lands. The dimensions are
  already in the photo manifest.
- Preload the neighbouring items on open and on navigate, so stepping through a
  set does not re-show the placeholder each time.
- Support swipe on touch as an **addition** to the arrows. Ignore drags that
  are more vertical than horizontal, and ignore mouse drags, so a scroll or a
  text selection is never read as navigation.
- Announce position changes through a live region; a visual `3 / 132` counter
  is decorative and should be `aria-hidden`.

### Empty, error, loading, and disabled states

- Empty states explain what is absent and provide the next useful action.
- Error states state what failed and how to recover; avoid “Oops!”
- Loading placeholders match the shape of the eventual content.
- Disabled controls remain understandable but do not need ordinary text
  contrast; they must not appear interactive.
- Keep state copy calm, direct, and specific.

### Header

- Standard container.
- `28px` top padding on mobile, `32px` from `md`.
- Mobile layout may wrap into two rows with an `8–12px` gap.
- Wordmark uses the documented small-size display exception.
- Navigation uses interface metadata type.
- Navigation destinations are separated by a `16px` horizontal gap rather
  than punctuation.
- Active navigation uses both color and `aria-current`; add an underline or
  weight change if color contrast is insufficient.
- Navigation hit area comes from padding/min-height, not `2.33` line-height.
- Theme control is a minimum `28 × 28px` target with visible focus.

### Footer

- Standard container and subtle top rule.
- `24px` rule-to-content spacing and `32px` bottom spacing.
- Metadata uses interface type with tabular time.
- Interactive music controls meet target-spacing and focus requirements.
- Footer copy may be lowercase, but accessible labels use natural sentence
  case.

## Dark theme

- Dark mode changes semantic values, not component meanings.
- Surfaces become one step lighter as they rise.
- Use `cream-100/200` for strong and primary text, `cream-400/500` for
  secondary text. Never the ink ramp: every ink value is near-black and
  disappears on `ink-900`.
- Do not use `accent-dark` for text on `ink-900` (`3.65:1`).
- **Check text against raised surfaces, not just the page.** `ink-800` carries
  the select dropdown, the note sheet, and the note sidebar. A color that
  passes on `ink-900` can fail there by a full step.
- A *selected* row is a state, not a raised surface. Express it as a warm
  accent wash (`bg-accent/[0.08]`) plus the accent outline, matching the light
  theme, rather than stepping the row up to `ink-800` — stepping up lifts the
  effective background under every tinted pill inside that row.
- Shadows alone do not distinguish dark surfaces; include a border or value
  shift.
- Photography and research media retain their native colors.

### Appearance and the theme control

- **The theme is an explicit saved choice, not the system appearance.** Light
  is the default until someone toggles; the preference lives in
  `localStorage` and is applied by an inline script before first paint. This is
  a deliberate departure from the usual "follow the system" convention.
- Because the choice is explicit, everything that describes the appearance must
  follow the resolved theme rather than `prefers-color-scheme`:
  - `color-scheme` tracks the `.dark` class in `app.css`, so the browser paints
    the surfaces it owns — scrollbars, the text caret, form-control chrome,
    spellcheck underlines — to match. Without it those stay light on a
    near-black page.
  - `theme-color` is a single meta element updated alongside the class. Two
    metas gated on `prefers-color-scheme` let the browser chrome disagree with
    the page whenever the saved choice differs from the system.
- The toggle shows the **current** theme, not the destination, and carries
  `aria-pressed`. A control whose appearance never changes reads as inert.

## Accessibility requirements

Focus, dark-theme contrast, keyboard operation, hover independence, and status
announcement are implemented. Light-theme contrast and pointer target size are
deferred by direction; both are marked below.

### Contrast

- `4.5:1` minimum for ordinary text.
- `3:1` minimum for qualifying large text and essential graphics.
- Focus indicators reach `3:1` against adjacent colors.
- Test every semantic pair in both themes, against the **composited**
  background and at the element’s resting `opacity`.
- Test raised surfaces as well as the page, and test each interactive state
  that only exists once opened: dropdowns, sheets, sidebars, lightboxes, empty
  states, and expanded disclosures.

**Status.** Dark theme: verified clean across every route and interactive
state. Light theme: **deferred by direction**, and still failing in the places
the audit records.

### Focus

Canonical treatment, declared once in `app.css` and inherited by every
interactive element:

```css
:root      { --focus-ring: #c9462f; } /* accent-dark  */
.dark      { --focus-ring: #f18272; } /* accent-light */

:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
```

Rules:

- **A component never removes the ring.** `outline: none` is not permitted.
  Replacing the ring with a background tint or a one-pixel border shift is the
  same mistake wearing a different hat: the tints that were used for this
  measured `1.09:1` against their own surface.
- A component may adjust `outline-offset` and `border-radius` so the ring hugs
  the right shape. Where a control sits flush inside a clipped, scrolling
  container — a select option — use a negative offset so the ring is drawn
  inside the row instead of being cut off at the first and last item.
- Do not use an opacity that drops the ring below `3:1`. Rings at `35–40%`
  opacity blend to roughly `1.6:1` and are not a focus indicator.
- Hover and focus may share a tint, but focus keeps the ring on top of it.
- `ring-*` utilities are not part of the system. Tailwind’s stock `ring-*`
  and `ring-offset-*` default to blue-500 on white, which is how an off-palette
  blue ring reached the skip link and the 404 buttons. `ringColor` and
  `ringOffsetColor` defaults are pinned to palette values in
  `tailwind.config.js` as a backstop, not as an invitation.

The boba game keeps its own `3px` ring inside the documented expressive
exception; it is solid, palette-derived, and meets the same contrast bar.

### Target size

**Deferred by direction.** Recorded here as the standing requirement:

Meet the [WCAG 2.2 24px target minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum)
or its spacing exception. Prefer `40px` for primary controls and at least
`28–32px` for dense interface controls.

Known gaps: site navigation links are roughly `16px` tall with a `4px` wrapped
row gap, and interactive pills are roughly `17px` tall with `4px` neighbours.
Both can be fixed without changing anything visible — `min-height` plus
vertical padding on the nav links, and an inset `::after` on interactive pills.

### Text customization

The site must retain all content and functionality when a user applies:

- line-height `1.5`;
- paragraph spacing `2em`;
- letter spacing `0.12em`;
- word spacing `0.16em`.

Avoid fixed-height text containers, clipping, and non-wrapping UI where these
overrides could cause loss. This requirement comes from
[WCAG 2.2 Text Spacing](https://www.w3.org/WAI/WCAG22/Understanding/text-spacing).

### Reflow and zoom

- Test at 200% browser zoom and a 320 CSS-pixel viewport.
- Reading content must not require horizontal scrolling.
- A data table may scroll inside its own labeled region.
- Dialogs and drawers remain reachable and internally scrollable.

### Motion and input

- Honor reduced motion.
- Do not require hover to reveal essential information. If a relationship,
  definition, or label exists only in a hover state, it does not exist on a
  touchscreen. Give it a real home: a link, a native `<details>`, or visible
  text, and keep the hover treatment as an enhancement on top.
- A hover target must be big enough to hover. A tooltip triggered by a `14px`
  glyph is a hover target the size of a glyph; pad the wrapper instead.
- Every pointer action has a keyboard path, and every gesture has a
  non-gesture equivalent. Swipe is an addition to the arrows, not a
  replacement for them.
- Focus order follows reading order.
- Skip-to-content remains the first keyboard-reachable control, and the
  `#main-content` target is a single stable element — including mid-transition.

### Status and announcement

- Any state change with a visual-only signal needs an `aria-live="polite"`
  region: a filtered result count, a position within a set, a transient
  confirmation.
- Announce the truth. A confirmation must reflect what actually happened —
  a clipboard write that rejects reports the failure and the fallback, it does
  not claim success.
- A transient visual confirmation and its live region are the same message:
  mark the visual one `aria-hidden` so it is not announced twice.

## Content and editorial style

- Write in a specific, direct, conversational voice.
- Prefer active voice.
- Avoid generic marketing terms such as “elevate,” “seamless,” “unleash,” and
  “game-changing.”
- Use sentence case for actions and lowercase for the established editorial
  navigation/heading voice.
- Use real dates, names, titles, and project details.
- Keep success messages calm; avoid unnecessary exclamation marks.
- Keep error messages actionable.
- Use en dashes for ranges and em dashes sparingly.
- Preserve conventional capitalization for institutions, papers, people, and
  acronyms even within a generally lowercase interface.

## Expressive exceptions

### Riso banner

May use:

- asymmetric radii;
- offset foreground/background plates;
- rough SVG displacement;
- small optical translations;
- a bespoke cream and dark paper surface.

Must still use accessible semantic text, link, focus, and selection colors.

### Boba game

The game owns a separate `.boba-*` system for:

- sprite colors;
- arcade typography;
- dense HUD spacing;
- score animation;
- modal geometry;
- game-specific shadows and borders.

Editorial tokens do not need to replace game art values. Shared accessibility,
input, focus, and reduced-motion rules still apply. Game styles must not leak
into ordinary routes.

### Canvas and generated art

Canvas shaders, LEGO image treatment, and pixel sprites may use internal
rendering values. Their surrounding controls, captions, and states use the
website system.

## Implementation conventions

### Ownership

- `tailwind.config.js`: primitive palette, breakpoints, and approved utility
  scale.
- `src/app.css`: font stacks, global semantic light/dark variables, atomic
  typography roles, shared component recipes, motion, layer, radius, and
  shadow tokens.
- Svelte components: structural layout and documented variants.
- Routes: composition and content-specific layout only.
- This guide: human-readable contract and exception register.

### Naming

- Primitive: `cream-100`, `space-4`, `motion-fast`.
- Semantic: `text-primary`, `surface-raised`, `space-section`.
- Component: `type-page-title`, `control-compact`, `page-shell-wide`.
- State: `is-open`, `is-selected`, `is-error`, or Svelte class directive with
  the component name.

### Do

- Use one atomic type recipe.
- Use the documented semantic color mapping in component CSS.
- Use the spacing scale for all ordinary gaps and insets.
- Put responsive behavior in the component that owns the relationship.
- Comment optical exceptions with the reason.
- Test both themes and all interaction states.

### Do not

- Combine `type-page-title` with a separate `text-*` or `leading-*` utility.
- Use a raw palette color when a semantic token exists.
- add a new spacing value because the closest approved value “looks slightly
  off” without testing and documenting it;
- use `transition-all` when only color or transform changes;
- use z-index values outside the layer scale;
- use fixed height on wrapping text;
- normalize expressive art into ordinary UI components.

## Component acceptance checklist

Before a new or changed component is complete:

- [ ] Uses a named typography role.
- [ ] Uses semantic colors in both themes.
- [ ] Uses approved spacing, radius, shadow, and layer values.
- [ ] Has default, hover, focus-visible, active, disabled, loading, empty, and
      error states where relevant.
- [ ] Ordinary text contrast is at least `4.5:1`.
- [ ] Focus and essential graphics contrast is at least `3:1`.
- [ ] Pointer targets meet the `24px` minimum or spacing exception.
- [ ] Works by keyboard and returns focus correctly after overlays.
- [ ] Survives WCAG text-spacing overrides.
- [ ] Works at 320px width and 200% zoom.
- [ ] Honors reduced motion.
- [ ] Has useful accessible names and image alternatives.
- [ ] Uses real content during review.

## Visual QA matrix

Review primary routes at:

- `375px`: small phone;
- `480px`: `sm` gutter and wrapping threshold;
- `768px`: primary desktop-layout transition;
- `1024px`: large-screen gutter and layout;
- `1280px`: wide page and About sidenotes;
- `1536px`: maximum whitespace and container behavior.

For each width, check:

- light and dark themes;
- default and keyboard-focus states;
- open menus, disclosures, drawers, and lightboxes;
- long titles, long tags, and empty states;
- reduced motion;
- 200% zoom;
- text-spacing override;
- at least one non-Apple font fallback environment.

## Governance

When adding a visual value:

1. Reuse an existing semantic token if it expresses the same purpose.
2. If the purpose is new, map it to an existing primitive.
3. Add a new primitive only when no existing value works across all relevant
   components.
4. Document the role, both theme mappings, accessibility result, and intended
   consumers.
5. Record expressive exceptions in this guide.

Review the guide whenever a new route, component family, theme, or font is
introduced. Remove unused tokens rather than keeping speculative styles.

## Reference standards

- [MIT Brand Guide: Typography](https://brand.mit.edu/typography)
- [USWDS Typography](https://designsystem.digital.gov/components/typography/)
- [USWDS Spacing Units](https://designsystem.digital.gov/design-tokens/spacing-units/)
- [GOV.UK Layout](https://design-system.service.gov.uk/styles/layout/)
- [GOV.UK Spacing](https://design-system.service.gov.uk/styles/spacing/)
- [WCAG 2.2 Contrast Minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum)
- [WCAG 2.2 Text Spacing](https://www.w3.org/WAI/WCAG22/Understanding/text-spacing)
- [WCAG 2.2 Target Size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum)
- [IBM Carbon Color](https://carbondesignsystem.com/elements/color/overview/)
