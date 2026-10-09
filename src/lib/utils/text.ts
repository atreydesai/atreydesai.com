// Shared inline-markup helpers used across pages.
//
// `parseInline` is the single source of truth for the lightweight markdown-ish
// syntax used in YAML/Markdown content (homepage intro, about page, banner).
// Each call site opts into exactly the transforms it needs.

export interface ParseInlineOptions {
	/** Class string for `<strong>` (empty = naked `<strong>`). */
	strongClass?: string;
	/** Enable `*italic*` → accent span. */
	italic?: boolean;
	/** Enable `[^N]` → footnote reference marker. */
	footnotes?: boolean;
}

// Transforms run in a fixed order: strong → italic → link → footnote.
export function parseInline(text: string, options: ParseInlineOptions = {}): string {
	const { strongClass = "", italic = false, footnotes = false } = options;

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

	text = text.replace(
		/\[([^\]]+)\]\(([^)]+)\)/g,
		'<a href="$2" target="_blank" rel="noopener noreferrer" class="link">$1</a>',
	);

	if (footnotes) {
		text = text.replace(
			/\[\^(\d+)\]/g,
			'<a id="fnref-$1" href="#fn-$1" class="footnote-ref" data-footnote="$1" aria-label="Footnote $1">[$1]</a>',
		);
	}

	return text;
}

// Escape the four characters unsafe in HTML text and double-quoted attributes.
// (Note: RSS uses its own escapeXml which also escapes `'` for XML.)
export function escapeHtml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}
