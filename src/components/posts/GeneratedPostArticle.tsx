import { Fragment } from "react";
import Link from "next/link";
import { ContentSlot } from "@/components/monetization/ContentSlot";
import { FactTable } from "@/components/article/FactTable";
import { FaqList } from "@/components/article/FaqList";
import { SectionHeading } from "@/components/article/SectionHeading";
import { SITE } from "@/lib/site";
import { channelHref, channelSectionHref, getPostChannel, inferPostChannel } from "@/lib/posts/channels";
import type { GeneratedPost } from "@/lib/posts/types";
import { DeskEyebrow } from "@/components/ui/DeskEyebrow";

export function GeneratedPostArticle({ post }: { post: GeneratedPost }) {
  const channel = getPostChannel(inferPostChannel(post));
  const canonicalPath = channelHref(channel.id, post.slug);
  const sections = post.sections ?? [];
  const hasTapeKind = sections.some((section) => section.kind === "tape");
  const tapeSections = hasTapeKind
    ? sections.filter((section) => section.kind === "tape")
    : sections.slice(0, 1);
  const restSections = sections.filter(
    (section) => !tapeSections.includes(section) && section.heading !== "교차 확인 자료",
  );
  const citations = (post.sources ?? []).filter(
    (source): source is typeof source & { url: string } => Boolean(source.url),
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
        ...(citations.length
          ? {
              citation: citations.map((source) => ({
                "@type": "NewsArticle",
                headline: source.summary,
                url: source.url,
                ...(source.label ? { publisher: { "@type": "Organization", name: source.label } } : {}),
                ...(source.publishedAt ? { datePublished: source.publishedAt } : {}),
              })),
            }
          : {}),
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
      <DeskEyebrow variant="base">
        {channel.eyebrow} · Magazine
      </DeskEyebrow>
      <h1 className="max-w-3xl text-2xl font-semibold tracking-tight md:text-3xl">{post.title}</h1>
      <p className="article-prose article-prose-lead max-w-3xl whitespace-pre-line text-muted">
        {post.excerpt}
      </p>
      <p className="font-mono text-[11px] text-muted">{post.editionDate} · 키워드 기반 이슈 칼럼</p>

      <div className="article-prose prose-board mt-4 max-w-3xl">
        {/* Fact table first: with the stock cover gone it opens the body and
            doubles as the summary for a reader who only scans. */}
        {post.table ? <FactTable table={post.table} /> : null}

        {tapeSections.map((section, index) => (
          <section key={`tape-${section.heading}-${index}`}>
            <SectionHeading as="h2">{section.heading}</SectionHeading>
            {section.paragraphs.map((paragraph, paragraphIndex) => (
              <p
                key={`tape-${index}-${paragraphIndex}`}
                className="article-prose-text mb-3 whitespace-pre-line text-ink"
              >
                {paragraph}
              </p>
            ))}
          </section>
        ))}

        <ContentSlot placement="intro" label={post.focusKeyword} />

        {restSections.map((section, index) => {
          const minor = section.headingLevel === 3;
          return (
            <Fragment key={`${section.heading}-${index}`}>
              <section>
                <SectionHeading as={minor ? "h3" : "h2"} tone={minor ? "minor" : "major"}>
                  {section.heading}
                </SectionHeading>
                {section.paragraphs.map((paragraph, paragraphIndex) => (
                  <p
                    key={`${index}-${paragraphIndex}`}
                    className="article-prose-text mb-3 whitespace-pre-line text-ink"
                  >
                    {paragraph}
                  </p>
                ))}
              </section>
              {index === 0 ? <ContentSlot placement="mid" label={post.focusKeyword} /> : null}
            </Fragment>
          );
        })}

        {post.externalLink || post.internalLink || citations.length ? (
          <section>
            <SectionHeading as="h2">교차 확인 자료</SectionHeading>
            <div className="space-y-2">
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
            {/* The column is written from retrieved reporting, so the reader gets
                the same list the writer worked from. Publisher names alone are
                not checkable, which is why entries without a URL are dropped. */}
            {citations.length ? (
              <ul className="mt-3 space-y-1">
                {citations.map((source) => (
                  <li key={source.id}>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-accent"
                    >
                      {source.summary}
                    </a>
                    <span className="ml-2 text-xs text-muted">{source.label}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}

        {post.faq?.length ? (
          <section>
            <SectionHeading as="h2">자주 묻는 질문</SectionHeading>
            <FaqList items={post.faq} />
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
