export function decodeHtml(input: string): string {
  return input
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)));
}

export function stripTags(html: string): string {
  return decodeHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

export function tableRows(html: string): string[][] {
  const rows: string[][] = [];
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let tr: RegExpExecArray | null;
  while ((tr = trRe.exec(html))) {
    const cells: string[] = [];
    const tdRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let td: RegExpExecArray | null;
    while ((td = tdRe.exec(tr[1] ?? ""))) {
      cells.push(stripTags(td[1] ?? ""));
    }
    if (cells.some(Boolean)) rows.push(cells);
  }
  return rows;
}

export function parseRssItems(xml: string): {
  title: string;
  link?: string;
  pubDate?: string;
  description?: string;
}[] {
  const items: { title: string; link?: string; pubDate?: string; description?: string }[] = [];
  const itemRe = /<item[\s\S]*?<\/item>/gi;
  let block: RegExpExecArray | null;
  while ((block = itemRe.exec(xml))) {
    const chunk = block[0];
    const unwrap = (raw: string) =>
      decodeHtml(stripTags(raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")));
    const title = unwrap(chunk.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
    const link = stripTags(chunk.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1] ?? "").trim();
    const pubDate = stripTags(chunk.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1] ?? "").trim();
    const description = unwrap(chunk.match(/<description[^>]*>([\s\S]*?)<\/description>/i)?.[1] ?? "");
    if (title) {
      items.push({
        title,
        link: link || undefined,
        pubDate: pubDate || undefined,
        description: description || undefined,
      });
    }
  }
  return items;
}

export function parseNumber(raw?: string): number | undefined {
  if (!raw) return undefined;
  const cleaned = raw.replace(/[^\d.+-]/g, "");
  if (!cleaned) return undefined;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : undefined;
}
