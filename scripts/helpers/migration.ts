import { ActionFunction, Address, EVMcrispr } from "@1hive/evmcrispr";
import { TransactionResponse } from "@ethersproject/abstract-provider";
import { Signer } from "@ethersproject/abstract-signer";
import { BigNumber } from "@ethersproject/bignumber";
import { Overrides } from "@ethersproject/contracts";
import { getAppContract } from "../../test/helpers";

export const HOLDERS_PROCESSED_PER_TRANSACTION = 10;

export const buildMigrationAction = async (
  hatchEVMcrispr: EVMcrispr,
  commonsEVMcrispr: EVMcrispr,
  newVault1Pct: BigNumber,
  vestingStartDate: number,
  vestingCliffPeriod: number,
  vestingCompletePeriod: number,
  signer: Signer
): Promise<ActionFunction[]> => {
  const hatch = await getAppContract(
    "marketplace-hatch.open:0",
    hatchEVMcrispr,
    signer
  );
  const vaultTokenAddress = await hatch.contributionToken();

  return [
    hatchEVMcrispr
      .call("migration-tools-beta.open")
      .migrate(
        commonsEVMcrispr.app("migration-tools.open:mtb"),
        commonsEVMcrispr.app("agent:1"),
        commonsEVMcrispr.app("agent:reserve"),
        vaultTokenAddress,
        newVault1Pct,
        vestingStartDate,
        vestingCliffPeriod,
        vestingCompletePeriod
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
  const total = Math.ceil(
    tokenHolders.length / HOLDERS_PROCESSED_PER_TRANSACTION
  );
  let counter = 1;
  let tx: TransactionResponse;

  for (
    let i = 0;
    i < tokenHolders.length;
    i += HOLDERS_PROCESSED_PER_TRANSACTION
  ) {
    try {
      await claimFunction(
        tokenHolders.slice(i, i + HOLDERS_PROCESSED_PER_TRANSACTION),
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
            i + HOLDERS_PROCESSED_PER_TRANSACTION,
            tokenHolders.length
          )}.`,
          10
        );
      }
    } catch (e) {
      console.error(e);
      return false;
    }
  }
  return true;
};
