import { ethers } from "hardhat";
import ora from "ora";
import { EVMcrispr, TX_GAS_LIMIT, TX_GAS_PRICE } from "@commonsswarm/evmcrispr";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  ERC20,
  IAgreement,
  IDisputableVoting,
  IStaking,
  IStakingFactory,
  TokenManager,
} from "../typechain";
import {
  addressesEqual,
  approveTokenAmount,
  filterContractEvents,
} from "../helpers/web3-helpers";
import { ContractReceipt } from "@ethersproject/contracts";

let spinner = ora();

interface GardenContext {
  agreement: IAgreement;
  hookedTokenManager: TokenManager;
  disputableVoting: IDisputableVoting;
  signer: SignerWithAddress;
}

// COMMONS UPGRADE PARAMETERS

const gardensDAOAddress = ""; // Gardens DAO to be upgraded.
const hatchMigrationToolsAddress = ""; // Migration tools app installed on the Hatch.
const entryTribute = 0.1; // The entry tribute to be deducted from buy order.
const exitTribute = 0.2; // The exit tribute to be deducted from sell orders.
const reserveRatio = 0.2; // The reserve ratio to be used for that collateral token.

const PPM = 1000000;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const buildGardenContext = async (
  evmcrispr: EVMcrispr,
  signer: SignerWithAddress
): Promise<GardenContext> => {
  return {
    agreement: (await ethers.getContractAt(
      "IAgreement",
      evmcrispr.app("agreement")(),
      signer
    )) as IAgreement,
    disputableVoting: (await ethers.getContractAt(
      "IDisputableVoting",
      evmcrispr.app("disputable-voting")(),
      signer
    )) as IDisputableVoting,
    hookedTokenManager: (await ethers.getContractAt(
      "TokenManager",
      evmcrispr.app("wrappable-hooked-token-manager")(),
      signer
    )) as TokenManager,
    signer,
  };
};

const signAgreement = async (gardenContext: GardenContext) => {
  const { agreement, signer } = gardenContext;

  spinner = spinner.start(`Sign community covenant`);

  const settingId = await agreement.getCurrentSettingId();
  const canPerform = await agreement.canPerform(
    ZERO_ADDRESS,
    ZERO_ADDRESS,
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

const getCollateralRequeriment = async (
  gardenContext: GardenContext
): Promise<any> => {
  const { agreement, disputableVoting } = gardenContext;

  const events = await filterContractEvents(
    agreement,
    "CollateralRequirementChanged"
  );

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

const stakeTokens = async (gardenContext: GardenContext): Promise<void> => {
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

const vote = async (gardenContext: GardenContext): Promise<void> => {
  const { disputableVoting, signer } = gardenContext;
  const signerAddress = await signer.getAddress();
  const votes = await filterContractEvents(disputableVoting, "StartVote");
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
        gasPrice: TX_GAS_PRICE,
        gasLimit: TX_GAS_LIMIT,
      })
    ).wait();

    spinner.succeed(
      `Vote yes on Commons Upgrade vote. Tx hash: ${txReceipt.transactionHash}`
    );
  }
};

async function main() {
  const signer = (await ethers.getSigners())[0];
  const evmcrispr = new EVMcrispr(signer, await signer.getChainId());

  spinner = spinner.start(`Connect evmcrispr to DAO ${gardensDAOAddress}`);

  await evmcrispr.connect(gardensDAOAddress);

  spinner = spinner.succeed();

  const gardenContext = await buildGardenContext(evmcrispr, signer);

  // Sign covenant
  await signAgreement(gardenContext);

  // Stake collateral action amount
  await stakeTokens(gardenContext);

  const { codeAddress: bancorFormulaBaseAddress } =
    await evmcrispr.connector.repo("bancor-formula", "aragonpm.eth");
  const tokenAddress = await gardenContext.hookedTokenManager.token();

  spinner = spinner.start(`Encode and forward Commons Upgrade script`);

  const txReceipt = await evmcrispr.forward(
    [
      evmcrispr.installNewApp("agent:new-agent"),
      evmcrispr.installNewApp("commons-bancor-market-maker.open:abc", [
        evmcrispr.app("wrappable-hooked-token-manager"),
        evmcrispr.app("agent"),
        evmcrispr.app("agent:new-agent"),
        bancorFormulaBaseAddress,
        entryTribute * PPM,
        exitTribute * PPM,
      ]),
      evmcrispr.installNewApp("migration-tools.open:mtb", [
        evmcrispr.app("wrappable-hooked-token-manager"),
        evmcrispr.app("agent"),
        evmcrispr.app("agent:new-agent"),
        0,
      ]),
      evmcrispr.addPermissions(
        [
          [
            "disputable-voting",
            "commons-bancor-market-maker.open:abc",
            "OPEN_TRADING_ROLE",
          ],
          [
            evmcrispr.ANY_ENTITY,
            "commons-bancor-market-maker.open:abc",
            "MAKE_BUY_ORDER_ROLE",
          ],
          [
            evmcrispr.ANY_ENTITY,
            "commons-bancor-market-maker.open:abc",
            "MAKE_SELL_ORDER_ROLE",
          ],
          [
            "disputable-voting",
            "commons-bancor-market-maker.open:abc",
            "ADD_COLLATERAL_TOKEN_ROLE",
          ],
          [
            "commons-bancor-market-maker.open:abc",
            "wrappable-hooked-token-manager",
            "MINT_ROLE",
          ],
          [
            "commons-bancor-market-maker.open:abc",
            "wrappable-hooked-token-manager",
            "BURN_ROLE",
          ],
          ["commons-bancor-market-maker.open:abc", "agent:2", "TRANSFER_ROLE"],
          [
            hatchMigrationToolsAddress,
            "migration-tools.open:mtb",
            "PREPARE_CLAIMS_ROLE",
          ],
          [
            "migration-tools.open:mtb",
            "wrappable-hooked-token-manager",
            "ISSUE_ROLE",
          ],
          [
            "migration-tools.open:mtb",
            "wrappable-hooked-token-manager",
            "ASSIGN_ROLE",
          ],
        ],
        "disputable-voting"
      ),
      evmcrispr.revokePermissions([
        ["dynamic-issuance", "wrappable-hooked-token-manager", "MINT_ROLE"],
        ["dynamic-issuance", "wrappable-hooked-token-manager", "BURN_ROLE"],
        ["disputable-voting", "dynamic-issuance", "UPDATE_SETTINGS_ROLE"],
      ]),
      evmcrispr
        .call("commons-bancor-market-maker.open:abc")
        .addCollateralToken(tokenAddress, 1, 0, reserveRatio * PPM),
    ],
    { context: "Commons Upgrade", path: ["disputable-voting"] }
  );

  spinner = spinner.succeed(
    `Commons Upgrade script forwarded. Tx hash: ${txReceipt.transactionHash}`
  );

  await vote(gardenContext);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    spinner.fail();
    console.error(error);
    process.exit(1);
  });
