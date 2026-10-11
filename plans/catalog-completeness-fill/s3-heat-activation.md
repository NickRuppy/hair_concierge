# S3 — Heat activation: slice plan

**Status:** Draft Rev. 1 (2026-10-09), ready for implementation once Q1–Q3 are answered. Worktree `.worktrees/catalog-completeness-fill`, branch `codex/catalog-completeness-fill` (HEAD `57ae223f` = `origin/main` `320940f4` + T1.1). S3 starts after the S1 data batch is applied: S3's prestate is S1's post-state.

**Rulings in force:** A1, A2, D-c, D-d, D-e, D-f, H1–H4 (`decisions.md`). Program context: `plan.md` §8b S3(a)–(e), §11 F05/F08/F09.

**Evidence base:** `research/x3-heat-activation/facts.md`, `research/r1-leave-in-heat/findings.md` (HEAT&GLOW pack record), `research/r4-user-submitted-14/` (Neqi v1.1 envelope + adapter output), plus fresh reads made for this plan (2026-10-09, SELECT only):

| Fact | Value |
|---|---|
| `product_leave_in_specs.heat_activation_required` | 68 rows, 0 `true`; adapter hard-codes `false` (`production-adapter.ts:1057`, AD-3 note `:1198`) |
| Neqi Diamond Glass Ultimate Styling Spray `42a2fe20` | `user_submitted`, not recommended; roles `{replacement_conditioner, styling_prep}`, fit `replacement_capable`, plan_roles `{post_wash_leave_in, pre_heat_application}`, stage `{towel_dry, pre_heat}`, hp `true`; 6 eligibility rows incl. `air_dry`/`non_heat_style`; **0 protocols**; 0 owners, 0 drafts, 0 routines. Engine-researched (batches `leave-in-research-calibration-v1` and `-v2-t20`, gold slot 13). |
| Pantene HEAT&GLOW `e781ca9e` | curated, recommended, thickness `{normal}`; roles `{extension_conditioner}`, fit `booster_only`; plan_roles `{post_wash_leave_in, pre_heat_application}`; hp `false` and stage `{towel_dry}` **today** (S1 T1.2 sets hp `true`, stage `{towel_dry, pre_heat, dry_hair}`); protocols: `post_wash_leave_in`/`post_wash_damp_conditioning` (Dunnes IE source), `post_wash_leave_in`/`between_wash_dry_care` and `pre_heat_protection`/`pre_heat_damp` (Boots UK source; V2 `activationRequired:false`). **Legacy curated row — never engine-researched** (not in any leave-in calibration batch). |
| HEAT&GLOW in user plans | 0 owners; **7 active routines** (7 plans) carry it as the planned **post-wash** leave-in (`planned:…:leave_in:post_wash_leave_in…`); 10 completed product drafts, 10 portfolio versions, 11 routine versions reference it. |
| Garnier Sleek & Stay `c574ee6f` | Oil row, recommended today; S1 T1.4 retires it from the plan (D-f). Not touched by S3. |
| Live publication gate | leave-in branch lives in `public.assert_personal_plan_curated_publication_v1_without_v2` (wrapped by the V2 assertion from `20260813085151` / Bondbuilder migrations); still requires `'pre_heat' = ANY(application_stage)` for `pre_heat_application`. |
| Stage-5 contract | V2 is live (`PERSONAL_PLAN_STAGE5_CONTRACT_VERSION = 2`); V1 payload still required by the gate and DB CHECK. |

---

## 1. The Leave-In v1.2 rule

### 1.1 What the property is

"Needs heat to work" is a **usage requirement the manufacturer states**: the product only does its job when a named heat step follows application. It is not a benefit claim and not an efficacy grade. It is completely separate from heat protection (D-e).

### 1.2 Field (research and production)

Research envelope, identity block (captured at G1 next to `applicationStage`, like §7.13's `application_stage`):

```jsonc
"identity": {
  "applicationStage": ["towel_dry", "pre_heat"],
  "heatActivation": {
    "value": "required",                 // "required" | "not_required"  (no "unknown": AD-2)
    "route": "airflow_shaping",          // "airflow_shaping" | "direct_contact_heat" | "either_heat"; null iff not_required
    "statements": [                      // verbatim, C1/C2 only; ≥1 of each kind when required
      { "kind": "activation_statement", "quote": "Noch mehr hitzeaktivierte Polymere …",
        "sourceTier": "C2", "sourceUrl": "https://neqi-hair.com/products/diamond-glass-ultimate-styling-spray", "retrievedAt": "2026-10-09" },
      { "kind": "heat_step_direction", "quote": "Anschließend die einzelnen Partien mit Hitze und auf Spannung föhnen.",
        "sourceTier": "C2", "sourceUrl": "https://neqi-hair.com/products/diamond-glass-ultimate-styling-spray", "retrievedAt": "2026-10-09" }
    ],
    "counterSignals": [                  // C3–C5 wording, corroboration only
      { "quote": "Jeden Abschnitt unter Hitze und Spannung föhnen, um den … Feuchtigkeitsschutz zu aktivieren", "sourceTier": "C3", "sourceUrl": "https://www.dm.de/p/d/3080142/…" }
    ]
  }
}
```

Production (`product_leave_in_specs`): keep the existing `heat_activation_required boolean NOT NULL DEFAULT false`; add `heat_activation_route text NULL CHECK (heat_activation_route IN ('airflow_shaping','direct_contact_heat','either_heat'))` with `(heat_activation_required) = (heat_activation_route IS NOT NULL)`. The route is what the routine and the Stage-3 guard need ("föhnen" ≠ "Glätteisen").

### 1.3 Evidence rule (directions-led, manufacturer-gated)

Normative text for the overlay (`§7.13-HA`):

- **HA-1 Directions-led.** `heatActivation` is identity data transcribed from the product's own text, like `application_stage` (§7.13): never derived from the formula, the INCI, a polymer class or the product name alone; silence → `not_required`.
- **HA-2 Two prongs, both required for `required`:**
  (a) an **activation statement**: the manufacturer says heat activates or releases the product's effect („hitzeaktiviert", „durch Hitze aktiviert", „bei Hitzeaktivierung", „…, um zu aktivieren" with a heat step);
  (b) a **heat-step direction**: the directions name a heat tool step after application **without offering a non-heat finish** as an alternative. „Föhnen, stylen oder an der Luft trocknen lassen" (Urban Alchemy) offers one → `not_required`. A further use sentence that names no non-heat finish (HEAT&GLOW „Zwischen den Haarwäschen nutzen, um Frizz zu kontrollieren.") does not defeat (b): the pack's activation direction governs every use it lists (ruling D-c).
- **HA-3 Authority (D-d): manufacturer only.** Both prongs must come from **C1** (current German pack) or **C2** (manufacturer's German-market page), including §2.4.1 rule 6 (house brand on its own retailer page). **T14's `C2_cross_market_verified` does not apply** ("German page or pack"). C3–C5 wording may only corroborate; retailer-only activation wording → `not_required`, recorded in `counterSignals`, routed to review with note `activation_authority_gap`.
- **HA-4 Route** is transcribed from prong (b)'s tool: Föhn/föhnen/Rundbürste → `airflow_shaping`; Glätteisen/Lockenstab → `direct_contact_heat`; both named as alternatives → `either_heat`.
- **HA-5 Ambiguity** (one prong only, unclear tool, conflicting C1/C2) → `identityStatus: provisional_identity_conflict`, G5 preserved, human review; the record does not project (AD-2).
- **HA-6 Separation (D-e).** `heatActivation` never sets or reads `provides_heat_protection` (§13.3 untouched); the HEAT claim never sets activation. A product may be activated without protection, protected without activation, both, or neither.
- **HA-7 Cross-check invariant.** `required` ⇒ `application_stage ∋ pre_heat` (prong (b) is by §7.13's own definition `pre_heat` evidence). A violation is a capture error → needs_research.
- **HA-8 Review routing.** Every `required` value routes to human review (new field, small n) with note `heat_activation_required`; `activation_authority_gap` and `provisional_identity_conflict` as above.
- **HA-9 Claim-authority bookkeeping.** v1.0 §2.4.1 lists HEAT as "the only claim-led field" (T9). Activation is **not** claim-led (no claim ladder, no evidence grade); it borrows only §2.4.1's C1/C2 source gate. The overlay says this explicitly so T9 is not reopened.

### 1.4 Production invariants (adapter AD-7, DB CHECK + gate, Stage-3 guard)

When `heat_activation_required = true`:

| # | Invariant | Enforced in |
|---|---|---|
| I1 | `application_stage ∋ 'pre_heat'` | adapter (refuse), table CHECK |
| I2 | `plan_roles = {pre_heat_application}` exactly — no `post_wash_leave_in` | adapter, table CHECK, Stage-3 guard |
| I3 | `roles = {styling_prep}` — no `replacement_conditioner`, no `extension_conditioner` (AD-3/AD-4 overridden); generated `conditioner_relationship = booster_only` | adapter, table CHECK (`NOT 'replacement_conditioner' = ANY(roles)`; existing CHECK already requires `styling_prep`) |
| I4 | `product_leave_in_fit_specs.conditioner_relationship = 'booster_only'` | adapter, publication gate (cross-table) |
| I5 | `provides_heat_protection = true` for a **Leave-In** projection | adapter refuses otherwise (`needs_research`: "heat-activated without a heat-protection claim has no Leave-In plan role → Styling program"); gate rejects curated/recommended rows |
| I6 | `heat_activation_route IS NOT NULL` | table CHECK |
| I7 | eligibility rows are `heat_style` only | expander + adapter invariant (exists) |
| I8 | required protocol roles = `{pre_heat_protection}` only | adapter `requiredProtocolRoles`, `expansion-manifest.ts` |

**Interaction with `provides_heat_protection`:** activation never counts as heat coverage. `loadStage3HeatCarrierCoverage` (`authority/catalog-facts.ts:909`) keeps reading `providesHeatProtection` only; a hypothetical activated-but-unprotected product would still need a separate heat carrier (Leave-In refuses such a projection per I5; Styling will rely on this rule, see §6).

---

## 2. Engine, adapter and apply-lane changes

### 2.1 Standard v1.2 artifacts (precedent: T20, PR #626)

- `docs/research/leave-in-inci/v1.2/leave-in-classification-overlay.v1.2.md` — "Standard v1.2 = v1.0 + v1.1 overlay + this file"; names v1.0 base (`7ae5e882…`) and v1.1 overlay (`9c134035…`) by sha256; scope line "identity field `heatActivation` only"; §0 how to read; §1 HA-1…HA-9; §2 per-record consequence (only gold slot 13 moves); §3 conformance (§1.1 conservative-failure: activation moves a product *out* of post-wash and replacement → less favourable, so no step-down needed; review routing per HA-8); §8 rule-change ledger block, row **22** "T21 — heat activation (A1, D-c, D-d, D-e; Nick, 2026-10-09)"; §9 source anchors.
- `docs/research/leave-in-inci/README.md` — status line (v1.2), "What is authoritative" rows for the v1.2 overlay/lock/calibration, rulings index row T21, Guidance synchronization note.
- `data/research/leave-in-inci/v1.2/{artifact-manifest.json, v1.2-logic-lock-receipt.json, calibration-envelopes/slot-*.json, calibration-expected-projections.json, lab-fixture.json}` — receipt schema `leave-in-research-logic-lock.v1`, `locked_standard_version: "1.2"`, `changed_scope: identity.heatActivation`.
- `scripts/leave-in-research/build-v1.2-calibration.ts` — re-stamps the 11 v1.1 calibration envelopes: `researchMethod` → v1.2 pins, adds `identity.heatActivation` from each record's frozen directions capture. Expected: `not_required` for 10 (slot 05 EVO Head Mistress carries `pre_heat` — check its C1/C2 text explicitly for an activation statement), `required`/`airflow_shaping` for slot 13. **Golden rule: every projection except slot 13 is byte-identical to the v1.1 expected projection.**
- Re-stamp the three S1 user-submitted v1.1 envelopes (Aussie, Balea Hair Sealer, Bali Curls N°3) the same way so future re-projection does not fail; their projections must stay byte-identical (S1 values unaffected). **Bali note (H4):** the Bali envelopes still carry the superseded heat-protection reading (`provides_heat_protection: true`); H4 overrides it and Slice 1 writes the H4 values. The frozen envelopes are not rewritten — see `research/r4-user-submitted-14/leave-in-v1.{1,2}/bali/SUPERSEDED-H4.md`.

### 2.2 Envelopes for the two products

- **Neqi `42a2fe20`** — full v1.2 research envelope = r4 `leave-in-v1.1/neqi-spray/envelope.json` + v1.2 pins + `identity.heatActivation` (§1.2 example; statements from neqi-hair.com C2, dm C3 as counter-signal). Profile values unchanged (T20 `balanced`, etc.). Projection delta vs today's live row: roles `{styling_prep}`, fit `booster_only`, plan_roles `{pre_heat_application}`, `heat_activation_required true`, route `airflow_shaping`, eligibility 6 → 4 rows (`normal|coarse × heat_protect|moisture_anti_frizz × heat_style`).
- **HEAT&GLOW `e781ca9e`** — **field-scoped activation amendment** `leave-in-heat-activation-amendment-v1.2` (not a full research envelope; see Proposal P5): `{productId, gtin 8700216939768, heatActivation{value required, route airflow_shaping, statements: C1 pack front „Hitzeaktivierte Formel für extra Pflege", C1 pack back „Unsere Pro-V Formel bringt bei Hitzeaktivierung noch mehr feuchtigkeitsspendende Nährstoffe ins Haar …", C1 direction „Föhnen, um zu aktivieren."}, applicationStage confirmation {towel_dry, pre_heat, dry_hair} (= S1 value), sources}`. C1 source: the current German pack, read from the dm-hosted packshot `https://products.dm-static.com/…/pantene-pro-v-leave-in-moisture-boost-heat-und-glow` (r1; Nick accepted the pack as C1 in H3). No pantene.de page exists (search 2026-10-09); dm.de 3088304 is C3 corroboration. Projection delta vs S1 post-state: roles `{extension_conditioner}` → `{styling_prep}`, plan_roles → `{pre_heat_application}`, activation `true`/`airflow_shaping`, eligibility → `normal × heat_protect|moisture_anti_frizz|shine_protect × heat_style` (3 rows). Every other legacy field is untouched (residual: never engine-researched).

### 2.3 Shared projection helper (reused by adapter, amendment path, and later Styling)

New pure module `src/lib/heat-activation/contract.ts`:
- `HEAT_ACTIVATION_ROUTES`, `heatActivationCaptureSchema` (zod; superRefine enforces HA-2/HA-3/HA-4 shape: `required` ⇒ ≥1 C1/C2 `activation_statement` + ≥1 C1/C2 `heat_step_direction` + route; `not_required` ⇒ route null; C3+ only in `counterSignals`).
- `heatActivationRouteServes(route, userRoutes)` (`either_heat` ⇒ any; else membership).
- `applyHeatActivationToLeaveInProjection({specs, fit, activation})` → I1–I8 applied or a typed refusal reason. Used by `projectLeaveInProduction` and by the amendment generator so both paths cannot drift.

### 2.4 Adapter (`src/lib/leave-in-research/production-adapter.ts`)

- `LEAVE_IN_PRODUCTION_ADAPTER_RESEARCH_METHOD` → `policyId leave-in-classification-v1.2`, `modelVersion leave-in-inci-v1.2`, `policySha256` = v1.2 overlay sha; add `LEAVE_IN_V1_1_OVERLAY` pin; **refuse v1.1 envelopes** (`needs_research`, reason "v1.2 added identity.heatActivation; re-stamp required"). Envelope version string and adapter version stay (`…-envelope-v1.0`, `…-adapter-v1`; AD-6 precedent).
- Envelope schema: `identity.heatActivation: heatActivationCaptureSchema` (required).
- Projection: `heat_activation_required`/`heat_activation_route` from the capture via the helper; `plan_roles`, `roles`, fit relationship, `requiredProtocolRoles` per I2–I8; invariant list gains I1, I2, I3, I5, I6 failures; replace the AD-3 rationale string (`:1198`) and the summary line (`:1299`) with the AD-7 text; markdown renderer prints the route.
- `src/lib/product-intake/expansion-manifest.ts:115` `deriveRequiredProtocolRoles("leave_in")` → `["pre_heat_protection"]` when `heat_activation_required === true`.
- `src/lib/product-intake/category-validators.ts` `leaveInSpecsSchema` → add `heat_activation_route` + superRefine mirroring the table CHECKs.
- Column-list pins that name the spec columns: `src/lib/leave-in/constants.ts`, `src/lib/catalog-authority/product-spec-relationships.ts`, `apps/product-intake-review/app/submissions/[submissionId]/review-property-rows.ts`, `src/lib/product-intake/catalog-enrichment/leave-in-research-calibration(.ts|-v2-t20.ts)` (historical batches: leave unchanged, add the new column only where a current reader enumerates columns).
- Guidance sync: `src/lib/product-intake/leave-in-research-prompt-contract.ts` (researcher must capture `heatActivation` with C1/C2 statements), `docs/product-intake-leave-in-production-adapter.md` (mapping table rows for AD-7), `plans/leave-in-inci/adapter-decisions.md` (new **AD-7 heat activation projection**; AD-3/AD-4 note "overridden when activation is required").
- Legacy writers: `scripts/ingest-products.ts:438` name heuristic → removed (activation only through research/amendment); `scripts/backfill-leave-in-specs.ts`, `scripts/catalog-additions/prepare-2026-06-27-products.ts` keep writing `false` (+ route null).

### 2.5 Eligibility — SQL and TS separation (activation vs protection)

`public.expand_leave_in_eligibility` (live md5 `bec42b02…`) and its TS port `expandLeaveInEligibility` (`production-adapter.ts:631`) change identically:

- `heat_protect` bucket **iff `provides_heat_protection`** (today: activation OR protection).
- activation ⇒ contexts `{heat_style}` and every non-heat bucket **emits its `heat_style` row** (today non-heat buckets skip `heat_style`, so an activated product would only be findable as a heat protector).
- non-activated products: unchanged.

Effect on live data: none outside the two S3 products (0 activated rows today). Proof test: recompute all 68 live-shaped fixtures, assert identical rows (T-E).

### 2.6 Apply lane

Two migrations in the S3 PR (S1 precedent: one-shot guarded data migration + PGlite rehearsal; T20 executor function not needed for two products — Proposal P14):

1. `supabase/migrations/<ts1>_leave_in_heat_activation_schema.sql` (code-coupled, deploys with the PR):
   - `DO $lineage$` digest guards on the current `prosrc` of `expand_leave_in_eligibility` and `assert_personal_plan_curated_publication_v1_without_v2` (precedent `20261002132306_bondbuilder_research_profile_storage.sql`), aborting on unknown drift.
   - `ALTER TABLE product_leave_in_specs ADD COLUMN heat_activation_route …`; CHECKs `heat_activation_route_iff_required`, `heat_activation_pre_heat_only` (`NOT heat_activation_required OR (plan_roles = ARRAY['pre_heat_application'] AND 'pre_heat' = ANY(application_stage) AND NOT 'replacement_conditioner' = ANY(roles))`), added `NOT VALID` then `VALIDATE` (0 rows affected).
   - `CREATE OR REPLACE expand_leave_in_eligibility` (§2.5).
   - `CREATE OR REPLACE assert_personal_plan_curated_publication_v1_without_v2` with the §3 leave-in branch; add `product_leave_in_fit_specs` to the `validate_personal_plan_curated_publication_dependency` trigger table list.
2. `supabase/migrations/<ts2>_catalog_completeness_fill_slice3.sql` (data; **applied to production only after Nick approves the exact generated batch fingerprint**):
   - generated by `plans/catalog-completeness-fill/slice3/generate.ts` from the Neqi v1.2 adapter output + the HEAT&GLOW amendment + the protocol rows (§5.4); artifacts `slice3/{prestate.json, target-state.json, rollback.sql, verify.sql, artifact-manifest.json}` (slice1 layout).
   - CAS on every touched row against the S1 post-state (NULL fails closed); specs written in **one UPDATE per product** (the I2/I3 CHECK is immediate, so activation and plan_roles must change in the same statement); eligibility delete+insert of the literal rows **and** an in-migration assertion that they equal `expand_leave_in_eligibility(...)`; protocols upserted on `(product_id, category, role, application_family)`; provenance rows in `personal_plan_catalog_fact_evidence` (`heat_activation_required`, `heat_activation_route`, `plan_roles`, `roles` with verbatim quotes); fresh-DB skip (P08 precedent) when the products do not exist.
   - HEAT&GLOW's two `post_wash_leave_in` protocol rows are **kept unchanged** (not required by the gate once `plan_roles` drops post-wash; they keep 7 frozen routines rendering — see Q1).

---

## 3. Publication gate alignment (F05)

New leave-in branch of `assert_personal_plan_curated_publication_v1_without_v2` (facts part; the required-protocol CTE is unchanged and already maps `pre_heat_application → pre_heat_protection`, so an activated product needs exactly one `pre_heat_protection` protocol):

```sql
WHEN 'leave_in' THEN EXISTS (SELECT 1 FROM public.product_leave_in_specs li WHERE li.product_id = v_product.id
  AND li.weight IS NOT NULL AND to_jsonb(li)->>'care_direction' IS NOT NULL
  AND to_jsonb(li)->>'repair_support_level' IS NOT NULL
  AND COALESCE(pg_catalog.jsonb_array_length(to_jsonb(li)->'plan_roles'), 0) > 0
  AND COALESCE(pg_catalog.jsonb_array_length(to_jsonb(li)->'functional_benefits'), 0) > 0
  AND (('post_wash_leave_in' = ANY(li.plan_roles) AND 'towel_dry' = ANY(li.application_stage))
    OR ('pre_heat_application' = ANY(li.plan_roles) AND li.provides_heat_protection = true))   -- T1.1 parity: no pre_heat stage requirement
  AND (li.heat_activation_required = false OR (
        li.plan_roles = ARRAY['pre_heat_application']::text[]
        AND li.provides_heat_protection = true
        AND 'pre_heat' = ANY(li.application_stage)
        AND li.heat_activation_route IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM public.product_leave_in_fit_specs f
                        WHERE f.product_id = li.product_id AND f.conditioner_relationship <> 'booster_only'))))
```

Deferred-constraint test cases — `tests/leave-in-heat-activation-publication-gate-postgres.test.ts` (PGlite, migrations replayed in order; each case one transaction, assertion at `COMMIT`):

| Case | Row shape | Expected |
|---|---|---|
| A1 | curated+recommended, plan_roles `{pre_heat_application}`, hp `true`, stage `{towel_dry}`, activation `false`, verified V1+V2 `pre_heat_protection` protocol (Gliss/Redken heat-only shape) | **accepted** (T1.1 parity; rejected before this migration — pin both) |
| A2 | HEAT&GLOW shape: activation `true`/`airflow_shaping`, plan_roles `{pre_heat_application}`, stage `{towel_dry, pre_heat, dry_hair}`, roles `{styling_prep}`, fit `booster_only`, hp `true`, exact-workflow `pre_heat_protection` protocols; legacy `post_wash_leave_in` rows still present | **accepted** |
| A3 | Olaplex shape (post-wash + pre-heat, activation `false`) — regression | **accepted** |
| A4 | Neqi shape, `user_submitted`, not recommended, activation `true` + one pre-heat protocol | **accepted** (gate does not apply; CHECKs pass) |
| A5 | activation and plan_roles changed in **one** UPDATE inside a deferred transaction that also replaces the protocol | **accepted** |
| R1 | activation `true` + plan_roles `{post_wash_leave_in, pre_heat_application}` | **rejected** immediately (CHECK `heat_activation_pre_heat_only`) |
| R2 | activation `true` + stage without `pre_heat` | **rejected** (CHECK) |
| R3 | activation `true` + roles ∋ `replacement_conditioner` | **rejected** (CHECK) |
| R4 | activation `true` + route NULL / activation `false` + route set | **rejected** (CHECK `heat_activation_route_iff_required`) |
| R5 | curated+recommended, activation `true`, hp `false` | **rejected at COMMIT** (gate) |
| R6 | curated+recommended, activation `true`, fit `replacement_capable` (fit row edited alone) | **rejected at COMMIT** (gate via the new fit_specs dependency trigger) |
| R7 | curated+recommended, activation `true`, `pre_heat_protection` protocol deleted | **rejected at COMMIT** |
| R8 | curated+recommended, plan_roles `{pre_heat_application}`, hp `false`, activation `false` | **rejected at COMMIT** (regression) |
| R9 | two-statement order: set activation `true` first, plan_roles second | **rejected** at the first statement (documents why the executor uses one UPDATE) |
| L1 | lineage guard: tampered `prosrc` of either function before the schema migration | migration **aborts** |

Also extend `tests/personal-plan-curated-publication-gate-migration.test.ts` with A1/R8 as pins of the replaced branch.

---

## 4. Stage-3 changes (test-first; main session owns the design, Opus implements to green)

1. **Facts type** (`src/lib/personal-plan/products/authority/contracts.ts:107`): `Stage3LeaveInFacts.spec.heatActivation?: { route: "airflow_shaping" | "direct_contact_heat" | "either_heat" | null }` — **key present only when activation is required**.
2. **Catalog-facts mapping** (`authority/catalog-facts.ts:665`): `row.heat_activation_required === true` ⇒ `heatActivation: { route: text(row.heat_activation_route) }`; otherwise the key is omitted. (`select("*")` already returns the new column.)
3. **Fingerprint:** because the key is omitted when false, every non-activated leave-in's `factFingerprint` stays byte-identical (no churn for in-flight intents or stored `select_replacement` evidence; Proposal P10). Only the two S3 products get new fingerprints.
4. **Input:** `Stage3AuthorityInput.heatRoutes?: readonly ("airflow_shaping" | "direct_contact_heat")[]`, built from `snapshot.assessments.heatExposure.events` by one helper (`stage3HeatRoutesFromSnapshot`, next to `heatEventsFromNeedSnapshot` in `src/lib/personal-plan/oil-heat-context.ts`) at every builder: `src/lib/personal-plan/products/production-persistence-gateway.ts`, `src/lib/personal-plan/product-previews.ts`, `src/lib/personal-plan/products/fit-comparison.ts`, `src/lib/discovery/equal-options.ts`, `src/lib/scan/resolve-verdict.ts` (+ `load-scan-verdict.ts`), `src/lib/mobile/scan-service.ts`. If S2's typed profile slice has merged, add the field to that slice instead of a parallel parameter.
5. **Defensive guard** in `categories/leave-in.ts` `evaluateFacts`, placed **before** the role check (L71) so DB drift cannot reopen the hole and the user sees the specific reason:
   - activation + role `post_wash_leave_in` → `mismatch`, criterion `leave_in.heat_activation` „Hitzeaktivierung": „Wirkt erst mit Hitze – nicht als Leave-in nach jeder Wäsche gedacht."
   - activation + role `pre_heat_application` + `route === null` → `unknown`, missing `heat_activation_route`.
   - activation + role `pre_heat_application` + `heatRoutes` undefined → `unknown`, missing `heat_routes` (fail closed).
   - activation + route not served by `heatRoutes` (Q3) → `mismatch`: „Wirkt erst beim Föhnen – passt nicht zu deinem Styling ohne Föhn." (`direct_contact_heat`: „Wirkt erst mit Glätteisen oder Lockenstab – passt nicht zu deinem Styling.")
   - otherwise fall through (hp check, weight, repair, care direction unchanged).
6. **Scan readiness** (`src/lib/product-intake/scan-catalog-readiness.ts:114`): activation ⇒ roles `[pre_heat_application]` only (today always adds `post_wash_leave_in`, which would demand a post-wash protocol for Neqi).
7. **Heat carrier coverage:** unchanged (hp only); pinned by a test.
8. **Authority version:** no bump (`personal-plan.leave-in.v3` stays). The category target shape and `buildLeaveInDecision` are unchanged; evaluator changes apply on the next evaluation, as T1.1 did. Pin with `stage3-authority-schema-contract.test.ts` staying green.

---

## 5. Bespoke guidance (F09)

### 5.1 Workflow id and registration

One generic reviewed workflow, analogous to `bondbuilder_verified_product`: **`heat_activated_verified_product`**.

| File | Change |
|---|---|
| `src/lib/routines/personal-plan/application/contracts.ts:99` | add id to `EXACT_APPLICATION_WORKFLOW_IDS_V2`; V1 `applicationGuidanceProtocolSchema.superRefine`: workflow ⇒ `scope.kind product`, `scope.category ∈ HEAT_ACTIVATED_WORKFLOW_CATEGORIES` (today `["leave_in"]`), `role heat_protection`, family ∈ {`pre_heat_damp`, `pre_heat_dry`}, anchor `damp_leave_on`/`dry_pre_heat` with `before ∋ heat_tool`, exactly one `apply_product`, ≥1 `tool` after it, no `rinse`, ≥1 `evidence.sourceType = manufacturer` |
| `contracts-v2.ts:72` | `EXACT_WORKFLOW_FAMILIES.heat_activated_verified_product = ["pre_heat_damp","pre_heat_dry"]`; pointer superRefine: `sourceRole pre_heat_protection`, `role heat_protection`, `facts.heat.activationRequired === true`, `facts.heat.supportedStates` = exactly the family's state, `facts.rinse leave_in`, step rules as V1, manufacturer evidence |
| `compiler-v2.ts:192` `exactProtocol` | heat branch for this workflow mirroring `composeHeatProtocols`: runtime family `damp_hair_protection`/`dry_hair_protection`, `requiredProfileFacts ["heatEvents"]`, anchor per family; `compatibleDayTypes`: damp → wash-family days + `styling_day` (no `refresh_day`/`between_wash_care_day`: both manufacturers say freshly washed/towel-dried hair); dry → `["refresh_day"]` |
| `compiler.ts:866` `materializeHeatOccurrences` + `day-type-registry.ts:121` `heatOccurrenceBelongsToDay` | items carrying `catalogFacts.heatActivationRoute`: compatible events by **route** (airflow for both products) instead of by state; a dry-state activation occurrence belongs to `refresh_day` only |
| `compiler-v2.ts:420` `withUniversalBetweenWashMethods` | skip universal between-wash methods for activated products (catalog fact `heatActivationRequired`), so no generic dry/damp refresh copy is generated for them |
| `product-protocol-adapter.ts:30,59` | bind like Bondbuilder: keep the pointer/payload only with non-empty `source_text` and an evidence `sourceUrl` equal to `source_url`, role `pre_heat_protection` |
| `src/lib/product-intake/catalog-enrichment/stage5-v2-builder.ts:285` | `activationRequired` from the **catalog fact** (V1 `protocolFacts.heatActivationRequired`, set by the generator) instead of the `/aktivier/` copy regex; exact steps copied when `workflowId` is set (exists) |
| `src/lib/routines/personal-plan/application/catalog-facts.ts:44` + `personal-plan/routine/application-adapter.ts:95` | add `heatActivationRoute` next to the existing `heatActivationRequired` fact; first real consumer of both |

### 5.2 Neqi Diamond Glass Ultimate Styling Spray — 1 protocol row

Source (C2, neqi-hair.com, fetched 2026-10-09), verbatim `source_text`: „1. Das Haar in Abschnitte unterteilen. 2. Das Spray großzügig und gleichmäßig auf das handtuchtrockene (nicht nasse) Haar sprühen. 3. Anschließend die einzelnen Partien mit Hitze und auf Spannung föhnen." Activation statement: „Noch mehr hitzeaktivierte Polymere als im goldenen Diamond Glass Styling Spray". Heat claim (separate, hp): „Styling + intensiver Hitzeschutz (bis 230°) in einem".

Row: role `pre_heat_protection`, family `pre_heat_damp`, `application_state damp`, placement `lengths_ends`, `rinse_action leave_in`, `reapplication required` (P7 app rule, unchanged), amount `{qualitative: generous}` („großzügig").

| stepKey | action | copyDe | Source sentence |
|---|---|---|---|
| `section` | section | Das handtuchtrockene Haar in Partien teilen – es sollte nicht mehr nass sein. | „Das Haar in Abschnitte unterteilen." + „handtuchtrockene (nicht nasse) Haar" |
| `apply` | apply_product | Das Spray großzügig und gleichmäßig auf jede Partie sprühen. | „Das Spray großzügig und gleichmäßig … sprühen." |
| `activate` | tool | Jede Partie mit Hitze und unter Spannung föhnen. Erst die Wärme aktiviert das Spray. | „Anschließend die einzelnen Partien mit Hitze und auf Spannung föhnen." + „hitzeaktivierte Polymere" |

Deliberately **not** carried over: the R4 shared copy „Glätteisen oder Lockenstab nur auf komplett trockenem Haar …" (not in Neqi's directions; „Styling mit Föhn oder Glätteisen" is an „Ideal für"-bullet, not a direction). No post-wash protocol for Neqi.

### 5.3 Pantene HEAT&GLOW — 2 exact rows (+ 2 legacy post-wash rows kept, see Q1)

Source (C1, current German pack back, DE/AT/CH, P&G Schwalbach; read from the dm-hosted packshot, r1): „1-2 Pumpstöße auf das gereinigte Haar auftragen. / Föhnen, um zu aktivieren. / Zwischen den Haarwäschen nutzen, um Frizz zu kontrollieren." Front: „Hitzeaktivierte Formel für extra Pflege". The pack names no separate dose for the between-wash use; the UK retailer „one pump on dry hair" is not German pack text and is excluded (D-d).

**Row 1 — wash day** (replaces today's Boots-sourced `pre_heat_protection`/`pre_heat_damp` row): `application_state damp`, `reapplication required`, amount `{pumps 1–2}`.

| stepKey | action | copyDe | Source sentence |
|---|---|---|---|
| `apply` | apply_product | 1–2 Pumpstöße im frisch gewaschenen Haar verteilen. | „1-2 Pumpstöße auf das gereinigte Haar auftragen." |
| `activate` | tool | Danach föhnen – erst die Wärme aktiviert die Pflege. | „Föhnen, um zu aktivieren." + „Hitzeaktivierte Formel für extra Pflege" |

**Row 2 — between washes** (new `pre_heat_protection`/`pre_heat_dry`, `application_state dry`, refresh days with a blow-dry event; amount `null`):

| stepKey | action | copyDe | Source sentence |
|---|---|---|---|
| `apply-between-washes` | apply_product | Zwischen den Haarwäschen gegen Frizz: die Creme im trockenen Haar verteilen. | „Zwischen den Haarwäschen nutzen, um Frizz zu kontrollieren." |
| `activate` | tool | Danach föhnen – erst die Wärme aktiviert die Pflege. | „Föhnen, um zu aktivieren." (applies to this use per D-c) |

„kurz föhnen" is Nick's D-c wording, not pack text; it is left out to stay manufacturer-only — add it only if Nick wants it.

### 5.4 Row mechanics (both products)

`source_url` = the C1/C2 URL, `source_label` names the tier („Neqi Hersteller (neqi-hair.com)", „Pantene-Packung DE (Rückseite), Foto via dm"), `source_text` verbatim; V1 `guidance_payload` (`schemaVersion 1`, `exactGuidanceRequired true`, `protocolFacts.workflowId heat_activated_verified_product`, `protocolFacts.heatActivationRequired true`, family/anchor as §5.1, `compatibleDayTypes` mirroring the V2 runtime) and V2 `guidance_payload_v2` built by `buildProductApplicationPointerV2` from the V1 payload (so V1/V2 agree by construction); evidence: the manufacturer source first (`sourceType manufacturer`), dm as `retailer` corroboration. German copy reviewed by Opus against `feedback_german_copy_idiomatic` (no archaic imperatives; infinitive constructions as in the existing templates).

---

## 6. Styling reuse contract

What the Styling category (`.worktrees/styling-concept/plans/styling-concept/01-styling-concept.md` §3.1 property 10 `heat_activated`, subtype `smoothing_styler`; draft PR #656) consumes from S3, unchanged:

1. **Evidence rule HA-1…HA-9** as a category-agnostic text (the overlay states it once; the Styling standard cites it by section and sha). Mapping: Styling `heat_activated: yes` = `required`, `no` = `not_required`, `unresolved` = HA-5 (stays in the research queue, never projected).
2. **`src/lib/heat-activation/contract.ts`**: capture schema, routes, `heatActivationRouteServes`. Styling stores `heat_activated` + `heat_activation_route` in its own spec table; it does not read leave-in columns.
3. **Separation rule:** activation never fills the heat-protection role; Stage-3 heat carrier coverage reads `providesHeatProtection` only (matches Styling rule "a styling product never counts as heat protection" and Heat-Protectant decision).
4. **Routine:** workflow `heat_activated_verified_product` with `HEAT_ACTIVATED_WORKFLOW_CATEGORIES` extended to `styling` when that category exists (and its semantic role added to the superRefine); the route-based heat occurrence placement (§5.1) applies unchanged.
5. **Stage-3 guard semantics:** activated product + user without the activation route → mismatch with the same German reasons.

Not reused: Leave-In's I2–I5 (plan-role restrictions are leave-in specific). Cross-program note for Styling (not an S3 decision): D-f hands Garnier Sleek & Stay to Styling as a heat-activated smoothing styler, while Styling ruling D2 keeps products named „Serum" in Oil, and `oil/decision.md` forbids heat-activation fields on Oil. The contract above is category-agnostic, so S3 works whichever home Nick confirms.

---

## 7. Ordered tasks

Routing: Sonnet for mechanical edits, Opus for German copy, the overlay's normative text and the generator; main session owns T3.1/T3.6 test design, integration and every review.

**T3.0 Rebase + inventory.** Merge `origin/main` (+ S2 if merged); confirm S1 applied; recapture prestate of `42a2fe20`, `e781ca9e` (specs, fit, eligibility, protocols, provenance) and a fresh reference inventory (owners, drafts by status, active routines by role).
- Consumes: S1 post-state. Produces: `slice3/prestate.json`, `slice3/reference-inventory.json`.
- Done: prestate matches S1 `target-state.json` for both products; inventory recorded (today: 7 active routines with HEAT&GLOW post-wash).

**T3.1 Shared contract (test-first).** `src/lib/heat-activation/contract.ts`.
- Tests: `tests/heat-activation-contract.test.ts` — `required needs a C1/C2 activation statement and a C1/C2 heat-step direction`, `retailer-only activation wording cannot create required`, `cross-market C2 is not admitted`, `option-list direction with an air-dry alternative is not_required`, `route null iff not_required`, `either_heat serves any route`.
- Produces: schema + helpers for T3.3/T3.4/T3.6/T3.7.

**T3.2 Standard v1.2 docs.** Overlay, README rows, `docs/personal-plan/categories/leave-in/decision.md:266` amended („`heat_activation_required` is a fit axis since Leave-In v1.2: an activated product serves only `pre_heat_application`, never post-wash or conditioner replacement; activation is separate from heat protection"), `docs/product-application-protocol-templates.md:889` TPL-LEAVEIN-HEAT rule made normative + new section „Exact workflow `heat_activated_verified_product`", adapter doc, `plans/leave-in-inci/adapter-decisions.md` AD-7, prompt contract.
- Done: `leave-in-research-v1-2-lock.test.ts` (T3.3) pins the overlay sha; docs reference only existing paths.

**T3.3 v1.2 lock + calibration.** `build-v1.2-calibration.ts`, 11 re-stamped envelopes, expected projections, manifest, lock receipt, Lab fixture; re-stamped Aussie/Balea/Bali envelopes under `research/r4-user-submitted-14/leave-in-v1.2/`; Neqi v1.2 envelope.
- Tests: `tests/leave-in-research-v1-2-lock.test.ts` (manifest hashes, base + v1.1 overlay byte-identical), `tests/leave-in-production-adapter-calibration.test.ts` (`v1.2 changes only slot 13`).
- Done: only slot 13's projection differs from v1.1.

**T3.4 Adapter + intake.** §2.4.
- Tests (red first) in `tests/leave-in-production-adapter.test.ts`: `v1.1 envelope is refused under v1.2`, `activation projects pre_heat_application only with styling_prep and booster_only`, `activation without heat protection refuses with the Styling reason`, `activation without a pre_heat stage refuses`, `non-activated projection is byte-identical to v1.1`, `requiredProtocolRoles is pre_heat_protection only for activation`; `tests/leave-in-product-intake-adapter.test.ts` + validator case for the route CHECK mirror.

**T3.5 Schema migration (SQL) + gate.** §2.5, §2.6(1), §3.
- Tests: `tests/leave-in-heat-activation-publication-gate-postgres.test.ts` (A1–A5, R1–R9, L1), `tests/leave-in-eligibility-expander-parity-postgres.test.ts` (`TS and SQL expanders agree on the activation × protection × stage matrix`, `all 68 live-shaped leave-in fixtures keep identical rows`), update `personal-plan-curated-publication-gate-migration.test.ts`.
- Done: full migration replay green in PGlite.

**T3.6 Stage-3 (test-first).** §4.
- Tests in `tests/personal-plan/products/stage3-authority.test.ts`: `activated leave-in is a mismatch for post_wash_leave_in with the Hitzeaktivierung reason`, `activated leave-in is ideal for pre_heat_application when the user blow-dries`, `activated leave-in is a mismatch for a straightener-only user` (Q3), `missing heat routes yield unknown`, `activated product never selected as the post-wash default among candidates`; `stage3-catalog-facts.test.ts`: `non-activated fingerprint is byte-identical to the pinned pre-S3 value`, `activated spec carries heatActivation.route`; heat-carrier test: `activation without protection is no heat carrier`; `tests/scanner-catalog-coverage-readiness.test.ts`: `activated leave-in needs only the pre-heat protocol`; `tests/scan-resolve-verdict.test.ts`: `Neqi scan for a no-heat profile shows the activation reason`, `… for a blow-dry profile evaluates the pre-heat role`; builder parity test asserting all six builders pass `heatRoutes`.

**T3.7 Guidance.** §5.1 registration + §5.2/5.3 copy.
- Tests: `tests/personal-plan-stage5-compiler-v2.test.ts` — `heat_activated_verified_product compiles to damp_hair_protection with the three Neqi steps on a wash day with a hair-dryer event`, `HEAT&GLOW dry variant appears only on refresh days with a blow-dry event`, `no universal between-wash methods for activated products`, `straightener-only profile yields no Neqi occurrence`; `tests/personal-plan-stage5-v2-builder.test.ts` — `activationRequired comes from the catalog fact, not the copy`, `exact steps survive V1→V2`; contract tests for every superRefine rule (wrong family, missing tool step, rinse step, no manufacturer evidence, category not allowed); `tests/application-catalog-rows-v2.test.ts` — binding filter; a V1 compile case mirroring the live Redken `2b7db7e3` pre-heat row family resolution.

**T3.8 Display + chat + legacy.** `src/components/chat/product-display-model.ts:532`: activation checked first → „Wirkt erst mit Hitze" (instead of „Booster nach dem Conditioner"); admin page label; remove the ingest name heuristic.
- Tests: `tests/product-display-model.test.ts` (`activated leave-in shows Wirkt erst mit Hitze`), `tests/recommendation-engine-selection.test.ts` (`no heat need → activated leave-in is a hard mismatch` — existing behaviour pinned).

**T3.9 Data generator + rehearsal.** §2.2, §2.6(2), §5.2–5.4.
- Consumes: T3.3 Neqi envelope, HEAT&GLOW amendment, T3.4 adapter, T3.7 payload builders. Produces: `<ts2>_catalog_completeness_fill_slice3.sql`, `slice3/*`.
- Tests: `tests/catalog-completeness-fill-slice3-postgres.test.ts` — seeded S1 post-state: migrate → `verify.sql` passes → rollback → prestate restored → reapply → tamper one prestate cell → abort; plus `assert_personal_plan_curated_publication(e781ca9e)` passes after apply; Stage-5 rendering of the generated rows through `adaptReviewedProductApplicationPointersV2` + `compileApplicationViewV2`.

**T3.10 Verify, review, apply.**
- `npm run ci:verify`; targeted suites above; `npm run catalog:authority:audit -- --pretty --allow-issues`, `npm run personal-plan:stage3:coverage-audit`, pointer-coverage audit (before/after, no new findings).
- Local flow (`docs/local-qa-access.md`, `npm run dev:worktree`): Anwendung for a test profile with HEAT&GLOW in the pre-heat slot + hair dryer → wash day shows the two steps, a refresh day shows the between-wash variant; Neqi scan with a no-heat profile and with a blow-dry profile; Personal Plan for a no-heat profile never offers HEAT&GLOW post-wash.
- One Codex whole-branch review (`codex:codex-rescue`, read-only). Then `/ship`.
- Production: schema migration ships with the deploy; the data migration is applied only after Nick approves the exact generated batch fingerprint. Postflight: before/after reads of both products match `target-state.json`; Stage-3 replay of a blow-dry heat profile picks HEAT&GLOW (normal hair) for pre-heat and nothing activated for post-wash; the 7 frozen routines still render (no `catalog_identity_mismatch`); Sentry check (`haircare-fw/hair-concierge`, last hour) after deploy and after apply.

**Risks**
- Frozen plans: 7 active routines show HEAT&GLOW as plain post-wash until Q1 is acted on; deleting its post-wash protocol rows would break their Anwendung (live read by product+role) — kept on purpose.
- Envelope refusal ripple: any v1.1 envelope still in the intake queue is refused after deploy; T3.3 re-stamps all known ones (11 + 3 + Neqi). Check the intake queue for pending leave-in envelopes at T3.0.
- Heat-occurrence placement is fragile (Nomi T6 history): keep the change gated on `heatActivationRoute` so non-activated items are untouched; the existing compiler suites must stay green unchanged.
- Function lineage: other branches (S2, Shampoo v1.6, Styling) may redefine `assert_personal_plan_curated_publication_v1_without_v2`; the digest guard aborts rather than overwrite — rebase and re-pin.
- HEAT&GLOW's C1 evidence is a retailer-hosted pack photo; if the pack changes, re-capture before apply.
- Residual ledger (F17): HEAT&GLOW's other legacy fields (care_direction `moisture`, functional_benefits, roles history) were never engine-researched; under T20 its care direction would likely read `balanced` — out of S3 scope, listed for a later Leave-In research batch.

---

## 8. Proposals (one recommendation per technical choice)

| # | Choice | Recommendation | Why |
|---|---|---|---|
| P1 | Field shape | Keep `heat_activation_required` boolean, add `heat_activation_route` | Existing column, CHECK and readers stay; the route is needed for routine placement and the Stage-3 guard |
| P2 | Evidence rule | Directions-led with a C1/C2 gate (incl. house brand rule 6, excl. T14 cross-market) | D-d says "German page or pack"; directions model keeps T9 closed |
| P3 | v1.1 envelopes | Refuse under v1.2; re-stamp the calibration set and the three S1 envelopes | Missing capture must not default to "not activated" (§1.1 fails toward review) |
| P4 | Version strings | Bump policy/model to v1.2; keep envelope `v1.0` and adapter `v1` labels | T20/AD-6 precedent; avoids touching the intake worker and API |
| P5 | HEAT&GLOW | Field-scoped activation amendment, not a full engine run | A full run would also move care direction and other legacy values outside S3; recorded as residual |
| P6 | Activation without protection | Leave-In refuses the projection; gate rejects publication | No Leave-In plan role exists for it; Styling owns such products |
| P7 | Roles/badge | `roles = {styling_prep}`, fit `booster_only`, display „Wirkt erst mit Hitze" | A2: never a conditioner replacement; avoids the misleading „Booster nach dem Conditioner" |
| P8 | Eligibility | `heat_protect` bucket from protection only; activation emits `heat_style` rows for its care buckets | Separation (D-e) and keeps the product findable in chat for heat stylers |
| P9 | Enforcement | Row-local invariants as table CHECKs; cross-table (fit, hp, protocol) in the deferred gate; add fit_specs to dependency triggers | Fails at the first wrong write; gate covers commit-time bundles |
| P10 | Fingerprint | Spec key only when activated | Zero fingerprint churn for 66 products and stored decisions |
| P11 | Authority version | No bump | Target shape unchanged; same as T1.1 |
| P12 | Workflow id | One generic `heat_activated_verified_product` | Reusable by Styling; per-product ids do not scale |
| P13 | HEAT&GLOW between-wash use | Second exact row `pre_heat_dry`, shown on refresh days with a blow-dry event | Faithful to the pack; a note step on the wash day would mix two uses in one block |
| P14 | Apply lane | Guarded one-shot data migration + PGlite rehearsal (S1 pattern) | Two products; an executor function adds surface without reuse |
| P15 | V2 activation fact | From the catalog fact, not the `/aktivier/` copy regex | The regex is a heuristic; the property now exists |
| P16 | HEAT&GLOW post-wash rows | Keep, unrequired, until Q1 is decided | Seven live routines read them |

## 9. Questions for Nick

**Q1 — Seven members already have HEAT&GLOW as their everyday after-wash leave-in.** Example: a member with normal hair who air-dries got HEAT&GLOW as „Leave-in nach der Wäsche" in her plan. After S3 the plan never picks it for that slot again, but her existing plan stays as it was until she next updates it. Options:
(a) leave the 7 plans as they are until their next update (recommended — matches how S1 handled Pantene 7in1; nothing breaks);
(b) leave them, but change their instructions to „1–2 Pumpstöße verteilen, danach föhnen" — this tells air-dryers to blow-dry;
(c) give them a different after-wash leave-in now — needs a plan-update mechanism for catalogue changes that does not exist yet (own follow-up).

**Q2 — Should the plan actively recommend Neqi's styling spray?** Today it is a user-submitted product: people who scan or own it get a verdict and, after S3, the right steps; the plan never suggests it. Making it a plan pick means curating it (price, shop link, Chaarlie-recommended). Recommendation: not in S3 — S3 makes its scan verdict and instructions correct; promotion is a separate catalogue decision.

**Q3 — Only for people who blow-dry?** Both products say „föhnen" to activate. Example: someone who only uses a straightener on dry hair would buy HEAT&GLOW and never activate it. Recommendation: offer heat-activated products only when the profile includes blow-drying (hair dryer, dryer brush or hot-air styler); straightener-only users get a regular heat protector.
