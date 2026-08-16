# Sprint 04 Acceptance and Sprint 05 Planning

## Outcome

Recorded the product owner's explicit acceptance of Sprint 04 with documented follow-up and prepared a detailed Sprint 05 Backtesting Engine scope proposal for review. No Sprint 05 code was implemented or authorized by this action.

## Scope completed

- Marked Sprint 04 accepted on 2026-08-16 without rewriting the unchecked visual-verification evidence.
- Preserved the missing browser/mobile pass and standalone startup warning as explicit follow-ups.
- Advanced project documentation to Sprint 05 planning.
- Created a complete Sprint 05 draft covering causal rules, next-open fills, final liquidation, costs, dataset fingerprinting, immutable records, UI states, tests, manual verification, risks, and exclusions.
- Preserved the activation gate: implementation requires separate product-owner scope approval and an explicit implementation task.

## Files or areas affected

- `docs/PROJECT_MASTER.md`
- `docs/STATUS.md`
- `docs/sprints/SPRINT_04.md`
- `docs/sprints/SPRINT_05.md`
- This action summary

## Decisions and assumptions

- Sprint 04 is accepted with follow-up rather than falsely marking the unverified desktop/keyboard/390px criterion as passed.
- The proposed backtest evaluates a fixed `mean_reversion_threshold_v1` rule set using close-time signals and next-candle-open fills.
- Proposed entries are symmetric long/short at below/above-reference states; exits occur when price returns to or crosses the reference region.
- A final open position is explicitly liquidated at the last close and labeled `end_of_data`.
- Quantity is fixed per trade; fees and adverse slippage are explicit; there is no cash account, compounding, leverage, optimization, or performance analytics.
- Saved records bind to a stable dataset fingerprint and engine/config versions.
- Reconciliation totals are required engine evidence; interpretive performance and risk metrics remain Sprint 06.
- The standalone startup correction is separate maintenance work and is not silently included in Sprint 05.

## Commands and verification results

- Read the mandatory project, roadmap, status, engineering, workflow, Sprint 04, decision, template, and summary instructions.
- Inspected the current mean-reversion, execution, session, API, and persistence boundaries.
- Confirmed the approved fixture contains 32 candles and the repository has no existing backtest engine or API.
- Confirmed the Git worktree was clean on `main` before documentation changes.
- Documentation-only planning action; application checks were not required.

## Manual verification

- Confirmed the product owner explicitly accepted Sprint 04 and authorized moving to Sprint 05 planning.
- Reviewed the proposal against the Sprint 05 roadmap outcome and Sprint 06/09 scope boundaries.

## Limitations or follow-up work

- Product-owner approval of `docs/sprints/SPRINT_05.md` is required before implementation.
- The exact contracts remain proposed until approval and implementation evidence.
- The Sprint 04 browser/mobile evidence gap remains historically documented.
- The standalone-output startup warning should be handled in a separate approved maintenance branch if it blocks future verification.

## Documentation updated

- Project master and status now identify Sprint 05 planning.
- Sprint 04 records acceptance with follow-up.
- Sprint 05 has a reviewable draft specification.
- This immutable summary records the acceptance and planning action.
