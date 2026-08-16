"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  createBacktest,
  fetchDataset,
  getBacktest,
  listBacktests,
} from "@/domain/session-api";
import {
  fingerprintBacktestResult,
  normalizeBacktestConfig,
  runBacktest,
} from "@/domain/backtest";
import type {
  BacktestRecord,
  BacktestResult,
  BacktestSummary,
  Dataset,
} from "@/domain/types";

type PendingSave = {
  id: string;
  operationId: string;
  result: BacktestResult;
  resultFingerprint: string;
};

function identifier(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function BacktestLab() {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [history, setHistory] = useState<BacktestSummary[]>([]);
  const [record, setRecord] = useState<BacktestRecord | null>(null);
  const [pending, setPending] = useState<PendingSave | null>(null);
  const [lookback, setLookback] = useState("10");
  const [threshold, setThreshold] = useState("1");
  const [quantity, setQuantity] = useState("1");
  const [feeBps, setFeeBps] = useState("0");
  const [slippageBps, setSlippageBps] = useState("0");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [rerunStatus, setRerunStatus] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextDataset, nextHistory] = await Promise.all([
        fetchDataset(),
        listBacktests(),
      ]);
      setDataset(nextDataset);
      setHistory(nextHistory);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Backtest data could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.all([fetchDataset(), listBacktests()])
      .then(([nextDataset, nextHistory]) => {
        if (active) {
          setDataset(nextDataset);
          setHistory(nextHistory);
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Backtest data could not be loaded.",
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

  function config() {
    return normalizeBacktestConfig({
      strategy: {
        lookback: Number(lookback),
        deviationThresholdPercent: threshold.trim(),
      },
      execution: {
        quantity: quantity.trim(),
        feeBps: feeBps.trim(),
        slippageBps: slippageBps.trim(),
      },
    });
  }

  let validationError: string | null = null;
  try {
    config();
  } catch (cause) {
    validationError =
      cause instanceof Error ? cause.message : "Configuration is invalid.";
  }

  async function save(candidate: PendingSave) {
    setBusy(true);
    setError(null);
    setSaveStatus("Saving immutable result…");
    try {
      const saved = await createBacktest(candidate);
      setRecord(saved);
      setPending(null);
      setHistory(await listBacktests());
      setSaveStatus("Saved as an immutable local record.");
    } catch (cause) {
      setPending(candidate);
      setSaveStatus("Save failed. The completed result remains available.");
      setError(
        cause instanceof Error
          ? cause.message
          : "The result could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function run() {
    if (!dataset || validationError) return;
    setBusy(true);
    setError(null);
    setSaveStatus(null);
    setRerunStatus(null);
    try {
      const result = runBacktest(dataset, config());
      const candidate = {
        id: identifier("backtest"),
        operationId: identifier("create"),
        result,
        resultFingerprint: await fingerprintBacktestResult(result),
      };
      setRecord({
        ...candidate,
        schemaVersion: 1,
        createdAt: new Date().toISOString(),
      });
      await save(candidate);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "The backtest could not run.",
      );
      setBusy(false);
    }
  }

  async function open(summary: BacktestSummary) {
    setBusy(true);
    setError(null);
    setRerunStatus(null);
    try {
      setRecord(await getBacktest(summary.id));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The result could not be restored.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function verifyRerun() {
    if (!dataset || !record) return;
    setBusy(true);
    setRerunStatus(null);
    try {
      const result = runBacktest(dataset, record.result.config);
      const fingerprint = await fingerprintBacktestResult(result);
      setRerunStatus(
        fingerprint === record.resultFingerprint
          ? "Verified: the rerun produced the same result fingerprint."
          : "Mismatch: the rerun differs from the stored result.",
      );
    } catch (cause) {
      setRerunStatus(
        cause instanceof Error ? cause.message : "The rerun failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading)
    return (
      <div className="center-state">
        <span className="spinner" />
        <p>Loading the backtest lab…</p>
      </div>
    );
  if (!dataset)
    return (
      <div className="center-state error-state" role="alert">
        <h1>Backtest data unavailable</h1>
        <p>{error}</p>
        <button className="primary-button" onClick={() => void load()}>
          Try again
        </button>
      </div>
    );

  return (
    <main className="backtest-shell">
      <header className="backtest-header">
        <div>
          <p className="eyebrow">BACKTEST LAB / SPRINT 05</p>
          <h1>
            Test one rule set, <em>without hindsight.</em>
          </h1>
        </div>
        <Link className="secondary-button nav-link" href="/">
          Open simulator
        </Link>
      </header>
      <p className="education-notice">
        Historical results are hypothetical and educational. They do not predict
        future performance.
      </p>

      <div className="backtest-grid">
        <section
          className="backtest-panel"
          aria-labelledby="configuration-heading"
        >
          <h2 id="configuration-heading">Configuration</h2>
          <p>
            Signals use candle closes and execute at the next candle open. Only
            one position can be open.
          </p>
          <div className="backtest-form">
            <label>
              Lookback
              <input
                inputMode="numeric"
                value={lookback}
                onChange={(event) => setLookback(event.target.value)}
              />
            </label>
            <label>
              Deviation threshold (%)
              <input
                inputMode="decimal"
                value={threshold}
                onChange={(event) => setThreshold(event.target.value)}
              />
            </label>
            <label>
              Quantity
              <input
                inputMode="decimal"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
              />
            </label>
            <label>
              Fee (bps)
              <input
                inputMode="decimal"
                value={feeBps}
                onChange={(event) => setFeeBps(event.target.value)}
              />
            </label>
            <label>
              Adverse slippage (bps)
              <input
                inputMode="decimal"
                value={slippageBps}
                onChange={(event) => setSlippageBps(event.target.value)}
              />
            </label>
          </div>
          <dl className="assumption-list">
            <div>
              <dt>Dataset</dt>
              <dd>
                {dataset.metadata.asset} · {dataset.metadata.timeframe} ·{" "}
                {dataset.candles.length} candles
              </dd>
            </div>
            <div>
              <dt>Spread</dt>
              <dd>0 bps</dd>
            </div>
            <div>
              <dt>Leverage</dt>
              <dd>Disabled</dd>
            </div>
            <div>
              <dt>Final position</dt>
              <dd>Closed at final candle close</dd>
            </div>
          </dl>
          {validationError && (
            <p className="settings-error" role="alert">
              {validationError}
            </p>
          )}
          <button
            className="primary-button"
            disabled={busy || Boolean(validationError)}
            onClick={() => void run()}
          >
            {busy ? "Working…" : "Run and save backtest"}
          </button>
          {pending && (
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() => void save(pending)}
            >
              Retry same save
            </button>
          )}
          {error && (
            <p className="settings-error" role="alert">
              {error}
            </p>
          )}
          {saveStatus && (
            <p className="rerun-status" role="status" aria-live="polite">
              {saveStatus}
            </p>
          )}
        </section>

        <section className="backtest-panel" aria-labelledby="result-heading">
          <h2 id="result-heading">Result and reconciliation</h2>
          {!record ? (
            <div className="empty-history">
              <h3>No result selected</h3>
              <p>Run a configuration or open a saved record.</p>
            </div>
          ) : (
            <BacktestResultView
              record={record}
              busy={busy}
              rerunStatus={rerunStatus}
              onRerun={() => void verifyRerun()}
            />
          )}
        </section>
      </div>

      <section
        className="history-panel"
        aria-labelledby="backtest-history-heading"
      >
        <div className="history-heading">
          <div>
            <span className="eyebrow">IMMUTABLE RECORDS</span>
            <h2 id="backtest-history-heading">Recent backtests</h2>
          </div>
          <button
            className="secondary-button"
            disabled={busy}
            onClick={() => void load()}
          >
            Refresh
          </button>
        </div>
        {history.length === 0 ? (
          <div className="empty-history">
            <h3>No saved backtests yet</h3>
            <p>A successfully saved run will appear here.</p>
          </div>
        ) : (
          <div className="session-list">
            {history.map((item) => (
              <article className="session-row" key={item.id}>
                <div>
                  <h3>{item.datasetId}</h3>
                  <p>
                    Lookback {item.lookback} · Threshold{" "}
                    {item.deviationThresholdPercent}% · {item.tradeCount} trades
                  </p>
                </div>
                <div className="session-dates">
                  <small>{new Date(item.createdAt).toLocaleString()}</small>
                  <button
                    className="secondary-button"
                    disabled={busy}
                    onClick={() => void open(item)}
                  >
                    Inspect
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function BacktestResultView({
  record,
  busy,
  rerunStatus,
  onRerun,
}: {
  record: BacktestRecord;
  busy: boolean;
  rerunStatus: string | null;
  onRerun: () => void;
}) {
  const result = record.result;
  return (
    <div className="backtest-result">
      <div className="result-metrics">
        <div>
          <span>Trades</span>
          <strong>{result.tradeCount}</strong>
        </div>
        <div>
          <span>Gross P&amp;L</span>
          <strong>{result.totalGrossPnl}</strong>
        </div>
        <div>
          <span>Fees</span>
          <strong>{result.totalFees}</strong>
        </div>
        <div>
          <span>Slippage</span>
          <strong>{result.totalSlippageCost}</strong>
        </div>
        <div>
          <span>Net P&amp;L</span>
          <strong>{result.totalNetPnl}</strong>
        </div>
        <div>
          <span>Forced exits</span>
          <strong>{result.forcedExitCount}</strong>
        </div>
      </div>
      <p className="fingerprint">
        <span>Result SHA-256</span>
        {record.resultFingerprint}
      </p>
      <button className="secondary-button" disabled={busy} onClick={onRerun}>
        Rerun and verify
      </button>
      {rerunStatus && (
        <p className="rerun-status" role="status">
          {rerunStatus}
        </p>
      )}
      <h3>Trade audit</h3>
      {result.trades.length === 0 ? (
        <p>No trades were generated by this configuration.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Direction</th>
                <th>Entry</th>
                <th>Exit</th>
                <th>Reason</th>
                <th>Net P&amp;L</th>
              </tr>
            </thead>
            <tbody>
              {result.trades.map((trade) => (
                <tr key={trade.id}>
                  <td>{trade.id}</td>
                  <td>{trade.direction}</td>
                  <td>{trade.entryPrice}</td>
                  <td>{trade.exitPrice}</td>
                  <td>{trade.exitReason}</td>
                  <td>{trade.netPnl}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <details>
        <summary>Signals and audit events</summary>
        <ol className="event-list">
          {result.events.map((event) => (
            <li key={event.id}>
              <span>Candle {event.candleIndex + 1}</span>
              {event.message}
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}
