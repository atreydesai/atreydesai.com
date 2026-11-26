import { block, cut, ellipse, model, within } from "../orthographic";

const profile = [5, 6, 6, 6, 7, 7, 7, 7, 8, 8, 8, 9, 9];
const straws = [
  { x: -4, y: -1, leanX: -4, leanY: 3, height: 23, tint: "r" },
  { x: 3, y: 0, leanX: 4, leanY: -3, height: 26, tint: "p" },
  { x: -1, y: -2, leanX: -1, leanY: -4, height: 22, tint: "p" },
  { x: 1, y: 2, leanX: 1, leanY: 4, height: 20, tint: "r" },
  { x: -1, y: 0, leanX: -1, leanY: 0, height: 25, tint: "a" },
];

function wall(x: number, z: number) {
  if (!within(z, 0, profile.length - 1) || Math.abs(x) > profile[z]) return "";
  if (z < 2) return "d";
  return Math.abs(x) % 3 === 0 ? "a" : "c";
}

export const caddy = model(23, 23, 27, {
  h: "#633e3e", d: "#8e514d", c: "#b96156", a: "#e18473",
  w: "#fff0db", i: "#dab3a0", r: "#dc6d60", p: "#ee9db1", n: "#773c52",
}, [
  cut(
    (x, y) => ellipse(x, y, 9.2, 9.2) ? (ellipse(x, y, 7, 7) ? "h" : "i") : "",
    wall, wall, wall,
    (x, y, z) => z < 5 || !ellipse(x, y, profile[z] - 1.5, profile[z] - 1.5),
  ),
  cut(
    (x, y) => ellipse(x, y, 9.4, 9.4) && !ellipse(x, y, 7, 7) ? "w" : "",
    (a, z) => Math.abs(a) <= 9 && within(z, 11, 12) ? "i" : "",
    (a, z) => Math.abs(a) <= 9 && within(z, 11, 12) ? "i" : "",
    (a, z) => Math.abs(a) <= 9 && within(z, 11, 12) ? "i" : "",
  ),
  block(0, 8, 4, 3, 0, 4, ["w", "i"], 1),
  block(0, 9, 5, 1, 0, 2, ["r", "r"]),
  ...straws.map(({ x, y, leanX, leanY, height, tint }) => {
    const tilt = (z: number, lean: number) => Math.round(lean * (z - 5) / (height - 5));
    const shade = (z: number) => (z + x) % 5 > 2 ? "w" : tint;
    return cut(
      (a, b) => Math.abs(a - x) <= Math.abs(leanX) + 1 && Math.abs(b - y) <= Math.abs(leanY) + 1 ? "w" : "",
      (a, z) => within(z, 5, height) && Math.abs(a + y + tilt(z, leanY)) <= 1 ? shade(z) : "",
      (a, z) => within(z, 5, height) && Math.abs(a + x + tilt(z, leanX)) <= 1 ? shade(z) : "",
      (a, z) => within(z, 5, height) && Math.abs(a - x - tilt(z, leanX)) <= 1 ? tint : "",
    );
  }),
]);
