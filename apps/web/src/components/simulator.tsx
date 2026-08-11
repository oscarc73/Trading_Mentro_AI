"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  Dataset,
  Direction,
  ExecutionConfig,
  PersistenceState,
  SimulationSession,
  SimulationState,
} from "@/domain/types";
import { simulationReducer, type SimulationAction } from "@/domain/simulation";
import {
  abandonSession,
  saveCheckpoint,
  SessionApiError,
} from "@/domain/session-api";
import {
  normalizeExecutionConfig,
  previewPosition,
  TradingDomainError,
} from "@/domain/execution";
import { CandleChart } from "./candle-chart";
import { ResultCard } from "./result-card";
import { calculateMeanReversion } from "@/domain/mean-reversion";
import { StrategyPanel } from "./strategy-panel";

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

type PendingSave = {
  state: SimulationState;
  config: ExecutionConfig;
  operationId: string;
  complete: boolean;
};

function operationId(): string {
  return `action-${crypto.randomUUID()}`;
}

export function Simulator({
  dataset,
  session,
  onSessionChange,
  onExit,
}: {
  dataset: Dataset;
  session: SimulationSession;
  onSessionChange: (session: SimulationSession) => void;
  onExit: () => void;
}) {
  const [state, setState] = useState(session.checkpoint.state);
  const [config, setConfig] = useState<ExecutionConfig>({
    ...session.checkpoint.executionConfig,
  });
  const [speed, setSpeed] = useState(1000);
  const [persistence, setPersistence] = useState<PersistenceState>("saved");
  const [pendingSave, setPendingSave] = useState<PendingSave | null>(null);
  const [notice, setNotice] = useState(
    "Session restored. Future candles remain hidden.",
  );
  const current = dataset.candles[state.cursor];
  const revealed = useMemo(
    () => dataset.candles.slice(0, state.cursor + 1),
    [dataset.candles, state.cursor],
  );
  const strategyAnalysis = useMemo(
    () =>
      session.checkpoint.schemaVersion === 2
        ? calculateMeanReversion(
            revealed,
            session.checkpoint.strategyContext.config,
          )
        : null,
    [revealed, session.checkpoint],
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

  const persist = useCallback(
    async (pending: PendingSave) => {
      setPersistence("saving");
      setPendingSave(pending);
      const checkpointState = {
        ...pending.state,
        playback:
          pending.state.playback === "playing"
            ? "paused"
            : pending.state.playback,
      } satisfies SimulationState;
      try {
        const updated = await saveCheckpoint({
          session,
          operationId: pending.operationId,
          executionConfig: pending.config,
          state: checkpointState,
          complete: pending.complete,
        });
        setPendingSave(null);
        setPersistence("saved");
        onSessionChange(updated);
      } catch (cause) {
        setPersistence(
          cause instanceof SessionApiError && cause.status === null
            ? "offline"
            : "failed",
        );
        setNotice(
          cause instanceof Error
            ? cause.message
            : "The checkpoint could not be saved.",
        );
      }
    },
    [onSessionChange, session],
  );

  const applyAction = useCallback(
    async (
      action: SimulationAction,
      successNotice: string,
      complete = false,
    ) => {
      if (persistence === "saving" || pendingSave) return;
      const next = simulationReducer(state, action);
      setState(next);
      if (next.latestError && next.latestError !== state.latestError) {
        setNotice(next.latestError.message);
        return;
      }
      setNotice(successNotice);
      await persist({
        state: next,
        config,
        operationId: operationId(),
        complete,
      });
    },
    [config, pendingSave, persist, persistence, state],
  );

  useEffect(() => {
    if (state.playback !== "playing" || persistence === "saving" || pendingSave)
      return;
    const timer = window.setTimeout(() => {
      void applyAction(
        { type: "NEXT", total: dataset.candles.length },
        "Next historical candle revealed and saved.",
      );
    }, speed);
    return () => window.clearTimeout(timer);
  }, [
    applyAction,
    dataset.candles.length,
    pendingSave,
    persistence,
    speed,
    state.playback,
  ]);

  function open(direction: Direction) {
    void applyAction(
      { type: "OPEN", direction, candle: current, config },
      `${direction === "long" ? "Long" : "Short"} market order submitted at the current candle.`,
    );
  }

  function updateConfig(field: keyof ExecutionConfig, value: string) {
    setConfig((currentConfig) => ({ ...currentConfig, [field]: value.trim() }));
  }

  function close() {
    void applyAction(
      { type: "CLOSE", candle: current },
      "Position closed and session completed.",
      true,
    );
  }

  async function abandon() {
    if (
      !window.confirm("Abandon this active session? It will become read-only.")
    )
      return;
    setPersistence("saving");
    try {
      await abandonSession(session, operationId());
      onExit();
    } catch (cause) {
      setPersistence(
        cause instanceof SessionApiError && cause.status === null
          ? "offline"
          : "failed",
      );
      setNotice(
        cause instanceof Error
          ? cause.message
          : "The session could not be abandoned.",
      );
    }
  }

  const actionsDisabled = persistence === "saving" || Boolean(pendingSave);

  return (
    <div className="app-shell">
      <header className="topbar">
        <button
          className="brand brand-button"
          onClick={onExit}
          aria-label="Back to saved sessions"
        >
          <span className="brand-mark">TM</span>
          <span>
            Trading Mentor <b>AI</b>
          </span>
        </button>
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
          <p className="eyebrow">SIMULATION LAB / SPRINT 03</p>
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

      <div
        className={`persistence-banner ${persistence}`}
        role={
          persistence === "failed" || persistence === "offline"
            ? "alert"
            : "status"
        }
        aria-live="polite"
      >
        <span>
          {persistence === "loading"
            ? "Loading"
            : persistence === "saving"
              ? "Saving…"
              : persistence === "saved"
                ? "Saved locally"
                : persistence === "offline"
                  ? "Offline · save pending"
                  : "Save failed"}
        </span>
        {pendingSave && persistence !== "saving" && (
          <button
            className="secondary-button"
            onClick={() => void persist(pendingSave)}
          >
            Retry save
          </button>
        )}
      </div>

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
          <CandleChart
            candles={revealed}
            movingAverage={strategyAnalysis?.series ?? []}
          />
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
            <ResultCard
              dataset={dataset}
              state={state}
              savePending={Boolean(pendingSave)}
            />
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
                      disabled={Boolean(state.position) || actionsDisabled}
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
                      disabled={Boolean(state.position) || actionsDisabled}
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
                      disabled={Boolean(state.position) || actionsDisabled}
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
                  <button
                    className="close-button"
                    onClick={close}
                    disabled={actionsDisabled}
                  >
                    Close position
                  </button>
                </div>
              ) : (
                <div className="actions">
                  <button
                    className="buy-button"
                    onClick={() => open("long")}
                    disabled={atEnd || Boolean(configError) || actionsDisabled}
                  >
                    Buy <small>Open long</small>
                  </button>
                  <button
                    className="sell-button"
                    onClick={() => open("short")}
                    disabled={atEnd || Boolean(configError) || actionsDisabled}
                  >
                    Sell <small>Open short</small>
                  </button>
                </div>
              )}
              <button
                className="hold-button"
                onClick={() => {
                  void applyAction(
                    { type: "HOLD", candle: current },
                    "Hold recorded. No transaction or P&L change was created.",
                  );
                }}
                disabled={atEnd || actionsDisabled}
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

      <StrategyPanel
        analysis={strategyAnalysis}
        currency={dataset.metadata.currency}
        legacy={session.checkpoint.schemaVersion === 1}
      />

      <section className="controls panel" aria-label="Playback controls">
        <div className="transport">
          <button
            onClick={() => void abandon()}
            aria-label="Abandon session"
            disabled={actionsDisabled}
          >
            ×
          </button>
          <button
            className="play"
            aria-label={
              state.playback === "playing" ? "Pause playback" : "Start playback"
            }
            onClick={() =>
              setState((currentState) =>
                simulationReducer(currentState, {
                  type: currentState.playback === "playing" ? "PAUSE" : "PLAY",
                }),
              )
            }
            disabled={atEnd || Boolean(state.trade) || actionsDisabled}
          >
            {state.playback === "playing" ? "Ⅱ" : "▶"}
          </button>
          <button
            onClick={() =>
              void applyAction(
                { type: "NEXT", total: dataset.candles.length },
                "Next historical candle revealed and saved.",
              )
            }
            disabled={atEnd || Boolean(state.trade) || actionsDisabled}
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
        <span>Trading Mentor AI · Sprint 03</span>
        <span>Deterministic simulation · UTC internally</span>
      </footer>
    </div>
  );
}
