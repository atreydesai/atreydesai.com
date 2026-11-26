export interface RecipeRecord {
  best: number;
  count: number;
}

export type RecipeRecords = Record<string, RecipeRecord>;

export const CUP_PRINTS = [
  { id: "house", name: "Shop seal", signatures: 0 },
  { id: "plum", name: "Plum Blossom", signatures: 3 },
  { id: "fern", name: "Garden Fern", signatures: 7 },
  { id: "ferry", name: "Ferry Stamp", signatures: 12 },
] as const;

export type CupPrintId = typeof CUP_PRINTS[number]["id"];

const MAX_RECORDS = 512;
const MAX_SERVES = 9999;
const RECIPE_ID = /^[\p{L}\p{N}][\p{L}\p{M}\p{N} &'’.,()_+\-]{0,119}$/u;

function normalizeRecord(value: unknown): RecipeRecord | null {
  if (!value || typeof value !== "object") return null;
  const { best, count } = value as Partial<RecipeRecord>;
  if (typeof best !== "number" || !Number.isFinite(best) ||
      typeof count !== "number" || !Number.isFinite(count) || count < 1) return null;
  return {
    best: Math.min(100, Math.max(0, Math.floor(best))),
    count: Math.min(MAX_SERVES, Math.floor(count)),
  };
}

export function normalizeRecipeRecords(value: unknown): RecipeRecords {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const records: [string, RecipeRecord][] = [];
  for (const [id, candidate] of Object.entries(value)) {
    if (id !== id.trim() || !RECIPE_ID.test(id) || Object.hasOwn(Object.prototype, id)) continue;
    const record = normalizeRecord(candidate);
    if (!record) continue;
    records.push([id, record]);
    if (records.length === MAX_RECORDS) break;
  }
  return Object.fromEntries(records);
}

export function mergeRecipeRecords(previous: RecipeRecords, earned: RecipeRecords): RecipeRecords {
  const records = new Map(Object.entries(normalizeRecipeRecords(previous)));
  for (const [id, record] of Object.entries(normalizeRecipeRecords(earned))) {
    const existing = records.get(id);
    if (existing) {
      records.set(id, { best: Math.max(existing.best, record.best), count: Math.min(MAX_SERVES, existing.count + record.count) });
    } else if (records.size < MAX_RECORDS) {
      records.set(id, record);
    }
  }
  return Object.fromEntries(records);
}

export function recipeStampCount(record?: RecipeRecord | null): number {
  const valid = normalizeRecord(record);
  if (!valid) return 0;
  if (valid.best >= 97 && valid.count >= 2) return 3;
  return valid.best >= 88 ? 2 : 1;
}

export function signatureCount(records: RecipeRecords): number {
  return Object.values(normalizeRecipeRecords(records)).filter((record) => recipeStampCount(record) === 3).length;
}

export function canUsePrint(id: unknown, records: RecipeRecords): id is CupPrintId {
  const print = CUP_PRINTS.find((entry) => entry.id === id);
  return !!print && (print.signatures === 0 || signatureCount(records) >= print.signatures);
}
