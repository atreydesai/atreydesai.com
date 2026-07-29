# Website design-system audit

Status: all non-accessibility findings implemented; accessibility findings
deferred at the user’s direction  
Audit date: July 29, 2026  
Implementation date: July 29, 2026  
Scope: the current working tree, including the uncommitted homepage work

## Implementation disposition

This document preserves the original evidence and recommendations as the
decision record. The implementation pass applied every visual-system,
typography, spacing, layout, motion, component, and maintainability correction.
It deliberately did not change color pairs, focus indicators, WCAG text-spacing
behavior, or minimum pointer-target rules.

| Finding                                    | Disposition |
| ------------------------------------------ | ----------- |
| Computed heading leading                   | Implemented |
| Text color contrast                        | Deferred    |
| Focus treatment                            | Deferred    |
| Long-form reading measure                  | Implemented |
| No-op About prose classes                  | Implemented |
| Purpose-named type roles                   | Implemented |
| Heading/body leading system                | Implemented |
| Navigation leading                         | Implemented |
| Governed spacing scale                     | Implemented |
| Page-shell width variants                  | Implemented |
| Page-header spacing variants               | Implemented |
| Named section and paragraph rhythm         | Implemented |
| Control density variants                   | Implemented |
| Motion tokens                              | Implemented |
| Radius, shadow, and layer tokens           | Implemented |
| Icon selection and one-family route groups | Implemented |
| Unused design-system rules                 | Implemented |
| Display wordmark exception                 | Documented  |
| Cross-platform prose fallback              | Documented  |

## Executive finding

The site has a strong editorial foundation: the warm paper palette is
recognizable, the three font roles are sensible, body leading is comfortable,
and the narrow primary shell gives most pages a coherent voice.

The inconsistency is mainly systemic, not aesthetic. Typography, spacing,
color, and interaction rules are split among Tailwind configuration, global
component classes, route utilities, and component-scoped CSS. Because those
layers can override one another, the value documented as canonical is not
always the value that reaches the browser. The clearest example is the page
title: `.heading-display` declares `line-height: 0.95`, but every ordinary page
title also uses `text-3xl`, whose later utility rule changes the computed
line-height to `1.2`.

The highest-value system corrections were:

1. make each typography style atomic, including its size and leading;
2. add semantic color roles without changing the existing palette mappings;
3. establish one documented spacing scale plus page/section recipes;
4. constrain long-form prose separately from the structural page container;
5. unify component geometry, motion, iconography, and layering.

## Method and limitations

The audit covered:

- every route and shared Svelte component;
- `src/app.css` and `tailwind.config.js`;
- a freshly compiled Tailwind stylesheet, used to verify cascade order;
- source-level route rendering for `/`, `/about/`, `/research/`, `/cv/`,
  `/resume/`, `/blog/`, `/photography/`, `/bookshelf/`, and the 404 route;
- contrast calculations using the WCAG relative-luminance formula;
- authoritative guidance from MIT, W3C, USWDS, GOV.UK, and IBM Carbon.

All audited routes returned the expected HTTP status. `svelte-check` completed
with zero errors and zero warnings.

The in-workspace browser automation surface was unavailable, so this is not a
screenshot-based visual regression audit. Findings that depend on optical
alignment rather than measurable source or computed CSS are labeled as such.
A later correction pass should include screenshots at 375, 480, 768, 1024,
1280, and 1536 CSS pixels in both themes.

## What is already consistent

- The body uses a readable `17px / 1.55` Optima-based treatment
  ([`src/app.css`](../src/app.css#L49)).
- Display, prose, and interface/metadata text have clearly stated font roles
  ([`src/app.css`](../src/app.css#L25)).
- Most editorial routes use `32px` mobile and `48px` desktop page-top spacing.
- The core page shell consistently uses `16px` mobile and `24px` small-screen
  gutters.
- Primary reading text has strong light-theme contrast: `ink-700` on
  `cream-100` is `9.37:1`.
- The dark theme is a real theme rather than an isolated dark section.
- The site uses left-aligned reading text, balanced display headings, old-style
  figures in prose, tabular figures for data, and reduced-motion handling.
- Research cards use a ledger-row language instead of generic elevated cards.
- The riso banner, paper texture, animated research media, and boba game give
  the site a distinctive visual voice.

These qualities should be preserved.

## Priority definitions

| Priority | Meaning                                                    |
| -------- | ---------------------------------------------------------- |
| P1       | Accessibility, cascade, or reading issue with broad impact |
| P2       | Noticeable cross-page inconsistency or missing system rule |
| P3       | Maintainability or polish issue                            |

## Findings for approval

### P1 — computed heading leading contradicts the declared heading style

Evidence:

- `.heading-display` declares `line-height: 0.95`
  ([`src/app.css`](../src/app.css#L118)).
- The type scale defines `text-3xl` as `1.875rem / 2.25rem`, or `1.2`
  ([`tailwind.config.js`](../tailwind.config.js#L10)).
- Ordinary titles combine both classes, including the shared page shell
  ([`PageShell.svelte`](../src/lib/components/PageShell.svelte#L23)).
- In the compiled CSS, the utility layer occurs after the component layer, so
  `text-3xl` wins.

Impact: the source says page titles should have tight MIT-style display
leading, but the browser renders them substantially looser. Future changes to
either class can create more silent divergence.

Recommended correction: replace combinations such as
`heading-display text-3xl` with one atomic `type-page-title` style containing
family, weight, size, leading, tracking, wrapping, and responsive behavior.

Risk: low.

### P1 — several text color pairs fail WCAG AA

WCAG requires `4.5:1` for ordinary text and `3:1` for large text. Relevant
current pairs are:

| Foreground               | Background  |    Ratio | Result for ordinary text |
| ------------------------ | ----------- | -------: | ------------------------ |
| `ink-700` `#434343`      | `cream-100` | `9.37:1` | pass                     |
| `ink-500` `#666666`      | `cream-100` | `5.44:1` | pass                     |
| `ink-400` `#818181`      | `cream-100` | `3.69:1` | fail                     |
| `ink-300` `#A4A4A4`      | `cream-100` | `2.36:1` | fail                     |
| `accent-dark` `#C9462F`  | `cream-100` | `4.52:1` | pass, narrowly           |
| `accent` `#E85D4C`       | `cream-100` | `3.26:1` | fail                     |
| `ink-400`                | `ink-900`   | `4.47:1` | fail, narrowly           |
| `accent-dark`            | `ink-900`   | `3.65:1` | fail                     |
| `accent`                 | `ink-900`   | `5.06:1` | pass                     |
| `accent-light` `#F07563` | `ink-900`   | `6.16:1` | pass                     |
| `wine-light` `#B96481`   | `ink-900`   | `4.31:1` | fail                     |

Failing combinations appear in small CV metadata
([`cv/+page.svelte`](../src/routes/cv/+page.svelte#L70)), missing-rating text
([`RatingGlyph.svelte`](../src/lib/components/RatingGlyph.svelte#L43)), the
dark-mode global link rule ([`src/app.css`](../src/app.css#L164)), dark active
navigation ([`Header.svelte`](../src/lib/components/Header.svelte#L66)), and
dark category labels
([`bookshelf/+page.svelte`](../src/routes/bookshelf/+page.svelte#L477)).

Recommended correction:

- reserve `ink-400`, `ink-300`, and low-opacity colors for decoration,
  disabled states, or qualifying large text;
- use `ink-500` or darker for small light-theme metadata;
- use `cream-500` or lighter for small dark-theme metadata;
- use `accent-dark` for light-theme text and `accent-light` for dark-theme
  text;
- replace or remap `wine-light` for small dark-theme text;
- do not use `accent` as ordinary text on cream.

Risk: low.

### P1 — focus styles are inconsistent and some are too faint

Evidence:

- category controls use an accent ring at 40% opacity
  ([`bookshelf/+page.svelte`](../src/routes/bookshelf/+page.svelte#L511));
- that ring blends to approximately `1.59:1` against the light page and
  `2.02:1` against the dark page, below the `3:1` non-text contrast target;
- the custom select removes the outline and substitutes a one-pixel border
  shift ([`CustomSelect.svelte`](../src/lib/components/CustomSelect.svelte#L331));
- icon controls, link controls, buttons, and custom controls do not share a
  single focus contract.

Recommended correction: use a solid `2px` semantic focus color with a `2px`
offset in both themes. Use `accent-dark` on light surfaces and `accent-light`
on dark surfaces. Every interactive component should use the same
`:focus-visible` recipe unless an inset treatment is required.

Risk: low.

### P1 — long-form measure is wider than the intended reading measure

Evidence:

- `layout-main` is a structural `820px` container
  ([`src/app.css`](../src/app.css#L149));
- blog prose occupies that full shell with no character-based measure
  ([`blog/[slug]/+page.svelte`](../src/routes/blog/[slug]/+page.svelte#L94));
- About also uses the full shell for continuous prose
  ([`about/+page.svelte`](../src/routes/about/+page.svelte#L207)).

USWDS recommends a target near 66 characters for long text, while GOV.UK
recommends no more than roughly 75. The shell can remain `820px` for mixed
layouts, but prose should have an inner measure.

Recommended correction: add `measure-reading: 68ch` and
`measure-compact: 58ch`. Apply the reading measure to blog prose and long About
sections; keep cards, tables, media, and short copy on the structural
container.

Risk: low to medium because line wraps will change.

### P1 — `prose` and `prose-lg` imply behavior that is not installed

The About page uses `prose prose-lg`
([`about/+page.svelte`](../src/routes/about/+page.svelte#L217)), but the Tailwind
typography plugin is not present
([`tailwind.config.js`](../tailwind.config.js#L7)). Those classes do not
contribute styles.

Impact: the source communicates a false typography contract. A future
maintainer may assume the page uses a standardized prose system when it
actually relies on body inheritance and `space-y-4`.

Recommended correction: remove the no-op classes and use a local
`type-prose`/`prose-flow` recipe. Installing another plugin is unnecessary.

Risk: low.

### P2 — the type scale has names that do not match the body baseline

The body is `17px`, but:

- `text-base` is `16px`;
- `text-lg` is `17.6px`, nearly the body size;
- `text-sm` is `15.2px`;
- the homepage introduces `18px`, `0.95rem`, and `0.94em` one-offs.

There are also relative component values such as `section-heading: 1.2em`.
That style changes size according to its parent, and adding `text-sm` later
changes both its size and leading through the utility cascade.

Recommended correction: name type tokens by purpose, not comparative size:
`type-body`, `type-body-small`, `type-deck`, `type-section-heading`,
`type-item-heading`, `type-meta`, and `type-page-title`.

Risk: medium because text wraps can shift.

### P2 — body leading is sound, but neighboring leading rules are not unified

Current effective values:

| Role                 |            Size |          Leading |  Ratio |
| -------------------- | --------------: | ---------------: | -----: |
| Body                 |          `17px` |        `26.35px` | `1.55` |
| Homepage intro       |          `18px` |         `26.1px` | `1.45` |
| Page title, computed |          `30px` |           `36px` | `1.20` |
| Page title, declared |          `30px` |         `28.5px` | `0.95` |
| Section heading      |        `20.4px` |        `31.62px` | `1.55` |
| Small body           |        `15.2px` |         `22.4px` | `1.47` |
| Metadata             |          `12px` |           `16px` | `1.33` |
| Blog body            |          `18px` |         `30.6px` | `1.70` |
| Blog `h2` and `h3`   | `24px` / `20px` | inherited `1.55` | `1.55` |

The body and long-form values are comfortable. Section and blog headings are
comparatively loose, while the intended display title is much tighter than
the actual title.

Recommended correction: preserve body `1.55` and long-form `1.7`; set display
titles to `0.95–1.05`; set prose headings to `1.3–1.4`; keep metadata at
`1.25–1.35`.

Risk: medium.

### P2 — the navigation uses leading as a hit-area substitute

Site navigation is `12px` type with `28px` line-height
([`Header.svelte`](../src/lib/components/Header.svelte#L57)), a ratio of
`2.33`. The resulting click band is useful, but the type rhythm is unlike any
other metadata style.

Recommended correction: use `leading-none` or metadata leading on the text and
create the hit area with `min-height`, padding, or a pseudo-element.

Risk: low.

### P2 — spacing uses a scale, but the scale is not governed

Most layout utilities are compatible with a 4px base, which is good. However,
component CSS introduces values such as:

- `0.3rem`, `0.65rem`, and `0.45rem` in custom-select controls;
- `0.4rem` gaps on the homepage;
- `4px 11px` tooltip padding;
- `0.625rem 0.875rem` shader-caption padding;
- `11px` FPS text;
- several undocumented negative offsets and optical margins.

These values are not automatically wrong. The problem is that the repository
does not distinguish scale values from approved optical exceptions.

Recommended correction: adopt the subset `2, 4, 6, 8, 10, 12, 16, 20, 24, 32,
40, 48, 64px`; require a comment and component namespace for exceptions.

Risk: medium because controls may change by one or two pixels.

### P2 — page containers are duplicated rather than expressed as variants

The standard shell uses `layout-main`, while Bookshelf and Photography
hand-write nearly identical wide wrappers:

- [`PageShell.svelte`](../src/lib/components/PageShell.svelte#L19)
- [`bookshelf/+page.svelte`](../src/routes/bookshelf/+page.svelte#L497)
- [`photography/+page.svelte`](../src/routes/photography/+page.svelte#L90)

The existing `.layout-container` already supplies wide gutters, including an
extra `32px` large-screen gutter, but it is unused
([`src/app.css`](../src/app.css#L144)).

Recommended correction: give `PageShell` explicit `reading`, `standard`, and
`wide` variants. Keep header and footer alignment intentionally independent.

Risk: medium.

### P2 — page-title spacing has five different patterns

Examples:

- shared title: `mb-4` inside a `mb-6` wrapper;
- homepage title: `mb-4`;
- About title: `mb-6`;
- blog article title: `mb-3`;
- custom CV/Resume headers: no title margin, `mb-8` on the whole row;
- Photography title: `mb-0` in a row and `mb-8` on the section.

Some differences are valid because the next element differs, but those
relationships are encoded as route-specific margins rather than page-header
variants.

Recommended correction: add `PageHeader` recipes for title-only,
title-plus-deck, title-plus-meta, and title-plus-action. Spacing belongs to the
relationship, not to the title itself.

Risk: medium.

### P2 — section and paragraph rhythm is consistent within pages, not across pages

Current route rhythm:

| Area                    | Current spacing                                          |
| ----------------------- | -------------------------------------------------------- |
| Standard page top       | `32px`, `48px` from `md`                                 |
| Home major sections     | `32–48px`                                                |
| About major sections    | `48px`; dotted rules use `32px` vertical margins         |
| Research major sections | `48px`; year groups `28px`; cards `12px`                 |
| CV major sections       | `40px`; item groups vary `8–24px`                        |
| Blog index items        | `24px` vertical padding                                  |
| Blog paragraphs         | `22.4px` after each paragraph                            |
| Bookshelf control bands | `20px` between major bands                               |
| Photography grid        | `16px`                                                   |
| Footer                  | `16px` top margin, `24px` rule-to-content, `32px` bottom |

Recommended correction: keep deliberate density differences, but name them:
`flow-tight`, `flow-default`, `flow-relaxed`, `section-gap`, and
`page-section-gap`. Standardize heading proximity so space above a heading is
at least 1.5 times the space below it.

Risk: medium.

### P2 — controls have three useful densities, but they are undocumented

- primary `.btn` is approximately `42px` high at the inherited body metrics;
- Bookshelf category controls are fixed at `32px`;
- search input is `36px`;
- custom-select triggers are approximately `28px`;
- the theme toggle is `28px`.

All of these can be valid. The inconsistency is that “compact,” “dense,” and
“regular” are not formal variants, so adjacent controls sometimes need
route-specific alignment.

Recommended correction: define `control-dense: 28px`, `control-compact: 32px`,
and `control-regular: 40px`; use a minimum `24px` pointer target and prefer
`40px` for primary actions.

Risk: medium.

### P2 — motion values and easing curves have proliferated

The site uses durations from `110ms` to `400ms`, plus `260ms`, `350ms`,
`380ms`, and several cubic Bézier curves. The overall feel is still coherent,
but there is no reason a dropdown, disclosure, tooltip, page transition, and
card hover should independently invent timing.

Recommended correction: define `motion-instant: 100ms`, `motion-fast: 150ms`,
`motion-base: 200ms`, `motion-slow: 300ms`, `motion-reveal: 400ms`, plus two
approved easings. Preserve bespoke game animation in its namespace.

Risk: low.

### P3 — radius, shadow, and layer rules are present but not named

The editorial UI uses `2px` controls, `8px` images/cards, irregular riso
radii, several one-off shadows, and z-indices such as `30`, `50`, `100`, and
`9999`.

Recommended correction: define radius, shadow, and z-index tokens. Keep the
riso banner as a documented expressive exception and reserve the highest layer
for modals/lightboxes.

Risk: low.

### P3 — two icon systems are mixed without a selection rule

The site uses both `@jis3r/icons` and `lucide-svelte`, sometimes in the same
component, such as the footer. Stroke weight and animation language may vary
optically.

Recommended correction: use `@jis3r/icons` for expressive or animated
interactions and Lucide only when no matching icon exists. Standardize visible
sizes by context and align by optical box, not import source.

Risk: low.

### P3 — unused design-system rules make the source of truth less trustworthy

The following global rules or tokens have no site usage:

- `.heading-display-sm`;
- `.layout-container`;
- `.highlight-glow`;
- `.card`;
- Tailwind `layout-side` and `layout-main` percentage spacing helpers.

Recommended correction: either adopt them through named variants or delete
them. A style guide is most useful when every documented token has a current
purpose.

Risk: low.

### P3 — the display font has an undocumented small-size exception

MIT’s guide recommends Neue Haas Grotesk Display above `20px`, while the site
wordmark uses the display family at `16px`
([`Header.svelte`](../src/lib/components/Header.svelte#L44)). It may be a valid
brand-mark exception, but it should be explicit and tested for legibility.

Recommended correction: document the wordmark exception or use the Text cut if
the Adobe kit provides it.

Risk: low.

### P3 — the prose stack changes character across platforms

Optima is available on Apple systems, Candara is common on Windows, and the
remaining fallbacks are not guaranteed on all Linux or Android devices
([`src/app.css`](../src/app.css#L18)). The result can have different width,
x-height, and perceived leading on different platforms.

Recommended correction: retain the current stack for now, but add Windows,
Android, and Linux screenshots to visual QA. If cross-platform identity becomes
important, license and serve a web prose face with compatible metrics.

Risk: none for documentation; medium for any eventual font change.

## Deliberate exceptions that should remain

### Riso banner

The uneven radii, offset accent plate, and rough SVG filter are an expressive
brand moment. They should not be normalized to ordinary card tokens. The
component should use semantic colors where possible, but its geometry is an
approved exception.

### Boba game

The game is a self-contained illustrated experience with a deliberately denser
type scale, brighter sprite palette, and arcade-like spacing. Its `.boba-*`
namespace should remain separate from the editorial design system. Shared
requirements still apply to focus visibility, reduced motion, keyboard access,
and text contrast.

### Photography and Bookshelf widths

Photography needs visual breadth and Bookshelf needs data density. Their wider
containers are appropriate; they should be formal `wide` page variants rather
than one-off wrappers.

## Proposed correction packages

The packages are intentionally separable so they can be approved independently.

### Package A — foundation and accessibility

- [x] Make typography roles atomic and fix the display-leading cascade.
- [x] Add semantic light/dark color variables.
- [ ] Repair failing text contrast pairs — deferred by request.
- [ ] Standardize `:focus-visible` — deferred by request.
- [x] Replace the no-op About prose classes.
- [x] Add prose measure tokens.

Expected impact: high; implementation risk: low to medium.

### Package B — spacing and page rhythm

- [x] Add `PageShell` width variants.
- [x] Add page-header variants.
- [x] Add named vertical-flow and section-gap recipes.
- [x] Normalize component CSS to the approved 4px-based scale.
- [x] Keep documented optical exceptions.

Expected impact: high; implementation risk: medium because line wraps and
page heights will change.

### Package C — component polish

- [x] Formalize control density, radius, shadow, and layer tokens.
- [x] Consolidate motion timings and easing curves.
- [x] Add an icon-selection rule and optical-size map.
- [x] Remove unused global styles and tokens.

Expected impact: moderate; implementation risk: low.

### Package D — visual verification

- [x] Compile the production bundle and smoke-test every primary route.
- [ ] Capture all primary routes at the six repository breakpoints.
- [ ] Test light and dark themes.
- [ ] Test 200% zoom and WCAG text-spacing overrides.
- [ ] Test keyboard focus order and target spacing.
- [ ] Compare Apple, Windows, and Linux/Android prose fallbacks.

Expected impact: confidence and regression protection; implementation risk:
none.

## Research basis

- [MIT Brand Guide: Typography](https://brand.mit.edu/typography) recommends
  tight `85–100%` leading for large NHG display text and distinguishes Display
  from Text at `20px`.
- [USWDS Typography](https://designsystem.digital.gov/components/typography/)
  recommends at least `16px` for most running text, a long-form target near 66
  characters, at least `1.5` leading for longer text, and stronger grouping
  through systematic whitespace.
- [USWDS Spacing Units](https://designsystem.digital.gov/design-tokens/spacing-units/)
  demonstrates a tokenized 8px foundation with smaller intermediate values.
- [GOV.UK Layout](https://design-system.service.gov.uk/styles/layout/) advises
  mobile-first layouts and approximately 75 characters or fewer per line.
- [GOV.UK Spacing](https://design-system.service.gov.uk/styles/spacing/)
  distinguishes responsive spacing from static component spacing.
- [WCAG 2.2 Contrast Minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum)
  defines `4.5:1` ordinary-text and `3:1` large-text thresholds.
- [WCAG 2.2 Text Spacing](https://www.w3.org/WAI/WCAG22/Understanding/text-spacing)
  requires content to tolerate user overrides of `1.5` line height, `2em`
  paragraph spacing, `0.12em` letter spacing, and `0.16em` word spacing without
  loss of content or function.
- [WCAG 2.2 Target Size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum)
  defines a `24 × 24` CSS-pixel minimum or sufficient separation.
- [IBM Carbon Color](https://carbondesignsystem.com/elements/color/overview/)
  uses role-based color tokens across themes and requires visible focus states
  on interactive elements.
