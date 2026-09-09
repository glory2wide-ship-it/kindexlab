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
    "1. 키워드 단독 매칭 오인 차단: 'FLOAT', 'Counter-', '몰아보기', '탈주', '캐슬'처럼 다의어이거나 여러 산업·일상에서 독립적으로 쓰이는 단어가 실시간 검색어에 올랐을 때, 포털 검색 매칭만 믿고 무관한 이종 산업 소식(예: 영화 작품명과 유튜브 구독 이탈 · 웹툰과 아파트 단지 · 패스트푸드 신메뉴 · 조선업 해상 데이터센터)을 하나의 맥락·인과로 묶지 마세요.",
    "2. 독립 단락 분리 및 팩트 서술: 수집 소스 사이에 실질적 연계·인과가 확인되지 않으면 각 산업·사건별 팩트를 독립 단락으로 분리해 객관 요약만 하고, '그래서/때문에/이어져'로 억지 연결하지 마세요. 연계가 없으면 현상 분석(왜 검색·랭킹에 올랐는지)만 짧게 다루세요.",
    "3. 포커스 키워드의 실제 의미·채널 분야와 맞지 않는 기사는 본문·표·FAQ에 인용하지 마세요. 단순 알파벳·부분 문자열 일치만으로는 동일 주제로 취급하지 마세요.",
    "4. 동음이의어 종합 금지: '이중적 의미', '차별화된 의미로 등장', '영화와 구독 탈주를 함께 읽는다'처럼 글자만 같은 두 의미를 한 편의 테마로 엮는 구성은 실패입니다. 보드·작품 의미 하나만 깊게 다루세요.",
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

/**
 * Legacy meta-definition copy (what KinDex *is*), wrongly used as ❺ body.
 * Never publish this as the feature section — it is not keyword-specific data.
 */
export const KINDEX_FEATURE_META_BOILERPLATE =
  "KinDex 관심 신호는 이 이슈로 검색·화제가 모이는 방향과 속도를 가리키며, 산출 공식이 아니라 관심의 상대 위치로 읽습니다.";

/**
 * Strip only numbering prefixes (❶ / "1. " / "2) ").
 * Never strip content digits such as 100만 · 2026년 · 1위.
 */
export function stripNumberedHeadingPrefix(heading: string): string {
  return heading
    .replace(/^#{1,6}\s*/, "")
    .replace(/^[❶❷❸❹❺❻❼❽❾]\s*/, "")
    // Ordinal markers only: 1. / 2) / 10. — not "100만" or "2026년".
    .replace(/^(?:[1-9]|1[0-2])[.)]\s+/, "")
    .trim();
}

/** Strip numbered H2 prefixes so heading matching stays stable. */
export function scrubSectionHeadingNoise(heading: string): string {
  return stripNumberedHeadingPrefix(heading).replace(/\.$/, "").trim();
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
 * True when ❺ only defines KinDex generally, without this keyword's rank/trend.
 * Empty strings are unusable for placement, but callers that only want to detect
 * the legacy meta sentence should prefer `isKindexFeatureMetaDefinition`.
 */
export function isKindexFeatureMetaDefinition(text: string): boolean {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return false;
  if (t === KINDEX_FEATURE_META_BOILERPLATE) return true;
  if (t.includes("KinDex 관심 신호는 이 이슈로 검색·화제가 모이는")) return true;
  if (t.includes("산출 공식이 아니라 관심의 상대 위치로 읽습니다")) return true;
  const explainsKinDex =
    /KinDex\s*(관심\s*)?(신호|데이터)는/.test(t) &&
    /(방향과\s*속도|상대\s*위치|산출\s*공식)/.test(t);
  const hasConcreteSignal =
    /\d+\s*위/.test(t) ||
    /(올랐|내렸|급등|급락|상위권|하위권|횡보|머물|변동|관심도|검색·신청|스냅샷)/.test(t);
  return explainsKinDex && !hasConcreteSignal;
}

/** Empty or meta-definition — not a publishable ❺ body. */
export function isKindexFeatureMetaBoilerplate(text: string): boolean {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return true;
  return isKindexFeatureMetaDefinition(t);
}

/**
 * True when ❺ is the old deterministic rank-glue template
 * (fact sentences + fixed closer), not editorial interpretation.
 */
export function isKindexFeatureRankTemplate(text: string): boolean {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return false;
  if (/종합하면\s+.+\s+관심은\s+보드\s*안\s+상대\s*순위[·・]?움직임으로\s*읽습니다/.test(t)) {
    return true;
  }
  if (/이\s*숫자는\s+.+\s+관심이\s*모이는\s*상대\s*위치와\s*속도를\s*보여\s*줍니다/.test(t)) {
    return true;
  }
  if (/같은\s*보드에서\s*확인된\s*순위[·・]?변동\s*신호가\s*제한적이어서/.test(t)) {
    return true;
  }
  const hasRankStack =
    /해당\s*히트맵에서\s*\d+\s*위에\s*있습니다/.test(t) &&
    /(직전\s*대비\s*순위\s*변동|직전\s*\d+\s*위에서)/.test(t);
  const hasEditorialBridge =
    /(신청|자격|모집|일정|정책|지원|관심의\s*축|흐름으로|해석하면|읽히|의미|본문에서|앞서\s*다룬|❶|❷|❸|❹)/.test(
      t,
    );
  return hasRankStack && !hasEditorialBridge;
}

/** Empty, meta-definition, or rank-glue template — replace before publish. */
export function isUnusableKindexFeatureBody(text: string): boolean {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return true;
  return isKindexFeatureMetaDefinition(t) || isKindexFeatureRankTemplate(t);
}

function toHonorificSignalClause(raw: string): string {
  let text = raw.replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (!/[.!?…]$/u.test(text)) text = `${text}.`;
  // Already 합니다체 (~습니다 / ~ㅂ니다) — do not touch.
  if (/(습니다|합니다|됩니다|입니다|습니까|입니까|니다)\.?$/u.test(text)) {
    return text.endsWith(".") ? text : `${text}.`;
  }
  text = text
    .replace(/했다\.$/u, "했습니다.")
    .replace(/됐다\.$/u, "됐습니다.")
    .replace(/되었다\.$/u, "되었습니다.")
    .replace(/였다\.$/u, "였습니다.")
    .replace(/올랐다\.$/u, "올랐습니다.")
    .replace(/내렸다\.$/u, "내렸습니다.")
    .replace(/있다\.$/u, "있습니다.")
    .replace(/없다\.$/u, "없습니다.");
  // Do not match the trailing "다." inside already-converted ~습니다/~ㅂ니다.
  if (!/(습니다|합니다|됩니다|입니다|니다)\.?$/u.test(text)) {
    text = text.replace(/(?<![니습합됩입])다\.$/u, "습니다.");
  }
  return text;
}

function subjectParticle(word: string): "이" | "가" {
  const last = word.trim().slice(-1);
  if (!last) return "이";
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return "가";
  return (code - 0xac00) % 28 === 0 ? "가" : "이";
}

function topicParticle(word: string): "은" | "는" {
  const last = word.trim().slice(-1);
  if (!last) return "은";
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return "는";
  return (code - 0xac00) % 28 === 0 ? "는" : "은";
}

/** Pull short story cues from ❶–❹ so fallback ❺ is not rank-only glue. */
export function extractStoryBeatsFromSections(
  sections: Array<{ heading: string; paragraphs: string[] }>,
): string[] {
  const beats: string[] = [];
  for (const section of sections) {
    if (isKindexFeatureSectionHeading(section.heading)) continue;
    if (isCoreSummaryHeading(section.heading)) continue;
    const heading = scrubSectionHeadingNoise(section.heading);
    if (heading && !/오늘의\s*결론|왜\s*지금/.test(heading)) {
      beats.push(heading);
    }
    for (const paragraph of section.paragraphs ?? []) {
      const first = paragraph
        .replace(/\s+/g, " ")
        .trim()
        .split(/(?<=[.!?…])\s+/)
        .map((part) => part.trim())
        .find((part) => part.length >= 24);
      if (first) {
        beats.push(first.length > 110 ? `${first.slice(0, 108).replace(/\s+\S*$/, "")}…` : first);
      }
      if (beats.length >= 6) return beats.slice(0, 6);
    }
  }
  return beats.slice(0, 6);
}

function pickStoryTheme(storyBeats: string[]): string {
  const blob = storyBeats.join(" ");
  const themes: Array<{ re: RegExp; label: string; weight: number }> = [
    { re: /영화|개봉|박스오피스|관객|배우|감독|OTT|극장|스크린/, label: "영화 흥행·편성·플랫폼 일정", weight: 3 },
    { re: /관광|여행|휴양|웰니스|클러스터|특화|치유/, label: "관광·휴양 정책과 현장 일정", weight: 3 },
    { re: /신청|자격|모집|접수|지원금|쿠폰/, label: "신청·자격·모집 일정", weight: 2 },
    { re: /공연|축제|티켓|예매|관람/, label: "공연·축제 일정과 예매", weight: 2 },
    { re: /투자|주가|공시|실적/, label: "투자·공시 이슈", weight: 2 },
    { re: /채용|취업|자격증/, label: "채용·자격 이슈", weight: 2 },
    { re: /웹툰|연재|회차|만화/, label: "웹툰 연재·독자 반응", weight: 3 },
  ];
  let best: { label: string; score: number } | undefined;
  for (const theme of themes) {
    const hits = blob.match(new RegExp(theme.re.source, "g"))?.length ?? 0;
    if (!hits) continue;
    const score = hits * theme.weight;
    if (!best || score > best.score) best = { label: theme.label, score };
  }
  if (best) return best.label;
  const firstHeading = storyBeats.find((beat) => beat.length <= 40 && !/[.!?…]$/u.test(beat));
  if (firstHeading) return firstHeading;
  return "본문에서 다룬 일정·신청·파급 포인트";
}

function describeRankMotion(facts: string[]): { rankClause: string; motionClause: string } {
  const joined = facts.join(" ");
  const rankMatch = joined.match(/(\d+)\s*위/);
  const rankClause = rankMatch
    ? `히트맵 ${rankMatch[1]}위`
    : /상위권/.test(joined)
      ? "보드 상위권"
      : "보드 안 상대 위치";

  let motionClause = "관심 속도는 확인된 변동 신호로만 가늠합니다";
  if (/정체|변동은\s*없|0\s*%|변동률은\s*0/.test(joined)) {
    motionClause = "직전 대비 순위는 정체라 급등·급락보다 안정 관심으로 읽힙니다";
  } else if (/올랐|상승|급등|\+/.test(joined) && !/내렸|하락|급락/.test(joined)) {
    motionClause = "직전 대비 순위가 올라 관심 속도가 붙은 구간으로 읽힙니다";
  } else if (/내렸|하락|급락/.test(joined)) {
    motionClause = "직전 대비 순위가 내려 관심 분산 여부를 함께 볼 구간입니다";
  }
  return { rankClause, motionClause };
}

/**
 * Build a keyword-specific ❺ paragraph from KinDex signals + ❶–❹ story beats.
 * Never returns meta-definition or rank-only glue templates.
 */
export function buildKindexFeatureParagraph(options: {
  keyword: string;
  signalFacts?: string[];
  storyBeats?: string[];
}): string {
  const keyword = options.keyword.replace(/^\[[^\]]+\]\s*/, "").trim() || "이 이슈";
  const particle = topicParticle(keyword);
  const facts = (options.signalFacts ?? []).map((item) => item.trim()).filter(Boolean);
  const storyBeats = (options.storyBeats ?? []).map((item) => item.trim()).filter(Boolean);
  const theme = pickStoryTheme(storyBeats);
  const { rankClause, motionClause } = describeRankMotion(facts);
  const agencyHint =
    facts.find((fact) => /(검색·신청\s*관심도|지원사업의\s*검색|관심도\s*기준)/.test(fact)) ||
    facts.find(
      (fact) =>
        /(문체부|해수부|산림청|공공\s*지원)/.test(fact) && !/히트맵\s*\d+\s*위/.test(fact),
    );

  const sentences: string[] = [];
  sentences.push(
    `${keyword}${particle} KinDex ${rankClause}에 있으며, ${motionClause}.`,
  );
  if (agencyHint) {
    sentences.push(toHonorificSignalClause(agencyHint));
  }
  sentences.push(
    `앞서 본문의 ${theme}${subjectParticle(theme)} 관심의 축인 만큼, 숫자만 나열하기보다 ‘보드 안 상대 위치’로 ${keyword} 흐름을 읽는 편이 맞습니다.`,
  );

  return sentences
    .map((item) => toHonorificSignalClause(item))
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveKindexParagraph(
  candidate: string | undefined,
  fallback: string,
): string {
  const cleaned = candidate?.replace(/\s+/g, " ").trim() ?? "";
  if (!cleaned || isUnusableKindexFeatureBody(cleaned)) return fallback;
  return cleaned;
}

/**
 * Force one numbered「KinDex 데이터가 보여주는 특징」section (single paragraph)
 * immediately before「핵심 요약」, after all other body sections.
 */
export function ensureKindexFeatureSectionPlacement<
  T extends { heading: string; paragraphs: string[]; headingLevel?: 2 | 3 },
>(
  sections: T[],
  options?: {
    fallbackParagraph?: string;
    keyword?: string;
    signalFacts?: string[];
    storyBeats?: string[];
  },
): T[] {
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
        paragraphs: [merged || ""],
      } as T;
      continue;
    }
    body.push(section);
  }

  const storyBeats =
    options?.storyBeats?.length
      ? options.storyBeats
      : extractStoryBeatsFromSections(body);
  const fallback =
    options?.fallbackParagraph?.trim() ||
    buildKindexFeatureParagraph({
      keyword: options?.keyword ?? "",
      signalFacts: options?.signalFacts,
      storyBeats,
    });

  if (!kindex) {
    kindex = {
      heading: KINDEX_FEATURE_SECTION_HEADING,
      headingLevel: 2 as const,
      paragraphs: [fallback],
    } as T;
  } else {
    const bodyText = kindex.paragraphs.map((item) => item.trim()).filter(Boolean).join(" ").trim();
    kindex = {
      ...kindex,
      paragraphs: [resolveKindexParagraph(bodyText, fallback)],
    };
  }

  return [...body, kindex, ...summary];
}

/**
 * Guarantee ≥5 body sections for Today's Analysis / briefing gates.
 * Always places KinDex ❺, then fills missing Why/How/outlook stubs from signal copy.
 */
export function ensureMinBodySections<
  T extends { heading: string; paragraphs: string[]; headingLevel?: 2 | 3 },
>(
  sections: T[],
  options: {
    keyword: string;
    signalFacts?: string[];
    minSections?: number;
  },
): T[] {
  const minSections = options.minSections ?? 5;
  const keyword = options.keyword.trim() || "이 이슈";
  const facts = (options.signalFacts ?? []).map((item) => item.trim()).filter(Boolean);
  let next = ensureKindexFeatureSectionPlacement(sections, {
    keyword,
    signalFacts: facts,
  });

  const stubTemplates: Array<{ heading: string; paragraph: string }> = [
    {
      heading: `${keyword} 핵심 사건·팩트 맥락`,
      paragraph:
        facts[0] ||
        `${keyword}에 대한 관심이 다시 모이며, 확인된 일정과 공개 반응을 중심으로 흐름을 정리합니다.`,
    },
    {
      heading: `왜 지금 ${keyword}에 관심이 모이는지`,
      paragraph:
        facts[1] ||
        `${keyword} 검색·조회 신호가 단기 변동을 보이며, 관련 일정과 미디어 노출이 겹친 영향으로 읽힙니다.`,
    },
    {
      heading: `독자가 ${keyword}에서 확인할 포인트`,
      paragraph:
        facts[2] ||
        `${keyword} 관련 공식 안내와 일정, 비교 키워드를 함께 보면 과장된 해석을 줄일 수 있습니다.`,
    },
    {
      heading: `${keyword} 전망과 파급`,
      paragraph:
        facts[3] ||
        `${keyword}는 후속 발표·편성·신청 창이 열릴 때 다시 반응이 커질 수 있어, 확인된 일정만 추적하는 편이 안전합니다.`,
    },
  ];

  const nonSummary = () =>
    next.filter((section) => !isCoreSummaryHeading(section.heading));

  let guard = 0;
  while (nonSummary().length < minSections && guard < stubTemplates.length) {
    const stub = stubTemplates[guard++]!;
    if (next.some((section) => scrubSectionHeadingNoise(section.heading) === scrubSectionHeadingNoise(stub.heading))) {
      continue;
    }
    const kindexIndex = next.findIndex((section) => isKindexFeatureSectionHeading(section.heading));
    const insertAt = kindexIndex >= 0 ? kindexIndex : next.length;
    const node = {
      heading: stub.heading,
      headingLevel: 2 as const,
      paragraphs: [stub.paragraph.endsWith(".") ? stub.paragraph : `${stub.paragraph}.`],
    } as T;
    next = [...next.slice(0, insertAt), node, ...next.slice(insertAt)];
    next = ensureKindexFeatureSectionPlacement(next, { keyword, signalFacts: facts });
  }

  return next;
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
    "[❺ 금지 — 메타 정의·순위 나열 템플릿]",
    "- KinDex가 무엇인지 설명하는 일반론(예: '관심 신호는 … 방향과 속도를 가리키며, 산출 공식이 아니라…')만 쓰는 것은 실패다.",
    "- 순위·정체 팩트만 이어 붙인 뒤 '종합하면 보드 안 상대 순위·움직임으로 읽습니다'로 끝내는 템플릿도 실패다.",
    "- 포커스 키워드의 순위·변동과 함께, 본문 ❶~❹에서 다룬 신청·일정·정책 축을 한 문단에 연결한다.",
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
