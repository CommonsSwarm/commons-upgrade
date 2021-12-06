import { EVMcrispr } from "@1hive/evmcrispr";
import { Contract } from "@ethersproject/contracts";
import { artifacts } from "hardhat";
import { RESERVE_AGENT_LABEL } from "./scripts/helpers/new-app-labels";
import {
  DAY,
  getAppContract,
  getTimestamp,
  MINUTE,
  pct16,
  ppm,
  toDecimals,
  WEEK,
} from "./test/helpers";

export const GARDEN_DAO_ADDRESS = "0x4ae7b62f1579b4149750a609ef9b830bc72272f8";
export const HATCH_DAO_ADDRESS = "0x4625c2c3E1Bc9323CC1A9dc312F3188e8dE83f42";
export const COLLATERAL_TOKEN_ADDRESS =
  "0xe91d153e0b41518a2ce8dd3d7944fa863463a97d";
export const HATCH_TOKEN_ADDRESS = "0x799844141c2627bd195c89c3a0c71341d0314c55";

// Module 1: Token Freeze & Token Thaw
export const TOKEN_FREEZE = 26 * WEEK;
export const TOKEN_THAW = 77 * WEEK;
export const OPENING_PRICE = toDecimals(1.47);

// Module 2: Augmented Bonding Curve
export const COMMONS_TRIBUTE = pct16(63);
export const ENTRY_TRIBUTE = pct16(3.5);
export const EXIT_TRIBUTE = pct16(3.5);

// Module 3: Tao Voting
export const SUPPORT_REQUIRED = pct16(91);
export const MINIMUM_QUORUM = pct16(7);
export const VOTE_DURATION = 7 * DAY;
export const DELEGATED_VOTING_PERIOD = 4 * DAY;
export const QUIET_ENDING_PERIOD = 3 * DAY;
export const QUIET_ENDING_EXTENSION = 3 * DAY;
export const EXECUTION_DELAY = 1 * DAY;

// Module 4: Conviction Voting
export const CONVICTION_GROWTH = 3 * DAY;
export const MINIMUM_CONVICTION = pct16(4);
export const SPENDING_LIMIT = pct16(4);

// Advanced Settings
export const VIRTUAL_SUPPLY = toDecimals(1);
export const VIRTUAL_BALANCE = toDecimals(1);
export const MINIMUM_EFFECTIVE_SUPPLY = pct16(1);
export const INITIAL_BUY = toDecimals(250_000);

// Computed params (don't touch)
const HATCH_VOTE_DURATION = 5 * MINUTE; // Needed to compute commons DAO token vesting start date
const now = getTimestamp();

export const VESTING_START_DATE =
  now +
  HATCH_VOTE_DURATION +
  VOTE_DURATION +
  DELEGATED_VOTING_PERIOD +
  EXECUTION_DELAY +
  TOKEN_FREEZE;
export const VESTING_CLIFF_PERIOD = 0;
export const VESTING_COMPLETE_PERIOD = TOKEN_THAW;

export const computeReserveRatio = async (commonsEVMcrispr: EVMcrispr) => {
  const reserve = getAppContract(RESERVE_AGENT_LABEL, commonsEVMcrispr);
  const tokenManager = getAppContract(
    "wrappable-hooked-token-manager.open:0",
    commonsEVMcrispr
  );
  const token = new Contract(
    await tokenManager.token(),
    (await artifacts.readArtifact("ERC20")).abi,
    commonsEVMcrispr.signer
  );

  const tokenTotalSupply = await token.totalSupply();
  const reserveBalance = await reserve.balance(COLLATERAL_TOKEN_ADDRESS);
  // Reserve Pool total value (wxDai) / (Total Supply of TEC * Opening Price)
  return reserveBalance
    .mul(ppm(1))
    .mul(toDecimals(1))
    .div(tokenTotalSupply.mul(OPENING_PRICE));
};
