import { dev } from "$app/environment";
import { error } from "@sveltejs/kit";

// Recording stage for the launch video and the link card; never part of the built site.
export function load() {
	if (!dev) error(404, "Not found");
}
