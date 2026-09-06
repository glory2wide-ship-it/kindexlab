/**
 * Exercises the LLM-override path of the "오늘의 분석" composer without calling
 * an LLM. Feeds deliberately awkward sections — long sentences, missing ❶
 * numbering, cliché phrasing — and asserts the composer still lands a column
 * that passes the editorial audit.
 *
 * Run: npx tsx scripts/check-analysis-override.ts
 */
import { stripCliche } from "@/lib/analysis/chain/editor";
import {
  composeTodayAnalysis,
  evaluateTodayAnalysis,
  type TodayAnalysisSection,
} from "@/lib/editorial/today-analysis";
import { getRankings } from "@/lib/api";

function fakeSections(name: string): TodayAnalysisSection[] {
  return [
    {
      heading: "화제의 출발점",
      headingLevel: 2,
      paragraphs: [
        `${name} 이야기가 번진 출발점은 방송 편성 변화였다. 제작진은 촬영 구성을 바꾸면서 출연 분량을 조정했다. 시청자는 그 변화를 곧바로 알아챘다.`,
        `결론적으로 ${name}에 대한 반응은 커뮤니티에서 먼저 나왔다. 그 뒤 기사화가 이어졌다.`,
      ],
    },
    {
      heading: "반응이 갈린 지점",
      headingLevel: 3,
      paragraphs: [
        `${name}을 둘러싼 반응은 세대별로 갈렸다. 오래 지켜본 시청자는 익숙함을 반겼다. 처음 접한 시청자는 설정 자체를 낯설게 봤다. 이 간극이 대화를 길게 만들었다.`,
      ],
    },
    {
      heading: "산업적 맥락",
      headingLevel: 2,
      paragraphs: [
        `${name} 사례는 예능 편성 전략의 변화를 보여준다. 주목받고 있다는 표현으로는 설명이 부족하다. 제작비 배분과 출연자 구성이 함께 움직였다.`,
      ],
    },
    {
      heading: "입문자를 위한 정리",
      headingLevel: 3,
      paragraphs: [
        `${name}을 처음 보는 사람은 초기 회차부터 순서대로 따라가면 맥락이 잡힌다. 인물 관계를 먼저 익히면 이해가 빠르다.`,
      ],
    },
  ];
}

async function main(): Promise<void> {
  const market = await getRankings();
  const entity = market.items[0];
  if (!entity) throw new Error("no entities on the board");

  const related = market.items.filter((item) => item.id !== entity.id).slice(0, 6);

  const base = composeTodayAnalysis({ entity, market, related });
  const baseReport = evaluateTodayAnalysis(base);

  const overridden = composeTodayAnalysis({
    entity,
    market,
    related,
    override: {
      title: `${entity.name} 이야기가 지금 번지는 이유`,
      excerpt: `${entity.name}을 둘러싼 반응과 배경을 정리한다.`,
      sections: fakeSections(entity.name),
    },
  });
  const overrideReport = evaluateTodayAnalysis(overridden);

  console.log(`entity: ${entity.name} (${entity.slug})`);
  console.log(
    `template : ok=${baseReport.ok} words=${baseReport.characterCount} failures=${JSON.stringify(baseReport.failures)}`,
  );
  console.log(
    `override : ok=${overrideReport.ok} words=${overrideReport.characterCount} failures=${JSON.stringify(overrideReport.failures)}`,
  );
  console.log(`override title used: ${overridden.title}`);
  console.log(`override first heading: ${overridden.sections[0]?.heading}`);
  console.log(
    `heading levels: ${overridden.sections.map((section) => section.headingLevel).join(",")}`,
  );

  const cliche = stripCliche("결론적으로 이 작품은 주목받고 있다. 귀추가 주목된다.");
  console.log(`cliche sweep: "${cliche}"`);

  if (!overrideReport.ok) {
    console.error("FAIL: override path did not reach a compliant column");
    process.exitCode = 1;
    return;
  }
  console.log("PASS");
}

void main();
