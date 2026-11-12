import assert from "node:assert/strict";
import test from "node:test";

import { SONGS } from "../src/lib/music/songs.ts";
import {
  BEATS_PER_BAR,
  approachNote,
  barSlot,
  bassMidi,
  chordAt,
  hitBeats,
  lineBeats,
  parseArp,
  parseBassLine,
  parseChordBar,
  parseMelody,
  parsePattern,
  parsePitch,
  parseSong,
  pumpShape,
  stepBeat,
} from "../src/lib/music/notation.ts";
import { bandSizes, climbingPlaylist, shuffledPlaylist } from "../src/lib/music/playlist.ts";

const PHASES = ["opening", "steady", "rush"];
const DRUMS = ["kick", "snare", "rim", "hat", "open", "shaker"];

test("every song in the songbook is well formed", () => {
  for (const song of SONGS) {
    assert.ok(song.name.length <= 14, `${song.name}: name too long for the flag`);
    assert.equal(song.sections.length, 2, `${song.name}: two sections`);
    for (const [s, section] of song.sections.entries()) {
      assert.equal(section.chords.length, 8, `${song.name} section ${s}: 8 chord bars`);
      assert.equal(section.melody.length, 8, `${song.name} section ${s}: 8 melody bars`);
      section.melody.forEach((line, bar) => {
        assert.equal(
          lineBeats(parseMelody(line)),
          BEATS_PER_BAR,
          `${song.name} ${s}:${bar} melody "${line}"`,
        );
      });
      section.chords.forEach((line, bar) => {
        const spans = parseChordBar(line);
        assert.equal(lineBeats(spans), BEATS_PER_BAR, `${song.name} ${s}:${bar} chords "${line}"`);
        for (const span of spans) {
          assert.ok(song.chords[span.name], `${song.name}: chord ${span.name} is not defined`);
        }
      });
    }
    for (const chord of Object.values(song.chords)) {
      assert.equal(chord.keys.split(" ").map(parsePitch).length, 4);
      parsePitch(chord.bass);
    }
    for (const phase of PHASES) {
      const groove = song.grooves[phase];
      assert.equal(
        lineBeats(parseBassLine(groove.bass)),
        BEATS_PER_BAR,
        `${song.name} ${phase} bass`,
      );
      assert.equal(parsePattern(groove.comp).length, 16);
      for (const drum of DRUMS) {
        if (groove[drum])
          assert.equal(parsePattern(groove[drum]).length, 16, `${song.name} ${phase} ${drum}`);
      }
    }
    assert.equal(parsePattern(song.fill.kick).length, 16);
    assert.equal(parsePattern(song.fill.snare).length, 16);
    assert.equal(parseArp(song.arp).length, 8);
    assert.ok(song.swing >= 0.5 && song.swing < 0.75);
    // Parses as a whole, and only once.
    assert.equal(parseSong(song), parseSong(song));
  }
});

test("pitches parse with sharps, flats, and octaves", () => {
  assert.equal(parsePitch("c4"), 60);
  assert.equal(parsePitch("a4"), 69);
  assert.equal(parsePitch("b4"), 71);
  assert.equal(parsePitch("bb3"), 58);
  assert.equal(parsePitch("eb4"), 63);
  assert.equal(parsePitch("f#5"), 78);
  assert.equal(parsePitch("c#4"), 61);
  assert.equal(parsePitch("ab5"), 80);
  assert.equal(parsePitch("d2"), 38);
  assert.throws(() => parsePitch("h4"));
  assert.throws(() => parsePitch("c"));
});

test("melody lines read beats and rests", () => {
  const notes = parseMelody("a5/.5 c6/.5 -/.5 a5/.5 g5 e5");
  assert.deepEqual(
    notes.map((note) => [note.beat, note.beats, note.midi]),
    [
      [0, 0.5, 81],
      [0.5, 0.5, 84],
      [1, 0.5, null],
      [1.5, 0.5, 81],
      [2, 1, 79],
      [3, 1, 76],
    ],
  );
});

test("the chord sounding at a beat of a split bar", () => {
  const spans = parseChordBar("Cmaj7/2 A7/2");
  assert.equal(chordAt(spans, 0).name, "Cmaj7");
  assert.equal(chordAt(spans, 1.5).name, "Cmaj7");
  assert.equal(chordAt(spans, 2).name, "A7");
  assert.equal(chordAt(spans, 3.5).name, "A7");
  const whole = parseChordBar("Dm7");
  assert.deepEqual(whole, [{ name: "Dm7", beat: 0, beats: 4 }]);
  assert.equal(chordAt(whole, 3).name, "Dm7");
});

test("bass degrees for each chord quality", () => {
  const root = 43; // g2
  const expected = {
    maj: [43, 47, 50, 54, 55],
    min: [43, 46, 50, 53, 55],
    dom: [43, 47, 50, 53, 55],
    sus: [43, 48, 50, 53, 55],
    m6: [43, 46, 50, 52, 55],
  };
  for (const [quality, notes] of Object.entries(expected)) {
    const chord = { keys: [], root, quality };
    assert.deepEqual(
      ["R", "3", "5", "7", "8"].map((degree) => bassMidi(degree, chord, 0)),
      notes,
      quality,
    );
    assert.equal(bassMidi("-", chord, 0), null);
  }
});

test("the approach note sits a semitone under the next root, near the current one", () => {
  // From d3 into g2: f#, the one just above d3, not an octave down.
  assert.equal(approachNote(50, 43), 54);
  // From g2 into c3: b2.
  assert.equal(approachNote(43, 48), 47);
  // From a2 into f2: e2.
  assert.equal(approachNote(45, 41), 40);
  // Into the same root: a leading tone just under it.
  assert.equal(approachNote(45, 45), 44);
  const dm = { keys: [], root: 50, quality: "min" };
  assert.equal(bassMidi(">", dm, 43), 54);
  for (let root = 36; root < 52; root++) {
    for (let next = 30; next < 60; next++) {
      const note = approachNote(root, next);
      assert.equal((((note - (next - 1)) % 12) + 12) % 12, 0);
      assert.ok(note - root <= 5 && root - note <= 6);
    }
  }
});

test("swing moves only the odd sixteenths; every eighth stays put", () => {
  for (const swing of [0.5, 0.55, 0.57, 0.6]) {
    for (let step = 0; step < 16; step += 2) assert.equal(stepBeat(step, swing), step / 4);
  }
  assert.equal(stepBeat(1, 0.5), 0.25);
  assert.equal(stepBeat(3, 0.5), 0.75);
  assert.ok(Math.abs(stepBeat(1, 0.56) - 0.28) < 1e-9);
  assert.ok(Math.abs(stepBeat(15, 0.6) - 3.8) < 1e-9);
});

test("rhythm form: eight bars a song in order, sections alternating by visit", () => {
  const order = [1, 0, 2, 3];
  for (let bar = 0; bar < 96; bar++) {
    const slot = barSlot(SONGS, order, bar, 8);
    const position = Math.floor(bar / 8);
    const loop = Math.floor(position / order.length);
    assert.equal(slot.song, order[position % order.length]);
    assert.equal(slot.barInSong, bar % 8);
    assert.equal(slot.barInSection, bar % 8);
    assert.equal(slot.section, loop % 2);
    assert.equal(slot.lap, Math.floor(loop / 2));
  }
  // A song listed twice counts each visit.
  assert.equal(barSlot(SONGS, [0, 0], 8, 8).section, 1);
  assert.equal(barSlot(SONGS, [0, 0], 16, 8).section, 0);
  assert.equal(barSlot(SONGS, [0, 0], 16, 8).lap, 1);
});

test("listening form: 32 bars a song, A B A B, laps 0 0 1 1", () => {
  for (const order of [undefined, []]) {
    for (let bar = 0; bar < 32 * SONGS.length * 2; bar++) {
      const slot = barSlot(SONGS, order, bar, 8);
      const block = Math.floor((bar % 32) / 8);
      assert.equal(slot.song, Math.floor(bar / 32) % SONGS.length);
      assert.equal(slot.barInSong, bar % 32);
      assert.equal(slot.barInSection, bar % 8);
      assert.equal(slot.section, [0, 1, 0, 1][block]);
      assert.equal(slot.lap, [0, 0, 1, 1][block]);
    }
  }
});

/** A seeded generator (mulberry32), so a draw can be repeated. */
function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Kept in step with `LeadVoice`, `KeysVoice`, and `Kit` in songs.ts.
const LEAD_VOICES = [
  "marimba",
  "glass",
  "kalimba",
  "whistle",
  "vibes",
  "reed",
  "square",
  "pluck",
  "saw",
  "acid",
];
const KEYS_VOICES = ["rhodes", "saw"];
const KITS = ["soft", "club"];

test("twelve songs, uniquely named, each on voices and a kit the band has", () => {
  assert.equal(SONGS.length, 12);
  assert.equal(new Set(SONGS.map((song) => song.name)).size, SONGS.length);
  for (const song of SONGS) {
    assert.ok(song.name.length <= 14, song.name);
    assert.ok(LEAD_VOICES.includes(song.lead), `${song.name}: no lead voice "${song.lead}"`);
    if (song.keys !== undefined)
      assert.ok(KEYS_VOICES.includes(song.keys), `${song.name}: no keys voice "${song.keys}"`);
    if (song.kit !== undefined) assert.ok(KITS.includes(song.kit), `${song.name}: no kit "${song.kit}"`);
    if (song.pump !== undefined)
      assert.ok(song.pump >= 0 && song.pump <= 1, `${song.name}: pump ${song.pump} is not 0–1`);
  }
});

test("hit beats: where a pattern strikes, swung like the drums", () => {
  assert.deepEqual(hitBeats(parsePattern("x...x...x...x..."), 0.5), [0, 1, 2, 3]);
  assert.deepEqual(hitBeats(parsePattern("x.o.....X......x"), 0.6), [0, 0.5, 2, 3.8]);
  assert.deepEqual(hitBeats(null, 0.5), []);
  assert.deepEqual(hitBeats(parsePattern("................"), 0.5), []);
});

test("the pump ducks under each kick and is back at rest by the bar line", () => {
  const beat = 60 / 126;
  const bar = 4 * beat;
  const drop = 0.005;
  const swell = 0.6 * beat;
  const near = (a, b) => Math.abs(a - b) < 1e-9;

  // Four on the floor: fall, climb, rest, four times over.
  const four = pumpShape([0, 1, 2, 3], beat, bar, 0.55, drop, swell);
  assert.equal(four.length, 12);
  [0, 1, 2, 3].forEach((b, n) => {
    const [pin, bottom, top] = four.slice(n * 3, n * 3 + 3);
    assert.ok(near(pin.time, b * beat) && pin.value === 1);
    assert.ok(near(bottom.time, b * beat + drop) && near(bottom.value, 0.45));
    assert.ok(near(top.time, b * beat + swell) && top.value === 1);
  });

  // A fill: kicks a sixteenth apart cut each climb short and fall from
  // where it got to; the last climb hurries to rest on the bar line.
  const kicks = [0, 1, 2, 2.5, 3, 3.25, 3.5, 3.75];
  for (const depth of [0.3, 0.55, 0.6, 1]) {
    const points = pumpShape(kicks, beat, bar, depth, drop, swell);
    for (let n = 1; n < points.length; n++) {
      assert.ok(points[n].time > points[n - 1].time, "in time order, no two at once");
    }
    for (const point of points) {
      assert.ok(point.value >= 1 - depth - 1e-9 && point.value <= 1, `value ${point.value}`);
      assert.ok(point.time >= 0 && point.time <= bar + 1e-9);
    }
    const last = points[points.length - 1];
    assert.ok(near(last.time, bar) && last.value === 1, "ends at rest on the bar line");
    // Every kick falls to the bottom within the drop.
    for (const b of kicks) {
      const bottom = points.find((point) => near(point.time, b * beat + drop));
      assert.ok(bottom && near(bottom.value, 1 - depth), `kick at ${b}`);
    }
    // A cut-short climb: the next fall starts from part way up, on the line.
    const cut = points.find((point) => near(point.time, 3.25 * beat));
    const slope = depth / (swell - drop);
    assert.ok(near(cut.value, 1 - depth + slope * (0.25 * beat - drop)));
  }

  // No kicks, no pump.
  assert.deepEqual(pumpShape([], beat, bar, 0.55, drop, swell), []);
});

test("a shuffled playlist is every song once, avoiding the last opener", () => {
  for (let seed = 1; seed <= 300; seed++) {
    const count = 1 + (seed % 12);
    const avoid = seed % count;
    const list = shuffledPlaylist(count, avoid, seeded(seed));
    assert.deepEqual(
      [...list].sort((a, b) => a - b),
      Array.from({ length: count }, (_, index) => index),
    );
    if (count > 1) assert.notEqual(list[0], avoid);
    // The same seed draws the same order.
    assert.deepEqual(shuffledPlaylist(count, avoid, seeded(seed)), list);
  }
  assert.deepEqual(shuffledPlaylist(1, 0), [0]);
  assert.deepEqual(shuffledPlaylist(0, null), []);
  // Every song gets to open sometimes.
  const openers = new Set();
  for (let seed = 1; seed <= 200; seed++) openers.add(shuffledPlaylist(10, null, seeded(seed))[0]);
  assert.equal(openers.size, 10);
});

test("a climbing playlist draws one song from each tempo band, slowest first", () => {
  // The first ten songs (2, 3, 3, 2) and the whole songbook (3, 3, 3, 3).
  for (const [count, sizes] of [
    [10, [2, 3, 3, 2]],
    [12, [3, 3, 3, 3]],
  ]) {
    assert.deepEqual(bandSizes(count, 4), sizes);
    const tempos = SONGS.slice(0, count).map((song) => song.bpm);
    const ranked = tempos
      .map((bpm, index) => ({ bpm, index }))
      .sort((a, b) => a.bpm - b.bpm || a.index - b.index)
      .map((entry) => entry.index);
    const bands = [];
    let from = 0;
    for (const size of sizes) {
      bands.push(ranked.slice(from, from + size));
      from += size;
    }
    const seen = bands.map(() => new Set());
    for (let seed = 1; seed <= 500; seed++) {
      const list = climbingPlaylist(tempos, 4, seeded(seed));
      assert.equal(list.length, 4);
      assert.equal(new Set(list).size, 4);
      list.forEach((song, band) => {
        assert.ok(bands[band].includes(song), `${count} songs, seed ${seed}: song ${song} not in band ${band}`);
        seen[band].add(song);
        if (band > 0) assert.ok(tempos[song] >= tempos[list[band - 1]]);
      });
      assert.deepEqual(climbingPlaylist(tempos, 4, seeded(seed)), list);
    }
    // Every song in every band comes up.
    seen.forEach((songs, band) => assert.equal(songs.size, bands[band].length));
    // More picks than songs: every song, slowest first.
    assert.deepEqual(climbingPlaylist(tempos, 20, seeded(7)), ranked);
  }
  assert.deepEqual(climbingPlaylist([120, 100, 120], 5), [1, 0, 2]);
});

test("listening form with an order: 32 bars a song in that order, looping", () => {
  const order = [7, 2, 9];
  for (let bar = 0; bar < 32 * order.length * 2; bar++) {
    const slot = barSlot(SONGS, order, bar, 8, "listening");
    const block = Math.floor((bar % 32) / 8);
    assert.equal(slot.song, order[Math.floor(bar / 32) % order.length]);
    assert.equal(slot.barInSong, bar % 32);
    assert.equal(slot.barInSection, bar % 8);
    assert.equal(slot.section, [0, 1, 0, 1][block]);
    assert.equal(slot.lap, [0, 0, 1, 1][block]);
  }
  // Naming the form the default picks changes nothing.
  for (let bar = 0; bar < 64; bar++) {
    assert.deepEqual(barSlot(SONGS, [1, 0], bar, 8, "rhythm"), barSlot(SONGS, [1, 0], bar, 8));
    assert.deepEqual(barSlot(SONGS, undefined, bar, 8, "listening"), barSlot(SONGS, undefined, bar, 8));
  }
});
