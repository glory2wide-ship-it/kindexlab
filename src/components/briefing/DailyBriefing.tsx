import { Fragment } from "react";
import Link from "next/link";
import { BriefingCover } from "@/components/briefing/BriefingCover";
import { ContentSlot } from "@/components/monetization/ContentSlot";
import { withBriefingCover } from "@/lib/briefing/cover";
import { isLiveEdition } from "@/lib/briefing/dates";
import { categoryLabel, heatmapHref } from "@/lib/briefing/metrics";
import { rankingPath } from "@/lib/slugs";
import { SITE } from "@/lib/site";
import { formatCount } from "@/lib/format";
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
  const tapeSections = briefing.sections.filter((section) => section.kind === "tape");
  const restSections = briefing.sections.filter(
    (section) => section.kind !== "tape" && section.heading !== "교차 확인 자료",
  );
  const jsonLd = briefing.faq?.length
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: briefing.faq.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: { "@type": "Answer", text: item.answer },
        })),
      }
    : null;

  return (
    <article className="rounded-2xl border border-line bg-panel px-5 py-8 md:px-10">
      {jsonLd ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      ) : null}
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
        {briefing.kind === "main" ? "Daily Trend Analysis" : "Category Deep Dive"}
        {live ? " · Live Edition" : " · Archive"}
      </p>
      <h1 className="mt-2 max-w-3xl text-2xl font-semibold tracking-tight md:text-3xl">
        {briefing.title}
      </h1>
      <p className="mt-3 max-w-3xl whitespace-pre-line text-sm leading-6 text-muted">{briefing.excerpt}</p>
      <p className="mt-4 font-mono text-[11px] text-muted">
        {briefing.editionDate} · {categoryLabel(briefing.category)} · {briefing.readingMinutes ?? 1}분
        읽기 · 약 {formatCount(briefing.wordCount)}단어 · 애드센스 고품질 본문 기준 충족
      </p>

      {cover ? (
        <div className="mt-6 max-w-3xl">
          <BriefingCover image={cover} />
        </div>
      ) : null}

      <nav className="mt-6 flex flex-wrap gap-2 text-sm" aria-label="관련 보드">
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
        {(tapeSections.length ? tapeSections : briefing.sections.slice(0, 1)).map((section, index) => {
          const level = section.headingLevel === 3 ? 3 : 2;
          return (
            <section key={`${section.heading ?? "tape"}-${index}`}>
              {section.heading ? <SectionHeading heading={section.heading} level={level} /> : null}
              {section.paragraphs.map((paragraph, paragraphIndex) => (
                <p
                  key={`tape-${index}-${paragraphIndex}`}
                  className="mb-4 whitespace-pre-line text-[15px] leading-8 text-ink/90"
                >
                  {paragraph}
                </p>
              ))}
            </section>
          );
        })}

        {briefing.table?.rows?.length ? (
          <section>
            <h2 className="mb-3 text-lg font-semibold">{briefing.table.caption}</h2>
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full min-w-[32rem] border-collapse text-sm">
                <thead className="bg-panel">
                  <tr>
                    {briefing.table.headers.map((header) => (
                      <th key={header} className="border-b border-line px-3 py-2 text-left font-semibold">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {briefing.table.rows.map((row, rowIndex) => (
                    <tr key={`${row[0]}-${rowIndex}`} className="odd:bg-transparent even:bg-panel/40">
                      {row.map((cell, cellIndex) => (
                        <td key={`${rowIndex}-${cellIndex}`} className="border-b border-line px-3 py-2">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {(tapeSections.length ? restSections : briefing.sections.slice(1).filter((section) => section.heading !== "교차 확인 자료")).map((section, index) => {
          const level = section.headingLevel === 3 ? 3 : 2;
          return (
            <Fragment key={`${section.heading ?? "p"}-${index}`}>
              <section>
                {section.heading ? <SectionHeading heading={section.heading} level={level} /> : null}
                {section.paragraphs.map((paragraph, paragraphIndex) => (
                  <p
                    key={`${index}-${paragraphIndex}`}
                    className="mb-4 whitespace-pre-line text-[15px] leading-8 text-ink/90"
                  >
                    {paragraph}
                  </p>
                ))}
              </section>
              {index === 0 ? <ContentSlot placement="mid" label={briefing.focusKeyword} /> : null}
            </Fragment>
          );
        })}

        {briefing.externalLink || briefing.internalLink ? (
          <section>
            <h2 className="mb-3 text-lg font-semibold">교차 확인 자료</h2>
            <div className="space-y-2 text-sm leading-7">
              {briefing.externalLink ? (
                <p>
                  외부 자료:{" "}
                  <a
                    href={briefing.externalLink.href}
                    target="_blank"
                    rel={briefing.externalLink.rel ?? "noopener noreferrer"}
                    className="underline hover:text-accent"
                  >
                    {briefing.externalLink.label}
                  </a>
                </p>
              ) : null}
              {briefing.internalLink ? (
                <p>
                  내부 링크 추천:{" "}
                  <Link href={briefing.internalLink.href} className="underline hover:text-accent">
                    [{briefing.internalLink.label}]
                  </Link>
                </p>
              ) : null}
            </div>
          </section>
        ) : null}

        {briefing.faq?.length ? (
          <section>
            <h2 className="mb-3 text-lg font-semibold">FAQ</h2>
            <div className="space-y-4 text-sm leading-7">
              {briefing.faq.map((item) => (
                <div key={item.question}>
                  <p>
                    <strong>Q. {item.question}</strong>
                  </p>
                  <p className="mt-1 whitespace-pre-line text-ink">A. {item.answer}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <ContentSlot placement="footer" label={briefing.focusKeyword} adFormat="auto" />
      </div>

      {related.length > 0 ? (
        <div className="mt-10 border-t border-line pt-6">
          <p className="text-sm font-medium">관련 이슈</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {related.map((entity) => (
              <li key={entity.slug}>
                <Link
                  href={rankingPath(entity.slug)}
                  className="text-sm text-accent hover:underline"
                >
                  {entity.name} 이슈 →
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="mt-8 text-sm text-muted">
        숫자 확인은{" "}
        <Link href="/#heatmap" className="text-accent hover:underline">
          종합 지수(INDEX)
        </Link>
        과{" "}
        <Link href={categoryHref} className="text-accent hover:underline">
          {categoryLabel(briefing.category)} 카테고리 보드
        </Link>
        에서 이어 읽으면 됩니다. 본문은 투자 자문이 아니며 {SITE.name} 관측입니다.
      </p>
    </article>
  );
}
