# Discovery intake coherent cutover — read-only plan

Apply only these five declarations after the listed assertion transfer. No source/support seam is removed.

| action | exact declaration | retained keeper and assertion transfer | mutation that keeper must catch |
|---|---|---|---|
| D | discovery-intake-api.test.ts:622 — a resolved, correctly-filed product is stored exactly as before | API L282 already drives same valid capture through real handler and asserts 201 plus item projection and clear order. | Make legacy POST return non-201 or skip insert; L282 fails. |
| C | discovery-intake-api.test.ts:711 — at-least-one rule decided from stored rows | Add exact state/submittedAt response assertion to L695, then delete L711. L695 retains stronger minimal stored-row rule. | Change successful legacy submit response shape; augmented L695 fails. |
| C | discovery-intake-flat-api.test.ts:422 — legacy tile shape writes old row | Add exact eight-field inserted row and catalogReads equals empty to API L282, then delete L422. Producer/persistence corroboration remains discovery-intake-items.test.ts:37. | Make legacy branch read catalog type or alter legacy insert field; augmented L282 fails. |
| C | discovery-classify-b7.test.ts:27 — D1 fourth care option | Add care.options[3].key equals conditioner_pre_wash to classify.test.ts:393 alongside existing fourth label/usage map, then delete B7 declaration. | Rename/remove fourth option key; augmented L393 fails. |
| D | discovery-classify-b7.test.ts:36 — pre_wash_conditioner valid only for conditioner | classify.test.ts:422 exhaustively checks every supported category against every usage role, including this role. | Permit pre_wash_conditioner for mask/oil; L422 fails. |

Retain classify.test.ts:415. It composes emitted question options with isValidDiscoveryUsage; exact static maps and PGlite do not exercise that producer-to-validator relation.

Native focused proof (not run):
node --import ./tests/server-only-register.cjs --import tsx --test tests/discovery-intake-api.test.ts tests/discovery-intake-flat-api.test.ts tests/discovery-classify.test.ts tests/discovery-classify-b7.test.ts
node --import ./tests/server-only-register.cjs --import tsx --test tests/discovery-intake-items.test.ts tests/discovery-intake-usage-migration.test.ts
git diff --check
