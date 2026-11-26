import { block, chamfer, cut, ellipse, model, within } from "./stacks/orthographic";

export const mirrorArray = model(33, 29, 18, {
  a: "#586e88", b: "#7691a2", B: "#a3b5b3", c: "#3f526b",
  d: "#524556", g: "#a78064", G: "#e0b47e", w: "#e9cf9f",
}, [
  block(0, 0, 0, 8, 6, 2, ["g", "d", "c"], 4),
  block(0, 0, 2, 5, 4, 2, ["b", "c"], 2),
  block(0, -1, 4, 3, 3, 5, ["g", "c"], 1),
  cut(
    (x, y) => ellipse(x, y, 15.5, 13) ? (x < -3 ? "B" : "b") : "",
    (x, z) => within(z, 8, 14) && Math.abs(x) <= z + 1 ? (z >= 13 ? "b" : "a") : "",
    (x, z) => within(z, 8, 14) && Math.abs(x) <= z + 1 ? (z >= 13 ? "a" : "c") : "",
    (x, z) => within(z, 8, 14) && Math.abs(x) <= z + 1 ? "c" : "",
    (x, y, z) => z <= 9 || !ellipse(x, y, z, z - 2),
  ),
  block(0, 1, 8, 1, 1, 8, ["w", "g"], 1),
  block(0, 1, 16, 2, 2, 2, ["G", "g"], 1),
]);

const planterSize = [7, 7, 7, 8, 8, 8, 9, 9, 9, 10, 10];
export const roofPlanter = model(25, 23, 21, {
  a: "#ad6d50", A: "#d59b71", b: "#7e5642", s: "#563e38",
  g: "#567551", G: "#779a59", l: "#aac478", r: "#be665e", R: "#e49375",
}, [
  cut(
    (x, y) => chamfer(x, y, 10, 8, 3) ? (chamfer(x, y, 7, 5, 3) ? "s" : "A") : "",
    (x, z) => within(z, 0, 10) && Math.abs(x) <= planterSize[z] - 2 ? (z >= 9 || z < 2 ? "b" : "a") : "",
    (x, z) => within(z, 0, 10) && Math.abs(x) <= planterSize[z] ? (z >= 9 ? "A" : "a") : "",
    (x, z) => within(z, 0, 10) && Math.abs(x) <= planterSize[z] ? "b" : "",
    (x, y, z) => z < 7 || !chamfer(x, y, planterSize[z] - 2, planterSize[z] - 4, 2),
  ),
  block(0, 0, 8, 7, 5, 1, ["s", "b"], 3),
  block(-3, -1, 8, 1, 1, 11, ["G", "g"], 1),
  block(4, 2, 8, 1, 1, 10, ["G", "g"], 1),
  block(-5, -1, 14, 4, 2, 2, ["l", "G", "g"], 2),
  block(-2, -3, 17, 3, 2, 2, ["G", "g"], 2),
  block(5, 3, 14, 3, 3, 2, ["G", "g"], 2),
  block(4, 0, 17, 3, 2, 2, ["l", "g"], 2),
  block(-5, -1, 19, 2, 2, 2, ["R", "r"], 2),
  block(5, 1, 18, 2, 2, 2, ["R", "r"], 2),
]);

export const sampleVault = model(29, 23, 19, {
  a: "#777d86", A: "#a5a7a7", b: "#464d65", B: "#5c666f",
  c: "#b57657", C: "#ddaa7a", l: "#eed6a8", m: "#69828d",
}, [
  block(-7, 0, 0, 3, 9, 3, ["B", "b"], 1),
  block(7, 0, 0, 3, 9, 3, ["B", "b"], 1),
  block(0, 0, 2, 12, 8, 4, ["a", "b", "B"], 3),
  block(0, 0, 5, 11, 7, 8, ["A", "a", "B"], 3),
  block(0, 0, 13, 10, 6, 2, ["A", "b", "B"], 2),
  block(-7, 0, 14, 2, 6, 2, ["C", "c"], 1),
  block(7, 0, 14, 2, 6, 2, ["C", "c"], 1),
  block(0, 0, 15, 4, 2, 3, ["l", "c"], 1),
  block(0, 0, 18, 3, 2, 1, ["C", "c"], 1),
  block(0, 7, 6, 5, 0, 5, ["b", "B"], 1),
  block(0, 8, 8, 4, 0, 2, ["m", "m"]),
  block(-3, 8, 8, 1, 0, 2, ["C", "c"]),
  block(8, 7, 5, 2, 1, 6, ["C", "c"], 1),
]);

export const rollerValve = model(25, 25, 19, {
  a: "#a6755e", A: "#d19d73", b: "#6d5251", r: "#a65356", R: "#e48774", m: "#a2a597",
}, [
  block(0, 0, 0, 9, 8, 3, ["A", "a", "b"], 3),
  block(-10, 0, 2, 2, 4, 4, ["A", "b"], 1),
  block(10, 0, 2, 2, 4, 4, ["A", "b"], 1),
  block(0, 0, 3, 6, 5, 5, ["A", "a"], 2),
  block(0, 0, 8, 3, 3, 5, ["m", "b"], 2),
  cut(
    (x, y) => ellipse(x, y, 9.7, 9.7) &&
      (!ellipse(x, y, 7.4, 7.4) || Math.abs(x) <= 1 || Math.abs(y) <= 1)
      ? (y < 1 ? "R" : "r") : "",
    (x, z) => Math.abs(x) <= 9 && within(z, 13, 16) ? "r" : "",
    (x, z) => Math.abs(x) <= 9 && within(z, 13, 16) ? "r" : "",
    (x, z) => Math.abs(x) <= 9 && within(z, 13, 16) ? "b" : "",
  ),
  block(0, 0, 16, 2, 2, 3, ["m", "b"], 2),
]);

export const dockLamp = model(19, 19, 24, {
  a: "#a98660", A: "#cfa77b", b: "#67536a", B: "#807883",
  c: "#b9665b", C: "#e19370", g: "#e2ba80", G: "#f2d7a1",
}, [
  block(0, 0, 0, 6, 6, 2, ["B", "b"], 3),
  block(0, 0, 2, 3, 3, 2, ["A", "a"], 1),
  block(0, 0, 4, 1, 1, 10, ["B", "b"], 1),
  block(0, 0, 13, 5, 5, 3, ["A", "a"], 3),
  block(0, 0, 15, 4, 4, 5, ["G", "g"], 2),
  ...[-3, 3].flatMap((x) => [-3, 3].map((y) => block(x, y, 15, 0, 0, 5, ["A", "a"]))),
  block(0, 0, 20, 6, 6, 1, ["C", "a"], 4),
  block(0, 0, 21, 4, 4, 2, ["C", "c"], 3),
  block(0, 0, 23, 2, 2, 1, ["G", "a"], 2),
]);

export const iceChest = model(29, 23, 15, {
  s: "#536b7a", S: "#83a1a6", b: "#45566a", p: "#dad1b5", P: "#f4e8cd",
  i: "#83b4ba", I: "#a9d2cb", w: "#e3efe1", r: "#b77059",
}, [
  block(0, 0, 0, 11, 8, 4, ["S", "b", "s"], 3),
  cut(
    (x, y) => chamfer(x, y, 13, 9, 3) ? "P" : "",
    (x, z) => Math.abs(x) <= 9 && within(z, 3, 10) ? (z > 8 ? "p" : "s") : "",
    (x, z) => Math.abs(x) <= 13 && within(z, 3, 10) ? (z > 8 ? "P" : "S") : "",
    (x, z) => Math.abs(x) <= 13 && within(z, 3, 10) ? (z > 8 ? "p" : "s") : "",
    (x, y, z) => z < 5 || !chamfer(x, y, 10, 7, 2),
  ),
  block(0, 8, 4, 4, 1, 4, ["p", "s"], 1),
  block(0, 9, 5, 2, 0, 2, ["r", "r"]),
  ...[[-6, 1, 9], [-2, -4, 12], [5, -1, 10], [4, 3, 8], [0, 0, 11]].map(([x, y, z]) =>
    block(x, y, 5, 2, 2, z - 4, [z % 2 ? "I" : "w", "i", "I"], 1)),
  block(0, -8, 11, 11, 1, 4, ["P", "s", "b"], 1),
]);

export const inkStamp = model(25, 21, 20, {
  a: "#a65953", A: "#d7856f", r: "#914b49", b: "#6c524b", g: "#bc946e",
  G: "#deb686", p: "#e9d2b0", s: "#795b60",
}, [
  block(0, 0, 0, 11, 8, 2, ["s", "r", "b"], 2),
  block(0, 0, 2, 12, 9, 3, ["A", "a", "r"], 3),
  block(0, 0, 5, 10, 7, 2, ["G", "g"], 2),
  block(0, 0, 7, 3, 3, 5, ["g", "b"], 2),
  block(0, 0, 12, 5, 4, 2, ["G", "g", "b"], 2),
  block(0, 0, 14, 6, 4, 4, ["G", "g", "b"], 3),
  block(0, 0, 18, 5, 3, 2, ["p", "g"], 3),
  block(-3, 8, 3, 4, 1, 1, ["p", "p"], 1),
]);
