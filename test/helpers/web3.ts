import { TransactionResponse } from "@ethersproject/abstract-provider";
import { getLatestBlock, mine, setAutomine } from "../../helpers/rpc";

export const MAX_TX_GAS_LIMIT = 10_000_000;
export const MAX_TX_GAS_PRICE = 10_000_000_000;

/**
 * Mine the maximum number of transactions possible per block
 * instead of one per
 * @param txs Transactions to be mined
 */
export const mineTxs = async (
  txs: Promise<TransactionResponse>[]
): Promise<void> => {
  // Disable automine so resolved transactions are sent to the mempool
  await setAutomine(false);

  await Promise.all(txs);

  const txCounter = txs.length;
  let i = 0;

  // Mine the maximum number of transactions possible
  do {
    await mine();
    const latestBlock = await getLatestBlock();
    i += latestBlock.transactions.length;
    console.log(`${i} txs of ${txCounter} mined`);
  } while (i < txCounter);

  await setAutomine(true);
};
