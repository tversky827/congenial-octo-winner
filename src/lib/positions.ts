// Fallback positions used only when an organization hasn't configured its own
// yet. Positions are now per-organization data (see the Position model); the UI
// prefers the org's configured list and falls back to this.
export const POSITIONS = ["CNA", "Nurse"] as const;
export const DEFAULT_POSITIONS: readonly string[] = POSITIONS;
