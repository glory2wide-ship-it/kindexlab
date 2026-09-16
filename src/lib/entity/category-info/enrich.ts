import { fetchNaverWebFallback } from "@/lib/context/fallback-naver";
import { fetchYoutubeFallback } from "@/lib/context/fallback-youtube";
import type { ContextSource } from "@/lib/context/types";
import type { CategoryInfoChannel } from "@/lib/entity/category-info/types";
import type {
  CategoryInfoLink,
  CategoryInfoPayload,
  CategoryInfoRow,
} from "@/lib/entity/category-info/types";
import { fetchText } from "@/lib/ingestion/http";
import { decodeHtml, stripTags } from "@/lib/ingestion/parse";
import { retrieveNewsForKeyword } from "@/lib/news/retrieve";

const UPDATING = "실시간 정보 업데이트 중";

type CrawlDoc = {
  title: string;
  url: string;
  publisher?: string;
  snippet?: string;
};

function plain(raw?: string): string | undefined {
  if (!raw) return undefined;
  const text = decodeHtml(stripTags(raw)).replace(/\s+/g, " ").trim();
  return text || undefined;
}

function isUpdating(value: string): boolean {
  return !value.trim() || value.includes(UPDATING) || value.includes("확인 중") || value.includes("준비 중");
}

function corpusOf(docs: CrawlDoc[]): string {
  return docs
    .map((doc) => `${doc.title} ${doc.snippet ?? ""}`)
    .join(" \n ")
    .slice(0, 12_000);
}

function firstMatch(text: string, patterns: RegExp[]): string | undefined {
  for (const pattern of patterns) {
    const hit = text.match(pattern);
    const value = hit?.[1]?.replace(/\s+/g, " ").trim();
    if (value && value.length >= 2 && value.length <= 80) return value;
  }
  return undefined;
}

function extractAgency(text: string): string | undefined {
  return firstMatch(text, [
    /소속사[:\s]*([가-힣A-Za-z0-9&.()\s]{2,40}?(?:엔터테인먼트|엔터|뮤직|Music|레이블|기획|아티스트)?)/,
    /(?:소속|계약)\s*([가-힣A-Za-z0-9&.]{2,30}(?:엔터테인먼트|엔터|뮤직))/,
  ]);
}

function extractHitSongs(text: string, name: string): string[] {
  const songs = new Set<string>();
  const patterns = [
    new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*(?:의)?\\s*(?:히트곡|대표곡|신곡|타이틀)\\s*[:\\s]*([가-힣A-Za-z0-9\\s]{2,40})`, "g"),
    /(?:히트곡|대표곡|타이틀곡|신곡)\s*[:\s]*([가-힣A-Za-z0-9\s]{2,40})/g,
    /['"‘“]([^'"’”]{2,30})['"’”]\s*(?:공개|발매|차트)/g,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const song = match[1]?.replace(/\s+/g, " ").trim();
      if (!song || song.includes(name) || song.length < 2) continue;
      songs.add(song);
      if (songs.size >= 3) return [...songs];
    }
  }
  return [...songs];
}

function extractSynopsis(docs: CrawlDoc[], name: string): string | undefined {
  for (const doc of docs) {
    const snippet = doc.snippet?.trim();
    if (!snippet || snippet.length < 40) continue;
    if (!snippet.includes(name) && !doc.title.includes(name)) continue;
    if (/등락|순위|시세|거래량/.test(snippet)) continue;
    return snippet.slice(0, 220);
  }
  return undefined;
}

function extractCast(text: string): string[] {
  const cast = new Set<string>();
  const block = firstMatch(text, [
    /(?:출연|캐스팅|출연진|등장인물)\s*[:\s]*([가-힣A-Za-z,\s·/]{4,120})/,
  ]);
  if (block) {
    for (const part of block.split(/[,·/]| 및 |와 |과 /)) {
      const name = part.trim();
      if (name.length >= 2 && name.length <= 20) cast.add(name);
      if (cast.size >= 6) break;
    }
  }
  return [...cast];
}

function extractHousingSnippet(text: string): string | undefined {
  return firstMatch(text, [
    /((?:매매|전세|월세|분양)[^\n]{0,20}?(?:\d[\d,.]*)\s*(?:억|만원|만)[^\n]{0,30})/,
    /(실거래[^\n]{0,40}?(?:\d[\d,.]*)\s*(?:억|만원)[^\n]{0,20})/,
  ]);
}

function upsertRow(rows: CategoryInfoRow[], label: string, value: string, emphasize?: boolean): CategoryInfoRow[] {
  let replaced = false;
  const next = rows.map((row) => {
    if (row.label !== label) return row;
    replaced = true;
    if (!isUpdating(row.value)) return row;
    return { ...row, value, emphasize: emphasize ?? row.emphasize };
  });
  if (!replaced) next.unshift({ label, value, emphasize });
  return next;
}

function dedupeRows(rows: CategoryInfoRow[]): CategoryInfoRow[] {
  const seen = new Set<string>();
  const out: CategoryInfoRow[] = [];
  for (const row of rows) {
    if (seen.has(row.label)) continue;
    seen.add(row.label);
    out.push(row);
  }
  return out;
}

function dedupeChips(
  chips: CategoryInfoPayload["chips"],
): CategoryInfoPayload["chips"] {
  const seen = new Set<string>();
  const out: CategoryInfoPayload["chips"] = [];
  for (const chip of chips) {
    if (!chip.items.length || seen.has(chip.label)) continue;
    seen.add(chip.label);
    out.push(chip);
  }
  return out;
}

function fillUpdatingRows(
  rows: CategoryInfoRow[],
  fillers: Array<{ label: string | RegExp; value?: string; emphasize?: boolean }>,
): CategoryInfoRow[] {
  let next = [...rows];
  for (const filler of fillers) {
    if (!filler.value) continue;
    if (typeof filler.label === "string") {
      next = upsertRow(next, filler.label, filler.value, filler.emphasize);
      continue;
    }
    const pattern = filler.label;
    next = next.map((row) =>
      pattern.test(row.label) && isUpdating(row.value)
        ? { ...row, value: filler.value!, emphasize: filler.emphasize ?? row.emphasize }
        : row,
    );
  }
  return next;
}

async function crawlNews(name: string): Promise<CrawlDoc[]> {
  try {
    const retrieval = await retrieveNewsForKeyword(name, {
      limit: 6,
      lookbackHours: 240,
      trustedOnly: false,
    });
    return retrieval.docs
      .filter((doc) => doc.link && doc.title)
      .slice(0, 5)
      .map((doc) => ({
        title: doc.title,
        url: doc.link!,
        publisher: doc.publisher,
        snippet: doc.snippet,
      }));
  } catch {
    return [];
  }
}

async function crawlWeb(name: string, channel: CategoryInfoChannel): Promise<CrawlDoc[]> {
  const preferBlog =
    channel === "recipe" ||
    channel === "food" ||
    channel === "domestic_travel" ||
    channel === "overseas_travel" ||
    channel === "weekend_outing";
  const preferOfficial =
    channel === "gov_subsidy" || channel === "travel_grant" || channel === "local_policy";
  try {
    const sources = await fetchNaverWebFallback(`${name} ${queryHint(channel)}`.trim(), 6, {
      preferBlog,
      preferOfficial,
    });
    return sources.map((source) => ({
      title: source.title,
      url: source.url,
      publisher: source.publisher,
      snippet: source.snippet,
    }));
  } catch {
    return [];
  }
}

function queryHint(channel: CategoryInfoChannel): string {
  switch (channel) {
    case "kpop":
    case "trot":
    case "star":
      return "소속사 히트곡";
    case "music":
      return "음원 차트 순위";
    case "movie":
      return "출연 시놉시스";
    case "tv_ratings":
      return "시청률 출연";
    case "webtoon":
      return "웹툰 줄거리 작가";
    case "youtuber":
    case "politics_youtube":
      return "유튜브 채널 구독자";
    case "gov_subsidy":
    case "travel_grant":
      return "지원금 신청 자격 기간";
    case "housing":
      return "실거래가 분양가";
    case "performance":
      return "공연 티켓 출연";
    case "exhibition":
      return "전시 입장료";
    case "book":
      return "작가 출판사 서평";
    case "food":
      return "맛집 주소 영업시간";
    default:
      return "최신 이슈";
  }
}

async function crawlYoutube(name: string): Promise<ContextSource[]> {
  try {
    return await fetchYoutubeFallback(name, 5);
  } catch {
    return [];
  }
}

/** Melon chart page — fill song chips when the artist appears on the live chart. */
async function crawlMelonChartHits(name: string): Promise<string[]> {
  try {
    const html = await fetchText("https://www.melon.com/chart/index.htm", {
      headers: { Referer: "https://www.melon.com/" },
      next: { revalidate: 3600 },
    });
    const songs: string[] = [];
    const rowRe =
      /<div class="ellipsis rank01">[\s\S]*?<a[^>]*>([^<]+)<\/a>[\s\S]*?<div class="ellipsis rank02">[\s\S]*?<a[^>]*>([^<]+)<\/a>/g;
    for (const match of html.matchAll(rowRe)) {
      const song = plain(match[1]);
      const artist = plain(match[2]);
      if (!song || !artist) continue;
      if (!artist.includes(name) && !name.includes(artist)) continue;
      songs.push(song);
      if (songs.length >= 3) break;
    }
    return songs;
  } catch {
    return [];
  }
}

function linksFromDocs(docs: CrawlDoc[], sourceLabel: string): CategoryInfoLink[] {
  return docs.slice(0, 5).map((doc) => ({
    title: doc.title.slice(0, 90),
    href: doc.url,
    source: doc.publisher || sourceLabel,
  }));
}

function mergeLinks(primary: CategoryInfoLink[], secondary: CategoryInfoLink[]): CategoryInfoLink[] {
  const seen = new Set<string>();
  const out: CategoryInfoLink[] = [];
  for (const link of [...primary, ...secondary]) {
    if (!link.href || seen.has(link.href)) continue;
    seen.add(link.href);
    out.push(link);
    if (out.length >= 5) break;
  }
  return out;
}

/**
 * Live crawl enrichment for ItemDetailCategoryInfo.
 * Uses news retrieval + Naver web/blog Open API (+ Melon chart / YouTube when useful).
 * Never throws — returns the base payload on soft failures.
 */
export async function enrichCategoryInfoPayload(
  base: CategoryInfoPayload,
): Promise<CategoryInfoPayload> {
  const name = base.entityName;
  const [newsDocs, webDocs] = await Promise.all([
    crawlNews(name),
    crawlWeb(name, base.channel),
  ]);

  const youtubeDocs =
    base.channel === "youtuber" || base.channel === "politics_youtube"
      ? await crawlYoutube(name)
      : [];

  const melonHits =
    base.channel === "music" || base.channel === "kpop" || base.channel === "trot"
      ? await crawlMelonChartHits(name)
      : [];

  const docs: CrawlDoc[] = [
    ...newsDocs,
    ...webDocs,
    ...youtubeDocs.map((doc) => ({
      title: doc.title,
      url: doc.url,
      publisher: doc.publisher,
      snippet: doc.snippet,
    })),
  ];
  const corpus = corpusOf(docs);

  let rows = [...base.rows];
  let chips = [...base.chips];
  let synopsis = base.synopsis;
  let statusMessage = base.statusMessage;
  let sparse = base.sparse;

  const agency = extractAgency(corpus);
  const hitSongs = melonHits.length ? melonHits : extractHitSongs(corpus, name);
  const cast = extractCast(corpus);
  const housing = extractHousingSnippet(corpus);
  const crawledSynopsis = extractSynopsis(docs, name);

  switch (base.channel) {
    case "kpop":
    case "trot":
    case "star":
    case "music": {
      if (agency) {
        rows = fillUpdatingRows(rows, [{ label: "소속사", value: agency, emphasize: true }]);
      }
      if (hitSongs.length) {
        rows = fillUpdatingRows(rows, [
          { label: /히트곡|대표곡|최근 히트/, value: hitSongs.join(" · ") },
        ]);
        const existing = chips.find((chip) => /히트|곡/.test(chip.label));
        if (existing) {
          chips = chips.map((chip) =>
            chip === existing ? { ...chip, items: hitSongs } : chip,
          );
        } else {
          chips = [...chips, { label: "최근 히트곡", items: hitSongs }];
        }
      }
      if (base.channel === "music" && hitSongs[0]) {
        rows = fillUpdatingRows(rows, [
          { label: "멜론 차트", value: `실시간 차트 노출 · ${hitSongs[0]}`, emphasize: true },
        ]);
      }
      break;
    }
    case "movie":
    case "tv_ratings":
    case "performance": {
      if (cast.length) {
        const label = base.channel === "tv_ratings" ? "최근 출연자" : "출연";
        const existing = chips.find((chip) => /출연|캐스트|등장/.test(chip.label));
        if (existing) {
          chips = chips.map((chip) =>
            chip === existing ? { ...chip, items: cast } : chip,
          );
        } else {
          chips = [...chips, { label, items: cast }];
        }
        rows = fillUpdatingRows(rows, [{ label: /출연/, value: cast.join(" · ") }]);
      }
      break;
    }
    case "youtuber":
    case "politics_youtube": {
      if (youtubeDocs[0]) {
        rows = fillUpdatingRows(rows, [
          {
            label: "유튜브 채널",
            value: youtubeDocs[0].publisher || name,
            emphasize: true,
          },
          {
            label: "채널 URL",
            value: youtubeDocs[0].url,
            emphasize: true,
          },
        ]);
        // Force URL into href when possible
        rows = rows.map((row) =>
          row.label === "채널 URL"
            ? { ...row, value: youtubeDocs[0]!.url, href: youtubeDocs[0]!.url }
            : row,
        );
        chips = [
          ...chips.filter((chip) => !/영상|조회/.test(chip.label)),
          {
            label: "최근 화제 영상 TOP",
            items: youtubeDocs.map((doc) => doc.title).slice(0, 5),
          },
        ];
      }
      break;
    }
    case "gov_subsidy":
    case "travel_grant": {
      const official = webDocs.find((doc) =>
        /\.go\.kr|korea\.kr|gov|지원|복지|청$|재단|공사/i.test(
          `${doc.url} ${doc.publisher ?? ""} ${doc.title}`,
        ),
      );
      if (official) {
        rows = fillUpdatingRows(rows, [
          {
            label: "주관 기관 홈페이지",
            value: official.title.slice(0, 60),
            emphasize: true,
          },
        ]);
        rows = rows.map((row) =>
          row.label.includes("주관 기관")
            ? { ...row, href: official.url, value: row.value === UPDATING ? official.title.slice(0, 60) : row.value }
            : row,
        );
      }
      const period = firstMatch(corpus, [
        /신청\s*기간[:\s]*([^\n.]{6,60})/,
        /(\d{4}\s*[.년/-]\s*\d{1,2}\s*[.월/-]\s*\d{1,2}\s*[~～-]\s*\d{4}\s*[.년/-]\s*\d{1,2}\s*[.월/-]\s*\d{1,2})/,
      ]);
      const eligibility = firstMatch(corpus, [
        /(?:신청\s*자격|지원\s*대상|자격\s*요건)[:\s]*([^\n.]{6,80})/,
      ]);
      if (period) rows = fillUpdatingRows(rows, [{ label: "신청 기간", value: period }]);
      if (eligibility) {
        rows = fillUpdatingRows(rows, [{ label: /신청 자격|자격·조건/, value: eligibility }]);
      }
      break;
    }
    case "housing": {
      if (housing) {
        rows = fillUpdatingRows(rows, [
          { label: /실거래가/, value: housing, emphasize: true },
        ]);
      }
      break;
    }
    case "webtoon":
    case "book":
    case "food":
    case "exhibition": {
      break;
    }
    default:
      break;
  }

  if (!synopsis) {
    synopsis = crawledSynopsis;
  }

  const crawledLinks = mergeLinks(
    linksFromDocs(newsDocs, "뉴스 수집"),
    mergeLinks(
      linksFromDocs(
        youtubeDocs.map((doc) => ({
          title: doc.title,
          url: doc.url,
          publisher: doc.publisher,
          snippet: doc.snippet,
        })),
        "유튜브",
      ),
      linksFromDocs(webDocs, "웹 수집"),
    ),
  );

  const links = mergeLinks(crawledLinks, base.links);
  const filledCount = rows.filter((row) => !isUpdating(row.value)).length;
  if (filledCount > 0 || links.length >= 3 || synopsis) {
    sparse = false;
    if (statusMessage === UPDATING && filledCount > 0) {
      statusMessage = undefined;
    }
  }
  if (sparse && links.length >= 3) {
    statusMessage = statusMessage || UPDATING;
  }

  return {
    ...base,
    rows: dedupeRows(rows),
    chips: dedupeChips(chips.filter((chip) => chip.items.length > 0)),
    synopsis,
    statusMessage,
    sparse,
    links: links.slice(0, 5),
    notice:
      base.notice ||
      "채널 맞춤 정보는 공개 뉴스·웹 문서를 주기적으로 수집해 보완합니다. 공식 발표와 다를 수 있습니다.",
    updatedAt: new Date().toISOString(),
  };
}
