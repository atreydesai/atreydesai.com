// Sharing a run, the way a word game shares its grid, in two forms a player
// can paste to a friend: a few lines of text that read on their own (the
// game and mode, the score, the run's best stats in words, the game's own
// emoji lines, and a link straight into the game), and a small card image
// drawn by share-card.ts. The text builder is free of the DOM so node tests
// can check it; the clipboard and share-sheet helpers touch the browser only
// when called.

export const SITE = "atreydesai.com";

/** A receipt stat, as the results slip shows it. */
export interface ShareStat {
  label: string;
  value: string | number;
}

export interface ShareInput {
  /** The game's id, for the link into it. */
  gameId: string;
  /** The game's lowercase display name. */
  game: string;
  expert: boolean;
  score: number;
  unit: string;
  newBest: boolean;
  /** The slip's receipt stats; the best few are shared in words. */
  stats: ShareStat[];
  /** The game's emoji lines; empty shares the words alone. */
  lines: string[];
}

/** Stats shared at most: enough to say how the run went, few enough to read. */
export const SHARED_STATS = 3;

/** A link that opens the arcade straight on `gameId` (see the root layout). */
export function playLink(gameId: string) {
  return `${SITE}/?play=${encodeURIComponent(gameId)}`;
}

/** A figure as it reads in a sentence: thousands grouped, words untouched. */
export function figure(value: string | number) {
  return typeof value === "number" ? value.toLocaleString("en-US") : value;
}

/**
 * The stats worth telling a friend: not the personal best (it means nothing
 * to them), not one that repeats the score (cup stack's "cups stacked"), and
 * nothing that came to zero.
 */
export function sharedStats(stats: ShareStat[], score: number, unit: string, limit = SHARED_STATS) {
  const noun = unit.replace(/s$/, "");
  const useful = stats.filter(
    ({ label, value }) =>
      label !== "personal best" && !(value === score && noun && label.includes(noun)),
  );
  return useful.filter(({ value }) => !isNothing(value)).slice(0, limit);
}

/** A stat with nothing in it: zero, "×0", "0 m", a dash, blank. */
function isNothing(value: string | number) {
  return typeof value === "number" ? value === 0 : !/[1-9]/.test(value);
}

/** The unit as it goes with this score: "1 cup", "38 cups". */
export function unitFor(score: number, unit: string) {
  return score === 1 ? unit.replace(/s$/, "") : unit;
}

/** The score as a sentence's subject: "38 cups", "1,240 points, a new best". */
export function scoreLine(score: number, unit: string, newBest: boolean) {
  return `${figure(score)} ${unitFor(score, unit)}${newBest ? ", a new best" : ""}`;
}

/** The text a run shares, ready to paste. */
export function shareText(input: ShareInput) {
  const title = `🧋 ${input.game}${input.expert ? " (expert)" : ""}`;
  const stats = sharedStats(input.stats, input.score, input.unit).map(
    ({ label, value }) => `${label}: ${figure(value)}`,
  );
  const body = input.lines.map((line) => line.trim()).filter(Boolean);
  return [
    title,
    scoreLine(input.score, input.unit, input.newBest),
    ...stats,
    ...(body.length ? ["", ...body] : []),
    "",
    playLink(input.gameId),
  ].join("\n");
}

/**
 * Emoji `cells` wrapped every `width`, at most `maxRows` rows, so a long run
 * still pastes as a tidy block. Shared by the games that share a sequence.
 */
export function emojiRows(cells: string[], width = 10, maxRows = 4): string[] {
  const rows: string[] = [];
  for (let index = 0; index < cells.length && rows.length < maxRows; index += width) {
    rows.push(cells.slice(index, index + width).join(""));
  }
  if (cells.length > width * maxRows) rows[rows.length - 1] += "…";
  return rows;
}

// --- The browser side ------------------------------------------------------------

export type ShareOutcome = "" | "copied" | "shared" | "failed";

/** Copies `text`, with an old-browser fallback. */
export async function copyText(text: string): Promise<ShareOutcome> {
  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    // Older browsers, or a clipboard the page may not write to.
  }
  try {
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.append(field);
    field.select();
    const copied = document.execCommand("copy");
    field.remove();
    return copied ? "copied" : "failed";
  } catch {
    return "failed";
  }
}

/** This browser can put an image on the clipboard. */
export function canCopyImage() {
  return (
    typeof window !== "undefined" &&
    typeof ClipboardItem !== "undefined" &&
    typeof navigator.clipboard?.write === "function"
  );
}

/**
 * Copies the card image. `png` is handed to the clipboard as a promise, so
 * the write starts inside the click even while the image is still being
 * drawn (Safari refuses a write that starts after an await).
 */
export async function copyImage(png: Promise<Blob>): Promise<ShareOutcome> {
  if (!canCopyImage()) return "failed";
  try {
    await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
    return "copied";
  } catch {
    return "failed";
  }
}

/** This device has a share sheet that takes image files (phones, mostly). */
export function canShareFile(file: File | null) {
  if (!file || typeof navigator === "undefined" || typeof navigator.share !== "function") return false;
  const coarse = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
  try {
    return coarse && !!navigator.canShare?.({ files: [file] });
  } catch {
    return false;
  }
}

/** Opens the share sheet with the card and the text beside it. */
export async function shareFile(file: File, text: string): Promise<ShareOutcome> {
  try {
    await navigator.share({ files: [file], text });
    return "shared";
  } catch (error) {
    // Dismissing the sheet is not a failure, and leaves nothing to say.
    if (error instanceof DOMException && error.name === "AbortError") return "";
    return "failed";
  }
}
