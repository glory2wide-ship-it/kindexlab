import { DailyBriefing } from "@/components/briefing/DailyBriefing";
import { AgencyPollComparisonBoard } from "@/components/politics/AgencyPollComparisonBoard";
import { kstDateString } from "@/lib/briefing/dates";
import { composeAgencyPollArticle } from "@/lib/politics/poll-briefing";
import { getPollBoardForEntity, isPollComparableType } from "@/lib/politics/polls";
import type { RankingEntity, RankingsPayload } from "@/lib/types";

export async function PollDeskSection({
  entity,
  market,
  related = [],
}: {
  entity: RankingEntity;
  market: RankingsPayload;
  related?: RankingEntity[];
}) {
  if (!isPollComparableType(entity.type)) return null;
  const polls = await getPollBoardForEntity(entity);
  if (!polls) return null;
  const briefing = composeAgencyPollArticle({
    polls,
    entity,
    market,
    editionDate: kstDateString(),
  });

  return (
    <div className="space-y-6">
      <AgencyPollComparisonBoard snapshot={polls} />
      <DailyBriefing briefing={briefing} related={related} />
    </div>
  );
}
