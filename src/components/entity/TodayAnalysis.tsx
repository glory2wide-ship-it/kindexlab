import { Fragment } from "react";
import Link from "next/link";
import { AffiliateWidget } from "@/components/affiliate/AffiliateWidget";
import { ContentSlot } from "@/components/monetization/ContentSlot";
import { FactTable } from "@/components/article/FactTable";
import { FaqList } from "@/components/article/FaqList";
import { SectionHeading } from "@/components/article/SectionHeading";
import { stripRowQualifier } from "@/lib/boards/heatmap";
import { rankingPath } from "@/lib/slugs";
import { SITE } from "@/lib/site";
import { analysisPlainText, type TodayAnalysisArticle } from "@/lib/editorial/today-analysis";
import { formatCount } from "@/lib/format";

export function TodayAnalysis({
  article,
  compact = false,
  entityHref,
  keyword,
}: {
  article: TodayAnalysisArticle;
  compact?: boolean;
  entityHref?: string;
  /** Clicked heatmap/list keyword, rendered in this section for later generated copy. */
  keyword?: string;
}) {
  const topic = stripRowQualifier(keyword ?? article.focusKeyword ?? "");
  const boardHref = entityHref ?? rankingPath(article.entitySlug);
  // The host page already owns the H1 (the keyword itself), so the column
  // headline is an H2 and its numbered subheads sit one level below that.
  const TitleTag = "h2";
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: article.title,
        description: article.excerpt,
        datePublished: article.publishedAt,
        dateModified: article.publishedAt,
        inLanguage: "ko",
        // schema.org wordCount means words, so it is derived rather than reusing 자수.
        wordCount: analysisPlainText(article).trim().split(/\s+/).filter(Boolean).length,
        keywords: [article.focusKeyword, article.supportKeyword].join(", "),
        author: { "@type": "Organization", name: SITE.name },
        publisher: { "@type": "Organization", name: SITE.name },
      },
      {
        "@type": "FAQPage",
        mainEntity: (article.faq ?? []).map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: { "@type": "Answer", text: item.answer },
        })),
      },
    ],
  };

  return (
    <article
      id="today-analysis"
      className={`scroll-mt-24 rounded-2xl border border-line bg-panel ${
        compact ? "p-5 md:p-6" : "p-6 md:p-8"
      }`}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <p className="font-sans text-[11px] font-semibold tracking-[0.14em] text-accent">오늘의 분석</p>
      {topic ? (
        <p data-analysis-keyword={topic} className="mt-2 text-sm font-semibold text-ink">
          키워드 · {topic}
        </p>
      ) : null}
      <TitleTag className={`mt-2 font-semibold tracking-tight ${compact ? "text-xl" : "text-2xl md:text-3xl"}`}>
        {article.title}
      </TitleTag>
      <p className="mt-3 text-sm leading-6 text-muted">{article.excerpt}</p>
      <p className="mt-2 font-sans text-[11px] text-muted">
        {article.editionDate} · {article.readingMinutes ?? 1}분 · {formatCount(article.characterCount)}자
      </p>
      <p className="mt-3 text-sm">
        <Link href={boardHref} className="underline hover:text-accent">
          지수(INDEX)에서 이 키워드 보기
        </Link>
      </p>

      {/* The fact table leads the body: it is the densest block on the page and
          now carries the opening visual weight on its own. */}
      <FactTable table={article.table} />

      <ContentSlot placement="intro" label={article.focusKeyword} />

      <div className={`mt-6 ${compact ? "text-[15px]" : ""}`}>
        {article.sections.map((section, index) => {
          const minor = section.headingLevel === 3;
          return (
            <Fragment key={`${section.heading}-${index}`}>
            {/* Mirrors the generated body: an ad band sits directly above every
                H2 except the first, which already follows the intro slot. */}
            {index > 0 && section.headingLevel === 2 ? (
              <ContentSlot placement="mid" label={article.focusKeyword} />
            ) : null}
            <section>
              <SectionHeading as={minor ? "h4" : "h3"} tone={minor ? "minor" : "major"}>
                {section.heading}
              </SectionHeading>
              {section.paragraphs.map((paragraph, paragraphIndex) => (
                <AnalysisParagraph
                  key={`${index}-${paragraphIndex}`}
                  text={paragraph}
                  internal={article.internalLink}
                />
              ))}
            </section>
            </Fragment>
          );
        })}

        <section>
          <SectionHeading as="h3">교차 확인 자료</SectionHeading>
          <p className="mb-2 text-sm leading-7">
            외부 자료:{" "}
            <a
              href={article.externalLink.href}
              target="_blank"
              rel={article.externalLink.rel ?? "noopener noreferrer"}
              className="underline hover:text-accent"
            >
              {article.externalLink.label}
            </a>
          </p>
          <p className="text-sm leading-7">
            내부 링크 추천:{" "}
            <Link href={article.internalLink.href} className="underline hover:text-accent">
              [{article.internalLink.label}]
            </Link>
          </p>
          {article.sources?.length ? (
            <ul className="mt-3 space-y-1 text-sm leading-7">
              {article.sources.map((source) => (
                <li key={source.url}>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-accent"
                  >
                    {source.title}
                  </a>
                  <span className="ml-2 text-xs text-muted">
                    {[source.publisher, source.publishedAt].filter(Boolean).join(" · ")}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section>
          <SectionHeading as="h3">자주 묻는 질문</SectionHeading>
          <FaqList items={article.faq ?? []} />
        </section>

        <ContentSlot placement="footer" label={article.focusKeyword} adFormat="auto" />
        {topic ? (
          <div className="mt-8 border-t border-line pt-8">
            <AffiliateWidget keyword={topic} placement="footer" />
          </div>
        ) : null}
      </div>
    </article>
  );
}

function AnalysisParagraph({
  text,
  internal,
}: {
  text: string;
  internal: TodayAnalysisArticle["internalLink"];
}) {
  const marker = `내부 링크 추천: [${internal.label}]`;
  if (text.includes(marker)) {
    const [before, after] = text.split(marker);
    return (
      <p className="mb-3 text-sm leading-7">
        {before}
        내부 링크 추천:{" "}
        <Link href={internal.href} className="underline hover:text-accent">
          [{internal.label}]
        </Link>
        {after}
      </p>
    );
  }
  return <p className="mb-3 whitespace-pre-line text-sm leading-7">{text}</p>;
}
