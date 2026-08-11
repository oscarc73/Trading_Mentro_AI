# Sprint 03 — Sessions, Persistence and Usability

## 1. Status

- **State:** Accepted by the product owner on 2026-08-10
- **Stage:** Stage 1 — Functional foundation
- **Primary owner:** Oscar
- **Implementation:** Codex
- **Depends on:** Sprint 02 — accepted on 2026-08-03

## 2. Primary outcome

Users can start, save, resume, complete, abandon, and review historical simulator sessions reliably across browser refreshes and application restarts.

## 3. Included scope

- Versioned `SimulationSession`, `SessionSummary`, `SessionCheckpoint`, lifecycle, and error contracts.
- Local SQLite persistence with schema initialization, transactional writes, optimistic revisions, and idempotent operation identifiers.
- `active → completed` and `active → abandoned` terminal transitions.
- Exact reducer checkpoint restoration with dataset compatibility and future-candle validation.
- Checkpoints after accepted Buy, Sell, Hold, Close, and candle-advance actions.
- Start/resume entry, recent sessions, persistence status, retry recovery, abandonment confirmation, and read-only review.
- Completed-session dataset range, duration, decisions, orders, fills, assumptions, result, and audit history.
- Keyboard focus visibility, live save/error announcements, and narrow-screen layouts without horizontal overflow.

## 4. Excluded scope

- Authentication, multiple users, or cloud synchronization.
- Multiple trades per session or editing terminal sessions.
- Strategies, indicators, backtesting, advanced analytics, journal notes, or AI explanations.
- Live data, broker integration, balances, margin, or leverage.

## 5. Authoritative contracts and lifecycle

- Session schema version: `1`.
- Checkpoint schema version: `1`.
- Persistence schema version: `1`.
- The checkpoint contains the execution configuration and complete Sprint 02 `SimulationState`.
- SQLite stores financial values inside the checkpoint JSON as validated decimal strings; it never converts them to binary floating point.
- A session contains approved dataset metadata and validates it against the currently available fixture before restoration.
- Terminal sessions are read-only.
- `expectedRevision` prevents stale writes. `(session_id, operation_id)` uniqueness makes retries idempotent.

## 6. API

```text
POST /api/v1/sessions
GET  /api/v1/sessions
GET  /api/v1/sessions/{session_id}
PUT  /api/v1/sessions/{session_id}/checkpoint
POST /api/v1/sessions/{session_id}/complete
POST /api/v1/sessions/{session_id}/abandon
```

Status mapping: missing session `404`, invalid or incompatible persisted state `422`, stale revision or terminal mutation `409`, invalid request schema `422`.

## 7. Acceptance criteria

- [x] Sprint 02 is recorded as accepted and Sprint 03 is active.
- [x] Sessions use versioned contracts and authoritative lifecycle transitions.
- [x] SQLite persists sessions transactionally across API restarts.
- [x] Retried create, checkpoint, complete, and abandon operations do not duplicate state transitions.
- [x] Active checkpoints restore cursor, configuration, position, orders, fills, trade, and audit events.
- [x] Future candle references, incompatible datasets, unsupported schemas, and malformed state are rejected.
- [x] Completed and abandoned sessions are read-only.
- [x] The UI provides start, resume, recent history, saving, saved, failed, offline, retry, and empty states.
- [x] Actions are locked while saving and a failed save retains recoverable local state.
- [x] Completed sessions provide the required read-only financial and audit review.
- [x] Full format, lint, typecheck, test, and production build gate passes.
- [x] Long, short, refresh/restart, failure recovery, keyboard-accessible controls, desktop, and 390px manual verification passes.
- [x] Final status, evidence, decision record, README, and immutable action summary are complete.

## 8. Verification evidence

Automated evidence:

- `pnpm.cmd install --offline --frozen-lockfile` — dependency graph already up to date.
- `pnpm.cmd format:check` — Prettier and Ruff formatting passed.
- `pnpm.cmd lint` — ESLint and Ruff passed with zero warnings/errors.
- `pnpm.cmd typecheck` — TypeScript and mypy passed.
- `pnpm.cmd test` — 31 Vitest tests and 21 pytest tests passed; one existing Starlette/httpx deprecation warning remains.
- `pnpm.cmd build` — Next.js production build passed.
- `git diff --check` — passed.

Manual browser evidence:

- Created a configured long, revealed candle 13, refreshed, resumed the exact 13-candle cursor and `0.5` BTC position, completed, and inspected the two linked orders/fills and two-event review.
- Repeated refresh/resume/completion with a short position.
- Restarted both API and production web applications and confirmed both completed sessions remained reviewable.
- Stopped the API during an accepted Hold: the UI retained `Hold (1)`, showed `Offline · save pending`, disabled actions, then saved the same state after Retry when the API returned.
- Confirmed terminal reviews expose no editing inputs, browser console contains no errors, native controls have accessible names/labels, and mobile history/review layouts have no horizontal overflow under the 390px breakpoint.
- Removed the generated manual-verification database after stopping both servers, leaving empty local history for the next run.

## 9. Definition of done

Sprint 03 is ready for product-owner review only after all acceptance checkboxes above are complete and repository documentation matches verified behavior.

**Review decision:** Accepted by the product owner on 2026-08-10. Sprint 04 planning is authorized; Sprint 04 implementation remains pending scope approval.
