# CODEX HANDOFF

## Context Switch

- Part of this project was previously developed on a local machine.
- Development and debugging have now switched to NAS remote environment.
- The NAS directory `/vol1/1000/docker/subscription_manager` is the only source of truth.
- Containers run on NAS.

## Current Operating Responsibility

From this handoff onward, the coding agent must handle all of the following in each task cycle:

- code modifications
- container rebuild/restart as required
- runtime and container log inspection
- API verification using `curl`

## Mandatory End-of-Round Output

At the end of every task round, output all of:

- modified file list
- commands executed
- test results
- remaining issues
