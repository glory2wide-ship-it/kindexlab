/**
 * Explains why retrieval came back thin for a keyword: how many documents each
 * provider returned and which filter discarded them.
 *
 *   npm run premium:why -- "키워드"
 */
import { retrieveNewsForKeyword } from "../src/lib/news/retrieve";
import { collectPremiumTargets } from "../src/lib/premium/keywords";
import type { PostChannel } from "../src/lib/posts/types";

async function probe(keyword: string) {
  for (const hours of [96, 336, 720]) {
    const retrieval = await retrieveNewsForKeyword(keyword, { limit: 8, lookbackHours: hours });
    const s = retrieval.stats;
    console.log(
      `  ${String(hours).padStart(3)}h · 수집 ${s.fetched} → 사용 ${s.kept} ` +
        `(오래됨 ${s.droppedStale} / 무관 ${s.droppedOffTopic} / 시세문구 ${s.droppedMarketTape} / ` +
        `UGC ${s.droppedUgc} / 비신뢰매체 ${s.droppedUntrusted} / 중복 ${s.droppedDuplicate})`,
    );
    if (s.kept >= 2) return;
  }
}

async function main() {
  const explicit = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
  const channel = process.argv.find((arg) => arg.startsWith("--channel="))?.split("=")[1];

  let keywords = explicit;
  if (!keywords.length) {
    const targets = await collectPremiumTargets({ channel: channel as PostChannel | undefined });
    keywords = targets.slice(0, 8).map((target) => target.keyword);
  }

  for (const keyword of keywords) {
    console.log(`\n── ${keyword}`);
    await probe(keyword);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
