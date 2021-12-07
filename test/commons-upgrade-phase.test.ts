import {
  EVMcrispr,
  Entity,
  LabeledAppIdentifier,
  ActionFunction,
} from "@1hive/evmcrispr";
import { Signer } from "@ethersproject/abstract-signer";
import { BigNumber } from "@ethersproject/bignumber";
import { Contract } from "@ethersproject/contracts";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { artifacts, ethers } from "hardhat";
import ora from "ora";
import {
  executeActions,
  getAppContract,
  getEvents,
  getTokenHolders,
  hasPermission as checkPermission,
  hasPermission,
  isAppInstalled as checkInstalledApp,
  isPermissionManager as checkPermissionManager,
  MAX_TX_GAS_LIMIT,
  PCT_BASE,
  prepareEVMcrisprSigner,
  toDecimals,
} from "./helpers";
import {
  COLLATERAL_TOKEN_ADDRESS,
  COMMONS_TRIBUTE,
  computeReserveRatio,
  GARDEN_DAO_ADDRESS,
  HATCH_DAO_ADDRESS,
  HATCH_TOKEN_ADDRESS,
  INITIAL_BUY,
  VESTING_CLIFF_PERIOD,
  VESTING_COMPLETE_PERIOD,
  VESTING_START_DATE,
  VIRTUAL_BALANCE,
  VIRTUAL_SUPPLY,
} from "../commons-config";
import {
  impersonateAddress,
  restoreSnapshot,
  takeSnapshot,
} from "../helpers/rpc";
import {
  buildABCSetUpActions,
  buildCommonsUpgradeActions,
  buildMigrationAction,
  claimTokens,
} from "../scripts/actions";
import {
  ABC_LABEL,
  COMMONS_POOL_AGENT_LABEL,
  MIGRATION_TOOLS_LABEL,
  RESERVE_AGENT_LABEL,
} from "../scripts/helpers/new-app-labels";

let spinner = ora();

describe.only("Commons Upgrade Phase", () => {
  let commonsEVMcrispr: EVMcrispr;
  let commonsExecutorSigner: Signer;
  let hatchEVMcrispr: EVMcrispr;
  let hatchExecutorSigner: Signer;
  let signer: SignerWithAddress;

  before("Set up evmcrisprs", async () => {
    signer = (await ethers.getSigners())[0];
    signer = prepareEVMcrisprSigner(signer);

    hatchEVMcrispr = await EVMcrispr.create(HATCH_DAO_ADDRESS, signer);
    commonsEVMcrispr = await EVMcrispr.create(GARDEN_DAO_ADDRESS, signer);

    commonsExecutorSigner = await impersonateAddress(
      commonsEVMcrispr.app("disputable-voting.open")
    );
    hatchExecutorSigner = await impersonateAddress(
      hatchEVMcrispr.appCache.has("dandelion-voting.1hive:0")
        ? hatchEVMcrispr.app("dandelion-voting.1hive")
        : hatchEVMcrispr.app("voting")
    );
  });

  describe("STEP 1: when executing the commons upgrade script", async () => {
    const isAppInstalled = async (
      app: LabeledAppIdentifier,
      expectedRepo: string
    ): Promise<void> => {
      checkInstalledApp(
        commonsEVMcrispr,
        app,
        GARDEN_DAO_ADDRESS,
        expectedRepo
      );
    };

    const isPermissionManager = async (
      manager: Entity,
      app: Entity,
      role: string
    ) => {
      return checkPermissionManager(commonsEVMcrispr, manager, app, role);
    };

    const hasPermission = async (
      who: Entity,
      where: Entity,
      what: string,
      how?: string[],
      checkForTrue = true
    ): Promise<void> => {
      return checkPermission(
        commonsEVMcrispr,
        who,
        where,
        what,
        how,
        checkForTrue
      );
    };

    before("Peform commons upgrade", async () => {
      const commonsUpgradeActionFns = await buildCommonsUpgradeActions(
        commonsEVMcrispr,
        hatchEVMcrispr
      );
      await executeActions(commonsUpgradeActionFns, commonsExecutorSigner);
    });

    describe("when installing apps", () => {
      it("should install the reserve Agent app", async () => {
        await isAppInstalled(RESERVE_AGENT_LABEL, "agent.aragonpm.eth");
      });

      it("should install the Augmented Bonding Curve", async () => {
        await isAppInstalled(
          ABC_LABEL,
          "augmented-bonding-curve.open.aragonpm.eth"
        );
      });

      it("should install the Migration Tools app", async () => {
        await isAppInstalled(
          MIGRATION_TOOLS_LABEL,
          "migration-tools.open.aragonpm.eth"
        );
      });
    });

    describe("when granting permissions", () => {
      describe("when setting up the Augmented Bonding Curve's permissions", () => {
        it("should grant the Disputable Voting the MANAGE_COLLATERAL_TOKEN_ROLE", async () => {
          await hasPermission(
            "disputable-voting.open",
            ABC_LABEL,
            "MANAGE_COLLATERAL_TOKEN_ROLE"
          );
        });

        it("should set the Disputable Voting as the MANAGE_COLLATERAL_TOKEN_ROLE manager", async () => {
          await isPermissionManager(
            "disputable-voting.open",
            ABC_LABEL,
            "MANAGE_COLLATERAL_TOKEN_ROLE"
          );
        });

        it("should grant to any entity the MAKE_BUY_ORDER_ROLE", async () => {
          await hasPermission("ANY_ENTITY", ABC_LABEL, "MAKE_BUY_ORDER_ROLE");
        });

        it("should set the Disputable Voting as the MAKE_BUY_ORDER_ROLE's manager", async () => {
          await isPermissionManager(
            "disputable-voting.open",
            ABC_LABEL,
            "MAKE_BUY_ORDER_ROLE"
          );
        });

        it("should grant to any entity the MAKE_SELL_ORDER_ROLE", async () => {
          await hasPermission("ANY_ENTITY", ABC_LABEL, "MAKE_SELL_ORDER_ROLE");
        });

        it("should set the Disputable Voting as the MAKE_SELL_ORDER_ROLE's manager", async () => {
          await isPermissionManager(
            "disputable-voting.open",
            ABC_LABEL,
            "MAKE_SELL_ORDER_ROLE"
          );
        });

        it("should grant to the ABC the token manager's MINT_ROLE", async () => {
          await hasPermission(
            ABC_LABEL,
            "wrappable-hooked-token-manager.open",
            "MINT_ROLE"
          );
        });

        it("should grant to the ABC the token manager's BURN_ROLE", async () => {
          await hasPermission(
            ABC_LABEL,
            "wrappable-hooked-token-manager.open",
            "BURN_ROLE"
          );
        });
        it("should grant to the ABC the reserve's agent TRANSFER_ROLE", async () => {
          await hasPermission(ABC_LABEL, RESERVE_AGENT_LABEL, "TRANSFER_ROLE");
        });
      });

      describe("when setting up the Migration Tools' permissions", () => {
        it("should grant to the Hatch's Migration Tools the PREPARE_CLAIMS_ROLE", async () => {
          await hasPermission(
            hatchEVMcrispr.app("migration-tools-beta.open"),
            MIGRATION_TOOLS_LABEL,
            "PREPARE_CLAIMS_ROLE"
          );
        });

        it("should set the Disputable Voting as the PREPARE_CLAIMS_ROLE's manager", async () => {
          await isPermissionManager(
            "disputable-voting.open",
            MIGRATION_TOOLS_LABEL,
            "PREPARE_CLAIMS_ROLE"
          );
        });

        it("should grant to the Migration Tools the token manager's ISSUE_ROLE", async () => {
          await hasPermission(
            MIGRATION_TOOLS_LABEL,
            "wrappable-hooked-token-manager.open",
            "ISSUE_ROLE"
          );
        });

        it("should grant to the Migration Tools the token manager's role ASSIGN_ROLE", async () => {
          await hasPermission(
            MIGRATION_TOOLS_LABEL,
            "wrappable-hooked-token-manager.open",
            "ASSIGN_ROLE"
          );
        });
      });

      describe("when setting up the Disputable Voting's permissions", () => {
        it("no one should be able to create votes until tokens are migrated", async () => {
          await hasPermission(
            "ANY_ENTITY",
            "disputable-voting.open",
            "CREATE_VOTES_ROLE",
            commonsEVMcrispr.setOracle(MIGRATION_TOOLS_LABEL)(),
            false
          );
        });
      });
    });

    describe("when revoking permissions", () => {
      it("should revoke the Dynamic Issuance's MINT_ROLE", async () => {
        await hasPermission(
          "dynamic-issuance.open",
          "wrappable-hooked-token-manager.open",
          "MINT_ROLE",
          undefined,
          false
        );
      });
      it("should revoke the Dynamic Issuance's BURN_ROLE", async () => {
        await hasPermission(
          "dynamic-issuance.open",
          "wrappable-hooked-token-manager.open",
          "BURN_ROLE",
          undefined,
          false
        );
      });
      it("should revoke the Disputable Voting's UPDATE_SETTINGS_ROLE", async () => {
        await hasPermission(
          "disputable-voting.open",
          "dynamic-issuance.open",
          "UPDATE_SETTINGS_ROLE",
          undefined,
          false
        );
      });
      it("should remove UPDATE_SETTINGS_ROLE's manager", async () => {
        await isPermissionManager(
          "NO_ENTITY",
          "dynamic-issuance.open",
          "UPDATE_SETTINGS_ROLE"
        );
      });
    });
  });

  describe("STEP 2: when performing the Hatch migration", () => {
    let newVault1: Contract;
    let newVault2: Contract;

    let migrationActionFns: ActionFunction[];

    const VOTE_EXECUTION_TIME = 100;

    before("Execute migration action", async () => {
      newVault1 = getAppContract(COMMONS_POOL_AGENT_LABEL, commonsEVMcrispr);
      newVault2 = getAppContract(RESERVE_AGENT_LABEL, commonsEVMcrispr);

      migrationActionFns = await buildMigrationAction(
        hatchEVMcrispr,
        commonsEVMcrispr
      );
    });

    it("should migrate the Hatch DAO funds correctly", async () => {
      const oldVault1 = getAppContract("agent:0", hatchEVMcrispr);
      const oldVault2 = getAppContract("agent:1", hatchEVMcrispr);
      const hatchVault1Funds = (await oldVault1.balance(
        COLLATERAL_TOKEN_ADDRESS
      )) as BigNumber;
      const hatchVault2Funds = (await oldVault2.balance(
        COLLATERAL_TOKEN_ADDRESS
      )) as BigNumber;
      const hatchTotalFunds = hatchVault1Funds.add(hatchVault2Funds);

      await executeActions(migrationActionFns, hatchExecutorSigner);

      const newVault1Funds = (await newVault1.balance(
        COLLATERAL_TOKEN_ADDRESS
      )) as BigNumber;
      const newVault2Funds = (await newVault2.balance(
        COLLATERAL_TOKEN_ADDRESS
      )) as BigNumber;

      const expectedNewVault1Funds = hatchTotalFunds
        .mul(COMMONS_TRIBUTE)
        .div(PCT_BASE);
      const expectedNewVault2Funds = hatchTotalFunds.sub(
        expectedNewVault1Funds
      );

      expect(newVault1Funds, "Vault 1 transfer mismatch").to.be.equal(
        expectedNewVault1Funds
      );
      expect(newVault2Funds, "Vault 2 transfer mismatch").to.be.equal(
        expectedNewVault2Funds
      );
    });

    describe("when claiming new Commons DAO tokens for all hatchers", () => {
      let hatchTokenHolders: { address: string; value: string }[];
      let commonsTokenManager: Contract;

      before("Claim tokens", async () => {
        const newMigrationTools = getAppContract(
          MIGRATION_TOOLS_LABEL,
          commonsEVMcrispr
        );
        hatchTokenHolders = await getTokenHolders(HATCH_TOKEN_ADDRESS);

        const hatchTokenHolderAddresses = hatchTokenHolders.map((holder) =>
          holder.address.toLowerCase()
        );

        const log = (msg: string) => {
          spinner.text = msg;
        };

        spinner.start("Claiming Tokens");

        await claimTokens(
          newMigrationTools.claimForMany,
          hatchTokenHolderAddresses,
          {
            gasLimit: MAX_TX_GAS_LIMIT,
          },
          log,
          false
        );

        spinner.stop();
      });

      it("should claim tokens correctly", async () => {
        commonsTokenManager = getAppContract(
          "wrappable-hooked-token-manager.open:0",
          commonsEVMcrispr
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
          parseFloat(transferableBalanceAfterCliffPeriod.toString()),
          "Invalid unvested tokens after cliff period"
        ).to.be.closeTo(
          (1 / VESTING_COMPLETE_PERIOD) * Number(holderValue),
          VOTE_EXECUTION_TIME
        );
        expect(
          transferableBalanceCompletePeriod.toString(),
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

  describe("STEP 3: when performing the ABC opening", () => {
    let abc: Contract;
    let bancorFormula: Contract;
    let reserve: Contract;
    let commonPool: Contract;
    let collateralToken: Contract;
    let token: Contract;

    let user1: SignerWithAddress;
    let abcUser1: Contract;
    let user2: SignerWithAddress;
    let abcUser2: Contract;

    let entryTribute: BigNumber;
    let exitTribute: BigNumber;
    let reserveRatio: BigNumber;

    let snapshotId: string;

    const ACCOUNTS_INITIAL_COLLATERAL_BALANCE = toDecimals(5000);
    const PURCHASE_AMOUNT = toDecimals(2000);

    let commonPoolBalanceBeforeInitialBuy: BigNumber;
    let expectedInitialBuyReturnAmount: BigNumber;

    const calculatePurchaseReturn = async (
      purchaseAmount: BigNumber
    ): Promise<BigNumber> => {
      const amountFee = purchaseAmount.mul(entryTribute).div(PCT_BASE);
      const amountLessFee = purchaseAmount.sub(amountFee);

      const tokenSupply = await token.totalSupply();
      const reserveCollateralBalance = await collateralToken.balanceOf(
        commonsEVMcrispr.app(RESERVE_AGENT_LABEL)
      );

      const supply = VIRTUAL_SUPPLY.add(tokenSupply);
      const connectorBalance = VIRTUAL_BALANCE.add(reserveCollateralBalance);
      const connectorWeight = reserveRatio;

      return await bancorFormula.calculatePurchaseReturn(
        supply,
        connectorBalance,
        connectorWeight,
        amountLessFee
      );
    };

    const calculateSaleReturn = async (saleAmount: BigNumber) => {
      const tokenSupply = await token.totalSupply();
      const reserveCollateralBalance = await collateralToken.balanceOf(
        commonsEVMcrispr.app(RESERVE_AGENT_LABEL)
      );

      const supply = VIRTUAL_SUPPLY.add(tokenSupply);
      const connectorBalance = VIRTUAL_BALANCE.add(reserveCollateralBalance);
      const connectorWeight = reserveRatio;

      const saleReturn = await bancorFormula.calculateSaleReturn(
        supply,
        connectorBalance,
        connectorWeight,
        saleAmount
      );

      return saleReturn;
    };

    const calculateSaleReturnAfterFee = async (saleAmount: BigNumber) => {
      const saleReturn = await calculateSaleReturn(saleAmount);

      const amountFeeAfterExchange = saleReturn.mul(exitTribute).div(PCT_BASE);
      return saleReturn.sub(amountFeeAfterExchange);
    };

    before("Prepare tests", async () => {
      [, user1, user2] = await ethers.getSigners();
      abc = getAppContract(ABC_LABEL, commonsEVMcrispr);
      abcUser1 = abc.connect(user1);
      abcUser2 = abc.connect(user2);

      bancorFormula = new Contract(
        await abc.formula(),
        (await artifacts.readArtifact("IBancorFormula")).abi,
        signer
      );
      reserve = getAppContract(RESERVE_AGENT_LABEL, commonsEVMcrispr);
      commonPool = getAppContract(COMMONS_POOL_AGENT_LABEL, commonsEVMcrispr);

      const erc20Abi = (await artifacts.readArtifact("ERC20")).abi;

      collateralToken = new Contract(
        COLLATERAL_TOKEN_ADDRESS,
        // [...erc20Abi, "function deposit() public payable"],
        (await artifacts.readArtifact("MiniMeToken")).abi,
        signer
      );
      token = new Contract(await abc.token(), erc20Abi, signer);

      entryTribute = await abc.buyFeePct();
      exitTribute = await abc.sellFeePct();

      const collateralTokenBuyer1 = collateralToken.connect(user1);
      const collateralTokenBuyer2 = collateralToken.connect(user2);

      // await collateralTokenBuyer1.deposit({
      //   value: ACCOUNTS_INITIAL_COLLATERAL_BALANCE,
      // });
      // await collateralTokenBuyer2.deposit({
      //   value: ACCOUNTS_INITIAL_COLLATERAL_BALANCE,
      // });
      await collateralTokenBuyer1.generateTokens(
        user1.address,
        ACCOUNTS_INITIAL_COLLATERAL_BALANCE
      );
      await collateralTokenBuyer2.generateTokens(
        user2.address,
        ACCOUNTS_INITIAL_COLLATERAL_BALANCE
      );
      await collateralTokenBuyer1.approve(abc.address, PURCHASE_AMOUNT);
      await collateralTokenBuyer2.approve(abc.address, PURCHASE_AMOUNT);
    });

    before("Execute the ABC set up actions", async () => {
      reserveRatio = await computeReserveRatio(commonsEVMcrispr);
      expectedInitialBuyReturnAmount = await calculatePurchaseReturn(
        INITIAL_BUY
      );

      /**
       * We need to take into account the common pool initial liquidity minted
       * when creating a garden
       */
      commonPoolBalanceBeforeInitialBuy = await token.balanceOf(
        commonPool.address
      );

      const actionFns = await buildABCSetUpActions(
        commonsEVMcrispr,
        expectedInitialBuyReturnAmount
      );
      await executeActions(actionFns, commonsExecutorSigner);
    });

    it("should make the initial buy", async () => {
      const commonsPoolBalanceAfter = await token.balanceOf(commonPool.address);

      expect(
        commonsPoolBalanceAfter.sub(commonPoolBalanceBeforeInitialBuy)
      ).to.equal(expectedInitialBuyReturnAmount);
    });

    describe("when making a purchase order", () => {
      beforeEach(async () => {
        snapshotId = await takeSnapshot();
      });

      afterEach(async () => {
        await restoreSnapshot(snapshotId);
      });

      it("should return the correct token amount", async () => {
        const expectedReturnedAmount = await calculatePurchaseReturn(
          PURCHASE_AMOUNT
        );
        const user1BalanceBefore = await token.balanceOf(user1.address);

        await abcUser1.makeBuyOrder(
          user1.address,
          collateralToken.address,
          PURCHASE_AMOUNT,
          expectedReturnedAmount
        );

        const user1BalanceAfter = await token.balanceOf(user1.address);

        expect(user1BalanceAfter.sub(user1BalanceBefore)).to.equal(
          expectedReturnedAmount
        );
      });

      it("should send to the reserve pool the correct collateral amount", async () => {
        const expectedReturnedAmount = await calculatePurchaseReturn(
          PURCHASE_AMOUNT
        );
        const reserveBalanceBefore = await reserve.balance(
          collateralToken.address
        );
        const depositAmountEntryTribute =
          PURCHASE_AMOUNT.mul(entryTribute).div(PCT_BASE);

        await abcUser1.makeBuyOrder(
          user1.address,
          collateralToken.address,
          PURCHASE_AMOUNT,
          expectedReturnedAmount
        );

        const reserveBalanceAfter = await reserve.balance(
          collateralToken.address
        );

        expect(reserveBalanceAfter.sub(reserveBalanceBefore)).to.equal(
          PURCHASE_AMOUNT.sub(depositAmountEntryTribute)
        );
      });

      it("should send to the common pool the correct entry tribute amount", async () => {
        const expectedReturnedAmount = await calculatePurchaseReturn(
          PURCHASE_AMOUNT
        );
        const commonsPoolBalanceBefore = await commonPool.balance(
          collateralToken.address
        );

        await abcUser1.makeBuyOrder(
          user1.address,
          collateralToken.address,
          PURCHASE_AMOUNT,
          expectedReturnedAmount
        );

        const expectedEntryTribute =
          PURCHASE_AMOUNT.mul(entryTribute).div(PCT_BASE);
        const commonsPoolBalanceAfter = await commonPool.balance(
          collateralToken.address
        );

        expect(commonsPoolBalanceAfter.sub(commonsPoolBalanceBefore)).to.equal(
          expectedEntryTribute
        );
      });

      it("should buy on behalf of another account", async () => {
        const expectedReturnedAmount = await calculatePurchaseReturn(
          PURCHASE_AMOUNT
        );
        const user1BalanceBefore = await token.balanceOf(user1.address);

        await abcUser2.makeBuyOrder(
          user1.address,
          collateralToken.address,
          PURCHASE_AMOUNT,
          expectedReturnedAmount
        );

        const user1BalanceAfter = await token.balanceOf(user1.address);
        const user2BalanceAfter = await token.balanceOf(user2.address);

        expect(user1BalanceAfter.sub(user1BalanceBefore)).to.equal(
          expectedReturnedAmount
        );
        expect(user2BalanceAfter).to.equal(0);
      });
    });

    describe("when making a sell order", () => {
      let saleAmount: BigNumber;
      let expectedSaleReturned: BigNumber;

      before("Prepare sell operation", async () => {
        const expectedReturnedAmount = await calculatePurchaseReturn(
          PURCHASE_AMOUNT
        );

        await abcUser1.makeBuyOrder(
          user1.address,
          collateralToken.address,
          PURCHASE_AMOUNT,
          expectedReturnedAmount
        );

        saleAmount = await token.balanceOf(user1.address);
        expectedSaleReturned = await calculateSaleReturnAfterFee(saleAmount);
      });

      beforeEach(async () => {
        snapshotId = await takeSnapshot();
      });

      afterEach(async () => {
        await restoreSnapshot(snapshotId);
      });

      it("should return the correct collateral amount", async () => {
        const { address } = user1;
        const collateralBalanceBefore = await collateralToken.balanceOf(
          address
        );

        await abcUser1.makeSellOrder(
          address,
          collateralToken.address,
          saleAmount,
          expectedSaleReturned
        );

        const tokenBalanceAfter = await token.balanceOf(address);
        const collateralBalanceAfter = await collateralToken.balanceOf(address);

        expect(tokenBalanceAfter).to.equal(0);
        expect(collateralBalanceAfter.sub(collateralBalanceBefore)).to.equal(
          expectedSaleReturned
        );
      });

      it("should take from the reserve pool the correct collateral sale amount", async () => {
        const { address } = user1;
        const reserveCollateralBalanceBefore = await collateralToken.balanceOf(
          reserve.address
        );
        const saleAmountBeforeTribute = await calculateSaleReturn(saleAmount);

        await abcUser1.makeSellOrder(
          address,
          collateralToken.address,
          saleAmount,
          expectedSaleReturned
        );

        const reserveCollateralBalanceAfter = await collateralToken.balanceOf(
          reserve.address
        );

        expect(
          reserveCollateralBalanceBefore.sub(reserveCollateralBalanceAfter)
        ).to.closeTo(saleAmountBeforeTribute, 1);
      });

      it("should send to the commons pool the correct collateral amount", async () => {
        const { address } = user1;
        const commonsCollateralBalanceBefore = await collateralToken.balanceOf(
          commonPool.address
        );
        const expectedSaleReturnBeforeTribute = await calculateSaleReturn(
          saleAmount
        );

        await abcUser1.makeSellOrder(
          address,
          collateralToken.address,
          saleAmount,
          expectedSaleReturned
        );

        const commonsCollateralBalanceAfter = await collateralToken.balanceOf(
          commonPool.address
        );

        expect(
          commonsCollateralBalanceAfter.sub(commonsCollateralBalanceBefore)
        ).to.equal(
          expectedSaleReturnBeforeTribute.mul(exitTribute).div(PCT_BASE)
        );
      });

      it("should send on behalf of another account", async () => {
        const user2CollateralBalanceBefore = await collateralToken.balanceOf(
          user2.address
        );

        await abcUser1.makeSellOrder(
          user2.address,
          collateralToken.address,
          saleAmount,
          expectedSaleReturned
        );

        const user1TokenBalanceAfter = await token.balanceOf(user1.address);
        const user2CollateralBalanceAfter = await collateralToken.balanceOf(
          user2.address
        );

        expect(user1TokenBalanceAfter).to.equal(0);
        expect(
          user2CollateralBalanceAfter.sub(user2CollateralBalanceBefore)
        ).to.equal(expectedSaleReturned);
      });
    });
  });
});
