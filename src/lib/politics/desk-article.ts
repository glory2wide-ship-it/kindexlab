import { composeArticle, finalizeEditorialArticle } from "@/lib/briefing/compose";
import { withBriefingCover } from "@/lib/briefing/cover";
import { editionDateTime, formatKoreanDate, kstDateString } from "@/lib/briefing/dates";
import { snapshotFromPayload } from "@/lib/briefing/metrics";
import {
  numberedHeading,
  plainName,
  subjectParticle,
  topicParticle,
  withParticle,
} from "@/lib/editorial/copy";
import { tableMarkdown, uniqueLines, resetEditorialPass } from "@/lib/editorial/rules";
import { POLL_LINKS, formatPollDelta, pollDelta, type PollBoardSnapshot } from "@/lib/politics/polls";
import { SITE } from "@/lib/site";
import type { BriefingArticle, RankingEntity, RankingsPayload } from "@/lib/types";

const FOCUS = "대통령 지지도";
const SUPPORT = "직무 평가 화제";

function pollCause(polls: PollBoardSnapshot, lead?: RankingEntity): string[] {
  const gallup = polls.polls.find((item) => item.agency === "gallup");
  const realmeter = polls.polls.find((item) => item.agency === "realmeter");
  const name = lead ? plainName(lead.name) : "정치인";
  return uniqueLines([
    `${FOCUS}가 지금 붙은 배경은 한 기관 숫자가 아니다`,
    `검색 창에 직무 평가와 부동산 키워드가 같이 붙었다`,
    gallup && realmeter
      ? `갤럽 동률과 리얼미터 격차가 같은 주에 겹쳤다`
      : `기관 공표가 같은 주에 어긋나 비교 질의가 붙었다`,
    `기관 차이가 검색 비교 질의로 번진 자리다`,
    `${SUPPORT}${topicParticle(SUPPORT)} 그 비교를 한 줄로 받지 않는다`,
    `${name} 이름이 정책 질의와 같이 뜨면 실검색이다`,
    `응원 해시태그만 오르면 허수에 가깝게 읽힌다`,
    `정책 질의가 남으면 다음날 같은 탭에도 잔여가 있다`,
    `표본오차 안 역전을 방향처럼 쓰면 원인을 놓친다`,
    `${FOCUS} 관심의 촉매는 검색 품질이지 공표 한 줄이 아니다`,
  ]);
}

function whySentences(polls: PollBoardSnapshot, lead?: RankingEntity): string[] {
  const gallup = polls.polls.find((item) => item.agency === "gallup");
  const name = lead ? plainName(lead.name) : "정치인";
  return uniqueLines([
    `${FOCUS}${subjectParticle(FOCUS)} 화제인 이유는 퍼센트 나열이 아니다`,
    `검색 창에 직무 평가와 부동산 키워드가 같이 붙었다`,
    `갤럽 동률과 리얼미터 격차가 같은 주에 겹쳤다`,
    `기관 차이가 검색 비교 질의로 번졌다`,
    `${SUPPORT}${topicParticle(SUPPORT)} 그 비교를 한 줄로 받지 않는다`,
    `${SUPPORT}는 공표와 검색 창을 처음부터 가른다`,
    `공식 조사 공표와 화제성 메모는 같은 칸이 아니다`,
    `${FOCUS} 보드는 공표 원문만 따로 둔다`,
    `표본오차 안에서 역전을 단정하면 허수다`,
    `허수는 정책 태그가 안 따라오는 관심이다`,
    `정책 질의가 따라오면 검색이 실제로 붙은 자리다`,
    `${name} 상세에서 태그와 한 줄을 겹쳐 본다`,
    `응원 해시태그 대신 정책 질의인지를 먼저 본다`,
    `정책 질의가 남으면 다음날 같은 탭에도 잔여가 있다`,
    `응원 키워드만 오르면 스팸성 언급에 가깝다`,
    gallup
      ? `전화면접과 ARS가 같은 주에 어긋난 자리다`
      : "조사 방법이 갈리면 검색이 붙는다",
    `${FOCUS} 관심의 촉매는 검색 품질이다`,
    `투자 자문으로 읽지 말고 검색 품질의 축만 따라간다`,
    `숫자는 표에 두고 이유는 검색 창에 남아 있다`,
  ]);
}

function methodSentences(): string[] {
  return uniqueLines([
    `한국갤럽은 전화면접으로 직무 평가를 따로 묻는다`,
    `리얼미터 주간집은 무선 ARS 비중이 큰 편이다`,
    `표본 크기와 오차 구간을 표에 먼저 적는다`,
    `의뢰 매체와 조사 기간을 한 줄에 같이 둔다`,
    `${FOCUS} 카드는 기관별로 나란히 둔다`,
    `비교 표는 긍정 부정 오차를 같이 보여 준다`,
    `선관위 등록 여부를 외부 링크로 확인한다`,
    `면접과 ARS를 한 평균으로 합치지 않고 칸을 가른다`,
    `공표 칸과 검색 칸을 처음부터 섞지 않는다`,
    `${FOCUS}를 응원 키워드로만 보면 허수다`,
    `${SUPPORT}가 빠지면 단일 이름 스파이크다`,
    `단일 스파이크는 다음날 같은 탭에서 먼저 식는다`,
    `테마 검색은 옆 이름까지 같이 끌어올린다`,
    `글의 쓸모는 내일 같은 탭에서 태그가 남았는지다`,
    `${SITE.name}는 이 왕복을 위해 이유를 숫자로 바꾸지 않는다`,
  ]);
}

function playbookSentences(dateLabel: string): string[] {
  return uniqueLines([
    `${dateLabel} 데스크는 ${FOCUS} 카드를 먼저 연다`,
    `조사 기간이 겹치는지부터 비교 표에 표시한다`,
    `오차 구간 밖 격차만 방향 문구로 따로 쓴다`,
    `${SUPPORT} 창과 공표 칸을 왕복해 읽는다`,
    `내부 링크 추천 주소는 대통령 지지도 보드다`,
    `외부 링크 한국갤럽에서 등록 원문을 연다`,
    `선관위 페이지에서 등록 번호를 원문과 맞춘다`,
    `본문 이유와 검색 태그가 같아야 오보가 줄어든다`,
    `${FOCUS} 검색이 정책 질의인지부터 적는다`,
    `${SUPPORT}가 바뀌면 어느 키워드 축인지 적는다`,
    `투자 신호로 읽지 말고 관측 메모로만 남긴다`,
    `다음 주 같은 요일에 표본오차 구간을 다시 본다`,
  ]);
}

function deskReserve(opts: {
  polls: PollBoardSnapshot;
  focus: string;
  name: string;
  dateLabel: string;
  peers: RankingEntity[];
}): string[] {
  const { focus, name, dateLabel, peers } = opts;
  const peerLines = peers.slice(0, 6).flatMap((peer) => {
    const peerName = plainName(peer.name);
    return [
      `${peerName} 검색이 ${name}${withParticle(name)} 같이 붙으면 테마 동조다`,
      `${peerName} 이름이 ${focus} 창에 섞이면 비교 질의가 붙었다`,
    ];
  });
  return uniqueLines([
    ...peerLines,
    `${dateLabel} ${focus} 데스크는 열 개 기관 칸부터 연다`,
    `${focus} 이슈는 공표 원문과 검색 창이 어긋나는지가 핵심이다`,
    `${SUPPORT}${subjectParticle(SUPPORT)} 같은 창에 붙으면 비교 테마가 번진 자리다`,
    `${name} 이름만 오르면 재검색이 하루 만에 끊기는 편이다`,
    `정책 태그가 안 따라오면 단타성 관심으로 읽는다`,
    `${focus} 창에 정책 질의가 섞이면 체류가 길어진다`,
    `${SUPPORT}${subjectParticle(SUPPORT)} 빠지면 단일 이름 스파이크로 읽힌다`,
    `${name} 커뮤니티 복제가 멈추는 순간 관심이 식는다`,
    `${focus} 상세의 한 줄이 본문 가설을 받쳐 줘야 한다`,
    `정치 실적은 공표와 헤드라인 중 하나가 먼저 나온다`,
    `${name} 위치는 결과일 뿐 ${focus}의 이유가 아니다`,
    `${focus}를 응원 키워드로만 보면 허수에 가깝게 읽힌다`,
    `${SUPPORT} 동조는 옆 이름이 같이 붙을 때다`,
    `${dateLabel} 다음 검색은 정책 태그가 남았는지다`,
    `${name} 정책 태그가 비면 다음날 같은 탭에서 먼저 식는다`,
    `${focus} 관심은 정책 단위로 내려갈 때 커진다`,
    `${name} 허수는 태그가 안 따라오는 관심에서 드러난다`,
    `${focus} 창의 정보 질의가 체류를 늘리는지 본다`,
    `${SUPPORT}${subjectParticle(SUPPORT)} 옆 이름까지 끌어올리는지 같이 본다`,
    `${name} 뉴스 헤드와 검색 창이 어긋나면 검색이 한 박자 빠르다`,
    `${dateLabel} ${name} 태그가 내일 같은 자리에 남는지 본다`,
    `${focus} 이슈를 이름 나열로 설명하면 허수가 된다`,
    `${name} 관심의 촉매는 검색 품질이지 공표 한 줄이 아니다`,
    `${focus} 브리핑은 이름 나열 대신 이유를 적는다`,
    `${SUPPORT} 동조가 옆 이름까지 번지는지 본다`,
    `${name} 커뮤니티 복제 속도가 허수를 가른다`,
    `${dateLabel} ${focus} 검색 축은 정책 아이템인지부터 가른다`,
    `${SUPPORT}와 ${name}${subjectParticle(name)} 한 창이면 테마가 맞물린 자리다`,
    `${name} 검색 품질이 정책 키워드면 체류가 길어지는 편이다`,
    `${focus} 창에 응원만 있고 정책이 비면 허수에 가깝다`,
    `${name} 재검색이 남는지는 다음날 같은 태그로 확인한다`,
    `${dateLabel} ${name} 화제는 조회 허수가 아니라 검색 품질이다`,
    `${focus} 태그가 ${SUPPORT}와 겹치면 테마 검색으로 읽는다`,
    `${name} 정보 질의와 응원 댓글이 섞이면 허수로 읽힌다`,
    `${focus}를 응원 해시태그로만 보면 허수에 가깝다`,
    `전화면접 축은 주중 창이 길고 ARS는 주말 속도가 빠르다`,
    `표본오차 구간을 먼저 적어야 역전을 방향처럼 쓰지 않는다`,
    `선관위 여론조사심의위에서 등록 원문을 맞춰 본다`,
    `조사 기간이 겹치지 않으면 같은 주라도 칸을 합치지 않는다`,
  ]);
}

export function composePoliticsDeskArticle(options: {
  polls: PollBoardSnapshot;
  market: RankingsPayload;
  editionDate: string;
}): BriefingArticle {
  resetEditorialPass();
  const { polls, market, editionDate } = options;
  const dateLabel = formatKoreanDate(editionDate);
  const snapshot = snapshotFromPayload(market);
  const politicsLead =
    snapshot.byType.politician_support?.[0] ??
    snapshot.byType.party_support?.[0] ??
    snapshot.gainers[0];
  const table = {
    caption: `${FOCUS} 기관 비교`,
    headers: ["기관", "조사기간", "긍정율", "부정율", "표본·오차", "증감"],
    rows: polls.polls.map((poll) => [
      poll.agencyLabel,
      poll.surveyedAt,
      `${poll.positive}%`,
      `${poll.negative}%`,
      `${poll.sampleSize}명 ±${poll.marginOfError}%p`,
      formatPollDelta(pollDelta(poll.positive, poll.previousPositive)),
    ]),
  };
  const peers = [
    ...(snapshot.byType.politician_support ?? []),
    ...(snapshot.byType.party_support ?? []),
    ...(snapshot.byType.headline_news ?? []),
  ]
    .filter((item) => item.id !== politicsLead?.id)
    .slice(0, 8);
  const lead = politicsLead ?? {
    id: "desk-lead",
    slug: "presidential-approval",
    name: FOCUS,
    nameEn: "Approval",
    type: "politician_support" as const,
    rank: 1,
    previousRank: 1,
    buzzScore: 1000,
    openScore: 1000,
    fluctuationRate: 0,
    volume: 0,
    sparkline: [],
    history: [],
    tags: [FOCUS],
    summary: "",
    analysis: "",
    products: [],
  };

  const draft: BriefingArticle = {
    id: `brief-${editionDate}-presidential-approval`,
    slug: `${editionDate}-presidential-approval`,
    kind: "deep-dive",
    category: "politician_support",
    editionDate,
    title: `${FOCUS}가 지금 검색을 흔든 이유, ${dateLabel} 정치 브리핑`,
    excerpt: `${FOCUS}의 배경과 ${SUPPORT} 파급을 오늘 창에서 가른다.`,
    publishedAt: editionDateTime(editionDate, 8, 5),
    updatedAt: editionDateTime(editionDate, 8, 5),
    readingMinutes: 4,
    wordCount: 0,
    relatedEntitySlugs: [lead, ...peers].map((item) => item.slug).slice(0, 6),
    focusKeyword: FOCUS,
    supportKeyword: SUPPORT,
    table: { ...table, markdown: tableMarkdown(table) },
    faq: [
      {
        question: `${FOCUS} 숫자가 검색 창 정당 칸과 같은가?`,
        answer:
          "아니다. 공식 여론조사 공표와 뉴스 언급은 다른 칸이다. 대통령 지지도 보드는 기관 원문을 따른다.",
      },
      {
        question: `열 개 기관 ${FOCUS}가 어긋나면 어느 쪽을 보나?`,
        answer:
          "조사 방법과 표본오차를 같이 읽는다. 면접과 ARS를 한 평균으로 합치지 말고 직무 평가 화제로 잔여를 본다.",
      },
      {
        question: `${SUPPORT}는 투자 신호나 공식 통계인가?`,
        answer:
          "공개된 직무 평가와 검색 창을 읽는 관측이다. 선관위 통계가 아니며 투자 자문으로 읽지 않는다.",
      },
    ],
    externalLink: {
      href: POLL_LINKS.gallup.href,
      label: POLL_LINKS.gallup.label,
      rel: "noopener noreferrer",
    },
    internalLink: { href: "/approval", label: "대통령 지지도가 검색을 흔든 이유" },
    sections: [
      {
        heading: numberedHeading(0, `${FOCUS}가 오늘 검색을 흔든 배경`),
        headingLevel: 2,
        kind: "tape",
        paragraphs: pollCause(polls, lead),
      },
      {
        heading: numberedHeading(1, `${SUPPORT}가 화제성을 키운 이유`),
        headingLevel: 2,
        kind: "briefing",
        paragraphs: whySentences(polls, lead),
      },
      {
        heading: numberedHeading(2, `${FOCUS} 파급이 붙는 창`),
        headingLevel: 3,
        kind: "briefing",
        paragraphs: methodSentences(),
      },
      {
        heading: numberedHeading(3, `정치에서 ${FOCUS}를 읽는 법`),
        headingLevel: 2,
        kind: "briefing",
        paragraphs: playbookSentences(dateLabel),
      },
      {
        heading: numberedHeading(4, `${SUPPORT} 다음 촉매가 남는 자리`),
        headingLevel: 3,
        kind: "briefing",
        paragraphs: uniqueLines([
          `${SUPPORT}${topicParticle(SUPPORT)} 사이트 검색 창에 고정된다`,
          `면접과 ARS가 같은 주에 어긋나면 비교 질의가 붙는다`,
          `정책 질의가 남으면 다음날 같은 탭에도 잔여가 있다`,
          `${lead.name} 태그가 안 따라오면 단타성 관심이다`,
          `태그가 따라오면 검색이 실제로 붙은 자리다`,
          `내부 링크 추천: [대통령 지지도가 검색을 흔든 이유]`,
        ]),
      },
    ],
  };

  const article = finalizeEditorialArticle(
    draft,
    deskReserve({
      polls,
      focus: FOCUS,
      name: plainName(lead.name),
      dateLabel,
      peers,
    }),
  );
  return withBriefingCover(article, { keyword: FOCUS });
}

export function composePoliticsDailyBriefing(market: RankingsPayload, editionDate = kstDateString()) {
  return composeArticle(market, {
    editionDate,
    kind: "deep-dive",
    category: "politician_support",
    publishedAt: editionDateTime(editionDate, 8, 20),
  });
}
