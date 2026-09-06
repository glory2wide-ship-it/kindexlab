import type { Metadata } from "next";
import Link from "next/link";
import { getRankings } from "@/lib/api";
import { listSeeded } from "@/lib/briefing/catalog";
import { channelSectionHref, isPostChannel } from "@/lib/posts/channels";
import { rankingPath } from "@/lib/slugs";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";

/**
 * Internal search.
 *
 * Results stay out of the index — a query-parameter page per keyword is the
 * kind of URL Google asks sites not to submit — while `follow` lets crawlers
 * walk through to briefing and desk pages listed here.
 */
export const metadata: Metadata = {
  title: "검색",
  description: `${SITE.name}에서 브리핑과 지수(INDEX) 항목을 검색합니다.`,
  robots: { index: false, follow: true },
};

const MAX_PER_GROUP = 12;

function normalise(value: string): string {
  return value.toLowerCase().replace(/\s+/g, "");
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string }>;
}) {
  const query = ((searchParams ? await searchParams : {}).q ?? "").trim();

  if (!query) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-ink">검색</h1>
        <p className="text-sm text-muted">
          찾고 싶은 키워드를 입력하세요. 브리핑과 지수(INDEX) 항목을 함께 찾아 드립니다.
        </p>
        <SearchForm defaultValue="" />
      </div>
    );
  }

  const needle = normalise(query);
  const [market, briefings] = await Promise.all([getRankings(), Promise.resolve(listSeeded())]);

  const briefingHits = briefings
    .filter((item) =>
      [item.title, item.excerpt ?? "", item.focusKeyword ?? ""].some((field) =>
        normalise(field).includes(needle),
      ),
    )
    .slice(0, MAX_PER_GROUP);

  const entities = market.items
    .filter((item) => [item.name, item.summary ?? ""].some((field) => normalise(field).includes(needle)))
    .slice(0, MAX_PER_GROUP);

  const total = briefingHits.length + entities.length;

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h1 className="text-2xl font-bold text-ink">‘{query}’ 검색 결과</h1>
        <p className="text-sm text-muted">{total}건을 찾았습니다.</p>
        <SearchForm defaultValue={query} />
      </div>

      {total === 0 ? (
        <div className="rounded-2xl border border-line bg-panel p-8 text-center">
          <p className="text-sm text-muted">
            일치하는 항목이 없습니다.{" "}
            <Link href="/briefing" className="text-ink underline">
              브리핑
            </Link>
            에서 최신 글을 확인해 보세요.
          </p>
        </div>
      ) : null}

      {briefingHits.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-ink">브리핑</h2>
          <ul className="space-y-2">
            {briefingHits.map((article) => (
              <li key={article.slug}>
                <Link
                  href={
                    isPostChannel(article.channel)
                      ? `${channelSectionHref(article.channel, "briefing")}/${article.slug}`
                      : `/briefing/${article.slug}`
                  }
                  className="block rounded-xl border border-line bg-panel p-4 transition hover:border-ink/30"
                >
                  <span className="block font-medium text-ink">{article.title}</span>
                  {article.excerpt ? (
                    <span className="mt-1 block text-sm text-muted line-clamp-2">{article.excerpt}</span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {entities.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-ink">지수(INDEX) 항목</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {entities.map((entity) => (
              <li key={entity.id}>
                <Link
                  href={rankingPath(entity.slug)}
                  className="block rounded-xl border border-line bg-panel p-4 transition hover:border-ink/30"
                >
                  <span className="block font-medium text-ink">{entity.name}</span>
                  {entity.summary ? (
                    <span className="mt-1 block text-sm text-muted line-clamp-2">{entity.summary}</span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function SearchForm({ defaultValue }: { defaultValue: string }) {
  return (
    <form action="/search" className="flex gap-2">
      <input
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder="키워드를 입력하세요"
        aria-label="검색어"
        className="w-full rounded-xl border border-line bg-panel px-4 py-2 text-sm text-ink outline-none focus:border-ink/40"
      />
      <button
        type="submit"
        className="shrink-0 rounded-xl border border-line bg-panel px-4 py-2 text-sm font-medium text-ink transition hover:border-ink/30"
      >
        검색
      </button>
    </form>
  );
}
