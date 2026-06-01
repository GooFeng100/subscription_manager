# task-state-sync

## Purpose

Keep task continuity across threads by enforcing synchronized updates to `docs/TASK_STATE.md` after every meaningful engineering action.

## When To Use

Use this skill in every round that includes any of:

- feature development
- refactor
- API/interface testing
- Docker/container debugging
- deployment/debug command execution

## Mandatory Rule

After completing the round's work, you must update `docs/TASK_STATE.md`.
If `docs/TASK_STATE.md` is not updated, the round is not complete.

## Update Checklist For `docs/TASK_STATE.md`

Update all relevant sections with concrete, current information:

1. Date/time and round goal
2. Completed work and changed files
3. Commands executed
4. Test commands and results
5. Docker/container status
6. API/interface status
7. Current blockers/risks
8. Next-step tasks for the following thread

## Handoff Protocol

- New thread startup should read, in order:
  1. `AGENTS.md`
  2. `docs/TASK_STATE.md`
  3. task spec document referenced by `docs/TASK_STATE.md`
- Continue from the "Next Tasks" and "Open Issues" sections in `docs/TASK_STATE.md` without re-deriving history.

## Scope Safety

- Do not modify business code when the round scope is documentation-only.
- Do not run destructive commands unless explicitly approved.
