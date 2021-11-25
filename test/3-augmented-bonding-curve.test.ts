// // it("should add the hatch contribution token as ABC's new collateral token", async () => {});

// import { EVMcrispr } from "@1hive/evmcrispr";
// import { Signer } from "@ethersproject/abstract-signer";
// import { buildCommonsUpgradeActions } from "../scripts/helpers/commons-upgrade";
// import { executeActions } from "./helpers";
// import { ENTRY_TRIBUTE, EXIT_TRIBUTE, RESERVE_RATIO } from "./params";

// describe("Augmented Bonding Curve", () => {
//   let commonsEVMcrispr: EVMcrispr;
//   let hatchEVMcrispr: EVMcrispr;
//   let executorSigner: Signer;

//   before("Set up evmcrispr", async () => {
//     commonsEVMcrispr = await EVMcrispr.create("", executorSigner);
//   });

//   before("Perform commons upgrade", async () => {
//     const actionsFns = await buildCommonsUpgradeActions(
//       commonsEVMcrispr,
//       hatchEVMcrispr,
//       ENTRY_TRIBUTE,
//       EXIT_TRIBUTE,
//       RESERVE_RATIO
//     );

//     await executeActions(actionsFns, executorSigner);
//   });

//   before("Perform migration", async () => {
//     await
//   })

//   before("Set up Augmented Bonding Curve", async () => {});
// });
