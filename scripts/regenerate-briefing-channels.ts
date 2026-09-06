import { runDailyBriefingJob } from "../src/lib/briefing/job";
import type { PostChannel } from "../src/lib/posts/types";

const editionDate = process.argv.find((arg) => /^\d{4}-\d{2}-\d{2}$/.test(arg)) ?? "2026-09-02";
const channels = process.argv
  .filter((arg) => !arg.startsWith("-") && arg !== editionDate && /^[a-z]+$/.test(arg))
  .filter((arg): arg is PostChannel =>
    ["entertainment", "politics", "economy", "culture", "travel"].includes(arg),
  );

async function main() {
  const result = await runDailyBriefingJob({
    persist: true,
    force: true,
    editionDate,
    channels: channels.length ? channels : undefined,
    useGeminiBatch: process.env.GEMINI_USE_BATCH !== "0",
    onChannel: (channel, count) => console.log(`  ${channel}: ${count} articles`),
  });

  const low = result.articles.filter((item) => (item.wordCount ?? 0) < 500);
  console.log(
    JSON.stringify(
      {
        editionDate: result.editionDate,
        total: result.articles.length,
        templateFallback: low.length,
        slugs: low.map((item) => item.slug),
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
