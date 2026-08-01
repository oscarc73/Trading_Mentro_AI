# Project Status

**Active sprint:** Sprint 01 — Minimum Functional Trading Simulator  
**State:** Implemented and verified; pending product-owner acceptance  
**Last updated:** 2026-08-01

## Repository state

Sprint 01 delivers a local Next.js simulator and FastAPI dataset service. Automated checks and desktop/mobile browser verification pass.

A post-rename Turbopack incident caused by a stale development process and generated HMR cache was repaired. The repository now provides `pnpm.cmd clean:next` and `pnpm.cmd dev:clean` recovery commands.

## Current scope

Build the historical simulator defined in `docs/sprints/SPRINT_01.md`. No future sprint is active.

## Blockers

None. A Starlette test-client deprecation warning is emitted by the current FastAPI dependency set but does not affect runtime behavior or test results.

The project drive continues to trigger Next.js slow-filesystem warnings. The latest cold development start completed successfully, but filesystem latency remains a development-performance risk.
