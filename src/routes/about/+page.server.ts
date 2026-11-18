import { aboutData } from "#lib/content.ts";
import type { PageServerLoad } from "./$types";

// Read at build time (the page is prerendered) and sent as page data, so the
// about page's script doesn't bundle the content modules.
export const load: PageServerLoad = () => ({ aboutData });
