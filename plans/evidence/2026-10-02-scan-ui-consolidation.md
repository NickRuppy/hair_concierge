# Scanner UI consolidation

Authorization: Nick's existing request to prune the least useful tests and inspect
production reachability. This changes tests only; scanner runtime stays live.
Baseline for this layer: the verified 80-declaration cleanup tree at `21e0e41f`.

Complete read: 3,675 lines and 111 AST declaration sites in scan-flow-ui, including
harnesses and generated cases, plus the ScanFlow/SearchSheet owners and all 72
scan-flow-state declarations. State tests do not replace component wiring.

Original line anchors below refer to the file before this consolidation.

| Deleted declaration (original line/title)                               | Mark | Keeper / required transfer                                                                                                                                                                                     | Mutation control                                                                      |
| ----------------------------------------------------------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 455: a second decode inside the confirm window is ignored               | C    | 474: two different decodes fired back-to-back without a settle only resolve once. Also fire a third different decode after settle while the first request remains pending, before asserting one request/event. | Allow a decode only in the post-render active-request phase; merged keeper must fail. |
| 880: a search-sheet submit sees no onSubmitIdentifier prop              | D    | Obsolete absence-only assertion: no live type or runtime branch consumes that prop; production behavior has no contract to preserve.                                                                           | None: no behavioral contract remains.                                                 |
| 1492: a text submit renders both sections with exact labels             | C    | 2682 ordering/dedupe asserts all rows and identical labels; 1925 full copy audit retains explicit-submit two-section response without dm catalog matches.                                                      | Existing stronger row/label assertions retained; no new assertion transfer.           |
| 1514: GTIN-mapped catalog hit renders once, deduped against live rows   | C    | 2682 asserts exact ordered row list with live duplicate and appended mapped match; 2290 retains retailer-empty/catalog-only row response.                                                                      | Existing stronger row/dedupe assertions retained.                                     |
| 1563: dm-lane failure leaves catalog results and quiet unavailable line | C    | 1925 copy audit already supplies catalog rows plus HTTP200 retailerOutcome unavailable. Add row-visible and no-empty-message assertions there. Keep HTTP429/analytics tests.                                   | Clear catalog results only on HTTP200-unavailable; copy keeper must fail.             |
| 2112: intake prefills full trimmed product query and empty brand        | C    | 2096 terminal recovery CTA transition: use padded query and carry both prefill assertions; 2347 independently retains persistent-link prefill.                                                                 | Remove programmatic product prefill; terminal keeper must fail.                       |
| 2339: persistent link absent in terminal empty state                    | C    | 1702 already asserts exactly one recovery CTA with the identical empty fixture; carry absent Nicht dabei? text there.                                                                                          | Render persistent recovery prompt with terminal copy; keeper must fail.               |

Independent preservation review caught a real gap in the initial proposal:
HTTP429 takes the catch branch, while HTTP200-unavailable takes a separate body
branch. Moving catalog visibility only to HTTP429 would lose the original proof.
The revised transfer uses the existing HTTP200 copy-audit fixture.

Counterpart plan review: accepted exact keeper/mutation accounting and durable
receipt requirements. Rejected requests for new pruning/shortfall approval: the
user already authorized this scope; the 20% target remains unachieved, not silently
replaced. Before any publication, reconcile current main using the campaign's
merge policy and repeat proof on that head. Publication is not authorized here.

Verification is serialized: baseline focused 186/186; final focused, mutations
and full comparison must finish on the edited tree. Current proof and limits will
be recorded in [the verification receipt](2026-10-02-test-audit-receipt.md).
