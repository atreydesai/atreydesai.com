<script lang="ts">
  let { text, cells = 2 }: { text: string; cells?: number } = $props();

  // Hand-set 5 × 7 pixels for painted signs and the counter's readouts.
  const glyphs: Record<string, number[]> = {
    A: [14, 17, 17, 31, 17, 17, 17], B: [30, 17, 17, 30, 17, 17, 30],
    C: [14, 17, 16, 16, 16, 17, 14], D: [30, 17, 17, 17, 17, 17, 30],
    E: [31, 16, 16, 30, 16, 16, 31], F: [31, 16, 16, 30, 16, 16, 16],
    G: [14, 17, 16, 23, 17, 17, 15], H: [17, 17, 17, 31, 17, 17, 17],
    I: [31, 4, 4, 4, 4, 4, 31], J: [7, 2, 2, 2, 18, 18, 12],
    K: [17, 18, 20, 24, 20, 18, 17], L: [16, 16, 16, 16, 16, 16, 31],
    M: [17, 27, 21, 21, 17, 17, 17], N: [17, 25, 21, 19, 17, 17, 17],
    O: [14, 17, 17, 17, 17, 17, 14], P: [30, 17, 17, 30, 16, 16, 16],
    Q: [14, 17, 17, 17, 21, 18, 13], R: [30, 17, 17, 30, 20, 18, 17],
    S: [15, 16, 16, 14, 1, 1, 30], T: [31, 4, 4, 4, 4, 4, 4],
    U: [17, 17, 17, 17, 17, 17, 14], V: [17, 17, 17, 17, 17, 10, 4],
    W: [17, 17, 17, 21, 21, 27, 17], X: [17, 17, 10, 4, 10, 17, 17],
    Y: [17, 17, 10, 4, 4, 4, 4], Z: [31, 1, 2, 4, 8, 16, 31],
    "0": [14, 17, 19, 21, 25, 17, 14], "1": [4, 12, 4, 4, 4, 4, 14],
    "2": [14, 17, 1, 2, 4, 8, 31], "3": [30, 1, 1, 14, 1, 1, 30],
    "4": [2, 6, 10, 18, 31, 2, 2], "5": [31, 16, 16, 30, 1, 1, 30],
    "6": [14, 16, 16, 30, 17, 17, 14], "7": [31, 1, 2, 4, 8, 8, 8],
    "8": [14, 17, 17, 14, 17, 17, 14], "9": [14, 17, 17, 15, 1, 1, 14],
    ":": [0, 4, 4, 0, 4, 4, 0], ".": [0, 0, 0, 0, 0, 0, 4],
    "$": [4, 15, 20, 14, 5, 30, 4], "·": [0, 0, 0, 4, 0, 0, 0],
  };

  const width = $derived(Math.max(1, text.length * 6 - 1));
  const ink = $derived(Array.from(text.toUpperCase(), (letter, index) =>
    (glyphs[letter] ?? []).map((row, y) =>
      Array.from({ length: 5 }, (_, x) => row & (16 >> x) ? "M" + (index * 6 + x) + " " + y + "h1v1h-1z" : "").join(""),
    ).join(""),
  ).join(""));
</script>

<svg class="order-pixel-word" aria-hidden="true" focusable="false" shape-rendering="crispEdges"
  viewBox="0 0 {width} 7" width={width * cells} height={7 * cells}>
  <path d={ink} fill="currentColor" />
</svg>

<style>
  .order-pixel-word {
    display: inline-block;
    flex: none;
    max-width: 100%;
    vertical-align: middle;
  }
</style>
