export function normalizeName(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/\(.*?\)/g, "")
    .replace(/\[.*?\]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .toLowerCase();
}

export function slugify(value: string): string {
  const latin = value
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (latin && /^[a-z0-9-]+$/.test(latin) && latin.length >= 2) return latin.slice(0, 60);

  const compact = normalizeName(value).slice(0, 40);
  return compact || `entity-${hash(value)}`;
}

export function hash(input: string): string {
  let value = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    value ^= input.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return (value >>> 0).toString(36);
}

export function namesOverlap(a: string, b: string): boolean {
  const left = normalizeName(a);
  const right = normalizeName(b);
  if (!left || !right) return false;
  return left === right || (left.length >= 2 && right.includes(left)) || (right.length >= 2 && left.includes(right));
}
