import { BigNumber } from "@ethersproject/bignumber";
import {
  EVMcrispr,
  Action,
  TX_GAS_LIMIT,
  TX_GAS_PRICE,
} from "@commonsswarm/evmcrispr";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Contract } from "@ethersproject/contracts";
import { Result } from "@ethersproject/abi";
import { ethers } from "hardhat";
import { Address } from "hardhat-deploy/dist/types";
import {
  ERC20,
  IAgreement,
  IDisputableVoting,
  IStaking,
  IStakingFactory,
  TokenManager,
} from "../typechain";

const toTokens = (amount, decimals = 18) => {
  const [integer, decimal] = String(amount).split(".");
  return BigNumber.from(
    (integer != "0" ? integer : "") + (decimal || "").padEnd(decimals, "0")
  );
};

const gardensDAO = "0xD1e62b72273Ab3Ed70DE2C6285A1a7C517BA012D";

const COLLATERAL_AMOUNT = toTokens(5.1, 18);

const hatchMigrationTools = "0xa1b4da2a85bce4733d50e392b5aaecc74223a926";
// tDAI
const collateralToken = "0xFB8F60246D56905866e12443ec0836EBfB3E1F2e";
const entryTribute = 0.1;
const exitTribute = 0.2;
const reserveRatio = 0.2;
const PPM = 1000000;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const filterContractEvents = (
  contract: Contract,
  selectedFilter: string,
  transactionHash?: string
): Promise<Result> => {
  return new Promise((resolve, reject) => {
    const filter = contract.filters[selectedFilter]();

    contract
      .queryFilter(filter)
      .then((events) => {
        if (transactionHash) {
          const filteredEvent = events.filter(
            (event) => event.transactionHash === transactionHash
          );
          resolve(filteredEvent[0]?.args);
        } else {
          resolve(events);
        }
      })
      .catch((err) => reject(err));
  });
};

const signAgreement = async (
  signer: SignerWithAddress,
  evmcrispr: EVMcrispr
) => {
  const getSettingIdAction: Action = evmcrispr
    .call("agreement")
    .getCurrentSettingId()();
  const settingId = await signer.call({ ...getSettingIdAction });
  const canPerformAction: Action = await evmcrispr
    .call("agreement")
    ["canPerform(address,address,bytes32,uint256[])"](
      ZERO_ADDRESS,
      ZERO_ADDRESS,
      ethers.utils.id("0x0"),
      [await signer.getAddress()]
    )();
  const canPerform = await signer.call({ ...canPerformAction });
  if (canPerform) {
    console.log(canPerform);
    // return;
  }
  try {
    const signAction = await evmcrispr.call("agreement").sign(settingId)();
    const txReceipt = await (
      await signer.sendTransaction({ ...signAction })
    ).wait();
    console.log(`Sign tx hash: ${txReceipt.transactionHash}`);
  } catch (e) {
    console.error(e);
  }
};

const checkAllowance = async (
  evmcrispr: EVMcrispr,
  holder: Address,
  tokenAddress: Address,
  signer: SignerWithAddress
) => {
  const agreement = (await ethers.getContractAt(
    "IAgreement",
    evmcrispr.app("agreement")(),
    signer
  )) as IAgreement;
  const stakingFactory = (await ethers.getContractAt(
    "IStakingFactory",
    await agreement.stakingFactory(),
    signer
  )) as IStakingFactory;
  const stakingInstanceAddress = await stakingFactory.getInstance(tokenAddress);
  // const stakingInstanceAddress = await stakingFactory.getInstance(tokenAddress);
  const staking = (await ethers.getContractAt(
    "IStaking",
    "0x80e9c60be074fdeff137b6eadbed8bc82a15c6bc",
    signer
  )) as IStaking;
  const token = (await ethers.getContractAt(
    "ERC20",
    tokenAddress,
    signer
  )) as ERC20;
  const allowance = await token.allowance(holder, staking.address);
  console.log(
    await agreement.getCollateralRequirement(ZERO_ADDRESS, toTokens(1, 18))
  );
  console.log(allowance.toString());
  console.log(await (await staking.getBalancesOf(holder)).toString());
  if (allowance.lt(COLLATERAL_AMOUNT)) {
    if (!allowance.eq(0)) {
      await token.approve(staking.address, 0);
    }
    await token.approve(staking.address, COLLATERAL_AMOUNT);
  }

  await staking.stake(COLLATERAL_AMOUNT, "0x", {
    gasLimit: TX_GAS_LIMIT,
    gasPrice: TX_GAS_PRICE,
  });

  const { _allowance: stakingAllowance } = await staking.getLock(
    holder,
    agreement.address
  );

  if (stakingAllowance.eq(0)) {
    await staking.allowManager(
      agreement.address,
      ethers.constants.MaxInt256,
      "0x"
    );
  }
};
const stakeTokens = async (evmcrispr: EVMcrispr, signer: SignerWithAddress) => {
  const tokenManager = (await ethers.getContractAt(
    "TokenManager",
    evmcrispr.app("wrappable-hooked-token-manager")(),
    signer
  )) as TokenManager;
  await checkAllowance(
    evmcrispr,
    await signer.getAddress(),
    await tokenManager.token(),
    signer
  );
};

const vote = async (evmcrispr: EVMcrispr, signer: SignerWithAddress) => {
  const disputableVotingAddress = evmcrispr.app("disputable-voting")();
  const disputableVoting = (await ethers.getContractAt(
    "IDisputableVoting",
    disputableVotingAddress,
    signer
  )) as IDisputableVoting;

  const votes = await filterContractEvents(disputableVoting, "StartVote");
  const vote = votes[votes.length - 1];

  const canVote = await disputableVoting.canVote(
    vote.args.voteId,
    await signer.getAddress()
  );

  if (canVote) {
    await disputableVoting.vote(vote.args.voteId, true, {
      gasPrice: TX_GAS_PRICE,
      gasLimit: TX_GAS_LIMIT,
    });
  }

  const canExecute = await disputableVoting.canExecute(vote.args.voteId);
  if (canExecute) {
    await disputableVoting.executeVote(
      vote.args.voteId,
      vote.args.executionScript,
      {
        gasPrice: TX_GAS_PRICE,
        gasLimit: TX_GAS_LIMIT,
      }
    );
  }
};

async function main() {
  const signer = (await ethers.getSigners())[0];
  const evmcrispr = new EVMcrispr(signer, await signer.getChainId());
  await evmcrispr.connect(gardensDAO);

  await stakeTokens(evmcrispr, signer);

  await signAgreement(signer, evmcrispr);

  const { codeAddress: bancorFormulaBaseAddress } =
    await evmcrispr.connector.repo("bancor-formula", "aragonpm.eth");
  const tokenManager = (await ethers.getContractAt(
    "TokenManager",
    evmcrispr.app("wrappable-hooked-token-manager")(),
    signer
  )) as TokenManager;
  const tokenAddress = await tokenManager.token();

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
            hatchMigrationTools,
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

  console.log(txReceipt);

  await vote(evmcrispr, signer);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
