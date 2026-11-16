// The page's footnotes: sections register their notes (Footnotes.svelte); one list at the bottom of the page
// (FootnoteList.svelte) numbers them in reading order and shows a preview when the reader points at a mark.
export type Note = { n: number; t: string; src?: string; href?: string };

/** registered notes by key "<section id>-<n>" (the key in each mark's href "#fn-<section id>-<n>") */
export const notes = $state<{ map: Record<string, Note> }>({ map: {} });

export function register(id: string, list: Note[]) {
	const next = { ...notes.map };
	for (const n of list) next[`${id}-${n.n}`] = n;
	notes.map = next;
	return () => {
		const left = { ...notes.map };
		for (const n of list) delete left[`${id}-${n.n}`];
		notes.map = left;
	};
}
