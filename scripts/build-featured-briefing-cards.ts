/**
 * Build a slim featured-cards index for the landing briefing rail.
 *
 *   npx tsx scripts/build-featured-briefing-cards.ts
 */
import { rebuildFeaturedCardsIndex } from "@/lib/briefing/rebuild-featured-cards";

async function main() {
  const result = await rebuildFeaturedCardsIndex();
  console.log(JSON.stringify({ ok: true, ...result }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
