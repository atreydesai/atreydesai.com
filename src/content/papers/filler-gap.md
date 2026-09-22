---
id: filler-gap
title: "Filling in the Mechanisms: How do LMs Learn Filler-Gap Dependencies under Developmental Constraints?"
authors:
  - Atrey Desai
  - Sathvik Nair
year: 2026
venue: ACL Findings; TLS
arxiv: "https://arxiv.org/abs/2604.14459"
pdf: "https://arxiv.org/pdf/2604.14459"
code: "https://github.com/atreydesai/developmental-filler-gap"
demo: null
twitter: null
blog: null
tags:
  - NLP
  - Linguistics
tldr: null
awards:
  - Oral (TLS)
preprint: false
featured: true
highlight: false
priority: 3
image: /images/papers/filler-gap-poster.png
imageAnimated: /images/papers/filler-gap.mp4
imageDescription: "In \"Who did the teacher like _?\", who is the object of like: the filler is fronted to form a dependency with the gap, which is unpronounced but marked with _. Implanting the learned filler-gap DAS feature from the source into the base sentence \"Did the teacher like him?\" should shift the prediction of the model from the base label (him) toward the source label (?). Across 19 BabyLM checkpoints, filler-gap localization increased with training duration, from near zero at 1M tokens (MAX ODDS ≈ 0.8) to a robust effect by 100M (MAX ODDS ≈ 10.6 for Wh→Wh), while the effects are weaker (MAX ODDS ≈ 3) around 10M tokens, and the 10M checkpoint corresponds to children's linguistic knowledge between the ages of 2 and 5. The model learns a shared representation for filler-gap dependencies, but still requires far more data than children would."
---

