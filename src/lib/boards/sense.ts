import { boardSlugFromEntitySlug } from "@/lib/analysis/briefing-boards";
import { getBoard } from "@/lib/boards/registry";

/**
 * Board-sense disambiguation for heatmap / briefing keywords.
 *
 * Ambiguous bare names (코스모스, 원피스, 애플 …) retrieve the wrong news cluster
 * unless RAG queries, prompts, and a post-generate gate lock the board's unit
 * meaning (도서 · 종목 · 영화 · 공연 …).
 */

export interface BoardSense {
  boardSlug: string;
  boardTitle: string;
  shortTitle: string;
  unitLabel: string;
  criteria: string;
  focusKeyword: string;
  channel: string;
  /** Editorial domain used for cross-domain leak detection. */
  domain: SenseDomain;
  /** Human label for prompts, e.g. "도서(책 제목)". */
  senseLabel: string;
  /** Extra search suffixes / phrases (combined with the keyword). */
  searchQualifiers: string[];
  /** Hard rules injected into the user prompt. */
  promptRules: string[];
  /**
   * Off-topic detector: wrong-sense density without enough on-sense markers.
   */
  offSense?: {
    wrong: RegExp;
    required: RegExp;
    label: string;
  };
}

export type SenseDomain =
  | "book"
  | "movie"
  | "performance"
  | "music"
  | "game"
  | "stock"
  | "crypto"
  | "grant"
  | "travel"
  | "food"
  | "housing"
  | "politics"
  | "youtube"
  | "news"
  | "fashion"
  | "health"
  | "car"
  | "general";

type UnitSensePreset = Pick<
  BoardSense,
  "senseLabel" | "searchQualifiers" | "promptRules" | "offSense" | "domain"
>;

/** Nature / season copy that often hijacks short cultural keywords in autumn. */
const NATURE_LEAK =
  /개화|야생화|꽃길|꽃밭|가을\s*꽃|코스모스\s*꽃|백로|산책로|가로수|식물원|단풍놀이|꽃축제|가을\s*정취|전령사|꽃양귀비|유채꽃/;

/** Travelogue leak into non-travel boards. */
const TRAVEL_LEAK =
  /항공권|숙소\s*예약|여행\s*일정|관광지\s*추천|패키지\s*여행|출국\s*준비|여권\s*만료/;

/** Pure sports-match framing on game-title boards. */
const SPORTS_GAME_LEAK =
  /경기\s*결과|득점|홈런|야구\s*중계|축구\s*중계|스포츠\s*중계/;

const UNIT_PRESETS: Record<string, UnitSensePreset> = {
  도서: {
    domain: "book",
    senseLabel: "도서(책 제목)",
    searchQualifiers: ["책", "도서", "베스트셀러", "서점", "저자", "출판"],
    promptRules: [
      "이 키워드는 도서·베스트셀러 보드의 책 제목입니다.",
      "꽃·식물·야생화·가을 풍경·산책로·개화 등 동음이의어(식물) 해석은 금지합니다.",
      "책·저자·출판·서점·독자·베스트셀러·개정판 맥락으로만 쓰세요.",
    ],
    offSense: {
      wrong: NATURE_LEAK,
      // Avoid bare "책" — it appears inside 산책로.
      required:
        /칼\s*세이건|세이건|교양서|과학서|베스트셀러|저자|출판사|서점\s*순위|개정판|《[^》]*》|소설|에세이/,
      label: "book-vs-flower",
    },
  },
  영화: {
    domain: "movie",
    senseLabel: "영화 작품",
    searchQualifiers: ["영화", "개봉", "박스오피스", "관객", "영화관"],
    promptRules: [
      "이 키워드는 영화 보드의 작품명입니다.",
      "동명의 책·공연·일반 명사·여행지로 바꾸지 마세요.",
    ],
    offSense: {
      wrong: NATURE_LEAK,
      required: /영화|개봉|박스오피스|관객|영화관|스크린|감독|배우/,
      label: "movie-vs-nature",
    },
  },
  공연: {
    domain: "performance",
    senseLabel: "공연·작품",
    searchQualifiers: ["공연", "뮤지컬", "연극", "티켓", "예매"],
    promptRules: [
      "이 키워드는 공연 보드의 작품명입니다.",
      "동명의 노래·일반 명사·꽃·여행 해석으로만 쓰지 마세요.",
    ],
    offSense: {
      wrong: NATURE_LEAK,
      required: /공연|뮤지컬|연극|티켓|예매|공연장|캐스팅/,
      label: "performance-vs-nature",
    },
  },
  전시: {
    domain: "performance",
    senseLabel: "전시·팝업",
    searchQualifiers: ["전시", "전시회", "팝업", "미술관", "갤러리"],
    promptRules: ["이 키워드는 전시·팝업 보드 항목입니다. 동음이의 일반 명사로 바꾸지 마세요."],
  },
  곡: {
    domain: "music",
    senseLabel: "음원·곡",
    searchQualifiers: ["노래", "음원", "차트", "앨범", "스트리밍"],
    promptRules: [
      "이 키워드는 음원 보드의 곡명입니다.",
      "동명의 일반 명사·꽃·장소 이야기로만 쓰지 마세요.",
    ],
    offSense: {
      wrong: NATURE_LEAK,
      required: /노래|음원|차트|앨범|스트리밍|멜론|스포티파이|가사|가수/,
      label: "song-vs-nature",
    },
  },
  그룹: {
    domain: "music",
    senseLabel: "아이돌·그룹",
    searchQualifiers: ["아이돌", "그룹", "컴백", "팬덤", "앨범"],
    promptRules: ["이 키워드는 아이돌/그룹명입니다. 동음이의 일반 명사로 바꾸지 마세요."],
  },
  가수: {
    domain: "music",
    senseLabel: "가수",
    searchQualifiers: ["가수", "트로트", "콘서트", "음원", "앨범"],
    promptRules: ["이 키워드는 가수명입니다."],
  },
  작품: {
    domain: "general",
    senseLabel: "콘텐츠 작품",
    searchQualifiers: ["작품", "드라마", "웹툰", "시즌", "OTT"],
    promptRules: ["이 키워드는 작품명입니다. 동음이의 일반 명사로 바꾸지 마세요."],
    offSense: {
      wrong: NATURE_LEAK,
      required: /작품|드라마|웹툰|시즌|OTT|회차|연재|시청/,
      label: "title-vs-nature",
    },
  },
  게임: {
    domain: "game",
    senseLabel: "게임 타이틀",
    searchQualifiers: ["게임", "출시", "업데이트", "플레이", "스팀"],
    promptRules: [
      "이 키워드는 게임 타이틀입니다.",
      "스포츠 경기 중계·일반 명사 해석으로만 쓰지 마세요.",
    ],
    offSense: {
      wrong: SPORTS_GAME_LEAK,
      required: /게임|출시|업데이트|플레이|스팀|모바일\s*게임|e스포츠|패치/,
      label: "game-vs-sports",
    },
  },
  종목: {
    domain: "stock",
    senseLabel: "주식 종목",
    searchQualifiers: ["주식", "주가", "시총", "증시", "증권"],
    promptRules: [
      "이 키워드는 주식 종목명입니다.",
      "동명의 일반 명사·과일·브랜드 소비 후기만으로 쓰지 마세요.",
    ],
    offSense: {
      wrong: NATURE_LEAK,
      required: /주식|주가|시총|증시|증권|코스피|나스닥|실적|시세/,
      label: "stock-vs-nature",
    },
  },
  코인: {
    domain: "crypto",
    senseLabel: "암호화폐",
    searchQualifiers: ["코인", "암호화폐", "비트코인", "거래소"],
    promptRules: ["이 키워드는 암호화폐/코인 항목입니다."],
  },
  시세: {
    domain: "stock",
    senseLabel: "원자재·환율 시세",
    searchQualifiers: ["시세", "환율", "가격", "시장"],
    promptRules: ["이 키워드는 원자재·환율 시세 항목입니다."],
  },
  상품: {
    domain: "general",
    senseLabel: "금융 상품",
    searchQualifiers: ["금리", "예금", "대출", "금융상품"],
    promptRules: ["이 키워드는 금리·금융상품 보드 항목입니다."],
  },
  사업: {
    domain: "grant",
    senseLabel: "지원사업",
    searchQualifiers: ["지원사업", "공고", "신청", "자격"],
    promptRules: ["이 키워드는 정부·공공 지원사업입니다. 동명의 일반 뉴스 소재로 바꾸지 마세요."],
  },
  지원금: {
    domain: "grant",
    senseLabel: "지원금·바우처",
    searchQualifiers: ["지원금", "바우처", "신청", "공고"],
    promptRules: ["이 키워드는 지원금·바우처 사업입니다."],
  },
  여행지: {
    domain: "travel",
    senseLabel: "여행지",
    searchQualifiers: ["여행", "관광", "가볼만한곳", "여행코스"],
    promptRules: ["이 키워드는 여행지명입니다."],
  },
  도시: {
    domain: "travel",
    senseLabel: "여행 도시",
    searchQualifiers: ["여행", "관광", "항공", "숙소"],
    promptRules: ["이 키워드는 해외·국내 여행 도시입니다."],
  },
  장소: {
    domain: "travel",
    senseLabel: "나들이 장소",
    searchQualifiers: ["나들이", "주말", "명소", "추천"],
    promptRules: ["이 키워드는 주말 나들이 장소입니다."],
  },
  맛집: {
    domain: "food",
    senseLabel: "음식·맛집",
    searchQualifiers: ["맛집", "음식", "리뷰", "메뉴"],
    promptRules: ["이 키워드는 맛집·음식점입니다. 동명의 인물·브랜드 일반 뉴스로만 쓰지 마세요."],
  },
  레시피: {
    domain: "food",
    senseLabel: "요리 레시피",
    searchQualifiers: ["레시피", "만드는법", "요리", "재료"],
    promptRules: ["이 키워드는 요리 레시피 항목입니다."],
  },
  단지: {
    domain: "housing",
    senseLabel: "부동산 단지",
    searchQualifiers: ["아파트", "분양", "전세", "실거래"],
    promptRules: ["이 키워드는 아파트·부동산 단지명입니다."],
  },
  품목: {
    domain: "general",
    senseLabel: "물가 품목",
    searchQualifiers: ["물가", "가격", "소비자"],
    promptRules: ["이 키워드는 체감 물가 품목입니다."],
  },
  업종: {
    domain: "general",
    senseLabel: "창업 업종",
    searchQualifiers: ["창업", "프랜차이즈", "가맹"],
    promptRules: ["이 키워드는 창업·프랜차이즈 업종입니다."],
  },
  키워드: {
    domain: "general",
    senseLabel: "이슈 키워드",
    searchQualifiers: ["이슈", "논란", "검색"],
    promptRules: [
      "이 키워드는 해당 보드의 이슈 키워드입니다.",
      "보드 기준·카테고리 맥락을 벗어난 동음이의 해석으로 바꾸지 마세요.",
    ],
  },
  기사: {
    domain: "news",
    senseLabel: "헤드라인 기사",
    searchQualifiers: ["뉴스", "기사", "헤드라인"],
    promptRules: ["이 키워드는 헤드라인 뉴스 항목입니다."],
  },
  채널: {
    domain: "youtube",
    senseLabel: "유튜브·미디어 채널",
    searchQualifiers: ["유튜브", "채널", "구독자", "영상"],
    promptRules: ["이 키워드는 유튜브/미디어 채널명입니다. 동명의 일반 기관·인물 기사로만 쓰지 마세요."],
  },
  인물: {
    domain: "politics",
    senseLabel: "인물",
    searchQualifiers: ["인물", "인터뷰", "행보"],
    promptRules: ["이 키워드는 인물명입니다. 동명의 브랜드·지명으로 바꾸지 마세요."],
  },
  정당: {
    domain: "politics",
    senseLabel: "정당",
    searchQualifiers: ["정당", "지지율", "총선"],
    promptRules: ["이 키워드는 정당명입니다."],
  },
  정책: {
    domain: "politics",
    senseLabel: "지자체·정책",
    searchQualifiers: ["정책", "조례", "시정"],
    promptRules: ["이 키워드는 정책·지자체 이슈입니다."],
  },
  법안: {
    domain: "politics",
    senseLabel: "법안",
    searchQualifiers: ["법안", "국회", "입법"],
    promptRules: ["이 키워드는 쟁점 법안입니다."],
  },
  평론가: {
    domain: "politics",
    senseLabel: "정치평론가",
    searchQualifiers: ["평론가", "칼럼", "시사"],
    promptRules: ["이 키워드는 정치평론가입니다."],
  },
  이슈: {
    domain: "politics",
    senseLabel: "외교·안보 이슈",
    searchQualifiers: ["이슈", "외교", "안보"],
    promptRules: ["이 키워드는 외교·안보 이슈입니다."],
  },
  프로그램: {
    domain: "general",
    senseLabel: "방송 프로그램",
    searchQualifiers: ["방송", "시청률", "예능", "드라마"],
    promptRules: ["이 키워드는 TV 방송 프로그램명입니다."],
  },
  밈: {
    domain: "general",
    senseLabel: "숏폼·밈",
    searchQualifiers: ["밈", "숏폼", "틱톡", "릴스"],
    promptRules: ["이 키워드는 숏폼·밈 소재입니다."],
  },
  아이템: {
    domain: "fashion",
    senseLabel: "패션 아이템",
    searchQualifiers: ["패션", "트렌드", "코디", "아이템"],
    promptRules: ["이 키워드는 패션 트렌드 아이템입니다."],
  },
  지역: {
    domain: "travel",
    senseLabel: "핫플레이스 지역",
    searchQualifiers: ["핫플", "상권", "카페거리"],
    promptRules: ["이 키워드는 핫플레이스·상권 지역입니다."],
  },
  차종: {
    domain: "car",
    senseLabel: "자동차 차종",
    searchQualifiers: ["자동차", "시승", "출시", "전기차"],
    promptRules: ["이 키워드는 자동차 차종명입니다."],
  },
};

/**
 * Board-scoped keyword overrides. Key format: `${boardSlug}::${keyword}`.
 * Prevents a book-only override from poisoning other boards.
 */
const KEYWORD_OVERRIDES: Record<string, Partial<UnitSensePreset>> = {
  "bestseller-surge-index::코스모스": {
    senseLabel: "도서 《코스모스》(칼 세이건)",
    searchQualifiers: ["책", "칼 세이건", "세이건", "베스트셀러", "과학 교양", "도서"],
    promptRules: [
      "『코스모스』는 칼 세이건의 과학 교양서(도서·베스트셀러)입니다.",
      "가을 꽃·야생화·산책로·개화 등 식물 코스모스 해석은 금지합니다.",
    ],
  },
  "bestseller-surge-index::사피엔스": {
    senseLabel: "도서 《사피엔스》(유발 하라리)",
    searchQualifiers: ["책", "하라리", "베스트셀러", "인류"],
    promptRules: ["『사피엔스』는 유발 하라리의 도서입니다. 인류학 일반론만으로 쓰지 말고 책·독자·서점 맥락을 유지하세요."],
  },
  "bestseller-surge-index::원피스": {
    senseLabel: "도서·만화 《원피스》",
    searchQualifiers: ["만화", "원피스 책", "점프", "오다 에이치로"],
    promptRules: [
      "『원피스』는 만화/도서 보드 항목입니다.",
      "의류 원피스(드레스) 패션 해석은 금지합니다.",
    ],
    offSense: {
      wrong: /원피스\s*원단|여름\s*원피스|원피스\s*코디|드레스\s*원피스|패션\s*원피스/,
      required: /만화|점프|오다|해적|단행본|웹툰|애니|베스트셀러/,
      label: "onepiece-vs-dress",
    },
  },
  "bestseller-surge-index::1984": {
    senseLabel: "도서 《1984》(조지 오웰)",
    searchQualifiers: ["책", "오웰", "소설", "디스토피아"],
    promptRules: ["『1984』는 조지 오웰의 소설입니다. 연도 일반 뉴스(1984년 사건)로만 쓰지 마세요."],
  },
  "bestseller-surge-index::데미안": {
    senseLabel: "도서 《데미안》(헤르만 헤세)",
    searchQualifiers: ["책", "헤세", "소설", "베스트셀러"],
    promptRules: ["『데미안』은 헤르만 헤세의 소설입니다."],
  },
  "bestseller-surge-index::어린왕자": {
    senseLabel: "도서 《어린왕자》",
    searchQualifiers: ["책", "생텍쥐페리", "소설", "베스트셀러"],
    promptRules: ["『어린왕자』는 도서입니다. 동명의 카페·전시만으로 본문을 채우지 마세요."],
  },
  "kospi-fomo-index::네이버": {
    senseLabel: "주식 종목 네이버",
    searchQualifiers: ["주식", "주가", "네이버 시총", "증권"],
    promptRules: ["네이버는 주식 종목입니다. 검색포털 사용법 가이드로만 쓰지 마세요."],
  },
  "kospi-fomo-index::카카오": {
    senseLabel: "주식 종목 카카오",
    searchQualifiers: ["주식", "주가", "카카오 시총", "증권"],
    promptRules: ["카카오는 주식 종목입니다. 카카오톡 사용 팁만으로 쓰지 마세요."],
  },
  "overseas-stock-index::애플": {
    senseLabel: "주식 종목 애플(Apple)",
    searchQualifiers: ["주식", "주가", "AAPL", "시총"],
    promptRules: [
      "애플은 미국 주식 종목입니다.",
      "과일 사과·애플파이 해석은 금지합니다.",
    ],
    offSense: {
      wrong: /사과\s*가격|과일\s*사과|애플파이|청송\s*사과|사과\s*농가/,
      required: /주식|주가|시총|애플\s*실적|아이폰|AAPL|나스닥/,
      label: "apple-vs-fruit",
    },
  },
  "webtoon-ranking::원피스": {
    senseLabel: "웹툰·만화 원피스",
    searchQualifiers: ["웹툰", "만화", "원피스", "점프"],
    promptRules: ["원피스는 웹툰/만화 작품입니다. 의류 원피스 해석은 금지합니다."],
  },
};

/** Domains that should reject nature/season-dominated copy even without a unit offSense. */
const NATURE_SENSITIVE_DOMAINS = new Set<SenseDomain>([
  "book",
  "movie",
  "performance",
  "music",
  "game",
  "stock",
  "crypto",
  "grant",
  "politics",
  "youtube",
  "news",
  "fashion",
  "car",
]);

const NATURE_REQUIRED_BY_DOMAIN: Partial<Record<SenseDomain, RegExp>> = {
  book: /베스트셀러|저자|출판사|교양서|소설|《[^》]*》/,
  movie: /영화|개봉|박스오피스|관객|감독/,
  performance: /공연|뮤지컬|연극|티켓|예매/,
  music: /음원|차트|앨범|가수|아이돌|스트리밍/,
  game: /게임|출시|업데이트|스팀|패치/,
  stock: /주식|주가|시총|증시|실적/,
  crypto: /코인|암호화폐|거래소|비트코인/,
  grant: /지원|신청|공고|바우처|자격/,
  politics: /정당|국회|지지율|후보|법안|선거/,
  youtube: /유튜브|구독자|채널|영상|조회수/,
  news: /뉴스|기사|보도|헤드라인/,
  fashion: /패션|코디|트렌드|아이템|브랜드/,
  car: /자동차|시승|출시|전기차|차종/,
};

function cleanKeyword(keyword: string): string {
  return keyword.replace(/^\[[^\]]+\]\s*/, "").replace(/\s+/g, " ").trim();
}

function overrideKey(boardSlug: string, keyword: string): string {
  return `${boardSlug}::${cleanKeyword(keyword)}`;
}

export function resolveBoardSense(input: {
  boardSlug?: string | null;
  entitySlug?: string | null;
  keyword?: string | null;
}): BoardSense | null {
  const boardSlug =
    input.boardSlug?.trim() ||
    boardSlugFromEntitySlug(input.entitySlug ?? undefined) ||
    "";
  if (!boardSlug) return null;
  const board = getBoard(boardSlug);
  if (!board) return null;

  const keyword = cleanKeyword(input.keyword ?? "");
  const preset = UNIT_PRESETS[board.unitLabel] ?? {
    domain: "general" as SenseDomain,
    senseLabel: `${board.shortTitle}의 ${board.unitLabel}`,
    searchQualifiers: [board.unitLabel, board.focusKeyword].filter(Boolean),
    promptRules: [
      `이 키워드는 "${board.title}" 보드의 ${board.unitLabel} 항목입니다.`,
      `보드 기준: ${board.criteria}`,
      "동음이의어·다른 분야의 일반 명사 해석으로 바꾸지 마세요.",
    ],
  };

  const override = keyword ? KEYWORD_OVERRIDES[overrideKey(boardSlug, keyword)] : undefined;
  const merged: UnitSensePreset = {
    domain: override?.domain ?? preset.domain,
    senseLabel: override?.senseLabel ?? preset.senseLabel,
    searchQualifiers: [
      ...new Set([...(override?.searchQualifiers ?? []), ...preset.searchQualifiers]),
    ],
    promptRules: [...(override?.promptRules ?? []), ...preset.promptRules],
    offSense: override?.offSense ?? preset.offSense,
  };

  return {
    boardSlug,
    boardTitle: board.title,
    shortTitle: board.shortTitle,
    unitLabel: board.unitLabel,
    criteria: board.criteria,
    focusKeyword: board.focusKeyword,
    channel: board.channel,
    ...merged,
  };
}

/** Sense-biased search queries (qualified first, then bare keyword). */
export function boardSenseQueries(keyword: string, sense: BoardSense | null | undefined): string[] {
  const base = cleanKeyword(keyword);
  if (!base) return [];
  if (!sense) return [base];
  const qualified = sense.searchQualifiers
    .map((q) => `${base} ${q}`.trim())
    .filter((q) => q !== base);
  return [...new Set([qualified[0] ?? base, base, ...qualified.slice(1)])];
}

/** Merge strategy queries with board-sense queries (sense-qualified first). */
export function mergeSenseQueries(
  keyword: string,
  strategyQueries: string[],
  sense: BoardSense | null | undefined,
): string[] {
  const senseQueries = boardSenseQueries(keyword, sense);
  return [...new Set([...senseQueries.slice(0, 2), ...strategyQueries, ...senseQueries.slice(2)])];
}

/** Prompt block describing the board sense. */
export function boardSensePromptBlock(sense: BoardSense | null | undefined): string {
  if (!sense) return "";
  return [
    "[보드 의미 · 동음이의어 금지 — 모든 카테고리 공통]",
    `- 보드: ${sense.boardTitle} (${sense.boardSlug})`,
    `- 채널: ${sense.channel}`,
    `- 단위: ${sense.unitLabel}`,
    `- 해석: ${sense.senseLabel}`,
    `- 랭킹 기준: ${sense.criteria}`,
    ...sense.promptRules.map((rule) => `- ${rule}`),
    "- 수집 자료가 동음이의어(다른 분야)면 인용하지 말고, 보드 의미에 맞는 자료만 쓰세요.",
  ].join("\n");
}

/** Category hint that includes board title + unit (not just channel type label). */
export function boardSenseCategoryHint(sense: BoardSense | null | undefined, fallback: string): string {
  if (!sense) return fallback;
  return `${sense.shortTitle} · ${sense.unitLabel} · ${sense.senseLabel}`;
}

function countHits(text: string, pattern: RegExp): number {
  return text.match(new RegExp(pattern.source, "g"))?.length ?? 0;
}

function mismatchFromPair(
  text: string,
  wrong: RegExp,
  required: RegExp,
  label: string,
): string | null {
  const wrongHits = countHits(text, wrong);
  const requiredHits = countHits(text, required);
  if (wrongHits === 0) return null;
  if (requiredHits >= 2) return null;
  if (wrongHits >= 2 && requiredHits === 0) return label;
  if (wrongHits >= 3 && requiredHits < 2) return label;
  return null;
}

/**
 * Detects board-sense mismatches:
 * 1) unit/keyword-specific offSense
 * 2) cross-domain nature leaks on non-nature boards
 */
export function detectBoardSenseMismatch(input: {
  plainText: string;
  boardSlug?: string | null;
  entitySlug?: string | null;
  keyword?: string | null;
}): string | null {
  const sense = resolveBoardSense(input);
  if (!sense) return null;
  const text = input.plainText.replace(/\s+/g, " ");

  if (sense.offSense) {
    const specific = mismatchFromPair(
      text,
      sense.offSense.wrong,
      sense.offSense.required,
      sense.offSense.label,
    );
    if (specific) return specific;
  }

  if (NATURE_SENSITIVE_DOMAINS.has(sense.domain)) {
    const required =
      NATURE_REQUIRED_BY_DOMAIN[sense.domain] ??
      new RegExp(sense.searchQualifiers.map((q) => q.replace(/\s+/g, "\\s*")).join("|"));
    const nature = mismatchFromPair(text, NATURE_LEAK, required, `nature-leak:${sense.domain}`);
    if (nature) return nature;
  }

  // Travel boards are allowed travel copy; other domains reject pure travelogue hijacks
  // when the keyword itself is not place-like and travel density is high without on-sense markers.
  if (sense.domain !== "travel" && sense.domain !== "food") {
    const required =
      NATURE_REQUIRED_BY_DOMAIN[sense.domain] ??
      new RegExp(
        [sense.unitLabel, ...sense.searchQualifiers]
          .map((q) => q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
          .join("|"),
      );
    const travel = mismatchFromPair(text, TRAVEL_LEAK, required, `travel-leak:${sense.domain}`);
    if (travel) return travel;
  }

  return null;
}

/** Prefer RAG rows that look on-sense; keep others as fallback. */
export function rankSourcesByBoardSense<T extends { title: string; snippet?: string }>(
  sources: T[],
  sense: BoardSense | null | undefined,
): T[] {
  if (!sense || sources.length < 2) return sources;
  const quals = sense.searchQualifiers.map((q) => q.toLowerCase());
  const wrong = sense.offSense?.wrong ?? (NATURE_SENSITIVE_DOMAINS.has(sense.domain) ? NATURE_LEAK : null);
  const score = (row: T) => {
    const blob = `${row.title} ${row.snippet ?? ""}`.toLowerCase();
    let s = 0;
    for (const q of quals) {
      if (blob.includes(q.toLowerCase())) s += 2;
    }
    if (wrong?.test(blob) && !(sense.offSense?.required.test(blob))) s -= 4;
    return s;
  };
  return [...sources].sort((a, b) => score(b) - score(a));
}

/**
 * Drop strongly off-sense sources when enough on-sense alternatives remain.
 * Keeps retrieval from drowning the model in the wrong homonym cluster.
 */
export function filterSourcesByBoardSense<T extends { title: string; snippet?: string }>(
  sources: T[],
  sense: BoardSense | null | undefined,
  options?: { minKeep?: number },
): T[] {
  if (!sense || sources.length < 3) return sources;
  const minKeep = options?.minKeep ?? 3;
  const wrong = sense.offSense?.wrong ?? (NATURE_SENSITIVE_DOMAINS.has(sense.domain) ? NATURE_LEAK : null);
  if (!wrong) return sources;
  const required = sense.offSense?.required;
  const kept = sources.filter((row) => {
    const blob = `${row.title} ${row.snippet ?? ""}`;
    if (!wrong.test(blob)) return true;
    if (required?.test(blob)) return true;
    return false;
  });
  return kept.length >= minKeep ? kept : sources;
}
