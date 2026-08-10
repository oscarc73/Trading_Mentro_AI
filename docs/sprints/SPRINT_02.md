# Sprint 02 — Reliable Trading Engine

## 1. Status

- **State:** Accepted by the product owner on 2026-08-03
- **Stage:** Stage 1 — Functional foundation
- **Primary owner:** Oscar
- **Implementation:** Codex
- **Depends on:** Sprint 01 — accepted by the product owner on 2026-08-02
- **Blocks:** None; Sprint 03 was activated on 2026-08-03

## 2. Primary outcome

Deliver a deterministic, decimal-safe domain engine that models orders, execution fills, positions, configurable costs, and reproducible gross and net P&L under explicit assumptions.

## 3. User story

As a trading learner, I want to choose a position quantity and realistic execution costs so that the simulator explains exactly how an order became a fill and how the final net result was calculated.

## 4. Starting state

Sprint 01 provides a verified Next.js/FastAPI historical simulator with current-candle-close entry and exit, fixed quantity `1`, zero fees, zero slippage, one position, gross P&L, and no persistence. Financial logic is framework-independent but does not yet separate orders from fills or calculate net P&L.

## 5. Included scope

- Decimal-safe trading calculations and decimal-string domain boundaries.
- Separate `Order`, `ExecutionFill`, `Position`, and `Trade` concepts.
- Deterministic sequential identifiers and auditable engine events.
- User-configurable positive fractional quantity.
- User-configurable fee basis points applied to each fill.
- User-configurable adverse slippage basis points applied to each fill.
- Explicit zero spread and no-leverage assumptions.
- Gross P&L from actual execution prices.
- Total fees, slippage impact, net P&L, and net return.
- Typed invalid-action errors that do not crash the UI or mutate financial state.
- Locked assumptions after a position opens.
- Expanded domain, reducer, and UI integration tests.

## 6. Excluded scope

- Multiple simultaneous positions or multiple completed trades per session.
- Partial fills, partial closes, or position averaging.
- Pending, limit, stop, stop-loss, or take-profit orders.
- Account balances, margin, leverage, liquidation, or risk-per-trade sizing.
- Non-zero spread modelling.
- Persistence, session history, or authentication.
- Strategies, indicators, backtesting, analytics, or AI explanations.
- Live data, broker integration, or real-money execution.

## 7. Functional requirements

### FR-01 — Configure execution

Before opening a position, the user can set quantity, fee basis points per fill, and slippage basis points per fill. Defaults remain quantity `1`, fees `0`, and slippage `0`.

### FR-02 — Validate settings

Quantity must be a positive finite decimal. Fee and slippage rates must be finite and non-negative. Slippage must remain below 10,000 basis points so sell fills remain positive. Invalid settings show an actionable message and disable opening actions.

### FR-03 — Lock assumptions

The normalized execution assumptions are captured when the position opens and cannot change until the session resets.

### FR-04 — Create orders and fills

Opening and closing create separate deterministic market orders and execution fills. Each fill references its order, revealed candle index, timestamp, reference price, execution price, quantity, fee, and slippage impact.

### FR-05 — Position state

The open position references its entry order and fill and displays direction, quantity, execution entry, and projected net P&L under the locked assumptions.

### FR-06 — Completed trade

Closing creates a completed trade linked to both orders and fills and displays reference and execution prices, gross P&L, total fees, slippage impact, net P&L, and net return.

### FR-07 — Invalid-state prevention

The engine rejects closing without a position, opening a second position, acting after completion, invalid settings, and invalid prices without creating an impossible financial state.

### FR-08 — Auditability and determinism

Accepted trading actions, holds, and rejected actions produce ordered deterministic events. Replaying the same dataset, settings, and actions produces identical state and results.

## 8. Technical requirements

### TR-01 — Domain separation

All order, fill, cost, P&L, validation, and transition rules remain outside React components and API routes.

### TR-02 — Decimal safety

Use `decimal.js` for quantities, prices, costs, and P&L. Domain values cross module boundaries as decimal strings. Conversion to JavaScript numbers occurs only at chart and display boundaries.

### TR-03 — Synchronous market execution

Only immediate market execution is supported. The revealed candle close is the authoritative reference price.

### TR-04 — Slippage

For `slippage_rate = slippage_bps / 10,000`:

```text
buy_execution_price  = reference_price * (1 + slippage_rate)
sell_execution_price = reference_price * (1 - slippage_rate)
slippage_cost        = abs(execution_price - reference_price) * quantity
```

### TR-05 — Fees

For each fill:

```text
fill_fee = abs(execution_price * quantity) * fee_bps / 10,000
total_fees = entry_fee + exit_fee
```

### TR-06 — P&L and return

```text
long_gross_pnl  = (exit_execution_price - entry_execution_price) * quantity
short_gross_pnl = (entry_execution_price - exit_execution_price) * quantity
net_pnl         = gross_pnl - total_fees
entry_notional  = abs(entry_execution_price * quantity)
net_return_pct  = net_pnl / entry_notional * 100
```

Slippage is embedded in execution prices and must not be deducted again from gross P&L. The UI shows slippage impact separately for transparency.

### TR-07 — Rounding

Do not round intermediate calculations. Format currency to two decimal places and return percentage to three decimal places only at presentation boundaries.

### TR-08 — Existing integrity

Preserve the simulation cursor, hidden-future-candle rule, current dataset boundary, playback behavior, one-position limit, and explicit end-of-data behavior.

## 9. Domain contracts and assumptions

- `Order`: intent, side, direction, quantity, submission time, candle index, and status.
- `ExecutionFill`: order reference, side, quantity, reference price, execution price, fee, slippage impact, time, and candle index.
- `Position`: direction, quantity, entry order/fill references, entry prices, entry costs, and time.
- `Trade`: both order/fill references, both prices and times, quantity, gross P&L, costs, net P&L, and net return.
- `ExecutionAssumptions`: quantity, fee bps, slippage bps, current-close fill rule, spread `0`, and leverage `false`.
- IDs are deterministic session sequences such as `order-1`, `fill-1`, and `event-1`.
- One session still contains at most one completed trade.

## 10. UX states

- Valid editable settings before entry.
- Visible validation error and disabled Buy/Sell for invalid settings.
- Locked settings while a position is open.
- Projected net P&L for an open position.
- Completed result with fill-level traceability and explicit costs.
- Existing loading, API error, playback, end-of-data, and reset states.

## 11. Acceptance criteria

- [x] Fractional quantity is accepted and calculated exactly.
- [x] Zero or invalid quantity is rejected visibly.
- [x] Fee and slippage settings are validated and captured at entry.
- [x] Long entry/exit create buy/sell orders and adverse fills.
- [x] Short entry/exit create sell/buy orders and adverse fills.
- [x] Entry and exit fees are calculated from their execution notionals.
- [x] Gross P&L, total fees, slippage impact, net P&L, and net return are correct.
- [x] Zero-cost settings reproduce Sprint 01 results.
- [x] Orders, fills, trades, and events have deterministic links and identifiers.
- [x] Invalid transitions produce typed errors and preserve valid state.
- [x] Assumptions cannot change during an open trade.
- [x] Future candles remain unavailable to the chart and decision flow.
- [x] The configured critical flow works in the UI on desktop and narrow mobile layouts.
- [x] Format, lint, typecheck, tests, and production build pass.
- [x] Required documentation reflects the implementation.
- [x] No excluded functionality was introduced.

## 12. Automated test minimum

### Financial engine

- Profitable, losing, and flat long and short formulas.
- Fractional decimal precision without binary floating-point drift.
- Buy-side and sell-side adverse slippage.
- Per-fill fees, total fees, slippage impact, gross P&L, net P&L, and return.
- Zero-cost Sprint 01 regression.
- Invalid quantity, price, fee rate, and slippage rate.

### State and audit

- Cannot close without a position or open a second position.
- Invalid commands do not mutate valid financial state.
- Hold creates no order or fill.
- Deterministic order, fill, and event identifiers.
- Same inputs and actions produce identical final state.
- Reset clears the session engine.

### UI integration

- Configure quantity and costs, open, advance, close, and inspect net result.
- Invalid settings show an error and disable opening actions.

## 13. Manual verification

1. Start API and web applications using the documented commands.
2. Verify the default zero-cost flow still matches Sprint 01.
3. Configure fractional quantity, fees, and slippage; open and close a long.
4. Independently verify the fill prices, fees, gross P&L, net P&L, and return.
5. Reset and repeat with a short.
6. Confirm settings lock after entry and unlock after reset.
7. Enter invalid quantity and rates and verify actionable errors and disabled actions.
8. Confirm order/fill references and audit event count in the result.
9. Verify future candles remain hidden and final-candle behavior remains explicit.
10. Verify desktop and narrow mobile layouts, keyboard access, and console errors.

## 14. Documentation updates

- [x] Add the missing reusable sprint template.
- [x] Update `docs/STATUS.md` and Sprint 01 acceptance.
- [x] Record the decimal execution model in `docs/DECISIONS.md`.
- [x] Update the root README assumptions and limitations.
- [x] Add the Sprint 02 immutable action summary.

## 15. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Binary floating-point drift | Incorrect financial results | Decimal library and exact-value regression tests |
| Slippage deducted twice | Understated P&L | Fill-price formulas, explicit net formula, and cost tests |
| UI validation bypass | Impossible state | Domain validation and reducer-level typed rejection |
| Assumptions change mid-trade | Non-reproducible result | Capture normalized assumptions at entry and lock controls |
| Order/fill concepts become speculative | Excess scope | Synchronous market orders only; no pending or partial lifecycle |

## 16. Sprint completion evidence

- **Starting point:** Sprint 01 accepted; implementation performed on the `sprint02` branch.
- **Implemented areas:** Decimal execution engine, typed simulation reducer, configurable simulator UI, tests, app icon fallback, and sprint documentation.
- **Key model:** Synchronous current-close market execution, adverse slippage per side, per-fill fees, zero spread, no leverage, one completed trade per reset, and deterministic sequence identifiers.
- **Automated verification:** Offline frozen install, formatting, lint, typecheck, 28 Vitest tests, 14 Pytest tests, and the Next.js production build pass.
- **Manual verification:** Default and configured long/short flows, invalid settings, locked assumptions, order/fill traceability, hidden future candles, end-of-data behavior, desktop layout, true 390px mobile layout, API health, and browser console/network state pass.
- **Known non-blocker:** The current FastAPI dependency set emits one Starlette test-client deprecation warning.
- **Review:** Implementation is complete and awaits product-owner acceptance.
