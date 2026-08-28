"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Sparkline } from "@/components/dashboard/Sparkline";
import { TYPE_LABEL, formatCompact, formatRate, formatScore, rankDelta, metricLabel } from "@/lib/format";
import { rankingPath } from "@/lib/slugs";
import { changeForEntity, getTimeframeSeries, scoreForTimeframe, volumeForTimeframe } from "@/lib/timeframes";
import type { RankingEntity, Timeframe } from "@/lib/types";

type SortKey = "rank" | "name" | "type" | "buzzScore" | "change" | "volume";

export function RankingTable({
  items,
  timeframe,
  selectedSlug,
  onSelect,
}: {
  items: RankingEntity[];
  timeframe: Timeframe;
  selectedSlug?: string | null;
  onSelect?: (slug: string) => void;
}) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [dir, setDir] = useState<"asc" | "desc">("asc");
  const sectorOffset = useMemo(() => {
    const types = new Set(items.map((item) => item.type));
    if (types.size !== 1 || items.length === 0) return 0;
    return Math.min(...items.map((item) => item.rank)) - 1;
  }, [items]);

  function boardRank(item: RankingEntity) {
    return item.rank - sectorOffset;
  }

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
  }, [dir, items, sortKey, timeframe]);

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
              <SortTh label="순위" active={sortKey === "rank"} onClick={() => toggle("rank")} />
              <SortTh label="종목" active={sortKey === "name"} onClick={() => toggle("name")} />
              <SortTh label="구분" active={sortKey === "type"} onClick={() => toggle("type")} />
              <SortTh
                label="버즈"
                active={sortKey === "buzzScore"}
                onClick={() => toggle("buzzScore")}
                right
              />
              <SortTh
                label="등락"
                active={sortKey === "change"}
                onClick={() => toggle("change")}
                right
              />
              <SortTh
                label="지표"
                active={sortKey === "volume"}
                onClick={() => toggle("volume")}
                right
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
                onClick={() => (onSelect ? onSelect(item.slug) : router.push(rankingPath(item.slug)))}
              >
                <td className="px-4 py-3 font-sans tabular-nums">
                  <span className="mr-2 text-base font-semibold">{boardRank(item)}</span>
                  <RankMove delta={rankDelta(item.rank, item.previousRank)} />
                </td>
                <td className="px-2 py-3">
                  <Link
                    href={rankingPath(item.slug)}
                    className="hover:text-accent"
                    onClick={(event) => {
                      if (!onSelect) return;
                      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                      event.preventDefault();
                      onSelect(item.slug);
                    }}
                  >
                    <span className="font-medium">{item.name}</span>
                    <span className="ml-2 text-xs text-muted">{item.nameEn}</span>
                  </Link>
                </td>
                <td className="px-2 py-3 text-xs text-muted">{TYPE_LABEL[item.type]}</td>
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
              href={rankingPath(item.slug)}
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
                <div className="text-lg font-semibold">{boardRank(item)}</div>
                <RankMove delta={rankDelta(item.rank, item.previousRank)} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{item.name}</p>
                <p className="font-sans text-xs tabular-nums text-muted">
                  {TYPE_LABEL[item.type]} · {metricLabel(item.type)} {formatCompact(volume)}
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

function SortTh({
  label,
  active,
  onClick,
  right,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  right?: boolean;
}) {
  return (
    <th className={`px-2 py-3 font-medium first:px-4 ${right ? "text-right" : ""}`}>
      <button
        type="button"
        onClick={onClick}
        className={`hover:text-ink ${active ? "text-accent" : ""}`}
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
