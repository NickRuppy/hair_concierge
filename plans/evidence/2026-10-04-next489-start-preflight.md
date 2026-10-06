# Start / Stage3 11-C assertion-union preflight

Read-only review of the candidate record, proposed transfer/cut diffs, controls, complete donor/keeper bodies for C4/C5/C8/C9/C10/C11 and relevant start-card/Stage3 owner paths. No runner, mutation, or source edit.

## Verdict

**No surviving assertion-union or operative-input blocker found for C1–C11.** The proposal keeps the execution count fixed: it adds observations to existing callbacks and deletes donors; it does not introduce an action, a fixture row, a second render, or a caught expected failure.

## Targeted checks

- **C4 sorting/count:** donor and keeper use the same `readyPlan` and two Shampoo preview roles; only input order is reversed. The adapter’s canonical role ranking in `src/lib/personal-plan/product-preview-contract.ts:98-106` makes the final grouped card order equal. Keeper already checks the sorted members; transfer adds the independent final `basis.cards.length === 2` and `countLabel === "2 Kategorien"`. It does not conflate the optional-card-count case.
- **C5 sole role / rich preview:** both execute one Conditioner `conditioner_rinse_out` recommendation against `readyPlan`. The keeper’s richer product/commerce/reasoning payload is an extension, not a changed cardinality/category predicate. Its exact product deep-equality plus transferred final IDs/category text and `asCard` access preserve non-group/sole-role behavior. Stale authority-hash rejection remains keeper-specific.
- **C8 paused snapshot:** the relevant branch is saved decision/card state, not preview content. The keeper’s `withPreviews` replacement changes authority previews but retains the oily/irritated computed decisions; paused merge/card construction does not consume preview values. Transferred `Pausiert`/`Aktuell nicht anwenden` and non-group card observations therefore retain the donor’s snapshot-independence contract. This does not prove preview-validation behavior, which remains in the keeper.
- **C9 deferred Stage3 assignment:** donor and keeper have the same Shampoo requirement, selections, cadence, and first everyday role. The keeper adds a deferred gateway/single-flight schedule around the same mutation. Transfer observes the initial add-another state, mutation type, and settled `ProductFitComparison` around that existing release. It does not claim DB atomicity; its appropriate scope is controller-to-gateway UI orchestration.
- **C10 group reviewer:** donor and keeper both start from the three-use-case Oil group and same default selections. Keeper’s later commit observes one local choice per member and advance; transferred initial titles, checked states, uniform flag, no overrides, and one-group position cover the donor’s pre-commit state without altering the commit action.
- **C11 labelled wrapper:** `OilGroupReview`’s role/group labelling is unconditional for a nonempty group. The existing three-member keeper is sufficient for the wrapper/`aria-labelledby` association; the donor’s one-item shape only changes child cardinality, which neither transferred assertion claims. The distinct checked-item CTA behavior remains outside this cut.

C1–C3/C6/C7 are similarly literal SSR transfers on byte-equivalent card/group/screen inputs. Their controls target rendered owner attributes/content, not test helper implementation. C7 copies the legacy-stagebar negatives to each already-rendered Basis/Optional/loading/retry/unavailable state, preserving the five-state union.

## Controls and limits

`/tmp/test-audit-start-stage3-controls.json` provides owner-anchored intended-red recipes (e.g. role ordering/card formatting, snapshot display, group wrapper, Stage3 assignment). They are static preparation only. Main must still establish focused green → intended assertion red → exact restoration/green receipts, and recheck current hashes before integration. This review does not establish browser geometry, database atomicity, or provider behavior.
