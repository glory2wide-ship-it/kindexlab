import type { CandlePoint, SeriesPoint } from "@/lib/types";

export type ChartStyle = "line" | "candle";

function yAt(
  value: number,
  min: number,
  range: number,
  top: number,
  height: number,
): number {
  return top + height - ((value - min) / range) * height;
}

/** Catmull-Rom → cubic Bézier path for a smoother close line. */
function smoothClosePath(
  coords: { x: number; y: number }[],
): string {
  if (coords.length < 2) return "";
  if (coords.length === 2) {
    return `M ${coords[0]!.x} ${coords[0]!.y} L ${coords[1]!.x} ${coords[1]!.y}`;
  }
  let d = `M ${coords[0]!.x} ${coords[0]!.y}`;
  for (let i = 0; i < coords.length - 1; i += 1) {
    const p0 = coords[Math.max(0, i - 1)]!;
    const p1 = coords[i]!;
    const p2 = coords[i + 1]!;
    const p3 = coords[Math.min(coords.length - 1, i + 2)]!;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

function CompactLine({
  points,
  positive,
}: {
  points: SeriesPoint[];
  positive: boolean;
}) {
  const width = 240;
  const height = 72;
  const pad = 4;
  const values = points.map((point) => point.v);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const innerWidth = width - pad * 2;
  const innerHeight = height - pad * 2;
  const coords = points.map((point, index) => ({
    x: pad + (index / Math.max(points.length - 1, 1)) * innerWidth,
    y: pad + innerHeight - ((point.v - min) / range) * innerHeight,
  }));
  const stroke = positive ? "var(--color-hts-up)" : "var(--color-hts-down)";
  const path = smoothClosePath(coords);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-16 w-full">
      <path d={path} fill="none" stroke={stroke} strokeWidth={1.8} strokeLinejoin="round" />
    </svg>
  );
}

function VolumePane({
  candles,
  padLeft,
  padRight,
  width,
  volTop,
  volHeight,
  padBottom,
  height,
}: {
  candles: CandlePoint[];
  padLeft: number;
  padRight: number;
  width: number;
  volTop: number;
  volHeight: number;
  padBottom: number;
  height: number;
}) {
  const maxVol = Math.max(...candles.map((bar) => bar.v), 1);
  const innerWidth = width - padLeft - padRight;
  const slot = innerWidth / candles.length;
  const barW = Math.max(1.5, Math.min(8, slot * 0.42));

  return (
    <g aria-hidden>
      <line
        x1={padLeft}
        x2={width - padRight}
        y1={volTop - 4}
        y2={volTop - 4}
        stroke="currentColor"
        strokeOpacity={0.1}
      />
      {candles.map((bar, index) => {
        const cx = padLeft + slot * index + slot / 2;
        const volH = (bar.v / maxVol) * volHeight * 0.92;
        const volY = height - padBottom - volH;
        return (
          <rect
            key={`vol-${bar.t}-${index}`}
            x={cx - barW / 2}
            y={volY}
            width={barW}
            height={Math.max(1, volH)}
            fill="currentColor"
            opacity={0.18}
            rx={0.8}
          />
        );
      })}
    </g>
  );
}

function LineChart({ candles, positive }: { candles: CandlePoint[]; positive: boolean }) {
  const width = 760;
  const height = 340;
  const padLeft = 52;
  const padRight = 16;
  const padTop = 16;
  const padBottom = 26;
  const volGap = 8;
  const volHeight = 44;
  const priceHeight = height - padTop - padBottom - volHeight - volGap;
  const volTop = padTop + priceHeight + volGap;

  const values = candles.map((bar) => bar.c);
  const minRaw = Math.min(...values);
  const maxRaw = Math.max(...values);
  const padPct = 0.08;
  const span = maxRaw - minRaw || Math.max(Math.abs(maxRaw) * 0.02, 1);
  const min = minRaw - span * padPct;
  const max = maxRaw + span * padPct;
  const range = max - min || 1;

  const innerWidth = width - padLeft - padRight;
  const coords = candles.map((bar, index) => ({
    x: padLeft + (index / Math.max(candles.length - 1, 1)) * innerWidth,
    y: yAt(bar.c, min, range, padTop, priceHeight),
    t: bar.t,
  }));
  const linePath = smoothClosePath(coords);
  const last = coords[coords.length - 1];
  const areaPath = `${linePath} L ${last?.x ?? padLeft} ${padTop + priceHeight} L ${coords[0]?.x ?? padLeft} ${padTop + priceHeight} Z`;
  const stroke = positive ? "var(--color-hts-up)" : "var(--color-hts-down)";
  const fillId = positive ? "chartFillUp" : "chartFillDown";

  const yTicks = [maxRaw, (minRaw + maxRaw) / 2, minRaw].map((value) => ({
    value,
    y: yAt(value, min, range, padTop, priceHeight),
  }));
  const xTicks = [0, Math.floor(candles.length / 2), candles.length - 1]
    .filter((index, i, arr) => arr.indexOf(index) === i && index >= 0 && index < candles.length)
    .map((index) => ({ t: candles[index]!.t, x: coords[index]!.x }));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-[21rem] w-full">
      <defs>
        <linearGradient id="chartFillUp" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-hts-up)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--color-hts-up)" stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id="chartFillDown" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-hts-down)" stopOpacity="0.2" />
          <stop offset="100%" stopColor="var(--color-hts-down)" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {yTicks.map((tick) => (
        <g key={`y-${tick.value}`}>
          <line
            x1={padLeft}
            x2={width - padRight}
            y1={tick.y}
            y2={tick.y}
            stroke="currentColor"
            strokeOpacity={0.1}
            strokeDasharray="3 4"
          />
          <text x={padLeft - 8} y={tick.y + 3} textAnchor="end" fill="currentColor" fontSize="10">
            {tick.value.toFixed(1)}
          </text>
        </g>
      ))}

      <path d={areaPath} fill={`url(#${fillId})`} />
      <path
        d={linePath}
        fill="none"
        stroke={stroke}
        strokeWidth={2.2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {last ? (
        <>
          <circle cx={last.x} cy={last.y} r={4.5} fill={stroke} opacity={0.25} />
          <circle cx={last.x} cy={last.y} r={2.6} fill={stroke} />
        </>
      ) : null}

      <VolumePane
        candles={candles}
        padLeft={padLeft}
        padRight={padRight}
        width={width}
        volTop={volTop}
        volHeight={volHeight}
        padBottom={padBottom}
        height={height}
      />

      {xTicks.map((tick) => (
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

function CandleChart({ candles }: { candles: CandlePoint[] }) {
  const width = 760;
  const height = 340;
  const padLeft = 52;
  const padRight = 16;
  const padTop = 16;
  const padBottom = 26;
  const volGap = 8;
  const volHeight = 44;
  const priceHeight = height - padTop - padBottom - volHeight - volGap;
  const volTop = padTop + priceHeight + volGap;

  const highs = candles.map((bar) => bar.h);
  const lows = candles.map((bar) => bar.l);
  const minRaw = Math.min(...lows);
  const maxRaw = Math.max(...highs);
  const padPct = 0.06;
  const span = maxRaw - minRaw || Math.max(Math.abs(maxRaw) * 0.02, 1);
  const min = minRaw - span * padPct;
  const max = maxRaw + span * padPct;
  const range = max - min || 1;

  const innerWidth = width - padLeft - padRight;
  const slot = innerWidth / candles.length;
  // Slimmer bodies — reads as candles, not a bar chart.
  const bodyWidth = Math.max(1.8, Math.min(9, slot * 0.38));

  const yTicks = [maxRaw, (minRaw + maxRaw) / 2, minRaw].map((value) => ({
    value,
    y: yAt(value, min, range, padTop, priceHeight),
  }));
  const xTicks = [0, Math.floor(candles.length / 2), candles.length - 1]
    .filter((index, i, arr) => arr.indexOf(index) === i && index >= 0 && index < candles.length)
    .map((index) => ({
      t: candles[index]!.t,
      x: padLeft + slot * index + slot / 2,
    }));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-[21rem] w-full">
      {yTicks.map((tick) => (
        <g key={`y-${tick.value}`}>
          <line
            x1={padLeft}
            x2={width - padRight}
            y1={tick.y}
            y2={tick.y}
            stroke="currentColor"
            strokeOpacity={0.1}
            strokeDasharray="3 4"
          />
          <text x={padLeft - 8} y={tick.y + 3} textAnchor="end" fill="currentColor" fontSize="10">
            {tick.value.toFixed(1)}
          </text>
        </g>
      ))}

      {candles.map((bar, index) => {
        const up = bar.c >= bar.o;
        const color = up ? "var(--color-hts-up)" : "var(--color-hts-down)";
        const cx = padLeft + slot * index + slot / 2;
        const yHigh = yAt(bar.h, min, range, padTop, priceHeight);
        const yLow = yAt(bar.l, min, range, padTop, priceHeight);
        const yOpen = yAt(bar.o, min, range, padTop, priceHeight);
        const yClose = yAt(bar.c, min, range, padTop, priceHeight);
        const bodyTop = Math.min(yOpen, yClose);
        const bodyHeight = Math.max(1, Math.abs(yClose - yOpen));

        return (
          <g key={`${bar.t}-${index}`}>
            <line
              x1={cx}
              x2={cx}
              y1={yHigh}
              y2={yLow}
              stroke={color}
              strokeWidth={1}
              strokeLinecap="round"
            />
            {/* Hollow up / solid down — classic domestic HTS body. */}
            <rect
              x={cx - bodyWidth / 2}
              y={bodyTop}
              width={bodyWidth}
              height={bodyHeight}
              fill={up ? "var(--color-panel)" : color}
              stroke={color}
              strokeWidth={1.15}
            />
          </g>
        );
      })}

      <VolumePane
        candles={candles}
        padLeft={padLeft}
        padRight={padRight}
        width={width}
        volTop={volTop}
        volHeight={volHeight}
        padBottom={padBottom}
        height={height}
      />

      {xTicks.map((tick) => (
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

export function TimeframeChart({
  points,
  candles,
  positive,
  compact = false,
  style = "line",
}: {
  points?: SeriesPoint[];
  candles?: CandlePoint[];
  positive: boolean;
  compact?: boolean;
  style?: ChartStyle;
}) {
  if (compact) {
    const series =
      points && points.length >= 2
        ? points
        : (candles ?? []).map((bar) => ({ t: bar.t, v: bar.c }));
    if (series.length < 2) return null;
    return <CompactLine points={series} positive={positive} />;
  }

  if (candles && candles.length >= 1) {
    return style === "candle" ? (
      <CandleChart candles={candles} />
    ) : (
      <LineChart candles={candles} positive={positive} />
    );
  }

  if (!points || points.length < 2) return null;
  const asCandles: CandlePoint[] = points.map((point) => ({
    t: point.t,
    o: point.v,
    h: point.v,
    l: point.v,
    c: point.v,
    v: 1,
  }));
  return <LineChart candles={asCandles} positive={positive} />;
}
