import { BigNumber, Signer } from "ethers";
import hre, { ethers } from "hardhat";

export const duration = {
  seconds: function (val) {
    return ethers.BigNumber.from(val);
  },
  minutes: function (val) {
    return ethers.BigNumber.from(val).mul(this.seconds("60"));
  },
  hours: function (val) {
    return ethers.BigNumber.from(val).mul(this.minutes("60"));
  },
  days: function (val) {
    return ethers.BigNumber.from(val).mul(this.hours("24"));
  },
  weeks: function (val) {
    return ethers.BigNumber.from(val).mul(this.days("7"));
  },
  years: function (val) {
    return ethers.BigNumber.from(val).mul(this.days("365"));
  },
};

export const setBalance = async (
  account: string,
  balance: string
): Promise<void> => {
  await hre.network.provider.send("hardhat_setBalance", [account, balance]);
};

export const impersonateAddress = async (
  address: string,
  setInitialBalance = true
): Promise<Signer> => {
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [address],
  });

  const signer = await ethers.provider.getSigner(address);

  if (setInitialBalance) {
    await setBalance(
      address,
      ethers.utils.hexStripZeros(ethers.constants.WeiPerEther.toHexString())
    );
  }
  return signer;
};

export const restoreSnapshot = async (id: string): Promise<void> => {
  await hre.network.provider.request({
    method: "evm_revert",
    params: [id],
  });
};

export const takeSnapshot = async (): Promise<string> => {
  return (await hre.network.provider.request({
    method: "evm_snapshot",
    params: [],
  })) as Promise<string>;
};

export const useSnapshot = async (id: string): Promise<string> => {
  await restoreSnapshot(id);

  return takeSnapshot();
};

export const increase = async (duration: string | BigNumber) => {
  if (!ethers.BigNumber.isBigNumber(duration)) {
    duration = ethers.BigNumber.from(duration);
  }

  if (duration.isNegative())
    throw Error(`Cannot increase time by a negative amount (${duration})`);

  await hre.network.provider.request({
    method: "evm_increaseTime",
    params: [duration.toNumber()],
  });

  await hre.network.provider.request({
    method: "evm_mine",
  });
};

export const mine = async () => {
  await hre.network.provider.request({
    method: "evm_mine",
    params: [],
  });
};

export const resetForkedChain = async () => {
  const { url, blockNumber, enabled } = hre.config.networks.hardhat.forking;
  await hre.network.provider.request({
    method: "hardhat_reset",
    params: [
      {
        forking: {
          blockNumber,
          enabled,
          jsonRpcUrl: url,
        },
      },
    ],
  });
};

export const setAutomine = async (automine: boolean) => {
  await hre.network.provider.send("evm_setAutomine", [automine]);
};

export const getLatestBlock = async (): Promise<any> => {
  return await hre.network.provider.send("eth_getBlockByNumber", [
    "latest",
    false,
  ]);
};
