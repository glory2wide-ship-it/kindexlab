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
  source: "인터파크" | "티켓링크" | "예스24티켓";
  kind: "performance" | "exhibition";
};

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
  return plain(raw);
}

function formatPeriod(start?: string, end?: string): string | undefined {
  const a = formatYmd(start);
  const b = formatYmd(end);
  if (a && b && a !== b) return `${a} ~ ${b}`;
  return a || b;
}

type InterparkRow = {
  goodsName?: string;
  placeName?: string;
  bookingPercent?: string | number;
  goodsCode?: string;
  playPeriod?: string;
  playStartDate?: string;
  playEndDate?: string;
  url?: string;
};

async function fetchInterpark(genre: string): Promise<InterparkRow[]> {
  try {
    const data = await fetchJson<Record<string, InterparkRow[] | undefined>>(
      `https://tickets.interpark.com/contents/api/ranking?period=D&date=&goodsCode=&page=1&pageSize=30&rankingTypes=${encodeURIComponent(genre)}`,
      {
        headers: {
          Accept: "application/json",
          Referer: "https://tickets.interpark.com/contents/ranking",
          Origin: "https://tickets.interpark.com",
        },
      },
    );
    return Object.values(data).flatMap((group) => (Array.isArray(group) ? group : []));
  } catch {
    return [];
  }
}

function looksLikeUiChrome(value?: string): boolean {
  if (!value) return true;
  return /예매 전|가격 전체 보기|확인해 주세요|로그인|쿠키|javascript|function\s*\(/i.test(
    value,
  );
}

async function enrichInterparkDetail(
  goodsCode: string,
): Promise<{ schedule?: string; time?: string; price?: string; url: string }> {
  const url = `https://tickets.interpark.com/goods/${goodsCode}`;
  try {
    const html = await fetchText(url, {
      headers: { Referer: "https://tickets.interpark.com/" },
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

async function lookupInterpark(
  name: string,
  kind: "performance" | "exhibition",
): Promise<TicketLookup | undefined> {
  const genres =
    kind === "exhibition"
      ? ["EXHIBIT", "exhibit"]
      : ["MUSICAL", "CONCERT", "PLAY", "CLASSIC", "musical", "concert", "drama", "classic"];
  const rows: InterparkRow[] = [];
  const seen = new Set<string>();
  for (const genre of genres) {
    for (const row of await fetchInterpark(genre)) {
      const key = row.goodsCode || row.goodsName || "";
      if (!key || seen.has(key)) continue;
      seen.add(key);
      rows.push(row);
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
    ? await enrichInterparkDetail(String(top.goodsCode))
    : {
        schedule: undefined,
        time: undefined,
        price: undefined,
        url: undefined as string | undefined,
      };
  const pct = Number(top.bookingPercent);
  const rankingUrl = top.url
    ? top.url.startsWith("//")
      ? `https:${top.url}`
      : top.url.startsWith("http")
        ? top.url
        : `https://tickets.interpark.com${top.url}`
    : undefined;
  return {
    title: plain(top.goodsName)!,
    venue: plain(top.placeName),
    schedule:
      formatPeriod(top.playStartDate, top.playEndDate) ||
      plain(top.playPeriod) ||
      detail.schedule,
    time: detail.time,
    price: detail.price,
    url: detail.url || rankingUrl,
    bookingPercent: Number.isFinite(pct) ? `예매율 ${pct}%` : undefined,
    source: "인터파크",
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

/** Resolve performance/exhibition venue·schedule·price via ticket site crawls. */
export async function lookupTicketFacts(
  name: string,
  kind: "performance" | "exhibition",
): Promise<TicketLookup | undefined> {
  const q = name.trim();
  if (!q) return undefined;
  const interpark = await lookupInterpark(q, kind);
  if (interpark?.venue || interpark?.schedule || interpark?.price) return interpark;
  const ticketlink = await lookupTicketlink(q, kind);
  return ticketlink ?? interpark;
}
