/**
 * Serper is opt-in. Even when SERPER_API_KEY is present (local/Vercel/Actions),
 * calls stay off unless SERPER_ENABLED=1. Default is disabled to avoid burn.
 */
export function isSerperEnabled(): boolean {
  const flag = (process.env.SERPER_ENABLED ?? "").trim().toLowerCase();
  if (!(flag === "1" || flag === "true" || flag === "yes" || flag === "on")) {
    return false;
  }
  return Boolean(process.env.SERPER_API_KEY?.trim());
}
