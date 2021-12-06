import { ethers } from "hardhat";
import ora from "ora";
import { EVMcrispr } from "@1hive/evmcrispr";
import {
  buildGardenContext,
  signAgreement,
  stakeTokens,
  vote,
} from "../helpers/gardens";
import { buildCommonsUpgradeActions } from "./actions/commons-upgrade";
import { GARDEN_DAO_ADDRESS, HATCH_DAO_ADDRESS } from "../commons-config";

let spinner = ora();

async function main() {
  const signer = (await ethers.getSigners())[0];

  spinner = spinner.start(`Connect evmcrispr to DAO ${GARDEN_DAO_ADDRESS}`);

  const evmcrispr = await EVMcrispr.create(GARDEN_DAO_ADDRESS, signer);
  const hatchEVMcrispr = await EVMcrispr.create(HATCH_DAO_ADDRESS, signer);

  const commonsUpgradeActionFns = await buildCommonsUpgradeActions(
    evmcrispr,
    hatchEVMcrispr
  );

  spinner.succeed();

  const gardenContext = await buildGardenContext(evmcrispr, signer);

  // Sign covenant
  await signAgreement(gardenContext);

  // Stake collateral action amount
  await stakeTokens(gardenContext);

  spinner = spinner.start(`Forwarding commons upgrade actions`);

  const txReceipt = await evmcrispr.forward(
    commonsUpgradeActionFns,
    ["disputable-voting.open"],
    { context: "Commons Upgrade" }
  );

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
