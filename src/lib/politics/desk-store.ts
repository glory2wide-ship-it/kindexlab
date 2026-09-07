import { unstable_cache } from "next/cache";
import { getPresidentialPollsLive } from "@/lib/politics/polls";

/**
 * Presidential approval desk — poll comparison data only.
 * Narrative columns never come from editorial templates; use Gemini briefings /
 * 오늘의 분석 when those pipelines succeed.
 */
const cachedPoliticsDeskCopy = unstable_cache(
  async () => {
    const polls = await getPresidentialPollsLive();
    return { polls };
  },
  ["politics-desk-copy-v22"],
  { revalidate: 3600 },
);

export async function loadPoliticsDeskCopy() {
  try {
    return await cachedPoliticsDeskCopy();
  } catch {
    return { polls: await getPresidentialPollsLive() };
  }
}
