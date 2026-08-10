# Personal Plan Stage 5 integration — truthful partial guidance

**Status:** rendered evidence reviewed, designed journey approved by Nick, and implementation verified on 2026-08-10; ready for draft-PR publication

## 1. Outcome

Make `/anwendung` useful when an accepted Stage-4 Routine contains a mix of confirmed, provisional, and unresolved products.

The Stage-5 safety boundary applies to the claims we render, not to the visibility of the product or the whole day:

- confirmed product plus verified guidance: render the normal application block;
- provisional product plus verified exact or compatible reviewed family guidance: render the application block with a visible `Vorläufig` status;
- included product with genuinely unresolved guidance: keep its ordered position and render a local gap without invented details;
- intentionally excluded product: render nothing for that product;
- keep the day available whenever it contains at least one usable step.

No amount, duration, application state, technique, sequence, heat occurrence, or reapplication rule may be inferred from an unreviewed source.

## 2. Current contract and exact gap

Current production evidence on 2026-08-10:

- the active accepted Routine contains no owned executable item;
- Heat is included but `planned` and `executable: false`;
- Shampoo, Conditioner, Leave-in, Mask, Oil, Bondbuilder, and Scalp roles are excluded in that Routine;
- there is no pending Routine proposal that supplies a more complete candidate;
- active reviewed application coverage consists of one family protocol each for Shampoo, Conditioner, and Leave-in, plus seven exact `pre_heat_protection` product protocols;
- no active Stage-5 protocol was found for Mask, Oil, Bondbuilder, or Scalp roles.

The page is therefore not merely failing to read Heat data. Two separate contracts prevent the desired journey:

1. The Stage-4-to-5 adapter filters to included, owned, executable items. An included planned product disappears even when its stable product identity and application instructions are known.
2. The Stage-5 compiler treats a day as all-or-nothing. One unresolved product prevents the other truthful steps in that day from rendering.

There is also a Heat-specific authority seam: Stage 3 reads `product_application_protocols`, while Stage 5 currently reads `application_guidance_protocols` and collapses several refined Heat events into one route. That seam matters for exact Heat instructions, but it is not the product scope of Stage 5.

## 3. Chosen product behavior

### Product states in Anwendung

| Accepted Routine state        | Guidance authority                           | Stage-5 behavior                                         |
| ----------------------------- | -------------------------------------------- | -------------------------------------------------------- |
| Included, confirmed/owned     | Compatible reviewed exact or family protocol | Normal ordered step                                      |
| Included, provisional/planned | Compatible reviewed exact or family protocol | Full ordered step with `Vorläufig` badge and explanation |
| Included, any availability    | Required application facts unresolved        | Ordered gap card; no guessed instruction                 |
| Excluded                      | Any                                          | Not shown                                                |

`Vorläufig` describes the product selection or ownership state. It does not imply that the displayed application instruction is speculative.

### Partial day behavior

A wash day does not disappear because its Conditioner is provisional or unresolved. For example:

1. confirmed Shampoo with reviewed instructions;
2. provisional Conditioner with reviewed instructions and a visible badge, or a local gap if its instruction is actually unresolved;
3. confirmed Leave-in with reviewed instructions when its placement remains sequence-safe.

The overview labels the day `Teilweise bereit` when it contains any provisional or unresolved block. The day summary states how many products are provisional rather than claiming that the entire routine is complete.

### Heat occurrence behavior

- ordinary airflow does not create a Heat step;
- a reviewed exact product protocol may support a styled blow-dry, direct-contact heat, or both;
- render one application before the first compatible qualifying event by default;
- render another application only when the reviewed exact protocol explicitly requires reapplication and the event order is deterministic;
- never hardcode a universal once-per-day rule when it would contradict the approved exact-product directions.

## 4. Scope

### In scope

- preserve included provisional/planned items with stable canonical product identity at the Stage-4-to-5 boundary;
- represent `confirmed`, `provisional`, and `unresolved` product blocks in the Stage-5 compilation contract;
- compile partial days without dropping independent truthful steps;
- resolve compatible reviewed exact guidance first and reviewed family guidance second;
- integrate `product_application_protocols` as the exact Heat authority already used by Stage 3;
- preserve individual qualifying Heat events from the immutable refined snapshot;
- render the responsive overview, provisional product block, and local unresolved gap shown in the reviewed mockup;
- add focused unit, route, database-fixture, server-render, and browser verification;
- release first behind a real internal access gate for production journey testing.

### Non-goals

- no new application instructions or catalog enrichment for currently unsupported products;
- no free-text parser that invents structured amounts, durations, techniques, or occurrences;
- no recommendation, ownership, acquisition, or Routine mutation from Stage 5;
- no checkbox, tracker, calendar, reminder, questionnaire, or daily activity state;
- no broader-user activation in the internal production-test release;
- no Claude or counterpart review for this workstream.

## 5. Proposed implementation

### Task 1 — preserve truthful Stage-4 product states

Update the application adapter so accepted included items do not disappear solely because availability is `planned` or `executable` is false.

- Keep the current canonical product, lifecycle, category, role, and owner checks.
- Pass stable availability/confirmation status into Stage 5.
- Continue to omit excluded items.
- Bulk-load compatible exact and family guidance facts without N+1 queries.
- Treat absent or unstable product identity as an unresolved category position, never as a named product.

### Task 2 — compile product blocks instead of all-or-nothing days

Extend the pure compiler contract with three block results:

- `confirmed_guidance`;
- `provisional_guidance`;
- `unresolved_guidance`.

The day compiler keeps ordered successful blocks and inserts a bounded unresolved block at the failed product's position. It suppresses a day only when the accepted Routine has no meaningful product occurrence for that day. Internal failure tokens never appear in German UI copy.

### Task 3 — align exact Heat guidance and event placement

- Load and validate the same reviewed `product_application_protocols` authority used by Stage 3.
- Require product/category/role/lifecycle alignment and visible source provenance.
- Preserve immutable `airflow_shaping` and `direct_contact_heat` event identities rather than reducing them to one `dryingRoute`.
- Use exact application state and reapplication facts without interpreting marketing prose.
- Emit a local unresolved Heat block when several occurrences cannot be placed losslessly; retain every unrelated step and day.

### Task 4 — render the signed partial-guidance journey

- Add the overview notice `Dein Plan wird noch vervollständigt` only when provisional or unresolved blocks exist.
- Label affected days `Teilweise bereit`.
- Mark the product itself `Vorläufig`; explain that selection is not yet confirmed while its displayed use is already known.
- Keep a local neutral gap for truly unknown details.
- Preserve direct-day recovery, navigation, mobile shell clearance, and read-only behavior.

## 6. Designed user journey

**Evidence review:** confirmed by Nick on 2026-08-10

**Journey sign-off:** confirmed by Nick on 2026-08-10

1. The user accepts the Stage-4 Routine and opens `Anwendung`.
2. Stage 5 reads the accepted Routine, product states, immutable refined events, canonical products, and reviewed guidance without mutating the Routine.
3. The overview shows every relevant day that contains usable or explicitly unresolved accepted product positions. A day with provisional content is labeled `Teilweise bereit`.
4. Opening a partial wash day shows confirmed and provisional products in physical order.
5. A provisional product with reviewed guidance shows its usable instructions plus a visible `Vorläufig` badge. The badge refers to product confirmation, not instruction quality.
6. If one required detail is genuinely unknown, only that product block becomes an explicit gap. Earlier and later sequence-safe instructions remain visible.
7. Heat appears at the first compatible event and repeats only when the exact reviewed protocol requires it.
8. The user can return to the unchanged Routine. Reading or navigating Stage 5 records no completion and changes no product state.
9. A fully confirmed and resolved portfolio uses the same page without provisional notice or badges.
10. Route/database failures retain the existing retry state; an empty accepted Routine still offers the truthful rest-day recovery.

Reviewed artifact: `plans/mockups/2026-08-10-personal-plan-stage5-partial-guidance.html`

## 7. Verification plan

### Deterministic tests

- Stage-4 adapter matrix for confirmed, planned, unresolved-identity, excluded, inactive, recategorized, and non-owner items;
- exact-over-family guidance precedence and product/category/role/lifecycle mismatches;
- partial-day compilation with confirmed + provisional + unresolved permutations;
- stable physical ordering when an intermediate product is unresolved;
- no invented facts in unresolved blocks;
- Heat event matrix for ordinary airflow, styled airflow, direct contact, both events, and exact required reapplication;
- view-adapter and server-render assertions for partial, complete, only-gap, empty, and retry states;
- German-copy guard against internal enum or failure-token leakage.

### Browser and database-fixture verification

- accepted Routine to `/anwendung` on mobile and desktop;
- partial overview to wash-day detail and back;
- provisional product with known full guidance;
- truly unresolved product between two usable steps;
- complete portfolio without provisional UI;
- direct day URL, inactive product, absent protocol, and retry recovery;
- keyboard order, focus visibility, 200% zoom, and bottom-navigation clearance;
- confirm that all Stage-5 interactions remain read-only.

### Release sequence after implementation approval

1. Run focused tests, typecheck, scoped lint, production build, and rendered browser verification.
2. Commit, push, and open the review artifact/PR.
3. Merge and deploy only after the implementation head passes its release gates.
4. Keep Stage 5 behind a real authenticated internal allowlist or equivalent existing gate.
5. Test the complete production journey with the internal portfolio.
6. Treat broader user access as a separate explicit activation decision after the production test is accepted.

## 8. Gates and disposition

- Branch/worktree: `codex/personal-plan-stage5-integration`, based on `origin/main` commit `52047e8f`.
- Counterpart review: intentionally omitted by explicit instruction.
- Planning artifacts: retain with the eventual implementation PR.
- Implementation gate: open after Nick reviewed the revised rendered mockup and approved the journey above.
- Publication boundary: implementation may proceed through a verified commit, push, and draft PR. Merge, deployment, production mutation, broader activation, and cleanup remain separate guarded steps.

## 9. Verification receipt

- Focused Stage-5 contracts: `npm run test:personal-plan-stage5` — 120/120 passed.
- Broader Personal Plan contracts: `npm run test:personal-plan` — 937/937 passed after rebasing onto current `main`.
- Isolated database replay: `npm run test:personal-plan-db` — 7 files and 209 checks passed.
- Authenticated responsive journey: `npm run test:playwright:personal-plan-stage5` — 2/2 passed, including confirmed, provisional, identity-free unresolved, read-only, direct-route, and recovery states.
- Static verification: `npm run typecheck`, repository `npm run lint`, scoped Prettier check, and `git diff --check` passed. Repository lint retains four unrelated pre-existing warnings and no errors.
- Production compilation: `npm run build` passed with `/anwendung` and `/anwendung/[dayType]` as dynamic routes.
- Rendered evidence inspected at 320 px mobile overview, 390 px mobile day top and bottom, and 1440 px desktop overview. The final unresolved card clears the fixed mobile navigation.
- Simulated Lea review: pass; the provisional product remains actionable without hiding uncertainty, and the unnamed unresolved position does not expose an unapproved product identity.
- Durable artifacts to commit: this plan and the signed HTML mockup. Playwright screenshots and test results are transient verification output and remain untracked.
- Counterpart review intentionally omitted by explicit instruction. No production write, activation, merge, deployment, or cleanup was performed.
