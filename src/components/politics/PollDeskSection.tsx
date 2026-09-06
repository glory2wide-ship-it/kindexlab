import { AgencyPollComparisonBoard } from "@/components/politics/AgencyPollComparisonBoard";
import { getPollBoardForEntity, isPollComparableType } from "@/lib/politics/polls";
import type { RankingEntity } from "@/lib/types";

/**
 * Poll comparison data only — never render editorial template prose.
 * Narrative columns come from Gemini (오늘의 분석 / overnight briefing) when ready.
 */
export async function PollDeskSection({
  entity,
}: {
  entity: RankingEntity;
  related?: RankingEntity[];
}) {
  if (!isPollComparableType(entity.type)) return null;
  const polls = await getPollBoardForEntity(entity);
  if (!polls) return null;

  return <AgencyPollComparisonBoard snapshot={polls} />;
}
