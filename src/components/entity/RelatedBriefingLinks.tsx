import Link from "next/link";
import {
  channelBriefingHubHref,
  channelBriefingHubLabel,
  relatedBriefingsForEntity,
} from "@/lib/seo/related-briefings";
import type { RankingEntity } from "@/lib/types";

/**
 * Server-rendered briefing links on entity detail pages.
 * Strengthens the ranking ↔ text-rich briefing internal graph for crawlers.
 */
export async function RelatedBriefingLinks({ entity }: { entity: RankingEntity }) {
  const articles = await relatedBriefingsForEntity(entity, 4);
  const hubHref = channelBriefingHubHref(entity);
  const hubLabel = channelBriefingHubLabel(entity);

  return (
    <section className="detail-copy-110 space-y-3 rounded-2xl border border-line bg-panel px-4 py-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 className="text-lg font-semibold">관련 투데이 브리핑</h2>
        <Link href={hubHref} className="text-xs font-medium text-accent hover:underline">
          {hubLabel} 전체 →
        </Link>
      </div>
      <p className="text-[12px] leading-5 text-muted">
        수치 지수와 함께 같은 카테고리의 텍스트 브리핑을 보면 이슈 맥락을 더 빠르게 파악할 수 있습니다.
      </p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {articles.map((article) => (
          <li key={article.slug}>
            <Link
              href={`/briefing/${article.slug}`}
              className="block rounded-xl border border-line bg-board/40 px-3 py-2.5 hover:border-accent/40"
            >
              <span className="block text-[11px] text-muted">{article.editionDate}</span>
              <span className="mt-0.5 block text-sm font-medium leading-5 text-ink">
                {article.title}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
