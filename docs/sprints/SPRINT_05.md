# Sprint 05 — Backtesting Engine

## 1. Status

- **State:** Implementation complete; pending product-owner review
- **Stage:** Stage 2 — Strategy research
- **Primary owner:** Oscar
- **Implementation:** `sprint05_implementation`
- **Depends on:** Sprint 04 — accepted with documented follow-up on 2026-08-16
- **Blocks:** Sprint 06 — Performance and Risk Analytics

## 2. Primary outcome

Users can run, save, reopen, and reproduce a deterministic backtest of the approved mean-reversion rules against the approved historical dataset, with explicit signal timing, next-candle execution, costs, and a complete trade audit.

## 3. User story

As a trading learner, I want to apply one transparent rule set across historical candles and inspect every signal and fill so that I can test whether the hypothesis produced hypothetical trades without confusing historical results with a prediction.

## 4. Starting state

Sprint 04 provides a framework-independent `sma_deviation_v1` model, decimal-safe SMA/deviation calculations, revealed-only analysis, locked strategy configuration, chart context, and backward-compatible session persistence.

Sprint 02 provides centralized decimal-safe execution, adverse slippage, fees, deterministic orders/fills, long/short P&L, and explicit assumptions. Sprint 03 provides local SQLite persistence patterns, immutable terminal records, optimistic revisions, and idempotent operation identifiers.

The approved `btc-usd-1h` generated fixture currently contains 32 ordered hourly candles. The repository has no backtest event loop, automated strategy rules, dataset fingerprint, multi-trade result, backtest API, or backtest UI.

Sprint 04 was accepted with two follow-ups that are not Sprint 05 feature scope: live desktop/keyboard/390px verification was waived, and the standalone-output startup warning should be addressed in a separate maintenance branch.

## 5. Included scope

- A framework-independent TypeScript backtesting domain module.
- One versioned rule set, `mean_reversion_threshold_v1`, using Sprint 04 states.
- Close-time signal evaluation and next-candle-open execution.
- Symmetric long and short entries, deterministic exits, and explicit final liquidation.
- One open position at a time with multiple sequential completed trades.
- Reuse of centralized fee, adverse-slippage, order, fill, and P&L calculations.
- Configurable lookback, deviation threshold, quantity, fee basis points, and slippage basis points.
- Dataset identity including a stable content fingerprint for reproducibility.
- Immutable backtest result contracts with signals, orders, fills, trades, events, reconciliation totals, sample size, and trade count.
- Local SQLite persistence for immutable backtest records with create, list, and detail APIs.
- Idempotent save/retry behavior and deterministic rerun comparison.
- A dedicated Backtest Lab entry point, configuration form, run state, results, audit detail, saved records, and reopen/rerun flow.
- Loading, validation, no-trade, completed, persistence-failure, incompatible-record, and offline states.
- Domain, data-integrity, API, persistence, integration, regression, and UI tests.

## 6. Excluded scope

- Win rate, loss rate, expectancy, drawdown, profit factor, Sharpe ratio, volatility, trade distribution charts, or benchmark comparison; these remain Sprint 06.
- Parameter optimization, sweeps, ranking, walk-forward analysis, training/validation splits, or strategy comparison.
- Bollinger Bands, RSI, EMA, VWAP, additional indicators, or a general strategy registry.
- Stop-loss, take-profit, trailing stops, time stops, limit orders, pending-order simulation, partial fills, or order-book modeling.
- Capital accounts, cash balances, compounding, margin, leverage, portfolio allocation, or risk-based position sizing.
- User-selected date ranges, multiple datasets, uploaded market data, or external data providers.
- Changing the interactive simulator to place automatic orders.
- AI-generated interpretation, live data, alerts, brokers, or real-money execution.
- Fixing the standalone-output startup warning inside Sprint 05 feature work.

## 7. Functional requirements

### FR-01 — Configure one reproducible run

Before running a backtest, the user configures:

- mean-reversion lookback: whole number `2` through `100`, default `10`;
- symmetric deviation threshold: positive decimal percentage, default `1`;
- fixed quantity per trade: positive decimal, default `1`;
- fee per fill: `0` through `10,000` basis points, default `0`;
- adverse slippage per fill: `0` through less than `10,000` basis points, default `0`.

The UI shows actionable validation, disables Run while invalid, normalizes accepted values, and displays the fixed rule and execution timing before execution.

### FR-02 — Evaluate signals causally

At each candle close `i`, after the Sprint 04 SMA is available, the engine evaluates only data through index `i`:

```text
flat + below_reference  → queue open_long
flat + above_reference  → queue open_short
flat + near_reference   → no action

long + near_reference or above_reference  → queue close_long
short + near_reference or below_reference → queue close_short
```

`insufficient_data` never creates an action. A queued action is evidence tied to the close that generated it and cannot execute on that same close.

### FR-03 — Execute at the next candle open

A signal generated at close `i` executes once at open `i + 1`. The next candle open is the reference price. Buy fills receive upward slippage; sell fills receive downward slippage. Fees use execution notional. Spread remains zero and leverage remains disabled.

There is no same-candle close execution for strategy signals. A signal on the final candle is recorded but cannot queue an executable action.

### FR-04 — Enforce position and reversal rules

Only one position may be open. Entry signals are ignored while a position is open except for the defined exit conditions. A close executes without opening the opposite direction at the same open. The engine may evaluate a new entry at that candle's later close.

### FR-05 — Close final exposure explicitly

If a position remains open after the final signal evaluation, the engine closes it at the final candle close using normal adverse slippage and fee rules. The trade and event are labeled `end_of_data`, not as a strategy exit. No position may remain open in a completed result.

### FR-06 — Produce an auditable result

Every completed run exposes:

- dataset identity, fingerprint, candle count, and UTC range;
- normalized strategy, rules, and execution assumptions;
- chronological signals and ignored terminal signals;
- deterministic orders, fills, completed trades, and engine events;
- each trade's direction, entry/exit reason, timestamps, reference prices, execution prices, fees, slippage cost, gross P&L, and net P&L;
- total gross P&L, total fees, total slippage cost, total net P&L, completed trade count, and forced-exit count.

Totals are reconciliation evidence required for engine correctness, not Sprint 06 performance analysis. Every result is labeled hypothetical.

### FR-07 — Preserve and reopen records

A completed result can be saved as an immutable local record. Recent records show creation time, dataset, normalized parameters, candle count, and trade count without adding performance rankings. Opening a record restores its exact audit result.

### FR-08 — Reproduce a run

Rerunning an existing record against the same dataset fingerprint and configuration produces a byte-equivalent domain result after excluding record identity and persistence timestamps. A mismatch is surfaced as an incompatibility error and never silently replaced.

### FR-09 — Recover from persistence failure

If record persistence fails, the completed in-memory result remains visible. Retry uses the same record and operation identifiers so an accepted write cannot create a duplicate.

### FR-10 — Protect existing behavior

Interactive simulation, session checkpoints, legacy sessions, strategy panels, identifiers, and Sprint 02 financial results remain unchanged. The Backtest Lab is a separate workflow and cannot mutate simulator sessions.

## 8. Technical requirements

### TR-01 — Domain boundary

Place the backtest clock, signal state machine, execution orchestration, result reconciliation, and reproducibility comparison in framework-independent TypeScript. React components and API routes consume typed inputs/results and do not calculate trades.

### TR-02 — Reuse financial primitives

Refactor execution internals only as needed to support an explicit reference price and timing while preserving current-close simulator behavior. Do not duplicate fee, slippage, fill, P&L, or return formulas. Existing Sprint 02–04 regression tests must remain unchanged or become stricter.

### TR-03 — Decimal safety

Use `decimal.js` for prices, quantity, fees, slippage, trade P&L, and totals. Persist decimal strings and round only for display. Do not use JavaScript number arithmetic for authoritative results.

### TR-04 — No look-ahead

Each strategy point must remain causal even if the engine computes the rolling series in one linear pass. A signal at index `i` may read candles `0..i`; its fill may read only the open at `i + 1`. Tests must mutate all later OHLCV fields and prove earlier signals, queued actions, fills, and closed trades are unchanged.

### TR-05 — Determinism

Identical dataset fingerprint, normalized configuration, and engine version produce an identical result. Record IDs, operation IDs, persistence timestamps, locale formatting, randomness, network state, and wall-clock time cannot affect the domain result.

### TR-06 — Dataset versioning

Expose a stable SHA-256 fingerprint for the canonical approved dataset without changing persisted Sprint 03/04 session metadata compatibility. A backtest record binds to dataset ID, generated timestamp, candle count, and fingerprint. The API rejects an unavailable or mismatched fingerprint.

### TR-07 — Linear event loop

Calculate the causal SMA series and process candles in linear time. Avoid repeatedly slicing and recalculating full history inside the event loop.

### TR-08 — Immutable persistence

Add versioned SQLite backtest storage without weakening session transactions. Backtest records are append-only after creation. `(record_id, operation_id)` idempotence returns the accepted record; a reused record ID with different content returns a conflict.

### TR-09 — Boundary validation

The API validates schema versions, supported engine/rule/strategy models, dataset identity, timestamp/index ordering, deterministic identifier sequences, one-position invariants, signal-to-fill timing, trade links, terminal closure, totals represented as finite decimal strings, and result fingerprint shape.

### TR-10 — API surface

The planned endpoints are:

```text
POST /api/v1/backtests
GET  /api/v1/backtests
GET  /api/v1/backtests/{backtest_id}
```

Create is idempotent by stable record and operation identifiers. Records have no update or delete endpoint in Sprint 05.

### TR-11 — Presentation and accessibility

Use a dedicated `/backtests` route or equivalently isolated Backtest Lab surface. Inputs have labels and descriptions, errors use accessible alerts, run/save status uses polite live regions, tables remain readable at 390px without page-level horizontal overflow, and profit/loss is never communicated by color alone.

### TR-12 — Operational follow-up separation

Do not mix the previously discovered standalone-output startup correction into backtesting changes. If it blocks manual verification, address it first in a separately approved maintenance branch with its own regression evidence.

## 9. Domain contracts and assumptions

Proposed contracts:

```ts
type MeanReversionRuleConfig = {
  model: "mean_reversion_threshold_v1";
  entrySignalTiming: "candle_close";
  signalFillTiming: "next_candle_open";
  finalPositionPolicy: "close_at_final_candle_close";
};

type BacktestConfig = {
  strategyContext: StrategyContext;
  rules: MeanReversionRuleConfig;
  executionConfig: ExecutionConfig;
};

type BacktestDatasetReference = {
  id: string;
  generatedAt: string;
  candleCount: number;
  fingerprint: string;
};

type BacktestSignalAction =
  | "open_long"
  | "open_short"
  | "close_long"
  | "close_short";

type BacktestSignal = {
  id: string;
  candleIndex: number;
  timestamp: string;
  state: Exclude<MeanReversionState, "insufficient_data">;
  action: BacktestSignalAction;
  executionCandleIndex: number | null;
  status: "executed" | "ignored_end_of_data";
};

type BacktestTrade = Trade & {
  id: string;
  entrySignalId: string;
  exitSignalId: string | null;
  exitReason: "strategy" | "end_of_data";
};

type BacktestEvent = {
  id: string;
  sequence: number;
  type:
    | "signal_created"
    | "order_filled"
    | "position_opened"
    | "position_closed"
    | "end_of_data_close";
  candleIndex: number;
  timestamp: string;
  message: string;
  signalId?: string;
  orderId?: string;
  fillId?: string;
  tradeId?: string;
};

type BacktestResult = {
  schemaVersion: 1;
  engineVersion: "mean_reversion_backtest_v1";
  dataset: BacktestDatasetReference;
  config: BacktestConfig;
  signals: BacktestSignal[];
  orders: Order[];
  fills: ExecutionFill[];
  trades: BacktestTrade[];
  events: BacktestEvent[];
  candleCount: number;
  tradeCount: number;
  forcedExitCount: number;
  totalGrossPnl: string;
  totalFees: string;
  totalSlippageCost: string;
  totalNetPnl: string;
};

type BacktestRecord = {
  schemaVersion: 1;
  id: string;
  operationId: string;
  result: BacktestResult;
  resultFingerprint: string;
  createdAt: string;
};
```

Assumptions:

- The approved full dataset is the only run range.
- SMA/deviation uses each completed close, including the signal candle close.
- Strategy signals never fill at the close that generated them.
- Signal fills use the next candle open; final liquidation alone uses the final close.
- Long and short directions are both enabled and symmetric.
- Quantity is fixed per trade; there is no cash account, compounding, or capital constraint.
- One position is open at most, and all completed results end flat.
- Spread is `0`; leverage, partial fills, and rejected fills are unsupported.
- A no-trade result is valid and reports zero decimal totals.
- Aggregate totals are exact sums for reconciliation and do not constitute Sprint 06 analytics.
- `resultFingerprint` is the SHA-256 digest of canonical UTF-8 JSON for `BacktestResult`, using recursively sorted object keys and preserved array order.

## 10. UX states

- Backtest Lab introduction with hypothetical-result and no-look-ahead notices.
- Valid defaults with visible rule and execution timing.
- Invalid strategy or execution configuration with disabled Run.
- Running state that prevents duplicate execution.
- Completed result with dataset/sample context, reconciliation totals, and chronological trade audit.
- Valid no-trade result with explanation and zero totals.
- Saving, saved, offline, failed, and idempotent Retry states.
- Recent immutable backtest records with empty state.
- Read-only record detail and deterministic Rerun comparison.
- Dataset fingerprint or engine-version incompatibility error.
- API unavailable state with recovery guidance.
- Desktop and 390px layouts with keyboard-accessible navigation and controls.

## 11. Acceptance criteria

- [x] Valid configuration normalizes before a run; invalid values visibly prevent execution.
- [x] Signals follow the approved flat/long/short state table exactly.
- [x] A close-time signal never fills before the next candle open.
- [x] Hidden-future mutation cannot change prior signals, fills, or completed trades.
- [x] Long and short trades use the existing adverse-slippage, fee, and P&L formulas.
- [x] Only one position exists at a time and no same-open reversal occurs.
- [x] Final exposure closes at the final close and is labeled `end_of_data`.
- [x] No-trade datasets produce a valid zero-total result.
- [x] Orders, fills, signals, events, and trades have deterministic ordered identifiers and valid links.
- [x] Per-trade values reconcile exactly to aggregate gross P&L, fees, slippage, and net P&L.
- [x] Dataset identity and SHA-256 fingerprint are preserved and validated.
- [x] Identical input produces byte-equivalent domain results.
- [x] Completed records persist across API restart and are immutable.
- [x] Retried record creation is idempotent and does not duplicate history.
- [x] Reopening and rerunning a compatible record reproduces the saved result.
- [x] The UI clearly labels assumptions, timing, sample size, trade count, and hypothetical results.
- [x] The UI provides loading, validation, running, no-trade, saved, offline, failed, retry, empty, and incompatible states.
- [x] Existing interactive simulator, sessions, strategy analysis, and financial tests remain unchanged.
- [ ] Desktop, keyboard, and 390px flows are usable without page-level horizontal overflow.
- [x] Install, format, lint, typecheck, tests, production build, and `git diff --check` pass.
- [x] Required documentation matches the implemented repository.
- [x] No excluded analytics, optimization, extra strategies, or live execution was introduced.

## 12. Automated test minimum

### Backtest domain

- Insufficient history produces no signal or fill.
- Flat below/above/near states map to long/short/no action.
- Long and short exit-state boundaries follow the rule table.
- Exact threshold equality remains near reference and behaves accordingly.
- Signals execute at the following open with correct candle index and timestamp.
- Fees and adverse slippage apply to next-open and final-close fills.
- Multiple sequential trades preserve one-position invariants and deterministic identifiers.
- A close never reverses at the same open.
- Final open position closes once at final close with `end_of_data` reason.
- Final-candle signal is recorded as ignored and creates no impossible fill.
- No-trade result has empty arrays and exact zero totals.
- High-precision decimal fixtures reconcile trade and aggregate totals exactly.
- Same input returns deep-equal results.
- Canonical result serialization and SHA-256 fingerprint are stable across repeated runs.
- Mutating future open/high/low/close/volume cannot alter prior output.
- Engine processes the causal SMA and event loop without quadratic history recalculation.

### Dataset and persistence

- Canonical dataset fingerprint is stable and changes when fixture content changes.
- Fingerprint exposure does not change legacy session metadata compatibility.
- New record round-trips complete configuration and result across repository restart.
- List ordering is deterministic and summaries expose no Sprint 06 metric.
- Duplicate operation retry returns the original record.
- Duplicate record ID with different content returns conflict.
- Unsupported schema, engine, rule, strategy, or dataset fingerprint is rejected.
- A missing or incorrect result fingerprint is rejected.
- Invalid indices, timestamps, links, identifier sequences, totals, or terminal exposure are rejected.
- Backtest records have no mutation endpoint.

### Regression and UI integration

- Existing Sprint 02 execution and Sprint 03/04 session tests remain green.
- Valid defaults run once and render a result.
- Invalid lookback, threshold, quantity, fee, and slippage disable Run with actionable errors.
- Running state blocks duplicate starts.
- Result shows the fixed rule, next-open timing, final-close policy, costs, sample size, and trade count.
- No-trade, API-offline, save-failed, retry, empty-history, and incompatible-record states render accessibly.
- Save, refresh, reopen, API restart, and rerun preserve/reproduce the result.
- Keyboard navigation and 390px layout preserve readable audit details without page overflow.
- Result copy remains hypothetical and does not present profitability conclusions or action advice.

## 13. Manual verification

1. Start from a clean documented setup and empty backtest history.
2. Open the Backtest Lab and verify default strategy, rule, execution, and hypothetical-result notices.
3. Run the approved fixture with zero costs and inspect the first signal, following-open fill, and exit independently.
4. Repeat with nonzero fees and slippage; reconcile one long trade, one short trade, and aggregate totals independently.
5. Confirm the engine never displays a fill on the signal candle close.
6. Inspect a final forced liquidation and confirm its `end_of_data` label and final-close reference.
7. Run a valid no-trade configuration and confirm zero totals without an error.
8. Run the same configuration twice and compare domain results excluding record identity/timestamps.
9. Save, refresh, reopen, restart the API, and reopen the immutable record.
10. Stop the API during save, confirm the result remains visible, restart it, and retry without duplication.
11. Attempt invalid inputs and incompatible/unsupported records; confirm safe actionable errors.
12. Confirm existing simulator sessions still start, save, resume, and review unchanged.
13. Navigate the lab with keyboard only and verify labels, focus, live announcements, and text alternatives.
14. Verify desktop and 390px layouts with no page-level horizontal overflow; any audit table may scroll only inside its labeled container.
15. Inspect browser console and API logs for runtime errors or failed requests.

## 14. Documentation updates

- [x] Update `docs/STATUS.md` after implementation evidence exists.
- [x] Update this sprint's checklist and completion evidence.
- [x] Record approved backtest timing, rule, fingerprint, and persistence decisions in `docs/DECISIONS.md`.
- [x] Update `README.md` with Backtest Lab behavior, assumptions, run commands, and limitations.
- [x] Document backtest API and immutable record schema.
- [x] Add an immutable Sprint 05 implementation summary under `docs/summaries/`.

## 15. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Same-close signal execution | Look-ahead bias and overstated results | Close-time signals, next-open fills, explicit timing fields, mutation tests |
| Strategy and backtest logic diverge | UI hypothesis and historical rules disagree | Reuse `sma_deviation_v1` as the single signal-state source |
| Financial formulas are duplicated | Simulator and backtest costs/P&L drift | Extract reusable execution primitives with Sprint 02 regression tests |
| Dataset changes invalidate reproducibility | Saved and rerun results silently differ | Stable content fingerprint, engine version, immutable record, mismatch errors |
| End-of-data behavior hides exposure | Results omit an open position or use an implicit price | Mandatory labeled final-close liquidation and terminal-flat validation |
| Aggregates become premature analytics | Sprint 06 scope and interpretation become muddled | Limit totals to reconciliation; exclude rates, risk, benchmarks, and conclusions |
| Client-produced record is malformed | Persisted audit cannot be trusted or reopened | Strict API structural/link/timing validation and client rerun comparison |
| Small 32-candle fixture yields few trades | Result may be educationally limited | Treat no/few trades as valid sample evidence; do not tune parameters for activity |
| Audit details overflow mobile | Core evidence becomes unusable | Responsive cards and labeled internal scroll containers verified at 390px |
| Standalone startup warning interrupts verification | Manual evidence remains incomplete | Resolve separately before Sprint 05 verification if needed; do not bundle silently |

## 16. Sprint completion evidence

To be completed only after scope approval, implementation, and verification:

- Repository state before work: Sprint 04 accepted; approved Sprint 05 plan staged on `sprint05_implementation`; no Sprint 05 code existed.
- Files created or modified: TypeScript backtest/execution/contracts/API client/tests; Backtest Lab route/component/styles; FastAPI models/repository/routes/tests; project documentation.
- Decisions recorded: causal close-signal/next-open rules and immutable dataset/result-fingerprinted SQLite records.
- Commands run: offline frozen install, Prettier/Ruff format, ESLint/Ruff lint, TypeScript/MyPy typecheck, Vitest, pytest with workspace temp path, Next.js production build, live HTTP checks, and `git diff --check`.
- Automated test results: 49 web tests and 26 API tests passed.
- Production build result: passed; `/`, `/backtests`, `/_not-found`, and `/icon.svg` generated successfully.
- Manual verification results: live API health and `/backtests` returned HTTP 200; no controllable browser was connected, so desktop/keyboard/390px/console checks remain pending.
- Remaining limitations: Sprint 06 analytics and all excluded research/live features remain absent; standalone startup compatibility stays separate maintenance scope.
- Documentation updated: README, project master, status, decisions, Sprint 05, and dated implementation summary.
- Review decision: pending product-owner review and acceptance.

Do not mark Sprint 05 active for implementation or accepted until the product owner explicitly approves this scope and later accepts the completed outcome.
