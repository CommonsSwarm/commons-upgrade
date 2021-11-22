import { EVMcrispr } from "@1hive/evmcrispr";
import { ethers } from "hardhat";
import ora from "ora";
import { getEvents, MAX_TX_GAS_LIMIT, MAX_TX_GAS_PRICE } from "../test/helpers";
import { IDisputableVoting } from "../typechain";

let spinner = ora();

const gardensDAOAddress = ""; // Gardens DAO containing disputable voting with the latest vote

const main = async () => {
  const signer = (await ethers.getSigners())[0];

  spinner = spinner.start(`Connect evmcrispr to DAO ${gardensDAOAddress}`);

  const evmcrispr = await EVMcrispr.create(gardensDAOAddress, signer);

  spinner.succeed();

  spinner = spinner.start("Execute latest vote");

  const disputableVoting = (await ethers.getContractAt(
    "IDisputableVoting",
    evmcrispr.app("disputable-voting"),
    signer
  )) as IDisputableVoting;

  const votes = await getEvents(disputableVoting, "StartVote");

  if (!votes || !votes.length) {
    throw new Error("Disputable voting has no votes");
  }

  const {
    args: { voteId, executionScript },
  } = votes.pop();

  const canExecute = await disputableVoting.canExecute(voteId);

  if (!canExecute) {
    spinner.fail(`Can't execute latest vote`);
    return;
  }

  const txReceipt = (
    await disputableVoting.executeVote(voteId, executionScript, {
      gasPrice: MAX_TX_GAS_PRICE,
      gasLimit: MAX_TX_GAS_LIMIT,
    })
  ).wait();

  spinner.succeed(
    `Execute latest vote. Tx hash: ${(await txReceipt).transactionHash}`
  );
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    spinner.fail();
    console.error(error);
    process.exit(1);
  });
