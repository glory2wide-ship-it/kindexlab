import { resolveChannelEditorPersona } from "@/lib/premium/briefing-editorial";
import { editorialGroundingRules, tenseConsistencyRules } from "@/lib/editorial/tense-rules";

/**
 * 100% prompt-cache hit: every fixed rule lives here.
 * Variables (channel, keyword, RAG) go only in the user message.
 * Keep this block large enough for OpenAI automatic prompt caching (≥1,024 tokens).
 */
export const STATIC_SYSTEM_PROMPT = [
  `당신은 구글 애드센스 승인·수익화 및 검색 SEO에 특화된 10년 차 수석 블로그 에디터이자 전문가 선배입니다.
기계적인 AI 요약체가 아닌, 독자의 문제를 실질적으로 해결하는 깊이 있는 고품질 한국어 칼럼을 생성해야 합니다.
주어진 [포커스 키워드]와 [최신 뉴스 데이터(실제 URL·발행일 포함)]만을 근거로 쓰세요. 기존 KINDEXLAB 시세·지수 점수는 언급하지 마세요.
단순 팩트 나열만 하면 Thin/Low-value content로 탈락하기 쉽습니다. 팩트 수집 뒤 반드시 아래 4방향 해석을 분량(1,400~1,800자)에 맞게 채워 체류 시간과 E-E-A-T를 높이세요.`,
  tenseConsistencyRules(),
  `[콘텐츠 밀도 확장 — 팩트 보도 이후 필수 (Low-value 방지)]
1. Why(배경·원인): "무엇이 일어났는가"에서 멈추지 말고, 왜 지금 대중이·검색·랭킹이 반응하는지 시장·플랫폼·팬덤·일정 맥락을 전문가 시각으로 풀어내세요. RAG에 근거가 있을 때만 인과를 단정합니다.
2. How(실용 인사이트): 독자의 일상·소비·시청·구독·지갑에 미치는 영향과, 확인·비교·행동에 쓸 구체 요령을 본문 서술로 녹이세요. '독자 체크리스트'·'확인해야 할 N가지' 같은 목록형 패딩 섹션은 금지입니다.
3. 데이터 비교 표: 핵심 지표·일정·장단·수치·비교 대상을 table(헤더 3열+, 행 2~4)로 시각화하세요. caption은 '팩트 체크' 또는 '핵심 팩트 요약'.
4. 전망·파급: RAG·공개 일정에 비춰 앞으로의 전개와 업계·소비자가 볼 포인트를 짧게 제시하세요. 확인되지 않은 수치·확정 발표를 지어내지 마세요.
5. H2 4개 역할 배분(번호 ❶❷❸❹, 제목은 이 사안 고유 명사 포함): ❶ 핵심 사건·팩트 맥락 → ❷ Why → ❸ How → ❹ 전망·파급. 표·FAQ는 본문 밀도를 보완합니다.`,
  `[작성 및 서식 엄격 규칙 — 위반 시 유효성 검증 실패]
1. 문장 종결 및 마침표: 모든 문장의 끝(명사형 종결, 줄바꿈 직전 포함)에는 예외 없이 온전한 마침표(.)를 찍으세요. 의문문은 ?, 감탄은 !만 허용합니다. 실패 예: '화두로 떠올랐다 이슈의 중심에는' → '화두로 떠올랐다. 이슈의 중심에는'.
2. 문체 다양성: '~다', '~했다', '~밝혔다', '~설명했다', '~덧붙였다' 같은 동일한 평서 종결어가 연속 3회 이상 나오면 안 됩니다. 의문형(~일까?), 명사형 종결, 짧은 단문을 섞어 리듬을 만드세요.
3. Anti-AI 패턴 배제: "결론적으로", "요약하자면", "이 글에서는", "주목받고 있다", "귀추가 주목된다", "다양한 관점이 존재한다", "상황을 지켜볼 필요가 있다", "알아보았습니다", "살펴보겠습니다", "긍정적인 반응을 보였다", "생일을 축하하며", "긍정과 부정을 나란히 읽으면", "새로운 패러다임", "혁신을 선보", "심층 분석", "주목할 만한", "화제가 되고", "관심이 집중" 등 상투적 문구를 어떤 활용형으로도 쓰지 마세요.
4. 모바일 가독성: 3~4문장을 하나의 문단으로 묶고, 문단 간 자연스러운 흐름을 유지하세요. 한 문장은 공백 제외 20~45자 내외로 간결하게 작성하세요. 한 문단에 5문장 이상 몰아넣지 마세요.
5. 수치 및 객관성: "좋다", "추천한다", "관심이 높다" 등의 모호한 감상 대신 구체적인 수치·날짜·기관명·비율·근거를 바탕으로 서술하세요.
6. 팩트 기반 작성: [최신 뉴스 데이터]에만 기반합니다. 수집 데이터에 없는 인물 관계·사건·수치를 지어내지 마세요. Sparse/Shorts에서도 Why·How·표·전망의 뼈대는 유지하되 확인된 범위만 밀도 있게 쓰세요.
7. 할루시네이션·노이즈 방지: 'FLOAT', 'Counter-' 등 다의어·접두어 일치만으로 이종 산업 소식을 한 인과로 묶지 마세요. 연계가 없으면 독립 단락 요약만 하세요.
8. 메타 누설 금지: 글자 수, 읽는 시간, SEO, AdSense, 날짜·카테고리 메타(예: '2026-09-02 · 실시간 웹툰 · 11분'), '네 기사를 작성해 드리겠습니다' 같은 LLM 서문을 본문에 넣지 마세요.
9. 체류시간 유도형 소제목: H2는 ❶❷❸❹ 번호 형식이며, 이 사안에서만 나올 수 있는 고유명사·구체 사실을 넣으세요. '향후 전망과 실행 팁', '전문가 시각의 장단점', '독자 체크리스트'처럼 키워드만 바꾸면 통하는 템플릿 소제목·목록 섹션은 실패입니다.`,
  `[애드센스·워드프레스 SEO]
1. Full/Sparse/Shorts: 공백 제외 1,400~1,800자. 하한 1,400자 미달 시 품질 게이트 실패. 팩트 + Why + How + 표 + 전망으로 밀도를 채우고 패딩·물타기는 금지.
2. H1은 title 하나. 본문 sections는 스키마상 최소 4개(H2, headingLevel 2). FAQ 질문은 H3 개념.
3. 포커스 키워드를 excerpt(도입부 상위 10%)에 1회 이상, 본문 합계 5회 이상 자연 배치(목표 5~7회, 과도한 반복 금지).
4. Markdown/JSON Table 1개 필수(caption은 '팩트 체크' 또는 '핵심 팩트 요약'). FAQ 3개 이상(Shorts는 1~2개).
5. externalLink.href는 제공된 뉴스 URL을 그대로 복사. 가상 URL 금지. internalLink.href는 /search?q= 로 시작, label은 구체 관련 글 제목.
6. JSON-LD Schema.org는 파이프라인이 조립하므로 script 태그를 본문에 넣지 마세요.
7. takeaways는 브리핑이면 빈 배열 []. 프리미엄 칼럼이면 How에 해당하는 실행 팁 2~4개(목록 패딩이 아닌 구체 행동).`,
  `[출력 포맷 — 절대 준수]
- 응답은 오직 지정된 JSON 객체 하나만 반환합니다. 코드블록·설명 문장 금지.
- 스키마: title, excerpt, sections[{heading, headingLevel, paragraphs[]}], table{caption, headers[], rows[][]}, faq[{question, answer}], externalLink{href, label}, internalLink{href, label}, takeaways[]`,
]
  .join("\n\n")
  .trim();

/** @deprecated Prefer STATIC_SYSTEM_PROMPT — kept for scripts/check-premium-pipeline. */
export const PREMIUM_SYSTEM_PROMPT = STATIC_SYSTEM_PROMPT;

export interface BriefingInputParams {
  briefing: boolean;
  mode: "full" | "sparse" | "shorts";
  channel: string;
  categoryHint: string;
  focusKeyword: string;
  relatedKeywords: string[];
  newsContext: string;
}

/**
 * Dynamic variables only — never put these in the system prompt (cache miss).
 */
export function buildSinglePassUserPrompt(params: BriefingInputParams): string {
  const {
    briefing,
    mode,
    channel,
    categoryHint,
    focusKeyword,
    relatedKeywords,
    newsContext,
  } = params;

  const related =
    relatedKeywords.filter(Boolean).join(", ") ||
    "직접 연관 키워드 없음 — 무관한 소재를 억지로 엮지 마세요.";

  const modeGuide =
    mode === "shorts"
      ? "Shorts: 1,400~1,800자. H2=팩트→Why→How→전망. 표1·FAQ1~2. 패딩 금지."
      : mode === "sparse"
        ? "Sparse: 1,400~1,800자. H2=팩트→Why→How→전망. 체크리스트 금지, 랭킹·검색 유입 Why 중심."
        : "Full: 1,400~1,800자. H2=팩트→Why→How→전망(스키마 4개). FAQ 3개+. 표 필수.";

  const sectionCount = "정확히 4 (Structured Outputs minItems=4)";
  const paraPerSection = "정확히 4 (스키마 minItems=4)";
  const sentences = "3~4";

  return [
    "[분류 정보]",
    `- 채널: ${channel}`,
    `- 상세 카테고리: ${categoryHint}`,
    `- 포커스 키워드: ${focusKeyword}`,
    `- 연관 키워드: ${related}`,
    `- 글 유형: ${briefing ? "일일브리핑/심층분석" : "프리미엄 SEO 칼럼"}`,
    `- 브리핑 모드: ${mode.toUpperCase()} — ${modeGuide}`,
    "",
    "[최신 뉴스 데이터 (RAG Context)]",
    newsContext?.trim() ||
      "수집된 뉴스 데이터가 없습니다. 포커스 키워드의 랭킹·검색 유입 현상만 밀도 있게 작성하세요.",
    "",
    "[시제 및 시간 정합성 — 본 호출 필수]",
    "- 위 뉴스 각 항목의 발행일(년, 월, 일)을 최우선 근거로 시제를 맞추세요.",
    "- 과거 날짜·종결 이슈는 ~했다 / ~개막한 바 있다 등 과거형만. 최근 일처럼 쓰지 마세요.",
    "- 시점이 다른 사건은 시간순으로 배치하세요.",
    "",
    "[작성 지시 — 단일 패스·Low-value 방지]",
    `위 RAG 팩트를 뼈대로 [포커스 키워드] "${focusKeyword}"를 excerpt 상위 10%에 1회, 본문에 합계 5회 이상 넣어 완전한 JSON을 한 번에 작성하세요.`,
    `- sections는 ${sectionCount}개. heading에 ❶❷❸❹와 이 사안 고유명사를 넣으세요.`,
    "- ❶ 핵심 사건·팩트 맥락  ❷ Why(왜 지금 주목·시장 배경)  ❸ How(독자 일상·소비·활용 요령, 목록형 체크리스트 금지)  ❹ 전망·파급(확인된 일정·신호만).",
    `- 각 섹션 paragraphs는 ${paraPerSection}개, 각 문단은 ${sentences}문장. 한 문장은 공백 제외 35~50자.`,
    "- title+excerpt+sections+faq 합계 공백 제외 1,400~1,800자(목표 1,500~1,700). 단순 사실 나열·패딩으로 채우지 마세요.",
    "- table 1개: 지표·일정·비교·수치(헤더 3열+, 행 2~4). faq는 Full/Sparse 3개+·Shorts 1~2개(답변 각 2~3문장).",
    "- externalLink는 위 뉴스 데이터의 실제 URL만.",
    '- internalLink.href는 /search?q=... 형식, label은 "관련 글: …" 구체 제목.',
    briefing ? "- takeaways는 반드시 []." : "- takeaways는 How에 맞는 구체 행동 2~4개.",
    "- 모든 문장 끝 마침표(.) 필수. 동일 평서 종결 연속 3회 금지.",
  ].join("\n");
}

/** Anti-AI clause — enforced after generation, not just requested. */
export const PREMIUM_BANNED_PHRASES = [
  "결론적으로",
  "요약하자면",
  "이 글에서는",
  "주목받고 있다",
  "귀추가 주목된다",
  "다양한 관점이 존재한다",
  "상황을 지켜볼 필요가 있다",
  "알아보았습니다",
  "살펴보겠습니다",
  "긍정적인 반응을 보였다",
  "생일을 축하하며",
  "이 소식에 긍정적인 반응",
  "긍정과 부정을 나란히 읽으면",
  "새로운 패러다임",
  "혁신을 선보",
  "심층 분석",
  "주목할 만한",
  "화제가 되고",
  "관심이 집중",
  "파급 효과를",
  "중요한 역할을 하",
  "촉진하는 데 기여",
] as const;

const BANNED_PATTERNS: { label: (typeof PREMIUM_BANNED_PHRASES)[number]; test: RegExp }[] = [
  { label: "결론적으로", test: /결론적으로/ },
  { label: "요약하자면", test: /요약하자면|요약하면/ },
  { label: "이 글에서는", test: /이\s*글에서는|본\s*글에서는|이\s*기사에서는/ },
  { label: "주목받고 있다", test: /주목(받|되)고\s*(있|계)\S*/ },
  { label: "귀추가 주목된다", test: /귀추\S*\s*주목/ },
  { label: "다양한 관점이 존재한다", test: /다양한\s*(관점|시각)\S*\s*(존재|있)\S*/ },
  { label: "상황을 지켜볼 필요가 있다", test: /지켜볼\s*필요\S*\s*있\S*/ },
  { label: "알아보았습니다", test: /알아(보았|봤|보겠)\S*/ },
  { label: "살펴보겠습니다", test: /살펴(보겠|보았|봤)\S*/ },
  { label: "긍정적인 반응을 보였다", test: /긍정적인\s*반응을\s*보였\S*/ },
  { label: "생일을 축하하며", test: /생일을\s*축하하며/ },
  { label: "이 소식에 긍정적인 반응", test: /이\s*소식에\s*긍정/ },
  { label: "긍정과 부정을 나란히 읽으면", test: /긍정과\s*부정을\s*나란히/ },
  { label: "새로운 패러다임", test: /새로운\s*패러다임/ },
  { label: "혁신을 선보", test: /혁신을\s*선보/ },
  { label: "심층 분석", test: /심층\s*분석/ },
  { label: "주목할 만한", test: /주목할\s*만한/ },
  { label: "화제가 되고", test: /화제가\s*되(고|는)/ },
  { label: "관심이 집중", test: /관심이\s*집중/ },
  { label: "파급 효과를", test: /파급\s*효과를/ },
  { label: "중요한 역할을 하", test: /중요한\s*역할을\s*하/ },
  { label: "촉진하는 데 기여", test: /촉진하는\s*데\s*기여/ },
];

export const PREMIUM_BANNED_MARKET_TERMS = [
  "시세",
  "지수 점수",
  "등락률",
  "KINDEXLAB 지수",
] as const;

export const PREMIUM_MIN_CHARS = 1_800;
export const PREMIUM_MAX_CHARS = 2_500;
export const PREMIUM_KEYWORD_MIN = 5;
export const PREMIUM_KEYWORD_MAX = 7;
export const PREMIUM_KEYWORD_HARD_MAX = 12;
export const PREMIUM_FAQ_MIN = 3;

export function findBannedPhrases(text: string): string[] {
  return BANNED_PATTERNS.filter((entry) => entry.test.test(text)).map((entry) => entry.label);
}

export function bannedPhraseReminder(): string {
  return [
    "[금지 표현 — 어떤 활용형으로도 쓰지 마세요]",
    "- 결론적으로 / 요약하자면 / 요약하면 / 이 글에서는 / 본 글에서는 / 이 기사에서는",
    "- 주목받고 있다 / 주목받고 있습니다 / 주목받는 / 주목되고 있습니다",
    "- 귀추가 주목된다 / 귀추가 주목됩니다",
    "- 다양한 관점이 존재한다 / 다양한 시각이 있습니다",
    "- 상황을 지켜볼 필요가 있다 / 지켜볼 필요가 있습니다",
    "- 알아보았습니다 / 알아봤습니다 / 알아보겠습니다",
    "- 살펴보겠습니다 / 살펴보았습니다",
    "- 긍정적인 반응을 보였다 / 이 소식에 긍정적인 반응",
    "- 생일을 축하하며",
    "- 긍정과 부정을 나란히 읽으면",
    "- 새로운 패러다임 / 혁신을 선보 / 심층 분석 / 주목할 만한 / 화제가 되고 / 관심이 집중",
    "- 좋다 / 추천한다 만으로 끝나는 모호한 감상 (수치·근거 없는 평가)",
    "이 표현이 하나라도 들어가면 글 전체가 폐기됩니다. 단정적인 서술로 대체하세요.",
  ].join("\n");
}

/** Cacheable system string — identical across calls (no channel/keyword). */
export function buildCacheableSystemPrompt(_opts?: {
  briefing?: boolean;
  channel?: string;
  includeSeo?: boolean;
}): string {
  return STATIC_SYSTEM_PROMPT;
}

/** @deprecated Channel persona belongs in the user message for cache hits. */
export function buildBriefingSystemPrompt(channel?: string): string {
  const persona = resolveChannelEditorPersona(channel);
  return `${persona}\n\n${STATIC_SYSTEM_PROMPT}`;
}

export function premiumPromptCacheKey(opts: {
  briefing?: boolean;
  channel?: string;
  mode?: string;
}): string {
  const kind = opts.briefing ? "briefing" : "premium";
  const mode = (opts.mode || "full").toLowerCase();
  // Channel omitted from cache key prefix so the static system prefix shares one machine.
  return `kindexlab:${kind}:single:${mode}:v10`;
}

export function wordpressAdsenseGuidelines(includeFullSeo: boolean): string {
  return includeFullSeo
    ? "[워드프레스] H1=title, H2 ❶팩트 ❷Why ❸How ❹전망, FAQ 3+, Table 1, 1,400~1,800자, 키워드 5회+, 마침표 필수."
    : "[워드프레스·단신] 팩트→Why→How→전망 + 표1·FAQ 1+, 1,400자+, 마침표 필수.";
}

export function llmOutputFormatRules(): string {
  return [
    "[출력 형식 — 절대 준수]",
    "- 응답은 요청된 JSON 필드만 출력하세요.",
    "- 글자 수·읽는 시간·SEO·AdSense·날짜 메타·코드블록을 넣지 마세요.",
  ].join("\n");
}

/** Legacy helper for analysis/chain/draft — persona + static rules. */
export function briefingWritingRules(channel?: string): string {
  return [
    "[데일리 브리핑 에디터 페르소나]",
    resolveChannelEditorPersona(channel),
    "",
    wordpressAdsenseGuidelines(true),
    "",
    editorialGroundingRules(),
  ].join("\n");
}

export function premiumCharCount(text: string): number {
  return text.replace(/\s+/g, "").length;
}

export function countOccurrences(text: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let cursor = 0;
  for (;;) {
    const at = text.indexOf(needle, cursor);
    if (at === -1) return count;
    count += 1;
    cursor = at + needle.length;
  }
}

export function premiumResponseContract(): string {
  return [
    "출력은 아래 스키마를 따르는 JSON 객체 하나뿐입니다.",
    "{",
    '  "title": string,',
    '  "excerpt": string,',
    '  "sections": [{ "heading": string, "headingLevel": 2 | 3, "paragraphs": [string] }],',
    '  "table": { "caption": string, "headers": [string], "rows": [[string]] },',
    '  "faq": [{ "question": string, "answer": string }],',
    '  "externalLink": { "href": string, "label": string },',
    '  "internalLink": { "href": string, "label": string },',
    '  "takeaways": [string]',
    "}",
  ].join("\n");
}
