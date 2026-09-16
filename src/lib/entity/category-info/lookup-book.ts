import { fetchText } from "@/lib/ingestion/http";
import { decodeHtml, stripTags } from "@/lib/ingestion/parse";
import { namesOverlap, normalizeName } from "@/lib/ingestion/names";

export type BookLookup = {
  title: string;
  author?: string;
  publisher?: string;
  synopsis?: string;
  url?: string;
  source: "예스24" | "알라딘";
};

function plain(raw?: string): string | undefined {
  if (!raw) return undefined;
  const text = decodeHtml(stripTags(raw)).replace(/\s+/g, " ").trim();
  return text || undefined;
}

function titleScore(candidate: string, name: string): number {
  const a = normalizeName(candidate);
  const b = normalizeName(name);
  if (!a || !b) return 0;
  if (a === b) return 100;
  if (a.includes(b) || b.includes(a)) return 80;
  if (namesOverlap(candidate, name)) return 60;
  return 0;
}

/** Yes24 search HTML occasionally embeds goods cards; also try entity-escaped JSON. */
async function lookupYes24(name: string): Promise<BookLookup | undefined> {
  const url = `https://www.yes24.com/Product/Search?domain=BOOK&query=${encodeURIComponent(name)}`;
  try {
    const html = await fetchText(url, {
      headers: { Referer: "https://www.yes24.com/" },
    });
    const candidates: BookLookup[] = [];

    for (const match of html.matchAll(
      /gd_name[^>]*href="([^"]+)"[^>]*>([^<]+)</gi,
    )) {
      const title = plain(match[2]);
      if (!title || titleScore(title, name) < 60) continue;
      const idx = match.index ?? 0;
      const window = html.slice(idx, idx + 1400);
      const author = plain(
        window.match(/info_auth[^>]*>([\s\S]*?)<\/span>/i)?.[1],
      )?.replace(/\s*저\s*$/, "");
      const publisher = plain(
        window.match(/info_pub[^>]*>([\s\S]*?)<\/span>/i)?.[1],
      );
      const href = match[1]?.startsWith("http")
        ? match[1]!
        : `https://www.yes24.com${match[1] ?? ""}`;
      candidates.push({
        title,
        author,
        publisher,
        url: href,
        source: "예스24",
      });
      if (candidates.length >= 5) break;
    }

    // Entity-escaped JSON blob fallback (some Yes24 responses omit gd_name markup).
    if (!candidates.length) {
      const names = [
        ...html.matchAll(/goods_name(?:&quot;|"):(?:&quot;|")([^&"]+)(?:&quot;|")/gi),
      ];
      const nos = [
        ...html.matchAll(/goods_no(?:&quot;|"):(?:&quot;|")(\d+)(?:&quot;|")/gi),
      ];
      for (let i = 0; i < names.length; i += 1) {
        const title = plain(names[i]?.[1]);
        if (!title || titleScore(title, name) < 60) continue;
        const goodsNo = nos[i]?.[1];
        candidates.push({
          title,
          url: goodsNo
            ? `https://www.yes24.com/Product/Goods/${goodsNo}`
            : undefined,
          source: "예스24",
        });
        if (candidates.length >= 5) break;
      }
    }

    candidates.sort((a, b) => titleScore(b.title, name) - titleScore(a.title, name));
    const top = candidates[0];
    if (!top?.url) return top;

    try {
      const detail = await fetchText(top.url, {
        headers: { Referer: "https://www.yes24.com/" },
      });
      const synopsis =
        plain(
          detail.match(
            /id=["']infoset_inDocS[^"']*["'][\s\S]{0,200}?textarea_overflow_[^>]*>([\s\S]*?)<\/div>/i,
          )?.[1],
        ) ||
        plain(
          detail.match(
            /property=["']og:description["']\s+content=["']([^"']+)["']/i,
          )?.[1],
        );
      const author =
        top.author ||
        plain(
          detail.match(/(?:저자|지은이)[^<]{0,40}>([^<]{2,40})</i)?.[1],
        )?.replace(/\s*저\s*$/, "");
      const publisher =
        top.publisher ||
        plain(detail.match(/(?:출판사|펴낸곳)[^<]{0,40}>([^<]{2,40})</i)?.[1]);
      return {
        ...top,
        author,
        publisher,
        synopsis: synopsis?.slice(0, 220),
      };
    } catch {
      return top;
    }
  } catch {
    return undefined;
  }
}

async function lookupAladin(name: string): Promise<BookLookup | undefined> {
  const url = `https://www.aladin.co.kr/search/wsearchresult.aspx?SearchTarget=Book&SearchWord=${encodeURIComponent(name)}`;
  try {
    const html = await fetchText(url, {
      headers: { Referer: "https://www.aladin.co.kr/" },
    });
    const candidates: BookLookup[] = [];
    // Aladin puts href before class="bo3" on the title anchor.
    const titleRe =
      /<a\s+href="([^"]+)"\s+class=["']bo3["'][^>]*>([\s\S]*?)<\/a>|<a\s+class=["']bo3["'][^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    for (const match of html.matchAll(titleRe)) {
      const hrefRaw = match[1] || match[3];
      const title = plain(match[2] || match[4]);
      if (!title || titleScore(title, name) < 60) continue;
      const idx = match.index ?? 0;
      const window = html.slice(idx, idx + 900);
      const author = plain(
        window.match(/>([^<]+)<\/a>\s*\(지은이\)/)?.[1],
      );
      const publisher = plain(
        window.match(/\(지은이\)\s*\|\s*<a[^>]*>([^<]+)<\/a>/i)?.[1],
      );
      const href = hrefRaw?.startsWith("http")
        ? hrefRaw
        : `https://www.aladin.co.kr${hrefRaw ?? ""}`;
      candidates.push({
        title,
        author: author || undefined,
        publisher: publisher || undefined,
        url: href,
        source: "알라딘",
      });
      if (candidates.length >= 5) break;
    }
    candidates.sort((a, b) => titleScore(b.title, name) - titleScore(a.title, name));
    const top = candidates[0];
    if (!top?.url) return top;
    try {
      const detail = await fetchText(top.url, {
        headers: { Referer: "https://www.aladin.co.kr/" },
      });
      const synopsis = plain(
        detail.match(
          /property=["']og:description["']\s+content=["']([^"']+)["']/i,
        )?.[1],
      );
      return { ...top, synopsis: synopsis?.slice(0, 220) };
    } catch {
      return top;
    }
  } catch {
    return undefined;
  }
}

/** Resolve book author/publisher/synopsis via Yes24 (primary) + Aladin. */
export async function lookupBookFacts(name: string): Promise<BookLookup | undefined> {
  const q = name.trim();
  if (!q) return undefined;
  const yes24 = await lookupYes24(q);
  if (yes24?.author || yes24?.publisher || yes24?.synopsis) return yes24;
  const aladin = await lookupAladin(q);
  return aladin ?? yes24;
}
