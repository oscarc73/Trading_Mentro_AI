# Trading Mentor AI

An educational historical-market simulator. Sprint 03 adds reliable local sessions: users can start, save, resume, complete, abandon, and review deterministic practice across browser refreshes and application restarts. All results are hypothetical; no real-money execution is available.

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

Open `http://localhost:3000`. The API health endpoint is `http://localhost:8000/health`, and the approved dataset endpoint is `http://localhost:8000/api/v1/datasets/btc-usd-1h`.

The API creates `services/api/data/sessions.sqlite3` for local session history. The file is ignored by Git. Sessions belong to this local installation; Sprint 03 does not include accounts or cloud synchronization.

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

## Sprint 03 session lifecycle

- New sessions start at the same initial 12-candle window and receive a versioned checkpoint.
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

See `docs/sprints/SPRINT_03.md` for lifecycle contracts, error mapping, exclusions, and verification evidence.

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
