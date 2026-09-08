"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  LineType,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type LogicalRange,
  type Time,
} from "lightweight-charts";
import {
  HTS_DOWN,
  HTS_UP,
  formatLwcTime,
  ohlcExtremes,
  priceAutoscaleProvider,
  priceVisibleRange,
  toLwcSeries,
  valueExtremes,
  type LwcCandle,
} from "@/lib/charts/lwc-data";
import type { CandlePoint, Timeframe } from "@/lib/types";

export type ChartStyle = "line" | "candle";

function readCssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

const PRICE_MARGINS = { top: 0.04, bottom: 0.05 } as const;
const MOBILE_MQ = "(max-width: 767px)";

function lockPriceScale(
  series: ISeriesApi<"Candlestick"> | ISeriesApi<"Area">,
  priceMin: number,
  priceMax: number,
) {
  const range = priceVisibleRange(priceMin, priceMax);
  const scale = series.priceScale();
  scale.applyOptions({
    scaleMargins: PRICE_MARGINS,
    autoScale: false,
  });
  // AreaSeries otherwise pulls 0 into the scale → flat line at the top.
  scale.setAutoScale(false);
  scale.setVisibleRange(range);
}

/**
 * Fit Y to the bars currently on screen — full-series min/max made KRW charts
 * look flat when history spanned far more than the visible window.
 */
function fitPriceToVisibleRange(
  chart: IChartApi,
  series: ISeriesApi<"Candlestick"> | ISeriesApi<"Area">,
  style: ChartStyle,
  ohlc: LwcCandle[],
  lineValues: number[],
  logical?: LogicalRange | null,
) {
  const range = logical ?? chart.timeScale().getVisibleLogicalRange();
  const from = range ? Math.floor(range.from) : 0;
  const to = range ? Math.ceil(range.to) : ohlc.length - 1;

  if (style === "candle") {
    const extremes = ohlcExtremes(ohlc, from, to) ?? ohlcExtremes(ohlc);
    if (extremes) lockPriceScale(series, extremes.min, extremes.max);
    return;
  }

  const extremes =
    valueExtremes(lineValues, from, to) ??
    valueExtremes(lineValues) ??
    ohlcExtremes(ohlc, from, to);
  if (extremes) lockPriceScale(series, extremes.min, extremes.max);
}

function resolveChartHeight(desktop: number): number {
  if (typeof window === "undefined") return desktop;
  return window.matchMedia(MOBILE_MQ).matches ? Math.round(desktop * 0.75) : desktop;
}

export function TradingViewChart({
  candles,
  linePath,
  timeframe,
  style = "line",
  positive = true,
  height = 420,
  pricePrecision = 2,
  /** Recent bars shown first; older loaded bars appear when panning left. */
  initialVisibleBars,
}: {
  candles: CandlePoint[];
  linePath?: number[];
  timeframe: Timeframe;
  style?: ChartStyle;
  positive?: boolean;
  height?: number;
  /** Decimal places on the right price scale (stocks/FX/commodities). */
  pricePrecision?: number;
  initialVisibleBars?: number;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const priceRef = useRef<ISeriesApi<"Candlestick"> | ISeriesApi<"Area"> | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const labelsRef = useRef<Map<number, string>>(new Map());
  const seriesDataRef = useRef<{ style: ChartStyle; ohlc: LwcCandle[]; lineValues: number[] }>({
    style: "line",
    ohlc: [],
    lineValues: [],
  });
  const fitRafRef = useRef<number | null>(null);
  const propsRef = useRef({
    candles,
    linePath,
    timeframe,
    style,
    positive,
    pricePrecision,
    initialVisibleBars,
  });
  propsRef.current = {
    candles,
    linePath,
    timeframe,
    style,
    positive,
    pricePrecision,
    initialVisibleBars,
  };

  const [resolvedHeight, setResolvedHeight] = useState(() => resolveChartHeight(height));

  // Mobile chart height is 25% shorter; desktop keeps the requested height.
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ);
    const apply = () => setResolvedHeight(resolveChartHeight(height));
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [height]);

  const applySeries = (chart: IChartApi) => {
    const {
      candles: nextCandles,
      linePath: nextLinePath,
      timeframe: nextTimeframe,
      style: nextStyle,
      positive: nextPositive,
      pricePrecision: nextPrecision,
      initialVisibleBars: nextVisibleBars,
    } = propsRef.current;
    if (nextCandles.length < 1) return;

    const { ohlc, area, labelByTime, priceMin, priceMax } = toLwcSeries(
      nextCandles,
      nextTimeframe,
      nextLinePath,
    );
    labelsRef.current = labelByTime;

    // Prefer closes (1 point/bar). The OHLC walk path is 4× denser and can break the area series.
    const lineValues =
      nextLinePath && nextLinePath.length === nextCandles.length * 4
        ? ohlc.map((bar) => bar.close)
        : area.map((point) => point.value);

    seriesDataRef.current = { style: nextStyle, ohlc, lineValues };

    const autoscale = priceAutoscaleProvider(priceMin, priceMax);
    const priceFormat = {
      type: "price" as const,
      precision: Math.min(Math.max(nextPrecision, 0), 4),
      minMove: Number(`1e-${Math.min(Math.max(nextPrecision, 0), 4)}`),
    };

    markersRef.current = null;
    if (priceRef.current) {
      chart.removeSeries(priceRef.current);
      priceRef.current = null;
    }

    const tone = nextPositive ? HTS_UP : HTS_DOWN;
    const panel = readCssVar("--panel", "#fffdf8");

    chart.timeScale().applyOptions({
      barSpacing:
        nextStyle === "candle"
          ? Math.max(3, Math.min(9, 720 / Math.max(Math.min(ohlc.length, 80), 1)))
          : 5,
      rightOffset: 4,
      fixLeftEdge: false,
      fixRightEdge: false,
    });

    if (nextStyle === "candle") {
      const candleSeries = chart.addSeries(
        CandlestickSeries,
        {
          upColor: HTS_UP,
          downColor: HTS_DOWN,
          borderUpColor: HTS_UP,
          borderDownColor: HTS_DOWN,
          wickUpColor: HTS_UP,
          wickDownColor: HTS_DOWN,
          borderVisible: true,
          wickVisible: true,
          priceLineVisible: true,
          lastValueVisible: true,
          priceLineColor: tone,
          priceLineWidth: 1,
          priceFormat,
          autoscaleInfoProvider: autoscale,
        },
        0,
      );
      candleSeries.setData(ohlc);
      priceRef.current = candleSeries;
    } else {
      const areaData =
        nextLinePath && nextLinePath.length === nextCandles.length * 4
          ? ohlc.map((bar) => ({ time: bar.time, value: bar.close }))
          : area;

      const areaSeries = chart.addSeries(
        AreaSeries,
        {
          lineColor: tone,
          topColor: nextPositive ? "rgba(22, 163, 74, 0.38)" : "rgba(220, 38, 38, 0.34)",
          bottomColor: nextPositive ? "rgba(22, 163, 74, 0.05)" : "rgba(220, 38, 38, 0.05)",
          lineWidth: 3,
          lineType: LineType.Curved,
          relativeGradient: true,
          priceLineVisible: true,
          lastValueVisible: true,
          priceLineColor: tone,
          priceLineWidth: 1,
          priceFormat,
          crosshairMarkerVisible: true,
          crosshairMarkerRadius: 5,
          crosshairMarkerBorderColor: panel,
          crosshairMarkerBackgroundColor: tone,
          autoscaleInfoProvider: priceAutoscaleProvider(
            Math.min(...lineValues),
            Math.max(...lineValues),
          ),
        },
        0,
      );
      areaSeries.setData(areaData);
      priceRef.current = areaSeries;

      const last = areaData[areaData.length - 1];
      if (last) {
        markersRef.current = createSeriesMarkers(areaSeries, [
          {
            time: last.time,
            position: "inBar",
            shape: "circle",
            color: tone,
            size: 1.5,
          },
        ]);
      }
    }

    // Show a recent window first so the user can drag right (pan left) into
    // earlier history instead of fitting every loaded bar into one screen.
    const total = ohlc.length;
    const preferred =
      typeof nextVisibleBars === "number" && nextVisibleBars > 0
        ? nextVisibleBars
        : Math.min(80, total);
    const visible = Math.max(12, Math.min(total, preferred));
    if (total > visible + 2) {
      chart.timeScale().setVisibleLogicalRange({
        from: total - visible,
        to: total - 1 + 3,
      });
    } else {
      chart.timeScale().fitContent();
    }

    // fitContent / setVisibleLogicalRange can reset price scale — lock to the
    // on-screen window so 분봉~월봉 moves read clearly (esp. KRW equities).
    if (priceRef.current) {
      fitPriceToVisibleRange(chart, priceRef.current, nextStyle, ohlc, lineValues);
    }
  };

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const board = readCssVar("--panel", "#fffdf8");
    const ink = readCssVar("--ink", "#141821");
    const muted = readCssVar("--muted", "#667085");
    const line = readCssVar("--line", "#e2dacb");
    const nextHeight = resolveChartHeight(height);

    const chart = createChart(host, {
      autoSize: true,
      width: Math.max(host.clientWidth || host.parentElement?.clientWidth || 320, 1),
      height: nextHeight,
      layout: {
        background: { type: ColorType.Solid, color: board },
        textColor: muted,
        fontFamily:
          '"Pretendard Variable", Pretendard, "Noto Sans KR", system-ui, sans-serif',
        fontSize: 11,
        attributionLogo: true,
      },
      grid: {
        vertLines: { color: line, style: 3 },
        horzLines: { color: line, style: 3 },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: muted,
          width: 1,
          style: 2,
          labelBackgroundColor: ink,
        },
        horzLine: {
          color: muted,
          width: 1,
          style: 2,
          labelBackgroundColor: ink,
        },
      },
      rightPriceScale: {
        borderColor: line,
        scaleMargins: PRICE_MARGINS,
        autoScale: false,
      },
      localization: {
        locale: "ko-KR",
        timeFormatter: (time: Time) => formatLwcTime(time, labelsRef.current),
        priceFormatter: (price: number) =>
          price.toLocaleString("ko-KR", {
            minimumFractionDigits: Math.min(pricePrecision, 4),
            maximumFractionDigits: Math.min(pricePrecision, 4),
          }),
      },
      timeScale: {
        borderColor: line,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 4,
        barSpacing: 8,
        minBarSpacing: 2,
        fixLeftEdge: false,
        fixRightEdge: false,
        lockVisibleTimeRangeOnResize: false,
        shiftVisibleRangeOnNewBar: true,
        tickMarkFormatter: (time: Time) => formatLwcTime(time, labelsRef.current),
      },
    });

    chartRef.current = chart;
    // Paint series immediately so Strict Mode remounts and mobile height
    // changes never leave an empty TradingView shell.
    applySeries(chart);

    const scheduleFit = (logical?: LogicalRange | null) => {
      if (fitRafRef.current != null) window.cancelAnimationFrame(fitRafRef.current);
      fitRafRef.current = window.requestAnimationFrame(() => {
        fitRafRef.current = null;
        const series = priceRef.current;
        if (!series) return;
        const { style: chartStyle, ohlc, lineValues } = seriesDataRef.current;
        if (!ohlc.length) return;
        fitPriceToVisibleRange(chart, series, chartStyle, ohlc, lineValues, logical);
      });
    };

    const onVisibleRange = (logical: LogicalRange | null) => {
      scheduleFit(logical);
    };
    chart.timeScale().subscribeVisibleLogicalRangeChange(onVisibleRange);

    const onResize = () => {
      scheduleFit();
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onVisibleRange);
      if (fitRafRef.current != null) window.cancelAnimationFrame(fitRafRef.current);
      markersRef.current = null;
      chart.remove();
      chartRef.current = null;
      priceRef.current = null;
    };
  }, [pricePrecision, height]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.applyOptions({ height: resolvedHeight });
  }, [resolvedHeight]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    applySeries(chart);
  }, [candles, linePath, timeframe, style, positive, pricePrecision, initialVisibleBars]);

  return (
    <div className="relative w-full overflow-hidden rounded-lg border border-line/50 bg-panel">
      <div ref={hostRef} className="w-full" style={{ minHeight: resolvedHeight, height: resolvedHeight }} />
    </div>
  );
}
