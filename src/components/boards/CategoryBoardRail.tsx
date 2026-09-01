"use client";

import Link from "next/link";
import {
  boardPath,
  categoryBoardPath,
  compositeTabIndex,
  getBoard,
  isDeskBoard,
  menuBoardsForChannel,
} from "@/lib/boards/registry";
import type { BoardDefinition } from "@/lib/boards/types";
import type { PostChannel } from "@/lib/posts/types";

/**
 * Ranking-board tabs. When `onSelect` is passed, clicks filter the heatmap
 * below instead of navigating away. "상세" still opens the full board page.
 * Culture inserts 종합 first, then 헤드라인 뉴스랭킹, then 문화·여행·레져 정부 지원금.
 */
export function CategoryBoardRail({
  channel,
  selectedSlug,
  onSelect,
}: {
  channel: PostChannel;
  selectedSlug?: string;
  onSelect?: (slug: string) => void;
}) {
  const boards = menuBoardsForChannel(channel);
  if (!boards.length) return null;
  const selected = selectedSlug ? getBoard(selectedSlug) : undefined;
  const composite = !selectedSlug;
  const insertAt = compositeTabIndex(channel);

  const compositeClass = composite
    ? "border-accent bg-accent text-black"
    : "border-line text-muted hover:text-ink";

  const compositeTab = onSelect ? (
    <li key="composite">
      <button
        type="button"
        onClick={() => onSelect("")}
        className={`inline-block rounded-md border px-3 py-1.5 text-xs ${compositeClass}`}
      >
        종합
      </button>
    </li>
  ) : (
    <li key="composite">
      <Link
        href={`/${channel}`}
        className="inline-block rounded-md border border-line px-3 py-1.5 text-xs text-muted hover:text-ink"
      >
        종합
      </Link>
    </li>
  );

  const boardTab = (board: BoardDefinition) => {
    const active = selectedSlug === board.slug;
    if (onSelect) {
      return (
        <li key={board.slug}>
          <button
            type="button"
            onClick={() => onSelect(board.slug)}
            className={`inline-block rounded-md border px-3 py-1.5 text-xs ${
              active ? "border-accent bg-accent text-black" : "border-line text-muted hover:text-ink"
            }`}
          >
            {board.shortTitle}
          </button>
        </li>
      );
    }
    return (
      <li key={board.slug}>
        <Link
          href={boardPath(board.slug)}
          className="inline-block rounded-md border border-line px-3 py-1.5 text-xs text-muted hover:text-ink"
        >
          {board.shortTitle}
        </Link>
      </li>
    );
  };

  const tabs = [
    ...boards.slice(0, insertAt).map(boardTab),
    compositeTab,
    ...boards.slice(insertAt).map(boardTab),
  ];

  return (
    <section className="rounded-2xl border border-line bg-panel px-5 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">랭킹·지수 보드</h2>
          {onSelect ? (
            <p className="mt-0.5 text-xs text-muted">
              보드를 고르면 아래 히트맵이 그 주제로 바뀝니다. 종목을 누르면 분석·여론조사 상세가 열립니다.
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-muted">
              보드를 고르면 아래 히트맵이 그 주제로 바뀝니다. 성별·연령·분봉 필터가 함께 적용됩니다.
            </p>
          )}
        </div>
        <Link
          href={categoryBoardPath(channel)}
          className="text-xs font-medium text-accent hover:underline"
        >
          전체 보기 →
        </Link>
      </div>
      <ul className="mt-3 flex flex-wrap gap-2">{tabs}</ul>
      {selected && !isDeskBoard(selected) ? (
        <p className="mt-2 text-[11px] text-muted">
          <Link href={boardPath(selected.slug)} className="text-accent hover:underline">
            이 보드 리포트 전체 보기 →
          </Link>
        </p>
      ) : null}
    </section>
  );
}
