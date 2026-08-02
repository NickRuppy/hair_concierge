# Historical quiz submissions PostHog dashboard

## Outcome and source context

Create one canonical PostHog dashboard for the historical quiz journey across the Standardquiz, Personal Plan, and events captured without package attribution. It must answer how many tracked people started, completed, and submitted a lead-capture event, and show how those measures changed over time.

The dashboard is an approximation. Supabase remains the source of truth for distinct email addresses and test-email-domain exclusion. Current production-event coverage in PostHog begins on 2026-05-28.

## Chosen direction

Create a new dashboard named `Quiz — Historische Starts, Abschlüsse & Leads` without changing the existing legacy or Personal Plan operational dashboards. Define the dashboard and its PostHog query-backed insights in the repository, then create or verify them through a dry-run-first, exact-project-confirmed PostHog migration. Its value beside Supabase is historical segmentation and trend diagnosis across quiz variants; it is not a second source of truth for email totals.

Use `quiz_started`, `quiz_completed`, and `quiz_lead_captured` events. A captured-lead event means the client emitted the event after the lead API returned successfully; there is no separate success property to filter. Report both unique PostHog people (`distinct_id`) and raw event volume, but never label either as unique email addresses. Filter to `properties.$host = 'chaarlie.de'`; a live host inventory on 2026-08-02 found no `www.chaarlie.de` quiz events. Keep missing `funnel_package_key` values visible as `Ohne Paketzuordnung`; this bucket can contain both older and current direct quiz traffic.

Do not claim internal tests are removed: a live query on 2026-08-02 found zero quiz events carrying `is_internal_test`. The dashboard description must state that PostHog cannot currently filter those rows reliably and direct operators to Supabase for a clean lead count.

## Scope and non-goals

In scope:

- A new PostHog dashboard with a historical default range beginning 2026-05-28.
- A lifetime snapshot (including start-to-capture rate), daily trend, package/version split, and event-vs-person comparison: four query-backed insights total.
- Production-host filtering for `chaarlie.de`.
- An explicit dashboard description documenting coverage, metric semantics, unavailable test filtering, and Supabase authority.
- Idempotent dry-run/apply behavior, duplicate protection, drift detection, and live read-back verification.

Out of scope:

- Editing or deleting existing dashboards or insights.
- Sending email addresses or test-domain data to PostHog.
- Claiming PostHog persons are unique leads.
- Backfilling pre-2026-05-28 PostHog events from Supabase.
- Changing application tracking semantics or emitting new events.
- Publishing, merging, deploying, or changing production application code beyond the separately authorized PostHog API write.

## Target map

- `scripts/analytics/historical-quiz-submissions-dashboard.ts` — declarative title, description, absolute date range, four insight queries/displays, and exact tile layouts.
- `scripts/posthog/ensure-historical-quiz-submissions-dashboard.ts` — guarded create-or-verify migration for the dashboard and its exact owned insights.
- `tests/posthog-historical-quiz-submissions-dashboard.test.ts` — query-contract and semantic regression tests.
- `tests/posthog-historical-quiz-submissions-dashboard-migration.test.ts` — dry-run, confirmation, duplicate, drift, idempotency, and read-back tests.
- `package.json` — one named dry-run/apply command.
- `plans/assets/historical-quiz-submissions-dashboard-mockup.html` and rendered screenshot — durable visual evidence.
- This plan — durable implementation and verification contract.

## Designed user journey

Actor: Nick or another internal operator reviewing historical quiz acquisition.

Entry condition: the operator opens PostHog and selects `Quiz — Historische Starts, Abschlüsse & Leads`.

1. The dashboard opens with the range `28 May 2026 – today` and explains that PostHog is an approximation while Supabase remains authoritative for distinct emails.
2. The operator reads the three primary counts—started, completed, and successfully captured—and the start-to-capture rate. The chart is explicitly non-sequential because event order differs between the Standardquiz and Personal Plan.
3. The operator scans three daily lines to identify historical changes. Every point represents one calendar day for starts, completions, or captured leads; days without activity appear as zero, and the partial current day remains visible and is labelled as incomplete. Changing the dashboard date range changes the number of daily positions—for example, 90 days produces 90 positions and 10 days produces 10.
4. The operator compares Standardquiz (`default_organic`), Personal Plan (`meta_personal_plan_v1`), and `Ohne Paketzuordnung` (missing package key) rows. A live 2026-08-02 query verified that all three buckets exist on the three quiz events; missing attribution is never silently folded into the Standardquiz or described as exclusively historical.
5. The operator compares people with raw events to see repeat attempts and avoid interpreting event volume as unique leads.
6. Before sharing a number, the operator reads the always-visible dashboard description covering host filtering, unavailable internal-test filtering, historical coverage, and cross-flow start semantics.
7. For exact unique emails or removal of test email domains, the operator switches to a Supabase-backed query rather than applying an unsupported PostHog filter.

Recovery and variants:

- If an event lacks package attribution, it remains visible in `Ohne Paketzuordnung`.
- Internal QA may remain because the quiz events currently carry no reliable test marker; the dashboard calls this out instead of presenting an inert filter as effective.
- If a dashboard or insight with an exact owned title already exists, the migration verifies it and does not create a duplicate.
- If exact-title resources drift from the reviewed spec or appear more than once, apply aborts before writing.
- If live read-back does not match the declared dashboard, the migration fails and reports the mismatched resource.

Completion: the operator can answer historical PostHog starts, completions, and capture activity from one place, with the limits visible alongside the numbers.

## Mockup evidence

- Selected direction: PostHog-style summary-to-detail layout.
- Prototype: `plans/assets/historical-quiz-submissions-dashboard-mockup.html`.
- Rendered screenshot: `plans/assets/historical-quiz-submissions-dashboard-mockup.png`.
- Feedback incorporated: the initial request for one historical dashboard, all funnel versions, lead emphasis, and best-effort test exclusion.
- Mockup review: **confirmed by Nick on 2026-08-02** ("Sounds excellent").
- Designed user-journey sign-off: **confirmed by Nick on 2026-08-02**.

### A2 daily-point revision

- Requested on 2026-08-02: keep A2 as a line chart, but replace monthly aggregation with daily points.
- The existing A2 insight (`5287562`) will be updated in place; dashboard `867563` and the other three insights remain unchanged.
- Each line will show one point per calendar day: started, completed, and lead captured. The selected dashboard date range controls the visible history, zero-activity dates stay present as zero, and the partial current day remains visible with an explicit caveat. A live query check confirmed 10 points for 10 calendar days and 90 points for 90 calendar days.
- Revised mockup review: **confirmed by Nick on 2026-08-02** (daily points on the existing lines, not bars).
- Revised designed user-journey sign-off: **confirmed by Nick on 2026-08-02**, including date-range-driven daily positions.

## Ordered tasks

1. Add a declarative analytics specification with the production-host filter, explicit package labeling, four dashboard insights, and date range `{ date_from: "2026-05-28", date_to: null, explicitDate: true }`. Complete when unit tests assert event names, identity basis, host filter, absence of a misleading internal-test claim, date placeholders, titles, chart types, and package fallbacks.
2. Add a guarded PostHog create-or-verify script. The declaration has no dashboard ID before first apply: idempotency must use exact-title dashboard search, abort on more than one match, and thereafter verify the returned ID. The script must validate all existing exact-title resources before any write, default to dry-run, require `--apply --confirm-project=126788`, create the dashboard before attaching insights, and re-read the final dashboard. Complete when migration tests cover no-write dry-run, confirmation/token guards, fresh creation, safe exact-title retry, duplicates, drift, partial state, and failed verification.
3. Add a package command and concise operator output. Complete when the dry-run can be invoked without remembering the script path and reports the exact pending actions.
4. Run focused tests, typecheck/lint for touched files, and a live read-only dry-run. Complete when all checks pass and the dry-run identifies only the new owned resources.
5. Apply the migration with exact project confirmation, then re-read the dashboard, every attached insight, layouts, filters, and query results. The migration writes and asserts these `sm` layouts: snapshot `{x:0,y:0,w:12,h:5}`, daily trend `{x:0,y:5,w:12,h:5}`, package split `{x:0,y:10,w:6,h:5}`, and people-vs-events `{x:6,y:10,w:6,h:5}`. Complete when the new dashboard exists exactly once, contains the four intended insights exactly once, and all live queries return successfully. Rollback is an exact-title/ID guarded delete of only the newly created dashboard and its task-owned insights; existing dashboards remain untouched.
6. Compare the live PostHog capture-event total with a fresh Supabase clean-submission count and document the timestamped deviation without treating equality as a requirement. Complete when the final handoff states both values, the measurement basis, and the known pre-tracking gap.

## Verification

Automated:

- Focused Node tests for the declaration and migration.
- TypeScript typecheck.
- ESLint on all touched TypeScript files.

Manual and live-state:

- Render the mockup at desktop width and inspect title hierarchy, caveat visibility, chart/table order, clipping, and legibility.
- Run the migration dry-run against PostHog before apply.
- After apply, GET the dashboard and confirm its title, description, date filter, attached insight IDs, unique titles, and intended order/layout.
- Execute each HogQL or native trends query through the PostHog query API and confirm a successful response with plausible non-negative values and the expected daily point count.
- Confirm the existing dashboards remain unchanged.

Evidence-sensitive review:

- Reconcile successful `quiz_lead_captured` event volume against a fresh Supabase count, separating pre-tracking submissions, duplicate submissions, unique emails, and explicitly excluded test domains.
- Treat PostHog ad-blocking, missing historical attribution, unavailable quiz-event test markers, and differing start semantics as residual limitations.

## Review and handoff

- Worktree: `.worktrees/historical-quiz-submissions-dashboard`.
- Branch: `codex/historical-quiz-submissions-dashboard`, based on fresh `origin/main`.
- Plan review: two Claude read-only passes at `high` effort removed the inert internal-test filter, grounded the package split, reduced the design to four query-backed tiles, and required exact title-based dashboard idempotency and exact layout payloads. Those findings are incorporated.
- User gates: mockup review and designed user-journey sign-off confirmed on 2026-08-02.
- Publication boundary: the authorized PostHog apply may occur after sign-off; committing, pushing, PR creation, merge, deployment, and Supabase writes remain separate actions.
- Artifacts: plan, HTML mockup, rendered mockup, analytics declaration, migration, tests, and package command are `commit`; transient Claude review output is `discard`; any PostHog backup/read-back artifact is `archive` outside the repository if produced.
- Stop point: verified live dashboard plus a timestamped PostHog/Supabase reconciliation, without modifying existing dashboards.

## Live creation receipt

- Created and verified on 2026-08-02 as PostHog dashboard `867563`.
- Attached insights: `5287561`, `5287562`, `5287563`, and `5287564`; each appears exactly once with the reviewed `sm` layout.
- A2 insight `5287562` was updated in place on 2026-08-02 to `A2 · Täglicher Verlauf — Starts, Abschlüsse & Leads`; its native trends source uses `interval: day` and three distinct-person (`dau`) series. Live read-back returned 10 points per series for 24 July–2 August and 90 points per series for 5 May–2 August, including zero-activity dates. The dashboard ID, A2 insight ID, other three insights, and layouts were unchanged.
- Live PostHog query snapshot at implementation time: 2,425 unique tracked starters, 1,566 unique tracked completers, 1,261 unique tracked people with a lead-capture event, and 1,368 lead-capture events.
- Supabase reconciliation at `2026-08-02T09:35:21.590Z`: 1,515 clean submissions and 1,367 unique clean emails across all history; 1,380 clean submissions occurred on or after the PostHog production tracking start. This leaves PostHog 12 capture events below the comparable Supabase submission count.
- Supabase clean filter excluded 66 rows using reserved test domains (`hairconscierge.test`, `example.com`, `example.org`, and `example.net`). No email address was sent to PostHog or written into this repository.
