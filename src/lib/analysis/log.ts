/**
 * Pipeline tracing for the "오늘의 분석" chain.
 *
 * On by default outside production so `npm run dev` shows news retrieval, each
 * chaining step and the cache decision in the terminal. Set ANALYSIS_DEBUG=1 to
 * keep it on in a deployed environment, or 0 to silence it locally.
 */
function enabled(): boolean {
  const flag = process.env.ANALYSIS_DEBUG;
  if (flag === "1") return true;
  if (flag === "0") return false;
  return process.env.NODE_ENV !== "production";
}

const PREFIX = "[analysis]";

export interface AnalysisLogger {
  step(name: string, fields?: Record<string, unknown>): void;
  detail(text: string): void;
  warn(name: string, fields?: Record<string, unknown>): void;
  /** Milliseconds since the logger was created. */
  elapsed(): number;
}

function render(fields?: Record<string, unknown>): string {
  if (!fields) return "";
  return Object.entries(fields)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${key}=${typeof value === "string" ? value : JSON.stringify(value)}`)
    .join(" ");
}

export function analysisLogger(keyword: string): AnalysisLogger {
  const startedAt = Date.now();
  const on = enabled();
  const tag = `${PREFIX} ${keyword}`;

  return {
    step(name, fields) {
      if (!on) return;
      console.log(`${tag} · ${name} ${render(fields)}`.trimEnd());
    },
    detail(text) {
      if (!on) return;
      console.log(`${tag}   ${text}`);
    },
    warn(name, fields) {
      if (!on) return;
      console.warn(`${tag} · ${name} ${render(fields)}`.trimEnd());
    },
    elapsed() {
      return Date.now() - startedAt;
    },
  };
}
