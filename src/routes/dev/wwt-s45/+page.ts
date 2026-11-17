import { dev } from "$app/env";
import { error } from "@sveltejs/kit";

// Preview of the launch page's sections 4 and 5 (familiarity, anonymity); never part of the built site.
export function load() {
	if (!dev) error(404, "Not found");
}
