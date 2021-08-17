import { ethers } from "hardhat";
import ora from "ora";
import { EVMcrispr, TX_GAS_LIMIT, TX_GAS_PRICE } from "@commonsswarm/evmcrispr";
import { filterContractEvents } from "../helpers/web3-helpers";
import { IDisputableVoting } from "../typechain";

let spinner = ora();

const gardensDAOAddress = ""; // Gardens DAO containing disputable voting with the latest vote

const main = async () => {
  const signer = (await ethers.getSigners())[0];
  const evmcrispr = new EVMcrispr(signer, await signer.getChainId());

  spinner = spinner.start(`Connect evmcrispr to DAO ${gardensDAOAddress}`);

  await evmcrispr.connect(gardensDAOAddress);

  spinner.succeed();

  spinner = spinner.start("Execute latest vote");

  const disputableVoting = (await ethers.getContractAt(
    "IDisputableVoting",
    evmcrispr.app("disputable-voting")(),
    signer
  )) as IDisputableVoting;

  const votes = await filterContractEvents(disputableVoting, "StartVote");

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
      gasPrice: TX_GAS_PRICE,
      gasLimit: TX_GAS_LIMIT,
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
