import { resolveDetailFacts } from "@/lib/boards/detail-facts";
import { resolveEntertainmentFacts } from "@/lib/boards/entertainment-facts";
import { buildTvProgramProfile, tvProgramGenreLabel } from "@/lib/boards/tv-program-profile";
import { entityNarrativeSummary } from "@/lib/entity/index-blurb";
import {
  isNewsPrimaryChannel,
  resolveCategoryInfoChannel,
} from "@/lib/entity/category-info/channel";
import {
  buildRelatedNewsLinks,
  ensureMinNewsLinks,
  naverNewsUrl,
} from "@/lib/entity/category-info/news";
import type {
  CategoryInfoChipGroup,
  CategoryInfoLink,
  CategoryInfoPayload,
  CategoryInfoRow,
} from "@/lib/entity/category-info/types";
import { formatCompact, formatRate } from "@/lib/format";
import type { RankingEntity } from "@/lib/types";

const UPDATING = "실시간 정보 업데이트 중";

function nonemptyRows(rows: CategoryInfoRow[]): CategoryInfoRow[] {
  const seen = new Set<string>();
  const out: CategoryInfoRow[] = [];
  for (const row of rows) {
    if (!row.value.trim()) continue;
    if (seen.has(row.label)) continue;
    seen.add(row.label);
    const multiline = Boolean(row.multiline || row.value.includes("\n"));
    const max = multiline ? 720 : 320;
    const value =
      row.value.length > max ? `${row.value.slice(0, max - 1).trimEnd()}…` : row.value;
    out.push({ ...row, value, multiline: multiline || undefined });
  }
  return out;
}

function nonemptyChips(chips: CategoryInfoChipGroup[]): CategoryInfoChipGroup[] {
  const seen = new Set<string>();
  const out: CategoryInfoChipGroup[] = [];
  for (const chip of chips) {
    const items = chip.items.map((item) => item.trim()).filter(Boolean);
    if (!items.length || seen.has(chip.label)) continue;
    seen.add(chip.label);
    out.push({ ...chip, items });
  }
  return out;
}

function fromDetailFacts(entity: RankingEntity): {
  rows: CategoryInfoRow[];
  chips: CategoryInfoChipGroup[];
  synopsis?: string;
  notice?: string;
  links: CategoryInfoLink[];
} {
  const facts = resolveDetailFacts(entity);
  if (!facts) {
    return { rows: [], chips: [], links: [] };
  }
  return {
    rows: facts.rows.map((row) => ({
      label: row.label,
      value: row.value,
      href: row.href,
      emphasize: row.label.includes("소속사") || row.label.includes("채널"),
    })),
    chips: (facts.chips ?? []).map((chip) => ({ label: chip.label, items: chip.items })),
    synopsis: entityNarrativeSummary(facts.synopsis),
    notice: facts.notice,
    links: (facts.links ?? []).map((link) => ({
      title: link.title,
      href: link.href,
      source: "관련 링크",
    })),
  };
}

function fromEntertainment(entity: RankingEntity): {
  rows: CategoryInfoRow[];
  chips: CategoryInfoChipGroup[];
  synopsis?: string;
} {
  const facts = resolveEntertainmentFacts(entity);
  if (!facts) return { rows: [], chips: [] };
  return {
    rows: facts.rows.map((row) => ({
      label: row.label,
      value: row.value,
      emphasize: row.label === "소속사" || row.label === "플랫폼",
    })),
    chips: (facts.chips ?? []).map((chip) => ({ label: chip.label, items: chip.items })),
    synopsis: entityNarrativeSummary(facts.synopsis),
  };
}

function fromTv(entity: RankingEntity): {
  rows: CategoryInfoRow[];
  chips: CategoryInfoChipGroup[];
  synopsis?: string;
} {
  const profile = buildTvProgramProfile(entity);
  if (!profile) return { rows: [], chips: [] };
  const rows: CategoryInfoRow[] = [
    { label: "방송 채널", value: profile.channel, emphasize: true },
    { label: "최근 본방송", value: profile.lastBroadcast },
  ];
  if (profile.rerunTime) {
    rows.push({ label: "재방송", value: profile.rerunTime });
  }
  if (profile.genre) {
    rows.push({
      label: "장르",
      value: tvProgramGenreLabel(profile.genre) || profile.genre,
    });
  }
  if (entity.measurement) {
    rows.push({
      label: "닐슨코리아 발표",
      value: `${entity.measurement.label} ${formatCompact(entity.measurement.value)}${entity.measurement.unit}${
        entity.measurement.changeRate !== undefined
          ? ` · 직전 대비 ${formatRate(entity.measurement.changeRate)}`
          : ""
      }`,
      emphasize: true,
    });
  }
  return {
    rows,
    chips: profile.cast.length
      ? [{ label: "최근 출연자", items: profile.cast.slice(0, 8) }]
      : [],
    synopsis: entityNarrativeSummary(profile.plotSummary),
  };
}

function musicChartRows(entity: RankingEntity): CategoryInfoRow[] {
  const rows: CategoryInfoRow[] = [];
  const ent = fromEntertainment(entity);
  rows.push(...ent.rows);
  if (entity.rank > 0) {
    rows.push({
      label: "KinDex 음원 보드 순위",
      value: `${entity.rank}위`,
      emphasize: true,
    });
  }
  rows.push({
    label: "멜론 차트",
    value: UPDATING,
    emphasize: true,
  });
  rows.push({
    label: "출처",
    value: "음원 상세는 멜론 공개 차트를 우선 수집·표시합니다.",
  });
  return rows;
}

function housingRows(entity: RankingEntity): CategoryInfoRow[] {
  return [
    { label: "단지/지역", value: entity.name, emphasize: true },
    { label: "최근 2개월 실거래가(평수별)", value: UPDATING, emphasize: true },
    { label: "신규 분양가(평수별)", value: UPDATING },
    {
      label: "매매·전세·월세 추이",
      value: UPDATING,
    },
  ];
}

function subsidyRows(entity: RankingEntity, links: CategoryInfoLink[]): {
  rows: CategoryInfoRow[];
  links: CategoryInfoLink[];
} {
  const detail = fromDetailFacts(entity);
  const home =
    detail.links.find((l) => /홈페이지|신청|공식/.test(l.title)) ||
    detail.rows.find((r) => r.href)?.href;
  const rows: CategoryInfoRow[] = [
    { label: "지원 사업", value: entity.name, emphasize: true },
    {
      label: "주관 기관 홈페이지",
      value: home && typeof home === "string" ? "공식 안내 바로가기" : UPDATING,
      href: typeof home === "string" ? home : undefined,
      emphasize: true,
    },
    { label: "신청 기간", value: UPDATING },
    { label: "신청 자격·조건", value: UPDATING },
    { label: "준비사항", value: UPDATING },
  ];
  return {
    rows: nonemptyRows([...detail.rows.filter((r) => !/순위|등락/.test(r.label)), ...rows]),
    links: ensureMinNewsLinks(entity.name, [...detail.links, ...links], 3),
  };
}

function newsExtrasForChannel(channel: string): string[] {
  if (channel === "recipe") return ["레시피", "만드는법", "블로그"];
  if (channel === "health") return ["건강", "증상", "병원"];
  if (channel === "car") return ["시승", "가격", "리뷰"];
  if (channel === "housing") return ["실거래", "분양", "전세"];
  if (channel === "stock" || channel === "overseas_stock") return ["주가", "실적", "공시"];
  if (channel === "finance") return ["금리", "상품", "은행"];
  if (channel === "domestic_travel" || channel === "overseas_travel") {
    return ["여행", "명소", "후기"];
  }
  if (channel === "weekend_outing") return ["나들이", "주차", "입장료"];
  if (channel === "local_policy") return ["지자체", "정책", "발표"];
  if (channel === "issue_keyword") return ["속보", "여론", "해설"];
  if (channel === "political_pundit") return ["방송", "유튜브", "칼럼"];
  if (channel === "game") return ["업데이트", "이벤트", "랭킹"];
  if (channel === "trot") return ["히트곡", "방송", "소속사"];
  return ["속보", "이슈", "해설"];
}

/**
 * Build channel-tailored detail payload for ItemDetailCategoryInfo.
 * Prefer curated packs; fall back to news links + status copy when sparse.
 */
export function buildCategoryInfoPayload(entity: RankingEntity): CategoryInfoPayload {
  const resolved = resolveCategoryInfoChannel(entity);
  const now = new Date().toISOString();
  const newsPrimary = isNewsPrimaryChannel(resolved.channel);
  const includeWebBlog =
    resolved.channel === "recipe" ||
    resolved.channel === "domestic_travel" ||
    resolved.channel === "overseas_travel" ||
    resolved.channel === "weekend_outing";

  let rows: CategoryInfoRow[] = [];
  let chips: CategoryInfoChipGroup[] = [];
  let synopsis: string | undefined;
  let notice: string | undefined;
  let links: CategoryInfoLink[] = [];
  let statusMessage: string | undefined;

  const detail = fromDetailFacts(entity);
  const entertainment = fromEntertainment(entity);

  switch (resolved.channel) {
    case "kpop":
    case "star":
    case "movie":
    case "webtoon":
    case "performance":
    case "exhibition": {
      rows = nonemptyRows([...entertainment.rows, ...detail.rows]);
      chips = nonemptyChips([...entertainment.chips, ...detail.chips]);
      synopsis = entertainment.synopsis || detail.synopsis;
      notice = detail.notice;
      links = detail.links;
      break;
    }
    case "book": {
      // Table-only 맞춤 정보 — do not merge hero profile rows (작가/출판사) or they duplicate.
      rows = [
        { label: "도서명", value: entity.name, emphasize: true },
        { label: "작가", value: UPDATING, emphasize: true },
        { label: "출판사", value: UPDATING },
        { label: "서점/판매처", value: UPDATING },
        { label: "출간·판형", value: UPDATING },
      ];
      chips = [];
      synopsis = undefined;
      notice = detail.notice;
      links = detail.links.length
        ? detail.links
        : buildRelatedNewsLinks(entity.name, newsExtrasForChannel("book"));
      break;
    }
    case "weekend_outing":
    case "youtuber":
    case "politics_youtube": {
      rows = nonemptyRows([...entertainment.rows, ...detail.rows]);
      chips = nonemptyChips([...entertainment.chips, ...detail.chips]);
      synopsis = entertainment.synopsis || detail.synopsis;
      notice = detail.notice;
      links = detail.links;
      break;
    }
    case "food": {
      rows = nonemptyRows([...entertainment.rows, ...detail.rows]);
      chips = nonemptyChips([...entertainment.chips, ...detail.chips]);
      synopsis = entertainment.synopsis || detail.synopsis;
      notice =
        detail.notice ||
        "맛집 정보·영업시간은 변동될 수 있으며, 방문 전 공식 안내를 확인해 주세요. 광고·제휴 링크가 포함될 수 있습니다.";
      links = detail.links;
      break;
    }
    case "trot": {
      rows = nonemptyRows([
        ...entertainment.rows,
        { label: "소속사", value: entertainment.rows.find((r) => r.label === "소속사")?.value || UPDATING },
        {
          label: "최근 히트곡",
          value:
            entertainment.chips.find((c) => /히트|곡/.test(c.label))?.items.slice(0, 3).join(" · ") ||
            UPDATING,
        },
      ]);
      chips = nonemptyChips(entertainment.chips);
      synopsis = entertainment.synopsis;
      links = buildRelatedNewsLinks(entity.name, newsExtrasForChannel("trot"));
      break;
    }
    case "tv_ratings": {
      const tv = fromTv(entity);
      rows = nonemptyRows(tv.rows);
      chips = nonemptyChips(tv.chips);
      synopsis = tv.synopsis;
      links = buildRelatedNewsLinks(entity.name, ["시청률", "방송", "출연"]);
      break;
    }
    case "music": {
      rows = nonemptyRows(musicChartRows(entity));
      chips = nonemptyChips(entertainment.chips);
      synopsis = entertainment.synopsis;
      links = [
        {
          title: `${entity.name} 멜론 검색`,
          href: `https://www.melon.com/search/total/index.htm?q=${encodeURIComponent(entity.name)}`,
          source: "멜론",
        },
        {
          title: `${entity.name} 관련 뉴스`,
          href: naverNewsUrl(entity.name),
          source: "네이버 뉴스",
        },
        ...buildRelatedNewsLinks(entity.name, ["음원", "차트"]),
      ];
      break;
    }
    case "gov_subsidy":
    case "travel_grant": {
      const subsidy = subsidyRows(entity, detail.links);
      rows = subsidy.rows;
      links = subsidy.links;
      synopsis = detail.synopsis;
      notice = "지원 자격·일정은 주관 기관 공지에 따라 수시로 변경될 수 있습니다.";
      break;
    }
    case "housing": {
      rows = housingRows(entity);
      links = buildRelatedNewsLinks(entity.name, newsExtrasForChannel("housing"));
      statusMessage = UPDATING;
      break;
    }
    default: {
      rows = nonemptyRows([...detail.rows, ...entertainment.rows]);
      chips = nonemptyChips([...detail.chips, ...entertainment.chips]);
      synopsis = detail.synopsis || entertainment.synopsis;
      notice = detail.notice;
      links = detail.links;
      break;
    }
  }

  if (newsPrimary || rows.length === 0) {
    statusMessage = statusMessage || UPDATING;
    links = ensureMinNewsLinks(
      entity.name,
      links.length
        ? links
        : buildRelatedNewsLinks(entity.name, newsExtrasForChannel(resolved.channel), {
            includeWeb: includeWebBlog,
            includeBlog: includeWebBlog,
          }),
      3,
    );
    if (rows.length === 0) {
      rows = [{ label: "상태", value: UPDATING, emphasize: true }];
    }
  } else {
    links = ensureMinNewsLinks(
      entity.name,
      links.length
        ? links
        : buildRelatedNewsLinks(entity.name, newsExtrasForChannel(resolved.channel), {
            includeWeb: includeWebBlog,
            includeBlog: includeWebBlog,
          }),
      3,
    );
  }

  const sparse =
    newsPrimary ||
    rows.every((row) => row.value === UPDATING) ||
    (rows.length <= 1 && !synopsis && chips.length === 0);

  return {
    category: resolved.category,
    channel: resolved.channel,
    channelLabel: resolved.channelLabel,
    entityName: entity.name,
    entitySlug: entity.slug,
    updatedAt: now,
    sparse,
    statusMessage: sparse ? statusMessage || UPDATING : statusMessage,
    rows: nonemptyRows(rows),
    chips: nonemptyChips(chips),
    synopsis: entityNarrativeSummary(synopsis),
    notice,
    links: links.slice(0, 5),
  };
}
