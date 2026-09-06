const KST = "Asia/Seoul";

export function kstDateString(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: KST }).format(date);
}

export function formatKoreanDate(editionDate: string): string {
  const [, month, day] = editionDate.split("-");
  return `${Number(month)}월 ${Number(day)}일`;
}

export function editionDateTime(editionDate: string, hour = 7, minute = 5): string {
  return `${editionDate}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+09:00`;
}

export function isLiveEdition(editionDate: string, now = new Date()): boolean {
  return editionDate === kstDateString(now);
}

export function compareDatesDesc(a: string, b: string): number {
  return b.localeCompare(a);
}

export function isEditionDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function parseEditionDate(raw?: string | string[]): string | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || !isEditionDate(value)) return undefined;
  return value;
}
