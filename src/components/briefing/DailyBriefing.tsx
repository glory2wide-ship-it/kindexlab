import { Fragment } from "react";
import Link from "next/link";
import { ContentSlot } from "@/components/monetization/ContentSlot";
import { FactTable } from "@/components/article/FactTable";
import { SectionHeading } from "@/components/article/SectionHeading";
import { isLiveEdition } from "@/lib/briefing/dates";
import { categoryLabel, heatmapHref } from "@/lib/briefing/metrics";
import {
  deskIdFromBriefingSlug,
  isStableInternalHref,
  resolveInternalLink,
} from "@/lib/premium/internal-link";
import { rankingPath } from "@/lib/slugs";
import { SITE } from "@/lib/site";
import { formatCount } from "@/lib/format";
import type { BriefingArticle, RankingEntity } from "@/lib/types";

export function DailyBriefing({
  briefing,
  related = [],
}: {
  briefing: BriefingArticle;
  related?: RankingEntity[];
}) {
  const live = isLiveEdition(briefing.editionDate);
  const categoryHref = heatmapHref(briefing.category);
  const internalLink = isStableInternalHref(briefing.internalLink?.href)
    ? briefing.internalLink!
    : resolveInternalLink({
        preferred: briefing.internalLink,
        channel: briefing.channel,
        deskId: briefing.deskId || deskIdFromBriefingSlug(briefing.slug, briefing.channel),
        labelHint: briefing.internalLink?.label || briefing.deskLabel || briefing.focusKeyword,
      });
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
          const minor = section.headingLevel === 3;
          return (
            <section key={`${section.heading ?? "tape"}-${index}`}>
              {section.heading ? (
                <SectionHeading as={minor ? "h3" : "h2"} tone={minor ? "minor" : "major"}>
                  {section.heading}
                </SectionHeading>
              ) : null}
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
          <section aria-labelledby="briefing-fact-table">
            <FactTable table={briefing.table} eyebrow="팩트 체크" />
          </section>
        ) : null}

        {(tapeSections.length ? restSections : briefing.sections.slice(1).filter((section) => section.heading !== "교차 확인 자료")).map((section, index) => {
          const minor = section.headingLevel === 3;
          return (
            <Fragment key={`${section.heading ?? "p"}-${index}`}>
              <section>
                {section.heading ? (
                  <SectionHeading as={minor ? "h3" : "h2"} tone={minor ? "minor" : "major"}>
                    {section.heading}
                  </SectionHeading>
                ) : null}
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

        {briefing.externalLink || internalLink ? (
          <section aria-labelledby="briefing-cross-links">
            <SectionHeading as="h2">교차 확인 자료</SectionHeading>
            <ul className="space-y-3 text-sm leading-7">
              {briefing.externalLink ? (
                <li>
                  <a
                    href={briefing.externalLink.href}
                    target="_blank"
                    rel={briefing.externalLink.rel ?? "noopener noreferrer"}
                    className="font-medium text-accent underline underline-offset-2 hover:text-ink"
                  >
                    {briefing.externalLink.label}
                  </a>
                  <span className="ml-2 text-muted">(외부 원문)</span>
                </li>
              ) : null}
              {internalLink ? (
                <li>
                  <Link
                    href={internalLink.href}
                    className="font-medium text-accent underline underline-offset-2 hover:text-ink"
                  >
                    {internalLink.label}
                  </Link>
                  <span className="ml-2 text-muted">(사이트 내부)</span>
                </li>
              ) : null}
            </ul>
          </section>
        ) : null}

        {briefing.faq?.length ? (
          <section aria-labelledby="briefing-faq">
            <SectionHeading as="h2">자주 묻는 질문</SectionHeading>
            <div className="space-y-6">
              {briefing.faq.map((item) => (
                <div key={item.question}>
                  <SectionHeading as="h3" tone="minor">
                    {item.question}
                  </SectionHeading>
                  <p className="whitespace-pre-line text-[15px] leading-8 text-ink/90">{item.answer}</p>
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
