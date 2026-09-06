import { collectArticleContext } from "../src/lib/context/collect-context";
import { canGenerateContext } from "../src/lib/context/score";

async function main() {
  const keyword = process.argv[2] ?? "BTS";
  const ctx = await collectArticleContext(keyword, {});
  console.log({
    keyword,
    score: ctx.score,
    canGenerate: canGenerateContext(ctx),
    signalFacts: ctx.signalFacts.length,
    newsCount: ctx.sources.filter((s) => s.tier === "news").length,
    sources: ctx.sources.length,
    tiers: ctx.sources.map((s) => s.tier),
    providers: ctx.providers,
    intentHints: ctx.intentHints.slice(0, 4),
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
