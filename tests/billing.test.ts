import { describe, it, expect } from "vitest";
import { estimateMonthly, PRICE_PER_FACILITY, PRICE_PER_SEAT } from "@/lib/billing";

describe("estimateMonthly", () => {
  it("charges per facility and per seat", () => {
    const e = estimateMonthly({ facilities: 3, seats: 50 });
    expect(e.facilityCost).toBe(3 * PRICE_PER_FACILITY);
    expect(e.seatCost).toBe(50 * PRICE_PER_SEAT);
    expect(e.monthlyTotal).toBe(3 * PRICE_PER_FACILITY + 50 * PRICE_PER_SEAT);
  });

  it("is zero for an empty org", () => {
    expect(estimateMonthly({ facilities: 0, seats: 0 }).monthlyTotal).toBe(0);
  });

  it("never goes negative", () => {
    expect(estimateMonthly({ facilities: -2, seats: -5 }).monthlyTotal).toBe(0);
  });

  it("honors custom pricing", () => {
    const e = estimateMonthly({ facilities: 2, seats: 10 }, 100, 5);
    expect(e.monthlyTotal).toBe(2 * 100 + 10 * 5);
  });
});
