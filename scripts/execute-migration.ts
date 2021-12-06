import { ethers } from "hardhat";
import ora from "ora";
import { EVMcrispr } from "@1hive/evmcrispr";
import { buildMigrationAction } from "./actions";
import { TransactionReceipt } from "@ethersproject/abstract-provider";
import { GARDEN_DAO_ADDRESS, HATCH_DAO_ADDRESS } from "../commons-config";

let spinner = ora();

async function main() {
  const signer = (await ethers.getSigners())[0];
  let receipt: TransactionReceipt;

  spinner = spinner.start(
    `Create evmcrispr instances for DAOs: ${GARDEN_DAO_ADDRESS} and ${HATCH_DAO_ADDRESS}`
  );

  const commonsEVMcrispr = await EVMcrispr.create(GARDEN_DAO_ADDRESS, signer);
  const hatchEVMcrispr = await EVMcrispr.create(HATCH_DAO_ADDRESS, signer);

  spinner.succeed();

  const migrationActionFns = await buildMigrationAction(
    hatchEVMcrispr,
    commonsEVMcrispr
  );

  spinner.start(`Forwarding hatch migration action`);

  receipt = await hatchEVMcrispr.forward(migrationActionFns, [
    "token-manager",
    "voting",
  ]);

  spinner.succeed(
    `Migration script forwarded. Tx hash: ${receipt.transactionHash}`
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    spinner.fail();
    console.error(error);
    process.exit(1);
  });
