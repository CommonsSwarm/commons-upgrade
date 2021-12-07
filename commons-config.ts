import { EVMcrispr } from "@1hive/evmcrispr";
import { Contract } from "@ethersproject/contracts";
import { artifacts } from "hardhat";
import { RESERVE_AGENT_LABEL } from "./scripts/helpers/new-app-labels";
import {
  DAY,
  getAppContract,
  getTimestamp,
  pct16,
  ppm,
  toDecimals,
  WEEK,
} from "./test/helpers";
import {
  garden,
  collateralTokenAddress,
  token,
  abc,
  taoVoting,
  hatch,
  advanced,
} from "./params.json";

export const GARDEN_DAO_ADDRESS = garden.daoAddress;
export const HATCH_DAO_ADDRESS = hatch.daoAddress;
export const COLLATERAL_TOKEN_ADDRESS = collateralTokenAddress;
export const HATCH_TOKEN_ADDRESS = hatch.tokenAddress;

// Module 1: Token Freeze & Token Thaw
export const TOKEN_FREEZE = Math.floor(
  parseFloat(token.tokenFreezeWeeks) * WEEK
);
export const TOKEN_THAW = Math.floor(parseFloat(token.tokenThawWeeks) * WEEK);
export const OPENING_PRICE = toDecimals(token.openingPrice);

// Module 2: Augmented Bonding Curve
export const COMMONS_TRIBUTE = pct16(abc.commonsTribute);
export const ENTRY_TRIBUTE = pct16(abc.entryTribute);
export const EXIT_TRIBUTE = pct16(abc.exitTribute);

// Module 3: Tao Voting
export const VOTE_DURATION = Math.floor(
  parseFloat(taoVoting.voteDurationDays) * DAY
);
export const DELEGATED_VOTING_PERIOD = Math.floor(
  parseFloat(taoVoting.delegatedVotingPeriodDays) * DAY
);
export const EXECUTION_DELAY = Math.floor(
  parseFloat(taoVoting.executionDelayDays) * DAY
);

// Advanced Settings
export const VIRTUAL_SUPPLY = toDecimals(advanced.abc.virtualSupply);
export const VIRTUAL_BALANCE = toDecimals(advanced.abc.virtualBalance);
export const INITIAL_BUY = toDecimals(advanced.abc.initialBuy);

// Computed params (don't touch)
const HATCH_VOTE_DURATION = Math.floor(
  parseFloat(hatch.voteDurationDays) * DAY
); // Needed to compute commons DAO token vesting start date
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
