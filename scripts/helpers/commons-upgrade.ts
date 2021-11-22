import { ActionFunction, EVMcrispr } from "@1hive/evmcrispr";
import { Signer } from "@ethersproject/abstract-signer";
import { getAppContract } from "../../test/helpers";

export const buildCommonsUpgradeActions = async (
  commonsEVMcrispr: EVMcrispr,
  hatchEVMcrispr: EVMcrispr,
  entryTribute: string,
  exitTribute: string,
  reserveRatio: number,
  signer: Signer
): Promise<ActionFunction[]> => {
  const hatchApp = getAppContract(
    "marketplace-hatch.open:0",
    hatchEVMcrispr,
    signer
  );
  const collateralTokenAddress = await hatchApp.contributionToken();
  const { codeAddress: bancorFormulaBaseAddress } =
    await commonsEVMcrispr.connector.repo("bancor-formula", "aragonpm.eth");

  const actionFns = [
    commonsEVMcrispr.installNewApp("agent:reserve"),
    commonsEVMcrispr.installNewApp("augmented-bonding-curve.open:abc", [
      "wrappable-hooked-token-manager.open",
      bancorFormulaBaseAddress,
      "agent:reserve",
      // Fees are going to the common pool
      "agent:1",
      entryTribute,
      exitTribute,
    ]),
    commonsEVMcrispr.installNewApp("migration-tools.open:mtb", [
      "wrappable-hooked-token-manager.open",
      "agent:1", // Common pool as Migration Tools' vault 1
      "agent:reserve", // Reserve pool as Migration Tools' vault 2
      0,
    ]),
    commonsEVMcrispr.addPermissions(
      [
        [
          "disputable-voting.open",
          "augmented-bonding-curve.open:abc",
          "MANAGE_COLLATERAL_TOKEN_ROLE",
        ],
        [
          commonsEVMcrispr.ANY_ENTITY,
          "augmented-bonding-curve.open:abc",
          "MAKE_BUY_ORDER_ROLE",
        ],
        [
          commonsEVMcrispr.ANY_ENTITY,
          "augmented-bonding-curve.open:abc",
          "MAKE_SELL_ORDER_ROLE",
        ],
        [
          "augmented-bonding-curve.open:abc",
          "wrappable-hooked-token-manager.open",
          "MINT_ROLE",
        ],
        [
          "augmented-bonding-curve.open:abc",
          "wrappable-hooked-token-manager.open",
          "BURN_ROLE",
        ],
        ["augmented-bonding-curve.open:abc", "agent:reserve", "TRANSFER_ROLE"],
        [
          hatchEVMcrispr.app("migration-tools-beta.open"),
          "migration-tools.open:mtb",
          "PREPARE_CLAIMS_ROLE",
        ],
        [
          "migration-tools.open:mtb",
          "wrappable-hooked-token-manager.open",
          "ISSUE_ROLE",
        ],
        [
          "migration-tools.open:mtb",
          "wrappable-hooked-token-manager.open",
          "ASSIGN_ROLE",
        ],
        [
          commonsEVMcrispr.ANY_ENTITY,
          "disputable-voting.open",
          "CREATE_VOTES_ROLE",
          // evmcrispr.setOracle("migration-tools.open:mtb"),
        ],
      ],
      "disputable-voting.open"
    ),
    commonsEVMcrispr.revokePermissions([
      [
        "dynamic-issuance.open",
        "wrappable-hooked-token-manager.open",
        "MINT_ROLE",
      ],
      [
        "dynamic-issuance.open",
        "wrappable-hooked-token-manager.open",
        "BURN_ROLE",
      ],
    ]),
    commonsEVMcrispr.revokePermission(
      [
        "disputable-voting.open",
        "dynamic-issuance.open",
        "UPDATE_SETTINGS_ROLE",
      ],
      true
    ),
    // evmcrispr
    //   .call("augmented-bonding-curve.open:abc")
    //   .addCollateralToken(collateralTokenAddress, 1, 0, reserveRatio),
  ];

  return actionFns;
};
