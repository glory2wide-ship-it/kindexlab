/**
 * LIVE heatmap rows from data.go.kr (보조금24·복지로·국토부 실거래).
 */
import { REGION_SEGMENTS } from "@/lib/boards/regions";
import { nowIso } from "@/lib/ingestion/http";
import type { ChartRow, SourceResult } from "@/lib/ingestion/types";
import { searchPublicGrants } from "@/lib/public-data/grants";
import { topTradedApartments } from "@/lib/public-data/housing";
import { hasDataGoKrKey } from "@/lib/public-data/key";
import { formatManwon } from "@/lib/public-data/rtms";

function result(id: string, label: string, items: ChartRow[], error?: string): SourceResult {
  return {
    id,
    label,
    ok: !error && items.length > 0,
    count: items.length,
    error: error ?? (items.length ? undefined : "no rows"),
    fetchedAt: nowIso(),
    items,
  };
}

async function subsidyLiveRows(boardSlug: string, query: string): Promise<ChartRow[]> {
  const grants = await searchPublicGrants(query, { limit: 24, includeBiz: true });
  return grants.slice(0, 20).map((grant, index) => ({
    rank: index + 1,
    title: grant.title,
    subtitle: grant.agency || grant.source,
    metric: Math.max(1, 40 - index),
    tags: [boardSlug, "live-chart", "public-data", grant.source],
    measurement: grant.deadline
      ? { value: index + 1, unit: "순위", label: grant.deadline.slice(0, 40), source: "보조금24/복지로" }
      : undefined,
  }));
}

async function housingLiveRows(): Promise<ChartRow[]> {
  const rows: ChartRow[] = [];
  for (const region of REGION_SEGMENTS.slice(0, 8)) {
    const tops = await topTradedApartments(region, { limit: 3 });
    for (const apt of tops) {
      rows.push({
        rank: rows.length + 1,
        title: apt.name,
        subtitle: `실거래 ${apt.deals}건 · 중위 ${formatManwon(apt.midManwon)}`,
        metric: apt.deals * 10 + Math.min(apt.midManwon / 1000, 50),
        volume: apt.deals,
        tags: ["housing-subscription-hotspot", "live-chart", "public-data", "rtms", region],
        measurement: {
          value: apt.midManwon,
          unit: "만원",
          label: "중위 매매가",
          source: "국토부 실거래가",
        },
      });
    }
  }
  return rows
    .sort((a, b) => (b.metric ?? 0) - (a.metric ?? 0))
    .slice(0, 24)
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

export async function fetchPublicDataLiveSources(): Promise<SourceResult[]> {
  if (!hasDataGoKrKey()) {
    return [
      result("public-data", "공공데이터 OpenAPI", [], "DATA_GO_KR_SERVICE_KEY unset"),
    ];
  }

  const out: SourceResult[] = [];
  try {
    const subsidy = await subsidyLiveRows("government-subsidy-search", "지원금");
    out.push(result("public-data-subsidy", "보조금24·복지로 LIVE", subsidy));
  } catch (error) {
    out.push(
      result(
        "public-data-subsidy",
        "보조금24·복지로 LIVE",
        [],
        error instanceof Error ? error.message : "failed",
      ),
    );
  }

  try {
    const support = await subsidyLiveRows("government-support-fund", "청년");
    out.push(result("public-data-support-fund", "정부지원금 LIVE", support));
  } catch (error) {
    out.push(
      result(
        "public-data-support-fund",
        "정부지원금 LIVE",
        [],
        error instanceof Error ? error.message : "failed",
      ),
    );
  }

  try {
    const travel = await subsidyLiveRows("travel-government-grant-ranking", "여행");
    out.push(result("public-data-travel-grant", "여행지원금 LIVE", travel));
  } catch (error) {
    out.push(
      result(
        "public-data-travel-grant",
        "여행지원금 LIVE",
        [],
        error instanceof Error ? error.message : "failed",
      ),
    );
  }

  try {
    const startup = await subsidyLiveRows("startup-franchise-index", "창업");
    out.push(result("public-data-startup", "창업·중소기업 지원 LIVE", startup));
  } catch (error) {
    out.push(
      result(
        "public-data-startup",
        "창업·중소기업 지원 LIVE",
        [],
        error instanceof Error ? error.message : "failed",
      ),
    );
  }

  try {
    const housing = await housingLiveRows();
    out.push(result("public-data-housing", "국토부 실거래 LIVE", housing));
  } catch (error) {
    out.push(
      result(
        "public-data-housing",
        "국토부 실거래 LIVE",
        [],
        error instanceof Error ? error.message : "failed",
      ),
    );
  }

  return out;
}
