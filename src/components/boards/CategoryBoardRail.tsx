"use client";

import Link from "next/link";
import {
  boardPath,
  compositeTabIndex,
  menuBoardsForChannel,
} from "@/lib/boards/registry";
import { MOBILE_COMPOSITE_TAB_LABEL, mobileBoardTabLabel } from "@/lib/boards/mobile-tab-label";
import { mobileBoardTabWidth } from "@/lib/boards/mobile-tab-width";
import type { BoardDefinition } from "@/lib/boards/types";
import type { PostChannel } from "@/lib/posts/types";

/**
 * Ranking-board tabs. When `onSelect` is passed, clicks filter the heatmap
 * below instead of navigating away.
 * Culture/politics/travel: 종합 → 정부지원금 → …; entertainment has no grant tab.
 */
export function CategoryBoardRail({
  channel,
  selectedSlug,
  onSelect,
  variant = "panel",
}: {
  channel: PostChannel;
  selectedSlug?: string;
  onSelect?: (slug: string) => void;
  /**
   * `panel` — bordered card above the heatmap (mobile keeps this).
   * `inline` — heading + tabs for the desktop heatmap header slot.
   */
  variant?: "panel" | "inline";
}) {
  const boards = menuBoardsForChannel(channel);
  if (!boards.length) return null;
  const composite = !selectedSlug;
  const insertAt = compositeTabIndex(channel);

  const compositeClass = composite
    ? "border-accent bg-accent text-black"
    : "border-line font-semibold text-soft hover:text-ink";

  // Desktop tab labels: 14px +10% → 15.4px (mobile unchanged).
  // Desktop stays on one row: nowrap so every channel fits.
  const tabShell =
    "inline-flex w-full items-center justify-center rounded-md border px-1.5 py-1.5 text-center text-[12.1px] font-semibold leading-none whitespace-nowrap md:inline-flex md:w-auto md:shrink md:px-2 md:py-1.5 md:text-[15.4px] md:leading-none";

  const orderedKeys = [
    ...boards.slice(0, insertAt).map((board) => board.slug),
    "composite",
    ...boards.slice(insertAt).map((board) => board.slug),
  ];
  const mobileCols = Math.max(2, Math.ceil(orderedKeys.length / 2));
  // Weight each column by the wider of the two stacked chips (row1 / row2).
  const colWeights = Array.from({ length: mobileCols }, (_, col) =>
    Math.max(
      mobileBoardTabWidth(orderedKeys[col] ?? ""),
      mobileBoardTabWidth(orderedKeys[col + mobileCols] ?? ""),
    ),
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
        <span className="hidden md:inline">종합</span>
      </button>
    </li>
  ) : (
    <li key="composite" className="min-w-0">
      <Link
        href={`/${channel}`}
        className={`${tabShell} border-line font-semibold text-soft hover:text-ink`}
      >
        <span className="md:hidden">{MOBILE_COMPOSITE_TAB_LABEL}</span>
        <span className="hidden md:inline">종합</span>
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
              active
                ? "border-accent bg-accent text-black"
                : "border-line font-semibold text-soft hover:text-ink"
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
          className={`${tabShell} border-line font-semibold text-soft hover:text-ink`}
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

  const heading = (
    <div
      className={
        variant === "inline"
          ? "mb-3"
          : "mb-3 hidden md:block"
      }
    >
      <h2 className="text-[17.28px] font-semibold">랭킹·지수 보드</h2>
      {onSelect ? (
        <p className="mt-0.5 text-[13.79px] text-muted">
          보드를 고르면 아래 히트맵이 그 주제로 바뀝니다. 종목을 누르면 분석·여론조사 상세가 열립니다.
        </p>
      ) : (
        <p className="mt-0.5 text-[13.79px] text-muted">
          보드를 고르면 아래 히트맵이 그 주제로 바뀝니다. 성별·연령·분봉 필터가 함께 적용됩니다.
        </p>
      )}
    </div>
  );

  const body = (
    <>
      {heading}
      <ul
        className="grid gap-1.5 max-md:[grid-template-columns:var(--m-rail)] md:flex md:flex-nowrap md:items-center md:gap-[6.6px]"
        style={{ ["--m-rail" as string]: gridTemplateColumns }}
      >
        {tabs}
      </ul>
    </>
  );

  if (variant === "inline") {
    return <div className="min-w-0">{body}</div>;
  }

  return (
    <section className="rounded-2xl border border-line bg-panel px-5 py-4 max-md:px-3 max-md:py-2.5">
      {body}
    </section>
  );
}
