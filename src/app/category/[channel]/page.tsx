import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { computeBoardIndex } from "@/lib/boards/board-index";
import { boardPath, categoryBoardPath, menuBoardsForChannel } from "@/lib/boards/registry";
import { seedMissingBoards } from "@/lib/boards/seed";
import { readBoard } from "@/lib/boards/store";
import type { CachedBoard } from "@/lib/boards/types";
import { getPostChannel, isPostChannel, POST_CHANNELS } from "@/lib/posts/channels";

/** Align with channel desks (`/[category]`) — boards refresh on the 3-minute cadence. */
export const revalidate = 180;

export function generateStaticParams() {
  return POST_CHANNELS.map((channel) => ({ channel: channel.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ channel: string }>;
}): Promise<Metadata> {
  const { channel } = await params;
  if (!isPostChannel(channel)) return { title: "카테고리를 찾을 수 없습니다" };
  const meta = getPostChannel(channel);
  return {
    title: `${meta.label} 랭킹·지수 보드`,
    description: `${meta.label} 랭킹 보드. 성별·연령별 순위를 함께 제공합니다.`,
    alternates: { canonical: categoryBoardPath(channel) },
  };
}

function tone(rate: number): string {
  if (rate > 0) return "text-up";
  if (rate < 0) return "text-down";
  return "text-muted";
}

function BoardCard({
  title,
  criteria,
  href,
  cached,
  desk,
}: {
  title: string;
  criteria: string;
  href: string;
  cached?: CachedBoard;
  desk?: boolean;
}) {
  const index = cached ? computeBoardIndex(cached.ranking, cached.slug) : null;
  return (
    <li>
      <Link
        href={href}
        className="flex h-full flex-col gap-2 rounded-2xl border border-line bg-panel px-4 py-4 hover:bg-board/50"
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-semibold leading-6">{title}</p>
          {desk ? (
            <span className="shrink-0 rounded-full bg-board px-2 py-0.5 text-[11px] text-muted">
              실시간 데스크
            </span>
          ) : index ? (
            <div className="shrink-0 text-right">
              <p className="font-sans text-base font-semibold tabular-nums">
                {index.value.toFixed(2)}
              </p>
              <p className={`font-sans text-[11px] font-semibold tabular-nums ${tone(index.changeRate)}`}>
                {index.changeRate > 0 ? "▲" : index.changeRate < 0 ? "▼" : "–"}{" "}
                {Math.abs(index.changeRate).toFixed(2)}%
              </p>
            </div>
          ) : (
            <span className="shrink-0 rounded-full bg-board px-2 py-0.5 text-[11px] text-muted">
              집계 대기
            </span>
          )}
        </div>
        <p className="text-xs leading-5 text-muted">{criteria}</p>
        {cached?.ranking.length ? (
          <ol className="mt-auto flex flex-wrap gap-x-3 gap-y-1 pt-1 text-xs text-muted">
            {cached.ranking.slice(0, 3).map((row) => (
              <li key={row.name} className="truncate">
                <span className="font-sans tabular-nums">{row.rank}</span> {row.name}
              </li>
            ))}
          </ol>
        ) : null}
      </Link>
    </li>
  );
}

export default async function CategoryBoardsPage({
  params,
}: {
  params: Promise<{ channel: string }>;
}) {
  const { channel } = await params;
  if (!isPostChannel(channel)) notFound();

  const meta = getPostChannel(channel);
  const boards = menuBoardsForChannel(channel);
  try {
    await seedMissingBoards();
  } catch {
    /* ignore seed failures — cards fall back to 집계 대기 */
  }
  // Read-only: the list shows whatever is cached. Generation happens on the
  // board detail page or via cron, so opening a category never blocks on 7 LLM
  // pipelines at once.
  const cached = await Promise.all(boards.map((board) => readBoard(board.slug)));

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          {meta.label} 랭킹·지수 보드
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-muted">
          {boards.length}개 보드를 100점 척도 지수로 산출합니다. 각 보드에서 성별·연령별 순위를 따로
          볼 수 있습니다.
        </p>
      </header>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {boards.map((board, index) => (
          <BoardCard
            key={board.slug}
            title={board.title}
            criteria={board.criteria}
            href={boardPath(board.slug)}
            cached={cached[index]}
            desk={Boolean(board.deskKind)}
          />
        ))}
      </ul>

      <section className="rounded-2xl border border-line bg-board/40 px-5 py-4">
        <h2 className="text-sm font-semibold">다른 카테고리</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {POST_CHANNELS.filter((item) => item.id !== channel).map((item) => (
            <Link
              key={item.id}
              href={categoryBoardPath(item.id)}
              className="rounded-md border border-line px-3 py-1.5 text-xs text-muted hover:text-ink"
            >
              {item.label} 랭킹
            </Link>
          ))}
        </div>
      </section>

      <p className="text-[11px] leading-5 text-muted">
        지수와 순위는 공개 보도·검색 트렌드 신호를 종합한 편집 추정치입니다. 성별·연령별 수치는 검색
        트렌드의 인구통계 특성을 반영해 산출한 값으로, 실측 설문 결과가 아닙니다.
      </p>
    </div>
  );
}
