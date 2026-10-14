# Retire the unused plannedLabelFor presentation method

Decision: the current audit explicitly includes removing obsolete, unreachable application paths. Main has confirmed that this supersedes the historical future-reconnect retention recorded in commit0bec2b93 and plans/2026-08-16-selected-is-ready/plan.md:86. No new approval question applies. This is a separate step after the six Routine presentation Cs complete, so their original source guard/control baseline remains intact.

## Exact bounded change

- Source: remove only the six-line `plannedLabelFor(sourceDecisionKeys)` method from the object returned by `src/lib/personal-plan/routine/portfolio-presentation.ts:93`. Keep the containing export, shared schema3/4 predicate and fitLabelFor implementation byte-for-byte. All imports still serve live functions/types; no import is removed.
- Delete exactly one declaration: `tests/personal-plan-portfolio-presentation.test.ts:154` in current pre-six-C source, “marks a v3 pending-source replacement as Noch kaufen even without a retained catalog product”. Its sole terminal assertion calls the retired method.
- Three retained callbacks lose only obsolete method assertions: two assert.equal statements from “uses v3-only labels for a replacement and an informed override, preserving legacy wording”; one from “presents v4 replacement metadata while leaving retained inventory display-only”; one from “marks a v3 planned purchase without an owned source as Noch kaufen”. **Three callback sites, four assert statements**, not three statements. Both live fitLabelFor assertions and every remaining projection/schema/JSON assertion stay exact. Titles are preserved under the requested only-clauses scope; the last title still mentions historical Noch-kaufen copy although its remaining oracle is the current decision-key projection.
- Count: predecessor six-C cohort69→retired68; portfolio file9→8. One declaration credit only. No credits for four removed assertion statements, method removal, or changed callback bodies. No new calls/fixtures/rows.

`plannedPurchaseDecisionKeys`, strict stored schemas, reader behavior, acquire API/service and current card behavior are excluded from the edit. The original six-C editor/manifest/snapshots were not modified.

## Current caller and owner closure

The complete109-line owner was read. loadOwnerPortfolioPresentation is live: it performs the scoped query, strict parser and row/snapshot identity validation, then emits schemaVersion, plannedPurchaseDecisionKeys, retained-owned inventory, deferred reasons and v4 retained inventory. Its projection reads plannedPurchases.sourceDecisionKey; none of this is removed.

The label factory computes a schema3/4 predicate and returns two independent methods. The retired method reads sourceDecisionKeys and presentation.plannedPurchaseDecisionKeys to produce the historical “Noch kaufen” label. fitLabelFor reads only the shared schema predicate and supplied fitDecision; it never calls or inspects plannedLabelFor.

A static scan enumerated3067 JS/TS source paths in src/scripts/packages/apps/tests, then parsed every file mentioning the module or symbols. Saved proof: `/tmp/test-audit-routine-planned-label-retirement-closure.json`. Eleven import declarations reference the module. Only `src/components/routine/personal-plan/routine-item-card.tsx:19` imports the value routinePresentationLabels outside tests; its only use at:176 is the immediate expression `routinePresentationLabels(presentation).fitLabelFor(item.state.fitDecision) ?? "Bewusste Wahl"`. There is no local alias, assigned returned object, object spread, enumeration, dynamic member selection or object escape at this call. Other application imports use loadOwnerPortfolioPresentation or type PortfolioPresentation, so they cannot dynamically reach the returned method. There is no module re-export/barrel, namespace import or require/dynamic import path to the label factory in the current path/symbol census. All plannedLabelFor references are its declaration and the test calls being removed.

The root package is private and has no exports map. The only workspace exports map is @chaarlie/product-intake-core's ./src/index.ts, outside this module and with no re-export path to it. The review app is a separate private workspace. tsconfig's @/* alias resolves directly into src; it does not provide a published SDK surface. The AST receipt records actual import clauses so an aliased imported symbol cannot disappear into a name-only census. Static closure does not prove arbitrary untracked external code does not import private application internals; no supported package/route/operator contract exports this method.

The actual card now presents selected products as Aktiv/✓Passt, not a purchase gate. Existing `stage4-ui:505` actual RoutinePage renderer checks exact Aktiv metadata, absence of Noch kaufen, presence of Mit Einschränkung, one retained Altes Shampoo and collapsed details. Current card/status owner read confirms sourceDecisionKeys still serve independent deferral-reason mapping; no field or type is deleted.

Historical0bec2b93 (#439) explicitly made catalog selections full members and left acquisition plumbing dormant. Current retirement deletes this unused display method only. The acquire route remains an actual exported POST: `src/app/api/personal-plan/routine/planned-items/[itemKey]/acquire/route.ts`, with release/auth/frontier/params guards and real acquisition-service factory. That route and `src/lib/personal-plan/routine/acquisition.ts` are hash-guarded untouched. No inference that its endpoint is retired is made.

## Donor readset and independent remaining proofs

The removed callback builds v3Snapshot, empties retainedOwnedProducts, changes the planned purchase sourceDecisionKey, and adds a structurally valid shampoo/unknown/planned_purchase category resolution. A fake query returns that stored snapshot to the actual reader. It then calls only plannedLabelFor and asserts Noch kaufen. The category resolution is accepted by the strict structural schema, but neither reader's projected decision keys nor the retired method consults categoryResolutions. The method output is wholly determined by schema3 and the source key in plannedPurchases. Thus the obsolete terminal oracle does not assert current pending-product persistence, authority choice, acquisition, or executable routine identity.

Retained independent proofs are concrete, not a claim of exact fixture equivalence:

1. Same portfolio-presentation suite retains the no-owned-source callback's exact `plannedPurchaseDecisionKeys === ["decision-replace"]` assertion. It retains the two-role case expecting one retained product plus both exact decision keys. The transferred actual GET keeper asserts JSON key array, schema3, exact retained-name array, no-store200 and observed ordered scoped query. None are inferred from expected values generated by the reader.
2. Same suite retains strict stored-snapshot unknown-field rejection and v4 exact retainedInventoryProducts/schema4. The actual schemas and parser implementation are byte-identical.
3. `tests/personal-plan-stage3-portfolio.test.ts:498`, “portfolio v3 keeps a pending submission while projecting its selected verified replacement”, runs the actual producer on a pending Conditioner identity and verifies the pending product is retained and the complete planned replacement/sourceDecisionKey is emitted. Its verdict is mismatch, not the removed fixture's unknown; it is not represented as literal same-input proof.
4. Same file:659, “portfolio v3 round-trips a selected replacement beside a legacy planned recommendation”, runs producer then strict parser and asserts schema3 plus exact replacement/legacy productId→sourceDecisionKey pairs.
5. `tests/personal-plan-routine-candidate-compiler.test.ts:549`, “compiler gives a v3 selected replacement precedence over its pending source identity”, parses actual v3 structure and compiles the selected product/assignment identity. Its inherited category resolution is unknown/pending_review and its selected planned purchase has the same source decision key. It protects the actual downstream identity precedence, not the retired label. Complete callback and inherited portfolio fixture were read.
6. Both v3 informed_override→Mit Einschränkung and null legacy→null fitLabelFor assertions remain in place; actual UI v3/null rendering remains unchanged.

No claim is made that another test repeats the deleted Shampoo unknown/planned_purchase fixture byte-for-byte. Its structural parser acceptance was incidental setup for an unreachable label contract. Current authoritative category/pending/replacement and JSON field assertions remain at actual producers/readers/consumer boundaries, and no parser/category behavior is modified.

## Guarded artifacts and execution ordering

- Editor `/tmp/test-audit-routine-planned-label-retirement-edit.cjs`
- Manifest `-manifest.json`, SHA256 `202ca66d400c4b04342d12e17cad193b7d06feec7730c97765174061b1959dc7`
- Exact before/after source+test snapshots `-snapshots/`
- Complete diff `-complete.diff`
- Closure receipt `-closure.json`

The before test snapshot is the exact existing six-C cut snapshot, not the current75 source. The editor pins the predecessor manifest hash, all six predecessor-cut test hashes, both target before/after hashes, every callback hash and29 source/keeper/config guards. It parses all output snapshots before any write. All unrelated callbacks are byte-identical; the three named retained callbacks differ only by the four recorded assertion removals. Production source differs only by exact removal of the one method; the reader prefix and fitLabelFor remain byte-identical.

`--check` recognizes the currently reviewed predecessor phase (before/transfer/cut) and reports applyReady. It does not modify the repository. `apply` is refused unless the entire six-file cohort matches the exact69 cut state and all source guards remain original. It stages all outputs in memory, rechecks guards/cohort immediately before first write, snapshots original target bytes to a unique /tmp receipt, then writes exactly two files. No repinning of drift or transient source mutants occurs.

Run order for main, once exclusive runner/writer windows are released:

```
node /tmp/test-audit-routine-planned-label-retirement-edit.cjs --check
# Only after original six-C transfer/control/cut proof has completed:
node /tmp/test-audit-routine-planned-label-retirement-edit.cjs apply
```

Then main's existing six-file native command should move69→68. The Stage3 portfolio and routine-candidate-compiler keeper files can be included in main's focused verification without adding declarations or test data. CI typecheck verifies inferred return type consumers after method removal; main owns relevant native/full coverage proof. No new provider/browser/DB execution is needed for this method retirement.

## Actual verification and limits

Only /tmp files were written. Static TypeScript parsing, anchor uniqueness, counts, prospective callback preservation and guarded --check succeeded. The current predecessor phase is before, so applyReady=false is expected. No native tests, compiler/typecheck, mutation controls, browser, provider, DB, catalog or environment access was performed. The closure scan is a resolved local source/callsite audit, not deployed telemetry. Original six-C source guards remain valid and its evidence files remain untouched.
