import type { Dataset, SimulationState } from "@/domain/types";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

function formatMoney(value: string | number): string {
  return money.format(Number(value));
}

export function ResultCard({
  dataset,
  state,
  savePending,
}: {
  dataset: Dataset;
  state: SimulationState;
  savePending: boolean;
}) {
  const trade = state.trade;
  if (!trade) return null;
  return (
    <div className="result-card">
      <span>COMPLETED TRADE</span>
      <h3>{trade.direction === "long" ? "Long" : "Short"} result</h3>
      <div
        className={`result-pnl ${Number(trade.netPnl) >= 0 ? "positive" : "negative"}`}
      >
        {formatMoney(trade.netPnl)}
      </div>
      <p>{Number(trade.netReturnPercent).toFixed(3)}% net return</p>
      <dl>
        <div>
          <dt>Market</dt>
          <dd>
            {dataset.metadata.asset} · {dataset.metadata.timeframe}
          </dd>
        </div>
        <div>
          <dt>Entry fill</dt>
          <dd>
            {formatMoney(trade.entryPrice)}
            <small>
              Ref {formatMoney(trade.entryReferencePrice)} ·{" "}
              {trade.entryOrderId} → {trade.entryFillId}
            </small>
            <small>{new Date(trade.entryTime).toLocaleString()}</small>
          </dd>
        </div>
        <div>
          <dt>Exit fill</dt>
          <dd>
            {formatMoney(trade.exitPrice)}
            <small>
              Ref {formatMoney(trade.exitReferencePrice)} · {trade.exitOrderId}{" "}
              → {trade.exitFillId}
            </small>
            <small>{new Date(trade.exitTime).toLocaleString()}</small>
          </dd>
        </div>
        <div>
          <dt>Quantity</dt>
          <dd>{trade.quantity} BTC</dd>
        </div>
        <div>
          <dt>Gross P&amp;L</dt>
          <dd>{formatMoney(trade.grossPnl)}</dd>
        </div>
        <div>
          <dt>Total fees</dt>
          <dd>{formatMoney(trade.totalFees)}</dd>
        </div>
        <div>
          <dt>Slippage impact</dt>
          <dd>{formatMoney(trade.slippageCost)}</dd>
        </div>
        <div>
          <dt>Audit events</dt>
          <dd>{state.events.length}</dd>
        </div>
      </dl>
      <p className="result-note">
        Gross P&amp;L uses execution fill prices, so slippage is already
        embedded. Net P&amp;L subtracts both fill fees. Net return denominator:
        absolute entry execution notional. Spread 0 bps; no leverage.
      </p>
      {savePending ? (
        <p className="result-note">
          Completion is waiting to be saved. Retry above before leaving this
          session.
        </p>
      ) : null}
    </div>
  );
}
