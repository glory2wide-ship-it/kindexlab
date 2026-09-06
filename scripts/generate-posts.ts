import { generateSeoPost, regenerateAllPosts } from "../src/lib/content-generator";

async function main() {
  if (process.argv.includes("--all")) {
    const result = await regenerateAllPosts();
    console.log(JSON.stringify(result, null, 2));
    if (result.specOk.some((ok) => !ok)) process.exitCode = 1;
    return;
  }
  const force = process.argv.includes("--force");
  const result = await generateSeoPost({ force });
  console.log(
    JSON.stringify(
      {
        skipped: result.skipped,
        reason: result.reason ?? null,
        slug: result.post?.slug ?? null,
        wordCount: result.post?.wordCount ?? 0,
        characterCount: result.post?.characterCount ?? 0,
        usedOpenAi: result.usedOpenAi,
        compliant: result.spec?.ok ?? false,
        tapeRatio: result.spec?.tapeRatio ?? 0,
        failures: result.spec?.failures ?? [],
        persisted: result.persisted,
        supabase: result.supabase,
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
