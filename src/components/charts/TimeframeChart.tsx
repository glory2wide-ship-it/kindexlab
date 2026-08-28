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

  const width = compact ? 240 : 760;
  const height = compact ? 72 : 320;
  const padLeft = compact ? 4 : 52;
  const padRight = compact ? 4 : 16;
  const padTop = compact ? 6 : 18;
  const padBottom = compact ? 6 : 28;
  const values = points.map((point) => point.v);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const innerWidth = width - padLeft - padRight;
  const innerHeight = height - padTop - padBottom;
  const coords = points.map((point, index) => {
    const x = padLeft + (index / (points.length - 1)) * innerWidth;
    const y = padTop + innerHeight - ((point.v - min) / range) * innerHeight;
    return { ...point, x, y };
  });
  const last = coords[coords.length - 1];
  const polyline = coords.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `${padLeft},${height - padBottom} ${polyline} ${width - padRight},${height - padBottom}`;
  const stroke = positive ? "#f43f5e" : "#60a5fa";
  const fill = positive ? "rgba(244,63,94,0.14)" : "rgba(96,165,250,0.14)";
  const ticks = compact
    ? []
    : [coords[0], coords[Math.floor(coords.length / 2)], coords[coords.length - 1]].filter(
        Boolean,
      );
  const yTicks = compact
    ? []
    : [max, min + range / 2, min].map((value, index) => ({
        value,
        y: padTop + (innerHeight * index) / 2,
      }));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={compact ? "h-16 w-full" : "h-[20rem] w-full"}>
      {yTicks.map((tick) => (
        <g key={`y-${tick.value}`}>
          <line
            x1={padLeft}
            x2={width - padRight}
            y1={tick.y}
            y2={tick.y}
            stroke="currentColor"
            strokeOpacity={0.12}
          />
          <text
            x={padLeft - 8}
            y={tick.y + 3}
            textAnchor="end"
            fill="currentColor"
            fontSize="10"
          >
            {tick.value.toFixed(1)}
          </text>
        </g>
      ))}
      <polygon points={area} fill={fill} />
      <polyline
        points={polyline}
        fill="none"
        stroke={stroke}
        strokeWidth={compact ? 1.8 : 2.6}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {last && !compact ? (
        <circle cx={last.x} cy={last.y} r={4} fill={stroke} />
      ) : null}
      {ticks.map((tick) => (
        <text
          key={`${tick.t}-${tick.x}`}
          x={tick.x}
          y={height - 8}
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
