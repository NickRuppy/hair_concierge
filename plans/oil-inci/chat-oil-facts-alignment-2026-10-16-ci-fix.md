# PR #690 CI repair

The Chat Oil alignment adds `weightRequest` to the normalized Oil target when
the request explicitly asks for a light finish. The category-owner test's full
target-profile assertion omitted that public decision field, so hosted
`quality-node` failed despite the intended production behavior being present.

The test now expects `weightRequest: "light"`. This protects the request-to-
decision contract that makes the selector restrict a light finish request to
light researched Oil products. No matching-tag, catalog, adapter, or runtime
behavior changes in this repair.

Verification recorded for this repair: the focused category-owner test failed
before the expectation update with the sole missing `weightRequest: "light"`
field, then passed after it. The only other full `decision.targetProfile`
assertions in the file cover Bondbuilder and Peeling and do not share the Oil
target shape.

Command: `~/.local/bin/coding-check --node-tests tests/recommendation-engine-categories.test.ts`. Red: 46 passed / 1 failed before the change, solely the missing expected field. Green: 47 passed / 0 failed after. `git diff --check` passed.

Review delta: test-only public target contract correction; no structural review or repeat counterpart pass is warranted. The previously reviewed runtime content at `555980dfbe053ed888940bde1a9de4e137049b8c` is unchanged. Original authorization to prepare draft PR #690 carries forward; the 2026-10-16 request explicitly asks to fix its CI failure. Merge and deployment remain unauthorized.

Revalidated substantive branch fingerprint (receipt metadata excluded): `197daf493ce41c187f5944cddc7667cbcfa8c57136f5ce93db5213c3cb0180f4`. Decision coverage remains confirmed; no new product choice. Artifact disposition: test and this addendum are commit candidates; previous review output remains transient.
