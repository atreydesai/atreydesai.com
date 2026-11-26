import { block, chamfer, cut, ellipse, model, within } from "../orthographic";

const feet = [[-10, -7], [10, -7], [0, 10]];

export const beacon = model(27, 27, 23, {
  m: "#676b86", M: "#9699a8", d: "#434961", w: "#eee0c7",
  g: "#ffc973", G: "#ffe6ab", a: "#dc8751", b: "#965746", R: "#ea7863", r: "#ad504d",
}, [
  ...feet.flatMap(([x, y]) => [
    block(x, y, 0, 2, 2, 2, ["M", "d", "m"], 1),
    cut(
      (a, b) => within(a, Math.min(x, 0) - 1, Math.max(x, 0) + 1) &&
        within(b, Math.min(y, 0) - 1, Math.max(y, 0) + 1) ? "M" : "",
      (a, z) => within(z, 1, 7) && Math.abs(a + Math.round(y * (1 - z / 9))) <= 1 ? "m" : "",
      (a, z) => within(z, 1, 7) && Math.abs(a + Math.round(x * (1 - z / 9))) <= 1 ? "m" : "",
      (a, z) => within(z, 1, 7) && Math.abs(a - Math.round(x * (1 - z / 9))) <= 1 ? "d" : "",
    ),
  ]),
  block(0, 0, 5, 6, 6, 3, ["M", "d", "m"], 3),
  block(0, 0, 8, 4, 4, 2, ["a", "b"], 2),
  cut(
    (x, y) => ellipse(x, y, 4.7, 4.7) ? (x <= -2 || y <= -2 ? "G" : "g") : "",
    (x, z) => Math.abs(x) <= 4 && within(z, 10, 15) ? (z < 12 ? "a" : "g") : "",
    (x, z) => Math.abs(x) <= 4 && within(z, 10, 15) ? (z < 12 ? "a" : Math.abs(x) < 2 ? "G" : "g") : "",
    (x, z) => Math.abs(x) <= 4 && within(z, 10, 15) ? "a" : "",
  ),
  block(0, 0, 15, 5, 5, 2, ["R", "r"], 3),
  block(0, 0, 17, 3, 3, 1, ["R", "r"], 2),
  block(1, -1, 17, 0, 0, 6, ["w", "M"]),
  block(1, -1, 22, 1, 1, 1, ["w", "M"], 1),
  cut(
    (x, y) => chamfer(x, y, 1, 0, 0) ? "w" : "",
    (x, z) => x === -6 && within(z, 7, 8) ? "m" : "",
    (x, z) => Math.abs(x) <= 1 && within(z, 7, 8) ? "w" : "",
    (x, z) => Math.abs(x) <= 1 && within(z, 7, 8) ? "m" : "",
  ),
]);
