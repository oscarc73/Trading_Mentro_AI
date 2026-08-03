"use client";

import { useEffect, useMemo, useReducer, useState } from "react";
import type { Dataset, Direction, ExecutionConfig } from "@/domain/types";
import { initialSimulationState, simulationReducer } from "@/domain/simulation";
import {
  DEFAULT_EXECUTION_CONFIG,
  normalizeExecutionConfig,
  previewPosition,
  TradingDomainError,
} from "@/domain/execution";
import { CandleChart } from "./candle-chart";

const INITIAL_WINDOW = 12;
const SPEEDS = [
  { label: "0.5×", ms: 2000 },
  { label: "1×", ms: 1000 },
  { label: "2×", ms: 500 },
];
const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

function formatMoney(value: string | number): string {
  return money.format(Number(value));
}

export function Simulator({ dataset }: { dataset: Dataset }) {
  const initialCursor = Math.min(INITIAL_WINDOW, dataset.candles.length) - 1;
  const [state, dispatch] = useReducer(
    simulationReducer,
    initialCursor,
    initialSimulationState,
  );
  const [config, setConfig] = useState<ExecutionConfig>({
    ...DEFAULT_EXECUTION_CONFIG,
  });
  const [speed, setSpeed] = useState(1000);
  const [notice, setNotice] = useState(
    "Practice mode ready. Future candles remain hidden.",
  );
  const current = dataset.candles[state.cursor];
  const revealed = useMemo(
    () => dataset.candles.slice(0, state.cursor + 1),
    [dataset.candles, state.cursor],
  );
  const atEnd = state.cursor === dataset.candles.length - 1;
  const configError = useMemo(() => {
    try {
      normalizeExecutionConfig(config);
      return null;
    } catch (cause) {
      return cause instanceof TradingDomainError
        ? cause.message
        : "Execution settings are invalid.";
    }
  }, [config]);
  const preview =
    state.position && state.assumptions
      ? previewPosition(state.position, current, state.assumptions)
      : null;

  useEffect(() => {
    if (state.latestError) setNotice(state.latestError.message);
  }, [state.latestError]);

  useEffect(() => {
    if (state.playback !== "playing") return;
    const timer = window.setInterval(
      () => dispatch({ type: "NEXT", total: dataset.candles.length }),
      speed,
    );
    return () => window.clearInterval(timer);
  }, [state.playback, speed, dataset.candles.length]);

  function open(direction: Direction) {
    dispatch({ type: "OPEN", direction, candle: current, config });
    setNotice(
      `${direction === "long" ? "Long" : "Short"} market order submitted at the current candle.`,
    );
  }

  function updateConfig(field: keyof ExecutionConfig, value: string) {
    setConfig((currentConfig) => ({ ...currentConfig, [field]: value.trim() }));
  }

  function close() {
    dispatch({ type: "CLOSE", candle: current });
    setNotice("Position closed using the current candle close.");
  }

  function reset() {
    dispatch({ type: "RESET", initialCursor });
    setNotice(
      "Simulation reset. The same fixture will produce the same result for the same actions.",
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Trading Mentor AI home">
          <span className="brand-mark">TM</span>
          <span>
            Trading Mentor <b>AI</b>
          </span>
        </a>
        <div className="mode-chip">
          <i /> Historical practice
        </div>
        <button
          className="icon-button"
          aria-label="Information about simulation assumptions"
          onClick={() =>
            setNotice(
              `Current-close market fills · Quantity ${state.assumptions?.quantity ?? config.quantity} · Fees ${state.assumptions?.feeBps ?? config.feeBps} bps · Slippage ${state.assumptions?.slippageBps ?? config.slippageBps} bps · No leverage.`,
            )
          }
        >
          ?
        </button>
      </header>

      <section className="hero" id="top">
        <div>
          <p className="eyebrow">SIMULATION LAB / SPRINT 02</p>
          <h1>
            Read the market.
            <br />
            <em>Test your judgment.</em>
          </h1>
        </div>
        <div className="market-summary">
          <div>
            <span>MARKET</span>
            <strong>{dataset.metadata.asset}</strong>
            <small>Generated fixture</small>
          </div>
          <div>
            <span>TIMEFRAME</span>
            <strong>{dataset.metadata.timeframe}</strong>
            <small>UTC candles</small>
          </div>
          <div>
            <span>LAST PRICE</span>
            <strong>{money.format(Number(current.close))}</strong>
            <small
              className={
                Number(current.close) >= Number(current.open)
                  ? "positive"
                  : "negative"
              }
            >
              {Number(current.close) >= Number(current.open) ? "Up" : "Down"}{" "}
              this candle
            </small>
          </div>
        </div>
      </section>

      <aside className="education-notice">
        <span>EDUCATIONAL SIMULATION</span>
        <p>
          This is generated historical practice data—not a live market or
          financial advice. Results are hypothetical.
        </p>
      </aside>

      <section className="workspace">
        <div className="chart-panel panel">
          <div className="panel-heading">
            <div>
              <span>PRICE ACTION</span>
              <h2>
                {dataset.metadata.asset}{" "}
                <small>· {dataset.metadata.timeframe}</small>
              </h2>
            </div>
            <div className="candle-count">
              <i /> {revealed.length} / {dataset.candles.length} candles
              revealed
            </div>
          </div>
          <CandleChart candles={revealed} />
          <div className="chart-footer">
            <span>{new Date(revealed[0].timestamp).toLocaleString()}</span>
            <span>
              Current candle · {new Date(current.timestamp).toLocaleString()}
            </span>
          </div>
        </div>

        <aside className="trade-panel panel">
          <div className="panel-heading">
            <div>
              <span>DECISION DESK</span>
              <h2>Your move</h2>
            </div>
            <span className={`status ${state.playback}`}>{state.playback}</span>
          </div>
          {state.trade ? (
            <ResultCard dataset={dataset} onReset={reset} />
          ) : (
            <>
              <div className="quote">
                <span>CURRENT CLOSE</span>
                <strong>{money.format(Number(current.close))}</strong>
                <small>{new Date(current.timestamp).toLocaleString()}</small>
              </div>
              <div
                className="execution-settings"
                aria-label="Execution settings"
              >
                <div className="settings-grid">
                  <label htmlFor="quantity">
                    Quantity (BTC)
                    <input
                      id="quantity"
                      inputMode="decimal"
                      value={config.quantity}
                      onChange={(event) =>
                        updateConfig("quantity", event.target.value)
                      }
                      disabled={Boolean(state.position)}
                    />
                  </label>
                  <label htmlFor="fee-bps">
                    Fee (bps/fill)
                    <input
                      id="fee-bps"
                      inputMode="decimal"
                      value={config.feeBps}
                      onChange={(event) =>
                        updateConfig("feeBps", event.target.value)
                      }
                      disabled={Boolean(state.position)}
                    />
                  </label>
                  <label htmlFor="slippage-bps">
                    Slippage (bps/fill)
                    <input
                      id="slippage-bps"
                      inputMode="decimal"
                      value={config.slippageBps}
                      onChange={(event) =>
                        updateConfig("slippageBps", event.target.value)
                      }
                      disabled={Boolean(state.position)}
                    />
                  </label>
                </div>
                {configError && (
                  <p className="settings-error" role="alert">
                    {configError}
                  </p>
                )}
                {state.position && (
                  <p className="settings-lock">
                    Settings locked for this trade.
                  </p>
                )}
              </div>
              {state.position ? (
                <div className="position-card">
                  <div>
                    <span>OPEN POSITION</span>
                    <strong>
                      {state.position.direction.toUpperCase()} ·{" "}
                      {state.position.quantity} BTC
                    </strong>
                  </div>
                  <dl>
                    <div>
                      <dt>Entry</dt>
                      <dd>{formatMoney(state.position.entryPrice)}</dd>
                    </div>
                    <div>
                      <dt>Projected net P&amp;L</dt>
                      <dd
                        className={
                          Number(preview?.estimatedNetPnl ?? 0) >= 0
                            ? "positive"
                            : "negative"
                        }
                      >
                        {formatMoney(preview?.estimatedNetPnl ?? 0)}
                      </dd>
                    </div>
                  </dl>
                  <button className="close-button" onClick={close}>
                    Close position
                  </button>
                </div>
              ) : (
                <div className="actions">
                  <button
                    className="buy-button"
                    onClick={() => open("long")}
                    disabled={atEnd || Boolean(configError)}
                  >
                    Buy <small>Open long</small>
                  </button>
                  <button
                    className="sell-button"
                    onClick={() => open("short")}
                    disabled={atEnd || Boolean(configError)}
                  >
                    Sell <small>Open short</small>
                  </button>
                </div>
              )}
              <button
                className="hold-button"
                onClick={() => {
                  dispatch({ type: "HOLD", candle: current });
                  setNotice(
                    "Hold recorded. No transaction or P&L change was created.",
                  );
                }}
                disabled={atEnd}
              >
                Hold <span>No trade ({state.holdCount})</span>
              </button>
              {atEnd && (
                <p className="end-warning">
                  End of data.{" "}
                  {state.position
                    ? "Close the open position explicitly at this final candle."
                    : "Reset to practice again."}
                </p>
              )}
              <div className="assumptions">
                <span>EXECUTION ASSUMPTIONS</span>
                <p>
                  Current-close market fills · Quantity{" "}
                  {state.assumptions?.quantity ?? config.quantity} · Fees{" "}
                  {state.assumptions?.feeBps ?? config.feeBps} bps · Slippage{" "}
                  {state.assumptions?.slippageBps ?? config.slippageBps} bps ·
                  Spread 0 bps · No leverage
                </p>
              </div>
            </>
          )}
        </aside>
      </section>

      <section className="controls panel" aria-label="Playback controls">
        <div className="transport">
          <button onClick={reset} aria-label="Reset simulation">
            ↺
          </button>
          <button
            className="play"
            aria-label={
              state.playback === "playing" ? "Pause playback" : "Start playback"
            }
            onClick={() =>
              dispatch({
                type: state.playback === "playing" ? "PAUSE" : "PLAY",
              })
            }
            disabled={atEnd || Boolean(state.trade)}
          >
            {state.playback === "playing" ? "Ⅱ" : "▶"}
          </button>
          <button
            onClick={() =>
              dispatch({ type: "NEXT", total: dataset.candles.length })
            }
            disabled={atEnd || Boolean(state.trade)}
            aria-label="Reveal next candle"
          >
            ▶|
          </button>
        </div>
        <div className="progress-wrap">
          <div className="progress-meta">
            <span>{notice}</span>
            <b>
              {Math.round(((state.cursor + 1) / dataset.candles.length) * 100)}%
            </b>
          </div>
          <div className="progress">
            <i
              style={{
                width: `${((state.cursor + 1) / dataset.candles.length) * 100}%`,
              }}
            />
          </div>
        </div>
        <label className="speed">
          SPEED
          <select
            value={speed}
            onChange={(event) => setSpeed(Number(event.target.value))}
          >
            {SPEEDS.map((item) => (
              <option key={item.ms} value={item.ms}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </section>
      <footer>
        <span>Trading Mentor AI · Sprint 02</span>
        <span>Deterministic simulation · UTC internally</span>
      </footer>
    </div>
  );

  function ResultCard({
    dataset: resultDataset,
    onReset,
  }: {
    dataset: Dataset;
    onReset: () => void;
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
              {resultDataset.metadata.asset} ·{" "}
              {resultDataset.metadata.timeframe}
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
                Ref {formatMoney(trade.exitReferencePrice)} ·{" "}
                {trade.exitOrderId} → {trade.exitFillId}
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
          embedded. Net P&amp;L subtracts both fill fees. Net return
          denominator: absolute entry execution notional. Spread 0 bps; no
          leverage.
        </p>
        <button className="primary-button" onClick={onReset}>
          Start again
        </button>
      </div>
    );
  }
}
