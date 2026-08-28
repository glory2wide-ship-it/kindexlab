import { AgencyPollComparisonBoard } from "@/components/politics/AgencyPollComparisonBoard";
import type { PollBoardSnapshot } from "@/lib/politics/polls";

export function PresidentialApprovalBoard({ snapshot }: { snapshot: PollBoardSnapshot }) {
  return <AgencyPollComparisonBoard snapshot={snapshot} />;
}
