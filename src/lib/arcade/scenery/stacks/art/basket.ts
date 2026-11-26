import { block, chamfer, cut, ellipse, model, within } from "../orthographic";

const widths = [9, 9, 10, 10, 11, 11, 12, 12, 12, 13, 13];
const depths = [5, 5, 6, 6, 7, 7, 8, 8, 8, 9, 9];

function weave(across: number, z: number, edges: number[]) {
  if (!within(z, 0, edges.length - 1) || Math.abs(across) > edges[z]) return "";
  if (z < 2) return "b";
  return (Math.floor(across / 3) + Math.floor(z / 2)) % 2 === 0 ? "w" : "a";
}

export const basket = model(29, 21, 24, {
  b: "#865638", a: "#b77b48", w: "#d49756", W: "#efbd79", s: "#593e31",
  n: "#e85d4c", N: "#f5967f", p: "#f7d1b7",
}, [
  cut(
    (x, y) => chamfer(x, y, 13, 9, 4) ? (chamfer(x, y, 10, 6, 3) ? "s" : (x + y) % 3 ? "W" : "w") : "",
    (x, z) => weave(x, z, depths),
    (x, z) => weave(x, z, widths),
    (x, z) => weave(x, z, widths),
    (x, y, z) => z <= 2 || !chamfer(x, y, widths[z] - 2, depths[z] - 2, 3),
  ),
  cut(
    (x, y) => chamfer(x, y, 14, 10, 4) && !chamfer(x, y, 10, 6, 3) ? ((x + y) % 4 === 0 ? "w" : "W") : "",
    (x, z) => Math.abs(x) <= 10 && within(z, 9, 11) ? "a" : "",
    (x, z) => Math.abs(x) <= 14 && within(z, 9, 11) ? "w" : "",
    (x, z) => Math.abs(x) <= 14 && within(z, 9, 11) ? "a" : "",
  ),
  // The front projection of the carry handle is an open arch.
  cut(
    (x, y) => Math.abs(x) <= 12 && within(y, -2, 0) ? "W" : "",
    (x, z) => within(x, 0, 2) && within(z, 10, 23) ? "a" : "",
    (x, z) => within(z, 10, 23) && ellipse(x, z - 10, 12.5, 13.5) && !ellipse(x, z - 10, 9, 10.3)
      ? ((x + z) % 4 === 0 ? "w" : "W") : "",
    (x, z) => within(z, 10, 23) && ellipse(x, z - 10, 12.5, 13.5) ? "a" : "",
  ),
  block(6, 6, 10, 3, 4, 2, ["N", "n"], 2),
  block(6, 9, 6, 3, 1, 5, ["N", "n"], 1),
  block(6, 10, 7, 2, 0, 1, ["p", "p"]),
]);
