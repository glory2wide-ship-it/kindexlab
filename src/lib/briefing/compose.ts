import { formatKoreanDate } from "@/lib/briefing/dates";
import {
  categoryLabel,
  describeEntity,
  heatmapHref,
  pickDeepDiveCategories,
  snapshotFromPayload,
  type MarketSnapshot,
} from "@/lib/briefing/metrics";
import { formatRate, formatScore } from "@/lib/format";
import { SITE } from "@/lib/site";
import type { BriefingArticle, BriefingKind, CategoryId, RankingsPayload } from "@/lib/types";

export function countWords(article: Pick<BriefingArticle, "title" | "excerpt" | "sections">): number {
  const text = [
    article.title,
    article.excerpt,
    ...article.sections.flatMap((section) => [section.heading ?? "", ...section.paragraphs]),
  ].join(" ");
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function names(list: { name: string }[], n = 3): string {
  return list
    .slice(0, n)
    .map((item) => item.name)
    .join("·");
}

function padUntil(article: BriefingArticle, snapshot: MarketSnapshot, min = 1050): BriefingArticle {
  const extra = [...article.sections];
  let words = countWords({ ...article, sections: extra });
  let i = 0;
  while (words < min && i < 24) {
    extra.push({
      heading: i === 0 ? "데이터 읽기 메모" : undefined,
      paragraphs: [paddingParagraph(snapshot, article, i)],
    });
    i += 1;
    words = countWords({ ...article, sections: extra });
  }
  return {
    ...article,
    sections: extra,
    wordCount: words,
    readingMinutes: Math.max(8, Math.round(words / 120)),
  };
}

function paddingParagraph(snapshot: MarketSnapshot, article: BriefingArticle, index: number): string {
  const date = formatKoreanDate(article.editionDate);
  const label = categoryLabel(article.category);
  const roster = [...snapshot.gainers, ...snapshot.volumeLeaders, ...snapshot.losers];
  const entity = roster[index % Math.max(roster.length, 1)];
  const peer = roster[(index + 3) % Math.max(roster.length, 1)];
  const href = heatmapHref(article.category);
  const templates = [
    `${date} 보드를 닫기 전에 확인할 것은 급등 숫자보다 거래량의 질입니다. ${entity ? describeEntity(entity) : "상위 종목"}처럼 검색과 언급이 같이 붙은 상승은 다음날 시세판에서도 빨간 면적을 남길 가능성이 큽니다. 반대로 ${peer ? describeEntity(peer) : "조정 종목"}은 이미 높은 가격대에서 재료가 소진된 회전에 가깝습니다. ${SITE.name} 트리맵은 이 차이를 박스 크기와 색으로 동시에 보여 주므로, 리스트의 순위 숫자만 보지 말고 면적을 함께 읽는 습관이 필요합니다. ${label} 필터를 켠 상태에서 일봉과 60분봉을 오가면 같은 종목의 온도가 얼마나 빨리 식는지도 보입니다.`,
    `분봉(5·10·30·60분)은 장중 노이즈를, 일봉·주봉·월봉은 테마의 지속성을 봅니다. ${entity ? entity.name : "상단 종목"}이 5분봉에서만 강하고 주봉에서 회색이면 단타성 이슈일 수 있습니다. 일봉과 주봉이 함께 빨강이면 재료가 여러 날에 걸쳐 쌓인 경우입니다. 카테고리 탭을 ${label}로 고정한 뒤 타임프레임만 바꿔 보면, 수급의 만기가 숫자보다 먼저 색으로 드러납니다. 이 습관이 ${SITE.name} 시세판을 단순 랭킹 사이트와 구분합니다.`,
    `내부 링크를 따라가면 해설과 시세가 같은 데이터임을 확인할 수 있습니다. 종합 히트맵은 시세판 상단에서, 이 글의 섹터 보드는 ${href} 에서 열립니다. ${entity ? `${entity.name} 상세 페이지` : "종목 상세"}의 분봉 차트와 브리핑의 문장은 같은 버즈 점수를 다른 해상도로 읽습니다. 아카이브는 어제 빨간 박스가 오늘 회색이 됐는지를 검증하는 장기 검색 유입 장치이기도 합니다. 독자가 글에서 보드로, 보드에서 글로 왕복할수록 체류 시간과 정보 탐색 의도가 같이 올라갑니다.`,
    `${date} ${label} 관측의 실무 순서는 이렇습니다. 먼저 종합 맵에서 면적이 큰 박스를 찾고, 이어서 ${label} 탭만 남긴 뒤 등락률 정렬을 켭니다. ${entity ? describeEntity(entity) : "주도 종목"}이 두 화면에서 모두 상단이면 테마가 일치한 것이고, 한쪽에서만 보이면 섹터 내부 회전입니다. 마지막에 상세 페이지 미니 차트와 브리핑 문장을 대조하면 과열인지 실수요인지가 갈립니다. 이 루프를 매일 같은 시각에 반복하는 것이 아카이브의 존재 이유입니다.`,
    `광고와 제휴 모듈은 본문 맥락이 있을 때만 자연스럽습니다. ${entity ? entity.name : "상단 종목"}처럼 패션·푸드·라이프 검색이 붙는 페이지는 상품 선반이 해설의 연장이 되고, 논란형 급등은 검색 품질이 떨어져 같은 슬롯이 어색해집니다. ${SITE.name}는 순위만 올리는 문장보다, 왜 이 박스 색이 나왔는지를 1,000단어 이상으로 풀어 독자가 시세판으로 돌아가게 만드는 쪽을 택합니다. ${peer ? peer.name : "상대 종목"} 페이지를 함께 열어 두면 편향도 줄어듭니다.`,
  ];
  return templates[index % templates.length] ?? templates[0] ?? "";
}

export function composeArticle(
  payload: RankingsPayload,
  options: {
    editionDate: string;
    kind: BriefingKind;
    category: CategoryId;
    publishedAt: string;
  },
): BriefingArticle {
  const snapshot = snapshotFromPayload(payload);
  const dateLabel = formatKoreanDate(options.editionDate);
  const article =
    options.kind === "main"
      ? composeMain(snapshot, dateLabel, options)
      : composeDeepDive(snapshot, dateLabel, options);
  return padUntil(article, snapshot);
}

function composeMain(
  snapshot: MarketSnapshot,
  dateLabel: string,
  options: { editionDate: string; publishedAt: string },
): BriefingArticle {
  const { payload, gainers, losers, volumeLeaders } = snapshot;
  const idx = payload.indices;
  const composite = idx[0];
  const top = gainers.slice(0, 4);
  const down = losers.slice(0, 3);
  const vol = volumeLeaders.slice(0, 3);
  const sectorLine = idx
    .slice(1)
    .map((row) => `${row.label} ${formatScore(row.value)}(${formatRate(row.changeRate)})`)
    .join(", ");

  const title = `${dateLabel} 종합 브리핑: ${names(top, 2)} 주도, ${names(down, 1)} 조정`;
  const excerpt = `${composite ? `${composite.label}는 ${formatScore(composite.value)}로 ${formatRate(composite.changeRate)}` : "종합지수가 움직였습니다"}. 급등 상단은 ${names(top, 2)}이고, ${names(down, 2)}는 숨 고르기에 들어갔습니다. 거래량은 ${names(vol, 2)} 구간에 몰렸습니다.`;

  const sections = [
    {
      heading: "한눈에 보는 오늘 시장",
      paragraphs: [
        `${dateLabel} ${SITE.name} 시세판의 질문은 누가 더 유명해졌는가가 아니라, 그 화제가 검색·스트리밍·시청률로 얼마나 빨리 번역됐는가입니다. ${composite ? `${composite.label}는 ${formatScore(composite.value)}, 전 집계 대비 ${formatRate(composite.changeRate)}입니다.` : ""} 섹터별로는 ${sectorLine} 순으로 온도가 갈렸습니다. 트리맵에서 박스가 큰 종목은 거래량(검색+언급)이 두껍고, 빨강이 진할수록 선택한 타임프레임의 등락률이 가파릅니다.`,
        `상승 쪽 핵심은 ${top.map(describeEntity).join(", ")}입니다. 공통점은 조회수만 늘어난 허수가 아니라 검색 키워드가 동반됐다는 점입니다. 하락 쪽은 ${down.map(describeEntity).join(", ")}로, 이미 높은 버즈 구간에서 재료가 소진된 대형주의 전형적인 되돌림입니다. 리스트만 보면 순위 숫자에 눈이 고정되지만, 히트맵은 같은 데이터를 면적으로 보여 급등과 거래량을 한 화면에 겹칩니다.`,
        `모바일 사용자는 1~5위와 급등 박스만 먼저 보고, 데스크톱 사용자는 섹터 전체를 훑습니다. 그래서 오늘의 보드는 상단 티커, 지수 카드, 트리맵, 리스트를 같은 데이터로 묶었습니다. 자세한 수급은 종합 히트맵에서 타임프레임을 바꿔 가며 확인하면 됩니다.`,
      ],
    },
    {
      heading: "급등주와 거래량",
      paragraphs: [
        `주간 상승률 상단은 ${gainers[0] ? describeEntity(gainers[0]) : "상위 종목"}이 차지했습니다. 이어 ${top.slice(1, 3).map(describeEntity).join(", ")}가 두 자릿수 또는 그에 가까운 탄력을 냈습니다. 급등 국면에서 확인할 것은 커뮤니티 피로입니다. 이틀 연속 두 자릿수면 스팸성 언급이 섞일 수 있어, ${SITE.name}는 검색 품질(구매·정보 탐색 키워드 비중)을 함께 봅니다.`,
        `거래량 상위는 ${vol.map(describeEntity).join(", ")}입니다. 주식에서 거래량 없는 급등이 위험하듯, 버즈 시장에서도 언급만 늘고 검색이 따라오지 않으면 하루 만에 반락합니다. 오늘 상단 종목은 대체로 검색이 같이 늘어난 실수요 상승에 가깝습니다. 상세 페이지의 분봉 차트는 같은 움직임을 장중 해상도로 보여 줍니다.`,
        `반대로 거래량이 줄며 하락한 종목은 공포 매도보다 대기 수요 공백으로 읽는 편이 맞습니다. ${down[0] ? describeEntity(down[0]) : "조정 대형주"}가 대표적입니다. 다음 편성·경기·음원 일정이 나오면 분봉이 먼저 반응하고, 일봉이 확인하는 순서가 반복됩니다.`,
      ],
    },
    {
      heading: "섹터별 수급: 아이돌·셀럽·방송",
      paragraphs: [
        `K-POP 섹터는 ${names(snapshot.byType.kpop ?? [], 3)}가 면을 만들었습니다. 화보와 숏폼 챌린지가 겹치면 검색이 패션 SKU로 떨어집니다. 셀럽 섹터는 ${names(snapshot.byType.celebrity ?? [], 3)}가 중심이고, 브랜드 파워가 있는 종목은 재료가 없어도 하단이 단단합니다. 방송은 ${names(snapshot.byType.tv_show ?? [], 3)}처럼 클립 재생산 속도가 곧 시세입니다.`,
        `인플루언서는 ${names(snapshot.byType.influencer ?? [], 3)}가 푸드·여행·IT 키워드를 나눴습니다. 영상 속 물건이 분명할수록 상세 페이지의 쇼핑 모듈이 본문의 자연스러운 연장이 됩니다. 음원 차트는 ${names(snapshot.byType.music_chart ?? [], 3)}, 시청률은 ${names(snapshot.byType.tv_rating ?? [], 3)}가 각각 다른 축으로 움직입니다. 화제성 순위와 가구 시청률이 어긋나는 날이 바로 심층 브리핑이 필요한 지점입니다.`,
        `카테고리 탭을 바꾸면 수급이 분리됩니다. 종합 맵에서 음원 박스가 커지면 스트리밍이 시장을 주도한 날이고, 시청률 탭만 열면 본방 숫자가 버즈보다 앞선 프로그램이 드러납니다. ${dateLabel}의 섹터 딥다이브는 변동 폭이 큰 두 카테고리를 따로 풀어 썼습니다.`,
      ],
    },
    {
      heading: "트리맵과 타임프레임으로 읽는 법",
      paragraphs: [
        `리스트의 순위는 결과이고, 트리맵의 색은 속도입니다. 박스가 큰데 회색이면 유명한 횡보이고, 박스가 작은데 진한 빨강이면 아직 거래량이 안 붙은 급등입니다. ${dateLabel} 종합 맵은 ${names(top, 2)}가 빨간 대형 면, ${names(down, 1)}가 파란 조정을 담당하는 구도입니다.`,
        `5분·10분봉은 예고 클립과 실시간 검색의 충돌을 보여 주고, 60분봉은 그 노이즈를 평균합니다. 일봉은 오늘 시가 대비 등락, 주봉·월봉은 테마가 며칠을 가는지 봅니다. 급등주가 분봉에서만 빨갛고 주봉에서 무채색이면 단타, 여러 봉이 함께 빨강이면 재료가 쌓인 상승입니다.`,
        `호버 카드의 미니 차트는 왜 이 색인가를 확인하는 짧은 루프입니다. 같은 종목을 상세 페이지에서 다시 열면 분봉부터 월봉까지 같은 시계열을 더 크게 볼 수 있습니다. 시세판 히트맵으로 돌아가 일봉과 분봉을 비교하면 브리핑의 문장이 숫자로 확인됩니다.`,
      ],
    },
    {
      heading: "내일 이후 전망",
      paragraphs: [
        `단기 변곡점은 ${names(top, 2)}의 차익 실현 여부, ${names(down, 1)}의 다음 재료 공개입니다. 이 중 하나라도 겹치면 종합지수는 다시 상단을 테스트할 수 있습니다. 반대로 이슈가 루머·논란으로 기울면 셀럽 섹터 변동성이 커지고 검색 품질이 떨어집니다. ${SITE.name}는 논란형 급등보다 콘텐츠·패션·라이프 실수요 급등을 우위에 둡니다.`,
        `중기적으로는 숏폼 재생산 속도와 쇼핑·음원·시청 검색의 동조화가 핵심 지표입니다. 유명한 사람을 나열하는 사이트는 이미 많습니다. 시세판이 의미를 가지려면 어제보다 누가 얼마나 올랐는지, 그 오름이 편성인지 화보인지 차트인지, 독자가 다음에 열어볼 상세 페이지와 어떻게 연결되는지를 매일 같은 형식으로 보여줘야 합니다.`,
        `이 브리핑은 예측이 아니라 관측입니다. 순위와 등락률은 공개된 화제성과 내부 가중치 모델의 스냅샷이며, 특정 인물이나 프로그램의 가치를 단정하지 않습니다. 내일 같은 시각 같은 보드에서 오늘의 빨간 박스가 얼마나 남아 있는지를 확인하는 것이 사용법입니다. 지난 해설은 아카이브에 남아 장기 검색 유입을 만듭니다.`,
      ],
    },
    {
      heading: "검색 의도와 상세 페이지",
      paragraphs: [
        `시세판에서 박스를 클릭하면 상세 페이지로 들어갑니다. ${names(top, 2)}처럼 오늘 빨간 대형 면인 종목은 분봉 차트와 한 줄 요약, 관련 상품 모듈이 같은 화면에 붙습니다. 독자가 브리핑에서 이름을 보고 상세로 이동하는 경로와, 히트맵에서 색을 보고 들어가는 경로는 다르지만 도착지는 같습니다. 이 중복이 오히려 신뢰입니다. 같은 숫자가 글과 차트에 반복됩니다.`,
        `검색 의도는 응원 키워드보다 착용·시청·재생·구매 키워드가 섞일 때 오래 갑니다. ${names(vol, 2)} 구간에 거래량이 몰린 것은 그 검색이 실제로 붙었다는 뜻입니다. 반대로 언급만 많고 검색이 빈 급등은 상세 페이지 체류가 짧습니다. ${dateLabel}은 전자에 가까운 종목이 상단에 더 많이 보였습니다.`,
        `카테고리 심층은 이 종합 해설이 놓친 상대 수익률을 보충합니다. 종합 맵의 큰 박스에 가려진 섹터 내부 1·2위를 따로 풀어, 내일 아카이브에서 “가설이 맞았는지”를 검증할 수 있게 합니다. 글 하단의 종목 링크와 시세판 히트맵은 그 검증의 출발점입니다.`,
      ],
    },
    {
      heading: "아카이브에 남는 오늘",
      paragraphs: [
        `자정이 바뀌면 이 글은 매거진 아카이브로 이동합니다. 제목과 날짜, 카테고리, 본문 키워드가 검색 색인이 되어 몇 주 뒤 “그날 하니는 왜 올랐나” 같은 질의에 답합니다. 매일 1~3편이 쌓이면 장기 트래픽 깔때기가 됩니다. 허브는 오늘 에디션만 강조하고, 지난 호는 아카이브 검색으로 엽니다.`,
        `아카이브 기사에도 종합 히트맵과 해당 카테고리 보드 링크가 붙어 있습니다. 과거 해설을 읽다가 현재 시세로 돌아오는 동선이 내부 링크의 역할입니다. ${SITE.name}는 이 왕복을 위해 본문을 짧게 자르지 않습니다. 1,000단어 이상의 분석이 광고 본문 품질과 검색 의도를 동시에 맞춥니다.`,
        `${dateLabel}의 가설을 한 줄로 남기면 이렇습니다. 급등 축은 ${names(top, 2)}, 조정 축은 ${names(down, 1)}, 거래량 축은 ${names(vol, 2)}입니다. 내일 같은 보드에서 이 세 축이 유지되면 테마가 연장된 것이고, 뒤집히면 하루짜리 노이즈였던 것입니다.`,
      ],
    },
  ];

  const relatedEntitySlugs = [...top, ...vol]
    .map((item) => item.slug)
    .filter((slug, i, arr) => arr.indexOf(slug) === i)
    .slice(0, 6);

  const draft: BriefingArticle = {
    id: `brief-${options.editionDate}-daily`,
    slug: `${options.editionDate}-daily`,
    kind: "main",
    category: "all",
    editionDate: options.editionDate,
    title,
    excerpt,
    publishedAt: options.publishedAt,
    updatedAt: options.publishedAt,
    readingMinutes: 10,
    wordCount: 0,
    relatedEntitySlugs,
    sections,
  };
  draft.wordCount = countWords(draft);
  return draft;
}

function composeDeepDive(
  snapshot: MarketSnapshot,
  dateLabel: string,
  options: { editionDate: string; publishedAt: string; category: CategoryId },
): BriefingArticle {
  const category = options.category === "all" ? "kpop" : options.category;
  const items = snapshot.byType[category] ?? [];
  const label = categoryLabel(category);
  const leaders = items.slice(0, 4);
  const laggards = [...items].sort((a, b) => a.fluctuationRate - b.fluctuationRate).slice(0, 3);
  const sector = snapshot.leadingSectors.find((row) => row.category === category)?.index;
  const href = heatmapHref(category);

  const title = `${dateLabel} ${label} 심층: ${names(leaders, 2)} 주도 수급`;
  const excerpt = `${label} 보드는 ${sector ? `${sector.label} ${formatScore(sector.value)}(${formatRate(sector.changeRate)})` : "섹터 지수가 움직인 하루입니다"}. 상단은 ${names(leaders, 2)}, 조정은 ${names(laggards, 1)}입니다. 같은 데이터는 시세판 ${label} 히트맵에서 면적으로 확인할 수 있습니다.`;

  const lead0 = leaders[0];
  const lead1 = leaders[1];
  const lag0 = laggards[0];

  const sections = [
    {
      heading: `${label} 보드가 오늘 말하는 것`,
      paragraphs: [
        `${dateLabel} ${label} 심층은 종합 브리핑이 놓치기 쉬운 섹터 내 상대 수익률을 풀어 씁니다. ${sector ? `${sector.label}는 ${formatScore(sector.value)}, ${formatRate(sector.changeRate)}입니다. ${sector.note}.` : `${label} 종목만 모아 보면 종합 맵과 다른 색깔이 드러납니다.`} 상단 ${leaders.map(describeEntity).join(", ")}가 섹터 면적의 대부분을 차지합니다.`,
        `심층 브리핑을 쓰는 이유는 간단합니다. 종합 트리맵에서는 대형 박스에 가려 ${label}의 내부 회전이 안 보일 수 있습니다. 카테고리 필터를 ${label}로 고정하면 박스 크기 순위가 바뀌고, 등락률 정렬을 켜면 또 한 번 순위가 뒤집힙니다. 오늘 그 뒤집힘이 가장 큰 축이 ${label}였습니다.`,
        `${SITE.name} 산출은 검색 35%, 소셜 25%, 스트리밍 20%, 뉴스 10%, 쇼핑 의도 10%입니다. ${label}에서는 스트리밍·본방·숏폼 비중이 상대적으로 더 민감하게 반응합니다. 같은 가중이라도 원점수의 분산이 섹터마다 다릅니다.`,
      ],
    },
    {
      heading: "상단 종목 해부",
      paragraphs: [
        lead0
          ? `${describeEntity(lead0)}가 섹터 1등 탄력을 냈습니다. ${lead0.summary} 상세 분석은 종목 시세 페이지에서 분봉 차트와 함께 읽을 수 있습니다. 거래량은 트리맵 박스 면적에 그대로 들어갑니다.`
          : `${label} 상단이 비어 있는 비정상 세션입니다.`,
        lead1
          ? `2순위 ${describeEntity(lead1)}는 상대 수익률로 1위를 추격합니다. ${lead1.analysis} 태그 ${lead1.tags.join("·")}가 검색 경로를 설명합니다.`
          : `추격 종목이 없어 1위 독주 구간입니다.`,
        `${names(leaders, 3)}를 한 화면에 두면, 급등이 한 이슈에 치우쳤는지 분산됐는지가 보입니다. 분산돼 있으면 섹터 지수 상승의 질이 좋고, 한 종목 독주면 다음날 되돌림 위험이 커집니다. ${dateLabel} ${label}는 ${leaders.length >= 3 ? "상단이 분산된 편" : "상단 집중도가 높은 편"}입니다.`,
      ],
    },
    {
      heading: "조정과 하단",
      paragraphs: [
        lag0
          ? `조정 축은 ${describeEntity(lag0)}입니다. ${lag0.summary} 하락이 급락이 되려면 거래량이 함께 줄어야 합니다. 오늘 수치는 재료 공백형 숨 고르기에 가깝습니다.`
          : `하단 조정이 뚜렷하지 않습니다.`,
        `섹터 안에서 빨강과 파랑이 동시에 보이면 관심이 빠져나간 것이 아니라 자리가 교체된 것입니다. ${names(leaders, 1)}로 들어간 관심이 ${names(laggards, 1)}에서 빠진 구도로 읽으면 됩니다. 리스트 뷰에서 등락 칼럼을 정렬하면 이 교체가 더 분명합니다.`,
        `하단 종목도 상세 페이지 가치가 있습니다. 이미 알려진 이름일수록 검색 품질이 유지되고, 다음 재료가 나왔을 때 분봉 반등이 빠릅니다. ${laggards.map((item) => item.name).join(", ")} 페이지를 함께 열어 두면 종합 급등만 쫓는 편향을 줄일 수 있습니다.`,
      ],
    },
    {
      heading: "히트맵에서 이 섹터만 보는 법",
      paragraphs: [
        `시세판에서 카테고리 탭의 ${label}를 고르고, 일봉으로 색을 읽은 뒤 5분봉으로 장중 노이즈를 확인합니다. 리스트로 전환해 등락·거래량을 재정렬하면 ${dateLabel} ${label} 심층의 실습이 끝납니다. 바로가기 주소는 ${href} 입니다.`,
        `호버 카드는 미니 차트와 한 줄 요약을 붙입니다. 박스가 작아 이름이 안 보여도 호버하면 통계가 나옵니다. 모바일에서는 리스트가 더 빠르고, 데스크톱에서는 트리맵이 섹터 온도를 한눈에 줍니다. 두 뷰는 같은 API 페이로드입니다.`,
        `관련 종목 ${leaders.map((item) => item.name).join(", ")}의 상세 페이지는 글 하단 모듈에 모아 두었습니다. 시세판과 글을 오가며 읽는 동선이 체류 시간과 검색 의도를 동시에 올립니다.`,
      ],
    },
    {
      heading: "앞으로 48시간",
      paragraphs: [
        `${label}의 다음 변곡은 편성표, 음원 프로모션, 화보 공개, 본방 예고 중 무엇이 먼저 나오느냐입니다. ${names(leaders, 2)}에 추가 재료가 겹치면 섹터 지수가 종합지수를 다시 앞설 수 있습니다. 재료가 없으면 오늘 빨간 면의 일부가 회색으로 식는 것이 정상입니다.`,
        `심층 브리핑은 하루짜리 가십이 아니라, 다음날 아카이브에서 검증할 가설을 남깁니다. ${dateLabel}의 가설은 “${names(leaders, 1)} 수급이 ${label} 지수를 끌었고, ${names(laggards, 1)}는 대기 공백”입니다. 내일 같은 탭에서 색이 유지되면 가설이 맞은 것이고, 뒤집히면 단타성 이슈였던 것입니다.`,
        `${SITE.name}는 이 검증 루프를 매일 1편의 종합과 1~2편의 심층으로 고정합니다. 글은 1,000단어 이상의 분석 본문을 유지하고, 어제의 글은 자동으로 아카이브에 쌓여 날짜·카테고리·검색어로 다시 열립니다. ${label} 히트맵은 시세판 카테고리 탭에서 언제든 다시 열 수 있습니다.`,
      ],
    },
    {
      heading: "종합 맵과의 차이",
      paragraphs: [
        `종합 트리맵은 거래량이 큰 대형 박스에 시선이 갑니다. ${label}만 남기면 순위가 재정렬되고, ${names(leaders, 2)}가 상대적으로 더 커지거나 ${names(laggards, 1)}의 파란 면이 또렷해집니다. 이 차이가 심층을 따로 쓰는 이유입니다. 같은 페이로드를 필터만 바꿔 보여주는 것이므로, 숫자가 어긋나면 버그가 아니라 섹터 가중치의 차이입니다.`,
        `상대 수익률은 종합 1위가 ${label} 1위와 다를 때 의미가 큽니다. 종합 상단이 다른 섹터인데 ${label} 내부에서는 ${lead0 ? lead0.name : "선두"}가 독주하면, 그 독주는 시장 전체가 아니라 팬덤·본방·스트리밍 한 축의 이야기입니다. 광고 슬롯과 상세 페이지 큐레이션도 그 축에 맞춰야 클릭 후 이탈이 줄어듭니다.`,
        `실습은 짧습니다. ${href} 로 이동해 ${label} 탭이 켜졌는지 확인하고, 트리맵과 리스트를 한 번씩 전환합니다. 등락 칼럼을 정렬한 뒤 ${names(leaders, 1)}와 ${names(laggards, 1)}를 상세에서 열어 분봉을 비교하면 이 심층의 문장이 차트와 겹칩니다.`,
      ],
    },
    {
      heading: "아카이브 가설",
      paragraphs: [
        `${dateLabel} ${label} 심층은 내일의 검색 질의에 답하기 위해 남깁니다. “왜 ${names(leaders, 1)}가 올랐는가”, “왜 ${names(laggards, 1)}는 빠졌는가”는 며칠 뒤에도 같은 URL에서 읽을 수 있어야 합니다. 그래서 본문을 요약 카드로만 끝내지 않고 1,000단어 이상으로 고정합니다.`,
        `가설이 틀려도 아카이브 가치는 남습니다. 틀린 가설은 다음날 종합 브리핑이 정정하고, 두 글이 내부 링크로 묶입니다. ${SITE.name} 매거진은 이 정정 루프를 숨기지 않습니다. 시세판은 실시간, 브리핑은 일일 스냅샷, 아카이브는 그 스냅샷의 도서관입니다.`,
        `닫기 전에 ${label} 히트맵과 종합 히트맵을 한 화면 차이로 기억해 두면 충분합니다. 오늘은 ${names(leaders, 2)}가 섹터 면적을 밀고, ${names(laggards, 1)}가 자리를 비워 준 날입니다. 내일 같은 탭에서 색이 남았는지 확인하면 됩니다.`,
      ],
    },
  ];

  const draft: BriefingArticle = {
    id: `brief-${options.editionDate}-${category}`,
    slug: `${options.editionDate}-${category.replaceAll("_", "-")}`,
    kind: "deep-dive",
    category,
    editionDate: options.editionDate,
    title,
    excerpt,
    publishedAt: options.publishedAt,
    updatedAt: options.publishedAt,
    readingMinutes: 9,
    wordCount: 0,
    relatedEntitySlugs: items.slice(0, 6).map((item) => item.slug),
    sections,
  };
  draft.wordCount = countWords(draft);
  return draft;
}

export function composeEdition(payload: RankingsPayload, editionDate: string, publishedAt: string) {
  const snapshot = snapshotFromPayload(payload);
  const dives = pickDeepDiveCategories(snapshot, editionDate, 2);
  return [
    composeArticle(payload, { editionDate, kind: "main", category: "all", publishedAt }),
    ...dives.map((category, index) =>
      composeArticle(payload, {
        editionDate,
        kind: "deep-dive",
        category,
        publishedAt: publishedAt.replace("T07:05:00", `T07:${String(15 + index * 10).padStart(2, "0")}:00`),
      }),
    ),
  ];
}
