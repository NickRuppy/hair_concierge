# Existing-catalog GTIN enrichment — 2026-08-28

Status: E1-E14 applied and verified in production. Added 188 GTINs to 182 existing products; 220/259 active products are barcode-linked and 208/259 are strict scan-result-ready. Remaining 39 are explicitly held or readiness-blocked, not silently completed.

## Contract

Nick authorized adding verified GTINs to existing products and continuing across the remaining existing catalog. No product creation, classification changes, brand renames, promotion, telemetry, scanner activation, application deployment, push, PR or merge. Prior local-commit authorization supplies the clean reviewed head required by the executor. This backend-only operator journey adds no layout or copy; no new mockup is required. The previously approved fail-closed policy immediately tightens live approve/link validation: invalid or conflicting GTINs are rejected rather than stored.

Canonical brand authority resolves the spelling: product `07895098-a301-4137-b5c6-9061589b1800` links to brand `b0500f20-3e0a-420b-9371-66b2d5431d33`, canonical name **Neqi**. Its legacy product.brand is **NEQI**. Refresh only the manifest's exact compare-and-set snapshot, not either database name.

## Frozen candidates

Historical research manifests and August 26 ledgers remain unchanged. Only E1/E2 v2 and the frozen production manifests below are executable:

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

## E1/E2 production result

Applied the four exact migrations in one transaction; at 08:02:57Z, every recorded SQL SHA matches the committed source, the canonical unique index is ready/valid, and RPC execute is service-role-only. All product rows retained their before-hash. No telemetry migration was applied.

Both live CLI preflights passed against clean reviewed head `147fd98aa3020123d8fc9d19c50dc8c436142227` (content fingerprint `8047ef7796738a1cf72e5bcd26bedc7134de9fe1fccb47b98fca7263f9d9d12d`; hook changes were formatting-only and the 23 tests were rerun).

- E1 v2 applied 08:03:21Z: 20 products / 21 GTINs; guarded verify passed.
- E2 v2 applied 08:03:37Z: 21 products / 22 GTINs; guarded verify passed.
- At 08:04:17Z: 41 item receipts, 82 valid GTIN rows (previously 39), 150 identifiers of all types (previously 107), and 79 active barcode-linked products (previously 38). All 282 product rows still hash to `47d1b182838693c2e3b160439f83734e`.
- At 08:04:19Z: current-root-main scanner lookup resolved all 43 raw codes and their 43 canonical spellings to the exact expected product IDs: 86/86, no failures. No browser-render claim.

## E3 continuation

Next frozen production manifest: `phase1-existing-identifier-backfill-e3-v1.json`, 17 existing products / 17 GTINs, raw SHA-256 `ef20870b5c5ca23b001cea92ce33524c6f1f2416f5e39225237ef05eb5fc7134`. All are within the 18-product cohort that passed live readiness at 07:59:24Z; the subsequent duplicate-identity check held one additional product. Sources were refreshed August 28. This is the next subset of the previously researched existing catalog, not new products.

Corrected the Gliss candidate's source-only size from 250 to 200 ml using the exact dm name/GTIN panel; production net-content is null and remains untouched. Refreshed exact legacy name snapshots for Balea Tiefenreinigung and got2b Extra Volumen using their existing IDs and unchanged brands/categories. Stronger [K18 German distributor](https://k18-hair.de/k18-hair/k18-oil/Leave-In-Molecular-Repair-Hair-Mask-50ml.aspx) and [Sante EU retailer](https://www.ecco-verde.it/sante/deep-repair-balsamo-riparativo-per-capelli) sources replace weaker barcode-only evidence.

Three E3 products stay held: Redken Extreme Anti-Snap `2b7db7e3-2058-4178-8a03-7d05f4a1d447` / `884486453402` (240/250-ml source conflict); Curlsmith Multitasking Conditioner `2bafeb7e-6610-4efc-a8e8-a402071b2ed9` / `850005417781`, `850005417804` (published formula parity unresolved); Guhl Panthenol+2in1 `11d42d9d-b8d8-42ae-a432-9a3d0f9d3504` / `4072600703403` (same physical name also exists as mask `8ef172f7-8e95-4ac7-a6a9-235ad760155b`; choose the primary identity before assignment). No user decision is needed to keep these holds excluded. Across all selected E1/E2/E3 rows, the only other normalized same-brand/name duplicate is NEQI Moisture Mystery shampoo versus leave-in; source formats, sizes and codes establish distinct physical products.

Extend the same executor through one follow-up migration, `20260828081500`, adding only E3's exact fingerprint and counts to its existing batch contract. Do not edit already-applied migrations. No extra table, column, registry, product creation or classification changes. Reuse all existing preflight, transaction, ownership, submission, head and replay guards; verify and review this bounded delta before applying E3.

E3 verification: 65 focused tests, TypeScript, targeted ESLint and diff checks passed. Read-only Claude delta review found no hard defects; independently verified exact SQL delta, immutable E1/E2 pins, 17/17 manifest and migration gating. Its curation question was reconciled: included Redken All Soft Mega Curls and Balea Tiefenreinigung are different products from held Redken Anti-Snap and Balea 3-in-1 mask. Deployment bundle SHA `6b4742e127114d43c3eeedcdd4f3062eaa5d89362f81bdcbe9deb8345fdae7ef` checks the live executor definition and original applied receipts before running the exact new migration transaction.

E3 applied 08:20:40Z against clean reviewed head `a5083d2e85ea971b45b5139668a54353f57f1c5f`; no hook delta. Migration history SQL hash `53a1c0f3f7f588737f13cb7e60992af23d764aa0f2036e3b612fda0821ec7ad9` matches the source. Guarded preflight, apply and readback passed. At 08:21:16Z, current-root-main lookup resolved all 38 distinct raw/canonical/EAN-13 spelling checks to their exact owners. Cumulative result: 60 GTINs / 58 existing products added; 96 active barcode-linked, 99 valid GTIN rows, 167 total identifier rows. All 282 product records remain unchanged: `md5(jsonb_agg(to_jsonb(p) order by p.id)::text)` = `47d1b182838693c2e3b160439f83734e`.

## E4-E7 continuation

Source refresh covers all 77 previously researched remaining products. Final physical-identity reconciliation retains 73 products / 75 codes; four remain held. A fresh read-only readiness audit at 08:19:23Z passed all 77 candidates (zero blockers; fingerprint `bb1b11bd38f39dbb43192f8ea0c509641066f29ceeafeaba22ef0fc5376fe6b0`). Reuse the existing executor, extending its explicit batch allowlist and exact pins through migration `20260828083000`; no new table, column or service. E1-E3 pins and applied migration files remain immutable. Each cohort still runs and verifies separately.

| Batch | Products | GTINs | Exact raw SHA-256 |
| --- | ---: | ---: | --- |
| E4 v1 | 20 | 21 | `6335df5709bde47fadb5c2740ca96866d461d6a37fe192a989c66ca0773a2436` |
| E5 v1 | 19 | 20 | `8b94a3a22d1e5554d00f84c9858b16a66d73afc3f24adbf7499f43d5d4a08136` |
| E6 v1 | 19 | 19 | `92def27ab25378987eb0c9e01f7d4818c886b9b63363716410658cf6cb4ae903` |
| E7 v1 | 15 | 15 | `c705507449cea92051853b15f1995f03d4b42b1fecdb1e439b8732d46c557e5e` |

Fresh canonical brand joins resolve legacy strings through existing IDs: OLAPLEX (`1fbf8e21-0988-48c1-b6a0-493f575b44f0`), Garnier (`e4b57913-ff70-4e94-a83f-41445d0d7a2e`), It's a 10 (`fab97ff7-38b9-40bc-bb90-5a48bd3b8ed6`), Hask, Isana and Alverde. The executable compare-and-set retains the actual current product.brand, not the canonical label; no database rename or new identity row.

Source judgments: OLAPLEX No.3PLUS 100/250 ml has matching published ingredient order; Moroccanoil 50/160 ml shares official INCI. Correct research-only Pantene Grow Abundant size to 290 ml and got2b Liquid to Dry to 150 ml; both production net-content fields are null. Nivea 2in1 is already one shampoo row with no duplicate physical owner. Epres already links to the manufacturer's CONSUMERKIT, so the verified starter-kit code matches that existing product. Herbal Essences Aloe is corroborated by an exact major-pharmacy 250-ml barcode field; its fresh market evidence is explicitly IL, not asserted as German shelf coverage. Each manifest retains the fresh source and historical corroboration; barcode-registry-only evidence was replaced with retailer/brand fields.

Held E6: Garnier Wahre Schätze Argan-Mandelcreme Spülung `99de5b38-3e80-4360-889c-2505f46a7243` / `3600542462594`; no qualifying direct barcode field after alternate-source search. Held E7: Cantu Leave-In Repair Cream `e3c4b607-8f81-462c-8a2b-e45c8b3a2976` / `810006943405`; same physical name also exists as conditioner `7539ab79-f4f6-49d7-9269-08034ef4de96`. Do not choose either owner silently. The older Balea, Redken, Curlsmith and Guhl holds above remain excluded.

Reviewed-deployment target: new migration SQL SHA `aa851262374777b093d0fa869df1d7b6152eb7e6ab0c4724092eba97034b0a06`; transactional bundle SHA `eb8889795339d9fae4e5bcc4988495e4ad416fe8ec3fdab963b785366e8eef26`. Wrapper pins the live E3 executor MD5 `0b3e9c77f0ada854d7dd355224a78d4c` and E3 receipt, records exactly the executed SQL, and refuses replay/drift. Final counterpart delta review and clean-head preflight precede production application.

Fresh all-75 identity/ownership preflight at 08:26:36Z: 77 unique canonical GTINs, zero current owners or unresolved-submission overlaps, zero exact product-snapshot drift. During local verification, strict item fingerprints caught a generator mapping error (candidate raw_gtin versus executable value). The generator and all four still-unapplied manifests were corrected and refrozen; no guard was relaxed and no affected data had been written. All 75 serialized item fingerprints now round-trip exactly.

The subsequent all-282 physical-identity audit held two additional selected rows before any E4-E7 apply: E5 Midnight Serum `6b01025d-9e72-4514-b42e-bbb6065fbe1c` shares the 100-ml package / `3600524135805` with oil `21a94166-3813-4c0f-8912-508fb8f704f1`; E7 Pantene 7in1 `f8f3b51d-8e64-487d-bad5-4a47c58862ed` shares the 145-ml package / `8700216178402` with oil `5827a3b9-a488-4c74-b13a-4d655f94f1c3`. E5/E7 were narrowed and refrozen to the pins above. No other confirmed physical duplicate was found in the remaining 73 selected products. The preliminary counterpart run was interrupted with no verdict when the new evidence arrived; review the final narrowed cohort instead. E3's already-applied Balea deep-cleansing owner follows the approved July 2 category plan and the August 26 legacy-shampoo duplicate hold; do not attach the code to the legacy shampoo as well.

The full live readiness audit at 08:28:22Z still has 259 active products, 96 barcode-linked, 84 scan-result-ready, 134 unlinked strict-ready and 41 authority-blocked (29 unlinked). The earlier 53 source/identity holds remain a research backlog, not new products. A fresh inventory at 08:29:40Z resumed those 53 in parallel; their evidence alone will not authorize a new batch without physical-identity, live ownership and exact-fingerprint checks. Barcode-missing readiness blockers overlap: 29 missing protocols, 21 unknown verdicts, 18 dispositions. No classification repairs are implied by identifier enrichment.

Final E4-E7 verification: main ran 55 focused tests and `npm run ci:verify` successfully (five existing lint warnings); after the two-row narrowing, all 23 affected tests and TypeScript passed. At 08:38:36Z, fresh 73-product / 75-GTIN preflight found zero existing owners, unresolved-submission overlaps, dispositions or identity drift. Claude's final read-only delta review found no hard defects and independently passed 23 tests, all pin/shape/immutability and dedup checks. It did not verify the out-of-repository deployment wrapper or full build; main verified both, including byte-for-byte equality of executed SQL and migration-history SQL. Optional typing/last-branch suggestions are deferred; this pass does not broaden the executor design.

E4-E7 applied 08:43:05Z–08:43:38Z against clean reviewed head `e4b1dbd1abbe645621a79474d15b34f541dc83fb` (no hook delta). All four CLI preflights, applies and readbacks passed. Migration-history SHA matches the exact SQL above. At 08:44:24Z: cumulative 135 GTINs / 131 existing products added; 169 active barcode-linked, 174 valid GTIN rows, 242 total identifier rows. All 282 product records retain their before-hash. Current-root-main lookup at 08:44:47Z resolved all 163 distinct raw/canonical/EAN-13 spelling checks for the 75 added codes, zero failures.

## E8-E9 resumed existing-catalog research

All 53 older source/identity holds received a fresh source pass: 26 now have direct package/barcode evidence; 27 remain held. Durable evidence: `existing-catalog-gtin-research-refresh-2026-08-28.json`, SHA `4c3851c8fc9566b77ad869113f89da41b72e6e7113e8a3b0bda1f6bf2a72c1bc`. Each ID is accounted for once. This is still the existing product catalog, including masks and oils, not the parked new-product expansion.

| Batch | Products | GTINs | Exact raw SHA-256 |
| --- | ---: | ---: | --- |
| E8 v1 | 20 | 20 | `d0307aa4fc449a49b438dd7efe6652757cf2f54239ebfa9b5082854fc24df602` |
| E9 v1 | 6 | 6 | `69730542eb6a5a51ca590954fe2efaa865c91b6f1f7ff73118c563fa21f2bfd6` |

All 26 were strict-ready in the 08:29:40Z live inventory. At 08:41:23Z: zero existing GTIN owners or unresolved-submission overlaps. The full-catalog physical-identity comparison flags only distinct formats or variants (Sante/Syoss mask vs conditioner; Pomélo 100-ml mask vs 200-ml conditioner; HASK 18-ml oil vs shampoo/conditioner/sachet; Papaya vs Aloe Hair Food). The active OGX Argan conditioner has an explicitly discontinued legacy duplicate without the proposed GTIN; do not attach anything to that old row. No new physical-owner choice is required for these 26.

Source quality corrections: official NUTREEOIL product JSON identifies Cacay 30 ml as `4260541540014`, so the comparison-only `4260541540007` is excluded. Urban Alchemy uses Hagel plus official structured barcode corroboration; Papaya and Jojoba use explicit dm fields. Jojoba is a distinct product from the held Midnight Serum. New manifests round-trip every serialized item fingerprint and retain current exact brand/name/category snapshots without changing product data.

Use the same executor with new migration `20260828085000`, immutable E1-E7 pins, E8 20/20 and E9 6/6. SQL SHA `8dd3d29b8cfbbfa019f6203b8a18bfa4421c3b9a8dcb8ae52a4cf84246ad885a`; transactional bundle SHA `5cb412bd37cafe0784c7edbc045bb1f846ab0f993c920c08ade3020564a8ee75`. Wrapper pins the live E4-E7 executor MD5 `bb46c77377818ba99c5dd5af04f8ecef` and all four applied receipts. No extra table, column, registry, product or classification change. Tests, counterpart delta review and exact clean-head preflight precede application.

E8-E9 verification: all 26 pass fresh live readiness at 08:48:09Z (fingerprint `ab55d0d4f0a5d935fa63120887d884d15352c94eb00ab30a18685e46a3589af8`). Main passed all 25 affected tests, full TypeScript, targeted ESLint and diff checks; independently verified all item hashes, raw pins, source accounting and exact equality of source/executed/history SQL. At 08:52:26Z the live executor MD5 and service-role-only permissions are unchanged, the new migration is absent and all 282 products retain the original hash. Claude Opus 4.8 / high read-only delta review found no hard defects; independently passed 25 tests and checked pin/shape/gating, prior immutability and zero held-ID/GTIN leakage. It did not verify the external deployment wrapper; main did. Transient review output stays outside the repository. No outstanding review finding blocks the authorized exact-cohort apply.

E8 applied 08:56:25Z (20/20), E9 applied 08:56:52Z (6/6), against clean reviewed head `72cc8ee5e911ef64f56b78d3a9abb573ebddbf48`; pre/post-hook tree is identical (`4257bf8dc27d951b8150b23e30c748abe8beeaec`). Both live CLI preflights, applies and readbacks passed. Migration-history SQL hash matches `8dd3d29b8cfbbfa019f6203b8a18bfa4421c3b9a8dcb8ae52a4cf84246ad885a`; service-role-only execute permissions remain intact. Current-root-main lookup at 08:57:19Z passed all 53 distinct raw/canonical/EAN-13 spelling checks for this last cohort. Root main advanced independently during the task; these final checks ran from its then-current `870fc4fbbc95d03e2662b379782be8a7e5c0bc11`, not the task branch.

## Final outcome and remaining scope

At 08:57:12Z: all nine batches have their exact fingerprints, reviewed heads and 157 item receipts. 161 new GTINs bring the valid canonical total from 39 to 200; all identifier types total 268 (previously 107). All 282 product records retain the exact original hash `47d1b182838693c2e3b160439f83734e`. No names, brands, classifications, lifecycle states or product rows were changed.

Fresh full-catalog readiness at 08:57:35Z: 259 active supported products, **195 barcode-linked** (previously 38), **183 scan-result-ready** under the existing oracle (previously 26). This is 75.3% barcode coverage of the active catalog, not 75.3% of market scans and not browser-render verification. The other 23 product records are outside the active supported cohort.

The **64 active products without barcodes** split into:

- **35 otherwise-ready products** held on source/package/formulation proof, open-submission overlap or physical-duplicate ownership. All have an explicit hold: 27 in the resumed source ledger plus eight earlier holds documented above. No unaccounted ready rows remain.
- **29 readiness-blocked products**, needing category authority/protocol/disposition work in addition to identifier research. Among already-barcoded products, 12 also remain readiness-blocked; adding a barcode does not solve that separate issue.

Durable exact-ID audit: `data/scanner-catalog-coverage/2026-08-26/existing-catalog-gtin-final-audit-2026-08-28.json`; readiness-oracle fingerprint `73235a7ec16851c28046b6d4369d6605b6d0051b1f58e61e88704650689af1db`. It includes category counts and all 64 remaining IDs/reasons. The oracle's `ready_for_ean_research` means classification-ready, not identity-cleared for apply.

The next product decision is canonical ownership for the same physical package represented in multiple categories: e.g. Guhl 2in1, Garnier Hair Food, Balea 3in1, Cantu leave-in, Midnight Serum and Pantene 7in1. Do not assign one code to both records or merge/reclassify records silently. Existing canonical brand IDs already settle spelling; no brand-name decision is outstanding. Source gaps stay researchable, but no unresolved candidate is represented as verified or written. New-product expansion remains parked until existing-catalog gaps are deliberately resolved.

Changes and evidence are committed locally; nothing was pushed, opened as a PR, merged or application-deployed. The authorized database schema and identifier-data writes described above are complete. Counterpart review reports and SQL wrappers are intentionally retained only as transient `/tmp` diagnostics; durable decisions, manifests and verification remain with the task branch.

## E10-E11 continuation — September 1

E10 added 12 verified GTINs to 12 existing products from the refreshed August 31 ledger. Its exact manifest fingerprint is `e9b803b9d36f7cc41a6a0972958e0f045d5c91668c8b5766c60976a84384f0e3`; migration `20260831190726` and all 12 item receipts passed exact readback against reviewed head `551b7a52b56a9f061eeafcb331084b7893b59ffe`. The live catalog moved from 195 to 207 barcode-linked and from 183 to 195 strict-ready products.

E11 completed the K18 Professional Molecular Repair Hair Mist at product `8f84eae5-222d-4bbf-9ab0-f30361882a95`. Readiness migration `20260901090000` first replaced the stale fine-only description, completed the reviewed Leave-in facts and six eligibility rows, stored schema-valid V1/V2 application guidance, removed only the exact guarded prior disposition and recorded three evidence rows plus the receipt fingerprint `4a6694959985138baf17701025e479387c827bd4f89948cd12f58aae29efe4dd`. This intermediate state was classification-ready but still unlinked.

E11 migration `20260901091000` then extended the existing guarded executor. The clean-head preflight on `d4e96171534ab0f9db6d3d5598f916a923aebd94` passed project, migration, exact identity, global owner, open-submission and readiness checks. The exact manifest fingerprint `f224db6c44e4b50dc22b15a8ed28b81922273d3127d83ad4c8e3c55711abf6ec` applied one raw code `858511001463`, canonical GTIN-14 `00858511001463`, to the K18 product. Guarded verify and direct receipt/identifier/migration-history readback passed. The final readiness export reports **208/259 barcode-linked (80.3%)** and **196/259 strict scan-result-ready (75.7%)**; 51 active products remain unlinked, split into 23 otherwise-ready for GTIN research and 28 blocked.

Official K18 evidence establishes the exact 300 ml lightweight professional mist and four-minute/no-rinse use; CosmoProf establishes UPC `858511001463`. Nick's approved internal decision remains explicit and separate: treat this lighter mist as an ordinary consumer Leave-in, not the main K18 bondbuilder. [K18 Hair Pro](https://www.k18hairpro.com/products/professional-molecular-repair-mist-300-ml-wholesale), [CosmoProf](https://www.cosmoprofbeauty.com/USA-040285.html), [SalonCentric corroboration](https://www.saloncentric.com/858511001463.html).

## E12 continuation — September 1

E12 resolved six previously held existing products under Nick's approved package-parity and single-owner rules. The exact 6-product / 7-GTIN manifest fingerprint is `1e1c69be793d4ab00b42c3c618b4580403dde6a85c47185568b2a7ebfb76915b`: Curlsmith Multitasking Conditioner has separate 59 ml and 946 ml package codes; Cantu uses the current dm 453 g package; Redken Anti-Snap records the source's 240/250 ml discrepancy without changing product content; Guhl 2in1 resolves to the conditioner owner; Midnight Serum and Pantene 7in1 resolve to their oil owners.

The static migration `20260901093000` preserves the E1-E11 executor and adds only E12's allowlist, exact 6/7 pin and disposition rollback guard. Its production migration-history source SHA is `4fa29d40b9c278dcb0f01b46ad0c3bc4a4ecf171b2d2e7c7548eba7c458b8944`. Both internal read-only reviews and Claude Opus 4.8 / high found no hard defect; the 35 focused TypeScript/PGlite tests, typecheck, targeted lint and diff checks passed. A fresh full readiness export confirmed all six were undisposed and blocker-free immediately before deployment.

Clean-head preflight against `cd0f8cd084a2fe9ea75b8876f03db2ed71f32e54` passed exact product identity, global ownership, open-submission, migration, branch and replay gates. The atomic apply and guarded verify returned 6 products / 7 GTINs; direct readback confirmed every canonical GTIN owner, six item receipts, seven identifiers, the reviewed head/fingerprint and exact migration-history SHA. No product fields, category assignments or formulas were mutated.

The post-apply readiness export reports **214/259 barcode-linked (82.6%)** and **202/259 strict scan-result-ready (78.0%)**. The 45 remaining unlinked products split into 17 otherwise-ready for identity research and 28 readiness-blocked. This is catalog coverage, not measured German market-scan coverage.

## E13 continuation — September 1

E13 resolved five more existing products / six exact package GTINs under the now-durable September 1 rules: Hair Food Aloe and Balea Aqua use their mask owners; Hair Food Macadamia uses the supportive leave-in owner; Balea Intensivmaske accepts both directly evidenced DE/AT 300-ml codes; current German OGX Keratin Oil Shampoo uses the existing shampoo analysis. The exact manifest fingerprint is `2efe9cf73fd0294298daaad125f95cf9c387bb2fabe88ad90efade5ca1f9afe4`.

Migration `20260901102000` preserves the E1-E12 executor and adds only E13's exact 5/6 pin, allowlist and disposition rollback guard. Its production history source SHA is `db9317744c7c15b32647d380275ade344e8854b0b9f6dc30be904c4fc3902290`. Main and worker verification passed 35 focused TypeScript/PGlite tests, typecheck, targeted lint and diff checks. Claude Opus 4.8 / high returned GO. A separate correctness review first stopped on stale conservative plan wording; after the newer user decisions were recorded as the controlling policy, its bounded re-review returned GO.

Clean-head preflight against `72813b5bb2643be26dbb3c2ffc47ed78278da37c` passed exact live product identity, migration, global ownership, open-submission, branch/head and replay gates. The atomic apply and guarded verify returned 5 products / 6 GTINs. Direct readback confirmed all owners, five item receipts, six identifiers, the reviewed head/fingerprint and exact migration-history SHA. No product field or category row was mutated.

The post-apply readiness export reports **219/259 barcode-linked (84.6%)** and **207/259 strict scan-result-ready (79.9%)**. The 40 remaining unlinked rows split into 12 otherwise-ready and 28 readiness-blocked. Several of those 12 are losing duplicate-category rows for packages that now already scan successfully, so they are not all real uncovered physical products.

## E14 continuation — September 1

E14 added the exact current German Gliss Kur Aqua Revive Conditioner package, raw GTIN `4015100812336` / canonical `04015100812336`, to existing conditioner owner `02113cc7-80c4-45a5-a56b-738ac96f4f02`. Balea Natural Beauty 3in1 Locken remained excluded because open researching submission `08991f6b-cf73-4d9b-9ebe-18f746602b6f` currently holds its code; the collision guard was not weakened.

The exact 1-product / 1-GTIN manifest fingerprint is `bc6a9751dffbd28508e47d37ef9c340591e6cb233aee8eab5081e2f015a94c34`. Migration `20260901110000` preserves E1-E13 and has production history source SHA `8b335e2f50826767c470366de066357132b7b0c87bdc7f1d42809699f211cf4e`. Main and independent read-only review passed 36 focused tests, typecheck, targeted lint, exact hash/static-delta checks and the live readiness audit.

An intentionally mistyped reviewed-head dry run stopped before execution, demonstrating the clean-head gate. The corrected preflight against `ffa1858011ce6821a9b3694a90f25b2039912b45` passed; atomic apply, guarded verify and direct owner/batch/item/migration readback all reconciled exactly. The final readiness export reports **220/259 barcode-linked (84.9%)** and **208/259 strict scan-result-ready (80.3%)**. The 39 remaining unlinked rows split into 11 otherwise-ready and 28 readiness-blocked.
