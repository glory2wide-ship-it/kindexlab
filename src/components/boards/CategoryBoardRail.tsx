"use client";

import Link from "next/link";
import {
  boardPath,
  compositeTabIndex,
  menuBoardsForChannel,
} from "@/lib/boards/registry";
import { MOBILE_COMPOSITE_TAB_LABEL, mobileBoardTabLabel } from "@/lib/boards/mobile-tab-label";
import {
  ECONOMY_MOBILE_EXTRA_PADDED_TAB_PX,
  ECONOMY_MOBILE_PADDED_TAB_PX,
  ECONOMY_MOBILE_STOCK_TAB_PX,
  isEconomyMobileExtraWideTab,
  isEconomyMobilePaddedTab,
  isEconomyMobileStockTab,
  mobileBoardTabWidth,
} from "@/lib/boards/mobile-tab-width";
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
  const isEconomy = channel === "economy";

  const compositeClass = composite
    ? "border-accent bg-accent text-black"
    : "border-line font-semibold text-soft hover:text-ink";

  // Channel tab labels +10%: 12.1→13.31 mobile, 15.4→16.94 desktop.
  // Economy mobile: equal-width flex rows with shared gap so chips never overlap.
  const tabShell =
    "inline-flex w-full max-w-full min-w-0 box-border items-center justify-center overflow-hidden rounded-md border px-1.5 py-1.5 text-center text-[13.31px] font-semibold leading-none whitespace-nowrap md:inline-flex md:w-auto md:max-w-none md:shrink md:overflow-visible md:px-2 md:py-1.5 md:text-[16.09px] md:leading-none";

  const tabClassFor = (slug: string) => {
    let cls = isEconomy ? `${tabShell} md:px-3` : tabShell;
    if (isEconomyMobileExtraWideTab(slug, channel)) {
      cls = `${cls} ${ECONOMY_MOBILE_EXTRA_PADDED_TAB_PX}`;
    } else if (isEconomyMobilePaddedTab(slug, channel)) {
      cls = `${cls} ${ECONOMY_MOBILE_PADDED_TAB_PX}`;
    } else if (isEconomyMobileStockTab(slug, channel)) {
      cls = `${cls} ${ECONOMY_MOBILE_STOCK_TAB_PX}`;
    } else if (isEconomy) {
      // 종합 / 정부지원금 / 부동산 / 금융 — match vertical breathing room.
      cls = `${cls} max-md:!py-[7.2px]`;
    }
    return cls;
  };

  const itemClass = isEconomy ? "min-w-0 flex-1 md:flex-none" : "min-w-0";

  const orderedKeys = [
    ...boards.slice(0, insertAt).map((board) => board.slug),
    "composite",
    ...boards.slice(insertAt).map((board) => board.slug),
  ];
  const mobileCols = Math.max(2, Math.ceil(orderedKeys.length / 2));
  // Non-economy: weight columns by the wider of the two stacked chips.
  const colWeights = Array.from({ length: mobileCols }, (_, col) =>
    Math.max(
      mobileBoardTabWidth(orderedKeys[col] ?? "", channel),
      mobileBoardTabWidth(orderedKeys[col + mobileCols] ?? "", channel),
    ),
  );
  const gridTemplateColumns = colWeights.map((w) => `minmax(0, ${w}fr)`).join(" ");

  const compositeTab = onSelect ? (
    <li key="composite" className={itemClass}>
      <button
        type="button"
        onClick={() => onSelect("")}
        className={`${tabClassFor("composite")} ${compositeClass}`}
      >
        <span className="md:hidden">{MOBILE_COMPOSITE_TAB_LABEL}</span>
        <span className="hidden md:inline">종합</span>
      </button>
    </li>
  ) : (
    <li key="composite" className={itemClass}>
      <Link
        href={`/${channel}`}
        className={`${tabClassFor("composite")} border-line font-semibold text-soft hover:text-ink`}
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
        <li key={board.slug} className={itemClass}>
          <button
            type="button"
            onClick={() => onSelect(board.slug)}
            className={`${tabClassFor(board.slug)} ${
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
      <li key={board.slug} className={itemClass}>
        <Link
          href={boardPath(board.slug)}
          className={`${tabClassFor(board.slug)} border-line font-semibold text-soft hover:text-ink`}
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

  // Economy mobile: two equal-flex rows so every chip shares the same gap and
  // never overflows its neighbor (weighted grid + w-auto caused overlap).
  const economyMobileMid = Math.ceil(tabs.length / 2);
  const economyMobileRows = isEconomy ? (
    <div className="flex flex-col gap-2 md:hidden">
      <ul className="flex w-full min-w-0 items-stretch gap-2">{tabs.slice(0, economyMobileMid)}</ul>
      <ul className="flex w-full min-w-0 items-stretch gap-2">{tabs.slice(economyMobileMid)}</ul>
    </div>
  ) : null;

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
      {economyMobileRows}
      <ul
        className={
          isEconomy
            ? "hidden md:flex md:flex-nowrap md:items-center md:gap-[10.93px]"
            : "grid gap-1.5 max-md:[grid-template-columns:var(--m-rail)] md:flex md:flex-nowrap md:items-center md:gap-[10.93px]"
        }
        style={
          isEconomy
            ? undefined
            : { ["--m-rail" as string]: gridTemplateColumns }
        }
      >
        {tabs}
      </ul>
    </>
  );

  if (variant === "inline") {
    return <div className="min-w-0">{body}</div>;
  }

  return (
    <section
      className={
        isEconomy
          ? "rounded-2xl border border-line bg-panel px-5 py-4 max-md:px-4 max-md:py-2.5"
          : "rounded-2xl border border-line bg-panel px-5 py-4 max-md:px-3 max-md:py-2.5"
      }
    >
      {body}
    </section>
  );
}
