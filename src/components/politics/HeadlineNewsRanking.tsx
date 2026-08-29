"use client";

import { useEffect, useState } from "react";
import { MarketWorkspace } from "@/components/dashboard/MarketWorkspace";
import { TickerTape } from "@/components/ticker/TickerTape";
import { headlinesToEntities } from "@/lib/news/headline-entities";
import type { HeadlineRankingSnapshot, HeadlineChannel } from "@/lib/politics/headlines";
import type { PostChannel } from "@/lib/posts/types";
import type { RankingEntity } from "@/lib/types";

function headlineTopic(channel: PostChannel): HeadlineChannel {
  if (channel === "entertainment") return "entertainment";
  if (channel === "economy") return "economy";
  if (channel === "culture") return "culture";
  return "politics";
}

const COPY: Record<
  HeadlineChannel,
  { title: string; boardSlug: string; source: string }
> = {
  politics: {
    title: "정치 헤드라인 뉴스 랭킹",
    boardSlug: "headline-news-ranking",
    source: "네이버·다음 정치 섹션과 포털 헤드라인을 합산합니다. 박스를 누르면 내부 상세 페이지로 이동합니다.",
  },
  entertainment: {
    title: "엔터 헤드라인 뉴스 랭킹",
    boardSlug: "ent-headline-news-ranking",
    source: "네이버·다음 연예 섹션과 포털 헤드라인을 합산합니다. 박스를 누르면 내부 상세 페이지로 이동합니다.",
  },
  economy: {
    title: "경제 헤드라인 뉴스 랭킹",
    boardSlug: "eco-headline-news-ranking",
    source: "네이버·다음 경제 섹션과 포털 헤드라인을 합산합니다. 박스를 누르면 내부 상세 페이지로 이동합니다.",
  },
  culture: {
    title: "문화/여행/맛집/레져/생활 헤드라인 뉴스 랭킹",
    boardSlug: "culture-headline-news-ranking",
    source:
      "문화·예술, 전시·공연, 여행·숙박, 음식·맛집, 캠핑·레저, 생활·건강·트렌드 기사만 수집합니다. 박스를 누르면 내부 상세 페이지로 이동합니다.",
  },
};

export function HeadlineNewsRanking({
  channel = "politics",
  onItems,
}: {
  channel?: PostChannel;
  onItems?: (items: RankingEntity[]) => void;
}) {
  const topic = headlineTopic(channel);
  const copy = COPY[topic];
  const [items, setItems] = useState<RankingEntity[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const response = await fetch(`/api/headlines?channel=${topic}`, { cache: "no-store" });
        if (!response.ok) throw new Error("load failed");
        const body = (await response.json()) as HeadlineRankingSnapshot;
        if (cancelled) return;
        setItems(
          headlinesToEntities(
            body.items ?? [],
            "헤드라인 뉴스랭킹",
            topic === "culture" ? ["culture-desk"] : [],
          ),
        );
        setError("");
      } catch {
        if (!cancelled) setError("헤드라인을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [topic]);

  useEffect(() => {
    onItems?.(items);
  }, [items, onItems]);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2 px-1">
        <div>
          <p className="font-sans text-xs font-semibold tracking-[0.14em] text-accent">
            HEADLINE RANKING · TOP {topic === "economy" || topic === "culture" ? 25 : 20}
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight">{copy.title}</h2>
        </div>
        <p className="text-[12px] text-muted">{copy.source}</p>
      </div>
      {error ? (
        <p className="rounded-xl border border-line bg-panel px-4 py-6 text-sm text-muted">{error}</p>
      ) : null}
      {loading && !items.length && !error ? (
        <p className="rounded-xl border border-line bg-panel px-4 py-10 text-center text-sm text-muted">
          실시간 헤드라인을 수집하는 중입니다.
        </p>
      ) : null}
      {items.length ? (
        <>
          {onItems ? null : (
            <div className="-mx-4">
              <TickerTape items={items} />
            </div>
          )}
          <MarketWorkspace
            items={items}
            flashNonce={items.length}
            initialView="treemap"
            hideCategoryTabs
            skipDemographicSkew
            boardSlug={copy.boardSlug}
            title="헤드라인 뉴스랭킹"
            subtitle="분봉은 급상승 속도, 성별·연령은 관심 키워드 가중치. 유사 이슈는 상위 10칸에서 1건만 남깁니다."
          />
        </>
      ) : null}
    </section>
  );
}
