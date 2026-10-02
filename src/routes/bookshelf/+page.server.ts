import { books } from "$lib/server/books";
import type { PageServerLoad } from "./$types";

// The entries ship as this page's data rather than as an import, so they are
// serialized into /bookshelf's response alone instead of sitting in a JS chunk
// that other pages can end up loading. Nothing here reads the URL, so the
// load never reruns while the page is open.
export const load: PageServerLoad = () => ({ books });
