# Engineering Rules

These rules apply to all code and technical documentation in Trading Mentor AI.

## 1. Scope discipline

- Implement only the active sprint and assigned task.
- Do not add “helpful” features without acceptance criteria.
- Do not create infrastructure for hypothetical scale before it is needed.
- Do not mix refactors with feature work unless necessary for correctness.
- A discovered issue outside scope must be documented, not silently expanded into the task.

## 2. Architecture

- Start with a modular monolith.
- Keep trading-domain logic independent of web frameworks and UI components.
- Separate data ingestion, simulation clock, execution, portfolio state, analytics and presentation.
- Use explicit interfaces at external boundaries.
- Avoid microservices, queues or distributed systems until evidence requires them.
- Record material architectural choices in `docs/DECISIONS.md`.

## 3. Market-data integrity

Every imported dataset must validate:

- required fields: timestamp, open, high, low, close and volume when available;
- timestamp format and timezone;
- ascending order;
- duplicate timestamps;
- invalid or missing numbers;
- `high >= max(open, close, low)`;
- `low <= min(open, close, high)`;
- non-negative volume when present;
- gaps or irregular intervals;
- asset and timeframe metadata.

Invalid data must produce an actionable error rather than silently changing results.

## 4. Simulation integrity

- The simulator may access only candles revealed at the current simulation time.
- Future candles cannot influence UI hints, indicators, fills, AI explanations or decisions.
- Randomness must be seedable when used.
- A session must preserve dataset identity, parameters and assumptions for reproducibility.
- “Hold” is an educational action and must not create a transaction.
- Only valid state transitions are allowed.

## 5. Orders, fills and positions

- Keep orders, fills, positions and trades as separate concepts once the engine reaches Sprint 02.
- Define whether an action fills at current close, next open or another rule. Never leave execution price implicit.
- Prevent impossible states such as closing without an open position or opening conflicting positions when the current mode allows only one.
- Position direction must be explicit: `long` or `short`.
- Quantity must be positive.
- All state changes must be auditable from session events.

## 6. Financial calculations

- Centralize P&L formulas.
- Cover long and short cases with tests.
- Distinguish gross P&L from net P&L.
- Treat fees, spread and slippage as explicit parameters.
- Avoid binary floating-point for persisted monetary values when precision is material.
- Define rounding at display boundaries; do not repeatedly round intermediate calculations.
- Never infer profitability from win rate alone.

Minimum reference formulas before costs:

```text
Long P&L  = (exit_price - entry_price) * quantity
Short P&L = (entry_price - exit_price) * quantity
Return %  = net_pnl / capital_at_risk * 100
```

The implementation must define `capital_at_risk` or use a differently named denominator that is mathematically accurate.

## 7. Backtesting rules

Applicable from Sprint 05:

- Prevent look-ahead bias.
- Prevent data leakage across training, validation or comparison periods when such splits are introduced.
- Define execution timing and price assumptions.
- Include costs in net results.
- Preserve parameter values and dataset versions.
- Report sample size and trade count.
- Avoid optimizing only for the best historical result.
- Label all results as hypothetical.

## 8. AI rules

Applicable from Sprint 08:

- AI explanations cannot calculate or overwrite authoritative P&L or analytics.
- The deterministic engine is the source of truth.
- AI must receive structured verified inputs.
- AI must not invent trades, prices, statistics or market events.
- The UI must distinguish system metrics from generated explanation.
- AI cannot autonomously execute orders.

## 9. Security and privacy

- Never commit secrets.
- Use environment variables with documented examples.
- Validate all external input.
- Limit uploaded file size and accepted formats.
- Apply safe file handling and avoid arbitrary path access.
- Add authentication only when required by an activated sprint.
- Do not collect unnecessary personal or financial data.
- Define retention and deletion before storing user-sensitive data.

## 10. Frontend quality

- Responsive behavior is required for supported screens.
- Core actions must be keyboard accessible.
- Do not communicate profit/loss using color alone.
- Show loading, empty, error and disabled states.
- Clearly label historical, simulated, delayed and live data.
- Avoid dark patterns and urgency language.
- The interface must make assumptions and risk visible.

## 11. Backend quality

- Validate request and response schemas.
- Use stable domain errors and appropriate status codes.
- Keep business rules out of route handlers.
- Log operational errors without leaking secrets or private data.
- Ensure deterministic endpoints are idempotent where appropriate.

## 12. Testing

Required categories as applicable:

- Unit tests for formulas and state transitions.
- Data-validation tests.
- API contract tests.
- Integration tests for critical flows.
- End-to-end tests for the primary user journey when the UI stabilizes.
- Regression test for every fixed bug with financial or state impact.

Tests must cover failures, not only happy paths.

## 13. Dependencies

- Add a dependency only when it clearly reduces risk or complexity.
- Prefer maintained, documented libraries with suitable licenses.
- Do not duplicate an existing repository capability.
- Record major dependency choices or replacements.
- Keep lockfiles committed.

## 14. Git and review

Recommended branch format:

```text
feat/s01-simulator-mvp
fix/simulator-pnl-short
chore/repo-tooling
```

Recommended commit format:

```text
feat(simulator): add candle replay controls
fix(engine): correct short position pnl
```

A pull request or completion report must explain behavior, verification and limitations—not only list files.

## 15. Documentation language

- User-facing product and project explanations: Spanish by default.
- Code identifiers, schemas, commits and technical API naming: English.
- Avoid duplicated sources of truth.
- Update documentation in the same change as behavior.
