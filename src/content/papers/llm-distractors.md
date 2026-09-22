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
preprint: true
featured: true
highlight: false
priority: 1
image: /images/papers/llm-distractors-poster.png
imageAnimated: /images/papers/llm-distractors.mp4
imageDescription: "Multiple-choice questions such as \"What best describes skin? A) flexible B) stiff C) brittle D) hard\" need plausible but wrong distractor choices; distractor creation used to rely on humans, but now work uses LLMs to replace this. We score MCQs via metrics in education research: difficulty for test-taker models, discriminability of model ranks, and writing quality. In nine generator-benchmark combinations, LLM distractors often exceed human-guided items in difficulty, but can jointly sacrifice writing quality and discriminability. We validate LLMs as a promising tool for distractor generation, but find areas benchmark creators must supervise."
---
