---
id: lol-to-llm-humor
title: "From LOL to LLM: Measuring Multilingual Multi-Turn Humor Understanding in AI"
authors:
  - Atrey Desai
  - Leo Du
  - James van Doorn
  - Kamala Sreepada
year: 2025
venue: null
arxiv: null
pdf: /papers/cmsc723_final.pdf
code: null
demo: null
twitter: null
blog: null
tags:
  - NLP
  - Multilingual
tldr: "We introduce a multilingual benchmark to evaluate how Large Language Models (LLMs) understand multi-turn humor in English and Spanish through joke classification and line-purpose identification tasks. We find that while larger open-source models (32B) significantly outperform smaller ones, all models struggle with nuanced humor comprehension and are highly sensitive to adversarial perturbations and cross-cultural linguistic differences."
awards: []
preprint: false
featured: false
highlight: false
priority: 99
classProject: true
image: /images/papers/lol-to-llm.png
imageAnimated: null
imageDescription: "Transcripts of stand-up comedy shows, each newline-separated line of a multi-line joke labelled by its role: establishing context, timing, punchline. The models tended to guess “escalation” or “establishing context” for many of the labels, including for many punchlines; “Punchline” was the label that was incorrectly guessed the most, with OLMo3.1-32B answering incorrectly 97% of the time. For the overall joke classification task, the 32 billion parameter models drastically outperformed the smaller 6-10 billion parameter models: on the English set at Pass@5, Qwen3-32B reached 30.8% and OLMo3.1-32B 26.6%, while Falcon3-10B can only reach 8% and the other models fall below 5%."
---

