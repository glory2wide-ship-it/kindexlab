import type { ContextSource } from "@/lib/context/types";
import { searchPublicGrants } from "@/lib/public-data/grants";
import { summarizeHousingPublicData } from "@/lib/public-data/housing";
import { hasDataGoKrKey } from "@/lib/public-data/key";

function grantToSource(row: {
  title: string;
  url?: string;
  agency?: string;
  summary?: string;
  deadline?: string;
  target?: string;
  source: string;
}): ContextSource | undefined {
  if (!row.url) return undefined;
  const bits = [row.agency, row.deadline, row.target, row.summary]
    .filter(Boolean)
    .join(" · ");
  return {
    title: row.title,
    url: row.url,
    publisher:
      row.source === "gov24"
        ? "보조금24"
        : row.source.startsWith("welfare")
          ? "복지로"
          : "기업마당",
    snippet: bits.slice(0, 220),
    tier: "web",
  };
}

/**
 * Official public-data docs for RAG (글생성). Soft-fails to [].
 */
export async function collectPublicDataContextSources(input: {
  keyword: string;
  boardSlug?: string;
  entityType?: string;
}): Promise<{ sources: ContextSource[]; providers: string[] }> {
  if (!hasDataGoKrKey()) return { sources: [], providers: [] };
  const providers: string[] = [];
  const sources: ContextSource[] = [];
  const keyword = input.keyword.trim();
  if (!keyword) return { sources, providers };

  const grantish =
    input.boardSlug?.includes("grant") ||
    input.boardSlug?.includes("subsidy") ||
    input.boardSlug === "government-support-fund" ||
    input.boardSlug === "government-subsidy-search" ||
    input.boardSlug === "startup-franchise-index" ||
    input.entityType === "subsidy" ||
    /지원금|보조금|복지|창업|중소기업|소상공인/.test(keyword);

  const housingish =
    input.boardSlug?.includes("housing") ||
    input.entityType === "region" ||
    /아파트|실거래|분양|전세|매매/.test(keyword);

  if (grantish) {
    const grants = await searchPublicGrants(keyword, {
      limit: 6,
      includeBiz: true,
    });
    if (grants.length) {
      providers.push("public-data:grants");
      for (const grant of grants) {
        const source = grantToSource(grant);
        if (source) sources.push(source);
      }
    }
  }

  if (housingish) {
    const housing = await summarizeHousingPublicData(keyword);
    if (housing?.tradeSummary || housing?.rentSummary) {
      providers.push("public-data:rtms");
      const region = housing.regionLabel ?? "";
      sources.push({
        title: `${keyword} 국토부 실거래 요약`,
        url: "https://rt.molit.go.kr/",
        publisher: "국토교통부 실거래가",
        snippet: [region, housing.tradeSummary, housing.rentSummary]
          .filter(Boolean)
          .join(" · ")
          .slice(0, 220),
        tier: "web",
      });
    }
  }

  return { sources, providers };
}
