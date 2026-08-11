# Trading Mentor AI — Project Master

**Status:** Foundational specification  
**Roadmap:** 10 initial sprints  
**Current sprint:** Sprint 04 implementation review
**Primary owner:** Oscar  

## 1. Product vision

Create an educational and research platform where users can practice trading, understand the reasoning behind decisions, validate strategy hypotheses with data, and develop disciplined risk management without initially placing real-money trades.

## 2. Product promise

Trading Mentor AI helps users answer four questions:

1. What happened in the market?
2. What rule or hypothesis am I testing?
3. What would have happened under explicit execution and risk assumptions?
4. What can I learn from the result?

It must not promise profitability, certainty, or risk-free trading.

## 3. Initial target user

The first user is a beginner or intermediate learner who wants to:

- Practice buying, selling, waiting, and closing positions.
- Replay historical market data candle by candle.
- Learn concepts such as mean reversion without receiving blind instructions.
- Review performance and mistakes.
- Compare a hypothesis against historical evidence.

Professional or institutional features are not part of the initial version.

## 4. Product objectives

### Primary objectives

- Deliver a reliable historical trading simulator.
- Build a deterministic and testable trading engine.
- Add strategy research and backtesting without look-ahead bias.
- Explain assumptions, risk and uncertainty clearly.
- Progress to paper trading only after the historical engine is stable.

### Secondary objectives

- Make the architecture extensible to more strategies and asset classes.
- Build a journal and educational AI mentor after deterministic calculations are trustworthy.
- Prepare a beta that other users can test safely.

## 5. Non-objectives for the initial roadmap

The first 10 sprints will not include:

- Real-money order execution.
- Custody of funds or assets.
- Guaranteed returns or personalized investment advice.
- High-frequency or latency-sensitive trading.
- Copy trading or social trading.
- Strategy marketplace.
- Complex portfolio accounting.
- Tax reporting.
- Mobile native applications.

These may only be evaluated after the beta and through a separate roadmap.

## 6. Core product modules

1. **Historical Simulator** — replays candles and captures user decisions.
2. **Trading Engine** — handles positions, fills, P&L and session state.
3. **Strategy Engine** — defines transparent rule-based strategies.
4. **Backtesting Engine** — evaluates strategies on historical datasets.
5. **Analytics** — presents performance, risk and behavior metrics.
6. **Trading Journal** — records sessions, decisions and reflections.
7. **AI Mentor** — explains results without changing deterministic calculations.
8. **Paper Trading** — observes live or delayed data without real capital.
9. **Risk Controls** — applies sizing, limits and explicit assumptions.
10. **Administration and Observability** — supports reliable beta operation.

## 7. Initial architecture direction

The intended architecture is a monorepo with clear boundaries:

```text
apps/
  web/                 # Next.js application
services/
  api/                 # FastAPI service
packages/
  domain/              # Shared domain contracts where practical
  ui/                  # Reusable UI components
  config/              # Shared configuration
  test-data/           # Small licensed or generated fixtures

docs/
  sprints/
```

The exact scaffold is implemented during Sprint 01 and recorded in `docs/DECISIONS.md`.

### Architectural principles

- Deterministic engine before AI.
- Domain logic separated from presentation.
- Historical simulation before live data.
- Explicit assumptions before performance claims.
- Modular monolith before distributed services.
- Small, testable increments before scale optimization.

## 8. Planned delivery stages

### Stage 1 — Functional foundation

**Sprints 01–03**

Deliver a complete historical simulator, trustworthy position/P&L logic, usable sessions and persistent results.

### Stage 2 — Strategy research

**Sprints 04–06**

Introduce the first mean-reversion strategy model, backtesting and transparent performance analytics.

### Stage 3 — Guided practice

**Sprints 07–08**

Add risk controls, paper trading, journal capabilities and an AI mentor that explains verified data.

### Stage 4 — Product beta

**Sprints 09–10**

Generalize the strategy architecture, harden security and reliability, deploy and prepare controlled beta testing.

## 9. Number of sprints

The approved initial roadmap contains **10 sprints**.

This number is a planning baseline, not permission to start all work at once. Only the active sprint may be implemented. A sprint may be split or reordered only when:

- new evidence makes the current plan unsafe or inefficient;
- the change is documented in `docs/DECISIONS.md`;
- `docs/ROADMAP.md` and `docs/STATUS.md` are updated;
- the product owner approves the change.

## 10. Sprint operating model

Every sprint must have:

- one primary outcome;
- user-visible or technically verifiable value;
- explicit inclusions and exclusions;
- acceptance criteria;
- automated and manual verification;
- documentation updates;
- a review before the next sprint.

Sprints are outcome-based. They do not finish merely because a time period ended.

## 11. Roles

### Product owner

- Defines priorities and approves scope.
- Accepts or rejects sprint outcomes.
- Decides commercial direction.

### ChatGPT project lead

- Maintains product and architecture coherence.
- Converts objectives into Codex-ready tasks.
- Reviews implementation reports and diffs.
- Protects scope and quality.

### Codex implementation agent

- Inspects the repository.
- Implements assigned scope.
- Runs tests and builds.
- Updates required documentation.
- Reports evidence and limitations.

### Future specialist agents

Specialized agents may later cover QA, data engineering, security, UX and quantitative validation. They must follow `AGENTS.md` and cannot override the sprint scope.

## 12. Product principles

- **Education over prediction.** Explain uncertainty and reasoning.
- **Evidence over confidence.** Metrics must support claims.
- **Safety over speed.** Avoid premature live trading.
- **Clarity over feature count.** Prefer simple workflows users understand.
- **Determinism before intelligence.** AI cannot be the source of financial calculations.
- **Traceability.** Important assumptions and decisions must be documented.
- **Reproducibility.** Simulations and backtests must be repeatable with the same inputs.

## 13. Success criteria for the initial roadmap

The 10-sprint roadmap is successful when a beta user can:

1. Load an approved historical dataset.
2. Replay candles without future-data leakage.
3. Open and close long or short simulated positions.
4. See reproducible P&L with explicit cost assumptions.
5. Test a mean-reversion strategy through backtesting.
6. Review transparent performance and risk metrics.
7. Practice through paper trading without real capital.
8. Receive educational explanations grounded in system data.
9. Save and review a trading journal.
10. Use a deployed beta with acceptable reliability and safety notices.

## 14. Change control

Material changes require an entry in `docs/DECISIONS.md`, including:

- date;
- decision;
- context;
- alternatives;
- consequences;
- affected files or sprints.

No roadmap or architecture change should exist only inside a chat message.
