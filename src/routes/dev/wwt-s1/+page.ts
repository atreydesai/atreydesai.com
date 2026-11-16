import { dev } from "$app/environment";
import { error } from "@sveltejs/kit";

// Prototype preview of the launch page's fingerprint motif; never part of the built site.
export function load() {
	if (!dev) error(404, "Not found");
}
