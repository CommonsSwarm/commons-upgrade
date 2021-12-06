import { ActionFunction, EVMcrispr, normalizeActions } from "@1hive/evmcrispr";
import { Signer } from "@ethersproject/abstract-signer";
import { isAddress } from "@ethersproject/address";
import { Contract } from "@ethersproject/contracts";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import hre from "hardhat";
import { MAX_TX_GAS_LIMIT } from ".";

const isSpecialEntity = (entity: string): boolean => {
  switch (entity) {
    case "ANY_ENTITY":
    case "BURN_ENTITY":
    case "NO_ENTITY":
      return true;
    default:
      return false;
  }
};

export const executeActions = async (
  actionFns: ActionFunction[],
  executorSigner: Signer
): Promise<void> => {
  const actions = await normalizeActions(actionFns)();

  await Promise.all(
    actions.map((action) => {
      return executorSigner.sendTransaction({
        ...action,
        gasLimit: MAX_TX_GAS_LIMIT,
      });
    })
  );
};

export const getAppContract = (
  appLabel: string,
  evmcrispr: EVMcrispr,
  signer?: any
) => {
  const app = evmcrispr.appCache.get(appLabel);

  if (!app) {
    throw new Error(
      `Can't instantiate contract of app ${appLabel} as it doesn't exists in DAO ${evmcrispr.app(
        "kernel"
      )}`
    );
  }

  return new Contract(
    app.address,
    app.abiInterface,
    signer ?? evmcrispr.signer
  );
};

/**
 * Override some of the methods in order for the evmcrispr to work in test networks
 * @param signer Signer to be used by the evmcrispr
 * @returns Updated signer
 */
export const prepareEVMcrisprSigner = (
  signer: SignerWithAddress
): SignerWithAddress => {
  signer.getChainId = async () => hre.network.config.chainId;

  return signer;
};

export const resolveEntity = (entity: string, evmcrispr: EVMcrispr): string => {
  if (isSpecialEntity(entity)) {
    return evmcrispr[entity];
  } else if (isAddress(entity)) {
    return entity;
  } else {
    return evmcrispr.app(entity);
  }
};
