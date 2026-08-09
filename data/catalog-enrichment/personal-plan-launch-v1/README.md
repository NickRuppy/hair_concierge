# Personal Plan launch catalog enrichment

Prepared and approval-bound on 2026-08-09. This sanitized batch retains the Deliverable-A catalog audit and adds the guarded B0 Heat/Scalp packages. It contains no user data and performed no Supabase, storage, submission, image-upload, notification, migration, publication, deployment, or activation write.

Frozen manifest schema SHA-256: `9fccf18050da7e0432ede9a45a3ee27a1bc1a29e362e0d5a64077f86b47d5f66`.

## Batch result

| Category | Tracked records | Product scope | Current disposition |
| --- | ---: | --- | --- |
| Heat Protectant | 7 | Exact approved Drogerie cohort | Five available/recommended; two unavailable but active/non-recommended; all seven B0 packages are approval-bound |
| Scalp Care | 8 | Exact approved Drogerie cohort across four roles | All eight available/recommended within the reviewed cosmetic and limited-evidence boundaries |
| Mask | 35 | All active recommended products | Exact-row verification complete; blocked on finished-product repair/protocol evidence |
| Conditioner | 43 | All active recommended products | Exact-row integrity verification complete; no enrichment shortage found |
| Deep Cleansing | 5 | Exact named launch cohort | Existing rows/specs verified; protocol schema remains blocked |
| Dry Shampoo | 10 | All active recommended products | Existing rows/specs verified, including Balea foam and got2b liquid |
| Bondbuilder | 3 | Epres, K18, and OLAPLEX No.3PLUS primaries | Existing rows verified; No.0 stays companion and legacy No.3 stays ineligible |
| Shampoo | 1 audit | 49 active recommended products | Coverage audit only; no finite upload cohort invented |
| Leave-in | 1 audit | 42 active recommended products | Coverage audit only; no finite upload cohort invented |
| Oil | 1 audit | 41 active recommended products | Coverage audit only; no finite upload cohort invented |

The deterministic integration check produces 114 unique keys: 15 `new_product`, 96 `verification_only`, and 3 coverage-only `excluded` records. The seven Heat and eight Scalp packages contain only the allowlisted product/spec/protocol proposals; every other manifest retains its prior zero-operation verification or coverage disposition.

## Approved Heat cohort

1. Balea Hitzeschutzspray Ultralight, 200 ml
2. Balea 2-Phasen Hitzeschutzspray, 200 ml
3. Jean&Len Hitzeschutzspray beat the heat, 100 ml
4. Schwarzkopf taft Aloe Boost Hydra Protect Hitzeschutzspray, 150 ml
5. got2b Hitzeschutzspray Schutzengel, 200 ml
6. Schwarzkopf taft x Gliss Lovely Long Hitzeschutzspray, 150 ml
7. L'ORÉAL PARIS ELVITAL Dream Length Defeat the Heat Hitzeschutzspray, 150 ml

The current commercial fingerprint marks Balea Ultralight, Jean&Len beat the heat, got2b Schutzengel, Taft x Gliss Lovely Long, and L'ORÉAL Defeat the Heat as available/recommended. Balea 2-Phasen and Taft Aloe Boost remain active catalog proposals with unavailable/non-recommended state. Jean&Len uses retailer-backed GTIN `4262500781476`; later source or availability changes require a fresh reviewed content fingerprint.

## Approved Scalp Care cohort

| Role | Products | Important review boundary |
| --- | --- | --- |
| Scalp comfort | Balea Professional Sensitive Kopfhaut Serum; Eucerin DermoCapillaire Urea Intensiv-Tonikum; Head & Shoulders Derma X Pro Kopfhaut-Feuchtigkeitspflege | Eucerin remains cosmetic/medical-adjacent without treatment behavior; Head & Shoulders is comfort, not the flake/oil role |
| Flake/oil adjunct | GLISS Scalp Balance klärendes Serum | Adjunct role only; shampoo remains primary for dandruff/oil management |
| Density-claim tonic | L'Oréal Elvital Fiber Booster Anti-Haarverlust Serum; The Ordinary Multi-Peptide Serum for Hair Density | Limited-evidence cosmetic claim boundary; no treatment promise |
| Scalp exfoliant | Balea Professional 4% AHA Kopfhautpeeling; ISANA Professional 2% PHA + 2% AHA Kopfhautpeeling | Exact rinse-off directions retained; no repeat cadence invented and no automatic Deep-Cleansing stacking |

All eight are approved available/recommended B0 proposals. The Ordinary retains `manufacturer_sku=100434` plus retailer-backed EAN `769915195910`. The local comparison boards, approval receipts, evidence dossiers, and image assets remain intentionally ignored under `ops/catalog-enrichment/personal-plan-launch-v1/`.

## Follow-up blockers

- Migration `20260808065528_personal_plan_category_readiness` was not applied in the checked environment. Heat/Scalp spec tables and the shared application-protocol table were absent; this remains a B1 integration gate, not a B0 manifest blocker.
- All 15 images were finalized locally and approved by exact SHA-256. Nothing was uploaded, and `products.image_url` remains unresolved for B1.
- Mask repair-support and application protocols still require finished-product evidence; stored catalog classifications were not treated as external proof.
- Existing-row target fingerprints and commercial state must be re-fetched against the accepted Personal Plan integration head before any Deliverable-B dry run.
- B1 must resolve canonical brand/product-line IDs and the verified uploaded image URL against the accepted integration head without changing the reviewed B0 content.

Use the preview-only command from `docs/product-intake-research-ops.md` for individual records. The command has no apply mode and cannot by itself prove live target freshness.
