export interface IRS {
  readonly id: string;
  readonly notionalAmount: number;
  readonly fixedLeg: Leg;
  readonly floatingLeg: Leg;
  // ... other relevant properties like currency, effective date, etc.
}

export interface Leg {
  readonly paymentFrequency: string; // e.g., "Quarterly", "Semi-Annually"
  readonly dayCountConvention: string; // e.g., "30/360", "Actual/365"
  readonly rate: Rate;
  // ... other leg-specific properties like payment dates, accrual periods
}

// Discriminated union for rate types
export type Rate = FixedRate | FloatingRate;

export interface FixedRate {
  readonly type: "Fixed";
  readonly value: number; // The fixed rate percentage
}

export interface FloatingRate {
  readonly type: "Floating";
  readonly index: string; // e.g., "LIBOR", "SOFR"
  readonly spread: number; // Spread over the index, often in basis points or percentage
  // ... other properties like fixing dates, reset frequency
}

export interface EuropeanCallOption {
  readonly id: string;
  readonly underlying: string; // e.g., "AAPL", "EURUSD"
  readonly strike: number;
  readonly expiry: number; // Unix timestamp or Date object
  readonly style: "European";
  // ... other option properties like premium, valuation date
}
