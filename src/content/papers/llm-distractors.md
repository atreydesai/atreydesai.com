---
id: llm-distractors
title: "Harder Benchmarks Are Not Always Better: Evaluating LLM Distractors for Multiple-Choice Benchmarks"
authors:
  - Atrey Desai
  - Nishant Balepur
  - Rachel Rudinger
year: 2026
venue: Under ACL ARR Review
arxiv: null
pdf: /papers/mcqa_generation.pdf
code: null
demo: null
twitter: null
blog: null
tags:
  - NLP
  - Evaluation
tldr: "LLM-generated distractors often make multiple-choice benchmarks harder, but difficulty alone does not make them better evaluations. Across three LLMs and three benchmarks, generated distractors rarely improve discrimination between models and can sacrifice writing quality. Adding distractors can lower accuracy without better separating model ranks. We outline best practices for monitoring plausibility, option length, and simulated mistakes when using LLMs to construct benchmarks."
awards: []
preprint: true
featured: true
highlight: false
priority: 1
imageDescription: "Multiple-choice questions such as \"What best describes skin? A) flexible B) stiff C) brittle D) hard\" need plausible but wrong distractor choices; distractor creation used to rely on humans, but now work uses LLMs to replace this. We score MCQs via metrics in education research: difficulty for test-taker models, discriminability of model ranks, and writing quality. In nine generator-benchmark combinations, LLM distractors often exceed human-guided items in difficulty, but can jointly sacrifice writing quality and discriminability. We validate LLMs as a promising tool for distractor generation, but find areas benchmark creators must supervise."
---
