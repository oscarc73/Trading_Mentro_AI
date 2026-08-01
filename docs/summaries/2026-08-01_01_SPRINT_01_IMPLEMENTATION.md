# Sprint 01 Implementation Summary

**Date:** 2026-08-01  
**Outcome:** Implemented and verified; pending product-owner acceptance.

## Scope completed

- Created a pnpm monorepo with a Next.js App Router frontend and FastAPI service.
- Added a deterministic generated BTC/USD hourly OHLCV fixture with provenance documentation.
- Added validation for schema, numeric ranges, candle consistency, ordering, duplicates, UTC timestamps, and hourly gaps.
- Built candle-by-candle replay with play, pause, next, reset, and speed controls.
- Added one simulated long or short position, Hold, explicit close, gross P&L, return percentage, and visible zero-cost assumptions.
- Added responsive loading, error, completed-trade, and end-of-data states.
- Added centralized TypeScript trading calculations and reducer-based state transitions outside React components.

## Files and areas affected

- Root workspace configuration, pnpm lockfile, `.gitignore`, and `README.md`.
- `apps/web/` Next.js application, domain logic, chart, styles, and tests.
- `services/api/` FastAPI service, dataset, validation, dependency locks, and tests.
- Project status, decisions, and Sprint 01 documentation.

## Decisions and assumptions

- Entry and exit fill at the current revealed candle close.
- Quantity is fixed at one, fees and slippage are zero, and leverage is unsupported.
- The fixture is generated rather than copied from a market-data provider.
- More complete order/fill separation, costs, and sizing remain Sprint 02 scope.
- Native dependency scripts are limited through pnpm's explicit build allowlist.

## Verification

- Frozen offline pnpm install passed.
- Formatting, ESLint, Ruff, TypeScript, and Mypy checks passed.
- 15 frontend tests passed.
- 14 API and data-validation tests passed.
- Next.js production build passed.

## Manual verification

- Confirmed API health and web availability.
- Verified 12 of 32 initial candles, single-candle advance, playback, reset, and the deterministic 32/32 end state.
- Verified a long result of `+$380.00` and `+0.399%`.
- Verified a short result of `-$380.00` and `-0.399%`.
- Verified desktop and 390 × 844 mobile layouts with no browser errors or horizontal overflow.

## Limitations and follow-up

- One generated fixture, one position, quantity one, gross P&L, and zero costs only.
- No persistence, indicators, strategies, AI, live data, broker integration, or real-money trading.
- Starlette currently emits a non-blocking test-client deprecation warning.

## Documentation updated

- `README.md`
- `docs/STATUS.md`
- `docs/DECISIONS.md`
- `docs/sprints/SPRINT_01.md`
- `services/api/data/README.md`
