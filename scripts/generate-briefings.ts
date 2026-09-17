/**
 * Daily briefing job — all five channels, mains + submenu deep-dives.
 *
 * Overnight / CI uses Gemini Batch (−50%) for every main + deep-dive in one
 * coalesced session. Pass `--no-batch` for Live API (local debugging).
 *
 * Usage:
 *   npm run briefing:generate:local
 *   npm run briefing:generate -- --force 2026-09-02
 *   npm run briefing:generate -- --batch --force
 *
 * Production: GitHub Actions `.github/workflows/daily-briefings.yml`
 * (04:00 KST → Gemini Batch → commit extra.json → Vercel deploy ~07:00 KST).
 */
import {
  briefingLlmConfigured,
  briefingProvider,
  geminiBatchEnabled,
} from "../src/lib/analysis/chain/llm";
import { kstDateString } from "../src/lib/briefing/dates";
import { runDailyBriefingJob } from "../src/lib/briefing/job";
import {
  deliverGenerationReport,
  persistGenerationReportForAdminSync,
  type GenerationReportRow,
} from "../src/lib/ops/generation-report";
import { resetGeminiUsage, snapshotGeminiUsage, formatKrw } from "../src/lib/ops/gemini-usage";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

function resolveOvernightBatch(): boolean {
  if (process.argv.includes("--no-batch")) return false;
  if (process.argv.includes("--batch")) return true;
  // CI overnight always Batches unless explicitly disabled via env.
  if (process.env.GITHUB_ACTIONS === "true" && process.env.GEMINI_USE_BATCH !== "0") {
    return true;
  }
  return geminiBatchEnabled();
}

function digestExists(editionDate: string): boolean {
  const dir = path.join(process.cwd(), "src/data/ops/daily");
  try {
    return readdirSync(dir).some(
      (name) => name.startsWith(`${editionDate}-briefings-`) && name.endsWith(".json"),
    );
  } catch {
    return false;
  }
}

function htmlReportExists(editionDate: string): boolean {
  return existsSync(
    path.join(process.cwd(), "artifacts", "generation-reports", `briefings-${editionDate}.html`),
  );
}

type EarlyExitGuard = { disarm: () => void };

/**
 * Last-resort guard: if the event loop empties after a Gemini Batch wave
 * without reaching writeReport (seen 2026-09-17 schedule on f989518), still
 * emit digest+HTML so CI assert/email are not a silent blackout.
 */
function installEarlyExitDigestGuard(
  editionDate: string,
  useGeminiBatch: boolean,
): EarlyExitGuard {
  let armed = true;
  const writeEmergency = (reason: string) => {
    if (!armed) return;
    armed = false;
    if (digestExists(editionDate) && htmlReportExists(editionDate)) return;
    try {
      process.env.REQUIRE_OPS_DIGEST = process.env.REQUIRE_OPS_DIGEST ?? "1";
      persistGenerationReportForAdminSync(
        {
          subject: `[KinDex] 브리핑 생성 보고 · ${editionDate}`,
          editionDate,
          pipeline: "daily-briefings",
          generatedAt: new Date().toISOString(),
          cost: snapshotGeminiUsage(),
          sections: [
            {
              title: "일일 브리핑",
              rows: [
                {
                  name: "daily-briefings",
                  status: "fail",
                  reason,
                  meta: "emergency-exit-guard",
                },
              ],
            },
          ],
          notes: [
            `Emergency digest: ${reason}`,
            `Gemini Batch=${useGeminiBatch}`,
            `API 추정 ${formatKrw(snapshotGeminiUsage().estimatedKrw)}`,
          ],
        },
        `briefings-${editionDate}`,
      );
      console.error(`[ops] emergency digest written (${reason})`);
    } catch (error) {
      console.error("[ops] emergency digest failed", error);
    }
    if (typeof process.exitCode !== "number" || process.exitCode === 0) {
      process.exitCode = 1;
    }
  };

  process.once("beforeExit", () => {
    writeEmergency("process beforeExit without completed briefing report");
  });
  process.once("SIGINT", () => {
    writeEmergency("SIGINT");
  });
  process.once("SIGTERM", () => {
    writeEmergency("SIGTERM");
  });

  return {
    disarm: () => {
      armed = false;
    },
  };
}

function toRow(outcome: {
  name: string;
  status: "ok" | "fail";
  channel: string;
  kind: string;
  deskLabel?: string;
  reason?: string;
}): GenerationReportRow {
  return {
    name: outcome.name,
    status: outcome.status,
    meta: [outcome.channel, outcome.kind, outcome.deskLabel].filter(Boolean).join(" · "),
    reason: outcome.reason,
  };
}

async function writeReport(options: {
  result: Awaited<ReturnType<typeof runDailyBriefingJob>>;
  useGeminiBatch: boolean;
  notes?: string[];
}): Promise<void> {
  const { result, useGeminiBatch } = options;
  const mains = result.outcomes.filter((item) => item.kind === "main");
  const dives = result.outcomes.filter((item) => item.kind === "deep-dive");
  const notes = [
    ...(options.notes ?? []),
    result.skipped ? `Job skipped: ${result.reason ?? "already published"}` : undefined,
    `Gemini Batch=${result.geminiBatch ?? useGeminiBatch}`,
    `API 추정 ${formatKrw(snapshotGeminiUsage().estimatedKrw)}`,
  ].filter(Boolean) as string[];

  const delivery = await deliverGenerationReport(
    {
      subject: `[KinDex] 브리핑·Update 키워드 생성 보고 · ${result.editionDate}`,
      editionDate: result.editionDate,
      pipeline: "daily-briefings",
      generatedAt: new Date().toISOString(),
      cost: snapshotGeminiUsage(),
      sections: [
        {
          title: "일일 브리핑",
          rows: mains.map((item) => ({
            ...toRow(item),
            status: result.skipped ? "skip" : item.status,
            reason: result.skipped ? result.reason ?? "already-published" : item.reason,
          })),
        },
        {
          title: "Update 키워드",
          rows: dives.map((item) => ({
            ...toRow(item),
            status: result.skipped ? "skip" : item.status,
            reason: result.skipped ? result.reason ?? "already-published" : item.reason,
          })),
        },
      ],
      notes,
    },
    `briefings-${result.editionDate}`,
  );
  console.log(`[report] ${delivery.detail}`);
}

async function main() {
  const force = process.argv.includes("--force");
  const editionDate = process.argv.find((arg) => /^\d{4}-\d{2}-\d{2}$/.test(arg)) ?? kstDateString();
  const useGeminiBatch = resolveOvernightBatch();
  resetGeminiUsage(process.env.GEMINI_MODEL?.trim() || "gemini-3.6-flash");

  if (useGeminiBatch && process.env.GEMINI_USE_BATCH !== "0") {
    process.env.GEMINI_USE_BATCH = "1";
  }

  if (!briefingLlmConfigured()) {
    console.error(
      `Briefing LLM is not configured (provider=${briefingProvider()}). Set GEMINI_API_KEY — briefings will fall back to templates.`,
    );
  }

  console.log(
    `Generating ${editionDate} briefings (force=${force}, provider=${briefingProvider()}, ai=${briefingLlmConfigured()}, geminiBatch=${useGeminiBatch})…`,
  );

  const exitGuard = installEarlyExitDigestGuard(editionDate, useGeminiBatch);

  let result: Awaited<ReturnType<typeof runDailyBriefingJob>> | null = null;
  let fatal: unknown = null;

  try {
    result = await runDailyBriefingJob({
      persist: true,
      force,
      editionDate,
      useGeminiBatch,
      onChannel: (channel, count) => {
        console.log(`  ${channel}: ${count} articles`);
      },
    });
  } catch (error) {
    fatal = error;
    console.error(error);
    // Minimal shell so CI still gets an ops digest + HTML even when the job aborts.
    result = {
      skipped: false,
      reason: error instanceof Error ? error.message : "generate failed",
      editionDate,
      persisted: false,
      removed: 0,
      articles: [],
      outcomes: [
        {
          name: "daily-briefings",
          title: "daily-briefings",
          kind: "main",
          channel: "",
          slug: `failed-${editionDate}`,
          status: "fail",
          reason: error instanceof Error ? error.message : "generate failed",
        },
      ],
      geminiBatch: useGeminiBatch,
    };
  }

  const mains = result.outcomes.filter((item) => item.kind === "main");
  const dives = result.outcomes.filter((item) => item.kind === "deep-dive");

  const summary = {
    skipped: result.skipped,
    reason: result.reason ?? null,
    editionDate: result.editionDate,
    removed: result.removed,
    persisted: result.persisted,
    geminiBatch: result.geminiBatch ?? useGeminiBatch,
    mainsOk: mains.filter((item) => item.status === "ok").length,
    mainsFail: mains.filter((item) => item.status === "fail").length,
    deepDivesOk: dives.filter((item) => item.status === "ok").length,
    deepDivesFail: dives.filter((item) => item.status === "fail").length,
    total: result.outcomes.length,
  };
  console.log(JSON.stringify(summary, null, 2));

  // Always write digest/HTML — Assert + email steps depend on these artifacts.
  process.env.REQUIRE_OPS_DIGEST = process.env.REQUIRE_OPS_DIGEST ?? "1";
  await writeReport({
    result,
    useGeminiBatch,
    notes: fatal
      ? [`Job aborted: ${fatal instanceof Error ? fatal.message : String(fatal)}`]
      : undefined,
  });

  if (!digestExists(editionDate) || !htmlReportExists(editionDate)) {
    console.error(
      `::error::Briefing report artifacts missing after writeReport edition=${editionDate} digest=${digestExists(editionDate)} html=${htmlReportExists(editionDate)}`,
    );
    process.exit(1);
  }
  exitGuard.disarm();

  if (fatal) {
    process.exit(1);
  }

  // Incomplete overnight edition: do not pretend success (seen 2026-09-17).
  if (!result.skipped) {
    const mainsOk = summary.mainsOk;
    const expectedMains = 5;
    if (mainsOk < expectedMains || summary.total < 20) {
      console.error(
        `::error::Incomplete briefing edition edition=${result.editionDate} mainsOk=${mainsOk}/${expectedMains} total=${summary.total}`,
      );
      process.exit(1);
    }
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
