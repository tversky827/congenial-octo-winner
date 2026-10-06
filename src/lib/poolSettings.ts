import { prisma } from "./db";
import { DEFAULT_OVERTIME_RULES, type OvertimeRules } from "./payrollEngine";

// Per-organization configurable business rules. Stored as key → JSON in
// SystemSetting so new rules need no schema change; every getter has a sensible
// default so the app works before anything is configured.

export interface PoolRules {
  overtime: OvertimeRules;
  minRestHours: number;        // minimum rest between a nurse's shifts
  maxHoursPerWeek: number;     // hard cap when claiming
  cancellationWindowHours: number; // how far ahead a nurse may self-cancel
}

export const DEFAULT_POOL_RULES: PoolRules = {
  overtime: DEFAULT_OVERTIME_RULES,
  minRestHours: 8,
  maxHoursPerWeek: 60,
  cancellationWindowHours: 24,
};

export async function getPoolRules(organizationId: string | null): Promise<PoolRules> {
  if (!organizationId) return DEFAULT_POOL_RULES;
  const rows = await prisma.systemSetting.findMany({ where: { organizationId } });
  const map = new Map(rows.map((r) => [r.key, r.value]));

  const parse = <T>(key: string, fallback: T): T => {
    const raw = map.get(key);
    if (raw === undefined) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  };

  return {
    overtime: parse("overtime", DEFAULT_POOL_RULES.overtime),
    minRestHours: parse("minRestHours", DEFAULT_POOL_RULES.minRestHours),
    maxHoursPerWeek: parse("maxHoursPerWeek", DEFAULT_POOL_RULES.maxHoursPerWeek),
    cancellationWindowHours: parse("cancellationWindowHours", DEFAULT_POOL_RULES.cancellationWindowHours),
  };
}

export async function setPoolRule(organizationId: string, key: string, value: unknown): Promise<void> {
  await prisma.systemSetting.upsert({
    where: { organizationId_key: { organizationId, key } },
    update: { value: JSON.stringify(value) },
    create: { organizationId, key, value: JSON.stringify(value) },
  });
}
