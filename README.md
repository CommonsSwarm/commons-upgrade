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

2. Configure the parameters on the `params.json` file.

3. Execute the script by running one of the following commands:

   ```sh
   yarn run commons-upgrade
   yarn run migration
   yarn run token-claiming
   yarn run abc-opening
   ```
