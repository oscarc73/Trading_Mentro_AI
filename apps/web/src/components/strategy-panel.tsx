import type { MeanReversionAnalysis } from "@/domain/types";

const stateLabels = {
  insufficient_data: "Insufficient data",
  below_reference: "Below reference",
  near_reference: "Near reference",
  above_reference: "Above reference",
} as const;

function signed(value: string, maximumFractionDigits: number): string {
  const numeric = Number(value);
  return `${numeric > 0 ? "+" : ""}${numeric.toLocaleString("en-US", {
    maximumFractionDigits,
  })}`;
}

export function StrategyPanel({
  analysis,
  currency,
  legacy = false,
}: {
  analysis: MeanReversionAnalysis | null;
  currency: string;
  legacy?: boolean;
}) {
  if (legacy || !analysis) {
    return (
      <section
        className="strategy-panel panel"
        aria-labelledby="strategy-heading"
      >
        <div className="strategy-panel-heading">
          <span>MEAN-REVERSION HYPOTHESIS</span>
          <h2 id="strategy-heading">Context not recorded</h2>
        </div>
        <p>
          This legacy Sprint 03 session has no saved strategy configuration.
          Trading history remains available and unchanged.
        </p>
      </section>
    );
  }

  const current = analysis.current;
  const money = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  });
  return (
    <section
      className={`strategy-panel panel strategy-${analysis.state}`}
      aria-labelledby="strategy-heading"
      aria-live="polite"
    >
      <div className="strategy-panel-heading">
        <span>MEAN-REVERSION HYPOTHESIS</span>
        <h2 id="strategy-heading">{stateLabels[analysis.state]}</h2>
      </div>
      {current ? (
        <dl className="strategy-metrics">
          <div>
            <dt>Current close</dt>
            <dd>{money.format(Number(current.close))}</dd>
          </div>
          <div>
            <dt>SMA ({analysis.config.lookback} closes)</dt>
            <dd>{money.format(Number(current.movingAverage))}</dd>
          </div>
          <div>
            <dt>Price deviation</dt>
            <dd>
              {signed(current.deviationPrice, 2)} {currency}
            </dd>
          </div>
          <div>
            <dt>Percent deviation</dt>
            <dd>{signed(current.deviationPercent, 3)}%</dd>
          </div>
          <div>
            <dt>Near-reference band</dt>
            <dd>Â±{analysis.config.deviationThresholdPercent}%</dd>
          </div>
        </dl>
      ) : (
        <p className="strategy-insufficient">
          Reveal {analysis.candlesRequired} more{" "}
          {analysis.candlesRequired === 1 ? "candle" : "candles"} to calculate
          the {analysis.config.lookback}-close SMA.
        </p>
      )}
      <p className="strategy-formula">
        deviation % = (close âˆ’ SMA) / SMA Ã— 100
      </p>
      <p className="strategy-explanation">{analysis.explanation}</p>
      <small>
        Configuration is locked for this session. Analysis is read-only and does
        not affect simulation actions or results.
      </small>
    </section>
  );
}
