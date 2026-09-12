import { catalogByType, politicsProducts, POLITICS_CATALOG } from "@/lib/politics/catalog";
import { POLITICS_TYPE_LABEL, POLITICS_TYPE_ORDER, type PoliticsEntityType } from "@/lib/politics/types";
import { slugify } from "@/lib/ingestion/names";
import { changeFromScores, scoreFromRank, sparklineFromHistory, volumeFromRank } from "@/lib/ingestion/score";
import type { RankingEntity } from "@/lib/types";

function hash(input: string): number {
  let value = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    value ^= input.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function history(values: number[]): RankingEntity["history"] {
  const labels = ["D-6", "D-5", "D-4", "D-3", "D-2", "D-1", "오늘"];
  return values.map((v, i) => ({ t: labels[i] ?? `${i}`, v }));
}

export function politicsSlug(type: PoliticsEntityType, name: string): string {
  return `pol-${type}-${slugify(name)}`;
}

export function seedPoliticsRankings(): RankingEntity[] {
  const items: RankingEntity[] = [];
  for (const type of POLITICS_TYPE_ORDER) {
    const rows = catalogByType(type);
    rows.forEach((entry, index) => {
      const rank = index + 1;
      const seed = hash(`${type}:${entry.name}`);
      const score = scoreFromRank(rank, rows.length, 920, 1780) + ((seed % 80) - 30);
      const prev = score / (1 + (((seed % 1700) - 850) / 10000));
      const fluctuationRate = changeFromScores(score, prev);
      const sparkline = sparklineFromHistory(
        [score * 0.92, score * 0.94, score * 0.96, score * 0.97, score * 0.98, prev],
        score,
      );
      const volume = volumeFromRank(rank, type === "subsidy" ? 110_000 : 80_000);
      const label = POLITICS_TYPE_LABEL[type];
      items.push({
        id: `pol-${slugify(entry.name)}`,
        slug: politicsSlug(type, entry.name),
        name: entry.name,
        nameEn: entry.nameEn,
        type,
        rank,
        previousRank: Math.max(1, rank + ((seed % 5) - 2)),
        buzzScore: Number(score.toFixed(2)),
        openScore: Number(prev.toFixed(2)),
        fluctuationRate,
        volume,
        sparkline,
        history: history(sparkline),
        tags: entry.tags,
        summary: `${entry.name}은(는) ${label} 5분봉 기준 ${rank}위입니다. 등락 ${fluctuationRate.toFixed(2)}%입니다.`,
        analysis: `${entry.name} 수급은 정치 뉴스 RSS·검색 언급·공개 시사 키워드를 합산한 정치 전용 스냅샷입니다. 공식 여론조사 수치가 아니라 화제성 대용치이며, 상세 해석은 일일 브리핑에서 이어집니다.`,
        products: politicsProducts(entry),
      });
    });
  }
  return items.sort((a, b) => b.buzzScore - a.buzzScore).map((item, index) => ({
    ...item,
    rank: index + 1,
  }));
}

export function politicsCatalogNames(): string[] {
  return POLITICS_CATALOG.map((item) => item.name);
}
