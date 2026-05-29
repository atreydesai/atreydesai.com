// Tiny Web Audio chiptune engine — no audio assets, just square/triangle
// oscillators for an 8-bit feel. The AudioContext is created lazily on first
// use (which happens right after a user gesture, so autoplay policies are
// satisfied) and persists as a module singleton across game sessions.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;

function ac(): AudioContext | null {
	if (typeof window === "undefined") return null;
	if (!ctx) {
		const AC =
			window.AudioContext ||
			(window as unknown as { webkitAudioContext?: typeof AudioContext })
				.webkitAudioContext;
		if (!AC) return null;
		ctx = new AC();
		master = ctx.createGain();
		master.gain.value = muted ? 0 : 0.5;
		master.connect(ctx.destination);
	}
	if (ctx.state === "suspended") ctx.resume();
	return ctx;
}

export function setMuted(m: boolean) {
	muted = m;
	if (master) master.gain.value = m ? 0 : 0.5;
}
export function isMuted() {
	return muted;
}

// One staccato note with a click-free attack/decay envelope.
function note(
	freq: number,
	start: number,
	dur: number,
	type: OscillatorType = "square",
	vol = 0.3,
) {
	if (!ctx || !master) return;
	const osc = ctx.createOscillator();
	const g = ctx.createGain();
	osc.type = type;
	osc.frequency.setValueAtTime(freq, start);
	g.gain.setValueAtTime(0.0001, start);
	g.gain.exponentialRampToValueAtTime(vol, start + 0.008);
	g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
	osc.connect(g).connect(master);
	osc.start(start);
	osc.stop(start + dur + 0.02);
}

// A pitch slide (used for the "hurt" sound).
function slide(
	fromF: number,
	toF: number,
	dur: number,
	type: OscillatorType = "square",
	vol = 0.32,
) {
	if (!ctx || !master) return;
	const t = ctx.currentTime;
	const osc = ctx.createOscillator();
	const g = ctx.createGain();
	osc.type = type;
	osc.frequency.setValueAtTime(fromF, t);
	osc.frequency.exponentialRampToValueAtTime(Math.max(40, toF), t + dur);
	g.gain.setValueAtTime(0.0001, t);
	g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
	g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
	osc.connect(g).connect(master);
	osc.start(t);
	osc.stop(t + dur + 0.02);
}

// Ascending power-up arpeggio — plays when the game starts.
export function sfxStart() {
	const c = ac();
	if (!c) return;
	const t = c.currentTime;
	[523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
		note(f, t + i * 0.07, 0.09, "square", 0.28),
	);
}

// Bright two-note "coin" blip — a boba is caught.
export function sfxCatch() {
	const c = ac();
	if (!c) return;
	const t = c.currentTime;
	note(987.77, t, 0.06, "square", 0.28); // B5
	note(1318.51, t + 0.06, 0.12, "square", 0.28); // E6
}

// Triumphant rising fanfare — every 10th boba caught.
export function sfxMilestone() {
	const c = ac();
	if (!c) return;
	const t = c.currentTime;
	// quick ascending arpeggio...
	const seq = [659.25, 783.99, 1046.5, 1318.51, 1567.98]; // E5 G5 C6 E6 G6
	seq.forEach((f, i) => note(f, t + i * 0.07, 0.1, "square", 0.26));
	// ...capped with a high sparkle
	note(2093.0, t + 0.4, 0.2, "square", 0.22); // C7
	note(1567.98, t + 0.4, 0.2, "triangle", 0.18); // G6 underneath
}

// Downward buzz — a boba was missed (lost heart).
export function sfxMiss() {
	const c = ac();
	if (!c) return;
	slide(440, 90, 0.22, "square", 0.34);
}

// Descending, slowing fanfare — game over.
export function sfxGameOver() {
	const c = ac();
	if (!c) return;
	const t = c.currentTime;
	const seq: Array<[number, number, number]> = [
		[659.25, 0.0, 0.14],
		[523.25, 0.16, 0.14],
		[415.3, 0.34, 0.16],
		[349.23, 0.54, 0.16],
		[261.63, 0.74, 0.34],
	];
	for (const [f, s, d] of seq) note(f, t + s, d, "square", 0.3);
	note(130.81, t + 0.74, 0.4, "triangle", 0.34); // low bass under the last note
}

// Short UI blip — menu buttons.
export function sfxBlip() {
	const c = ac();
	if (!c) return;
	note(880, c.currentTime, 0.05, "square", 0.24);
}

// Playful little rising chirp — hovering the homepage boba.
export function sfxBoba() {
	const c = ac();
	if (!c) return;
	const t = c.currentTime;
	note(880.0, t, 0.05, "square", 0.2); // A5
	note(1174.66, t + 0.05, 0.05, "square", 0.2); // D6
	note(1567.98, t + 0.1, 0.09, "square", 0.2); // G6
}

// Resume the AudioContext (call from a user gesture so later hover sounds play).
export function unlockAudio() {
	ac();
}

// ---------------------------------------------------------------------------
// 8-bit theme music — four short chiptune loops that play one after another,
// cycling. Routed through `musicBus -> master`, so the mute toggle (which
// zeroes `master`) silences the music too. Each song's lead loops `reps` times,
// with a bass line auto-looped underneath.
// ---------------------------------------------------------------------------

let musicBus: GainNode | null = null;
let musicOn = false;
let musicTimer: ReturnType<typeof setTimeout> | null = null;
let musicOscs: OscillatorNode[] = [];

// Notified with the song name each time a new song begins (for a "now playing"
// readout). Single listener — one game instance at a time.
let songListener: ((name: string) => void) | null = null;
export function onSongChange(cb: ((name: string) => void) | null) {
	songListener = cb;
}

function ensureMusicBus(): boolean {
	const c = ac();
	if (!c || !master) return false;
	if (!musicBus) {
		musicBus = c.createGain();
		musicBus.gain.value = 0.55; // sit under the SFX
		musicBus.connect(master);
	}
	return true;
}

// MIDI note -> frequency (0 = rest).
const mf = (m: number) => (m <= 0 ? 0 : 440 * Math.pow(2, (m - 69) / 12));

function mnote(freq: number, start: number, dur: number, type: OscillatorType, vol: number) {
	if (!ctx || !musicBus || freq <= 0) return;
	const osc = ctx.createOscillator();
	const g = ctx.createGain();
	osc.type = type;
	osc.frequency.setValueAtTime(freq, start);
	const atk = 0.008;
	const rel = Math.min(0.06, dur * 0.5);
	g.gain.setValueAtTime(0.0001, start);
	g.gain.exponentialRampToValueAtTime(vol, start + atk);
	g.gain.setValueAtTime(vol, start + Math.max(atk, dur - rel));
	g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
	osc.connect(g).connect(musicBus);
	osc.start(start);
	osc.stop(start + dur + 0.02);
	musicOscs.push(osc);
}

type NoteSeq = [number, number][]; // [midiNote (0=rest), beats]
interface Song {
	name: string;
	bpm: number;
	reps: number;
	wave: OscillatorType;
	lead: NoteSeq;
	bass: NoteSeq;
}

const SONGS: Song[] = [
	{
		name: "HEYYYYYTEA",
		bpm: 144, reps: 2, wave: "square",
		lead: [
			[72,.5],[76,.5],[79,.5],[84,.5],[83,.5],[79,.5],[76,.5],[79,.5],
			[77,.5],[74,.5],[77,.5],[81,.5],[79,.5],[76,.5],[72,.5],[74,.5],
			[76,.5],[79,.5],[84,.5],[86,.5],[84,.5],[81,.5],[79,.5],[76,.5],
			[72,1],[74,1],[76,1],[72,1],
		],
		bass: [[36,1],[43,1],[41,1],[43,1]],
	},
	{
		// "CHAGEE more like 자기야" — lilting A-minor-pentatonic K-pop feel.
		name: "CHAGEE (자기야)",
		bpm: 128, reps: 2, wave: "triangle",
		lead: [
			[76,.5],[79,.5],[81,1],[79,.5],[76,.5],[74,1],
			[72,.5],[74,.5],[76,1],[74,.5],[72,.5],[69,1],
			[76,.5],[79,.5],[81,.5],[79,.5],[76,.5],[74,.5],[72,1],
			[69,1],[72,1],[69,2],
		],
		bass: [[45,1.5],[40,1.5],[43,1]],
	},
	{
		name: "moge mog",
		bpm: 152, reps: 2, wave: "square",
		lead: [
			[65,.5],[69,.5],[72,.5],[69,.5],[70,.5],[69,.5],[67,.5],[65,.5],
			[67,.5],[70,.5],[74,.5],[70,.5],[72,.5],[70,.5],[69,.5],[67,.5],
			[65,.5],[72,.5],[77,.5],[72,.5],[76,.5],[72,.5],[69,.5],[65,.5],
			[67,1],[65,1],[69,1],[65,1],
		],
		bass: [[41,1],[36,1],[43,1],[36,1]],
	},
	{
		name: "ume zoome",
		bpm: 162, reps: 2, wave: "sawtooth",
		lead: [
			[67,.25],[69,.25],[71,.25],[72,.25],[74,.25],[76,.25],[78,.25],[79,.25],
			[78,.25],[76,.25],[74,.25],[72,.25],[71,.25],[69,.25],[67,.25],[69,.25],
			[71,.25],[72,.25],[74,.25],[76,.25],[78,.25],[79,.25],[81,.25],[83,.25],
			[81,.25],[79,.25],[78,.25],[76,.25],[74,.25],[72,.25],[71,.25],[69,.25],
			[67,.5],[74,.5],[79,.5],[74,.5],[71,.5],[74,.5],[79,.5],[83,.5],
			[79,1],[76,1],[74,1],[67,1],
		],
		bass: [[43,1],[50,1],[48,1],[50,1]],
	},
];

function scheduleVoice(
	notes: NoteSeq,
	t0: number,
	spb: number,
	type: OscillatorType,
	vol: number,
	fillBeats: number,
) {
	if (!notes.length) return;
	let beat = 0;
	let i = 0;
	while (beat < fillBeats - 1e-6) {
		const [m, b] = notes[i % notes.length];
		mnote(mf(m), t0 + beat * spb, b * spb, type, vol);
		beat += b;
		i++;
	}
}

function scheduleSong(i: number, startTime: number) {
	if (!musicOn || !ctx) return;
	const song = SONGS[i];
	songListener?.(song.name);
	const spb = 60 / song.bpm;
	const totalBeats = song.lead.reduce((s, n) => s + n[1], 0) * song.reps;
	musicOscs = []; // prior song's notes are ending — drop their refs
	scheduleVoice(song.lead, startTime, spb, song.wave, 0.2, totalBeats);
	scheduleVoice(song.bass, startTime, spb, "triangle", 0.18, totalBeats);
	const nextStart = startTime + totalBeats * spb;
	// Queue the next song slightly early so the loop is seamless.
	const ms = Math.max(0, (nextStart - ctx.currentTime) * 1000 - 120);
	musicTimer = setTimeout(() => scheduleSong((i + 1) % SONGS.length, nextStart), ms);
}

export function startMusic() {
	if (!ensureMusicBus() || !ctx) return;
	if (musicOn) return;
	musicOn = true;
	scheduleSong(0, ctx.currentTime + 0.15);
}

export function stopMusic() {
	musicOn = false;
	if (musicTimer) {
		clearTimeout(musicTimer);
		musicTimer = null;
	}
	for (const o of musicOscs) {
		try {
			o.stop();
		} catch {
			/* already stopped */
		}
	}
	musicOscs = [];
}
