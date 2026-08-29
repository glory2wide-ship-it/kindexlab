"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Sparkline } from "@/components/dashboard/Sparkline";
import { heatmapNameLines } from "@/lib/musicTitle";
import { isTwoLineBracketHeatmap } from "@/lib/boards/culture-grants";
import { TYPE_LABEL, formatCompact, formatRate, formatScore, rankDelta, metricLabel } from "@/lib/format";
import { entityHref } from "@/lib/slugs";
import { entityPlatform, formatPlatformTag } from "@/lib/boards/game-platforms";
import { changeForEntity, getTimeframeSeries, scoreForTimeframe, volumeForTimeframe } from "@/lib/timeframes";
import type { RankingEntity, Timeframe } from "@/lib/types";

type SortKey = "rank" | "name" | "type" | "buzzScore" | "change" | "volume";

export function RankingTable({
  items,
  timeframe,
  selectedSlug,
  onSelect,
  lockOrder = false,
}: {
  items: RankingEntity[];
  timeframe: Timeframe;
  selectedSlug?: string | null;
  onSelect?: (slug: string) => void;
  lockOrder?: boolean;
}) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [dir, setDir] = useState<"asc" | "desc">("asc");
  const rows = useMemo(() => {
    const mapped = items.map((item) => {
      const series = getTimeframeSeries(item, timeframe);
      return {
        item,
        series,
        change: changeForEntity(item, timeframe),
        buzzScore: scoreForTimeframe(item, timeframe),
        volume: volumeForTimeframe(item, timeframe),
      };
    });
    if (lockOrder) return mapped;
    const sign = dir === "asc" ? 1 : -1;
    return mapped.sort((a, b) => {
      const table: Record<SortKey, number | string> = {
        rank: a.item.rank,
        name: a.item.name,
        type: a.item.type,
        buzzScore: a.buzzScore,
        change: a.change,
        volume: a.volume,
      };
      const other: Record<SortKey, number | string> = {
        rank: b.item.rank,
        name: b.item.name,
        type: b.item.type,
        buzzScore: b.buzzScore,
        change: b.change,
        volume: b.volume,
      };
      if (typeof table[sortKey] === "string") {
        return String(table[sortKey]).localeCompare(String(other[sortKey]), "ko") * sign;
      }
      return ((table[sortKey] as number) - (other[sortKey] as number)) * sign;
    });
  }, [dir, items, lockOrder, sortKey, timeframe]);

  function toggle(key: SortKey) {
    if (sortKey === key) setDir((value) => (value === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setDir(key === "rank" || key === "name" ? "asc" : "desc");
    }
  }

  return (
    <div className="index-gothic max-h-[min(78vh,880px)] overflow-auto font-sans">
      <div className="hidden md:block">
        <table className="w-full font-sans text-sm">
          <thead className="sticky top-0 z-10 bg-panel text-left text-[11px] font-sans tracking-wider text-muted shadow-[inset_0_-1px_0_var(--color-line)]">
            <tr className="border-b border-line">
              <SortTh label="순위" active={!lockOrder && sortKey === "rank"} onClick={() => toggle("rank")} disabled={lockOrder} />
              <SortTh label="종목" active={!lockOrder && sortKey === "name"} onClick={() => toggle("name")} disabled={lockOrder} />
              <SortTh label="구분" active={!lockOrder && sortKey === "type"} onClick={() => toggle("type")} disabled={lockOrder} />
              <SortTh
                label="버즈"
                active={!lockOrder && sortKey === "buzzScore"}
                onClick={() => toggle("buzzScore")}
                right
                disabled={lockOrder}
              />
              <SortTh
                label="등락"
                active={!lockOrder && sortKey === "change"}
                onClick={() => toggle("change")}
                right
                disabled={lockOrder}
              />
              <SortTh
                label="지표"
                active={!lockOrder && sortKey === "volume"}
                onClick={() => toggle("volume")}
                right
                disabled={lockOrder}
              />
              <th className="px-4 py-3 font-medium">추세</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ item, series, change, buzzScore, volume }) => (
              <tr
                key={item.id}
                className={`cursor-pointer border-b border-line/80 font-sans transition-colors hover:bg-board/80 ${
                  selectedSlug === item.slug ? "bg-accent/10" : ""
                }`}
                onClick={() => {
                  const href = entityHref(item);
                  if (onSelect) {
                    onSelect(item.slug);
                    return;
                  }
                  router.push(href);
                }}
              >
                <td className="px-4 py-3 font-sans tabular-nums">
                  <span className="mr-2 text-base font-semibold">{item.rank}</span>
                  <RankMove delta={rankDelta(item.rank, item.previousRank)} />
                </td>
                <td className="px-2 py-3">
                  <Link
                    href={entityHref(item)}
                    className="hover:text-accent"
                    onClick={(event) => {
                      if (!onSelect) return;
                      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                      event.preventDefault();
                      onSelect(item.slug);
                    }}
                  >
                    <PlatformTag entity={item} />
                    <RankName entity={item} />
                  </Link>
                </td>
                <td className="px-2 py-3 text-xs text-muted">
                  {item.heatmapGroup ?? TYPE_LABEL[item.type]}
                </td>
                <td className="px-2 py-3 text-right font-sans tabular-nums">{formatScore(buzzScore)}</td>
                <td className="px-2 py-3 text-right">
                  <ChangeCell rate={change} />
                </td>
                <td className="px-2 py-3 text-right font-sans tabular-nums text-muted">
                  {metricLabel(item.type)} {formatCompact(volume)}
                </td>
                <td className="px-4 py-3">
                  <Sparkline data={series.map((point) => point.v)} positive={change >= 0} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="divide-y divide-line font-sans md:hidden">
        {rows.map(({ item, series, change, volume }) => (
          <li key={item.id}>
            <Link
              href={entityHref(item)}
              onClick={(event) => {
                if (!onSelect) return;
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                event.preventDefault();
                onSelect(item.slug);
              }}
              className={`flex items-center gap-3 px-4 py-3 ${
                selectedSlug === item.slug ? "bg-accent/10" : ""
              }`}
            >
              <div className="w-8 text-center font-sans tabular-nums">
                <div className="text-lg font-semibold">{item.rank}</div>
                <RankMove delta={rankDelta(item.rank, item.previousRank)} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  <PlatformTag entity={item} />
                  <RankName entity={item} />
                </p>
                <p className="font-sans text-xs tabular-nums text-muted">
                  {TYPE_LABEL[item.type] && item.heatmapGroup
                    ? `${item.heatmapGroup} · ${metricLabel(item.type)} ${formatCompact(volume)}`
                    : `${TYPE_LABEL[item.type]} · ${metricLabel(item.type)} ${formatCompact(volume)}`}
                </p>
              </div>
              <div className="text-right">
                <ChangeCell rate={change} />
                <Sparkline
                  data={series.map((point) => point.v)}
                  positive={change >= 0}
                  className="ml-auto mt-1 h-6 w-16"
                />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RankName({ entity }: { entity: RankingEntity }) {
  const lines = heatmapNameLines(entity);
  if (lines.artist && lines.artist !== lines.title && isTwoLineBracketHeatmap(entity.heatmapGroup)) {
    return (
      <span className="flex flex-col gap-0.5">
        <span className="font-medium">{lines.title}</span>
        <span className="text-xs text-muted">{lines.artist}</span>
      </span>
    );
  }
  if (entity.type === "local_policy" || entity.type === "subsidy") {
    return (
      <>
        <span className="text-xs text-muted">{lines.artist ?? `[${entity.nameEn}]`}</span>{" "}
        <span className="font-medium">{lines.title}</span>
      </>
    );
  }
  if (entity.type === "political_pundit" && lines.artist) {
    return (
      <>
        <span className="font-medium">{lines.title}</span>
        <span className="ml-1 text-xs text-muted">({lines.artist})</span>
      </>
    );
  }
  if (entity.type === "headline_news") {
    return (
      <>
        <span className="font-medium leading-5" title={entity.name}>
          {entity.name}
        </span>
        {entity.nameEn ? <span className="ml-2 text-xs text-muted">{entity.nameEn}</span> : null}
      </>
    );
  }
  return (
    <>
      <span className="font-medium">{entity.name}</span>
      {entity.nameEn && entity.nameEn !== entity.name ? (
        <span className="ml-2 text-xs text-muted">{entity.nameEn}</span>
      ) : null}
    </>
  );
}

function PlatformTag({ entity }: { entity: RankingEntity }) {
  const platform = entityPlatform(entity);
  if (!platform) return null;
  return (
    <span className="mr-1.5 inline-flex translate-y-[-1px] items-center rounded-sm bg-ink/10 px-1 py-0.5 align-middle font-sans text-[10px] font-bold leading-none text-ink/80">
      {formatPlatformTag(platform)}
    </span>
  );
}

function SortTh({
  label,
  active,
  onClick,
  right,
  disabled,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  right?: boolean;
  disabled?: boolean;
}) {
  return (
    <th className={`px-2 py-3 font-medium first:px-4 ${right ? "text-right" : ""}`}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`${disabled ? "cursor-default" : "hover:text-ink"} ${active ? "text-accent" : ""}`}
      >
        {label}
      </button>
    </th>
  );
}

function ChangeCell({ rate }: { rate: number }) {
  const up = rate > 0;
  const down = rate < 0;
  return (
    <span
      className={`font-sans font-semibold tabular-nums ${up ? "text-up" : down ? "text-down" : "text-muted"}`}
    >
      {up ? "▲" : down ? "▼" : "–"} {formatRate(rate)}
    </span>
  );
}

function RankMove({ delta }: { delta: number }) {
  if (delta > 0) return <span className="text-[11px] text-up">▲{delta}</span>;
  if (delta < 0) return <span className="text-[11px] text-down">▼{Math.abs(delta)}</span>;
  return <span className="text-[11px] text-muted">–</span>;
}
