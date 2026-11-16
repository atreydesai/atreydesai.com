import { dev } from "$app/environment";
import { error } from "@sveltejs/kit";

// Visual QA for the arcade's share cards and share text; never part of the built site.
export function load() {
	if (!dev) error(404, "Not found");
}
