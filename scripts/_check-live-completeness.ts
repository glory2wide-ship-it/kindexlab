/**
 * Heatmap LIVE completeness report by channel / board.
 *
 *   npm run live:completeness
 */
import { evaluateLiveCompleteness } from "@/lib/ops/live-completeness";

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

async function main() {
  const report = await evaluateLiveCompleteness();
  if (!report.snapshotItems) {
    console.error("No snapshot — cannot score LIVE completeness");
    process.exit(1);
  }

  console.log("=== Heatmap LIVE completeness ===");
  console.log(`snapshot updatedAt=${report.snapshotUpdatedAt}`);
  console.log(`screen cap=${report.screenCap} · level=${report.level}\n`);

  for (const channel of report.channels) {
    console.log(`## ${channel.channel}`);
    for (const board of channel.boards) {
      const flag = board.native ? " [native]" : "";
      console.log(
        `  ${board.slug}${flag}: live ${board.liveInHead}/${report.screenCap} (${pct(board.livePct)}) · fill ${board.fill}/${report.screenCap}`,
      );
    }
    console.log(`  → ${channel.detail}\n`);
  }

  console.log("## landing 종합");
  console.log(
    `  screen-${report.screenCap} live lead=${report.landingLiveLead}/${report.screenCap} (${pct(report.landingLivePct)})`,
  );

  console.log("\n=== Category summary ===");
  for (const row of report.channels) {
    console.log(
      `${row.channel.padEnd(14)} live≈${pct(row.livePct).padStart(4)} · fill≈${pct(row.fillPct).padStart(4)}`,
    );
  }
  const avgLive =
    report.channels.reduce((sum, row) => sum + row.livePct, 0) / Math.max(1, report.channels.length);
  const avgFill =
    report.channels.reduce((sum, row) => sum + row.fillPct, 0) / Math.max(1, report.channels.length);
  console.log(`ALL            live≈${pct(avgLive).padStart(4)} · fill≈${pct(avgFill).padStart(4)}`);
  for (const note of report.notes) console.log(`note: ${note}`);
}

void main();
