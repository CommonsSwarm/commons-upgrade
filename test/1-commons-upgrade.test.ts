import { EVMcrispr, App, Entity, LabeledAppIdentifier } from "@1hive/evmcrispr";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Signer } from "ethers";
import { ethers } from "hardhat";
import { impersonateAddress } from "../helpers/rpc";
import {
  executeActions,
  hasPermission as checkPermission,
  isAppInstalled as checkInstalledApp,
  isPermissionManager as checkPermissionManager,
  prepareEVMcrisprSigner,
} from "./helpers";
import { buildCommonsUpgradeActions } from "../scripts/helpers/commons-upgrade";
import {
  ENTRY_TRIBUTE,
  EXIT_TRIBUTE,
  RESERVE_RATIO,
  XDAI_GARDENS_DAO_ADDRESS,
  XDAI_HATCH_DAO_ADDRESS,
} from "./params";

describe("Commons Upgrade", () => {
  let commonsEVMcrispr: EVMcrispr;
  let hatchEVMcrispr: EVMcrispr;
  let signer: SignerWithAddress;
  let executorSigner: Signer;

  const isAppInstalled = async (
    app: LabeledAppIdentifier,
    expectedRepo: string
  ): Promise<void> => {
    checkInstalledApp(
      commonsEVMcrispr,
      app,
      XDAI_GARDENS_DAO_ADDRESS,
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

  before("Set up evmcrisprs", async () => {
    signer = (await ethers.getSigners())[0];
    signer = prepareEVMcrisprSigner(signer);

    hatchEVMcrispr = await EVMcrispr.create(XDAI_HATCH_DAO_ADDRESS, signer);
    commonsEVMcrispr = await EVMcrispr.create(XDAI_GARDENS_DAO_ADDRESS, signer);

    executorSigner = await impersonateAddress(
      commonsEVMcrispr.app("disputable-voting.open")
    );
  });

  before("Execute commons upgrade script", async () => {
    const commonsUpgradeActionFns = await buildCommonsUpgradeActions(
      commonsEVMcrispr,
      hatchEVMcrispr,
      ENTRY_TRIBUTE,
      EXIT_TRIBUTE,
      RESERVE_RATIO
    );
    await executeActions(commonsUpgradeActionFns, executorSigner);
  });

  describe("when installing apps", () => {
    it("should install the reserve Agent app", async () => {
      await isAppInstalled("agent:reserve", "agent.aragonpm.eth");
    });

    it("should install the Augmented Bonding Curve", async () => {
      await isAppInstalled(
        "augmented-bonding-curve.open:abc",
        "augmented-bonding-curve.open.aragonpm.eth"
      );
    });

    it("should install the Migration Tools app", async () => {
      await isAppInstalled(
        "migration-tools.open:mtb",
        "migration-tools.open.aragonpm.eth"
      );
    });
  });

  describe("when granting permissions", () => {
    describe("when setting up the Augmented Bonding Curve's permissions", () => {
      it("should grant the Disputable Voting the MANAGE_COLLATERAL_TOKEN_ROLE", async () => {
        await hasPermission(
          "disputable-voting.open",
          "augmented-bonding-curve.open:abc",
          "MANAGE_COLLATERAL_TOKEN_ROLE"
        );
      });

      it("should set the Disputable Voting as the MANAGE_COLLATERAL_TOKEN_ROLE manager", async () => {
        await isPermissionManager(
          "disputable-voting.open",
          "augmented-bonding-curve.open:abc",
          "MANAGE_COLLATERAL_TOKEN_ROLE"
        );
      });

      it("should grant to any entity the MAKE_BUY_ORDER_ROLE", async () => {
        await hasPermission(
          "ANY_ENTITY",
          "augmented-bonding-curve.open:abc",
          "MAKE_BUY_ORDER_ROLE"
        );
      });

      it("should set the Disputable Voting as the MAKE_BUY_ORDER_ROLE's manager", async () => {
        await isPermissionManager(
          "disputable-voting.open",
          "augmented-bonding-curve.open:abc",
          "MAKE_BUY_ORDER_ROLE"
        );
      });

      it("should grant to any entity the MAKE_SELL_ORDER_ROLE", async () => {
        await hasPermission(
          "ANY_ENTITY",
          "augmented-bonding-curve.open:abc",
          "MAKE_SELL_ORDER_ROLE"
        );
      });

      it("should set the Disputable Voting as the MAKE_SELL_ORDER_ROLE's manager", async () => {
        await isPermissionManager(
          "disputable-voting.open",
          "augmented-bonding-curve.open:abc",
          "MAKE_SELL_ORDER_ROLE"
        );
      });

      it("should grant to the ABC the token manager's MINT_ROLE", async () => {
        await hasPermission(
          "augmented-bonding-curve.open:abc",
          "wrappable-hooked-token-manager.open",
          "MINT_ROLE"
        );
      });

      it("should grant to the ABC the token manager's BURN_ROLE", async () => {
        await hasPermission(
          "augmented-bonding-curve.open:abc",
          "wrappable-hooked-token-manager.open",
          "BURN_ROLE"
        );
      });
      it("should grant to the ABC the reserve's agent TRANSFER_ROLE", async () => {
        await hasPermission(
          "augmented-bonding-curve.open:abc",
          "agent:reserve",
          "TRANSFER_ROLE"
        );
      });
    });

    describe("when setting up the Migration Tools' permissions", () => {
      it("should grant to the Hatch's Migration Tools the PREPARE_CLAIMS_ROLE", async () => {
        await hasPermission(
          hatchEVMcrispr.app("migration-tools-beta.open"),
          "migration-tools.open:mtb",
          "PREPARE_CLAIMS_ROLE"
        );
      });

      it("should set the Disputable Voting as the PREPARE_CLAIMS_ROLE's manager", async () => {
        await isPermissionManager(
          "disputable-voting.open",
          "migration-tools.open:mtb",
          "PREPARE_CLAIMS_ROLE"
        );
      });

      it("should grant to the Migration Tools the token manager's ISSUE_ROLE", async () => {
        await hasPermission(
          "migration-tools.open:mtb",
          "wrappable-hooked-token-manager.open",
          "ISSUE_ROLE"
        );
      });

      it("should grant to the Migration Tools the token manager's role ASSIGN_ROLE", async () => {
        await hasPermission(
          "migration-tools.open:mtb",
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
          commonsEVMcrispr.setOracle("migration-tools.open:mtb")(),
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
