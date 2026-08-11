import Decimal from "decimal.js";
import type {
  Candle,
  MeanReversionAnalysis,
  MeanReversionConfig,
  MeanReversionPoint,
  StrategyContext,
} from "./types";

export const DEFAULT_MEAN_REVERSION_CONFIG: MeanReversionConfig = {
  lookback: 10,
  deviationThresholdPercent: "1",
};

export class MeanReversionDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MeanReversionDomainError";
  }
}

function decimal(value: string, label: string): Decimal {
  let result: Decimal;
  try {
    result = new Decimal(value);
  } catch {
    throw new MeanReversionDomainError(
      `${label} must be a finite decimal value.`,
    );
  }
  if (!result.isFinite()) {
    throw new MeanReversionDomainError(
      `${label} must be a finite decimal value.`,
    );
  }
  return result;
}

export function normalizeMeanReversionConfig(
  config: MeanReversionConfig,
): MeanReversionConfig {
  if (
    !Number.isInteger(config.lookback) ||
    config.lookback < 2 ||
    config.lookback > 100
  ) {
    throw new MeanReversionDomainError(
      "Lookback must be a whole number from 2 to 100 candles.",
    );
  }
  const threshold = decimal(
    config.deviationThresholdPercent,
    "Deviation threshold",
  );
  if (!threshold.gt(0)) {
    throw new MeanReversionDomainError(
      "Deviation threshold must be a positive finite decimal value.",
    );
  }
  return {
    lookback: config.lookback,
    deviationThresholdPercent: threshold.toString(),
  };
}

export function createStrategyContext(
  config: MeanReversionConfig,
): StrategyContext {
  return {
    model: "sma_deviation_v1",
    config: normalizeMeanReversionConfig(config),
  };
}

export function calculateMeanReversion(
  revealedCandles: readonly Candle[],
  inputConfig: MeanReversionConfig,
): MeanReversionAnalysis {
  const config = normalizeMeanReversionConfig(inputConfig);
  const threshold = new Decimal(config.deviationThresholdPercent);
  const closes = revealedCandles.map((candle) => {
    const close = decimal(candle.close, "Candle close");
    if (!close.isPositive()) {
      throw new MeanReversionDomainError("Candle close must be positive.");
    }
    return close;
  });
  const series: MeanReversionPoint[] = [];
  let rollingSum = new Decimal(0);

  closes.forEach((close, candleIndex) => {
    rollingSum = rollingSum.plus(close);
    if (candleIndex >= config.lookback) {
      rollingSum = rollingSum.minus(closes[candleIndex - config.lookback]);
    }
    if (candleIndex < config.lookback - 1) return;

    const movingAverage = rollingSum.div(config.lookback);
    const deviationPrice = close.minus(movingAverage);
    const deviationPercent = deviationPrice.div(movingAverage).times(100);
    const state = deviationPercent.lt(threshold.negated())
      ? "below_reference"
      : deviationPercent.gt(threshold)
        ? "above_reference"
        : "near_reference";
    series.push({
      candleIndex,
      timestamp: revealedCandles[candleIndex].timestamp,
      close: close.toString(),
      movingAverage: movingAverage.toString(),
      deviationPrice: deviationPrice.toString(),
      deviationPercent: deviationPercent.toString(),
      state,
    });
  });

  const current = series.at(-1) ?? null;
  return {
    model: "sma_deviation_v1",
    config,
    state: current?.state ?? "insufficient_data",
    current,
    series,
    candlesRequired: Math.max(0, config.lookback - revealedCandles.length),
    explanation: current
      ? "This close-only model describes price relative to a recent unweighted mean. Mean reversion is a hypothesis, not a prediction; price can continue moving away from the mean."
      : "No reference is available until the full close-price lookback is revealed. Mean reversion is a hypothesis, not a prediction.",
  };
}
