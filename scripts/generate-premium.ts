/**
 * Premium column generator.
 *
 * The rebuild pipeline previously had only an HTTP entry point
 * (`/api/admin/purge-and-rebuild`), which meant a full sweep had to be driven
 * from a laptop and paged around the route's `maxDuration`. A CLI has neither
 * limit, so the same run fits in one CI job and its output can be committed —
 * the only way generated work survives to production, since Vercel's filesystem
 * is read-only and `writeDisk` bails out there.
 *
 * Usage:
 *   npm run premium:generate                          # every keyword, no purge
 *   npm run premium:generate -- --limit=10            # trial slice
 *   npm run premium:generate -- --channel=economy
 *   npm run premium:generate -- --purge --date=2026-09-01
 *   npm run premium:generate -- --dry                 # list targets only
 */
import { kstDateString } from "../src/lib/briefing/dates";
import {
  PREMIUM_BATCH_DELAY_MS,
  PREMIUM_BATCH_SIZE,
  runPremiumRebuild,
} from "../src/lib/premium/batch";
import { collectPremiumTargets } from "../src/lib/premium/keywords";
import { purgeContentStores } from "../src/lib/premium/purge";
import { deliverGenerationReport } from "../src/lib/ops/generation-report";
import { formatKrw, resetGeminiUsage, snapshotGeminiUsage } from "../src/lib/ops/gemini-usage";
import { POST_CHANNELS } from "../src/lib/posts/channels";
import type { PostChannel } from "../src/lib/posts/types";

function flag(name: string): string | undefined {
  const match = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return match?.slice(name.length + 3);
}

function num(name: string, fallback: number): number {
  const parsed = Number.parseInt(flag(name) ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function parseChannel(): PostChannel | undefined {
  const raw = flag("channel");
  const allowed = POST_CHANNELS.map((channel) => channel.id);
  return allowed.includes(raw as PostChannel) ? (raw as PostChannel) : undefined;
}

async function main() {
  const startedAt = Date.now();
  const channel = parseChannel();
  const editionDate = flag("date") ?? kstDateString();
  const offset = num("offset", 0);
  const batchSize = num("batch", PREMIUM_BATCH_SIZE) || PREMIUM_BATCH_SIZE;
  const delayMs = num("delay", PREMIUM_BATCH_DELAY_MS);
  const shouldPurge = process.argv.includes("--purge");
  const dryRun = process.argv.includes("--dry");
  resetGeminiUsage(process.env.GEMINI_MODEL?.trim() || "gemini-3.6-flash");

  const all = await collectPremiumTargets({ channel });
  const limit = num("limit", all.length);
  const targets = all.slice(offset, offset + limit);

  if (dryRun) {
    console.log(`[dry] 대상 ${targets.length}건 / 전체 ${all.length}건 · edition=${editionDate}`);
    for (const [index, target] of targets.entries()) {
      console.log(`  ${String(index + 1).padStart(3)}. [${target.channel}] ${target.keyword}  → ${target.slug}`);
    }
    return;
  }

  if (shouldPurge) {
    const purged = await purgeContentStores();
    console.log(
      `[1/3] 기존 DB 데이터 Purge 완료 (오늘의 분석 ${purged.analysis}건 · 이슈칼럼 ${purged.posts}건 · 일일브리핑/아카이브 ${purged.briefings}건)`,
    );
  } else {
    console.log("[1/3] Purge 생략 (--purge 미지정)");
  }

  console.log(
    `[2/3] 키워드 수집 및 배치 작업 시작 (총 ${targets.length}개 키워드${
      all.length !== targets.length ? ` / 전체 ${all.length}개 중 ${offset + 1}~${offset + targets.length}` : ""
    }, 배치 ${batchSize}개씩)`,
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

  const seconds = Math.round((Date.now() - startedAt) / 1000);
  console.log(
    `[3/3] 완료 — 생성 ${run.generated}건 · 실패 ${run.failed}건 · ${run.batches}배치 · ${seconds}초`,
  );

  const reasons = new Map<string, number>();
  for (const item of run.items) {
    if (item.ok) continue;
    reasons.set(item.reason ?? "unknown", (reasons.get(item.reason ?? "unknown") ?? 0) + 1);
  }
  if (reasons.size) {
    console.log("실패 사유:");
    for (const [reason, count] of [...reasons].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(count).padStart(4)}건  ${reason}`);
    }
  }

  const chars = run.items.filter((item) => item.ok).map((item) => item.chars ?? 0);
  if (chars.length) {
    const mean = Math.round(chars.reduce((sum, value) => sum + value, 0) / chars.length);
    console.log(`평균 글자수(공백 제외): ${mean}자 · 최소 ${Math.min(...chars)} · 최대 ${Math.max(...chars)}`);
  }

  const delivery = await deliverGenerationReport(
    {
      subject: `[KindexLab] 이슈칼럼 생성 보고 · ${editionDate}`,
      editionDate,
      pipeline: "premium-columns",
      generatedAt: new Date().toISOString(),
      cost: snapshotGeminiUsage(),
      sections: [
        {
          title: "이슈칼럼",
          rows: run.items.map((item) => ({
            name: item.keyword,
            status: item.ok ? ("ok" as const) : ("fail" as const),
            meta: item.channel,
            reason: item.ok
              ? item.chars
                ? `${item.chars}자`
                : undefined
              : [item.reason, item.detail].filter(Boolean).join(": "),
          })),
        },
      ],
      notes: [
        `generated=${run.generated}`,
        `failed=${run.failed}`,
        `batches=${run.batches}`,
        `${seconds}s`,
        `API 추정 ${formatKrw(snapshotGeminiUsage().estimatedKrw)}`,
      ],
    },
    `premium-${editionDate}`,
  );
  console.log(`[report] ${delivery.detail}`);

  // A run that produced nothing is a failure worth surfacing to CI, but the
  // exit code is set rather than forced: `process.exit` can cut off the store
  // writes that are still flushing.
  if (run.generated === 0 && targets.length > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
