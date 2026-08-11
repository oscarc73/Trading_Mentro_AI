"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createSession,
  fetchDataset,
  getSession,
  listSessions,
} from "@/domain/session-api";
import { DEFAULT_EXECUTION_CONFIG } from "@/domain/execution";
import { initialSimulationState } from "@/domain/simulation";
import {
  createStrategyContext,
  DEFAULT_MEAN_REVERSION_CONFIG,
  MeanReversionDomainError,
  normalizeMeanReversionConfig,
} from "@/domain/mean-reversion";
import type {
  Dataset,
  SessionSummary,
  SimulationSession,
} from "@/domain/types";
import { SessionReview } from "./session-review";
import { Simulator } from "./simulator";

const INITIAL_WINDOW = 12;

function identifier(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function SimulatorLoader() {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selected, setSelected] = useState<SimulationSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [lookback, setLookback] = useState(
    String(DEFAULT_MEAN_REVERSION_CONFIG.lookback),
  );
  const [threshold, setThreshold] = useState(
    DEFAULT_MEAN_REVERSION_CONFIG.deviationThresholdPercent,
  );
  const strategyConfig = getStrategyConfig(lookback, threshold);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [loadedDataset, history] = await Promise.all([
        fetchDataset(),
        listSessions(),
      ]);
      if (!loadedDataset.candles?.length) {
        throw new Error("The approved dataset is empty.");
      }
      setDataset(loadedDataset);
      setSessions(history);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The simulator data could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.all([fetchDataset(), listSessions()])
      .then(([value, history]) => {
        if (active) {
          setDataset(value);
          setSessions(history);
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : "The simulator data could not be loaded.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const refreshHistory = useCallback(async () => {
    setSessions(await listSessions());
  }, []);

  async function start() {
    if (!dataset || !strategyConfig.value) return;
    setStarting(true);
    setError(null);
    try {
      const initialCursor =
        Math.min(INITIAL_WINDOW, dataset.candles.length) - 1;
      const session = await createSession({
        sessionId: identifier("session"),
        datasetId: dataset.metadata.id,
        operationId: identifier("create"),
        executionConfig: DEFAULT_EXECUTION_CONFIG,
        strategyContext: createStrategyContext(strategyConfig.value),
        state: initialSimulationState(initialCursor),
      });
      setSelected(session);
      await refreshHistory();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "The session could not start.",
      );
    } finally {
      setStarting(false);
    }
  }

  async function openSession(summary: SessionSummary) {
    setStarting(true);
    setError(null);
    try {
      const session = await getSession(summary.id);
      if (session.dataset.id !== dataset?.metadata.id) {
        throw new Error("The saved session uses an incompatible dataset.");
      }
      setSelected(session);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The session could not be restored.",
      );
    } finally {
      setStarting(false);
    }
  }

  if (loading) {
    return (
      <div className="center-state">
        <span className="spinner" />
        <p>Loading the practice market…</p>
      </div>
    );
  }
  if (error || !dataset) {
    return (
      <div className="center-state error-state" role="alert">
        <span className="state-icon">!</span>
        <h1>Market data unavailable</h1>
        <p>
          {error ?? "No candles were returned."} Start the local API and try
          again.
        </p>
        <button className="primary-button" onClick={() => void load()}>
          Try again
        </button>
      </div>
    );
  }
  if (selected) {
    if (selected.status !== "active") {
      return (
        <SessionReview
          dataset={dataset}
          session={selected}
          onBack={() => {
            setSelected(null);
            void refreshHistory();
          }}
        />
      );
    }
    return (
      <Simulator
        dataset={dataset}
        session={selected}
        onSessionChange={setSelected}
        onExit={() => {
          setSelected(null);
          void refreshHistory();
        }}
      />
    );
  }
  return (
    <main className="session-home">
      <section className="session-hero">
        <p className="eyebrow">SIMULATION LAB / SPRINT 04</p>
        <h1>
          Practice that <em>remembers.</em>
        </h1>
        <p>
          Start a saved historical session or continue exactly where you left
          off. Future candles remain hidden and every result is hypothetical.
        </p>
        <fieldset className="strategy-config">
          <legend>Mean-reversion hypothesis</legend>
          <p>
            Compare each revealed close with an unweighted simple moving
            average. Configuration locks when the session starts.
          </p>
          <div className="strategy-config-grid">
            <label htmlFor="strategy-lookback">
              Lookback (candles)
              <input
                id="strategy-lookback"
                inputMode="numeric"
                value={lookback}
                onChange={(event) => setLookback(event.target.value)}
                aria-describedby="strategy-config-error"
              />
            </label>
            <label htmlFor="strategy-threshold">
              Deviation threshold (%)
              <input
                id="strategy-threshold"
                inputMode="decimal"
                value={threshold}
                onChange={(event) => setThreshold(event.target.value)}
                aria-describedby="strategy-config-error"
              />
            </label>
          </div>
          <p className="formula-preview">
            deviation % = (close âˆ’ SMA) / SMA Ã— 100
          </p>
          {strategyConfig.error && (
            <p
              id="strategy-config-error"
              className="settings-error"
              role="alert"
            >
              {strategyConfig.error}
            </p>
          )}
        </fieldset>
        <button
          className="primary-button"
          onClick={() => void start()}
          disabled={starting || Boolean(strategyConfig.error)}
        >
          {starting ? "Starting…" : "Start new session"}
        </button>
      </section>
      <section className="history-panel" aria-labelledby="recent-heading">
        <div className="history-heading">
          <div>
            <span className="eyebrow">PERSISTED LOCALLY</span>
            <h2 id="recent-heading">Recent sessions</h2>
          </div>
          <button
            className="secondary-button"
            onClick={() => void load()}
            disabled={starting}
          >
            Refresh
          </button>
        </div>
        {sessions.length === 0 ? (
          <div className="empty-history">
            <h3>No saved sessions yet</h3>
            <p>Your first session will appear here after it is created.</p>
          </div>
        ) : (
          <div className="session-list">
            {sessions.map((item) => (
              <article className="session-row" key={item.id}>
                <div>
                  <span className={`session-status ${item.status}`}>
                    {item.status}
                  </span>
                  <h3>
                    {item.asset} · {item.timeframe}
                  </h3>
                  <p>
                    {item.direction ?? "No position"} · Candle {item.cursor + 1}{" "}
                    of {item.candleCount}
                    {item.netPnl !== null
                      ? ` · Net ${Number(item.netPnl).toFixed(2)} USD`
                      : ""}
                  </p>
                </div>
                <div className="session-dates">
                  <small>
                    Updated {new Date(item.updatedAt).toLocaleString()}
                  </small>
                  <small>
                    Created {new Date(item.createdAt).toLocaleString()}
                  </small>
                  <button
                    className="secondary-button"
                    onClick={() => void openSession(item)}
                    disabled={starting}
                  >
                    {item.status === "active" ? "Resume" : "Review"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      {error && (
        <div className="home-error" role="alert">
          <strong>Could not continue</strong>
          <span>{error}</span>
        </div>
      )}
    </main>
  );
}

function getStrategyConfig(lookback: string, threshold: string) {
  try {
    return {
      value: normalizeMeanReversionConfig({
        lookback: Number(lookback),
        deviationThresholdPercent: threshold.trim(),
      }),
      error: null,
    };
  } catch (cause) {
    return {
      value: null,
      error:
        cause instanceof MeanReversionDomainError
          ? cause.message
          : "Strategy configuration is invalid.",
    };
  }
}
