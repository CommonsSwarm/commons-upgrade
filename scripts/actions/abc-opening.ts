import { ActionFunction, EVMcrispr } from "@1hive/evmcrispr";
import { BigNumber } from "@ethersproject/bignumber";
import {
  COLLATERAL_TOKEN_ADDRESS,
  computeReserveRatio,
  INITIAL_BUY,
  VIRTUAL_BALANCE,
  VIRTUAL_SUPPLY,
} from "../../commons-config";
import { ABC_LABEL, COMMONS_POOL_AGENT_LABEL } from "../helpers/new-app-labels";

export const buildABCSetUpActions = async (
  commonsEVMcrispr: EVMcrispr,
  expectedInitialBuyReturnAmount = BigNumber.from(0)
): Promise<ActionFunction[]> => {
  const actionFns = [
    commonsEVMcrispr
      .exec(ABC_LABEL)
      .addCollateralToken(
        COLLATERAL_TOKEN_ADDRESS,
        VIRTUAL_SUPPLY,
        VIRTUAL_BALANCE,
        await computeReserveRatio(commonsEVMcrispr)
      ),
    commonsEVMcrispr.act(
      COMMONS_POOL_AGENT_LABEL,
      COLLATERAL_TOKEN_ADDRESS,
      "approve(address,uint256)",
      [ABC_LABEL, INITIAL_BUY]
    ),
    commonsEVMcrispr.act(
      COMMONS_POOL_AGENT_LABEL,
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
