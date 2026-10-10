// Markdown-aware inline diff for prose drafts.
//
// A port of prose-diff-viewer's Python renderer: added text is wrapped in
// <ins>, removed text in <del> (latexdiff conventions), rendered as formatted
// prose rather than raw markdown. Blocks (paragraphs, headings, scene breaks,
// blockquotes) are matched first; a changed region then gets a word-level
// diff, so a one-word edit shows as exactly that rather than a rewritten
// paragraph. The matcher reproduces Python's difflib.SequenceMatcher with
// autojunk off, so both versions of the tool mark the same words.

const BLOCK_SPLIT = /\n\s*\n/;
const WORD = /\S+/g;
const HEADING = /^(#{1,6})\s+([\s\S]*)$/;
const HR = /^(\*\s*\*\s*\*[\s*]*|-{3,}|_{3,})$/;
const PARA_BREAK = "\n\n";
const SENTINEL = "\0";
const EXCERPT_WORDS = 12;

/** @typedef {"equal" | "replace" | "delete" | "insert"} OpTag */
/** @typedef {[OpTag, number, number, number, number]} Opcode */
/** @typedef {"edited" | "added" | "removed"} ChangeKind */
/** @typedef {{ id: string, excerpt: string, kind: ChangeKind }} Change */
/**
 * @typedef {object} DiffResult
 * @property {string} html
 * @property {Change[]} changes
 * @property {number} wordsAdded
 * @property {number} wordsRemoved
 */
/**
 * @typedef {object} RenderOptions
 * @property {boolean} [showDeletions] Render removed text (default true). Off,
 *   the output reads as the new version with its additions marked.
 * @property {number} [headingShift] Levels to demote markdown headings by, so a
 *   chapter's `#` can sit under a page's own h1 (default 0).
 */

/** @param {string} text */
function words(text) {
    return text.match(WORD) ?? [];
}

/** @param {string} text */
function strip(text) {
    return text.replace(/^\s+|\s+$/g, "");
}

/** Split markdown into blank-line-separated blocks. @param {string} text */
export function splitBlocks(text) {
    return strip(text.replace(/\r\n?/g, "\n"))
        .split(BLOCK_SPLIT)
        .filter((block) => strip(block))
        .map((block) => block.replace(/^\n+|\n+$/g, ""));
}

/** Word tokens, with paragraph breaks kept as their own token. @param {string} text */
function tokens(text) {
    /** @type {string[]} */
    const out = [];
    for (const para of text.split(BLOCK_SPLIT)) {
        const found = words(para);
        if (!found.length) continue;
        if (out.length) out.push(PARA_BREAK);
        out.push(...found);
    }
    return out;
}

/** @param {string} text */
function escapeHtml(text) {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Minimal inline markdown for novel prose: emphasis, strong, code. @param {string} text */
export function renderInline(text) {
    return escapeHtml(text)
        .replace(/\*\*\*([\s\S]+?)\*\*\*/g, "<strong><em>$1</em></strong>")
        .replace(/\*\*([\s\S]+?)\*\*/g, "<strong>$1</strong>")
        .replace(/(?<![\w*])\*([^*\n]+)\*(?![\w*])/g, "<em>$1</em>")
        .replace(/_([^_\n]+)_/g, "<em>$1</em>")
        .replace(/`([^`]+)`/g, "<code>$1</code>");
}

/** @param {string} block */
function isQuote(block) {
    return block.split("\n").every((line) => line.trimStart().startsWith(">"));
}

/** @param {string} block */
function unquote(block) {
    return block
        .split("\n")
        .map((line) => line.trimStart().slice(1).trimStart())
        .join("\n");
}

/** @param {string} block */
function joinLines(block) {
    return block.replace(/\s*\n\s*/g, " ");
}

/**
 * The block's kind and the plain text its words are diffed on.
 * @param {string} block
 * @returns {[string, string]}
 */
function kindAndText(block) {
    const stripped = strip(block);
    const heading = stripped.match(HEADING);
    if (heading) return [`h${heading[1].length}`, heading[2]];
    if (HR.test(stripped)) return ["hr", ""];
    if (isQuote(stripped)) return ["bq", unquote(stripped)];
    return ["p", joinLines(stripped)];
}

/**
 * Render one markdown block. `inner`, when given, is already-rendered inline
 * HTML to place inside the block's wrapper.
 * @param {string} block
 * @param {string | null} inner
 * @param {number} headingShift
 */
function renderBlock(block, inner, headingShift) {
    const stripped = strip(block);
    const heading = stripped.match(HEADING);
    if (heading) {
        const level = Math.min(6, heading[1].length + headingShift);
        return `<h${level}>${inner ?? renderInline(heading[2])}</h${level}>`;
    }
    if (HR.test(stripped)) return "<hr>";
    if (isQuote(stripped)) {
        return `<blockquote><p>${inner ?? renderInline(unquote(stripped))}</p></blockquote>`;
    }
    return `<p>${inner ?? renderInline(joinLines(stripped))}</p>`;
}

/**
 * Python's difflib.SequenceMatcher with no junk and autojunk off: the longest
 * matching run is found, then the regions either side of it, recursively.
 * @param {string[]} a
 * @param {string[]} b
 * @returns {Opcode[]}
 */
export function opcodes(a, b) {
    /** @type {Map<string, number[]>} */
    const b2j = new Map();
    b.forEach((item, j) => {
        const indices = b2j.get(item);
        if (indices) indices.push(j);
        else b2j.set(item, [j]);
    });

    /**
     * @param {number} alo
     * @param {number} ahi
     * @param {number} blo
     * @param {number} bhi
     * @returns {[number, number, number]}
     */
    function longestMatch(alo, ahi, blo, bhi) {
        let besti = alo;
        let bestj = blo;
        let bestsize = 0;
        /** @type {Map<number, number>} */
        let j2len = new Map();
        for (let i = alo; i < ahi; i++) {
            /** @type {Map<number, number>} */
            const next = new Map();
            for (const j of b2j.get(a[i]) ?? []) {
                if (j < blo) continue;
                if (j >= bhi) break;
                const k = (j2len.get(j - 1) ?? 0) + 1;
                next.set(j, k);
                if (k > bestsize) {
                    besti = i - k + 1;
                    bestj = j - k + 1;
                    bestsize = k;
                }
            }
            j2len = next;
        }
        while (besti > alo && bestj > blo && a[besti - 1] === b[bestj - 1]) {
            besti--;
            bestj--;
            bestsize++;
        }
        while (besti + bestsize < ahi && bestj + bestsize < bhi && a[besti + bestsize] === b[bestj + bestsize]) {
            bestsize++;
        }
        return [besti, bestj, bestsize];
    }

    /** @type {[number, number, number][]} */
    const blocks = [];
    const queue = [[0, a.length, 0, b.length]];
    while (queue.length) {
        const [alo, ahi, blo, bhi] = /** @type {number[]} */ (queue.pop());
        const match = longestMatch(alo, ahi, blo, bhi);
        const [i, j, k] = match;
        if (!k) continue;
        blocks.push(match);
        if (alo < i && blo < j) queue.push([alo, i, blo, j]);
        if (i + k < ahi && j + k < bhi) queue.push([i + k, ahi, j + k, bhi]);
    }
    blocks.sort((x, y) => x[0] - y[0] || x[1] - y[1] || x[2] - y[2]);

    // Collapse adjacent runs, then close with the sentinel block.
    /** @type {[number, number, number][]} */
    const merged = [];
    let [i1, j1, k1] = [0, 0, 0];
    for (const [i2, j2, k2] of blocks) {
        if (i1 + k1 === i2 && j1 + k1 === j2) {
            k1 += k2;
        } else {
            if (k1) merged.push([i1, j1, k1]);
            [i1, j1, k1] = [i2, j2, k2];
        }
    }
    if (k1) merged.push([i1, j1, k1]);
    merged.push([a.length, b.length, 0]);

    /** @type {Opcode[]} */
    const ops = [];
    let i = 0;
    let j = 0;
    for (const [ai, bj, size] of merged) {
        if (i < ai && j < bj) ops.push(["replace", i, ai, j, bj]);
        else if (i < ai) ops.push(["delete", i, ai, j, bj]);
        else if (j < bj) ops.push(["insert", i, ai, j, bj]);
        i = ai + size;
        j = bj + size;
        if (size) ops.push(["equal", ai, i, bj, j]);
    }
    return ops;
}

/**
 * Word-level inline diff of two prose strings, as inline HTML. Paragraph
 * breaks inside the region come back as `</p><p>`.
 * @param {string} oldText
 * @param {string} newText
 * @param {DiffResult} result
 * @param {boolean} showDeletions
 */
function wordDiffHtml(oldText, newText, result, showDeletions) {
    const a = tokens(oldText);
    const b = tokens(newText);
    /** @type {string[]} */
    const parts = [];

    /**
     * @param {string[]} run
     * @param {"ins" | "del" | null} tag
     */
    function emit(run, tag) {
        /** @type {string[]} */
        let pending = [];
        const flush = () => {
            if (!pending.length) return;
            const body = renderInline(pending.join(" "));
            parts.push(tag ? `<${tag}>${body}</${tag}>` : body);
            pending = [];
        };
        for (const token of run) {
            if (token === PARA_BREAK) {
                flush();
                parts.push(SENTINEL);
            } else {
                pending.push(token);
            }
        }
        flush();
    }

    /** @param {string[]} run */
    const countWords = (run) => run.filter((token) => token !== PARA_BREAK).length;

    for (const [op, i1, i2, j1, j2] of opcodes(a, b)) {
        if (op === "equal") emit(a.slice(i1, i2), null);
        if (op === "replace" || op === "delete") {
            const run = a.slice(i1, i2);
            result.wordsRemoved += countWords(run);
            // Clean read drops the paragraph breaks with the words: the new
            // version doesn't have them.
            if (showDeletions) emit(run, "del");
        }
        if (op === "replace" || op === "insert") {
            const run = b.slice(j1, j2);
            result.wordsAdded += countWords(run);
            emit(run, "ins");
        }
    }

    /** @type {string[]} */
    const joined = [];
    parts.forEach((part, index) => {
        if (part === SENTINEL) {
            joined.push("</p><p>");
            return;
        }
        if (joined.length && joined[joined.length - 1] !== "</p><p>" && index > 0) joined.push(" ");
        joined.push(part);
    });
    return joined.join("");
}

/**
 * Diff two markdown documents into rendered HTML, a list of changed passages,
 * and word counts. Each changed passage is wrapped in `<div class="change">`
 * with an id the list points at.
 * @param {string} oldText
 * @param {string} newText
 * @param {RenderOptions} [options]
 * @returns {DiffResult}
 */
export function diffDocuments(oldText, newText, { showDeletions = true, headingShift = 0 } = {}) {
    /** @type {DiffResult} */
    const result = { html: "", changes: [], wordsAdded: 0, wordsRemoved: 0 };
    const oldBlocks = splitBlocks(oldText);
    const newBlocks = splitBlocks(newText);
    // Compare blocks on their normalized text, so pure whitespace edits match.
    // (The Python original kept runs of spaces inside a line, so a double
    // space made an empty "change" with nothing marked in it.)
    const key = (/** @type {string} */ block) => kindAndText(block).join(" ").replace(/\s+/g, " ");
    /** @type {string[]} */
    const out = [];

    /**
     * @param {string} html
     * @param {string} excerptSource
     * @param {ChangeKind} kind
     */
    function addChange(html, excerptSource, kind) {
        const id = `chg-${result.changes.length + 1}`;
        const found = words(excerptSource);
        const excerpt = found.slice(0, EXCERPT_WORDS).join(" ") + (found.length > EXCERPT_WORDS ? "…" : "");
        result.changes.push({ id, excerpt, kind });
        return `<div class="change" id="${id}">${html}</div>`;
    }

    for (const [op, i1, i2, j1, j2] of opcodes(oldBlocks.map(key), newBlocks.map(key))) {
        if (op === "equal") {
            for (const block of newBlocks.slice(j1, j2)) out.push(renderBlock(block, null, headingShift));
        } else if (op === "delete") {
            for (const block of oldBlocks.slice(i1, i2)) {
                const [, text] = kindAndText(block);
                result.wordsRemoved += words(text).length;
                let html = "";
                if (showDeletions) {
                    html = text
                        ? renderBlock(block, `<del>${renderInline(text)}</del>`, headingShift)
                        : `<del class="block">${renderBlock(block, null, headingShift)}</del>`;
                }
                out.push(addChange(html, text || block, "removed"));
            }
        } else if (op === "insert") {
            for (const block of newBlocks.slice(j1, j2)) {
                const [, text] = kindAndText(block);
                result.wordsAdded += words(text).length;
                const html = text
                    ? renderBlock(block, `<ins>${renderInline(text)}</ins>`, headingShift)
                    : `<ins class="block">${renderBlock(block, null, headingShift)}</ins>`;
                out.push(addChange(html, text || block, "added"));
            }
        } else {
            // Replace: one word-level diff across the whole changed region.
            const oldRegion = oldBlocks.slice(i1, i2);
            const newRegion = newBlocks.slice(j1, j2);
            const oldSeg = oldRegion.map((block) => kindAndText(block)[1]).join(PARA_BREAK);
            const newSeg = newRegion.map((block) => kindAndText(block)[1]).join(PARA_BREAK);
            const inner = wordDiffHtml(oldSeg, newSeg, result, showDeletions);
            // Keep a heading (or quote) a heading when one block became another
            // of the same kind.
            const sameKind =
                oldRegion.length === 1 &&
                newRegion.length === 1 &&
                kindAndText(oldRegion[0])[0] === kindAndText(newRegion[0])[0] &&
                kindAndText(newRegion[0])[0] !== "p";
            const html = sameKind ? renderBlock(newRegion[0], inner, headingShift) : `<p>${inner}</p>`;
            out.push(addChange(html, newSeg, "edited"));
        }
    }

    result.html = out.join("\n");
    return result;
}

/**
 * Render a single version, with no diff.
 * @param {string} text
 * @param {RenderOptions} [options]
 */
export function renderDocument(text, { headingShift = 0 } = {}) {
    return splitBlocks(text)
        .map((block) => renderBlock(block, null, headingShift))
        .join("\n");
}
