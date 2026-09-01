import { Fragment } from "react";
import Link from "next/link";
import { AffiliateWidget } from "@/components/affiliate/AffiliateWidget";
import { ContentSlot } from "@/components/monetization/ContentSlot";
import { stripRowQualifier } from "@/lib/boards/heatmap";
import { FactTable } from "@/components/article/FactTable";
import { FaqList } from "@/components/article/FaqList";
import { SectionHeading } from "@/components/article/SectionHeading";
import { SITE } from "@/lib/site";
import { formatCount } from "@/lib/format";
import { channelHref, channelSectionHref, getPostChannel, inferPostChannel } from "@/lib/posts/channels";
import type { GeneratedPost } from "@/lib/posts/types";

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
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
        {channel.eyebrow} · Magazine
      </p>
      <h1 className="max-w-3xl text-2xl font-semibold tracking-tight md:text-3xl">{post.title}</h1>
      <p className="max-w-3xl whitespace-pre-line text-sm leading-6 text-muted">{post.excerpt}</p>
      <p className="font-mono text-[11px] text-muted">
        {post.editionDate} · {post.readingMinutes ?? 1}분 · {formatCount(post.wordCount || post.characterCount)}
        어절 · 키워드 기반 이슈 칼럼
      </p>

      <div className="prose-board mt-4 max-w-3xl">
        {/* Fact table first: with the stock cover gone it opens the body and
            doubles as the summary for a reader who only scans. */}
        {post.table ? <FactTable table={post.table} /> : null}

        {tapeSections.map((section, index) => (
          <section key={`tape-${section.heading}-${index}`}>
            <SectionHeading as="h2">{section.heading}</SectionHeading>
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

        {post.externalLink || post.internalLink || citations.length ? (
          <section>
            <SectionHeading as="h2">교차 확인 자료</SectionHeading>
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
            {/* The column is written from retrieved reporting, so the reader gets
                the same list the writer worked from. Publisher names alone are
                not checkable, which is why entries without a URL are dropped. */}
            {citations.length ? (
              <ul className="mt-3 space-y-1 text-sm leading-7">
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
        {post.focusKeyword ? (
          <div className="mt-8 border-t border-line pt-8">
            <AffiliateWidget keyword={stripRowQualifier(post.focusKeyword)} channel={channel.id} placement="footer" />
          </div>
        ) : null}
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
