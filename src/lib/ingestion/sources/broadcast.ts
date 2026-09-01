import { kstDateString } from "@/lib/briefing/dates";
import { fetchText, nowIso } from "@/lib/ingestion/http";
import { parseNumber, tableRows } from "@/lib/ingestion/parse";
import type { ChartRow, SourceResult } from "@/lib/ingestion/types";

function result(id: string, label: string, items: ChartRow[], error?: string): SourceResult {
  return {
    id,
    label,
    ok: !error && items.length > 0,
    count: items.length,
    error: error ?? (items.length ? undefined : "no rows"),
    fetchedAt: nowIso(),
    items,
  };
}

function ymd(offsetDays = 0): string {
  const [year, month, day] = kstDateString().split("-").map(Number);
  const date = new Date(Date.UTC(year, (month ?? 1) - 1, (day ?? 1) + offsetDays));
  return kstDateString(date).replace(/-/g, "");
}

function parseNielsen(html: string, tags: string[]): ChartRow[] {
  const rows = tableRows(html);
  const items: ChartRow[] = [];
  for (const cells of rows) {
    const rank = parseNumber(cells[0]);
    if (!rank || rank > 40) continue;
    const channel = cells[1]?.trim();
    const title = cells[2]?.trim();
    const metric = parseNumber(cells[3]?.replace(/,/g, ""));
    if (!title || /순위|프로그램/.test(title)) continue;
    if (/^\d{1,2}:\d{2}$/.test(title)) continue;
    items.push({
      rank,
      title,
      subtitle: channel,
      metric,
      volume: metric && metric > 50 ? Math.round(metric * 1000) : undefined,
      // The table's fourth column is the household rating itself. Values above
      // 50 are not ratings -- that column carries viewer counts on some pages --
      // so only the plausible range is quotable.
      measurement:
        metric && metric > 0 && metric <= 50
          ? { value: metric, unit: "%", label: "가구 시청률", source: "닐슨코리아" }
          : undefined,
      tags,
    });
  }
  return items;
}

async function fetchNielsen(url: string, id: string, label: string, tags: string[]): Promise<SourceResult> {
  const dates = [0, -1, -2].map((offset) => ymd(offset));
  const errors: string[] = [];
  for (const begin of dates) {
    try {
      const html = await fetchText(`${url}${url.includes("?") ? "&" : "?"}begin_date=${begin}`);
      const items = parseNielsen(html, tags);
      if (items.length) return result(id, label, items);
      errors.push(`${begin}: empty`);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "failed");
    }
  }
  return result(id, label, [], errors.at(-1) ?? "empty");
}

export async function fetchTerrestrialRatings(): Promise<SourceResult> {
  return fetchNielsen(
    "https://www.nielsenkorea.co.kr/tv_terrestrial_day.asp?menu=Tit_1&sub_menu=1_1&area=00",
    "nielsen-terrestrial",
    "닐슨 지상파 시청률",
    ["닐슨", "지상파"],
  );
}

export async function fetchCableRatings(): Promise<SourceResult> {
  return fetchNielsen(
    "https://www.nielsenkorea.co.kr/tv_terrestrial_day.asp?menu=Tit_1&sub_menu=3_1&area=00",
    "nielsen-cable",
    "닐슨 케이블 시청률",
    ["닐슨", "케이블"],
  );
}

export async function fetchBroadcastSources(): Promise<SourceResult[]> {
  return Promise.all([fetchTerrestrialRatings(), fetchCableRatings()]);
}
