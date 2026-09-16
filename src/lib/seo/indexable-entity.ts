/**
 * Search-index gates for entity detail pages.
 *
 * Ranking/politics URLs used to be submitted in sitemap.xml while meta robots
 * stayed noindex — wasting crawl budget (~735 of ~1265 discovered URLs in GSC).
 * Only name-quality + chain-grounded analysis pages may advertise index:true.
 */

import { isLikelyCelebrityName } from "@/lib/boards/celebrity";
import { isLikelyMovieTitle } from "@/lib/boards/movie-title";
import { isLikelyPartyName } from "@/lib/boards/party-name";
import { isLikelyTvProgramName } from "@/lib/boards/tv-program";
import { isUnusableRankName } from "@/lib/boards/demographics";
import { isGeminiAnalysis } from "@/lib/analysis/quality";
import type { CachedAnalysis } from "@/lib/analysis/store";
import { TYPE_LABEL, scoreLabel } from "@/lib/format";
import { isAllowedKrEnEntityName } from "@/lib/ingestion/names";
import type { EntityType, RankingEntity } from "@/lib/types";

/** Single-token / scrap fragments that must never compete in SERP. */
const FRAGMENT_NAME =
  /^(감탄|RP|1초|공개|속보|종합|오늘|이유|사랑|부모|학대|구금|마취|활짝|깜짝|고고|옛말|화제성|본방|테이블|MJ|인도)$/i;

const GUIDE_OR_TRIVIA_NOISE =
  /(공략|키우기|가이드|활용\s*전략|키\b|몸무게|나이\b|평가$|리뷰\s*모음)/i;

export function entityNameLooksIndexable(name: string, type?: EntityType): boolean {
  const cleaned = name.replace(/^\[[^\]]+\]\s*/, "").trim();
  if (!cleaned || cleaned.length < 2 || cleaned.length > 40) return false;
  if (isUnusableRankName(cleaned)) return false;
  if (!isAllowedKrEnEntityName(cleaned)) return false;
  if (FRAGMENT_NAME.test(cleaned.replace(/\s+/g, ""))) return false;
  if (GUIDE_OR_TRIVIA_NOISE.test(cleaned)) return false;

  if (type === "party_support") return isLikelyPartyName(cleaned);
  if (type === "celebrity") return isLikelyCelebrityName(cleaned);
  if (type === "movie") return isLikelyMovieTitle(cleaned);
  if (type === "tv_show" || type === "tv_rating") return isLikelyTvProgramName(cleaned);

  // Generic: prefer Hangul subjects or short Latin brands; drop sentence chrome.
  if (/[다요임]$/.test(cleaned) && cleaned.length >= 14) return false;
  if (MOVIE_OR_UI_CHROME(cleaned)) return false;
  return true;
}

function MOVIE_OR_UI_CHROME(name: string): boolean {
  return /(선택하신|해당하는\s*영화|일시적인\s*오류|\.go\.kr|네이버\s*웨일|인플루언서)/i.test(
    name,
  );
}

/**
 * True when this entity detail page may set robots index and appear in sitemap.
 * Requires a chain-grounded 오늘의 분석 so thin templates never enter the index.
 */
export function isIndexableEntityPage(
  entity: Pick<RankingEntity, "name" | "type" | "slug">,
  analysis?: Pick<CachedAnalysis, "provenance" | "keyword"> | null,
): boolean {
  if (!entityNameLooksIndexable(entity.name, entity.type)) return false;
  if (!analysis || !isGeminiAnalysis(analysis)) return false;
  if (analysis.keyword && !entityNameLooksIndexable(analysis.keyword, entity.type)) {
    return false;
  }
  return true;
}

/** SERP-oriented title — intent keyword before the brand template. */
export function entitySeoTitle(
  entity: Pick<RankingEntity, "name" | "type">,
  options?: { rateLabel?: string },
): string {
  const typeLabel = TYPE_LABEL[entity.type] ?? "이슈";
  const metric = scoreLabel(entity.type);
  if (entity.type === "party_support") {
    return `${entity.name} 지지율 · 정당 지지도`;
  }
  if (entity.type === "politician_support") {
    return `${entity.name} 지지도 · 정치인 지지율`;
  }
  if (entity.type === "tv_rating" || entity.type === "tv_show") {
    return `${entity.name} 시청률 · TV 화제성`;
  }
  if (entity.type === "movie") {
    return `${entity.name} 박스오피스 · 영화 화제성`;
  }
  if (options?.rateLabel) {
    return `${entity.name} ${typeLabel} · ${options.rateLabel}`;
  }
  return `${entity.name} ${typeLabel} · ${metric}`;
}

export function entitySeoDescription(
  entity: Pick<RankingEntity, "name" | "type" | "summary">,
): string {
  const typeLabel = TYPE_LABEL[entity.type] ?? "이슈";
  const summary = entity.summary?.trim();
  if (summary && summary.length >= 40) return summary.slice(0, 160);
  if (entity.type === "party_support" || entity.type === "politician_support") {
    return `${entity.name} ${typeLabel} 지지도와 여론·화제성 추이를 KinDex 지수로 확인하세요.`;
  }
  if (entity.type === "tv_rating" || entity.type === "tv_show") {
    return `${entity.name} 시청률·방송 화제성을 실시간 지수로 정리한 KinDex 상세 페이지입니다.`;
  }
  return `${entity.name} ${typeLabel} 화제성 지수와 오늘의 분석을 KinDex에서 확인하세요.`;
}

export function breadcrumbJsonLd(
  items: { name: string; url: string }[],
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
