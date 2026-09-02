import { BriefingCard } from "@/components/briefing/BriefingCard";
import { FeaturedBriefingCard } from "@/components/briefing/FeaturedBriefingCard";
import { channelMainLabel, desksForChannel } from "@/lib/briefing/desks";
import { channelSectionHref, getPostChannel } from "@/lib/posts/channels";
import type { PostChannel } from "@/lib/posts/types";
import type { BriefingArticle } from "@/lib/types";

export function ChannelBriefingLayout({
  channel,
  main,
  dives,
  heading,
  titleLevel = 1,
}: {
  channel: PostChannel;
  main?: BriefingArticle;
  dives: BriefingArticle[];
  heading?: string;
  titleLevel?: 1 | 2;
}) {
  const meta = getPostChannel(channel);
  const desks = desksForChannel(channel);
  const hrefFor = (article: BriefingArticle) =>
    `${channelSectionHref(channel, "briefing")}/${article.slug}`;
  const TitleTag = titleLevel === 2 ? "h2" : "h1";
  const SectionTitle = titleLevel === 2 ? "h3" : "h2";

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <TitleTag className="text-2xl font-semibold tracking-tight md:text-3xl">
          {heading ?? `${meta.label} 일일브리핑`}
        </TitleTag>
        <p className="max-w-2xl text-sm leading-6 text-muted">
          상단은 {channelMainLabel(channel)}이고, 아래는 하부 메뉴별 심층 분석입니다. 지수(INDEX)는 키워드를 고르는
          트리거이고, 본문은 그 키워드만으로 쓴 독립 칼럼입니다.
        </p>
      </header>

      {main ? (
        <FeaturedBriefingCard article={main} href={hrefFor(main)} kicker={channelMainLabel(channel)} />
      ) : (
        <p className="rounded-2xl border border-dashed border-line bg-panel p-6 text-sm leading-6 text-muted">
          {meta.label} 종합 브리핑은 다음 에디션부터 같은 규격으로 붙습니다.
        </p>
      )}

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <SectionTitle className="text-lg font-semibold tracking-tight">하부 메뉴 심층 분석</SectionTitle>
          <p className="font-mono text-[11px] text-muted">{desks.length}개 데스크</p>
        </div>
        {desks.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {desks.map((desk) => {
              const article = dives.find((item) => item.deskId === desk.id);
              if (article) {
                return (
                  <BriefingCard
                    key={desk.id}
                    article={article}
                    href={hrefFor(article)}
                    kicker={desk.label}
                  />
                );
              }
              return (
                <article
                  key={desk.id}
                  className="rounded-2xl border border-dashed border-line bg-panel p-5"
                >
                  <span className="rounded-full border border-accent/40 px-2 py-0.5 font-sans text-[10px] font-semibold text-accent">
                    {desk.label}
                  </span>
                  <p className="mt-3 text-sm leading-6 text-muted">
                    {desk.label} 심층 분석은 같은 그리드 규격으로 다음 에디션에 붙습니다.
                  </p>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-line bg-panel p-6 text-sm leading-6 text-muted">
            {meta.label} 하부 메뉴가 열리면 같은 그리드에 심층 분석 카드가 자동으로 붙습니다.
          </p>
        )}
      </section>
    </div>
  );
}
