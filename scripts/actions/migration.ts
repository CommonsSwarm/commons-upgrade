import { ActionFunction, EVMcrispr } from "@1hive/evmcrispr";
import { TransactionResponse } from "@ethersproject/abstract-provider";
import { Overrides } from "@ethersproject/contracts";
import {
  COLLATERAL_TOKEN_ADDRESS,
  COMMONS_TRIBUTE,
  INITIAL_BUY,
  VESTING_CLIFF_PERIOD,
  VESTING_COMPLETE_PERIOD,
  VESTING_START_DATE,
} from "../../commons-config";
import {
  COMMONS_POOL_AGENT_LABEL,
  MIGRATION_TOOLS_LABEL,
  RESERVE_AGENT_LABEL,
  ORIGINAL_AGENT_LABEL,
} from "../helpers/new-app-labels";

export const HOLDERS_PER_TRANSACTION = 10;

export const buildMigrationAction = async (
  hatchEVMcrispr: EVMcrispr,
  commonsEVMcrispr: EVMcrispr
): Promise<ActionFunction[]> => {
  return [
    hatchEVMcrispr.grant(["voting", "agent:1", "TRANSFER_ROLE"], "voting"),
    hatchEVMcrispr
      .exec("agent:1")
      .transfer(
        COLLATERAL_TOKEN_ADDRESS,
        commonsEVMcrispr.app(ORIGINAL_AGENT_LABEL),
        INITIAL_BUY
      ),
    hatchEVMcrispr
      .exec("migration-tools-beta.open")
      .migrate(
        commonsEVMcrispr.app(MIGRATION_TOOLS_LABEL),
        commonsEVMcrispr.app(COMMONS_POOL_AGENT_LABEL),
        commonsEVMcrispr.app(RESERVE_AGENT_LABEL),
        COLLATERAL_TOKEN_ADDRESS,
        COMMONS_TRIBUTE,
        VESTING_START_DATE,
        VESTING_CLIFF_PERIOD,
        VESTING_COMPLETE_PERIOD
      ),
  ];
};

export const claimTokens = async (
  claimFunction: Function,
  tokenHolders: string[],
  overrides?: Overrides,
  log?: (message: string, spaces?: number) => void,
  waitForConfirmations = true
): Promise<boolean> => {
  const total = Math.ceil(tokenHolders.length / HOLDERS_PER_TRANSACTION);
  let counter = 1;
  let tx: TransactionResponse;

  for (let i = 0; i < tokenHolders.length; i += HOLDERS_PER_TRANSACTION) {
    try {
      tx = await claimFunction(
        tokenHolders.slice(i, i + HOLDERS_PER_TRANSACTION),
        overrides ?? {}
      );

      if (waitForConfirmations) {
        await tx.wait();
      }

      if (log) {
        log(
          `Tx ${counter++} of ${total}: Claimed for token holders ${
            i + 1
          } to ${Math.min(
            i + HOLDERS_PER_TRANSACTION,
            tokenHolders.length
          )} of a total of ${tokenHolders.length}. Tx hash: ${tx.hash}`
        );
      }
    } catch (e) {
      console.error(e);
      return false;
    }
  }

  return true;
};
