# Existing-catalog GTIN enrichment — 2026-08-28

Status: approved data-only release; code/source review passed, production apply pending.

## Contract

Nick authorized adding verified GTINs to existing products and continuing across the remaining existing catalog. No product creation, classification changes, brand renames, promotion, telemetry, scanner activation, application deployment, push, PR or merge. Prior local-commit authorization supplies the clean reviewed head required by the executor. This backend-only operator journey adds no layout or copy; no new mockup is required. The previously approved fail-closed policy immediately tightens live approve/link validation: invalid or conflicting GTINs are rejected rather than stored.

Canonical brand authority resolves the spelling: product `07895098-a301-4137-b5c6-9061589b1800` links to brand `b0500f20-3e0a-420b-9371-66b2d5431d33`, canonical name **Neqi**. Its legacy product.brand is **NEQI**. Refresh only the manifest's exact compare-and-set snapshot, not either database name.

## Frozen candidates

Historical v1 manifests and August 26 ledgers remain unchanged. Only v2 files are executable:

| Batch | Products | GTINs | Exact raw SHA-256 |
| --- | ---: | ---: | --- |
| E1 v2 | 20 | 21 | `0002bbd596cc88acff0982ef147341d87d6c39a26a4b0709efd68aa48e733522` |
| E2 v2 | 21 | 22 | `aa3c2a026c1a372e963f47d47e9c611d1b8dd8ca9edf0c334390a56443fda147` |

Sources reopened August 28; extra exact-package corroboration is retained in `source_urls`. Package identity is neither sales evidence nor proof of classification accuracy.

Holds removed from execution:

- Balea 3-in-1 Intensivmaske, product `d5d67009-7aac-4299-938b-7218b8635a0c`, codes `4066447237443` / `4066447982817`: [dm AT](https://www.dm.at/p/d/1671219/balea-haarmaske-3in1-intensivpflege) and [dm DE](https://www.dm.de/p/d/1671219/balea-haarmaske-intensivpflege-3in1) publish differing ingredient panels. Match the catalog formulation before adding either.
- Guhl Kopfhaut Sensitive, product `02afbd03-1c7d-467c-8a07-a8b226d6f535`: hold extra 50-ml code `40726526`. The [HAGEL 50-ml panel](https://www.hagel-shop.de/guhl-kopfhaut-sensitiv-shampoo-50-ml-5832001.html) matches one 250-ml retailer but differs from current dm AT; extra-pack formula parity is unresolved. Regular 250-ml identity remains verified.

Retained variants have positive published-list corroboration: [NEQI](https://neqi-hair.com/products/repair-reveal-conditioner) groups 90/250 ml, and the [90-ml retailer panel](https://www.maquibeauty.de/neqi-repair-reveal-reparierender-conditioner-90-ml-p-90930.html) matches the shared list in order. Balea Sensitive dry shampoo [100 ml](https://www.dm-drogeriemarkt.it/p/d/3059888/balea-shampoo-secco-sensitive-minitaglia) / [200 ml](https://www.dm.ro/p/d/1711758/balea-sampon-uscat-pentru-scalp-sensibil) publish the same six ingredients. This is published-list parity, not a guarantee for every physical package.

## Data-first release amendment

1. Apply only migrations `20260826142000`, `20260826142100`, `20260826142200`, `20260826143000`; exclude telemetry. Preserve live approval's net-content persistence. Use an exact transactional SQL bundle with 5-second lock timeout, 60-second statement timeout, absent-version checks, live function-definition/ACL guards and matching history records. No generic `db push` against divergent history; no product-data DML in schema deployment.
2. Guarded E1/E2 CLI apply requires exact clean branch/head, fingerprint, product snapshot, all active/inactive owners and every scanned/researched identifier on unresolved submissions. Executor repeats overlap detection under a short SHARE lock; ordinary reads remain available.
3. Verify all owners/ledgers, unchanged product metadata, and current-main scanner lookup against live data. Current main reads raw/normalized GTIN variants, so these valid raw EAN rows need no application deploy. Future code reading `canonical_gtin14` still requires schema-first release.
4. Refresh full existing-catalog coverage and continue the next existing-product cohort. E3–E7 remain research candidates until refreshed and promoted through the same guards. New products remain parked.

## Verification

Before-state `2026-08-28T07:49:22Z`: 282 products, 107 identifiers of all types, 24 unresolved submissions; four versions absent. Barcode subset: 40 rows, 39 valid/distinct GTINs, no duplicate/cross-owner collision. One pre-existing PZN remains outside the canonical index.

Red/green proof: unresolved scanned and second researched barcode fixtures failed before the executor guard, passed after; retailer-SKU sanitizer fixture failed before type restriction, passed after. Pagination is deterministic. Live approval compatibility has an executable pack-size regression fixture.

Transient schema snapshots and reviewer output stay outside the repo. Commit durable manifests, code, tests and this receipt. Lookup success does not prove rendered personalized verdicts or 80/20 market coverage. Append production readback after execution.

Pre-apply verification: 62/62 focused tests passed; `npm run ci:verify` passed (five existing lint warnings); targeted ESLint and `git diff --check` passed. Full live readiness audit at 07:53:54Z: 259 active supported products, 38 barcode-linked, 26 scan-result-ready; all 41 selected products pass the readiness oracle. Fresh exact-cohort preflight at 07:58:22Z: no identity drift, dispositions, owners or open-submission overlaps.

Claude Opus 4.8 / high, read-only terminal review: no hard correctness defects. Codex retained the approved invalid-GTIN fail-closed policy and checked the live queue: at 08:00:06Z, zero invalid GTINs across 24 open submissions; 14 researched payloads use `final` (eight also have `draft`), ten are empty. This confirms the guarded researched-identifier path. The net-content regression was fixed before review; a claimed migration timestamp collision was disproved (June `20260626143000` is not August `20260826143000`). Structural review retained the existing guarded executor and four migrations; no extra registry/service/columns were introduced for this refresh.

Reviewed deployment bundle SHA-256: `cb7c5b6791ca08007ecb8b642d78653cf19943d54f3a53f1ea08954f1a952f16`. Exact bundle, before-function snapshots and transient Claude report: `/tmp/scanner-gtin-apply-lQUl9QEr/`. Schema/data verification will check that all 282 product rows retain MD5 `47d1b182838693c2e3b160439f83734e` unless an unrelated concurrent catalog write is identified. Branch merge-base: `455c115bb04862ebb27d9b03a31a4b92c8af3c37`; current root main lookup compatibility was inspected separately, not inferred from this older worktree.

Post-review delta: added the positive valid-EAN/GTIN-equivalent approval test requested by Claude. It proves successful canonical deduplication before the predecessor receives the payload. Main reran all 23 affected tests successfully; no production code or reviewed SQL bundle changed after counterpart review.
