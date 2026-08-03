# Project Status

**Active sprint:** Sprint 02 — Reliable Trading Engine
**State:** Implemented and verified; pending product-owner acceptance
**Last updated:** 2026-08-02

## Repository state

Sprint 01 was accepted by the product owner on 2026-08-02. Sprint 02 replaces the fixed-number calculation path with a deterministic decimal-safe domain engine that separates market orders, execution fills, positions, and completed trades.

The simulator now supports positive fractional quantity, configurable per-fill fees and adverse slippage, explicit zero spread and no leverage, gross and net P&L, deterministic audit links, and typed invalid-state errors. All repository checks and desktop/mobile browser verification pass.

## Current scope

Review and accept the outcome defined in `docs/sprints/SPRINT_02.md`. No future sprint is active.

## Blockers

None. A Starlette test-client deprecation warning is emitted by the current FastAPI dependency set but does not affect runtime behavior or test results.

The project drive remains slow for dependency linking and Next.js checks, but the verified install, test, and production-build commands complete successfully.
