# Trading Mentor AI

An educational historical-market simulator. Sprint 02 adds a deterministic execution engine with auditable orders and fills, fractional sizing, configurable costs, and reproducible net P&L. All results are hypothetical; no real-money execution is available.

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

## Sprint 02 execution assumptions

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

See `docs/sprints/SPRINT_02.md` for formulas, validation rules, scope, and verification evidence.
