// Links to a step inside a pinned section: /blog/who-wrote-this/#anonymity/rewrite opens the page at the anonymity
// section's paraphrasing step. A step is named by its view (anonymity.json, rq3.json, familiarity.json steps[].view)
// or, in a section whose steps have no names, by its number from 1 (#which-ai/3, #recent/2).
//
// Each stepped section registers its step names and its own `go` (the same jump its step dashes use). The page calls
// followHash() once mounted and on hashchange; while the reader scrolls through a section, stepShown() keeps the
// address bar's hash on the step in view (replaceState: no history entries, no scroll), so the link to copy is
// always the one in the address bar.
import { replaceState } from "$app/navigation";

type Entry = { keys: string[]; go: (i: number, instant?: boolean) => void };
const reg = new Map<string, Entry>();
const waiting = new Map<string, (e: Entry) => void>();
let following = 0; // while a followed link settles, the hash is not rewritten

export function registerSteps(id: string, keys: string[], go: Entry["go"]) {
	const e: Entry = { keys, go };
	reg.set(id, e);
	const w = waiting.get(id);
	if (w) { waiting.delete(id); w(e); }
	return () => { if (reg.get(id) === e) reg.delete(id); };
}

function parse(hash: string) {
	const m = /^#([\w-]+)\/([\w-]+)$/.exec(decodeURIComponent(hash));
	return m ? { id: m[1], key: m[2] } : null;
}

function index(e: Entry, key: string) {
	const i = e.keys.indexOf(key);
	if (i >= 0) return i;
	const n = Number(key);
	return Number.isInteger(n) && n >= 1 && n <= e.keys.length ? n - 1 : -1;
}

/** Scroll to the step the address bar names, once its section has mounted (sections mount lazily). */
export function followHash() {
	const t = parse(location.hash);
	if (!t) return;
	const el = document.getElementById(t.id);
	if (!el) return;
	let moved = false; // the reader scrolling on their own ends the re-aiming below
	const stop = () => { moved = true; };
	const evs = ["wheel", "touchstart", "keydown", "pointerdown"] as const;
	evs.forEach((ev) => addEventListener(ev, stop, { passive: true, once: true }));
	const run = (e: Entry) => {
		const i = index(e, t.key);
		if (i < 0) return;
		following = performance.now();
		// sections above may still be mounting and changing height: aim, then aim again while the page settles
		const aim = () => { if (!moved) { following = performance.now(); e.go(i, true); } };
		requestAnimationFrame(aim);
		[400, 1000, 2000].forEach((ms) => setTimeout(aim, ms));
		setTimeout(() => evs.forEach((ev) => removeEventListener(ev, stop)), 2500);
	};
	const e = reg.get(t.id);
	if (e) run(e);
	else {
		waiting.set(t.id, run);
		el.scrollIntoView({ block: "start" }); // brings the section near, so it mounts
	}
}

/** Keep the address bar on the step in view (only while the section is the one at the middle of the screen). */
export function stepShown(id: string, i: number) {
	const e = reg.get(id);
	if (!e || i < 0 || i >= e.keys.length || performance.now() - following < 2500) return;
	const el = document.getElementById(id);
	if (!el) return;
	const r = el.getBoundingClientRect(), mid = innerHeight / 2;
	if (r.top > mid || r.bottom < mid) return;
	const hash = `#${id}/${e.keys[i]}`;
	if (location.hash === hash) return;
	try { replaceState(hash, {}); } catch { /* before the router is ready: leave the address bar alone */ }
}
