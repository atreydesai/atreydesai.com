import { block, chamfer, cut, ellipse, model, within } from "../orthographic";

const feet = [[-11, 5], [11, 5], [0, -10]];
const legHeight = 9;

export const beacon = model(31, 27, 27, {
  m: "#757a8b", M: "#afb0ad", d: "#454c63", w: "#dfd1b7",
  g: "#c3a171", G: "#ddbf8c", a: "#aa785f", b: "#6e5557",
  R: "#bf7868", r: "#8f5a56", v: "#627881", V: "#9eaaa2",
}, [
  ...feet.flatMap(([x, y]) => {
    const strut = (at: number, foot: number, z: number) =>
      within(z, 2, legHeight) && Math.abs(at - Math.round(foot * (1 - 0.55 * (z - 2) / (legHeight - 2)))) <= 1;
    return [
      block(x, y, 0, 3, 2, 2, ["M", "d", "m"], 1),
      block(x, y, 2, 1, 1, 2, ["w", "m"], 1),
      cut(
        (a, b) => within(a, Math.min(x, 0) - 1, Math.max(x, 0) + 1) &&
          within(b, Math.min(y, 0) - 1, Math.max(y, 0) + 1) ? "M" : "",
        (a, z) => strut(-a, y, z) ? "m" : "",
        (a, z) => strut(-a, x, z) ? "M" : "",
        (a, z) => strut(a, x, z) ? "d" : "",
      ),
    ];
  }),
  block(0, 0, 7, 6, 5, 2, ["b", "d", "m"], 2),
  block(0, 0, 9, 8, 6, 4, ["M", "d", "m"], 3),
  cut(
    (x, y) => ellipse(x, y, 7.4, 6.4) ? (x <= -2 ? "G" : "g") : "",
    (x, z) => Math.abs(x) <= 6 && within(z, 13, 19) ? (z < 16 ? "a" : "g") : "",
    (x, z) => Math.abs(x) <= 7 && within(z, 13, 19) ? (z < 15 ? "a" : "g") : "",
    (x, z) => Math.abs(x) <= 7 && within(z, 13, 19) ? "b" : "",
  ),
  block(0, 6, 16, 4, 0, 3, ["V", "v"]),
  block(-3, 6, 18, 0, 0, 1, ["V", "V"]),
  block(0, 0, 20, 7, 6, 2, ["R", "r"], 3),
  block(0, 0, 22, 4, 3, 1, ["R", "r"], 2),
  block(-3, -1, 22, 0, 0, 5, ["w", "M"]),
  block(-3, -1, 26, 1, 1, 1, ["w", "M"], 1),
]);
