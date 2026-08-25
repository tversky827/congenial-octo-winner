// Simple plan/billing math for the platform (super-admin) view. Pure +
// testable. These are illustrative list prices — a real billing integration
// would replace them, but the shape (per-facility + per-seat) is standard SaaS.

export const PRICE_PER_FACILITY = 299; // $/facility/month
export const PRICE_PER_SEAT = 4; // $/active user/month

export interface PlanInputs {
  facilities: number;
  seats: number; // active users
}

export interface PlanEstimate {
  facilities: number;
  seats: number;
  facilityCost: number;
  seatCost: number;
  monthlyTotal: number;
}

export function estimateMonthly(
  { facilities, seats }: PlanInputs,
  pricePerFacility = PRICE_PER_FACILITY,
  pricePerSeat = PRICE_PER_SEAT
): PlanEstimate {
  const facilityCost = Math.max(0, facilities) * pricePerFacility;
  const seatCost = Math.max(0, seats) * pricePerSeat;
  return {
    facilities,
    seats,
    facilityCost,
    seatCost,
    monthlyTotal: facilityCost + seatCost,
  };
}
