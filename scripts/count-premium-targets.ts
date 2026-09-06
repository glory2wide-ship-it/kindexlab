import { collectPremiumTargets } from "../src/lib/premium/keywords";

async function main() {
  const all = await collectPremiumTargets();
  const heatmap = all.filter((t) => t.source === "heatmap").length;
  const board = all.filter((t) => t.source === "board").length;
  console.log(JSON.stringify({ total: all.length, heatmap, boardOnly: board }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
