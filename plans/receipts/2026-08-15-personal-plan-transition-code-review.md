# Personal Plan transition system — code-review receipt

Date: 2026-08-15
Scope: complete uncommitted task tree against `23626d7d5b6a4b8b2d7c85daa90033d518a8c18b`
Integrated publication base: `9a81a7b8d068db2af96e870fe8ab4617572f5609`; conflict-free rebase with overlapping Stage 3 integration inspected.
Reviewed content fingerprint: `e6cad815de366fe1976dc612691598b6080631e58a4641785cb59bf6969cfc53`; receipt files excluded.
Verdict: no blocking findings remain.

## Review lanes

The main session reviewed the complete diff, shared transition lifecycle, route/history ownership, stage handoffs, responsive fixed controls, accessibility behavior, tests, and durable artifacts. Two implementation-time Claude code-review passes and one final read-only integrated-head pass were run because this is a meaningful shared-state and cross-route change. The main session verified every finding against source and browser evidence.

## Accepted and resolved findings

- Stage 3 completion now uses a route-aware App Router replacement rather than a native history mutation or document replacement.
- Stage 3 receives opacity-only entrance motion so its fixed confirmation action is not captured by a transformed ancestor.
- Anwendung native history entries no longer copy Next.js private state; route-aware pathname reconciliation drives the selected view.
- Back and Forward restore a stored scroll position per semantic view with an immediate jump despite the global smooth-scroll rule.
- The incoming transition layer remains keyed stably, preventing mobile action-dock remounts; outgoing controls are inert, hidden from accessibility, and suppressed where portals would duplicate them.
- Stage 2 renders one cookie-clearance owner, maps the actual save/error state into the Journey header, and keeps the bridge visible through bootstrap.
- Strict Mode target-intent consumption is cached for the mounted destination, preventing a development-only lost entrance.
- Dead two-layer stage-variant code was removed; quiet stage changes use the documented one-sided target entrance.
- Direct Anwendung day routes were added to the lab so server addressability and reload are verified, not inferred.
- The Bedarfsplan action bar now renders once through a body portal and stays pinned to the viewport while the content layers transform.
- Malformed percent-encoded Anwendung day segments now fail closed to the existing unknown-segment behavior instead of throwing during render.

## Rejected or retained observations

- Retaining full `/anwendung` prefetch is an approved product tradeoff: the destination is authoritative and safe to read, while the residual read/telemetry cost is documented for monitoring.
- Delaying heading focus until the 360ms transition settles is the approved focus handoff; reduced motion remains immediate. The brief body-focus interval is retained as a known accessibility tradeoff.
- Day-level server telemetry now represents deep links/reloads rather than every local day open; the zero-RSC local navigation is the intended behavior.
- The claim that `stage2LoadState` could leave Basis in an error state was rejected after tracing the state machine: Optional exists only in the optional journey and Basis-only failure intentionally retains its recoverable error.
- A plan-navigation intent that is consumed when `/plan-start` resumes directly into Stage 2 or Stage 3 is harmless; entrance application remains destination- and successful-content-bound.

## Refresh after reviewer fixes

The final delta was re-inspected and verified with focused typecheck/browser tests, the 17-journey browser suite, all 1,596 Personal Plan tests, and `npm run ci:verify`. After the final conflict-free rebase and reviewer fixes, those exact-head browser, Personal Plan, and CI gates passed again. The final Claude pass independently ran the transition tests and 17 browser journeys; the main implementation-loop owns the readiness decision.
