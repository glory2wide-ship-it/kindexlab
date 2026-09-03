/**
 * Import a Gemini (Gems) column as the politics 정부 지원금 → 자녀장려금
 * "오늘의 분석" entry so the heatmap detail page shows it.
 *
 *   npx tsx --env-file=.env.local scripts/import-gemini-child-credit.ts
 */
import { writeAnalysis } from "../src/lib/analysis/store";
import { kstDateString, editionDateTime } from "../src/lib/briefing/dates";
import { boardRowSlug } from "../src/lib/boards/heatmap";
import { analysisPlainText, type TodayAnalysisArticle } from "../src/lib/editorial/today-analysis";
import { tableMarkdown } from "../src/lib/editorial/rules";
import { rankingPath } from "../src/lib/slugs";

const BOARD = "government-support-fund";
const NAME = "[국세청] 자녀장려금";
const RELATED_NAME = "[국세청] 근로장려금";

function buildArticle(editionDate: string): TodayAnalysisArticle {
  const entitySlug = boardRowSlug(BOARD, NAME);
  const relatedSlug = boardRowSlug(BOARD, RELATED_NAME);
  const focusKeyword = "자녀장려금";
  const supportKeyword = "근로장려금";

  const table = {
    caption: "가구 유형별 자녀장려금 지급액 비교",
    headers: ["가구 유형", "부부합산 총소득 기준", "자녀당 지급액", "주요 특징"],
    rows: [
      ["홑벌이 가구", "7,000만 원 미만", "50만 원 ~ 100만 원", "총소득 2,100만 원 미만 시 최대액 지급"],
      ["맞벌이 가구", "7,000만 원 미만", "50만 원 ~ 100만 원", "총소득 2,500만 원 미만 시 최대액 지급"],
    ],
  };

  const article: TodayAnalysisArticle = {
    id: `today-${editionDate}-${entitySlug}`,
    slug: `${editionDate}-${entitySlug}-today`,
    entitySlug,
    title: "2026 자녀장려금 신청 조건 및 지급액 총정리: 대상자라면 꼭 챙겨야 할 핵심 혜택",
    excerpt:
      "아이를 키우는 가정이라면 매년 늘어나는 양육비 부담에 한숨이 깊어지기 마련입니다. 물가는 오르고 가계 지출은 커지는 요즘, 정부에서 지원하는 자녀장려금은 가계에 단비 같은 존재입니다.",
    editionDate,
    publishedAt: editionDateTime(editionDate),
    characterCount: 0,
    readingMinutes: 4,
    focusKeyword,
    supportKeyword,
    sections: [
      {
        heading: "❶ 2026 자녀장려금 핵심 신청 자격 조건",
        headingLevel: 2,
        paragraphs: [
          "과거와 달리 소득 기준이 대폭 완화되면서 더 많은 가정에 자녀장려금 혜택이 돌아가고 있습니다. 내가 과연 대상에 포함되는지, 얼마나 받을 수 있는지 꼼꼼하게 따져보아야 합니다. 이번 글에서 자격 요건부터 신청 방법까지 실무적인 내용을 명확하게 짚어드리겠습니다.",
          "자녀장려금을 받기 위해서는 가구, 소득, 재산이라는 세 가지 기준을 모두 충족해야 합니다. 요건 중 하나라도 누락되면 대상에서 제외되므로 꼼꼼한 확인이 필수입니다.",
        ],
      },
      {
        heading: "❷ 가구원 및 자녀 요건",
        headingLevel: 3,
        paragraphs: [
          "기준일 현재 18세 미만의 부양자녀가 반드시 있어야 합니다. 홑벌이 가구이거나 맞벌이 가구 모두 신청할 수 있으며, 부부합산 소득 기준을 함께 충족해야 합니다.",
          "법률상 배우자만 인정되며 사실혼 관계는 가구원 산정에서 제외됩니다. 자녀장려금 가구원 기준은 신청 전에 주민등록과 가족관계를 다시 맞추는 것이 안전합니다.",
        ],
      },
      {
        heading: "❸ 소득 및 재산 요건",
        headingLevel: 3,
        paragraphs: [
          "부부합산 연간 총소득이 7,000만 원 미만이어야 합니다. 또한 가구원 전체의 재산 합계액이 2억 4천만 원 미만이어야 안전하게 수급 대상이 됩니다.",
          "재산 산정 시 주택, 토지, 예금은 물론 자동차와 전세금까지 모두 포함되니 주의가 필요합니다. 자녀장려금 재산 기준은 부채를 빼지 않는 방식으로 잡히는 경우가 많아 체감과 다를 수 있습니다.",
        ],
      },
      {
        heading: "❹ 가구 유형별 자녀장려금 지급액 비교",
        headingLevel: 2,
        paragraphs: [
          "지원받을 수 있는 금액은 자녀 1인당 최소 50만 원에서 최대 100만 원까지 책정됩니다. 소득 구간과 가구 형태에 따라 차등 지급되므로 아래 표를 통해 나의 예상 금액을 가늠해 볼 수 있습니다.",
          "같은 자녀장려금이라도 홑벌이와 맞벌이의 최대액 구간이 달라집니다. 근로장려금과 함께 요건을 보면 가구 전체 지원 그림을 잡기 쉽습니다.",
        ],
      },
      {
        heading: "❺ 신청 기한 놓쳤을 때 대처하는 방법",
        headingLevel: 2,
        paragraphs: [
          "매년 5월은 정기 신청 기간으로 이 시기에 신청하는 것이 가장 유리합니다. 만약 이 기간을 놓쳤더라도 기한 후 신청 제도를 이용할 수 있어 구제받을 수 있습니다.",
          "5월 1일부터 5월 31일까지 정기 신청을 마쳐야 자녀장려금 전액을 온전히 수령할 수 있습니다. 6월 이후에 신청하는 기한 후 신청의 경우 원래 받을 수 있는 금액의 95%만 지급되므로 일정에 차질이 없도록 기억해야 합니다.",
          "국세청 모바일 앱인 손택스나 홈택스 홈페이지에 접속하면 안내문을 통해 몇 번의 터치만으로 간편하게 접수할 수 있습니다. 안내문이 없더라도 자격 요건을 충족한다면 직접 로그인하여 신청 메뉴에서 대상 여부를 조회하고 접수할 수 있습니다. 근로장려금 신청 화면에 자녀장려금이 함께 안내되는 경우도 있으니 함께 확인하세요.",
        ],
      },
    ],
    table: { ...table, markdown: tableMarkdown(table) },
    faq: [
      {
        question: "근로장려금과 자녀장려금을 동시에 중복으로 받을 수 있나요?",
        answer:
          "네, 두 장려금은 요건을 각각 충족한다면 중복으로 수령할 수 있으므로 함께 신청하는 것이 유리합니다.",
      },
      {
        question: "재산을 계산할 때 전세보증금이나 대출금도 포함되나요?",
        answer:
          "전세금은 재산 합계에 포함되지만, 은행 대출금 등 부채는 재산에서 차감되지 않으므로 산정 시 유의해야 합니다.",
      },
      {
        question: "안내 문자를 받지 못했는데 자격이 되는지 어떻게 확인하나요?",
        answer:
          "국세청 홈택스나 손택스 앱에 직접 로그인하여 장려금 신청 메뉴를 통해 대상자 여부를 직접 조회하고 간편하게 신청할 수 있습니다.",
      },
    ],
    externalLink: {
      href: "https://www.hometax.go.kr/",
      label: "국세청 홈택스 공식",
      rel: "noopener noreferrer",
    },
    internalLink: {
      href: rankingPath(relatedSlug),
      label: "2026 근로장려금 반기 및 정기 신청 조건 총정리",
    },
    reviewed: true,
  };

  article.characterCount = analysisPlainText(article).replace(/\s+/g, "").length;
  article.readingMinutes = Math.max(2, Math.round(article.characterCount / 500));
  return article;
}

async function main() {
  const editionDate = kstDateString();
  const article = buildArticle(editionDate);
  const slug = article.entitySlug;
  const generatedAt = new Date();
  const expiresAt = new Date(generatedAt.getTime() + 90 * 24 * 3600_000);

  const saved = await writeAnalysis({
    slug,
    keyword: NAME,
    editionDate,
    generatedAt: generatedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    article,
    provenance: {
      kind: "chain",
      newsDocs: 0,
      publishers: ["국세청 홈택스"],
      facts: [
        "부부합산 총소득 7,000만 원 미만",
        "재산 합계 2억 4천만 원 미만",
        "자녀 1인당 50만~100만 원",
      ],
      model: "import:gemini-gems",
      buildMs: 0,
    },
  });

  console.log(
    JSON.stringify(
      {
        slug,
        saved,
        chars: article.characterCount,
        title: article.title,
        focus: article.focusKeyword,
        support: article.supportKeyword,
        sections: article.sections.length,
        expiresAt: expiresAt.toISOString(),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
