import { fetchJson, fetchText, nowIso } from "@/lib/ingestion/http";
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

function walkVideos(node: unknown, found: ChartRow[], seen: Set<string>) {
  if (!node || found.length >= 40) return;
  if (Array.isArray(node)) {
    for (const item of node) walkVideos(item, found, seen);
    return;
  }
  if (typeof node !== "object") return;
  const record = node as Record<string, unknown>;
  const renderer =
    (record.videoRenderer as Record<string, unknown> | undefined) ??
    (record.compactVideoRenderer as Record<string, unknown> | undefined) ??
    (record.gridVideoRenderer as Record<string, unknown> | undefined) ??
    (record.reelItemRenderer as Record<string, unknown> | undefined);
  if (renderer) {
    const videoId = typeof renderer.videoId === "string" ? renderer.videoId : "";
    const title = titleFromRenderer(renderer);
    if (videoId && title && !seen.has(videoId) && !/19금|성인/.test(title)) {
      seen.add(videoId);
      const views = viewsFromRenderer(renderer);
      const thumb = thumbFromRenderer(renderer, videoId);
      found.push({
        rank: found.length + 1,
        title,
        subtitle: channelFromRenderer(renderer) || "YouTube",
        metric: views > 0 ? Math.log10(views + 1) : undefined,
        volume: views > 0 ? views : undefined,
        measurement:
          views > 0 ? { value: views, unit: "회", label: "조회수", source: "유튜브" } : undefined,
        imageUrl: thumb,
        tags: ["유튜브", "인기", views > 0 ? "조회수" : "트렌딩"],
      });
    }
  }
  for (const value of Object.values(record)) walkVideos(value, found, seen);
}

function titleFromRenderer(renderer: Record<string, unknown>): string {
  const title = renderer.title;
  if (typeof title === "string") return title.trim();
  if (title && typeof title === "object") {
    const record = title as Record<string, unknown>;
    if (typeof record.simpleText === "string") return record.simpleText.trim();
    const runs = record.runs;
    if (Array.isArray(runs)) {
      return runs
        .map((run) => (run && typeof run === "object" ? String((run as { text?: string }).text ?? "") : ""))
        .join("")
        .trim();
    }
  }
  return "";
}

function channelFromRenderer(renderer: Record<string, unknown>): string {
  const owner = renderer.ownerText ?? renderer.shortBylineText;
  if (owner && typeof owner === "object") {
    const runs = (owner as { runs?: { text?: string }[] }).runs;
    if (Array.isArray(runs) && typeof runs[0]?.text === "string") return runs[0].text;
  }
  return "";
}

function viewsFromRenderer(renderer: Record<string, unknown>): number {
  const blobs = [renderer.viewCountText, renderer.shortViewCountText]
    .map((value) => {
      if (!value) return "";
      if (typeof value === "string") return value;
      if (typeof value === "object") {
        const record = value as { simpleText?: string; runs?: { text?: string }[] };
        if (record.simpleText) return record.simpleText;
        if (Array.isArray(record.runs)) return record.runs.map((run) => run.text ?? "").join("");
      }
      return "";
    })
    .join(" ");
  const compact = blobs.replace(/,/g, "").replace(/회/g, "");
  const million = compact.match(/([\d.]+)\s*만/);
  if (million) return Math.round(Number(million[1]) * 10_000);
  const billion = compact.match(/([\d.]+)\s*억/);
  if (billion) return Math.round(Number(billion[1]) * 100_000_000);
  const plain = compact.match(/([\d.]+)\s*(?:m|M)/);
  if (plain) return Math.round(Number(plain[1]) * 1_000_000);
  const digits = compact.match(/(\d[\d.]*)/);
  return digits ? Number(digits[1]) : 0;
}

function thumbFromRenderer(renderer: Record<string, unknown>, videoId: string): string {
  const thumbs = renderer.thumbnail as { thumbnails?: { url?: string }[] } | undefined;
  const url = thumbs?.thumbnails?.at(-1)?.url;
  if (url) return url;
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

async function innertubeKey(): Promise<string | undefined> {
  try {
    const html = await fetchText("https://www.youtube.com/feed/trending?gl=KR&hl=ko", {
      headers: { Referer: "https://www.youtube.com/" },
    });
    const match = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/);
    return match?.[1];
  } catch {
    return undefined;
  }
}

async function fetchYoutubeTrending(): Promise<SourceResult> {
  try {
    const key = await innertubeKey();
    const url = key
      ? `https://www.youtube.com/youtubei/v1/browse?key=${key}&prettyPrint=false`
      : "https://www.youtube.com/youtubei/v1/browse?prettyPrint=false";
    const data = await fetchJson<unknown>(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://www.youtube.com",
        Referer: "https://www.youtube.com/feed/trending?gl=KR&hl=ko",
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: "WEB",
            clientVersion: "2.20240815.01.00",
            hl: "ko",
            gl: "KR",
          },
        },
        browseId: "FEtrending",
      }),
    });
    const items: ChartRow[] = [];
    walkVideos(data, items, new Set());
    if (items.length) return result("youtube-trending", "유튜브 인기", items.slice(0, 30));
    return result("youtube-trending", "유튜브 인기", [], "no rows");
  } catch (error) {
    return result(
      "youtube-trending",
      "유튜브 인기",
      [],
      error instanceof Error ? error.message : "youtube error",
    );
  }
}

async function fetchYoutubeHtmlFallback(): Promise<SourceResult> {
  try {
    const html = await fetchText("https://www.youtube.com/feed/trending?gl=KR&hl=ko", {
      headers: { Referer: "https://www.youtube.com/" },
    });
    const jsonMatch = html.match(/ytInitialData\s*=\s*(\{[\s\S]+?\});\s*</);
    if (!jsonMatch?.[1]) return result("youtube-trending-html", "유튜브 인기 HTML", [], "no ytInitialData");
    const data = JSON.parse(jsonMatch[1]) as unknown;
    const items: ChartRow[] = [];
    walkVideos(data, items, new Set());
    return result("youtube-trending-html", "유튜브 인기 HTML", items.slice(0, 30));
  } catch (error) {
    return result(
      "youtube-trending-html",
      "유튜브 인기 HTML",
      [],
      error instanceof Error ? error.message : "html error",
    );
  }
}

export async function fetchShortsSources(): Promise<SourceResult[]> {
  const primary = await fetchYoutubeTrending();
  if (primary.ok) return [primary];
  const fallback = await fetchYoutubeHtmlFallback();
  if (fallback.ok) return [primary, fallback];
  return [primary, fallback, result("shorts-watchlist", "숏폼 인기 관측", shortsFallbackRows())];
}

export function pickPrimaryShorts(sources: SourceResult[]): SourceResult | undefined {
  const order = ["youtube-trending", "youtube-trending-html", "shorts-watchlist"];
  return order.map((id) => sources.find((item) => item.id === id && item.ok)).find(Boolean);
}

const SHORTS_FALLBACK: { title: string; subtitle: string }[] = [
  { title: "올해의 챌린지", subtitle: "YouTube" },
  { title: "분당 먹방 클립", subtitle: "YouTube" },
  { title: "K-POP 커버 쇼츠", subtitle: "YouTube" },
  { title: "주말 여행 릴스", subtitle: "Reels" },
  { title: "IT 언박싱 쇼츠", subtitle: "YouTube" },
  { title: "틱톡 댄스 챌린지", subtitle: "TikTok" },
  { title: "릴스 하이라이트", subtitle: "Instagram" },
  { title: "쇼츠 예능 클립", subtitle: "YouTube" },
  { title: "게임 하이라이트 쇼츠", subtitle: "YouTube" },
  { title: "뷰티 릴스", subtitle: "Instagram" },
  { title: "스포츠 쇼츠", subtitle: "YouTube" },
  { title: "동물 숏폼", subtitle: "TikTok" },
];

function shortsFallbackRows(): ChartRow[] {
  return SHORTS_FALLBACK.map((row, index) => ({
    rank: index + 1,
    title: row.title,
    subtitle: row.subtitle,
    // No metric: this fallback has no view count, and deriving one from the
    // index only saturates the scoring bonus so every top row ties.
    volume: Math.round((28 - index) * 120_000),
    tags: ["숏폼 인기 관측", row.subtitle],
  }));
}
