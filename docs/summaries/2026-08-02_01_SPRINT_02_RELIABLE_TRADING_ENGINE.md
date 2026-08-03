# Sprint 02 — Reliable Trading Engine

## Outcome

Sprint 02 is implemented and verified. The simulator now uses a deterministic, decimal-safe trading engine with explicit orders, fills, execution costs, gross and net results, and auditable state transitions. Product-owner acceptance remains pending.

## Scope completed

- Added positive fractional quantity plus configurable fee and adverse-slippage basis points.
- Added separate order, execution-fill, position, completed-trade, assumptions, error, and engine-event contracts.
- Added exact decimal calculations for execution prices, fill fees, slippage impact, gross P&L, net P&L, and net return.
- Added typed rejection of invalid settings and invalid state transitions without corrupting financial state.
- Locked normalized assumptions after entry and exposed projected net P&L while a position is open.
- Added result traceability from orders to fills and deterministic audit events.
- Preserved current-close fills, hidden future candles, playback, one-position behavior, reset, and explicit end-of-data behavior.
- Added the missing reusable sprint template and completed Sprint 02 documentation.

## Files and areas affected

- `apps/web/src/domain`: execution engine, contracts, reducer, and tests.
- `apps/web/src/components`: simulator integration and UI tests.
- `apps/web/src/app`: responsive styles and icon fallback.
- `apps/web/package.json` and `pnpm-lock.yaml`: `decimal.js` dependency.
- `README.md` and `docs`: scope, status, decision, sprint, template, and summary records.

## Decisions and assumptions

- `decimal.js` performs all trading arithmetic; domain monetary values cross module boundaries as decimal strings.
- Every accepted open or close action produces one synchronous market order and one fill at the revealed candle close adjusted by adverse slippage.
- Buy fills slip upward and sell fills slip downward. Fees apply independently to both fill notionals.
- Slippage is embedded in execution prices and reported separately, not deducted from gross P&L a second time.
- Spread remains zero, leverage remains unsupported, and a reset still permits at most one completed trade.
- Session-local sequential identifiers make the same inputs and actions reproducible.

## Commands and verification results

- `pnpm.cmd install --offline --frozen-lockfile` — passed with all packages reused locally.
- `pnpm.cmd format:check` — passed.
- `pnpm.cmd lint` — passed.
- `pnpm.cmd typecheck` — passed.
- `pnpm.cmd test` — passed: 28 Vitest tests and 14 Pytest tests.
- `pnpm.cmd build` — passed with Next.js 16.2.12.

The only emitted warning is the existing Starlette test-client deprecation warning from the current FastAPI dependency set.

## Manual verification

- Confirmed API health and successful web loading.
- Completed configured fractional long and short flows with fees and slippage.
- Confirmed assumptions lock after entry and results show reference/execution prices, order-to-fill links, gross P&L, fees, slippage impact, net P&L, return, and audit count.
- Confirmed invalid quantity displays an actionable error and disables Buy and Sell.
- Confirmed future candles remain hidden and the tested fixture begins at 12 of 32 revealed candles.
- Confirmed desktop and true 390px mobile layouts, no horizontal overflow, no runtime overlay, no failed resources, and no browser console errors.

## Limitations and follow-up

The implementation intentionally remains limited to one approved fixture, one trade per reset, immediate market fills, zero spread, and no partial or pending orders, account balance, leverage, persistence, analytics, strategy, AI explanation, live data, or broker integration. Future work starts only after product-owner review and acceptance.

## Documentation updated

- Added `docs/SPRINT_TEMPLATE.md`.
- Added and completed `docs/sprints/SPRINT_02.md`.
- Updated `docs/STATUS.md`, `docs/PROJECT_MASTER.md`, `docs/DECISIONS.md`, `docs/sprints/SPRINT_01.md`, and `README.md`.
- Added this immutable Sprint 02 action summary.