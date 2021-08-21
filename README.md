# Commons Upgrade Script

Hardhat script to upgrade a Gardens to a Commons DAO.

The script uses the [EVMcrispr](https://github.com/CommonsSwarm/EVMcrispr) to encode an EVM script that does the following:

1. Install an Agent app that will act as the ABC (Augmented Bonding Curve) reserve.
2. Install the Augmented Bonding Curve app.
3. Install a Migration Tools app that will be used to migrate the Hatch tokens.
4. Set and configure the Migration Tools' and ABC's permissions.
5. Revoke the Issuance's permissions as the ABC will be used instead.
6. Add a collateral token to the ABC.

## Usage

1. Set the signer account by creating a `mnemonic.txt` file on the root project directory containing the account's seed phrase.

2. Configure the following parameters on the `scripts/commons-upgrade.ts` file:

   - `gardensDAOAddress`: The Gardens DAO address to be upgraded.
   - `collateralTokenAddress`: Collateral token address to be used by the ABC.
   - `hatchMigrationToolsAddress`: Migration Tools app address installed on the Hatch DAO.
   - `entryTribute`: The entry tribute to be deducted from the buy orders made to the augmented bonding curve.
   - `exitTribute`: The exit tribute to be deducted from the sell orders made to the augmented bonding curve.
   - `reserveRatio`: The reserve ratio to be used for the gardens token buy and sell order calculations.

3. Execute the script by running one of the following commands:

   ```sh
   yarn run commons-upgrade-rinkeby
   ```

   or

   ```sh
   yarn run commons-upgrade-xdai
   ```

   The script will create a vote on the gardens' disputable voting app containing the encoded EVM script. It will also try to vote using the signer account.

## Vote execution

Once the commons upgrade voting has finished, you can execute the vote by running one of the following commands:

```sh
yarn run execute-latest-vote-rinkeby
```

or

```sh
yarn run execute-latest-vote-xdai
```
