import { fetchJson, fetchText } from "@/lib/ingestion/http";
import { decodeHtml, stripTags } from "@/lib/ingestion/parse";
import { namesOverlap, normalizeName } from "@/lib/ingestion/names";

export type TicketLookup = {
  title: string;
  venue?: string;
  schedule?: string;
  time?: string;
  price?: string;
  url?: string;
  bookingPercent?: string;
  source: "놀티켓" | "티켓링크" | "예스24티켓" | "인터파크티켓";
  kind: "performance" | "exhibition";
};

type NolRankRow = {
  goodsName?: string;
  placeName?: string;
  bookingPercent?: string | number;
  goodsCode?: string;
  playPeriod?: string;
  playStartDate?: string;
  playEndDate?: string;
  url?: string;
  rank?: number;
};

const NOL_ORIGIN = "https://nol.yanolja.com";
const NOL_TICKET_HOST = "https://tickets.interpark.com";

function plain(raw?: string): string | undefined {
  if (!raw) return undefined;
  const text = decodeHtml(stripTags(raw)).replace(/\s+/g, " ").trim();
  return text || undefined;
}

function titleScore(candidate: string, name: string): number {
  const clean = candidate.replace(/^\[[^\]]+\]\s*/, "").replace(/[〈〉<>]/g, "");
  const needle = name.replace(/^\[[^\]]+\]\s*/, "").replace(/[〈〉<>]/g, "");
  const a = normalizeName(clean);
  const b = normalizeName(needle);
  if (!a || !b) return 0;
  if (a === b) return 100;
  if (a.includes(b) || b.includes(a)) return 80;
  if (namesOverlap(clean, name)) return 60;
  return 0;
}

function formatYmd(raw?: string): string | undefined {
  if (!raw) return undefined;
  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 8) {
    return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6, 8)}`;
  }
  const iso = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}.${iso[2]}.${iso[3]}`;
  // NOL playPeriod often uses YY.MM.DD
  const short = raw.match(/(\d{2})\.(\d{2})\.(\d{2})/g);
  if (short?.length) return plain(raw);
  return plain(raw);
}

function formatPeriod(start?: string, end?: string): string | undefined {
  const a = formatYmd(start);
  const b = formatYmd(end);
  if (a && b && a !== b) return `${a} ~ ${b}`;
  return a || b;
}

function looksLikeUiChrome(value?: string): boolean {
  if (!value) return true;
  return /예매 전|가격 전체 보기|확인해 주세요|로그인|쿠키|javascript|function\s*\(/i.test(
    value,
  );
}

function unescapeJsonFragment(value: string): string {
  return value
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

function goodsUrl(goodsCode?: string, fallback?: string): string | undefined {
  if (goodsCode) return `${NOL_TICKET_HOST}/goods/${goodsCode}`;
  if (!fallback) return undefined;
  if (fallback.startsWith("//")) return `https:${fallback}`;
  if (fallback.startsWith("http")) return fallback;
  if (fallback.startsWith("/")) return `${NOL_TICKET_HOST}${fallback}`;
  return fallback;
}

/** Genre slugs on nol.yanolja.com/ticket/display/ranking/* */
function nolRankingPaths(kind: "performance" | "exhibition"): string[] {
  if (kind === "exhibition") return ["exhibition"];
  return ["musical", "concert", "play", "classic", "family"];
}

/** Legacy rankingTypes accepted by tickets.interpark.com contents API. */
function nolApiGenres(kind: "performance" | "exhibition"): string[] {
  if (kind === "exhibition") return ["EXHIBIT", "exhibit"];
  return ["MUSICAL", "CONCERT", "PLAY", "CLASSIC", "musical", "concert", "drama", "classic"];
}

function parseNolRankingHtml(html: string): NolRankRow[] {
  const rows: NolRankRow[] = [];
  const seen = new Set<string>();
  for (const match of html.matchAll(
    /goodsCode\\":\\"([^\\"]+)\\",\\"goodsName\\":\\"(.*?)\\",\\"posterImageUrl\\":\\"[^\\"]*\\",\\"placeName\\":\\"(.*?)\\",\\"playPeriod\\":\\"(.*?)\\"/g,
  )) {
    const goodsCode = match[1];
    const goodsName = plain(unescapeJsonFragment(match[2] ?? ""));
    if (!goodsCode || !goodsName || seen.has(goodsCode)) continue;
    seen.add(goodsCode);
    rows.push({
      goodsCode,
      goodsName,
      placeName: plain(unescapeJsonFragment(match[3] ?? "")),
      playPeriod: plain(unescapeJsonFragment(match[4] ?? "")),
    });
    if (rows.length >= 40) break;
  }
  if (rows.length) {
    // Attach visible 예매율 when present near the title.
    for (const row of rows) {
      if (!row.goodsName) continue;
      const idx = html.indexOf(row.goodsName);
      if (idx < 0) continue;
      const window = html.slice(idx, idx + 1200);
      const pct = window.match(/예매율\s*([\d.]+)\s*퍼센트/i)?.[1];
      if (pct) row.bookingPercent = pct;
    }
    return rows;
  }

  // Visible SSR cards (no escaped JSON).
  for (const match of html.matchAll(
    />([^<]{2,80})<\/h3>[\s\S]{0,400}?장소\s*<\/span>([^<]{2,60})[\s\S]{0,200}?공연기간\s*<\/span>([^<]{6,40})[\s\S]{0,200}?예매율\s*([\d.]+)\s*퍼센트/gi,
  )) {
    const goodsName = plain(match[1]);
    if (!goodsName || seen.has(goodsName)) continue;
    seen.add(goodsName);
    rows.push({
      goodsName,
      placeName: plain(match[2]),
      playPeriod: plain(match[3]),
      bookingPercent: match[4],
    });
    if (rows.length >= 40) break;
  }
  return rows;
}

async function fetchNolRankingHtml(path: string): Promise<NolRankRow[]> {
  try {
    const html = await fetchText(`${NOL_ORIGIN}/ticket/display/ranking/${path}`, {
      headers: {
        Accept: "text/html,*/*",
        Referer: `${NOL_ORIGIN}/ticket/display/ranking/${path}`,
      },
    });
    return parseNolRankingHtml(html);
  } catch {
    return [];
  }
}

async function fetchNolRankingApi(genre: string): Promise<NolRankRow[]> {
  try {
    const data = await fetchJson<Record<string, NolRankRow[] | undefined>>(
      `${NOL_TICKET_HOST}/contents/api/ranking?period=D&date=&goodsCode=&page=1&pageSize=30&rankingTypes=${encodeURIComponent(genre)}`,
      {
        headers: {
          Accept: "application/json",
          Referer: `${NOL_ORIGIN}/ticket/display/ranking/${genre.toLowerCase()}`,
          Origin: NOL_ORIGIN,
        },
      },
    );
    return Object.values(data).flatMap((group) => (Array.isArray(group) ? group : []));
  } catch {
    return [];
  }
}

async function enrichNolGoodsDetail(
  goodsCode: string,
): Promise<{ schedule?: string; time?: string; price?: string; url: string }> {
  const url = goodsUrl(goodsCode)!;
  try {
    const html = await fetchText(url, {
      headers: { Referer: `${NOL_ORIGIN}/` },
    });
    const scheduleRaw =
      plain(
        html.match(
          /(?:공연기간|전시기간|관람기간)\s*[:：]?\s*([^<\n]{8,40})/i,
        )?.[1],
      ) ||
      plain(html.match(/playPeriod["']?\s*[:=]\s*["']([^"']+)["']/i)?.[1]);
    const time = plain(
      html.match(/(?:공연시간|관람시간)\s*[:：]?\s*([^<\n]{4,40})/i)?.[1],
    );
    const priceRaw = plain(
      html.match(
        /(?:티켓가격|관람료|입장료)\s*[:：]?\s*((?:전석|R석|S석|VIP|성인)?[^<\n]{0,40}\d[\d,]*(?:\s*원)?)/i,
      )?.[1],
    );
    return {
      schedule: looksLikeUiChrome(scheduleRaw) ? undefined : scheduleRaw,
      time: looksLikeUiChrome(time) ? undefined : time,
      price: looksLikeUiChrome(priceRaw) ? undefined : priceRaw,
      url,
    };
  } catch {
    return { url };
  }
}

async function lookupNolTicket(
  name: string,
  kind: "performance" | "exhibition",
): Promise<TicketLookup | undefined> {
  const rows: NolRankRow[] = [];
  const seen = new Set<string>();
  const pushAll = (batch: NolRankRow[]) => {
    for (const row of batch) {
      const key = row.goodsCode || row.goodsName || "";
      if (!key || seen.has(key)) continue;
      seen.add(key);
      rows.push(row);
    }
  };

  // 1) NOL display ranking pages (yanolja)
  for (const path of nolRankingPaths(kind)) {
    pushAll(await fetchNolRankingHtml(path));
  }
  // 2) Shared ranking API still served under tickets.interpark.com
  if (rows.length < 5) {
    for (const genre of nolApiGenres(kind)) {
      pushAll(await fetchNolRankingApi(genre));
    }
  }

  const scored = rows
    .map((row) => ({
      row,
      score: titleScore(row.goodsName ?? "", name),
    }))
    .filter((item) => item.score >= 60)
    .sort((a, b) => b.score - a.score);
  const top = scored[0]?.row;
  if (!top?.goodsName) return undefined;

  const detail = top.goodsCode
    ? await enrichNolGoodsDetail(String(top.goodsCode))
    : {
        schedule: undefined,
        time: undefined,
        price: undefined,
        url: goodsUrl(undefined, top.url),
      };
  const pct = Number(top.bookingPercent);
  return {
    title: plain(top.goodsName)!,
    venue: plain(top.placeName),
    schedule:
      plain(top.playPeriod) ||
      formatPeriod(top.playStartDate, top.playEndDate) ||
      detail.schedule,
    time: detail.time,
    price: detail.price,
    url: detail.url || goodsUrl(top.goodsCode, top.url),
    bookingPercent: Number.isFinite(pct) ? `예매율 ${pct}%` : undefined,
    source: "놀티켓",
    kind,
  };
}

async function lookupTicketlink(
  name: string,
  kind: "performance" | "exhibition",
): Promise<TicketLookup | undefined> {
  const url = `https://www.ticketlink.co.kr/search?query=${encodeURIComponent(name)}`;
  try {
    const html = await fetchText(url, {
      headers: { Referer: "https://www.ticketlink.co.kr/" },
    });
    const products: Array<{
      id: string;
      title: string;
      venue?: string;
      schedule?: string;
    }> = [];
    for (const match of html.matchAll(
      /\{"productId":(\d+),"productName":"((?:\\.|[^"\\])*)"[^}]*?"placeName":"((?:\\.|[^"\\])*)"[^}]*?"hallName":"((?:\\.|[^"\\])*)"[^}]*?"startDate":"([^"]*)"[^}]*?"endDate":"([^"]*)"/g,
    )) {
      const title = plain(match[2]?.replace(/\\"/g, '"'));
      if (!title) continue;
      products.push({
        id: match[1]!,
        title,
        venue: plain(match[3]) || plain(match[4]),
        schedule: formatPeriod(match[5], match[6]),
      });
    }
    const scored = products
      .map((row) => ({ row, score: titleScore(row.title, name) }))
      .filter((item) => item.score >= 60)
      .sort((a, b) => b.score - a.score);
    const top = scored[0]?.row;
    if (!top) return undefined;
    return {
      title: top.title,
      venue: top.venue,
      schedule: top.schedule,
      url: `https://www.ticketlink.co.kr/product/${top.id}`,
      source: "티켓링크",
      kind:
        kind === "exhibition" || /전시|팝업|아트|페어/.test(`${top.title} ${name}`)
          ? "exhibition"
          : "performance",
    };
  } catch {
    return undefined;
  }
}

async function lookupYes24TicketSearch(
  name: string,
  kind: "performance" | "exhibition",
): Promise<TicketLookup | undefined> {
  const url = `https://ticket.yes24.com/Pages/Search/Search.aspx?query=${encodeURIComponent(name)}`;
  try {
    const html = await fetchText(url, {
      headers: { Referer: "https://ticket.yes24.com/" },
    });
    const candidates: Array<{ title: string; href: string; venue?: string; schedule?: string }> =
      [];
    for (const match of html.matchAll(
      /href="([^"]*Perf\/Detail\/Index\?Id=\d+[^"]*)"[^>]*>([^<]{2,80})</gi,
    )) {
      const title = plain(match[2]);
      if (!title || titleScore(title, name) < 50) continue;
      const href = match[1]!.startsWith("http")
        ? match[1]!
        : `https://ticket.yes24.com${match[1]}`;
      const idx = match.index ?? 0;
      const window = html.slice(idx, idx + 800);
      candidates.push({
        title,
        href,
        venue: plain(window.match(/(?:장소|공연장)[^<]{0,20}>([^<]{2,40})</i)?.[1]),
        schedule: plain(window.match(/(?:기간|일정)[^<]{0,20}>([^<]{6,40})</i)?.[1]),
      });
      if (candidates.length >= 5) break;
    }
    // Broader anchor fallback — take first ranked search hit
    if (!candidates.length) {
      for (const match of html.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([^<]{2,80})<\/a>/gi)) {
        const title = plain(match[2]);
        const hrefRaw = match[1] ?? "";
        if (!title || titleScore(title, name) < 60) continue;
        if (!/ticket|perf|goods|detail/i.test(hrefRaw) && !/공연|전시|뮤지컬|콘서트/.test(title)) {
          continue;
        }
        const href = hrefRaw.startsWith("http")
          ? hrefRaw
          : `https://ticket.yes24.com${hrefRaw.startsWith("/") ? "" : "/"}${hrefRaw}`;
        candidates.push({ title, href });
        break;
      }
    }
    candidates.sort((a, b) => titleScore(b.title, name) - titleScore(a.title, name));
    const top = candidates[0];
    if (!top) return undefined;
    return {
      title: top.title,
      venue: top.venue,
      schedule: top.schedule,
      url: top.href,
      source: "예스24티켓",
      kind,
    };
  } catch {
    return undefined;
  }
}

async function lookupInterparkSearch(
  name: string,
  kind: "performance" | "exhibition",
): Promise<TicketLookup | undefined> {
  const url = `https://tickets.interpark.com/search?q=${encodeURIComponent(name)}`;
  try {
    const html = await fetchText(url, {
      headers: { Referer: "https://tickets.interpark.com/" },
    });
    const candidates: Array<{ title: string; href: string; venue?: string }> = [];
    for (const match of html.matchAll(
      /href="((?:https:\/\/tickets\.interpark\.com)?\/goods\/\d+)"[^>]*>([^<]{2,80})</gi,
    )) {
      const title = plain(match[2]);
      if (!title || titleScore(title, name) < 50) continue;
      const href = match[1]!.startsWith("http")
        ? match[1]!
        : `https://tickets.interpark.com${match[1]}`;
      const idx = match.index ?? 0;
      const window = html.slice(idx, idx + 600);
      candidates.push({
        title,
        href,
        venue: plain(window.match(/(?:장소|공연장)[^<]{0,30}>([^<]{2,40})</i)?.[1]),
      });
      if (candidates.length >= 5) break;
    }
    candidates.sort((a, b) => titleScore(b.title, name) - titleScore(a.title, name));
    const top = candidates[0];
    if (!top) return undefined;
    return {
      title: top.title,
      venue: top.venue,
      url: top.href,
      source: "인터파크티켓",
      kind,
    };
  } catch {
    return undefined;
  }
}

/** Resolve performance/exhibition venue·schedule·price via NOL Ticket + Ticketlink crawls. */
export async function lookupTicketFacts(
  name: string,
  kind: "performance" | "exhibition",
): Promise<TicketLookup | undefined> {
  const q = name.trim();
  if (!q) return undefined;
  const nol = await lookupNolTicket(q, kind);
  if (nol?.venue || nol?.schedule || nol?.price) return nol;
  const ticketlink = await lookupTicketlink(q, kind);
  if (ticketlink?.venue || ticketlink?.schedule) return ticketlink;
  // 미매칭 시 Interpark / Yes24 검색 1순위 파싱
  const interpark = await lookupInterparkSearch(q, kind);
  if (interpark) return interpark;
  const yes24 = await lookupYes24TicketSearch(q, kind);
  return yes24 ?? ticketlink ?? nol;
}
