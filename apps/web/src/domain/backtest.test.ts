import { describe, expect, it } from "vitest";
import {
  fingerprintBacktestResult,
  normalizeBacktestConfig,
  runBacktest,
} from "./backtest";
import type { Dataset } from "./types";

const fingerprint = "a".repeat(64);

function dataset(closes: string[], opens = closes): Dataset {
  return {
    fingerprint,
    metadata: {
      id: "test-1h",
      asset: "TEST/USD",
      timeframe: "1h",
      currency: "USD",
      data_kind: "historical-generated",
      source: "test",
      generated_at: "2026-08-16T00:00:00Z",
    },
    candles: closes.map((close, index) => ({
      timestamp: new Date(Date.UTC(2026, 0, 1, index)).toISOString(),
      open: opens[index],
      high: String(Math.max(Number(opens[index]), Number(close)) + 1),
      low: String(Math.min(Number(opens[index]), Number(close)) - 1),
      close,
      volume: "10",
    })),
  };
}

function config(feeBps = "0", slippageBps = "0") {
  return normalizeBacktestConfig({
    strategy: { lookback: 2, deviationThresholdPercent: "5" },
    execution: { quantity: "1", feeBps, slippageBps },
  });
}

describe("backtest engine", () => {
  it("evaluates close signals and executes them at the following open", () => {
    const result = runBacktest(
      dataset(
        ["100", "80", "100", "120", "100"],
        ["100", "90", "90", "110", "110"],
      ),
      config(),
    );
    expect(
      result.signals.map((signal) => [signal.candleIndex, signal.action]),
    ).toEqual([
      [1, "open_long"],
      [2, "close_long"],
      [3, "open_short"],
      [4, "close_short"],
    ]);
    expect(
      result.fills.map((fill) => [fill.candleIndex, fill.referencePrice]),
    ).toEqual([
      [2, "90"],
      [3, "110"],
      [4, "110"],
      [4, "100"],
    ]);
    expect(result.trades).toHaveLength(2);
    expect(result.trades[0]).toMatchObject({
      direction: "long",
      grossPnl: "20",
      exitReason: "strategy",
    });
    expect(result.trades[1]).toMatchObject({
      direction: "short",
      grossPnl: "10",
      exitReason: "end_of_data",
    });
    expect(result.forcedExitCount).toBe(1);
    expect(result.totalNetPnl).toBe("30");
  });

  it("applies adverse slippage and fees through shared execution formulas", () => {
    const result = runBacktest(
      dataset(["100", "80", "100"], ["100", "90", "90"]),
      config("10", "100"),
    );
    expect(result.fills[0]).toMatchObject({
      referencePrice: "90",
      executionPrice: "90.9",
      fee: "0.0909",
      slippageCost: "0.9",
    });
    expect(result.trades[0].exitReason).toBe("end_of_data");
    expect(result.totalFees).toBe(result.trades[0].totalFees);
    expect(result.totalNetPnl).toBe(result.trades[0].netPnl);
  });

  it("returns a valid zero-total no-trade result", () => {
    const result = runBacktest(dataset(["100", "100", "100", "100"]), config());
    expect(result.signals).toEqual([]);
    expect(result.trades).toEqual([]);
    expect(result).toMatchObject({
      tradeCount: 0,
      totalGrossPnl: "0",
      totalFees: "0",
      totalSlippageCost: "0",
      totalNetPnl: "0",
    });
  });

  it("keeps prior output unchanged when hidden future fields mutate", () => {
    const original = dataset(
      ["100", "80", "100", "120", "100"],
      ["100", "90", "90", "110", "110"],
    );
    const changed = structuredClone(original);
    changed.candles[3] = {
      ...changed.candles[3],
      open: "999",
      high: "1000",
      low: "1",
      close: "500",
      volume: "9999",
    };
    changed.candles[4] = { ...changed.candles[4], close: "2", low: "1" };
    const first = runBacktest(original, config());
    const second = runBacktest(changed, config());
    expect(first.signals.filter((signal) => signal.candleIndex <= 2)).toEqual(
      second.signals.filter((signal) => signal.candleIndex <= 2),
    );
    expect(first.fills.filter((fill) => fill.candleIndex <= 2)).toEqual(
      second.fills.filter((fill) => fill.candleIndex <= 2),
    );
  });

  it("is deterministic and fingerprints canonical results", async () => {
    const input = dataset(["100", "80", "100"]);
    const first = runBacktest(input, config());
    const second = runBacktest(input, config());
    expect(first).toEqual(second);
    expect(await fingerprintBacktestResult(first)).toBe(
      await fingerprintBacktestResult(second),
    );
    expect(await fingerprintBacktestResult(first)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects malformed dataset fingerprints and invalid configuration", () => {
    expect(() =>
      runBacktest({ ...dataset(["1", "1"]), fingerprint: "bad" }, config()),
    ).toThrow("SHA-256");
    expect(() =>
      normalizeBacktestConfig({
        strategy: { lookback: 1, deviationThresholdPercent: "1" },
        execution: { quantity: "1", feeBps: "0", slippageBps: "0" },
      }),
    ).toThrow("2 to 100");
  });
});
