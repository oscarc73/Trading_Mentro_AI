# Turbopack Cache Repair

**Date:** 2026-08-01  
**Outcome:** Resolved and browser-verified

## Outcome

The Next.js development server was recovered after it panicked while writing the `/page` endpoint and the browser failed to load a Turbopack HMR chunk. A clean server started from the corrected `Trading Mentor AI` path now serves the application and its HMR client chunks successfully.

## Scope completed

- Inspected the browser error, Next.js development log, and Turbopack panic log.
- Verified that Next.js 16.2.12 resolves from the corrected repository path.
- Identified and stopped a stale Node development process that had started before the repository relink and still owned port 3000.
- Removed the generated `.next` cache and started a single fresh development server.
- Added safe, cross-platform cache recovery commands.
- Verified the web application with its FastAPI service in a browser.

## Files and areas affected

- `package.json`
- `apps/web/package.json`
- `apps/web/scripts/clean-next.mjs`
- `README.md`
- `docs/STATUS.md`
- `docs/summaries/2026-08-01_03_TURBOPACK_CACHE_REPAIR.md`

Generated cache content under `apps/web/.next` was removed and regenerated. No application or financial-domain behavior changed.

## Decisions and assumptions

- The normal `dev` command remains unchanged so Turbopack can retain its development cache during ordinary use.
- `dev:clean` is an explicit recovery command, not the default startup path.
- The cleanup script resolves and validates the exact `.next` target before recursively removing it.
- Cache cleanup must run only after every active Next.js development server has stopped.
- The persistent slow-filesystem warning is treated as a performance risk, not as evidence of a missing dependency.

## Root cause evidence

- `next/package.json` resolved inside the corrected `Trading Mentor AI/node_modules/.pnpm` tree.
- Port 3000 was owned by Node process 5064, started at 5:30 PM before the repository repair.
- The stale server's log contained the HMR `ChunkLoadError`, the missing generated `build-manifest.json`, and a slow-filesystem warning.
- After stopping that process and clearing `.next`, a new server returned HTTP 200 and loaded the exact `%5Bturbopack%5D_browser_dev_hmr-client...` script family without browser errors.

## Commands and verification results

- `pnpm.cmd clean:next` — passed; removed the generated Next.js cache.
- `pnpm.cmd --filter @trading-mentor/web exec node -p "require.resolve('next/package.json')"` — passed; resolved Next.js 16.2.12 from the corrected path.
- `pnpm.cmd --filter @trading-mentor/web dev` — passed; fresh server listened on port 3000.
- `curl.exe http://127.0.0.1:3000/` — HTTP 200 after cold compilation.
- `curl.exe http://127.0.0.1:8000/health` — HTTP 200 with `{"status":"ok"}`.
- Web Prettier check — passed.
- Web ESLint — passed with zero warnings.
- Web TypeScript check — passed.
- Web Vitest suite — 15 tests passed.
- Python Ruff format check with cache disabled — 7 files already formatted.
- Python Ruff lint with cache disabled — passed.
- Python mypy check using a temporary cache — passed for 4 source files.
- Python pytest with its cache provider disabled — 14 tests passed with the existing Starlette deprecation warning.
- `pnpm.cmd build` — not completed in this run. The sandbox denied writing `apps/web/.next/trace`, and the request for elevated build access was declined. A production build had passed immediately before this repair during the repository-rename verification, but it is not counted as a post-change pass.

## Manual verification

The local browser loaded the exact Turbopack HMR client chunk that previously failed. The page had meaningful content, no Next.js error overlay, and no browser console errors. With FastAPI running, the simulator rendered the BTC/USD chart, decision controls, playback controls, and educational simulation notice.

## Limitations and follow-up

- Next.js still reports a slow filesystem benchmark for `apps/web/.next/dev`; cold compilation may be slower than expected.
- A post-change production build remains to be rerun with permission to write generated `.next` output.
- If the repository is moved again, stop the old server first, reinstall dependencies if links no longer resolve, and use `pnpm.cmd dev:clean` once.

## Documentation updated

- Added cache-recovery instructions to `README.md`.
- Recorded the resolved incident and remaining filesystem-performance risk in `docs/STATUS.md`.
- Added this chronological action summary.
