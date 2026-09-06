import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BoardDesk } from "@/components/boards/BoardRankingPanel";
import { HeadlineNewsRanking } from "@/components/politics/HeadlineNewsRanking";
import { getOrCreateBoard } from "@/lib/boards/pipeline";
import {
  BOARD_SLUG_ALIASES,
  BOARDS,
  boardPath,
  menuBoardsForChannel,
  categoryBoardPath,
  getBoard,
  isDeskBoard,
} from "@/lib/boards/registry";
import { boardUsesRegionFilter } from "@/lib/boards/regions";
import { getPostChannel } from "@/lib/posts/channels";
import { SITE } from "@/lib/site";
import { DeskEyebrow } from "@/components/ui/DeskEyebrow";

export const dynamic = "force-dynamic";
export const dynamicParams = true;
export const maxDuration = 300;

export function generateStaticParams() {
  return BOARDS.map((board) => ({ slug: board.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const board = getBoard(slug);
  if (!board) return { title: "랭킹 보드를 찾을 수 없습니다" };
  if (isDeskBoard(board)) {
    return {
      title: board.title,
      description: board.criteria,
      alternates: { canonical: boardPath(board.slug) },
    };
  }
  const regionHint = boardUsesRegionFilter(board.slug) ? "·지역별 " : "";
  return {
    title: `${board.title} TOP 10`,
    description: `${board.criteria} 기준으로 산출한 ${board.title} 상위 순위와 성별·연령${regionHint}순위.`,
    alternates: { canonical: boardPath(board.slug) },
  };
}

export default async function BoardDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const alias = BOARD_SLUG_ALIASES[slug];
  if (alias) redirect(boardPath(alias));
  const board = getBoard(slug);
  if (!board) notFound();

  const channel = getPostChannel(board.channel);
  const siblings = menuBoardsForChannel(board.channel).filter((item) => item.slug !== board.slug);

  if (isDeskBoard(board)) {
    return (
      <div className="space-y-8">
        <p className="text-sm text-muted">
          <Link href={categoryBoardPath(board.channel)}>{channel.label} 랭킹</Link>
          <span className="mx-2">/</span>
          {board.title}
        </p>
        <header className="space-y-1">
          <DeskEyebrow variant="xs">{channel.eyebrow}</DeskEyebrow>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{board.title}</h1>
          <p className="max-w-2xl text-sm leading-6 text-muted">산출 기준 · {board.criteria}</p>
        </header>
        {board.deskKind === "headlines" ? <HeadlineNewsRanking channel={board.channel} /> : null}
        {siblings.length ? (
          <section>
            <h2 className="mb-3 text-lg font-semibold">{channel.label} 다른 랭킹</h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {siblings.map((item) => (
                <li key={item.slug}>
                  <Link
                    href={boardPath(item.slug)}
                    className="block rounded-xl border border-line bg-panel px-4 py-3 hover:bg-board/60"
                  >
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="mt-0.5 text-xs text-muted">{item.criteria}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    );
  }

  const { entry } = await getOrCreateBoard(board);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: board.title,
    url: `${SITE.url}${boardPath(board.slug)}`,
    itemListElement: entry.ranking.map((row) => ({
      "@type": "ListItem",
      position: row.rank,
      name: row.name,
    })),
  };

  return (
    <div className="space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <p className="text-sm text-muted">
        <Link href={categoryBoardPath(board.channel)}>{channel.label} 랭킹</Link>
        <span className="mx-2">/</span>
        {board.title}
      </p>

      <header className="space-y-1">
        <DeskEyebrow variant="xs">{channel.eyebrow}</DeskEyebrow>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{board.title}</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted">산출 기준 · {board.criteria}</p>
      </header>

      <BoardDesk board={entry} unitLabel={board.unitLabel} />

      {entry.pump ? (
        <section className="rounded-2xl border border-line bg-panel p-5">
          <h2 className="text-sm font-semibold">{entry.pump.shortsTitle}</h2>
          <p className="mt-0.5 text-xs text-muted">15초 숏폼 대본 · 고정 댓글 세트</p>
          <ol className="mt-3 space-y-1.5 text-sm leading-7 text-ink/85">
            {entry.pump.shortsScript.map((line, index) => (
              <li key={line} className="flex gap-2">
                <span className="font-sans text-xs tabular-nums text-muted">{index + 1}</span>
                <span>{line}</span>
              </li>
            ))}
          </ol>
          <p className="mt-3 rounded-lg bg-board px-3 py-2 text-xs leading-6 text-muted">
            고정 댓글 · {entry.pump.pinnedComment}
          </p>
        </section>
      ) : null}

      {siblings.length ? (
        <section>
          <h2 className="mb-3 text-lg font-semibold">{channel.label} 다른 랭킹</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {siblings.map((item) => (
              <li key={item.slug}>
                <Link
                  href={boardPath(item.slug)}
                  className="block rounded-xl border border-line bg-panel px-4 py-3 hover:bg-board/60"
                >
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="mt-0.5 text-xs text-muted">{item.criteria}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
