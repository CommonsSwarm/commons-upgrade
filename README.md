# Commons Upgrade Script

Hardhat script to upgrade a Gardens to a Commons DAO.

## Usage

1. Set the signer account by creating a `mnemonic.txt` file containing the account's seed phrase.

2. Configure the following parameters on `scripts/commons-upgrade.ts` file:

   - `gardensDAOAddress`: The Gardens DAO address to be upgraded.
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

   The script will create a voting on the gardens' disputable voting app containing the encoded EVM script. It will also try to vote using the signer account.

## Vote execution

Once the commons upgrade voting has finished, you can execute the vote by running one of the following commands:

```sh
yarn run execute-latest-vote-rinkeby
```

or

```sh
yarn run execute-latest-vote-xdai
```
