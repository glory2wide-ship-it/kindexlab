"use client";

import { ContentSlot } from "@/components/monetization/ContentSlot";
import type { CachedBoard } from "@/lib/boards/types";

/**
 * The ranking report. AdSense slots sit at the intro/mid/footer marks.
 * Shopping shelves stay off until AdSense approval.
 */
export function BoardReportBody({ board }: { board: CachedBoard }) {
  const report = board.report;
  const sections = report?.sections ?? [];
  const midpoint = Math.max(1, Math.ceil(sections.length / 2));
  const table = report?.table;
  const faq = report?.faq ?? [];
  const target = report?.targetAnalysis ?? {
    heading: "세대별·성별 분석 리포트",
    headingLevel: 2 as const,
    paragraphs: ["이 보드의 세대·성별 분석은 다음 집계에서 채워집니다."],
  };

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };

  return (
    <article className="space-y-5">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{report?.title || board.title}</h1>
        <p className="text-sm leading-7 text-ink/85">{report?.excerpt || board.title}</p>
        <p className="text-xs text-muted">{board.editionDate}</p>
      </header>

      <ContentSlot placement="intro" />

      {sections.map((section, index) => (
        <div key={section.heading ?? index} className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">{section.heading}</h2>
          {(section.paragraphs ?? []).map((paragraph) => (
            <p key={paragraph} className="text-sm leading-7 text-ink/85">
              {paragraph}
            </p>
          ))}

          {index === 0 && table?.rows?.length ? (
            <div className="overflow-x-auto rounded-xl border border-line">
              <p className="border-b border-line px-3 py-2 text-sm font-semibold">
                {table.caption}
              </p>
              <table className="w-full min-w-[32rem] border-collapse text-sm">
                <thead className="bg-board/60">
                  <tr>
                    {(table.headers ?? []).map((header) => (
                      <th
                        key={header}
                        className="border-b border-line px-3 py-2 text-left font-semibold"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((row, rowIndex) => (
                    <tr key={`${row[0]}-${rowIndex}`} className="even:bg-board/40">
                      {row.map((cell, cellIndex) => (
                        <td
                          key={`${rowIndex}-${cellIndex}`}
                          className={`border-b border-line px-3 py-2 ${
                            cellIndex === 2 ? "font-sans tabular-nums" : ""
                          }`}
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {index === midpoint - 1 ? <ContentSlot placement="mid" /> : null}
        </div>
      ))}

      <div className="space-y-3 rounded-2xl border border-line bg-board/40 p-5">
        <h2 className="text-lg font-semibold tracking-tight">{target.heading}</h2>
        {(target.paragraphs ?? []).map((paragraph) => (
          <p key={paragraph} className="text-sm leading-7 text-ink/85">
            {paragraph}
          </p>
        ))}
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">자주 묻는 질문</h2>
        {faq.map((item) => (
          <div key={item.question} className="rounded-xl border border-line px-4 py-3">
            <p className="text-sm font-semibold">Q. {item.question}</p>
            <p className="mt-1 text-sm leading-7 text-ink/85">A. {item.answer}</p>
          </div>
        ))}
      </section>

      <ContentSlot placement="footer" />
    </article>
  );
}
