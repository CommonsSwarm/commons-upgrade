import { ethers } from "hardhat";
import ora from "ora";
import { EVMcrispr } from "@1hive/evmcrispr";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ContractReceipt } from "@ethersproject/contracts";
import {
  ERC20,
  IAgreement,
  IDisputableVoting,
  IStaking,
  IStakingFactory,
  ITokenManager,
} from "../typechain";
import {
  addressesEqual,
  approveTokenAmount,
  getEvent,
  getEvents,
  MAX_TX_GAS_LIMIT,
  MAX_TX_GAS_PRICE,
} from "../test/helpers";

let spinner = ora();

interface GardenContext {
  agreement: IAgreement;
  hookedTokenManager: ITokenManager;
  disputableVoting: IDisputableVoting;
  signer: SignerWithAddress;
}

export const buildGardenContext = async (
  evmcrispr: EVMcrispr,
  signer: SignerWithAddress
): Promise<GardenContext> => {
  return {
    agreement: (await ethers.getContractAt(
      "IAgreement",
      evmcrispr.app("agreement.open"),
      signer
    )) as IAgreement,
    disputableVoting: (await ethers.getContractAt(
      "IDisputableVoting",
      evmcrispr.app("disputable-voting.open"),
      signer
    )) as IDisputableVoting,
    hookedTokenManager: (await ethers.getContractAt(
      "ITokenManager",
      evmcrispr.app("wrappable-hooked-token-manager.open"),
      signer
    )) as ITokenManager,
    signer,
  };
};

export const signAgreement = async (gardenContext: GardenContext) => {
  const { agreement, signer } = gardenContext;

  spinner = spinner.start(`Sign community covenant`);

  const settingId = await agreement.getCurrentSettingId();
  const canPerform = await agreement.canPerform(
    ethers.constants.AddressZero,
    ethers.constants.AddressZero,
    ethers.utils.id("0x0"),
    [await signer.getAddress()]
  );

  if (canPerform) {
    spinner.succeed();
    return;
  }

  const txReceipt = await (await agreement.sign(settingId)).wait();

  spinner.succeed(`Covenant signed. Tx hash: ${txReceipt.transactionHash}`);
};

export const getCollateralRequeriment = async (
  gardenContext: GardenContext
): Promise<any> => {
  const { agreement, disputableVoting } = gardenContext;

  const events = await getEvents(agreement, "CollateralRequirementChanged");

  const lastEvent = events
    .filter(({ args }) =>
      addressesEqual(args.disputable, disputableVoting.address)
    )
    .pop();

  if (!lastEvent) {
    throw new Error("Collateral requeriment id not found");
  }

  return await agreement.getCollateralRequirement(
    disputableVoting.address,
    lastEvent.args.collateralRequirementId
  );
};

export const stakeTokens = async (
  gardenContext: GardenContext
): Promise<void> => {
  const { agreement, hookedTokenManager, signer } = gardenContext;

  spinner = spinner.start(`Stake collateral action amount`);

  const signerAddress = await signer.getAddress();
  const token = (await ethers.getContractAt(
    "ERC20",
    await hookedTokenManager.token(),
    signer
  )) as ERC20;
  const stakingFactory = (await ethers.getContractAt(
    "IStakingFactory",
    await agreement.stakingFactory(),
    signer
  )) as IStakingFactory;
  const staking = (await ethers.getContractAt(
    "IStaking",
    await stakingFactory.getInstance(token.address),
    signer
  )) as IStaking;
  const signerTotalStake = await staking.totalStakedFor(signerAddress);
  const [, , collateralActionAmount] = await getCollateralRequeriment(
    gardenContext
  );
  let txReceipt: ContractReceipt;

  if (signerTotalStake.gte(collateralActionAmount)) {
    spinner.succeed();
    return;
  }

  spinner = spinner.start(
    `Approve collateral action amount ${collateralActionAmount}`
  );

  await approveTokenAmount(
    token,
    signerAddress,
    staking.address,
    collateralActionAmount
  );

  spinner = spinner.succeed();

  spinner = spinner.start(
    `Stake collateral action amount of ${collateralActionAmount}`
  );

  txReceipt = await (await staking.stake(collateralActionAmount, "0x")).wait();

  spinner = spinner.succeed();

  const { _allowance: stakingAllowance } = await staking.getLock(
    signerAddress,
    agreement.address
  );

  if (stakingAllowance.eq(0)) {
    spinner = spinner.start(`Allow agreement to lock up balance`);

    txReceipt = await (
      await staking.allowManager(
        agreement.address,
        ethers.constants.MaxInt256,
        "0x"
      )
    ).wait();

    spinner = spinner.succeed();
  }
};

export const vote = async (gardenContext: GardenContext): Promise<void> => {
  const { disputableVoting, signer } = gardenContext;
  const signerAddress = await signer.getAddress();
  const votes = await getEvents(disputableVoting, "StartVote");
  const {
    args: { voteId },
  } = votes.pop();

  const canVote = await disputableVoting.canVote(voteId, signerAddress);

  if (canVote) {
    spinner = spinner.start(
      `Vote yes on Commons Upgrade vote with id ${voteId}`
    );

    const txReceipt = await (
      await disputableVoting.vote(voteId, true, {
        gasPrice: MAX_TX_GAS_PRICE,
        gasLimit: MAX_TX_GAS_LIMIT,
      })
    ).wait();

    spinner.succeed(
      `Vote yes on Commons Upgrade vote. Tx hash: ${txReceipt.transactionHash}`
    );
  }
};
