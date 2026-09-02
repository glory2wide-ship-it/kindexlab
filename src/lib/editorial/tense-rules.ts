/** Shared tense / timeline rules for briefing and today-analysis generation. */
export function tenseConsistencyRules(): string {
  return [
    "[시제 및 시간 정합성 엄격 준수]",
    "1. 기준 시점 인식: 본문 작성 시 수집된 뉴스 데이터의 개별 발행일(년·월·일)을 최우선 근거로 삼으세요.",
    "2. 시제 일치(과거형 서술): 이미 지난 과거 날짜(예: 2020년, 지난 4월)의 사건이나 종결된 이슈는 반드시 명확한 과거형(~했다, ~전해진 바 있다, ~보도했다)으로 서술하세요. 현재 시점과 혼동해 최근 일처럼 쓰지 마세요.",
    "3. 타임라인 정렬: 서로 다른 시점의 사건(예: 2020년 비교 기사와 2026년 서비스 축소)이 함께 있으면 시간순 흐름에 맞게 배치해 독자가 발생 시기를 오인하지 않게 하세요.",
    "4. 날짜가 확인되지 않으면 '최근'·'곧' 등으로 단정하지 말고, 확인된 시점만 밝히거나 시점을 생략하세요.",
  ].join("\n");
}

/**
 * Blocks forced narratives that stitch unrelated stories via string/prefix match
 * (e.g. "Counter-" linking a game title to tactical-nuke coverage).
 */
export function prefixNoisePreventionRules(): string {
  return [
    "[형태소/접두어 오인(노이즈) 방지]",
    "1. 키워드 매칭 오류 차단: 'Counter-', '몰아보기' 등 단순 문자열·접두어 일치만으로 완전히 다른 분야(예: 게임 이슈와 대북 전술핵 뉴스)의 무관한 기사를 억지로 엮거나 한 묶음으로 다루지 마세요.",
    "2. 팩트 기반 격리: 수집 데이터 사이에 실질적 인과관계·직접적 맥락 연결고리가 확인되지 않으면 억지로 엮지 마세요. 각각 독립 단락으로 분리하거나, 현상 분석(왜 검색·랭킹에 올랐는지)만 짧게 다루세요.",
    "3. 포커스 키워드의 실제 의미·분야와 맞지 않는 기사는 본문·표·FAQ에 인용하지 마세요.",
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

/** Shared blocks injected into system/user prompts for briefing and analysis. */
export function editorialGroundingRules(): string {
  return [
    tenseConsistencyRules(),
    "",
    prefixNoisePreventionRules(),
    "",
    sentencePeriodRules(),
  ].join("\n");
}
