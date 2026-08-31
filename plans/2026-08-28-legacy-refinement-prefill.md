# Saved data in optional refinement

Date: 2026-08-28. Status: **approved for implementation, 2026-08-28**.
Depends on [universal paid entry](2026-08-28-universal-paid-entry.md).
Source: [confirmed decisions](2026-08-28-unified-post-payment.md).
Scope revision: this remains required after #478, which adds no legacy import.
Reuse its explicit first_open/module behavior; do not implement that routing again.

## Outcome, chosen direction and scope

Show usable old answers and exact products on existing optional-refinement screens,
without asking users to search/identify known products again. The initial Plan and
normal direct acceptance remain quiz-only. No new screen, automatic fit acceptance,
recommendation-policy change, old-data deletion, or account/billing mutation.
This is a separately testable implementation deliverable, not deferred user scope:
ship its support before enabling broad historical migration.

## Target map

- New pure `src/lib/personal-plan/legacy-prefill.ts`: exact mappings, hint generation,
  fingerprints, and skip outcomes; deterministic tests before implementation.
- `persistence/stage2-refinement-{service,supabase}.ts`,
  `refinement/{production-persistence-gateway,http-gateway,gateway}.ts`, and new
  `src/app/api/personal-plan/stage-2/optional-entry/route.ts`: explicit owned module
  preparation, returned session/revision, successor creation and atomic receipt.
- `products/{stage3-persistence-supabase,production-persistence-gateway,contracts}.ts`
  plus payload readers/decoders and products entry route: verified products handoff,
  inventory import/create RPC, versioned capture hints and existing draft priority.
- `src/components/personal-plan-products/{index,stage3-products-flow}.tsx` and
  Plan-start/module host: current product cards/search/frequency UI, loading/error
  guard, no edit/Weiter before optional preparation resolves.
- Additive Supabase migration: nullable receipt column and two service-only RPCs.
  Keep generic Stage2/Stage3 create/load and direct-acceptance callers unchanged.

## Saved-data mapping

Read original `user_product_usage` and `hair_profiles`; never rewrite/delete them.
Do not reuse the legacy computed routine artifact as a versioned Personal Plan.

| Saved value | Optional refinement prefill | Skip / unresolved |
| --- | --- | --- |
| Supported, non-fallback usage category | `currentProductCategories` | Missing rows are unknown, not an explicit empty selection; exclude the unselected-shampoo sentinel. |
| Canonical `shampoo_frequency` | `wetWashFrequency` | No product-frequency inference; old ranges without an exact current value remain unanswered. |
| Canonical towel material + compatible technique | `towel`; no_towel needs no technique | Partial pair may show available selection but is not complete. |
| Canonical drying method(s) | air_dry → air_dry; blow_dry → ordinary_blow_dry; blow_dry_diffuser → diffuser_or_airflow_shaping | Validate legacy scalar/array storage; unknown values or inferred per-tool heat frequencies omitted. |
| Explicit canonical styling tools | Corresponding current additional heat tools | multi_tool is ambiguous; diffuser ownership does not imply its use as a drying route. |
| Canonical night_protection | Current nightProtection, including explicitly saved empty array | Null/unknown does not mean no protection. |
| Exact matched, active catalog ID in supported category, current publication eligible; canonical frequency | Existing selected-product card, original frequency, source label “Aus deinen bisherigen Angaben” | Catalog eligibility must be rechecked at import and normal decision time. |
| Known exact product but missing/invalid frequency | Known candidate selected in existing capture UI, frequency unanswered | No fabricated frequency; Weiter follows normal validation. |
| Name-only, ambiguous, pending, retired/inactive or wrong-category product | Prefill original name in existing search/intake; no exact selection | Preserve original row/submission; never transfer old submission status as a new authority result. |

Do not import generic scalp_condition, uses_heat_protection boolean, aggregate
heat_styling, oil usage or dry-shampoo preferences as narrower current answers.
Mapped values must have traceable saved user-input provenance; never map defaults
from legacy normalization/resolver fallbacks as user answers. Valid exact mappings
use current `user` provenance; retain raw source IDs and mapping version in the
prefill receipt. No new provenance enum needed. Missing values remain open.
Historical empty styling_tools/night_protection arrays may be old database defaults
(`20260417130000_profile_signal_cleanup.sql` removed defaults without recording
per-row provenance). Treat such empties as unanswered unless independent saved
onboarding completion evidence proves the corresponding question was submitted;
do not infer provenance from a newer updated_at timestamp alone.

### Once-only import and entry boundary

One nullable `personal_plans.legacy_prefill_v1` JSONB receipt per migrated Plan
records Stage2 answer consumption and Stage3 inventory consumption. Each entry
stores outcome, appliedAt, sourceFingerprint and source row IDs; only server RPCs
write it. This is a versioned two-operation receipt, not a generic migration runner.
Consumed includes “nothing usable” and user
dismissal/removal. A new refined version must not reread legacy values and undo
the user's later changes. Store receipts and seeded successor drafts atomically.

**Never seed generic loadOrCreate**, because normal direct acceptance calls it
for BOTH stages (`accept.ts:215,297`). Add a distinct explicit-module preparation
operation, using the existing reopen lifecycle (`stage2-refinement-service.ts:237`):

```ts
// Authenticated POST /api/personal-plan/stage-2/optional-entry
// Body identifies only the requested module; user/Plan/acceptance are server-derived.
openOptionalRefinement(input: {
  userId: string; module: "products" | "habits";
}): Promise<Stage2PersistedDraft>;
type Stage3EntryIntent = "baseline" | "optional_products_module";
```

- For a migrated, already-accepted Plan, explicit module entry calls the POST
  before exposing editable form/Weiter. The server verifies paid Stage2 access,
  current Plan ownership and accepted routine; a query parameter is not authority.
  Generic GET/load, initial preview and direct acceptance remain prefill-free.
- If the parent is complete and fully synthetic (every completed answer has
  explicit assumed provenance), create one in-progress successor, copy answers/
  provenance, overlay only valid legacy mappings, rerun canonical path pruning,
  and write the Stage2 receipt in the same transaction. Never mutate the parent.
  Mapped exact facts are user answers; inherited defaults remain assumed.
- Existing in-progress/user-origin/reopened drafts always win; no overlay. Mark
  the one-time attempt as skipped_existing_state under the same lock so later
  versions cannot unexpectedly import old answers. Empty imports are also consumed.
  Interrupted, unaccepted direct-accept drafts are never converted to user work.
- `http-gateway.ts`/host module entry waits for optional preparation and uses its
  returned draft ID/revision/session; PATCH and retry keep the normal CAS protocol.
  No schema writes on a routing GET or a client-side sequence of simulated clicks.
- Stage3 intent is baseline everywhere except the explicit products-module
  handoff. Derive permission from the persisted products projection/stage3Handoff
  and current owned refined source, never from a client-provided intent alone.
  An unaccepted recovery that actually completes the products module may also
  use this verified handoff for inventory import; it is real refinement, not
  baseline acceptance. Existing completed direct-accept drafts stay immutable.
- Add a versioned import/create RPC, separate from generic product loadOrCreate:
  lock Plan + receipt, validate current authority/refined source, create/reuse
  eligible user_products with existing_inventory source, seed the new draft and
  consume inventory receipt atomically. Existing user drafts win; failures roll
  back the marker. No fit verdict, role, category completion or portfolio activation
  is created by import. Always use normal decision/evaluation/activation gates.
- Unresolved names and known candidates with missing frequency are capture hints,
  not valid captured products. Add optional versioned `legacyPrefillHints` by
  category to the draft read/decoder/UI contract; render through existing search/
  candidate/frequency controls. Dismissal consumes a hint. Do not forge a frequency
  to satisfy the captured-product schema. Persist/reload hints, and never create a
  second pending submission merely from viewing one.
- Non-migrated Plans bypass both operations. Once a marker is consumed, later
  drafts use current-state reconciliation only; removing/changing an imported
  product is not undone by an unchanged legacy row.

## Designed user journey and planning evidence

After seeing the normal Plan and taking its normal action, the returning buyer opens
an optional module. Preparation completes before editable fields are displayed.
Reliable old choices appear selected; unknown values remain open. Exact products
and usable frequencies appear under Ausgewählte Produkte; normal Weiter continues.
Users can remove/change/add. Missing identities use existing search/intake with the
saved name prefilled. Missing frequency uses the existing selector. Normal fit,
role and activation decisions still follow. No extra identity confirmation screen.

Existing new-system work wins. Unaccepted source/acceptance recovery uses normal
Stage2 without answer overlay; a genuinely completed products-module handoff may
still receive inventory prefill. Failed import remains retryable without consuming
its receipt; leaving optional refinement returns to the existing routine. Parent
versions and old records are retained throughout.
For product-preparation handoff errors, use the confirmed compact error/retry
contract in the chapter-retirement plan, never a removed chapter screen.

Evidence: [current screen](unified-post-payment-evidence/current-products.png),
[proposed static layout](unified-post-payment-evidence/prefill.html),
[mobile](unified-post-payment-evidence/proposed-mobile.png), and
[unknown product](unified-post-payment-evidence/unresolved-mobile.png).
Codex inspected desktop/mobile, saved-card wrapping and unresolved Weiter disabled.
This proves the layout is sufficient, not that persistence/import is implemented.
Nick's visual review and final complete-journey sign-off are confirmed (2026-08-28).

## Ordered tasks and exact boundaries

1. **Map known facts and unresolved hints without guesses.** Consumes owned legacy
   usage/profile rows + explicit provenance evidence + current category/frequency
   contracts. Produces `legacy_prefill_v1` seed/hints and sourceFingerprint. Add a
   pure mapper test beside existing Personal Plan persistence tests. Completion:
   exact/invalid frequency, supported/unsupported category, old default arrays,
   sentinel, partial towel, ambiguous heat and retired product cases are explicit;
   raw source rows remain unchanged and no default becomes user provenance.
2. **Open optional Stage2 successor once.** Consumes migrated accepted Plan, module,
   current parent/draft, mapper output. Produces server-returned seeded successor
   plus Stage2 receipt. Transaction locks the owned personal_plans row FOR UPDATE,
   re-reads current refinement and receipt, checks fully assumed completed parent,
   inserts successor with existing uniqueness/CAS rules, then writes receipt before
   commit. Existing user/in-progress state wins and records a skip. Tests extend
   stage2-refinement-service, direct-acceptance and Stage2 route suites. Completion:
   baseline/GET/accept never import; concurrent POST gives one successor; parent
   immutable; user edits/reopen win; inherited defaults remain assumed.
3. **Import products on a verified optional handoff.** Consumes owned persisted
   products-module projection/stage3Handoff, current refined version and inventory
   marker. Produces one new Stage3 draft with exact selections/capture hints plus
   inventory receipt. Lock Plan first, then current draft; revalidate source and
   current catalog authority, create/reuse owned records, insert draft and marker
   in one transaction. Existing draft and consumed receipt bypass legacy reads.
   Extend stage3-persistence-supabase and production gateway suites. Completion:
   baseline acceptance unchanged; no duplicate owned record; wrong-owner/stale/
   retired/unsupported rejected; missing frequency stays unresolved; failure rolls
   back; removal/reopen/new refined version cannot reimport a removed product.
4. **Render existing screens with server-prepared state.** Consumes returned draft
   session/revision and validated hints. Produces the reviewed card/search UI.
   Extend Stage2/Stage3 UI tests and Feinschliff browser fixtures: matched preselect,
   unresolved search, frequency repair, removal/edit, Back/reload, pending/error and
   retry. Completion: no empty-form flash, no enabled Continue before loading,
   no extra screen and no import-created fit/role/category completion.

## Verification, rollout and handoff

Automated anchors: `tests/personal-plan-direct-acceptance.test.ts`,
`tests/personal-plan/persistence/stage2-refinement-service.test.ts`,
`tests/personal-plan/products/stage3-persistence-supabase.test.ts`,
`tests/personal-plan-stage2-refinement-ui.test.tsx`, and
`tests/personal-plan-feinschliff-journey.spec.ts`. Add POST route coverage to the
existing Stage2 API suite and decoder compatibility cases to existing payload tests.
Run repository typecheck/lint and affected journeys via implementation-loop.
Isolated SQL fixtures prove lock/CAS, privilege/owner checks and full rollback.
Local browser fixture screenshots do not prove authenticated persistence/provider
behavior. No production writes or dev-login seed against copied production env.

Additive receipt/schema and compatible readers before importer; do not enable the
historical admission switch until entry + prefill + chapter compatibility are ready.
Retain old rows, immutable parent versions and compatibility decoder support.
A failed optional import cannot lock users out of their active Plan/routine.

Claude reviewed the original combined contract once at high; reconciled findings
are in the universal-entry plan. Splitting this document changes organization,
not the approved feature or launch ordering. No second approval review claimed.
Implementation, final code review and publication retain their separate gates.
Plan/HTML/screenshots = commit; transient reviewer report = discard. Stop before
code until reviewed evidence + final journey approval, and before ship/deploy until
separately authorized.

## Implementation authorization

On 2026-08-28 Nick confirmed the contextual evidence and final journey and explicitly
requested implementation with workers and explorers. This supersedes earlier
planning-only status text. Publication and production changes remain separate.
