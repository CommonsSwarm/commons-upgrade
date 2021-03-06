import { TOKEN_FREEZE } from "../commons-config";
import {
  garden,
  convictionVoting,
  collateralTokenAddress,
  advanced,
  taoVoting,
  token,
} from "../params.json";

// Converts from 30 to 0.3
const toPct = (s) => parseFloat(s) / 100;

const json = {
  gnosisSafe: "0x0000000000000000000000000000000000000000",
  gardenTokenName: advanced.token.name,
  gardenTokenSymbol: advanced.token.symbol,
  seeds: garden.seeds,
  commonPoolAmount: 0,
  honeyTokenLiquidityInXdai: parseFloat(advanced.garden.stableInitialLiquidity),
  gardenTokenLiquidity: parseFloat(advanced.garden.tokenInitialLiquidity),
  issuanceTargetRatio: 0,
  issuanceThrottle: 0,
  convictionGrowthHours: Math.floor(
    parseFloat(convictionVoting.convictionGrowthDays) * 24
  ),
  spendingLimit: toPct(convictionVoting.spendingLimit),
  minimumConviction: toPct(convictionVoting.minConviction),
  minActiveStakePercentage: toPct(advanced.convictionVoting.minEffectiveSupply),
  requestToken: collateralTokenAddress,
  agreementTitle: advanced.agreement.title,
  agreementContent: advanced.agreement.content,
  settlementPeriod: parseFloat(advanced.agreement.settlementPeriodDays),
  proposalDeposit:
    parseFloat(advanced.agreement.proposalDepositStable) /
    parseFloat(token.openingPrice),
  challengeDeposit:
    parseFloat(advanced.agreement.challangeDepositStable) /
    parseFloat(token.openingPrice),
  proposalDepositStable: parseFloat(advanced.agreement.proposalDepositStable),
  challengeDepositStable: parseFloat(advanced.agreement.challangeDepositStable),
  voteSupportRequired: toPct(taoVoting.supportRequired),
  voteMinAcceptanceQuorum: toPct(taoVoting.minQuorum),
  voteDurationDays: 0.003,
  delegatedVotingPeriodDays: 0,
  voteQuietEndingPeriodDays: 0,
  voteQuietEndingExtensionDays: 0,
  voteExecutionDelayDays: 0,
};

console.log(JSON.stringify(json, null, 2));
