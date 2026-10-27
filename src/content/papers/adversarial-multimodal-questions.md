---
id: adversarial-multimodal-questions
title: "Asking About Occluded Content Marks Adversarial Multimodal Questions"
authors:
  - HyoJung Han*
  - Atrey Desai*
  - Ishan Upadhyay
  - Tianyi Zheng
  - Eve Fleisig
  - Aparna Garimella
  - Marine Carpuat
  - Jordan Boyd-Graber
year: 2026
venue: Under ACL ARR Review
arxiv: null
pdf: /papers/adversarial-multimodal-questions.pdf
code: null
demo: null
twitter: null
blog: null
tags:
  - NLP
  - Multimodal
  - Evaluation
tldr: "We study how expert authors create adversarial multimodal quizbowl questions, using logged image revisions and model probes alongside competition results from skilled humans and 14 AI systems. Of 14 question characteristics, only asking about content hidden in an image reliably predicts questions being harder for machines than for skilled humans. Image edits turn 35% of correct model answers wrong, even when needed clues remain. Adversarialness depends less on what images show than on what questions ask respondents to do. * Equal contribution."
awards: []
preprint: true
featured: true
highlight: false
priority: 3
image: /papers/adversarial-multimodal-questions-figure1.png
imageDescription: "A multimodal quizbowl clue shows a Barnett Newman painting with its right side masked and asks for \"this color, which has been obscured\" (answer: yellow). While the question is written, the author probes Qwen3-VL, which answers red, the color it can see, with 85% confidence. In tournament play, humans answer correctly in 3 of 5 games, while 0 of 14 AI systems do, and 10 of the 14 answer red. When authors edit an image and probe again, 35% of the model's 227 correct answers turn wrong, even when the needed clues remain. Not what an image shows... but what the question asks!"
---
