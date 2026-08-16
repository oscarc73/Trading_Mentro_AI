# Sprint 04 — Mean-Reversion Strategy Model

## 1. Status

- **State:** Accepted by the product owner with documented follow-up on 2026-08-16
- **Stage:** Stage 2 — Strategy research
- **Primary owner:** Oscar
- **Implementation:** Codex
- **Depends on:** Sprint 03 — accepted on 2026-08-10
- **Blocks:** Sprint 05 — Backtesting Engine

## 2. Primary outcome

The platform calculates and displays an initial transparent mean-reversion hypothesis from revealed historical candles without recommending or executing trades automatically.

## 3. User story

As a trading learner, I want to compare the current price with a recent average and see the exact deviation calculation so that I can understand a basic mean-reversion hypothesis without treating it as a guaranteed signal.

## 4. Starting state

Sprint 03 provides a verified historical simulator with sequential candle revelation, strict future-data hiding, deterministic orders/fills/P&L, versioned SQLite session checkpoints, exact resume, recent-session history, persistence recovery, and read-only review.

The repository has no strategy or indicator engine. Calculations currently cover execution and financial results only. Session checkpoint schema version `1` contains no strategy configuration or analysis context.

## 5. Included scope

- Framework-independent mean-reversion domain module in TypeScript.
- Simple moving average (SMA) of revealed candle closes.
- Signed price deviation from the SMA in absolute price and percentage terms.
- Configurable integer lookback and positive percentage threshold.
- Four deterministic hypothesis states: insufficient data, below reference, near reference, and above reference.
- A chart SMA overlay restricted to revealed candles.
- A transparent strategy panel showing formula inputs, result, state, assumptions, and educational explanation.
- Strategy configuration captured when a new session starts and locked for that session.
- Versioned checkpoint support that preserves new-session strategy configuration without invalidating readable Sprint 03 sessions.
- Strategy context in active-session resume and completed-session review.
- Validation, loading, insufficient-data, disabled, legacy-session, and error states.
- Domain, persistence-contract, reducer/integration, and UI tests.

## 6. Excluded scope

- Buy, Sell, Hold, or Close recommendations.
- Automatic order creation or execution.
- Backtesting, performance metrics, optimization, parameter sweeps, or strategy comparison.
- Bollinger Bands, RSI, EMA, VWAP, standard deviation bands, or additional indicators.
- Entry/exit rules, stop-loss, take-profit, or position sizing derived from the hypothesis.
- AI-generated explanations.
- Live market data, alerts, broker integration, or real-money trading.
- A general multi-strategy plugin/registry architecture; that remains Sprint 09 scope.

## 7. Functional requirements

### FR-01 — Configure the hypothesis

Before creating a new session, the user can configure:

- `lookback`: whole candle count, default `10`, minimum `2`, maximum `100`;
- `deviationThresholdPercent`: positive decimal percentage, default `1`.

Invalid values show an actionable message and prevent session creation. Configuration is normalized, persisted, and locked after session creation.

### FR-02 — Calculate the rolling reference

For revealed candle index `i`, the SMA is available only when at least `lookback` candles ending at `i` are revealed. The calculation uses exactly those close prices and no earlier or future value outside the selected window.

### FR-03 — Calculate deviation

For current close `C` and current SMA `M`:

```text
deviation_price   = C - M
deviation_percent = (C - M) / M * 100
```

Positive deviation means price is above the reference; negative deviation means it is below. Domain results remain decimal strings and are rounded only for display.

### FR-04 — Classify the current state

For threshold `T`:

```text
deviation_percent < -T  → below_reference
-T <= deviation_percent <= T → near_reference
deviation_percent > T   → above_reference
```

Equality belongs to `near_reference`. Before enough candles exist, the state is `insufficient_data` and no deviation is presented as authoritative.

### FR-05 — Explain without directing

The strategy panel explains:

- the current close;
- lookback and candles used;
- SMA value;
- signed absolute and percentage deviation;
- threshold and resulting state;
- that mean reversion is a hypothesis, not a prediction;
- that price can continue moving away from the mean.

Language must not instruct the user to Buy, Sell, Hold, or Close.

### FR-06 — Display chart context

The price chart displays a visually distinct SMA line only for calculated points through the current revealed cursor. The line and textual state must not expose future candles. Color is not the sole method used to communicate state.

### FR-07 — Preserve simulation behavior

Trading actions, execution assumptions, order/fill identifiers, P&L, persistence recovery, lifecycle transitions, and terminal immutability remain unchanged. Strategy analysis is read-only context and cannot mutate engine calculations.

### FR-08 — Persist and review context

New sessions preserve normalized strategy configuration in their checkpoint. Resume restores the exact configuration. Completed-session review shows the configuration and final revealed-candle analysis. Sprint 03 sessions without strategy context remain readable and display a clear “not recorded for this legacy session” state.

## 8. Technical requirements

### TR-01 — Domain boundary

Place configuration validation, rolling SMA, deviation, classification, and deterministic explanation selection outside React components and API routes. UI components consume typed results only.

### TR-02 — Decimal safety

Use the existing `decimal.js` dependency for close, mean, deviation, threshold, and percentage calculations. Do not convert domain calculations to JavaScript numbers. Number conversion remains limited to chart rendering and formatted presentation boundaries.

### TR-03 — No look-ahead

The strategy function accepts only the revealed candle slice or an explicit cursor-bounded input. Tests must prove that changing hidden future candles cannot change any current indicator point, state, or explanation.

### TR-04 — Determinism

Identical revealed candles and normalized configuration produce byte-equivalent domain results. No timestamps, randomness, AI, network data, or mutable global state may influence calculation.

### TR-05 — Contract evolution

Introduce a versioned strategy context for new checkpoints while preserving read access to schema-version-1 Sprint 03 sessions. The SQLite table schema should remain unchanged unless implementation evidence proves a migration is necessary; checkpoint JSON is the preferred extension boundary.

### TR-06 — Efficient rolling calculation

Calculate the SMA series in linear time using a rolling decimal sum or an equivalently clear deterministic algorithm. Avoid recalculating every full window independently during each render.

### TR-07 — Presentation boundaries

Display price values using the dataset currency, deviation price with an explicit sign, and deviation percentage to no more than three decimal places. Do not round intermediate values.

### TR-08 — Accessibility and responsiveness

Configuration inputs require associated labels and actionable validation. Strategy state changes use a polite live region. The chart legend and strategy panel remain readable and free of horizontal overflow at 390px.

## 9. Domain contracts and assumptions

Proposed contracts:

```ts
type MeanReversionConfig = {
  lookback: number;
  deviationThresholdPercent: string;
};

type MeanReversionState =
  | "insufficient_data"
  | "below_reference"
  | "near_reference"
  | "above_reference";

type MeanReversionPoint = {
  candleIndex: number;
  timestamp: string;
  close: string;
  movingAverage: string;
  deviationPrice: string;
  deviationPercent: string;
  state: Exclude<MeanReversionState, "insufficient_data">;
};

type MeanReversionAnalysis = {
  model: "sma_deviation_v1";
  config: MeanReversionConfig;
  state: MeanReversionState;
  current: MeanReversionPoint | null;
  series: MeanReversionPoint[];
  candlesRequired: number;
};

type StrategyContext = {
  model: "sma_deviation_v1";
  config: MeanReversionConfig;
};
```

Assumptions:

- Close price is the only input.
- SMA is unweighted and uses consecutive revealed candles.
- Threshold is symmetric above and below the mean.
- The first valid point is at index `lookback - 1`.
- The model describes relative location only; it does not estimate probability, timing, expected return, or trade direction.
- Strategy context does not change execution, fees, slippage, spread, leverage, quantity, orders, fills, P&L, or session lifecycle.

## 10. UX states

- New-session strategy configuration with defaults and formula preview.
- Invalid lookback or threshold with disabled Start action.
- Loading dataset/session history.
- Active analysis with chart overlay and transparent formula details.
- Insufficient data showing the exact number of additional candles required.
- Below, near, and above-reference states communicated through text and styling.
- Saving/saved/offline/failed checkpoint states inherited unchanged from Sprint 03.
- Legacy session with unavailable strategy context.
- Completed read-only review with final configuration and analysis.
- Dataset or persisted-context incompatibility error with safe recovery guidance.

## 11. Acceptance criteria

- [x] Valid configuration normalizes and locks when a new session is created.
- [x] Invalid lookback and threshold values visibly prevent session creation.
- [x] SMA values are exact for known decimal fixtures.
- [x] Absolute and percentage deviations are exact before presentation formatting.
- [x] Threshold boundary equality classifies as near reference.
- [x] Insufficient history produces no authoritative SMA/deviation result.
- [x] Hidden future-candle changes cannot affect current analysis or series.
- [x] The chart SMA series ends at the revealed cursor.
- [x] Explanations disclose assumptions and uncertainty without trade instructions.
- [x] Strategy configuration survives save, refresh, resume, and API restart.
- [x] Sprint 03 sessions without strategy context remain readable.
- [x] Completed reviews show the final strategy configuration and analysis.
- [x] Trading engine calculations and deterministic identifiers remain unchanged.
- [ ] Desktop, keyboard, and 390px mobile flows are usable without horizontal overflow.
- [x] Install, format, lint, typecheck, tests, production build, and `git diff --check` pass.
- [x] Required documentation matches the implemented repository.
- [x] No excluded functionality was introduced.

## 12. Automated test minimum

### Strategy domain

- Known SMA windows with integers and high-precision decimal closes.
- First valid index and insufficient-data behavior.
- Positive, negative, and zero absolute/percentage deviation.
- Below, near, and above classification, including both equality boundaries.
- Minimum/maximum lookback and invalid integer cases.
- Positive decimal threshold validation and invalid/non-finite cases.
- Same inputs produce identical outputs.
- Mutating hidden future candles leaves current output unchanged.
- Linear series contains only cursor-bounded points in timestamp order.

### Persistence and state integrity

- New checkpoint round-trips exact strategy configuration.
- Active session resume restores identical analysis inputs.
- Schema-version-1 session remains readable with legacy state.
- Unsupported strategy model/config is rejected safely.
- Strategy context cannot alter orders, fills, trades, events, or P&L.
- Idempotent save retry remains unchanged.

### UI integration

- Configure, start, reveal, refresh, resume, and verify identical strategy values.
- Invalid configuration prevents Start.
- Insufficient data message updates when enough candles become available.
- Chart overlay count and last timestamp match revealed analysis points.
- All four states render accessible text.
- Legacy and API-offline states remain recoverable.
- Completed review displays configuration, final reference, deviation, and disclaimer.
- Strategy panel never presents Buy/Sell/Close recommendations.

## 13. Manual verification

1. Start from an empty local session database and both applications running.
2. Create a session with lookback `10` and threshold `1%`.
3. Independently calculate one SMA and deviation from the fixture and compare every displayed input/result.
4. Advance candles and confirm the line/state change only after revelation.
5. Modify a hidden future candle in a test fixture and verify the current UI output is unchanged.
6. Refresh and resume; verify configuration and analysis are identical.
7. Complete the session and inspect the read-only strategy context.
8. Open a Sprint 03 schema-version-1 session and verify the legacy-context message.
9. Exercise invalid inputs, insufficient data, API offline/retry, and unsupported persisted context.
10. Navigate configuration and analysis using the keyboard and confirm focus/live announcements.
11. Verify desktop and 390px layouts with no horizontal overflow.
12. Confirm trading orders, fills, fees, slippage, gross/net P&L, and identifiers match Sprint 03 behavior.

## 14. Documentation updates

- [x] Update `docs/STATUS.md` after implementation evidence exists.
- [x] Update this sprint's evidence and checklist.
- [x] Record the approved strategy formula and checkpoint evolution in `docs/DECISIONS.md`.
- [x] Update `README.md` with configuration, formulas, limitations, and run behavior.
- [x] Update persistence/schema documentation for strategy context compatibility.
- [x] Add an immutable Sprint 04 implementation summary under `docs/summaries/`.

## 15. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Look-ahead leakage | Misleading educational context and invalid future backtests | Cursor-bounded domain API plus hidden-future mutation tests |
| Strategy wording becomes advice | Users may treat a hypothesis as a directive | Prohibit action labels; deterministic educational copy and content assertions |
| Floating-point drift | Incorrect mean/deviation near thresholds | Reuse `decimal.js`; decimal strings and exact boundary tests |
| Contract evolution breaks Sprint 03 sessions | Saved history becomes unreadable | Backward-compatible versioned checkpoint union and legacy-session tests |
| Indicator logic leaks into UI | Duplication and future backtest divergence | Framework-independent typed strategy module as the only calculation source |
| Scope expands into backtesting or indicator stacking | Sprint outcome becomes too large and unverifiable | Limit to SMA/deviation; explicitly defer Bollinger, RSI, signals, and performance to later work |

## 16. Sprint completion evidence

Scope was approved and implementation authorized by the product owner on 2026-08-10.

- **Repository state before work:** Sprint 03 implementation was clean; the approved Sprint 04 planning documentation was the only pending change.
- **Files created or modified:** Mean-reversion domain module/tests, strategy configuration/panel/chart/review UI, session contracts/client, FastAPI validation/persistence/tests, workspace verification scripts, README, decisions, status, sprint, and immutable action summaries.
- **Decisions recorded:** revealed-only `sma_deviation_v1`; decimal-safe rolling calculation; checkpoint JSON version `2` with locked strategy context and retained version-1 reads; no SQLite migration.
- **Commands run:** offline frozen install, format check, lint, typecheck, Vitest/pytest, production build, `git diff --check`, local API/web health checks.
- **Automated test results:** 42 Vitest tests and 23 pytest tests passed. Existing Starlette/httpx deprecation and restricted pytest-cache warnings remain non-failing.
- **Production build result:** Next.js 16.2.12 production build passed; `/`, `/_not-found`, and `/icon.svg` were generated successfully.
- **Manual verification results:** Production API and web servers started; `/health` and `/` returned HTTP 200. The Codex browser runtime reported no available browser, so interactive desktop/390px, live console, refresh/resume, and screenshot checks were not executed.
- **Remaining limitations:** The unchecked desktop/keyboard/390px acceptance item requires a connected browser. Backtesting, performance analytics, signals, additional indicators, and live execution remain intentionally excluded.
- **Documentation updated:** README, project master, status, Sprint 04, decisions, and two dated action summaries.
- **Review decision:** Accepted by the product owner with follow-up on 2026-08-16. The unchecked desktop/keyboard/390px verification item was explicitly waived for acceptance because no controllable browser was connected. The standalone startup compatibility warning remains separate maintenance work.

Sprint 04 was explicitly accepted by the product owner on 2026-08-16. The unchecked visual verification item remains unchanged so the historical evidence is not overstated.
