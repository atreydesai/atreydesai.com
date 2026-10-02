// Live explainers for research papers, keyed by paper id. PaperMedia renders
// the paper's explainer as its card media and lightbox; a paper without an
// entry shows no media.
import type { Component } from "svelte";
import ArtifactsExplainer from "./ArtifactsExplainer.svelte";
import BenchMarkerExplainer from "./BenchMarkerExplainer.svelte";
import BookTubeExplainer from "./BookTubeExplainer.svelte";
import CalExplainer from "./CalExplainer.svelte";
import DistractorsExplainer from "./DistractorsExplainer.svelte";
import FillerGapExplainer from "./FillerGapExplainer.svelte";
import HumorExplainer from "./HumorExplainer.svelte";
import ReasonersExplainer from "./ReasonersExplainer.svelte";
import RlTapExplainer from "./RlTapExplainer.svelte";
import type { ExplainerProps } from "./motion";

export type { ExplainerProps };
export type ExplainerComponent = Component<ExplainerProps>;

export const explainers: Partial<Record<string, ExplainerComponent>> = {
	"llm-distractors": DistractorsExplainer,
	"test-time-reasoners": ReasonersExplainer,
	"filler-gap": FillerGapExplainer,
	benchmarker: BenchMarkerExplainer,
	"computational-animal-linguistics": CalExplainer,
	"mcq-artifacts": ArtifactsExplainer,
	"rl-trigger-action": RlTapExplainer,
	"booktube-phonetic": BookTubeExplainer,
	"lol-to-llm-humor": HumorExplainer,
};
