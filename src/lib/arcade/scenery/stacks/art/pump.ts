import { block, chamfer, cut, model, within } from "../orthographic";

const width = [7, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 7, 6, 4, 3];
const depth = [5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 5, 5, 4, 3];

export const pump = model(21, 27, 25, {
  D: "#81482e", d: "#9e5c32", a: "#c47d3c", A: "#e5a75b", H: "#f5ce87", L: "#fae5c1",
  l: "#d7b694", t: "#63837b", n: "#405d55", g: "#f2d5a3",
  r: "#c95850", R: "#eb806c", h: "#f5a38b",
}, [
  cut(
    (x, y) => chamfer(x, y, 8, 6, 2) ? (x <= -4 ? "H" : "A") : "",
    (x, z) => Math.abs(x) <= depth[z] ? (z < 3 ? "D" : z < 13 ? "d" : "A") : "",
    (x, z) => Math.abs(x) <= width[z] ? (z < 3 ? "d" : Math.abs(x - 5) < 2 ? "H" : "a") : "",
    (x, z) => Math.abs(x) <= width[z] ? (z < 3 ? "D" : "d") : "",
  ),
  cut(
    (x, y) => Math.abs(x) <= 5 && within(y, 5, 7) ? "L" : "",
    (x, z) => within(x, -7, -5) && within(z, 5, 12) ? "l" : "",
    (x, z) => {
      if (Math.abs(x) > 5 || !within(z, 5, 12)) return "";
      if (z === 5 || z === 12) return "l";
      if (z === 10 && Math.abs(x) <= 3) return "n";
      if (within(z, 7, 8) && Math.abs(x) <= 2) return "t";
      return "L";
    },
    (x, z) => Math.abs(x) <= 5 && within(z, 5, 12) ? "l" : "",
  ),
  block(0, 0, 18, 4, 4, 3, ["g", "d", "a"], 2),
  block(0, 0, 20, 2, 2, 3, ["R", "r"], 1),
  block(0, 5, 22, 3, 7, 2, ["R", "r"], 2),
  block(0, 2, 24, 3, 3, 1, ["h", "R"], 2),
  block(0, 11, 21, 1, 1, 1, ["r", "D"]),
]);
