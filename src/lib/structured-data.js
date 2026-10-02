const SITE_URL = "https://atreydesai.com";

// Facts below follow src/content/cv.yaml; keep them in step when the CV changes.
export const PERSON_DESCRIPTION =
  "Atrey Desai is an undergraduate researcher in the CLIP Lab at the University of Maryland, College Park, studying computer science and linguistics, and a visiting researcher in the ACL2 Lab at the University of Texas at Arlington. Research spans natural language processing, LLM evaluation and benchmarks, interpretability, multimodal reasoning, AI safety, and computational animal linguistics.";

/** @param {{ imageUrl: string }} input */
export function personStructuredData({ imageUrl }) {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": `${SITE_URL}/#person`,
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
        url: "https://clip.umd.edu",
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
      "SPIRE Research Grant (2025)",
      "Omicron Delta Kappa Top 10 Freshman (2024)",
      "CMSC & ARHU Dean's List (2023–2026)",
      "UMD President's Scholarship (2023)",
      "NMSC National Merit Scholarship (2023)",
      "Catherine Yang Scholarship (2023)",
    ],
  };
}
