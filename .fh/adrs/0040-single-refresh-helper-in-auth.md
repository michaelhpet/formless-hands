---
id: ADR-040
status: proposed
date: 2026-10-10
task: LIN-142
work: 121
touches:
  - core/src/daemon/auth.rs
---

# ADR-040: Single refresh helper in auth.rs

## Context

Token refresh had two paths: the canonical refresh and an inline retry in
`auth.rs` that fired immediately on failure — the mechanism of the auth
refresh loop. Work #121 removed the inline retry so refresh goes through
one helper.

## Decision

One path for token refresh: `refresh_once()`, replacing `retry_inline()`.
Proposed; awaiting human sign-off.

## Consequences

Removes the loop at its source. Callers get uniform refresh semantics;
no behavior change beyond eliminating the immediate inline retry.
