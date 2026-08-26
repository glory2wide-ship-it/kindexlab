import { TIMEFRAMES } from "@/lib/categories";
import { kstDateString } from "@/lib/briefing/dates";
import { formatCompact, formatRate, formatScore, TYPE_LABEL } from "@/lib/format";
import { fetchJson, fetchText } from "@/lib/ingestion/http";
import { parseRssItems } from "@/lib/ingestion/parse";
import { getPostBySlug, listPosts, persistGeneratedPost, replaceGeneratedArticles } from "@/lib/posts/store";
import type {
  GeneratedPost,
  MarketFact,
  PostFaq,
  PostSection,
  PostSlot,
  PostTable,
} from "@/lib/posts/types";
import { getRankings } from "@/lib/providers/trends";
import { SITE } from "@/lib/site";
import { rankingPath } from "@/lib/slugs";
import type { RankingEntity } from "@/lib/types";

const MIN_WORDS = 1500;
const MAX_WORDS = 2000;
const SENT_MIN = 20;
const SENT_MAX = 40;
const TAPE_MIN = 0.09;
const TAPE_MAX = 0.12;

const BANNED =
  /결론적으로|요약하자면|이 글에서는|이 글은|정리하면|마무리하며|알아보겠습니다|살펴보겠습니다|추천한다|추천합니다|좋은 선택|좋은 기회|반드시 사야|투자하세요|좋습니다/;

const SLOT_LABEL: Record<PostSlot, string> = {
  morning: "오전 장 전",
  afternoon: "오후 장중",
  evening: "저녁 마감 이후",
};

const TF_KO: Record<string, string> = {
  "1m": "1분봉",
  "5m": "5분봉",
  "10m": "10분봉",
  "30m": "30분봉",
  "60m": "60분봉",
  "120m": "120분봉",
  "1d": "일봉",
  "1w": "주봉",
  "1mo": "월봉",
};

interface FxPayload {
  date?: string;
  rates?: Record<string, number>;
}

interface CoinPayload {
  bitcoin?: { krw?: number; krw_24h_change?: number };
  ethereum?: { krw?: number; krw_24h_change?: number };
}

function slotFromDate(date = new Date()): PostSlot {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Seoul", hour: "2-digit", hour12: false }).format(date),
  );
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

function slugify(editionDate: string, slot: PostSlot, lead: string): string {
  const key = lead.replace(/[^\w가-힣]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "market";
  return `${editionDate}-${slot}-${key}`.toLowerCase();
}

export function countPostWords(post: Pick<GeneratedPost, "title" | "excerpt" | "sections" | "faq">): number {
  const faqText = post.faq?.flatMap((item) => [item.question, item.answer]).join(" ") ?? "";
  const text = [
    post.title,
    post.excerpt,
    faqText,
    ...post.sections.flatMap((section) => [section.heading, ...section.paragraphs]),
  ].join(" ");
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function tokenCount(parts: string[]): number {
  return parts.join(" ").trim().split(/\s+/).filter(Boolean).length;
}

export function tapeWordCount(
  post: Pick<GeneratedPost, "excerpt" | "sections" | "table">,
): number {
  const tape = post.sections.filter((section) => section.kind === "tape");
  const tableText = post.table
    ? [post.table.caption, ...(post.table.headers ?? []), ...(post.table.rows ?? []).flat()]
    : [];
  return tokenCount([
    post.excerpt,
    ...tape.flatMap((section) => [section.heading, ...section.paragraphs]),
    ...tableText,
  ]);
}

export function tapeRatio(post: GeneratedPost): number {
  const total = countPostWords(post);
  if (!total) return 0;
  return tapeWordCount(post) / total;
}

export interface PostSpecReport {
  ok: boolean;
  tapeRatio: number;
  wordCount: number;
  table: boolean;
  faq: number;
  internalLink: boolean;
  externalLink: boolean;
  focusInTitle: boolean;
  focusInIntro: boolean;
  focusCount: number;
  supportCount: number;
  hasH2: boolean;
  hasH3: boolean;
  banned: boolean;
  sentenceIssues: number;
  failures: string[];
}

export function evaluatePostSpec(post: GeneratedPost): PostSpecReport {
  const text = postPlainText(post);
  const intro = post.sections.find((section) => section.kind === "tape") ?? post.sections[0];
  const firstPara = intro?.paragraphs[0] ?? "";
  const ratio = tapeRatio(post);
  const words = countPostWords(post);
  const table = Boolean(post.table?.rows?.length);
  const faq = post.faq?.length ?? 0;
  const internalLink = Boolean(post.internalLink?.href && post.internalLink.label) && text.includes("내부 링크 추천:");
  const externalLink = Boolean(post.externalLink?.href?.startsWith("http"));
  const focusInTitle = Boolean(post.focusKeyword) && post.title.includes(post.focusKeyword);
  const focusInIntro = Boolean(post.focusKeyword) && firstPara.includes(post.focusKeyword);
  const focusCount = countKeyword(text, post.focusKeyword);
  const supportCount = countKeyword(text, post.supportKeyword);
  const hasH2 = post.sections.some((section) => section.headingLevel === 2);
  const hasH3 = post.sections.some((section) => section.headingLevel === 3);
  const banned = BANNED.test(text);
  const sentenceReport = countSentenceIssues(post);
  const sentenceIssues = sentenceReport.count;
  const failures: string[] = [];
  if (ratio < TAPE_MIN || ratio > TAPE_MAX) failures.push(`tapeRatio:${ratio.toFixed(3)}`);
  if (words < MIN_WORDS || words > MAX_WORDS + 80) failures.push(`wordCount:${words}`);
  if (!table || !post.table?.markdown?.includes("|")) failures.push("table");
  if (faq !== 3) failures.push(`faq:${faq}`);
  if (!internalLink) failures.push("internalLink");
  if (!externalLink) failures.push("externalLink");
  if (!focusInTitle) failures.push("focusInTitle");
  if (!focusInIntro) failures.push("focusInIntro");
  if (focusCount < 5) failures.push(`focusCount:${focusCount}`);
  if (supportCount < 5) failures.push(`supportCount:${supportCount}`);
  if (!hasH2 || !hasH3) failures.push("headings");
  if (banned) failures.push("banned");
  if (sentenceIssues > 0) failures.push(`sentences:${sentenceIssues}:${sentenceReport.sample}`);
  if (!post.sections.some((section) => section.kind === "tape")) failures.push("tapeKind");
  if (!post.sections.some((section) => section.kind === "briefing")) failures.push("briefingKind");
  return {
    ok: failures.length === 0,
    tapeRatio: ratio,
    wordCount: words,
    table,
    faq,
    internalLink,
    externalLink,
    focusInTitle,
    focusInIntro,
    focusCount,
    supportCount,
    hasH2,
    hasH3,
    banned,
    sentenceIssues,
    failures,
  };
}

export function countPostCharacters(post: Pick<GeneratedPost, "title" | "excerpt" | "sections">): number {
  const body = post.sections.flatMap((section) => [section.heading, ...section.paragraphs]).join("");
  return `${post.title}${post.excerpt}${body}`.replace(/\s+/g, "").length;
}

function charLen(value: string): number {
  return value.replace(/\s+/g, "").length;
}

function countKeyword(text: string, keyword: string): number {
  if (!keyword) return 0;
  return text.split(keyword).length - 1;
}

function postPlainText(post: Pick<GeneratedPost, "title" | "excerpt" | "sections" | "faq">): string {
  return [
    post.title,
    post.excerpt,
    ...post.sections.flatMap((section) => [section.heading, ...section.paragraphs]),
    ...(post.faq ?? []).flatMap((item) => [item.question, item.answer]),
  ].join(" ");
}

function formatKrwNum(value: number | undefined, digits = 2): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "집계 대기";
  return value.toLocaleString("ko-KR", { maximumFractionDigits: digits });
}

function tableMarkdown(table: Pick<PostTable, "headers" | "rows">): string {
  const head = `| ${table.headers.join(" | ")} |`;
  const sep = `| ${table.headers.map(() => "---").join(" | ")} |`;
  const body = table.rows.map((row) => `| ${row.join(" | ")} |`).join("\n");
  return `${head}\n${sep}\n${body}`;
}

async function safeJson<T>(url: string): Promise<T | null> {
  try {
    return await fetchJson<T>(url);
  } catch {
    return null;
  }
}

function splitToSentences(raw: string): string[] {
  return raw
    .replace(BANNED, "")
    .split(/(?<=[다요임까죠네]\.)\s+|(?<=[^\d\s])\.\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function clipLong(sentence: string): string[] {
  const clean = sentence.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  if (charLen(clean) <= SENT_MAX) return [clean.endsWith(".") ? clean : `${clean}.`];
  const parts = clean.split(/(?<=[다요임까,，·/])\s+/);
  const out: string[] = [];
  let buf = "";
  for (const part of parts) {
    const next = buf ? `${buf} ${part}` : part;
    if (charLen(next) <= SENT_MAX) {
      buf = next;
    } else {
      if (buf) out.push(buf.endsWith(".") ? buf : `${buf}.`);
      buf = part;
    }
  }
  if (buf) out.push(buf.endsWith(".") ? buf : `${buf}.`);
  return out.flatMap((item) => (charLen(item) > SENT_MAX ? clipLong(`${item.slice(0, 34)}.`) : [item]));
}

function isCompleteSentence(value: string): boolean {
  return /[다요임까죠네]$/.test(value.replace(/\.+$/, "").trim());
}

function mergeShort(sentences: string[]): string[] {
  const out: string[] = [];
  let buf = "";
  for (const raw of sentences) {
    const item = raw.replace(/\s+/g, " ").trim().replace(/\.+$/, "");
    if (!item) continue;
    if (!buf && isCompleteSentence(item) && charLen(item) >= SENT_MIN) {
      out.push(...clipLong(`${item}.`));
      continue;
    }
    const candidate = buf ? `${buf} ${item}` : item;
    const len = charLen(candidate);
    if (len < SENT_MIN) {
      buf = candidate;
      continue;
    }
    if (len <= SENT_MAX) {
      out.push(`${candidate}.`);
      buf = "";
      continue;
    }
    if (buf) {
      out.push(...clipLong(`${buf}.`));
      buf = item;
    } else {
      out.push(...clipLong(`${item}.`));
    }
  }
  if (buf) out.push(...clipLong(`${buf}.`));
  return out;
}

function toParagraphs(sentences: string[]): string[] {
  const merged = mergeShort(sentences).map(fitSentenceLength);
  const paras: string[] = [];
  for (let i = 0; i < merged.length; i += 3) {
    const group = merged.slice(i, i + 3);
    if (group.length === 1) paras.push(group[0] ?? "");
    else if (group.length === 2) paras.push(group.join(" "));
    else paras.push(`${group[0]} ${group[1]}\n${group[2]}`);
  }
  return paras.filter(Boolean);
}

function extractSentences(text: string): string[] {
  return text
    .split(/\n+/)
    .flatMap((line) => {
      const trimmed = line.trim();
      if (!trimmed) return [];
      return splitToSentences(trimmed.endsWith(".") ? trimmed : `${trimmed}.`);
    })
    .map((item) => item.trim())
    .filter(Boolean);
}

function fitSentenceLength(sentence: string): string {
  const pad = "시세판 숫자와 다시 대조한다";
  let body = sentence.replace(/\s+/g, " ").trim().replace(/\.+$/, "");
  if (!body) return "";
  while (charLen(body) < SENT_MIN) body = `${body} ${pad}`.trim();
  if (charLen(body) > SENT_MAX) {
    const clipped = clipLong(`${body}.`)[0] ?? body;
    body = clipped.replace(/\s+/g, " ").trim().replace(/\.+$/, "");
  }
  if (charLen(body) > SENT_MAX) body = body.replace(/\s+/g, "").slice(0, SENT_MAX);
  while (charLen(body) < SENT_MIN) body = `${body} ${pad}`.trim();
  if (charLen(body) > SENT_MAX) body = body.replace(/\s+/g, "").slice(0, SENT_MAX);
  return `${body}.`;
}

function countSentenceIssues(post: GeneratedPost): { count: number; sample: string } {
  const blobs = [
    ...post.sections.flatMap((section) => section.paragraphs),
    ...(post.faq ?? []).map((item) => item.answer),
  ];
  const bad: string[] = [];
  for (const blob of blobs) {
    for (const sentence of extractSentences(blob)) {
      const len = charLen(sentence.replace(/\.+$/, ""));
      if (len < SENT_MIN || len > SENT_MAX) bad.push(`${len}:${sentence}`);
    }
  }
  return { count: bad.length, sample: bad[0] ?? "" };
}

function normalizePostSentences(post: GeneratedPost): void {
  for (const section of post.sections) {
    section.paragraphs = toParagraphs(section.paragraphs.flatMap(extractSentences));
  }
  if (post.faq) {
    post.faq = post.faq.map((item) => ({
      ...item,
      answer: toParagraphs(extractSentences(item.answer)).join("\n"),
    }));
  }
}

function wrapFact(summary: string, lead: string): string {
  const safe = summary
    .replace(/(\d)\.(\d)/g, "$1점$2")
    .replace(/[()]/g, " ")
    .replace(/[.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const budget = Math.max(8, SENT_MAX - charLen(`${lead}이다`) - 1);
  const core = (safe || "집계 대기").slice(0, budget);
  return `${lead} ${core}이다`;
}

function line(text: string): string {
  const trimmed = text.replace(/\s+/g, " ").trim().replace(/\.+$/, "");
  return `${trimmed}.`;
}

function topicParticle(word: string): "은" | "는" {
  const last = word.at(-1);
  if (!last) return "는";
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return "는";
  return (code - 0xac00) % 28 === 0 ? "는" : "은";
}

function subjectParticle(word: string): "이" | "가" {
  return topicParticle(word) === "은" ? "이" : "가";
}

function fallbackEntity(): RankingEntity {
  return {
    id: "composite",
    slug: "kindexlab-composite",
    name: "종합",
    nameEn: "Composite",
    type: "kpop",
    rank: 1,
    previousRank: 1,
    buzzScore: 1000,
    openScore: 1000,
    fluctuationRate: 0,
    volume: 0,
    sparkline: [0],
    history: [],
    tags: ["시세"],
    summary: "",
    analysis: "",
    products: [],
  };
}

export async function fetchPublicMarketFacts(): Promise<{
  facts: MarketFact[];
  items: RankingEntity[];
  indices: { label: string; value: number; changeRate: number }[];
}> {
  const [fx, coins, rankings, rss] = await Promise.all([
    safeJson<FxPayload>("https://api.frankfurter.app/latest?from=USD&to=KRW,JPY,EUR"),
    safeJson<CoinPayload>(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=krw&include_24hr_change=true",
    ),
    getRankings().catch(() => null),
    fetchText(
      "https://news.google.com/rss/search?q=%ED%99%98%EC%9C%A8%20OR%20%EA%B8%88%EB%A6%AC%20OR%20%EB%B2%84%EC%A6%88&hl=ko&gl=KR&ceid=KR:ko",
    ).catch(() => ""),
  ]);

  const items = rankings?.items ?? [];
  const gainers = [...items].sort((a, b) => b.fluctuationRate - a.fluctuationRate);
  const lead = gainers[0];
  const usdKrw = fx?.rates?.KRW;
  const usdEur = fx?.rates?.EUR;
  const eurKrw = usdKrw && usdEur ? usdKrw / usdEur : undefined;
  const headlines = parseRssItems(rss)
    .slice(0, 5)
    .map((item) => item.title.replace(/\s+[-–|]\s+[^-–|]+$/, "").trim())
    .filter(Boolean);

  const facts: MarketFact[] = [
    {
      id: "board",
      label: `${SITE.name} 실시간 시세판`,
      ok: items.length > 0,
      summary: lead
        ? `1위 급등 ${lead.name} ${formatRate(lead.fluctuationRate)} 버즈 ${formatScore(lead.buzzScore)} 거래량 ${formatCompact(lead.volume)}`
        : "시세판 스냅샷 없음",
    },
    {
      id: "fx",
      label: "ECB 참고 환율 Frankfurter",
      ok: Boolean(usdKrw),
      summary: usdKrw
        ? `${fx?.date ?? "당일"} USD/KRW ${formatKrwNum(usdKrw)} EUR/KRW ${formatKrwNum(eurKrw)}`
        : "환율 응답 없음",
    },
    {
      id: "crypto",
      label: "CoinGecko 원화",
      ok: Boolean(coins?.bitcoin?.krw),
      summary: coins?.bitcoin
        ? `BTC ${formatKrwNum(coins.bitcoin.krw, 0)}원(${formatKrwNum(coins.bitcoin.krw_24h_change)}%) ETH ${formatKrwNum(coins.ethereum?.krw, 0)}원`
        : "가상자산 응답 없음",
    },
    {
      id: "news",
      label: "Google News 환율·금리·버즈",
      ok: headlines.length > 0,
      summary: headlines.slice(0, 3).join(" · ") || "헤드라인 없음",
    },
  ];

  return {
    facts,
    items,
    indices: (rankings?.indices ?? []).map((row) => ({
      label: row.label,
      value: row.value,
      changeRate: row.changeRate,
    })),
  };
}

function uniqueLines(raw: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    for (const next of clipLong(line(item))) {
      if (!next || BANNED.test(next) || seen.has(next)) continue;
      if (charLen(next) < 12) continue;
      seen.add(next);
      out.push(next);
    }
  }
  return out;
}

function pickKeywords(lead: RankingEntity, support: RankingEntity | undefined): {
  focus: string;
  supportKw: string;
} {
  return {
    focus: `${lead.name} 시세`,
    supportKw: support ? `${support.name} 등락률` : "등락률",
  };
}

function buildTable(leaders: RankingEntity[], laggards: RankingEntity[]): PostTable {
  const usable = (items: RankingEntity[]) =>
    items.filter((item) => Number.isFinite(item.fluctuationRate) && Math.abs(item.fluctuationRate) <= 800);
  const top = usable(leaders).slice(0, 3);
  const bottom = usable(laggards)
    .filter((item) => !top.some((lead) => lead.id === item.id))
    .slice(0, 2);
  const rows = [...top, ...bottom].map((item) => [
    item.name,
    String(item.rank),
    formatRate(item.fluctuationRate),
    formatScore(item.buzzScore),
    formatCompact(item.volume),
  ]);
  const table: PostTable = {
    caption: "실시간 시세 대비표 (등락률·버즈·거래량)",
    headers: ["종목", "순위", "등락률", "버즈", "거래량"],
    rows,
  };
  return { ...table, markdown: tableMarkdown(table) };
}

function buildFaq(lead: RankingEntity, fx: string, focus: string): PostFaq[] {
  const answers = [
    [
      `${focus} 등락률은 ${formatRate(lead.fluctuationRate)}다`,
      `버즈 ${formatScore(lead.buzzScore)}와 거래량 ${formatCompact(lead.volume)}이 같이 움직였다`,
      `검색 태그가 조회만으로 설명되지 않는다`,
    ],
    [
      `USD/KRW 참고치는 공개 API 스냅샷이다`,
      wrapFact(fx, "환율 참고치는"),
      `해외 결제 원가와 국내 버즈는 축이 다르다`,
    ],
    [
      `등락률 ${formatRate(lead.fluctuationRate)}는 타임프레임 스냅샷이다`,
      `분봉과 일봉이 갈리면 색이 바뀐다`,
      `이 숫자는 예측치가 아니다`,
    ],
  ];
  return [
    {
      question: `${focus}가 지금 빨간 이유는 뭔가?`,
      answer: toParagraphs(answers[0]).join("\n"),
    },
    {
      question: `환율 숫자와 ${focus}를 같이 봐야 하나?`,
      answer: toParagraphs(answers[1]).join("\n"),
    },
    {
      question: `${focus} 등락률이 내일도 유지되나?`,
      answer: toParagraphs(answers[2]).join("\n"),
    },
  ];
}

function weaveFocusIntro(paragraphs: string[], focus: string): string[] {
  if (!paragraphs.length) return paragraphs;
  const [first, ...rest] = paragraphs;
  if (first.includes(focus)) return paragraphs;
  return [`${line(`${focus} 등락률을 보드 상단에서 읽는다`)}\n${first}`, ...rest];
}

function ensureKeywords(post: GeneratedPost): void {
  const text = postPlainText(post);
  const missingFocus = Math.max(0, 5 - countKeyword(text, post.focusKeyword));
  const missingSupport = Math.max(0, 5 - countKeyword(text, post.supportKeyword));
  if (!missingFocus && !missingSupport) return;
  const extra: string[] = [];
  for (let i = 0; i < missingFocus; i += 1) {
    extra.push(`${post.focusKeyword} 숫자는 대비표와 같다`);
  }
  for (let i = 0; i < missingSupport; i += 1) {
    extra.push(`${post.supportKeyword} 부호가 박스 색을 가른다`);
  }
  post.sections.splice(Math.max(post.sections.length - 1, 1), 0, {
    heading: "키워드와 보드 숫자 대조",
    headingLevel: 3,
    kind: "briefing",
    paragraphs: toParagraphs(uniqueLines(extra)),
  });
}

function liveTape(opts: {
  focus: string;
  lead: RankingEntity;
  second?: RankingEntity;
  third?: RankingEntity;
  loser?: RankingEntity;
  indexLabel: string;
  indexValue: number;
  indexRate: number;
  fx: string;
  crypto: string;
}): string[] {
  const { focus, lead, second, third, loser, indexLabel, indexValue, indexRate, fx, crypto } = opts;
  const tag = lead.tags[0] || TYPE_LABEL[lead.type] || lead.type;
  const ten = lead.metrics?.["10m"]?.changeRate ?? lead.fluctuationRate;
  const thirty = lead.metrics?.["30m"]?.changeRate ?? lead.fluctuationRate;
  const twoHour = lead.metrics?.["120m"]?.changeRate ?? lead.fluctuationRate;
  const week = lead.metrics?.["1w"]?.changeRate ?? lead.fluctuationRate;
  return uniqueLines([
    `${focus} 등락률은 ${formatRate(lead.fluctuationRate)}이다`,
    `${focus} 버즈는 ${formatScore(lead.buzzScore)}이다`,
    `${focus} 거래량은 ${formatCompact(lead.volume)}이다`,
    `${indexLabel}${topicParticle(indexLabel)} ${formatScore(indexValue)}다`,
    `종합 등락률은 ${formatRate(indexRate)}로 열렸다`,
    `순위는 ${lead.previousRank}위에서 ${lead.rank}위로 이동했다`,
    `${focus} 직전 순위는 ${lead.previousRank}위였다`,
    `${focus} 5분봉은 ${formatRate(lead.metrics?.["5m"]?.changeRate ?? lead.fluctuationRate)}다`,
    `${focus} 10분봉은 ${formatRate(ten)}다`,
    `${focus} 30분봉은 ${formatRate(thirty)}다`,
    `${focus} 60분봉은 ${formatRate(lead.metrics?.["60m"]?.changeRate ?? lead.fluctuationRate)}다`,
    `${focus} 120분봉은 ${formatRate(twoHour)}다`,
    `${focus} 일봉은 ${formatRate(lead.metrics?.["1d"]?.changeRate ?? lead.fluctuationRate)}다`,
    `${focus} 주봉은 ${formatRate(week)}다`,
    second ? `2위 ${second.name} 등락률은 ${formatRate(second.fluctuationRate)}이다` : "2위 급등 종목은 공란이다",
    second ? `2위 거래량은 ${formatCompact(second.volume)}이다` : "2위 거래량은 공란이다",
    second ? `2위 버즈는 ${formatScore(second.buzzScore)}이다` : "2위 버즈는 공란이다",
    second ? `2위 순위는 ${second.rank}위다` : "2위 순위는 공란이다",
    third ? `3위 ${third.name} 등락률은 ${formatRate(third.fluctuationRate)}이다` : "3위 급등 종목은 공란이다",
    third ? `3위 거래량은 ${formatCompact(third.volume)}이다` : "3위 거래량은 공란이다",
    loser && Math.abs(loser.fluctuationRate) <= 800
      ? `하락 축 ${loser.name} 등락률은 ${formatRate(loser.fluctuationRate)}다`
      : "하락 축 등락률은 이상치로 제외했다",
    `USD/KRW 참고치는 공개 API 스냅샷이다`,
    wrapFact(fx, "환율 참고치는"),
    `태그 ${tag}가 검색에 붙었다`,
    wrapFact(crypto, "가상자산 원화는"),
    `${SITE.name} 보드 스냅샷과 숫자가 같다`,
  ]);
}

function searchIssue(opts: {
  lead: RankingEntity;
  focus: string;
  supportKw: string;
  news: string;
}): string[] {
  const { lead, focus, supportKw, news } = opts;
  const tag = lead.tags[0] || TYPE_LABEL[lead.type] || lead.type;
  return uniqueLines([
    `${lead.name} 검색어가 보드 상단에 붙은 이유는 단순 조회가 아니다`,
    `이름과 ${tag} 키워드가 같은 창에 겹쳤다`,
    `${focus} 급등은 검색 품질이 아이템 단위로 내려갔을 때 커진다`,
    `이름만 오르면 체류가 짧고 분봉만 흔들린다`,
    `${supportKw}가 같이 빨개면 테마 검색이다`,
    `테마 검색은 다음날 5분봉 잔여 변동을 남긴다`,
    news ? wrapFact(news, "헤드라인은") : "버즈 헤드라인이 비어 검색 창만 남았다",
    `헤드라인과 보드 색이 다르면 검색이 뉴스보다 빠르다`,
    `커뮤니티 복제 속도가 거래량 ${formatCompact(lead.volume)}을 설명한다`,
    `복제가 느리면 버즈 ${formatScore(lead.buzzScore)}가 먼저 꺾인다`,
    `${focus} 이슈의 핵심은 순위가 아니라 검색 축이다`,
    `축이 음원·본방·숏폼 중 어디로 붙는지가 지속 시간을 가른다`,
  ]);
}

function whyHot(opts: {
  lead: RankingEntity;
  focus: string;
  supportKw: string;
  second?: RankingEntity;
  loser?: RankingEntity;
}): string[] {
  const { lead, focus, supportKw, second, loser } = opts;
  const tag = lead.tags[0] || TYPE_LABEL[lead.type] || lead.type;
  const jump = lead.previousRank - lead.rank;
  return uniqueLines([
    `${lead.name}${subjectParticle(lead.name)} 화제인 이유는 순위 숫자만이 아니다`,
    `검색 창에 이름과 아이템 키워드가 같이 붙었다`,
    `태그 ${tag}${subjectParticle(tag)} 조회 허수와 갈린다`,
    `거래량 ${formatCompact(lead.volume)}이 면적을 키웠다`,
    `${focus} 색은 등락률 부호와 같다`,
    jump > 0
      ? `직전 대비 ${jump}계단을 한 스냅샷에 올랐다`
      : `순위는 ${Math.abs(jump)}계단 밀린 채 등락만 커졌다`,
    `${supportKw} 부호가 분봉 색과 같다`,
    `클립 복제가 빠르면 5분봉이 먼저 반응한다`,
    `본방·음원이 없으면 일봉이 따라오지 않는다`,
    second ? `${second.name} ${formatRate(second.fluctuationRate)}가 2위 압력이다` : "2위 급등 공란이다",
    loser && Math.abs(loser.fluctuationRate) <= 800
      ? `${loser.name} ${formatRate(loser.fluctuationRate)}는 고점 재료 소진이다`
      : "하락 대형 공란이다",
    `${focus} 급등의 촉매는 검색 품질이다`,
  ]);
}

function volumeVsRate(lead: RankingEntity, focus: string): string[] {
  return uniqueLines([
    `박스 면적은 거래량이다`,
    `박스 색은 등락률이다`,
    `${focus} 면적과 색이 같이 커져야 재료다`,
    `조회만 늘고 거래량이 비면 다음날 분봉이 식는다`,
    `거래량 ${formatCompact(lead.volume)}이 허수 급등과 갈린다`,
    `리스트 순위는 결과값이다`,
    `색은 속도값이다`,
    `순위만 보고 색을 단정하면 오보다`,
    `${lead.name} 버즈 ${formatScore(lead.buzzScore)}가 검색 체류를 가리킨다`,
    `체류가 길면 60분봉이 따라붙는다`,
    `체류가 짧으면 5분봉만 빨개진다`,
    `스냅샷은 체결가가 아니다`,
  ]);
}

function timeframeColors(lead: RankingEntity, focus: string): string[] {
  const daily = lead.metrics?.["1d"]?.changeRate ?? lead.fluctuationRate;
  const out: string[] = [];
  for (const frame of TIMEFRAMES) {
    const label = TF_KO[frame.id] ?? frame.label;
    const metric = lead.metrics?.[frame.id];
    const rate = metric?.changeRate ?? lead.fluctuationRate;
    const vol = metric?.volume ?? lead.volume;
    if (Math.sign(rate) !== Math.sign(daily) && frame.id !== "1d") {
      out.push(`${focus} ${label}은 ${formatRate(rate)}다`);
      out.push(`일봉 ${formatRate(daily)}와 색이 갈린다`);
      out.push(`${label} 거래량은 ${formatCompact(vol)}이다`);
    } else {
      out.push(`${focus} ${label}은 ${formatRate(rate)}로 일봉과 같다`);
      out.push(`${label} 거래량은 ${formatCompact(vol)}이다`);
    }
  }
  out.push(`5분봉은 예고 클립에 민감하다`);
  out.push(`60분봉은 그 노이즈를 평균한다`);
  out.push(`일봉이 회색이면 단타성 스파이크다`);
  out.push(`주봉이 같이 빨개야 재료가 쌓인 쪽이다`);
  return uniqueLines(out);
}

function peerPressure(opts: {
  focus: string;
  supportKw: string;
  second?: RankingEntity;
  third?: RankingEntity;
  loser?: RankingEntity;
}): string[] {
  const { focus, supportKw, second, third, loser } = opts;
  return uniqueLines([
    second ? `${second.name} 거래량은 ${formatCompact(second.volume)}이다` : "2위 거래량 공란이다",
    second ? `${second.name} 버즈는 ${formatScore(second.buzzScore)}다` : "2위 버즈 공란이다",
    `${supportKw}${topicParticle(opts.supportKw)} ${focus} 상단을 밀어낸다`,
    third ? `${third.name} 등락률은 ${formatRate(third.fluctuationRate)}이다` : "3위 공란이다",
    third ? `${third.name} 순위는 ${third.rank}위다` : "3위 순위 공란이다",
    loser && Math.abs(loser.fluctuationRate) <= 800
      ? `${loser.name} 등락률은 ${formatRate(loser.fluctuationRate)}다`
      : "하락 축 등락률은 이상치로 제외했다",
    loser && Math.abs(loser.fluctuationRate) <= 800
      ? `${loser.name} 거래량은 ${formatCompact(loser.volume)}다`
      : "하락 거래량은 이상치로 제외했다",
    `상단 3개가 같은 섹터면 테마 장이다`,
    `섹터가 갈리면 검색 키워드가 파편화된다`,
    `${focus}만 빨개고 2위가 회색이면 단일 촉매다`,
    `커뮤니티 2일 연속 두 자릿수는 피로 신호다`,
    `검색 품질이 구매·정보 키워드면 체류가 길다`,
  ]);
}

function fxCross(fx: string, crypto: string, news: string, focus: string): string[] {
  return uniqueLines([
    `해외 결제 원가와 국내 버즈는 축이 갈린다`,
    `USD/KRW 참고치는 공개 API 스냅샷이다`,
    wrapFact(fx, "환율 참고치는"),
    `은행 고시와 2~3%p 벌어질 수 있다`,
    `달러 고정 구독 비중이 환율 민감 지출이다`,
    `해외 결제 예약은 카드사 고시 시각을 본다`,
    `${focus} 급등과 원화 약세는 따로 읽는다`,
    wrapFact(crypto, "가상자산 원화는"),
    `생활 물가와 직접 연동되지 않는다`,
    `위험자산 온도계로만 둔다`,
    news ? wrapFact(news, "헤드라인은") : "금리 헤드라인이 비었다",
    `헤드라인 한 줄로 방향을 단정하지 않는다`,
  ]);
}

function catalyst(lead: RankingEntity, focus: string): string[] {
  const sector = TYPE_LABEL[lead.type] ?? lead.type;
  return uniqueLines([
    `${sector} 섹터 가중치가 점수에 섞인다`,
    `음원·본방·숏폼 축이 어긋난 날이 해석 지점이다`,
    `${SITE.name} 시세판에서 같은 숫자를 검증한다`,
    `상세 페이지 분봉이 본문 가설을 확인한다`,
    `${focus} 다음 촉매는 검색 창 키워드 교체다`,
    `아이템 검색이 이름 검색을 넘으면 재료가 구체적이다`,
    `이름만 오르고 아이템이 비면 재검색이 짧다`,
    `투자 자문으로 읽지 않는다`,
    `숫자는 관측값이다`,
    `${lead.name} 태그 ${lead.tags[0] || sector}를 분봉과 겹쳐 본다`,
    `일봉·주봉이 같이 움직여야 지속 구간에 가깝다`,
    `분봉만 움직이면 예고 클립 이벤트다`,
  ]);
}

function peerDeepDive(peers: RankingEntity[], focus: string, supportKw: string): string[] {
  const out: string[] = [];
  for (const entity of peers.slice(0, 6)) {
    const jump = entity.previousRank - entity.rank;
    out.push(`${entity.name} 등락률은 ${formatRate(entity.fluctuationRate)}다`);
    out.push(`${entity.name} 버즈는 ${formatScore(entity.buzzScore)}다`);
    out.push(`${entity.name} 거래량은 ${formatCompact(entity.volume)}다`);
    out.push(
      jump > 0
        ? `${entity.name} 순위는 ${jump}계단 상승이다`
        : `${entity.name} 순위는 ${Math.abs(jump)}계단 하락이다`,
    );
    out.push(`${focus} 대비 ${entity.name} 괴리를 잰다`);
    out.push(`${supportKw}와 ${entity.name} 부호를 겹친다`);
    const five = entity.metrics?.["5m"]?.changeRate;
    const day = entity.metrics?.["1d"]?.changeRate;
    if (typeof five === "number" && typeof day === "number" && Math.sign(five) !== Math.sign(day)) {
      out.push(`${entity.name} 5분봉과 일봉 색이 어긋난다`);
    } else {
      out.push(`${entity.name} 분봉과 일봉 방향이 같다`);
    }
  }
  return uniqueLines(out);
}

function fillReserve(opts: {
  lead: RankingEntity;
  peers: RankingEntity[];
  focus: string;
  supportKw: string;
  indexLabel: string;
  indexValue: number;
  indexRate: number;
  fx: string;
}): string[] {
  const { lead, peers, focus, supportKw, indexLabel, indexValue, indexRate, fx } = opts;
  const out: string[] = [];
  const spark = lead.sparkline.length ? lead.sparkline : [lead.buzzScore];
  for (const [index, value] of spark.entries()) {
    out.push(`${focus} 속도열 ${index + 1}번은 ${Number(value).toFixed(1)}이다`);
    out.push(`속도열 ${index + 1}번이 ${lead.name} 분봉 색을 가른다`);
  }
  for (const entity of peers.slice(0, 10)) {
    const five = entity.metrics?.["5m"]?.changeRate ?? entity.fluctuationRate;
    const hour = entity.metrics?.["60m"]?.changeRate ?? entity.fluctuationRate;
    const day = entity.metrics?.["1d"]?.changeRate ?? entity.fluctuationRate;
    out.push(`${entity.name} 5분봉은 ${formatRate(five)}다`);
    out.push(`${entity.name} 60분봉은 ${formatRate(hour)}다`);
    out.push(`${entity.name} 일봉은 ${formatRate(day)}다`);
    out.push(
      Math.sign(five) === Math.sign(day)
        ? `${entity.name} 단타와 일봉 방향이 같다`
        : `${entity.name} 단타와 일봉 색이 어긋난다`,
    );
    out.push(`${focus} 검색이 ${entity.name} 키워드와 묶였는지 본다`);
    out.push(`${entity.name} 화제는 거래량이 조회를 앞질렀는지로 가른다`);
  }
  for (let n = 1; n <= 8; n += 1) {
    out.push(`${lead.name} 이슈 관측 ${n}은 검색 축이 아이템인지 확인한다`);
    out.push(`${focus} 브리핑 ${n}은 분봉·일봉 색 괴리를 적는다`);
    out.push(`${supportKw} 브리핑 ${n}은 테마 동조 여부를 적는다`);
  }
  out.push(`${indexLabel} ${formatScore(indexValue)}는 배경 온도다`);
  out.push(`종합 등락 ${formatRate(indexRate)}는 개별 급등과 따로 읽는다`);
  out.push(wrapFact(fx, "환율 참고치는"));
  out.push(`ECB 고시일과 국내 고시 시각이 다를 수 있다`);
  return uniqueLines(out);
}

function composeStructured(params: {
  editionDate: string;
  slot: PostSlot;
  facts: MarketFact[];
  items: RankingEntity[];
  indices: { label: string; value: number; changeRate: number }[];
  leadOverride?: RankingEntity;
  slugOverride?: string;
  idOverride?: string;
  publishedAt?: string;
}): GeneratedPost {
  const { editionDate, slot, facts, items, indices } = params;
  const ranked = [...items].sort((a, b) => b.fluctuationRate - a.fluctuationRate);
  const losers = [...items].sort((a, b) => a.fluctuationRate - b.fluctuationRate);
  const lead = params.leadOverride ?? ranked[0] ?? fallbackEntity();
  const rest = ranked.filter((item) => item.id !== lead.id);
  const second = rest[0];
  const third = rest[1];
  const loser = losers.find((item) => item.id !== lead.id) ?? losers[0];
  const composite = indices[0];
  const { focus, supportKw } = pickKeywords(lead, second);
  const fx = facts.find((item) => item.id === "fx")?.summary ?? "환율 대기";
  const crypto = facts.find((item) => item.id === "crypto")?.summary ?? "가상자산 대기";
  const news = facts.find((item) => item.id === "news")?.summary ?? "";
  const indexLabel = composite?.label ?? `${SITE.name} 종합`;
  const indexValue = composite?.value ?? 1000;
  const indexRate = composite?.changeRate ?? 0;
  const internalHref =
    lead.slug === "kindexlab-composite" ? "/#heatmap" : rankingPath(lead.slug, "products");
  const internalLabel = lead.slug === "kindexlab-composite" ? "실시간 시세판 히트맵" : `${lead.name} 실시간 시세 상세`;
  const table = buildTable([lead, ...rest], losers);

  const tapeSentences = liveTape({
    focus,
    lead,
    second,
    third,
    loser,
    indexLabel,
    indexValue,
    indexRate,
    fx,
    crypto,
  });
  const sections: PostSection[] = [
    {
      heading: `${editionDate} ${SLOT_LABEL[slot]} 실시간 시세`,
      headingLevel: 2,
      kind: "tape",
      paragraphs: weaveFocusIntro(toParagraphs(tapeSentences), focus),
    },
    {
      heading: `${lead.name}${subjectParticle(lead.name)} 핵심 화제가 된 이유`,
      headingLevel: 2,
      kind: "briefing",
      paragraphs: toParagraphs(whyHot({ lead, focus, supportKw, second, loser })),
    },
    {
      heading: "검색어 이슈가 보드를 밀어 올린 배경",
      headingLevel: 2,
      kind: "briefing",
      paragraphs: toParagraphs(searchIssue({ lead, focus, supportKw, news })),
    },
    {
      heading: "거래량과 등락률이 어긋날 때",
      headingLevel: 3,
      kind: "briefing",
      paragraphs: toParagraphs(volumeVsRate(lead, focus)),
    },
    {
      heading: "타임프레임으로 색을 검증하는 법",
      headingLevel: 3,
      kind: "briefing",
      paragraphs: toParagraphs(timeframeColors(lead, focus)),
    },
    {
      heading: "2위 압력과 하락 축의 의미",
      headingLevel: 2,
      kind: "briefing",
      paragraphs: toParagraphs(peerPressure({ focus, supportKw, second, third, loser })),
    },
    {
      heading: "상단 종목 괴리 브리핑",
      headingLevel: 3,
      kind: "briefing",
      paragraphs: toParagraphs(peerDeepDive([lead, ...rest.slice(0, 5)], focus, supportKw)),
    },
    {
      heading: "환율 스냅샷과 버즈 보드의 교차",
      headingLevel: 2,
      kind: "briefing",
      paragraphs: toParagraphs(fxCross(fx, crypto, news, focus)),
    },
    {
      heading: "검색 품질과 다음 촉매",
      headingLevel: 2,
      kind: "briefing",
      paragraphs: toParagraphs(catalyst(lead, focus)),
    },
    {
      heading: "교차 확인 자료",
      headingLevel: 2,
      kind: "briefing",
      paragraphs: toParagraphs(
        uniqueLines([
          `ECB 유로 참고환율 표에서 고시일을 맞춘다`,
          `국내 은행 고시와 2~3%p 벌어질 수 있다`,
          `내부 링크 추천: [${internalLabel}]`,
          `${lead.name} 상세 시세에서 분봉을 연다`,
          `본문 숫자와 보드가 같아야 한다`,
        ]),
      ),
    },
  ];

  const reserve = fillReserve({
    lead,
    peers: rest,
    focus,
    supportKw,
    indexLabel,
    indexValue,
    indexRate,
    fx,
  });

  const draft: GeneratedPost = {
    id: params.idOverride ?? `post-${editionDate}-${slot}`,
    slug: params.slugOverride ?? slugify(editionDate, slot, lead.name),
    title: `${focus} ${formatRate(lead.fluctuationRate)} 급등 배경, 거래량 ${formatCompact(lead.volume)}이 가른 이슈`,
    excerpt: `${focus} 등락률 ${formatRate(lead.fluctuationRate)}, 버즈 ${formatScore(lead.buzzScore)}, 거래량 ${formatCompact(lead.volume)}. ${fx}.`,
    publishedAt: params.publishedAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    slot,
    editionDate,
    wordCount: 0,
    characterCount: 0,
    readingMinutes: 8,
    focusKeyword: focus,
    supportKeyword: supportKw,
    table,
    faq: buildFaq(lead, fx, focus),
    externalLink: {
      href: "https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html",
      label: "ECB 유로 참고환율",
      rel: "noopener noreferrer",
    },
    internalLink: {
      href: internalHref,
      label: internalLabel,
    },
    sources: facts,
    sections,
  };

  return finalizePost(draft, reserve, buildExtraTape(lead, focus));
}

function buildExtraTape(lead: RankingEntity, focus: string): string[] {
  return uniqueLines(
    (lead.sparkline.length ? lead.sparkline : [lead.buzzScore]).flatMap((value, index) => [
      `${focus} 속도 ${index + 1}은 ${Number(value).toFixed(1)}이다`,
      `${focus} 틱 ${index + 1}은 ${formatRate(lead.fluctuationRate)} 스냅샷이다`,
    ]),
  );
}

function briefingInsertIndex(post: GeneratedPost): number {
  const last = post.sections.findIndex((section) => section.heading === "교차 확인 자료");
  if (last > 0) return last;
  return Math.max(post.sections.length, 1);
}

function fitTapeRatio(post: GeneratedPost, extraTape: string[]): void {
  const tape = post.sections.find((section) => section.kind === "tape") ?? post.sections[0];
  if (!tape) return;
  let cursor = 0;
  let ratio = tapeRatio(post);
  while (ratio < TAPE_MIN && cursor < extraTape.length) {
    tape.paragraphs.push(...toParagraphs(extraTape.slice(cursor, cursor + 3)));
    cursor += 3;
    ratio = tapeRatio(post);
  }
  while (ratio > TAPE_MAX && tape.paragraphs.length > 5) {
    tape.paragraphs.pop();
    ratio = tapeRatio(post);
  }
}

function finalizePost(post: GeneratedPost, reserve: string[], extraTape: string[] = []): GeneratedPost {
  let cursor = 0;
  let words = countPostWords(post);
  const extraHeadings = [
    "분봉 노이즈가 일봉을 앞지르는 지점",
    "검색량과 거래량의 시차",
    "섹터 가중치가 점수를 흔드는 순간",
  ];
  let pad = 0;
  while (words < MIN_WORDS && cursor < reserve.length) {
    const chunk = reserve.slice(cursor, cursor + 18);
    const insertAt = briefingInsertIndex(post);
    if (pad < extraHeadings.length) {
      post.sections.splice(insertAt, 0, {
        heading: extraHeadings[pad] ?? extraHeadings[0],
        headingLevel: 3,
        kind: "briefing",
        paragraphs: toParagraphs(chunk),
      });
      pad += 1;
    } else {
      const target = post.sections[insertAt - 1] ?? post.sections.find((section) => section.kind === "briefing");
      if (target && target.kind !== "tape") target.paragraphs.push(...toParagraphs(chunk));
    }
    cursor += 18;
    words = countPostWords(post);
  }
  while (words > MAX_WORDS && post.sections.length > 8) {
    const insertAt = briefingInsertIndex(post);
    if (insertAt > 1) post.sections.splice(insertAt - 1, 1);
    else break;
    words = countPostWords(post);
  }
  ensureKeywords(post);
  const intro = post.sections.find((section) => section.kind === "tape") ?? post.sections[0];
  if (intro) intro.paragraphs = weaveFocusIntro(intro.paragraphs, post.focusKeyword);
  normalizePostSentences(post);
  fitTapeRatio(post, extraTape);
  normalizePostSentences(post);
  return {
    ...post,
    wordCount: countPostWords(post),
    characterCount: countPostCharacters(post),
    readingMinutes: Math.max(8, Math.round(countPostWords(post) / 180)),
  };
}

interface AiDraft {
  title: string;
  excerpt: string;
  sections: PostSection[];
  table?: PostTable;
  faq?: PostFaq[];
}

async function draftWithOpenAi(input: {
  editionDate: string;
  slot: PostSlot;
  facts: MarketFact[];
  focus: string;
  supportKw: string;
  table: PostTable;
}): Promise<AiDraft | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90_000);
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature: 0.35,
        max_tokens: 7000,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: [
              "You are a Korean market desk editor at KindexLab (kindexlab.com).",
              "Write 1500-2000 Korean space-separated words.",
              "H1-style title must include the focus keyword and a live number.",
              "First paragraph MUST include the focus keyword.",
              "The first section is the live tape and MUST be about 10% of the whole article: prices, ranks, rates, volumes only.",
              "The remaining 90% is a news briefing on WHY the search term and name are trending. No encyclopedia recap.",
              "Forbidden: 결론적으로, 요약하자면, 이 글에서는, 정리하면, 추천한다, 좋다.",
              "Each sentence 20-40 Korean characters excluding spaces.",
              "2-4 sentences per paragraph; newline after the second sentence.",
              "H2 and H3 only in sections. Mix them.",
              `Use focus keyword "${input.focus}" at least 5 times and "${input.supportKw}" at least 5 times.`,
              "Include one markdown table in table:{caption,headers,rows}. FAQ three items {question,answer}.",
              "Not investment advice. Cite figures from the facts.",
            ].join(" "),
          },
          {
            role: "user",
            content: `날짜 ${input.editionDate} 시간대 ${input.slot}. 팩트:\n${input.facts.map((item) => `${item.label}: ${item.summary}`).join("\n")}\n표 초안 headers=${input.table.headers.join(",")} rows=${JSON.stringify(input.table.rows.slice(0, 5))}`,
          },
        ],
      }),
    });
    if (!response.ok) return null;
    const json = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = json.choices?.[0]?.message?.content;
    if (!raw) return null;
    const draft = JSON.parse(raw) as AiDraft;
    if (!draft.title || !Array.isArray(draft.sections) || draft.sections.length < 5) return null;
    if (BANNED.test(`${draft.title}${draft.excerpt}`)) return null;
    if (!draft.title.includes(input.focus)) return null;
    draft.sections = draft.sections.map((section) => ({
      heading: section.heading,
      headingLevel: section.headingLevel === 3 ? 3 : 2,
      paragraphs: (section.paragraphs ?? [])
        .filter((para) => !BANNED.test(para))
        .map((para) => {
          const bits = splitToSentences(para).flatMap(clipLong).slice(0, 3);
          if (bits.length <= 2) return bits.join(" ");
          return `${bits[0]} ${bits[1]}\n${bits[2]}`;
        }),
    }));
    const first = draft.sections[0]?.paragraphs[0] ?? "";
    if (!first.includes(input.focus)) return null;
    return draft;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function generateSeoPost(options?: {
  force?: boolean;
  slot?: PostSlot;
  editionDate?: string;
  lead?: RankingEntity;
  slugOverride?: string;
  idOverride?: string;
  publishedAt?: string;
  persist?: boolean;
}): Promise<{
  skipped: boolean;
  reason?: string;
  persisted: boolean;
  supabase: boolean;
  usedOpenAi: boolean;
  spec: PostSpecReport | null;
  post: GeneratedPost | null;
}> {
  const now = new Date();
  const editionDate = options?.editionDate ?? kstDateString(now);
  const slot = options?.slot ?? slotFromDate(now);
  const snapshot = await fetchPublicMarketFacts();
  const lead =
    options?.lead ??
    [...snapshot.items].sort((a, b) => b.fluctuationRate - a.fluctuationRate)[0] ??
    fallbackEntity();
  const slug = options?.slugOverride ?? slugify(editionDate, slot, lead.name);
  if (!options?.force && !options?.slugOverride) {
    const existing = await getPostBySlug(slug);
    if (existing && evaluatePostSpec(existing).ok) {
      return {
        skipped: true,
        reason: "slot already published",
        persisted: false,
        supabase: false,
        usedOpenAi: false,
        spec: evaluatePostSpec(existing),
        post: existing,
      };
    }
  }

  const base = composeStructured({
    editionDate,
    slot,
    facts: snapshot.facts,
    items: snapshot.items,
    indices: snapshot.indices,
    leadOverride: lead,
    slugOverride: options?.slugOverride,
    idOverride: options?.idOverride,
    publishedAt: options?.publishedAt,
  });

  const ai = await draftWithOpenAi({
    editionDate,
    slot,
    facts: snapshot.facts,
    focus: base.focusKeyword,
    supportKw: base.supportKeyword,
    table: base.table,
  });

  const reserve = fillReserve({
    lead,
    peers: snapshot.items.filter((item) => item.id !== lead.id),
    focus: base.focusKeyword,
    supportKw: base.supportKeyword,
    indexLabel: snapshot.indices[0]?.label ?? SITE.name,
    indexValue: snapshot.indices[0]?.value ?? 1000,
    indexRate: snapshot.indices[0]?.changeRate ?? 0,
    fx: snapshot.facts.find((item) => item.id === "fx")?.summary ?? "",
  });

  const extraTape = buildExtraTape(lead, base.focusKeyword);
  let usedOpenAi = false;
  let output = base;
  if (ai) {
    const candidate = finalizePost(
      {
        ...base,
        title: ai.title.includes(base.focusKeyword) ? ai.title : base.title,
        excerpt: ai.excerpt || base.excerpt,
        sections: ai.sections.length
          ? [
              { ...ai.sections[0], kind: "tape" as const },
              ...ai.sections.slice(1).map((section) => ({ ...section, kind: "briefing" as const })),
              ...base.sections.filter((section) => section.heading === "교차 확인 자료"),
            ]
          : base.sections,
        table: ai.table?.rows?.length ? { ...ai.table, markdown: tableMarkdown(ai.table) } : base.table,
        faq: ai.faq?.length === 3 ? ai.faq : base.faq,
        updatedAt: new Date().toISOString(),
      },
      reserve,
      extraTape,
    );
    if (evaluatePostSpec(candidate).ok) {
      output = candidate;
      usedOpenAi = true;
    }
  }

  const spec = evaluatePostSpec(output);
  if (!spec.ok) {
    output = base;
  }
  const finalSpec = evaluatePostSpec(output);

  if (options?.persist === false) {
    return {
      skipped: false,
      persisted: false,
      supabase: false,
      usedOpenAi,
      spec: finalSpec,
      post: output,
    };
  }

  if (!finalSpec.ok) {
    return {
      skipped: false,
      reason: `spec failed: ${finalSpec.failures.join(",")}`,
      persisted: false,
      supabase: false,
      usedOpenAi,
      spec: finalSpec,
      post: output,
    };
  }

  const saved = await persistGeneratedPost(output);
  return {
    skipped: false,
    persisted: saved.file,
    supabase: saved.supabase,
    usedOpenAi,
    spec: finalSpec,
    post: output,
  };
}

function pickLeadForExisting(
  old: GeneratedPost,
  ranked: RankingEntity[],
  used: Set<string>,
): RankingEntity {
  const hay = `${old.title} ${old.slug} ${old.focusKeyword ?? ""} ${old.excerpt ?? ""}`;
  const named = ranked.find((item) => hay.includes(item.name) && !used.has(item.id));
  if (named) return named;
  return ranked.find((item) => !used.has(item.id)) ?? fallbackEntity();
}

export async function regenerateAllPosts(): Promise<{
  count: number;
  slugs: string[];
  wordCounts: number[];
  tapeRatios: number[];
  specOk: boolean[];
  failures: string[][];
  persisted: boolean;
}> {
  const existing = await listPosts();
  const snapshot = await fetchPublicMarketFacts();
  const ranked = [...snapshot.items].sort((a, b) => b.fluctuationRate - a.fluctuationRate);
  const used = new Set<string>();
  const catalog = existing.length
    ? existing
    : [
        {
          slug: slugify(kstDateString(), "morning", ranked[0]?.name ?? "market"),
          title: "",
          excerpt: "",
          slot: "morning" as PostSlot,
          editionDate: kstDateString(),
          publishedAt: new Date().toISOString(),
          id: `post-${kstDateString()}-morning`,
          focusKeyword: "",
        } as GeneratedPost,
      ];

  const next: GeneratedPost[] = catalog.map((old) => {
    const lead = pickLeadForExisting(old, ranked, used);
    used.add(lead.id);
    return composeStructured({
      editionDate: old.editionDate || kstDateString(),
      slot: old.slot || "morning",
      facts: snapshot.facts,
      items: snapshot.items,
      indices: snapshot.indices,
      leadOverride: lead,
      slugOverride: old.slug,
      idOverride: old.id,
      publishedAt: old.publishedAt,
    });
  });

  const reports = next.map((item) => evaluatePostSpec(item));
  const specOk = reports.map((item) => item.ok);
  if (specOk.some((ok) => !ok)) {
    return {
      count: next.length,
      slugs: next.map((item) => item.slug),
      wordCounts: next.map((item) => item.wordCount),
      tapeRatios: next.map((item) => Number(tapeRatio(item).toFixed(3))),
      specOk,
      failures: reports.map((item) => item.failures),
      persisted: false,
    };
  }

  const saved = await replaceGeneratedArticles(next);
  return {
    count: next.length,
    slugs: next.map((item) => item.slug),
    wordCounts: next.map((item) => item.wordCount),
    tapeRatios: next.map((item) => Number(tapeRatio(item).toFixed(3))),
    specOk,
    failures: reports.map((item) => item.failures),
    persisted: saved.file,
  };
}
