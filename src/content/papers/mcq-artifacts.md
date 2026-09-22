---
id: mcq-artifacts
title: "Language Models Generate Multiple-Choice Questions with Artifacts"
authors:
  - Atrey Desai
  - Nishant Balepur
  - Rachel Rudinger
year: 2025
venue: MASC-SLL
arxiv: null
pdf: https://scholar.google.com/citations?view_op=view_citation&hl=en&user=hTDzj6cAAAAJ&citation_for_view=hTDzj6cAAAAJ:d1gkVwhDpl0C
code: null
demo: null
twitter: null
blog: null
tags:
  - NLP
  - Evaluation
tldr: null
awards: []
preprint: false
featured: false
highlight: false
priority: 99
image: /images/papers/mcq-artifacts.png
imageAnimated: null
imageDescription: "An LLM-generated MCQ asks for the predicate logic translation of 'For all x, if P of x then Q of x': (A) ∃x (P(x) ∧ Q(x)), (B) ∀x (P(x) ∧ Q(x)), (C) ∀x (P(x) → Q(x)), (D) ∃x (P(x) → Q(x)); A: (C). With the Choices-Only Prompt the question is struck out, and the answer is still (C) ∀x (P(x) → Q(x)). GPT-4o-mini accuracy, read from the poster's bar charts: 80% with the Full Prompt vs 38% Choices Only on Human-Written ARC/MMLU questions, but 96% vs 96% on its own generated questions (question-answer-distractors, comprehension); GPT-4o-mini often exceeds 90% accuracy using only the choices. LLMs' questions look good at first... but they're full of shortcuts!"
---

