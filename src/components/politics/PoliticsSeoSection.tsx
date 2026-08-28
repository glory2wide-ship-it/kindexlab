import Link from "next/link";
import { AdSlot } from "@/components/ads/AdSlot";
import { BriefingCard } from "@/components/briefing/BriefingCard";
import {
  politicsBriefingCopy,
  politicsDeepDives,
  politicsFaqs,
  politicsPostTeasers,
  politicsTable,
} from "@/lib/politics/content";
import { channelHref, channelSectionHref } from "@/lib/posts/channels";
import { rankingPath } from "@/lib/slugs";
import { SITE } from "@/lib/site";
import type { BriefingArticle, RankingEntity } from "@/lib/types";
import type { GeneratedPost } from "@/lib/posts/types";

export function PoliticsSeoSection({
  items,
  briefings,
  posts,
}: {
  items: RankingEntity[];
  briefings: BriefingArticle[];
  posts: GeneratedPost[];
}) {
  const main = briefings.find((item) => item.kind === "main") ?? briefings[0];
  const copy = politicsBriefingCopy(items, main);
  const table = politicsTable(items);
  const faqs = politicsFaqs(items);
  const dives = politicsDeepDives(items);
  const teasers = politicsPostTeasers(posts);
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        name: "정치 시세판",
        description: copy.excerpt,
        url: `${SITE.url}/politics`,
        inLanguage: "ko",
      },
      {
        "@type": "FAQPage",
        mainEntity: faqs.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: { "@type": "Answer", text: item.answer },
        })),
      },
    ],
  };

  return (
    <div className="space-y-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {briefings.length ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-xl font-semibold tracking-tight">브리핑 허브</h2>
            <Link href={channelSectionHref("politics", "briefing")} className="text-sm font-medium text-accent hover:underline">
              전체 보기
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {briefings.slice(0, 4).map((article) => (
              <BriefingCard
                key={article.slug}
                article={article}
                href={`${channelSectionHref("politics", "briefing")}/${article.slug}`}
              />
            ))}
          </div>
        </section>
      ) : null}

      <AdSlot format="in-article" />

      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">9대 지표 심층</h2>
        <p className="text-sm leading-6 text-muted">
          각 메뉴(헤드라인·정당·정치인·평론가·인플루언서·시청률·검색어·지자체 정책·정부 지원금)별 해설입니다.
        </p>
        <div className="grid gap-4 lg:grid-cols-2">
          {dives.map((dive) => (
            <article key={dive.type} className="rounded-2xl border border-line bg-panel p-5">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-accent">{dive.label}</p>
              <h3 className="mt-2 text-base font-semibold">{dive.heading}</h3>
              {dive.paragraphs.map((paragraph) => (
                <p key={paragraph.slice(0, 28)} className="mt-2 text-sm leading-7 text-ink">
                  {paragraph}
                </p>
              ))}
              {dive.leader ? (
                <Link
                  href={rankingPath(dive.leader.slug)}
                  className="mt-3 inline-block text-sm font-medium text-accent hover:underline"
                >
                  {dive.leader.name} 이슈 보기 →
                </Link>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      {teasers.length ? (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold tracking-tight">이슈 칼럼</h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {teasers.map((post) => (
              <li key={post.slug} className="rounded-2xl border border-line bg-panel p-4">
                <Link href={channelHref("politics", post.slug)} className="font-medium hover:text-accent">
                  {post.title}
                </Link>
                <p className="mt-1 text-sm leading-6 text-muted">{post.excerpt}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 text-xl font-semibold tracking-tight">{table.caption}</h2>
        <div className="overflow-x-auto rounded-xl border border-line bg-panel">
          <table className="w-full min-w-[32rem] border-collapse text-sm">
            <thead>
              <tr>
                {table.headers.map((header) => (
                  <th key={header} className="border-b border-line px-3 py-2 text-left font-semibold">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, rowIndex) => (
                <tr key={`${row[0]}-${rowIndex}`} className="odd:bg-transparent even:bg-board/50">
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
        {table.markdown ? (
          <pre className="mt-3 overflow-x-auto rounded-xl border border-dashed border-line bg-board p-3 font-mono text-[11px] leading-5 text-muted">
            {table.markdown}
          </pre>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">자주 묻는 질문</h2>
        <dl className="space-y-3">
          {faqs.map((item) => (
            <div key={item.question} className="rounded-2xl border border-line bg-panel p-5">
              <dt className="font-semibold">{item.question}</dt>
              <dd className="mt-2 text-sm leading-7 text-muted">{item.answer}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
