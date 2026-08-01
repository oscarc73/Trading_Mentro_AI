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
