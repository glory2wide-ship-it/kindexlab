import { stripRowQualifier } from "@/lib/boards/heatmap";
import { BOARDS, isDeskBoard } from "@/lib/boards/registry";
import { readBoard } from "@/lib/boards/store";
import { matchKeywordInRss } from "@/lib/context/rss-match";
import type { ContextSource, SignalFact } from "@/lib/context/types";
import { TYPE_LABEL } from "@/lib/format";
import { namesOverlap } from "@/lib/ingestion/names";
import type { RankingEntity } from "@/lib/types";

export interface SignalBriefResult {
  facts: SignalFact[];
  /** RSS hits that also qualify as citable sources. */
  rssSources: ContextSource[];
}

function sparkTrend(sparkline: number[]): "상승" | "하락" | "횡보" {
  if (sparkline.length < 2) return "횡보";
  const head = sparkline.slice(0, Math.ceil(sparkline.length / 2));
  const tail = sparkline.slice(Math.ceil(sparkline.length / 2));
  const avg = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
  const delta = avg(tail) - avg(head);
  if (delta > avg(head) * 0.03) return "상승";
  if (delta < -avg(head) * 0.03) return "하락";
  return "횡보";
}

async function findBoardNote(keyword: string): Promise<string | undefined> {
  for (const board of BOARDS) {
    if (isDeskBoard(board)) continue;
    const cached = await readBoard(board.slug);
    if (!cached?.ranking?.length) continue;
    const row = cached.ranking.find((entry) =>
      namesOverlap(stripRowQualifier(entry.name), keyword),
    );
    if (row?.note && row.note.length >= 12) return row.note;
  }
  return undefined;
}

/**
 * Tier 0 — builds verifiable context from heatmap entity data, board notes,
 * peer comparison, and category RSS matches. No LLM involved.
 */
export async function buildSignalBrief(input: {
  keyword: string;
  entity?: RankingEntity;
  related?: RankingEntity[];
}): Promise<SignalBriefResult> {
  const { keyword, entity, related = [] } = input;
  const facts: SignalFact[] = [];

  if (entity) {
    const label = TYPE_LABEL[entity.type] ?? entity.type;
    const rankDelta = entity.previousRank - entity.rank;
    if (rankDelta !== 0) {
      facts.push({
        kind: "rank",
        text: `${keyword}은(는) ${label} 히트맵에서 ${entity.previousRank}위에서 ${entity.rank}위로 ${rankDelta > 0 ? "올랐다" : "내렸다"}.`,
      });
    } else {
      facts.push({
        kind: "rank",
        text: `${keyword}은(는) ${label} 히트맵 ${entity.rank}위에 머물고 있다.`,
      });
    }

    const sourceTag = entity.tags?.[0];
    if (sourceTag) {
      facts.push({
        kind: "source",
        text: `${keyword}의 수집 근거는 ${sourceTag} 피드와 실시간 차트·검색 신호다.`,
      });
    }

    if (entity.measurement) {
      const m = entity.measurement;
      facts.push({
        kind: "measurement",
        text: `${m.source} 기준 ${m.label}은(는) ${m.value}${m.unit}로 집계됐다.`,
      });
    }

    if (entity.sparkline.length >= 4) {
      const trend = sparkTrend(entity.sparkline);
      facts.push({
        kind: "trend",
        text: `${keyword} 버즈 추세는 최근 스냅샷 기준 ${trend} 흐름이다.`,
      });
    }
  }

  const boardNote = await findBoardNote(keyword);
  if (boardNote) {
    facts.push({ kind: "board", text: boardNote });
  }

  const peers = related
    .filter((item) => item.name !== keyword)
    .slice(0, 3)
    .map((item) => `${item.name}(${item.rank}위)`);
  if (peers.length) {
    facts.push({
      kind: "peer",
      text: `같은 채널 상위권에는 ${peers.join(", ")} 등이 함께 올라와 있다.`,
    });
  }

  const rssSources = await matchKeywordInRss(keyword, 4);
  for (const hit of rssSources.slice(0, 2)) {
    facts.push({
      kind: "rss",
      text: `${hit.publisher} 헤드라인: ${hit.title}`,
    });
  }

  return { facts: facts.slice(0, 8), rssSources };
}
