import { dev } from "$app/environment";
import { error } from "@sveltejs/kit";

// Visual QA for the research explainers; never part of the built site.
export const prerender = false;

export function load() {
	if (!dev) error(404, "Not found");
}
