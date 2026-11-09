// Markdown-aware inline diff for prose drafts.
//
// A port of prose-diff-viewer's Python renderer: added text is wrapped in
// <ins>, removed text in <del> (latexdiff conventions), rendered as formatted
// prose rather than raw markdown. Blocks (paragraphs, headings, scene breaks,
// blockquotes) are matched first; a changed region then gets a word-level
// diff, so a one-word edit shows as exactly that rather than a rewritten
// paragraph. The matcher reproduces Python's difflib.SequenceMatcher with
// autojunk off, so both versions of the tool mark the same words.
//
// Two modes sit on that matcher. "exact" is the Python tool's output, word
// for word. "smart" reads better on heavy rewrites: a short unchanged
// fragment stranded between two edits ("and", "the", "detectors like") is
// folded into the edit around it, so a rewritten sentence reads as the old
// sentence, then the new one, rather than a comb of tiny matches. It also
// makes each changed paragraph its own change, so a long rewritten region
// steps paragraph by paragraph.
//
// Comments are kept apart from the prose in both modes: `%` comments and
// reviewer macros (`\todo{...}`, or a `\mohit{...}` that holds a sentence) in
// LaTeX sources, `<!-- -->` in markdown. Each comment is diffed as a single
// token, so it's added or removed whole rather than matched word by word
// against the text around it, and it's left out of the word counts.

const BLOCK_SPLIT = /\n\s*\n/;
const WORD = /\S+/g;
const HEADING = /^(#{1,6})\s+([\s\S]*)$/;
const HR = /^(\*\s*\*\s*\*[\s*]*|-{3,}|_{3,})$/;
const PARA_BREAK = "\n\n";
const SENTINEL = "\0";
const EXCERPT_WORDS = 12;

// A comment travels through the diff as one token: NOTE, then its source
// with each run of whitespace swapped for NOTE_SPACE.
const NOTE = "\u0001";
const NOTE_SPACE = "\u0002";
const NOTE_TOKEN = /(\u0001\S*)/;

// Enough to tell a LaTeX source from markdown.
const LATEX =
    /\\(?:documentclass|usepackage|begin\{|(?:sub)*section\*?\{|chapter\*?\{|paragraph\*?\{|label\{|(?:auto|c|C|eq)?ref\{|cite[a-z]*\*?[[{]|emph\{|text(?:bf|it)\{|footnote\{)/;
// A macro and any optional arguments, up to its opening brace.
const MACRO = /\\([A-Za-z]+)\*?(?:\[[^\]\n]*\])*\{/y;
// Macros that are comments whatever they hold.
const NOTE_MACROS = new Set([
    "todo",
    "TODO",
    "note",
    "comment",
    "fixme",
    "FIXME",
    "marginpar",
    "marginnote",
    "missingfigure",
]);
// Standard macros that carry prose. Any other macro that wraps a phrase of
// NOTE_MIN_WORDS or more somewhere in either version is taken for a
// reviewer's macro, like `\mohit{...}`, and every use of it for a comment,
// down to a one-word `\hg{why?}`.
const PROSE_MACROS = new Set(
    `part chapter section subsection subsubsection paragraph subparagraph title subtitle author date thanks
    caption captionof footnote footnotetext emph textbf textit textsl textsc texttt textsf textrm textmd textup
    textnormal textsuperscript textsubscript underline uline sout xout st hl ul enquote foreignlanguage mbox
    makebox fbox framebox parbox text textcolor colorbox fcolorbox href url item cite citep citet citealp
    citealt citeauthor citeyear citeyearpar nocite parencite textcite autocite footcite ref autoref cref Cref
    eqref pageref nameref label input include includegraphics begin end newcommand renewcommand
    providecommand newenvironment renewenvironment def hspace vspace keywords abstract bibliography
    bibliographystyle usepackage documentclass multicolumn multirow mathrm mathbf mathit mathcal operatorname
    frac sqrt intertext`.split(/\s+/),
);
const NOTE_MIN_WORDS = 3;

// Smart mode folds an unchanged run of at most FOLD_MAX_WORDS between two
// rewrites into them. Each rewrite is measured by its longer half, old or
// new; the run may be as long as the shorter rewrite when the other one
// reaches FOLD_BIG_EDIT words, and half as long otherwise, so "[-a-] {+the+}
// big [-dog-] {+cat+}" keeps its "big".
const FOLD_MAX_WORDS = 6;
const FOLD_BIG_EDIT = 4;
// A word that ends a sentence, allowing for a closing quote or bracket.
const SENTENCE_END = /[.!?]["'”’)\]}]*$/;

/** @typedef {"equal" | "replace" | "delete" | "insert"} OpTag */
/** @typedef {[OpTag, number, number, number, number]} Opcode */
/** @typedef {"edited" | "added" | "removed" | "comment"} ChangeKind */
/** @typedef {{ id: string, excerpt: string, kind: ChangeKind }} Change */
/**
 * @typedef {object} DiffResult
 * @property {string} html
 * @property {Change[]} changes
 * @property {number} wordsAdded Prose words, not counting comments.
 * @property {number} wordsRemoved
 * @property {number} notesAdded Comments added.
 * @property {number} notesRemoved Comments removed.
 */
/**
 * How a pair of sources is read: as LaTeX or markdown, and which macros hold
 * comments.
 * @typedef {{ latex: boolean, noteMacros: Set<string> }} Syntax
 */
/**
 * @typedef {object} RenderOptions
 * @property {boolean} [showDeletions] Render removed text (default true). Off,
 *   the output reads as the new version with its additions marked.
 * @property {number} [headingShift] Levels to demote markdown headings by, so a
 *   chapter's `#` can sit under a page's own h1 (default 0).
 * @property {"exact" | "smart"} [mode] "exact" (the default) marks every word
 *   the matcher finds; "smart" folds stranded fragments into the edits around
 *   them and makes each changed paragraph its own change.
 * @property {boolean} [latex] Read the source as LaTeX, for its comments.
 *   Detected from the text when left out.
 */

/** @param {string} text */
function words(text) {
    return text.match(WORD) ?? [];
}

/** @param {string} token */
function isNote(token) {
    return token.startsWith(NOTE);
}

/** @param {string} token */
function isProse(token) {
    return token !== PARA_BREAK && !isNote(token);
}

/** @param {string} text */
function strip(text) {
    return text.replace(/^\s+|\s+$/g, "");
}

/** Whether a source reads as LaTeX rather than markdown. @param {string} text */
export function looksLikeLatex(text) {
    return LATEX.test(text);
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
        // Underscores inside a word (snake_case, LaTeX labels) aren't emphasis.
        .replace(/(?<![\w\\])_([^_\n]+)_(?!\w)/g, "<em>$1</em>")
        .replace(/`([^`]+)`/g, "<code>$1</code>");
}

// ---- comments ----

/** @param {string} raw */
function noteToken(raw) {
    return NOTE + strip(raw).replace(/\s+/g, NOTE_SPACE);
}

/**
 * Index of the brace that closes the one at `open`, or -1.
 * @param {string} text
 * @param {number} open
 */
function closingBrace(text, open) {
    let depth = 0;
    for (let i = open; i < text.length; i++) {
        const ch = text[i];
        if (ch === "\\") i++;
        else if (ch === "{") depth++;
        else if (ch === "}" && --depth === 0) return i;
    }
    return -1;
}

/**
 * Read a source (or both versions, joined) for its syntax.
 * @param {string} text
 * @param {boolean} [latex] Overrides detection.
 * @returns {Syntax}
 */
function readSyntax(text, latex) {
    const noteMacros = new Set(NOTE_MACROS);
    // A reviewer's macro is LaTeX enough on its own, even in a fragment
    // without a \section or \cite to go by.
    let reviewed = false;
    for (const found of text.matchAll(/\\([A-Za-z]+)\*?(?:\[[^\]\n]*\])*\{/g)) {
        const name = found[1];
        if (noteMacros.has(name)) reviewed = true;
        if (noteMacros.has(name) || PROSE_MACROS.has(name)) continue;
        const open = (found.index ?? 0) + found[0].length - 1;
        const close = closingBrace(text, open);
        if (close >= 0 && words(text.slice(open + 1, close)).length >= NOTE_MIN_WORDS) {
            noteMacros.add(name);
            reviewed = true;
        }
    }
    const isLatex = latex ?? (looksLikeLatex(text) || reviewed);
    return { latex: isLatex, noteMacros };
}

/**
 * Swap each comment in a block's source for a note token, spaced off from
 * the words either side.
 * @param {string} text
 * @param {Syntax} syntax
 */
function markNotes(text, syntax) {
    const mark = (/** @type {string} */ raw) => ` ${noteToken(raw)} `;
    if (!syntax.latex) return text.replace(/<!--[\s\S]*?-->/g, mark);

    // `%` runs to the end of its line, unless escaped as `\%`. An empty one
    // only joins two lines.
    const source = text
        .split("\n")
        .map((line) => {
            const at = line.search(/(?<!\\)%/);
            if (at < 0) return line;
            return line.slice(0, at) + (strip(line.slice(at + 1)) ? mark(line.slice(at)) : "");
        })
        .join("\n");

    let out = "";
    let i = 0;
    while (i < source.length) {
        const ch = source[i];
        if (ch === NOTE) {
            // A `%` comment marked above, perhaps holding a macro: copy it whole.
            let end = i;
            while (end < source.length && !/\s/.test(source[end])) end++;
            out += source.slice(i, end);
            i = end;
        } else if (ch === "\\") {
            MACRO.lastIndex = i;
            const found = MACRO.exec(source);
            if (!found) {
                out += source.slice(i, i + 2);
                i += 2;
                continue;
            }
            const open = i + found[0].length - 1;
            const close = closingBrace(source, open);
            if (close >= 0 && syntax.noteMacros.has(found[1])) {
                out += mark(source.slice(i, close + 1));
                i = close + 1;
            } else {
                // Not a comment, but one may sit inside its argument.
                out += found[0];
                i += found[0].length;
            }
        } else {
            out += ch;
            i++;
        }
    }
    return out;
}

/**
 * Who a comment is from (a macro's name, `%`, or "note") and what it says.
 * @param {string} token
 */
function parseNote(token) {
    let body = strip(token.slice(1).split(NOTE_SPACE).join(" ").split(NOTE).join(""));
    let by = "note";
    if (body.startsWith("<!--")) return { by, body: strip(body.replace(/^<!--|-->$/g, "")) };
    if (body.startsWith("%")) {
        by = "%";
        body = strip(body.replace(/^%+/, ""));
    }
    MACRO.lastIndex = 0;
    const found = MACRO.exec(body);
    if (found && closingBrace(body, found[0].length - 1) === body.length - 1) {
        by = by === "%" ? `% ${found[1]}` : found[1];
        body = body.slice(found[0].length, -1);
    }
    return { by, body: strip(body) };
}

/**
 * @param {string} token
 * @param {"ins" | "del" | null} [tag]
 */
function renderNote(token, tag = null) {
    const { by, body } = parseNote(token);
    const inner = `<span class="note-by">${escapeHtml(by)}</span> ${escapeHtml(body)}`;
    return tag ? `<${tag} class="note">${inner}</${tag}>` : `<span class="note">${inner}</span>`;
}

/**
 * Inline HTML for text that may hold note tokens, all of it wrapped in `tag`
 * when one is given.
 * @param {string} text
 * @param {"ins" | "del" | null} [tag]
 */
function renderText(text, tag = null) {
    /** @param {string} prose */
    const wrap = (prose) => (tag ? `<${tag}>${renderInline(prose)}</${tag}>` : renderInline(prose));
    if (!text.includes(NOTE)) return wrap(text);
    return text
        .split(NOTE_TOKEN)
        .map((part, i) => (i % 2 ? renderNote(part, tag) : strip(part) ? wrap(strip(part)) : ""))
        .filter(Boolean)
        .join(" ");
}

/**
 * LaTeX source as the words a reader sees: references and labels dropped,
 * formatting macros unwrapped to their text.
 * @param {string} text
 */
function plainLatex(text) {
    let out = text.replace(
        /\\(?:label|cite[a-z]*|(?:auto|c|C|eq|page|name)?ref|input|include|includegraphics|url|begin|end)\*?(?:\[[^\]]*\])*\{[^{}]*\}(?:\[[^\]]*\])*/g,
        "",
    ).replace(/\\textasciicircum\{\}/g, "^");
    for (let before = ""; before !== out; ) {
        before = out;
        out = out.replace(/\\[A-Za-z]+\*?(?:\[[^\]]*\])*\{([^{}]*)\}/g, "$1");
    }
    return out
        .replace(/\\([%$&#_{}])/g, "$1")
        .replace(/\\[A-Za-z]+\*?|[{}$]/g, "")
        .replace(/~/g, " ")
        .replace(/---/g, "—")
        .replace(/--/g, "–");
}

/**
 * The words a change is listed by: its prose, or what its comments say when
 * it has no prose.
 * @param {string[]} found
 * @param {boolean} latex
 */
function excerptWords(found, latex) {
    const prose = found.filter(isProse);
    if (prose.length && latex) {
        const plain = words(plainLatex(prose.join(" ")));
        if (plain.length) return plain;
    }
    if (prose.length) return prose;
    return found.filter(isNote).flatMap((token) => {
        const { by, body } = parseNote(token);
        return [`${by}:`, ...words(body)];
    });
}

// ---- blocks ----

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
 * The block's kind and the plain text its words are diffed on, comments
 * swapped for note tokens.
 * @param {string} block
 * @param {Syntax} syntax
 * @returns {[string, string]}
 */
function kindAndText(block, syntax) {
    const stripped = strip(block);
    const heading = stripped.match(HEADING);
    if (heading) return [`h${heading[1].length}`, markNotes(heading[2], syntax)];
    if (HR.test(stripped)) return ["hr", ""];
    if (isQuote(stripped)) return ["bq", markNotes(unquote(stripped), syntax)];
    return ["p", joinLines(markNotes(stripped, syntax))];
}

/**
 * Render one markdown block. `inner`, when given, is already-rendered inline
 * HTML to place inside the block's wrapper.
 * @param {string} block
 * @param {string | null} inner
 * @param {number} headingShift
 * @param {Syntax} syntax
 */
function renderBlock(block, inner, headingShift, syntax) {
    const [kind, text] = kindAndText(block, syntax);
    if (kind === "hr") return "<hr>";
    const body = inner ?? renderText(text);
    if (kind === "bq") return `<blockquote><p>${body}</p></blockquote>`;
    if (kind === "p") return `<p>${body}</p>`;
    const level = Math.min(6, Number(kind.slice(1)) + headingShift);
    return `<h${level}>${body}</h${level}>`;
}

// ---- matching ----

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
 * Smart mode's cleanup, after diff-match-patch's semantic cleanup but counted
 * in words: an unchanged run stranded between two edits is folded into them,
 * so "[-one label and underperformed against-] {+a single label and lagged
 * behind+}" replaces "[-one-] {+a single+} label and [-underperformed
 * against-] {+lagged behind+}". Folding cascades, since each fold makes a
 * longer edit for the runs beside it. A run stays when it holds a paragraph
 * break or a comment, when it starts or ends a sentence (a kept "At the
 * default" after a new sentence is a real anchor), or when the edits around
 * it only add or only remove.
 * @param {Opcode[]} ops
 * @param {string[]} a
 * @param {string[]} b
 * @returns {Opcode[]}
 */
function foldFragments(ops, a, b) {
    /** @param {string[]} run */
    const prose = (run) => run.filter(isProse).length;
    /** @param {Opcode} op */
    const removed = ([, i1, i2]) => prose(a.slice(i1, i2));
    /** @param {Opcode} op */
    const added = ([, , , j1, j2]) => prose(b.slice(j1, j2));
    /** @param {Opcode} op */
    const size = (op) => Math.max(removed(op), added(op));

    const out = ops.map((op) => /** @type {Opcode} */ ([...op]));
    for (let k = 1; k + 1 < out.length; ) {
        const [tag, i1, i2, j1] = out[k];
        const left = out[k - 1];
        const right = out[k + 1];
        const run = a.slice(i1, i2);
        let fold =
            tag === "equal" &&
            run.every(isProse) &&
            removed(left) + removed(right) > 0 &&
            added(left) + added(right) > 0 &&
            !SENTENCE_END.test(run[run.length - 1]) &&
            !(SENTENCE_END.test(a[i1 - 1] ?? "") && SENTENCE_END.test(b[j1 - 1] ?? ""));
        if (fold) {
            const shorter = Math.min(size(left), size(right));
            const limit = Math.max(size(left), size(right)) >= FOLD_BIG_EDIT ? shorter : shorter / 2;
            fold = run.length <= Math.min(FOLD_MAX_WORDS, limit);
        }
        if (!fold) {
            k++;
            continue;
        }
        out.splice(k - 1, 3, ["replace", left[1], right[2], left[3], right[4]]);
        // The run before the merged edit now sits beside a longer one.
        k = Math.max(1, k - 2);
    }
    return out;
}

/**
 * One block per token run: each block's tokens, paragraph breaks between,
 * and the block each token came from.
 * @param {string[]} texts
 */
function regionTokens(texts) {
    /** @type {string[]} */
    const found = [];
    /** @type {number[]} */
    const blockOf = [];
    texts.forEach((text, k) => {
        const own = tokens(text);
        if (!own.length) return;
        if (found.length) {
            found.push(PARA_BREAK);
            blockOf.push(k);
        }
        for (const token of own) {
            found.push(token);
            blockOf.push(k);
        }
    });
    return { tokens: found, blockOf };
}

/**
 * A stretch of the rendered region: the whole region in exact mode, one
 * paragraph of the new text in smart mode.
 * @typedef {object} Unit
 * @property {string[]} parts Rendered inline HTML, SENTINEL for a `</p><p>`.
 * @property {number} same Unchanged prose words.
 * @property {number} added
 * @property {number} removed
 * @property {string[]} notes Comments added or removed.
 * @property {boolean} reflowed A paragraph break was added or removed.
 * @property {string[]} newTokens Tokens of the new text, kept or added.
 * @property {string[]} oldTokens Tokens taken out.
 * @property {Set<number>} newBlocks
 * @property {Set<number>} oldBlocks
 */

/** @returns {Unit} */
function newUnit() {
    return {
        parts: [],
        same: 0,
        added: 0,
        removed: 0,
        notes: [],
        reflowed: false,
        newTokens: [],
        oldTokens: [],
        newBlocks: new Set(),
        oldBlocks: new Set(),
    };
}

/**
 * Word-level inline diff of a changed region: its old blocks' texts against
 * its new ones.
 * @param {string[]} oldTexts
 * @param {string[]} newTexts
 * @param {DiffResult} result Counts are added to it.
 * @param {boolean} showDeletions
 * @param {boolean} smart
 * @returns {Unit[]}
 */
function diffRegion(oldTexts, newTexts, result, showDeletions, smart) {
    const { tokens: a, blockOf: aBlock } = regionTokens(oldTexts);
    const { tokens: b, blockOf: bBlock } = regionTokens(newTexts);
    let ops = opcodes(a, b);

    // Counts come from the matcher's own edits, so they don't change with
    // the mode.
    for (const [op, i1, i2, j1, j2] of ops) {
        if (op === "replace" || op === "delete") {
            const run = a.slice(i1, i2);
            result.wordsRemoved += run.filter(isProse).length;
            result.notesRemoved += run.filter(isNote).length;
        }
        if (op === "replace" || op === "insert") {
            const run = b.slice(j1, j2);
            result.wordsAdded += run.filter(isProse).length;
            result.notesAdded += run.filter(isNote).length;
        }
    }
    if (smart) ops = foldFragments(ops, a, b);

    /** @type {Unit[]} */
    const units = [];
    let unit = newUnit();

    /**
     * @param {number} from
     * @param {number} to
     * @param {"ins" | "del" | null} tag
     */
    function emit(from, to, tag) {
        const source = tag === "del" ? a : b;
        const blockOf = tag === "del" ? aBlock : bBlock;
        const visible = tag !== "del" || showDeletions;
        /** @type {string[]} */
        let pending = [];
        const flush = () => {
            if (!pending.length) return;
            const body = renderInline(pending.join(" "));
            unit.parts.push(tag ? `<${tag}>${body}</${tag}>` : body);
            pending = [];
        };
        for (let n = from; n < to; n++) {
            const token = source[n];
            if (token === PARA_BREAK) {
                flush();
                if (tag) unit.reflowed = true;
                // Smart mode starts a new unit at each of the new text's
                // paragraphs; a removed break stays inside its unit, so the
                // units are the same with deletions shown or hidden.
                if (smart && tag !== "del") {
                    units.push(unit);
                    unit = newUnit();
                } else if (visible) {
                    unit.parts.push(SENTINEL);
                }
                continue;
            }
            (tag === "del" ? unit.oldBlocks : unit.newBlocks).add(blockOf[n]);
            (tag === "del" ? unit.oldTokens : unit.newTokens).push(token);
            if (isNote(token)) {
                if (tag) unit.notes.push(token);
                flush();
                if (visible) unit.parts.push(renderNote(token, tag));
                continue;
            }
            if (tag === "del") unit.removed++;
            else if (tag === "ins") unit.added++;
            else unit.same++;
            if (visible) pending.push(token);
        }
        flush();
    }

    for (const [op, i1, i2, j1, j2] of ops) {
        if (op === "equal") emit(j1, j2, null);
        // In smart mode a new paragraph that opens an insertion starts before
        // the old text, so the old text sits with the paragraph replacing it
        // rather than the one before.
        let from = j1;
        let cut = i1;
        if (smart && op === "replace") while (from < j2 && b[from] === PARA_BREAK) from++;
        if (from > j1) {
            // Comments opening the old text were notes on what came before
            // them, so they stay with it.
            while (cut < i2 && isNote(a[cut])) cut++;
            emit(i1, cut, "del");
            emit(j1, from, "ins");
        }
        if (op === "replace" || op === "delete") emit(cut, i2, "del");
        if (op === "replace" || op === "insert") emit(from, j2, "ins");
    }
    units.push(unit);
    return units;
}

/** @param {string[]} parts */
function joinParts(parts) {
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
export function diffDocuments(oldText, newText, { showDeletions = true, headingShift = 0, mode = "exact", latex } = {}) {
    /** @type {DiffResult} */
    const result = { html: "", changes: [], wordsAdded: 0, wordsRemoved: 0, notesAdded: 0, notesRemoved: 0 };
    const syntax = readSyntax(`${oldText}\n${newText}`, latex);
    const isLatex = syntax.latex;
    const smart = mode === "smart";
    const oldBlocks = splitBlocks(oldText);
    const newBlocks = splitBlocks(newText);
    /** @param {string} block */
    const read = (block) => kindAndText(block, syntax);
    /** @param {string} block @param {string | null} inner */
    const render = (block, inner) => renderBlock(block, inner, headingShift, syntax);
    // Compare blocks on their normalized text, so pure whitespace edits match.
    // (The Python original kept runs of spaces inside a line, so a double
    // space made an empty "change" with nothing marked in it.)
    const key = (/** @type {string} */ block) => read(block).join(" ").replace(/\s+/g, " ");
    /** @type {string[]} */
    const out = [];

    /**
     * @param {string} html
     * @param {string[]} excerptFrom
     * @param {ChangeKind} kind
     */
    function addChange(html, excerptFrom, kind) {
        const id = `chg-${result.changes.length + 1}`;
        const excerpt = excerptFrom.slice(0, EXCERPT_WORDS).join(" ") + (excerptFrom.length > EXCERPT_WORDS ? "…" : "");
        result.changes.push({ id, excerpt, kind });
        return `<div class="change" id="${id}">${html}</div>`;
    }

    /**
     * A whole block added or removed.
     * @param {string} block
     * @param {"ins" | "del"} tag
     */
    function wholeBlock(block, tag) {
        const [, text] = read(block);
        const found = words(text);
        const prose = found.filter(isProse).length;
        const notes = found.length - prose;
        if (tag === "del") {
            result.wordsRemoved += prose;
            result.notesRemoved += notes;
        } else {
            result.wordsAdded += prose;
            result.notesAdded += notes;
        }
        let html = "";
        if (tag === "ins" || showDeletions) {
            html = text ? render(block, renderText(text, tag)) : `<${tag} class="block">${render(block, null)}</${tag}>`;
        }
        /** @type {ChangeKind} */
        const kind = notes && !prose ? "comment" : tag === "del" ? "removed" : "added";
        return addChange(html, text ? excerptWords(found, isLatex) : words(block), kind);
    }

    for (const [op, i1, i2, j1, j2] of opcodes(oldBlocks.map(key), newBlocks.map(key))) {
        if (op === "equal") {
            for (const block of newBlocks.slice(j1, j2)) out.push(render(block, null));
            continue;
        }
        if (op === "delete") {
            for (const block of oldBlocks.slice(i1, i2)) out.push(wholeBlock(block, "del"));
            continue;
        }
        if (op === "insert") {
            for (const block of newBlocks.slice(j1, j2)) out.push(wholeBlock(block, "ins"));
            continue;
        }

        // Replace: one word-level diff across the whole changed region.
        const oldRegion = oldBlocks.slice(i1, i2);
        const newRegion = newBlocks.slice(j1, j2);
        const units = diffRegion(
            oldRegion.map((block) => read(block)[1]),
            newRegion.map((block) => read(block)[1]),
            result,
            showDeletions,
            smart,
        );

        if (!smart) {
            const [unit] = units;
            // Keep a heading (or quote) a heading when one block became
            // another of the same kind.
            const sameKind =
                oldRegion.length === 1 &&
                newRegion.length === 1 &&
                read(oldRegion[0])[0] === read(newRegion[0])[0] &&
                read(newRegion[0])[0] !== "p";
            const inner = joinParts(unit.parts);
            const html = sameKind ? render(newRegion[0], inner) : `<p>${inner}</p>`;
            const onlyNotes = !unit.added && !unit.removed && unit.notes.length > 0;
            out.push(addChange(html, excerptWords(onlyNotes ? unit.notes : unit.newTokens, isLatex), onlyNotes ? "comment" : "edited"));
            continue;
        }

        // A paragraph that was only split or joined, with every word kept,
        // isn't worth a stop of its own beside real edits.
        const edited = units.some((unit) => unit.added || unit.removed || unit.notes.length);
        for (const unit of units) {
            const parts = [...unit.parts];
            while (parts[0] === SENTINEL) parts.shift();
            while (parts[parts.length - 1] === SENTINEL) parts.pop();
            const inner = joinParts(parts);
            // A paragraph from a single block keeps that block's kind, so a
            // reworded heading stays a heading.
            const from =
                unit.newBlocks.size === 1
                    ? newRegion[[...unit.newBlocks][0]]
                    : unit.newBlocks.size === 0 && unit.oldBlocks.size === 1
                      ? oldRegion[[...unit.oldBlocks][0]]
                      : null;
            const html = !inner ? "" : from && !parts.includes(SENTINEL) ? render(from, inner) : `<p>${inner}</p>`;
            const reflowed = !edited && unit.reflowed;
            if (!unit.added && !unit.removed && !unit.notes.length && !reflowed) {
                if (html) out.push(html);
                continue;
            }
            /** @type {ChangeKind} */
            let kind = "edited";
            if (!unit.added && !unit.removed && !reflowed) kind = "comment";
            else if (!unit.same && !unit.removed) kind = "added";
            else if (!unit.same && !unit.added) kind = "removed";
            const listedBy =
                kind === "comment" ? unit.notes : unit.newTokens.some(isProse) ? unit.newTokens : unit.oldTokens;
            out.push(addChange(html, excerptWords(listedBy, isLatex), kind));
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
export function renderDocument(text, { headingShift = 0, latex } = {}) {
    const syntax = readSyntax(text, latex);
    return splitBlocks(text)
        .map((block) => renderBlock(block, null, headingShift, syntax))
        .join("\n");
}
