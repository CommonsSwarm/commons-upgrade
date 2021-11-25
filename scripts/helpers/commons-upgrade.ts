import { ActionFunction, EVMcrispr } from "@1hive/evmcrispr";
import { BigNumber } from "@ethersproject/bignumber";
import { getAppContract } from "../../test/helpers";

export const buildCommonsUpgradeActions = async (
  commonsEVMcrispr: EVMcrispr,
  hatchEVMcrispr: EVMcrispr,
  entryTribute: string | BigNumber,
  exitTribute: string | BigNumber,
  reserveRatio: number | BigNumber | string
): Promise<ActionFunction[]> => {
  const hatchApp = getAppContract("marketplace-hatch.open:0", hatchEVMcrispr);
  const collateralTokenAddress = await hatchApp.contributionToken();
  const { codeAddress: bancorFormulaBaseAddress } =
    await commonsEVMcrispr.connector.repo("bancor-formula", "aragonpm.eth");

  const actionFns = [
    commonsEVMcrispr.install("agent:reserve"),
    commonsEVMcrispr.install("augmented-bonding-curve.open:abc", [
      "wrappable-hooked-token-manager.open",
      bancorFormulaBaseAddress,
      "agent:reserve",
      // Fees are going to the common pool
      "agent:1",
      entryTribute,
      exitTribute,
    ]),
    commonsEVMcrispr.install("migration-tools.open:mtb", [
      "wrappable-hooked-token-manager.open",
      "agent:1", // Common pool as Migration Tools' vault 1
      "agent:reserve", // Reserve pool as Migration Tools' vault 2
      0,
    ]),
    commonsEVMcrispr.grantPermissions(
      [
        [
          "disputable-voting.open",
          "augmented-bonding-curve.open:abc",
          "MANAGE_COLLATERAL_TOKEN_ROLE",
        ],
        [
          "ANY_ENTITY",
          "augmented-bonding-curve.open:abc",
          "MAKE_BUY_ORDER_ROLE",
        ],
        [
          "ANY_ENTITY",
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
          "ANY_ENTITY",
          "disputable-voting.open",
          "CREATE_VOTES_ROLE",
          commonsEVMcrispr.setOracle("migration-tools.open:mtb"),
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
    commonsEVMcrispr.revoke(
      [
        "disputable-voting.open",
        "dynamic-issuance.open",
        "UPDATE_SETTINGS_ROLE",
      ],
      true
    ),
    commonsEVMcrispr
      .exec("augmented-bonding-curve.open:abc")
      .addCollateralToken(collateralTokenAddress, 1, 0, reserveRatio),
  ];

  return actionFns;
};
