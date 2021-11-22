import { Address } from "@1hive/evmcrispr";
import { BigNumber } from "@ethersproject/bignumber";
import { ContractReceipt } from "@ethersproject/contracts";
import { ERC20 } from "../../typechain";

export const approveTokenAmount = async (
  token: ERC20,
  owner: Address,
  spender: Address,
  amount: BigNumber
): Promise<ContractReceipt | null> => {
  const allowance = await token.allowance(owner, spender);

  if (allowance.lt(amount)) {
    if (!allowance.eq(0)) {
      await (await token.approve(spender, 0)).wait();
    }
    return await (await token.approve(spender, amount)).wait();
  }

  return null;
};

export const getTokenHolders = async (
  token: Address,
  length = 1000
): Promise<{ address: string; value: BigNumber }[]> => {
  return fetch(
    `https://blockscout.com/xdai/mainnet/api?module=token&action=getTokenHolders&contractaddress=${token}&offset=${length}`
  )
    .then((res) => res.json())
    .then((res) =>
      res.result.map((tokenHolder) => ({
        address: tokenHolder.address.toLowerCase(),
        value: tokenHolder.value,
      }))
    );
};
