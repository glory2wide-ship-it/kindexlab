/**
 * Hybrid system prompt for 오늘의 분석 (heatmap columns):
 * - ~80% legacy AdSense craft (Why/How density, SEO, anti-thin, 합니다체)
 * - ~20% light originality (why-now · reader meaning · careful outlook)
 *
 * Outline: ❶ 오늘의 결론 / ❷ 왜 지금 관심이 높아졌나 / ❸ [독자 소제목] / ❹ [전망 소제목]
 *          / ❺ KinDex 데이터가 보여주는 특징 (한 문단) → takeaways「핵심 요약」직전
 * KinDex 숫자는 산출 강의가 아니라 관심·화제 트렌드 해석.
 */
import { TREND_ANALYSIS_DISCLAIMER, stripTrendDisclaimer } from "@/lib/editorial/disclaimer";
import {
  buildKindexFeatureParagraph,
  editionFreshnessRules,
  editorialGroundingRules,
  ensureKindexFeatureSectionPlacement,
  extractStoryBeatsFromSections,
  isKindexFeatureSectionHeading,
  isUnusableKindexFeatureBody,
  KINDEX_FEATURE_SECTION_HEADING,
  stripNumberedHeadingPrefix,
  tenseConsistencyRules,
} from "@/lib/editorial/tense-rules";
import { bannedPhraseReminder } from "@/lib/premium/prompt";
import { resolveChannelEditorPersona } from "@/lib/premium/briefing-editorial";
import { formatNumberedH2 } from "@/lib/premium/seo-format";

/** Slots 1·2·5 stay fixed (❶❷❺); slots 3·4 are adaptive (❸❹). */
export const HYBRID_FIXED_HEADINGS = {
  conclusion: "오늘의 결론",
  whyNow: "왜 지금 관심이 높아졌나",
  kindexFeature: KINDEX_FEATURE_SECTION_HEADING,
  /** @deprecated Awkward — never force into published copy. */
  outlook: "앞으로 지켜볼 흐름",
} as const;

/** @deprecated Awkward legacy label — never force this into published copy. */
export const HYBRID_LEGACY_READER_HEADING = "사용자에게 의미하는 변화";

/** @deprecated Awkward legacy outlook label. */
export const HYBRID_LEGACY_OUTLOOK_HEADING = "앞으로 지켜볼 흐름";

/** @deprecated Prefer HYBRID_FIXED_HEADINGS + resolveHybrid*Heading. */
export const HYBRID_ANALYSIS_HEADINGS = [
  HYBRID_FIXED_HEADINGS.conclusion,
  HYBRID_FIXED_HEADINGS.whyNow,
  HYBRID_LEGACY_READER_HEADING,
  HYBRID_LEGACY_OUTLOOK_HEADING,
] as const;

export type HybridAnalysisHeading = string;

const AWKWARD_READER_HEADINGS = [
  HYBRID_LEGACY_READER_HEADING,
  "사용자에게 미치는 영향",
  "독자에게 의미하는 변화",
  "독자에게 미치는 영향",
  "독자 관점의 시사점",
  "실질적 파급력과 독자 관점의 시사점",
  "지원금을 신청하는 방법",
  "여행·외식 소비자에게 끼치는 영향",
  "투자자에게 의미하는 변화",
  "팬들에게 끼치는 영향",
  "시민·유권자에게 미치는 영향",
  "소비자에게 끼치는 영향",
  "일상에서 달라지는 점",
];

const AWKWARD_OUTLOOK_HEADINGS = [
  HYBRID_LEGACY_OUTLOOK_HEADING,
  "앞으로 지켜볼 점",
  "향후 전망",
  "향후 전망과 파급",
  "전망과 파급",
  "향후 과제",
  "다음 모집·쿠폰 일정을 확인하는 법",
  "실적·수급에서 확인할 포인트",
  "다음 일정과 반응을 보는 법",
  "예약·성수기 전에 확인할 변수",
  "추가 발표와 일정에서 볼 점",
  "출시·판매 일정에서 볼 점",
  "앞으로 확인할 일정과 변수",
];

/** Headings that already sound like a real audience/action label. */
const NATURAL_READER_HINT =
  /투자자|소비자|신청|지원금|팬|유권자|시민|여행|외식|시청자|구독자|이용자|직장인|학부모|주민|자격|혜택|동선|판단|힌트|확인|포인트|변화/;

/** Headings that already sound like a concrete outlook/check label. */
const NATURAL_OUTLOOK_HINT =
  /일정|모집|쿠폰|실적|변수|확인|다음|추가|신청|발표|반응|수급|예약|혜택|포인트|관전|지급|읽는|보는/;

function focusCoreLabel(focusKeyword?: string): string {
  return (
    (focusKeyword || "")
      .replace(/^\[[^\]]+\]\s*/, "")
      .replace(/\s*이슈\s*$/u, "")
      .trim() || "이 사업"
  );
}

/**
 * Pick a natural 3rd H2 for the reader-impact section from channel / category / keyword.
 * Returns a keyword-flavored hint — models must still rewrite with unique nouns.
 */
export function resolveHybridReaderHeading(input: {
  channel?: string;
  categoryHint?: string;
  focusKeyword?: string;
}): string {
  const channel = (input.channel || "").toLowerCase();
  const blob = `${input.categoryHint || ""} ${input.focusKeyword || ""}`.toLowerCase();
  const focus = focusCoreLabel(input.focusKeyword);

  if (/지원금|보조금|바우처|상품권|수당|환급|신청|자격|혜택|복지|숙박 지원|관광숙박/.test(blob)) {
    return `${focus} 신청·자격에서 놓치기 쉬운 점`;
  }
  if (
    channel === "economy" ||
    /주식|종목|코스피|코스닥|증시|증권|펀드|환율|금리|채권|투자|반도체|시총/.test(blob)
  ) {
    return `${focus}가 투자 판단에 주는 힌트`;
  }
  if (
    channel === "entertainment" ||
    /아이돌|팬덤|팬|콘서트|앨범|컴백|배우|드라마|예능|유튜버|인플루언서/.test(blob)
  ) {
    return `${focus} 팬·시청자가 바로 느끼는 변화`;
  }
  if (channel === "travel" || /여행|맛집|카페|호텔|항공|관광|주말나들이|숙소/.test(blob)) {
    return `${focus} 여행·외식 동선에서 달라지는 점`;
  }
  if (channel === "politics" || /정당|의원|대통령|선거|국회|정책|법안/.test(blob)) {
    return `${focus}가 시민 생활에 미치는 영향`;
  }
  if (
    channel === "culture" ||
    /공연|전시|도서|웹툰|레시피|건강|자동차|팝업|구매|가격|출시|가전/.test(blob)
  ) {
    return `${focus}를 고를 때 확인할 포인트`;
  }
  return `${focus} 일상에서 달라지는 점`;
}

/**
 * Pick a natural 4th H2 for the outlook section — never "앞으로 지켜볼 흐름".
 */
export function resolveHybridOutlookHeading(input: {
  channel?: string;
  categoryHint?: string;
  focusKeyword?: string;
}): string {
  const channel = (input.channel || "").toLowerCase();
  const blob = `${input.categoryHint || ""} ${input.focusKeyword || ""}`.toLowerCase();
  const focus = focusCoreLabel(input.focusKeyword);

  if (/지원금|보조금|바우처|상품권|수당|환급|신청|모집|쿠폰|숙박 지원|관광숙박/.test(blob)) {
    return `${focus} 다음 모집·지급 일정을 읽는 법`;
  }
  if (
    channel === "economy" ||
    /주식|종목|코스피|코스닥|증시|증권|펀드|환율|금리|채권|투자|반도체|시총/.test(blob)
  ) {
    return `${focus} 실적·수급에서 확인할 포인트`;
  }
  if (
    channel === "entertainment" ||
    /아이돌|팬덤|팬|콘서트|앨범|컴백|배우|드라마|예능|유튜버|인플루언서/.test(blob)
  ) {
    return `${focus} 다음 일정과 반응을 보는 법`;
  }
  if (channel === "travel" || /여행|맛집|카페|호텔|항공|관광|주말나들이|숙소|예약/.test(blob)) {
    return `${focus} 예약·성수기 전에 확인할 변수`;
  }
  if (channel === "politics" || /정당|의원|대통령|선거|국회|정책|법안/.test(blob)) {
    return `${focus} 추가 발표와 일정에서 볼 점`;
  }
  if (channel === "culture" || /공연|전시|도서|웹툰|레시피|건강|자동차|팝업|구매|가격|출시|가전/.test(blob)) {
    return `${focus} 출시·판매 일정에서 볼 점`;
  }
  return `${focus} 앞으로 확인할 일정과 변수`;
}

/**
 * ~80%: legacy AdSense density / SEO / anti-thin craft.
 * Deliberately omits any "승인용/고품질 기준 충족" language.
 */
const LEGACY_ADSENSE_CORE = `[콘텐츠 밀도 — 팩트 보도 이후 필수 (Low-value 방지) · 비중 ≈80%]
1. Why(배경·원인): "무엇이 일어났는가"에서 멈추지 말고, 에디션 날짜 기준으로 왜 지금 대중·검색·보도가 반응하는지 시장·플랫폼·일정 맥락을 전문가 시각으로 풀어내세요. RAG에 근거가 있을 때만 인과를 단정합니다.
2. How(실용 인사이트): 독자의 일상·소비·시청·구독·지갑에 미치는 영향과, 확인·비교·판단에 쓸 구체 요령을 본문 서술로 녹이세요. '독자 체크리스트'·'확인해야 할 N가지' 목록형 패딩은 금지입니다.
3. 데이터 비교 표: 핵심 지표·일정·장단·수치·비교 대상을 table(헤더 3열+, 행 2~4)로 시각화하세요. caption은 '팩트 체크' 또는 '핵심 팩트 요약'만 사용하세요.
4. 전망·파급: RAG·공개 일정·관심 신호에 비춰 앞으로의 전개를 신중히 제시하세요. 확인되지 않은 수치·확정 발표를 지어내지 마세요.
5. 위 Why·How·전망 밀도는 아래 [최종 출력 섹션] ❶~❹에 녹이고, KinDex 숫자 해석은 ❺ 한 문단에 모으세요. 표·FAQ는 본문을 보완합니다.`;

const HYBRID_SECTION_OUTPUT = `[최종 출력 섹션 — sections 정확히 5개, headingLevel 2]
heading 앞에 반드시 ❶❷❸❹❺ 번호를 붙이세요 (레거시 애드센스 칼럼과 동일).
❺ 다음에 오는 takeaways가 화면의 「핵심 요약」이 됩니다. ❺는 그 직전 본문 소제목입니다.

1. ❶ 오늘의 결론  ← 본문 역할 고정, 번호 필수
   - 오늘 뉴스와 KinDex 관심 데이터에서 가장 중요한 변화와 의미를 2~4문단으로.
   - "A가 1위"만으로 끝내지 마세요. 자세한 숫자 트렌드 해석은 ❺에 모으세요.
2. ❷ 왜 지금 관심이 높아졌나  ← 본문 역할 고정, 번호 필수
   - 사건·뉴스·사회적 맥락 분석. RAG에 확인된 일정·보도만 인과로 연결하세요.
3. ❸ [독자·주제별 자연 소제목]  ← "사용자에게 의미하는 변화"·"지원금을 신청하는 방법" 같은 공통 템플릿 금지
   - 포커스 키워드·사업명·지역명을 넣은 이 글만의 소제목으로 새로 지으세요.
   - 예: "❸ 국민취업지원제도 신청 전 확인할 자격" / "❸ 관광두레 참가자가 챙길 혜택"
   - 본문: 해당 독자 관점의 실질 핵심. 목록형 체크리스트 금지. KinDex 숫자 해석은 ❺로.
4. ❹ [글에 맞는 전망 소제목]  ← "앞으로 지켜볼 흐름"·"다음 모집·쿠폰 일정을 확인하는 법" 공통 템플릿 금지
   - 예: 지원금 → "❹ 청년내일저축계좌 다음 모집창을 읽는 법"
   - 예: 주식 → "❹ 실적·수급에서 확인할 포인트"
   - 예: 팬덤 → "❹ 다음 일정과 반응을 보는 법"
   - 예: 여행·맛집 → "❹ 예약·성수기 전에 확인할 변수"
   - 본문: 뉴스와 데이터 기반의 신중 전망. "가능성이 있습니다", "확인이 필요합니다" 수준.
   - 본 섹션 마지막 문단의 마지막 문장은 필수 디스클레이머로 끝내세요.
5. ❺ KinDex 데이터가 보여주는 특징  ← 제목 고정, 번호 필수, paragraphs 정확히 1개
   - 순위·변동 숫자를 나열만 하지 마세요. ❶~❹에서 이미 쓴 신청·자격·일정·정책 축과 연결해 ‘왜 이 순위·정체가 의미 있는지’를 한 문단으로 해석하세요.
   - 실패 예: "N위에 있습니다. 정체(0%)입니다. … 종합하면 보드 안 상대 순위·움직임으로 읽습니다."처럼 팩트 문장만 이어 붙이기.
   - KinDex가 무엇인지 정의하는 일반론(관심 신호는 방향·속도… / 산출 공식이 아니라…)만 쓰는 것도 실패입니다.
   - 산출 공식·점수 척도 강의 금지. 입력에 없는 수치 금지.
   - takeaways(핵심 요약) 바로 앞에 둡니다.`;

const LEGACY_CRAFT_RULES = `[작성 및 서식 엄격 규칙]
1. 문장 종결: 모든 서술 문장을 높임말(합니다체: ~습니다/~합니다/~됩니다/~있습니다/~없습니다)로 끝내고 마침표(.)를 찍으세요. 의문문은 '~까요?'만 허용. '~다/~했다/~이다/~된다' 해라체 금지.
2. 문체 리듬: 동일 종결(~습니다 등)이 연속 3회 나오지 않도록 '~합니다/~됩니다/~았습니다/~고 있습니다' 등으로 바꾸세요.
3. Anti-AI 패턴 배제: "결론적으로", "요약하자면", "이 글에서는", "주목받고 있다", "귀추가 주목된다", "다양한 관점이 존재한다", "상황을 지켜볼 필요가 있다", "알아보았습니다", "살펴보겠습니다", "긍정적인 반응을 보였다", "새로운 패러다임", "혁신을 선보", "심층 분석", "주목할 만한", "화제가 되고", "관심이 집중" 등 상투어 금지.
4. 문장 길이: 한 문장은 공백 제외 45~90자 권장(최소 40자). 20~35자 단문 연속 금지. 문단당 2~4문장, 한 문단에 5문장 이상 금지. ❺만 예외로 한 문단(여러 문장 가능).
5. 수치·객관성: 모호한 감상 대신 날짜·기관명·비율·확인된 근거로 서술하세요.
6. 팩트 기반: [최신 뉴스 데이터]가 1차 근거입니다. KinDex 관심 신호는 ❺에서 숫자가 가리키는 트렌드 해석으로 보조합니다. 없는 사건·수치를 지어내지 마세요.
7. 할루시네이션 방지: 다의어·접두어 일치만으로 이종 산업 소식을 한 인과로 묶지 마세요. 동음이의어를 이중적 의미·복합 트렌드로 한 편의 주제로 엮는 구성도 금지입니다.
8. 메타 누설 금지: 글자 수, 읽는 시간, SEO, AdSense, '애드센스 고품질 본문 기준 충족', LLM 서문을 본문에 넣지 마세요.
9. 소제목: ❶❷❸❹❺ 번호 필수. 1·2·5는 고정 문구, 3·4는 독자·주제별 자연어. "사용자에게 의미하는 변화"·"앞으로 지켜볼 흐름" 금지.
10. 【연도 숫자 필수】 소제목·본문에서 연도를 쓰면 반드시 \`2026년\`처럼 숫자를 \`년\` 앞에 붙이세요. \`❶ 년 …\`처럼 숫자 누락은 즉시 폐기입니다. 「파급 효과」는 허용합니다. \`시점맙니다\`, \`다시 습니다\`처럼 서술어 어간이 빠진 종결은 금지입니다.`;

const LEGACY_SEO_BLOCK = `[애드센스·검색 SEO]
1. 분량: 공백 제외 목표 1,000~1,800자(파이프라인 floor/ceiling을 우선). 밀도는 패딩이 아니라 분석으로 채우세요.
2. H1=title 하나. sections는 정확히 5개(H2, heading에 ❶❷❸❹❺). FAQ 질문은 H3 개념.
3. 포커스 키워드(브래킷 부처명 제외한 핵심어)를 문서 전체에서 5~6회만 자연 배치. 7회 초과·소제목·표·FAQ 질문 과반복 금지.
4. table 1개 + FAQ 3개+(답변 각 2~3문장).
5. externalLink.href는 제공된 뉴스 URL만. internalLink.href는 실제 경로만 (/board/…, /{channel}/briefing, /ranking/…). /search?q= 금지.
6. takeaways 3개 = 독자가 바로 가져갈 실행·판단 포인트(높임말). 목록 패딩 금지. 화면에서는 ❺ 다음 「핵심 요약」.
7. JSON-LD는 파이프라인이 조립하므로 script 태그를 본문에 넣지 마세요.`;

/**
 * ~20%: light originality — KinDex meaning concentrated in section ❺.
 */
const LIGHT_JOURNALIST_BLOCK = `[독창 앵글 — 가벼운 보강만 · 비중 ≈20%]
❶~❹에는 뉴스·독자·전망을, ❺에는 KinDex 숫자 해석만 짧게 반영하세요.
1) 오늘 뉴스 + KinDex 관심에서 무엇이 가장 중요한가 (❶)
2) 왜 지금 관심이 붙었는가 (사건·사회 맥락) (❷)
3) 이 글의 실제 독자(투자자·소비자·신청자·팬 등)에게 무엇이 달라지는가 (❸)
4) 앞으로 어떤 일정·변수·반응을 확인하면 좋은가 (❹, 상투적 "지켜볼 흐름" 금지)
5) KinDex 순위·변동 + ❶~❹ 스토리를 묶은 특징 한 문단 (❺, 핵심 요약 직전)
금지: KinDex/킨덱스 산출 방식, 점수 척도(100점·999점 등) 장문 해설, 등락률·시세 나열, 순위표를 그대로 문장으로 옮기기.
금지: KinDex 개념 정의만 쓰는 문장(예: "관심 신호는 … 방향과 속도를 가리키며, 산출 공식이 아니라…").
금지: "N위입니다. 정체입니다. 종합하면 보드 안 상대 순위…"형 템플릿 나열.
KinDex 숫자가 있으면 ❶~❹ 주제(신청·일정·정책 등)와 묶어 관심 방향·속도·상대 위치를 ❺에서 해석하세요. 입력에 없는 수치는 만들지 마세요.`;

/**
 * Hybrid system prompt used when `dataJournalist: true` (오늘의 분석 / heatmap columns).
 */
export function buildHybridAnalysisSystemPrompt(channel?: string): string {
  const persona =
    resolveChannelEditorPersona(channel) ||
    "당신은 구글 애드센스·SEO 수익화 기준을 아는 10년 차 전문 웹진 에디터이자 후배에게 원고를 다듬어 주는 전문가 선배입니다.";
  const readerHint = resolveHybridReaderHeading({ channel });
  const outlookHint = resolveHybridOutlookHeading({ channel });

  return [
    `${persona}

기계적인 AI 요약체가 아닌, 독자의 문제를 실질적으로 해결하는 깊이 있는 고품질 한국어 칼럼을 생성하세요.
주어진 [포커스 키워드]·[최신 뉴스 데이터]·[KinDex 관심 신호]를 근거로 쓰세요. 지수 산출·점수 척도 강의는 넣지 말고, 숫자가 의미하는 관심·화제 트렌드를 해석하세요.
단순 팩트 나열만 하면 Thin/Low-value로 탈락하기 쉽습니다. 뉴스 해석 + 독자 의미 + 신중 전망으로 체류와 E-E-A-T를 높이세요.
[보드 의미 · 동음이의어] 사용자 메시지에 보드·단위·해석이 있으면 그것을 최우선으로 지키세요. 같은 글자라도 꽃·여행·의류·과일 등 다른 분야로 바꾸지 마세요. 동음이의 RAG는 버리고 보드 의미에 맞는 자료만 쓰세요.`,

    LEGACY_ADSENSE_CORE,
    HYBRID_SECTION_OUTPUT,
    LEGACY_CRAFT_RULES,
    LEGACY_SEO_BLOCK,
    LIGHT_JOURNALIST_BLOCK,
    tenseConsistencyRules(),
    editionFreshnessRules(),
    editorialGroundingRules(),
    bannedPhraseReminder(),

    `[제목]
- 금지: "○○가 지금 화제인 이유", "오늘 ○○ TOP 10", "○○가 1위를 기록한 이유"
- 권장: 사건·일정·비교·파급이 드러나는 독창 제목. 포커스 핵심어를 자연히 포함. 제목에 KinDex/지수 문구 남용 금지.`,

    `[출력 포맷 — 절대 준수]
- JSON 객체 하나만 반환. 코드블록·설명 문장 금지.
- 스키마: title, excerpt, sections[{heading, headingLevel, paragraphs[]}], table{caption, headers[], rows[][]}, faq[{question, answer}], externalLink{href, label}, internalLink{href, label}, takeaways[]
- sections[0].heading="❶ ${HYBRID_FIXED_HEADINGS.conclusion}"
- sections[1].heading="❷ ${HYBRID_FIXED_HEADINGS.whyNow}"
- sections[2].heading="❸ …" 독자·주제 자연 소제목 (예: "❸ ${readerHint}"). "${HYBRID_LEGACY_READER_HEADING}" 금지.
- sections[3].heading="❹ …" 전망 자연 소제목 (예: "❹ ${outlookHint}"). "${HYBRID_LEGACY_OUTLOOK_HEADING}" 금지.
- sections[4].heading="❺ ${HYBRID_FIXED_HEADINGS.kindexFeature}" ← 제목 고정, paragraphs 정확히 1개, takeaways(핵심 요약) 직전
- ❶~❹ 각 섹션 paragraphs 3~4개. ❺만 paragraphs 1개.
- ❺ 본문은 KinDex 순위·관심 속도·보드 안 상대 위치 해석만 씁니다. 면책 문구(${TREND_ANALYSIS_DISCLAIMER})를 ❺ paragraphs에 넣지 마세요.
- 면책 문구는 ❹ 마지막 문단의 마지막 문장으로만 둡니다: ${TREND_ANALYSIS_DISCLAIMER}`,
  ]
    .join("\n\n")
    .trim();
}

/** @deprecated Prefer buildHybridAnalysisSystemPrompt — kept for stable import sites. */
export const DATA_JOURNALIST_SYSTEM_PROMPT = buildHybridAnalysisSystemPrompt();

function scrubHeadingNoise(heading: string): string {
  return stripNumberedHeadingPrefix(heading).replace(/\.$/, "").trim();
}

function isAwkwardReaderHeading(heading: string): boolean {
  const clean = scrubHeadingNoise(heading);
  if (!clean || clean.length < 6 || clean.length > 42) return true;
  if (AWKWARD_READER_HEADINGS.some((item) => clean === item || clean.includes(item))) return true;
  if (/사용자|독자 관점|실질적 파급|시사점/.test(clean)) return true;
  if (!NATURAL_READER_HINT.test(clean)) return true;
  return false;
}

function isAwkwardOutlookHeading(heading: string): boolean {
  const clean = scrubHeadingNoise(heading);
  if (!clean || clean.length < 6 || clean.length > 44) return true;
  if (AWKWARD_OUTLOOK_HEADINGS.some((item) => clean === item || clean.includes(item))) return true;
  if (/지켜볼 흐름|지켜볼 점|향후 전망$/.test(clean)) return true;
  if (!NATURAL_OUTLOOK_HINT.test(clean)) return true;
  return false;
}

/**
 * Normalize hybrid outline: fix slots 1·2·5; repair 3·4; prefix ❶❷❸❹❺.
 * ❺ KinDex feature section is always one paragraph, immediately before takeaways/핵심 요약.
 */
export function applyHybridAnalysisHeadings<T extends { heading: string; headingLevel?: 2 | 3; paragraphs: string[] }>(
  sections: T[],
  context?: {
    channel?: string;
    categoryHint?: string;
    focusKeyword?: string;
    signalFacts?: string[];
  },
): Array<T & { heading: string; headingLevel: 2 }> {
  const storyBeats = extractStoryBeatsFromSections(sections);
  const kindexFallback = buildKindexFeatureParagraph({
    keyword: context?.focusKeyword ?? "",
    signalFacts: context?.signalFacts,
    storyBeats,
  });
  const placed = ensureKindexFeatureSectionPlacement(sections, {
    keyword: context?.focusKeyword,
    signalFacts: context?.signalFacts,
    storyBeats,
    fallbackParagraph: kindexFallback,
  });
  const cleaned = placed
    .filter((section) => !section.heading.includes("핵심 요약"))
    .map((section) => ({
      ...section,
      heading: scrubHeadingNoise(section.heading),
    }));
  const taken = new Set<number>();
  const fallbackReader = resolveHybridReaderHeading(context ?? {});
  const fallbackOutlook = resolveHybridOutlookHeading(context ?? {});

  const pick = (matcher: (heading: string) => boolean, preferredIndex: number): T | undefined => {
    let sourceIndex = cleaned.findIndex(
      (section, sectionIndex) => !taken.has(sectionIndex) && matcher(section.heading),
    );
    if (sourceIndex < 0) {
      sourceIndex = cleaned.findIndex(
        (_, sectionIndex) => !taken.has(sectionIndex) && sectionIndex === preferredIndex,
      );
    }
    if (sourceIndex < 0) {
      sourceIndex = cleaned.findIndex((_, sectionIndex) => !taken.has(sectionIndex));
    }
    if (sourceIndex < 0) return undefined;
    taken.add(sourceIndex);
    return cleaned[sourceIndex] as T;
  };

  const conclusion = pick(
    (heading) => heading === HYBRID_FIXED_HEADINGS.conclusion || heading.includes("오늘의 결론"),
    0,
  );
  const whyNow = pick(
    (heading) => heading === HYBRID_FIXED_HEADINGS.whyNow || heading.includes("왜 지금"),
    1,
  );
  const kindexSource = pick((heading) => isKindexFeatureSectionHeading(heading), cleaned.length - 1);
  const readerSource = pick((heading) => {
    if (!heading) return false;
    if (heading === HYBRID_FIXED_HEADINGS.conclusion || heading.includes("오늘의 결론")) return false;
    if (heading === HYBRID_FIXED_HEADINGS.whyNow || heading.includes("왜 지금")) return false;
    if (isKindexFeatureSectionHeading(heading)) return false;
    if (AWKWARD_OUTLOOK_HEADINGS.some((item) => heading === item || heading.includes("지켜볼"))) return false;
    return true;
  }, 2);
  const outlookSource = pick((heading) => !isKindexFeatureSectionHeading(heading), 3);

  const readerHeading =
    readerSource && !isAwkwardReaderHeading(readerSource.heading)
      ? scrubHeadingNoise(readerSource.heading)
      : fallbackReader;
  const outlookHeading =
    outlookSource && !isAwkwardOutlookHeading(outlookSource.heading)
      ? scrubHeadingNoise(outlookSource.heading)
      : fallbackOutlook;

  const emptyParas = ["관련 확인된 사실이 제한적입니다."];
  const kindexParas = (() => {
    const merged = (kindexSource?.paragraphs ?? [])
      .map((item) => item.trim())
      .filter(Boolean)
      .join(" ")
      .trim();
    // Disclaimer-only ❺ must fall back — strip first so leftover data copy can survive.
    const withoutDisclaimer = stripTrendDisclaimer(merged);
    const usable =
      withoutDisclaimer && !isUnusableKindexFeatureBody(withoutDisclaimer)
        ? withoutDisclaimer
        : kindexFallback;
    return [usable];
  })();

  const ordered = [
    {
      ...(conclusion as T),
      heading: HYBRID_FIXED_HEADINGS.conclusion,
      headingLevel: 2 as const,
      paragraphs: (conclusion?.paragraphs?.length ? conclusion.paragraphs : emptyParas) as string[],
    },
    {
      ...(whyNow as T),
      heading: HYBRID_FIXED_HEADINGS.whyNow,
      headingLevel: 2 as const,
      paragraphs: (whyNow?.paragraphs?.length ? whyNow.paragraphs : emptyParas) as string[],
    },
    {
      ...(readerSource as T),
      heading: readerHeading,
      headingLevel: 2 as const,
      paragraphs: (readerSource?.paragraphs?.length ? readerSource.paragraphs : emptyParas) as string[],
    },
    {
      ...(outlookSource as T),
      heading: outlookHeading,
      headingLevel: 2 as const,
      paragraphs: (outlookSource?.paragraphs?.length ? outlookSource.paragraphs : emptyParas) as string[],
    },
    {
      ...(kindexSource as T),
      heading: HYBRID_FIXED_HEADINGS.kindexFeature,
      headingLevel: 2 as const,
      paragraphs: kindexParas,
    },
  ];

  return ordered.map((section, index) => ({
    ...section,
    heading: formatNumberedH2(index, section.heading),
  }));
}

export function buildDataJournalistUserPrompt(params: {
  channel: string;
  categoryHint: string;
  focusKeyword: string;
  relatedKeywords: string[];
  newsContext: string;
  editionDate?: string;
  minChars?: number;
  maxChars?: number;
  /** Editorial interest signals — meaning only, no score pedagogy. */
  kindexSignals?: string;
  /** Board sense / homonym guard (e.g. 코스모스 = book, not flower). */
  boardSenseBlock?: string;
  /** full = rewrite whole column; incremental = update from prior digest + new facts. */
  rewriteMode?: "full" | "incremental";
  previousArticleDigest?: string;
}): string {
  const floor = params.minChars ?? 1000;
  const ceiling = params.maxChars ?? 1800;
  const focusCore =
    params.focusKeyword.replace(/^\[[^\]]+\]\s*/, "").replace(/\s*이슈\s*$/u, "").trim() ||
    params.focusKeyword;
  const related =
    params.relatedKeywords.filter(Boolean).join(", ") ||
    "직접 연관 키워드 없음 — 무관한 소재를 억지로 엮지 마세요.";
  const editionLine = params.editionDate?.trim() || "미지정";
  const charTarget =
    floor <= 850 ? "900~1,400" : floor <= 1000 ? "1,100~1,500" : "1,400~1,700";
  const ctx = {
    channel: params.channel,
    categoryHint: params.categoryHint,
    focusKeyword: params.focusKeyword,
  };
  const readerHeading = resolveHybridReaderHeading(ctx);
  const outlookHeading = resolveHybridOutlookHeading(ctx);

  return [
    "[분류 정보]",
    `- 채널: ${params.channel}`,
    `- 상세 카테고리: ${params.categoryHint}`,
    `- 포커스 키워드(원문): ${params.focusKeyword}`,
    `- 포커스 핵심어(본문 배치용): ${focusCore}`,
    `- 비교용 연관 키워드: ${related}`,
    `- 에디션 날짜(KST): ${editionLine}`,
    `- 글 유형: 오늘의 분석 (하이브리드: 레거시 애드센스 밀도 ≈80% + 독창 앵글 ≈20%)`,
    `- 분량: 공백 제외 ${floor}~${ceiling}자 (목표 ${charTarget})`,
    `- 3번 소제목 권장안: ${readerHeading}`,
    `- 4번 소제목 권장안: ${outlookHeading}`,
    `- 5번 소제목(고정): ${HYBRID_FIXED_HEADINGS.kindexFeature} — paragraphs 1개, 핵심 요약 직전`,
    "",
    ...(params.boardSenseBlock?.trim() ? [params.boardSenseBlock.trim(), ""] : []),
    ...(params.rewriteMode === "incremental"
      ? [
          "[증분 갱신 모드]",
          "이전 칼럼의 골격·확정 팩트는 유지하고, 신규 뉴스·일정·수치만 반영해 갱신하세요.",
          "전체를 처음부터 다시 쓰지 마세요. 제목·소제목은 필요할 때만 최소 수정하세요.",
          "지원금 주제면 본문에 라벨 단어 「기간」「마감」「신청처」「준비물」을 반드시 포함하세요. 소스에 구체 일정이 없으면 '공식 공고에서 확인' 문장으로라도 네 라벨을 남기세요.",
          params.previousArticleDigest?.trim()
            ? `이전 칼럼 요약:\n${params.previousArticleDigest.trim()}`
            : "이전 칼럼 요약 없음 — 확인된 신규 팩트만으로 밀도 있게 갱신하세요.",
          "",
        ]
      : [
          "[전면 재작성 모드]",
          "이전 문장에 얽매이지 말고 오늘 근거로 칼럼 전체를 새로 작성하세요.",
          "지원금 주제면 본문에 라벨 단어 「기간」「마감」「신청처」「준비물」을 빠짐없이 명시하세요. ❸ 또는 ❹에 네 항목을 한 문단으로 모으되, 확인되지 않은 날짜·금액은 지어내지 말고 공식 공고 확인으로 적으세요.",
          "",
        ]),
    "[KinDex 관심 신호 — 산출 공식 강의 금지. 숫자가 보여주는 관심·화제 트렌드(방향·속도·상대 위치)를 ❺ 한 문단에서 해석]",
    params.kindexSignals?.trim() ||
      "별도 수치 블록 없음 — RAG·연관 키워드만으로 작성하세요.",
    "",
    "[최신 뉴스 데이터 (RAG Context) — 1차 근거]",
    params.newsContext?.trim() ||
      "수집된 뉴스 데이터가 없습니다. 확인된 일정·공개 사실만 밀도 있게 작성하세요.",
    "",
    "[작성 지시 — 하이브리드 80/20 · 섹션]",
    `- "${focusCore}"에 대해 완전한 JSON을 한 번에 작성하세요.`,
    "- 밀도(Why·How·표·전망·SEO)는 ≈80%, 독창 해석은 ≈20%로 다섯 섹션에 녹이세요.",
    "- sections heading 순서(번호 필수):",
    `  1) ❶ ${HYBRID_FIXED_HEADINGS.conclusion}`,
    `  2) ❷ ${HYBRID_FIXED_HEADINGS.whyNow}`,
    `  3) ❸ ${readerHeading} (권장 예시일 뿐 — 포커스 키워드·사업명을 넣어 새로 지을 것 / "${HYBRID_LEGACY_READER_HEADING}"·"지원금을 신청하는 방법" 금지)`,
    `  4) ❹ ${outlookHeading} (권장 예시일 뿐 — 이 사안 고유 일정·변수로 새로 지을 것 / "${HYBRID_LEGACY_OUTLOOK_HEADING}"·"다음 모집·쿠폰 일정을 확인하는 법" 금지)`,
    `  5) ❺ ${HYBRID_FIXED_HEADINGS.kindexFeature} (고정 제목 · paragraphs 정확히 1개 · takeaways/핵심 요약 직전)`,
    "- 오늘의 결론: 오늘 뉴스와 KinDex 데이터에서 가장 중요한 변화와 의미",
    "- 왜 지금 관심이 높아졌나: 사건·뉴스·사회적 맥락 분석",
    "- 3번 섹션: 실제 독자 관점의 실질 핵심 (소제목·본문 모두 이 키워드 고유 정보)",
    "- 4번 섹션: 뉴스·데이터 기반의 신중 전망(일정·변수·확인 포인트, 공통 템플릿 소제목 금지)",
    "- 5번 섹션: KinDex 순위·변동을 ❶~❹의 신청·일정·정책 축과 연결해 한 문단으로 해석 (개념 정의·순위 나열 템플릿 금지)",
    `- 5번 섹션에 면책 문구(${TREND_ANALYSIS_DISCLAIMER})를 넣지 마세요. 면책은 ❹ 마지막 문장으로만.`,
    "- KinDex 산출 방식·점수 척도 강의 금지. 있는 숫자는 ❺에서 본문 스토리와 함께 관심 트렌드로 해석.",
    "- ❶~❹ paragraphs 3~4개(각 문단 2~4문장). ❺ paragraphs 1개. 문장 45~90자, 단문 연속·한 문장 문단 연달아 쓰기 금지. 높임말(합니다체) 필수.",
    `- 포커스 핵심어 "${focusCore}"를 title·excerpt·본문·FAQ 합쳐 5~6회만 자연 배치하세요. 짧은 핵심어(2~3글자)라도 7회를 넘기지 마세요.`,
    "- table caption은 '팩트 체크' 또는 '핵심 팩트 요약'. FAQ 3개+. takeaways 3개(높임말) — 화면의 「핵심 요약」.",
    "- 같은 주장을 문장만 바꿔 반복하지 마세요. 팩트는 한 번만 쓰고 다음 문장은 해석·함의로 이어가세요.",
    "- 확인되지 않은 사건·수치를 지어내지 마세요.",
    "- 본문에 AdSense/SEO/글자 수 메타 문구를 절대 넣지 마세요.",
    "- 보드 의미·동음이의어 금지 규칙이 있으면 그 해석을 최우선으로 지키세요.",
    "- 지원금·보조금·바우처·보증 주제면 「기간」「마감」「신청처」「준비물」 네 라벨을 본문에 반드시 넣으세요.",
  ].join("\n");
}
