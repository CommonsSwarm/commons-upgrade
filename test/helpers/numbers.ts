import { utils } from "ethers";
import { BigNumber } from "@ethersproject/bignumber";

export const toDecimals = (amount, decimals = 18) => {
  const [integer, decimal] = String(amount).split(".");
  return BigNumber.from(
    (integer != "0" ? integer : "") + (decimal || "").padEnd(decimals, "0")
  );
};

export const pct16 = (x: number | string) => toDecimals(x, 16);

export const ppm = (x: number | string): number => Number(x) * 1e6;

export const PCT_BASE = pct16(100);
