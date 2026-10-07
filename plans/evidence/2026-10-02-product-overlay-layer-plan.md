# Product overlay: independent transfer review

**Scope.** Read-only second pass of the ten conditional donor declarations named in `/tmp/test-audit-next-coherent-layer-ledger.md`. I read each donor and proposed keeper, then traced the relevant owner and live callers. This is a transfer plan, not evidence that edits or controls have run. The native full-268 run was in progress and was not touched.

## Verdict

**Accept 10 conditional C cuts, provided all transfers below land in the named existing keeper bodies.** None is a standalone deletion. C9 needed a correction: its donor does assert the zero-horizontal-scroll case `[[0,222]]`; that exact input and final call must move to the priority keeper. C10 is feasible as a runtime test and should replace the source grep.

## Actual paths

| Area | Execution path and consequence |
|---|---|
| Compact card | `ProductCard` computes facts, price, and identity at [product-card.tsx:51-55](/Users/nick/AI_work/hair_conscierge/.worktrees/test-audit-pruning/src/components/chat/product-card.tsx:51), renders every fact label at [product-card.tsx:79-89](/Users/nick/AI_work/hair_conscierge/.worktrees/test-audit-pruning/src/components/chat/product-card.tsx:79), and price at [product-card.tsx:93-97](/Users/nick/AI_work/hair_conscierge/.worktrees/test-audit-pruning/src/components/chat/product-card.tsx:93). `fact.source` is used only as the React key at [product-card.tsx:83](/Users/nick/AI_work/hair_conscierge/.worktrees/test-audit-pruning/src/components/chat/product-card.tsx:83), so its literal strings are not a rendered contract. |
| Display owner | `buildCompactProductFacts` forms category, format, heat, then optional weight at [product-display-model.ts:130-155](/Users/nick/AI_work/hair_conscierge/.worktrees/test-audit-pruning/src/components/chat/product-display-model.ts:130); `formatProductPrice` catches invalid currency and retries EUR at [product-display-model.ts:250-268](/Users/nick/AI_work/hair_conscierge/.worktrees/test-audit-pruning/src/components/chat/product-display-model.ts:250). |
| Persisted chat | `attachProductLineNamesToMessages` flattens, invokes the real product helper with its diagnostic callback, identity-short-circuits fallback, then repartitions at [route.ts:14-45](/Users/nick/AI_work/hair_conscierge/.worktrees/test-audit-pruning/src/app/api/chat/[id]/route.ts:14). GET calls it after row normalization at [route.ts:86-91](/Users/nick/AI_work/hair_conscierge/.worktrees/test-audit-pruning/src/app/api/chat/[id]/route.ts:86). The shared helper performs the real table/column/id query and handles resolved-error and rejected-query paths at [display.ts:71-107](/Users/nick/AI_work/hair_conscierge/.worktrees/test-audit-pruning/src/lib/product-lines/display.ts:71). |
| Modal | Registration reconciles isolation at [modal-layer-manager.ts:273-287](/Users/nick/AI_work/hair_conscierge/.worktrees/test-audit-pruning/src/lib/ui/modal-layer-manager.ts:273). That reconciliation creates the body-child observer and callback at [modal-layer-manager.ts:182-199](/Users/nick/AI_work/hair_conscierge/.worktrees/test-audit-pruning/src/lib/ui/modal-layer-manager.ts:182), and releases it when no layers remain at [modal-layer-manager.ts:223-230](/Users/nick/AI_work/hair_conscierge/.worktrees/test-audit-pruning/src/lib/ui/modal-layer-manager.ts:223). |

## Transfers, exact retained assertions, and faults

| Donor → keeper | Required transfer | Fault caught in actual owner |
|---|---|---|
| `product-display-model:148` → `product-card-rendering:63` | With the existing Wella fixture, assert exact fact-chip text nodes/order `>Leave-in<` before `>Lotion<`, `Hitzeschutz`, and absence of `Mittel` and `Pflege:`. Do not carry source values. | Drop/reorder a compact fact or allow weight as a fourth fact in `buildCompactProductFacts`. |
| `product-display-model:214` → `product-card-rendering:63` | Tighten the existing 18.51/EUR rendered price to exact `18,51 €` (ordinary space), replacing its permissive whitespace match. | Change locale or stop normalizing NBSP. |
| `product-display-model:218` → `product-card-rendering:107` | In the existing image fixture, set currency to `NOT_A_CURRENCY`; retain image/no-icon assertions and add exact `18,51 €`. Normal EUR remains covered by :63. | Remove formatter catch/retry or use a wrong fallback currency. |
| `product-card-rendering:87` → `product-card-rendering:63` | Transfer the first-chip/order and `Mittel` absence assertions above. The donor differs only in name, which facts never read. | Omit facts or reverse category/format. |
| `product-line-display:68` → `chat-route-product-lines:58` | Make line-1 canonical name exactly `NEQI x @_the.beautiful.people`; assert it on the first product in the returned message. Keep table/columns/id query-port assertions. | Wrong table/columns/filter, null map, or first-product skip. |
| `product-line-display:100` → `chat-route-product-lines:58` | Add product-4 with `missing-line`; assert groups `[[product-1], null, [product-2,product-3,product-4]]`, names `[NEQI…, Line Two, Existing line, null]`, and one captured id batch `[line-1,line-2,line-3,missing-line]`. Retain the standalone all-enriched/no-query test. | Cursor advance/repartition error, overwrite existing line, missing-result mapping, or reordered query ids. |
| `product-line-display:118` → `chat-route-product-lines:89` | Add the resolved `{ data:null, error: lookupError }` query-port case. Capture `console.error`: exact lookup Error as second argument once; returned messages are the exact original array and retained product object. | Ignore `result.error`, skip owner callback, clone fallback, or replace error. |
| `product-line-display:131` → `chat-route-product-lines:89` | Add a distinct async `.in()` rejection `networkError` with the same exact callback/identity assertions; retain the current synchronous `.from()` throw as a third input form. | Remove awaited-query catch, rethrow, or silence diagnostic. |
| `modal-layer-manager:231` → `modal-layer-manager:192` | **Correction:** use `installFakeDom(0, 222)` in the priority/nested test. After dialog release assert body remains `fixed` and `scrollToCalls === []`; after sheet release assert final `scrollToCalls === [[0,222]]`. The existing :161 `[20,640]` test covers nonzero restore but does not replace this zero-left nested lifecycle. | Release body lock when top dialog releases, or lose captured zero-x scroll. |
| `modal-layer-manager:376` → `modal-layer-manager:161` | Replace source text regexes with a local injected `MutationObserver` capture port. After first registration, assert one observer observed `document.body` with `{childList:true}`; append a sibling, manually deliver its captured callback, and assert that sibling becomes `aria-hidden=true`/inert. On release assert observer disconnects and attributes restore. Preserve/restore the original global descriptor in a local `try/finally`. | No observer, observer no-op callback, no re-isolation for new sibling, wrong target/options, or no disconnect. |

## C10 feasibility

The existing fake DOM has mutable body children and attributes ([modal-layer-manager.test.ts:10-143](/Users/nick/AI_work/hair_conscierge/.worktrees/test-audit-pruning/tests/modal-layer-manager.test.ts:10)); `ensureBodyChildrenObserved` resolves `MutationObserver` when registering, not at module initialization. A test-local constructor can retain its callback, target, options, and disconnect count, then be installed before `registerModalLayer`. It need not emulate browser scheduling: manually invoking the captured callback is the relevant owner boundary. If the implementation cannot restore the global descriptor cleanly under the test harness, C10 becomes **F** and only nine cuts proceed; it must not revert to the private source grep.

## Verification plan for parent

Proposed focused native command only, after edits:

```sh
node --import ./tests/server-only-register.cjs --import tsx --test tests/product-display-model.test.ts tests/product-card-rendering.test.tsx tests/product-line-display.test.ts tests/chat-route-product-lines.test.ts tests/modal-layer-manager.test.ts tests/bottom-sheet-focus.test.tsx
```

Then use owner mutations matching the rightmost column. No mutation or test was run in this review.

## Depth limits

I audited only the ten named donor/keeper transfers; the remaining 54-cohort declarations remain navigation evidence, not revalidated verdicts. The chat helper test exercises the production persisted-message projection with an injected query port; it does not establish GET authentication, row persistence, or live Supabase behavior. The observer port proves callback handling and cleanup, not browser-native mutation timing.

