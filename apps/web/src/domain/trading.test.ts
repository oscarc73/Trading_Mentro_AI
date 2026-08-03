import { describe, expect, it } from "vitest";
import {
  calculateGrossPnl,
  calculateReturnPercent,
  closePosition,
  normalizeExecutionConfig,
  openPosition,
  TradingDomainError,
} from "./execution";
import type { Candle, Direction } from "./types";

function candle(close: string, timestamp = "2025-01-01T00:00:00Z"): Candle {
  return {
    timestamp,
    open: close,
    high: close,
    low: close,
    close,
    volume: "10",
  };
}

describe("trading calculations", () => {
  it.each([
    ["long", "100", "110", "10"],
    ["long", "100", "90", "-10"],
    ["long", "100", "100", "0"],
    ["short", "100", "90", "10"],
    ["short", "100", "110", "-10"],
    ["short", "100", "100", "0"],
  ] as const)(
    "calculates %s P&L",
    (direction: Direction, entry, exit, expected) => {
      expect(calculateGrossPnl(direction, entry, exit, "1")).toBe(expected);
    },
  );

  it("calculates fractional quantities without binary floating-point drift", () => {
    expect(calculateGrossPnl("long", "0.1", "0.3", "0.2")).toBe("0.04");
  });

  it("uses absolute entry notional for return", () =>
    expect(calculateReturnPercent("10", "100", "1")).toBe("10"));

  it.each(["0", "NaN", "Infinity", "-1"])(
    "rejects invalid entry notional %s",
    (entry) => {
      expect(() => calculateReturnPercent("10", entry, "1")).toThrow(
        TradingDomainError,
      );
    },
  );
});

describe("execution configuration", () => {
  it("normalizes decimal configuration and makes zero assumptions explicit", () => {
    expect(
      normalizeExecutionConfig({
        quantity: "1.5000",
        feeBps: "5.0",
        slippageBps: "10.00",
      }),
    ).toEqual({
      quantity: "1.5",
      feeBps: "5",
      slippageBps: "10",
      fillPriceRule: "current candle close",
      spreadBps: "0",
      leverage: false,
    });
  });

  it.each([
    [{ quantity: "0", feeBps: "0", slippageBps: "0" }, "INVALID_QUANTITY"],
    [{ quantity: "1", feeBps: "-1", slippageBps: "0" }, "INVALID_FEE_RATE"],
    [
      { quantity: "1", feeBps: "0", slippageBps: "10000" },
      "INVALID_SLIPPAGE_RATE",
    ],
  ] as const)("rejects invalid config %#", (config, code) => {
    try {
      normalizeExecutionConfig(config);
      throw new Error("Expected configuration to fail.");
    } catch (cause) {
      expect(cause).toBeInstanceOf(TradingDomainError);
      expect((cause as TradingDomainError).code).toBe(code);
    }
  });
});

describe("orders, fills, and costs", () => {
  const config = { quantity: "1", feeBps: "5", slippageBps: "10" };

  it("applies adverse slippage and per-fill fees to a long trade", () => {
    const opened = openPosition({
      direction: "long",
      candle: candle("100"),
      candleIndex: 4,
      config,
      orderSequence: 1,
      fillSequence: 1,
    });
    expect(opened.order).toMatchObject({ id: "order-1", side: "buy" });
    expect(opened.fill).toMatchObject({
      id: "fill-1",
      referencePrice: "100",
      executionPrice: "100.1",
      fee: "0.05005",
      slippageCost: "0.1",
    });

    const closed = closePosition({
      position: opened.position,
      candle: candle("110", "2025-01-01T01:00:00Z"),
      candleIndex: 5,
      assumptions: opened.assumptions,
      orderSequence: 2,
      fillSequence: 2,
    });
    expect(closed.order).toMatchObject({ id: "order-2", side: "sell" });
    expect(closed.fill.executionPrice).toBe("109.89");
    expect(closed.trade).toMatchObject({
      grossPnl: "9.79",
      totalFees: "0.104995",
      slippageCost: "0.21",
      netPnl: "9.685005",
    });
  });
  it("preserves Sprint 01 results when all costs are zero", () => {
    const opened = openPosition({
      direction: "long",
      candle: candle("100"),
      candleIndex: 4,
      config: { quantity: "1", feeBps: "0", slippageBps: "0" },
      orderSequence: 1,
      fillSequence: 1,
    });
    const closed = closePosition({
      position: opened.position,
      candle: candle("110"),
      candleIndex: 5,
      assumptions: opened.assumptions,
      orderSequence: 2,
      fillSequence: 2,
    });
    expect(closed.trade).toMatchObject({
      grossPnl: "10",
      totalFees: "0",
      slippageCost: "0",
      netPnl: "10",
      netReturnPercent: "10",
    });
  });

  it("uses sell then buy fills for a short trade", () => {
    const opened = openPosition({
      direction: "short",
      candle: candle("100"),
      candleIndex: 4,
      config,
      orderSequence: 1,
      fillSequence: 1,
    });
    const closed = closePosition({
      position: opened.position,
      candle: candle("90"),
      candleIndex: 5,
      assumptions: opened.assumptions,
      orderSequence: 2,
      fillSequence: 2,
    });
    expect(opened.order.side).toBe("sell");
    expect(closed.order.side).toBe("buy");
    expect(closed.trade).toMatchObject({
      grossPnl: "9.81",
      totalFees: "0.094995",
      slippageCost: "0.19",
      netPnl: "9.715005",
    });
  });
});
