import { unstable_cache } from "next/cache";
import { getPresidentialPolls } from "@/lib/politics/polls";

/**
 * Presidential approval desk — poll comparison data only.
 * Narrative columns never come from editorial templates; use Gemini briefings /
 * 오늘의 분석 when those pipelines succeed.
 */
const cachedPoliticsDeskCopy = unstable_cache(
  async () => {
    const polls = await getPresidentialPolls();
    return { polls };
  },
  ["politics-desk-copy-v21"],
  { revalidate: 3600 },
);

export async function loadPoliticsDeskCopy() {
  try {
    return await cachedPoliticsDeskCopy();
  } catch {
    return { polls: await getPresidentialPolls() };
  }
}
