import { ActionFunction, Address, EVMcrispr } from "@1hive/evmcrispr";
import { TransactionReceipt } from "@ethersproject/abstract-provider";
import { Signer } from "@ethersproject/abstract-signer";
import { Contract } from "@ethersproject/contracts";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { artifacts, ethers } from "hardhat";
import { impersonateAddress, resetForkedChain } from "../helpers/rpc";
import {
  DAY,
  executeActions,
  getAppContract,
  getEvents,
  getTimestamp,
  MAX_TX_GAS_LIMIT,
  pct16,
  ppm,
  prepareEVMcrisprSigner,
} from "./helpers";
import { buildCommonsUpgradeActions } from "../scripts/helpers/commons-upgrade";
import { BigNumber } from "@ethersproject/bignumber";
import { getTokenHolders } from "./helpers/token";
import {
  claimTokens,
  HOLDERS_PROCESSED_PER_TRANSACTION,
} from "../scripts/helpers/claim-tokens";

// xDai
const GARDEN_DAO_ADDRESS = "0x4ae7b62f1579b4149750a609ef9b830bc72272f8";
const HATCH_DAO_ADDRESS = "0x4625c2c3E1Bc9323CC1A9dc312F3188e8dE83f42";

describe("Hatch migration", () => {
  let hatchEVMcrispr: EVMcrispr;
  let hatchExecutorSigner: Signer;
  let commonsEVMcrispr: EVMcrispr;
  let commonsExecutorSigner: Signer;

  let signer: SignerWithAddress;

  let hatch: Contract;
  let newMigrationTools: Contract;
  let migrationAction: ActionFunction[];

  // Migration params
  let newVault1: Contract;
  let newVault2: Contract;
  let vaultTokenAddress: Address;
  const pct = pct16(20);
  const vestingStartDate = getTimestamp() + 90 * DAY;
  const vestingCliffPeriod = 0;
  const vestingCompletePeriod = (365 - 90) * DAY;

  let PCT_BASE: BigNumber;

  before(async () => {
    await resetForkedChain();
  });

  before("Prepare EVMcrisprs", async () => {
    [signer] = await ethers.getSigners();
    signer = prepareEVMcrisprSigner(signer);

    hatchEVMcrispr = await EVMcrispr.create(HATCH_DAO_ADDRESS, signer);
    commonsEVMcrispr = await EVMcrispr.create(GARDEN_DAO_ADDRESS, signer);

    hatchExecutorSigner = await impersonateAddress(
      hatchEVMcrispr.app("dandelion-voting.1hive")
    );
    commonsExecutorSigner = await impersonateAddress(
      commonsEVMcrispr.app("disputable-voting.open")
    );
  });

  before("Perform Commons Upgrade", async () => {
    hatch = await getAppContract(
      "marketplace-hatch.open:0",
      hatchEVMcrispr,
      signer
    );
    vaultTokenAddress = await hatch.contributionToken();

    const actionFns = await buildCommonsUpgradeActions(
      commonsEVMcrispr,
      hatchEVMcrispr.app("migration-tools-beta.open"),
      vaultTokenAddress,
      pct16(10).toString(),
      pct16(20).toString(),
      ppm(0.01)
    );
    await executeActions(actionFns, commonsExecutorSigner);
  });

  before("Prepare migration", async () => {
    const hatchMigrationTools = getAppContract(
      "migration-tools-beta.open:0",
      hatchEVMcrispr,
      signer
    );
    newMigrationTools = getAppContract(
      "migration-tools.open:mtb",
      commonsEVMcrispr,
      signer
    );

    PCT_BASE = (await hatchMigrationTools.PCT_BASE()) as BigNumber;

    newVault1 = getAppContract("agent:1", commonsEVMcrispr, signer);
    newVault2 = getAppContract("agent:reserve", commonsEVMcrispr, signer);

    vaultTokenAddress = await hatch.contributionToken();

    migrationAction = [
      hatchEVMcrispr
        .call("migration-tools-beta.open")
        .migrate(
          newMigrationTools.address,
          newVault1.address,
          newVault2.address,
          vaultTokenAddress,
          pct,
          vestingStartDate,
          vestingCliffPeriod,
          vestingCompletePeriod
        ),
    ];
  });

  it("should migrate the Hatch DAO funds correctly", async () => {
    const oldVault1 = getAppContract("agent:0", hatchEVMcrispr, signer);
    const oldVault2 = getAppContract("agent:1", hatchEVMcrispr, signer);
    const hatchVault1Funds = (await oldVault1.balance(
      vaultTokenAddress
    )) as BigNumber;
    const hatchVault2Funds = (await oldVault2.balance(
      vaultTokenAddress
    )) as BigNumber;
    const hatchTotalFunds = hatchVault1Funds.add(hatchVault2Funds);

    await executeActions(migrationAction, hatchExecutorSigner);

    const newVault1Funds = (await newVault1.balance(
      vaultTokenAddress
    )) as BigNumber;
    const newVault2Funds = (await newVault2.balance(
      vaultTokenAddress
    )) as BigNumber;

    const expectedNewVault1Funds = hatchTotalFunds.mul(pct).div(PCT_BASE);
    const expectedNewVault2Funds = hatchTotalFunds.sub(expectedNewVault1Funds);

    expect(newVault1Funds).to.be.equal(expectedNewVault1Funds);
    expect(newVault2Funds).to.be.equal(expectedNewVault2Funds);
  });

  describe("when claiming new Commons DAO tokens for a group of hatchers", () => {
    let hatchTokenHolders: { address: string; value: string }[];
    let commonsTokenManager: Contract;

    before("Claim tokens", async () => {
      hatchTokenHolders = (await getTokenHolders(await hatch.token())).slice(
        0,
        HOLDERS_PROCESSED_PER_TRANSACTION
      );
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
        commonsEVMcrispr,
        signer
      );
      const commonsToken = new Contract(
        await commonsTokenManager.token(),
        (await artifacts.readArtifact("MiniMeToken")).abi,
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
          vestingStartDate + vestingCliffPeriod + 1
        );
      const transferableBalanceCompletePeriod =
        await commonsTokenManager.transferableBalance(
          holderAddress,
          vestingStartDate + vestingCompletePeriod
        );

      expect(transferableBalanceNow, "Claimed tokens not vested").to.be.equal(
        0
      );
      expect(
        transferableBalanceAfterCliffPeriod,
        "Invalid unvested tokens after cliff period"
      ).to.be.equal((1 / vestingCompletePeriod) * Number(holderValue));
      expect(
        transferableBalanceCompletePeriod,
        "Claimed tokens not completely unvested"
      ).to.be.equal(holderValue);
    });
  });
});
