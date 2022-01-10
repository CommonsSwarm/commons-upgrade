import { ethers } from "hardhat";
import ora from "ora";
import { EVMcrispr } from "@1hive/evmcrispr";
import { claimTokens } from "./actions";
import { GARDEN_DAO_ADDRESS, HATCH_TOKEN_ADDRESS } from "../commons-config";
import { getAppContract, getTokenHolders } from "../test/helpers";

let spinner = ora();

async function main() {
  const signer = (await ethers.getSigners())[0];

  spinner = spinner.start(
    `Create evmcrispr instance for DAO: ${GARDEN_DAO_ADDRESS}`
  );

  const commonsEVMcrispr = await EVMcrispr.create(GARDEN_DAO_ADDRESS, signer);

  spinner.succeed();

  const commonsMigrationTools = getAppContract(
    "migration-tools.open:0",
    commonsEVMcrispr
  );
  const tokenHolders = await getTokenHolders(HATCH_TOKEN_ADDRESS);
  const tokenHolderAddresses = tokenHolders.map((holder) =>
    holder.address.toLowerCase()
  );

  await claimTokens(
    commonsMigrationTools.claimForMany,
    tokenHolderAddresses,
    {},
    console.log
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    spinner.fail();
    console.error(error);
    process.exit(1);
  });
