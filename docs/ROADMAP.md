# Trading Mentor AI — Roadmap

## Roadmap policy

This roadmap defines **10 initial sprints**. Only the active sprint is authorized for implementation. Future sprint details are directional until activated.

## Stage 1 — Functional foundation

### Sprint 01 — Minimum Functional Trading Simulator

**Outcome:** A runnable web simulator that loads historical candles, replays them sequentially, allows one simulated long or short position, closes it, and displays P&L.

**Key scope:** repository foundation, historical sample data, candle chart, playback controls, buy/sell/hold/close actions, basic results, core tests.

### Sprint 02 — Reliable Trading Engine

**Outcome:** A deterministic domain engine for orders, fills, positions and P&L with explicit assumptions.

**Key scope:** centralized execution model, long/short formulas, quantity and position sizing, configurable fees/slippage, invalid-state prevention, expanded tests.

### Sprint 03 — Sessions, Persistence and Usability

**Outcome:** Users can create, complete, save and review simulator sessions reliably.

**Key scope:** session persistence, recent sessions, richer results, restart/resume rules, accessibility and responsive UX, error states.

## Stage 2 — Strategy research

### Sprint 04 — Mean-Reversion Strategy Model

**Outcome:** The platform can calculate and display an initial transparent mean-reversion hypothesis without executing trades automatically.

**Key scope:** moving average reference, distance/deviation measures, optional Bollinger/RSI context, strategy configuration, educational explanations, indicator tests.

### Sprint 05 — Backtesting Engine

**Outcome:** The mean-reversion rules can be evaluated reproducibly against historical data.

**Key scope:** event loop, entry/exit rules, costs, no look-ahead controls, parameter configuration, repeatable runs, backtest records.

### Sprint 06 — Performance and Risk Analytics

**Outcome:** Users can understand what a backtest result means and its limitations.

**Key scope:** net return, win rate, loss rate, expectancy, drawdown, profit factor, trade distribution, benchmark comparison where appropriate, assumptions panel.

## Stage 3 — Guided practice

### Sprint 07 — Risk Controls and Paper Trading Foundation

**Outcome:** Users can practice on current or delayed market data without real capital and under explicit risk limits.

**Key scope:** market-data adapter boundary, paper account, position limits, risk-per-trade settings, connection status, delayed/live labeling, safe fallbacks.

### Sprint 08 — Trading Journal and AI Mentor

**Outcome:** Users can record decisions and receive educational explanations grounded in verified session data.

**Key scope:** journal entries, decision notes, post-session review, AI explanation layer, citations to internal metrics, refusal to invent market facts, no autonomous execution.

## Stage 4 — Product beta

### Sprint 09 — Multi-Strategy Architecture and Comparative Lab

**Outcome:** Additional rule-based strategies can be added without rewriting the simulation and backtesting engines.

**Key scope:** strategy interface, parameter schemas, strategy registry, comparison views, baseline strategy example, compatibility tests.

### Sprint 10 — Hardening, Deployment and Controlled Beta

**Outcome:** A secure, observable and deployable beta is ready for limited external testing.

**Key scope:** production configuration, authentication only if required for beta, security review, rate limits, monitoring, backups, CI/CD, performance checks, onboarding and legal/safety notices.

## Post-roadmap candidates

These items are not approved for implementation during Sprints 01–10:

- Broker integrations.
- Real-money execution.
- Mobile native application.
- Marketplace of strategies.
- Social/copy trading.
- Advanced portfolio management.
- Institutional data feeds.

A separate discovery and risk review is required before any real-money capability.

## Sprint activation rule

Before activating a sprint:

1. The previous sprint must satisfy its Definition of Done.
2. `docs/STATUS.md` must show no unresolved release blocker.
3. The sprint specification must be expanded using `docs/SPRINT_TEMPLATE.md`.
4. The product owner must approve the scope.
5. Codex receives one explicit task package for that sprint.
