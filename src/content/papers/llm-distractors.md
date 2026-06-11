---
id: llm-distractors
title: "Quick, Create a Distractor! Evaluating LLM Distractors for Multiple-Choice Benchmarks"
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
tldr: "Researchers use LLMs to create wrong answers (i.e., distractors) for multiple-choice question answering (MCQA) datasets, but whether LLM distractors can replace human-guided ones is unclear. We test this in three strong LLMs and three MCQA benchmarks under two tasks: distractor generation from question-answer pairs and distractor extension from MCQs. We score MCQs via metrics in education research, showing: 1) LLM distractors have trade-offs in how well they challenge test-taker models, discern model ranks, and adhere to writing quality; 2) LLM distractors rarely match the original MCQA benchmark items, so benefits are unlikely from contamination alone; and 3) LLMs struggle to balance plausibility, option length, and simulated mistakes, which humans can help monitor. From these analyses, we outline steps for rigorously using LLMs to scale MCQA benchmarks."
awards: []
preprint: false
featured: true
highlight: false
priority: 1
image: /images/papers/llm-distractors-poster.png
imageAnimated: /images/papers/llm-distractors.mp4
imageDescription: "Animated explainer: a benchmark question needs wrong answers (distractors). People write them carefully; LLMs write them instantly. Grading both with metrics from education research, LLM distractors often make harder questions, but human-guided ones better separate models and follow MCQ writing guidelines."
---
