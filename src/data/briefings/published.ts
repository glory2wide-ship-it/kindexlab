import { dailyBriefing } from "@/data/briefing";
import { marketIndices, rankings, rankingsUpdatedAt } from "@/data/rankings";
import { composeEdition } from "@/lib/briefing/compose";
import { editionDateTime } from "@/lib/briefing/dates";
import type { BriefingArticle, RankingsPayload } from "@/lib/types";

const payload: RankingsPayload = {
  updatedAt: rankingsUpdatedAt,
  status: "open",
  indices: marketIndices,
  items: rankings,
};

function handcraftedMain(): BriefingArticle {
  return {
    ...dailyBriefing,
    slug: "2026-08-24-daily",
    kind: "main",
    category: "all",
    editionDate: "2026-08-24",
    relatedEntitySlugs: ["iu", "newjeans-hanni", "zzuyang", "running-man", "transit-love"],
  };
}

const august22 = composeEdition(payload, "2026-08-22", editionDateTime("2026-08-22"));
const august23 = composeEdition(payload, "2026-08-23", editionDateTime("2026-08-23"));
const august24Dives = composeEdition(payload, "2026-08-24", editionDateTime("2026-08-24")).filter(
  (article) => article.kind === "deep-dive",
);

export const publishedBriefings: BriefingArticle[] = [
  ...august22,
  ...august23,
  handcraftedMain(),
  ...august24Dives,
];
