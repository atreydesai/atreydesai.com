import { dev } from "$app/env";
import { error } from "@sveltejs/kit";

// Visual QA for the research explainers; never part of the built site.
export function load() {
	if (!dev) error(404, "Not found");
}
