# Personal Plan Offer Refocus V2 — Proposal D

**Status:** Implemented locally; review-ready
**Plan date:** 2026-07-30
**Source branch:** `origin/main` at `9e6c7848`
**Planning worktree:** `.worktrees/offer-page-d-refocus-plan`
**Implementation authorization:** Granted by Nick on 2026-07-30
**Publication and production-dashboard authorization:** Not granted

Implementation verification completed on 2026-07-30. The approved D copy and
journey were preserved; no PostHog, Customer.io, deployment, or publication
write was performed.

## Outcome

Update the existing personal-plan offer page to the approved proposal D: keep the
current page's compactness and checkout flow, while adopting PR #252's clearer,
more emotional framing, its diagnostic-method presentation, a short textual
before/after contrast, and compact purple-family survey rings.

The finished page should be approximately 249 px shorter than the current mobile
page at 390 px width (5,898 px versus 6,147 px in the approved mockup estimate),
despite adding one tracked section.

## Approved design source

Nick reviewed and approved proposal D on 2026-07-30 in:

`/Users/nick/.codex/visualizations/2026/07/28/019fa871-468a-7b03-83fa-8ffb184cae06/offer-pr252-vs-live-exact.html`

The implementation should reproduce D, not reinterpret PR #252 from scratch.
The approved mobile section heights are useful regression budgets:

| Section              | Approved D height |
| -------------------- | ----------------: |
| Highlights           |            437 px |
| Real-hair diagnostic |            466 px |
| Before/after         |            501 px |
| Survey evidence      |            498 px |

The approved German strings are snapshotted here so the unversioned mockup is
not the only source of truth.

**Highlights**

1. “Versteh endlich, was deine Haare wirklich brauchen – statt weiter zu
   raten.”
2. “Eine klare Routine ohne Produktchaos: wenige Produkte, feste Reihenfolge.”
3. “Fahr dir durch die Haare und sie fühlen sich weich an – nicht trocken und
   strohig.”
4. “Trag deine Haare wieder offen – mit einem richtig guten Gefühl.”

**Diagnostic method**

- Heading: “Dein Plan basiert auf echter Haar-Diagnostik:”
- Cards:
  - “Zugtest — Struktur & Elastizität”
  - “Oberflächentest — Haaroberfläche & Glanz”
  - “Kopfhaut-Check — Typ & Zustand”
  - “Über 1.000 Produkte — analysiert & geprüft” (evidence-gated below)
- Credit: “Entwickelt gemeinsam mit Friseurmeistern.”
- Transition: “Daraus entstehen deine Produktauswahl, Reihenfolge und
  Anwendung.”

**Before/after**

- Heading: “Vorher und nachher mit Chaarlie”
- Subtitle: “So beschreiben es Frauen in unserer Umfrage:” (evidence-gated
  below)
- “Ich weiß nie, welche Produkte wirklich zu mir passen.” → “Empfehlungen mit
  Grund, abgestimmt auf deine Auswertung”
- “Meine Haare sind trocken, strohig oder glanzlos.” → “Weich, geschmeidig, mit
  Glanz, den man sieht”
- “Haare im Dutt oder Zopf verstecken” → “Haare offen tragen, mit gutem Gefühl”

**Survey evidence**

- Eyebrow: “Was Frauen wirklich beschäftigt”
- Heading: “Über 4.000 Frauen haben uns geantwortet.”
- 82% “wollen verstehen, was ihr Haar wirklich braucht”
- 73% “wünschen sich eine klare Routine ohne Produktchaos”
- 63% “wissen nicht, welche Produkte wirklich passen”
- Source: “Quelle: eigene Umfrage · 4.024 Antworten · Mehrfachauswahl möglich”

## Product decisions already settled

1. **Plan highlights:** four concise, emotional benefits at approximately the
   current live height, with restrained purple emphasis.
2. **Diagnostic method:** PR #252-style centered heading and 2×2 method grid;
   center the disclaimer below the four boxes; retain the current purple
   transition into the next part of the offer.
3. **Before/after:** use only the three strongest contrasts; retain PR #252's
   calm lavender/purple treatment; no red/green pairing and no strikethrough.
4. **Survey evidence:** retain the current concise wording and horizontal card
   layout, adding percentage rings in one purple family from darker for the
   highest value to lighter for the lower values.
5. Keep the current pricing transition/button, pricing, checkout, subscription
   clarification, testimonials, guarantee, FAQ, and final CTA behavior.

## Recommended implementation direction

### Page structure

In `src/components/personal-plan-offer/personal-plan-offer.tsx`:

- replace the current factual highlight cards with approved D;
- retain the method section's existing 2×2 grid structure, but replace its
  numbered/technical framing with D's heading and card copy and add the centered
  credit below the grid;
- add a dedicated textual before/after section immediately after the diagnostic
  method and before pricing;
- retain the existing purple transition/button beneath the method content;
- replace the large survey-number cards with the compact ring-and-copy cards;
- preserve the symbolic hero `BeforeAfterFigure`; the new textual section adds
  a different kind of contrast and does not replace the hero image;
- keep all checkout props, pricing values, payment behavior, and sticky-header
  navigation unchanged.

The section mapping is explicit because the D headings do not mirror the
existing analytics IDs:

| Section ID                    | Current heading                                                               | D heading                                                                      | Change                                                |
| ----------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------- |
| `personal_plan_diagnosis`     | “Dein Ausgangspunkt”                                                          | unchanged                                                                      | No content or layout change                           |
| `personal_plan_complete_plan` | “Dein kompletter Haarpflegeplan”                                              | “Die Highlights deines Plans”                                                  | Replace heading, eyebrow, and four cards              |
| `personal_plan_method`        | “Vier Signale. Eine klare Empfehlung.”                                        | “Dein Plan basiert auf echter Haar-Diagnostik:”                                | Reuse grid; replace framing/copy; add centered credit |
| `personal_plan_before_after`  | Does not exist                                                                | “Vorher und nachher mit Chaarlie”                                              | New section immediately before pricing                |
| `personal_plan_survey`        | “Was Frauen wirklich beschäftigt” / “Das sind die größten Herausforderungen.” | “Was Frauen wirklich beschäftigt” / “Über 4.000 Frauen haben uns geantwortet.” | Compact existing evidence into ring cards             |

Responsive defaults:

- at mobile width, reproduce approved D directly;
- at `sm` and above, highlights and diagnostic cards use a balanced 2×2 grid;
- at `md` and above, the three before/after contrasts and three survey cards use
  three equal columns to keep the page compact;
- on every width, percentage numerals remain visible text; ring fill and color
  are supplementary rather than the only carrier of meaning.

### Analytics identity

Keep these stable because the route, package, and commercial offer are unchanged:

- `offer_variant = "personal-plan-v1"`
- `funnel_package = "meta_personal_plan_v1"`
- checkout, billing, Meta event identity, and product/price identifiers

Bump the semantic page revision:

- `offer_revision: "personal_plan_v1" -> "personal_plan_v2"`

Add the typed section ID:

- `personal_plan_before_after`

The v2 visual order is:

| Index | Section ID                    |
| ----: | ----------------------------- |
|     0 | `hero`                        |
|     1 | `personal_plan_diagnosis`     |
|     2 | `personal_plan_complete_plan` |
|     3 | `personal_plan_method`        |
|     4 | `personal_plan_before_after`  |
|     5 | `pricing`                     |
|     6 | `personal_plan_survey`        |
|     7 | `testimonials`                |
|     8 | `guarantee`                   |
|     9 | `faq`                         |
|    10 | `final_cta`                   |

The new section emits only the existing `offer_section_viewed` event under the
existing 25%-visible/750-ms-visible-tab rule. It adds no CTA or detail event.

Update:

- `src/lib/analytics/events.ts`
- `src/lib/analytics/offer-section-order.ts`
- `src/lib/customerio/offer-engagement.ts`
- the section markup in the offer component

Because the same-tab `offer_engaged` session-storage key includes the revision,
a tab that spans the v1-to-v2 cutover can qualify once again after reload. This
is not a durable cross-session deduplication mechanism. The release preflight
must still verify whether any Customer.io campaign turns `offer_engaged` into
customer-facing communication. The safe default is **no duplicate
customer-facing message**: if such a campaign exists, add a revision-aware
exclusion or equivalent deduplication before deployment.

The persistent Meta offer-view guard is also revision-scoped, so a returning
eligible result can emit the v2 view again. Its lead-derived Meta `event_id`
remains unchanged across the revision, preserving the existing deduplication
identity.

## Scope

### In scope

- the four approved D sections and responsive behavior;
- the new tracked section and v2 revision;
- tests for copy, order, schema acceptance, and revision;
- analytics documentation;
- a reviewable, dry-run-first PostHog dashboard migration;
- local, preview, and authorized post-deployment verification;
- a deployment annotation and rollback record.

### Out of scope

- price, subscription terms, checkout, payment methods, or billing;
- route or funnel-package changes;
- hero, testimonials, guarantee, FAQ, or final CTA redesign;
- new images, dependencies, database migrations, feature flags, or experiments;
- changing the engagement threshold or adding new event names;
- production deployment, PostHog writes, Customer.io writes, or merge without
  separate authorization.

## Evidence gate for two lines of copy

The approved D mockup includes:

- “Über 1.000 Produkte — analysiert & geprüft”
- “So beschreiben es Frauen in unserer Umfrage:”

The repository supports the existing 4,024-participant survey percentages and
the master-stylist/founder context, but it does not currently contain evidence
that more than 1,000 products have been analyzed or that the three textual
before/after statements were answers from that survey. This limitation remains
recorded for release review; it does not authorize implementation copy drift.

Nick explicitly approved the exact D copy on 2026-07-30 and instructed that it
must not be changed or softened. Implement option 1 exactly:

1. **Exact D copy (approved):** use both approved claims exactly as snapshotted
   above. Nick is the owner-approved source for this marketing copy decision.
2. **Evidence-safe copy (rejected alternative, retained for decision history):**
   - use “Produktabgleich — passende Pflege aus unserer Datenbank” in the fourth
     diagnostic card;
   - use “Was sich mit einem klaren Plan verändert:” above the three
     before/after contrasts.

## Designed user journey

1. A user opens an existing `/result/<leadId>` offer and sees the unchanged
   hero and diagnosis context.
2. In **“Highlights deines Plans”**, four short emotional statements communicate
   the outcome faster than the current factual cards. Purple emphasis supports
   scanning without adding visual noise.
3. In **“Dein Plan basiert auf echter Haar-Diagnostik:”**, the user sees four
   centered analysis inputs in a 2×2 grid. The centered disclaimer/credibility
   line and current purple transition explain how those inputs become the plan.
4. In the new **before/after** section, three calm cards contrast the old
   situation with the clearer result. There is no alarmist red/green coding and
   no crossed-out text.
5. The existing transition brings the user into unchanged pricing and checkout.
   Sticky navigation and payment behavior work exactly as before.
6. In the survey section, three compact horizontal cards show the existing
   percentages as readable numerals inside dark-to-light purple rings, paired
   with the current concise explanations.
7. Testimonials, guarantee, FAQ, and final CTA complete the unchanged lower
   funnel.

Loading, missing-result, checkout failure, and payment recovery behavior are not
changed by this work. The page uses existing result data only; the new sections
need no additional request or loading state.

Meaningful variants to verify:

- 390 px mobile: matches approved D hierarchy and length;
- 768 px/tablet: balanced grids with no awkward orphaned text;
- 1440 px desktop: compact columns, readable line lengths, and centered
  diagnostic disclaimer;
- reduced viewport height: sticky header jump still lands cleanly at pricing;
- long German wrapping: rings do not shrink and card baselines remain aligned.

## Implementation sequence

### 1. Lock copy and evidence

- Resolve the evidence gate above.
- Transcribe the exact approved German copy from proposal D into implementation
  constants/data structures.
- Record the chosen substantiation source or safer wording in this plan before
  editing the product component.

Acceptance:

- the exact owner-approved D copy is used without substitution or softening;
- no unreviewed copy drift from D;
- all UI copy remains German.

### 2. Add failing contract tests first

Update:

- `tests/personal-plan-offer-page.test.tsx`
- `tests/offer-section-order.test.ts`
- `tests/offer-engagement.test.ts`
- `tests/analytics-tracking.test.ts` only if payload coverage needs the new ID

Delete or rewrite the existing assertions that intentionally contradict D,
including the v1 revision literal, the old factual highlight copy, and the old
DOM-shape regular expressions. Do not merely append new assertions to the
current test.

Add replacement assertions for:

- v2 revision;
- exact section IDs and visual order;
- new before/after copy and three contrast pairs;
- four diagnostic cards and centered support copy;
- survey percentages and accessible text;
- unchanged pricing/checkout handoff;
- schema acceptance of `personal_plan_before_after`.

Acceptance:

- focused tests fail for the intended missing behavior before the component and
  schema changes.

### 3. Implement the four approved sections

- Use small local data arrays within the offer component unless extraction
  materially improves readability; do not introduce a speculative design
  system.
- Build rings with CSS/conic gradients and existing Tailwind/CSS utilities; add
  no chart dependency.
- Mark decorative ring layers appropriately and preserve visible numerical text.
- Keep the transition/button and pricing boundary intact.

Acceptance:

- the lab page reproduces D at mobile;
- desktop/tablet defaults above are met;
- the new section is directly before pricing;
- no checkout or product-selection code changes.

### 4. Update the typed analytics contract

- add `personal_plan_before_after` to `OfferSectionId`;
- insert it at index 4 in `PERSONAL_PLAN_SECTION_ORDER`;
- add it to the closed Customer.io section list;
- bump only `PERSONAL_PLAN_OFFER_REVISION` to `personal_plan_v2`;
- retain variant and funnel package values;
- document the downstream index shift and revision boundary.

Acceptance:

- every rendered section resolves to its exact v2 index;
- the observer emits one qualified view per section per offer view;
- Meta routing remains unchanged;
- personal-plan `offer_engaged` still normally qualifies after the first three
  sections, so the new later section does not delay engagement.

### 5. Update analytics documentation

Update `docs/analytics/offer-page-tracking.md` with:

- the v2 section table and indices;
- the new revision and unchanged variant/package identities;
- the 25%/750-ms view rule;
- the Customer.io repeat-engagement caveat and preflight;
- the dashboard IDs, insight IDs, cutover order, validation, and rollback;
- the release annotation requirement.

Acceptance:

- an operator can distinguish v1 and v2 traffic and execute or reverse the
  dashboard cutover without reading product code.

### 6. Build a guarded PostHog dashboard migration

Use a small repository script such as:

`scripts/posthog/update-personal-plan-offer-v2-dashboards.ts`

with a focused test. It should:

- use project `126788`;
- default to read-only dry-run;
- require an explicit apply flag and project confirmation;
- fetch and fingerprint the expected existing insight definitions before PATCH;
- stop on unexpected dashboard/query drift;
- redact credentials and write any before-state backup only to an explicit
  temporary/output location;
- PATCH only the named insights below;
- re-read and assert the updated queries after apply;
- support restoring the captured before-state;
- add a deployment annotation only when an exact production timestamp is known.

This is intentionally a scripted migration rather than an ad-hoc UI edit.
Seven live insight definitions are affected, two contain ordered
predecessor/denominator logic, and a reviewed fingerprint plus reversible
before-state materially reduces the risk of silently overwriting dashboard
drift. Keep the utility narrowly scoped to these IDs; do not turn it into a
general PostHog framework.

Required dashboard changes:

1. Dashboard `859068`, “Persönlicher Haarplan — Offer-Seite: Views & Klicks”
   - insights `5235347`, `5235348`, `5235350`, `5235351`, and `5245339`:
     replace the hard-coded v1 revision filter with v2;
   - insight `5235348`: insert `personal_plan_before_after` between method and
     pricing; renumber the following rows/stages and update its description from
     10 visual sections to 11.
2. Dashboard `858662`, “Persönlicher Haarplan — Funnel & Quiz-Drop-off”
   - insight `5233190`: select v2, insert the new section, and update predecessor
     formulas, labels, and downstream numbering;
   - leave insights `5233182` and `5233189` revision-agnostic so they continue
     across the page revision.
3. Dashboard `825839`, “Quiz Result & Checkout — Letzte 24 Stunden”
   - insight `5033903`: group reach by `offer_variant`, `offer_revision`, and
     `section_id`; match each denominator to the same variant/revision; order by
     variant, revision, and minimum section index. This prevents mixed v1/v2
     traffic from diluting reach or misordering shifted indices.

Dashboard updates are production writes. The script may be implemented and
dry-run during the code change, but **must not be applied** until separately
authorized after the code is deployed and one valid v2 event is visible.

### 7. Verify locally and in preview

Run focused tests, then repository gates:

```bash
npx tsx --test \
  tests/personal-plan-offer-page.test.tsx \
  tests/offer-section-order.test.ts \
  tests/offer-engagement.test.ts \
  tests/analytics-tracking.test.ts
npm run typecheck
npm run lint
npm run build
npm run funnel:check
```

Include the dashboard migration test when added. Use the repository-supported
Node 22 runtime rather than the planning shell's Node 23.

Render `/labs/offer-page?variant=personal-plan` locally and in Vercel Preview:

- compare mobile against the approved D artifact;
- capture mobile and desktop screenshots;
- confirm section order, copy, rings, purple family, centered alignment, and
  page-length budget;
- exercise sticky pricing navigation and the checkout entry without completing
  a payment;
- verify keyboard focus, contrast, headings, visible percentage text, and no
  horizontal overflow;
- confirm no large asset or dependency regression.

Run `ready-check` and `request-code-review` through `implementation-loop` before
claiming the branch is review-ready.

### 8. Deploy and cut over analytics under separate authorization

After merge/deployment is separately authorized:

1. Record the production deployment timestamp and SHA.
2. Complete one authorized fresh quiz/result journey.
3. Confirm in PostHog:
   - `offer_viewed` has `personal_plan_v2`;
   - `personal_plan_before_after` appears once after the visibility threshold;
   - it has index 4, the unchanged offer variant, and unchanged funnel package;
   - pricing and checkout events still arrive with the v2 revision;
   - event payloads contain no answer values or PII.
4. Run the dashboard migration dry-run again against current definitions.
5. Apply it only with explicit production-write authorization.
6. Re-read all seven affected insights and validate O2/B2/new 24-hour grouping.
7. Add a deployment annotation with timestamp, SHA, v2 revision, and new section.
8. Recheck the three dashboards after fresh traffic arrives.

## Rollback

If the UI or event contract is wrong:

- redeploy the preceding production release;
- restore the captured PostHog insight definitions if the dashboard migration
  was already applied;
- add a rollback annotation with timestamp and reason;
- retain v1/v2 event rows as historical truth rather than rewriting them;
- do not alter checkout or billing data.

If only a dashboard query is wrong, restore that insight's before-state without
rolling back the product page.

## Risks and controls

| Risk                                    | Control                                                                         |
| --------------------------------------- | ------------------------------------------------------------------------------- |
| Unsupported marketing claim             | Resolve the explicit evidence gate before implementation                        |
| v1/v2 traffic mixed in dashboards       | Revision bump and revision-matched denominators                                 |
| Dashboard drift overwritten             | Fingerprint guard, dry-run, narrow IDs, before-state restore                    |
| Duplicate Customer.io message           | Audit active `offer_engaged` consumers and default to no customer-facing repeat |
| New section delays funnel engagement    | Existing threshold remains the first three sections; add a regression assertion |
| Page becomes longer despite new content | Approved height budgets and responsive screenshot comparison                    |
| Percentage rings reduce accessibility   | Visible text, supplementary color, semantic labels, contrast check              |
| Checkout regression                     | No checkout code changes; preview navigation and checkout-entry test            |

## Decisions and approvals

Resolved:

1. **Evidence/copy decision:** Nick approved the exact D claims and explicitly
   rejected substitutions or softening.
2. **Designed-user-journey sign-off:** granted by Nick on 2026-07-30.

Not needed now; recommended defaults are sufficient:

- responsive translation: use the compact grid behavior described above;
- analytics: preserve variant/package and bump only revision to v2;
- dashboard timing: deploy code, verify one v2 event, then apply the dashboard
  migration;
- dashboard mechanism: use the narrow, guarded script above rather than manual
  edits;
- Customer.io: do not permit a second customer-facing message for an already
  engaged result.
- rollback: use the previous release plus the captured dashboard before-state;
  no UI kill-switch is warranted for this copy/layout-only change.

Later, separate approvals:

- commit/push/draft PR;
- merge and deployment;
- production PostHog or Customer.io writes.

## Counterpart-review findings ledger

Read-only review completed with Claude Code 2.1.220 on 2026-07-30.

| Finding                                                                                         | Disposition                                                                                                                                                                                                                                                 |
| ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Existing v1/copy/DOM test assertions contradict D and must be replaced, not appended to         | **Accepted.** Step 2 now explicitly requires deleting or rewriting them.                                                                                                                                                                                    |
| The current method is already a 2×2 grid, not a long vertical list                              | **Accepted.** The page-structure description now preserves the existing grid and limits the change to framing, copy, and credit.                                                                                                                            |
| D's headings can be confused with existing analytics IDs                                        | **Accepted.** Added the current-heading → D-heading → section-ID table.                                                                                                                                                                                     |
| The unversioned mockup is too fragile as the only copy source                                   | **Accepted.** Snapshotted every approved D string and height budget in this plan.                                                                                                                                                                           |
| A bespoke dashboard tool may be heavier than ad-hoc edits                                       | **Rejected after scope review.** Seven live insights are affected, including ordered predecessor and revision-matched denominator logic. A narrow, tested, fingerprint-guarded script is proportionate and safer; a general framework remains out of scope. |
| A UI kill-switch may be needed                                                                  | **Rejected as unnecessary.** The change is static copy/layout with no data migration or checkout change; guarded redeploy plus dashboard restore is an adequate rollback.                                                                                   |
| `funnel:check` does not validate offer-section behavior                                         | **Accepted as clarification.** It remains a package-registry regression gate; focused tests, rendered review, typecheck, lint, and build are the actual section-work evidence.                                                                              |
| New Customer.io section-list entry is parity rather than required for the current depth trigger | **Accepted.** Keep it for closed-schema parity and future-safe validation, while retaining the accurate first-three-sections engagement behavior.                                                                                                           |
