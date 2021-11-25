import { ActionFunction, Address, EVMcrispr } from "@1hive/evmcrispr";
import { Signer } from "@ethersproject/abstract-signer";
import { BigNumber } from "@ethersproject/bignumber";
import { Contract } from "@ethersproject/contracts";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { artifacts, ethers } from "hardhat";
import { impersonateAddress, resetForkedChain } from "../helpers/rpc";
import {
  executeActions,
  getAppContract,
  getEvents,
  hasPermission,
  MAX_TX_GAS_LIMIT,
  PCT_BASE,
  prepareEVMcrisprSigner,
} from "./helpers";
import { buildCommonsUpgradeActions } from "../scripts/helpers/commons-upgrade";
import {
  buildMigrationAction,
  claimTokens,
} from "../scripts/helpers/migration";
import {
  ENTRY_TRIBUTE,
  EXIT_TRIBUTE,
  HATCH_TOKEN_HOLDERS,
  RESERVE_RATIO,
  VAULT1_PCT,
  VESTING_CLIFF_PERIOD,
  VESTING_COMPLETE_PERIOD,
  VESTING_START_DATE,
  XDAI_GARDENS_DAO_ADDRESS,
  XDAI_HATCH_DAO_ADDRESS,
} from "./params";

describe("Hatch migration", () => {
  let hatchEVMcrispr: EVMcrispr;
  let hatchExecutorSigner: Signer;
  let commonsEVMcrispr: EVMcrispr;
  let commonsExecutorSigner: Signer;

  let signer: SignerWithAddress;

  let hatch: Contract;
  let migrationActionFns: ActionFunction[];

  // Migration params
  let newVault1: Contract;
  let newVault2: Contract;
  let vaultTokenAddress: Address;

  before(async () => {
    await resetForkedChain();
  });

  before("Prepare EVMcrisprs", async () => {
    [signer] = await ethers.getSigners();
    signer = prepareEVMcrisprSigner(signer);

    hatchEVMcrispr = await EVMcrispr.create(XDAI_HATCH_DAO_ADDRESS, signer);
    commonsEVMcrispr = await EVMcrispr.create(XDAI_GARDENS_DAO_ADDRESS, signer);

    hatchExecutorSigner = await impersonateAddress(
      hatchEVMcrispr.app("dandelion-voting.1hive")
    );
    commonsExecutorSigner = await impersonateAddress(
      commonsEVMcrispr.app("disputable-voting.open")
    );
  });

  before("Perform Commons Upgrade", async () => {
    hatch = await getAppContract("marketplace-hatch.open:0", hatchEVMcrispr);
    vaultTokenAddress = await hatch.contributionToken();

    const actionFns = await buildCommonsUpgradeActions(
      commonsEVMcrispr,
      hatchEVMcrispr,
      ENTRY_TRIBUTE,
      EXIT_TRIBUTE,
      RESERVE_RATIO
    );
    await executeActions(actionFns, commonsExecutorSigner);
  });

  before("Prepare migration", async () => {
    newVault1 = getAppContract("agent:1", commonsEVMcrispr);
    newVault2 = getAppContract("agent:reserve", commonsEVMcrispr);

    vaultTokenAddress = await hatch.contributionToken();

    migrationActionFns = await buildMigrationAction(
      hatchEVMcrispr,
      commonsEVMcrispr,
      VAULT1_PCT,
      VESTING_START_DATE,
      VESTING_CLIFF_PERIOD,
      VESTING_COMPLETE_PERIOD
    );
  });

  it("should migrate the Hatch DAO funds correctly", async () => {
    const oldVault1 = getAppContract("agent:0", hatchEVMcrispr);
    const oldVault2 = getAppContract("agent:1", hatchEVMcrispr);
    const hatchVault1Funds = (await oldVault1.balance(
      vaultTokenAddress
    )) as BigNumber;
    const hatchVault2Funds = (await oldVault2.balance(
      vaultTokenAddress
    )) as BigNumber;
    const hatchTotalFunds = hatchVault1Funds.add(hatchVault2Funds);

    await executeActions(migrationActionFns, hatchExecutorSigner);

    const newVault1Funds = (await newVault1.balance(
      vaultTokenAddress
    )) as BigNumber;
    const newVault2Funds = (await newVault2.balance(
      vaultTokenAddress
    )) as BigNumber;

    const expectedNewVault1Funds = hatchTotalFunds
      .mul(VAULT1_PCT)
      .div(PCT_BASE);
    const expectedNewVault2Funds = hatchTotalFunds.sub(expectedNewVault1Funds);

    expect(newVault1Funds).to.be.equal(expectedNewVault1Funds);
    expect(newVault2Funds).to.be.equal(expectedNewVault2Funds);
  });

  describe("when claiming new Commons DAO tokens for all hatchers", () => {
    let hatchTokenHolders: { address: string; value: string }[];
    let commonsTokenManager: Contract;

    before("Claim tokens", async () => {
      const newMigrationTools = getAppContract(
        "migration-tools.open:mtb",
        commonsEVMcrispr
      );
      hatchTokenHolders = HATCH_TOKEN_HOLDERS;

      const hatchTokenHolderAddresses = hatchTokenHolders.map((holder) =>
        holder.address.toLowerCase()
      );

      await claimTokens(
        newMigrationTools.claimForMany,
        hatchTokenHolderAddresses,
        {
          gasLimit: MAX_TX_GAS_LIMIT,
        },
        undefined,
        false
      );
    });

    it("should claim tokens correctly", async () => {
      commonsTokenManager = getAppContract(
        "wrappable-hooked-token-manager.open:0",
        commonsEVMcrispr
      );
      const commonsToken = new Contract(
        await commonsTokenManager.token(),
        (
          await artifacts.readArtifact(
            "@aragon/minime/contracts/MiniMeToken.sol:MiniMeToken"
          )
        ).abi,
        signer
      );

      const transferEvents = await getEvents(commonsToken, "Transfer", [
        commonsTokenManager.address,
      ]);
      const commonsTokenHolders = transferEvents.map(({ args }) => ({
        address: args[1].toLowerCase(),
        value: args[2].toString(),
      }));

      expect(hatchTokenHolders).to.have.deep.members(commonsTokenHolders);
    });

    it("should vest claimed tokens correctly", async () => {
      const { address: holderAddress, value: holderValue } =
        hatchTokenHolders[0];
      const transferableBalanceNow =
        await commonsTokenManager.spendableBalanceOf(holderAddress);
      const transferableBalanceAfterCliffPeriod =
        await commonsTokenManager.transferableBalance(
          holderAddress,
          VESTING_START_DATE + VESTING_CLIFF_PERIOD + 1
        );
      const transferableBalanceCompletePeriod =
        await commonsTokenManager.transferableBalance(
          holderAddress,
          VESTING_START_DATE + VESTING_COMPLETE_PERIOD
        );

      expect(transferableBalanceNow, "Claimed tokens not vested").to.be.equal(
        0
      );
      expect(
        transferableBalanceAfterCliffPeriod,
        "Invalid unvested tokens after cliff period"
      ).to.be.equal((1 / VESTING_COMPLETE_PERIOD) * Number(holderValue));
      expect(
        transferableBalanceCompletePeriod,
        "Claimed tokens not completely unvested"
      ).to.be.equal(holderValue);
    });

    it("should be possible for any account to create votes in the Commons' Disputable Voting", async () => {
      await hasPermission(
        commonsEVMcrispr,
        "ANY_ENTITY",
        "disputable-voting.open",
        "CREATE_VOTES_ROLE"
      );
    });
  });
});
