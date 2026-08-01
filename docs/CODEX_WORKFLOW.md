# Codex Workflow

This document defines how work is prepared, assigned, implemented and reviewed.

## 1. Work lifecycle

```text
Project context
  → Active sprint
  → Scoped task
  → Repository inspection
  → Implementation plan
  → Code and tests
  → Verification
  → Documentation update
  → Review
  → Acceptance or correction
```

## 2. Before assigning work to Codex

The project lead prepares a task containing:

1. **Context:** verified repository and sprint state.
2. **Objective:** one primary outcome.
3. **Included scope:** exact behavior to implement.
4. **Excluded scope:** tempting but unauthorized work.
5. **Acceptance criteria:** observable pass/fail conditions.
6. **Technical constraints:** architecture, interfaces and rules.
7. **Tests:** expected automated and manual verification.
8. **Documentation:** files that must be updated.
9. **Report format:** evidence Codex must return.

Do not send broad prompts such as “build the app” after the repository exists.

## 3. Codex start protocol

Codex must:

1. Read the mandatory project files.
2. Inspect the repository structure, scripts, lockfiles and current changes.
3. Identify the active sprint and task.
4. Report contradictions, missing prerequisites or existing partial implementations.
5. Present a concise plan tied to acceptance criteria.
6. Begin implementation without expanding scope.

## 4. Implementation protocol

During implementation, Codex must:

- preserve unrelated user changes;
- avoid destructive commands unless explicitly authorized;
- implement domain logic before wiring UI where practical;
- add tests alongside behavior;
- use fixtures that are small, legal to store and reproducible;
- keep error messages actionable;
- update documentation after the implementation reflects reality;
- stop when the requested task is complete.

## 5. Verification protocol

Codex must run the repository's documented commands. The initial target command set should eventually support equivalents of:

```bash
pnpm install
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Python checks should be exposed through documented commands or a unified task runner. Exact commands must follow the repository once configured.

Manual verification must cover the acceptance criteria that automated tests cannot prove, including the primary UI flow.

## 6. Completion report

Codex returns:

### Summary
What outcome was delivered.

### Files changed
Grouped by application, service, package and documentation.

### Decisions
Only material decisions and assumptions.

### Verification
Each command and result. Never write “tests pass” without naming what ran.

### Manual checks
Exact user flow exercised.

### Limitations and risks
Known gaps, unsupported cases or deferred items.

### Documentation
Files updated and current sprint checklist status.

## 7. Review by ChatGPT/project lead

The reviewer checks:

- scope compliance;
- acceptance criteria;
- trading and P&L correctness;
- absence of future-data leakage;
- data validation;
- architecture boundaries;
- error handling;
- tests and build evidence;
- documentation accuracy;
- regressions and security concerns.

The outcome is one of:

- **Accepted** — sprint/task meets Definition of Done.
- **Accepted with follow-up** — non-blocking issue documented for later.
- **Changes required** — specific defects or missing evidence must be corrected.

## 8. Documentation updates after every accepted sprint

- Mark the sprint checklist accurately.
- Set the new state in `docs/STATUS.md`.
- Add material decisions to `docs/DECISIONS.md`.
- Add a dated, immutable action summary under `docs/summaries/`.
- Record unresolved non-blockers.
- Create the next sprint specification only after approval.

## 9. Prohibited workflow patterns

- Starting several future sprints in parallel without approval.
- Reporting completion based only on generated code.
- Skipping tests because the change “looks simple.”
- Changing the stack without a decision record.
- Solving a bug by disabling validation or tests.
- Using AI-generated explanations as proof of financial correctness.
- Adding live trading because an API is easy to connect.
