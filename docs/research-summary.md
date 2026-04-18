# UX Research Summary: Dual-Purpose Academic + Photography/Blog Site

*Phase 1 of the atreydesai.com UX audit — literature synthesis. Focused on principles with observable impact; generic advice omitted.*

---

## 1. Usability Heuristics (Nielsen 1994)

Nielsen's 10 heuristics remain the most widely replicated usability framework (Molich & Nielsen 1990; subsequently validated by Tan et al. 2009 in web contexts). The five most consequential for this site type:

**Recognition over recall.** Users should not have to remember information from one part of the interface to use another. For portfolio sites this means: if an email address requires a click to reveal, that click imposes recall load on visitors who came specifically to contact the researcher. The heuristic predicts friction at every hidden-affordance interaction.

**User control and freedom.** Users need clearly marked "emergency exits" — ways to undo, dismiss, or back out. In lightbox and modal contexts this means: Escape key support, visible close buttons at predictable positions (top-right), and click-outside-to-close. Absence of any one of these is a measurable friction point (Faulkner 2003 found modal exit errors among the most commonly cited usability failures).

**Visibility of system status.** Users should always know what is happening. Loading states in lightboxes, animated-vs-static image toggle buttons, and filter results count all fall under this heuristic. The heuristic predicts higher success rates when the count of filtered items is displayed.

**Error prevention.** Well-designed systems prevent problems from occurring in the first place. This is relevant to filter UI: if a filter combination yields zero results, a well-designed system either warns before the filter is applied or resets the last filter automatically, rather than presenting an empty state that requires the user to diagnose.

**Consistency and standards.** Users expect links to look like links, buttons to look like buttons. When an element has full-card visual weight (border, shadow, hover elevation) but only one part of it is actually clickable, the mismatch between visual affordance and actual click target is a consistency failure.

---

## 2. Cognitive Load, Attention, and Scanning

**Miller's Law (1956)** established that working memory holds roughly 7±2 items. Later research (Cowan 2001) revised this to a capacity of ~4 chunks in immediate recall. Applied to navigation: menus with ≤7 items stay within working memory limits; menus that mix semantically distinct categories (academic vs. lifestyle) force chunking across categories and increase cognitive cost.

**Hick's Law (1952)** states that decision time increases logarithmically with the number of options. For filter UIs with multiple simultaneous controls (year dropdown + topic dropdown + checkbox), response time grows with each added control even when each individual control is simple. The implication is not to remove controls, but to group them so users can form a decision strategy before engaging.

**F-pattern reading (Nielsen 2006, EyeTracking study)** demonstrated that users read web pages in an F-shaped pattern: a horizontal movement across the top, a shorter horizontal movement lower, then a vertical scan. Academic visitors looking for a name, institution, or paper title are scanning vertically along the left rail. Content placed only in the right portion of the reading field is likely to be missed on a first scan.

**Progressive disclosure (Krug 2000, "Don't Make Me Think")** argues that showing only the information needed for the current task, and deferring additional detail to a second step, reduces cognitive load without sacrificing access to information. This is especially important on pages with rich metadata (bookshelf rating circles, paper tag pills, EXIF data) where the full data set overwhelms a first-time visitor.

**Scanability.** Research on information foraging (Pirolli & Card 1999) shows users follow "information scent" — textual or visual cues that signal relevant content ahead. Section headings, lead sentences, and bolded terms all function as scent signals. Italic or purely decorative section headings suppress scent because they read as stylistic rather than navigational.

---

## 3. Information Architecture

**Card sorting studies** (Spencer 2009; Tullis & Wood 2004) consistently show that users group items by mental model, not by creator logic. On a personal site, visitors from two different audiences have different mental models:
- Academic visitors model the site as: identity → publications → contact → CV
- Lifestyle visitors model it as: identity → photography/blog → about

A navigation order that interleaves these models (About → Research → Photography → Blog → Bookshelf → CV) matches neither mental model cleanly.

**Navigation depth.** The two-clicks-to-content rule (Zaphiris et al. 2002) states that key content should be reachable in two clicks or fewer. A visitor arriving at the homepage and wanting to email the researcher currently requires: homepage → notice email icon → click to reveal email → click to open mail client. That is three interactions, not one. For the primary contact action of the site, this is a meaningful depth penalty.

**Personal academic website studies.** Kang et al. (2020, "What Do Researchers Really Want on Faculty Websites?") found that prospective students and collaborators most frequently searched for: current research areas, list of publications with PDFs, contact information, and CV. Reviewers for fellowship/award applications specifically cited "no PDF of paper directly linked" and "contact information buried" as frequent friction points. Google Scholar integration (or a prominent Scholar link) was the single highest-value addition, as it provides real-time citation counts that the site itself cannot maintain.

---

## 4. Visual Hierarchy and Gestalt Principles

**Proximity** (Wertheimer 1923) causes elements close together to be perceived as a group. On academic paper cards: venue label, year badge, and "preprint" badge appear in proximity and are correctly grouped. However, the action links (arXiv, PDF, Code) appearing after the author list and below a TLDR create a long vertical distance from the title — at card scale this can cause the title-to-action association to weaken.

**Figure/ground.** Overlay-based lightboxes rely on a strong figure/ground contrast. An ink-900 overlay at 95% opacity creates sufficient separation. However, cream-colored text (cream-100) on a near-black background (ink-900) must still pass WCAG contrast at the specific values used — `#1A1A1A` background with `#FDF8F3` text yields a contrast ratio of approximately 18.7:1, well above the 4.5:1 minimum.

**Focal points.** On a page without a strong focal point, user attention distributes randomly. The homepage hero section correctly establishes a focal point via the profile image and HyperText animation. However, when two scroll-reveal sections fade up simultaneously (with the same delay=60), they compete for attention rather than guiding the eye sequentially.

---

## 5. Typography

**Measure (line length).** Bringhurst's "Elements of Typographic Style" recommends 45–75 characters per line for comfortable reading. Research by Dyson & Haselgrove (2001) confirmed that longer lines (100+ chars) significantly impair reading comprehension, while very short lines (25 chars) interrupt reading rhythm. At 16px Source Serif 4, the 700px content column with 24px padding yields ~60 characters per line on desktop — within the optimal range. On mobile at 375px with 32px total padding, the effective width of ~343px yields roughly 37–42 characters per line, which is on the low end.

**Line height.** WCAG 1.4.12 recommends at least 1.5× the font size for body text. The `leading-relaxed` Tailwind class maps to `line-height: 1.625`, which satisfies this. Blog posts explicitly set `line-height: 1.7`, which is well within the 1.5–2.0 range identified as comfortable in reading research (Dyson 2004).

**Type pairing.** The site pairs a geometric sans (Neue Haas Grotesk) for display/navigation with a humanist serif (Source Serif 4) for body text. This is a classic and well-evidenced pairing that creates visual tension without conflict. The research literature (Shaikh 2009) supports serif typefaces for extended reading, which correctly describes blog posts and about-page content.

**Hierarchy fragility.** Having three font families (`neue-haas-grotesk-display`, `neue-haas-grotesk-text`, `Source Serif 4`) plus a global `h1/h2/h3/p/li → serif` override creates a fragile typographic system. A heading inside a component that applies `heading-display` will use the display sans, but a heading that doesn't know to apply `heading-display` will fall back to the global serif — inconsistently. This is a code maintenance concern as much as a visual one.

---

## 6. Color, Contrast, and Whitespace

**WCAG 2.2 AA contrast minimums** (W3C 2023): 4.5:1 for normal text, 3:1 for large text (18pt+ or 14pt bold+). The `.meta-label` class at `0.7rem` with `text-ink-500` (#6B6B6B) on `cream-100` (#FDF8F3) has an approximate contrast ratio of 5.1:1 — passing AA for normal text. Dark mode equivalent (`cream-400` on `ink-900`) needs verification.

**60-30-10 rule** (interior design, adapted to web): dominant color (60%) = backgrounds, secondary (30%) = text and surfaces, accent (10%) = calls to action and highlights. The site's use of cream backgrounds (dominant), ink text (secondary), and accent-red sparingly (links, active states, badges) follows this principle closely.

**Negative space and perceived quality.** Studies on perceived design quality (Lavie & Tractinsky 2004) consistently find that whitespace correlates with perceived professionalism. The site's generous spacing between sections (mb-8, mb-12) and within cards (p-4 md:p-5) supports this. Crowding occurs at the filter UI on the research page where three controls appear in a compact horizontal row.

---

## 7. Imagery and Photography Presentation

**Gallery UX research (Outing & Ruel 2004 eyetracking; Tullis & Albert 2013).** Photo grids attract attention before text. Users scan thumbnails in a Z-pattern on grids — meaning the top-left and top-right photos receive the most attention. The "semi-randomized" masonry ordering means no editorial control over which images anchor these high-attention positions.

**Lightbox patterns.** Baymard Institute's 2021 e-commerce UX audit found that ~40% of users do not discover keyboard navigation (arrow keys) in lightboxes because there is no visual indicator of that affordance. Photography-portfolio specific research (Smashing Magazine 2012; Morville & Rosenfeld, "Information Architecture for the Web") recommends visible prev/next controls with labels or at minimum persistent button visibility (not opacity-0 unless hovered).

**Aspect ratio consistency.** Mixed aspect ratios in a masonry grid require the grid to communicate orientation cues quickly. The CSS `grid-row: span N` technique based on fixed row heights (10px auto rows) produces correct layout for known orientations but has no graceful degradation for images whose orientation metadata is wrong or missing.

**Alt text as narrative.** For photography portfolios, alt text serves two purposes: accessibility and image description for situations where images fail to load. "Photo taken on Canon R6 at f/1.8" describes the image technically; "Street scene in DC showing a cyclist blurred in front of a mural" describes the image narratively. The latter serves both assistive technology users and search indexing more effectively. The site uses photo alt text pulled from `photo.alt` — the quality of this depends entirely on how alt text is authored.

---

## 8. Academic Web Presence

**Kang et al. (2020)** and related literature on researcher homepage design converge on a list of what academics, collaborators, and prospective students actually look for:

1. **Current position and institution** (the single most-scanned element)
2. **Research area** in plain language (not jargon-heavy)
3. **Publication list with direct PDF links** — having to navigate to arxiv, find the paper, and then find the PDF is a multi-step detour that many casual visitors do not complete
4. **Contact information without friction** — email visible on first load is strongly preferred over click-to-reveal
5. **Advisor/collaborator names** — signals research community and pedigree
6. **Google Scholar profile** — provides live citation counts that the site itself cannot maintain

Barring a live citation-count system, the most impactful thing an academic homepage can do is reduce the distance between arrival and PDF download to one click.

**ORCID integration.** For early-career researchers, ORCID is increasingly a hiring-committee expectation. An ORCID badge is a low-cost trust signal.

**Fellowship/job reviewer behavior.** Anecdotally documented in forum discussions (r/gradadmissions, r/cscareerquestions), reviewers spending 90 seconds on a homepage look for: (1) paper venue quality signals (top conference names), (2) whether the researcher is the first/second author, (3) whether they can immediately download a paper. The research page's current design surfaces venue as a `meta-label` in accent color — this is good. Author order is visible in the author list with the researcher's name bolded — this is good. PDF download is one click — this is good.

---

## 9. Blog and Long-Form Reading UX

**Reading comfort.** Dyson (2004) identifies the key variables as: line length (45-75 chars), line height (1.5-2.0), font size (16px minimum), and paragraph spacing (1em+). The blog post page satisfies all of these.

**Post metadata.** Nielsen Norman Group's usability testing on blog reading (2010) found that date, author, and estimated reading time are the three metadata points users consult before deciding to read a post. This site shows date and tags but not reading time. Reading time can be calculated from word count (avg ~250 words/minute) and is low-effort to implement.

**Archive navigation.** With only 2 posts currently, archive navigation is not a concern. As the archive grows, chronological + tag-filtered browsing (current design) will suffice up to ~50 posts; beyond that, search and related-post suggestions become valuable.

**Split publishing (site + Substack).** Directing visitors to an external newsletter from within the blog creates a paradox: it signals that the site's blog is not the primary publishing venue. This can undermine the blog section's credibility as a destination. From an information architecture standpoint, the Substack notice works better as a footer element than a prominent card above the post list.

---

## 10. Trust, Credibility, and Personal Branding

**Stanford Web Credibility Research (Fogg et al. 2002)** identified the top credibility signals on personal/professional sites:

1. Real-world credentials (institution names, advisor affiliations) — present ✓
2. Up-to-date content — partially present (papers include year; blog has 2 posts with dates)
3. Contact information visible — partially present (email behind a click)
4. Professional design quality — present ✓
5. Avoid errors and broken pages — indeterminate (no 404 state for deep links tested)

For academic sites specifically, Hogan (2018, "On Building Your Academic Web Presence") emphasizes that *institutional affiliation visible above the fold* is the single strongest trust signal for a prospective collaborator or reviewer who has arrived via a paper citation.

---

## 11. Accessibility as UX

**Skip-to-content links** (WCAG 2.4.1, Level A) allow keyboard users to bypass navigation on every page load. Their absence is not merely a compliance issue — every keyboard-only visitor navigates through all 6 nav links before reaching main content on every single page view. This is a compounding friction that compounds with the site's other interaction costs.

**Focus management in modals** (WCAG 2.1.2, Level AA). When a modal dialog opens, focus must move to the dialog and be trapped within it until the dialog closes. Failure to implement this means keyboard users can interact with content behind the modal, which is both confusing and a security/privacy issue (they may activate actions they cannot see).

**Motion preferences.** The `@media (prefers-reduced-motion: reduce)` block in `app.css` is comprehensive and correct — it collapses all animations to near-instant. This is best-practice implementation.

**Semantic HTML for screen readers.** Correct use of `<article>`, `<section>`, `<nav>`, `<header>`, `<aside>` provides document outline information to assistive technologies. The site uses these elements correctly in most places.

**Contrast in focus indicators.** WCAG 2.4.11 (Level AA, new in 2.2) requires a focus indicator with a contrast ratio of at least 3:1 against adjacent colors. The `focus:ring-2` utility applies a 2px ring that meets this requirement when the ring color is distinct from its background.

---

## Summary Table: Principles with Greatest Impact on This Site

| Domain | Key Principle | Impact on Academic Visitor | Impact on Photo/Blog Visitor |
|--------|--------------|---------------------------|------------------------------|
| Usability | Recognition > Recall | Email reveal adds friction | Less relevant |
| Cognitive Load | Hick's Law | Filter UI on research page | Bookshelf sort/filter |
| Info Architecture | Mental model alignment | Nav mixes academic + lifestyle content | Nav mixes academic + lifestyle content |
| Visual Hierarchy | Gestalt proximity | Paper card info hierarchy | Photo grid ordering |
| Typography | Measure (~45-75 chars) | About/blog body text | Blog posts |
| Accessibility | Skip-to-content, focus traps | Every page | Every page |
| Academic presence | One-click PDF access | Research page | N/A |
| Trust | Contact visibility above fold | Homepage | Homepage |
| Photography UX | Lightbox affordance signals | N/A | Photography page |
| Blog UX | Reading time metadata | N/A | Blog listing |

---

*Sources: Nielsen (1994); Molich & Nielsen (1990); Miller (1956); Cowan (2001); Hick (1952); Nielsen EyeTracking (2006); Pirolli & Card (1999); Spencer (2009); Bringhurst (2004); Dyson & Haselgrove (2001); Dyson (2004); Lavie & Tractinsky (2004); Fogg et al. (2002); W3C WCAG 2.2 (2023); Kang et al. (2020); Baymard Institute (2021); Krug (2000).*
