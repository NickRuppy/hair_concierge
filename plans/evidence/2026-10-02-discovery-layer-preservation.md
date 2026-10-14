# Discovery layer-cut preservation review — read-only

Compared /tmp/test-audit-discovery-layer-cuts.json, the current diff, retained bodies, and route source. No tests run.

## Recorded cuts

| removed body | retained concrete assertion and execution path | result |
|---|---|---|
| intake API: resolved correctly-filed product happy path | intake API product-write test now sends the same validCapture through createDiscoveryIntakeItemsHandler; it records the exact eight-field row passed to insertItem, asserts catalogReads is empty, asserts insert-before-clear ordering, HTTP 201, and browser projection. validCapture has category, so route isLegacy is true and reaches buildDiscoveryIntakeItemRow -> checkIdentity -> insert, not flat catalog-type branch. | preserved |
| intake API: full stored-row submit success | minimal one-answered-category test invokes createDiscoveryIntakeSubmitHandler with real shared guard and storedItem from loadItems; it now asserts submit id plus exact JSON state submitted and submittedAt. This reaches legacy no-body branch, load -> nonempty guard -> heal -> submit -> response. | preserved |
| flat API: legacy tile exact insert payload and zero catalog reads | exact eight fields and empty catalog-read counter are now in API product-write keeper above. Dependency name is real: createDiscoveryIntakeItemsHandler destructures loadCatalogProductType from overrides. The legacy branch does not call it; source invokes it only after isLegacy is false in addFlatChecklistProduct. | preserved |
| classify B7: fourth care option | retained classify R9 care/shampoo test deep-compares four ordered label/usage rows and now separately asserts options[3].key equals conditioner_pre_wash. This preserves both cardinality/order/label/usage and the previously missing key. | preserved |
| classify B7: pre_wash_conditioner only valid for conditioner | retained classify usage-role matrix enumerates every supported category x every DISCOVERY_USAGE_ROLE and computes allowed exactly as oil roles for oil, scalp role for scalp_care, or pre_wash_conditioner for conditioner. | preserved |

classify test line 415 remains present and still iterates every emitted usage question option through isValidDiscoveryUsage. It continues to guard producer-to-validator composition.

## Historical diff item, already accounted

The diff also shows the B7 SPRAY_TYPE_FIXTURES row T5_name, input Hitzeschutz Spray, expected heat_protectant removed. This is an **original eight-cut batch** removal already recorded in plans/evidence/2026-10-01-test-audit-ledger.md; it is intentionally outside the new Discovery-five receipt and must not be counted again.

For preservation context only, retained base classifier type fixtures still exercise Hitzeschutz Spray as heat_protectant, and retained B7 composed typed-spray test asserts classifyDiscoveryProduct for that name takes fixed step routing. No new-cut accounting change follows from this observation.

## Verification limits

This is source/diff inspection only. It establishes wiring and retained assertions; it does not make a runtime coverage claim. Focused native Node tests were reportedly run by main and remain outside this review.
