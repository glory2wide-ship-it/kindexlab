import { Fragment } from "react";
import Link from "next/link";
import { BriefingCover } from "@/components/briefing/BriefingCover";
import { ContentSlot } from "@/components/monetization/ContentSlot";
import { SITE } from "@/lib/site";
import { channelHref, channelSectionHref, getPostChannel, inferPostChannel } from "@/lib/posts/channels";
import type { GeneratedPost } from "@/lib/posts/types";

export function GeneratedPostArticle({ post }: { post: GeneratedPost }) {
  const channel = getPostChannel(inferPostChannel(post));
  const canonicalPath = channelHref(channel.id, post.slug);
  const hasTapeKind = post.sections.some((section) => section.kind === "tape");
  const tapeSections = hasTapeKind
    ? post.sections.filter((section) => section.kind === "tape")
    : post.sections.slice(0, 1);
  const restSections = post.sections.filter(
    (section) => !tapeSections.includes(section) && section.heading !== "교차 확인 자료",
  );
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting",
        headline: post.title,
        description: post.excerpt,
        datePublished: post.publishedAt,
        dateModified: post.updatedAt,
        inLanguage: "ko",
        wordCount: post.wordCount || post.characterCount,
        keywords: [post.focusKeyword, post.supportKeyword].filter(Boolean).join(", "),
        articleSection: channel.label,
        author: { "@type": "Organization", name: SITE.name },
        publisher: { "@type": "Organization", name: SITE.name },
        mainEntityOfPage: `${SITE.url}${canonicalPath}`,
      },
      {
        "@type": "FAQPage",
        mainEntity: (post.faq ?? []).map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: { "@type": "Answer", text: item.answer },
        })),
      },
    ],
  };

  return (
    <article className="space-y-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <p className="text-sm text-muted">
        <Link href={channelSectionHref(channel.id, "posts")} className="hover:text-ink">
          이슈 칼럼
        </Link>
        <span className="mx-2">/</span>
        <Link href={channelSectionHref(channel.id, "posts")} className="hover:text-ink">
          {channel.label}
        </Link>
        <span className="mx-2">/</span>
        {post.editionDate}
      </p>
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
        {channel.eyebrow} · Magazine
      </p>
      <h1 className="max-w-3xl text-2xl font-semibold tracking-tight md:text-3xl">{post.title}</h1>
      <p className="max-w-3xl whitespace-pre-line text-sm leading-6 text-muted">{post.excerpt}</p>
      <p className="font-mono text-[11px] text-muted">
        {post.editionDate} · {post.readingMinutes}분 · {(post.wordCount || post.characterCount).toLocaleString("ko-KR")}
        어절 · 키워드 기반 이슈 칼럼
      </p>

      {post.coverImage?.src ? (
        <div className="max-w-3xl">
          <BriefingCover image={post.coverImage} />
        </div>
      ) : null}

      <div className="prose-board mt-4 max-w-3xl space-y-8">
        {tapeSections.map((section, index) => (
          <section key={`tape-${section.heading}-${index}`}>
            <h2 className="mb-3 text-lg font-semibold">{section.heading}</h2>
            {section.paragraphs.map((paragraph, paragraphIndex) => (
              <p
                key={`tape-${index}-${paragraphIndex}`}
                className="mb-3 whitespace-pre-line text-sm leading-7 text-ink"
              >
                {paragraph}
              </p>
            ))}
          </section>
        ))}

        <ContentSlot placement="intro" label={post.focusKeyword} />

        {post.table?.rows?.length ? (
          <section>
            <h2 className="mb-3 text-lg font-semibold">{post.table.caption}</h2>
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full min-w-[32rem] border-collapse text-sm">
                <thead className="bg-panel">
                  <tr>
                    {post.table.headers.map((header) => (
                      <th key={header} className="border-b border-line px-3 py-2 text-left font-semibold">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {post.table.rows.map((row, rowIndex) => (
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

        {restSections.map((section, index) => {
          const Heading = section.headingLevel === 3 ? "h3" : "h2";
          return (
            <Fragment key={`${section.heading}-${index}`}>
              <section>
                <Heading
                  className={
                    section.headingLevel === 3
                      ? "mb-3 text-base font-semibold tracking-tight"
                      : "mb-3 text-lg font-semibold"
                  }
                >
                  {section.heading}
                </Heading>
                {section.paragraphs.map((paragraph, paragraphIndex) => (
                  <p
                    key={`${index}-${paragraphIndex}`}
                    className="mb-3 whitespace-pre-line text-sm leading-7 text-ink"
                  >
                    {paragraph}
                  </p>
                ))}
              </section>
              {index === 0 ? <ContentSlot placement="mid" label={post.focusKeyword} /> : null}
            </Fragment>
          );
        })}

        {post.externalLink || post.internalLink ? (
          <section>
            <h2 className="mb-3 text-lg font-semibold">교차 확인 자료</h2>
            <div className="space-y-2 text-sm leading-7">
              {post.externalLink ? (
                <p>
                  외부 자료:{" "}
                  <a
                    href={post.externalLink.href}
                    target="_blank"
                    rel={post.externalLink.rel ?? "noopener noreferrer"}
                    className="underline hover:text-accent"
                  >
                    {post.externalLink.label}
                  </a>
                </p>
              ) : null}
              {post.internalLink ? (
                <p>
                  내부 링크 추천:{" "}
                  <Link href={post.internalLink.href} className="underline hover:text-accent">
                    [{post.internalLink.label}]
                  </Link>
                </p>
              ) : null}
            </div>
          </section>
        ) : null}

        {post.faq?.length ? (
          <section>
            <h2 className="mb-3 text-lg font-semibold">FAQ</h2>
            <div className="space-y-4 text-sm leading-7">
              {post.faq.map((item) => (
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

        <ContentSlot placement="footer" label={post.focusKeyword} adFormat="auto" />
      </div>

      <p className="max-w-3xl text-xs leading-6 text-muted">
        본문은 투자 자문이 아닙니다. 출처: {SITE.name} 이슈 키워드. 면책은{" "}
        <Link href="/disclaimer" className="underline">
          면책조항
        </Link>
        을 따릅니다.
      </p>
    </article>
  );
}
