# Application guidance authority reconciliation

## Outcome

Make the guarded Stage 5 V2 artifact apply executable without weakening its source-authority checks:

- the nine production V1 protocol rows that diverge from their reviewed source artifacts become exact matches;
- the two already-active Leave-in family templates become exact matches for the reviewed 289-row artifact;
- the existing fail-closed artifact executor is repinned, under exact function-definition guards, from the 2026-08-12 artifact identity to the reviewed 2026-08-14 use-case-coverage artifact identity;
- the artifact executor remains responsible for inserting the five missing family templates and verifying all 289 product pointers;
- the category-level runtime switch remains off.

This is a backend authority correction. No new use case, hair-care rule, UI surface, or user journey is introduced, so no new mockup is required. K18's stored V1 provenance gains the reviewed amount/application sentence, but production Anwendung already renders the matching V2 authority; this release introduces no new visible guidance.

## Reviewed nine-row cohort

| Product | Exact reviewed source | Exact stored V1 gap |
| --- | --- | --- |
| Nivea Power Repair Conditioner | `S5-12-conditioner-exact-01.json` | `sharedTemplateContactTime: include` |
| K18 Leave-In Molecular Repair Hair Mask | `S5-04-bondbuilder-primary-protocols.json` | exact `workflowId`, 1–3 pump amount, reviewed application sentence |
| OLAPLEX No.3PLUS Complete Repair Treatment | `S5-04-bondbuilder-primary-protocols.json` | exact `workflowId` |
| L'Oréal Paris Elvital Fiber Booster Anti-Haarverlust Serum | `S5-09-scalp-canonical-protocols.json` | `cosmetic_claim_only` caution |
| Swiss-O-Par Teebaumöl | `S5-10-shampoo-exact-01.json` | exact two-pass `workflowId` |
| The Ordinary Multi-Peptide Serum for Hair Density | `S5-09-scalp-canonical-protocols.json` | `cosmetic_claim_only` and `stop_on_irritation` cautions |
| Pantene Pro-V Grow Abundant Anti-Haarverlust Shampoo | `S5-11-shampoo-exact-02.json` | `cosmetic_claim_only` caution |
| Elvital Fiber Booster Conditioner | `S5-13-conditioner-exact-02.json` | `sharedTemplateContactTime: include` |
| Epres Bond Repair Treatment | `S5-04-bondbuilder-primary-protocols.json` | exact `workflowId` |

These are not missing application use cases. Every live V2 pointer for the cohort already equals the reviewed artifact pointer.

The captured production-shaped preflight reported exactly these nine `source_protocol_diverged` blockers and no reverse-coverage blocker. The migration still verifies the complete expected cohort and fails closed if the live state has changed.
The read-only production preconditions, including all eleven old fingerprints and the two observed family copies, are retained in `plans/evidence/2026-08-14-application-guidance-authority-live-preconditions.json`; tests reconstruct those fingerprints from reviewed payloads plus the captured deltas.

## Template reconciliation

The artifact contains 28 family templates. Production currently has 23 matching keys:

- update, with exact old-payload guards:
  - `leave-in.damp-refresh.v2`
  - `leave-in.dry-care.v2`
- leave absent for the artifact executor to insert atomically:
  - `oil.finish.damp-refresh.v2`
  - `oil.finish.dry-care.v2`
  - `oil.leave-in.damp-refresh.v2`
  - `oil.leave-in.dry-care.v2`
  - `leave-in.post-style-finish.v2`

The two in-place corrections are explicit reviewed authority replacements. The migration records the transition in Git and migration history; the normal artifact executor remains fail-closed for any unreviewed family conflict.

## Implementation

1. Add deterministic coverage first:
   - a computed payload test maps each of the nine exact identities to the named reviewed source file and proves its canonical V1 fingerprint equals the artifact `source_fingerprint`;
   - a static migration-contract test fails until the migration:
   - names all nine exact `(product_id, category, role, application_family)` identities;
   - embeds both expected-old and reviewed-new V1 fingerprints;
   - requires all nine live rows and all nine exact reviewed source payloads;
   - guards the two current family payloads before updating them;
   - performs no product, specification, V2 pointer, or runtime-flag mutation;
   - verifies the nine V1 source fingerprints and two template payloads after the update;
   - requires exactly one guarded replacement of the old executor batch, source kind, and snapshot identity and verifies the new identity in the installed definition.
2. Add one migration that applies only the reviewed field deltas to the nine V1 payloads, replaces the two reviewed template payloads, and repins the executor identity. Lock exact rows, compare exact old fingerprints/payloads, fail on precondition drift, then verify exact reviewed fingerprints/payloads and executor definition in one transaction. Because active family rows are intentionally immutable, suspend only their named immutability trigger after both old payloads are locked and verified, update exactly two rows, restore the trigger, and verify both the trigger state and new payload fingerprints before continuing.
3. Run the focused migration test, Stage 5 artifact/generator/preflight tests, full Personal Plan tests, and `npm run ci:verify`.
4. Run repository ready-check and whole-branch review. Stop review-ready: publication and production writes remain separate.

## Release sequence after later authorization

1. Refresh the exact reviewed branch head and required checks.
2. Re-capture the eleven read-only live fingerprints and require an exact match to the committed preconditions; stop on any drift.
3. Apply the reconciliation migration and verify nine V1 rows, two family rows, and the guarded executor repin.
4. Run the production-shaped artifact preflight; require zero blockers.
5. Apply the exact 289-row artifact with its reviewed SHA-256; require 28 family rows and 289 exact product pointers.
6. Merge and deploy the reviewed head.
7. Keep `PERSONAL_PLAN_STAGE5_USE_CASE_COVERAGE_ENABLED` off until separately authorized activation.

## Rollback and residual risk

- The migration fails before mutation if any of the eleven current authorities differ from the reviewed preconditions.
- The previous two family payloads and nine V1 fingerprints remain recoverable from the migration's exact guards and Git history.
- No product visibility, recommendation fit, product role, V2 pointer, user data, or runtime flag changes in this correction.
- The executor keeps its existing security, validation, locking, ledger, and exact-family checks; only its exact artifact identity is repinned. The old batch ledger remains intact and the new batch receives its own ledger rows.
