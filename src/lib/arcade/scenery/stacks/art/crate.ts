import { block, chamfer, cut, model, within } from "../orthographic";

export const crate = model(29, 25, 14, {
  R: "#da9673", r: "#bc7256", B: "#865043", c: "#9e5f4d", D: "#4d4659", d: "#635870",
  H: "#f1c17d", h: "#b98952", p: "#f8e6ce", P: "#c79a79", i: "#7d5d4c",
}, [
  block(-8, 0, 0, 2, 9, 3, ["h", "B"], 1),
  block(8, 0, 0, 2, 9, 3, ["h", "B"], 1),
  cut(
    (x, y) => chamfer(x, y, 13, 11, 2) ? "R" : "",
    (x, z) => Math.abs(x) <= 11 && within(z, 2, 11) ? (z === 5 || z === 9 ? "B" : "c") : "",
    (x, z) => Math.abs(x) <= 13 && within(z, 2, 11) ? (z === 5 || z === 9 ? "c" : "r") : "",
    (x, z) => Math.abs(x) <= 13 && within(z, 2, 11) ? (z === 5 || z === 9 ? "B" : "c") : "",
  ),
  block(0, 0, 11, 13, 11, 2, ["R", "c", "B"], 2),
  ...[-8, 8].flatMap((x) => [
    block(x, 0, 12, 1, 11, 2, ["d", "D"]),
    block(x, 11, 3, 1, 0, 9, ["d", "D"]),
    block(x, -11, 3, 1, 0, 9, ["d", "D"]),
    block(x, 12, 7, 2, 0, 3, ["H", "h"], 1),
  ]),
  cut(
    (x, y) => chamfer(x, y + 1, 5, 4, 1) ? (x < -2 && y < -1 ? "H" : within(y, 0, 1) && within(x, -3, 2) ? "i" : y === 3 && within(x, -3, 3) ? "P" : "p") : "",
    (x, z) => within(x, -3, 5) && z === 13 ? "P" : "",
    (x, z) => Math.abs(x) <= 5 && z === 13 ? "P" : "",
    (x, z) => Math.abs(x) <= 5 && z === 13 ? "P" : "",
  ),
]);
