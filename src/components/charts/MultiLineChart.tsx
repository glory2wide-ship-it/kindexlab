"use client";

export interface ChartLine {
  id: string;
  label: string;
  color: string;
  width?: number;
  dashed?: boolean;
  values: (number | undefined)[];
}

export function MultiLineChart({
  labels,
  lines,
}: {
  labels: string[];
  lines: ChartLine[];
}) {
  const width = 760;
  const height = 320;
  const padLeft = 44;
  const padRight = 16;
  const padTop = 18;
  const padBottom = 36;
  const numbers = lines.flatMap((line) => line.values.filter((value): value is number => value != null));
  if (labels.length < 2 || numbers.length < 2) {
    return <p className="py-16 text-center text-sm text-muted">표시할 시계열 포인트가 없습니다.</p>;
  }
  const min = Math.min(...numbers) - 1;
  const max = Math.max(...numbers) + 1;
  const range = max - min || 1;
  const innerWidth = width - padLeft - padRight;
  const innerHeight = height - padTop - padBottom;
  const x = (index: number) => padLeft + (index / Math.max(labels.length - 1, 1)) * innerWidth;
  const y = (value: number) => padTop + innerHeight - ((value - min) / range) * innerHeight;

  const yTicks = [max, min + range / 2, min];
  const xTicks = [0, Math.floor(labels.length / 2), labels.length - 1];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-[20rem] w-full text-muted" role="img">
      {yTicks.map((tick) => (
        <g key={`y-${tick}`}>
          <line
            x1={padLeft}
            x2={width - padRight}
            y1={y(tick)}
            y2={y(tick)}
            stroke="currentColor"
            strokeOpacity={0.12}
          />
          <text x={padLeft - 8} y={y(tick) + 3} textAnchor="end" fill="currentColor" fontSize="10">
            {tick.toFixed(1)}
          </text>
        </g>
      ))}
      {lines.map((line) => {
        const pts = line.values
          .map((value, index) => (value == null ? null : `${x(index)},${y(value)}`))
          .filter((value): value is string => Boolean(value));
        if (pts.length < 2) return null;
        // Pinned to `number`: the array holds `number | undefined`, so the
        // inferred overload would widen the accumulator to match it.
        const lastIndex = line.values.reduce<number>(
          (found, value, index) => (value != null ? index : found),
          -1,
        );
        const lastValue = lastIndex >= 0 ? line.values[lastIndex] : undefined;
        return (
          <g key={line.id}>
            <polyline
              points={pts.join(" ")}
              fill="none"
              stroke={line.color}
              strokeWidth={line.width ?? 1.8}
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray={line.dashed ? "5 4" : undefined}
            />
            {lastValue != null ? <circle cx={x(lastIndex)} cy={y(lastValue)} r={3.4} fill={line.color} /> : null}
          </g>
        );
      })}
      {xTicks.map((index) => (
        <text
          key={`x-${index}`}
          x={x(index)}
          y={height - 10}
          textAnchor="middle"
          fill="currentColor"
          fontSize="10"
        >
          {labels[index]}
        </text>
      ))}
    </svg>
  );
}
