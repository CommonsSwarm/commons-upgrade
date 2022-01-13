import {
  ActionFunction,
  EVMcrispr,
  LabeledAppIdentifier,
} from "@1hive/evmcrispr";
import { ethers } from "hardhat";
import {
  DELEGATED_VOTING_PERIOD,
  ENTRY_TRIBUTE,
  EXECUTION_DELAY,
  EXIT_TRIBUTE,
  QUIET_ENDING_PERIOD,
  QUIET_ENDING_EXTENSION,
  VOTE_DURATION,
} from "../../commons-config";
import { getAppContract } from "../../test/helpers";
import {
  ABC_LABEL,
  COMMONS_POOL_AGENT_LABEL,
  MIGRATION_TOOLS_LABEL,
  RESERVE_AGENT_LABEL,
} from "../helpers/new-app-labels";

const checkConvictionVotingAgent = async (
  agentLabel: LabeledAppIdentifier,
  commonsEVMcrispr: EVMcrispr
) => {
  const agentApp = commonsEVMcrispr.appCache.get(agentLabel);
  const convictionVoting = getAppContract(
    "disputable-conviction-voting.open:0",
    commonsEVMcrispr
  );
  const fundsManagerAddress = await convictionVoting.fundsManager();

  if (!agentApp) {
    throw new Error(`Agent ${agentLabel} not found`);
  }

  const transferPermission = agentApp.permissions.get(
    ethers.utils.id("TRANSFER_ROLE")
  )!;

  if (!transferPermission.grantees.has(fundsManagerAddress.toLowerCase())) {
    throw new Error(
      `${COMMONS_POOL_AGENT_LABEL} is not the conviction voting agent`
    );
  }
};

export const buildCommonsUpgradeActions = async (
  commonsEVMcrispr: EVMcrispr,
  hatchEVMcrispr: EVMcrispr
): Promise<ActionFunction[]> => {
  const { codeAddress: bancorFormulaBaseAddress } =
    await commonsEVMcrispr.connector.repo("bancor-formula", "aragonpm.eth");

  await checkConvictionVotingAgent(COMMONS_POOL_AGENT_LABEL, commonsEVMcrispr);

  const actionFns = [
    commonsEVMcrispr.install(RESERVE_AGENT_LABEL),
    commonsEVMcrispr.install(ABC_LABEL, [
      "wrappable-hooked-token-manager.open",
      bancorFormulaBaseAddress,
      RESERVE_AGENT_LABEL,
      // Agent receiving the fees
      COMMONS_POOL_AGENT_LABEL,
      ENTRY_TRIBUTE,
      EXIT_TRIBUTE,
    ]),
    commonsEVMcrispr.install(MIGRATION_TOOLS_LABEL, [
      "wrappable-hooked-token-manager.open",
      COMMONS_POOL_AGENT_LABEL,
      RESERVE_AGENT_LABEL,
      0,
    ]),
    commonsEVMcrispr.grantPermissions(
      [
        [
          "disputable-voting.open",
          "disputable-voting.open",
          "CHANGE_VOTE_TIME_ROLE",
        ],
        [
          "disputable-voting.open",
          "disputable-voting.open",
          "CHANGE_QUIET_ENDING_ROLE",
        ],
        [
          "disputable-voting.open",
          "disputable-voting.open",
          "CHANGE_DELEGATED_VOTING_PERIOD_ROLE",
        ],
        [
          "disputable-voting.open",
          "disputable-voting.open",
          "CHANGE_EXECUTION_DELAY_ROLE",
        ],
        ["disputable-voting.open", ABC_LABEL, "MANAGE_COLLATERAL_TOKEN_ROLE"],
        ["ANY_ENTITY", ABC_LABEL, "MAKE_BUY_ORDER_ROLE"],
        ["ANY_ENTITY", ABC_LABEL, "MAKE_SELL_ORDER_ROLE"],
        [ABC_LABEL, "wrappable-hooked-token-manager.open", "MINT_ROLE"],
        [ABC_LABEL, "wrappable-hooked-token-manager.open", "BURN_ROLE"],
        [ABC_LABEL, RESERVE_AGENT_LABEL, "TRANSFER_ROLE"],
        [
          hatchEVMcrispr.app("migration-tools-beta.open"),
          MIGRATION_TOOLS_LABEL,
          "PREPARE_CLAIMS_ROLE",
        ],
        [
          MIGRATION_TOOLS_LABEL,
          "wrappable-hooked-token-manager.open",
          "ISSUE_ROLE",
        ],
        [
          MIGRATION_TOOLS_LABEL,
          "wrappable-hooked-token-manager.open",
          "ASSIGN_ROLE",
        ],
        [
          "ANY_ENTITY",
          "disputable-voting.open",
          "CREATE_VOTES_ROLE",
          commonsEVMcrispr.setOracle(MIGRATION_TOOLS_LABEL),
        ],
      ],
      "disputable-voting.open"
    ),
    commonsEVMcrispr
      .exec("disputable-voting.open")
      .changeVoteTime(VOTE_DURATION),
    commonsEVMcrispr
      .exec("disputable-voting.open")
      .changeDelegatedVotingPeriod(DELEGATED_VOTING_PERIOD),
    commonsEVMcrispr
      .exec("disputable-voting.open")
      .changeQuietEndingConfiguration(
        QUIET_ENDING_PERIOD,
        QUIET_ENDING_EXTENSION
      ),
    commonsEVMcrispr
      .exec("disputable-voting.open")
      .changeExecutionDelay(EXECUTION_DELAY),
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
  ];

  return actionFns;
};
