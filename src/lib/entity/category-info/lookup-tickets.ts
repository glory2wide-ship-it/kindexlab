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
  const clean = candidate.replace(/^\[[^\]]+\]\s*/, "");
  const a = normalizeName(clean);
  const b = normalizeName(name.replace(/^\[[^\]]+\]\s*/, ""));
  if (!a || !b) return 0;
  if (a === b) return 100;
  if (a.includes(b) || b.includes(a)) return 80;
  if (namesOverlap(clean, name)) return 60;
  return 0;
}

type InterparkRow = {
  goodsName?: string;
  placeName?: string;
  bookingPercent?: string | number;
  goodsCode?: string;
  playPeriod?: string;
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

async function enrichInterparkDetail(
  goodsCode: string,
): Promise<{ schedule?: string; time?: string; price?: string; url: string }> {
  const url = `https://tickets.interpark.com/goods/${goodsCode}`;
  try {
    const html = await fetchText(url, {
      headers: { Referer: "https://tickets.interpark.com/" },
    });
    const schedule =
      plain(
        html.match(/(?:기간|공연기간|전시기간)[^<]{0,20}[:：]?\s*([^<\n]{6,60})/i)?.[1],
      ) ||
      plain(html.match(/playPeriod["']?\s*[:=]\s*["']([^"']+)["']/i)?.[1]);
    const time = plain(
      html.match(/(?:시간|관람시간|공연시간)[^<]{0,20}[:：]?\s*([^<\n]{4,40})/i)?.[1],
    );
    const price = plain(
      html.match(/(?:가격|티켓가격|관람료|입장료)[^<]{0,30}[:：]?\s*([^<\n]{2,50})/i)?.[1],
    );
    return { schedule, time, price, url };
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
      : ["MUSICAL", "CONCERT", "PLAY", "CLASSIC", "musical", "concert", "drama"];
  const rows: InterparkRow[] = [];
  for (const genre of genres) {
    rows.push(...(await fetchInterpark(genre)));
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
    : { schedule: undefined, time: undefined, price: undefined, url: undefined };
  const pct = Number(top.bookingPercent);
  return {
    title: plain(top.goodsName)!,
    venue: plain(top.placeName),
    schedule: detail.schedule || plain(top.playPeriod),
    time: detail.time,
    price: detail.price,
    url: detail.url,
    bookingPercent: Number.isFinite(pct) ? `예매율 ${pct}%` : undefined,
    source: "인터파크",
    kind,
  };
}

async function lookupTicketlink(name: string): Promise<TicketLookup | undefined> {
  const url = `https://www.ticketlink.co.kr/search?query=${encodeURIComponent(name)}`;
  try {
    const html = await fetchText(url, {
      headers: { Referer: "https://www.ticketlink.co.kr/" },
    });
    const product =
      html.match(
        /productName["']?\s*[:=]\s*["']([^"']+)["'][\s\S]{0,400}?placeName["']?\s*[:=]\s*["']([^"']+)["']/i,
      ) ||
      html.match(
        /class=["'][^"']*product[_-]?name[^"']*["'][^>]*>([^<]+)<[\s\S]{0,300}?place[^>]*>([^<]+)</i,
      );
    if (!product) return undefined;
    const title = plain(product[1]);
    if (!title || titleScore(title, name) < 60) return undefined;
    const venue = plain(product[2]);
    const schedule = plain(
      html.match(/(?:기간|일정)[^<]{0,20}>([^<]{6,50})</i)?.[1],
    );
    return {
      title,
      venue,
      schedule,
      url,
      source: "티켓링크",
      kind: /전시|팝업|아트|페어/.test(`${title} ${name}`)
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
  const ticketlink = await lookupTicketlink(q);
  return ticketlink ?? interpark;
}
