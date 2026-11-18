import { dev } from "$app/env";
import { error } from "@sveltejs/kit";

// Development only: never built (it answers 404 outside `vite dev`).
export const prerender = false;

// Prototype preview of the launch page's fingerprint motif; never part of the built site.
export function load() {
	if (!dev) error(404, "Not found");
}
