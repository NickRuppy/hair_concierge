# Oil heat-capability simplification

## Outcome and source context

Oil products have exactly three application purposes:

- `pre_wash_fibre_treatment`
- `leave_on_fibre_conditioning`
- `dry_finish`

Heat protection is not a fourth Oil purpose. It is the independently reviewed
binary capability `product_oil_specs.provides_heat_protection`.

Nick confirmed on 2026-09-03 that producer or shop evidence is authoritative
for this binary. He also confirmed that both owned products and explicitly
selected planned products may satisfy the heat need. Pending submissions and
unresolved products may not.

## Chosen direction

Define one shared verified-carrier rule and apply it consistently from Stage 3
through Anwendung:

```text
qualifies as an integrated Oil heat carrier =
  selected for leave_on_fibre_conditioning
  AND provides_heat_protection = true
  AND exact leave_on_fibre_conditioning protocol is verified_complete
  AND the Personal Plan contains at least one qualifying heat event
```

`selected` includes an owned product and a catalog-backed planned product the
user explicitly selected. It excludes merely captured products, dry-finish-only
or pre-wash-only assignments, pending submissions, inactive products, and
unresolved recommendations.

The binary capability covers one qualifying heat use only in the exact
application context supported by the reviewed leave-on protocol. A damp,
post-wash Oil stays on wash-family days unless that exact product's reviewed
protocol explicitly supports a styling-day application context. Do not add
route-level Oil fields. Do not invent reapplication: one Oil application covers
the immediately following styling sequence. It does not establish all-day or
repeated-session protection.

Hard presentation constraint confirmed by Nick on 2026-09-03: Stage 3,
Routine, and Anwendung must retain their existing component tree, layout
hierarchy, primary actions, and status treatment. This change may populate or
extend existing property rows, existing Routine details, and existing
application instruction text; it must not introduce a heat-specific component,
card section, badge, callout, or alternate layout.

### Cross-stage contract

| Stage | Required behavior |
| --- | --- |
| Stage 3 | Evaluate the exact selected Oil, its selected purpose, and each existing refined heat event by tool plus route. Recompute coverage whenever the Oil assignment or selected planned product changes. A qualifying Oil resolves only the event contexts supported by its exact protocol; any uncovered event keeps the standalone heat-protection need. The existing property comparison may show `Hitzeschutz: Ja`. |
| Routine | Preserve one ordinary `leave_on_fibre_conditioning` Oil item. Include heat protection only in the existing Routine details, never as another role, duplicated item, badge, or new card section. |
| Anwendung | Compile the exact leave-on protocol once. Append the integrated heat instruction only when the current canonical day context corresponds to a qualifying heat event, the exact reviewed protocol supports that application context, and this same Oil remains a verified carrier. The statement covers only the immediately subsequent styling sequence; do not render a separate note/callout or add a new field. |
| Fallback | If any predicate is false or unknown, the exact protocol does not support the relevant context, or a separately declared heat event remains unsupported, preserve the standalone `heat_protectant` requirement. Never silently mark heat covered. |

## Scope and non-goals

In scope:

- current Oil intake and validator contracts;
- Stage 3 heat-carrier evaluation for owned and selected planned products;
- Stage 3 recomputation after relevant Oil decisions;
- Routine presentation of the secondary heat capability;
- Anwendung gating and exact application sequencing;
- guarded normalization of the 13 live Oil products and the 16 existing
  evidence rows in the reviewed eight-product evidence subset;
- exact regression coverage across the database-to-application path;
- canonical Product Intake documentation.

Non-goals:

- no fourth Oil role or `pre_heat_protection` alias;
- no new database column or route-specific heat taxonomy;
- no changes to the standalone `heat_protectant` category;
- no changes to the existing Leave-in heat contract;
- no invented temperature, tool, reapplication, or regional-formula facts;
- no automatic activation of pending or user-submitted products;
- no production application in the implementation pass.

## Decision-coverage checkpoint — confirmed

### Confirmed with Nick

- Oil keeps exactly three purposes; heat protection remains an independent
  binary capability.
- Producer or shop evidence is authoritative for
  `provides_heat_protection`.
- A heat carrier must be the exact owned or explicitly planned Oil selected for
  `leave_on_fibre_conditioning`; dry-finish and pre-wash selections do not
  qualify.
- A qualifying Oil prevents a redundant standalone heat-protection purchase
  only when it covers every qualifying heat-event context. Partial coverage does
  not close the standalone need.
- A damp/post-wash Oil carries heat wording on wash-family days only. It may
  appear as the carrier on `styling_day` only when that exact product's reviewed
  protocol explicitly supports the styling-day application context.
- One Oil application covers the immediately following styling sequence. A
  later separately declared heat event needs exact evidence or the normal
  standalone heat-protection path; no reapplication is inferred. The current
  profile does not schedule or detect an unreported second session, so product
  guidance must not imply all-day or repeated-session protection.
- Stage 3, Routine, and Anwendung retain their existing components, layouts,
  actions, and status hierarchy. Heat information is integrated only into
  existing property, detail, and instruction content.

### Inherited from evidence or contract

- Pending, inactive, unresolved, or protocol-incomplete products cannot resolve
  the need.
- The existing one-final-save Stage 3 interaction and atomic persistence
  contract remain intact.
- Current Routine data has no persisted day-to-event assignment, but the
  existing canonical day type plus accepted event tool/route can derive the
  relevant application context without a new field.
- The Stage 3 authority evaluation already receives the current refined need
  snapshot, whose heat-exposure assessment retains event tool and route. Use
  that existing input; do not widen the persisted Stage 3 snapshot merely to
  distinguish hair dryer from dryer brush/hot-air styler.
- If any eligibility predicate becomes false or unknown, the normal standalone
  `heat_protectant` path remains available.

### Implementation defaults

- Reuse the existing Stage 3 property comparison, Routine compact metadata row
  (and the legacy card's existing `Anwendungsdetails` text), and Anwendung
  instruction-step rendering.
- Preserve all unrelated labels and ordering.
- Use discriminating tests to prove no duplicate Routine item, no retired Oil
  heat role, no false coverage, and no new presentation branch.

### Open consequential assumptions

- None. Nick confirmed the existing-signal mapping on 2026-09-03:
  `hair_dryer` with `airflow_shaping` belongs to wash-family days; dryer brush,
  hot-air styler, and direct-contact tools belong to `styling_day`. The heat
  sentence appears only when that mapped context contains the verified Oil
  application and its exact protocol supports that context. A damp/post-wash
  protocol is not blanket-enabled for `styling_day`. The statement covers the
  immediately following styling sequence only and makes no all-day or
  repeated-session claim. No new persisted scheduling or reapplication field
  is introduced.

Undiscussed consequential assumptions affecting this handoff: none.

## Target map

- Oil and heat carrier authority:
  `src/lib/personal-plan/oil-heat-context.ts`,
  `src/lib/personal-plan/products/authority/catalog-facts.ts`,
  `src/lib/personal-plan/products/authority/categories/heat-protectant.ts`
- Stage 3 product decisions and recomputation:
  `src/lib/personal-plan/products/stage3-persistence-supabase.ts`,
  `src/lib/personal-plan/products/production-persistence-gateway.ts`,
  `src/lib/personal-plan/products/portfolio.ts`,
  `src/lib/personal-plan/products/authority/contracts.ts`, and
  `src/components/personal-plan-products/stage3-products-flow.tsx`
- Routine representation and presentation:
  `src/lib/personal-plan/routine/repository.ts`,
  `src/lib/personal-plan/routine/load-view.ts`,
  `src/components/routine/personal-plan/routine-item-card.tsx`, and their view
  model contracts
- Anwendung adaptation and compilation:
  `src/lib/personal-plan/routine/application-adapter.ts`,
  `src/lib/routines/personal-plan/application/compiler.ts`, and V2 pointer logic
- Intake and operator contract:
  `src/lib/product-intake/category-validators.ts`, expansion manifest/templates,
  `docs/product-application-protocol-templates.md`, and
  `docs/product-intake-research-ops.md`
- Data convergence:
  `supabase/migrations/20260903083832_simplify_oil_heat_capability.sql`

## Designed user journey

1. The user enters Stage 3 with a confirmed heat-protection need.
2. They own or explicitly select an Oil for `leave_on_fibre_conditioning`.
3. Stage 3 evaluates that exact selection. If its binary heat capability is
   `true`, its leave-on protocol is verified, and that exact protocol supports
   every qualifying heat-event context, `Hitzeschutz: Ja` appears as a normal
   product-fit criterion alongside the existing properties. The product action
   and hierarchy do not change, and Stage 3 does not recommend a second heat
   product.
4. If the selected Oil is planned rather than owned, it still avoids a redundant
   second purchase and remains visibly marked as `Noch kaufen`.
5. If the Oil is only selected for pre-wash or dry finish, its heat flag is
   false/null, its protocol is incomplete, or even one qualifying heat event is
   outside the exact supported application context, the heat need stays open
   and the normal standalone Heat Protectant choice remains available. For
   example, a damp/post-wash Oil may cover hair-dryer airflow while a separate
   straightener event remains uncovered.
6. Routine shows one Oil item under `Pflege ohne Ausspülen`. Its existing
   `Rhythmus · Zeitpunkt · Status` metadata line may include
   `Hitzeschutz: bestätigt` before the existing status; the legacy card may add
   the same wording to its existing `Anwendungsdetails` text. The card gets no
   third property tile, new status, or badge. There is no duplicate Oil or
   artificial Oil heat role.
7. Anwendung maps the existing accepted heat
   event to its canonical context. A qualifying `hair_dryer` airflow event maps
   to wash-family days; dryer-brush, hot-air-styler, and direct-contact events
   map to `styling_day`. If the verified Oil application is present and its
   exact reviewed protocol supports that context, its existing step receives
   the heat sentence. A post-wash/damp Oil is not synthesized onto a standalone
   styling day. There is no new note component, layout, or persisted day-event
   field.
8. When the current day context has no mapped qualifying heat event, the same
   Oil application remains ordinary leave-on care and the heat wording is
   absent.
9. The heat statement applies to the styling sequence immediately following
   the Oil application. A later, separately declared heat event remains
   uncovered unless exact product evidence supports it, so the normal Heat
   Protectant path stays available. An unreported second session cannot be
   detected by the current profile; the application copy therefore makes no
   all-day or reapplication claim.
10. If current catalog identity or protocol authority becomes unavailable,
   Anwendung keeps the rest of the day usable and does not fabricate heat
   coverage.

## Planning evidence

- Rendered three-surface mockup:
  [`mockups/oil-heat-capability-journey.html`](./mockups/oil-heat-capability-journey.html)
- Rendered before/after comparison showing the exact existing content slot used
  on each surface:
  [`mockups/oil-heat-capability-before-after.html`](./mockups/oil-heat-capability-before-after.html)
- Question answered: how the same capability is communicated without creating
  a fourth role or duplicate product application.
- Initial feedback: the first mockup over-promoted a derived capability through
  a dedicated Stage 3 callout and a prominent Routine badge.
- Revised direction: use the existing Stage 3 property/criterion presentation,
  the existing Routine compact metadata row (plus the legacy card's existing
  detail text), and the existing Anwendung step text. Keep all actions,
  statuses, component trees, and layout hierarchies unchanged. Do not add a
  heat-specific UI element on any of the three surfaces.
- Evidence review: approved by Nick on 2026-09-03 after reviewing the explicit
  before/after comparison.
- User-journey sign-off: confirmed by Nick on 2026-09-03 after the final
  exact-context, partial-coverage, immediate-sequence, and unreported-session
  limitation walkthrough. The previously approved constraint that Stage 3,
  Routine, and Anwendung reuse their existing layouts and content slots without
  new heat-specific components remains unchanged.

## Current production cohort

The refreshed live read-only production audit on 2026-09-03 found 13 Oil
products that declare the legacy role. Twelve already have leave-on support;
Garnier Fructis Sleek & Stay needs its exact protocol converted to the leave-on
role. The extra four products are the already-live Wave 2 Oils, so the guarded
migration must normalize them in the same transaction rather than leave a
partially retired role in production.

Across the whole catalog there are currently 82 `oil.authority_facts` rows over
40 products. Only 16 rows over eight of the 13 migration targets contain the
reviewed legacy-role evidence that this migration must rewrite. The other five
targets have no such evidence rows; the migration must not fabricate them, and
it must not assume that unrelated Oil evidence is absent.

The same audit found 61 active routines in total and zero active routines,
pending proposals, or open/completed Stage 3 drafts using the retired Oil role.
One active routine uses Olaplex No.7 under both `dry_finish` and
`leave_on_fibre_conditioning`; that valid reference must remain accepted by the
migration guard.

## Ordered tasks

### 1. Repair the existing shared carrier loader

Consumes: selected product state, selected Oil roles, catalog binary, exact
protocol status/day compatibility, and the existing refined heat events with
tool plus route from `Stage3EvaluationContext.refinedNeedSnapshot`.

Produces: one normalized selected-carrier result containing only the event
contexts the exact product protocol supports, without a new persisted Oil role
or Stage 3 snapshot field. Repair `loadStage3HeatCarrierCoverage` rather than
introducing a parallel authority path.

- Require the exact `Stage3RoleAssignment.roles` to include
  `leave_on_fibre_conditioning`; category membership and catalog support alone
  are insufficient.
- Normalize two eligible selection sources: an owned role assignment, or an
  explicitly accepted catalog-backed planned recommendation for that same Oil
  role. Merely available recommendations do not count.
- For persisted planned selections, use `draft.decisions` entries with category
  `oil`, role `leave_on_fibre_conditioning`, choice state `planned_purchase`, an
  accepted resolution action, and a catalog recommendation product ID.
- For the existing one-final-save UI, expose server-derived carrier eligibility
  with the Oil recommendation/alternative so the client can present the
  combination after selection, then revalidate it server-side against a
  projected draft before accepting the batched heat decision.
- Reject dry-finish-only, pre-wash-only, pending, inactive, false/null, and
  protocol-incomplete cases.
- Stop returning every requested route as verified merely because the product
  has the binary. Map the existing refined events to canonical day context and
  intersect them with the exact protocol's compatible days. Preserve tool plus
  route long enough to distinguish hair-dryer airflow from dryer-brush or
  hot-air-styler airflow.
- Preserve producer/shop restrictions when one is explicitly structured in the
  reviewed protocol; otherwise use the binary as the heat-capability authority.

Completion: table-driven tests cover every predicate input and demonstrate
that category membership alone cannot qualify a product, hair-dryer airflow
does not imply dryer-brush coverage, and one uncovered event prevents full
carrier coverage.

### 2. Align Stage 3 selection and heat resolution

Consumes: shared carrier result.

Produces: current heat coverage after every relevant Oil decision.

- Recompute coverage when an Oil role assignment, owned choice, or selected
  planned recommendation changes.
- Preserve the one-final-save interaction: do not persist each local choice.
  The server must validate planned Oil intents first, fold them into a projected
  draft, and re-evaluate the dependent heat intent before the atomic CAS save.
- Resolve the heat need with one carrier only when every qualifying heat-event
  context is covered. Preserve the standalone recommendation for partial
  coverage.
- Preserve the normal standalone heat flow when coverage is absent or unknown.
- Surface heat capability as an ordinary selected-product fit criterion shown in
  the planning mockup; do not turn it into a new primary callout or action.
- Reuse the existing comparison renderer; do not create a heat-specific Stage 3
  component or layout branch.

Completion: tests prove owned and planned positive cases, dry-finish-only and
pending negative cases, A-to-B selection changes, mixed hair-dryer/straightener
partial coverage, and fallback recommendation.

### 3. Preserve one Routine item with an existing-property treatment

Consumes: Stage 3 portfolio resolution and selected carrier identity.

Produces: one leave-on Oil Routine item and truthful presentation metadata.

- Do not synthesize `pre_heat_protection` or a second assignment.
- Show `Hitzeschutz` only for the resolved carrier, within the existing compact
  metadata row (or existing detail text in the legacy card) rather than as a
  new property tile or status badge.
- Reuse the current Routine item card structure without adding a component or
  changing its layout hierarchy.
- Preserve planned/owned availability and cadence semantics.

Completion: Routine compiler and component tests prove one item, one role,
stable cadence, correct planned state, and no duplicate heat item.

### 4. Gate Anwendung on actual heat use

Consumes: accepted Routine item, current verified catalog facts/protocol, and
accepted profile heat events.

Produces: one exact application block with a conditional integrated-heat
sentence inside its existing instruction text.

- Compile the Oil's leave-on pointer, not a retired Oil heat pointer.
- Add one deterministic day-context resolver over existing inputs. Map a
  qualifying `hair_dryer`/`airflow_shaping` event to wash-family days and map
  dryer-brush, hot-air-styler, and direct-contact events to `styling_day`.
- Append the heat wording only when the current day matches that derived context
  and contains the verified leave-on Oil block. Do not gate on
  `block.heatEventIds`: ordinary leave-on Oil items do not carry that field.
- Preserve each exact product protocol's reviewed day compatibility. Do not
  blanket-add `styling_day` to damp/post-wash Oil protocols. A styling-day Oil
  carrier is valid only when that exact product protocol already supports the
  application context.
- Treat protocol `compatibleDayTypes` as the single day-placement authority in
  V1 and the equivalent shared/exact protocol compatibility as the authority in
  V2. `resolveApplicationGuidance` must resolve the block for the current day
  before the Oil heat predicate can decorate its existing instruction. Do not
  duplicate this with a second `applicationState` day-routing table.
- Keep the small styling-day carrier path for an exact future product protocol
  that genuinely supports that context. It remains unreachable for the current
  13 damp/post-wash products; do not add a current product merely to exercise
  it.
- Do not invent a second application or reapplication instruction. Limit the
  statement to the immediately following styling sequence. A separately
  represented event that the Oil protocol does not cover remains on the normal
  standalone heat-protection path. An unreported later session is outside the
  current model, so the wording must not promise all-day or repeated-session
  protection.
- Preserve local degradation when identity or guidance is unavailable.

Completion: database-row-to-adapter-to-V2-compiler tests cover OGX, Garnier,
wash-family airflow heat, exact-protocol-supported styling-day tool heat,
post-wash/damp styling-day rejection, separately declared uncovered-event
fallback, immediate-sequence-only wording, non-heat days, missing authority,
and legacy-role rejection.

### 5. Harden guarded data convergence and intake

Consumes: the exact reviewed 13-product live prestate.

Produces: exact three-role Oil catalog state and replay-safe guards.

- Replace aggregate protocol counts with exact per-product membership guards.
- Parse and verify every affected V1/V2 payload.
- Guard the exact 16 existing evidence rows over their eight reviewed target
  identities and accepted snake-case JSON shapes. Assert that the other five
  migration targets still have no authority-evidence rows, but ignore and
  preserve unrelated Oil evidence elsewhere in the catalog.
- Preserve the current 13 products' exact damp/post-wash target day array as
  `["wash_day", "intensive_care_day", "bond_repair_day",
  "clarifying_wash_day"]`. Remove `styling_day` from Garnier's converted V1
  payload. Change both the
  all-row postflight payload check and the Garnier-specific postflight assertion
  to require this exact four-day array. Keep the V2 `oil.damp.v2` template on
  that same four-day array.
- Set the generic current `TPL-OIL-LEAVEON` template to that exact four-day array
  too, so a future styling-context Oil requires an explicit reviewed product
  protocol rather than inheriting blanket compatibility.
- Abort transactionally if a legacy Oil-role Routine/proposal/draft appears
  before apply; retain the same query in the operator preflight for visibility.
- Update the canonical Product Intake runbook and current generators while
  preserving historical fingerprint-bound artifacts.

Completion: migration prestate, shifted-family drift, poststate, replay,
evidence, payload-schema, and accepted-Routine collision tests pass.

## Verification

Automated:

- focused Stage 3 authority, persistence, portfolio, Routine, adapter, V1/V2
  compiler, scanner-readiness, intake, and migration suites;
- full `npm run test:node` and nested Personal Plan suites;
- `npm run ci:verify` plus the focused migration and Personal Plan suites.

Manual/browser:

- Stage 3 owned qualifying Oil;
- Stage 3 selected planned qualifying Oil;
- dry-finish-only and incomplete-protocol fallbacks;
- Routine one-item presentation on mobile and desktop;
- Anwendung heat day and non-heat day.

Migration/live state:

- preflight the exact 13 product/protocol identities and the 16 evidence rows
  over their eight reviewed evidence identities;
- repeat the zero-collision query for accepted routines, pending proposals, and
  active/completed drafts immediately before apply;
- local clean-database replay and production preflight only; production apply
  remains separately authorized.

Evidence-sensitive review:

- verify every `provides_heat_protection=true` value remains tied to the reviewed
  producer/shop evidence;
- verify no implementation infers heat protection from product name,
  ingredients, Oil purpose, or neighboring products.

## Review and handoff

Findings ledger:

| ID | Type | Evidence | Decision | Plan change | Revalidation |
| --- | --- | --- | --- | --- | --- |
| F1 | defect | Stage 3 carrier loader filters Oil by category, not selected leave-on role | accepted | Tasks 1-2 | negative dry-finish-only test |
| F2 | defect | Migration guards aggregate leave-on counts despite family-scoped uniqueness | accepted | Task 5 | shifted-family drift test |
| F3 | defect | Anwendung capability note is not gated on a heat event | accepted | Task 4 | heat/no-heat compiler tests |
| F4 | product decision | Planned qualifying Oil may avoid a second purchase | accepted by Nick | Tasks 1-3 | planned-product journey test |
| F5 | product decision | Producer/shop binary is the heat authority | accepted by Nick | Tasks 1 and 5 | evidence provenance review |
| F6 | defect | Canonical intake runbook still lists a fourth Oil role | accepted | Task 5 | docs/current-generator search |
| F7 | scope/product decision | Profile stores event tool/route but no persisted day assignment | accepted by Nick; infer canonical context from existing day type plus tool/route | Journey and Task 4 | wash-family/styling/non-heat mapping tests |
| F8 | scope/product decision | Blanket `styling_day` compatibility can place a damp/post-wash Oil into an unsupported standalone styling context and differs from V2 runtime behavior | accepted by Nick: exact-context only | Journey and Task 4 | damp-only styling rejection plus exact styling-context positive test |
| F9 | scope/product decision | The Oil binary alone does not establish reapplication or later-session protection | accepted by Nick: immediate sequence only | Chosen direction, Journey, and Task 4 | immediate-only copy plus separately declared uncovered-event fallback tests |
| F10 | architecture tradeoff | Exact context could be enforced independently in protocol compatibility and runtime application-state routing | accepted from repository contract: protocol day compatibility is the single placement authority | Target map and Task 4 | V1/V2 compatible and incompatible day tests |
| F11 | defect | Stage 3 currently returns every requested route as verified after finding any binary-capable carrier and loses the tool distinction within `airflow_shaping` | accepted | Tasks 1-2 and Journey | hair-dryer versus dryer-brush plus mixed-event partial-coverage tests |
| F12 | defect | The first live-13 migration fixture treated the 16 reviewed target evidence rows as the global Oil-evidence population, but production has 82 rows over 40 products | accepted | Current production cohort and Task 5 | unrelated evidence preservation plus target-scoped drift tests |
| F13 | maintainability | Stage 3 and Anwendung encoded the event-to-day mapping independently | accepted | Shared `oil-heat-context` authority | focused Stage 3 and Anwendung suites consume one resolver |
| F14 | defect | Batched Stage 3 decisions were all reviewed against the pre-selection draft, so a dependent Heat decision could be stale after a planned Oil choice | accepted | Task 2 projected-draft server validation | full-coverage rejection, valid fallback, and one-CAS regression tests |
| F15 | user-flow defect | The one-final-save client kept rendering the original Heat review after a local planned Oil selection because review bundles had no read-only projection path | accepted | Task 2 read-only projected review | full coverage removes the Heat card before save; partial coverage retains it; preview performs no write |
| F16 | migration hardening | Preflight did not fail early on an extra legacy Oil spec without a protocol and did not re-prove the 13 legacy heat rows' stored source linkage before deriving the binary | accepted | Task 5 preflight | spec-only drift, blank source text, and broken V1 evidence-link tests |
| F17 | downstream projection defect | An authority-valid integrated Heat `leave_uncovered` decision would otherwise become an excluded standalone Heat item and uncovered role in the portfolio/Routine | accepted | Task 3 portfolio projection | exact persisted carrier pass is omitted; an ordinary Heat gap remains visible |
| F18 | recovery defect | Persisting the server-generated Heat intent in the browser review draft could carry a stale full-coverage result across reload into a later partial-coverage review | accepted | Task 2 preview reconciliation | only the user's Oil choice persists; the ephemeral Heat intent joins the final atomic batch only after the current projection |
| F19 | interactive race | An in-flight Oil projection could overwrite a newer local review choice because the preview generation advanced only for another preview, not every local choice | accepted from final counterpart review | Task 2 preview lifecycle | delayed-preview regression preserves the later choice and current recovery draft |
| F20 | future-data safety | Stage 3 credited a wash-family event when an Oil protocol covered any one wash-family day, although Anwendung requires the exact rendered day | accepted from final counterpart review | Shared `oil-heat-context` authority | partial wash-family protocol gets no integrated credit; complete four-day protocol does |
| F21 | copy safety | The immediate-heat sentence fell back to the last protocol step when a malformed leave-on protocol had no `apply_product` step | accepted from final counterpart review | Task 4 compiler | no application step means no appended capability sentence |
| F22 | interactive race | Changing an already answered leave-on Oil cleared the projected Heat resolution but retained a user-authored Heat choice, allowing auto-submit to send a now-invalid Oil/Heat pair before the fresh projection returned | accepted from ship review | Task 2 preview lifecycle | dependent Heat choice and review order are cleared synchronously when leave-on Oil changes; the unanswered Heat subject blocks auto-submit until projection or user review |

Counterpart-review reconciliation:

- Accept the day-level event finding: leave-on Oil blocks do not carry
  `heatEventIds`, so Anwendung must combine the current canonical day type with
  the accepted event tool/route while compiling the verified leave-on block.
- Reject the claim that the migration's aggregate protocol guard is sufficient.
  Protocol uniqueness includes `application_family`, so one product can still
  contribute two leave-on rows while another contributes none.
- Keep the production migration forward-only. Recovery, if ever needed, is a
  separately reviewed forward migration from the recorded exact prestate; no
  automatic down migration or runtime dual-role compatibility is introduced.
- Put the accepted-Routine/proposal/draft collision check inside the migration
  transaction as well as the operator preflight so it cannot race production
  apply.
- The implementation review found a stale historical Oil authority CLI apply
  path; retire it while preserving read-only inspection.
- A follow-up decision audit rejected blanket `styling_day` compatibility for
  the 13 normalized damp/post-wash Oil protocols. Preserve exact reviewed
  context instead and keep V1/V2 behavior aligned. The Stage 4 confirmation
  remains present in the row's accessible name.
- Accept the counterpart finding that the four-day target array and all coupled
  migration/template sites must be enumerated in Task 5.
- Reject a duplicate runtime `applicationState` routing predicate: the guidance
  resolver already admits a block only when its exact protocol is compatible
  with the current day. Keep that contract as the single authority and test it
  across V1/V2.
- Retain the exact-protocol-gated styling path rather than deleting it: Nick's
  selected policy explicitly permits a future Oil whose reviewed protocol
  supports that context, while the current 13 remain unable to enter it.
- Accept the final counterpart-review maintainability finding and centralize
  event-to-day mapping plus refined-event extraction. The compiler and Stage 3
  carrier loader now consume one shared resolver, so tool/route semantics
  cannot drift between them.
- Reject the counterpart concern that the styling-day branch should be removed:
  it is intentionally unreachable for the current exact protocols but is part
  of Nick's confirmed future-product rule.
- Keep the existing scan-profile delegate as an explicit seam. It has no
  production caller today; this implementation does not widen scanner verdict
  behavior beyond the confirmed Stage 3, Routine, and Anwendung scope.
- Keep the inherited bounded catalog read limit. The selected IDs are already
  bounded upstream, so this change does not introduce a new truncation path.
- Reject the first internal-review replay concern: `RETURN` exits only the
  preflight `DO` block; the idempotent DML and separate postflight still run.
- Accept the fail-early migration findings instead: guard the global legacy Oil
  spec cohort and re-prove nonblank source fields plus exact V1 evidence URL
  linkage before converting the reviewed heat role into the capability binary.
- Accept the projected-decision findings: the mutation repeats authority against
  the in-memory non-heat decisions before its single CAS write, and the existing
  client review flow uses the same server-owned projection without persisting a
  local choice or approximating protocol/event compatibility in the browser.
- Keep the server-generated integrated Heat intent ephemeral in the browser. It
  is never written into review-draft recovery state; it is appended only to the
  final atomic decision batch after the current projection. This prevents a
  formerly complete carrier result from surviving a reload into partial coverage.
- Omit an integrated Heat decision from the downstream portfolio only when its
  persisted authority result contains the exact passing
  `heat_protectant.carrier.verified` criterion. A normal `leave_uncovered` Heat
  decision remains a visible product gap.
- Accept the final interactive-race finding: every new local choice invalidates
  older preview writeback, and the latest complete choice set is projected again
  whenever it still contains a planned leave-on Oil. Changing that Oil to an
  uncovered choice also reprojects so the Heat card returns.
- Accept the reverse interactive-race finding from the ship review: changing an
  already answered leave-on Oil now synchronously removes both server-projected
  and user-authored dependent Heat state before rendering. Auto-submit therefore
  cannot send the stale pair while the replacement projection is in flight.
- Accept the future partial-day finding conservatively. Because Stage 3 knows a
  wash-family route but not its eventual exact day, an Oil earns integrated
  wash-family coverage only when its reviewed protocol supports all four
  canonical wash-family days. A subset keeps standalone Heat.
- Keep guidance-only Oil protocols fail-closed when compatible day types cannot
  be derived from exact V1 protocol data; this may retain a redundant Heat
  recommendation but cannot remove needed guidance.
- Reject a preview mutation-rate limit as a requirement for this handoff: the
  endpoint is owner-authenticated, payload-bounded, and read-only like the
  existing Stage 3 reads. A dedicated cost limit remains an optional operational
  follow-up, not a correctness gate.
- Retain the styling-only future Oil path and the Routine capability label even
  without a current heat need: both are explicit confirmed product semantics,
  and neither changes the current 13-product cohort's exact wash-family protocols.

Implementation status after the decision audit: review-ready. The uncommitted
implementation aligns V1/V2 protocol compatibility, Stage 3 per-event coverage,
Routine metadata, Anwendung immediate-sequence wording, intake validation, the
current Wave 1/Wave 2 artifacts, and the guarded live-13 migration.

Final verification receipt (2026-09-04):

- affected Stage 3, Routine, Anwendung, persistence, portfolio, and migration
  suite: 329/329 passing;
- full Node repository suite: 5,494/5,494 passing;
- nested Personal Plan suite: 848/848 passing;
- `npm run ci:verify`: TypeScript clean, ESLint zero errors with five unrelated
  pre-existing warnings, and the Next.js production build passing;
- `git diff --check`: passing;
- final counterpart review: one medium stale-preview race plus four bounded
  fail-closed/correctness findings accepted and corrected; remaining findings
  reconciled above as intentional confirmed semantics or non-blocking follow-up;
- ship review: one high reverse stale-choice race accepted and corrected with a
  focused regression; the remaining findings were low-severity, intentional, or
  explicitly deferred and did not block publication;
- decision coverage remains confirmed, with no open consequential assumptions
  affecting this handoff.

Worktree: continue only in `codex/oil-heat-capability-simplification`.

Artifact disposition: plan and mockup commit with the implementation; transient
Claude review is discarded after reconciliation.

Stop point: revised journey explicitly confirmed and implementation is
review-ready. No commit, push, PR, merge, or production apply without later
authorization.
