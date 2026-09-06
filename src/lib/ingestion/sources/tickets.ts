import { kstDateString } from "@/lib/briefing/dates";
import { fetchJson, fetchText, nowIso } from "@/lib/ingestion/http";
import { stripTags } from "@/lib/ingestion/parse";
import type { ChartRow, SourceResult } from "@/lib/ingestion/types";

function result(id: string, label: string, items: ChartRow[], error?: string): SourceResult {
  return {
    id,
    label,
    ok: !error && items.length > 0,
    count: items.length,
    error: error ?? (items.length ? undefined : "empty"),
    fetchedAt: nowIso(),
    items,
  };
}

function cleanShowTitle(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, " ")
    .replace(/[〈〈]/g, "〈")
    .replace(/[〉〉]/g, "〉")
    .replace(/\s+/g, " ")
    .trim();
}

/** Infer 시/도 label from venue / tour suffix for `[지역] 공연명` seeds. */
export function regionHintFromTicket(title: string, venue?: string): string | undefined {
  const blob = `${title} ${venue ?? ""}`;
  const rules: [RegExp, string][] = [
    [/서울|충무|샤롯데|블루스퀘어|디큐브|올림픽공원|대학로|LG아트|링크아트|유니플렉스|정동극장|플러스씨어터/, "서울"],
    [/수원|성남|고양|용인|부천|안산|광명|의정부|김포|하남|시흥|평택|동탄|일산|경기/, "경기"],
    [/인천|송도|부평|강화|영종|청라/, "인천"],
    [/부산|벡스코|해운대|센텀/, "부산"],
    [/대구|계명/, "대구"],
    [/광주/, "광주"],
    [/대전/, "대전"],
    [/울산/, "울산"],
    [/세종|조치원/, "세종"],
    [/춘천|강릉|원주|속초|평창|양양|정선|영월|강원/, "강원"],
    [/청주|충주|제천|오송|단양|충북/, "충북"],
    [/천안|아산|공주|보령|내포|태안|충남|이천/, "충남"],
    [/전주|군산|익산|남원|전북/, "전북"],
    [/여수|순천|목포|담양|보성|광양|전남/, "전남"],
    [/경주|포항|구미|안동|울릉|영덕|경북/, "경북"],
    [/창원|김해|진주|통영|거제|남해|마산|경남/, "경남"],
    [/제주|서귀포|성산|애월|탐라/, "제주"],
  ];
  for (const [re, label] of rules) {
    if (re.test(blob)) return label;
  }
  return undefined;
}

export function formatTicketSeedName(title: string, venue?: string): string {
  const cleaned = cleanShowTitle(title);
  const region = regionHintFromTicket(cleaned, venue);
  return region ? `[${region}] ${cleaned}` : cleaned;
}

type InterparkRankRow = {
  rank?: string | number;
  previousRank?: string | number;
  goodsName?: string;
  placeName?: string;
  bookingPercent?: string | number;
  genre?: string;
  displayGenre?: string;
  goodsCode?: string;
  imageUrl?: string;
};

type InterparkRankingPayload = Record<string, InterparkRankRow[] | undefined>;

const INTERPARK_HEADERS = {
  Accept: "application/json",
  Referer: "https://tickets.interpark.com/contents/ranking",
  Origin: "https://tickets.interpark.com",
};

async function fetchInterparkGenre(rankingTypes: string, tag: string): Promise<ChartRow[]> {
  const url = `https://tickets.interpark.com/contents/api/ranking?period=D&page=1&pageSize=50&rankingTypes=${encodeURIComponent(rankingTypes)}`;
  const data = await fetchJson<InterparkRankingPayload>(url, { headers: INTERPARK_HEADERS });
  const rows = Object.values(data).flatMap((group) => (Array.isArray(group) ? group : []));
  const items: ChartRow[] = [];
  for (const [index, row] of rows.entries()) {
    const title = cleanShowTitle(row.goodsName ?? "");
    if (!title) continue;
    const rank = Number(row.rank) || index + 1;
    const prev = Number(row.previousRank);
    const pct = Number(row.bookingPercent);
    items.push({
      rank,
      previousRank: Number.isFinite(prev) && prev > 0 ? prev : undefined,
      title,
      subtitle: row.placeName,
      metric: Number.isFinite(pct) ? pct : Math.max(1, 60 - index),
      volume: Number.isFinite(pct) ? Math.round(pct * 10_000) : undefined,
      measurement: Number.isFinite(pct)
        ? { value: pct, unit: "%", label: "예매율", source: "NOL 인터파크" }
        : undefined,
      imageUrl: row.imageUrl?.startsWith("//") ? `https:${row.imageUrl}` : row.imageUrl,
      tags: ["NOL", "인터파크", tag, row.displayGenre ?? rankingTypes].filter(Boolean) as string[],
    });
  }
  return items;
}

async function fetchInterparkSources(): Promise<SourceResult[]> {
  const jobs: { id: string; label: string; type: string; tag: string }[] = [
    { id: "interpark-musical", label: "NOL 인터파크 뮤지컬 랭킹", type: "MUSICAL", tag: "뮤지컬" },
    { id: "interpark-concert", label: "NOL 인터파크 콘서트 랭킹", type: "CONCERT", tag: "콘서트" },
    { id: "interpark-drama", label: "NOL 인터파크 연극 랭킹", type: "DRAMA", tag: "연극" },
    { id: "interpark-classic", label: "NOL 인터파크 클래식/무용 랭킹", type: "CLASSIC", tag: "클래식" },
    { id: "interpark-exhibit", label: "NOL 인터파크 전시/행사 랭킹", type: "EXHIBIT", tag: "전시" },
  ];
  return Promise.all(
    jobs.map(async (job) => {
      try {
        const items = await fetchInterparkGenre(job.type, job.tag);
        return result(job.id, job.label, items);
      } catch (error) {
        return result(job.id, job.label, [], error instanceof Error ? error.message : "interpark error");
      }
    }),
  );
}

function parseYes24Titles(html: string): ChartRow[] {
  const items: ChartRow[] = [];
  const seen = new Set<string>();

  const push = (titleRaw: string, venue?: string, pct?: number) => {
    const title = cleanShowTitle(stripTags(titleRaw));
    if (!title || title.length < 2 || /예스24|랭킹|공연정보|error|준?비중입니다/i.test(title)) return;
    const key = title.replace(/\s+/g, "").toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    items.push({
      rank: items.length + 1,
      title,
      subtitle: venue?.trim() || undefined,
      metric: Number.isFinite(pct) ? (pct as number) : Math.max(1, 55 - items.length),
      measurement: Number.isFinite(pct)
        ? { value: pct as number, unit: "%", label: "예매율", source: "예스24" }
        : undefined,
      tags: ["예스24", "티켓 랭킹"],
    });
  };

  for (const match of html.matchAll(
    /class=['"]rlb-tit['"]>([^<]+)<\/p><p class=['"]rlb-sub-tit['"]>([\s\S]*?)<\/p><p class=['"]rank-best-point['"]><strong>([\d.]+)%<\/strong>/gi,
  )) {
    const venue = stripTags(match[2] ?? "")
      .split(/\n|<br\s*\/?>/i)
      .map((part) => part.trim())
      .filter(Boolean)
      .at(-1);
    push(match[1] ?? "", venue, Number(match[3]));
  }

  for (const match of html.matchAll(
    /class=['"]rank-list-tit['"]>\s*<a[^>]*>([^<]+)<\/a>[\s\S]*?(?:<\/div>){1,3}<div>([\s\S]*?)<\/div><div>([\d.]+)%<\/div>/gi,
  )) {
    const venue = stripTags(match[2] ?? "")
      .split(/\n|<br\s*\/?>/i)
      .map((part) => part.trim())
      .filter(Boolean)
      .at(-1);
    push(match[1] ?? "", venue, Number(match[3]));
  }

  if (items.length >= 8) return items.slice(0, 40);

  for (const match of html.matchAll(/class=['"]rlb-tit['"]>([^<]+)/gi)) {
    push(match[1] ?? "");
  }
  for (const match of html.matchAll(/class=['"]rank-list-tit['"]>\s*<a[^>]*>([^<]+)<\/a>/gi)) {
    push(match[1] ?? "");
  }
  return items.slice(0, 40);
}

async function fetchYes24Rank(): Promise<SourceResult> {
  const endTime = kstDateString();
  try {
    const body = new URLSearchParams({ pt: "1", ci: "0", et: endTime });
    const html = await fetchText("https://ticket.yes24.com/New/Rank/Ajax/RankList.aspx", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        Accept: "text/html,*/*",
        Origin: "https://ticket.yes24.com",
        Referer: "https://ticket.yes24.com/Rank/All",
        "X-Requested-With": "XMLHttpRequest",
      },
      body,
    });
    return result("yes24-ticket-rank", "예스24 티켓 랭킹", parseYes24Titles(html));
  } catch (error) {
    return result(
      "yes24-ticket-rank",
      "예스24 티켓 랭킹",
      [],
      error instanceof Error ? error.message : "yes24 error",
    );
  }
}

async function fetchTicketlinkRank(): Promise<SourceResult> {
  const urls = [
    "https://www.ticketlink.co.kr/ranking/daily/genre/0001",
    "https://www.ticketlink.co.kr/ranking",
    "https://www.ticketlink.co.kr/home/main",
  ];
  const errors: string[] = [];
  for (const url of urls) {
    try {
      const html = await fetchText(url, {
        headers: {
          Accept: "text/html,application/json",
          Referer: "https://www.ticketlink.co.kr/",
        },
      });
      if (html.trim().startsWith("{")) {
        try {
          const data = JSON.parse(html) as { data?: { productName?: string; rank?: number }[] };
          const items: ChartRow[] = [];
          for (const [index, row] of (data.data ?? []).entries()) {
            const title = cleanShowTitle(row.productName ?? "");
            if (!title) continue;
            items.push({
              rank: row.rank ?? index + 1,
              title,
              metric: Math.max(1, 50 - index),
              tags: ["티켓링크", "티켓 랭킹"],
            });
          }
          if (items.length) return result("ticketlink-rank", "티켓링크 랭킹", items);
        } catch {
          /* fall through to HTML parse */
        }
      }
      const items = [...html.matchAll(/productName['"]\s*:\s*['"]([^'"]+)['"]/g)]
        .map((m, index) => ({
          rank: index + 1,
          title: cleanShowTitle(m[1] ?? ""),
          metric: Math.max(1, 50 - index),
          tags: ["티켓링크", "티켓 랭킹"],
        }))
        .filter((row) => row.title.length >= 2)
        .slice(0, 40);
      if (items.length) return result("ticketlink-rank", "티켓링크 랭킹", items);
      errors.push(`${url}: empty`);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  return result("ticketlink-rank", "티켓링크 랭킹", [], errors.at(-1) ?? "unavailable");
}

type KopisBoxRow = {
  prfplcnm?: string;
  prfnm?: string;
  rnum?: string;
  cate?: string;
  area?: string;
};

async function fetchKopisBoxOffice(): Promise<SourceResult> {
  const key = (process.env.KOPIS_API_KEY ?? process.env.KOPIS_SERVICE_KEY ?? "").trim();
  if (!key) {
    return result("kopis-boxoffice", "KOPIS 예매상황판", [], "KOPIS_API_KEY 없음");
  }
  const date = kstDateString().replace(/-/g, "");
  try {
    const xml = await fetchText(
      `http://www.kopis.or.kr/openApi/restful/boxoffice?service=${encodeURIComponent(key)}&ststype=day&date=${date}`,
    );
    const blocks = [...xml.matchAll(/<db>([\s\S]*?)<\/db>/g)];
    const items: ChartRow[] = [];
    for (const [index, block] of blocks.entries()) {
      const body = block[1] ?? "";
      const pick = (tag: string) => body.match(new RegExp(`<${tag}>([^<]*)</${tag}>`))?.[1]?.trim();
      const title = cleanShowTitle(pick("prfnm") ?? "");
      if (!title) continue;
      const rank = Number(pick("rnum")) || index + 1;
      items.push({
        rank,
        title,
        subtitle: pick("prfplcnm"),
        metric: Math.max(1, 50 - rank),
        tags: ["KOPIS", pick("cate") ?? "공연", pick("area")].filter(Boolean) as string[],
      });
    }
    return result("kopis-boxoffice", "KOPIS 예매상황판", items);
  } catch (error) {
    return result(
      "kopis-boxoffice",
      "KOPIS 예매상황판",
      [],
      error instanceof Error ? error.message : "kopis error",
    );
  }
}

export async function fetchTicketSources(): Promise<SourceResult[]> {
  const [interpark, yes24, ticketlink, kopis] = await Promise.all([
    fetchInterparkSources(),
    fetchYes24Rank(),
    fetchTicketlinkRank(),
    fetchKopisBoxOffice(),
  ]);
  return [...interpark, yes24, ticketlink, kopis];
}

const PERFORMANCE_SOURCE_IDS = new Set([
  "interpark-musical",
  "interpark-concert",
  "interpark-drama",
  "interpark-classic",
  "yes24-ticket-rank",
  "ticketlink-rank",
  "kopis-boxoffice",
]);

const EXHIBITION_SOURCE_IDS = new Set(["interpark-exhibit", "yes24-ticket-rank"]);

function mergeChartRows(groups: ChartRow[][]): ChartRow[] {
  const map = new Map<string, ChartRow>();
  for (const group of groups) {
    for (const row of group) {
      const key = row.title.replace(/\s+/g, "").toLowerCase();
      if (!key) continue;
      const current = map.get(key);
      if (!current || (row.metric ?? 0) > (current.metric ?? 0)) {
        map.set(key, {
          ...row,
          tags: [...new Set([...(current?.tags ?? []), ...(row.tags ?? [])])],
        });
      }
    }
  }
  return [...map.values()]
    .sort((a, b) => (b.metric ?? 0) - (a.metric ?? 0) || a.rank - b.rank)
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

export function pickPerformanceTicketRows(sources: SourceResult[]): ChartRow[] {
  return mergeChartRows(
    sources.filter((source) => PERFORMANCE_SOURCE_IDS.has(source.id)).map((source) => source.items),
  ).slice(0, 40);
}

export function pickExhibitionTicketRows(sources: SourceResult[]): ChartRow[] {
  const exhibit = sources.find((source) => source.id === "interpark-exhibit")?.items ?? [];
  const yes24 = (sources.find((source) => source.id === "yes24-ticket-rank")?.items ?? []).filter((row) =>
    /전시|팝업|페어|비엔날레|뮤지엄|몰입|체험전|특별전|미디어/.test(row.title),
  );
  return mergeChartRows([exhibit, yes24]).slice(0, 40);
}

export function ticketRowsToNewsLines(rows: ChartRow[], label: string): string[] {
  return rows.slice(0, 24).map((row, index) => {
    const place = row.subtitle ? ` @ ${row.subtitle}` : "";
    const metric =
      row.measurement?.value != null
        ? ` · ${row.measurement.label} ${row.measurement.value}${row.measurement.unit}`
        : "";
    return `${index + 1}. [${label}] ${row.title}${place}${metric}`;
  });
}

export function ticketRowsToBoardSeeds(rows: ChartRow[]): string[] {
  return rows.map((row) => formatTicketSeedName(row.title, row.subtitle));
}
