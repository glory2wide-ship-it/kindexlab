/**
 * Visitor-facing trust helpers for 맞춤 정보 packs.
 * Empty / “업데이트 중” cells must not be shown as if they were facts.
 */

import { isNewsPrimaryChannel } from "@/lib/entity/category-info/channel";
import { isNewsSearchFallbackUrl } from "@/lib/entity/category-info/news";
import type {
  CategoryInfoLink,
  CategoryInfoPayload,
  CategoryInfoRow,
} from "@/lib/entity/category-info/types";

export const UPDATING_PLACEHOLDER = "실시간 정보 업데이트 중";

/** True when a row value is still a soft placeholder, not a fact. */
export function isUpdatingValue(value?: string | null): boolean {
  const text = (value ?? "").trim();
  if (!text) return true;
  return /실시간\s*정보\s*업데이트\s*중|확인\s*중|준비\s*중|추가\s*수집\s*중/.test(text);
}

export function isFilledRow(row: Pick<CategoryInfoRow, "value">): boolean {
  return !isUpdatingValue(row.value);
}

/** Real press permalinks only (no Naver/Google search fallbacks). */
export function realNewsLinks(links: CategoryInfoLink[]): CategoryInfoLink[] {
  return links.filter((link) => link.href && !isNewsSearchFallbackUrl(link.href));
}

export const NEWS_SLA_MIN_REAL = 3;

export function meetsNewsSla(links: CategoryInfoLink[]): boolean {
  return realNewsLinks(links).length >= NEWS_SLA_MIN_REAL;
}

export type VisitorTrustView = {
  /** Rows safe to show visitors (placeholders stripped). */
  rows: CategoryInfoRow[];
  /** Real article links for the news block (search fallbacks demoted). */
  links: CategoryInfoLink[];
  /** Optional single soft search fallback, shown separately if needed. */
  searchFallback?: CategoryInfoLink;
  /** Hide the whole pack — nothing trustworthy to show. */
  hideSection: boolean;
  /** Soften badge / copy when pack is thin but not empty. */
  thin: boolean;
  visitorFillRate: number;
};

/**
 * Derive what the detail page should actually render from an enriched payload.
 */
export function toVisitorTrustView(payload: CategoryInfoPayload): VisitorTrustView {
  const rows = payload.rows.filter(isFilledRow);
  const real = realNewsLinks(payload.links);
  const searchFallback = payload.links.find((link) => isNewsSearchFallbackUrl(link.href));
  const hasChips = payload.chips.some((chip) => chip.items.length > 0);
  const hasSpark =
    (payload.sparkline?.points.length ?? 0) >= 2 ||
    (payload.sparklines ?? []).some((s) => s.points.length >= 2);
  const hasSynopsis = Boolean(payload.synopsis?.trim());

  const newsPrimary = isNewsPrimaryChannel(payload.channel);
  const newsOk = meetsNewsSla(payload.links);

  // News-primary: require SLA before showing the section as “filled”.
  if (newsPrimary) {
    const hideSection = !newsOk && rows.length === 0 && !hasChips && !hasSpark && !hasSynopsis;
    const visitorFillRate = newsOk ? 1 : real.length / NEWS_SLA_MIN_REAL;
    return {
      rows,
      links: real.slice(0, 5),
      searchFallback: newsOk ? undefined : searchFallback,
      hideSection,
      thin: !newsOk,
      visitorFillRate: Math.min(1, Math.max(0, visitorFillRate)),
    };
  }

  const hideSection =
    rows.length === 0 && real.length === 0 && !hasChips && !hasSpark && !hasSynopsis;

  const attempted = Math.max(payload.rows.length, 1);
  const visitorFillRate =
    rows.length / attempted + (real.length > 0 ? 0 : 0);

  return {
    rows,
    links: real.slice(0, 5),
    searchFallback: real.length >= 2 ? undefined : searchFallback,
    hideSection,
    thin: rows.length < 2 && real.length < 2,
    visitorFillRate: Math.min(1, rows.length / attempted),
  };
}
