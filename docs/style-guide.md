# Atrey Desai website style guide

Version: 1.1  
Status: canonical and implemented for the non-accessibility design system  
Companion document: [Website design-system audit](./design-audit.md)

## Purpose

This guide defines the website’s visual language and the rules for applying it.
It is intentionally more specific than a mood board: it names the available
tokens, explains their roles, defines component states, and records the few
places where expressive exceptions are allowed.

The typography, spacing, layout, surface, motion, icon, and component rules are
implemented in the current working tree. The accessibility chapter remains in
the guide because a comprehensive design system should record those
requirements, but contrast remapping, focus-standardization, text-spacing
conformance, and target-size corrections were explicitly excluded from this
implementation pass.

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

All sizes assume the browser’s default `16px` root.

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
| `accent-light` | `#F07563` | Dark-theme links, focus, and interactive text       |
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
| Wine   | `#8A3251` | `#B96481` | `#5E1F37` | Personal, favorite, affective    |
| Steel  | `#3A6A91` | `#779BBE` | `#1F4567` | Informational, analytical        |
| Plum   | `#6F4476` | `#A07CA8` | `#4A2A50` | Special or cross-category        |

Use the dark shade for ordinary text on light surfaces and the light shade for
ordinary text on dark surfaces. Exception: `wine-light` is only `4.31:1` on
`ink-900`; it is not approved for small text. Either map that semantic role to
`#C06A87` or use a neutral dark-theme text token after approval.

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
| `text-muted`     | `ink-400`                     | `ink-400`         |
| `text-disabled`  | `ink-400`                     | `ink-400`         |
| `link-default`   | `accent-dark`                 | `accent-dark`     |
| `link-hover`     | `ink-900`                     | `cream-100`       |
| `border-subtle`  | `ink-200`                     | `ink-700`         |
| `border-strong`  | `ink-500`                     | `cream-400`       |
| `focus-ring`     | `accent-dark`                 | `accent-light`    |
| `selection`      | `blush-200`                   | `ink-600`         |

Color roles remain the same across themes even when the primitive value
changes. This follows the role-based token model documented by
[IBM Carbon](https://carbondesignsystem.com/elements/color/overview/).

The table records the canonical role mappings. Only the globally inherited
`surface-page` and `text-primary` roles are CSS variables; component-scoped
roles use the matching Tailwind primitive so the palette remains the single
source of truth. The audit identifies contrast-related remaps for `text-muted`,
`link-default`, and support colors; those changes remain deferred by direction.
`focus-ring` is a documented target role rather than a standardized
implementation in this pass.

### Color-use rules

- Ordinary text must reach `4.5:1`.
- Large text and essential graphical objects must reach `3:1`.
- Do not round a near-pass upward.
- Do not communicate state by hue alone; pair it with text, icon, underline,
  fill, or shape.
- `ink-300`, `ink-400`, and low-opacity text colors are decorative or disabled
  unless the tested background and size qualify.
- Accent hover states must remain readable; a hover state cannot reduce
  contrast below the default state.
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
- On narrow screens, use a scroll container with a visible or discoverable
  overflow affordance.

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
  secondary text.
- Do not use `accent-dark` or `wine-light` for small text on `ink-900`.
- Shadows alone do not distinguish dark surfaces; include a border or value
  shift.
- Photography and research media retain their native colors.
- The theme toggle persists a user choice and should respect the system choice
  when no explicit preference has been saved.

## Accessibility requirements

The following requirements are retained as future design-system guidance. They
were not part of the requested implementation pass and should not be read as a
claim that the current site has been remediated against them.

### Contrast

- `4.5:1` minimum for ordinary text.
- `3:1` minimum for qualifying large text and essential graphics.
- Focus indicators reach `3:1` against adjacent colors.
- Test every semantic pair in both themes.

### Focus

Canonical treatment:

```css
:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
```

Do not use an opacity that drops the ring below `3:1`. An inset ring may add a
one-pixel separating stroke where the component and ring are too similar.

### Target size

Meet the [WCAG 2.2 24px target minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum)
or its spacing exception. Prefer `40px` for primary controls and at least
`28–32px` for dense interface controls.

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
- Do not require hover to reveal essential information.
- Every pointer action has a keyboard path.
- Focus order follows reading order.
- Skip-to-content remains the first keyboard-reachable control.

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
