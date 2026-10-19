const SITE_URL = "https://atreydesai.com";
const PERSON_ID = `${SITE_URL}/#person`;
const WEBSITE_ID = `${SITE_URL}/#website`;

// Facts below follow src/content/cv.yaml; keep them in step when the CV changes.
export const PERSON_DESCRIPTION =
  "Atrey Desai is an undergraduate researcher in the CLIP Lab at the University of Maryland, College Park, studying computer science and linguistics, and a visiting researcher in the ACL2 Lab at the University of Texas at Arlington. Research spans natural language processing, LLM evaluation and benchmarks, interpretability, multimodal reasoning, AI safety, and computational animal linguistics.";

export const SITE_DESCRIPTION =
  "Personal site of Atrey Desai: research, publications, CV, writing, photography, and bookshelf.";

/** @param {{ imageUrl: string }} input */
export function personStructuredData({ imageUrl }) {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": PERSON_ID,
    name: "Atrey Desai",
    givenName: "Atrey",
    familyName: "Desai",
    description: PERSON_DESCRIPTION,
    url: `${SITE_URL}/`,
    image: imageUrl,
    sameAs: [
      "https://github.com/atreydesai",
      "https://x.com/atreydesai",
      "https://scholar.google.com/citations?user=hTDzj6cAAAAJ&hl=en",
      "https://instagram.com/framedbyatrey",
    ],
    jobTitle: "Undergraduate Researcher",
    email: "adesai10@umd.edu",
    affiliation: [
      {
        "@type": "CollegeOrUniversity",
        name: "University of Maryland, College Park",
        url: "https://umd.edu",
      },
      {
        "@type": "Organization",
        name: "CLIP Lab",
        url: "https://clip.umiacs.umd.edu",
      },
      {
        "@type": "CollegeOrUniversity",
        name: "The University of Texas at Arlington",
        url: "https://www.uta.edu",
      },
      {
        "@type": "Organization",
        name: "ACL2 Lab",
      },
    ],
    knowsAbout: [
      "Natural Language Processing",
      "Computational Linguistics",
      "Machine Learning",
      "AI Safety",
      "Benchmark Evaluation",
      "Multimodal Reasoning",
      "Interpretability",
      "Reinforcement Learning",
      "Computational Animal Linguistics",
    ],
    knowsLanguage: ["English", "Gujarati", "Spanish", "Korean"],
    award: [
      "CRA NSF CISE Student Funding Program (2026)",
      "ACL D&I Award (2026)",
      "Department of Computer Science Professional Development Fund (2026)",
      "SPIRE Research Grant (2025)",
      "Omicron Delta Kappa Top 10 Freshman (2024)",
      "CMSC & ARHU Dean's List (2023–2026)",
      "UMD President's Scholarship (2023)",
      "NMSC National Merit Scholarship (2023)",
      "Catherine Yang Scholarship (2023)",
    ],
  };
}

/** The site itself, owned by the Person. Emitted on every page. */
export function websiteStructuredData() {
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    url: `${SITE_URL}/`,
    name: "Atrey Desai",
    description: SITE_DESCRIPTION,
    inLanguage: "en-US",
    publisher: { "@id": PERSON_ID },
    author: { "@id": PERSON_ID },
  };
}

/**
 * The page-level node: a WebPage (or subtype) that belongs to the site, plus a
 * BreadcrumbList for every page below the homepage.
 *
 * @param {{
 *   url: string,
 *   name: string,
 *   description: string,
 *   imageUrl: string,
 *   pageType?: string,
 *   breadcrumbs?: Array<{ name: string, url: string }>,
 *   about?: boolean,
 *   mainEntity?: object,
 * }} input
 */
export function pageStructuredData({
  url,
  name,
  description,
  imageUrl,
  pageType = "WebPage",
  breadcrumbs = [],
  about = false,
  mainEntity,
}) {
  /** @type {object[]} */
  const nodes = [];
  /** @type {Record<string, unknown>} */
  const page = {
    "@type": pageType,
    "@id": `${url}#webpage`,
    url,
    name,
    description,
    inLanguage: "en-US",
    isPartOf: { "@id": WEBSITE_ID },
    primaryImageOfPage: { "@type": "ImageObject", url: imageUrl },
  };
  if (about) page.about = { "@id": PERSON_ID };
  // A ProfilePage is about the person it profiles.
  if (mainEntity) page.mainEntity = mainEntity;
  else if (pageType === "ProfilePage") page.mainEntity = { "@id": PERSON_ID };

  if (breadcrumbs.length > 0) {
    page.breadcrumb = { "@id": `${url}#breadcrumb` };
    nodes.push({
      "@type": "BreadcrumbList",
      "@id": `${url}#breadcrumb`,
      itemListElement: breadcrumbs.map((crumb, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: crumb.name,
        item: crumb.url,
      })),
    });
  }

  return [page, ...nodes];
}

/**
 * @param {{
 *   url: string,
 *   title: string,
 *   description: string,
 *   imageUrl: string,
 *   datePublished: string,
 *   dateModified?: string,
 *   tags?: string[],
 * }} input
 */
export function blogPostingStructuredData({
  url,
  title,
  description,
  imageUrl,
  datePublished,
  dateModified,
  tags = [],
}) {
  return {
    "@type": "BlogPosting",
    "@id": `${url}#article`,
    mainEntityOfPage: { "@id": `${url}#webpage` },
    headline: title,
    description,
    image: imageUrl,
    datePublished,
    dateModified: dateModified ?? datePublished,
    keywords: tags.join(", "),
    inLanguage: "en-US",
    author: { "@id": PERSON_ID },
    publisher: { "@id": PERSON_ID },
    isPartOf: { "@id": WEBSITE_ID },
  };
}

/**
 * Papers as ScholarlyArticle nodes. Atrey is linked by @id; co-authors are
 * plain names because the site does not know their profiles.
 *
 * @param {Array<{
 *   id: string,
 *   title: string,
 *   authors: string[],
 *   year: number,
 *   venue: string | null,
 *   arxiv: string | null,
 *   tldr: string | null,
 *   tags: string[],
 *   preprint?: boolean,
 * }>} papers
 */
export function paperListStructuredData(papers) {
  return papers.map((paper) => ({
    "@type": "ScholarlyArticle",
    "@id": `${SITE_URL}/research/#${paper.id}`,
    url: `${SITE_URL}/research/#${paper.id}`,
    headline: paper.title,
    name: paper.title,
    // Work under review has no publication date or publisher yet.
    ...(paper.preprint ? {} : { datePublished: String(paper.year) }),
    author: paper.authors.map((name) =>
      name === "Atrey Desai"
        ? { "@id": PERSON_ID }
        : { "@type": "Person", name },
    ),
    ...(paper.tldr ? { abstract: paper.tldr } : {}),
    ...(paper.venue && !paper.preprint
      ? { publisher: { "@type": "Organization", name: paper.venue } }
      : {}),
    ...(paper.arxiv ? { sameAs: paper.arxiv } : {}),
    keywords: paper.tags.join(", "),
    inLanguage: "en",
  }));
}

/**
 * Wrap nodes in one @graph under a single @context.
 *
 * @param {object[]} nodes
 */
export function graph(nodes) {
  return { "@context": "https://schema.org", "@graph": nodes };
}

/** @param {Record<string, unknown>} node */
export function withoutContext(node) {
  const { "@context": _context, ...rest } = node;
  return rest;
}
