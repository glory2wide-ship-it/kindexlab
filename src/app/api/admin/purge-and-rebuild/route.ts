import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { kstDateString } from "@/lib/briefing/dates";
import { categoryBoardPath } from "@/lib/boards/registry";
import { cronAuthorized } from "@/lib/cron";
import { POST_CHANNELS } from "@/lib/posts/channels";
import type { PostChannel } from "@/lib/posts/types";
import { PREMIUM_BATCH_DELAY_MS, PREMIUM_BATCH_SIZE, runPremiumRebuild } from "@/lib/premium/batch";
import { collectPremiumTargets } from "@/lib/premium/keywords";
import { purgeContentStores } from "@/lib/premium/purge";
import { rankingPath } from "@/lib/slugs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;

/**
 * Ceiling on keywords per invocation. A premium column costs retrieval plus up
 * to three completions, so 25 keywords is five batches of five — comfortably
 * inside maxDuration, with the caller paging through via ?offset=.
 */
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 200;

function toInt(raw: string | null, fallback: number, max: number): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.min(parsed, max);
}

function parseChannel(raw: string | null): PostChannel | undefined {
  const allowed = POST_CHANNELS.map((channel) => channel.id);
  return allowed.includes(raw as PostChannel) ? (raw as PostChannel) : undefined;
}

/**
 * Purge every stored article, then regenerate the keyword universe as premium
 * SEO columns.
 *
 * Only the first page purges (offset 0) so a resumed run does not delete what
 * the previous page just wrote. Pass ?purge=0 to rebuild without wiping, or
 * ?channel=economy to scope the sweep to one category.
 */
async function handle(request: Request) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const params = new URL(request.url).searchParams;
  const limit = toInt(params.get("limit"), DEFAULT_LIMIT, MAX_LIMIT);
  const offset = toInt(params.get("offset"), 0, 10_000);
  const batchSize = toInt(params.get("batch"), PREMIUM_BATCH_SIZE, 20) || PREMIUM_BATCH_SIZE;
  const delayMs = toInt(params.get("delay"), PREMIUM_BATCH_DELAY_MS, 60_000);
  const channel = parseChannel(params.get("channel"));
  const editionDate = params.get("date") ?? kstDateString();
  const shouldPurge = offset === 0 && params.get("purge") !== "0";

  const purged = shouldPurge
    ? await purgeContentStores()
    : { analysis: 0, posts: 0, briefings: 0, total: 0 };

  if (shouldPurge) {
    console.log(
      `[1/3] 기존 DB 데이터 Purge 완료 (오늘의 분석 ${purged.analysis}건 · 이슈칼럼 ${purged.posts}건 · 일일브리핑/아카이브 ${purged.briefings}건)`,
    );
  } else {
    console.log("[1/3] Purge 생략 (이어받기 실행)");
  }

  const all = await collectPremiumTargets({ channel });
  const targets = all.slice(offset, offset + limit);

  console.log(
    `[2/3] 키워드 수집 및 배치 작업 시작 (총 ${targets.length}개 키워드${
      all.length !== targets.length ? ` / 전체 ${all.length}개 중 ${offset + 1}~${offset + targets.length}` : ""
    })`,
  );

  const run = await runPremiumRebuild(targets, {
    editionDate,
    batchSize,
    delayMs,
    onProgress: (item, position, total) => {
      const percent = Math.round((position / Math.max(1, total)) * 100);
      const status = item.ok
        ? `글 생성 완료 (${item.chars}자, 출처 ${item.sources}건)`
        : `건너뜀 [${item.reason}${item.detail ? `: ${item.detail}` : ""}]`;
      console.log(`[Progress] (${position}/${total}) '${item.keyword}' ${status} (${percent}% 진행 중...)`);
    },
  });

  for (const item of run.items) {
    if (item.ok) revalidatePath(rankingPath(item.slug));
  }
  for (const postChannel of POST_CHANNELS) {
    revalidatePath(categoryBoardPath(postChannel.id));
    revalidatePath(`/${postChannel.id}`);
  }
  revalidatePath("/briefing");

  const nextOffset = offset + targets.length;
  const done = nextOffset >= all.length;
  const totalMs = Date.now() - startedAt;

  if (done) {
    console.log(
      `[3/3] 전체 데이터 재생성 및 파이프라인 구축 완료! (생성 ${run.generated}건 · 실패 ${run.failed}건 · ${Math.round(totalMs / 1000)}초)`,
    );
  } else {
    console.log(
      `[3/3] 배치 구간 완료 — 다음 실행: ?offset=${nextOffset}&purge=0 (누적 ${nextOffset}/${all.length})`,
    );
  }

  return NextResponse.json({
    ok: true,
    editionDate,
    purged,
    registered: all.length,
    offset,
    processed: targets.length,
    generated: run.generated,
    failed: run.failed,
    batches: run.batches,
    batchSize,
    delayMs,
    done,
    nextOffset: done ? null : nextOffset,
    totalMs,
    items: run.items,
  });
}

export async function GET(request: Request) {
  try {
    return await handle(request);
  } catch (error) {
    console.error("[purge-and-rebuild]", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "rebuild failed" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
