import { Contract } from "@ethersproject/contracts";
import { utils as ethersUtils } from "ethers";
import { App, Entity, EVMcrispr, LabeledAppIdentifier } from "@1hive/evmcrispr";
import { resolveEntity } from "./evmcrispr";
import { expect } from "chai";
import { addressesEqual, getAppContract } from ".";

export const hasPermission = async (
  evmcrispr: EVMcrispr,
  who: Entity,
  where: Entity,
  what: string,
  how?: string[],
  checkForTrue = true
): Promise<void> => {
  who = resolveEntity(who, evmcrispr);
  where = resolveEntity(where, evmcrispr);
  what = ethersUtils.id(what);

  const acl = getAppContract("acl:0", evmcrispr);
  const hasPermission =
    how && how.length
      ? await acl[`hasPermission(address,address,bytes32,uint256[])`](
          who,
          where,
          what,
          how
        )
      : await acl[`hasPermission(address,address,bytes32)`](who, where, what);

  expect(hasPermission).to.be[checkForTrue ? "true" : "false"];
};

export const isAppInstalled = async (
  evmcrispr: EVMcrispr,
  app: LabeledAppIdentifier,
  expectedKernel: string,
  expectedRepo: string
): Promise<void> => {
  const appContract = getAppContract(app, evmcrispr);
  const appKernelAddress = await appContract.kernel();
  const appId = await appContract.appId();

  expect(addressesEqual(appKernelAddress, expectedKernel)).to.be.true;
  expect(appId).to.be.eq(ethersUtils.namehash(expectedRepo));
};

export const isPermissionManager = async (
  evmcrispr: EVMcrispr,
  manager: Entity,
  app: Entity,
  role: string
) => {
  const acl = getAppContract("acl:0", evmcrispr);
  const permissionManager = await acl["getPermissionManager(address,bytes32)"](
    resolveEntity(app, evmcrispr),
    ethersUtils.id(role)
  );

  expect(addressesEqual(resolveEntity(manager, evmcrispr), permissionManager))
    .to.be.true;
};
