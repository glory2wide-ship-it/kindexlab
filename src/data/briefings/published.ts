import { marketIndices, rankings, rankingsUpdatedAt } from "@/data/rankings";
import { composeChannelEdition } from "@/lib/briefing/compose";
import { editionDateTime } from "@/lib/briefing/dates";
import type { BriefingArticle, RankingsPayload } from "@/lib/types";
import type { PostChannel } from "@/lib/posts/types";

const payload: RankingsPayload = {
  updatedAt: rankingsUpdatedAt,
  status: "open",
  indices: marketIndices,
  items: rankings,
};

const ARCHIVE_DATES = ["2026-08-22", "2026-08-23", "2026-08-24"] as const;
const ARCHIVE_CHANNELS: PostChannel[] = ["entertainment", "politics"];

let cached: BriefingArticle[] | undefined;

export function publishedBriefings(): BriefingArticle[] {
  if (!cached) {
    cached = ARCHIVE_DATES.flatMap((date) =>
      ARCHIVE_CHANNELS.flatMap((channel) =>
        composeChannelEdition(payload, channel, date, editionDateTime(date)),
      ),
    );
  }
  return cached;
}
