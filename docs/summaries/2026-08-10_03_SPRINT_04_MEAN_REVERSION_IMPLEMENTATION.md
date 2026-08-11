# Sprint 04 Mean-Reversion Implementation

## Outcome

Implemented the approved transparent mean-reversion hypothesis across domain logic, versioned persistence, active simulation, chart context, and terminal review. Automated verification and production build pass; live browser visual verification remains pending because no controllable browser was connected to this Codex session.

## Scope completed

- Added decimal-safe configuration validation, a linear rolling SMA, signed deviation, four-state classification, insufficient-data handling, and deterministic educational explanation.
- Added new-session lookback/threshold configuration with validation, normalization, locked persistence, and formula preview.
- Added a revealed-only SMA chart line and accessible text analysis for active and terminal sessions.
- Added checkpoint schema version `2` strategy context while retaining readable version-1 Sprint 03 sessions and the existing SQLite schema.
- Rejected unsupported, missing, or changed version-2 strategy contexts without changing trading transitions or financial calculations.
- Added domain, UI, legacy, review, API round-trip, restart, and locked-context tests.

## Files or areas affected

- `apps/web/src/domain/mean-reversion.ts` and its tests
- TypeScript session types/client
- Simulator loader, simulator, chart, strategy panel, review, CSS, and UI tests
- FastAPI models, repository, and session tests
- Root/web verification scripts
- README and project documentation

## Decisions and assumptions

- The only strategy model is `sma_deviation_v1`; no registry was introduced.
- Strategy inputs are close-only, consecutive, unweighted, symmetric around the SMA, and read-only.
- Domain results remain decimal strings; number conversion is limited to chart and formatted display boundaries.
- The session envelope and SQLite schema remain version `1`; only checkpoint JSON evolves to version `2` for new strategy-enabled sessions.
- TypeScript and mypy caches are disabled in the typecheck script because the project drive rejects stale generated cache writes. Ruff checks also run without cache for the same reason.

## Commands and verification results

- `pnpm.cmd install --offline --frozen-lockfile` — passed, already up to date.
- `pnpm.cmd format:check` — Prettier and Ruff passed.
- `pnpm.cmd lint` — ESLint and Ruff passed with zero errors/warnings.
- `pnpm.cmd typecheck` — TypeScript and mypy passed.
- `pnpm.cmd test` — 42 Vitest and 23 pytest tests passed.
- `pnpm.cmd build` — Next.js 16.2.12 production build passed.
- `git diff --check` — passed.
- Existing non-failing warnings: Starlette `httpx` deprecation and restricted pytest cache writes.

## Manual verification

- Started the production FastAPI and Next.js applications.
- Confirmed API `/health` returned HTTP 200 and the web root returned HTTP 200.
- Attempted the required controlled browser connection; the browser runtime returned no available browser.

## Limitations or follow-up work

- A connected browser is still required to complete interactive configure/start/reveal/refresh/resume/review checks, console inspection, keyboard navigation, and desktop/390px overflow review.
- Backtesting, performance metrics, optimization, signals, extra indicators, live data, AI explanations, and broker execution remain excluded.
- Sprint 04 is not accepted and Sprint 05 must not begin until the product owner reviews the outcome.

## Documentation updated

- Updated README formulas, assumptions, and compatibility behavior.
- Recorded the strategy and checkpoint decisions.
- Updated project master, status, Sprint 04 checklist/evidence, scope approval summary, and this implementation summary.
