import { finalizeEditorialArticle } from "@/lib/briefing/compose";
import { withBriefingCover } from "@/lib/briefing/cover";
import { editionDateTime, formatKoreanDate } from "@/lib/briefing/dates";
import {
  numberedHeading,
  plainName,
  subjectParticle,
  topicParticle,
  withParticle,
} from "@/lib/editorial/copy";
import { tableMarkdown, uniqueLines, resetEditorialPass } from "@/lib/editorial/rules";
import {
  POLL_LINKS,
  formatPollDelta,
  pollDelta,
  pollMetricLabels,
  type PollBoardSnapshot,
} from "@/lib/politics/polls";
import type { BriefingArticle, RankingEntity, RankingsPayload } from "@/lib/types";

const SUPPORT = "여론조사 기관";

function focusOf(entity: RankingEntity, kind: PollBoardSnapshot["kind"]): string {
  if (kind === "presidential") return "대통령 지지도";
  if (kind === "party") return `${plainName(entity.name)} 지지도`;
  return `${plainName(entity.name)} 지지도`;
}

function introSentences(polls: PollBoardSnapshot, entity: RankingEntity, focus: string): string[] {
  const name = plainName(entity.name);
  const gallup = polls.polls.find((item) => item.agency === "gallup");
  const realmeter = polls.polls.find((item) => item.agency === "realmeter");
  return uniqueLines([
    `${focus}가 지금 붙은 배경은 한 기관 숫자가 아니다`,
    `전화면접과 ARS가 같은 주에 어긋나 비교 질의가 붙었다`,
    gallup
      ? `한국갤럽 평가는 이번 주 면접 축으로 공표됐다`
      : "한국갤럽 칸이 비면 면접 축을 따로 열어 읽는다",
    realmeter
      ? `리얼미터 평가는 이번 주 ARS 축으로 공표됐다`
      : "리얼미터 칸이 비면 ARS 축을 따로 열어 읽는다",
    `열 개 기관의 격차가 같은 주에 벌어져 검색이 붙었다`,
    `${name}${subjectParticle(name)} 검색 창에 기관 비교 질의가 바로 붙었다`,
    `표본오차 안 역전을 방향처럼 쓰면 원인을 놓친다`,
    `정책 질의가 남으면 다음날 비교 보드에도 잔여가 있다`,
  ]);
}

function methodSentences(focus: string, labels: { positive: string; negative: string }): string[] {
  return uniqueLines([
    `한국갤럽은 전화면접으로 ${labels.positive} 평가를 따로 묻는다`,
    `리얼미터 주간집은 무선 ARS 비중이 큰 편이다`,
    `엠브레인퍼블릭은 면접 컨소시엄 축에 가깝게 읽힌다`,
    `케이스탯리서치도 같은 주 면접 공표를 따로 낸다`,
    `코리아리서치는 면접 표본으로 잔여를 먼저 본다`,
    `리서치앤리서치는 의뢰 매체와 기간을 같이 적는다`,
    `한국사회여론연구소는 주중 면접 창이 길게 열린다`,
    `조원씨앤아이 ARS는 표본이 두꺼운 편으로 읽힌다`,
    `알앤써치 ARS는 헤드라인 속도가 빠른 축이다`,
    `에이스리서치 ARS는 주말 조사 창을 자주 연다`,
    `${focus} 카드는 기관별로 칸을 나란히 둔다`,
    `비교 표는 ${labels.positive}와 ${labels.negative} 오차를 같이 보여 준다`,
    `선관위 등록 여부는 외부 링크로 원문을 연다`,
    `면접과 ARS를 한 평균으로 합치지 않고 칸을 가른다`,
    `표본 크기와 오차 구간을 표에 먼저 적는다`,
    `${SUPPORT}${topicParticle(SUPPORT)} 방법 차이가 격차의 핵심이다`,
  ]);
}

function meaningSentences(
  polls: PollBoardSnapshot,
  entity: RankingEntity,
  focus: string,
  name: string,
): string[] {
  const labels = pollMetricLabels(polls.kind);
  const kindNote =
    polls.kind === "presidential"
      ? "직무 긍정과 부정은 같은 주에도 면접과 ARS가 갈린다"
      : polls.kind === "party"
        ? "정당 지지와 비지지는 이슈 주보다 고정층이 먼저 남는다"
        : "인물 호감과 비호감은 뉴스 한 건에 검색이 먼저 흔들린다";
  return uniqueLines([
    kindNote,
    `${name} 검색이 빨개져도 ${focus} 공표가 안 움직이면 화제다`,
    `${focus}가 움직여도 정책 태그가 안 따라오면 단타다`,
    `정책 질의와 응원 해시태그를 한 줄로 섞어 읽지 않는다`,
    `${SUPPORT} 이름이 검색 창에 같이 뜨면 비교 질의가 붙었다`,
    `${labels.positive} 격차가 오차 구간 안이면 방향을 단정하지 않는다`,
    `${labels.negative}${subjectParticle(labels.negative)} 같이 오르면 무당층이 빠져나간 자리다`,
    `부동산·연금 키워드가 ${focus} 창에 남으면 잔여가 있다`,
    `선관위 등록 원문과 헤드라인 숫자가 어긋나면 원문을 연다`,
    `투자 자문으로 읽지 말고 검색 품질과 공표만 적는다`,
    `${name}${subjectParticle(name)} 커뮤니티 복제가 멈추면 관심도 식는다`,
    `다음날 같은 탭에 ${focus} 태그가 남는지가 재료다`,
  ]);
}

function pollPadReserve(opts: {
  polls: PollBoardSnapshot;
  focus: string;
  name: string;
  dateLabel: string;
  peers: RankingEntity[];
}): string[] {
  const { polls, focus, name, dateLabel, peers } = opts;
  const labels = pollMetricLabels(polls.kind);
  const peerLines = peers.slice(0, 8).flatMap((peer) => {
    const peerName = plainName(peer.name);
    return [
      `${peerName} 검색이 ${name}${withParticle(name)} 같이 움직이면 테마 동조다`,
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
    `${name} ${labels.positive} 질의와 정책 질의가 실수요를 가른다`,
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
    `${labels.positive}만 보고 ${labels.negative}를 빼면 무당층을 놓친다`,
    `조사 기간이 겹치지 않으면 같은 주라도 칸을 합치지 않는다`,
  ]);
}

export function composeAgencyPollArticle(options: {
  polls: PollBoardSnapshot;
  entity: RankingEntity;
  market: RankingsPayload;
  editionDate: string;
}): BriefingArticle {
  resetEditorialPass();
  const { polls, entity, editionDate } = options;
  const dateLabel = formatKoreanDate(editionDate);
  const focus = focusOf(entity, polls.kind);
  const labels = pollMetricLabels(polls.kind);
  const name = plainName(entity.name);
  const table = {
    caption: `${focus} 기관 비교`,
    headers: ["기관", "조사기간", `${labels.positive}율`, `${labels.negative}율`, "표본·오차", "증감"],
    rows: polls.polls.map((poll) => [
      poll.agencyLabel,
      poll.surveyedAt,
      `${poll.positive}%`,
      `${poll.negative}%`,
      `${poll.sampleSize}명 ±${poll.marginOfError}%p`,
      formatPollDelta(pollDelta(poll.positive, poll.previousPositive)),
    ]),
  };
  const peers = options.market.items
    .filter((item) => item.id !== entity.id && (item.type === "politician_support" || item.type === "party_support"))
    .slice(0, 8);
  const relatedLabel =
    polls.kind === "presidential" ? "대통령 지지도가 검색을 흔든 이유" : `${name} 이슈가 검색을 흔든 이유`;

  const draft: BriefingArticle = {
    id: `brief-${editionDate}-poll-${entity.slug}`,
    slug: `${editionDate}-poll-${entity.slug}`,
    kind: "deep-dive",
    category: entity.type === "party_support" ? "party_support" : "politician_support",
    editionDate,
    title: `${focus}가 지금 검색을 흔든 이유, ${dateLabel} 비교 브리핑`,
    excerpt: `${focus}의 배경과 ${SUPPORT} 파급을 오늘 창에서 가른다.`,
    publishedAt: editionDateTime(editionDate, 8, 10),
    updatedAt: editionDateTime(editionDate, 8, 10),
    readingMinutes: 4,
    wordCount: 0,
    relatedEntitySlugs: [entity, ...peers].map((item) => item.slug).slice(0, 6),
    focusKeyword: focus,
    supportKeyword: SUPPORT,
    table: { ...table, markdown: tableMarkdown(table) },
    faq: [
      {
        question: `${focus} 숫자가 ${name} 검색 칸과 같은가?`,
        answer: [
          "아니다. 공식 공표와 뉴스 언급은 다른 칸이다",
          "기관 비교 보드는 원문 숫자를 따른다",
          "검색 창은 화제 두께를 보여 줄 뿐이다",
        ].join(". ") + ".",
      },
      {
        question: `열 개 기관 ${focus}가 어긋나면 어느 쪽을 보나?`,
        answer: [
          "조사 방법과 표본오차를 같이 읽는다",
          "면접과 ARS를 한 평균으로 합치지 않는다",
          "한 주의 방향만 단정하지 말고 잔여를 본다",
        ].join(". ") + ".",
      },
      {
        question: `${focus} 숫자가 투자 신호나 선관위 통계인가?`,
        answer: [
          "각 기관이 공표한 직무·지지 평가 스냅샷이다",
          "공식 선거 통계가 아니라 관측값이다",
          "투자 자문으로 읽지 말고 검색 품질의 축만 따른다",
        ].join(". ") + ".",
      },
    ],
    externalLink: {
      href: POLL_LINKS.nesdc.href,
      label: POLL_LINKS.nesdc.label,
      rel: "noopener noreferrer",
    },
    internalLink: {
      href: polls.kind === "presidential" ? "/approval" : "/politics",
      label: relatedLabel,
    },
    sections: [
      {
        heading: numberedHeading(0, `${focus}가 오늘 검색을 흔든 배경`),
        headingLevel: 2,
        kind: "tape",
        paragraphs: introSentences(polls, entity, focus),
      },
      {
        heading: numberedHeading(1, `${SUPPORT}가 화제성을 키운 이유`),
        headingLevel: 2,
        kind: "briefing",
        paragraphs: methodSentences(focus, labels),
      },
      {
        heading: numberedHeading(2, `${focus} 파급이 붙는 창`),
        headingLevel: 3,
        kind: "briefing",
        paragraphs: meaningSentences(polls, entity, focus, name),
      },
      {
        heading: numberedHeading(3, `정치에서 ${focus}를 읽는 법`),
        headingLevel: 2,
        kind: "briefing",
        paragraphs: uniqueLines([
          `${dateLabel}엔 ${focus} 카드를 먼저 연다`,
          `조사 기간이 겹치는지부터 비교 표에 표시한다`,
          `오차 구간 밖 격차만 방향 문구로 따로 쓴다`,
          `선관위 페이지에서 등록 번호를 원문과 맞춘다`,
          `본문 이유와 검색 태그가 같아야 오보가 줄어든다`,
        ]),
      },
      {
        heading: numberedHeading(4, `${SUPPORT} 다음 촉매가 남는 자리`),
        headingLevel: 3,
        kind: "briefing",
        paragraphs: uniqueLines([
          `공신력 있는 외부 페이지에서 원문 숫자를 맞춘다`,
          `내부 링크 추천: [${relatedLabel}]`,
          `${name} 상세에서 태그와 한 줄을 같이 연다`,
          `본문 이유와 검색 태그가 같아야 오보가 줄어든다`,
        ]),
      },
    ],
  };

  const article = finalizeEditorialArticle(
    draft,
    pollPadReserve({ polls, focus, name, dateLabel, peers }),
  );
  return withBriefingCover(article, { keyword: focus });
}
