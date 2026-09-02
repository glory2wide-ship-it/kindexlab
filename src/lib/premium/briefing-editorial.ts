import { isSparseContext, type PremiumContext } from "@/lib/premium/context";
import type { PostChannel } from "@/lib/posts/types";
import type { BriefingArticle } from "@/lib/types";

/** Briefing columns with thin retrieval can publish shorter than premium SEO posts. */
export const BRIEFING_SHORTS_MIN_CHARS = 700;
export const BRIEFING_SPARSE_MIN_CHARS = 1_400;
export const BRIEFING_FULL_MIN_CHARS = 1_800;
export const BRIEFING_SECTION_TARGET_SHORTS = 2;
export const BRIEFING_SECTION_TARGET_SPARSE = 3;
export const BRIEFING_SECTION_TARGET_FULL = 3;

export type BriefingGenerationMode = "full" | "sparse" | "shorts";

const CHANNEL_EDITOR_PERSONA: Record<PostChannel, string> = {
  entertainment:
    "당신은 트렌드를 예리하게 읽고 자연스러운 문장으로 풀어내는 10년 차 엔터테인먼트 전문 웹진 에디터입니다.",
  politics:
    "당신은 트렌드를 예리하게 분석하고 자연스러운 문장으로 풀어내는 10년 차 정치 전문 웹진 에디터입니다.",
  economy:
    "당신은 트렌드를 예리하게 분석하고 자연스러운 문장으로 풀어내는 10년 차 경제 전문 웹진 에디터입니다.",
  culture:
    "당신은 트렌드를 예리하게 읽고 자연스러운 문장으로 풀어내는 10년 차 문화·생활 전문 웹진 에디터입니다.",
  travel:
    "당신은 트렌드를 예리하게 읽고 자연스러운 문장으로 풀어내는 10년 차 여행·맛집 전문 웹진 에디터입니다.",
};

const CATEGORY_HINT: Record<string, RegExp> = {
  webtoon: /웹툰|연재|회차|작가|네이버웹툰|카카오웹툰/i,
  kpop: /음원|아이돌|KPOP|팬덤|신보|컴백|뮤직|차트/i,
  music_chart: /음원|아이돌|KPOP|팬덤|신보|컴백|뮤직|차트/i,
  tv_show: /방송|드라마|예고|본방|시청|출연|편성/i,
  tv_rating: /방송|드라마|예고|본방|시청|시청률/i,
  mobile_game: /게임|플레이|시즌|패치|모바일/i,
  pc_game: /게임|플레이|시즌|패치|PC|스팀/i,
  console_game: /게임|플레이|시즌|패치|콘솔/i,
  influencer: /유튜브|숏폼|채널|크리에이터|구독/i,
  shorts: /숏폼|쇼츠|클립|틱톡/i,
  celebrity: /셀럽|연예인|배우|가수|화보|행사/i,
};

function categoryPattern(category?: string): RegExp | undefined {
  if (!category) return undefined;
  return CATEGORY_HINT[category] ?? undefined;
}

function keywordMatchesCategory(keyword: string, category?: string): boolean {
  const pattern = categoryPattern(category);
  if (!pattern) return true;
  return pattern.test(keyword);
}

/**
 * Drops cross-category peers (e.g. webtoon + idol) so the model is not asked to
 * stitch unrelated trends into one narrative.
 */
export function filterBriefingRelatedKeywords(
  focusKeyword: string,
  related: string[] = [],
  category?: string,
): string[] {
  const focus = focusKeyword.trim();
  return related
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => item !== focus)
    .filter((item) => keywordMatchesCategory(item, category))
    .slice(0, 3);
}

export function briefingRelatedKeywords(
  article: BriefingArticle,
  edition: BriefingArticle[],
): string[] {
  const peers = edition.filter((item) => item.slug !== article.slug);
  if (article.kind === "main") {
    return filterBriefingRelatedKeywords(
      article.focusKeyword ?? "",
      peers
        .filter((item) => item.channel === article.channel)
        .map((item) => item.focusKeyword)
        .filter((keyword): keyword is string => Boolean(keyword?.trim())),
      article.category,
    );
  }
  const sameDesk = peers.filter(
    (item) =>
      item.kind === "deep-dive" &&
      item.channel === article.channel &&
      item.category === article.category,
  );
  return filterBriefingRelatedKeywords(
    article.focusKeyword ?? "",
    sameDesk
      .map((item) => item.focusKeyword)
      .filter((keyword): keyword is string => Boolean(keyword?.trim())),
    article.category,
  );
}

export function resolveChannelEditorPersona(channel?: string): string {
  if (channel && channel in CHANNEL_EDITOR_PERSONA) {
    return CHANNEL_EDITOR_PERSONA[channel as PostChannel];
  }
  return CHANNEL_EDITOR_PERSONA.entertainment;
}

/**
 * Picks full / sparse / shorts from retrieval quality and related-keyword coherence.
 * Shorts is used when data is too thin or unrelated peers were dropped.
 */
export function assessBriefingGenerationMode(opts: {
  context: Pick<PremiumContext, "sources" | "newsThin" | "score" | "signalFacts">;
  relatedRaw: string[];
  relatedFiltered: string[];
}): BriefingGenerationMode {
  const { context, relatedRaw, relatedFiltered } = opts;
  const sources = context.sources.length;
  const signals = context.signalFacts.length;
  const unrelatedDropped = Math.max(0, relatedRaw.length - relatedFiltered.length);
  const heavilyFiltered = relatedRaw.length >= 2 && relatedFiltered.length === 0;
  const veryThin = sources <= 2 || (signals === 0 && sources <= 3);

  if (veryThin || heavilyFiltered || (unrelatedDropped >= 2 && isSparseContext(context))) {
    return "shorts";
  }
  if (isSparseContext(context) || unrelatedDropped > 0) {
    return "sparse";
  }
  return "full";
}

export function briefingSectionTarget(mode: BriefingGenerationMode): number {
  if (mode === "shorts") return BRIEFING_SECTION_TARGET_SHORTS;
  if (mode === "sparse") return BRIEFING_SECTION_TARGET_SPARSE;
  return BRIEFING_SECTION_TARGET_FULL;
}

export function briefingMinChars(mode: BriefingGenerationMode): number {
  if (mode === "shorts") return BRIEFING_SHORTS_MIN_CHARS;
  if (mode === "sparse") return BRIEFING_SPARSE_MIN_CHARS;
  return BRIEFING_FULL_MIN_CHARS;
}

/** Shorts mode: fact-only brief when sources are thin or keywords do not cohere. */
export function buildShortsModePrompt(): string {
  return [
    "[단신(Shorts) 요약 모드]",
    "수집 데이터가 빈약하거나 서로 연관 없는 키워드가 섞여 있습니다.",
    "- 억지로 길게 쓰지 말고 짧고 팩트 위주로만 작성하세요.",
    "- 확인된 사실만 쓰고, 추측·일반론·체크리스트·인사말·마무리 요약은 금지입니다.",
    "- 연관성이 떨어지는 소재는 억지로 엮지 말고 독립 단락으로 분리하세요.",
    "- 분량 목표: 공백 제외 700~1,100자. 짧아도 됩니다.",
    "",
    "[시제·노이즈·마침표] 뉴스 발행일 기준 과거형은 과거형만. 연도가 다르면 시간순. 접두어만으로 무관 기사를 묶지 마세요. 모든 문장 끝에 마침표(.) 필수.",
  ].join("\n");
}

/** Sparse-data prompt: trend phenomenon analysis, not padding or checklists. */
export function buildBriefingSparsePrompt(): string {
  return [
    "[데이터 부족 모드 — 브리핑 전용]",
    "수집된 기사에 작품 줄거리·사건 내막 같은 구체 정보가 없습니다.",
    "- 억지로 지어내거나 분량을 채우지 마세요.",
    "- '독자 체크리스트', '확인해야 할 N가지', '실행 팁' 같은 일반론 섹션은 쓰지 마세요.",
    "- 대신 '왜 지금 검색·랭킹에 올랐는지' 그 현상 자체(포털 알고리즘, 동시간대 검색어 겹침, 카테고리 노출 구조)를 팩트 기반으로 짧고 선명하게 분석하세요.",
    "- 확인되지 않은 수치·날짜·기관명·인물 연관은 단정하지 말고 '확인되지 않았다'고 적으세요.",
    "- 분량은 짧아도 됩니다. 밀도 있는 1,400자가 빈 2,000자보다 낫습니다.",
    "",
    "[시제·노이즈·마침표] 뉴스 발행일 기준 과거형은 과거형만. 연도가 다르면 시간순. 접두어만으로 무관 기사를 묶지 마세요. 모든 문장 끝에 마침표(.) 필수.",
  ].join("\n");
}

export function relatedKeywordsPromptBlock(related: string[]): string {
  if (!related.length) {
    return "[연관 검색어] 같은 채널·같은 카테고리의 직접 연관 키워드는 없습니다. 무관한 인물·작품을 억지로 엮지 마세요.";
  }
  return [
    `[연관 검색어 — 같은 카테고리] ${related.join(", ")}`,
    "위 키워드와 논리적 연관이 없다면 한 문장으로 '같은 시간대 별개 이슈' 정도만 병렬 언급하세요. 인과관계를 만들지 마세요.",
    "접두어·부분 문자열만 겹치는 키워드(예: Counter-)는 같은 주제로 취급하지 마세요.",
  ].join("\n");
}
