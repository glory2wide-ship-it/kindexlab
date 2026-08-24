import type { SeriesPoint } from "@/lib/types";

export function TimeframeChart({
  points,
  positive,
  compact = false,
}: {
  points: SeriesPoint[];
  positive: boolean;
  compact?: boolean;
}) {
  if (points.length < 2) return null;

  const width = compact ? 240 : 640;
  const height = compact ? 72 : 220;
  const padX = compact ? 4 : 8;
  const padY = compact ? 6 : 24;
  const values = points.map((point) => point.v);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const coords = points.map((point, index) => {
    const x = padX + (index / (points.length - 1)) * (width - padX * 2);
    const y = height - padY - ((point.v - min) / range) * (height - padY * 2);
    return { ...point, x, y };
  });
  const polyline = coords.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `${padX},${height} ${polyline} ${width - padX},${height}`;
  const stroke = positive ? "#f43f5e" : "#60a5fa";
  const fill = positive ? "rgba(244,63,94,0.14)" : "rgba(96,165,250,0.14)";
  const ticks = compact
    ? []
    : [coords[0], coords[Math.floor(coords.length / 2)], coords[coords.length - 1]].filter(
        Boolean,
      );

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={compact ? "h-16 w-full" : "h-56 w-full"}>
      <polygon points={area} fill={fill} />
      <polyline
        points={polyline}
        fill="none"
        stroke={stroke}
        strokeWidth={compact ? 1.8 : 2.6}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {ticks.map((tick) => (
        <text
          key={`${tick.t}-${tick.x}`}
          x={tick.x}
          y={height - 6}
          textAnchor="middle"
          fill="currentColor"
          fontSize="10"
        >
          {tick.t}
        </text>
      ))}
    </svg>
  );
}
