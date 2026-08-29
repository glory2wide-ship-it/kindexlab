"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AffiliateWidget } from "@/components/affiliate/AffiliateWidget";
import { ProductShelf } from "@/components/affiliate/ProductShelf";
import { DemographicTabs } from "@/components/boards/DemographicTabs";
import { defaultAffiliateForChannel } from "@/lib/affiliate/catalog";
import { applyDemographicSkew } from "@/lib/boards/entity-skew";
import { filterKey, filterLabel } from "@/lib/boards/demographics";
import { TYPE_LABEL, formatRate } from "@/lib/format";
import { channelFromEntityType } from "@/lib/posts/channels";
import { rankingPath } from "@/lib/slugs";
import type { AgeSegment, GenderSegment } from "@/lib/boards/types";
import type { RankingEntity } from "@/lib/types";

/**
 * Related-name ranking plus the affiliate shelf, both keyed off the same
 * gender/age tabs so a 30s filter reorders the list and swaps the widget.
 */
export function RelatedRankingDesk({
  entity,
  related,
  heading = "같은 섹터 종목",
}: {
  entity: RankingEntity;
  related: RankingEntity[];
  heading?: string;
}) {
  const [gender, setGender] = useState<"all" | GenderSegment>("all");
  const [age, setAge] = useState<"all" | AgeSegment>("all");
  const channel = channelFromEntityType(entity.type);
  const rows = useMemo(
    () => applyDemographicSkew(related ?? [], gender, age),
    [related, gender, age],
  );
  const filtered = gender !== "all" || age !== "all";
  const listKey = filterKey(gender, age);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-line bg-panel px-4 py-3">
        <DemographicTabs gender={gender} age={age} onGender={setGender} onAge={setAge} />
        {filtered ? (
          <p className="mt-2 text-[11px] leading-5 text-muted">
            {filterLabel(gender, age)} 관심 가중치로 같은 섹터 순위를 다시 매겼습니다.
          </p>
        ) : null}
      </div>

      <ProductShelf products={entity.products ?? []} entityName={entity.name} />
      <AffiliateWidget
        category={defaultAffiliateForChannel(channel)}
        channel={channel}
        gender={gender}
        age={age}
        placement="footer"
      />

      <section>
        <h2 className="mb-3 text-lg font-semibold">{heading}</h2>
        <ul key={listKey} className="grid gap-3 sm:grid-cols-2">
          {rows.map((item, index) => (
            <li
              key={`${listKey}-${item.id}`}
              className="board-rank-row"
              style={{ animationDelay: `${Math.min(index, 9) * 28}ms` }}
            >
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
                  className={`font-sans text-sm tabular-nums ${
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
