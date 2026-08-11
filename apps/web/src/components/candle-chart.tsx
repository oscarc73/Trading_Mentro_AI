"use client";

import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  LineSeries,
  type UTCTimestamp,
} from "lightweight-charts";
import type { Candle, MeanReversionPoint } from "@/domain/types";

export function CandleChart({
  candles,
  movingAverage,
}: {
  candles: Candle[];
  movingAverage: MeanReversionPoint[];
}) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!host.current) return;
    const chart = createChart(host.current, {
      autoSize: true,
      height: 410,
      layout: {
        background: { type: ColorType.Solid, color: "#0d1210" },
        textColor: "#7d8c84",
      },
      grid: {
        vertLines: { color: "#19211d" },
        horzLines: { color: "#19211d" },
      },
      rightPriceScale: { borderColor: "#26312b" },
      timeScale: {
        borderColor: "#26312b",
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        vertLine: { color: "#80eeb4" },
        horzLine: { color: "#80eeb4" },
      },
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#44d492",
      downColor: "#f16f6f",
      borderVisible: false,
      wickUpColor: "#44d492",
      wickDownColor: "#f16f6f",
    });
    series.setData(
      candles.map((candle) => ({
        time: Math.floor(
          new Date(candle.timestamp).getTime() / 1000,
        ) as UTCTimestamp,
        open: Number(candle.open),
        high: Number(candle.high),
        low: Number(candle.low),
        close: Number(candle.close),
      })),
    );
    const averageSeries = chart.addSeries(LineSeries, {
      color: "#e7dfca",
      lineWidth: 2,
      title: "SMA",
      priceLineVisible: false,
      lastValueVisible: true,
    });
    averageSeries.setData(
      movingAverage.map((point) => ({
        time: Math.floor(
          new Date(point.timestamp).getTime() / 1000,
        ) as UTCTimestamp,
        value: Number(point.movingAverage),
      })),
    );
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [candles, movingAverage]);

  return (
    <div
      ref={host}
      className="chart"
      aria-label={`Candlestick chart showing ${candles.length} revealed candles and ${movingAverage.length} SMA points`}
    />
  );
}
