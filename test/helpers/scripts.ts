import { ActionFunction, normalizeActions } from "@1hive/evmcrispr";
import {
  TransactionReceipt,
  TransactionResponse,
} from "@ethersproject/abstract-provider";
import { Signer } from "ethers";
import { MAX_TX_GAS_LIMIT } from "./web3";

export const executeActions = async (
  actionFns: ActionFunction[],
  executorSigner: Signer
): Promise<TransactionReceipt[]> => {
  const actions = await normalizeActions(actionFns);

  const txResponses: TransactionResponse[] = await Promise.all(
    actions.map((action) => {
      return executorSigner.sendTransaction({
        ...action,
        gasLimit: MAX_TX_GAS_LIMIT,
      });
    })
  );

  return Promise.all(txResponses.map((txResponse) => txResponse.wait()));
};
