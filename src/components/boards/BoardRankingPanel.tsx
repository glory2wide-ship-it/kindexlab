"use client";

import { useEffect, useMemo, useState } from "react";
import { AffiliateWidget } from "@/components/affiliate/AffiliateWidget";
import { DemographicTabs } from "@/components/boards/DemographicTabs";
import { BoardReportBody } from "@/components/boards/BoardReportBody";
import { clampAgeForBoard } from "@/lib/boards/age-tabs";
import { filterKey, filterLabel, selectRanking, dropNamesForFilter } from "@/lib/boards/demographics";
import { platformForGame, formatPlatformTag } from "@/lib/boards/game-platforms";
import { getBoard } from "@/lib/boards/registry";
import { isCultureGrantBoard } from "@/lib/boards/culture-grants";
import { boardUsesRegionFilter } from "@/lib/boards/regions";
import { boardRowSlug } from "@/lib/boards/heatmap";
import { parseBracketLabel } from "@/lib/politics/labeled-rank";
import { computeBoardIndex } from "@/lib/boards/board-index";
import { entityHref } from "@/lib/slugs";
import type {
  AgeSegment,
  BoardRankEntry,
  CachedBoard,
  GenderSegment,
  RegionSegment,
} from "@/lib/boards/types";
import type { PostChannel } from "@/lib/posts/types";

function tone(rate: number): string {
  if (rate > 0) return "text-up";
  if (rate < 0) return "text-down";
  return "text-muted";
}

function RankRow({
  entry,
  max,
  index,
  boardSlug,
}: {
  entry: BoardRankEntry;
  max: number;
  index: number;
  boardSlug?: string;
}) {
  const score = Number.isFinite(entry.score) ? entry.score : 0;
  const change = Number.isFinite(entry.changeRate) ? entry.changeRate : 0;
  const width = max > 0 ? Math.max(6, Math.round((score / max) * 100)) : 0;
  const platform = boardSlug === "game-esports-ranking" ? platformForGame(entry.name) : undefined;
  const detailHref =
    boardSlug && entry.name
      ? entityHref({ slug: boardRowSlug(boardSlug, entry.name), name: entry.name })
      : null;
  const bracket =
    boardUsesRegionFilter(boardSlug) || isCultureGrantBoard(boardSlug)
      ? parseBracketLabel(entry.name)
      : null;

  return (
    <li
      className="board-rank-row grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 border-t border-line/80 px-4 py-3 first:border-t-0"
      style={{ animationDelay: `${Math.min(index, 9) * 28}ms` }}
    >
      <span className="font-sans text-sm font-semibold tabular-nums text-muted">{index + 1}</span>
      <div className="min-w-0">
        <p className={bracket ? "text-sm font-semibold" : "truncate text-sm font-semibold"}>
          {platform ? (
            <span className="mr-1.5 inline-flex translate-y-[-1px] items-center rounded-sm bg-ink/10 px-1 py-0.5 align-middle font-sans text-[10px] font-bold leading-none text-ink/80">
              {formatPlatformTag(platform)}
            </span>
          ) : null}
          {detailHref ? (
            <a href={detailHref} className="hover:text-accent hover:underline">
              {bracket ? (
                <span className="inline-flex flex-col">
                  <span>{bracket.subject}</span>
                  <span className="text-xs font-normal text-muted">{bracket.org}</span>
                </span>
              ) : (
                entry.name || "집계 중"
              )}
            </a>
          ) : bracket ? (
            <span className="inline-flex flex-col">
              <span>{bracket.subject}</span>
              <span className="text-xs font-normal text-muted">{bracket.org}</span>
            </span>
          ) : (
            entry.name || "집계 중"
          )}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted">
          {entry.note || " "}
          {detailHref ? (
            <>
              {" · "}
              <a href={detailHref} className="text-accent hover:underline">
                상세 보기
              </a>
            </>
          ) : null}
        </p>
        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-board">
          <div
            className="h-full rounded-full bg-accent/70 transition-[width] duration-500 ease-out"
            style={{ width: `${width}%` }}
          />
        </div>
      </div>
      <div className="text-right">
        <p className="font-sans text-sm font-semibold tabular-nums">{score.toFixed(2)}</p>
        <p className={`font-sans text-xs font-semibold tabular-nums ${tone(change)}`}>
          {change > 0 ? "▲" : change < 0 ? "▼" : "–"} {Math.abs(change).toFixed(2)}%
        </p>
      </div>
    </li>
  );
}

export function BoardRankingPanel({
  board,
  affiliateCategory,
  unitLabel,
  channel,
  gender,
  age,
  region = "all",
  onGender,
  onAge,
  onRegion,
}: {
  board: CachedBoard;
  affiliateCategory: string;
  unitLabel: string;
  channel: PostChannel;
  gender: "all" | GenderSegment;
  age: "all" | AgeSegment;
  region?: "all" | RegionSegment;
  onGender: (value: "all" | GenderSegment) => void;
  onAge: (value: "all" | AgeSegment) => void;
  onRegion?: (value: "all" | RegionSegment) => void;
}) {
  const showRegion = boardUsesRegionFilter(board.slug);
  const rows = useMemo(() => {
    try {
      const def = getBoard(board.slug);
      return selectRanking(board.demographics, board.ranking ?? [], gender, age, {
        limit: Math.max(10, board.ranking?.length ?? 10),
        dropNames: dropNamesForFilter(def, gender, age),
        region: showRegion ? region : "all",
      });
    } catch {
      return (board.ranking ?? []).slice(0, 10);
    }
  }, [board.demographics, board.ranking, board.slug, gender, age, region, showRegion]);
  const max = rows.length ? Math.max(...rows.map((row) => (Number.isFinite(row.score) ? row.score : 0))) : 0;
  const filtered = gender !== "all" || age !== "all" || (showRegion && region !== "all");
  const listKey = filterKey(gender, age, showRegion ? region : "all");
  const boardIndex = computeBoardIndex(rows, board.slug);
  const indexValue = boardIndex.value;
  const indexChange = boardIndex.changeRate;
  const heading = getBoard(board.slug)?.title || board.title;

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-2xl border border-line bg-panel shadow-sm">
        <div className="flex flex-col gap-3 border-b border-line px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold">{heading}</h2>
              <p className="mt-0.5 text-xs text-muted">
                {filtered
                  ? `${filterLabel(gender, age, showRegion ? region : "all")} 세그먼트 상위 ${rows.length}위`
                  : `전체 상위 ${rows.length}위`}
                {" · "}100점 척도
              </p>
            </div>
            <div className="text-right">
              <p className="font-sans text-lg font-semibold tabular-nums">
                {indexValue.toFixed(2)}
              </p>
              <p className={`font-sans text-xs font-semibold tabular-nums ${tone(indexChange)}`}>
                {indexChange > 0 ? "▲" : indexChange < 0 ? "▼" : "–"}{" "}
                {Math.abs(indexChange).toFixed(2)}%
              </p>
            </div>
          </div>

          <DemographicTabs
            gender={gender}
            age={age}
            onGender={onGender}
            onAge={onAge}
            boardSlug={board.slug}
            region={region}
            onRegion={onRegion}
            showRegion={showRegion}
          />

          {filtered ? (
            <p className="text-[11px] leading-5 text-muted">
              {filterLabel(gender, age, showRegion ? region : "all")} 기준으로 재정렬했습니다. 성별·연령
              {showRegion ? "·지역" : ""}을 함께 고르면 해당 세그먼트 가중치로 상위 순위를 다시 산출합니다.
              세그먼트 수치는 검색 트렌드 특성을 반영한 추정치입니다.
            </p>
          ) : null}
        </div>

        {rows.length ? (
          <ul key={listKey} className="board-rank-list">
            {rows.map((entry, index) => (
              <RankRow
                key={`${listKey}-${entry.name}-${index}`}
                entry={entry}
                max={max}
                index={index}
                boardSlug={board.slug}
              />
            ))}
          </ul>
        ) : (
          <p className="px-4 py-8 text-center text-sm text-muted">
            이 필터 조합의 전용 수치가 부족해 인접 지역·전체 가중치로 순위를 채우는 중입니다.
          </p>
        )}

        <p className="border-t border-line px-4 py-2.5 text-[11px] leading-5 text-muted">
          {unitLabel} 단위 집계 · 지수는 편집 기준에 따른 추정값이며 실측 통계가 아닙니다.
        </p>
      </section>

      <AffiliateWidget
        category={affiliateCategory}
        channel={channel}
        boardSlug={board.slug}
        gender={gender}
        age={age}
        placement="mid"
      />
    </div>
  );
}

export function BoardDesk({
  board,
  affiliateCategory,
  unitLabel,
  channel,
}: {
  board: CachedBoard;
  affiliateCategory: string;
  unitLabel: string;
  channel: PostChannel;
}) {
  const [gender, setGender] = useState<"all" | GenderSegment>("all");
  const [age, setAge] = useState<"all" | AgeSegment>("all");
  const [region, setRegion] = useState<"all" | RegionSegment>("all");

  useEffect(() => {
    setAge((current) => clampAgeForBoard(board.slug, current));
    if (!boardUsesRegionFilter(board.slug)) setRegion("all");
  }, [board.slug]);

  return (
    <div className="space-y-8">
      <BoardRankingPanel
        board={board}
        affiliateCategory={affiliateCategory}
        unitLabel={unitLabel}
        channel={channel}
        gender={gender}
        age={age}
        region={region}
        onGender={setGender}
        onAge={setAge}
        onRegion={setRegion}
      />
      <BoardReportBody
        board={board}
        affiliateCategory={affiliateCategory}
        channel={channel}
        gender={gender}
        age={age}
      />
    </div>
  );
}
