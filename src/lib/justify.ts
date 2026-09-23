// Site-wide paragraph justification with Justice (@kitlangton/justice).
//
// Justice is a numerical Knuth–Plass engine: it takes measured word widths and
// returns line breaks plus per-line word spacing, tracking, and optical-margin
// allowances. This module is the DOM adapter around it:
//
//   1. find running-prose blocks (`p`, `li`) whose content is plain inline
//      markup (links, emphasis, code, footnote markers…),
//   2. measure their words on a canvas in each word's own computed font,
//   3. solve the whole paragraph at its current width,
//   4. render each line as its own nowrap block, cloning the inline elements
//      a line passes through, then correct each line's spacing against its
//      real rendered width so both edges land flush to the sub-pixel.
//
// The original children are never rewritten. They're moved, intact, into a
// `hidden` span inside the same block, so Svelte keeps its references: text
// updates, {@html} swaps, and {#if} blocks keep landing in that source, and a
// MutationObserver re-renders the visible copy from it. The visible copy is the
// accessible one (real links, focusable, readable); ids move onto it so hash
// links still land, and hover/focus events are forwarded back to the source so
// component listeners (the about page's footnote markers) keep working.
//
// Words are hyphenated with Liang's TeX patterns for US English (loaded as a
// separate chunk); Justice weighs each discretionary break against spacing,
// so a hyphen only appears where it rescues a line. A block (or ancestor) set
// to `hyphens: none` is never hyphenated, not even at a hyphen in the text.
//
// Opt a block (or a whole subtree) out with `data-justify="off"`.

import { prepare, solve, withHyphenation, type Line, type Prepared } from "@kitlangton/justice";

const CANDIDATES = "p, li";
const EXCLUDED =
	'[data-justify="off"], nav, button, label, pre, table, svg, [aria-live], [contenteditable], .sr-only, .j-render, .j-src';
// Inline content that can't be broken into measured words.
const BLOCKED_TAGS = new Set([
	"AUDIO", "BUTTON", "CANVAS", "EMBED", "IFRAME", "IMG", "INPUT", "MATH",
	"OBJECT", "PICTURE", "RUBY", "SELECT", "TEXTAREA", "VIDEO",
]);
const FORWARDED_EVENTS = ["mouseenter", "mouseleave", "focus", "blur"] as const;
// Below this a column is too narrow to justify well even with hyphenation.
const MIN_WIDTH = 200;
const MIN_WORDS = 8;
const WS = /[ \t\n\r\f]/;
const WS_ALL = /[ \t\n\r\f]/g;
const WS_SPLIT = /([ \t\n\r\f]+)/;

interface Segment {
	text: string;
	/** Source inline elements from outermost to innermost. */
	chain: Element[];
}

interface Word {
	segments: Segment[];
	length: number;
}

interface Paragraph {
	words: Word[];
	/** gaps[i] is the element chain the space between word i and i+1 sits in. */
	gaps: Element[][];
	prepared: Prepared;
}

interface Model {
	/** One entry per <br>-delimited segment, solved separately. */
	paragraphs: Paragraph[];
	wordCount: number;
	letterSpacing: number;
	wordSpacing: number;
	textIndent: number;
	space: number;
}

interface Block {
	host: HTMLElement;
	render: HTMLSpanElement | null;
	source: HTMLSpanElement | null;
	model: Model | null;
	dirty: boolean;
	width: number;
	/** Width of an inside list marker (`list-inside`) sharing the first line. */
	marker: number;
	/** Source element → its clones in the current render. */
	clones: Map<Element, Element[]>;
	/** Ids lifted off source elements onto their first clone. */
	ids: Map<Element, string>;
}

interface RenderedLine {
	el: HTMLSpanElement;
	/** Content width the line must reach; null for a ragged final line. */
	target: number | null;
	gaps: number;
	characters: number;
	wordSpacing: number;
	letterSpacing: number;
	space: number;
}

const blocks = new Map<HTMLElement, Block>();
const sourceHosts = new WeakMap<Element, HTMLElement>();
const queued = new Set<HTMLElement>();
let frame = 0;
let scanPending = false;
let ctx: CanvasRenderingContext2D | null = null;
let ctxFont = "";
let resizeObserver: ResizeObserver;
let bodyObserver: MutationObserver;
let sourceObserver: MutationObserver;
let hyphenateSync: ((text: string, options?: { hyphenChar?: string }) => string) | null = null;
const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

export function startJustify(): () => void {
	if (typeof Intl === "undefined" || !("Segmenter" in Intl)) return () => {};
	ctx = document.createElement("canvas").getContext("2d");
	if (!ctx) return () => {};
	ctx.fontKerning = "normal";

	resizeObserver = new ResizeObserver((entries) => {
		for (const entry of entries) {
			const host = entry.target as HTMLElement;
			const block = blocks.get(host);
			const width = entry.contentBoxSize?.[0]?.inlineSize ?? entry.contentRect.width;
			if (block && Math.abs(width - block.width) > 0.5) enqueue(host);
		}
	});

	// New content anywhere (route changes, {#if} blocks, late data) may bring
	// new candidates. Mutations inside a source are the source observer's job.
	bodyObserver = new MutationObserver((records) => {
		for (const record of records) {
			if (record.addedNodes.length && !insideJustified(record.target)) {
				scheduleScan();
				return;
			}
		}
	});
	bodyObserver.observe(document.body, { childList: true, subtree: true });

	sourceObserver = new MutationObserver(onSourceMutation);

	document.addEventListener("copy", onCopy);
	document.addEventListener("mousedown", onMultiClick);
	document.fonts?.ready.then(invalidateAll);
	document.fonts?.addEventListener?.("loadingdone", invalidateAll);

	// Hold the first pass for the dictionary so paragraphs don't reflow twice.
	let stopped = false;
	import("hyphen/en-us")
		.then((module) => (hyphenateSync = module.hyphenateSync))
		.catch(() => {})
		.finally(() => !stopped && scheduleScan());

	return () => {
		stopped = true;
		cancelAnimationFrame(frame);
		resizeObserver.disconnect();
		bodyObserver.disconnect();
		sourceObserver.disconnect();
		document.removeEventListener("copy", onCopy);
		document.removeEventListener("mousedown", onMultiClick);
		document.fonts?.removeEventListener?.("loadingdone", invalidateAll);
		for (const block of blocks.values()) revert(block);
		blocks.clear();
		queued.clear();
	};
}

function insideJustified(node: Node): boolean {
	const el = node instanceof Element ? node : node.parentElement;
	return !!el?.closest(".j-render, .j-src");
}

function invalidateAll() {
	for (const block of blocks.values()) {
		block.dirty = true;
		enqueue(block.host);
	}
}

function scheduleScan() {
	scanPending = true;
	schedule();
}

function enqueue(host: HTMLElement) {
	queued.add(host);
	schedule();
}

function schedule() {
	if (!frame) frame = requestAnimationFrame(flush);
}

function scan() {
	for (const [host, block] of blocks) {
		if (!host.isConnected) {
			resizeObserver.unobserve(host);
			blocks.delete(host);
			queued.delete(host);
			if (block.source) sourceHosts.delete(block.source);
		}
	}
	for (const host of document.body.querySelectorAll<HTMLElement>(CANDIDATES)) {
		if (blocks.has(host) || host.closest(EXCLUDED)) continue;
		blocks.set(host, {
			host,
			render: null,
			source: null,
			model: null,
			dirty: true,
			width: -1,
			marker: 0,
			clones: new Map(),
			ids: new Map(),
		});
		resizeObserver.observe(host);
		queued.add(host);
	}
}

// Reads, then writes, then reads, then writes — so a page full of paragraphs
// costs two layouts, not one per paragraph.
function flush() {
	frame = 0;
	if (scanPending) {
		scanPending = false;
		scan();
	}

	const plans: { block: Block; width: number; layouts: Line[][] | null }[] = [];
	for (const host of queued) {
		const block = blocks.get(host);
		if (block) plans.push({ block, width: -1, layouts: null });
	}
	queued.clear();

	for (const plan of plans) {
		const { block } = plan;
		const width = availableWidth(block.host);
		plan.width = width;
		if (width < MIN_WIDTH) continue;
		if (block.dirty || !block.model) {
			block.model = buildModel(block);
			block.dirty = false;
		}
		const model = block.model;
		if (!model || model.wordCount < MIN_WORDS) continue;
		block.marker = markerWidth(block);
		const inset = block.marker || model.textIndent;
		const layouts = model.paragraphs.map((paragraph, index) =>
			solve(paragraph.prepared, index === 0 && inset ? [width - inset, width] : width).lines,
		);
		// A block that fits on one line has nothing to justify — unless it only
		// fits because its final punctuation hangs, which native layout would
		// wrap instead.
		const single = layouts.length === 1 && layouts[0].length === 1 ? layouts[0][0] : null;
		if (!single || single.natural > single.width + 0.01) plan.layouts = layouts;
	}

	const rendered: RenderedLine[] = [];
	for (const { block, width, layouts } of plans) {
		block.width = width;
		if (layouts && block.model) rendered.push(...render(block, block.model, layouts));
		else revert(block);
	}

	// Canvas widths can't see every OpenType feature (old-style figures) or
	// cross-element kerning, so measure what actually rendered and put the
	// remaining sub-pixel difference into the line's spacing.
	const measured = rendered.map((line) =>
		line.target === null ? 0 : line.el.getBoundingClientRect().width,
	);
	rendered.forEach((line, index) => {
		if (line.target === null) return;
		const delta = line.target - measured[index];
		if (Math.abs(delta) < 0.05) return;
		if (line.gaps > 0 && Math.abs(delta / line.gaps) < line.space * 0.5) {
			line.el.style.wordSpacing = `${line.wordSpacing + delta / line.gaps}px`;
		} else if (line.characters > 0 && Math.abs(delta / line.characters) < 0.5) {
			line.el.style.letterSpacing = `${line.letterSpacing + delta / line.characters}px`;
		}
	});

	// Drop the records our own writes produced.
	bodyObserver.takeRecords();
	sourceObserver.takeRecords();
}

function availableWidth(host: HTMLElement): number {
	if (!host.isConnected || host.closest(EXCLUDED)) return -1;
	const cs = getComputedStyle(host);
	if (
		(cs.display !== "block" && cs.display !== "list-item") ||
		cs.direction !== "ltr" ||
		cs.writingMode !== "horizontal-tb" ||
		!["start", "left", "justify"].includes(cs.textAlign) ||
		cs.whiteSpace !== "normal" ||
		isMono(cs.fontFamily)
	) {
		return -1;
	}
	return host.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
}

// An inside marker ("• ", "1. ") is an inline box at the start of the first
// line, so that line is rendered inline beside it and fitted that much
// narrower. Measured where the text actually starts, so it includes the
// marker's own spacing and any text-indent.
function markerWidth(block: Block): number {
	const { host } = block;
	const cs = getComputedStyle(host);
	if (
		cs.display !== "list-item" ||
		cs.listStylePosition !== "inside" ||
		cs.listStyleType === "none"
	) {
		return 0;
	}
	const contentLeft = host.getBoundingClientRect().left + host.clientLeft + px(cs.paddingLeft);
	// Once rendered, an empty probe at the head of the render marks where text
	// starts even if the first line itself has wrapped below the marker.
	const probe = block.render?.querySelector(":scope > .j-probe");
	if (probe) return Math.max(0, probe.getBoundingClientRect().left - contentLeft);

	const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
	for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
		const index = node.data.search(/[^ \t\n\r\f]/);
		if (index < 0) continue;
		const range = document.createRange();
		range.setStart(node, index);
		range.setEnd(node, index + 1);
		return Math.max(0, range.getBoundingClientRect().left - contentLeft);
	}
	return 0;
}

function isMono(family: string): boolean {
	return /mono|menlo|monaco|consolas|courier/i.test(family);
}

// ---------------------------------------------------------------- model

function buildModel(block: Block): Model | null {
	const root = block.source ?? block.host;
	const segments = collectWords(root);
	if (!segments) return null;

	const hostStyle = getComputedStyle(block.host);
	const base = fontSpec(block.host, hostStyle);
	const space = measure(" ", base);
	const paragraphs: Paragraph[] = [];
	let wordCount = 0;

	for (const words of segments) {
		if (!words.length) continue;
		// Engine text: spaces that must not break (inside nowrap code, NBSP)
		// become NBSP, one-for-one so UTF-16 offsets still match the source.
		// With hyphens off, a hyphen in the text ("Boyd-Graber") is not a break
		// point either; U+2011 keeps the length, so offsets still line up.
		const unhyphenated = noHyphens(hostStyle);
		const text = words
			.map((word) =>
				word.segments
					.map((s) => {
						const t = s.text.replace(WS_ALL, "\u00a0");
						return unhyphenated ? t.replace(/-/g, "\u2011") : t;
					})
					.join(""),
			)
			.join(" ");
		let prepared = prepare(text, (fragment) => measure(fragment, base));
		const hyphenate = hyphenateSync && !unhyphenated;
		if (prepared.words.length !== words.length) return null;

		// Replace the base-font word widths with ones measured per segment in
		// each segment's own font (italics, code, small caps).
		let sum = 0;
		words.forEach((word, i) => {
			for (const segment of word.segments) {
				sum += measure(
					segment.text.replace(/[ \t\n\r\f]+/g, " "),
					fontSpec(segment.chain.at(-1) ?? block.host),
				);
			}
			prepared.widths[i + 1] = sum;
		});
		if (hyphenate) {
			prepared = withHyphenation(prepared, hyphenateWord, (fragment, i) =>
				measure(fragment, wordFont(words[i], base)),
			);
		}

		const gaps: Element[][] = [];
		for (let i = 0; i < words.length - 1; i++) {
			gaps.push(commonChain(words[i].segments.at(-1)!.chain, words[i + 1].segments[0].chain));
		}
		paragraphs.push({ words, gaps, prepared });
		wordCount += words.length;
	}

	if (!paragraphs.length) return null;
	return {
		paragraphs,
		wordCount,
		letterSpacing: px(hostStyle.letterSpacing),
		wordSpacing: px(hostStyle.wordSpacing),
		textIndent: px(hostStyle.textIndent),
		space,
	};
}

/** Words grouped by <br>; null when the block holds anything but inline text. */
function collectWords(root: Element): Word[][] | null {
	const out: Word[][] = [[]];
	let word: Word | null = null;
	const endWord = () => {
		if (word) out[out.length - 1].push(word);
		word = null;
	};
	const push = (text: string, chain: Element[]) => {
		word ??= { segments: [], length: 0 };
		word.segments.push({ text, chain });
		word.length += text.length;
	};

	const walk = (node: Node, chain: Element[], nowrap: boolean): boolean => {
		for (const child of node.childNodes) {
			if (child.nodeType === Node.TEXT_NODE) {
				const text = (child as Text).data;
				if (nowrap) {
					if (text) push(text, chain);
					continue;
				}
				for (const part of text.split(WS_SPLIT)) {
					if (!part) continue;
					if (WS.test(part[0])) endWord();
					else push(part, chain);
				}
			} else if (child instanceof HTMLElement) {
				if (child.tagName === "BR") {
					endWord();
					out.push([]);
					continue;
				}
				if (child.tagName === "WBR") continue;
				if (BLOCKED_TAGS.has(child.tagName)) return false;
				const cs = getComputedStyle(child);
				if (cs.display === "none") continue;
				if (
					cs.display !== "inline" ||
					cs.position === "absolute" ||
					cs.position === "fixed" ||
					cs.float !== "none" ||
					!["normal", "nowrap"].includes(cs.whiteSpace)
				) {
					return false;
				}
				if (!walk(child, [...chain, child], nowrap || cs.whiteSpace === "nowrap")) return false;
			} else if (child.nodeType === Node.ELEMENT_NODE) {
				return false; // SVG, MathML
			}
		}
		return true;
	};

	if (!walk(root, [], false)) return null;
	endWord();
	return out;
}

/** CSS `hyphens: none` on the block (it inherits) turns hyphenation off. */
function noHyphens(cs: CSSStyleDeclaration): boolean {
	const value = cs.hyphens || (cs as unknown as { webkitHyphens?: string }).webkitHyphens;
	return value === "none";
}

/** A word's font when all of it shares one; fragments are measured in it. */
function wordFont(word: Word, base: FontSpec): FontSpec {
	const el = word.segments[0].chain.at(-1);
	return el && word.segments.every((s) => s.chain.at(-1) === el) ? fontSpec(el) : base;
}

const LETTER = /\p{L}/gu;

function hyphenateWord(word: string): string[] {
	// Leave names, acronyms, numbers, and URLs whole.
	if (word.length < 6 || /^\P{L}*\p{Lu}|[\d@/:\u00ad]/u.test(word)) return [word];
	const letters = (text: string) => text.match(LETTER)?.length ?? 0;
	const parts = hyphenateSync!(word, { hyphenChar: "\u00ad" }).split("\u00ad");
	if (parts.join("") !== word) return [word];
	// TeX's English minimums: two letters before a break, three after.
	const out = [parts[0]];
	let offset = parts[0].length;
	for (const part of parts.slice(1)) {
		if (letters(word.slice(0, offset)) >= 2 && letters(word.slice(offset)) >= 3) out.push(part);
		else out[out.length - 1] += part;
		offset += part.length;
	}
	return out;
}

function commonChain(a: Element[], b: Element[]): Element[] {
	let k = 0;
	while (k < a.length && k < b.length && a[k] === b[k]) k++;
	return a.slice(0, k);
}

interface FontSpec {
	font: string;
	letterSpacing: string;
	transform: string;
	caps: string;
}

const specs = new WeakMap<Element, FontSpec>();

function fontSpec(el: Element, cs: CSSStyleDeclaration = getComputedStyle(el)): FontSpec {
	const cached = specs.get(el);
	if (cached) return cached;
	const spec = {
		font: `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`,
		letterSpacing: cs.letterSpacing === "normal" ? "0px" : cs.letterSpacing,
		transform: cs.textTransform,
		caps: cs.fontVariantCaps,
	};
	// Computed styles only change with classes/fonts; the cache is per flush.
	specs.set(el, spec);
	queueMicrotask(() => specs.delete(el));
	return spec;
}

function measure(text: string, spec: FontSpec): number {
	const c = ctx!;
	// The canvas normalises `font` on read, so track what was last assigned.
	if (ctxFont !== spec.font) c.font = ctxFont = spec.font;
	if ("letterSpacing" in c) c.letterSpacing = spec.letterSpacing;
	if ("fontVariantCaps" in c) {
		(c as any).fontVariantCaps = spec.caps === "small-caps" ? "small-caps" : "normal";
	}
	if (spec.transform === "uppercase") text = text.toUpperCase();
	else if (spec.transform === "lowercase") text = text.toLowerCase();
	return c.measureText(text).width;
}

function px(value: string): number {
	const n = parseFloat(value);
	return Number.isFinite(n) ? n : 0;
}

// --------------------------------------------------------------- render

function convert(block: Block) {
	if (block.render) return;
	const { host } = block;
	const render = document.createElement("span");
	render.className = "j-render";
	const source = document.createElement("span");
	source.className = "j-src";
	source.hidden = true;
	source.append(...host.childNodes);
	host.append(render, source);
	host.dataset.justified = "";
	block.render = render;
	block.source = source;
	sourceHosts.set(source, host);
	sourceObserver.observe(source, {
		childList: true,
		characterData: true,
		attributes: true,
		subtree: true,
	});
}

function revert(block: Block) {
	const { host, render, source } = block;
	if (!render || !source) return;
	for (const [el, id] of block.ids) el.id = id;
	block.ids.clear();
	block.clones.clear();
	render.remove();
	host.replaceChildren(...source.childNodes);
	delete host.dataset.justified;
	sourceHosts.delete(source);
	block.render = null;
	block.source = null;
	block.dirty = true;
}

function render(block: Block, model: Model, layouts: Line[][]): RenderedLine[] {
	convert(block);
	const lines: RenderedLine[] = [];
	const fragment = document.createDocumentFragment();
	block.clones = new Map();

	model.paragraphs.forEach((paragraph, p) => {
		layouts[p].forEach((line, l) => {
			const el = document.createElement("span");
			el.className = "j-line";
			// Beside an inside marker, text-indent is already in the marker's line.
			const indent = p === 0 && l === 0 && !block.marker ? model.textIndent : 0;
			const shift = indent - line.opening;
			if (shift) el.style.marginLeft = `${shift}px`;
			const wordSpacing = model.wordSpacing + line.wordSpacing;
			const letterSpacing = model.letterSpacing + line.tracking;
			el.style.wordSpacing = `${wordSpacing}px`;
			el.style.letterSpacing = `${letterSpacing}px`;
			const characters = fillLine(block, el, paragraph, line);
			fragment.append(el);

			const ragged =
				line.last && line.natural <= line.width + line.hanging + line.opening + 0.01;
			lines.push({
				el,
				target: ragged ? null : line.width + line.hanging + line.opening - line.residual,
				gaps: line.end - line.start - 1,
				characters,
				wordSpacing,
				letterSpacing,
				space: model.space,
			});
		});
	});

	if (block.marker > 0) {
		// A word joiner forbids the break after the marker's trailing space, so
		// the probe (and the first line after it) can't wrap off the marker line.
		const probe = document.createElement("span");
		probe.className = "j-probe";
		probe.ariaHidden = "true";
		probe.textContent = "\u2060";
		fragment.prepend(probe);
		// Let hanging punctuation (and sub-pixel rounding) overhang without
		// pushing the first line off the marker's line.
		const first = lines[0].el;
		first.style.marginRight = `${-(layouts[0][0].hanging + 2)}px`;
	}
	block.render!.classList.toggle("j-inline", block.marker > 0);
	block.render!.replaceChildren(fragment);
	return lines;
}

/** Appends a line's words, reopening clones of the inline elements it crosses. */
function fillLine(block: Block, lineEl: HTMLElement, paragraph: Paragraph, line: Line): number {
	const stack: [Element, Element][] = [];
	let characters = 0;
	const open = (chain: Element[]): Element => {
		let k = 0;
		while (k < stack.length && k < chain.length && stack[k][0] === chain[k]) k++;
		stack.length = k;
		for (let i = k; i < chain.length; i++) {
			const clone = cloneElement(block, chain[i]);
			(stack.at(-1)?.[1] ?? lineEl).append(clone);
			stack.push([chain[i], clone]);
		}
		return stack.at(-1)?.[1] ?? lineEl;
	};
	const text = (parent: Element, value: string) => {
		parent.append(value);
		for (const _ of graphemes.segment(value)) characters++;
	};

	for (let w = line.start; w < line.end; w++) {
		if (w > line.start) text(open(paragraph.gaps[w - 1]), " ");
		const word = paragraph.words[w];
		const from = w === line.start ? (line.startOffset ?? 0) : 0;
		const to = w === line.end - 1 ? (line.endOffset ?? word.length) : word.length;
		let offset = 0;
		for (const segment of word.segments) {
			const start = Math.max(from - offset, 0);
			const end = Math.min(to - offset, segment.text.length);
			if (end > start) text(open(segment.chain), segment.text.slice(start, end));
			offset += segment.text.length;
		}
	}
	if (line.hyphenated) {
		// Generated, not source text: kept out of narration and copied text.
		const hyphen = document.createElement("span");
		hyphen.className = "j-hyphen";
		hyphen.ariaHidden = "true";
		(stack.at(-1)?.[1] ?? lineEl).append(hyphen);
		text(hyphen, "-");
	}
	return characters;
}

function cloneElement(block: Block, source: Element): Element {
	const clone = source.cloneNode(false) as Element;
	clone.removeAttribute("id");
	// The first clone of an element takes its id, so `#fn-3`-style links land
	// on something visible.
	if (source.id) {
		block.ids.set(source, source.id);
		source.removeAttribute("id");
	}
	const list = block.clones.get(source);
	if (list) list.push(clone);
	else {
		block.clones.set(source, [clone]);
		const id = block.ids.get(source);
		if (id) clone.id = id;
	}
	for (const type of FORWARDED_EVENTS) {
		clone.addEventListener(type, (event) => {
			const Ctor = event instanceof FocusEvent ? FocusEvent : MouseEvent;
			source.dispatchEvent(new Ctor(type, event as any));
		});
	}
	return clone;
}

function onSourceMutation(records: MutationRecord[]) {
	for (const record of records) {
		const target = record.target;
		const source = (target instanceof Element ? target : target.parentElement)?.closest(".j-src");
		const host = source && sourceHosts.get(source);
		const block = host && blocks.get(host);
		if (!block) continue;

		if (record.type === "attributes" && target instanceof Element && target !== source) {
			syncAttribute(block, target, record.attributeName!);
		} else {
			block.dirty = true;
			enqueue(block.host);
		}
	}
}

// Attribute changes (a hover class, an updated href) don't move any text, so
// they're copied onto the clones rather than re-rendering the block.
function syncAttribute(block: Block, source: Element, name: string) {
	const clones = block.clones.get(source) ?? [];
	if (name === "id") {
		if (source.id) {
			block.ids.set(source, source.id);
			source.removeAttribute("id");
			if (clones[0]) clones[0].id = block.ids.get(source)!;
		}
		sourceObserver.takeRecords();
		return;
	}
	const value = source.getAttribute(name);
	for (const clone of clones) {
		if (value === null) clone.removeAttribute(name);
		else clone.setAttribute(name, value);
	}
}

// ------------------------------------------------------------ selection

// Each rendered line is its own block, so the browser's paragraph selection
// (triple-click) would stop at the line's edges. Select the whole rendered
// paragraph instead, as it would for an unjustified one.
function onMultiClick(event: MouseEvent) {
	if (event.detail < 3 || event.button !== 0) return;
	const target = event.target instanceof Element ? event.target : null;
	const render = target?.closest(".j-render");
	const selection = document.getSelection();
	if (!render || !selection) return;
	event.preventDefault();
	const range = document.createRange();
	range.selectNodeContents(render);
	selection.removeAllRanges();
	selection.addRange(range);
}

// ----------------------------------------------------------------- copy

// Rendered lines are separate blocks, and each block keeps a hidden copy of
// its source, so the browser's own copy would add a newline at every line and
// could pick up the hidden text. Rebuild the selection without either.
function onCopy(event: ClipboardEvent) {
	const selection = document.getSelection();
	if (!selection || selection.isCollapsed || !event.clipboardData) return;
	let touches = false;
	for (const block of blocks.values()) {
		if (block.render && selection.containsNode(block.render, true)) {
			touches = true;
			break;
		}
	}
	if (!touches) return;

	const container = document.createElement("div");
	for (let i = 0; i < selection.rangeCount; i++) {
		container.append(selection.getRangeAt(i).cloneContents());
	}
	container.querySelectorAll(".j-src, .j-probe").forEach((el) => el.remove());
	container.querySelectorAll(".j-line").forEach((el) => {
		const next = el.nextElementSibling;
		const hyphenated = el.querySelector(".j-hyphen");
		hyphenated?.remove();
		el.replaceWith(...el.childNodes);
		// A line broken mid-word rejoins without a space.
		if (next?.classList.contains("j-line") && !hyphenated) next.before(" ");
	});
	container.querySelectorAll(".j-render").forEach((el) => el.replaceWith(...el.childNodes));

	event.clipboardData.setData("text/html", container.innerHTML);
	event.clipboardData.setData("text/plain", plainText(container).trim());
	event.preventDefault();
}

const BLOCK_TAGS = /^(P|LI|DIV|H[1-6]|BLOCKQUOTE|UL|OL|SECTION|ARTICLE|HEADER|FOOTER|FIGURE|FIGCAPTION|TR|PRE|DT|DD)$/;

function plainText(node: Node): string {
	let out = "";
	for (const child of node.childNodes) {
		if (child.nodeType === Node.TEXT_NODE) {
			out += (child as Text).data.replace(/[ \t\n\r\f]+/g, " ");
		} else if (child instanceof Element) {
			if (child.tagName === "BR") out += "\n";
			else if (BLOCK_TAGS.test(child.tagName)) out += `\n${plainText(child).trim()}\n`;
			else out += plainText(child);
		}
	}
	return out.replace(/\n{3,}/g, "\n\n");
}
