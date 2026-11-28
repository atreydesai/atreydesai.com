import { normalizeExpansion, object } from "./state.ts";
export const SAVE_VERSION = 3 as const;
/** Each step is independent and pure so historic fixtures remain executable. */
export function v1ToV2(value: Record<string, unknown>) {
  return {
    ...value,
    version: 2,
    legacyUnlimitedStock: value.mode === "normal" && value.status === "open",
    migrationFrom: 1,
  };
}
export function v2ToV3(value: Record<string, unknown>) {
  return { ...value, version: 3, expansion: normalizeExpansion(value.expansion, value) };
}
export const MIGRATIONS: Readonly<Record<number, (value: Record<string, unknown>) => Record<string, unknown>>> = {
  1: v1ToV2,
  2: v2ToV3,
};
export function migrateCampaign(value: unknown): Record<string, unknown> | null {
  let current = { ...object(value) };
  if (![1, 2, 3].includes(Number(current.version))) return null;
  while (Number(current.version) < SAVE_VERSION) {
    const step = MIGRATIONS[Number(current.version)];
    if (!step) return null;
    current = step(current);
  }
  return current;
}
/** Existing live services keep their original duration and timers. The legacy shell
 * completes those services; the next opening uses the expanded clock. */
export function migrateEnvelope(value: unknown) {
  const envelope = object(value),
    campaign = migrateCampaign(envelope.campaign);
  if (!campaign) return null;
  return { ...envelope, campaign, shift: envelope.shift ?? null, expandedShift: envelope.expandedShift ?? null };
}
