// Shared inline-markup helpers used across pages.
//
// `parseInline` is the single source of truth for the lightweight markdown-ish
// syntax used in YAML/Markdown content (homepage intro, about page, banner).
// Each call site opts into exactly the transforms it needs, so the rendered
// HTML stays identical to the per-page functions this replaced.

export interface ParseInlineOptions {
	/** Class string for `<strong>` (empty = naked `<strong>`). */
	strongClass?: string;
	/** Enable `*italic*` → accent span. */
	italic?: boolean;
	/** Enable `[label]()` (empty parens) → copy button. */
	copyButton?: boolean;
	/** Enable `[^N]` → footnote reference marker. */
	footnotes?: boolean;
}

// Transform order is significant — it mirrors the original per-page functions
// so output is byte-for-byte identical: strong → italic → copyButton → link →
// footnote. (`copyButton` matches empty `()`, `link` matches non-empty `(url)`,
// so they never collide, but copyButton runs first to match the old banner code.)
export function parseInline(text: string, options: ParseInlineOptions = {}): string {
	const { strongClass = "", italic = false, copyButton = false, footnotes = false } = options;

	text = text.replace(
		/\*\*([^*]+)\*\*/g,
		strongClass ? `<strong class="${strongClass}">$1</strong>` : "<strong>$1</strong>",
	);

	if (italic) {
		text = text.replace(
			/\*([^*]+)\*/g,
			'<span class="text-ink-900 dark:text-cream-100">$1</span>',
		);
	}

	if (copyButton) {
		text = text.replace(
			/\[([^\]]+)\]\(\)/g,
			'<button type="button" data-banner-copy class="link banner-copy-btn">$1</button>',
		);
	}

	text = text.replace(
		/\[([^\]]+)\]\(([^)]+)\)/g,
		'<a href="$2" target="_blank" rel="noopener noreferrer" class="link">$1</a>',
	);

	if (footnotes) {
		text = text.replace(
			/\[\^(\d+)\]/g,
			'<a href="#fn-$1" class="footnote-ref" data-footnote="$1">[$1]</a>',
		);
	}

	return text;
}

// Escape the five characters unsafe in HTML text/attribute context.
// (Note: RSS uses its own escapeXml which also escapes `'` for XML.)
export function escapeHtml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}
