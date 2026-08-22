const SITE_URL = "https://atreydesai.com";

export const PERSON_DESCRIPTION =
  "Atrey Desai is an undergraduate researcher at the University of Maryland studying natural language processing, AI safety, computational linguistics, benchmark evaluation, and multimodal reasoning.";

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
        name: "University of Maryland",
        url: "https://umd.edu",
      },
      {
        "@type": "Organization",
        name: "CLIP Lab",
        url: "https://clip.umd.edu",
      },
      {
        "@type": "Organization",
        name: "Learn Prompting",
        url: "https://learnprompting.org",
      },
    ],
    knowsAbout: [
      "Natural Language Processing",
      "AI Safety",
      "Computational Linguistics",
      "Machine Learning",
      "Benchmark Evaluation",
      "Multimodal Reasoning",
    ],
  };
}
