import type { CountryCode, MarketConfig } from "@/lib/market/config";

export type PublisherKind = "trusted" | "unknown" | "ugc";

/**
 * User-generated platforms, excluded in every market: a blog or forum post
 * carries no editorial accountability, and the column cites its sources.
 */
const UGC_NAMES = [
  "네이버 블로그",
  "네이버 포스트",
  "네이버 카페",
  "naver blog",
  "naver post",
  "naver cafe",
  "다음 블로그",
  "다음 카페",
  "브런치",
  "brunch",
  "티스토리",
  "tistory",
  "블로그",
  "카페",
  "나무위키",
  "위키백과",
  "wikipedia",
  "디시인사이드",
  "dcinside",
  "루리웹",
  "뽐뿌",
  "클리앙",
  "인스티즈",
  "더쿠",
  "youtube",
  "유튜브",
  "reddit",
  "quora",
  "트위터",
  "threads",
  "medium",
  "velog",
  "substack",
  "blogspot",
  "wordpress",
  "github",
];

const UGC_HOSTS = [
  "blog.naver.com",
  "post.naver.com",
  "cafe.naver.com",
  "cafe.daum.net",
  "blog.daum.net",
  "brunch.co.kr",
  "tistory.com",
  "namu.wiki",
  "wikipedia.org",
  "dcinside.com",
  "ruliweb.com",
  "ppomppu.co.kr",
  "clien.net",
  "instiz.net",
  "theqoo.net",
  "youtube.com",
  "youtu.be",
  "reddit.com",
  "quora.com",
  "medium.com",
  "velog.io",
  "substack.com",
  "blogspot.com",
  "wordpress.com",
];

/** Wire services and international outlets accepted in every market. */
const GLOBAL_TRUSTED = [
  "reuters",
  "bloomberg",
  "associated press",
  "ap news",
  "bbc",
  "cnn",
  "cnbc",
  "guardian",
  "financial times",
  "wall street journal",
  "new york times",
  "washington post",
  "nikkei",
  "billboard",
  "hollywood reporter",
  "rolling stone",
  "the verge",
  "techcrunch",
  "engadget",
];

/**
 * Outlets whose names are ordinary words. Substring matching would let
 * "The Times of India" pass as "Time", so these require the full name to match
 * or the link to resolve to the outlet's own host.
 */
const TRUSTED_EXACT = [
  "time",
  "people",
  "people.com",
  "variety",
  "deadline",
  "wired",
  "the times",
  "welt",
  "bild",
  "stern",
  "focus",
  "metro",
];

const TRUSTED_HOSTS = [
  "time.com",
  "people.com",
  "variety.com",
  "deadline.com",
  "wired.com",
  "thetimes.co.uk",
  "welt.de",
  "bild.de",
  "stern.de",
  "focus.de",
  "metro.co.uk",
];

/**
 * Outlets with a newsroom, matched loosely so local and romanised names both
 * hit ("조선비즈" / "Chosunbiz"). Add a country key to onboard a new market.
 */
const TRUSTED_BY_COUNTRY: Record<CountryCode, string[]> = {
  KR: [
    "연합뉴스", "yonhap", "뉴시스", "newsis", "뉴스1", "news1",
    "조선일보", "조선비즈", "chosun", "중앙일보", "joongang", "joins",
    "동아일보", "donga", "한겨레", "hani", "경향신문", "khan",
    "한국일보", "hankook", "서울신문", "seoul", "국민일보", "kmib",
    "세계일보", "segye", "문화일보", "munhwa",
    "매일경제", "mk.co", "한국경제", "hankyung", "머니투데이", "mt.co",
    "이데일리", "edaily", "아시아경제", "asiae", "파이낸셜뉴스", "fnnews",
    "헤럴드경제", "herald", "전자신문", "etnews", "지디넷", "zdnet",
    "블로터", "bloter", "아이뉴스24", "inews24", "베타뉴스",
    "kbs", "mbc", "sbs", "jtbc", "ytn", "mbn", "채널a", "tv조선", "ebs",
    "osen", "마이데일리", "mydaily", "스타뉴스", "starnews",
    "텐아시아", "tenasia", "엑스포츠뉴스", "xportsnews",
    "스포츠조선", "스포츠동아", "스포츠서울", "스포츠경향",
    "일간스포츠", "isplus", "뉴스엔", "newsen", "헤럴드팝",
    "디스패치", "dispatch", "인터풋볼", "스포티비", "spotv",
    "노컷뉴스", "nocut", "오마이뉴스", "ohmynews", "프레시안", "pressian",
    "미디어오늘", "mediatoday", "시사인", "sisain", "주간조선",
    "위키트리", "인사이트", "더팩트", "tf.co", "뉴스핌", "newspim",
    "뉴스토마토", "newstomato", "데일리안", "dailian", "쿠키뉴스", "kukinews",
    "매일신문", "부산일보", "국제신문", "강원일보", "제주일보",
  ],
  US: [
    "usa today", "usatoday", "npr", "abc news", "cbs news", "nbc news", "fox news",
    "politico", "axios", "the hill", "newsweek", "the atlantic",
    "los angeles times", "chicago tribune", "boston globe",
    "entertainment weekly", "vulture", "pitchfork",
  ],
  GB: [
    "sky news", "telegraph", "the independent", "evening standard",
    "daily mail", "the sun", "daily mirror", "nme", "empire",
  ],
  DE: [
    "spiegel", "die zeit", "faz", "frankfurter allgemeine", "süddeutsche",
    "sueddeutsche", "tagesschau", "zdf", "ard", "handelsblatt",
    "n-tv", "deutsche welle", "dw.com",
  ],
  JP: [
    "asahi", "朝日新聞", "yomiuri", "読売新聞", "mainichi", "毎日新聞",
    "sankei", "産経", "nhk", "kyodo", "共同通信", "jiji", "時事通信",
    "oricon", "オリコン", "natalie", "ナタリー", "toyo keizai", "東洋経済",
  ],
};

function hostOf(link?: string): string {
  if (!link) return "";
  try {
    return new URL(link).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function trustedPublishers(market: MarketConfig): string[] {
  return [...(TRUSTED_BY_COUNTRY[market.country] ?? []), ...GLOBAL_TRUSTED];
}

export function classifyPublisher(
  market: MarketConfig,
  publisher?: string,
  link?: string,
): PublisherKind {
  const name = (publisher ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  const host = hostOf(link);

  if (UGC_HOSTS.some((entry) => host.endsWith(entry))) return "ugc";
  if (name && UGC_NAMES.some((entry) => name.includes(entry))) return "ugc";

  if (host && TRUSTED_HOSTS.some((entry) => host === entry || host.endsWith(`.${entry}`))) {
    return "trusted";
  }
  if (name && TRUSTED_EXACT.includes(name)) return "trusted";

  const trusted = trustedPublishers(market);
  if (name && trusted.some((entry) => name.includes(entry))) return "trusted";
  if (host && trusted.some((entry) => host.includes(entry))) return "trusted";
  return "unknown";
}
