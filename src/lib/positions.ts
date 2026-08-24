// The fixed set of staff roles. Staff belong to exactly one, and only see
// shifts posted for that role. Kept in one place so the UI, validation, and
// queries all agree.
export const POSITIONS = ["CNA", "Nurse"] as const;
export type Position = (typeof POSITIONS)[number];

export function isValidPosition(value: unknown): value is Position {
  return typeof value === "string" && (POSITIONS as readonly string[]).includes(value);
}
