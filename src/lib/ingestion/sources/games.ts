import { fetchJson, nowIso } from "@/lib/ingestion/http";
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

interface AppleFeed {
  feed?: {
    entry?: AppleEntry | AppleEntry[];
  };
}

interface AppleEntry {
  "im:name"?: { label?: string };
  "im:artist"?: { label?: string };
  "im:image"?: { label?: string; attributes?: { height?: string } }[];
  "im:price"?: { attributes?: { amount?: string } };
  id?: { attributes?: { "im:id"?: string } };
}

function appleEntries(data: AppleFeed): AppleEntry[] {
  const entry = data.feed?.entry;
  if (!entry) return [];
  return Array.isArray(entry) ? entry : [entry];
}

function appleImage(entry: AppleEntry): string | undefined {
  const images = entry["im:image"] ?? [];
  return [...images].sort((a, b) => Number(b.attributes?.height ?? 0) - Number(a.attributes?.height ?? 0))[0]
    ?.label;
}

function parseAppleFeed(data: AppleFeed, tag: string): ChartRow[] {
  const rows: ChartRow[] = [];
  appleEntries(data).forEach((entry, index) => {
    const title = entry["im:name"]?.label?.replace(/\s*-\s*[^-]+$/, "").trim() || entry["im:name"]?.label?.trim();
    if (!title || /19금|성인/.test(title)) return;
    const price = Number(entry["im:price"]?.attributes?.amount ?? 0);
    rows.push({
      rank: index + 1,
      title,
      subtitle: entry["im:artist"]?.label,
      // The store publishes an order, not a number. A metric derived from the
      // index adds nothing and pins the bonus at its cap.
      volume: Math.round((48 - index) * 95_000),
      imageUrl: appleImage(entry),
      tags: [tag, price > 0 ? "유료" : "무료"],
    });
  });
  return rows;
}

async function fetchAppleGames(kind: "free" | "grossing"): Promise<SourceResult> {
  const path = kind === "free" ? "topfreeapplications" : "topgrossingapplications";
  const id = kind === "free" ? "apple-ios-games-free" : "apple-ios-games-grossing";
  const label = kind === "free" ? "앱스토어 무료 게임" : "앱스토어 매출 게임";
  try {
    const data = await fetchJson<AppleFeed>(
      `https://itunes.apple.com/kr/rss/${path}/limit=30/genre=6014/json`,
    );
    return result(id, label, parseAppleFeed(data, kind === "free" ? "앱스토어 무료" : "앱스토어 매출"));
  } catch (error) {
    return result(id, label, [], error instanceof Error ? error.message : "apple error");
  }
}

interface SteamSpyGame {
  appid?: number;
  name?: string;
  ccu?: number;
  average_2weeks?: number;
  developer?: string;
}

async function fetchSteamSpy(): Promise<SourceResult> {
  try {
    const data = await fetchJson<Record<string, SteamSpyGame>>(
      "https://steamspy.com/api.php?request=top100in2weeks",
    );
    const items = Object.values(data)
      .filter((game) => game.name && !/adult|nsfw/i.test(game.name ?? ""))
      .sort((a, b) => (b.ccu ?? b.average_2weeks ?? 0) - (a.ccu ?? a.average_2weeks ?? 0))
      .slice(0, 40)
      .map((game, index) => {
        const reported = game.ccu || game.average_2weeks;
        const players = reported || Math.max(1, 40 - index) * 8_000;
        return {
          rank: index + 1,
          title: game.name!.trim(),
          subtitle: game.developer,
          metric: Math.log10(players + 1),
          volume: players,
          // Only when SteamSpy actually reported a count; the rank-derived
          // fallback above is a placeholder and must not be quoted as one.
          measurement: reported
            ? { value: reported, unit: "명", label: "동시 접속자", source: "SteamSpy" }
            : undefined,
          imageUrl: game.appid
            ? `https://cdn.akamai.steamstatic.com/steam/apps/${game.appid}/header.jpg`
            : undefined,
          tags: ["스팀", "동접", "PC"],
        } satisfies ChartRow;
      });
    return result("steam-most-played", "스팀 동접 순위", items);
  } catch (error) {
    return result(
      "steam-most-played",
      "스팀 동접 순위",
      [],
      error instanceof Error ? error.message : "steamspy error",
    );
  }
}

interface SteamRank {
  rank?: number;
  appid?: number;
  last_week_rank?: number;
  peak_in_game?: number;
}

async function fetchSteamCharts(): Promise<SourceResult> {
  try {
    const data = await fetchJson<{ response?: { ranks?: SteamRank[] } }>(
      "https://api.steampowered.com/ISteamChartsService/GetMostPlayedGames/v1/",
    );
    const ranks = data.response?.ranks ?? [];
    const items = ranks.slice(0, 30).map((row, index) => {
      const appid = row.appid;
      const rank = row.rank ?? index + 1;
      const peak = row.peak_in_game ?? 0;
      return {
        rank,
        previousRank: row.last_week_rank,
        title: appid ? `Steam ${appid}` : `PC Game ${rank}`,
        metric: peak > 0 ? Math.log10(peak + 1) : undefined,
        volume: peak > 0 ? peak : undefined,
        measurement:
          peak > 0
            ? { value: peak, unit: "명", label: "최고 동시 접속자", source: "스팀" }
            : undefined,
        imageUrl: appid ? `https://cdn.akamai.steamstatic.com/steam/apps/${appid}/header.jpg` : undefined,
        tags: ["스팀 차트", "동접"],
      } satisfies ChartRow;
    });
    return result("steam-charts", "스팀 차트", items);
  } catch (error) {
    return result("steam-charts", "스팀 차트", [], error instanceof Error ? error.message : "steam charts error");
  }
}

interface ChihiroLink {
  name?: string;
  provider_name?: string;
  images?: { url?: string }[];
}

async function fetchPlaystationStore(): Promise<SourceResult> {
  const urls = [
    "https://store.playstation.com/store/api/chihiro/00_09_000/container/KR/ko/999/STORE-MSF75508-PS5GAMES?size=30",
    "https://store.playstation.com/store/api/chihiro/00_09_000/container/KR/ko/19/STORE-MSF86012-GAMESALL?size=30",
  ];
  const errors: string[] = [];
  for (const url of urls) {
    try {
      const data = await fetchJson<{ links?: ChihiroLink[]; included?: ChihiroLink[] }>(url, {
        headers: { Referer: "https://store.playstation.com/ko-kr/pages/browse" },
      });
      const links = [...(data.links ?? []), ...(data.included ?? [])];
      const items = links
        .map((link) => link.name?.trim())
        .filter((name): name is string => typeof name === "string" && isConsoleGameTitle(name))
        .filter((name, index, all) => all.indexOf(name) === index)
        .slice(0, 30)
        .map((title, index) => ({
          rank: index + 1,
          title,
          subtitle: links[index]?.provider_name,
          volume: Math.round((36 - index) * 80_000),
          imageUrl: links[index]?.images?.[0]?.url,
          tags: ["PS 스토어", "콘솔"],
        }));
      if (items.length) return result("playstation-store", "플레이스테이션 스토어", items);
      errors.push(`empty ${url}`);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  return result("playstation-store", "플레이스테이션 스토어", [], errors.at(-1) ?? "empty");
}

function isConsoleGameTitle(title: string): boolean {
  if (!title || /19금|성인/.test(title)) return false;
  return !/membership|vip pass|playstation plus|ps plus|구독|시즌[\s-]?패스|vip\s*패스/i.test(title);
}

const CONSOLE_FALLBACK: { title: string; subtitle: string }[] = [
  { title: "마리오카트 월드", subtitle: "Nintendo" },
  { title: "젤다의 전설 티어스 오브 더 킹덤", subtitle: "Nintendo" },
  { title: "그랜드 테프트 오토 VI", subtitle: "Rockstar" },
  { title: "EA Sports FC 26", subtitle: "EA" },
  { title: "콜 오브 듀티", subtitle: "Activision" },
  { title: "파이널 판타지 VII 리버스", subtitle: "Square Enix" },
  { title: "스파이더맨 2", subtitle: "Insomniac" },
  { title: "헤일로 인피니트", subtitle: "Xbox Game Studios" },
  { title: "포르자 호라이즌 5", subtitle: "Playground Games" },
  { title: "스트리트 파이터 6", subtitle: "Capcom" },
  { title: "몬스터 헌터 와일즈", subtitle: "Capcom" },
  { title: "엘든 링 나이트레인", subtitle: "FromSoftware" },
];

function consoleFallbackRows(): ChartRow[] {
  return CONSOLE_FALLBACK.map((game, index) => ({
    rank: index + 1,
    title: game.title,
    subtitle: game.subtitle,
    volume: Math.round((30 - index) * 88_000),
    tags: ["콘솔 인기 관측", game.subtitle],
  }));
}

export async function fetchGameSources(): Promise<SourceResult[]> {
  const [free, grossing, steamSpy, steamCharts, playstation] = await Promise.all([
    fetchAppleGames("free"),
    fetchAppleGames("grossing"),
    fetchSteamSpy(),
    fetchSteamCharts(),
    fetchPlaystationStore(),
  ]);
  const consoleWatch = result("console-watchlist", "콘솔 인기 관측", consoleFallbackRows());
  const psClean = (playstation.items ?? []).filter((row) => isConsoleGameTitle(row.title));
  const playstationClean = { ...playstation, items: psClean, count: psClean.length, ok: psClean.length > 0 };
  return [
    free,
    grossing,
    steamSpy,
    steamCharts,
    playstationClean,
    ...(playstationClean.ok && playstationClean.count >= 8 ? [] : [consoleWatch]),
  ];
}

export function pickMobileGames(sources: SourceResult[]): ChartRow[] {
  const free = sources.find((item) => item.id === "apple-ios-games-free")?.items ?? [];
  const grossing = sources.find((item) => item.id === "apple-ios-games-grossing")?.items ?? [];
  return [...free, ...grossing];
}

export function pickPcGames(sources: SourceResult[]): ChartRow[] {
  const spy = sources.find((item) => item.id === "steam-most-played");
  if (spy?.ok) return spy.items;
  return sources.find((item) => item.id === "steam-charts")?.items ?? [];
}

export function pickConsoleGames(sources: SourceResult[]): ChartRow[] {
  const store = (sources.find((item) => item.id === "playstation-store")?.items ?? []).filter((row) =>
    isConsoleGameTitle(row.title),
  );
  const watch = sources.find((item) => item.id === "console-watchlist")?.items ?? [];
  if (store.length >= 8) return store;
  const seen = new Set(store.map((row) => row.title));
  return [...store, ...watch.filter((row) => !seen.has(row.title))];
}
