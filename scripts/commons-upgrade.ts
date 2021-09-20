import { ethers } from "hardhat";
import ora from "ora";
import { EVMcrispr } from "@commonsswarm/evmcrispr";
import {
  toDecimals,
  TX_GAS_LIMIT,
  TX_GAS_PRICE,
} from "../helpers/web3-helpers";
import {
  buildGardenContext,
  signAgreement,
  stakeTokens,
  vote,
} from "../helpers/gardens";

let spinner = ora();

// COMMONS UPGRADE PARAMETERS

const gardensDAOAddress = ""; // Gardens DAO to be upgraded.
const collateralTokenAddress = ""; // ABC's collateral token (e.g. wxDAI).
const hatchMigrationToolsAddress = ""; // Migration tools app installed on the Hatch.
const entryTribute = 0.1; // The entry tribute to be deducted from buy order.
const exitTribute = 0.2; // The exit tribute to be deducted from sell orders.
const reserveRatio = 0.2; // The reserve ratio to be used for that collateral token.

const PPM = 1000000;

async function main() {
  const signer = (await ethers.getSigners())[0];
  const evmcrispr = await EVMcrispr.create(signer, gardensDAOAddress, {
    ipfsGateway: "https://ipfs.io/ipfs/",
  });

  spinner = spinner.start(`Connect evmcrispr to DAO ${gardensDAOAddress}`);

  spinner = spinner.succeed();

  const { codeAddress: bancorFormulaBaseAddress } =
    await evmcrispr.connector.repo("bancor-formula", "aragonpm.eth");

  spinner = spinner.start(`Encode Commons Upgrade script`);

  const encodedAction = await evmcrispr.encode(
    [
      evmcrispr.installNewApp("agent:reserve"),
      evmcrispr.installNewApp("augmented-bonding-curve.open:abc", [
        evmcrispr.app("wrappable-hooked-token-manager.open"),
        bancorFormulaBaseAddress,
        evmcrispr.app("agent:reserve"),
        // Fees are going to the common pool
        evmcrispr.app("agent:1"),
        // Percentage values are represented in 18-decimal base
        toDecimals(entryTribute),
        toDecimals(exitTribute),
      ]),
      evmcrispr.installNewApp("migration-tools.open:mtb", [
        evmcrispr.app("wrappable-hooked-token-manager.open"),
        evmcrispr.app("agent:1"), // Common pool as Migration Tools' vault 1
        evmcrispr.app("agent:reserve"), // Reserve pool as Migration Tools' vault 2
        0,
      ]),
      evmcrispr.addPermissions(
        [
          [
            "disputable-voting.open",
            "augmented-bonding-curve.open:abc",
            "OPEN_TRADING_ROLE",
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
            "disputable-voting.open",
            "augmented-bonding-curve.open:abc",
            "ADD_COLLATERAL_TOKEN_ROLE",
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
          [
            "augmented-bonding-curve.open:abc",
            "agent:reserve",
            "TRANSFER_ROLE",
          ],
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
            evmcrispr.setOracle("migration-tools.open:mtb"),
          ],
        ],
        "disputable-voting.open"
      ),
      evmcrispr.revokePermissions(
        [
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
          [
            "disputable-voting.open",
            "dynamic-issuance.open",
            "UPDATE_SETTINGS_ROLE",
          ],
        ],
        true
      ),
      evmcrispr
        .call("augmented-bonding-curve.open:abc")
        .addCollateralToken(collateralTokenAddress, 1, 0, reserveRatio * PPM),
    ],
    ["disputable-voting.open"],
    { context: "Commons Upgrade" }
  );

  spinner.succeed();

  const gardenContext = await buildGardenContext(evmcrispr, signer);

  // Sign covenant
  await signAgreement(gardenContext);

  // Stake collateral action amount
  await stakeTokens(gardenContext);

  spinner = spinner.start("Forward Commons Upgrade script");

  const txReceipt = await (
    await signer.sendTransaction({
      ...encodedAction.action,
      gasLimit: TX_GAS_LIMIT,
      gasPrice: TX_GAS_PRICE,
    })
  ).wait();

  spinner = spinner.succeed(
    `Commons Upgrade script forwarded. Tx hash: ${txReceipt.transactionHash}`
  );

  // Vote on the commons upgrade vote
  await vote(gardenContext);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    spinner.fail();
    console.error(error);
    process.exit(1);
  });
