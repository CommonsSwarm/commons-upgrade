import { ActionFunction, EVMcrispr } from "@1hive/evmcrispr";

export const buildCommonsUpgradeActions = async (
  evmcrispr: EVMcrispr,
  hatchMigrationToolsAddress: string,
  collateralTokenAddress: string,
  entryTribute: string,
  exitTribute: string,
  reserveRatio: number
): Promise<ActionFunction[]> => {
  const { codeAddress: bancorFormulaBaseAddress } =
    await evmcrispr.connector.repo("bancor-formula", "aragonpm.eth");

  const actionFns = [
    evmcrispr.installNewApp("agent:reserve"),
    evmcrispr.installNewApp("augmented-bonding-curve.open:abc", [
      "wrappable-hooked-token-manager.open",
      bancorFormulaBaseAddress,
      "agent:reserve",
      // Fees are going to the common pool
      "agent:1",
      entryTribute,
      exitTribute,
    ]),
    evmcrispr.installNewApp("migration-tools.open:mtb", [
      "wrappable-hooked-token-manager.open",
      "agent:1", // Common pool as Migration Tools' vault 1
      "agent:reserve", // Reserve pool as Migration Tools' vault 2
      0,
    ]),
    evmcrispr.addPermissions(
      [
        [
          "disputable-voting.open",
          "augmented-bonding-curve.open:abc",
          "MANAGE_COLLATERAL_TOKEN_ROLE",
        ],
        [
          evmcrispr.ANY_ENTITY,
          "augmented-bonding-curve.open:abc",
          "MAKE_BUY_ORDER_ROLE",
        ],
        [
          evmcrispr.ANY_ENTITY,
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
          hatchMigrationToolsAddress,
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
          evmcrispr.ANY_ENTITY,
          "disputable-voting.open",
          "CREATE_VOTES_ROLE",
          // evmcrispr.setOracle("migration-tools.open:mtb"),
        ],
      ],
      "disputable-voting.open"
    ),
    evmcrispr.revokePermissions([
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
    evmcrispr.revokePermission(
      [
        "disputable-voting.open",
        "dynamic-issuance.open",
        "UPDATE_SETTINGS_ROLE",
      ],
      true
    ),
    // evmcrispr
    //   .call("augmented-bonding-curve.open:abc")
    //   .addCollateralToken(collateralTokenAddress, 1, 0, ppm(reserveRatio)),
  ];

  return actionFns;
};
