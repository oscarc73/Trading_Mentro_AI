# Definition of Done

A task or sprint is complete only when all applicable conditions are satisfied.

## Product completion

- The required user outcome works end to end.
- Every acceptance criterion has evidence.
- Included scope is complete.
- Excluded scope was not introduced.
- Errors and unsupported states are handled visibly.

## Technical completion

- Architecture follows repository rules.
- Trading-domain logic is not duplicated in UI code.
- Inputs are validated.
- Financial calculations are centralized and tested.
- No future-data leakage is introduced.
- No credentials or sensitive data are committed.
- New dependencies are justified and locked.

## Verification completion

- Formatting check passes.
- Lint passes.
- Typecheck passes.
- Unit tests pass.
- Relevant integration/end-to-end tests pass.
- Production build passes.
- Required manual flow is verified.
- Failures or skipped checks are documented and treated as blockers unless explicitly accepted.

## Documentation completion

- `docs/STATUS.md` reflects reality.
- The active sprint checklist is updated.
- Material decisions are recorded.
- Setup/run instructions are accurate.
- New environment variables or commands are documented.

## Review completion

- Codex has returned the required completion report.
- The project lead has reviewed scope, correctness and evidence.
- Blocking defects are closed.
- The product owner has accepted the sprint outcome.

## Not done when

The work is not complete if:

- it runs only on the implementer's machine without documented setup;
- tests were not run;
- the UI exists but the domain logic is fake or hardcoded;
- the engine works but no usable flow exposes it when the sprint requires one;
- a future sprint feature was partially added without tests;
- documentation describes intended behavior rather than implemented behavior;
- simulated results are presented without their assumptions.
