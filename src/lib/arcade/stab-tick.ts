// Straw stab's practice tick: a soft note on each practice cup's beat, so the
// practice can be followed by ear as well as by eye. The effects in sfx.ts
// sound the moment they are called; a tick has to land on a beat of the
// song, so it is scheduled here, on the arcade's shared audio context, in the
// clock the soundtrack itself is scheduled in (startMusic's downbeat is in
// it), a moment ahead as the music is. It goes out through the arcade's
// master gain (so the mute switch and the level apply), sits an octave over
// the song's own effect root (in the music's key, under the melody's level),
// and pauses with the context, so a tick scheduled before a pause still
// lands on its beat after it.

import { sharedAudioContext } from "#lib/audio-context.ts";
import { SONGS } from "#lib/music/songs.ts";
import { getMuted, sfxOutput } from "#lib/sfx.ts";

/** Seconds ahead of its beat a tick is scheduled, about the music's own look-ahead. */
export const TICK_LOOKAHEAD = 0.2;
/** Peak level, before the master gain: about half of a stab's own note. */
const TICK_LEVEL = 0.04;
const TICK_SECONDS = 0.07;

export interface Ticks {
  /**
   * Schedules a tick at audio time `at`, in the key of song `song` (an index
   * into the songbook). False when there is no running audio to put it on.
   */
  at(at: number, song: number): boolean;
  /** Silences every tick still to come: a new run, or the game closing. */
  stop(): void;
}

export function createTicks(): Ticks {
  const voices = new Set<OscillatorNode>();
  return {
    at(at, song) {
      const context = sharedAudioContext();
      if (!context || context.state !== "running") return false;
      if (getMuted()) return true;
      const output = sfxOutput();
      if (!output) return false;
      const start = Math.max(at, context.currentTime);
      const root = SONGS[song]?.sfxRoot ?? 60;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(440 * Math.pow(2, (root + 12 - 69) / 12), start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(TICK_LEVEL, start + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + TICK_SECONDS);
      oscillator.connect(gain).connect(output);
      oscillator.onended = () => {
        voices.delete(oscillator);
        oscillator.disconnect();
        gain.disconnect();
      };
      oscillator.start(start);
      oscillator.stop(start + TICK_SECONDS + 0.02);
      voices.add(oscillator);
      return true;
    },
    stop() {
      for (const voice of voices) {
        try {
          voice.stop();
        } catch {
          // Already stopped.
        }
      }
      voices.clear();
    },
  };
}
