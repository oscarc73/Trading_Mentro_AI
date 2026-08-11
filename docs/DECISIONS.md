# Decisions

## 2026-08-01 — Sprint 01 repository and execution model

**Decision:** Use a pnpm monorepo with a Next.js App Router web application and a FastAPI service. Keep simulator state and financial calculations in framework-independent TypeScript modules. Use an approved generated BTC/USD hourly fixture. Entry and exit fill at the current revealed candle close with quantity 1, zero fees, and zero slippage.

**Context:** The repository contained foundational documentation only. Sprint 01 requires the smallest complete web/API vertical slice with reproducible behavior.

**Alternatives:** A Next.js-only API was rejected because the approved architecture explicitly requires FastAPI. External market data was rejected to avoid licensing, availability, and reproducibility risks.

**Consequences:** The web client depends on the local FastAPI service. Cross-language domain contracts are deliberately small in Sprint 01. More complete order/fill separation remains Sprint 02 scope.

**Affected files:** Root workspace configuration, `apps/web`, `services/api`, `README.md`, and Sprint 01 documentation.

## 2026-08-01 — Dependency-build and local-origin policy

**Decision:** Use pnpm 11's `allowBuilds` policy to permit install scripts only for `esbuild`, `sharp`, and `unrs-resolver`. Permit the local web origin through both `localhost:3000` and `127.0.0.1:3000`.

**Context:** Next.js and the selected test/build tools require reviewed native packages. Browser verification also showed that developers may use either local loopback spelling.

**Consequences:** Future dependencies with install scripts fail closed until reviewed. The API remains unavailable to arbitrary cross-origin callers.

**Affected files:** `pnpm-workspace.yaml`, `services/api/app/main.py`, API tests.

## 2026-08-02 — Sprint 02 decimal execution and audit model

**Decision:** Use `decimal.js` for trading quantities, prices, fees, slippage, P&L, and return calculations while exposing decimal strings at domain boundaries. Model each synchronous market action as a deterministic `Order` and `ExecutionFill`, capture normalized assumptions at entry, and record ordered engine events.

**Context:** Sprint 01 used JavaScript numbers, fixed quantity `1`, zero costs, and direct position transitions. Sprint 02 requires explicit sizing and costs without introducing pending orders, account balances, leverage, or persistence.

**Alternatives:** Native JavaScript numbers were rejected because fractional quantities and basis-point costs can accumulate binary floating-point drift. Scaled integers were rejected because the simulator does not yet have one fixed instrument precision. Random UUIDs were rejected because session-local sequence identifiers are simpler and reproducible.

**Consequences:** Domain monetary values are decimal strings; conversion to numbers is restricted to chart and display boundaries. Buy fills receive upward slippage and sell fills downward slippage. Gross P&L uses execution prices, net P&L subtracts both fill fees, and slippage is shown separately rather than deducted twice. One synchronous fill per order and one completed trade per reset remain intentional limitations.

**Dependency:** `decimal.js`, recorded in the pnpm lockfile.

**Affected files:** `apps/web/src/domain`, simulator UI and tests, workspace dependency files, README, and Sprint 02 documentation.

## 2026-08-03 — Sprint 03 local session persistence model

**Decision:** Persist versioned simulator checkpoints in local SQLite using one transactional session row plus a unique operation ledger. The browser supplies a stable session identifier, operation identifier, and expected revision. The API validates the complete reducer state and approved dataset before each write or restore. Active sessions may transition only to completed or abandoned; terminal sessions are read-only.

**Context:** Sprint 03 requires exact resume across browser and application restarts without changing the authoritative Sprint 02 TypeScript engine or introducing authentication and cloud infrastructure.

**Alternatives:** Browser-only storage was rejected because it would not survive application data loss consistently or provide an API/repository boundary. Normalized SQL tables for every order, fill, event, and position were rejected as unnecessary duplication of the versioned reducer contract for the current one-trade scope. Server-generated action identifiers were rejected because the client must retry a failed request without duplicating an accepted transition.

**Consequences:** Python's built-in `sqlite3` adds no dependency. Checkpoint JSON preserves decimal strings and deterministic identifiers, while indexed summary columns support recent-session ordering. Optimistic revisions reject stale clients, unique operation identifiers make retries idempotent, and dataset/timestamp validation prevents persisted future-candle references. The local database is single-installation data and is excluded from Git.

**Affected files:** Session domain contracts and client API, simulator/session/review UI, FastAPI models/routes/repository/tests, `.gitignore`, README, and Sprint 03 documentation.

## 2026-08-10 — Sprint 04 revealed-only SMA deviation model

**Decision:** Implement the first strategy-research model as `sma_deviation_v1`: an unweighted rolling simple moving average of revealed closes plus signed absolute and percentage deviation. Use `decimal.js` for every strategy calculation, a configurable lookback from 2 to 100, a positive symmetric percentage threshold, and four descriptive states including insufficient data. The model remains read-only and produces no trade instruction or engine action.

**Context:** Sprint 04 begins the strategy-research stage. The platform needs a transparent, deterministic hypothesis that learners can inspect without introducing future-data leakage, performance claims, or automated execution.

**Alternatives:** Bollinger Bands, RSI, multiple indicators, a general strategy registry, and action signals were rejected as premature scope. Native JavaScript numbers were rejected because threshold boundaries and high-precision close fixtures require exact decimal behavior.

**Consequences:** The browser supplies only the revealed candle slice. A linear rolling decimal sum produces chart and panel results. The explanation discloses close-only assumptions and uncertainty. Strategy analysis cannot alter orders, fills, events, positions, trades, costs, P&L, identifiers, or lifecycle transitions.

**Affected files:** Mean-reversion domain contracts/module/tests, chart and strategy UI, session configuration and review, README, and Sprint 04 documentation.

## 2026-08-10 — Backward-compatible strategy checkpoint context

**Decision:** Keep the SQLite persistence schema and session envelope at version `1`, while extending checkpoint JSON to a discriminated version union. Checkpoint schema version `2` requires a normalized, locked `StrategyContext`; checkpoint version `1` remains valid without strategy context. Checkpoint updates must preserve the original schema and exact strategy context.

**Context:** New sessions must resume and review the same strategy inputs, while existing Sprint 03 local sessions must remain readable without a database migration.

**Alternatives:** Migrating every legacy checkpoint was rejected because historical sessions have no authentic strategy configuration to recover. Adding normalized strategy columns to SQLite was rejected because checkpoint JSON is already the versioned restoration boundary.

**Consequences:** New sessions persist `sma_deviation_v1` configuration in checkpoint version `2`. Legacy sessions display that context was not recorded. The API rejects missing, unsupported, or changed version-2 strategy context, and idempotent writes remain unchanged.

**Affected files:** TypeScript session contracts/client, FastAPI models/repository/tests, README, and Sprint 04 documentation.
