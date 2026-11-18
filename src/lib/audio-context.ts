// The one AudioContext the site's sounds share, and the call that wakes it.
//
// Browsers only let a context start inside a user gesture, so whatever opens
// the arcade has to unlock audio synchronously in its click. That used to mean
// importing sfx.ts, and with it the arcade's soundtrack, into every page via
// the footer. This module is the small part a click needs; sfx.ts builds its
// graph on the same context when the arcade loads.

let shared: AudioContext | null = null;
// Set while a game holds the clock (sfx.ts's suspendAudio): nothing may wake
// the context then, or a stray blip restarts the soundtrack under a pause card.
let held = false;

export function sharedAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!shared) {
    const AudioContextConstructor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) return null;
    shared = new AudioContextConstructor();
  }
  return shared;
}

/** Whether sound can play now, without creating the context to find out. */
export function audioRunning() {
  return shared?.state === "running";
}

export function holdAudioClock(value: boolean) {
  held = value;
}

/** Create or resume the shared context. Call it inside a user gesture. */
export function unlockAudio() {
  const context = sharedAudioContext();
  if (!context || held || context.state !== "suspended") return;
  void context.resume().catch(() => {
    // A later user gesture will retry.
  });
}
