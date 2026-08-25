import Link from "next/link";
import { BriefingCover } from "@/components/briefing/BriefingCover";
import { withBriefingCover } from "@/lib/briefing/cover";
import { isLiveEdition } from "@/lib/briefing/dates";
import { categoryLabel, heatmapHref } from "@/lib/briefing/metrics";
import { rankingPath } from "@/lib/slugs";
import type { BriefingArticle, RankingEntity } from "@/lib/types";

function SectionHeading({
  heading,
  level,
}: {
  heading: string;
  level: 2 | 3;
}) {
  if (level === 3) {
    return <h3 className="mb-3 text-base font-semibold tracking-tight">{heading}</h3>;
  }
  return <h2 className="mb-3 text-lg font-semibold">{heading}</h2>;
}

export function DailyBriefing({
  briefing,
  related = [],
}: {
  briefing: BriefingArticle;
  related?: RankingEntity[];
}) {
  const live = isLiveEdition(briefing.editionDate);
  const categoryHref = heatmapHref(briefing.category);
  const cover = withBriefingCover(briefing, {
    keyword: related[0]?.name,
    imageUrl: related[0]?.imageUrl,
  }).coverImage;

  return (
    <article className="rounded-2xl border border-line bg-panel px-5 py-8 md:px-10">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
        {briefing.kind === "main" ? "Daily Trend Analysis" : "Category Deep Dive"}
        {live ? " · Live Edition" : " · Archive"}
      </p>
      <h1 className="mt-2 max-w-3xl text-2xl font-semibold tracking-tight md:text-3xl">
        {briefing.title}
      </h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">{briefing.excerpt}</p>
      <p className="mt-4 font-mono text-[11px] text-muted">
        {briefing.editionDate} · {categoryLabel(briefing.category)} · {briefing.readingMinutes}분
        읽기 · 약 {briefing.wordCount.toLocaleString("ko-KR")}단어 · 애드센스 고품질 본문 기준 충족
      </p>

      {cover ? (
        <div className="mt-6 max-w-3xl">
          <BriefingCover image={cover} />
        </div>
      ) : null}

      <nav className="mt-6 flex flex-wrap gap-2 text-sm" aria-label="관련 시세판">
        <Link
          href="/#heatmap"
          className="rounded-full border border-line px-3 py-1.5 text-muted hover:text-ink"
        >
          종합 히트맵
        </Link>
        <Link
          href={categoryHref}
          className="rounded-full border border-line px-3 py-1.5 text-muted hover:text-ink"
        >
          {categoryLabel(briefing.category)} 보드
        </Link>
        <Link
          href={`/briefing/archive/${briefing.editionDate}`}
          className="rounded-full border border-line px-3 py-1.5 text-muted hover:text-ink"
        >
          {briefing.editionDate} 에디션
        </Link>
      </nav>

      <div className="prose-board mt-8 max-w-3xl space-y-8">
        {briefing.sections.map((section, index) => {
          const level = section.headingLevel === 3 ? 3 : 2;
          return (
            <section key={`${section.heading ?? "p"}-${index}`}>
              {section.heading ? <SectionHeading heading={section.heading} level={level} /> : null}
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph.slice(0, 24)} className="mb-4 text-[15px] leading-8 text-ink/90">
                  {paragraph}
                </p>
              ))}
            </section>
          );
        })}
      </div>

      {related.length > 0 ? (
        <div className="mt-10 border-t border-line pt-6">
          <p className="text-sm font-medium">관련 종목 시세</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {related.map((entity) => (
              <li key={entity.slug}>
                <Link
                  href={rankingPath(entity.slug)}
                  className="text-sm text-accent hover:underline"
                >
                  {entity.name} {entity.rank}위 →
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="mt-8 text-sm text-muted">
        숫자 확인은{" "}
        <Link href="/#heatmap" className="text-accent hover:underline">
          Finviz 스타일 종합 히트맵
        </Link>
        과{" "}
        <Link href={categoryHref} className="text-accent hover:underline">
          {categoryLabel(briefing.category)} 카테고리 보드
        </Link>
        에서 이어 읽으면 됩니다.
      </p>
    </article>
  );
}
