import { dev } from "$app/environment";
import { error } from "@sveltejs/kit";

// Dev preview of the launch page's section 3 (If human, which human?); never part of the built site.
export function load() {
	if (!dev) error(404, "Not found");
}
