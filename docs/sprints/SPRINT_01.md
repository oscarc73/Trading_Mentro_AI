# Sprint 01 — Minimum Functional Trading Simulator

## 1. Status

- **State:** Accepted by the product owner on 2026-08-02
- **Stage:** Stage 1 — Functional foundation
- **Primary owner:** Oscar
- **Implementation:** Codex
- **Depends on:** Foundational documentation
- **Blocks:** Sprint 02

## 2. Primary outcome

Deliver a locally runnable web application that loads an approved historical OHLCV dataset, reveals candles sequentially, lets the user open one simulated long or short position, closes it and displays a reproducible basic P&L result.

## 3. User story

As a learner,  
I want to replay historical candles and make simple buy or sell decisions,  
so that I can practice the mechanics of a trade without risking real money.

## 4. Starting state

At sprint activation, the repository may be empty or contain only documentation. Codex must verify the actual state before scaffolding.

## 5. Included scope

- Monorepo foundation and documented local setup.
- Next.js web application.
- Python/FastAPI service.
- One small approved or generated historical OHLCV fixture.
- Asset/timeframe metadata for that fixture.
- Dataset validation at the API/data boundary.
- Candlestick chart.
- Initial visible candle window.
- Candle-by-candle playback.
- Play, pause, next candle and reset controls.
- Speed selection using a small fixed set of options.
- Actions: Buy, Sell, Hold and Close Position.
- Maximum one open position at a time.
- Long and short support.
- Fixed quantity of `1` unit for Sprint 01.
- Basic gross P&L calculation.
- Completed-session result summary.
- Automated tests for validation, state transitions and P&L.
- Documentation and runnable commands.

## 6. Excluded scope

- Strategy indicators, including RSI, EMA, Bollinger Bands or VWAP.
- Automated mean-reversion signals.
- AI explanations.
- Backtesting.
- Fees, spread, slippage and leverage beyond displaying that Sprint 01 assumes zero.
- Multiple simultaneous positions.
- Partial closes.
- Stop loss or take profit orders.
- User accounts or authentication.
- Database persistence.
- Live or delayed market feeds.
- Broker integrations.
- Real-money trading.
- Mobile native application.

## 7. Functional requirements

### FR-01 — Load simulation data

The user can open the simulator and load the included sample asset/timeframe. The UI shows the asset, timeframe and that the data is historical/simulated practice data.

### FR-02 — Validate dataset

The API validates required OHLCV fields, chronological order, duplicate timestamps, numeric values and candle consistency. Invalid data returns an actionable error.

### FR-03 — Initial chart state

The simulator displays an initial historical context window before playback starts. Future candles beyond the simulation cursor must not be rendered or available to client decision logic.

### FR-04 — Playback

The user can:

- start playback;
- pause playback;
- reveal exactly one next candle;
- choose from fixed playback speeds;
- reset the simulation.

Playback must stop cleanly at the final candle.

### FR-05 — Open long position

When no position is open, `Buy` opens a long position with quantity `1` at the current revealed candle's close price.

### FR-06 — Open short position

When no position is open, `Sell` opens a short position with quantity `1` at the current revealed candle's close price.

### FR-07 — Hold

`Hold` records or acknowledges that no trade action is taken for the current candle. It must not alter the position or P&L.

### FR-08 — Position restrictions

While a position is open:

- opening another position is disabled;
- the UI shows direction, entry price, quantity and current unrealized gross P&L;
- `Close Position` is enabled.

### FR-09 — Close position

Closing uses the current revealed candle's close price. It creates a completed trade and calculates gross P&L.

### FR-10 — Result

After the position closes, show at minimum:

- asset;
- timeframe;
- direction;
- entry time and price;
- exit time and price;
- quantity;
- gross P&L;
- return percentage with a clearly documented denominator;
- assumption that fees and slippage are zero;
- action to reset/start again.

### FR-11 — End of data

If data ends with an open position, the app must not silently invent a result. It must clearly require closing at the last revealed candle or offer an explicit close-at-last-candle action using the same execution rule.

### FR-12 — Errors

The application must show useful states for API failure, invalid data, empty data and unsupported action.

## 8. Technical requirements

### TR-01 — Domain separation

P&L and position-transition logic must live outside React components and API route handlers.

### TR-02 — Simulation cursor

The simulation state must have an explicit cursor/index. Only candles up to that cursor are exposed to the chart and action logic.

### TR-03 — State model

At minimum, support these states:

```text
idle
ready
playing
paused
position_open
completed
error
```

The implementation may model playback and position state separately if that produces clearer valid transitions.

### TR-04 — Execution convention

For Sprint 01 only:

- entry fills at the close of the current revealed candle;
- exit fills at the close of the current revealed candle;
- quantity is 1;
- fees are 0;
- slippage is 0;
- leverage is not supported.

These assumptions must be visible in the result and centralized in code.

### TR-05 — P&L formulas

```text
long_gross_pnl  = (exit_price - entry_price) * quantity
short_gross_pnl = (entry_price - exit_price) * quantity
```

For Sprint 01, return percentage should use the absolute entry notional:

```text
entry_notional = abs(entry_price * quantity)
return_percent = gross_pnl / entry_notional * 100
```

Handle zero or invalid entry notional defensively.

### TR-06 — API boundary

The API must expose a documented endpoint or equivalent boundary that returns validated candle data and metadata. It must not return candles outside the requested approved fixture.

### TR-07 — Reproducibility

Resetting and replaying the same fixture with the same actions must produce the same result.

### TR-08 — Tooling

The repository must document commands for development, lint, typecheck, tests and build. Prefer root-level commands for common checks.

## 9. Suggested domain types

```text
Candle
DatasetMetadata
SimulationSession
SimulationCursor
Position
Trade
PositionDirection
SimulationAssumptions
```

Names may vary only when the alternative is clearer and documented.

## 10. UX states

### Initial

Show project name, educational notice and start/load action.

### Ready

Show initial candles and enabled playback controls.

### Playing

Reveal candles at selected speed.

### Paused

Keep current state and allow next-candle or resume.

### Position open

Show current position details and unrealized gross P&L.

### Completed trade

Show result summary and reset action.

### Error

Show actionable message and a safe retry/reset path.

## 11. Acceptance criteria

- [x] The repository starts locally using documented commands.
- [x] Web and API applications have health/availability verification.
- [x] The included fixture loads and passes validation.
- [x] Invalid candle fixtures fail with actionable errors.
- [x] Only revealed candles appear in the simulator.
- [x] Play, pause, next and reset work without duplicate timers or skipped state.
- [x] Buy opens one long position at the current candle close.
- [x] Sell opens one short position at the current candle close.
- [x] A second position cannot open while one is active.
- [x] Hold does not modify position or P&L.
- [x] Close Position closes at the current candle close.
- [x] Long P&L is correct in profitable, losing and flat examples.
- [x] Short P&L is correct in profitable, losing and flat examples.
- [x] The result shows entry, exit, direction, quantity, P&L, return and zero-cost assumptions.
- [x] End-of-data behavior is explicit and deterministic.
- [x] Loading, error, empty and disabled states are visible.
- [x] Core flow works on desktop and a narrow mobile viewport.
- [x] Lint, typecheck, tests and production build pass.
- [x] Required documentation is updated.
- [x] No excluded functionality was implemented.

## 12. Automated test minimum

### Data validation

- valid fixture accepted;
- missing required field rejected;
- duplicate timestamp rejected;
- unsorted timestamp rejected;
- impossible OHLC candle rejected;
- invalid numeric value rejected.

### Trading calculations

- profitable long;
- losing long;
- flat long;
- profitable short;
- losing short;
- flat short;
- return percentage;
- invalid/zero notional handling.

### State transitions

- cannot close without position;
- cannot open second position;
- reset clears session state;
- next reveals one candle;
- final candle cannot advance beyond dataset;
- hold does not create a trade.

### UI/integration

At least one automated test should cover the critical user flow if practical in the selected tooling.

## 13. Manual verification

1. Start the API and web app from a clean local setup.
2. Load the included dataset.
3. Confirm only the initial window is visible.
4. Advance one candle and verify exactly one candle appears.
5. Start playback, pause and resume.
6. Open a long, advance candles and close it.
7. Verify the displayed result against a manual calculation.
8. Reset and repeat with a short.
9. Test an invalid dataset response or fixture.
10. Test the flow at a narrow mobile width.
11. Reach the final candle and verify deterministic end behavior.

## 14. Documentation updates

- [x] Update `docs/STATUS.md` with implemented state and limitations.
- [x] Update `docs/DECISIONS.md` with tooling and architecture decisions.
- [x] Add accurate root README setup and commands.
- [x] Document the sample dataset and its licensing/origin or generation method.
- [x] Mark this sprint checklist using evidence.

## 15. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Future candles leak into UI or client state | Invalid learning and future backtests | Cursor-based API/selector behavior and tests |
| P&L duplicated in UI | Inconsistent results | Central domain calculation module |
| Timer bugs reveal skipped/duplicate candles | Unreliable simulation | Single controlled timer and transition tests |
| Unclear fill convention | Misleading results | Central assumptions object and visible disclosure |
| Poor fixture provenance | Licensing or reproducibility problem | Generated fixture or documented redistributable source |
| Scope expansion | Sprint never stabilizes | Enforce exclusions and review changed files |

## 16. Sprint completion evidence

To be filled by Codex after implementation:

- Repository state before work: Nine foundational Markdown documents; no application scaffold, lockfile, or Git repository.
- Files created/modified: Root pnpm workspace and README; Next.js web app; FastAPI service; generated fixture; tests; project status, decisions, and sprint evidence.
- Decisions recorded: pnpm monorepo, Next.js App Router, FastAPI, generated BTC/USD fixture, centralized TypeScript simulator domain, explicit current-close execution, reviewed pnpm build-script allowlist, and local loopback CORS policy.
- Commands run: `pnpm.cmd install`, `python -m pip install -r services/api/requirements-dev.txt`, `pnpm.cmd install --frozen-lockfile --offline`, `pnpm.cmd format:check`, `pnpm.cmd lint`, `pnpm.cmd typecheck`, `pnpm.cmd test`, and `pnpm.cmd build`.
- Automated test results: 15 Vitest tests and 14 Pytest tests pass after final validation additions.
- Production build result: Next.js 16.2.12 production build passes with a statically generated home route.
- Manual verification results: API and web health confirmed; generated fixture loaded; initial 12/32 candles shown; next-candle, long, short, reset, speed, playback, P&L, and explicit 32/32 end state verified in-browser. Desktop and 390 × 844 mobile layouts verified with no console errors or horizontal overflow.
- Remaining limitations: Sprint 01 intentionally supports one generated fixture, one position, quantity 1, gross P&L, and zero costs only. Starlette emits a non-blocking test-client deprecation warning.
- Documentation updated: `README.md`, `docs/STATUS.md`, `docs/DECISIONS.md`, `services/api/data/README.md`, and this sprint specification.
- Review decision: Accepted by the product owner on 2026-08-02; Sprint 02 scope approved.
