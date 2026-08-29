function enabled(): boolean {
  const flag = process.env.INGEST_DEBUG;
  if (flag === "1") return true;
  if (flag === "0") return false;
  return process.env.NODE_ENV !== "production";
}

function render(fields?: Record<string, unknown>): string {
  if (!fields) return "";
  return Object.entries(fields)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${key}=${Array.isArray(value) ? value.join("|") : String(value)}`)
    .join(" ");
}

/** Mirrors the analysis logger so ingest and article traces read the same way. */
export function ingestLog(name: string, fields?: Record<string, unknown>): void {
  if (!enabled()) return;
  console.log(`[ingest] ${name} ${render(fields)}`.trimEnd());
}

export function ingestWarn(name: string, fields?: Record<string, unknown>): void {
  if (!enabled()) return;
  console.warn(`[ingest] ${name} ${render(fields)}`.trimEnd());
}
