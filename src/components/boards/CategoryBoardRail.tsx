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
import { MOBILE_COMPOSITE_TAB_LABEL, mobileBoardTabLabel } from "@/lib/boards/mobile-tab-label";
import { mobileBoardTabWidth } from "@/lib/boards/mobile-tab-width";
import type { BoardDefinition } from "@/lib/boards/types";
import type { PostChannel } from "@/lib/posts/types";

/**
 * Ranking-board tabs. When `onSelect` is passed, clicks filter the heatmap
 * below instead of navigating away. "상세" still opens the full board page.
 * Culture/politics/entertainment/travel: 종합 → 정부지원금(문화/생활·정치·여행) → …
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

  const tabShell =
    "inline-flex w-full items-center justify-center rounded-md border px-1.5 py-1.5 text-center text-[11px] leading-none whitespace-nowrap md:inline-block md:w-auto md:px-3 md:text-xs md:leading-normal md:whitespace-normal";

  const orderedKeys = [
    ...boards.slice(0, insertAt).map((board) => board.slug),
    "composite",
    ...boards.slice(insertAt).map((board) => board.slug),
  ];
  const mobileCols = Math.max(2, Math.ceil(orderedKeys.length / 2));
  const colWeights = Array.from({ length: mobileCols }, (_, col) =>
    mobileBoardTabWidth(orderedKeys[col] ?? ""),
  );
  const gridTemplateColumns = colWeights.map((w) => `minmax(0, ${w}fr)`).join(" ");

  const compositeTab = onSelect ? (
    <li key="composite" className="min-w-0">
      <button
        type="button"
        onClick={() => onSelect("")}
        className={`${tabShell} ${compositeClass}`}
      >
        <span className="md:hidden">{MOBILE_COMPOSITE_TAB_LABEL}</span>
        <span className="hidden md:inline">종합 랭킹</span>
      </button>
    </li>
  ) : (
    <li key="composite" className="min-w-0">
      <Link
        href={`/${channel}`}
        className={`${tabShell} border-line text-muted hover:text-ink`}
      >
        <span className="md:hidden">{MOBILE_COMPOSITE_TAB_LABEL}</span>
        <span className="hidden md:inline">종합 랭킹</span>
      </Link>
    </li>
  );

  const boardTab = (board: BoardDefinition) => {
    const active = selectedSlug === board.slug;
    const mobileLabel = mobileBoardTabLabel(board.slug, board.shortTitle);
    if (onSelect) {
      return (
        <li key={board.slug} className="min-w-0">
          <button
            type="button"
            onClick={() => onSelect(board.slug)}
            className={`${tabShell} ${
              active ? "border-accent bg-accent text-black" : "border-line text-muted hover:text-ink"
            }`}
          >
            <span className="md:hidden">{mobileLabel}</span>
            <span className="hidden md:inline">{board.shortTitle}</span>
          </button>
        </li>
      );
    }
    return (
      <li key={board.slug} className="min-w-0">
        <Link
          href={boardPath(board.slug)}
          className={`${tabShell} border-line text-muted hover:text-ink`}
        >
          <span className="md:hidden">{mobileLabel}</span>
          <span className="hidden md:inline">{board.shortTitle}</span>
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
    <section className="rounded-2xl border border-line bg-panel px-5 py-4 max-md:px-3 max-md:py-2.5">
      <div className="mb-3 hidden flex-wrap items-baseline justify-between gap-2 md:flex">
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
      <ul
        className="grid gap-1.5 md:flex md:flex-wrap md:gap-2"
        style={{ gridTemplateColumns }}
      >
        {tabs}
      </ul>
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
