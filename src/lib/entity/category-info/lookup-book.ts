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

async function lookupYes24(name: string): Promise<BookLookup | undefined> {
  const url =
    `https://www.yes24.com/Product/Search?domain=BOOK&query=${encodeURIComponent(name)}`;
  try {
    const html = await fetchText(url, {
      headers: { Accept: "text/html", Referer: "https://www.yes24.com/" },
    });
    const blocks = [
      ...html.matchAll(
        /<div[^>]*class="[^"]*itemUnit[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?=<div[^>]*class="[^"]*itemUnit|<\/div>\s*<div[^>]*class="[^"]*sTitle)/gi,
      ),
    ];
    const candidates: BookLookup[] = [];
    const loose = [
      ...html.matchAll(
        /gd_name[^>]*href="([^"]+)"[^>]*>([^<]+)<[\s\S]{0,800}?info_auth[\s\S]{0,200}?>([\s\S]{0,200}?)<\/span>[\s\S]{0,400}?info_pub[\s\S]{0,200}?>([\s\S]{0,120}?)<\/span>/gi,
      ),
    ];
    for (const match of loose) {
      const href = match[1]?.startsWith("http")
        ? match[1]
        : `https://www.yes24.com${match[1] ?? ""}`;
      const title = plain(match[2]);
      if (!title || titleScore(title, name) < 60) continue;
      candidates.push({
        title,
        author: plain(match[3])?.replace(/\s*저\s*$/, ""),
        publisher: plain(match[4]),
        url: href,
        source: "예스24",
      });
    }
    // Fallback: title + nearby author text
    if (!candidates.length) {
      for (const match of html.matchAll(
        /gd_name[^>]*href="([^"]+)"[^>]*>([^<]+)</gi,
      )) {
        const title = plain(match[2]);
        if (!title || titleScore(title, name) < 60) continue;
        const idx = match.index ?? 0;
        const window = html.slice(idx, idx + 1200);
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
    }
    void blocks;
    candidates.sort((a, b) => titleScore(b.title, name) - titleScore(a.title, name));
    const top = candidates[0];
    if (!top?.url) return top;
    // Detail page for synopsis when possible
    try {
      const detail = await fetchText(top.url, {
        headers: { Accept: "text/html", Referer: "https://www.yes24.com/" },
      });
      const synopsis =
        plain(
          detail.match(
            /id=["']infoset_inDocS[^"']*["'][\s\S]{0,200}?textarea_overflow_[^>]*>([\s\S]*?)<\/div>/i,
          )?.[1],
        ) ||
        plain(
          detail.match(/property=["']og:description["']\s+content=["']([^"']+)["']/i)?.[1],
        );
      return { ...top, synopsis: synopsis?.slice(0, 220) };
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
      headers: { Accept: "text/html", Referer: "https://www.aladin.co.kr/" },
    });
    const candidates: BookLookup[] = [];
    for (const match of html.matchAll(
      /class=["']bo3["'][^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]{0,500}?class=["']ss_book_list["'][\s\S]{0,300}?<li>([\s\S]*?)<\/li>/gi,
    )) {
      const title = plain(match[2]);
      if (!title || titleScore(title, name) < 60) continue;
      const meta = plain(match[3]) ?? "";
      const author = meta.split("|")[0]?.replace(/\s*지음\s*$/, "").trim();
      const publisher = meta.split("|")[1]?.trim();
      const href = match[1]?.startsWith("http")
        ? match[1]
        : `https://www.aladin.co.kr${match[1] ?? ""}`;
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
    return candidates[0];
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
