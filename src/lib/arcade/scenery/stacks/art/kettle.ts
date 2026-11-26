import { block, cut, ellipse, model, within } from "../orthographic";

const bellyWidth = [6, 8, 9, 10, 10, 10, 10, 10, 10, 9, 9, 8, 7];
const bellyDepth = [5, 6, 7, 8, 8, 8, 8, 8, 8, 8, 7, 7, 6];
const spoutReach = [7, 9, 10, 12, 13, 14, 15, 16, 16];

export const kettle = model(25, 35, 18, {
  A: "#e3a16e", a: "#c2774b", d: "#914d38", H: "#f4c491",
  B: "#613929", L: "#db9e6c", t: "#513630", h: "#805244", n: "#302626",
}, [
  cut(
    (x, y) => ellipse(x, y, 10.5, 8.5) ? (x < -4 && y < 3 ? "H" : "A") : "",
    (x, z) => Math.abs(x) <= bellyDepth[z] ? (z < 2 ? "d" : z < 9 ? "a" : "A") : "",
    (x, z) => Math.abs(x) <= bellyWidth[z] ? (z < 2 ? "d" : z < 8 ? "a" : "A") : "",
    (x, z) => Math.abs(x) <= bellyWidth[z] ? (z < 3 ? "B" : "d") : "",
  ),
  // The handle is a separate profile with an open center and two shoulders.
  cut(
    (x, y) => within(x, -2, 2) && within(y, -16, -6) ? "h" : "",
    (x, z) => {
      const outer = ellipse(x - 10, z - 8, 6.3, 5.7);
      const opening = ellipse(x - 10, z - 8, 3.8, 3.2);
      return outer && !opening ? (x > 12 ? "t" : "h") : "";
    },
    (x, z) => Math.abs(x) <= 2 && within(z, 3, 13) ? "t" : "",
    (x, z) => Math.abs(x) <= 2 && within(z, 3, 13) ? "t" : "",
  ),
  cut(
    (x, y) => within(x, -2, 2) && within(y, 6, 17) ? (y >= 16 && x === 0 ? "n" : "H") : "",
    (x, z) => {
      const reach = spoutReach[z - 5];
      return Math.abs(x + reach) <= 1 ? (z > 10 ? "A" : "a") : "";
    },
    (x, z) => within(z, 5, 13) && Math.abs(x) <= (z > 9 ? 1 : 2) ? "d" : "",
    (x, z) => within(z, 5, 13) && Math.abs(x) <= (z > 9 ? 1 : 2) ? "a" : "",
  ),
  block(0, 0, 12, 7, 6, 2, ["A", "B", "d"], 3),
  block(0, 0, 14, 6, 5, 1, ["H", "a"], 3),
  block(0, -1, 15, 1, 1, 2, ["h", "t"]),
  block(0, -1, 17, 2, 2, 1, ["h", "n"], 1),
]);
