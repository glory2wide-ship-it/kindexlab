import { Fragment } from "react";
import Link from "next/link";
import { BriefingCover } from "@/components/briefing/BriefingCover";
import { ContentSlot } from "@/components/monetization/ContentSlot";
import { rankingPath } from "@/lib/slugs";
import { SITE } from "@/lib/site";
import type { TodayAnalysisArticle } from "@/lib/editorial/today-analysis";

export function TodayAnalysis({
  article,
  compact = false,
  entityHref,
}: {
  article: TodayAnalysisArticle;
  compact?: boolean;
  entityHref?: string;
}) {
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
        wordCount: article.wordCount,
        keywords: [article.focusKeyword, article.supportKeyword].join(", "),
        author: { "@type": "Organization", name: SITE.name },
        publisher: { "@type": "Organization", name: SITE.name },
      },
      {
        "@type": "FAQPage",
        mainEntity: article.faq.map((item) => ({
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
      <TitleTag className={`mt-2 font-semibold tracking-tight ${compact ? "text-xl" : "text-2xl md:text-3xl"}`}>
        {article.title}
      </TitleTag>
      <p className="mt-3 text-sm leading-6 text-muted">{article.excerpt}</p>
      <p className="mt-2 font-sans text-[11px] text-muted">
        {article.editionDate} · {article.readingMinutes}분 · {article.wordCount.toLocaleString("ko-KR")}어절
      </p>
      <p className="mt-3 text-sm">
        <Link href={boardHref} className="underline hover:text-accent">
          시세판에서 이 키워드 보기
        </Link>
      </p>

      {article.coverImage?.src ? (
        <div className="mt-5">
          <BriefingCover image={article.coverImage} />
        </div>
      ) : null}

      <div className={`mt-6 space-y-6 ${compact ? "text-[15px]" : ""}`}>
        {article.sections.map((section, index) => {
          const Heading = section.headingLevel === 3 ? "h4" : "h3";
          return (
            <Fragment key={`${section.heading}-${index}`}>
            <section>
              <Heading
                className={
                  section.headingLevel === 3
                    ? "mb-3 text-base font-semibold tracking-tight"
                    : "mb-3 text-lg font-semibold tracking-tight"
                }
              >
                {section.heading}
              </Heading>
              {section.paragraphs.map((paragraph, paragraphIndex) => (
                <AnalysisParagraph
                  key={`${index}-${paragraphIndex}`}
                  text={paragraph}
                  internal={article.internalLink}
                />
              ))}
              {index === 0 && article.table?.rows?.length ? (
                <div className="mt-5 overflow-x-auto rounded-xl border border-line">
                  <p className="border-b border-line px-3 py-2 text-sm font-semibold">{article.table.caption}</p>
                  <table className="w-full min-w-[28rem] border-collapse text-sm">
                    <thead className="bg-board/60">
                      <tr>
                        {article.table.headers.map((header) => (
                          <th key={header} className="border-b border-line px-3 py-2 text-left font-semibold">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {article.table.rows.map((row, rowIndex) => (
                        <tr key={`${row[0]}-${rowIndex}`} className="odd:bg-transparent even:bg-board/40">
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
              ) : null}
            </section>
            {index === 0 ? <ContentSlot placement="mid" label={article.focusKeyword} /> : null}
            </Fragment>
          );
        })}

        <section>
          <h3 className="mb-3 text-lg font-semibold tracking-tight">교차 확인 자료</h3>
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
        </section>

        <section>
          <h3 className="mb-3 text-lg font-semibold tracking-tight">FAQ</h3>
          <div className="space-y-4 text-sm leading-7">
            {article.faq.map((item) => (
              <div key={item.question}>
                <p>
                  <strong>Q. {item.question}</strong>
                </p>
                <p className="mt-1 whitespace-pre-line">A. {item.answer}</p>
              </div>
            ))}
          </div>
        </section>

        <ContentSlot placement="footer" label={article.focusKeyword} adFormat="auto" />
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
