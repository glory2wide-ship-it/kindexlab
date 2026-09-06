import { namesOverlap, normalizeName } from "@/lib/ingestion/names";
import { POLITICS_YOUTUBE_SEEDS } from "@/lib/politics/youtube-seeds";
import type { EntityType } from "@/lib/types";

export type TrafficCategory = "politics" | "entertainment";

export interface TrafficChannel {
  /** Canonical entity name. Episode titles are replaced with this. */
  name: string;
  category: TrafficCategory;
  type: EntityType;
  /**
   * Other names the same subject travels under: host, programme, or the
   * shorthand viewers actually search. Used both to recognise a feed row and to
   * widen the news query.
   */
  aliases: string[];
  tags: string[];
}

/**
 * Channels that bypass every category filter and are always present in the
 * ranking and the article pipeline. YouTube trending is dominated by music and
 * clips, so these high-traffic politics and variety channels drop out of the
 * feed on most days even though they carry the audience we publish for.
 */
const POLITICS_SEED_WHITELIST: TrafficChannel[] = POLITICS_YOUTUBE_SEEDS.filter(
  (seed) => seed.influencer,
).map((seed) => ({
  name: seed.name,
  category: "politics" as const,
  type: "political_influencer" as const,
  aliases: seed.aliases,
  tags: ["시사", "유튜브", ...(seed.handle ? ["라이브"] : [])],
}));

export const TOP_TRAFFIC_CHANNELS_WHITELIST: TrafficChannel[] = [
  ...POLITICS_SEED_WHITELIST,
  {
    name: "TV조선 뉴스",
    category: "politics",
    type: "political_ratings",
    aliases: ["TV조선", "티비조선"],
    tags: ["시사", "보도"],
  },
  {
    name: "짠한형",
    category: "entertainment",
    type: "influencer",
    aliases: ["신동엽", "짠한형 신동엽"],
    tags: ["웹예능", "유튜브"],
  },
  {
    name: "핑계고",
    category: "entertainment",
    type: "influencer",
    aliases: ["뜬뜬", "유재석", "핑계고 유재석"],
    tags: ["웹예능", "유튜브"],
  },
  {
    name: "채널 십오야",
    category: "entertainment",
    type: "influencer",
    aliases: ["십오야", "나영석", "채널십오야"],
    tags: ["웹예능", "유튜브"],
  },
  {
    name: "침착맨",
    category: "entertainment",
    type: "influencer",
    aliases: ["이말년", "침착맨 플러스"],
    tags: ["웹예능", "유튜브"],
  },
  {
    name: "성시경",
    category: "entertainment",
    type: "influencer",
    aliases: ["먹을텐데", "성시경의 먹을텐데"],
    tags: ["웹예능", "유튜브"],
  },
  {
    name: "요정재형",
    category: "entertainment",
    type: "influencer",
    aliases: ["정재형", "요정 재형"],
    tags: ["웹예능", "유튜브"],
  },
  {
    name: "피식대학",
    category: "entertainment",
    type: "influencer",
    aliases: ["피식쇼", "피식대학Psick Univ"],
    tags: ["웹예능", "유튜브"],
  },
  {
    name: "슈카월드",
    category: "entertainment",
    type: "influencer",
    aliases: ["슈카", "전석재"],
    tags: ["웹예능", "경제"],
  },
];

/**
 * Aliases are matched as substrings of the normalised haystack, so a short one
 * would fire on unrelated rows ("딴지" inside a sentence). Anything under this
 * length must match a whole name instead.
 */
const SUBSTRING_SAFE_LENGTH = 3;

function hit(needle: string, haystack: string): boolean {
  const term = normalizeName(needle);
  if (!term) return false;
  if (term.length >= SUBSTRING_SAFE_LENGTH) return haystack.includes(term);
  return namesOverlap(needle, haystack);
}

/**
 * Recognises a whitelisted channel from a feed row. The channel name usually
 * arrives in the row subtitle and the episode name in the title, but shorts
 * feeds sometimes carry the programme name in the title alone, so both are
 * searched.
 */
export function matchTrafficChannel(
  title: string,
  subtitle?: string,
): TrafficChannel | undefined {
  const haystack = normalizeName(`${title} ${subtitle ?? ""}`);
  if (!haystack) return undefined;
  return TOP_TRAFFIC_CHANNELS_WHITELIST.find(
    (channel) =>
      hit(channel.name, haystack) || channel.aliases.some((alias) => hit(alias, haystack)),
  );
}

export function findTrafficChannelByName(name: string): TrafficChannel | undefined {
  return TOP_TRAFFIC_CHANNELS_WHITELIST.find(
    (channel) =>
      namesOverlap(channel.name, name) ||
      channel.aliases.some((alias) => namesOverlap(alias, name)),
  );
}
