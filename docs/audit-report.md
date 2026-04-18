# UX Audit Report: atreydesai.com

*Phase 2 + 3 of the UX audit. Audit-only — no files modified.*

---

## Executive Summary

Ten highest-impact issues, in priority order:

1. **No skip-to-content link** — every keyboard user tabs through all 6 nav items on every page; this is a WCAG 2.4.1 Level A failure that affects all routes.
2. **Lightbox modals do not trap or manage focus** — keyboard users can interact with page content behind the overlay; affects both the photography lightbox and the research card lightbox.
3. **Email is hidden behind a click** — the primary contact action for academic visitors requires a user-initiated reveal, which is the single highest-friction point for collaborators, recruiters, and reviewers.
4. **TLDR is suppressed on the full research page for non-highlighted papers** — the most information-dense academic page hides the paper's one-line summary unless the paper is marked featured or a class project, forcing visitors to navigate to arXiv to understand each paper.
5. **Blog article cards have a misleading click target** — the full `<article>` element has hover styling (group-hover color change) but only the `<h2>` inside it links anywhere; the card looks fully clickable but isn't.
6. **The photo container inside the photography lightbox is `aria-hidden="true"`** — this hides all image alt text from assistive technology while the lightbox is open, making the photography page completely opaque to screen reader users.
7. **Stagger animation delays up to 0.95 seconds** — on pages like the blog listing, the 20th item in a `stagger-children` list appears after nearly a full second, which is beyond the 0.5s threshold at which delay becomes perceptible as lag (ISO 9241).
8. **The footnote superscripts on the About page have no interaction feedback** — clicking `[1]` does nothing visible; the sidebar simply shows the footnote if it's in the viewport, but users who click the number expecting a jump-to-link receive no response.
9. **CV has two simultaneous content sources** — the page embeds a PDF iframe and then duplicates CV sections as HTML below it, creating maintenance overhead and an inconsistent reading experience.
10. **Navigation mixes academic and lifestyle sections without grouping** — the order (About, Research, Photography, Blog, Bookshelf, CV) does not match either primary audience's mental model, increasing cognitive cost for first-time visitors.

---

## Project Structure Map

**Framework:** SvelteKit 2.16 / Svelte 5, Vite, adapter-vercel  
**Styling:** Tailwind CSS 3.4 with extended custom design system (`app.css`)  
**Content:** YAML + Markdown via Rollup/Vite glob imports  
**Fonts:** Neue Haas Grotesk Display/Text (Adobe Typekit), Source Serif 4 (Google Fonts)

```
src/
├── routes/
│   ├── +layout.svelte          # Root layout: Header, Footer, page transitions
│   ├── +page.svelte            # Homepage: hero, interests, featured papers
│   ├── about/+page.svelte      # About: bio, dynamic footnote sidebar
│   ├── research/+page.svelte   # Research: publications, preprints, talks + filter
│   ├── blog/+page.svelte       # Blog listing: tag filter + post cards
│   ├── blog/[slug]/+page.svelte# Blog post: prose-styled markdown content
│   ├── bookshelf/+page.svelte  # Bookshelf: full search/filter/sort table
│   ├── photography/+page.svelte# Photography: masonry grid + lightbox
│   ├── cv/+page.svelte         # CV: PDF embed + duplicated HTML sections
│   └── resume/+page.svelte     # Resume: PDF embed
└── lib/components/
    ├── Header.svelte            # Fixed sticky nav, mobile drawer
    ├── Footer.svelte            # DC time, music player
    ├── ResearchCard.svelte      # Paper card with lightbox
    ├── CustomSelect.svelte      # Accessible dropdown
    ├── ScrollReveal.svelte      # IntersectionObserver animations
    ├── OptimizedImage.svelte    # Lazy load + blur placeholder
    ├── LegoImage.svelte         # Canvas pixelation hover effect
    ├── RatingCircle.svelte      # SVG progress circle
    ├── HyperText.svelte         # Character scramble animation
    ├── DarkModeToggle.svelte    # Theme switcher
    ├── CustomCursor.svelte      # Desktop custom cursor
    ├── Seo.svelte               # Meta + JSON-LD
    └── Markdown.svelte          # Marked.js renderer
```

---

## Findings Table

| # | Issue | Location | Principle Violated | Evidence | Severity | Effort |
|---|-------|----------|--------------------|----------|----------|--------|
| 1 | No skip-to-content link | No file in `src/` — absent sitewide | WCAG 2.4.1 (Level A) | Every keyboard user traverses 6 nav links before reaching main content on every page load | **Critical** | S |
| 2 | Lightbox does not trap focus (photography) | `photography/+page.svelte:152-273` | WCAG 2.1.2 (Level AA) | `tabindex="-1"` set but `el.focus()` never called; focus can escape the overlay | **Critical** | S |
| 3 | Lightbox does not trap focus (research card) | `ResearchCard.svelte:386-463` | WCAG 2.1.2 (Level AA) | Same pattern: dialog opened but not focused, `svelte-ignore a11y-no-noninteractive-element-interactions` suppresses the warning | **Critical** | S |
| 4 | Photo container `aria-hidden="true"` in lightbox | `photography/+page.svelte:195-199` | WCAG 1.1.1 (Level A), 4.1.2 | All image alt text and EXIF metadata is hidden from screen readers while the lightbox is open | **Critical** | S |
| 5 | Email hidden behind click | `+page.svelte:116-128` | Nielsen H6 (Recognition>Recall); Fogg (2002) credibility | Primary contact for both audiences requires a user-initiated reveal; Kang et al. (2020) ranks contact friction as a top pain point | **High** | S |
| 6 | TLDR suppressed on full research page | `ResearchCard.svelte:215` | Progressive disclosure (Krug 2000); Kang et al. (2020) | `{#if paper.tldr && (isPreview || paper.highlight || paper.classProject)}` — non-highlighted papers on `/research` show no abstract | **High** | S |
| 7 | Blog article entire card looks clickable but only `<h2>` is | `blog/+page.svelte:78-119` | Nielsen H4 (Consistency); Fitts's Law | `group-hover` applied to `<article>`, `group-hover:text-ink-700` on `<h2>`, but no `<a>` wraps the full card | **High** | S |
| 8 | Stagger delays reach 0.95s on 20th item | `app.css:283-366` | ISO 9241-110 (0.5s responsiveness threshold) | `.stagger-children > *:nth-child(20)` has `animation-delay: 0.95s` — the blog listing uses `stagger-children` | **High** | S |
| 9 | CV iframe + duplicated HTML sections | `cv/+page.svelte:38-46, 49+` | Nielsen H1 (Visibility); information architecture | Two simultaneous representations of the same content; if PDF is updated, HTML is not, or vice versa | **High** | M |
| 10 | Footnote superscripts have no interaction response | `about/+page.svelte:65-70, 278-296` | Nielsen H1 (Visibility of system status) | `[^1]` markers are styled as clickable (`cursor: pointer`) but clicking does nothing visible on most displays; sidebar may or may not be visible | **Medium** | S |
| 11 | Nav mixes academic and lifestyle content | `Header.svelte:8-15` | Mental model mismatch (Spencer 2009); Hick's Law | Order: About, Research, Photography, Blog, Bookshelf, CV — neither audience's expected grouping | **Medium** | S |
| 12 | Mobile prose line length is too short | `app.css:76-77` | Dyson & Haselgrove (2001) | `max-w-[700px]` with `px-4` at 375px viewport → ~343px effective width → ~37-42 chars/line (below 45 minimum) | **Medium** | S |
| 13 | Substack notice is positioned above the post list | `blog/+page.svelte:41-54` | Information hierarchy; progressive disclosure | External publishing notice displaces the primary content; signals the site blog is secondary | **Medium** | S |
| 14 | Research filter has explanatory prose ("Refine by year...") | `research/+page.svelte:157-159` | Nielsen H8 (Aesthetic); label clarity | Good control labels make instruction text redundant; prose takes up space and slows scanning | **Low** | S |
| 15 | About footnote sidebar may overlap content at lg breakpoint | `about/+page.svelte:82-106` | Layout stability | Fixed `right-4`, `w-48` aside at 1024px viewport with `max-w-[700px]` main — aside starts at 700+layout padding+sidebar leaving ~zero clearance | **Medium** | S |
| 16 | No reading time on blog posts | `blog/+page.svelte:94-116` | Nielsen NNG blog usability (2010) | Date and tags shown, reading time absent — the third most-consulted metadata before deciding to read | **Low** | S |
| 17 | Blog post has no next/previous navigation | `blog/[slug]/+page.svelte:1-153` | Information foraging (Pirolli & Card 1999) | Dead end after reading a post — only "Back to blog" | **Low** | S |
| 18 | Custom cursor removes system cursor globally | `app.css:240-242`; `CustomCursor.svelte` | Accessibility (WCAG 2.5.3); trust | `cursor: none` on `.cursor-custom` class on body; custom cursor uses `mix-blend-mode: difference` which can disappear over certain backgrounds | **Low** | M |
| 19 | No Google Scholar/ORCID link in nav or hero | `Header.svelte:8-15`; `+page.svelte:34-38` | Kang et al. (2020) academic presence study | Scholar link exists in social icons on homepage but not in nav; ORCID absent entirely | **Low** | S |
| 20 | CV page has no "last updated" indicator | `cv/+page.svelte:32-35` | Fogg et al. (2002) credibility | Reviewers cannot tell if CV is current without downloading it | **Low** | S |

---

## Audience-Specific Walkthroughs

### Academic Visitor

*Scenario: a faculty member at another institution has read a preprint, clicked the author link, and arrived at the homepage.*

**Landing on `/`:**  
The hero loads well. The H1 "hey, i'm atrey desai." with the HyperText animation is charming and distinctive. The visitor scans right for institution affiliation — this is in the intro paragraphs below, but not above-the-fold in a scannable form. A visitor skimming in F-pattern may not register "University of Maryland" before scrolling, because it's embedded in prose rather than set apart as a meta-label. The social icons (GitHub, Twitter, Scholar) are small and unlabeled — a scholar icon with a graduation-cap symbol is not universally recognized as "Google Scholar."

The email icon is visible, which is good. But clicking it plays a letter-drop animation and reveals the address — a delightful interaction for casual visitors, but a small cognitive speed bump for a time-pressed reviewer who expected to click-to-open-email directly.

The Research section below the fold shows 3 featured papers. This is well-curated and correct.

**Navigating to `/research`:**  
The research page surfaces all content correctly: publications → preprints → class projects → talks. The filter UI is appropriately placed. **However:** on a full page with 8 papers (not preview mode), none of the non-highlighted, non-class-project papers show their TLDR. The visitor sees venue, year, author list, tags, and links — but no one-sentence summary of what the paper actually found. They must click through to arXiv for each paper they want to evaluate. This is the most significant friction point for academic visitors.

The deep-linking hash feature (`/research#paper-id`) is useful for linking from other pages, but the 3-second flash highlight may expire before slow scrolling animation finishes on long pages.

**Finding the CV:**  
CV is in the nav. The page loads a PDF iframe correctly. Below it, hardcoded HTML sections duplicate the content — the visitor may see the embedded PDF and never scroll to the HTML, or may read the HTML without realizing the PDF is above. These two representations can fall out of sync.

**Trying to contact:**  
The visitor goes back to the homepage, clicks the Mail icon, watches the animation, then clicks the revealed address. Three interactions for what should be one. For a collaborator in a time-pressured context (e.g., reviewing applications before a deadline), this is meaningful friction.

**Total friction points for academic visitor:** 4 (missing institution above fold, no TLDR on research page, email reveal, PDF/HTML CV split).

---

### Photography/Blog Visitor

*Scenario: a friend-of-a-friend has been told to check out the photography portfolio. They arrive at the homepage, don't know Atrey's research, and are here for creative content.*

**Landing on `/`:**  
The profile image has a Lego pixelation hover effect — immediately delightful and distinctive. The copy talks about NLP and AI research. The visitor scans down: "interests" section is research-oriented. "Research" section shows paper cards with academic venue badges. The visitor finds no clear path to photography from the homepage — they must look at the navigation and find "Photography."

The navigation order has Photography third, after About and Research. For this visitor, Photography is their primary goal, but it's not prominent. There is no photography teaser, preview, or link on the homepage.

**On `/photography`:**  
The masonry grid loads and looks beautiful. The variety of aspect ratios is handled correctly. Hovering a photo shows a very subtle scale-up (`scale-[1.02]`) — the hover affordance is present but minimal. Clicking a photo opens the lightbox. The lightbox works well for mouse users: close button visible at top-right, arrow keys and chevron buttons for navigation, EXIF data and photo counter at the bottom.

**Lightbox as a keyboard user:**  
Focus is not moved to the dialog on open. The close button has an `aria-label`, but without focus management, a keyboard user cannot interact with the lightbox at all without tabbing blindly. The photo content (`aria-hidden="true"`) is invisible to a screen reader, so no alt text is announced.

**Navigating to `/blog`:**  
The blog listing shows 2 posts. Before the post list, a notice says "I also write on Substack: Subscribe to my newsletter." This notice creates an ambiguity — if Substack is the primary writing venue, why is there a `/blog` at all? For a first-time visitor, this is a split signal.

The post cards have a group-hover effect that makes the entire `<article>` appear interactive (title color changes, suggesting the card responds), but clicking the body of the article does nothing. Only clicking the `<h2>` title link navigates. This is a significant discoverability failure for mobile users whose touch targets may land on the excerpt text below the title.

**Reading a blog post:**  
The post page is clean and readable. Good typography, correct heading hierarchy. The only gap: after finishing the post, the "Back to blog" link is the only navigation offered. There is no "next post" or "related reading" option, so the visitor dead-ends.

**Total friction points for photo/blog visitor:** 3 (no photography teaser on homepage, blog article non-clickable card body, post dead-end).

---

## Prioritized Suggestions

### Quick Wins (< 1 day each)

**1. Add a skip-to-content link**  
In `+layout.svelte`, before the `<Header>`, add:
```html
<a href="#main-content" class="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] btn-primary">
  Skip to content
</a>
```
Add `id="main-content"` to the `<main>` element (or the first `<div class="layout-main">` in each page).

**2. Fix focus management in both lightboxes**  
In `photography/+page.svelte` and `ResearchCard.svelte`, after setting `lightboxOpen = true`, call `document.querySelector('[role="dialog"]').focus()`. Add a focus trap: in the dialog's `keydown` handler, intercept `Tab` and `Shift+Tab` to keep focus within the dialog.

**3. Remove `aria-hidden="true"` from the photo container**  
`photography/+page.svelte:199` — the `div` wrapping the `<img>` and EXIF info should not be aria-hidden. The image gets its accessible name from `alt`, and the EXIF text is useful context. Remove the attribute.

**4. Show TLDR unconditionally when it exists on the research page**  
`ResearchCard.svelte:215`: Change  
`{#if paper.tldr && (isPreview || paper.highlight || paper.classProject)}`  
to  
`{#if paper.tldr}`  
This surfaces the abstract-equivalent to any visitor on `/research`, which is the highest-value information for the primary academic audience.

**5. Make the entire blog article card a link**  
`blog/+page.svelte:78-119`: Wrap the `<article>` in an `<a href="/blog/{post.id}">`, or move the click event to the article element. Remove the nested `<a>` on the `<h2>` to avoid nested links (invalid HTML). The group-hover styling already implies the card is a unit — the semantics should match.

**6. Reduce stagger animation ceiling**  
`app.css:282-378`: The 20-item stagger reaching 0.95s is too slow. Cap it at 10 items (0.45s maximum delay) and give items 11+ the same `0.45s` delay. Or reduce the per-item increment from 0.05s to 0.03s.

**7. Move the Substack notice to the footer of the blog page**  
`blog/+page.svelte:41-54`: Move the Substack card below the post list, or into the sidebar of the blog layout if one is introduced. The notice should not compete with the post list for primary position.

**8. Add a "last updated" date to the CV page**  
`cv/+page.svelte:32-35`: A single line of text below the download button — "Last updated: [Month Year]" — eliminates reviewer uncertainty about currency.

**9. Make footnote superscripts anchor-link to the footnote sidebar (desktop) or footnote section (mobile)**  
`about/+page.svelte:65-70`: Replace the plain `<sup data-footnote>` with an `<a href="#fn-{id}">` anchor that scrolls to the footnote. On desktop, the sidebar `id="fn-{id}"` elements already exist. This gives users a predictable action for an element that currently looks interactive but does nothing when clicked.

**10. Add `aria-sort` attributes to bookshelf sort column headers**  
`bookshelf/+page.svelte` (sort button elements): When `sortField === col`, add `aria-sort={sortDirection === "asc" ? "ascending" : "descending"}`. For unsorted columns, add `aria-sort="none"`. This exposes sort state to screen reader users without any visual change.

---

### Medium Refactors (1–3 days)

**11. Surface contact email above the fold without requiring a click**  
Consider showing the email address directly in the social links row, optionally with lightweight obfuscation (CSS-reversed text, or a `mailto:` link that doesn't require a reveal at all). The letter-drop animation can still play on page load. Alternatively, add a persistent "contact" link in the nav. The reveal pattern is clever but it disadvantages the people who most need to contact you quickly.

**12. Resolve the CV dual-source problem**  
Choose one of two approaches:
- **PDF only:** Remove the duplicated HTML sections below the iframe. Add a fallback message if the browser cannot render the PDF. This eliminates the maintenance burden.
- **HTML only:** Remove the iframe, generate the CV from structured YAML/JSON (consistent with the existing content architecture), and add a "Download PDF" that generates or serves a pre-rendered PDF. This approach is more accessible but requires a generation step.

**13. Restructure the navigation to reflect audience groupings**  
Current: `About | Research | Photography | Blog | Bookshelf | CV`  
Proposed: `About | Research | CV | Photography | Blog | Bookshelf`  
This groups the academic-primary items (Research, CV) together and the creative/lifestyle items (Photography, Blog, Bookshelf) together. The homepage order of sections (research interests → research papers) already implies research is primary — the nav should reinforce that. Alternatively, introduce a visual separator between the two groups.

**14. Address the About footnote sidebar collision at lg breakpoint**  
`about/+page.svelte:82-84`: The aside is `fixed right-4 w-48`. At 1024px (the `lg` breakpoint where it becomes visible), the main content column is `max-w-[700px]` centered, which extends roughly to the center. The aside starts ~192px from the right edge, so there's about 1024-192=832px from the left. The main column + centering math leaves roughly 100-160px of clearance depending on centering. This will clip at moderate viewport widths. Either:
- Change the aside to `xl:block hidden` (show only at ≥1280px), or
- Position it relative to the layout container rather than the viewport.

**15. Add institution + current role as scannable text above or beside the intro**  
On the homepage, add a brief line in `meta-label` style — "CS + Linguistics · University of Maryland · NLP / AI Safety" — before or alongside the intro paragraphs. This satisfies the F-pattern scan for institution affiliation without disrupting the prose tone.

---

### Strategic Changes (multi-day)

**16. Homepage: add a photography teaser for the photo/blog audience**  
The homepage currently leads with identity + research. The photography/blog audience has no visual hook on the homepage. Adding a small mosaic or single hero image from the photography portfolio (3-4 images, constrained to a strip) would serve both audiences: it signals creative range to academic visitors and immediately communicates photographic quality to creative visitors. This is the biggest information architecture question and requires a design decision (see Design Decision Questions below).

**17. Blog: establish a clear publishing strategy**  
The presence of both a site blog and a Substack creates ambiguity. Either:
- **Site-first:** Write on the site; syndicate to Substack. The site blog becomes the canonical URL. Restructure the Substack notice to say "Subscribe for email delivery of new posts."
- **Substack-first:** Remove the site blog and replace with a prominent Substack link. Don't maintain two publication venues.
The current hybrid creates a ghost town at `/blog` (2 posts) while directing visitors away to Substack.

**18. Research page: add inline abstract on demand**  
For papers where `tldr` is null (no one-line summary), consider adding the option to expand a short abstract or link to the abstract section of the arXiv page without navigating away. A "Show abstract" toggle on each paper card would give academic visitors the information they need without requiring navigation. This also reduces the weight the TLDR field carries.

**19. Improve photo alt text strategy**  
The photography page currently uses `photo.alt` for each image. If alt text is auto-populated or generic, it fails both accessibility and SEO purposes. Establish an authoring convention: each photo should have a descriptive alt text that describes the scene (not just the camera settings). The EXIF data is shown in the lightbox; the alt text should describe what's in the frame.

---

## Design-Decision Questions

These questions must be answered before the strategic changes above can be designed correctly. They are listed in priority order.

1. **Who is the primary audience?** The site currently serves both audiences approximately equally. If academic visitors (collaborators, search committees, prospective advisors) are primary, then the homepage and nav should lead with research, and photography should be clearly secondary. If the site is equally a portfolio site and a research site, the homepage needs a clearer dual-entry structure (two explicit paths, or a homepage that more clearly communicates both identities). *This decision affects nav order, homepage layout, and the photography teaser question.*

2. **Should the email be revealed on page load?** The reveal animation is a distinctive interaction, but it disadvantages the highest-value contact scenario (time-pressured academic). One option: reveal on page load with a short delay (so the animation still plays), rather than requiring a click. Another: keep the click reveal but add a persistent `mailto:` link in the footer for users who missed the homepage. *This affects the homepage and possibly the layout.*

3. **Is the site blog an active publishing venue, or a secondary channel?** If you plan to write regularly on the site, the Substack notice should be repositioned (to footer) and the site blog should be the primary destination. If Substack is primary, remove the site blog from the nav and replace with a "Writing" page that links out to Substack. *This affects the nav, the blog route, and the content strategy.*

4. **Should the CV page be PDF-only, HTML-only, or both with explicit purpose separation?** The current design does both without explaining why. A possible rationale: the PDF is for downloading/printing; the HTML is for in-page reading/linking. If that's the intent, it should be communicated — e.g., "Prefer a downloadable PDF? [Download]" vs. "Browse below." *This affects the cv route.*

5. **Should photography and blog live under a "creative" umbrella in the nav?** If audience grouping is desired without removing any pages, a `Creative ▾` dropdown containing Photography, Blog, and Bookshelf would group lifestyle content and leave Research and CV as standalone nav items. This is a larger navigation refactor but solves the mental model mismatch cleanly. *This affects the Header component and potentially URL structure.*

6. **What is the intended state of the footnote interaction on About?** The current implementation shows footnotes in a sidebar when their markers scroll into view. If the intended experience is that clicking `[1]` does something (jumps to footnote, highlights sidebar item), the component needs an interaction layer. If the intended experience is purely ambient (footnotes appear as you read), the `cursor: pointer` style on the superscripts is misleading and should be removed. *This affects about/+page.svelte and the component's CSS.*

---

*Audit conducted April 2026. Framework: SvelteKit 2.16 / Svelte 5. No files modified.*
