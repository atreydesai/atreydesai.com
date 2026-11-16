import { dev } from "$app/environment";
import { error } from "@sveltejs/kit";

// Dev preview of the launch page's section 2 (If AI, which AI?); never part of the built site.
export function load() {
	if (!dev) error(404, "Not found");
}
