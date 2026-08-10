# Sprint 03 — Sessions, Persistence and Usability

## Outcome

Implemented and verified reliable local simulator sessions. Users can start, save, resume, complete, abandon, list, and review historical practice across browser refreshes and application restarts without changing Sprint 02 financial calculations.

## Scope completed

- Activated Sprint 03 and recorded Sprint 02 acceptance.
- Added versioned TypeScript and Pydantic session/checkpoint contracts.
- Added transactional SQLite schema initialization, session repository, deterministic list ordering, optimistic revisions, idempotent operation ledger, and stable API errors.
- Added create/list/get/checkpoint/complete/abandon endpoints.
- Added exact state/dataset/timestamp validation, future-candle prevention, and read-only terminal sessions.
- Added start/resume history, saving/saved/offline/failed/retry/empty states, action locking, abandonment confirmation, and read-only review UI.
- Added responsive and accessible control, focus, live-status, history, and review layouts.
- Added persistence, API, reducer restore, and UI recovery tests.

## Areas affected

- `apps/web/src/domain`: session contracts and API client.
- `apps/web/src/components` and `apps/web/src/app/globals.css`: session entry, simulator persistence integration, result/review views, recovery, and responsive UI.
- `services/api/app`: versioned models, SQLite repository, routes, and error handling.
- `services/api/tests`: lifecycle, restart, transaction/idempotency, validation, and error tests.
- Root/data README, status, sprint, decisions, ignore rules, and this action summary.

## Decisions and assumptions

- Use Python's built-in SQLite support and store validated versioned checkpoint JSON plus indexed session summary columns.
- Preserve all financial values as decimal strings.
- Use client-stable operation identifiers for safe retries and `expectedRevision` for stale-write prevention.
- Keep one local installation and one trade per session; authentication and cloud sync remain excluded.
- Extract the completed result into a top-level React component during the React best-practices pass to avoid inline-component remounts.

## Commands and verification

- `pnpm.cmd install --offline --frozen-lockfile` — passed; already up to date.
- `pnpm.cmd format:check` — passed.
- `pnpm.cmd lint` — passed.
- `pnpm.cmd typecheck` — passed.
- `pnpm.cmd test` — passed: 31 web tests and 21 API tests.
- `pnpm.cmd build` — passed with static `/`, `/_not-found`, and `/icon.svg` output.
- `git diff --check` — passed.

The API suite continues to emit the known Starlette/httpx test-client deprecation warning; all 21 API tests pass.

## Manual verification

- Configured long: create, open, advance to candle 13, refresh, resume exact cursor/position, complete, and inspect financial/audit review.
- Short: create, open, advance, refresh, resume, complete, and inspect review.
- Restarted API and production web server; persisted completed history remained available.
- Stopped API during Hold, observed offline pending state and disabled controls, restarted API, retried, and verified `Hold (1)` saved.
- Confirmed no browser console errors or framework overlay.
- Confirmed read-only terminal views contain no inputs.
- Confirmed recent history and review have no horizontal overflow at the 390px responsive breakpoint.
- Stopped verification servers and removed only the generated `services/api/data/sessions.sqlite3` test history.

## Limitations and follow-up

- Sessions are local to one installation and have no authentication or cloud synchronization.
- SQLite deletion remains a manual local-file operation; no in-product delete action is in Sprint 03 scope.
- One trade per session remains authoritative.
- The current FastAPI test dependency set emits one non-blocking deprecation warning.
- Sprint 04 is not activated.

## Documentation updated

- `README.md`
- `services/api/data/README.md`
- `docs/PROJECT_MASTER.md`
- `docs/STATUS.md`
- `docs/DECISIONS.md`
- `docs/sprints/SPRINT_02.md`
- `docs/sprints/SPRINT_03.md`
- This immutable action summary
