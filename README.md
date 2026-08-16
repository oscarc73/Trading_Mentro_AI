# Trading Mentor AI

An educational historical-market simulator and deterministic strategy-research platform. Sprint 05 adds an auditable Backtest Lab for the transparent mean-reversion model while preserving the reliable interactive sessions from Sprints 01–04. All results and hypotheses are hypothetical; no real-money execution is available.

## Requirements

- Node.js 24+
- pnpm 11+
- Python 3.14+

On Windows PowerShell, use `pnpm.cmd` if script execution policy blocks `pnpm.ps1`.

## Setup

```powershell
pnpm.cmd install
python -m pip install -r services/api/requirements.lock
```

## Run locally

Terminal 1:

```powershell
python -m uvicorn services.api.app.main:app --reload --port 8000
```

Terminal 2:

```powershell
pnpm.cmd --filter @trading-mentor/web dev
```

Open `http://localhost:3000` for the simulator or `http://localhost:3000/backtests` for the Backtest Lab. The API health endpoint is `http://localhost:8000/health`, and the approved dataset endpoint is `http://localhost:8000/api/v1/datasets/btc-usd-1h`.

The API creates `services/api/data/sessions.sqlite3` for local session history. The file is ignored by Git. Sessions belong to this local installation; accounts and cloud synchronization are not included.

## Sprint 05 Backtest Lab

The Backtest Lab applies `mean_reversion_threshold_v1` to the complete approved dataset. A signal is evaluated at candle close and fills only at the next candle open. One long or short position may be open; an unresolved final position closes at the final candle close and is labeled `end_of_data`. Quantity, fee basis points, and adverse-slippage basis points are explicit; spread is zero and leverage is disabled.

Each result includes normalized inputs, dataset SHA-256 identity, chronological signals, orders, fills, completed trades, audit events, sample size, trade count, and exact reconciliation totals. The API stores the result as an immutable SQLite record with an idempotent operation identifier and canonical result SHA-256 fingerprint. Saved records can be reopened and rerun for equality verification.

The totals are engine-reconciliation evidence, not performance analysis. Win rate, drawdown, expectancy, optimization, date selection, additional strategies, live data, and broker execution are intentionally excluded.

### Backtest API

```text
POST /api/v1/backtests
GET  /api/v1/backtests
GET  /api/v1/backtests/{backtest_id}
```

There are no update or delete endpoints. The API validates the versioned engine/rule contracts, approved dataset fingerprint, next-candle timing, execution links, sequential position lifecycle, totals, and result fingerprint before accepting a record.

## Sprint 04 mean-reversion hypothesis

Before starting a new session, configure a whole-number lookback from `2` to `100` candles and a positive percentage threshold. Defaults are `10` candles and `1%`; values normalize and lock when the session starts.

For revealed close `C` and the unweighted simple moving average `M` of the configured consecutive closes:

```text
deviation_price   = C - M
deviation_percent = (C - M) / M * 100
```

The display classifies deviation below `-T`, inside `-T` through `T`, or above `T` as below, near, or above the recent reference. Equality is near reference. The SMA chart line and analysis series end at the revealed cursor, so hidden future candles are never inputs. Calculations use `decimal.js`; number conversion occurs only at chart and display boundaries.

This close-only model describes relative location. It does not predict reversal probability or timing, recommend an action, create orders, change execution, or backtest performance. Price can continue moving away from the mean.

### Recover the Next.js development cache

After moving or renaming the repository, stop any existing web development server before starting it from the new path. If Turbopack reports a `ChunkLoadError`, `Next.js package not found`, or a missing generated manifest, run:

```powershell
pnpm.cmd dev:clean
```

This removes only the generated `apps/web/.next` directory and starts a fresh development server. To clear the cache without starting the server, run `pnpm.cmd clean:next`. Do not run either cache-cleaning command while another Next.js development server is active.

## Verification

```powershell
pnpm.cmd format:check
pnpm.cmd lint
pnpm.cmd typecheck
pnpm.cmd test
pnpm.cmd build
```

`requirements.txt` and `requirements-dev.txt` declare supported direct-dependency ranges. `requirements.lock` records the exact verified Python environment for reproducible local setup.

## Session lifecycle and checkpoint compatibility

- New Sprint 04 sessions start at the same initial 12-candle window and receive checkpoint schema version `2` with locked `sma_deviation_v1` configuration.
- Sprint 03 checkpoint schema version `1` remains readable and shows a clear legacy strategy-context state.
- Accepted Buy, Sell, Hold, Close, manual advance, and playback advance actions are saved before another action is enabled.
- Failed saves keep the new local state visible and locked until an idempotent retry succeeds.
- Active sessions can become completed or abandoned. Both terminal states are read-only.
- Restoration validates the persistence schema, complete reducer state, dataset metadata, event timestamps, and cursor boundaries.
- Recent sessions are ordered by last update and show status, market, timeframe, direction, progress, result, and timestamps.
- Completed reviews reuse the Sprint 02 result and expose orders, fills, costs, decisions, and audit events.

### Session API

```text
POST /api/v1/sessions
GET  /api/v1/sessions
GET  /api/v1/sessions/{session_id}
PUT  /api/v1/sessions/{session_id}/checkpoint
POST /api/v1/sessions/{session_id}/complete
POST /api/v1/sessions/{session_id}/abandon
```

See `docs/sprints/SPRINT_03.md` for lifecycle contracts and `docs/sprints/SPRINT_04.md` for the strategy formulas, compatibility contract, exclusions, and verification evidence.

## Execution assumptions

- Historical generated BTC/USD hourly candles only.
- Immediate market orders reference the current revealed candle close.
- Quantity is a positive decimal value selected before entry and defaults to `1`.
- Fees and adverse slippage are configured in basis points per fill and default to `0`.
- Buy slippage increases the execution price; sell slippage decreases it.
- Gross P&L uses execution fill prices; net P&L subtracts entry and exit fees.
- Slippage impact is displayed separately and is not deducted twice.
- Net return uses absolute entry execution notional as its denominator.
- Spread remains `0`, leverage is unsupported, and assumptions lock after entry.
- Orders, fills, positions, trades, and audit events use deterministic session identifiers.

See `docs/sprints/SPRINT_02.md` for formulas and validation rules. Sprint 03 persists these values unchanged as decimal strings.
