import { dev } from "$app/environment";
import { track as vercelTrack } from "@vercel/analytics";

// Named events for the actions that say a visit went somewhere: a paper
// opened, the CV downloaded, the email copied, the arcade started. GA's
// enhanced measurement already counts generic outbound clicks and file
// downloads, so only these deliberate actions are named here.

type Params = Record<string, string | number | boolean>;

export function track(event: string, params: Params = {}) {
  if (typeof window === "undefined") return;
  if (dev) {
    console.debug("[track]", event, params);
    return;
  }
  // Custom events are only recorded on Vercel plans that support them; the
  // call is harmless elsewhere.
  vercelTrack(event, params);
  const w = window as any;
  w.dataLayer = w.dataLayer || [];
  // gtag reads Arguments objects from the queue, not arrays, and the queue
  // works before the GA script has loaded.
  (function gtag(..._args: unknown[]) {
    // eslint-disable-next-line prefer-rest-params
    w.dataLayer.push(arguments);
  })("event", event, params);
}

/**
 * One delegated listener for markup-declared events: a click on (or inside)
 * an element with `data-track="event_name"` sends that event, with every
 * other `data-track-*` attribute as a parameter (`data-track-kind="pdf"`
 * becomes `kind: "pdf"`). Returns the cleanup.
 */
export function startClickTracking(): () => void {
  const onClick = (e: MouseEvent) => {
    const el = (e.target as Element | null)?.closest<HTMLElement>("[data-track]");
    if (!el) return;
    const params: Params = { page: location.pathname };
    for (const [key, value] of Object.entries(el.dataset)) {
      if (key.startsWith("track") && key !== "track" && value) {
        const name = key.slice(5);
        params[name.charAt(0).toLowerCase() + name.slice(1)] = value;
      }
    }
    track(el.dataset.track!, params);
  };
  // Capture, so a handler that stops propagation can't hide the click.
  document.addEventListener("click", onClick, true);
  return () => document.removeEventListener("click", onClick, true);
}
