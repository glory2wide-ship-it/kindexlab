import type { Metadata } from "next";
import { INDEX_WEIGHTS, METHODOLOGY } from "@/data/methodology";
import { CATEGORIES } from "@/lib/categories";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "소개",
  description: `${SITE.name}의 데이터 구성과 시세 산출 방식. ${SITE.companyShort} 운영.`,
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-8">
      <header>
        <p className="font-mono text-xs text-accent">ABOUT</p>
        <h1 className="mt-2 text-3xl font-semibold">{SITE.name} 소개</h1>
        <p className="mt-3 leading-7 text-muted">{SITE.description}</p>
      </header>
      <section className="space-y-3 text-[15px] leading-8">
        <h2 className="text-xl font-semibold">무엇을 보나</h2>
        <p>
          {SITE.name}는 K-컬처 화제성을 금융 시세판의 문법으로 읽습니다. 트리맵은 거래량(검색·언급)을
          면적으로, 등락률을 색으로 보여 주고, 리스트는 같은 데이터를 정렬 가능한 표로 제공합니다.
          분봉부터 월봉까지 타임프레임을 바꾸면 단기 노이즈와 중기 추세를 같은 보드에서 비교할 수
          있습니다.
        </p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {CATEGORIES.filter((item) => item.id !== "all").map((item) => (
            <li key={item.id} className="rounded-lg border border-line bg-panel px-3 py-2 text-sm">
              {item.label}
            </li>
          ))}
        </ul>
      </section>
      <section className="space-y-3 text-[15px] leading-8">
        <h2 className="text-xl font-semibold">시세판은 어떻게 구성되나</h2>
        <p>
          각 종목은 검색량, 소셜 언급, 영상·스트리밍, 뉴스 톤, 쇼핑 의도 키워드를 가중 평균한
          버즈 점수로 정렬됩니다.   실시간 음원 차트는 스트리밍·검색 속도를, 실시간 시청률 순위는
          가구·분당 시청 지표를 같은 정규화 틀에 맞춰 표시합니다. 숏폼/SNS는 유튜브 조회를,
          모바일·PC·콘솔 게임은 스토어 순위와 동접을 같은 보드에 올립니다. Phase 1은 목 데이터와{" "}
          <code className="rounded bg-panel px-1">/api/rankings</code> 인터페이스를 제공합니다.
          이후 네이버 데이터랩, 음원 차트, 시청률, 유튜브·소셜 수집기를 같은 타입에 연결하면 됩니다.
        </p>
      </section>
      <section className="space-y-3 text-[15px] leading-8">
        <h2 className="text-xl font-semibold">{METHODOLOGY.title}</h2>
        <p className="text-sm text-muted">{METHODOLOGY.subtitle}</p>
        <p className="rounded-lg bg-panel px-3 py-2 font-mono text-xs leading-5">
          {METHODOLOGY.formula}
        </p>
        <ul className="space-y-2">
          {INDEX_WEIGHTS.map((item) => (
            <li key={item.key}>
              <span className="font-mono text-accent">{item.weight}%</span> {item.label} —{" "}
              {item.sources}
            </li>
          ))}
        </ul>
        {METHODOLOGY.paragraphs.map((paragraph) => (
          <p key={paragraph.slice(0, 20)}>{paragraph}</p>
        ))}
      </section>
      <section className="space-y-3 text-[15px] leading-8">
        <h2 className="text-xl font-semibold">문의</h2>
        <p>
          운영 문의, 개인정보, 콘텐츠 오류는{" "}
          <a href={`mailto:${SITE.contactEmail}`} className="text-accent hover:underline">
            {SITE.contactEmail}
          </a>
          또는{" "}
          <a href="/contact" className="text-accent hover:underline">
            문의하기
          </a>
          로 보내 주십시오.
        </p>
      </section>
    </article>
  );
}
