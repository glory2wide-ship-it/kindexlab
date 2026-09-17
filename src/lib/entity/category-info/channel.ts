import { getBoard, resolveBoardSlug } from "@/lib/boards/registry";
import type { PostChannel } from "@/lib/posts/types";
import type { RankingEntity } from "@/lib/types";
import type {
  CategoryInfoCategory,
  CategoryInfoChannel,
} from "@/lib/entity/category-info/types";

export type ResolvedCategoryChannel = {
  category: CategoryInfoCategory;
  channel: CategoryInfoChannel;
  channelLabel: string;
  boardSlug?: string;
};

const BOARD_TO_CHANNEL: Record<
  string,
  { category: CategoryInfoCategory; channel: CategoryInfoChannel; label: string }
> = {
  "kpop-fandom-power": { category: "entertainment", channel: "kpop", label: "KPOP" },
  "trot-kayo-fandom-power": { category: "entertainment", channel: "trot", label: "트로트 가요" },
  "realtime-tv-ratings": { category: "entertainment", channel: "tv_ratings", label: "TV시청률" },
  "variety-hot-minute": { category: "entertainment", channel: "tv_ratings", label: "TV시청률" },
  "realtime-music-chart": { category: "entertainment", channel: "music", label: "음원" },
  "star-reputation-index": { category: "entertainment", channel: "star", label: "스타" },
  "boxoffice-expectation": { category: "entertainment", channel: "movie", label: "영화" },
  "entertain-youtuber-ranking": { category: "entertainment", channel: "youtuber", label: "유튜버" },
  "realtime-webtoon-rank": { category: "entertainment", channel: "webtoon", label: "웹툰" },
  "game-esports-ranking": { category: "entertainment", channel: "game", label: "게임" },
  "government-support-fund": { category: "politics", channel: "gov_subsidy", label: "정부지원금" },
  "party-support-chart": { category: "politics", channel: "party_support", label: "정당 지지도" },
  "politician-support-chart": {
    category: "politics",
    channel: "politician_support",
    label: "정치인 지지도",
  },
  "governor-approval-index": { category: "politics", channel: "local_policy", label: "지자체 정책" },
  "political-influencer-power": {
    category: "politics",
    channel: "politics_youtube",
    label: "정치 유튜브",
  },
  "political-pundit-ranking": {
    category: "politics",
    channel: "political_pundit",
    label: "정치평론가",
  },
  "policy-controversy-index": {
    category: "politics",
    channel: "issue_keyword",
    label: "이슈 키워드",
  },
  "government-subsidy-search": { category: "economy", channel: "gov_subsidy", label: "정부지원금" },
  "housing-subscription-hotspot": {
    category: "economy",
    channel: "housing",
    label: "지역별 부동산",
  },
  "rates-finance-products": { category: "economy", channel: "finance", label: "금융" },
  "kospi-fomo-index": { category: "economy", channel: "stock", label: "주식" },
  "overseas-stock-index": { category: "economy", channel: "overseas_stock", label: "해외 주식" },
  "commodities-fx-index": { category: "economy", channel: "commodities_fx", label: "원자재 환율" },
  "inflation-sentiment-index": { category: "economy", channel: "inflation", label: "소비자 물가" },
  "startup-franchise-index": { category: "economy", channel: "startup", label: "창업/소상공" },
  "culture-leisure-grant-ranking": {
    category: "culture",
    channel: "gov_subsidy",
    label: "정부지원금",
  },
  "performance-ticket-ranking": { category: "culture", channel: "performance", label: "공연" },
  "exhibition-popup-ranking": { category: "culture", channel: "exhibition", label: "전시 팝업" },
  "bestseller-surge-index": { category: "culture", channel: "book", label: "도서 베스트셀러" },
  "health-info-ranking": { category: "culture", channel: "health", label: "건강정보" },
  "recipe-ranking": { category: "culture", channel: "recipe", label: "요리 레시피" },
  "car-review-ranking": { category: "culture", channel: "car", label: "자동차" },
  "travel-government-grant-ranking": {
    category: "travel",
    channel: "travel_grant",
    label: "여행 정부지원금",
  },
  "domestic-travel-ranking": { category: "travel", channel: "domestic_travel", label: "국내 여행" },
  "overseas-travel-ranking": { category: "travel", channel: "overseas_travel", label: "해외 여행" },
  "weekend-outing-ranking": {
    category: "travel",
    channel: "weekend_outing",
    label: "지역별 주말 나들이",
  },
  "food-restaurant-ranking": {
    category: "travel",
    channel: "food",
    label: "지역별 음식/맛집",
  },
};

const TYPE_FALLBACK: Partial<
  Record<
    RankingEntity["type"],
    { category: CategoryInfoCategory; channel: CategoryInfoChannel; label: string }
  >
> = {
  kpop: { category: "entertainment", channel: "kpop", label: "KPOP" },
  trot: { category: "entertainment", channel: "trot", label: "트로트 가요" },
  tv_rating: { category: "entertainment", channel: "tv_ratings", label: "TV시청률" },
  tv_show: { category: "entertainment", channel: "tv_ratings", label: "TV시청률" },
  music_chart: { category: "entertainment", channel: "music", label: "음원" },
  celebrity: { category: "entertainment", channel: "star", label: "스타" },
  movie: { category: "entertainment", channel: "movie", label: "영화" },
  influencer: { category: "entertainment", channel: "youtuber", label: "유튜버" },
  shorts: { category: "entertainment", channel: "youtuber", label: "유튜버" },
  webtoon: { category: "entertainment", channel: "webtoon", label: "웹툰" },
  mobile_game: { category: "entertainment", channel: "game", label: "게임" },
  pc_game: { category: "entertainment", channel: "game", label: "게임" },
  console_game: { category: "entertainment", channel: "game", label: "게임" },
  subsidy: { category: "politics", channel: "gov_subsidy", label: "정부지원금" },
  party_support: { category: "politics", channel: "party_support", label: "정당 지지도" },
  politician_support: {
    category: "politics",
    channel: "politician_support",
    label: "정치인 지지도",
  },
  local_policy: { category: "politics", channel: "local_policy", label: "지자체 정책" },
  political_influencer: {
    category: "politics",
    channel: "politics_youtube",
    label: "정치 유튜브",
  },
  political_pundit: { category: "politics", channel: "political_pundit", label: "정치평론가" },
  political_search: { category: "politics", channel: "issue_keyword", label: "이슈 키워드" },
  housing: { category: "economy", channel: "housing", label: "지역별 부동산" },
  finance_product: { category: "economy", channel: "finance", label: "금융" },
  stock_market: { category: "economy", channel: "stock", label: "주식" },
  overseas_stock: { category: "economy", channel: "overseas_stock", label: "해외 주식" },
  commodities_fx: { category: "economy", channel: "commodities_fx", label: "원자재 환율" },
  inflation: { category: "economy", channel: "inflation", label: "소비자 물가" },
  startup_franchise: { category: "economy", channel: "startup", label: "창업/소상공" },
  performance: { category: "culture", channel: "performance", label: "공연" },
  exhibition: { category: "culture", channel: "exhibition", label: "전시 팝업" },
  book: { category: "culture", channel: "book", label: "도서 베스트셀러" },
  restaurant: { category: "travel", channel: "food", label: "지역별 음식/맛집" },
  outing: { category: "travel", channel: "weekend_outing", label: "지역별 주말 나들이" },
  travel_spot: { category: "travel", channel: "domestic_travel", label: "국내 여행" },
  overseas_travel: { category: "travel", channel: "overseas_travel", label: "해외 여행" },
};

const GROUP_FALLBACK: Array<{
  test: RegExp;
  category: CategoryInfoCategory;
  channel: CategoryInfoChannel;
  label: string;
}> = [
  { test: /^K\s*POP$/i, category: "entertainment", channel: "kpop", label: "KPOP" },
  { test: /트로트/, category: "entertainment", channel: "trot", label: "트로트 가요" },
  { test: /시청률|OTT/, category: "entertainment", channel: "tv_ratings", label: "TV시청률" },
  { test: /음원/, category: "entertainment", channel: "music", label: "음원" },
  { test: /스타/, category: "entertainment", channel: "star", label: "스타" },
  { test: /영화/, category: "entertainment", channel: "movie", label: "영화" },
  { test: /유튜버/, category: "entertainment", channel: "youtuber", label: "유튜버" },
  { test: /웹툰/, category: "entertainment", channel: "webtoon", label: "웹툰" },
  { test: /게임/, category: "entertainment", channel: "game", label: "게임" },
  { test: /지원금/, category: "politics", channel: "gov_subsidy", label: "정부지원금" },
  { test: /정당/, category: "politics", channel: "party_support", label: "정당 지지도" },
  { test: /정치인/, category: "politics", channel: "politician_support", label: "정치인 지지도" },
  { test: /지자체/, category: "politics", channel: "local_policy", label: "지자체 정책" },
  { test: /정치\s*유튜브/, category: "politics", channel: "politics_youtube", label: "정치 유튜브" },
  { test: /평론/, category: "politics", channel: "political_pundit", label: "정치평론가" },
  { test: /이슈/, category: "politics", channel: "issue_keyword", label: "이슈 키워드" },
  { test: /부동산/, category: "economy", channel: "housing", label: "지역별 부동산" },
  { test: /금융/, category: "economy", channel: "finance", label: "금융" },
  { test: /^주식$/, category: "economy", channel: "stock", label: "주식" },
  { test: /해외\s*주식/, category: "economy", channel: "overseas_stock", label: "해외 주식" },
  { test: /원자재|환율/, category: "economy", channel: "commodities_fx", label: "원자재 환율" },
  { test: /물가/, category: "economy", channel: "inflation", label: "소비자 물가" },
  { test: /창업|소상공/, category: "economy", channel: "startup", label: "창업/소상공" },
  { test: /공연/, category: "culture", channel: "performance", label: "공연" },
  { test: /전시|팝업/, category: "culture", channel: "exhibition", label: "전시 팝업" },
  { test: /도서|베스트/, category: "culture", channel: "book", label: "도서 베스트셀러" },
  { test: /건강/, category: "culture", channel: "health", label: "건강정보" },
  { test: /요리|레시피/, category: "culture", channel: "recipe", label: "요리 레시피" },
  { test: /자동차/, category: "culture", channel: "car", label: "자동차" },
  { test: /국내\s*여행/, category: "travel", channel: "domestic_travel", label: "국내 여행" },
  { test: /해외\s*여행/, category: "travel", channel: "overseas_travel", label: "해외 여행" },
  { test: /나들이/, category: "travel", channel: "weekend_outing", label: "지역별 주말 나들이" },
  { test: /맛집|음식/, category: "travel", channel: "food", label: "지역별 음식/맛집" },
];

function boardSlugOf(entity: Pick<RankingEntity, "slug">): string | undefined {
  if (!entity.slug.includes("--")) return undefined;
  return resolveBoardSlug(entity.slug.slice(0, entity.slug.indexOf("--")));
}

function categoryFromPostChannel(channel?: PostChannel): CategoryInfoCategory {
  if (channel === "politics") return "politics";
  if (channel === "economy") return "economy";
  if (channel === "culture") return "culture";
  if (channel === "travel") return "travel";
  return "entertainment";
}

export function resolveCategoryInfoChannel(
  entity: Pick<RankingEntity, "slug" | "type" | "heatmapGroup" | "sourceChannel" | "tags">,
): ResolvedCategoryChannel {
  const boardSlug = boardSlugOf(entity);
  if (boardSlug && BOARD_TO_CHANNEL[boardSlug]) {
    const hit = BOARD_TO_CHANNEL[boardSlug]!;
    return {
      category: hit.category,
      channel: hit.channel,
      channelLabel: hit.label,
      boardSlug,
    };
  }

  const board = boardSlug ? getBoard(boardSlug) : undefined;
  if (board) {
    const mapped = BOARD_TO_CHANNEL[board.slug];
    if (mapped) {
      return {
        category: mapped.category,
        channel: mapped.channel,
        channelLabel: mapped.label,
        boardSlug: board.slug,
      };
    }
  }

  const byType = TYPE_FALLBACK[entity.type];
  if (byType) {
    return {
      category: byType.category,
      channel: byType.channel,
      channelLabel: byType.label,
      boardSlug,
    };
  }

  const group = entity.heatmapGroup?.trim() ?? "";
  for (const row of GROUP_FALLBACK) {
    if (row.test.test(group)) {
      return {
        category: row.category,
        channel: row.channel,
        channelLabel: row.label,
        boardSlug,
      };
    }
  }

  return {
    category: categoryFromPostChannel(entity.sourceChannel),
    channel: "generic",
    channelLabel: group || "종목 정보",
    boardSlug,
  };
}

/** Excel channels that are news-primary (or empty spec). */
export function isNewsPrimaryChannel(channel: CategoryInfoChannel): boolean {
  return (
    channel === "game" ||
    channel === "party_support" ||
    channel === "politician_support" ||
    channel === "local_policy" ||
    channel === "issue_keyword" ||
    channel === "finance" ||
    channel === "stock" ||
    channel === "overseas_stock" ||
    channel === "commodities_fx" ||
    channel === "inflation" ||
    channel === "startup" ||
    channel === "health" ||
    channel === "recipe" ||
    channel === "car" ||
    channel === "domestic_travel" ||
    channel === "overseas_travel" ||
    channel === "trot" ||
    channel === "generic"
  );
}
