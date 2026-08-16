import Decimal from "decimal.js";
import {
  closePosition,
  normalizeExecutionConfig,
  openPosition,
} from "./execution";
import {
  calculateMeanReversion,
  createStrategyContext,
} from "./mean-reversion";
import type {
  BacktestConfig,
  BacktestEvent,
  BacktestResult,
  BacktestSignal,
  BacktestSignalAction,
  BacktestTrade,
  Candle,
  Dataset,
  Direction,
  ExecutionConfig,
  MeanReversionConfig,
  MeanReversionPoint,
  Position,
} from "./types";

export const DEFAULT_BACKTEST_RULES = {
  model: "mean_reversion_threshold_v1",
  entrySignalTiming: "candle_close",
  signalFillTiming: "next_candle_open",
  finalPositionPolicy: "close_at_final_candle_close",
} as const;

export function normalizeBacktestConfig({
  strategy,
  execution,
}: {
  strategy: MeanReversionConfig;
  execution: ExecutionConfig;
}): BacktestConfig {
  const strategyContext = createStrategyContext(strategy);
  const assumptions = normalizeExecutionConfig(execution, "next candle open");
  return {
    strategyContext,
    rules: DEFAULT_BACKTEST_RULES,
    executionConfig: {
      quantity: assumptions.quantity,
      feeBps: assumptions.feeBps,
      slippageBps: assumptions.slippageBps,
    },
  };
}

type PendingAction = {
  signal: BacktestSignal;
  direction: Direction;
  intent: "open" | "close";
};

function signalAction(
  position: Position | null,
  point: MeanReversionPoint,
): BacktestSignalAction | null {
  if (!position) {
    if (point.state === "below_reference") return "open_long";
    if (point.state === "above_reference") return "open_short";
    return null;
  }
  if (
    position.direction === "long" &&
    (point.state === "near_reference" || point.state === "above_reference")
  ) {
    return "close_long";
  }
  if (
    position.direction === "short" &&
    (point.state === "near_reference" || point.state === "below_reference")
  ) {
    return "close_short";
  }
  return null;
}

function directionFor(action: BacktestSignalAction): Direction {
  return action.endsWith("long") ? "long" : "short";
}

function intentFor(action: BacktestSignalAction): "open" | "close" {
  return action.startsWith("open") ? "open" : "close";
}

export function runBacktest(
  dataset: Dataset,
  inputConfig: BacktestConfig,
): BacktestResult {
  if (!dataset.candles.length) throw new Error("Backtest dataset is empty.");
  if (!/^[a-f0-9]{64}$/.test(dataset.fingerprint)) {
    throw new Error("Dataset fingerprint must be a SHA-256 hex value.");
  }
  const config = normalizeBacktestConfig({
    strategy: inputConfig.strategyContext.config,
    execution: inputConfig.executionConfig,
  });
  const analysis = calculateMeanReversion(
    dataset.candles,
    config.strategyContext.config,
  );
  const pointByIndex = new Map(
    analysis.series.map((point) => [point.candleIndex, point]),
  );
  const assumptions = normalizeExecutionConfig(
    config.executionConfig,
    "next candle open",
  );
  const signals: BacktestSignal[] = [];
  const orders: BacktestResult["orders"] = [];
  const fills: BacktestResult["fills"] = [];
  const trades: BacktestTrade[] = [];
  const events: BacktestEvent[] = [];
  let position: Position | null = null;
  let entrySignalId: string | null = null;
  let pending: PendingAction | null = null;

  function addEvent(
    type: BacktestEvent["type"],
    candle: Candle,
    candleIndex: number,
    message: string,
    links: Partial<BacktestEvent> = {},
  ) {
    events.push({
      id: `event-${events.length + 1}`,
      sequence: events.length + 1,
      type,
      candleIndex,
      timestamp: candle.timestamp,
      message,
      ...links,
    });
  }

  for (const [candleIndex, candle] of dataset.candles.entries()) {
    if (pending) {
      if (pending.intent === "open") {
        const opened = openPosition({
          direction: pending.direction,
          candle,
          candleIndex,
          config: config.executionConfig,
          orderSequence: orders.length + 1,
          fillSequence: fills.length + 1,
          referencePriceField: "open",
          fillPriceRule: "next candle open",
        });
        orders.push(opened.order);
        fills.push(opened.fill);
        position = opened.position;
        entrySignalId = pending.signal.id;
        addEvent(
          "position_opened",
          candle,
          candleIndex,
          `${pending.direction} position opened at the next candle open.`,
          {
            signalId: pending.signal.id,
            orderId: opened.order.id,
            fillId: opened.fill.id,
          },
        );
      } else if (position) {
        const direction = position.direction;
        const closed = closePosition({
          position,
          candle,
          candleIndex,
          assumptions,
          orderSequence: orders.length + 1,
          fillSequence: fills.length + 1,
          referencePriceField: "open",
        });
        const trade: BacktestTrade = {
          ...closed.trade,
          id: `trade-${trades.length + 1}`,
          entrySignalId: entrySignalId!,
          exitSignalId: pending.signal.id,
          exitReason: "strategy",
        };
        orders.push(closed.order);
        fills.push(closed.fill);
        trades.push(trade);
        addEvent(
          "position_closed",
          candle,
          candleIndex,
          `${direction} position closed at the next candle open.`,
          {
            signalId: pending.signal.id,
            orderId: closed.order.id,
            fillId: closed.fill.id,
            tradeId: trade.id,
          },
        );
        position = null;
        entrySignalId = null;
      }
      pending = null;
    }

    const point = pointByIndex.get(candleIndex);
    if (!point) continue;
    const action = signalAction(position, point);
    if (!action) continue;
    const atEnd = candleIndex === dataset.candles.length - 1;
    const signal: BacktestSignal = {
      id: `signal-${signals.length + 1}`,
      candleIndex,
      timestamp: candle.timestamp,
      state: point.state,
      action,
      executionCandleIndex: atEnd ? null : candleIndex + 1,
      status: atEnd ? "ignored_end_of_data" : "executed",
    };
    signals.push(signal);
    addEvent(
      "signal_created",
      candle,
      candleIndex,
      `${action.replace("_", " ")} signal evaluated at candle close.`,
      { signalId: signal.id },
    );
    if (!atEnd) {
      pending = {
        signal,
        direction: directionFor(action),
        intent: intentFor(action),
      };
    }
  }

  if (position) {
    const candleIndex = dataset.candles.length - 1;
    const candle = dataset.candles[candleIndex];
    const direction = position.direction;
    const closed = closePosition({
      position,
      candle,
      candleIndex,
      assumptions,
      orderSequence: orders.length + 1,
      fillSequence: fills.length + 1,
      referencePriceField: "close",
    });
    const trade: BacktestTrade = {
      ...closed.trade,
      id: `trade-${trades.length + 1}`,
      entrySignalId: entrySignalId!,
      exitSignalId: null,
      exitReason: "end_of_data",
    };
    orders.push(closed.order);
    fills.push(closed.fill);
    trades.push(trade);
    addEvent(
      "end_of_data_close",
      candle,
      candleIndex,
      `${direction} position closed at the final candle close.`,
      {
        orderId: closed.order.id,
        fillId: closed.fill.id,
        tradeId: trade.id,
      },
    );
  }

  const sum = (values: string[]) =>
    values
      .reduce((total, value) => total.plus(value), new Decimal(0))
      .toString();
  return {
    schemaVersion: 1,
    engineVersion: "mean_reversion_backtest_v1",
    dataset: {
      id: dataset.metadata.id,
      generatedAt: dataset.metadata.generated_at,
      candleCount: dataset.candles.length,
      fingerprint: dataset.fingerprint,
    },
    config,
    signals,
    orders,
    fills,
    trades,
    events,
    candleCount: dataset.candles.length,
    tradeCount: trades.length,
    forcedExitCount: trades.filter(
      (trade) => trade.exitReason === "end_of_data",
    ).length,
    totalGrossPnl: sum(trades.map((trade) => trade.grossPnl)),
    totalFees: sum(trades.map((trade) => trade.totalFees)),
    totalSlippageCost: sum(trades.map((trade) => trade.slippageCost)),
    totalNetPnl: sum(trades.map((trade) => trade.netPnl)),
  };
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`)
    .join(",")}}`;
}

export async function fingerprintBacktestResult(
  result: BacktestResult,
): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalize(result));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
