import { enrichBriefingWithAi } from "../src/lib/briefing/ai-main";
import { composeChannelEdition } from "../src/lib/briefing/compose";
import { editionDateTime } from "../src/lib/briefing/dates";
import { channelUsesBoardBriefing, composeBoardChannelEdition } from "../src/lib/briefing/from-boards";
import { persistEdition } from "../src/lib/briefing/persist";
import { isPersistableBriefing } from "../src/lib/briefing/quality";
import { briefingRelatedKeywords } from "../src/lib/premium/briefing-editorial";
import { parseChannelFromSlug } from "../src/lib/briefing/store";
import { delay } from "../src/lib/premium/batch";
import { getRankings } from "../src/lib/providers/trends";
import type { BriefingArticle } from "../src/lib/types";
import type { PostChannel } from "../src/lib/posts/types";

const FALLBACK_SLUGS = [
  "2026-09-02-economy-inflation-sentiment-index",
  "2026-09-02-culture-daily",
  "2026-09-02-culture-health-info-ranking",
  "2026-09-02-culture-car-review-ranking",
];

async function composeChannelDraft(
  channel: PostChannel,
  editionDate: string,
): Promise<BriefingArticle[]> {
  const publishedAt = editionDateTime(editionDate);
  if (channelUsesBoardBriefing(channel)) {
    return composeBoardChannelEdition(channel, editionDate, publishedAt);
  }
  const payload = await getRankings();
  return composeChannelEdition(payload, channel, editionDate, publishedAt);
}

function enrichmentRelatedKeywords(article: BriefingArticle, edition: BriefingArticle[]): string[] {
  return briefingRelatedKeywords(article, edition);
}

function categoryHint(article: BriefingArticle): string {
  if (article.kind === "main") return article.channel ?? "entertainment";
  return article.category ?? article.deskLabel ?? article.channel ?? "entertainment";
}

async function main() {
  const slugs = process.argv.filter((arg) => arg.startsWith("2026-"));
  const targets = slugs.length ? slugs : FALLBACK_SLUGS;
  const editionDate = targets[0]?.slice(0, 10) ?? "2026-09-02";
  const channels = [...new Set(targets.map((slug) => parseChannelFromSlug(slug)).filter(Boolean))] as PostChannel[];

  const draftsByChannel = new Map<PostChannel, BriefingArticle[]>();
  for (const channel of channels) {
    draftsByChannel.set(channel, await composeChannelDraft(channel, editionDate));
  }

  const saved: { slug: string; title: string; wordCount?: number }[] = [];
  let skippedQuality = 0;

  for (const slug of targets) {
    const channel = parseChannelFromSlug(slug);
    if (!channel) {
      console.warn(`skip unknown slug: ${slug}`);
      continue;
    }
    const edition = draftsByChannel.get(channel) ?? [];
    const draft = edition.find((item) => item.slug === slug);
    if (!draft) {
      console.warn(`skip missing draft: ${slug}`);
      continue;
    }

    console.log(`regenerating ${slug}…`);
    const article = await enrichBriefingWithAi(draft, {
      leadKeyword: draft.focusKeyword?.trim() || draft.title,
      relatedKeywords: enrichmentRelatedKeywords(draft, edition),
      categoryHint: categoryHint(draft),
    });
    const persistable = isPersistableBriefing(article);
    console.log(`  → wordCount=${article.wordCount ?? 0} persistable=${persistable}`);

    if (!persistable) {
      skippedQuality += 1;
      console.warn(`  ! quality gate failed — article will not be saved`);
    } else {
      // Persist each article immediately so a reboot does not lose progress.
      const result = await persistEdition([article]);
      console.log(`  → persisted kept=${result.kept}`);
      saved.push({
        slug: article.slug,
        title: article.title,
        wordCount: article.wordCount,
      });
    }

    await delay(5_000);
  }

  if (!saved.length) {
    console.error("No articles passed quality gate.");
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        regenerated: saved.length,
        skippedQuality,
        persisted: saved.length,
        templateFallback: saved.filter((item) => (item.wordCount ?? 0) < 500).length,
        slugs: saved,
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
