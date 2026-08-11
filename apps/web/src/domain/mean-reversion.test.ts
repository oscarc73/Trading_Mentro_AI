import { describe, expect, it } from "vitest";
import {
  calculateMeanReversion,
  normalizeMeanReversionConfig,
} from "./mean-reversion";
import type { Candle } from "./types";

function candles(closes: string[]): Candle[] {
  return closes.map((close, index) => ({
    timestamp: new Date(Date.UTC(2025, 0, 1, index)).toISOString(),
    open: close,
    high: close,
    low: close,
    close,
    volume: "1",
  }));
}

describe("mean-reversion model", () => {
  it("calculates exact rolling decimal SMA and deviations", () => {
    const result = calculateMeanReversion(
      candles(["1.1", "2.2", "3.3", "4.4"]),
      { lookback: 3, deviationThresholdPercent: "10" },
    );
    expect(result.series).toHaveLength(2);
    expect(result.series[0]).toMatchObject({
      candleIndex: 2,
      movingAverage: "2.2",
      deviationPrice: "1.1",
      deviationPercent: "50",
      state: "above_reference",
    });
    expect(result.current?.movingAverage).toBe("3.3");
  });

  it("returns insufficient data without an authoritative point", () => {
    const result = calculateMeanReversion(candles(["10", "11"]), {
      lookback: 3,
      deviationThresholdPercent: "1",
    });
    expect(result.state).toBe("insufficient_data");
    expect(result.current).toBeNull();
    expect(result.candlesRequired).toBe(1);
  });

  it.each([
    ["96", "below_reference"],
    ["100", "near_reference"],
    ["104", "above_reference"],
  ] as const)("classifies %s relative to the current mean", (last, state) => {
    const result = calculateMeanReversion(candles(["100", last]), {
      lookback: 2,
      deviationThresholdPercent: "1",
    });
    expect(result.state).toBe(state);
    expect(result.current?.deviationPercent).toBeTypeOf("string");
  });

  it("places exact positive and negative equality inside near reference", () => {
    const positive = calculateMeanReversion(candles(["99", "101"]), {
      lookback: 2,
      deviationThresholdPercent: "1",
    });
    const negative = calculateMeanReversion(candles(["101", "99"]), {
      lookback: 2,
      deviationThresholdPercent: "1",
    });
    expect(positive.current?.deviationPercent).toBe("1");
    expect(negative.current?.deviationPercent).toBe("-1");
    expect(positive.state).toBe("near_reference");
    expect(negative.state).toBe("near_reference");
  });

  it("normalizes boundaries and rejects invalid configuration", () => {
    expect(
      normalizeMeanReversionConfig({
        lookback: 2,
        deviationThresholdPercent: "1.00",
      }),
    ).toEqual({
      lookback: 2,
      deviationThresholdPercent: "1",
    });
    expect(() =>
      normalizeMeanReversionConfig({
        lookback: 101,
        deviationThresholdPercent: "1",
      }),
    ).toThrow();
    expect(() =>
      normalizeMeanReversionConfig({
        lookback: 2.5,
        deviationThresholdPercent: "1",
      }),
    ).toThrow();
    expect(() =>
      normalizeMeanReversionConfig({
        lookback: 10,
        deviationThresholdPercent: "0",
      }),
    ).toThrow();
    expect(() =>
      normalizeMeanReversionConfig({
        lookback: 10,
        deviationThresholdPercent: "Infinity",
      }),
    ).toThrow();
  });

  it("is deterministic and unaffected by hidden future candles", () => {
    const revealed = candles(["1", "2", "3"]);
    const first = calculateMeanReversion(revealed, {
      lookback: 2,
      deviationThresholdPercent: "1",
    });
    const futureA = [...revealed, ...candles(["999"])];
    const futureB = [...revealed, ...candles(["0.001"])];
    expect(calculateMeanReversion(futureA.slice(0, 3), first.config)).toEqual(
      first,
    );
    expect(calculateMeanReversion(futureB.slice(0, 3), first.config)).toEqual(
      first,
    );
    expect(calculateMeanReversion(revealed, first.config)).toEqual(first);
  });
});
