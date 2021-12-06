import { ethers } from "hardhat";
import ora from "ora";
import { EVMcrispr } from "@1hive/evmcrispr";
import { buildABCSetUpActions } from "./actions";
import { GARDEN_DAO_ADDRESS } from "../commons-config";

let spinner = ora();

async function main() {
  const signer = (await ethers.getSigners())[0];

  spinner = spinner.start(
    `Create evmcrispr instance for DAO: ${GARDEN_DAO_ADDRESS}`
  );

  const commonsEVMcrispr = await EVMcrispr.create(GARDEN_DAO_ADDRESS, signer);

  spinner.succeed();

  spinner = spinner.start(`Forward abc set up actions`);

  const abcActionFns = await buildABCSetUpActions(commonsEVMcrispr);

  const receipt = await commonsEVMcrispr.forward(
    abcActionFns,
    ["disputable-voting.open"],
    {
      context: "Open Augmented Bonding Curve",
    }
  );

  spinner = spinner.succeed(
    `ABC actions forwarded. Tx hash: ${receipt.transactionHash}`
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    spinner.fail();
    console.error(error);
    process.exit(1);
  });
