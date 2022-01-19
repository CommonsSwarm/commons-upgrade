import { ActionFunction, EVMcrispr } from "@1hive/evmcrispr";
import { BigNumber } from "@ethersproject/bignumber";
import {
  COLLATERAL_TOKEN_ADDRESS,
  computeReserveRatio,
  INITIAL_BUY,
  VIRTUAL_BALANCE,
  VIRTUAL_SUPPLY,
} from "../../commons-config";
import {
  ABC_LABEL,
  COMMONS_POOL_AGENT_LABEL,
  ORIGINAL_AGENT_LABEL,
  RESERVE_AGENT_LABEL,
} from "../helpers/new-app-labels";

export const setUpABCActions = async (
  commonsEVMcrispr: EVMcrispr
): Promise<ActionFunction[]> => {
  const actionFns = [
    commonsEVMcrispr.grant(
      ["disputable-voting.open", COMMONS_POOL_AGENT_LABEL, "TRANSFER_ROLE"],
      "disputable-voting.open"
    ),
    commonsEVMcrispr
      .exec(COMMONS_POOL_AGENT_LABEL)
      .transfer(COLLATERAL_TOKEN_ADDRESS, ORIGINAL_AGENT_LABEL, "15000e18"),
    commonsEVMcrispr
      .exec(COMMONS_POOL_AGENT_LABEL)
      .transfer(
        COLLATERAL_TOKEN_ADDRESS,
        RESERVE_AGENT_LABEL,
        String(395357.44 - 393832.93172) + "e18"
      ),
    commonsEVMcrispr
      .exec(ABC_LABEL)
      .addCollateralToken(
        COLLATERAL_TOKEN_ADDRESS,
        VIRTUAL_SUPPLY,
        VIRTUAL_BALANCE,
        await computeReserveRatio(commonsEVMcrispr)
      ),
  ];

  return actionFns;
};

export const initializeABCActions = async (
  commonsEVMcrispr: EVMcrispr,
  expectedInitialBuyReturnAmount = BigNumber.from(0)
): Promise<ActionFunction[]> => {
  const actionFns = [
    commonsEVMcrispr.act(
      ORIGINAL_AGENT_LABEL,
      COLLATERAL_TOKEN_ADDRESS,
      "approve(address,uint256)",
      [ABC_LABEL, INITIAL_BUY]
    ),
    commonsEVMcrispr.act(
      ORIGINAL_AGENT_LABEL,
      ABC_LABEL,
      "makeBuyOrder(address,address,uint256,uint256)",
      [
        COMMONS_POOL_AGENT_LABEL,
        COLLATERAL_TOKEN_ADDRESS,
        INITIAL_BUY,
        expectedInitialBuyReturnAmount,
      ]
    ),
  ];

  return actionFns;
};
