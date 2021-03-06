import { Address } from "@1hive/evmcrispr";
import { BigNumber } from "@ethersproject/bignumber";
import { Contract, ContractReceipt } from "@ethersproject/contracts";
import { addressesEqual } from ".";
import { ERC20 } from "../../typechain";
import {
  HATCH_TOKEN,
  HATCH_TOKEN_HOLDERS,
} from "../fixtures/hatch-token-holders";

const MM_TOKEN_VERSION = "MMT_0.1";

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
): Promise<{ address: string; value: string }[]> => {
  if (addressesEqual(token, HATCH_TOKEN)) {
    return new Promise((resolve) => {
      resolve(HATCH_TOKEN_HOLDERS);
    });
  }

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

export const isMiniMeToken = async (token: Contract): Promise<boolean> => {
  try {
    const version = await token.version();
    return version === MM_TOKEN_VERSION;
  } catch (err) {
    return false;
  }
};
