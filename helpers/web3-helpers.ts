import { ethers } from "hardhat";
import { Result } from "@ethersproject/abi";
import { BigNumber } from "@ethersproject/bignumber";
import { Contract, ContractReceipt } from "@ethersproject/contracts";
import { Address } from "hardhat-deploy/dist/types";
import { ERC20 } from "../typechain";

const { utils } = ethers;

export const filterContractEvents = (
  contract: Contract,
  selectedFilter: string,
  transactionHash?: string
): Promise<Result> => {
  return new Promise((resolve, reject) => {
    const filter = contract.filters[selectedFilter];

    if (!filter) {
      reject(new Error(`Selected filter ${selectedFilter} doesn't exists`));
    }

    contract
      .queryFilter(filter())
      .then((events) => {
        if (transactionHash) {
          const filteredEvent = events.filter(
            (event) => event.transactionHash === transactionHash
          );
          resolve(filteredEvent[0]?.args);
        } else {
          resolve(events);
        }
      })
      .catch((err) => reject(err));
  });
};

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

export const toDecimals = (amount, decimals = 18) => {
  const [integer, decimal] = String(amount).split(".");
  return BigNumber.from(
    (integer != "0" ? integer : "") + (decimal || "").padEnd(decimals, "0")
  );
};

export const addressesEqual = (first, second) => {
  first = first && utils.getAddress(first);
  second = second && utils.getAddress(second);
  return first === second;
};
