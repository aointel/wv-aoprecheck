/**
 * State × Hour Performance Matrix
 *
 * Provides dials-per-transfer estimates by state and hour (EST).
 * Used by dial-rate-controller to calculate target dial rates.
 *
 * dialsPerTransfer: how many outbound dials are needed to produce one transfer.
 * Lower = more efficient (fewer dials needed per transfer).
 * Higher = less efficient (need more dials to find a willing transfer).
 *
 * Dead zones: hours when outbound dialing should be minimal (pre-8am, post-9pm EST).
 */

/** Returns current hour in Eastern time (0–23). */
export function currentHourEST(): number {
  const now = new Date();
  // EST = UTC-5, EDT = UTC-4; use fixed offset of -5 (conservative)
  const utcHour = now.getUTCHours();
  const utcMonth = now.getUTCMonth(); // 0-based
  // Rough DST: Mar–Nov = EDT (UTC-4), else EST (UTC-5)
  const isDST = utcMonth >= 2 && utcMonth <= 10;
  const offsetHours = isDST ? -4 : -5;
  return ((utcHour + offsetHours) + 24) % 24;
}

/** True if it's outside calling hours (before 8am or after 9pm EST). */
export function isDeadZone(hourEST: number): boolean {
  return hourEST < 8 || hourEST >= 21;
}

/** Per-hour dial efficiency — how many dials needed per transfer. */
const HOUR_DIALS_PER_TRANSFER: Record<number, number> = {
  8:  28, // 8am  — slow start
  9:  22, // 9am  — ramping up
  10: 18, // 10am — good
  11: 16, // 11am — peak
  12: 20, // 12pm — lunch dip
  13: 18, // 1pm  — good
  14: 17, // 2pm  — peak
  15: 17, // 3pm  — peak
  16: 18, // 4pm  — good
  17: 20, // 5pm  — slight drop
  18: 22, // 6pm  — evening
  19: 25, // 7pm  — slower
  20: 28, // 8pm  — winding down
};

const DEFAULT_DIALS_PER_TRANSFER = 20;

/**
 * State-specific multipliers.
 * Some states are harder to convert (higher dials/transfer).
 * Values > 1.0 = harder state, < 1.0 = easier state.
 */
const STATE_MULTIPLIERS: Record<string, number> = {
  CA: 1.3,
  NY: 1.2,
  FL: 0.95,
  TX: 1.0,
  OH: 0.9,
  PA: 1.05,
  IL: 1.1,
  GA: 0.95,
  NC: 0.95,
  VA: 1.0,
};

export interface StateHourPerf {
  dialsPerTransfer: number;
}

/**
 * Returns the estimated dials-per-transfer for a given state and hour.
 */
export function getStateHourPerf(state: string, hourEST: number): StateHourPerf {
  const baseRate = HOUR_DIALS_PER_TRANSFER[hourEST] ?? DEFAULT_DIALS_PER_TRANSFER;
  const multiplier = STATE_MULTIPLIERS[state.toUpperCase()] ?? 1.0;
  const dialsPerTransfer = Math.round(baseRate * multiplier);
  return { dialsPerTransfer };
}
