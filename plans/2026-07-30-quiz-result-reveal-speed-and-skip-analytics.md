# Quiz result reveal speed and Skip analytics

## Outcome and source context

Make the three-message personal-plan result reveal 15% faster while preserving its
copy, order, animation, and always-available `Überspringen` control. Replace the
current inferred Skip measurement with an exhaustive completion-trigger contract,
then add a guarded live insight to PostHog dashboard `859068` so the team can monitor
Skip usage without mixing exact and legacy-inferred data.

Source context:

- Nick's 2026-07-30 direction: keep the transitions and Skip control, make the
  overall wait 10–20% faster, and add the measurement to PostHog.
- Live PostHog audit at 2026-07-30 20:17 UTC: 165 production reveal runs from
  159 distinct IDs; 22 runs were definite pre-step-3 skips and another 18 were
  timing-based probable skips.
- Current production implementation: three messages at 2,400 ms each, 7,200 ms
  total, with one shared completion event for timer and button paths.

Planning contract:

- **Outcome:** 2,040 ms per message and 6,120 ms total; exact Skip-vs-timer
  completion properties; one new live PostHog insight.
- **Constraints:** keep all three German messages, their order, the 600-ms
  animation, the button position/copy, reduced-motion behavior, result destination,
  exactly-once completion semantics, and PostHog-only routing.
- **Non-goals:** no new copy, visual redesign, removal of the Skip control, result
  page changes, offer-page redesign, experiment framework, new database tables,
  Customer.io/Meta events, or code publication/deployment.
- **Done when:** the plan and mockup are approved; timing/event tests pass; the
  rendered journey passes browser checks; the declarative dashboard query and
  guarded mutation tests pass; live PostHog contains exactly one verified O7 tile;
  `ready-check` and `request-code-review` pass before review-ready handoff.

## Chosen direction

Use the midpoint of Nick's range: **15% faster**.

- Message interval: `2_400 ms` → `2_040 ms`
- Total scheduled reveal: `7_200 ms` → `6_120 ms`
- Animation: remains `600 ms`
- Messages and Skip control: unchanged

Extend the existing exhaustive
`personal_plan_result_reveal_completed` event rather than add a second button-only
event. Every completed reveal will carry:

- `completion_trigger`: `skip_button` or `timer`
- `elapsed_ms`: monotonic client elapsed time since the first visible reveal step
- `visible_step`: 1–3 at completion
- `step_count`: existing total message count
- `scheduled_duration_ms`: configured automatic reveal duration
- `lead_id`: existing stable per-result join

The exactly-once completion claim remains ahead of tracking and navigation, so a
timer/button race produces one completion event and one route replacement.

Add one chart-led PostHog tile to the existing personal-plan offer dashboard:

**`O7 · Ergebnis-Reveal — Überspringen (7 Tage)`**

The query groups one row per `lead_id`, filters to `chaarlie.de`, and classifies:

1. `Explizit übersprungen` — new events with `completion_trigger=skip_button`
2. `Automatisch weiter` — new events with `completion_trigger=timer`
3. `Historischer Mindestwert Skip` — legacy events without a trigger whose
   maximum viewed step is below 3
4. `Historisch nicht unterscheidbar` — remaining legacy completions

This makes the tile useful immediately without presenting the pre-deployment
24.2% timing estimate as exact. The tile description states that the exact Skip
rate uses only new trigger-bearing completions; legacy rows remain visibly
separate until they leave the seven-day window. It also states that O7 covers
**all production result reveals on `chaarlie.de`**, not the narrower
`meta_personal_plan_v1` offer cohort used by O1–O6.

## Scope and non-goals

### In scope

- Deterministic reveal timing constant and tests
- Completion-trigger and timing properties in the typed analytics contract
- PostHog property mapping and destination tests
- Result-reveal component wiring for button and timer triggers
- Declarative O7 insight definition
- A new narrow dry-run-first PostHog mutation script that creates or attaches the
  exact O7 insight once, verifies it, and refuses ambiguous title matches
- Live apply to PostHog dashboard `859068`, explicitly authorized in this task
- Browser verification at representative desktop and mobile widths

### Out of scope

- Removing or hiding `Überspringen`
- Shortening or rewriting any of the three messages
- Changing the result/offer page after the reveal
- Changing generic `$pageview`, offer, checkout, Meta, or Customer.io semantics
- Treating PostHog `distinct_id` as a verified-human identifier
- Committing, pushing, opening a PR, merging, or deploying product code without a
  later publication instruction

## Target map

- `src/lib/quiz/personal-plan-result-reveal.ts`
  - Change the deterministic interval to 2,040 ms.
  - Keep total duration derived from interval × message count.
  - Add a pure `buildPersonalPlanResultRevealCompletion` helper that shapes and
    validates the trigger, visible step, elapsed time, scheduled duration, step
    count, and lead ID before the component sends the event.
- `src/app/result/[leadId]/reveal/personal-plan-result-reveal.tsx`
  - Pass explicit timer/button triggers into the existing exactly-once handler.
  - Measure elapsed time from the first visible step.
  - Record the visible step without making the scheduler effect restart on each
    message.
- `src/lib/analytics/events.ts`
  - Extend the typed completion payload.
- `src/lib/analytics/destinations/posthog.ts`
  - Map the new fields to snake_case PostHog properties.
- `tests/personal-plan-result-reveal.test.ts`
  - Update timing expectations and preserve the three-step schedule oracle.
- `tests/analytics-tracking.test.ts`
  - Assert the full completion payload reaches PostHog and no other destination.
- `tests/personal-plan-quiz-funnel-entry.test.ts`
  - Keep the source-level journey guard and add trigger-property coverage only if
    the focused unit tests do not already prove the wiring.
- `scripts/analytics/personal-plan-offer-dashboard.ts`
  - Add the frozen O7 title, description, query, and chart presentation.
- `scripts/analytics/personal-plan-offer-v3-dashboard.ts`
  - Carry O7 forward unchanged because it is reveal-level, not offer-revision
    specific.
- `scripts/posthog/add-personal-plan-reveal-skip-insight.ts` (new)
  - Dry-run by default.
  - Copy/adapt the already-shipped O6 create-or-attach flow from
    `update-personal-plan-offer-v2-dashboards.ts`: dependency-injected fetch/output,
    EU API origin, exact-title search, duplicate refusal in search and attached
    tiles, create-or-attach, and post-write re-read.
  - Require `POSTHOG_PERSONAL_API_KEY`, explicit `--apply`, and
    `--confirm-project=126788` before any write.
- `tests/posthog-personal-plan-offer-dashboard.test.ts`
  - Validate O7 source predicates, mutually exclusive classification, exact-vs-
    legacy wording, and production-host filter.
- `tests/posthog-personal-plan-reveal-skip-insight.test.ts` (new)
  - Validate create, attach, already-applied, duplicate-refusal, dry-run, and
    verified-apply paths.

## Designed user journey

1. A person completes the new personal-plan quiz and enters the existing
   full-screen result reveal.
2. The first unchanged message appears immediately:
   `Heute startest du mit deinem persönlichen Haarplan.`
3. After 2.04 seconds, the second unchanged message appears:
   `Ab <Datum> kennst du deine Routine ganz genau.`
4. After another 2.04 seconds, the third unchanged message appears:
   `Bis <Datum> wird dein Haar gesünder und schöner aussehen.`
5. If the person waits, the same result page opens automatically after 6.12
   seconds total. PostHog records one completion with `timer`, visible step 3,
   elapsed time, and scheduled duration.
6. At any point, the person may choose the unchanged top-right
   `Überspringen` control. The same result page opens immediately. PostHog records
   one completion with `skip_button`, the currently visible step, elapsed time,
   and scheduled duration.
7. If button and timer occur nearly together, the existing claim guard accepts
   only the first completion; the person still navigates once.
8. Reduced-motion users keep the same no-animation behavior; message dwell timing
   and Skip availability otherwise match the main path.
9. If result-artifact email delivery fails in the background, the existing warning
   and reveal journey remain unchanged; this task adds no new user-visible error
   state.
10. The person completes the reveal on the same result/offer page as today.

Operator journey:

1. The team opens the existing personal-plan PostHog dashboard.
2. O7 shows exact new Skip and timer completions plus visibly separate legacy
   lower-bound/ambiguous rows.
3. The team can read volume and rate without treating inferred legacy behavior as
   exact.
4. After the legacy seven-day window expires, O7 naturally becomes entirely
   trigger-exact.

## Mockup evidence

- Reviewable interactive comparison:
  [`plans/mockups/2026-07-30-quiz-result-reveal-timing.html`](mockups/2026-07-30-quiz-result-reveal-timing.html)
- Direction shown: current 2.40 s / 7.20 s next to proposed 2.04 s / 6.12 s,
  using the same real layout, copy, button, and animation.
- Feedback incorporated before mockup: retain all transitions and the Skip control;
  choose a 10–20% speed increase.
- Selected direction: 15% faster.
- Mockup review status: **confirmed by Nick on 2026-07-31**
- User-journey sign-off status: **confirmed by Nick on 2026-07-31**

## Ordered tasks

### 1. Lock timing behavior test-first

Update focused deterministic tests to expect a 2,040-ms interval, a 6,120-ms total,
and scheduled callbacks at 2,040, 4,080, and 6,120 ms. Then change the constant.
Edit only `PERSONAL_PLAN_RESULT_REVEAL_MESSAGE_MS`; do not replace the unrelated
`MIDPOINT_HOLD_MS = 2400` in the personal-plan quiz or
`MAX_RECENT_TOTAL_CHARS = 2400` in the agent runtime. Update the three exact
reveal-test oracles: interval, total, and callback schedule.

Completion criterion: the focused reveal tests pass and still prove three messages
before automatic completion.

### 2. Extend the completion analytics contract

Add the four new decision-relevant properties to the typed event and PostHog mapper.
First add and unit-test the pure
`buildPersonalPlanResultRevealCompletion(...)` helper in
`src/lib/quiz/personal-plan-result-reveal.ts`; it owns trigger-to-payload mapping,
elapsed-time normalization, visible-step bounds, and scheduled-duration shaping.
Keep `scheduled_duration_ms` because it is the cohort key needed to compare this
6.12-second version with later timing changes. Update destination tests before
component wiring.

Completion criterion: tests prove snake_case mapping, PostHog-only routing, and no
PII additions beyond the already-present `lead_id`.

### 3. Wire exact trigger and elapsed-time ownership

Start the monotonic clock when the first reveal step is tracked. Pass
`skip_button` plus the current visible step from the button, and `timer` plus step
3 from the scheduler. Keep the exactly-once claim before analytics/navigation and
avoid a `storyIndex` dependency that would restart scheduled timeouts.

The repository has no jsdom/testing-library interaction harness. Do not introduce
one for this small change. Verification will therefore be proportional and
explicit: pure-helper unit tests prove both payload variants and edge shaping;
the existing claim unit test proves exactly-once completion; a narrow source
contract proves the button passes `skip_button` and the scheduler passes `timer`;
code review verifies the thin component wiring. The HTML timing mockup verifies
the visible sequence but is not claimed as an end-to-end analytics test.

Completion criterion: the pure-helper tests, claim test, and source-wiring contract
pass, with no false claim of runtime component interaction coverage.

### 4. Add the declarative O7 insight

Define the four mutually exclusive exact/legacy categories at one row per lead,
filtered with the exact PostHog property predicate
`properties.$host = 'chaarlie.de'` and the dashboard date range. Legacy
classification must join completion events to step-view events by `lead_id` and
take `max(properties.step_index)` per lead before classification. Present a simple
bar chart with a description that names the exact denominator and legacy caveat.
Explicit `completion_trigger` always wins over legacy inference. A legacy
completion with no joined step rows has `max_step = NULL` and must be
`Historisch nicht unterscheidbar`, never a lower-bound Skip.

Completion criterion: query contract tests prove no event-count inflation,
the per-lead join, production filtering, exact-vs-legacy separation, and
seven-day/dashboard date compatibility.

### 5. Build and dry-run the guarded dashboard mutation

Implement the narrow add/attach script with exact-title discovery, duplicate
refusal in both search results and dashboard tiles, dashboard-ID verification,
dry-run default, explicit `--apply`, `--confirm-project=126788`,
`POSTHOG_PERSONAL_API_KEY`, injected fetch/output for offline tests, and post-write
re-read. Copy the O6 pattern instead of designing a second mutation protocol; do
not extract a speculative shared abstraction.

Completion criterion: mutation tests cover create, attach, no-op, duplicate,
dry-run, and apply verification; a live dry run reports one intended O7 creation
and no other writes.

### 6. Apply and verify the authorized PostHog change

Run the script with `--apply`, then re-read dashboard `859068` and the created
insight. Confirm exactly one O7 tile, exact title/description/query/presentation,
and no changes to O1/O2/O3/O5/O6.

Completion criterion: the live dashboard contains exactly one verified O7 tile and
the receipt records its insight ID.

### 7. Run repository and journey verification

Run focused tests, the relevant broader node suite, lint/type checks proportionate
to the diff, and browser checks against the reviewed mockup/current component at
desktop and mobile widths. Then run `ready-check` and `request-code-review` through
`implementation-loop`.

Completion criterion: no blocking verification/review findings remain and the
branch is review-ready without publication.

## Verification

### Automated

- Repository-standard `tsx --test tests/personal-plan-result-reveal.test.ts`
  or the matching `npm run test:node` slice
- Focused analytics tracking tests covering the completion payload
- Focused PostHog dashboard declaration tests
- New guarded-mutation script tests
- Relevant `npm run test:node` slice or full suite as selected by
  `implementation-loop`
- `npm run lint`
- Type checking/build check if touched types are not fully covered by tests

### Manual/browser

- Replay current and proposed timings in the reviewed HTML at desktop and mobile
  widths.
- Verify each unchanged message appears in order.
- Verify proposed automatic completion at roughly 6.12 seconds.
- Verify `Überspringen` is available during steps 1, 2, and 3 and immediately shows
  the existing opening state.
- Verify reduced-motion behavior remains free of the 600-ms animation.

### Live-state

- Dry-run PostHog mutation before apply.
- Exact-title search must return zero or one matching insight, never more.
- Apply only to project `126788`, dashboard `859068`.
- Re-read tile list and insight payload after apply.
- Run a bounded HogQL preview and reconcile its category total to unique completed
  reveal `lead_id` count.
- Treat that live reconciliation as mandatory because `$host` has no existing
  dashboard-query precedent in this repository.

### Evidence-sensitive review

- Confirm legacy inference is labeled as a lower bound/ambiguous, never exact.
- Confirm `completion_trigger` owns the timer/button distinction and no timing
  threshold is used for new events.
- Confirm offer and checkout funnel semantics remain unchanged.
- Confirm O7 remains out-of-band from the frozen v2/v3 migration fingerprint and
  resource-ID sets; adding O7 must not change or trip the already-applied migration.

## Review and handoff

### Implementation evidence (2026-07-31)

- The task worktree was fast-forwarded without conflict from `0a94d79b` through
  `dc395a75` to fresh `origin/main` at `556f25c4` before the final fingerprint.
- Focused red/green guards cover the 2,040-ms interval, 6,120-ms total, exact
  trigger payload, PostHog-only routing, per-lead O7 classification, v3
  out-of-band inheritance, and guarded create-or-attach mutation.
- The first live HogQL validation caught an ambiguous joined `lead_id`; the final
  query qualifies `completions.lead_id` and passed a bounded seven-day execution.
- Final live reconciliation returned 184 unique completed reveal leads:
  26 `Historischer Mindestwert Skip` (14.1%) and 158
  `Historisch nicht unterscheidbar`; exact categories remain zero until the new
  product code is deployed. An independent unique-completion query also returned
  184.
- PostHog insight creation requires `DataVisualizationNode` for the bar
  presentation. A rejected `DataTableNode` request returned HTTP 400 and created
  no resource; the corrected guarded apply created insight `5261977`.
- Dashboard `859068` was re-read with unchanged O1/O2/O3/O5/O6 IDs and exactly
  one O7 tile. O7 was verified with a `-7d` date range, HogQL source,
  `ActionsBar` display, `abschlussart` x-axis, and `eindeutige_leads` y-axis.
- The required whole-branch Claude review found no hard correctness defects. Its
  `$host` concern was closed by the live reconciliation above; its low test and
  future-invariant gaps were incorporated before the final fingerprint.

- Worktree:
  `/Users/nick/AI_work/hair_conscierge/.worktrees/quiz-reveal-skip-analytics`
- Branch: `codex/quiz-reveal-skip-analytics`
- Counterpart review: required before implementation handoff.
- Findings ledger:

  | ID | Type | Evidence | Decision | Plan change | Revalidation |
  | --- | --- | --- | --- | --- | --- |
  | F1 | defect | Existing tests cannot execute effects/clicks/timers in the component | accepted | Added pure payload helper and honest source-wiring contract | Focused unit tests + review |
  | F2 | tradeoff | Runtime wiring would require a new jsdom or seeded Playwright harness | accepted: no new harness | Explicitly use helper tests + claim test + source contract; mockup is visual only | Counterpart re-review |
  | F3 | defect | O6 already owns guarded exact-title create/attach behavior | accepted | O7 script copies the O6 safeguards and dependency injection | Mutation tests |
  | F4 | tradeoff | `scheduled_duration_ms` is configuration, not an observed duration | accepted: retain | Documented it as the cohort key for later timing comparisons | Analytics contract test |
  | F5 | defect | Unrelated `MIDPOINT_HOLD_MS = 2400` exists | accepted | Added a no-blind-replace guard | Diff review |
  | F6 | defect | `$host` has no dashboard-query prior art | accepted | Pinned `properties.$host` and made live reconciliation mandatory | Dry run + live HogQL |
  | F7 | defect | Legacy classification requires a per-lead step/completion join | accepted | Added exact join/max-step contract | Query contract test |
  | F8 | defect | Applied v2/v3 fingerprints must remain frozen | accepted | O7 is explicitly out-of-band from migration resource sets | Migration tests |
  | F9 | defect | O7 null and old/new precedence were implicit | accepted | Explicit trigger wins; NULL max step is ambiguous | Query contract test |
  | F10 | defect | O7 denominator differs from O1–O6 | accepted | Tile description says all production reveals, not offer cohort | Live dashboard read |
  | F11 | defect | Reviewer could not see Codex workflow skills | rejected | `implementation-loop`, `ready-check`, and `request-code-review` are present in the active Codex skill registry and mandated by repo `AGENTS.md` | Codex skill reads |
  | F12 | tradeoff | Legacy join exists only for the transition window | accepted: retain | Nick asked to add the currently observed lower-bound behavior to PostHog; the join ages out naturally after seven days | Query reconciliation |
  | F13 | defect | Live HogQL found ambiguous joined `lead_id` | accepted | Qualified `completions.lead_id` in the classified CTE | Live seven-day query + denominator reconciliation |
  | F14 | defect | PostHog create rejects chart fields on `DataTableNode` | accepted | Mirrored the live O3 `DataVisualizationNode` envelope and seven-day source filter | Offline mutation suite + live apply/re-read |
  | F15 | risk | Whole-branch review flagged the new exact `$host` predicate | accepted and closed for current production | Kept the approved predicate after a 184-to-184 live reconciliation and saved-insight re-read | Live HogQL + independent denominator |
  | F16 | tradeoff | Legacy `max_step < 3` is coupled to the current reveal length | accepted: no change | The legacy heuristic describes the shipped three-step history and expires from the seven-day window | Query contract + live reconciliation |
  | F17 | test gap | Empty lead IDs and non-finite step inputs lacked explicit helper coverage | accepted | Added guards for both and made step normalization finite-safe | Focused helper tests + typecheck |
  | F18 | maintainability | v3 test enumerated today’s revision-scoped insights | accepted | Changed the invariant to cover every future insight except the intentionally cross-revision O7 | Focused v3 declaration test |
- Mockup review: **confirmed by Nick on 2026-07-31** (“All right perfect”)
- Designed user-journey sign-off: **confirmed by Nick on 2026-07-31**
  (“you can start implementation please”)
- Implementation started through `implementation-loop` after both statuses were
  confirmed.
- Live PostHog apply is authorized by this request but must remain confined to the
  one guarded O7 addition.
- Commit, push, PR, merge, deployment, and production code publication remain
  separate and are not authorized by this plan.

Residual risks:

- Small initial sample and analytics identities mean the current skip estimate is
  directional.
- New exact trigger data begins only when product code is deployed; O7 must keep
  legacy rows separate during the transition.
- The live dashboard can be updated before product deployment, but exact categories
  will remain empty until new trigger-bearing events arrive.
- Component trigger wiring is intentionally accepted as helper-tested,
  source-guarded, and code-reviewed rather than introducing a new browser-component
  harness for this small change.
- In `personal-plan-offer-v3-dashboard.ts`, O7 must be added explicitly to the
  overriding `insights` object without `revision3Insight`; it must not be added to
  either applied migration's `insightIds` or fingerprint maps.

Recommended handoff after sign-off: `implementation-loop` on the existing worktree
and branch.
