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
