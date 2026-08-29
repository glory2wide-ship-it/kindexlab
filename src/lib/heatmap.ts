/** Heatmap + indicators: green up, red down, charcoal flat. */
export function heatFill(rate: number): string {
  const n = Number.isFinite(rate) ? rate : 0;
  if (n >= 3) return "#22c55e";
  if (n >= 1) return "#16a34a";
  if (n > 0.25) return "#14532D";
  if (n <= -3) return "#ef4444";
  if (n <= -1) return "#dc2626";
  if (n < -0.25) return "#7F1D1D";
  return "#27272A";
}

export function heatText(_rate: number): string {
  return "#FFFFFF";
}

export const HEAT_LEGEND_STOPS: { label: string; color: string }[] = [
  { label: "-3%", color: "#ef4444" },
  { label: "-2%", color: "#dc2626" },
  { label: "-1%", color: "#7F1D1D" },
  { label: "0%", color: "#27272A" },
  { label: "+1%", color: "#14532D" },
  { label: "+2%", color: "#16a34a" },
  { label: "+3%", color: "#22c55e" },
];
