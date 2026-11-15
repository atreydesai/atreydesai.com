// Sharing a run, the way a word game shares its grid: a few short lines a
// player can paste to a friend. The game's name and mode, the score, the
// game's own emoji lines (what happened, at a glance), and where to play.

const SITE = "atreydesai.com";

interface ShareInput {
  /** The game's lowercase display name. */
  game: string;
  expert: boolean;
  score: number;
  unit: string;
  /** The game's emoji lines; empty shares the score alone. */
  lines: string[];
}

/** The text a run shares, ready to paste. */
export function shareText({ game, expert, score, unit, lines }: ShareInput) {
  const title = `🧋 ${game}${expert ? " (expert)" : ""}`;
  const figure = `${score.toLocaleString("en-US")} ${unit}`;
  const body = lines.map((line) => line.trim()).filter(Boolean);
  return [title, figure, ...(body.length ? ["", ...body] : []), "", SITE].join("\n");
}

/**
 * Shares `text`: the system share sheet on a phone (where pasting into a
 * chat is what people do), the clipboard everywhere else. Resolves to what
 * happened, so the button can say so.
 */
export async function shareRun(text: string): Promise<"" | "copied" | "shared" | "failed"> {
  const coarse = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
  if (coarse && typeof navigator.share === "function") {
    try {
      await navigator.share({ text });
      return "shared";
    } catch (error) {
      // Dismissing the sheet is not a failure, and leaves nothing to say.
      if (error instanceof DOMException && error.name === "AbortError") return "";
    }
  }
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
