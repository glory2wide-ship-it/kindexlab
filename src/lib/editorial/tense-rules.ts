/** Shared tense / timeline rules for briefing and today-analysis generation. */
export function tenseConsistencyRules(): string {
  return [
    "[시제 및 시간 정합성 엄격 준수 — 위반 시 유효성 검증 실패]",
    "1. 기준 시점 인식: 본문 작성 시 수집된 뉴스 데이터의 개별 발행일(년, 월, 일)을 최우선 근거로 삼으세요. 기사마다 적힌 발행일을 확인하고, 그 날짜 기준으로 서술하세요.",
    "2. 시제 일치(과거형 서술): 이미 지나간 과거 날짜(예: 2016년 미술 전시 등)의 사건이나 종결된 이슈를 다루고 있다면, 반드시 명확한 과거형(~했다, ~개막한 바 있다, ~전해진 바 있다, ~보도했다)으로 서술하세요. 현재 시점과 혼동하여 최근 일처럼 작성하지 마세요.",
    "3. 타임라인 정렬: 서로 다른 시점의 사건이 함께 다뤄질 경우, 시간순 흐름에 맞게 배치하여 독자가 사건 발생 시기를 오인하지 않도록 논리적으로 구성하세요. 먼저 일어난 일 → 나중 일 순으로 섹션·문단을 배열하세요.",
    "4. 날짜가 확인되지 않으면 '최근'·'곧' 등으로 단정하지 말고, 확인된 시점만 밝히거나 시점을 생략하세요.",
    "5. 실패 예(금지): 2016년 전시를 '지금 개막한다', '관심을 모으고 있다'처럼 현재진행으로 쓰기. 성공 예: '2016년 …에서 개막한 바 있다.'",
  ].join("\n");
}

/**
 * Prevents stale retrospective pieces from reading like today's breaking coverage.
 * Pair with an explicit editionDate in the user prompt.
 */
export function editionFreshnessRules(): string {
  return [
    "[에디션 시의성 — 위반 시 유효성 검증 실패]",
    "1. 앵커 날짜: 사용자 메시지의 [에디션 날짜(KST)]가 본문·표·FAQ의 '오늘' 기준입니다. 이 날짜보다 이전인 일정·공연·행사는 절대 '예정', '개최된다', '열린다', '진행 중'으로 쓰지 마세요.",
    "2. 최신 앵글 우선: title·excerpt·❶ 팩트 H2는 RAG에서 에디션 기준 약 14일 이내(표시: 최신/최근)인 사건·보도를 중심으로 잡으세요. 수개월 전 투어 성료·개막만으로 '오늘의 Update 키워드'를 쓰지 마세요.",
    "3. 오래된 팩트는 배경만: 에디션보다 45일 이상 지난 일정(표시: 오래된 배경)은 타임라인 배경 1~2문장으로만 쓰고, Why(❷)는 '왜 오늘 검색·랭킹에 다시 올랐는지' 현재 신호로 설명하세요.",
    "4. 미래/과거 혼동 금지: 에디션 날짜 이후의 일정만 '예정'·미래형. 에디션 이전에 끝난 갈라·폐막·성료는 과거형만.",
    "5. 무관 연관어 금지: 연관 키워드·다른 작품·도서·전시·지원금이 같은 인과가 아니면 억지로 끼워 넣지 마세요. 병렬 언급이 필요하면 '같은 시간대 별개 이슈'로만.",
    "6. 실패 예: 에디션 2026-09-03인데 2025~2026년 초 내한 투어를 현재 화제처럼 쓰고, 이미 지난 8월 갈라를 '개최 예정'으로 표기. 성공 예: 최근 14일 보도·랭킹 신호를 ❶에 두고, 과거 투어는 과거형 배경으로만.",
  ].join("\n");
}

/**
 * Blocks forced narratives that stitch unrelated stories via string/prefix match
 * or ambiguous everyday tokens (e.g. FLOAT, Counter-).
 */
export function prefixNoisePreventionRules(): string {
  return [
    "[이종 산업 키워드 혼선(노이즈) 방지]",
    "1. 키워드 단독 매칭 오인 차단: 'FLOAT', 'Counter-', '몰아보기'처럼 다의어이거나 여러 산업·일상에서 독립적으로 쓰이는 단어가 실시간 검색어에 올랐을 때, 포털 검색 매칭만 믿고 무관한 이종 산업 소식(예: 패스트푸드 신메뉴 · 조선업 해상 데이터센터 · 미술 전시)을 하나의 맥락·인과로 묶지 마세요.",
    "2. 독립 단락 분리 및 팩트 서술: 수집 소스 사이에 실질적 연계·인과가 확인되지 않으면 각 산업·사건별 팩트를 독립 단락으로 분리해 객관 요약만 하고, '그래서/때문에/이어져'로 억지 연결하지 마세요. 연계가 없으면 현상 분석(왜 검색·랭킹에 올랐는지)만 짧게 다루세요.",
    "3. 포커스 키워드의 실제 의미·채널 분야와 맞지 않는 기사는 본문·표·FAQ에 인용하지 마세요. 단순 알파벳·부분 문자열 일치만으로는 동일 주제로 취급하지 마세요.",
  ].join("\n");
}

/** Every declarative sentence must end with a full stop (period). */
export function sentencePeriodRules(): string {
  return [
    "[문장 끝 마침표 필수 적용]",
    "1. 온전한 종결: 모든 문장의 끝(서술어·명사형 종결 포함)에는 예외 없이 마침표(.)를 온전하게 찍으세요. 줄바꿈으로 문장이 끝나도 마지막에는 반드시 마침표를 포함하세요.",
    "2. 띄어쓰기 및 문장 부호 정돈: 문장이 급하게 끊기거나 마침표가 누락된 채 다음 문장과 이어지지 않도록 문맥과 문장 부호를 엄격히 교정해 출력하세요.",
    "3. 의문문은 물음표(?), 감탄은 느낌표(!)로 닫되, 일반 서술·명사형 종결은 마침표(.)만 사용하세요. 종결 부호 없는 문장은 실패로 간주합니다.",
    "4. 실패 예(금지): '화두로 떠올랐다 이슈의 중심에는' → 반드시 '화두로 떠올랐다. 이슈의 중심에는'처럼 문장마다 마침표를 찍으세요.",
  ].join("\n");
}

/** Fixed H2 title for the dedicated KinDex trend-feature section. */
export const KINDEX_FEATURE_SECTION_HEADING = "KinDex 데이터가 보여주는 특징";

const KINDEX_FEATURE_FALLBACK_PARAGRAPH =
  "KinDex 관심 신호는 이 이슈로 검색·화제가 모이는 방향과 속도를 가리키며, 산출 공식이 아니라 관심의 상대 위치로 읽습니다.";

/** Strip numbered H2 prefixes so heading matching stays stable. */
export function scrubSectionHeadingNoise(heading: string): string {
  return heading
    .replace(/^#{1,6}\s*/, "")
    .replace(/^[❶❷❸❹❺❻❼❽❾]\s*/, "")
    .replace(/^\d+[.\s]+/, "")
    .replace(/\.$/, "")
    .trim();
}

export function isKindexFeatureSectionHeading(heading: string): boolean {
  const clean = scrubSectionHeadingNoise(heading);
  return (
    clean === KINDEX_FEATURE_SECTION_HEADING ||
    clean.includes(KINDEX_FEATURE_SECTION_HEADING) ||
    /^KinDex\s*데이터가\s*보여주는/.test(clean)
  );
}

export function isCoreSummaryHeading(heading: string): boolean {
  return scrubSectionHeadingNoise(heading).includes("핵심 요약");
}

/**
 * Force one numbered「KinDex 데이터가 보여주는 특징」section (single paragraph)
 * immediately before「핵심 요약」, after all other body sections.
 */
export function ensureKindexFeatureSectionPlacement<
  T extends { heading: string; paragraphs: string[]; headingLevel?: 2 | 3 },
>(
  sections: T[],
  options?: { fallbackParagraph?: string },
): T[] {
  const fallback = options?.fallbackParagraph?.trim() || KINDEX_FEATURE_FALLBACK_PARAGRAPH;
  const summary: T[] = [];
  const body: T[] = [];
  let kindex: T | undefined;

  for (const section of sections) {
    if (isCoreSummaryHeading(section.heading)) {
      summary.push(section);
      continue;
    }
    if (isKindexFeatureSectionHeading(section.heading)) {
      const merged = [...(kindex?.paragraphs ?? []), ...(section.paragraphs ?? [])]
        .map((item) => item.trim())
        .filter(Boolean)
        .join(" ")
        .trim();
      kindex = {
        ...section,
        ...(kindex ?? {}),
        heading: KINDEX_FEATURE_SECTION_HEADING,
        headingLevel: 2 as const,
        paragraphs: [merged || fallback],
      } as T;
      continue;
    }
    body.push(section);
  }

  if (!kindex) {
    kindex = {
      heading: KINDEX_FEATURE_SECTION_HEADING,
      headingLevel: 2 as const,
      paragraphs: [fallback],
    } as T;
  } else if (!kindex.paragraphs.length || !kindex.paragraphs[0]?.trim()) {
    kindex = { ...kindex, paragraphs: [fallback] };
  } else if (kindex.paragraphs.length > 1) {
    kindex = {
      ...kindex,
      paragraphs: [kindex.paragraphs.map((item) => item.trim()).filter(Boolean).join(" ").trim() || fallback],
    };
  }

  return [...body, kindex, ...summary];
}

/**
 * 모든 글 생성 프롬프트에 넣는 KinDex 숫자 해석 지침.
 * 산출 공식이 아니라, 숫자가 가리키는 관심·화제 트렌드를 해석한다.
 * 전용 번호 소제목 + 한 문단으로「핵심 요약」직전에 둔다.
 */
export function kindexDataTrendInterpretationRules(): string {
  return [
    "KinDex 데이터가 보여주는 특징",
    "[숫자가 의미하는 트렌드 해석]",
    "- 입력에 순위·변동·관심 점수·열기(히트)가 있으면 산출 공식을 설명하지 말고, 그 숫자가 가리키는 관심·화제 트렌드를 해석한다.",
    "- 상승·하락·급등·정체·상대적 관심 쏠림처럼 ‘방향과 속도, 다른 이슈 대비 위치’를 문장으로 풀어 쓴다.",
    "- 점수 산식·100점 만점·999 스케일 강의는 하지 않는다. 숫자는 관심의 세기와 움직임을 읽는 신호로만 쓴다.",
    "- 입력에 없는 수치를 지어내지 않는다. 있는 숫자만 트렌드로 해석한다.",
    "[필수 소제목 배치 — 모든 글]",
    `- 본문 sections에 번호 달린 소제목 \`KinDex 데이터가 보여주는 특징\`을 반드시 둔다 (오늘의 분석·하이브리드는 ❺, 그 외 글은 본문 H2 중 마지막 번호).`,
    "- 이 소제목 그룹의 paragraphs는 정확히 1개(한 문단)만 쓴다. 2개 이상 금지.",
    "- 위치: 글 본문의 마지막 소주제이며, takeaways가 되는 \`핵심 요약\` 바로 앞에 온다.",
    "- 다른 섹션(결론·Why·How·전망)에는 KinDex 숫자 해석을 길게 반복하지 말고, 이 소제목 한 문단에 모은다.",
  ].join("\n");
}

/** Shared blocks injected into system/user prompts for briefing and analysis. */
export function editorialGroundingRules(): string {
  return [
    tenseConsistencyRules(),
    "",
    editionFreshnessRules(),
    "",
    prefixNoisePreventionRules(),
    "",
    sentencePeriodRules(),
    "",
    kindexDataTrendInterpretationRules(),
    "",
    // Lazy require avoided — import at call sites that already pull honorific rules,
    // and keep this file free of cycles by inlining the essential honorific mandate.
    "[높임말(합니다체) 필수 — 모든 글]",
    "- 본문·요약·FAQ·takeaways 서술 문장은 ~습니다/~합니다/~됩니다/~있습니다/~없습니다로 끝내세요.",
    "- 해라체·한다체(~다/~한다/~이다/~했다/~된다) 문장 종결 금지.",
  ].join("\n");
}
