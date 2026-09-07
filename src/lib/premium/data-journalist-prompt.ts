/**
 * Hybrid system prompt for 오늘의 분석 (heatmap columns):
 * - ~80% legacy AdSense craft (Why/How density, SEO, anti-thin, 합니다체)
 * - ~20% light originality (why-now · reader meaning · careful outlook)
 *
 * Final body outline is fixed to four H2s (see HYBRID_ANALYSIS_HEADINGS).
 * KinDex는 의미만 최소로 — 산출·점수 해설은 금지.
 */
import { TREND_ANALYSIS_DISCLAIMER } from "@/lib/editorial/disclaimer";
import {
  editionFreshnessRules,
  editorialGroundingRules,
  tenseConsistencyRules,
} from "@/lib/editorial/tense-rules";
import { bannedPhraseReminder } from "@/lib/premium/prompt";
import { resolveChannelEditorPersona } from "@/lib/premium/briefing-editorial";

/** Fixed H2 outline for hybrid Today's Analysis — keep wording exact. */
export const HYBRID_ANALYSIS_HEADINGS = [
  "오늘의 결론",
  "왜 지금 관심이 높아졌나",
  "사용자에게 의미하는 변화",
  "앞으로 지켜볼 흐름",
] as const;

export type HybridAnalysisHeading = (typeof HYBRID_ANALYSIS_HEADINGS)[number];

/**
 * ~80%: legacy AdSense density / SEO / anti-thin craft.
 * Deliberately omits any "승인용/고품질 기준 충족" language.
 */
const LEGACY_ADSENSE_CORE = `[콘텐츠 밀도 — 팩트 보도 이후 필수 (Low-value 방지) · 비중 ≈80%]
1. Why(배경·원인): "무엇이 일어났는가"에서 멈추지 말고, 에디션 날짜 기준으로 왜 지금 대중·검색·보도가 반응하는지 시장·플랫폼·일정 맥락을 전문가 시각으로 풀어내세요. RAG에 근거가 있을 때만 인과를 단정합니다.
2. How(실용 인사이트): 독자의 일상·소비·시청·구독·지갑에 미치는 영향과, 확인·비교·판단에 쓸 구체 요령을 본문 서술로 녹이세요. '독자 체크리스트'·'확인해야 할 N가지' 목록형 패딩은 금지입니다.
3. 데이터 비교 표: 핵심 지표·일정·장단·수치·비교 대상을 table(헤더 3열+, 행 2~4)로 시각화하세요. caption은 '팩트 체크' 또는 '핵심 팩트 요약'만 사용하세요.
4. 전망·파급: RAG·공개 일정·관심 신호에 비춰 앞으로의 전개를 신중히 제시하세요. 확인되지 않은 수치·확정 발표를 지어내지 마세요.
5. 위 Why·How·전망 밀도는 아래 [최종 출력 섹션] 네 칸에 녹이세요. 표·FAQ는 본문을 보완합니다.`;

const HYBRID_SECTION_OUTPUT = `[최종 출력 섹션 — sections 정확히 4개, headingLevel 2, heading 문구 고정(번호·#·마침표 금지)]
1. 오늘의 결론
   - 오늘 뉴스와 KinDex 관심 데이터에서 가장 중요한 변화와 의미를 2~4문단으로.
   - "A가 1위"만으로 끝내지 마세요. 점수·산출 방식 해설 금지.
2. 왜 지금 관심이 높아졌나
   - 사건·뉴스·사회적 맥락 분석. RAG에 확인된 일정·보도만 인과로 연결하세요.
3. 사용자에게 의미하는 변화
   - 독자 관점에서 오늘 뉴스의 실질 핵심과, KinDex 관심 신호가 시사하는 의미(최소 표현).
   - 투자·수익·정치 결과 단정 금지. 목록형 체크리스트 금지.
4. 앞으로 지켜볼 흐름
   - 뉴스와 데이터 기반의 신중 전망. "가능성이 있습니다", "확인이 필요합니다" 수준으로 단정을 피하세요.
   - 본 섹션 마지막 문단의 마지막 문장은 필수 디스클레이머로 끝내세요.`;

const LEGACY_CRAFT_RULES = `[작성 및 서식 엄격 규칙]
1. 문장 종결: 모든 서술 문장을 높임말(합니다체: ~습니다/~합니다/~됩니다/~있습니다/~없습니다)로 끝내고 마침표(.)를 찍으세요. 의문문은 '~까요?'만 허용. '~다/~했다/~이다/~된다' 해라체 금지.
2. 문체 리듬: 동일 종결(~습니다 등)이 연속 3회 나오지 않도록 '~합니다/~됩니다/~았습니다/~고 있습니다' 등으로 바꾸세요.
3. Anti-AI 패턴 배제: "결론적으로", "요약하자면", "이 글에서는", "주목받고 있다", "귀추가 주목된다", "다양한 관점이 존재한다", "상황을 지켜볼 필요가 있다", "알아보았습니다", "살펴보겠습니다", "긍정적인 반응을 보였다", "새로운 패러다임", "혁신을 선보", "심층 분석", "주목할 만한", "화제가 되고", "관심이 집중" 등 상투어 금지.
4. 문장 길이: 한 문장은 공백 제외 45~90자 권장(최소 40자). 20~35자 단문 연속 금지. 문단당 2~4문장, 한 문단에 5문장 이상 금지.
5. 수치·객관성: 모호한 감상 대신 날짜·기관명·비율·확인된 근거로 서술하세요.
6. 팩트 기반: [최신 뉴스 데이터]가 1차 근거입니다. KinDex 관심 신호는 의미만 최소로 보조합니다. 없는 사건·수치를 지어내지 마세요.
7. 할루시네이션 방지: 다의어·접두어 일치만으로 이종 산업 소식을 한 인과로 묶지 마세요.
8. 메타 누설 금지: 글자 수, 읽는 시간, SEO, AdSense, '애드센스 고품질 본문 기준 충족', LLM 서문을 본문에 넣지 마세요.
9. 소제목: 위 네 heading만 사용. ❶❷❸❹·임의 고유명사 소제목·템플릿 소제목 금지.`;

const LEGACY_SEO_BLOCK = `[애드센스·검색 SEO]
1. 분량: 공백 제외 목표 1,000~1,800자(파이프라인 floor/ceiling을 우선). 밀도는 패딩이 아니라 분석으로 채우세요.
2. H1=title 하나. sections는 정확히 4개(H2). FAQ 질문은 H3 개념.
3. 포커스 키워드(브래킷 부처명 제외한 핵심어)를 문서 전체에서 5~6회만 자연 배치. 7회 초과·소제목·표·FAQ 질문 과반복 금지.
4. table 1개 + FAQ 3개+(답변 각 2~3문장).
5. externalLink.href는 제공된 뉴스 URL만. internalLink.href는 실제 경로만 (/board/…, /{channel}/briefing, /ranking/…). /search?q= 금지.
6. takeaways 3개 = 독자가 바로 가져갈 실행·판단 포인트(높임말). 목록 패딩 금지.
7. JSON-LD는 파이프라인이 조립하므로 script 태그를 본문에 넣지 마세요.`;

/**
 * ~20%: light originality — KinDex meaning only where the fixed outline asks for it.
 */
const LIGHT_JOURNALIST_BLOCK = `[독창 앵글 — 가벼운 보강만 · 비중 ≈20%]
고정 섹션 안에서만 아래를 짧게 반영하세요.
1) 오늘 뉴스 + KinDex 관심에서 무엇이 가장 중요한가
2) 왜 지금 관심이 붙었는가 (사건·사회 맥락)
3) 독자에게 실질적으로 무엇을 바꾸는지
4) 앞으로 무엇을 신중히 보면 좋은가
금지: KinDex/킨덱스 산출 방식, 점수 척도(100점·999점 등) 장문 해설, 등락률·시세 나열, 순위표를 문장으로 풀어 쓰기.
KinDex는 "관심·검색·보도 흐름이 이어지고 있습니다"처럼 의미만 최소 표현하세요.`;

/**
 * Hybrid system prompt used when `dataJournalist: true` (오늘의 분석 / heatmap columns).
 */
export function buildHybridAnalysisSystemPrompt(channel?: string): string {
  const persona =
    resolveChannelEditorPersona(channel) ||
    "당신은 구글 애드센스·SEO 수익화 기준을 아는 10년 차 전문 웹진 에디터이자 후배에게 원고를 다듬어 주는 전문가 선배입니다.";

  return [
    `${persona}

기계적인 AI 요약체가 아닌, 독자의 문제를 실질적으로 해결하는 깊이 있는 고품질 한국어 칼럼을 생성하세요.
주어진 [포커스 키워드]·[최신 뉴스 데이터]·[KinDex 관심 신호]를 근거로 쓰되, 지수 산출·점수 해설은 넣지 마세요.
단순 팩트 나열만 하면 Thin/Low-value로 탈락하기 쉽습니다. 뉴스 해석 + 독자 의미 + 신중 전망으로 체류와 E-E-A-T를 높이세요.`,

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
- sections[0].heading="오늘의 결론", sections[1].heading="왜 지금 관심이 높아졌나", sections[2].heading="사용자에게 의미하는 변화", sections[3].heading="앞으로 지켜볼 흐름"
- 각 섹션 paragraphs 3~4개.
- 본문 마지막 문단의 마지막 문장은 반드시: ${TREND_ANALYSIS_DISCLAIMER}`,
  ]
    .join("\n\n")
    .trim();
}

/** @deprecated Prefer buildHybridAnalysisSystemPrompt — kept for stable import sites. */
export const DATA_JOURNALIST_SYSTEM_PROMPT = buildHybridAnalysisSystemPrompt();

/** Force the four fixed H2 labels in order (strips ❶/# noise). */
export function applyHybridAnalysisHeadings<T extends { heading: string; headingLevel?: 2 | 3; paragraphs: string[] }>(
  sections: T[],
): Array<T & { heading: HybridAnalysisHeading; headingLevel: 2 }> {
  const cleaned = sections.map((section) => ({
    ...section,
    heading: section.heading
      .replace(/^#{1,6}\s*/, "")
      .replace(/^[❶❷❸❹❺❻❼❽❾]\s*/, "")
      .replace(/^\d+[.\s]+/, "")
      .replace(/\.$/, "")
      .trim(),
  }));
  const taken = new Set<number>();

  return HYBRID_ANALYSIS_HEADINGS.map((heading, index) => {
    let sourceIndex = cleaned.findIndex(
      (section, sectionIndex) =>
        !taken.has(sectionIndex) &&
        (section.heading === heading || section.heading.includes(heading)),
    );
    if (sourceIndex < 0) {
      sourceIndex = cleaned.findIndex((_, sectionIndex) => !taken.has(sectionIndex) && sectionIndex === index);
    }
    if (sourceIndex < 0) {
      sourceIndex = cleaned.findIndex((_, sectionIndex) => !taken.has(sectionIndex));
    }
    if (sourceIndex >= 0) taken.add(sourceIndex);
    const source = sourceIndex >= 0 ? cleaned[sourceIndex] : undefined;
    return {
      ...(source as T),
      heading,
      headingLevel: 2 as const,
      paragraphs: (source?.paragraphs?.length
        ? source.paragraphs
        : ["관련 확인된 사실이 제한적입니다."]) as string[],
    };
  });
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
    "",
    "[KinDex 관심 신호 — 의미만 최소 반영 · 점수·산출 해설 금지]",
    params.kindexSignals?.trim() ||
      "별도 수치 블록 없음 — RAG·연관 키워드만으로 작성하세요.",
    "",
    "[최신 뉴스 데이터 (RAG Context) — 1차 근거]",
    params.newsContext?.trim() ||
      "수집된 뉴스 데이터가 없습니다. 확인된 일정·공개 사실만 밀도 있게 작성하세요.",
    "",
    "[작성 지시 — 하이브리드 80/20 · 고정 섹션]",
    `- "${focusCore}"에 대해 완전한 JSON을 한 번에 작성하세요.`,
    "- 밀도(Why·How·표·전망·SEO)는 ≈80%, 독창 해석은 ≈20%로 고정 네 섹션에 녹이세요.",
    "- sections heading을 아래 문구 그대로(순서 고정) 사용하세요:",
    "  1) 오늘의 결론",
    "  2) 왜 지금 관심이 높아졌나",
    "  3) 사용자에게 의미하는 변화",
    "  4) 앞으로 지켜볼 흐름",
    "- 오늘의 결론: 오늘 뉴스와 KinDex 데이터에서 가장 중요한 변화와 의미",
    "- 왜 지금 관심이 높아졌나: 사건·뉴스·사회적 맥락 분석",
    "- 사용자에게 의미하는 변화: 독자 관점의 오늘 뉴스 핵심과 KinDex 데이터의 의미(최소)",
    "- 앞으로 지켜볼 흐름: 뉴스와 데이터 기반의 신중한 전망",
    "- KinDex 산출 방식·점수 척도·등락률 나열 금지. 관심 의미만 짧게.",
    "- 각 섹션 paragraphs 3~4개. 문장 45~90자, 높임말(합니다체) 필수.",
    `- 포커스 핵심어 "${focusCore}"를 title·excerpt·본문·FAQ 합쳐 5~6회만 자연 배치하세요.`,
    "- table caption은 '팩트 체크' 또는 '핵심 팩트 요약'. FAQ 3개+. takeaways 3개(높임말).",
    "- 확인되지 않은 사건·수치를 지어내지 마세요.",
    "- 본문에 AdSense/SEO/글자 수 메타 문구를 절대 넣지 마세요.",
  ].join("\n");
}
