import type { PostFaq, PostLink, PostTable } from "@/lib/posts/types";
import type { EntityType } from "@/lib/types";
import { editorialGroundingRules } from "@/lib/editorial/tense-rules";

export const MIN_WORDS = 700;
export const MAX_WORDS = 900;
export const SENT_MIN = 20;
export const SENT_MAX = 40;
export const TAPE_MIN = 0;
export const TAPE_MAX = 1;

export const MARKET_TAPE =
  /시세판|시세|등락률|등락|거래량|버즈 점수|버즈|시가총액|분봉|호가창|호가|급등주|급등|급락|전일 대비|박스 면적|트리맵|히트맵|차트|가격|순위|체결가|캔들|\+\d+\.\d+%|-\d+\.\d+%|\d+\s*위/;

export const BANNED =
  /결론적으로|요약하자면|이 글에서는|이 글은|정리하면|마무리하며|알아보겠습니다|살펴보겠습니다|추천한다|추천합니다|좋은 선택|좋은 기회|반드시 사야|투자하세요|좋습니다|한 줄로 남기면|가설을 한 줄|위키백과|위키식|간단히 정리|다음과 같습니다|이번 글에서|보드에서 다시 대조|보드에서 대조|다시 대조한다|검색 태그로 한 번 더|한 번 더 확인한다|상단의 실시간 숫자를 먼저 읽는다|관측값이고 이유는|한 칸 이동한 스냅샷|프로필을 다시 쓰는|관측 \d+은|브리핑 \d+은|보드 실습 \d+은|속도 \d+은|틱 \d+은|종합하면|주목받고 있|주목을 받고 있|이목이 집중되고|귀추가 주목|다양한 관점이 있|다양한 시각이 존재|화제를 모으고 있|기대를 모으고 있|관심이 모아지고 있|긍정적인 반응을 보였|이 소식에 긍정|생일을 축하하며|뜨거운 관심을 (끌|받)|많은 관심을 (끌|받)|뜨거운 호응을 얻|긍정과 부정을 나란히/;

const FILLER_SRC =
  "검색 태그로 한 번 더 확인한다|보드에서 다시 대조한다|다시 대조한다|한 줄로 남기면|가설을 한 줄|결론적으로|요약하자면|이 글에서는|정리하면|마무리하며|알아보겠습니다|살펴보겠습니다|상단의 실시간 숫자를 먼저 읽는다|위키식";

const FILLER = new RegExp(FILLER_SRC, "g");

/**
 * Sentence padding works by prefixing a connective clause, never by appending a
 * second complete sentence. Appending produced run-ons like "…키운다 옆 이름이…"
 * with no terminal punctuation between the two clauses.
 */
const EXTEND = [
  "배경을 같이 읽으면",
  "대화가 붙은 자리를 보면",
  "습관까지 겹쳐 살피면",
  "며칠 흐름을 이어 보면",
  "초보자 눈으로 정리하면",
  "현장 맥락을 먼저 놓으면",
  "관심의 두께를 재 보면",
  "이름 대신 이유를 보면",
  "하루 뒤를 같이 생각하면",
  "입소문 속도를 같이 보면",
  "커뮤니티 반응을 겹쳐 보면",
  "유행과 이해를 갈라 보면",
  "다음날 잔여까지 살피면",
  "파급이 어디로 새는지 보면",
  "정보 질문 비중을 보면",
  "산업 흐름과 나란히 놓으면",
  "화제의 출발점을 되짚으면",
  "팬덤 밖 반응을 같이 보면",
  "사흘치 대화를 모아 보면",
  "뉴스와 입소문을 갈라 보면",
  "생활 쪽 파급을 짚어 보면",
  "이벤트가 지난 뒤를 보면",
  "옆 이름까지 넓혀 보면",
  "처음 접한 독자 입장에서는",
  "맥락을 한 줄로 줄이면",
  "취향과 소문을 갈라 놓으면",
  "재대화가 남는지를 보면",
  "관심이 식는 속도를 보면",
  "검색보다 대화를 먼저 보면",
  "한 주 단위로 넓혀 보면",
  "이름값을 걷어 내고 보면",
  "화제의 폭을 가늠해 보면",
  "주변 반응까지 포개어 보면",
  "관심이 붙은 순서를 따라가면",
  "이야기의 결을 따라 읽으면",
  "누가 먼저 꺼냈는지 보면",
  "말이 오간 자리를 짚어 보면",
  "관심의 성격을 나눠 보면",
  "다시 찾는 이유를 보면",
  "대화가 번진 방향을 보면",
];

const TAPE_EXTEND = [
  "공개된 화제성만 놓고 보면",
  "이번 에디션 기준으로 보면",
  "오늘 이슈 메모를 따라가면",
  "같은 시각의 관심만 보면",
  "화제의 결을 그대로 옮기면",
];

const POLL_EXTEND = [
  "표본오차 구간을 같이 놓으면",
  "면접과 ARS를 갈라 보면",
  "선관위 등록 원문을 열어 보면",
  "정책 질의가 남는지를 보면",
  "응원 해시태그를 걷어 내면",
  "공표와 관심을 처음부터 가르면",
  "한 주의 잔여까지 살피면",
  "조사 기간이 겹치는지를 보면",
  "공표 자료를 먼저 펼치면",
];

/** How many times a connective prefix may repeat inside one article. */
const EXTEND_REPEAT_LIMIT = 2;
const passUsed = new Map<string, number>();

const ALL_CONNECTIVE_PREFIXES = [...EXTEND, ...TAPE_EXTEND, ...POLL_EXTEND];

/** Counts template-style connective openers that read as auto-padded filler. */
export function countTemplateConnectives(text: string): number {
  let total = 0;
  for (const clause of ALL_CONNECTIVE_PREFIXES) {
    if (!clause || !text.includes(clause)) continue;
    total += text.split(clause).length - 1;
  }
  return total;
}

export function hasTemplateConnectiveSpam(text: string, max = 1): boolean {
  return countTemplateConnectives(text) > max;
}

/**
 * Mad-lib skeletons from `editorial/copy.ts` briefing templates. Any match means
 * the text is auto-padded filler, not an OpenAI column.
 */
export const BRIEFING_BOILERPLATE_PATTERNS: { label: string; test: RegExp }[] = [
  { label: "이슈가 지금 화제인 배경", test: /이슈가\s*지금\s*화제인\s*배경/ },
  { label: "화제인 배경은 산업 흐름", test: /화제인\s*배경은\s*산업\s*흐름/ },
  { label: "자주 오른다", test: /에서\s*자주\s*오른다/ },
  { label: "관심을 먼저 키운", test: /관심을\s*먼저\s*키운/ },
  { label: "유행 한 줄", test: /유행\s*한\s*줄/ },
  { label: "생활 이야기로 번지는 자리", test: /생활\s*이야기로\s*번지는\s*자리/ },
  { label: "설명하는 입문이 필요", test: /설명하는\s*입문이\s*필요/ },
  { label: "화제인 이유는 유행 한 줄", test: /화제인\s*이유는\s*유행\s*한\s*줄/ },
  { label: "주제가 테마로", test: /주제가\s*테마로\s*(읽|묶)/ },
  { label: "관심이 구체적인 자리", test: /관심이\s*구체적인\s*자리/ },
  { label: "생활 관심으로 샨", test: /생활\s*관심으로\s*샨/ },
  { label: "이슈가 밖으로 샨", test: /이슈가\s*밖으로\s*샨/ },
  { label: "호기심과 결이 다르", test: /호기심과\s*결이\s*다르/ },
  { label: "생활 대화로 번지는지", test: /생활\s*대화로\s*번지는지/ },
  { label: "입소문이 겹치면", test: /입소문이\s*겹치면/ },
  { label: "연 뒤 맥락만 먼저 정리", test: /연\s*뒤\s*맥락만\s*먼저\s*정리/ },
  { label: "맥락 메모", test: /맥락\s*메모/ },
  { label: "붙어야 관심이", test: /붙어야\s*관심이/ },
  { label: "습관이 남아야", test: /습관이\s*남아야/ },
  { label: "대화가 멈추면 관심", test: /대화가\s*멈추면\s*관심/ },
  { label: "파급이 밖으로 샨", test: /파급이\s*밖으로\s*샨/ },
  { label: "테마로 번진", test: /테마(로|가)\s*(번|묶)/ },
  { label: "입문은 배경부터", test: /입문은\s*.+\s*배경부터/ },
  { label: "가 지금 화제인 이유", test: /가\s*지금\s*화제인\s*이유/ },
  { label: "이름 나열", test: /이름\s*나열/ },
  { label: "습관 단위", test: /습관\s*단위/ },
  { label: "짧은 유행", test: /짧은\s*유행/ },
  { label: "정보 질문이 섞이면 체류", test: /정보\s*질문이\s*섞이면\s*체류/ },
  { label: "커뮤니티 이틀 연속", test: /커뮤니티.*이틀\s*연속/ },
  { label: "현장을 같이 읽", test: /현장을\s*같이\s*읽/ },
  { label: "배경을 같이 읽", test: /배경을\s*같이\s*읽/ },
  { label: "투자 조언이 아니라 문화 입문", test: /투자\s*조언이\s*아니라\s*문화\s*입문/ },
  { label: "유행과 이해를 갈라", test: /유행과\s*이해를\s*갈라/ },
];

export function findBriefingBoilerplate(text: string): string[] {
  return BRIEFING_BOILERPLATE_PATTERNS.filter((entry) => entry.test.test(text)).map(
    (entry) => entry.label,
  );
}

export function hasBriefingBoilerplate(text: string): boolean {
  return findBriefingBoilerplate(text).length > 0;
}

const REPORTING_ENDING = /(?:밝혔다|설명했다|덧붙였다|전했다|말했다|밝혔습니다|설명했습니다|덧붙였습니다)\.?$/;

const PADDING_PATTERNS = [
  /체크리스트/,
  /실행\s*체크리스트/,
  /독자가\s*(먼저|반드시)\s*확인/,
  /확인해야\s*할\s*(N|몇|\d)/i,
  /꼼꼼히\s*점검/,
];

const METADATA_LEAK =
  /분\s*읽기|SEO\s*기준|글자\s*수|AdSense|메타데이터|\d{4}-\d{2}-\d{2}\s*·|읽는\s*시간/;

/** True when reporting-verb endings repeat in a row (기계적 보도체). */
export function hasRepetitiveDeclarativeEndings(text: string, maxStreak = 2): boolean {
  const sentences = extractSentences(text);
  let streak = 0;
  for (const sentence of sentences) {
    if (REPORTING_ENDING.test(sentence.trim())) {
      streak += 1;
      if (streak > maxStreak) return true;
    } else {
      streak = 0;
    }
  }
  return false;
}

export function hasGenericPadding(text: string): boolean {
  return PADDING_PATTERNS.some((pattern) => pattern.test(text));
}

export function hasLeakedMetadata(text: string): boolean {
  return METADATA_LEAK.test(text);
}

/** Returns how many sentences repeat the same claim fingerprint. */
export function duplicateClaimCount(text: string): number {
  const seen = new Set<string>();
  let duplicates = 0;
  for (const sentence of extractSentences(text)) {
    const key = claimFingerprint(sentence);
    if (!key) continue;
    if (seen.has(key)) duplicates += 1;
    else seen.add(key);
  }
  return duplicates;
}

export function resetEditorialPass(): void {
  passUsed.clear();
}

export function hasBannedCopy(text: string): boolean {
  return BANNED.test(text) || new RegExp(FILLER_SRC).test(text) || MARKET_TAPE.test(text);
}

export function editorialSystemPrompt(focus: string, supportKw: string): string {
  return [
    "You are a Korean magazine editor at KinDex (kindexlab.com, 킨덱스).",
    "Your ONLY input is one issue keyword string. There is no market feed behind it.",
    "Write an independent trend column: industrial and social background, why it is topical, ripple effects, and a beginner guide.",
    "You are NOT given prices, ranks, volumes, rates, charts, heatmaps, or ticker data. Do not invent, imply, or mention any of them.",
    "Forbidden in every sentence: 시세, 시세판, 등락, 거래량, 버즈, 분봉, 호가, 급등, 급락, 히트맵, 트리맵, 차트, 가격, 체결, 순위, 1위, 전일 대비.",
    "Forbidden filler: 결론적으로, 요약하자면, 이 글에서는, 이 글은, 정리하면, 마무리하며, 알아보겠습니다, 살펴보겠습니다, 추천한다, 좋습니다, 위키식, 보드에서 대조한다, 긍정적인 반응을 보였다, 생일을 축하하며, 이 소식에 긍정적인 반응, 긍정과 부정을 나란히 읽으면.",
    "Never repeat the same fact, event, or sentence in more than one section. If a birthday, release, or quote is already used, move on to a different fact.",
    "Voice: a domain expert briefing a curious newcomer. Declarative, concrete, never promotional.",
    "Length: 700-900 Korean space-separated words.",
    "Each sentence 20-40 Korean characters excluding spaces. One idea per sentence. Group 3-4 sentences into one paragraph and break lines between paragraphs.",
    "Every sentence must end with a period (.). Do not omit terminal punctuation even when a sentence ends at a line break.",
    "The first 10% states why this keyword is topical now, through background and ripple only.",
    "The comparison table is keyword / background / topicality / ripple. Never prices.",
    "Never mention shopping malls, Coupang, or Toss Shopping in the body.",
    "H1-style title must include the focus keyword and invite a click.",
    "The first paragraph MUST include the focus keyword exactly once.",
    "Use H2 and H3 subheads prefixed with ❶ ❷ ❸ ❹ ❺. Three to five numbered subheads.",
    `Use focus keyword "${focus}" at least 5 times and support keyword "${supportKw}" at least 5 times, naturally.`,
    "Include one markdown comparison table. Include one official external URL and 내부 링크 추천: [title].",
    "FAQ: exactly 3 items. Each answer must cite a distinct concrete detail (who, what, when) and must not reuse a sentence from the body or from another answer.",
    "Not investment advice.",
    "",
    editorialGroundingRules(),
  ].join("\n");
}

export function stripFiller(value: string): string {
  return value.replace(FILLER, " ").replace(/\s+/g, " ").trim();
}

export function charLen(value: string): number {
  return value.replace(/\s+/g, "").length;
}

export function tokenCount(parts: string[]): number {
  return parts.join(" ").trim().split(/\s+/).filter(Boolean).length;
}

export function countKeyword(text: string, keyword: string): number {
  if (!keyword) return 0;
  return text.split(keyword).length - 1;
}

export function splitToSentences(raw: string): string[] {
  return stripFiller(raw)
    .replace(BANNED, "")
    .split(/(?<=[다요임까죠네]\.)\s+|(?<=[^\d\s])\.\s+/)
    .map((item) => stripFiller(item).trim())
    .filter(Boolean);
}

/**
 * Korean connective endings. A chunk closing on one of these is a mid-sentence
 * clause, not a sentence: sealing it with a period yields "…있으며." Splitting
 * long prose produces these, so such fragments are dropped rather than shipped.
 */
const CONNECTIVE_TAIL =
  /(으며|하며|이며|면서|으면|하고|이고|지만|때문에|통해|위해|따라|와|과|및|이나|거나|는데|은데|아서|어서|으로|보다|처럼|라는|이라는|에서)$/;

function endsMidClause(value: string): boolean {
  return CONNECTIVE_TAIL.test(value.replace(/[.\s]+$/, "").trim());
}

/**
 * Closes a clause as a sentence. Splitting happens at commas and connectives, so
 * the trailing separator has to go before the period lands, otherwise the body
 * fills with "…있으며,." artifacts.
 */
function seal(value: string): string {
  const trimmed = value.replace(/[\s,，·/]+$/, "").trim();
  if (!trimmed) return "";
  if (endsMidClause(trimmed)) return "";
  return trimmed.endsWith(".") ? trimmed : `${trimmed}.`;
}

/** Trims an over-long clause at a word boundary; never mid-word. */
function trimToBudget(sentence: string): string {
  const body = sentence.replace(/\.+$/, "");
  const words = body.split(" ");
  let out = "";
  for (const word of words) {
    const next = out ? `${out} ${word}` : word;
    if (charLen(next) > SENT_MAX) break;
    out = next;
  }
  // Walk back to the last word that closes a sentence cleanly.
  let candidate = out;
  while (candidate && endsMidClause(candidate)) {
    candidate = candidate.slice(0, candidate.lastIndexOf(" ")).trim();
  }
  return seal(candidate);
}

export function clipLong(sentence: string): string[] {
  const clean = stripFiller(sentence.replace(/\s+/g, " "));
  if (!clean) return [];
  if (charLen(clean) <= SENT_MAX) return [seal(clean)].filter(Boolean);
  const parts = clean.split(/(?<=[다요임까,，·/])\s+/);
  const out: string[] = [];
  let buf = "";
  for (const part of parts) {
    const next = buf ? `${buf} ${part}` : part;
    if (charLen(next) <= SENT_MAX) {
      buf = next;
    } else {
      if (buf) out.push(seal(buf));
      buf = part;
    }
  }
  if (buf) out.push(seal(buf));
  return out
    .map((item) => (charLen(item) > SENT_MAX ? trimToBudget(item) : item))
    .filter(Boolean);
}

function isCompleteSentence(value: string): boolean {
  return /[다요임까죠네]$/.test(value.replace(/\.+$/, "").trim());
}

function nextExtension(body: string, used: Set<string>): string | undefined {
  const tapeLike = /검색 창은|태그는|화제는/.test(body) && /관측|메모/.test(body);
  const pollLike =
    /여론조사|직무 평가|직무평가|지지도|전화면접|표본오차|표본 크기|조사 기간|선관위|무선 ARS|갤럽|리얼미터/.test(
      body,
    );
  const pool = tapeLike ? TAPE_EXTEND : pollLike ? POLL_EXTEND : EXTEND;
  const start = Math.abs(hashCode(body)) % pool.length;
  // Prefer an unused clause; once the pool runs dry, repeat up to the limit
  // instead of dropping the sentence and leaving a section nearly empty.
  for (let limit = 1; limit <= EXTEND_REPEAT_LIMIT; limit += 1) {
    for (let i = 0; i < pool.length; i += 1) {
      const clause = pool[(start + i) % pool.length];
      if (!clause || used.has(clause) || body.includes(clause)) continue;
      if ((passUsed.get(clause) ?? 0) >= limit) continue;
      return clause;
    }
  }
  return undefined;
}

function hashCode(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return hash;
}

export function fitSentenceLength(sentence: string, used: Set<string> = new Set()): string {
  let body = stripFiller(sentence.replace(/\s+/g, " ")).replace(/\.+$/, "");
  if (!body) return "";
  if (charLen(body) > SENT_MAX) {
    body = (clipLong(`${body}.`)[0] ?? body).replace(/\s+/g, " ").trim().replace(/\.+$/, "");
  }
  let guard = 0;
  while (charLen(body) < SENT_MIN && guard < 3) {
    const extra = nextExtension(body, used);
    if (!extra) break;
    if (charLen(`${extra} ${body}`) > SENT_MAX) break;
    used.add(extra);
    passUsed.set(extra, (passUsed.get(extra) ?? 0) + 1);
    body = `${extra} ${body}`.trim();
    guard += 1;
  }
  if (charLen(body) < SENT_MIN || charLen(body) > SENT_MAX) return "";
  if (hasBannedCopy(body)) return "";
  return seal(body);
}

export function mergeShort(sentences: string[]): string[] {
  const out: string[] = [];
  let buf = "";
  for (const raw of sentences) {
    const item = stripFiller(raw.replace(/\s+/g, " ")).replace(/\.+$/, "");
    if (!item) continue;
    // A finished sentence is never glued to the next one; padding to SENT_MIN
    // happens later in fitSentenceLength, which prefixes a connective clause.
    if (!buf && isCompleteSentence(item)) {
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
      out.push(seal(candidate));
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

export function toParagraphs(sentences: string[]): string[] {
  const used = new Set<string>();
  const merged = collapseRepeatedClaims(
    mergeShort(sentences)
      .map((item) => fitSentenceLength(item, used))
      .filter(Boolean),
  );
  const paras: string[] = [];
  let i = 0;
  let cycle = 0;
  while (i < merged.length) {
    const size = 2 + (cycle % 3);
    const group = merged.slice(i, i + size);
    if (group.length) paras.push(group.join(" "));
    i += group.length;
    cycle += 1;
  }
  return paras.filter(Boolean);
}

export function extractSentences(text: string): string[] {
  return text
    .split(/\n+/)
    .flatMap((line) => {
      const trimmed = stripFiller(line);
      if (!trimmed) return [];
      return splitToSentences(trimmed.endsWith(".") ? trimmed : `${trimmed}.`);
    })
    .map((item) => stripFiller(item))
    .filter(Boolean);
}

export function line(text: string): string {
  const trimmed = stripFiller(text.replace(/\s+/g, " ")).replace(/\.+$/, "");
  return trimmed ? `${trimmed}.` : "";
}

function stripConnectivePrefix(value: string): string {
  let out = value.replace(/\.+$/, "").trim();
  for (const pool of [EXTEND, TAPE_EXTEND, POLL_EXTEND]) {
    for (const clause of pool) {
      if (out.startsWith(clause)) {
        out = out.slice(clause.length).trim();
        break;
      }
    }
  }
  return out;
}

/**
 * Same claim with a different prefix still reads as repetition. Compare the
 * core after dropping connective clauses, particles, and the subject name.
 */
function claimFingerprint(sentence: string): string {
  return stripConnectivePrefix(sentence)
    .replace(/긍정적인 반응을 보였\S*/g, "긍정반응")
    .replace(/생일을 축하하며\S*/g, "생일축하")
    .replace(/이 소식에\s*/g, "")
    .replace(/대중은\s*/g, "")
    .replace(/[은는이가을를의와과도만]\s*/g, "")
    .replace(/\s+/g, "")
    .replace(/[.]+$/g, "");
}

export function collapseRepeatedClaims(sentences: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const sentence of sentences) {
    const key = claimFingerprint(sentence);
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(sentence);
  }
  return out;
}

/** Drop later sentences that restate an earlier claim, including across paragraphs. */
export function dropRepeatedSentences(text: string, seen: Set<string> = new Set()): string {
  const kept: string[] = [];
  for (const sentence of extractSentences(text)) {
    if (hasBannedCopy(sentence)) continue;
    const key = claimFingerprint(sentence);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    kept.push(sentence);
  }
  // extractSentences often returns clauses without a trailing period; re-seal
  // before joining so the next extract/audit pass still sees boundaries.
  return kept
    .map((sentence) => {
      const trimmed = sentence.trim();
      if (!trimmed) return "";
      return /[.!?…]["'」』)]*$/.test(trimmed) ? trimmed : `${trimmed}.`;
    })
    .filter(Boolean)
    .join(" ");
}

export function uniqueLines(raw: string[]): string[] {
  const seen = new Set<string>();
  const used = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    for (const next of clipLong(line(item)).map((row) => fitSentenceLength(row, used))) {
      if (!next || hasBannedCopy(next) || seen.has(next)) continue;
      if (charLen(next.replace(/\.+$/, "")) < SENT_MIN) continue;
      seen.add(next);
      out.push(next);
    }
  }
  return collapseRepeatedClaims(out);
}

export function tableMarkdown(table: Pick<PostTable, "headers" | "rows">): string {
  const head = `| ${table.headers.join(" | ")} |`;
  const sep = `| ${table.headers.map(() => "---").join(" | ")} |`;
  const body = table.rows.map((row) => `| ${row.join(" | ")} |`).join("\n");
  return `${head}\n${sep}\n${body}`;
}

export interface EditorialDoc {
  title: string;
  excerpt: string;
  focusKeyword: string;
  supportKeyword: string;
  sections: { heading?: string; headingLevel?: 2 | 3; paragraphs: string[]; kind?: "tape" | "briefing" }[];
  table?: PostTable | null;
  faq?: PostFaq[];
  internalLink?: PostLink | null;
  externalLink?: PostLink | null;
  coverSrc?: string;
}

export interface EditorialReport {
  ok: boolean;
  tapeRatio: number;
  wordCount: number;
  failures: string[];
}

export function editorialPlainText(doc: EditorialDoc): string {
  return [
    doc.title,
    doc.excerpt,
    ...doc.sections.flatMap((section) => [section.heading ?? "", ...section.paragraphs]),
    ...(doc.faq ?? []).flatMap((item) => [item.question, item.answer]),
    doc.internalLink?.label ? `내부 링크 추천: [${doc.internalLink.label}]` : "",
  ].join(" ");
}

export function editorialWordCount(doc: EditorialDoc): number {
  return tokenCount([editorialPlainText(doc)]);
}

export function tapeWordCount(doc: EditorialDoc): number {
  const tape = doc.sections.filter((section) => section.kind === "tape");
  return tokenCount([
    doc.excerpt,
    ...tape.flatMap((section) => [section.heading ?? "", ...section.paragraphs]),
  ]);
}

export function tapeRatio(doc: EditorialDoc): number {
  const total = editorialWordCount(doc);
  if (!total) return 0;
  return tapeWordCount(doc) / total;
}

export function evaluateEditorial(doc: EditorialDoc): EditorialReport {
  const text = editorialPlainText(doc);
  const intro = doc.sections[0];
  const firstPara = intro?.paragraphs[0] ?? "";
  const words = editorialWordCount(doc);
  const ratio = tapeRatio(doc);
  const numberedHeadings = doc.sections.filter((section) =>
    /^(?:[1-5]\.|[❶❷❸❹❺])\s/.test(section.heading ?? ""),
  );
  const failures: string[] = [];
  if (words < MIN_WORDS || words > MAX_WORDS + 40) failures.push(`wordCount:${words}`);
  if (!doc.table?.rows?.length || !doc.table.markdown?.includes("|")) failures.push("table");
  if ((doc.faq?.length ?? 0) !== 3) failures.push(`faq:${doc.faq?.length ?? 0}`);
  if (!doc.internalLink?.href) failures.push("internalLink");
  if (!text.includes("내부 링크 추천:")) failures.push("internalLinkPhrase");
  if (!doc.externalLink?.href?.startsWith("http")) failures.push("externalLink");
  if (!doc.focusKeyword || !doc.title.includes(doc.focusKeyword)) failures.push("focusInTitle");
  if (!doc.focusKeyword || !firstPara.includes(doc.focusKeyword)) failures.push("focusInIntro");
  if (countKeyword(text, doc.focusKeyword) < 5) failures.push(`focusCount:${countKeyword(text, doc.focusKeyword)}`);
  if (countKeyword(text, doc.supportKeyword) < 5) {
    failures.push(`supportCount:${countKeyword(text, doc.supportKeyword)}`);
  }
  if (!doc.sections.some((section) => section.headingLevel === 2)) failures.push("h2");
  if (!doc.sections.some((section) => section.headingLevel === 3)) failures.push("h3");
  if (numberedHeadings.length < 3 || numberedHeadings.length > 5) {
    failures.push(`numberedHeadings:${numberedHeadings.length}`);
  }
  if (hasBannedCopy(text)) failures.push("banned");
  if (MARKET_TAPE.test(text)) failures.push("marketTape");
  const extendHits = EXTEND.filter((clause) => countKeyword(text, clause) > 2);
  if (extendHits.length) failures.push(`extendRepeat:${extendHits[0]}`);
  const sentenceIssues = countSentenceIssues(doc);
  if (sentenceIssues.count > 0) failures.push(`sentences:${sentenceIssues.count}:${sentenceIssues.sample}`);
  return { ok: failures.length === 0, tapeRatio: ratio, wordCount: words, failures };
}

export function countSentenceIssues(doc: EditorialDoc): { count: number; sample: string } {
  const blobs = [...doc.sections.flatMap((section) => section.paragraphs), ...(doc.faq ?? []).map((item) => item.answer)];
  const bad: string[] = [];
  for (const blob of blobs) {
    for (const sentence of extractSentences(blob)) {
      const len = charLen(sentence.replace(/\.+$/, ""));
      if (len < SENT_MIN || len > SENT_MAX) bad.push(`${len}:${sentence}`);
    }
  }
  return { count: bad.length, sample: bad[0] ?? "" };
}

export function normalizeEditorialSentences(doc: EditorialDoc): void {
  for (const section of doc.sections) {
    section.paragraphs = toParagraphs(section.paragraphs.flatMap(extractSentences));
  }
  if (doc.faq) {
    for (const item of doc.faq) {
      item.answer = toParagraphs(extractSentences(item.answer)).join("\n");
    }
  }
}

export function officialLinkForChannel(channel: "entertainment" | "economy" | "politics" | "culture" | "travel" | "all"): PostLink {
  if (channel === "politics") {
    return {
      href: "https://www.assembly.go.kr/portal/main/main.do",
      label: "국회 본회의·의안 공식 안내",
      rel: "noopener noreferrer",
    };
  }
  if (channel === "economy") {
    return {
      href: "https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html",
      label: "ECB 유로 참고환율",
      rel: "noopener noreferrer",
    };
  }
  if (channel === "travel") {
    return {
      href: "https://korean.visitkorea.or.kr/",
      label: "대한민국 구석구석 공식",
      rel: "noopener noreferrer",
    };
  }
  if (channel === "culture") {
    return {
      href: "https://comic.naver.com/index",
      label: "네이버웹툰 공식",
      rel: "noopener noreferrer",
    };
  }
  return {
    href: "https://www.kbs.co.kr/",
    label: "KBS 편성·뉴스 공식",
    rel: "noopener noreferrer",
  };
}

/** Picks the authoritative source that matches the keyword's own field. */
export function officialLinkForTopic(
  type: EntityType,
  channel: "entertainment" | "economy" | "politics" | "culture" | "travel" | "all",
): PostLink {
  if (type === "webtoon") {
    return { href: "https://comic.naver.com/index", label: "네이버웹툰 공식", rel: "noopener noreferrer" };
  }
  if (type === "kpop" || type === "music_chart") {
    return { href: "https://www.melon.com/", label: "멜론 공식", rel: "noopener noreferrer" };
  }
  if (type === "movie") {
    return { href: "https://www.kobis.or.kr/", label: "KOBIS 박스오피스 공식", rel: "noopener noreferrer" };
  }
  if (type === "tv_show" || type === "tv_rating" || type === "political_ratings") {
    return { href: "https://www.kbs.co.kr/", label: "KBS 편성·뉴스 공식", rel: "noopener noreferrer" };
  }
  if (type === "mobile_game" || type === "pc_game" || type === "console_game") {
    return { href: "https://www.grac.or.kr/", label: "게임물관리위원회 공식", rel: "noopener noreferrer" };
  }
  if (type === "shorts" || type === "influencer") {
    return { href: "https://www.youtube.com/", label: "유튜브 공식", rel: "noopener noreferrer" };
  }
  return officialLinkForChannel(channel);
}
