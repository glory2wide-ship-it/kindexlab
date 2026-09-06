import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  formatKrw,
  usdToKrw,
  type GeminiUsageSnapshot,
  snapshotGeminiUsage,
} from "@/lib/ops/gemini-usage";

export type ReportRowStatus = "ok" | "fail" | "skip";

export interface GenerationReportRow {
  name: string;
  status: ReportRowStatus;
  meta?: string;
  reason?: string;
  /** Optional per-item estimate when attribution is available. */
  costUsd?: number;
}

export interface GenerationReportSection {
  /** e.g. 일일 브리핑 / Update 키워드 / 이슈칼럼 / 오늘의 분석 */
  title: string;
  rows: GenerationReportRow[];
}

export interface GenerationReport {
  subject: string;
  editionDate: string;
  pipeline: string;
  generatedAt: string;
  sections: GenerationReportSection[];
  notes?: string[];
  /** Gemini API usage + estimated USD for this run. */
  cost?: GeminiUsageSnapshot;
}

export const DEFAULT_REPORT_EMAIL_TO = "glory2wide@gmail.com";

export function countByStatus(rows: GenerationReportRow[]): {
  ok: number;
  fail: number;
  skip: number;
  total: number;
} {
  let ok = 0;
  let fail = 0;
  let skip = 0;
  for (const row of rows) {
    if (row.status === "ok") ok += 1;
    else if (row.status === "fail") fail += 1;
    else skip += 1;
  }
  return { ok, fail, skip, total: rows.length };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function statusLabel(status: ReportRowStatus): string {
  if (status === "ok") return "성공";
  if (status === "fail") return "실패";
  return "스킵";
}

function statusColor(status: ReportRowStatus): string {
  if (status === "ok") return "#0f7b3a";
  if (status === "fail") return "#b42318";
  return "#667085";
}

function costTable(cost: GeminiUsageSnapshot): string {
  return `
  <section style="margin:0 0 24px;">
    <h2 style="margin:0 0 8px;font-size:16px;">API 비용 (추정 · 원화)</h2>
    <p style="margin:0 0 10px;padding:10px 12px;background:#eff8ff;border:1px solid #b2ddff;border-radius:8px;font-size:14px;">
      이번 실행 추정 합계 <strong>${formatKrw(cost.estimatedKrw)}</strong>
      · 모델 ${escapeHtml(cost.model)}
      · 호출 ${cost.calls.toLocaleString("ko-KR")}회
      · 토큰 ${cost.totalTokens.toLocaleString("ko-KR")}
      · 환율 1 USD = ${cost.usdKrwRate.toLocaleString("ko-KR")}원
    </p>
    <table style="border-collapse:collapse;width:100%;font-size:13px;margin-bottom:8px;">
      <thead>
        <tr style="background:#f2f4f7;">
          <th style="padding:6px 8px;border:1px solid #e4e7ec;text-align:left;">모드</th>
          <th style="padding:6px 8px;border:1px solid #e4e7ec;text-align:right;">호출</th>
          <th style="padding:6px 8px;border:1px solid #e4e7ec;text-align:right;">입력 토큰</th>
          <th style="padding:6px 8px;border:1px solid #e4e7ec;text-align:right;">출력 토큰</th>
          <th style="padding:6px 8px;border:1px solid #e4e7ec;text-align:right;">추정 비용(원)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding:6px 8px;border:1px solid #e4e7ec;">Live</td>
          <td style="padding:6px 8px;border:1px solid #e4e7ec;text-align:right;">${cost.live.calls.toLocaleString("ko-KR")}</td>
          <td style="padding:6px 8px;border:1px solid #e4e7ec;text-align:right;">${cost.live.promptTokens.toLocaleString("ko-KR")}</td>
          <td style="padding:6px 8px;border:1px solid #e4e7ec;text-align:right;">${cost.live.completionTokens.toLocaleString("ko-KR")}</td>
          <td style="padding:6px 8px;border:1px solid #e4e7ec;text-align:right;">${formatKrw(cost.liveKrw)}</td>
        </tr>
        <tr>
          <td style="padding:6px 8px;border:1px solid #e4e7ec;">Batch (−50%)</td>
          <td style="padding:6px 8px;border:1px solid #e4e7ec;text-align:right;">${cost.batch.calls.toLocaleString("ko-KR")}</td>
          <td style="padding:6px 8px;border:1px solid #e4e7ec;text-align:right;">${cost.batch.promptTokens.toLocaleString("ko-KR")}</td>
          <td style="padding:6px 8px;border:1px solid #e4e7ec;text-align:right;">${cost.batch.completionTokens.toLocaleString("ko-KR")}</td>
          <td style="padding:6px 8px;border:1px solid #e4e7ec;text-align:right;">${formatKrw(cost.batchKrw)}</td>
        </tr>
        <tr style="background:#f9fafb;font-weight:600;">
          <td style="padding:6px 8px;border:1px solid #e4e7ec;">합계</td>
          <td style="padding:6px 8px;border:1px solid #e4e7ec;text-align:right;">${cost.calls.toLocaleString("ko-KR")}</td>
          <td style="padding:6px 8px;border:1px solid #e4e7ec;text-align:right;">${cost.promptTokens.toLocaleString("ko-KR")}</td>
          <td style="padding:6px 8px;border:1px solid #e4e7ec;text-align:right;">${cost.completionTokens.toLocaleString("ko-KR")}</td>
          <td style="padding:6px 8px;border:1px solid #e4e7ec;text-align:right;">${formatKrw(cost.estimatedKrw)}</td>
        </tr>
      </tbody>
    </table>
    <p style="margin:0;color:#667085;font-size:11px;">${escapeHtml(cost.pricingNote)}</p>
  </section>`;
}

function sectionTable(section: GenerationReportSection): string {
  const counts = countByStatus(section.rows);
  const showCost = section.rows.some((row) => typeof row.costUsd === "number");
  const rowsHtml = section.rows.length
    ? section.rows
        .map(
          (row, index) => `
      <tr>
        <td style="padding:6px 8px;border:1px solid #e4e7ec;text-align:right;">${index + 1}</td>
        <td style="padding:6px 8px;border:1px solid #e4e7ec;">${escapeHtml(row.name)}</td>
        <td style="padding:6px 8px;border:1px solid #e4e7ec;color:${statusColor(row.status)};font-weight:600;">${statusLabel(row.status)}</td>
        <td style="padding:6px 8px;border:1px solid #e4e7ec;color:#475467;font-size:12px;">${escapeHtml(row.meta ?? "")}</td>
        <td style="padding:6px 8px;border:1px solid #e4e7ec;color:#475467;font-size:12px;">${escapeHtml(row.reason ?? "")}</td>
        ${
          showCost
            ? `<td style="padding:6px 8px;border:1px solid #e4e7ec;text-align:right;font-size:12px;">${
                typeof row.costUsd === "number" ? formatKrw(usdToKrw(row.costUsd)) : "—"
              }</td>`
            : ""
        }
      </tr>`,
        )
        .join("")
    : `
      <tr>
        <td colspan="${showCost ? 6 : 5}" style="padding:10px 8px;border:1px solid #e4e7ec;color:#667085;">대상 없음</td>
      </tr>`;

  return `
  <section style="margin:0 0 28px;">
    <h2 style="margin:0 0 8px;font-size:16px;">${escapeHtml(section.title)}</h2>
    <p style="margin:0 0 10px;color:#475467;font-size:13px;">
      성공 <strong style="color:#0f7b3a;">${counts.ok}</strong>
      · 실패 <strong style="color:#b42318;">${counts.fail}</strong>
      · 스킵 <strong style="color:#667085;">${counts.skip}</strong>
      · 합계 ${counts.total}
    </p>
    <table style="border-collapse:collapse;width:100%;font-size:13px;">
      <thead>
        <tr style="background:#f2f4f7;">
          <th style="padding:6px 8px;border:1px solid #e4e7ec;text-align:right;width:40px;">#</th>
          <th style="padding:6px 8px;border:1px solid #e4e7ec;text-align:left;">종목/키워드</th>
          <th style="padding:6px 8px;border:1px solid #e4e7ec;text-align:left;width:64px;">결과</th>
          <th style="padding:6px 8px;border:1px solid #e4e7ec;text-align:left;">구분</th>
          <th style="padding:6px 8px;border:1px solid #e4e7ec;text-align:left;">사유</th>
          ${
            showCost
              ? `<th style="padding:6px 8px;border:1px solid #e4e7ec;text-align:right;width:88px;">비용</th>`
              : ""
          }
        </tr>
      </thead>
      <tbody>${rowsHtml}
      </tbody>
    </table>
  </section>`;
}

export function renderGenerationReportHtml(report: GenerationReport): string {
  const allRows = report.sections.flatMap((section) => section.rows);
  const totals = countByStatus(allRows);
  const cost = report.cost ?? snapshotGeminiUsage();
  const notes = (report.notes ?? [])
    .map((note) => `<li style="margin:0 0 4px;">${escapeHtml(note)}</li>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="utf-8"><title>${escapeHtml(report.subject)}</title></head>
<body style="margin:0;padding:24px;font-family:Segoe UI,Apple SD Gothic Neo,Malgun Gothic,sans-serif;color:#101828;background:#fff;">
  <h1 style="margin:0 0 6px;font-size:20px;">${escapeHtml(report.subject)}</h1>
  <p style="margin:0 0 18px;color:#475467;font-size:13px;">
    에디션 ${escapeHtml(report.editionDate)} · 파이프라인 ${escapeHtml(report.pipeline)} · ${escapeHtml(report.generatedAt)}
  </p>
  <p style="margin:0 0 20px;padding:10px 12px;background:#f9fafb;border:1px solid #e4e7ec;border-radius:8px;font-size:14px;">
    전체 성공 <strong style="color:#0f7b3a;">${totals.ok}</strong>
    · 실패 <strong style="color:#b42318;">${totals.fail}</strong>
    · 스킵 <strong style="color:#667085;">${totals.skip}</strong>
    · 합계 ${totals.total}
    · API 추정 <strong>${formatKrw(cost.estimatedKrw)}</strong>
  </p>
  ${costTable(cost)}
  ${report.sections.map(sectionTable).join("\n")}
  ${notes ? `<ul style="margin:0;padding-left:18px;color:#475467;font-size:13px;">${notes}</ul>` : ""}
  <p style="margin:24px 0 0;color:#98a2b3;font-size:11px;">KinDex overnight generation report · recipient ${DEFAULT_REPORT_EMAIL_TO}</p>
</body>
</html>`;
}

export function renderGenerationReportText(report: GenerationReport): string {
  const cost = report.cost ?? snapshotGeminiUsage();
  const lines: string[] = [
    report.subject,
    `edition=${report.editionDate} pipeline=${report.pipeline}`,
    `api_cost_krw=${formatKrw(cost.estimatedKrw)} (fx ${cost.usdKrwRate} KRW/USD) tokens=${cost.totalTokens} calls=${cost.calls}`,
    `live_krw=${formatKrw(cost.liveKrw)} batch_krw=${formatKrw(cost.batchKrw)} model=${cost.model}`,
    "",
  ];
  for (const section of report.sections) {
    const counts = countByStatus(section.rows);
    lines.push(`## ${section.title}`);
    lines.push(`성공 ${counts.ok} · 실패 ${counts.fail} · 스킵 ${counts.skip} · 합계 ${counts.total}`);
    for (const [index, row] of section.rows.entries()) {
      const costPart =
        typeof row.costUsd === "number" ? ` · ${formatKrw(usdToKrw(row.costUsd))}` : "";
      lines.push(
        `${index + 1}. [${statusLabel(row.status)}] ${row.name}${row.meta ? ` (${row.meta})` : ""}${row.reason ? ` — ${row.reason}` : ""}${costPart}`,
      );
    }
    lines.push("");
  }
  lines.push(cost.pricingNote);
  for (const note of report.notes ?? []) lines.push(`- ${note}`);
  return lines.join("\n");
}

export async function writeGenerationReportArtifacts(
  report: GenerationReport,
  fileStem: string,
): Promise<{ jsonPath: string; htmlPath: string; textPath: string }> {
  const dir = path.join(process.cwd(), "artifacts", "generation-reports");
  await mkdir(dir, { recursive: true });
  const jsonPath = path.join(dir, `${fileStem}.json`);
  const htmlPath = path.join(dir, `${fileStem}.html`);
  const textPath = path.join(dir, `${fileStem}.txt`);
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(htmlPath, `${renderGenerationReportHtml(report)}\n`, "utf8");
  await writeFile(textPath, `${renderGenerationReportText(report)}\n`, "utf8");
  return { jsonPath, htmlPath, textPath };
}

async function sendViaResend(options: {
  to: string;
  from: string;
  subject: string;
  html: string;
  text: string;
  apiKey: string;
}): Promise<void> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: options.from,
      to: [options.to],
      subject: options.subject,
      html: options.html,
      text: options.text,
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Resend ${response.status}: ${detail.slice(0, 400)}`);
  }
}

/**
 * Writes HTML/JSON/text artifacts. Email is sent by CI (`scripts/ci-email-report.sh`)
 * using RESEND_API_KEY or Gmail SMTP secrets — keep generation decoupled from mail.
 */
export async function deliverGenerationReport(
  report: GenerationReport,
  fileStem: string,
): Promise<{ emailed: boolean; to?: string; detail: string; htmlPath: string }> {
  const withCost: GenerationReport = {
    ...report,
    cost: report.cost ?? snapshotGeminiUsage(),
  };
  const artifacts = await writeGenerationReportArtifacts(withCost, fileStem);
  const to = (process.env.REPORT_EMAIL_TO ?? DEFAULT_REPORT_EMAIL_TO).trim();

  // Optional local/CI Node send when explicitly requested.
  if (process.env.REPORT_EMAIL_SEND === "1") {
    const html = renderGenerationReportHtml(withCost);
    const text = renderGenerationReportText(withCost);
    const resendKey = (process.env.RESEND_API_KEY ?? "").trim();
    const from =
      (process.env.REPORT_EMAIL_FROM ?? "").trim() || "KinDex Reports <onboarding@resend.dev>";
    if (resendKey) {
      try {
        await sendViaResend({
          to,
          from,
          subject: withCost.subject,
          html,
          text,
          apiKey: resendKey,
        });
        return {
          emailed: true,
          to,
          detail: `resend → ${artifacts.htmlPath}`,
          htmlPath: artifacts.htmlPath,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[report] email failed: ${message}`);
        return {
          emailed: false,
          to,
          detail: `email error; wrote ${artifacts.htmlPath}`,
          htmlPath: artifacts.htmlPath,
        };
      }
    }
  }

  return {
    emailed: false,
    to,
    detail: `wrote ${artifacts.htmlPath} (CI email step → ${to})`,
    htmlPath: artifacts.htmlPath,
  };
}
