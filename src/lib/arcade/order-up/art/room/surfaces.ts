/**
 * The big flat surfaces of a room (floors, walls, the ground outside) as
 * pixel shaders: a function from a position to one of a few palette slots.
 * The baker lights each slot once per light step (in shade, in a sun patch,
 * under a lamp) and writes words straight into the pixel buffer, so a whole
 * floor with its sun patches and lamp pools costs a few milliseconds.
 */
import { noise } from "../../../core/painter.ts";

/** A surface: its base colours, and which one sits at a position. */
export interface Surface {
  colors: readonly string[];
  /** u, v in pixels along the surface (floors: tile units × 24 and × 24). Returns a slot in `colors`. */
  at(u: number, v: number): number;
}

const fract = (n: number) => n - Math.floor(n);

/** Square tiles in two tones with a grout line. */
export function checker(a: string, b: string, grout: string, size = 24): Surface {
  return {
    colors: [a, b, grout],
    at(u, v) {
      const cu = Math.floor(u / size);
      const cv = Math.floor(v / size);
      if (fract(u / size) * size < 1 || fract(v / size) * size < 1) return 2;
      return (cu + cv) & 1;
    },
  };
}

/** Boards running along u, staggered ends, a little grain. */
export function planks(base: string, alt: string, seam: string, grain: string, width = 8, length = 48): Surface {
  return {
    colors: [base, alt, seam, grain],
    at(u, v) {
      const row = Math.floor(v / width);
      if (fract(v / width) * width < 1) return 2;
      const offset = noise(row, 3, 11) * length;
      const along = u + offset;
      if (fract(along / length) * length < 1) return 2;
      const board = Math.floor(along / length);
      const n = noise(Math.floor(along / 3), row, 5);
      if (n > 0.93) return 3;
      return noise(board, row, 7) > 0.6 ? 1 : 0;
    },
  };
}

/** Herringbone parquet. */
export function herringbone(base: string, alt: string, seam: string, w = 6, l = 18): Surface {
  return {
    colors: [base, alt, seam],
    at(u, v) {
      const band = Math.floor((u + v) / l);
      const flip = band & 1;
      const a = flip ? u : v;
      const b = flip ? v : u;
      if (fract((a + band * 3) / w) * w < 1) return 2;
      if (fract((a + b) / l) * l < 1) return 2;
      return flip ? 1 : 0;
    },
  };
}

/** Stone flags or terrazzo: big irregular slabs, specks. */
export function stone(base: string, alt: string, seam: string, speck: string, size = 22): Surface {
  return {
    colors: [base, alt, seam, speck],
    at(u, v) {
      const row = Math.floor(v / size);
      const off = (row & 1) * size * 0.5;
      const cu = Math.floor((u + off) / size);
      if (fract(v / size) * size < 1 || fract((u + off) / size) * size < 1) return 2;
      if (noise(Math.floor(u), Math.floor(v), 9) > 0.965) return 3;
      return noise(cu, row, 4) > 0.55 ? 1 : 0;
    },
  };
}

/** Poured concrete: soft blotches, expansion joints, specks. */
export function concrete(base: string, alt: string, seam: string, speck: string, joint = 72): Surface {
  return {
    colors: [base, alt, seam, speck],
    at(u, v) {
      if (fract(u / joint) * joint < 1 || fract(v / joint) * joint < 1) return 2;
      if (noise(Math.floor(u), Math.floor(v), 13) > 0.975) return 3;
      return noise(Math.floor(u / 9), Math.floor(v / 7), 2) > 0.62 ? 1 : 0;
    },
  };
}

/** Metal deck grating. */
export function grating(base: string, hole: string, rim: string): Surface {
  return {
    colors: [base, hole, rim],
    at(u, v) {
      const a = Math.floor(u) % 6;
      const b = Math.floor(v) % 6;
      if (a === 0 || b === 0) return 2;
      return (a + b) % 4 === 1 ? 1 : 0;
    },
  };
}

/** Running-bond brick, 8 by 4, z up from the floor. */
export function brick(base: string, alt: string, mortar: string, w = 8, h = 4): Surface {
  return {
    colors: [base, alt, mortar],
    at(u, z) {
      const course = Math.floor(z / h);
      if (fract(z / h) * h < 1) return 2;
      const along = u + (course & 1) * (w / 2);
      if (fract(along / w) * w < 1) return 2;
      return noise(Math.floor(along / w), course, 21) > 0.7 ? 1 : 0;
    },
  };
}

/** Glazed tiles (subway or square) with grout. */
export function tiles(base: string, alt: string, grout: string, w = 6, h = 3, stagger = true): Surface {
  return {
    colors: [base, alt, grout],
    at(u, z) {
      const course = Math.floor(z / h);
      if (fract(z / h) * h < 1) return 2;
      const along = u + (stagger && course & 1 ? w / 2 : 0);
      if (fract(along / w) * w < 1) return 2;
      return noise(Math.floor(along / w), course, 17) > 0.82 ? 1 : 0;
    },
  };
}

/** Vertical boards (panelling, a shack, the side of a truck). */
export function boards(base: string, alt: string, seam: string, w = 6): Surface {
  return {
    colors: [base, alt, seam],
    at(u) {
      if (fract(u / w) * w < 1) return 2;
      return noise(Math.floor(u / w), 0, 31) > 0.55 ? 1 : 0;
    },
  };
}

/** Round logs laid along the wall. */
export function logs(base: string, light: string, dark: string, h = 7): Surface {
  return {
    colors: [base, light, dark],
    at(u, z) {
      const y = fract(z / h) * h;
      if (y < 1.2) return 2;
      if (y > h - 2.2) return 1;
      return noise(Math.floor(u / 5), Math.floor(z / h), 3) > 0.92 ? 2 : 0;
    },
  };
}

/** Plaster, faintly mottled. */
export function plaster(base: string, alt: string): Surface {
  return {
    colors: [base, alt],
    at(u, z) {
      return noise(Math.floor(u / 3), Math.floor(z / 2), 41) > 0.86 ? 1 : 0;
    },
  };
}

/** Corrugated metal, ribs along z. */
export function corrugated(base: string, light: string, dark: string, pitch = 4): Surface {
  return {
    colors: [base, light, dark],
    at(u) {
      const x = Math.floor(u) % pitch;
      return x === 0 ? 1 : x === pitch - 1 ? 2 : 0;
    },
  };
}

/** Riveted panels (a habitat, a train). */
export function panels(base: string, alt: string, seam: string, rivet: string, w = 20, h = 18): Surface {
  return {
    colors: [base, alt, seam, rivet],
    at(u, z) {
      const a = fract(u / w) * w;
      const b = fract(z / h) * h;
      if (a < 1 || b < 1) return 2;
      if ((Math.round(a) === 3 || Math.round(a) === w - 3) && (Math.round(b) === 3 || Math.round(b) === h - 3)) return 3;
      return Math.floor(u / w) & 1 ? 1 : 0;
    },
  };
}

/** Shiplap: horizontal boards. */
export function shiplap(base: string, alt: string, seam: string, h = 5): Surface {
  return {
    colors: [base, alt, seam],
    at(u, z) {
      if (fract(z / h) * h < 1) return 2;
      return noise(Math.floor(z / h), Math.floor(u / 40), 9) > 0.6 ? 1 : 0;
    },
  };
}

/** Rough ground outside: asphalt, sand, grass, snow, regolith. */
export function ground(base: string, alt: string, speck: string, grain = 0.06, seed = 1): Surface {
  return {
    colors: [base, alt, speck],
    at(u, v) {
      const n = noise(Math.floor(u), Math.floor(v), seed);
      if (n > 1 - grain) return 2;
      return noise(Math.floor(u / 6), Math.floor(v / 4), seed + 1) > 0.6 ? 1 : 0;
    },
  };
}
