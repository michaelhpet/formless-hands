---
id: ADR-041
status: accepted
date: 2026-10-10
task: LIN-142
work: 128
touches:
  - core/src/poller.rs
  - core/src/db.rs
---

# ADR-041: Backoff state lives in task metadata

## Context

After 401s from the token endpoint, the daemon retried refreshes in a
tight loop and the worker exited before writing any backoff state. The
first fix kept the delay in memory, so it restarted at 0 on every repoll
and worker restart — proven by `backoff_resets_across_polls` failing on
work #128, attempt 1.

## Decision

Persist the backoff delay in task metadata (`backoff_until`,
`backoff_count` on `tasks`), additive with defaults so existing rows
migrate untouched. The next run resumes the delay instead of starting
cold. A status index serves the triage queue's filter.

## Consequences

Backoff survives repolls and worker restarts; no more than 1 refresh per
minute per source. Existing sessions are untouched by the fix.
