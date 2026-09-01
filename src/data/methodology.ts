/**
 * What the site actually computes, stated as it is computed.
 *
 * The previous copy described a weighted z-score model drawing on Naver DataLab
 * with 2% winsorization. None of that exists in the codebase: `scoreFromRank`
 * maps a source's published rank onto a fixed band, and `scoreFromMetric` scales
 * a household rating. Claiming an observation pipeline the code does not run is
 * a misrepresentation, so the copy now tracks `src/lib/ingestion/score.ts` and
 * `compose.ts`. Change these strings when that math changes.
 */
export const INDEX_INPUTS = [
  {
    key: "tv",
    label: "시청률",
    basis: "닐슨 가구 시청률(%)을 지수로 직접 환산합니다. 18%를 상한으로 둡니다.",
    sources: "닐슨코리아 지상파·종합편성",
  },
  {
    key: "music",
    label: "음원",
    basis: "차트가 공개한 순위를 공통 구간으로 정규화합니다.",
    sources: "멜론, 벅스, 지니, 애플뮤직, 써클차트",
  },
  {
    key: "webtoon",
    label: "웹툰",
    basis: "순위 정규화값에 작품 별점을 가산합니다.",
    sources: "네이버웹툰 일간·주간, 카카오웹툰",
  },
  {
    key: "video",
    label: "숏폼·영상",
    basis: "순위 정규화값에 조회 지표를 가산합니다.",
    sources: "유튜브 인기 급상승",
  },
  {
    key: "game",
    label: "게임",
    basis: "순위 정규화값에 동시접속·플레이타임 지표를 가산합니다.",
    sources: "스팀, 애플 앱스토어, 플레이스테이션 스토어",
  },
  {
    key: "news",
    label: "인물·이슈",
    basis: "순위 정규화값에 해당 이름의 헤드라인 노출 건수를 가산합니다.",
    sources: "구글 뉴스 RSS, 구글 트렌드",
  },
] as const;

export const METHODOLOGY = {
  title: "지수 산출 방식",
  subtitle: "공개된 순위와 지표를 하나의 척도로 정규화한 상대 지표입니다.",
  formula:
    "지수 = 소스 순위를 880~1,860 구간으로 정규화 (+ 소스가 제공한 지표 가산). 시청률은 가구 시청률 %를 직접 환산합니다. 등락률 = 직전 수집 대비 순위 또는 지수의 변화.",
  paragraphs: [
    "KindexLab 지수는 인물이나 프로그램의 ‘가치’를 평가하지 않습니다. 음원 차트, 시청률, 웹툰 인기, 영상 조회, 게임 순위, 뉴스 노출처럼 이미 공개된 집계를 모아 같은 눈금 위에 올린 값입니다. 새로운 측정을 하는 것이 아니라, 흩어진 공개 순위를 한 화면에서 비교할 수 있게 만드는 것이 목적입니다.",
    "따라서 지수는 절대적인 인기의 크기가 아니라 같은 시점에 함께 집계된 항목들 사이의 상대적 위치입니다. 지수 1,600이 1,400보다 두 배 화제라는 뜻은 아닙니다. 소스마다 집계 대상과 방식이 다르므로 서로 다른 섹터를 가로질러 비교할 때는 순위의 방향성만 참고하시는 편이 정확합니다.",
    "등락률은 직전 수집분과 비교한 변화입니다. 수집은 5분 주기로 돌지만 원본 차트가 갱신되지 않으면 값도 그대로이며, 이 경우 등락률은 0으로 표시됩니다. 지금 화면의 상당수가 0인 것은 오류가 아니라 원본이 아직 움직이지 않았다는 뜻입니다.",
    "거래량(Volume)은 소스가 조회수나 동시접속 수를 함께 제공하면 그 값을, 제공하지 않으면 순위에 따른 환산값을 씁니다. 트리맵에서 박스의 크기를 정하는 데만 쓰이며 실제 거래량이 아닙니다. 이름은 시세판 비유를 따른 것입니다.",
    "웹툰과 게임, 숏폼에서 19금·성인 표기 작품은 광고 적합성을 위해 집계에서 제외합니다. 뉴스 노출 건수는 헤드라인에 이름이 등장한 횟수만 세며, 보도의 논조나 사실 여부는 반영하지 않습니다. 논란으로 인한 노출과 호평으로 인한 노출이 같은 값으로 들어간다는 점을 감안해 읽어 주세요.",
    "분·주·월 단위 구간 차트는 실제 관측 이력이 아니라 현재 지수와 순위를 바탕으로 그린 참고용 시각화입니다. 항목별 원본 지표의 시계열 저장은 아직 도입 전이며, 도입되면 이 문단을 실제 이력 기준으로 교체합니다.",
  ],
};
