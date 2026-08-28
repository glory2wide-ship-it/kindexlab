import { charLen, tableMarkdown, uniqueLines } from "@/lib/editorial/rules";
import type { IssueKeyword, IssueName } from "@/lib/editorial/issue-keyword";
import { SITE } from "@/lib/site";
import type { PostTable } from "@/lib/posts/types";
import type { EntityType } from "@/lib/types";

export function topicParticle(word: string): "은" | "는" {
  const last = word.at(-1);
  if (!last) return "는";
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return "는";
  return (code - 0xac00) % 28 === 0 ? "는" : "은";
}

export function subjectParticle(word: string): "이" | "가" {
  return topicParticle(word) === "은" ? "이" : "가";
}

export function objectParticle(word: string): "을" | "를" {
  return topicParticle(word) === "은" ? "을" : "를";
}

export function withParticle(word: string): "과" | "와" {
  return topicParticle(word) === "은" ? "과" : "와";
}

const sp = subjectParticle;
const op = objectParticle;
const wp = withParticle;

export function names(list: { name: string }[], n = 3): string {
  return list
    .slice(0, n)
    .map((item) => plainName(item.name))
    .join("·");
}

export function plainName(value: string): string {
  return value.replace(/[.:：]/g, " ").replace(/\s+/g, " ").trim();
}

export function briefName(value: string, max = 8): string {
  const clean = plainName(value);
  if (charLen(clean) <= max) return clean;
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const tail = parts.slice(-2).join(" ");
    if (charLen(tail) <= max + 4 && charLen(tail) >= 2) return tail;
  }
  return clean.slice(0, max).trim();
}

function topicLens(type: EntityType): {
  scene: string;
  spark: string;
  habit: string;
  noise: string;
  ripple: string;
} {
  switch (type) {
    case "kpop":
    case "music_chart":
      return {
        scene: "음원과 팬덤 문화",
        spark: "신보와 화보",
        habit: "재생과 착용 취향",
        noise: "응원 댓글만의 소음",
        ripple: "팬덤 밖 패션 관심",
      };
    case "celebrity":
      return {
        scene: "대중문화 현장",
        spark: "화보와 행사",
        habit: "일상 아이템 취향",
        noise: "이름만의 조회",
        ripple: "생활 소비 관심",
      };
    case "tv_show":
    case "tv_rating":
      return {
        scene: "방송 편성 문화",
        spark: "예고와 본방",
        habit: "따라 보기 습관",
        noise: "예고만의 호기심",
        ripple: "출연자와 장소 관심",
      };
    case "influencer":
      return {
        scene: "숏폼 창작 문화",
        spark: "협찬 컷과 라이브",
        habit: "따라 하기 습관",
        noise: "구독 독촉 댓글",
        ripple: "메뉴와 도구 관심",
      };
    case "webtoon":
      return {
        scene: "연재 작품 문화",
        spark: "회차와 댓글",
        habit: "정주행 습관",
        noise: "스포일러 도배",
        ripple: "원작과 굿즈 관심",
      };
    case "shorts":
      return {
        scene: "짧은 영상 문화",
        spark: "사운드 복제",
        habit: "따라 찍기 습관",
        noise: "조회만의 호기심",
        ripple: "템플릿 확산",
      };
    case "mobile_game":
    case "pc_game":
    case "console_game":
      return {
        scene: "플레이 문화",
        spark: "시즌 패치",
        habit: "공략 읽기 습관",
        noise: "이벤트 한정 소문",
        ripple: "장비와 공략 관심",
      };
    case "subsidy":
    case "local_policy":
      return {
        scene: "정책 안내 현장",
        spark: "접수 일정",
        habit: "자격 확인 습관",
        noise: "카톡 체인 소문",
        ripple: "서류와 대상 관심",
      };
    case "party_support":
    case "politician_support":
    case "headline_news":
    case "political_pundit":
    case "political_influencer":
    case "political_ratings":
    case "political_search":
      return {
        scene: "공공 토론 현장",
        spark: "공표와 헤드라인",
        habit: "정책 읽기 습관",
        noise: "응원 해시태그",
        ripple: "일정과 제도 관심",
      };
    default:
      return {
        scene: "대중 담론",
        spark: "뉴스와 클립",
        habit: "정보 찾기 습관",
        noise: "이름만의 호기심",
        ripple: "관련 키워드 확산",
      };
  }
}

export function pickIssueKeywords(keyword: IssueKeyword): { focus: string; supportKw: string } {
  return {
    focus: `${briefName(keyword.name)} 이슈`,
    supportKw: `${keyword.topicLabel} 화제`,
  };
}

export function numberedHeading(index: number, text: string): string {
  const marks = ["❶", "❷", "❸", "❹", "❺"];
  return `${marks[index] ?? `❶`} ${text}`;
}

export function relatedIssueTitle(name: string): string {
  return `${plainName(name)} 이슈가 지금 화제인 이유`;
}

export function buildIssueCompareTable(keywords: IssueKeyword[], caption: string): PostTable {
  const rows = keywords.slice(0, 5).map((item) => {
    const lens = topicLens(item.topic);
    return [item.name, lens.scene, lens.spark, lens.ripple];
  });
  const table: PostTable = {
    caption,
    headers: ["키워드", "배경", "화제성", "파급"],
    rows,
  };
  return { ...table, markdown: tableMarkdown(table) };
}

export function surgeCauseSentences(opts: {
  keyword: IssueKeyword;
  focus: string;
  supportKw: string;
}): string[] {
  const { keyword, focus, supportKw } = opts;
  const name = briefName(keyword.name);
  const lens = topicLens(keyword.topic);
  return uniqueLines([
    `${focus}가 지금 화제인 배경은 산업 흐름이다`,
    `${name} 이름은 ${lens.scene}에서 자주 오른다`,
    `${lens.spark}${sp(lens.spark)} 관심을 먼저 키운다`,
    `초보자는 ${name} 맥락부터 읽으면 이해가 빠르다`,
    `${focus}는 단순 유행 한 줄로 끝나지 않는다`,
    `${supportKw}가 겹치면 주제가 한층 넓어진다`,
    `${lens.habit}${sp(lens.habit)} 붙어야 관심이 오래 간다`,
    `${lens.noise}만 있으면 대화가 금방 식는다`,
    `${name} 키워드가 생활 이야기로 번지는 자리다`,
    `${lens.ripple}${sp(lens.ripple)} 남으면 파급이 밖으로 샌다`,
    `대중은 배경을 알 때 ${name}${op(name)} 더 오래 본다`,
    `${focus}를 유행어로만 보면 맥락을 놓친다`,
    `${keyword.topicLabel} 현장에서 이름이 반복된다`,
    `지금은 ${name}${op(name)} 설명하는 입문이 필요하다`,
  ]);
}

export function extraCauseSentences(opts: {
  keyword: IssueKeyword;
  focus: string;
  supportKw: string;
}): string[] {
  const { keyword, focus, supportKw } = opts;
  const name = briefName(keyword.name);
  const lens = topicLens(keyword.topic);
  return uniqueLines([
    `${focus}의 입문은 ${lens.scene}부터다`,
    `${name} 다음 질문은 ${lens.habit}인지다`,
    `${supportKw} 없이 이름만 외우면 이해가 얕다`,
    `${lens.spark}${sp(lens.spark)} 꺼져도 습관이 남아야 한다`,
    `${name} 대화가 멈추면 관심이 짧아진다`,
    `${focus}는 아이템 단위로 내려갈 때 커진다`,
    `${lens.noise}${wp(lens.noise)} 정보가 섞이면 혼선이다`,
    `${supportKw}가 옆 주제까지 끌어올리는지 본다`,
    `${lens.ripple}${sp(lens.ripple)} 남으면 파급이 하루를 넘긴다`,
    `초보 가이드는 ${name} 배경을 짧게 짚는다`,
  ]);
}

export function issueWhySentences(opts: {
  keyword: IssueKeyword;
  focus: string;
  supportKw: string;
}): string[] {
  const { keyword, focus, supportKw } = opts;
  const name = briefName(keyword.name);
  const lens = topicLens(keyword.topic);
  const peer = keyword.related[0]?.name;
  return uniqueLines([
    `${name}${sp(name)} 화제인 이유는 유행 한 줄이 아니다`,
    `${lens.scene}에서 ${name} 이야기가 반복되고 있다`,
    `${lens.spark}${sp(lens.spark)} 겹치며 대중의 질문이 늘었다`,
    `${focus}의 핵심은 왜 지금 회자되는가다`,
    `${lens.habit}${sp(lens.habit)} 붙어야 관심이 구체적인 자리다`,
    `${supportKw}가 같이 붙으면 주제가 테마로 읽힌다`,
    `테마는 다음날 대화에도 잔여를 남긴다`,
    peer
      ? `${briefName(peer)} 이야기도 같은 현장에서 묶인다`
      : `${name} 혼자 회자되는 단독 주제에 가깝다`,
    `${lens.noise}만 오르면 소문에 가깝게 읽힌다`,
    `초보자는 프로필보다 배경을 먼저 본다`,
    `${focus}는 투자 조언이 아니라 문화 입문이다`,
    `${lens.ripple}${sp(lens.ripple)} 붙으면 생활 관심으로 샌다`,
    `${keyword.topicLabel}${op(keyword.topicLabel)} 알면 ${name} 맥락이 열린다`,
    `지금은 입문 설명이 ${name} 이해를 돕는다`,
  ]);
}

export function searchQualitySentences(opts: {
  keyword: IssueKeyword;
  focus: string;
  supportKw: string;
}): string[] {
  const { keyword, focus, supportKw } = opts;
  const name = briefName(keyword.name);
  const lens = topicLens(keyword.topic);
  return uniqueLines([
    `${name} 파급은 단순 호기심과 결이 다르다`,
    `${lens.ripple}${sp(lens.ripple)} 생활 대화로 번지는지가 핵심이다`,
    `${focus} 관심은 습관으로 내려갈 때 커진다`,
    `${supportKw}가 같이 뜨면 주제가 넓어진다`,
    `뉴스와 입소문이 겹치면 이슈가 밖으로 샌다`,
    `뉴스 없이 이름만 오르면 팬덤 결집에 가깝다`,
    `커뮤니티가 이틀 연속 폭주하면 피로 신호다`,
    `${focus}를 이름 나열로 설명하면 맥락이 빈다`,
    `${lens.scene} 없이 프로필만 적으면 입문이 얕다`,
    `${name} 다음 관심은 ${lens.habit}인지 가른다`,
    `습관이 비면 대화가 하루 만에 끊긴다`,
    `${lens.ripple}${sp(lens.ripple)} 남는지가 파급의 길이다`,
    `초보자는 파급이 어디로 새는지부터 본다`,
    `${keyword.topicLabel} 현장에서 파급이 읽힌다`,
  ]);
}

export function deskPlaybookSentences(opts: {
  focus: string;
  supportKw: string;
  dateLabel: string;
  label: string;
}): string[] {
  const { focus, supportKw, dateLabel, label } = opts;
  return uniqueLines([
    `${dateLabel} 입문은 ${label} 배경부터 읽는다`,
    `${focus}를 연 뒤 맥락만 먼저 정리한다`,
    `이름 나열만 보지 말고 현장을 같이 읽는다`,
    `현장은 배경이고 습관은 이해의 깊이다`,
    `${supportKw}가 겹치면 주제가 테마로 묶인다`,
    `짧은 유행은 관심을 흔들고 습관이 남긴다`,
    `이벤트가 지나도 대화가 남아야 주제다`,
    `사흘이 지나도 이야기가 남으면 파급이다`,
    `초보자는 공식 안내와 입문 글을 같이 본다`,
    `${SITE.name} 칼럼은 배경을 쉽게 풀어 준다`,
    `글과 원문을 오가는 습관이 오해를 줄인다`,
    `모바일은 짧은 입문이 먼저 읽히기 쉽다`,
  ]);
}

export function peerIssueSentences(
  peers: IssueName[],
  topic: EntityType,
  focus: string,
  supportKw: string,
): string[] {
  const lens = topicLens(topic);
  const out: string[] = [];
  const shapes: Array<(peer: IssueName) => string[]> = [
    (peer) => {
      const name = briefName(peer.name);
      return [
        `${name}${sp(name)} ${lens.scene}에서 같이 회자된다`,
        `${name} 배경도 ${lens.spark} 쪽에 가깝다`,
        `${focus}와 ${name} 이야기가 한 주제로 묶인다`,
        `${name} 관심은 ${lens.habit}에서 두꺼워진다`,
      ];
    },
    (peer) => {
      const name = briefName(peer.name);
      return [
        `${supportKw}와 ${name} 주제가 겹치면 테마다`,
        `${name} 화제는 이름만의 호기심과 결이 다르다`,
        `${name} 다음 관심은 ${lens.spark} 쪽에 가깝다`,
        `${name} 대화에 ${lens.habit}${sp(lens.habit)} 남는지 본다`,
      ];
    },
    (peer) => {
      const name = briefName(peer.name);
      return [
        `${name} 대화가 멈추면 관심이 짧아진다`,
        `${name} 입문은 ${lens.habit}${op(lens.habit)} 찾아 본다`,
        `${name} 이해는 이름보다 배경에 가깝다`,
        `${name} ${lens.noise}만 있으면 소문에 가깝다`,
      ];
    },
  ];
  for (const [index, peer] of peers.slice(0, 8).entries()) {
    const shape = shapes[index % shapes.length];
    if (shape) out.push(...shape(peer));
  }
  return uniqueLines(out);
}

export function catalystSentences(keyword: IssueKeyword, focus: string, label: string): string[] {
  const name = briefName(keyword.name);
  const lens = topicLens(keyword.topic);
  return uniqueLines([
    `${label}에서 ${focus} 다음 관심은 습관 교체다`,
    `${lens.spark} 중 하나가 먼저 대화를 연다`,
    `습관이 이름보다 구체적일 때 이해가 깊다`,
    `이름만 오르고 습관이 비면 대화가 끊긴다`,
    `${name} 배경을 ${lens.scene}${wp(lens.scene)} 겹쳐 읽는다`,
    `사흘이 지나도 이야기가 남으면 지속이다`,
    `짧은 유행만 움직이면 ${lens.spark} 이벤트다`,
    `${SITE.name} 입문은 배경을 쉽게 풀어 준다`,
    `${focus} 칼럼은 전망이 아니라 맥락 메모다`,
    `${lens.ripple}${sp(lens.ripple)} 생활 관심으로 새는지가 파급이다`,
    `초보자는 앞으로 볼 습관만 적어두면 된다`,
    `${name} 전망은 ${lens.habit}${sp(lens.habit)} 남는지다`,
  ]);
}

export function insightSentences(opts: {
  keyword: IssueKeyword;
  focus: string;
  supportKw: string;
  dateLabel: string;
}): string[] {
  const { keyword, focus, supportKw, dateLabel } = opts;
  const name = briefName(keyword.name);
  const lens = topicLens(keyword.topic);
  return uniqueLines([
    `${dateLabel} 입문 메모의 축은 ${focus} 배경이다`,
    `${lens.scene}${op(lens.scene)} 빼면 이해가 바로 얕아진다`,
    `독자가 당장 할 일은 배경을 한 번 읽는 것이다`,
    `${focus}에 정보 질문이 섞이면 체류가 길다`,
    `${supportKw}가 빠지면 단독 유행에 가깝다`,
    `단독 유행은 다음날 대화에서 먼저 식는다`,
    `테마는 옆 이름까지 같이 끌어올린다`,
    `${focus}를 소문으로만 보면 맥락을 놓친다`,
    `허수는 습관이 안 따라오는 짧은 관심이다`,
    `습관이 따라오면 주제가 실제로 붙은 자리다`,
    `글의 쓸모는 내일이 되어도 맥락이 남는지다`,
    `${SITE.name} 칼럼은 이유를 숫자로 바꾸지 않는다`,
    `${name} 이해는 ${lens.habit}${sp(lens.habit)} 붙는지로 가른다`,
  ]);
}

function keywordBodyLines(
  peer: IssueName,
  topic: EntityType,
  focus: string,
  supportKw: string,
  dateLabel: string,
  label: string,
  index: number,
): string[] {
  const name = briefName(peer.name);
  const lens = topicLens(topic);
  const cycle = index % 6;
  if (cycle === 0) {
    return [
      `${dateLabel} ${name} 이야기는 ${lens.scene}에 붙어 있다`,
      `${focus}와 ${name} 맥락이 같이 뜨는지가 핵심이다`,
      `${name} 화제는 호기심과 이해를 갈라 본다`,
      `${name} 관심은 ${lens.habit}에서 먼저 두꺼워졌다`,
    ];
  }
  if (cycle === 1) {
    return [
      `${supportKw}가 ${name} 주제와 겹치면 테마다`,
      `${name} 다음 관심은 ${lens.habit}인지 본다`,
      `${name} 대화가 멈추면 관심이 먼저 짧아진다`,
      `${name} ${lens.spark}${sp(lens.spark)} 남으면 재료가 구체적이다`,
    ];
  }
  if (cycle === 2) {
    return [
      `${name} 배경은 ${lens.scene} 흐름으로 읽힌다`,
      `${label}에서 ${name} 맥락을 열어 재료를 가른다`,
      `${name} 관심은 이름보다 배경과 같이 읽는다`,
      `${name} ${lens.spark}${sp(lens.spark)} 꺼져도 습관이 남아야 한다`,
    ];
  }
  if (cycle === 3) {
    return [
      `${name} 유행만 반복하면 이슈 이유를 놓친다`,
      `${name} 입문과 본문 가설이 같아야 한다`,
      `${focus}와 ${name}${sp(name)} 한 주제면 테마다`,
      `${name} ${lens.noise}만 있으면 소문에 가깝다`,
    ];
  }
  if (cycle === 4) {
    return [
      `${name} ${lens.habit}${sp(lens.habit)} 붙으면 체류가 길어진다`,
      `${name} 뉴스와 입소문이 어긋나면 입소문이 빠르다`,
      `${label} 이름만 보면 ${name} 맥락을 놓친다`,
      `${name} 다음날 같은 대화에 주제가 남는지 본다`,
    ];
  }
  return [
    `${name} 팬덤과 실수요가 대화에서 갈린다`,
    `${focus}의 ${lens.habit}${sp(lens.habit)} 이해를 가른다`,
    `${name} 커뮤니티 이틀 연속 폭주는 피로 신호다`,
    `${supportKw} 없이 ${name}만 오르면 먼저 식는다`,
  ];
}

export function padIssueReserve(opts: {
  keyword: IssueKeyword;
  focus: string;
  supportKw: string;
  dateLabel: string;
  label: string;
}): string[] {
  const { keyword, focus, supportKw, dateLabel, label } = opts;
  const out: string[] = [];
  const roster = (
    keyword.related.length ? keyword.related : [{ name: keyword.name, slug: keyword.slug }]
  ).slice(0, 12);
  for (const [index, peer] of roster.entries()) {
    out.push(...keywordBodyLines(peer, keyword.topic, focus, supportKw, dateLabel, label, index));
  }
  const name = briefName(keyword.name);
  const lens = topicLens(keyword.topic);
  out.push(
    `${dateLabel} ${label} 입문은 ${name} 배경부터 연다`,
    `${focus}는 ${lens.habit}으로 내려가는지가 핵심이다`,
    `${supportKw}가 같은 주제에 붙으면 테마가 번진 자리다`,
    `${name} 이름만 오르면 대화가 하루 만에 끊긴다`,
    `${label} 습관이 안 따라오면 짧은 관심으로 읽는다`,
    `${focus}에 정보 질문이 섞이면 체류가 길어진다`,
    `${supportKw}가 빠지면 단독 유행으로 읽는다`,
    `${name} 대화가 멈추는 순간 관심이 식는다`,
    `${focus} 입문이 본문 가설을 받쳐 줘야 한다`,
    `${label} 재료는 ${lens.spark} 중 하나가 먼저 나온다`,
    `${focus}를 소문으로만 보면 맥락이 빈다`,
    `${supportKw} 동조는 옆 이름이 같이 붙을 때다`,
    `${name} ${lens.habit}${sp(lens.habit)} 이해를 가른다`,
    `${dateLabel} 다음 관심은 ${lens.habit}${sp(lens.habit)} 남았는지다`,
    `${focus} 짧은 유행만 움직이면 ${lens.spark} 이벤트다`,
    `${name} 사흘이 지나도 이야기가 남아야 지속이다`,
    `${label}에서 ${name} 배경을 다시 열어 본다`,
    `${focus} 칼럼은 예측이 아니라 맥락 메모다`,
    `${supportKw} 대화가 뉴스보다 한 박자 빠른 자리다`,
    `${name} 습관이 비면 다음날 대화에서 먼저 식는다`,
    `${focus} 관심은 습관 단위로 내려갈 때 커진다`,
    `${label} 이름만 보면 붙은 현장을 놓친다`,
    `${name} 허수는 습관이 안 따라오는 관심이다`,
    `${focus}의 정보 질문이 체류를 늘리는지 본다`,
    `${supportKw}가 옆 이름까지 끌어올리는지 같이 본다`,
    `${name} 뉴스와 입소문이 어긋나면 입소문이 빠르다`,
    `${dateLabel} ${name} 주제가 내일 같은 자리에 남는지 본다`,
    `${focus} 이슈를 이름 나열로 설명하면 허수가 된다`,
    `${label}에서 현장과 습관을 한 번에 읽어 재료를 가른다`,
    `${name} 관심의 촉매는 이해이지 유행 한 줄이 아니다`,
    `${focus} 칼럼은 이름 나열 대신 이유를 적는다`,
    `${supportKw} 동조가 옆 이름까지 번지는지 본다`,
    `${label}에서 배경과 현장을 같이 읽는다`,
    `${name} 대화 속도가 소문을 가른다`,
    `${supportKw}가 빠지면 다음날 관심이 먼저 식는다`,
    `${dateLabel} ${focus}의 축은 ${lens.habit}인지부터 가른다`,
    `${label}에서 ${name} 배경을 같이 읽는다`,
    `${supportKw}와 ${name}${sp(name)} 한 주제면 테마다`,
    `${name} 이해가 습관이면 체류가 길어지는 편이다`,
    `${name} 짧은 유행 하나에 관심이 바로 흔들리는 패턴이다`,
    `${name} 소음을 가리려면 사흘 잔여를 본다`,
    `${focus} 다음날 같은 대화가 비면 짧은 관심이다`,
    `${supportKw}가 사흘 대화와 같이 움직이면 주제가 쌓인다`,
    `${dateLabel} ${label}에서 글과 원문을 오가는 습관이 오해를 줄인다`,
    `${focus} 모바일은 짧은 입문이 먼저 읽힌다`,
    `${name} 다음 관심은 ${lens.spark} 어디에 붙었는지다`,
    `${label} 현장이 ${supportKw}와 같으면 테마로 본다`,
    `${focus}에 소문만 있고 습관이 비면 허수에 가깝다`,
    `${name} 재대화가 남는지는 다음날 같은 주제로 본다`,
    `${dateLabel} ${name} 화제는 호기심이 아니라 이해다`,
    `${focus}가 ${supportKw}와 겹치면 테마로 읽는다`,
    `${label} 이름만 보지 말고 현장도 같이 읽는다`,
    `${name} 예고에 관심이 먼저 흔들리는 패턴이다`,
    `${focus} 본방이 지나도 대화가 남아야 주제다`,
    `${supportKw} 옆 이름까지 붙으면 테마가 번진 것이다`,
    `${name} 정보 질문과 응원 댓글이 섞이면 소문이다`,
    `${label}에서 ${name} 입문을 본문과 겹쳐 본다`,
    `${focus} 관심 두께는 이름 나열보다 습관에 가깝다`,
    `${dateLabel} ${supportKw}가 같은 대화에 남는지가 핵심이다`,
    `${name} 정보 질문이 붙으면 체류가 길어지는 흐름이다`,
    `${focus}를 유행 한 줄로만 설명하면 이유를 놓친다`,
    `${label} 현장은 이슈가 붙은 자리다`,
    `${name} 팬덤과 실수요가 대화에서 갈린다`,
    `${supportKw} 없이 이름만 오르면 다음날 먼저 식는다`,
    `${dateLabel} ${label} 칼럼은 ${name} 배경을 적는다`,
    `${name} 뉴스와 입소문이 어긋나면 입소문이 빠르다`,
    `${focus} 이슈의 배경은 유행이 아니라 현장에 있다`,
    `${name} 논란형 관심보다 이해를 우위에 둔다`,
    `${supportKw}가 습관 단위면 재료가 구체적인 자리다`,
    `${focus} 다음날 같은 자리에서 주제가 비었는지 본다`,
    `${name} 커뮤니티 이틀 연속 폭주는 피로 신호다`,
    `${label} 본문 이유와 배경이 같아야 오해가 줄어든다`,
    `${dateLabel} ${name} 관심은 ${lens.habit}인지 가른다`,
    `${focus} 관심을 유행 문장으로 다시 쓰지 않는다`,
    `${supportKw} 동조가 멈추면 옆 이름이 먼저 빠진다`,
    `${name} 프로필 요약 대신 지금 붙은 배경을 적는다`,
    `${name} 입문은 ${lens.habit}${wp(lens.habit)} 같은 자리다`,
    `${focus} 질문도 같은 습관 이름으로 이어진다`,
    `${label}에서 취향과 소문을 섞어 읽지 않는다`,
    `${dateLabel} ${name} ${lens.scene}${sp(lens.scene)} 비면 재료가 빠진다`,
    `${focus} 관심은 ${lens.spark}${sp(lens.spark)} 꺼진 뒤에도 남는지다`,
    `${supportKw}가 ${lens.scene}${wp(lens.scene)} 겹치면 테마로 이어진다`,
    `${name} 이름만 보지 말고 ${lens.habit}${op(lens.habit)} 연다`,
    `${label}에서 ${lens.habit}${sp(lens.habit)} 이해를 가른다`,
    `${focus}를 ${lens.noise}로만 보면 소문에 가깝다`,
    `${name} 재대화는 습관이 남았는지로 본다`,
    `${dateLabel} ${supportKw} 동조가 옆 주제까지 번지는지 본다`,
    `${label}${topicParticle(label)} ${name} 이유를 유행 대신 배경으로 적는다`,
    `${focus}에 정보 질문이 섞이면 체류가 길다`,
    `${name} 관심은 ${lens.scene} 유입이 먼저 두꺼워진 결과다`,
    `${lens.ripple}${sp(lens.ripple)} 생활 관심으로 새면 파급이 길다`,
    `초보자는 ${name} 배경 한 줄이면 입문이 된다`,
    `앞으로의 관전 포인트는 ${lens.habit}${sp(lens.habit)} 남는지다`,
    `${focus} 전망은 유행이 아니라 습관의 잔여다`,
  );
  const seen = new Set<string>();
  const fitted: string[] = [];
  for (const raw of out) {
    const body = raw.replace(/\s+/g, " ").replace(/\.+$/, "").trim();
    if (!body || seen.has(body)) continue;
    const len = charLen(body);
    if (len < 20 || len > 40) continue;
    seen.add(body);
    fitted.push(`${body}.`);
  }
  return fitted.length ? fitted : uniqueLines(out);
}

export function buildIssueFaq(opts: {
  keyword: IssueKeyword;
  focus: string;
  supportKw: string;
  label: string;
}): { question: string; answer: string }[] {
  const { keyword, focus, supportKw, label } = opts;
  const name = briefName(keyword.name);
  const lens = topicLens(keyword.topic);
  // FAQ answers are authored at full sentence length on purpose: they bypass
  // the reserve-clause padding, so a short line here would be dropped outright.
  return [
    {
      question: `${focus}가 지금 화제인 이유는 뭔가?`,
      answer:
        [
          `${name} 이야기가 ${lens.scene} 안에서 꾸준히 반복되고 있다`,
          `${lens.spark} 같은 재료가 같은 시기에 한꺼번에 겹친 자리다`,
          `${supportKw}가 같이 붙으면 단독 유행이 아니라 테마로 읽는다`,
        ].join(" "),
    },
    {
      question: `${label} 초보자는 ${focus}를 어디서 시작하나?`,
      answer:
        [
          `${lens.scene} 배경을 짧게 읽은 뒤에 대중의 습관을 확인한다`,
          `${lens.ripple}${sp(lens.ripple)} 생활 대화로 새는지를 이어서 살펴본다`,
          `소문만 있고 습관이 따라오지 않으면 짧은 유행으로 본다`,
        ].join(" "),
    },
    {
      question: `${focus} 설명이 투자 신호나 공식 통계인가?`,
      answer:
        [
          `공개된 화제와 문화 배경만 읽는 입문 성격의 글이다`,
          `공식 통계나 투자 조언이 아니라 맥락을 적은 메모에 가깝다`,
          `전망도 습관이 남는지로만 가르고 숫자로 단정하지 않는다`,
        ].join(" "),
    },
  ];
}
