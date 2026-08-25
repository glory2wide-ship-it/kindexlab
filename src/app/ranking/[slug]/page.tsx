import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductShelf } from "@/components/affiliate/ProductShelf";
import { BuzzChart } from "@/components/entity/BuzzChart";
import { EntityHero } from "@/components/entity/EntityHero";
import { getAllSlugs, getEntityBySlug, getRelatedEntities } from "@/lib/api";
import { TYPE_LABEL, formatRate } from "@/lib/format";
import { SITE } from "@/lib/site";
import { rankingPath, rankingUrl } from "@/lib/slugs";
import type { EntityType } from "@/lib/types";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

export async function generateStaticParams() {
  if (process.env.TRENDS_DATA_SOURCE === "live") return [];
  const slugs = await getAllSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const entity = await getEntityBySlug(slug);
  if (!entity) return { title: "종목을 찾을 수 없습니다" };
  return {
    title: `${entity.name} ${entity.rank}위 · ${formatRate(entity.fluctuationRate)}`,
    description: entity.summary,
    alternates: { canonical: rankingPath(entity.slug) },
    openGraph: {
      title: `${entity.name} 버즈 시세`,
      description: entity.summary,
    },
  };
}

export default async function RankingDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const entity = await getEntityBySlug(slug);
  if (!entity) notFound();
  const related = await getRelatedEntities(entity);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: `${entity.name} 버즈 시세`,
    url: rankingUrl(SITE.url, entity.slug),
    description: entity.summary,
    mainEntity: {
      "@type": schemaType(entity.type),
      name: entity.name,
      alternateName: entity.nameEn,
    },
  };

  return (
    <div className="space-y-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <p className="text-sm text-muted">
        <Link href="/" className="hover:text-ink">
          시세판
        </Link>
        <span className="mx-2">/</span>
        {entity.name}
      </p>
      <EntityHero entity={entity} />
      <BuzzChart entity={entity} />
      <article className="rounded-2xl border border-line bg-panel p-6 md:p-8">
        <h2 className="text-xl font-semibold">오늘의 분석</h2>
        <p className="mt-4 text-[15px] leading-8">{entity.analysis}</p>
      </article>
      <ProductShelf products={entity.products} entityName={entity.name} />
      <section>
        <h2 className="mb-3 text-lg font-semibold">같은 섹터 종목</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {related.map((item) => (
            <li key={item.id}>
              <Link
                href={rankingPath(item.slug)}
                className="flex items-center justify-between rounded-xl border border-line bg-panel px-4 py-3 hover:border-accent/40"
              >
                <span>
                  <span className="block text-xs text-muted">
                    {TYPE_LABEL[item.type]} · {item.rank}위
                  </span>
                  <span className="font-medium">{item.name}</span>
                </span>
                <span
                  className={`font-mono text-sm ${
                    item.fluctuationRate > 0
                      ? "text-up"
                      : item.fluctuationRate < 0
                        ? "text-down"
                        : "text-muted"
                  }`}
                >
                  {formatRate(item.fluctuationRate)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function schemaType(type: EntityType): string {
  if (type === "tv_show" || type === "tv_rating") return "TVSeries";
  if (type === "music_chart") return "MusicRecording";
  if (type === "webtoon") return "ComicSeries";
  if (type === "shorts") return "VideoObject";
  if (type === "mobile_game" || type === "pc_game" || type === "console_game") return "VideoGame";
  return "Person";
}
