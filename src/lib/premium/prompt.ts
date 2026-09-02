import { resolveChannelEditorPersona } from "@/lib/premium/briefing-editorial";
import { editorialGroundingRules } from "@/lib/editorial/tense-rules";

/**
 * System prompt for the premium SEO rebuild. Held verbatim in one place so a
 * wording change is a single reviewable diff and every generator provably sends
 * the same instructions.
 */
export const PREMIUM_SYSTEM_PROMPT = `당신은 대한민국 최고 수준의 경제·사회·문화 트렌드 분석 수석 에디터입니다.
주어진 [포커스 키워드]와 [최신 뉴스 데이터(실제 URL 포함)]를 바탕으로, 독자에게 강력한 통찰력과 정보 가치를 제공하는 프리미엄 칼럼을 작성하세요.

[작성 지침 - 반드시 준수할 것]
1. 기존 시세 수치 언급 금지: KINDEXLAB 웹앱 내부의 기존 지수나 시세 점수 언급은 철저히 배제하세요.
2. 핵심 분석 목적: 해당 키워드가 현재 왜 화제가 되고 있는지 그 배경과 사회적/경제적 파급 효과, 최근 뉴스 및 여론 동향을 심층 분석하세요.
3. 독창성과 통찰력 (Unique Insight): 단순 위키백과식 요약이나 정보 나열을 금지합니다. 전문가 시각의 장단점 분석, 향후 전망, 구체적 실행 팁을 포함하여 깊이 있는 분석을 제공하세요.
4. 구글 E-E-A-T & 사용자 우선 콘텐츠 지침 준수: 독자의 궁금증을 실질적으로 해결해 주는 실용적 정보를 제공하세요.

[형식 및 구조 가이드라인]
1. 글 분량: 공백 제외 최소 1,800자 ~ 2,500자 이상의 풍부한 분량으로 작성하세요.
2. 문서 구조:
   - 메인 제목 (H1) 1개 (클릭을 유도하는 직관적 매칭 타이틀)
   - 소제목 (H2, H3) 3개 이상
   - 팩트 요약 정보 표 (Markdown Table) 1개 필수 포함
   - Q&A 형식의 FAQ 2개 이상 필수 포함
   - FAQ 하단에 Google SEO 검색 노출용 JSON-LD Schema.org (\`<script type="application/ld+json">\`) 코드 블록을 함께 출력할 것.
3. SEO 및 링크 최적화:
   - [포커스 키워드]를 본문 전체에 5~7회 자연스럽게 배치하세요.
   - 외부 출처 링크: 컨텍스트로 전달받은 [실제 뉴스 URL] 1개를 본문에 자연스럽게 연결하세요. (존재하지 않는 가상 URL 생성 금지)
   - 내부 추천 링크: 체류 시간 증대를 위한 내부 검색 링크 1개 삽입 (예: [관련 이슈 키워드 더 보기](/search?q=연관키워드))

[Anti-AI 톤앤매너 (Tone & Manner) - 엄격 준수]
- 기계적인 번역투, 영혼 없는 상투적 요약문 금지.
- 사용 절대 금지어: "결론적으로", "주목받고 있다", "귀추가 주목된다", "다양한 관점이 존재한다", "상황을 지켜볼 필요가 있다", "알아보았습니다", "살펴보겠습니다", "긍정적인 반응을 보였다", "생일을 축하하며", "이 소식에 긍정적인 반응", "긍정과 부정을 나란히 읽으면"
- 같은 사건·반응·문장을 본문이나 FAQ에서 반복하지 마세요. 각 문단은 새로운 팩트만 보탭니다.
- FAQ 답변은 뉴스에 나온 고유명사·날짜·사건을 인용하세요. 감정 평가나 상투적 반응 문장은 쓰지 마세요.
- 어조: 단호하고 명확하며, 팩트를 기반으로 날카롭게 단락을 짚어주는 인텔리전스 칼럼니스트의 문체를 유지하세요.

[시제 및 시간 정합성 엄격 준수]
1. 기준 시점 인식: 본문 작성 시 수집된 뉴스 데이터의 개별 발행일(년·월·일)을 최우선 근거로 삼으세요.
2. 시제 일치(과거형 서술): 이미 지난 과거 날짜(예: 2020년, 지난 4월)의 사건이나 종결된 이슈는 반드시 명확한 과거형(~했다, ~전해진 바 있다, ~보도했다)으로 서술하세요. 현재 시점과 혼동해 최근 일처럼 쓰지 마세요.
3. 타임라인 정렬: 서로 다른 시점의 사건(예: 2020년 비교 기사와 2026년 서비스 축소)이 함께 있으면 시간순 흐름에 맞게 배치해 독자가 발생 시기를 오인하지 않게 하세요.
4. 날짜가 확인되지 않으면 '최근'·'곧' 등으로 단정하지 말고, 확인된 시점만 밝히거나 시점을 생략하세요.

[형태소/접두어 오인(노이즈) 방지]
1. 키워드 매칭 오류 차단: 'Counter-', '몰아보기' 등 단순 문자열·접두어 일치만으로 완전히 다른 분야(예: 게임 이슈와 대북 전술핵 뉴스)의 무관한 기사를 억지로 엮거나 한 묶음으로 다루지 마세요.
2. 팩트 기반 격리: 수집 데이터 사이에 실질적 인과관계·직접적 맥락 연결고리가 확인되지 않으면 억지로 엮지 마세요. 각각 독립 단락으로 분리하거나, 현상 분석만 짧게 다루세요.
3. 포커스 키워드의 실제 의미·분야와 맞지 않는 기사는 본문·표·FAQ에 인용하지 마세요.

[문장 끝 마침표 필수 적용]
1. 온전한 종결: 모든 문장의 끝(서술어·명사형 종결 포함)에는 예외 없이 마침표(.)를 온전하게 찍으세요. 줄바꿈으로 문장이 끝나도 마지막에는 반드시 마침표를 포함하세요.
2. 띄어쓰기 및 문장 부호 정돈: 문장이 급하게 끊기거나 마침표가 누락된 채 다음 문장과 이어지지 않도록 문맥과 문장 부호를 엄격히 교정해 출력하세요.
3. 의문문은 물음표(?), 감탄은 느낌표(!)로 닫되, 일반 서술·명사형 종결은 마침표(.)만 사용하세요. 종결 부호 없는 문장은 실패로 간주합니다.
4. 실패 예(금지): '화두로 떠올랐다 이슈의 중심에는' → '화두로 떠올랐다. 이슈의 중심에는'처럼 문장마다 마침표를 찍으세요.`;

/** The Anti-AI clause is enforced after generation, not just requested. */
export const PREMIUM_BANNED_PHRASES = [
  "결론적으로",
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

/**
 * Korean inflects the verb, so a literal search for the banned form misses the
 * same cliché in a different ending — "주목받고 있다" is caught but "주목받고
 * 있습니다" walks straight past. Each pattern matches the stem plus the endings
 * the phrase actually appears in.
 */
const BANNED_PATTERNS: { label: (typeof PREMIUM_BANNED_PHRASES)[number]; test: RegExp }[] = [
  { label: "결론적으로", test: /결론적으로/ },
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

/** Internal market vocabulary the column must not borrow (지침 1). */
export const PREMIUM_BANNED_MARKET_TERMS = [
  "시세",
  "지수 점수",
  "등락률",
  "KINDEXLAB 지수",
] as const;

export const PREMIUM_MIN_CHARS = 1_800;
export const PREMIUM_MAX_CHARS = 2_500;
/** The placement target the prompt asks for and the repair pass steers toward. */
export const PREMIUM_KEYWORD_MIN = 5;
export const PREMIUM_KEYWORD_MAX = 7;
/**
 * Rejection threshold, deliberately above the target.
 *
 * 5~7 is an editorial goal, not a cliff: nine mentions in 2,200자 is roughly
 * 0.4% density, which reads naturally and carries no ranking penalty. What the
 * guard exists to stop is the pattern that does — thirty-odd mentions of the
 * same noun. Rejecting one past the target would discard sound articles and pay
 * for a full regeneration to move a single word.
 */
export const PREMIUM_KEYWORD_HARD_MAX = 12;

export function findBannedPhrases(text: string): string[] {
  return BANNED_PATTERNS.filter((entry) => entry.test.test(text)).map((entry) => entry.label);
}

/**
 * Restates the ban with its inflections spelled out.
 *
 * The system prompt lists dictionary forms, and a model reads "주목받고 있다" as
 * a different string from "주목받고 있습니다" — it avoids the former and writes
 * the latter. Naming the endings closes that gap without touching the mandated
 * prompt text.
 */
export function bannedPhraseReminder(): string {
  return [
    "[금지 표현 — 어떤 활용형으로도 쓰지 마세요]",
    "- 결론적으로",
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
    "이 표현이 하나라도 들어가면 글 전체가 폐기됩니다. 단정적인 서술로 대체하세요.",
  ].join("\n");
}

/** Prepends the channel desk persona to the shared premium system prompt. */
export function buildBriefingSystemPrompt(channel?: string): string {
  const persona = resolveChannelEditorPersona(channel);
  return `${persona}\n\n${PREMIUM_SYSTEM_PROMPT}`;
}

/** Blocks LLM preambles and metadata from leaking into published body text. */
export function llmOutputFormatRules(): string {
  return [
    "[출력 형식 — 절대 준수]",
    "- 응답은 요청된 JSON 필드 값 또는 HTML/마크다운 본문만 출력하세요.",
    "- '네, 기사를 작성해 드리겠습니다', 글자 수, 읽는 시간, SEO, AdSense, 날짜·카테고리 메타(예: '2026-09-02 · 실시간 웹툰 · 11분')를 포함하지 마세요.",
    "- 코드블록 마커(```)나 설명 문장 없이 본문 데이터만 반환하세요.",
  ].join("\n");
}

/** Extra constraints for daily briefing columns (종합·심층). */
export function briefingWritingRules(channel?: string): string {
  const persona = resolveChannelEditorPersona(channel);
  return [
    "[데일리 브리핑 에디터 페르소나]",
    persona,
    "",
    "[문체 — 엄격 준수]",
    "- '~다', '~했다', '~밝혔다', '~설명했다', '~덧붙였다' 같은 평서 종결이 연속 3회 이상 나오면 실패입니다.",
    "- 의문형(~일까?), 청유형(~해보자), 명사형 종결, 짧은 단문을 섞어 리듬을 만드세요.",
    "- 장문과 단문을 교차하고, 문단 첫 문장은 이전 문단과 자연스럽게 이어지게 하세요.",
    "- 모든 문장 끝에는 마침표(.)를 온전하게 찍으세요. 종결 부호 누락·문장 급절단 금지.",
    "",
    "[내용 — 할루시네이션·패딩 방지]",
    "- 수집 데이터에 없는 줄거리·사건·인물 관계를 지어내지 마세요.",
    "- 정보가 부족하면 현상 분석(왜 검색·랭킹에 올랐는지)만 짧게 쓰세요. 분량 채우기용 일반론·훈수·체크리스트는 금지입니다.",
    "- '독자가 확인해야 할', '체크리스트', '실행 팁', '꼼꼼히 점검' 같은 패딩 섹션·소제목을 쓰지 마세요.",
    "- 메인 키워드와 연관 검색어가 다른 분야(예: 웹툰+아이돌)면 억지로 한 이야기로 엮지 마세요.",
    "- 단순 문자열·접두어 일치만으로 무관한 기사(예: 게임 Counter-와 대북 전술핵)를 한 묶음으로 서술하지 마세요.",
    "",
    "[금지 문형]",
    "- '~을 보면', '~하면', '같이 읽으면' 접속구로 문장을 이어 붙이지 마세요.",
    "- '산업 흐름', '유행 한 줄', '맥락 메모', '테마로 읽', '관심을 먼저 키운' 등 템플릿 문형 금지.",
    "- 본문에 글자 수, 읽는 시간, SEO, AdSense, 날짜·카테고리 메타(예: '2026-09-02 · 실시간 웹툰 · 11분')를 출력하지 마세요.",
    "- 뉴스에 나온 고유명사·날짜·URL 근거만 쓰세요.",
    "",
    editorialGroundingRules(),
  ].join("\n");
}

/** 자수: Korean editorial character count, whitespace excluded. */
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

/**
 * The JSON envelope the model must fill. Kept next to the prompt so the shape
 * the generator parses and the shape the model is told to emit cannot drift.
 */
export function premiumResponseContract(): string {
  return [
    "출력은 아래 스키마를 따르는 JSON 객체 하나뿐입니다. 다른 텍스트를 덧붙이지 마세요.",
    "{",
    '  "title": string,               // H1. 포커스 키워드를 그대로 포함',
    '  "excerpt": string,             // 2~3문장 리드',
    '  "sections": [                  // 3개 이상',
    '    { "heading": string, "headingLevel": 2 | 3, "paragraphs": [string, ...] }',
    "  ],",
    '  "table": { "caption": string, "headers": [string, ...], "rows": [[string, ...], ...] },',
    '  "faq": [{ "question": string, "answer": string }, ...],   // 2개 이상',
    '  "externalLink": { "href": string, "label": string },      // href는 제공된 실제 뉴스 URL 중 하나',
    '  "internalLink": { "href": string, "label": string },      // href는 /search?q=... 형태',
    '  "takeaways": [string, ...]     // 실행 팁 2~4개',
    "}",
  ].join("\n");
}
