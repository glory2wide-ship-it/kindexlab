"use client";

import { useEffect, useRef } from "react";
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
  type Time,
} from "lightweight-charts";
import {
  HTS_DOWN,
  HTS_UP,
  formatLwcTime,
  priceAutoscaleProvider,
  priceVisibleRange,
  toLwcSeries,
} from "@/lib/charts/lwc-data";
import type { CandlePoint, Timeframe } from "@/lib/types";

export type ChartStyle = "line" | "candle";

function readCssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function lockPriceScale(
  series: ISeriesApi<"Candlestick"> | ISeriesApi<"Area">,
  priceMin: number,
  priceMax: number,
) {
  const range = priceVisibleRange(priceMin, priceMax);
  const scale = series.priceScale();
  scale.applyOptions({
    scaleMargins: { top: 0.08, bottom: 0.1 },
    autoScale: true,
  });
  // AreaSeries otherwise pulls 0 into the scale → flat line at the top.
  scale.setAutoScale(false);
  scale.setVisibleRange(range);
}

export function TradingViewChart({
  candles,
  linePath,
  timeframe,
  style = "line",
  positive = true,
  height = 420,
}: {
  candles: CandlePoint[];
  linePath?: number[];
  timeframe: Timeframe;
  style?: ChartStyle;
  positive?: boolean;
  height?: number;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const priceRef = useRef<ISeriesApi<"Candlestick"> | ISeriesApi<"Area"> | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const labelsRef = useRef<Map<number, string>>(new Map());

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const board = readCssVar("--panel", "#fffdf8");
    const ink = readCssVar("--ink", "#141821");
    const muted = readCssVar("--muted", "#667085");
    const line = readCssVar("--line", "#e2dacb");

    const chart = createChart(host, {
      autoSize: true,
      height,
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
        scaleMargins: { top: 0.08, bottom: 0.1 },
        autoScale: true,
      },
      timeScale: {
        borderColor: line,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 4,
        barSpacing: 8,
        minBarSpacing: 3,
        tickMarkFormatter: (time: Time) => formatLwcTime(time, labelsRef.current),
      },
      localization: {
        locale: "ko-KR",
        timeFormatter: (time: Time) => formatLwcTime(time, labelsRef.current),
      },
    });

    chartRef.current = chart;

    const onResize = () => {
      if (priceRef.current) {
        const visible = priceRef.current.priceScale().getVisibleRange();
        if (visible) priceRef.current.priceScale().setVisibleRange(visible);
      }
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      markersRef.current = null;
      chart.remove();
      chartRef.current = null;
      priceRef.current = null;
    };
  }, [height]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || candles.length < 1) return;

    const { ohlc, area, labelByTime, priceMin, priceMax } = toLwcSeries(
      candles,
      timeframe,
      linePath,
    );
    labelsRef.current = labelByTime;
    const autoscale = priceAutoscaleProvider(priceMin, priceMax);

    markersRef.current = null;
    if (priceRef.current) {
      chart.removeSeries(priceRef.current);
      priceRef.current = null;
    }

    const tone = positive ? HTS_UP : HTS_DOWN;
    const panel = readCssVar("--panel", "#fffdf8");

    chart.timeScale().applyOptions({
      barSpacing: style === "candle" ? Math.max(2.5, Math.min(7, 720 / Math.max(ohlc.length, 1))) : 4.5,
    });

    if (style === "candle") {
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
          autoscaleInfoProvider: autoscale,
        },
        0,
      );
      candleSeries.setData(ohlc);
      lockPriceScale(candleSeries, priceMin, priceMax);
      priceRef.current = candleSeries;
    } else {
      // Prefer closes (1 point/bar). The OHLC walk path is 4× denser and can break the area series.
      const areaData =
        linePath && linePath.length === candles.length * 4
          ? ohlc.map((bar) => ({ time: bar.time, value: bar.close }))
          : area;

      const areaSeries = chart.addSeries(
        AreaSeries,
        {
          lineColor: tone,
          topColor: positive ? "rgba(22, 163, 74, 0.38)" : "rgba(220, 38, 38, 0.34)",
          bottomColor: positive ? "rgba(22, 163, 74, 0.05)" : "rgba(220, 38, 38, 0.05)",
          lineWidth: 3,
          lineType: LineType.Curved,
          relativeGradient: true,
          priceLineVisible: true,
          lastValueVisible: true,
          priceLineColor: tone,
          priceLineWidth: 1,
          crosshairMarkerVisible: true,
          crosshairMarkerRadius: 5,
          crosshairMarkerBorderColor: panel,
          crosshairMarkerBackgroundColor: tone,
          autoscaleInfoProvider: priceAutoscaleProvider(
            Math.min(...areaData.map((p) => p.value)),
            Math.max(...areaData.map((p) => p.value)),
          ),
        },
        0,
      );
      areaSeries.setData(areaData);
      const lineMin = Math.min(...areaData.map((p) => p.value));
      const lineMax = Math.max(...areaData.map((p) => p.value));
      lockPriceScale(areaSeries, lineMin, lineMax);
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

    chart.timeScale().fitContent();

    // fitContent can reset price scale — re-lock after it.
    if (priceRef.current) {
      if (style === "line") {
        const values =
          linePath && linePath.length === candles.length * 4
            ? ohlc.map((b) => b.close)
            : area.map((p) => p.value);
        lockPriceScale(priceRef.current, Math.min(...values), Math.max(...values));
      } else {
        lockPriceScale(priceRef.current, priceMin, priceMax);
      }
    }
  }, [candles, linePath, timeframe, style, positive, height]);

  return (
    <div className="relative w-full overflow-hidden rounded-lg border border-line/50 bg-panel">
      <div ref={hostRef} className="w-full" style={{ minHeight: height }} />
    </div>
  );
}
