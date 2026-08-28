import { unstable_cache } from "next/cache";
import { composeArticle } from "@/lib/briefing/compose";
import { editionDateTime, kstDateString } from "@/lib/briefing/dates";
import { composePoliticsDeskArticle } from "@/lib/politics/desk-article";
import { getPresidentialPolls } from "@/lib/politics/polls";
import { getRankings } from "@/lib/providers/trends";

const cachedPoliticsDeskCopy = unstable_cache(
  async (editionDate: string) => {
    const [polls, market] = await Promise.all([getPresidentialPolls(), getRankings()]);
    return {
      polls,
      explainer: composePoliticsDeskArticle({ polls, market, editionDate }),
      briefing: composeArticle(market, {
        editionDate,
        kind: "deep-dive",
        category: "politician_support",
        publishedAt: editionDateTime(editionDate, 8, 20),
      }),
    };
  },
  ["politics-desk-copy-v20"],
  { revalidate: 3600 },
);

export async function loadPoliticsDeskCopy() {
  const editionDate = kstDateString();
  try {
    return await cachedPoliticsDeskCopy(editionDate);
  } catch {
    const [polls, market] = await Promise.all([getPresidentialPolls(), getRankings()]);
    return {
      polls,
      explainer: composePoliticsDeskArticle({ polls, market, editionDate }),
      briefing: composeArticle(market, {
        editionDate,
        kind: "deep-dive",
        category: "politician_support",
        publishedAt: editionDateTime(editionDate, 8, 20),
      }),
    };
  }
}
