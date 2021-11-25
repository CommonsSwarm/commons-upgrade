import { DAY, getTimestamp, pct16, ppm } from "../helpers";

export const XDAI_GARDENS_DAO_ADDRESS =
  "0x4ae7b62f1579b4149750a609ef9b830bc72272f8";
export const XDAI_HATCH_DAO_ADDRESS =
  "0x4625c2c3E1Bc9323CC1A9dc312F3188e8dE83f42";

// Augmented Bonding Curve params
export const ENTRY_TRIBUTE = pct16(10);
export const EXIT_TRIBUTE = pct16(20);
export const RESERVE_RATIO = ppm(0.01);

// Migration Tools params
export const VAULT1_PCT = pct16(20);
export const VESTING_START_DATE = getTimestamp() + 90 * DAY;
export const VESTING_CLIFF_PERIOD = 0;
export const VESTING_COMPLETE_PERIOD = (365 - 90) * DAY;
