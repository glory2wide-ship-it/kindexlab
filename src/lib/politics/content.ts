import { POLITICS_TYPE_LABEL, POLITICS_TYPE_ORDER, type PoliticsEntityType } from "@/lib/politics/types";
import type { BriefingArticle, RankingEntity } from "@/lib/types";
import type { GeneratedPost, PostFaq, PostTable } from "@/lib/posts/types";

export interface PoliticsDeepDive {
  type: PoliticsEntityType;
  label: string;
  heading: string;
  paragraphs: string[];
  leader?: RankingEntity;
}

export function politicsTable(items: RankingEntity[]): PostTable {
  const leaders = POLITICS_TYPE_ORDER.map((type) => {
    const row = items.find((item) => item.type === type);
    return row;
  }).filter((item): item is RankingEntity => Boolean(item));

  const headers = ["주제", "오늘 키워드", "배경", "파급"];
  const rows = leaders.map((item) => [
    POLITICS_TYPE_LABEL[item.type as PoliticsEntityType] ?? item.type,
    item.name,
    "공공 토론 현장",
    "정책·일정 관심",
  ]);
  const markdown = [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");
  return {
    caption: "정치 이슈 키워드 대비표",
    headers,
    rows,
    markdown,
  };
}

export function politicsFaqs(items: RankingEntity[]): PostFaq[] {
  const subsidy = items.find((item) => item.type === "subsidy");
  const party = items.find((item) => item.type === "party_support");
  return [
    {
      question: "정치 보드 아홉 주제는 무엇을 다루나?",
      answer:
        "헤드라인 뉴스, 정당 지지도, 정치인 지지도, 정치 평론가, 정치 인플루언서, 정치뉴스 시청, 정치 검색어, 지자체 정책, 정부 지원금입니다. 각 칸은 오늘 화제인 키워드를 고르는 트리거입니다.",
    },
    {
      question: "정당·정치인 지지도는 공식 여론조사인가?",
      answer: party
        ? `아닙니다. ${party.name} 등 이름은 화제 키워드입니다. 한국갤럽·리얼미터 공표는 상세 페이지의 비교 표에서 따로 읽습니다.`
        : "아닙니다. 정당·정치인 이름은 화제 키워드이며 조사기관 공표와 다를 수 있습니다.",
    },
    {
      question: "정부 지원금 이슈는 어디서 신청하나?",
      answer: subsidy
        ? `${subsidy.name}처럼 화제가 된 지원 사업은 정부24와 복지로에서 자격·신청 기간을 확인하세요. 보드의 이름은 관심 키워드일 뿐입니다.`
        : "정부24와 복지로에서 자격과 신청 기간을 확인하세요. 보드의 이름은 관심 키워드일 뿐입니다.",
    },
  ];
}

export function politicsDeepDives(items: RankingEntity[]): PoliticsDeepDive[] {
  return POLITICS_TYPE_ORDER.map((type) => {
    const pool = items.filter((item) => item.type === type);
    const leader = pool[0];
    const second = pool[1];
    const label = POLITICS_TYPE_LABEL[type];
    const heading = `${label} 이슈 입문`;
    const paragraphs = leader
      ? [
          `${label}에서 오늘 이야기가 모인 키워드는 ${leader.name}입니다.`,
          second
            ? `${second.name} 이야기도 같은 현장에서 같이 읽힙니다.`
            : `${label} 주제는 배경을 알면 초보 입문이 빨라집니다.`,
          `${leader.name} 관심은 정책과 일정 질문으로 내려갈 때 구체적입니다.`,
        ]
      : [`${label} 키워드가 비면 다음 에디션에서 주제를 다시 고릅니다.`];
    return { type, label, heading, paragraphs, leader };
  });
}

export function politicsBriefingCopy(
  items: RankingEntity[],
  article?: BriefingArticle,
): { title: string; excerpt: string; paragraphs: string[] } {
  if (article) {
    return {
      title: article.title,
      excerpt: article.excerpt,
      paragraphs: article.sections.flatMap((section) => section.paragraphs).slice(0, 4),
    };
  }
  const leaders = POLITICS_TYPE_ORDER.map((type) => items.find((item) => item.type === type)).filter(
    Boolean,
  );
  const names = leaders
    .slice(0, 4)
    .map((item) => item!.name)
    .join("·");
  return {
    title: `오늘 정치 이슈: ${names || "아홉 주제"} 입문`,
    excerpt:
      "헤드라인부터 정부 지원금까지 아홉 주제의 키워드를 고릅니다. 공식 여론조사나 수급 심사가 아니라, 오늘 화제인 이름을 입문으로 푸는 칼럼입니다.",
    paragraphs: [
      `오늘 정치 대화의 키워드는 ${names || "헤드라인·정당·지원금"}입니다.`,
      "각 이름은 트리거일 뿐이고, 본문은 배경과 파급을 쉽게 풉니다.",
      "지원금·지자체 정책은 관심 키워드입니다. 신청은 정부24·복지로에서 확인하세요.",
    ],
  };
}

export function politicsPostTeasers(posts: GeneratedPost[], limit = 6): GeneratedPost[] {
  return posts.slice(0, limit);
}
