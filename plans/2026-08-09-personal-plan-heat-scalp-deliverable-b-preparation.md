# Personal Plan Heat and Scalp catalog follow-up — B0 preparation

**Status:** hardened and executable in the Deliverable-A worktree

## 1. Outcome and source context

Turn the seven Heat Protectant and eight Drogerie Scalp Care stubs from Deliverable A into exact, reviewed, fail-closed new-product packages with full Product Intake payloads, specs, protocols, commercial state, and Nick-approved images. This preparation makes the later catalog-data PR fast without pretending its integration base or production schema is ready.

This plan consumes:

- `plans/2026-08-09-personal-plan-catalog-enrichment.md` and its Deliverable-A manifests;
- the Heat and Scalp category decisions under `docs/personal-plan/categories/`;
- `docs/product-intake-research-ops.md`;
- Nick's 2026-08-09 decisions: all seven Heat products become active rows; unavailable Heat products remain non-recommended; use only the already-narrowed eight-product Drogerie Scalp cohort; review raw images and final images separately by category; unresolved images block only their product;
- Nick's later explicit decision to move the exact Head & Shoulders Derma X Pro Kopfhaut-Feuchtigkeitspflege from the screenshot's flake/oil column to `scalp_comfort` after reviewing the exact manufacturer-evidence conflict.
- Nick's final data decisions: use current availability for Taft x Gliss Lovely Long; accept Rossmann-backed Jean&Len GTIN `4262500781476`; add `manufacturer_sku` for official maker codes; use The Ordinary manufacturer SKU `100434` plus retailer-backed EAN `769915195910`; recommend every approved available Heat/Scalp product while keeping unavailable Heat products active and non-recommended.

Current read-only checks on 2026-08-09 confirmed that production has the legacy Heat category only, no Scalp Care category, none of the three required Heat/Scalp/protocol tables, and no exact identifier duplicate among the 15 products. Those facts are freshness evidence, not permission to write.

## 2. Chosen direction

Stay in `.worktrees/personal-plan-catalog-enrichment` for B0. Do not merge or transplant the Stage-4/5 stack into this dirty, task-owned Deliverable-A worktree.

Harden the manifest contract so each `new_product` record includes an exact allowlisted **catalog-content input** for the future product insert. Keep this content validation in B0 so recommendation and availability contradictions fail during authoring, while B1 still owns live foreign-key resolution, uploaded-image URL resolution, and the executable insert. The validator derives the catalog-content input from the **normalized** standard Product Intake final payload plus explicit catalog state and requires the planned input to match it exactly.

The B0 field map is explicit:

```text
name = product.clean_name
brand = product.canonical_brand
category = product.category_key
affiliate_link = product.affiliate_link
purchase_link_status = product.purchase_link_status
purchase_link_checked_at = product.purchase_link_checked_at
price_checked_at = product.price_checked_at
price_eur = product.price_eur
currency = product.currency
image_asset_path = image.expected_storage_path
image_sha256 = image.final_sha256
image_url = unresolved until the approved asset is uploaded and verified in B1
brand_id = unresolved canonical_brand lookup in B1
product_line_id = unresolved optional product_line lookup in B1
```

The catalog state lives in a required strict `catalog_state` manifest object and maps without inference:

```text
origin = curated
is_active = true
lifecycle_status = active
is_chaarlie_recommended = <reviewed boolean>
```

This is deliberately not represented as a literal database row. B1 must resolve the two foreign keys and the final `image_url`, then equality-check the executable row against this reviewed content input and fail on ambiguity, drift, missing upload verification, or a changed image hash.

All 15 packages remain `is_chaarlie_recommended=false` while B0 research or image review is incomplete. Only the exact final content fingerprint may later carry `true` for a currently available, evidence-cleared product after Nick approves its data and final image.

### Frozen Heat state

All seven become `new_product` packages for active curated rows.

- Balea Ultralight, Jean&Len beat the heat, got2b Schutzengel, L'Oréal Elvital Dream Length Defeat the Heat, and Taft x Gliss Lovely Long are German-available at the approved checkpoint and carry `is_chaarlie_recommended=true` in the exact approved B0 content.
- Taft Aloe Boost Hydra Protect and Balea 2-Phasen are active catalog rows with `purchase_link_status=unavailable` and `is_chaarlie_recommended=false`. This active-but-non-recommended policy was explicitly selected by Nick. Later availability requires a fresh human-reviewed content fingerprint and never promotes automatically.

### Frozen Scalp state

Use only these eight Drogerie products; no Highend product or other screenshot candidate enters B0.

- `scalp_comfort`: Balea Professional Kopfhautpflege Serum Sensitive; Eucerin DermoCapillaire Urea Intensiv-Tonikum; Head & Shoulders Derma X Pro Kopfhaut-Feuchtigkeitspflege.
- `scalp_flake_oil_adjunct`: GLISS Scalp Balance Klärendes Serum.
- `density_claim_tonic`: L'Oréal Paris Elvital Fiber Booster Anti-Haarverlust Serum; The Ordinary Multi-Peptide Serum for Hair Density.
- `scalp_exfoliant`: Balea Professional Kopfhautpflege Peeling Tiefenreinigung; ISANA Professional Kopfhautpeeling Tiefenreinigung.

Evidence treatment:

- Eucerin is supported as a cosmetic by explicit pharmacy Pflichtangaben; retain medical-adjacent limitations and no treatment behavior.
- The Ordinary's official exact page and `manufacturer_sku=100434` resolve manufacturer identity; retailer-backed EAN `769915195910` is retained with its provenance rather than represented as a manufacturer-confirmed GTIN.
- the current visible official Balea and ISANA directions do not state repeat cadence; both use the previously approved, clearly attributed Hair Concierge `as_needed` fallback.
- density products retain the adjacent limited-evidence statement and never become treatment or regrowth claims.
- All eight approved Scalp products were available at the reviewed checkpoint and carry `is_chaarlie_recommended=true` within the settled cosmetic/limited-evidence boundaries.

## 3. Scope and non-goals

### In scope

- exact manifest support for curated lifecycle and recommendation state and the strict B0 catalog-content field map;
- authoring 15 full standard Product Intake final payloads from the current stubs;
- reclassifying the eight Scalp manifests and Balea 2-Phasen from zero-operation provisional candidates to `new_product`;
- exact product insert, identifier, category-spec, and role-keyed protocol proposals;
- live duplicate and current German commercial refresh;
- raw source review boards, local processing only after raw approval, magenta QA, final `1200x1200` WebP review, expected storage paths, and SHA-256 values;
- fail-closed preview and focused verification.

### Non-goals

- the accepted Stage-5/current-main integration base;
- migration renumbering, schema/type/consumer changes, or an apply executor;
- Mask or other existing-category enrichment;
- Highend or additional Scalp candidates;
- category policy, ranking, symptom, safety, or user-facing copy changes;
- synthetic submissions, user usage, notifications, image upload, catalog write, deployment, activation, commit, push, or PR.

The later B1 work is governed by `plans/2026-08-09-personal-plan-heat-scalp-deliverable-b-integration-gate.md` and is deliberately non-executable until its base gate clears.

## 4. Target map

- `plans/2026-08-09-personal-plan-heat-scalp-deliverable-b-preparation.md`
- `plans/2026-08-09-personal-plan-heat-scalp-deliverable-b-integration-gate.md`
- `src/lib/product-intake/catalog-enrichment/**`
- `tests/product-intake-catalog-enrichment*.test.ts`
- `data/catalog-enrichment/personal-plan-launch-v1/manifest.schema.json`
- `data/catalog-enrichment/personal-plan-launch-v1/heat/*.json`
- `data/catalog-enrichment/personal-plan-launch-v1/scalp/*.json`
- `data/catalog-enrichment/personal-plan-launch-v1/README.md`
- ignored `ops/catalog-enrichment/personal-plan-launch-v1/{heat,scalp}/**`

## 5. Designed operator journey

There is no end-user surface, copy, timing, or feedback change, so no user-facing mockup is required.

1. Nick reviews the Heat raw-image board and approves or rejects each exact source.
2. Nick reviews the Scalp raw-image board. A blocked or rejected image returns only that product to search.
3. Only approved raw sources enter local processing. Each produces a clean cutout, magenta QA, neutral catalog preview, final `1200x1200` WebP, and SHA-256.
4. Nick reviews the final images beside current catalog examples. Any correction invalidates that product's old image and content fingerprint.
5. Nick reviews each product's exact identity, commercial state, curated lifecycle/recommendation values, identifiers, spec, protocol, limitations, and final image hash.
6. The non-writing preview shows the exact insert/spec/protocol proposal and every remaining blocker. It cannot upload, publish, link, notify, deploy, or activate anything.
7. B0 finishes as reviewed packages ready to transplant onto the future accepted B1 base.

**Operator-journey sign-off:** confirmed by Nick on 2026-08-09 through the final alignment walkthrough and explicit `go then` instruction.

## 6. Planning evidence

- reviewed Deliverable-A manifests and preview tooling;
- Nick's Drogerie screenshot reconciled to the exact eight-product Scalp set;
- current external evidence pass for Eucerin, Head & Shoulders, The Ordinary, Balea, and ISANA;
- current read-only live migration/table/category and exact-identifier duplicate checks;
- current Git ancestry proving the Deliverable-A worktree is not a safe Stage-5 integration base;
- local Heat and Scalp raw-image review boards produced under ignored operator paths.

No user-facing evidence is applicable. Raw and final image boards are operator evidence and remain subject to Nick review.

## 7. Ordered tasks

### Task 1 — Harden curated product insert validation test-first

**Consumes:** current manifest validator and the standard Product Intake final payload validator.

**Produces:** normalized, allowlisted curated product insert validation and preview.

- Add failing tests for missing/contradictory origin, active lifecycle, recommendation state, commercial state, and final product payload.
- Reject `purchase_link_status=unavailable` with `is_chaarlie_recommended=true`.
- Add a required strict `catalog_state` object for `origin`, `is_active`, `lifecycle_status`, and `is_chaarlie_recommended`.
- Derive the expected catalog-content input from the normalized Product Intake payload, `catalog_state`, and reviewed local image metadata using the field map in section 2, then compare the planned input to that normalized result.
- Require `commercial.status` to equal `product_payload.final.product.purchase_link_status`; reject drift between the descriptive dossier state and the strict Product Intake enum.
- Keep `brand_id`, `product_line_id`, and `image_url` explicitly unresolved in B0; no placeholder UUID or URL is accepted.
- Keep shared category spec/protocol operations derived and equality-checked.
- Keep preview non-writing and expose the exact catalog-content proposal plus the three B1 resolutions still required for the executable insert.

**Complete when:** red proof exists; malformed states fail closed; focused tests pass; no submission, user, notification, storage, or activation operation is allowlisted.

### Task 2 — Author and refresh all 15 full packages

**Consumes:** hardened manifest contract, current dossiers, current German sources, live duplicate evidence.

**Produces:** 15 exact `new_product` manifests with complete standard Product Intake final payloads and exact product/spec/protocol proposals.

This is not a metadata refresh. The current records are stubs: all 15 require full `product_payload.final` authoring; eight Scalp records and Balea 2-Phasen require reclassification and nonzero operations; all eight Scalp products require exact spec and protocol operations.

- Map descriptive commercial states to the strict `available|unavailable` product enum while retaining detailed limitations separately.
- Recheck identity, identifiers, duplicate absence, purchase URL, availability, price, and timestamps.
- Keep `origin=curated` and active lifecycle. After Nick's exact data and image approvals, set recommendation true only for the 13 available products and false for the two unavailable Heat products.
- Preserve unknown GTIN/cadence/claim facts rather than inventing them.
- For Head & Shoulders Derma X Pro Kopfhaut-Feuchtigkeitspflege, replace the stale `scalp_flake_oil_adjunct` value in both `primary_role` and every role-keyed application protocol with `scalp_comfort`.
- Reconfirm from the finished-product sources that every Heat product is a spray before retaining `format=spray`. The seven reviewed stubs currently agree; any contrary source is a B0 blocker and B1 schema decision, not a value to coerce through the literal-spray validator.
- Bind any later approval to the exact normalized content and asset fingerprint.

The active-but-non-recommended Heat decision has a low leak risk in the current runtime: general catalog, matching, relationship, and recommendation paths require `is_chaarlie_recommended=true`. The only intentional consumer exception is an exact product already matched to that user's owned inventory with verified specs. These new rows have no usage association in B0/B1. Preserve that boundary with fixtures asserting the three unavailable Heat rows have no `user_product_usage` operation or association, and later with an integration test proving they cannot enter general product/API/category output.

**Complete when:** all 15 previews pass structurally, show exact product/spec/protocol operations, bind Nick's exact image/data approvals, and are B0-ready while still exposing the named B1 foreign-key/image-URL integration gate.

### Task 3 — Review raw image candidates

**Consumes:** exact product identity and Product Intake image-source priority.

**Produces:** category-batched local Heat and Scalp boards with one renderable candidate or one honest blocker per product.

- Record source page/image URL, dimensions, format/alpha, exact variant check, and visible concerns.
- Do not process before Nick approves the raw source.
- A missing or rejected image blocks only that product.

**Complete when:** Nick has approved/rejected all candidates and every rejection is routed to targeted search.

### Task 4 — Process and review final images

**Consumes:** Nick-approved raw candidates.

**Produces:** cutouts, magenta QA, neutral previews, final `1200x1200` WebP assets, hashes, and approved/rework decisions.

- Inspect alpha before model removal and use Vision/rembg/shadow repair only as needed.
- Compare final images beside current catalog examples.
- Do not upload.
- Invalidate approval after any source, processing, or hash change.

**Complete when:** Nick approves every final image allowed to enter the database; unresolved images remain blocked.

### Task 5 — Verify and review the exact B0 tree

**Consumes:** complete manifests and reviewed local image artifacts.

**Produces:** exact B0 verification and whole-tree review receipts.

- Run `node --import ./tests/server-only-register.cjs --import tsx --test tests/product-intake-catalog-enrichment*.test.ts` for the focused manifest contract.
- Run `npm run products:intake:catalog-enrichment:preview -- <manifest>` once for each of the 15 manifest paths and retain the command/result matrix.
- Run deterministic index/fingerprint reconciliation, shared category/Product Intake regressions, targeted lint, typecheck as applicable, and diff checks.
- Verify all active/not-recommended states stay outside general recommendation eligibility.
- Run one whole-tree counterpart review on the exact content fingerprint and reconcile supported findings.

**Complete when:** no B0 blocker remains except explicitly pending Nick review or the named B1 integration gate.

## 8. Verification

### Automated

- curated insert positive and negative contract tests;
- all 15 manifest previews and deterministic fingerprint/index checks;
- shared Heat/Scalp spec/protocol validator equality tests;
- duplicate, stale-commercial, stale-image, and stale-review checks;
- focused Product Intake regressions, targeted lint/typecheck, and `git diff --check`.

### Manual/operator

- raw candidates exactly match product, variant, size, and market;
- final images pass magenta and neutral-background comparison;
- identity, catalog state, commercial fields, specs, protocols, limitations, and hashes are reviewable per product;
- preview contains no user/submission/notification/storage/activation operation.

### Evidence-sensitive

- finished-product/manufacturer evidence owns Heat capability and exact use;
- Scalp retains cosmetic/medical and escalation boundaries;
- density fit remains separate from efficacy;
- `as_needed` is labeled Hair Concierge fallback, never manufacturer cadence.

## 9. Review and handoff

- Worktree: `.worktrees/personal-plan-catalog-enrichment` on `codex/personal-plan-catalog-enrichment`.
- Tracked plan/tooling/manifests are later `commit` artifacts after review.
- Ignored source/final images and local boards are retained through review, then archived by Product Intake operations.
- Claude's transient plan review is discarded after findings reconciliation.
- Operator-journey sign-off and all 15 final-image plus exact-data approvals are confirmed and hash-bound in ignored operator receipts.
- Stop before commit, push, PR, merge, migration apply, image upload, catalog apply, deployment, production verification, or activation.

**Recommended execution:** author and verify all 15 approval-bound manifests, run the whole-tree readiness/review loop, and stop before the separately gated B1 integration or any external write.
