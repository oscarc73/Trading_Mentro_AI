"use client";

import type { Dataset, SimulationSession } from "@/domain/types";
import { calculateMeanReversion } from "@/domain/mean-reversion";
import { StrategyPanel } from "./strategy-panel";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

export function SessionReview({
  dataset,
  session,
  onBack,
}: {
  dataset: Dataset;
  session: SimulationSession;
  onBack: () => void;
}) {
  const { state, executionConfig } = session.checkpoint;
  const trade = state.trade;
  const first = dataset.candles[0];
  const last = dataset.candles[state.cursor];
  const fillsByOrder = new Map(state.fills.map((fill) => [fill.orderId, fill]));
  const strategyAnalysis =
    session.checkpoint.schemaVersion === 2
      ? calculateMeanReversion(
          dataset.candles.slice(0, state.cursor + 1),
          session.checkpoint.strategyContext.config,
        )
      : null;
  return (
    <main className="review-shell">
      <header className="review-header">
        <div>
          <p className="eyebrow">READ-ONLY SESSION REVIEW</p>
          <h1>
            {session.status === "completed"
              ? "Completed practice."
              : "Abandoned practice."}
          </h1>
          <p>
            {session.dataset.asset} · {session.dataset.timeframe} ·{" "}
            {session.status}
          </p>
        </div>
        <button className="secondary-button" onClick={onBack}>
          Back to sessions
        </button>
      </header>

      <aside className="education-notice">
        <span>HYPOTHETICAL RESULT</span>
        <p>
          Historical simulation only. This review is educational and is not
          financial advice.
        </p>
      </aside>

      <section className="review-grid">
        <article className="review-card">
          <span className="eyebrow">SESSION</span>
          <dl>
            <div>
              <dt>Dataset range</dt>
              <dd>
                {new Date(first.timestamp).toLocaleString()} —{" "}
                {new Date(last.timestamp).toLocaleString()}
              </dd>
            </div>
            <div>
              <dt>Session duration</dt>
              <dd>
                {formatDuration(
                  session.createdAt,
                  session.completedAt ??
                    session.abandonedAt ??
                    session.updatedAt,
                )}
              </dd>
            </div>
            <div>
              <dt>Progress</dt>
              <dd>
                {state.cursor + 1} / {dataset.candles.length} candles
              </dd>
            </div>
            <div>
              <dt>Quantity</dt>
              <dd>{executionConfig.quantity}</dd>
            </div>
            <div>
              <dt>Execution</dt>
              <dd>
                Current close · {executionConfig.feeBps} fee bps ·{" "}
                {executionConfig.slippageBps} slippage bps
              </dd>
            </div>
          </dl>
        </article>
        <article className="review-card result-review">
          <span className="eyebrow">RESULT</span>
          {trade ? (
            <>
              <h2>
                {trade.direction.toUpperCase()} ·{" "}
                {money.format(Number(trade.netPnl))}
              </h2>
              <p>{Number(trade.netReturnPercent).toFixed(3)}% net return</p>
              <dl>
                <div>
                  <dt>Gross P&amp;L</dt>
                  <dd>{money.format(Number(trade.grossPnl))}</dd>
                </div>
                <div>
                  <dt>Fees</dt>
                  <dd>{money.format(Number(trade.totalFees))}</dd>
                </div>
                <div>
                  <dt>Slippage impact</dt>
                  <dd>{money.format(Number(trade.slippageCost))}</dd>
                </div>
                <div>
                  <dt>Net P&amp;L</dt>
                  <dd>{money.format(Number(trade.netPnl))}</dd>
                </div>
              </dl>
            </>
          ) : (
            <p>No completed trade was recorded.</p>
          )}
        </article>
      </section>

      <StrategyPanel
        analysis={strategyAnalysis}
        currency={dataset.metadata.currency}
        legacy={session.checkpoint.schemaVersion === 1}
      />

      <section className="review-card review-wide">
        <span className="eyebrow">ORDERS AND FILLS</span>
        {state.orders.length === 0 ? (
          <p>No orders were submitted.</p>
        ) : (
          <div className="audit-list">
            {state.orders.map((order) => {
              const fill = fillsByOrder.get(order.id);
              return (
                <div key={order.id} className="audit-row">
                  <strong>
                    {order.id} → {fill?.id}
                  </strong>
                  <span>
                    {order.intent} {order.side} · {order.quantity}
                  </span>
                  <span>
                    Reference {money.format(Number(fill?.referencePrice))} →
                    execution {money.format(Number(fill?.executionPrice))}
                  </span>
                  <small>
                    {new Date(order.submittedAt).toLocaleString()} · candle{" "}
                    {order.candleIndex + 1}
                  </small>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="review-card review-wide">
        <span className="eyebrow">DECISION AND AUDIT TIMELINE</span>
        <ol className="timeline">
          {state.events.map((event) => (
            <li key={event.id}>
              <strong>
                {event.id} · {event.type.replaceAll("_", " ")}
              </strong>
              <span>{event.message}</span>
              <small>
                {new Date(event.timestamp).toLocaleString()} · candle{" "}
                {event.candleIndex + 1}
              </small>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}

function formatDuration(start: string, end: string): string {
  const seconds = Math.max(
    0,
    Math.round((Date.parse(end) - Date.parse(start)) / 1000),
  );
  if (seconds < 60) return `${seconds} seconds`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}
