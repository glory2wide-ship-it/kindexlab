export function heatFill(rate: number): string {
  const intensity = Math.min(1, Math.abs(rate) / 10);
  const mix = 22 + intensity * 78;
  const key = rate >= 0 ? "var(--color-up)" : "var(--color-down)";
  return `color-mix(in srgb, ${key} ${mix}%, var(--color-panel))`;
}

export function heatText(rate: number): string {
  return Math.abs(rate) >= 3 ? "#fff" : "var(--color-ink)";
}
