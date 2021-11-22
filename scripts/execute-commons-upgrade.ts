import { ethers } from "hardhat";
import ora from "ora";
import { EVMcrispr } from "@1hive/evmcrispr";
import {
  buildGardenContext,
  signAgreement,
  stakeTokens,
  vote,
} from "../helpers/gardens";
import { buildCommonsUpgradeActions } from "./helpers/commons-upgrade";
import { MAX_TX_GAS_LIMIT } from "../test/helpers";

let spinner = ora();

// COMMONS UPGRADE PARAMETERS
const gardensDAOAddress = "0x5672542F00Db5db374c13944C249fE925Aa325A6"; // Gardens DAO to be upgraded.
const collateralTokenAddress = "0xc7ad46e0b8a400bb3c915120d284aafba8fc4735"; // ABC's collateral token (e.g. wxDAI).
const hatchMigrationToolsAddress = "0xbfb0c36ab2daf889e51854e5e65be453251a130d"; // Migration tools app installed on the Hatch.
const entryTribute = "0.1e18"; // The entry tribute to be deducted from buy order.
const exitTribute = "0.2e18"; // The exit tribute to be deducted from sell orders.
const reserveRatio = 0.2; // The reserve ratio to be used for that collateral token.

async function main() {
  const signer = (await ethers.getSigners())[0];

  spinner = spinner.start(`Connect evmcrispr to DAO ${gardensDAOAddress}`);

  const evmcrispr = await EVMcrispr.create(gardensDAOAddress, signer);

  spinner = spinner.succeed();

  const commonsUpgradeAction = await buildCommonsUpgradeActions(
    evmcrispr,
    hatchMigrationToolsAddress,
    collateralTokenAddress,
    entryTribute,
    exitTribute,
    reserveRatio
  );

  spinner.succeed();

  const gardenContext = await buildGardenContext(evmcrispr, signer);

  // Sign covenant
  await signAgreement(gardenContext);

  // Stake collateral action amount
  await stakeTokens(gardenContext);

  spinner = spinner.start("Forward Commons Upgrade script");

  const txReceipt = await (
    await signer.sendTransaction({
      ...commonsUpgradeAction,
      gasLimit: MAX_TX_GAS_LIMIT,
      gasPrice: MAX_TX_GAS_LIMIT,
    })
  ).wait();

  spinner = spinner.succeed(
    `Commons Upgrade script forwarded. Tx hash: ${txReceipt.transactionHash}`
  );

  // Vote on the commons upgrade vote
  await vote(gardenContext);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    spinner.fail();
    console.error(error);
    process.exit(1);
  });
