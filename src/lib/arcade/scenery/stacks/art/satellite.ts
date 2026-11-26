import { block, chamfer, cut, ellipse, model, within } from "../orthographic";

export const satellite = model(39, 25, 17, {
  n: "#324761", s: "#455d77", b: "#587d9c", B: "#78a5c0", l: "#a3c3cf",
  d: "#81523a", D: "#a8734d", a: "#d5a66a", A: "#f4cd83", w: "#f9e5b9", r: "#e17963",
}, [
  block(0, 0, 0, 6, 4, 3, ["D", "d"], 2),
  block(0, 0, 2, 7, 5, 5, ["a", "d", "D"], 2),
  block(0, 0, 6, 10, 1, 2, ["l", "s"], 1),
  ...[-13, 13].map((center) => cut(
    (x, y) => {
      const pane = x - center;
      if (!chamfer(pane, y, 6, 5, 1)) return "";
      if (Math.abs(pane) === 6 || Math.abs(y) === 5) return "l";
      if (pane % 4 === 0 || y === 0) return "n";
      return y < 0 ? "B" : "b";
    },
    (x, z) => Math.abs(x) <= 5 && within(z, 5, 7) ? "s" : "",
    (x, z) => Math.abs(x + center) <= 6 && within(z, 5, 7) ? "n" : "",
    (x, z) => Math.abs(x - center) <= 6 && within(z, 5, 7) ? "n" : "",
  )),
  block(0, 2, 7, 2, 2, 2, ["w", "D"], 1),
  // A shallow dish, open above its feed horn.
  cut(
    (x, y) => ellipse(x, y - 2, 7.4, 7.4) ? (x < -2 || y < 0 ? "w" : "A") : "",
    (x, z) => within(z, 9, 13) && Math.abs(x + 2) <= z - 6 ? "a" : "",
    (x, z) => within(z, 9, 13) && Math.abs(x) <= z - 6 ? "a" : "",
    (x, z) => within(z, 9, 13) && Math.abs(x) <= z - 6 ? "D" : "",
    (x, y, z) => z <= 10 || !ellipse(x, y - 2, z - 8, z - 8),
  ),
  block(0, 2, 10, 1, 1, 6, ["w", "a"], 1),
  block(0, 2, 16, 1, 1, 1, ["r", "D"], 1),
]);
