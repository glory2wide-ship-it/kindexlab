import { fetchText, nowIso } from "@/lib/ingestion/http";
import { parseRssItems } from "@/lib/ingestion/parse";
import { normalizeName } from "@/lib/ingestion/names";

export interface PoliticsHeadline {
  rank: number;
  title: string;
  publisher: string;
  publishedAt?: string;
  url: string;
  source: "naver" | "daum" | "google";
  /** Portal rank + recency + surge proxy used for heatmap tile size. */
  heat?: number;
}

export interface HeadlineRankingSnapshot {
  updatedAt: string;
  live: boolean;
  items: PoliticsHeadline[];
}

export type HeadlineChannel = "politics" | "entertainment" | "economy" | "culture";

const GOOGLE_POLITICS_RSS =
  "https://news.google.com/rss/headlines/section/topic/NATION?hl=ko&gl=KR&ceid=KR:ko";
const GOOGLE_RANKING_RSS =
  "https://news.google.com/rss/search?q=%EC%A0%95%EC%B9%98%20when:1d&hl=ko&gl=KR&ceid=KR:ko";
const GOOGLE_ENTERTAIN_RSS =
  "https://news.google.com/rss/headlines/section/topic/ENTERTAINMENT?hl=ko&gl=KR&ceid=KR:ko";
const GOOGLE_ENTERTAIN_SEARCH =
  "https://news.google.com/rss/search?q=%EC%97%B0%EC%98%88%20OR%20%EC%95%84%EC%9D%B4%EB%8F%8C%20when:1d&hl=ko&gl=KR&ceid=KR:ko";
const GOOGLE_ECONOMY_RSS =
  "https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=ko&gl=KR&ceid=KR:ko";
const GOOGLE_ECONOMY_SEARCH =
  "https://news.google.com/rss/search?q=%EA%B2%BD%EC%A0%9C%20when:1d&hl=ko&gl=KR&ceid=KR:ko";
const DAUM_POLITICS_RSS = "https://media.daum.net/rss/today/primary/politics/rss2.xml";
const DAUM_ENTERTAIN_RSS = "https://media.daum.net/rss/today/primary/entertain/rss2.xml";
const DAUM_ECONOMY_RSS = "https://media.daum.net/rss/today/primary/economic/rss2.xml";
const NAVER_POLITICS_RANKING =
  "https://news.naver.com/main/ranking/popularDay.naver?rankingType=popular_day&sectionId=100";
const NAVER_ENTERTAIN_RANKING =
  "https://news.naver.com/main/ranking/popularDay.naver?rankingType=popular_day&sectionId=106";
const NAVER_ECONOMY_RANKING =
  "https://news.naver.com/main/ranking/popularDay.naver?rankingType=popular_day&sectionId=101";
const GOOGLE_CULTURE_SEARCH =
  "https://news.google.com/rss/search?q=%EB%AC%B8%ED%99%94%20OR%20%EC%98%88%EC%88%A0%20OR%20%EA%B3%B5%EC%97%B0%20OR%20%EC%A0%84%EC%8B%9C%20OR%20%EC%97%AC%ED%96%89%20when:1d&hl=ko&gl=KR&ceid=KR:ko";
const GOOGLE_TRAVEL_RSS =
  "https://news.google.com/rss/headlines/section/topic/TRAVEL?hl=ko&gl=KR&ceid=KR:ko";
const GOOGLE_FOOD_SEARCH =
  "https://news.google.com/rss/search?q=%EB%A7%9B%EC%A7%91%20OR%20%EC%9D%8C%EC%8B%9D%20OR%20%EC%BA%A0%ED%95%91%20OR%20%EB%A0%88%EC%A0%80%20when:1d&hl=ko&gl=KR&ceid=KR:ko";
const GOOGLE_LIFE_SEARCH =
  "https://news.google.com/rss/search?q=%EC%83%9D%ED%99%9C%20OR%20%ED%8A%B8%EB%A0%8C%EB%93%9C%20OR%20%EA%B1%B4%EA%B0%95%20OR%20%EC%97%AC%EA%B0%80%20when:1d&hl=ko&gl=KR&ceid=KR:ko";
const GOOGLE_HEALTH_RSS =
  "https://news.google.com/rss/headlines/section/topic/HEALTH?hl=ko&gl=KR&ceid=KR:ko";
const DAUM_CULTURE_RSS = "https://media.daum.net/rss/today/primary/culture/rss2.xml";
const NAVER_CULTURE_RANKING =
  "https://news.naver.com/main/ranking/popularDay.naver?rankingType=popular_day&sectionId=103";

const POLITICS_HINT =
  /정치|국회|대통령|여야|민주당|국민의힘|의원|총선|대선|청와대|국무총리|탄핵|공천|여론조사|지지도|외교|안보|여의도/;
const ENTERTAIN_HINT =
  /연예|아이돌|가수|드라마|예능|컴백|콘서트|영화|뮤직|걸그룹|보이그룹|시상식|팬덤|음원|아이유|BTS|블랙핑크/;
const ECONOMY_HINT =
  /경제|금리|환율|증시|코스피|코스닥|부동산|물가|대출|지원금|주식|원자재|유가|수출|경기|한은|관세|채권/;
const CULTURE_ALLOW =
  /문화|예술|공연|뮤지컬|연극|콘서트|전시|팝업|여행|축제|도서|베스트셀러|미술관|박물관|클래식|오페라|나들이|관광|숙소|숙박|항공|뮤지엄|페스티벌|티켓|맛집|음식|캠핑|레저|레져|여가|생활|트렌드|건강|웰니스|요리|카페|호텔|리조트|테마파크|놀이공원|한옥|온천|휴양|글램핑|백패킹|등산|트레킹|공연예술|웹툰|웹소설|독립영화|다큐|시네마|영화제|북페어|도서관|한식|외식|미식|브런치|베이커리|오픈런|핫플|주말|휴가|힐링|취미/;
const CULTURE_SOFT = /라이프|여가|주말|휴가|힐링|취미|육아|소비|인테리어|뷰티|패션|날씨/;
const CULTURE_BLOCK =
  /여야|민주당|국민의힘|대통령|국회|총선|대선|탄핵|공천|여론조사|지지도|청와대|국무총리|의원|외교|안보|여의도|특검|코스피|코스닥|증시|환율|금리|한은|관세|채권|주식 시장|부동산 시세|수출입|재정적자|당대표|원내대표|국정감사|계엄|오세훈|이재명|윤석열|한동훈|김문수|조국|박찬대/;

function looksPolitical(title: string): boolean {
  return POLITICS_HINT.test(title);
}

function looksEntertainment(title: string): boolean {
  return ENTERTAIN_HINT.test(title);
}

function looksEconomy(title: string): boolean {
  return ECONOMY_HINT.test(title);
}

function looksCulture(title: string): boolean {
  return CULTURE_ALLOW.test(title) && !CULTURE_BLOCK.test(title);
}

function isCultureLifestyleTitle(title: string, strict: boolean): boolean {
  if (CULTURE_BLOCK.test(title) || looksPolitical(title)) return false;
  if (/Weverse/i.test(title)) return false;
  const kana = title.match(/[\u3040-\u30ff]/g)?.length ?? 0;
  if (kana >= 6) return false;
  if (strict) return looksCulture(title);
  return CULTURE_ALLOW.test(title) || CULTURE_SOFT.test(title);
}

function keepCultureHeadline(item: PoliticsHeadline, strict: boolean): boolean {
  if (/Weverse/i.test(item.publisher)) return false;
  return isCultureLifestyleTitle(item.title, strict);
}

function cultureReactionHeat(item: PoliticsHeadline, sourceIndex: number): number {
  const rankBoost = Math.max(0, 32 - sourceIndex);
  const parsed = item.publishedAt ? Date.parse(item.publishedAt) : Number.NaN;
  const hours = Number.isFinite(parsed)
    ? Math.max(0.1, (Date.now() - parsed) / 3_600_000)
    : sourceIndex * 0.45 + 4;
  const recency = Math.min(24, 18 / (0.4 + hours));
  const sourceBoost = item.source === "naver" ? 22 : item.source === "daum" ? 14 : 9;
  const surge = /오픈런|매진|흥행|돌파|속보|인기|핫플|줄서|대박|급상승|예약 마감|전석 매진/.test(
    item.title,
  )
    ? 12
    : 0;
  return rankBoost + recency + sourceBoost + surge;
}

const PUBLISHER_HINTS: [RegExp, string][] = [
  [/연합뉴스|yonhap/i, "연합뉴스"],
  [/조선일보|chosun/i, "조선일보"],
  [/중앙일보|joongang|joins/i, "중앙일보"],
  [/동아일보|donga/i, "동아일보"],
  [/한겨레|hani/i, "한겨레"],
  [/경향신문|khan/i, "경향신문"],
  [/한국일보|hankookilbo/i, "한국일보"],
  [/뉴시스|newsis/i, "뉴시스"],
  [/뉴스1|news1/i, "뉴스1"],
  [/JTBC|jtbc/i, "JTBC"],
  [/MBC|mbc/i, "MBC"],
  [/SBS|sbs/i, "SBS"],
  [/KBS|kbs/i, "KBS"],
  [/YTN|ytn/i, "YTN"],
  [/매일경제|mk\.co/i, "매일경제"],
  [/한국경제|hankyung/i, "한국경제"],
  [/서울신문|seoul\.co/i, "서울신문"],
  [/문화일보/i, "문화일보"],
  [/국민일보/i, "국민일보"],
  [/스타뉴스|starnews/i, "스타뉴스"],
  [/스포츠조선|sportschosun/i, "스포츠조선"],
  [/엑스포츠뉴스|xportsnews/i, "엑스포츠뉴스"],
  [/OSEN|osen/i, "OSEN"],
  [/텐아시아|tenasia/i, "텐아시아"],
  [/마이데일리|mydaily/i, "마이데일리"],
  [/뉴스엔|newsen/i, "뉴스엔"],
];

function publisherFrom(title: string, link?: string, fallback = "언론사"): string {
  const hay = `${title} ${link ?? ""}`;
  for (const [pattern, label] of PUBLISHER_HINTS) {
    if (pattern.test(hay)) return label;
  }
  const dashed = title.split(/\s+[-–|]\s+/);
  if (dashed.length > 1) {
    const tail = dashed[dashed.length - 1]?.trim() ?? "";
    if (tail.length >= 2 && tail.length <= 12) return tail;
  }
  return fallback;
}

function cleanTitle(title: string): string {
  return title
    .replace(/\s+[-–|]\s+[^-–|]{1,18}$/, "")
    .replace(/^[\[【].*?[\]】]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function toIso(raw?: string): string | undefined {
  if (!raw) return undefined;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : undefined;
}

async function fromRss(
  url: string,
  source: PoliticsHeadline["source"],
  publisherFallback: string,
): Promise<PoliticsHeadline[]> {
  const xml = await fetchText(url, {
    headers: { Accept: "application/rss+xml,application/xml,text/xml,text/html" },
  });
  return parseRssItems(xml)
    .filter((item) => item.link && item.title.length >= 8)
    .map((item, index) => ({
      rank: index + 1,
      title: cleanTitle(item.title),
      publisher: publisherFrom(item.title, item.link, publisherFallback),
      publishedAt: toIso(item.pubDate),
      url: item.link!,
      source,
    }));
}

function uniquePush(into: PoliticsHeadline[], rows: PoliticsHeadline[]): void {
  const seen = new Set(into.map((item) => normalizeName(item.title)));
  for (const row of rows) {
    const key = normalizeName(row.title);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    into.push(row);
  }
}

function parseNaverRanking(html: string): PoliticsHeadline[] {
  const items: PoliticsHeadline[] = [];
  const seen = new Set<string>();
  const re =
    /href="(https:\/\/n\.news\.naver\.com\/(?:article|mnews\/article)\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    const url = match[1]?.replace(/&amp;/g, "&") ?? "";
    const title = cleanTitle(match[2]?.replace(/<[^>]+>/g, " ") ?? "");
    const key = normalizeName(title);
    if (!url || title.length < 8 || !key || seen.has(key)) continue;
    if (!/article\/\d+/.test(url) && !/mnews\/article/.test(url)) continue;
    seen.add(key);
    items.push({
      rank: items.length + 1,
      title,
      publisher: publisherFrom(title, url, "네이버 뉴스"),
      url,
      source: "naver",
    });
    if (items.length >= 28) break;
  }
  return items;
}

async function fetchCultureHeadlineRanking(): Promise<HeadlineRankingSnapshot> {
  const sources = [
    fetchText(NAVER_CULTURE_RANKING).then(parseNaverRanking),
    fromRss(DAUM_CULTURE_RSS, "daum", "다음 문화"),
    fromRss(GOOGLE_CULTURE_SEARCH, "google", "포털"),
    fromRss(GOOGLE_TRAVEL_RSS, "google", "포털"),
    fromRss(GOOGLE_FOOD_SEARCH, "google", "포털"),
    fromRss(GOOGLE_LIFE_SEARCH, "google", "포털"),
    fromRss(GOOGLE_HEALTH_RSS, "google", "포털"),
  ];
  const settled = await Promise.allSettled(sources);
  const buckets = settled.map((result) => (result.status === "fulfilled" ? result.value : []));

  const merged: PoliticsHeadline[] = [];
  for (const bucket of buckets) {
    uniquePush(
      merged,
      bucket.filter((item) => keepCultureHeadline(item, true)),
    );
  }
  if (merged.length < 12) {
    for (const bucket of buckets) {
      uniquePush(
        merged,
        bucket.filter((item) => keepCultureHeadline(item, false)),
      );
    }
  }

  const scored = merged.map((item, index) => ({
    ...item,
    heat: cultureReactionHeat(item, index),
  }));
  scored.sort((left, right) => (right.heat ?? 0) - (left.heat ?? 0));
  const items = scored.slice(0, 25).map((item, index) => ({ ...item, rank: index + 1 }));
  return {
    updatedAt: nowIso(),
    live: items.length > 0,
    items,
  };
}

export async function fetchHeadlineRanking(
  channel: HeadlineChannel = "politics",
): Promise<HeadlineRankingSnapshot> {
  if (channel === "culture") return fetchCultureHeadlineRanking();

  const merged: PoliticsHeadline[] = [];
  const sources =
    channel === "entertainment"
      ? [
          fetchText(NAVER_ENTERTAIN_RANKING).then(parseNaverRanking),
          fromRss(DAUM_ENTERTAIN_RSS, "daum", "다음 연예"),
          fromRss(GOOGLE_ENTERTAIN_SEARCH, "google", "포털"),
          fromRss(GOOGLE_ENTERTAIN_RSS, "google", "포털"),
        ]
      : channel === "economy"
        ? [
            fetchText(NAVER_ECONOMY_RANKING).then(parseNaverRanking),
            fromRss(DAUM_ECONOMY_RSS, "daum", "다음 경제"),
            fromRss(GOOGLE_ECONOMY_SEARCH, "google", "포털"),
            fromRss(GOOGLE_ECONOMY_RSS, "google", "포털"),
          ]
        : [
            fetchText(NAVER_POLITICS_RANKING).then(parseNaverRanking),
            fromRss(DAUM_POLITICS_RSS, "daum", "다음 뉴스"),
            fromRss(GOOGLE_RANKING_RSS, "google", "포털"),
            fromRss(GOOGLE_POLITICS_RSS, "google", "포털"),
          ];
  const settled = await Promise.allSettled(sources);

  const naver = settled[0]?.status === "fulfilled" ? settled[0].value : [];
  const daum = settled[1]?.status === "fulfilled" ? settled[1].value : [];
  const googleRank = settled[2]?.status === "fulfilled" ? settled[2].value : [];
  const googleTopic = settled[3]?.status === "fulfilled" ? settled[3].value : [];
  const topical = channel === "entertainment" ? looksEntertainment : channel === "economy" ? looksEconomy : looksPolitical;

  uniquePush(merged, naver.filter((item) => topical(item.title)));
  uniquePush(merged, daum);
  uniquePush(merged, [...googleTopic, ...googleRank].filter((item) => topical(item.title)));
  if (merged.length < 12) uniquePush(merged, naver);
  const cap = channel === "economy" ? 25 : 20;
  if (merged.length < cap) uniquePush(merged, [...googleTopic, ...googleRank]);

  const items = merged.slice(0, cap).map((item, index) => ({ ...item, rank: index + 1 }));
  return {
    updatedAt: nowIso(),
    live: items.length > 0,
    items,
  };
}

export async function fetchPoliticsHeadlineRanking(): Promise<HeadlineRankingSnapshot> {
  return fetchHeadlineRanking("politics");
}
