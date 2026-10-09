# Public funnel66 independent preservation review

**CONDITIONAL PASS for C1, C2 and C3. No blocking preservation gap found.** This verdict covers the frozen three transfers and donor removals. It gives no runtime, coverage, deletion or source-retirement credit. Root remains the sole operator; the three transfers need the proposed native and actual-owner assertion proof before cutting.

Packet `/tmp/test-audit-public-funnel66-c69uzpx6` is pinned by manifest SHA256 `152177b98efeb7dd05c261323a8eaec59f1bf6cabb690a122c1e645414552b9a` and handoff-receipt SHA256 `c4a22b53082fc6edf7c06d7781f788af9dce0d0767ce1c365bdcdeb60450cf85`. Both match. All97 original source/support/dependency readset hashes matched frozen copies and current bytes during the independent static check; all12 original test files likewise matched. Nothing was repinned.

## C1 — PASS: one real default GatedPreview tree, full scroll union

Donor `tests/gated-preview-component.test.tsx:141–169` and keeper117–139 both execute exactly `renderPreview().render()` without an override. Full helper/default props, dispatcher and walkers were read. Each fresh dispatcher initializes the same single useState to false. It calls actual `GatedPreview`; the fixture does not manufacture the returned DOM shape. The walker visits returned React elements without executing Button or PremiumSheet. This is a direct component/hook-dispatch test, not mounted React, browser scrolling or a PremiumSheet integration test.

The real owner `src/components/gated-preview/gated-preview.tsx:51–118` derives its ID solely from the routine feature and reads the same source, German label/benefit/CTA and literal child. Neither render consumes time, random data, storage or a request. The retained label query already enforces exactly one label and reads the very same element in the same tree. Reusing that result loses neither its exact-one helper assertion nor a second state transition; the donor had no preceding transition.

All nine explicit donor assertions survive verbatim at the original keeper: overflow-y-auto, min-h-0, role=region, aria-label absent, aria-labelledby equals the label ID, independently truthy ID, tabIndex0, exactly one expected child within the scroll element, and exactly one class-matching scroller anywhere in the tree. The independently truthy ID prevents equal-empty ID/association false green. requireByData still checks exactly one scroll container; existing keeper requireByData checks the single label. Original frame/copy/CTA/viewport assertions remain intact. No new render, fixture input or callback call is added. The only duplicated queries eliminated are the duplicate owner render and duplicate identical label lookup.

Keep the existing chat override open→CTA callback→open/context→close sequence and application copy override separately. Those consumed props and state prefixes differ. Consolidation does not validate focus management, actual scroll geometry, button host rendering or live payment behavior; none was established by the removed declaration.

## C2 — PASS: identical Chat composition; raw timestamps and rendered absence both remain

Donor `tests/gated-example-pages.test.tsx:294–299` and keeper271–292 use the exact same `render(GatedChatExample)`, actual AppRouter/Pathname providers, pathname `/routine`, no component props, same four shared messages and initial closed sheet state. The router's navigation/refresh functions throw but do not construct the asserted HTML. Real ReactDOM SSR executes actual GatedChatExample, ChatMessage and ChatInput. No event/effect runs between the original setup and assertion blocks.

Full `GatedChatExample`, fixture factory/array, `ChatMessage` and `ChatInput` were read. All messages have empty created_at and null recommendations/message_context/feedback. Those actual predicates exclude product, lookup, intake and feedback subtrees. Hair profile is null; all mutation callbacks except the disabled composer's no-op onSend are absent. ChatMessage computes new product maps and normalized text without changing message objects. Clean empty timestamps short-circuit the formatter. The disabled input initializes empty state and has no form host. This is not a mock-provided expected result.

The entire raw-field loop remains unchanged, traversing the same four messages. The rendered negative keeps the same regex; its subject alone changes from a second `render(GatedChatExample)` to the keeper's existing `html`. Both are needed: checking raw fields alone would miss a renderer that always prints a time, while checking output alone would miss a populated raw timestamp suppressed by some unrelated render change. The keeper's existing user/assistant/input markers, disabled marker, four/two-user counts, capability bans and absent feedback/product affordances remain exact.

The raw-field check now runs after the keeper's SSR rather than before the donor's SSR. Actual reviewed clean owner rendering does not mutate the fixture; no current mutable readset distinction makes this reordering meaningful. We do not promise equivalent behavior for an invented renderer that corrupts then restores the fixture during render. This is not a hydration test: it preserves initial SSR and the literal empty-time contract that prevents the known timezone-dependent markup.

## C3 — PASS: each of three existing trapped SSR results retains all negatives

Donor `tests/gated-pages-zero-mutation.test.tsx:137–143` and keeper127–135 are inside the already-existing routine/anwendung/chat COMPOSITIONS loop. The proposal removes the second registration, preserving the three original rows and first registration. That is one AST declaration and three native registrations removed, not three new declaration credits.

Both call exactly `renderComposition(Composition)`. Full helpers were read: fresh fetch/XHR/beacon recorders, original descriptor capture and finally restoration, identical throwing router, pathname `/routine`, actual ReactDOM SSR. The original keeper still requires an empty request list and nonempty actual HTML. Every row gains the unchanged `<form`, `type="submit"` and `formaction=` absence assertions on that same result. No render, transport call, row, input, handler action or mock result is added.

The composition fixtures and direct real page owners were read. Routine uses an active payload with five owned included products, no pending proposal and no edit/detail callbacks; it builds fresh maps and projected arrays. Application uses ready state with the same four day records, no selected day and no currentPathname; sorting copies its input (`[...days].sort(...)`). Its overview/shelf logic uses map/slice and does not modify the fixture. Chat has the closed, empty-time shape described above. Thus no producer mutation, later state or different dependency environment distinguishes the old second render.

The architecture/module scans and direct InertExample capture/key-handler tests remain separate. SSR effects are no-ops; a clean network recorder does not prove the mounted composition cannot fetch, submit, navigate, hydrate or load images. PremiumSheet is actually called during SSR, but BottomSheetContent initializes mounted/visible false and returns null, so its child payment surface is not rendered. No claim of provider/payment coverage follows from C3. The useful existing import exclusions and their held limitations stay unchanged.

## Whole cohort and precise preservation

All twelve original test files, callbacks, fixtures/helpers and literal tables were fully read:

| File | Original declaration sites |
|---|---:|
| funnel-api.test.ts | 4 |
| funnel-client.test.ts | 8 |
| funnel-cookie.test.ts | 4 |
| funnel-migration.test.ts | 5 |
| funnel-rate-limit.test.ts | 3 |
| funnel-route.test.ts | 3 |
| funnel-server.test.ts | 6 |
| gated-example-pages.test.tsx | 11 |
| gated-pages-zero-mutation.test.tsx | 8 |
| gated-preview-component.test.tsx | 4 |
| editorial-pages.test.tsx | 8 |
| landing-client-import-boundary.test.ts | 2 |

The 66-site ledger's judgments and all original assertion bodies were reviewed. This is not a new full semantic re-audit of every transport/legal/payment implementation underneath those retained tests. The full operative-owner review is concentrated on the three changed surfaces; broader source-reading limits are below.

The independent checker reconstructs all12 transfer files from exact original keeper-statement replacements and all12 cut files from the exact donor removal strings. All other bytes are unchanged. Sixty unrelated registrations are byte-identical in both phases; nine whole test files are byte-identical. All nine held F sites are explicitly matched by title and exact original statement. No helper/import/export/source change, new skip or retirement is introduced.

AST66→66→63; literal native79→79→74. The additional13 native registrations before/transfer arise from the four-route loop (+3) and five three-composition registrations (+10); cut retains four three-composition registrations (+8). This static expansion is not an observed runner count. Assertion sites294→308→294: C1 nine, C2 two and C3 three transferred; final site count remains equal, without claiming site equality alone proves preservation. C2's only assertion-text adaptation is using existing html. C1's nested label-query helper assertion remains at the original keeper query. Full unions were independently inspected rather than inferred from those counts.

## Twenty controls, fourteen unique complete mutants — static assessment only

Every find anchor occurs once in the pinned whole source, reconstructed full mutant SHA and snapshot agree, and each mutant parses as TS/TSX. Exactly one native title matches each selected command in its selected test file. All transfer and cut first-frame files, lines and complete assertion texts match the frozen keeper ASTs. The controls mutate three actual files: GatedPreview, shared Chat fixture and ChatMessage. No injected test-return value is used.

| Controls | Real fault and intended first assertion | Operator / decoded message evidence |
|---|---|---|
| C1-01 | Remove scroller overflow-y-auto; line141 | match; overflow-y-auto and remaining class text |
| C1-02 | Remove scroller min-h-0; line143 | match; min-h-0 and remaining class text |
| C1-03 | region→presentation; line146 | strictEqual; presentation / region |
| C1-04 | Add duplicate aria-label; line150 | strictEqual; duplicate / undefined |
| C1-05 | Wrong aria-labelledby; line151 | strictEqual; wrong-label / gated-preview-label-routine |
| C1-06 | Both referenced and actual ID become empty; line152 | ==; explicit “the band needs an id for the region to reference” |
| C1-07 | tabIndex0→−1; line153 | strictEqual; −1 / 0 |
| C1-08 | Remove actual children; line156 | strictEqual; explicit child-inside-scroll diagnostic, actual0/expected1 |
| C1-09 | Add second overflow-y-auto class to frame; line159 | strictEqual; actual2/expected1 |
| C2-01 | Fixture factory emits valid fixed ISO time; line294 | strictEqual; ISO value / empty string |
| C2-02 | Actual timestamp JSX always prints12:34; line296 | doesNotMatch; timestamp class and12:34 |
| C3-01/04/07 | Insert real form host in each existing composition's shared frame; line137 | doesNotMatch; `<form` |
| C3-02/05/08 | Insert explicit submit button; line138 | doesNotMatch; `type="submit"` |
| C3-03/06/09 | Insert string formAction button; line139 | doesNotMatch; /forbidden and formAction attribute |

Earlier keeper assertions should remain satisfied for each intended fault: none removes the queried data marker; C1-06 leaves equality true so the separate nonempty assertion catches it; C1-09 keeps rounded/border/overflow-hidden and the unique data-marked scroll element while the class count becomes two. The direct GatedPreview tree does not run CSS merging on those raw frame classes. For C2-01 a valid ISO string avoids Invalid Date; C2-02 changes both condition and rendered value so a RangeError cannot masquerade as lost timestamp suppression. For C3 the inserted nodes leave original content/nonempty/network assertions intact; string formAction uses the real React host serializer and does not call a server action. Each negative order is deliberate: form first, submit second, action third.

All20 recipes were inspected, including the repeated three-host-node mutations selected separately for each existing composition. These are14 distinct mutant byte contents, not20 unique source faults. Numeric message fragments alone are weak; operator, typed actual/expected where applicable and FIRST intended keeper assertion frame must govern the main proof, not a coincidental digit somewhere in the HTML. All recipes currently remain UNRUN. Setup, import, native timeout, skipped selection, console warning or helper assertion failures are not acceptable substitutes.

## Retained F sites and non-blocking correction

Held unchanged: ASCII-only byte-size test; successful-first-attempt test named retry; three HTTP rejection tests whose titles imply unobserved DB/body-read ordering; trusted-offer positive without the titled browser contrast; route-window branch grep; incomplete regex import graph; inert-range check without actual closing-tag ancestry. Their existing positive/negative contracts remain; no fixes or credit are asserted.

**Low-severity documentation correction:** complete-ledger row `gated-example-pages:7` says “real four catalog fixtures.” The actual fixture has five products, and the retained test requires five and checks every product's name/image. No code or assertion loss follows; read it as five. No other blocker identified.

## Read depth, live callers, history and limits

Full independent fresh source reads: GatedPreview, InertExample, all three gated compositions, example-copy, all four fixture modules (chat/products/routine/application), ChatMessage401 lines, ChatInput72, RoutinePage328, RoutineSection, ApplicationPage207, ApplicationOverview and ApplicationDayCard, Button, usePlanSelection, orderedBenefits, gate and chat page. Relevant RoutineItemCard predicates were inspected by bounded readset search rather than a fresh full550-line audit; its outputs are unchanged. No exhaustive transitive owner-read claim is made.

PremiumSheet was read at imports/initial context+reducer+selection88–158, callback/render boundary449–510 and render tail690–715; BottomSheet provider30–65, initial content state140–180 and null/portal boundary480–502. These slices establish the identical closed SSR path; they do not audit the payment machine or all effect closures. Necessary React dependency slices were read: dispatcher515–524/1259–1268, SSR reducer3870–3928 and hook dispatcher9696–9725, host/form-action serialization1050–1135 and1551–1587. Next pathname/router117–159 and date-fns valid-date guard329–360 were read. Actual dependency files remain pinned; no owner/vendor runtime execution occurred.

Live routing was established through the complete Chat page and gate, Routine page276–333, Anwendung307–332 and frozen caller search. They preserve premium/keepsake/example branches; no obsolete-owner conclusion is proposed. The full three frozen history excerpts (#527 presentational example boundaries; #565 acquisition retry/order; #454 dynamic landing/import boundary) were read. CI quality-node135–166 and package40–55 route these top-level ts/tsx files through test:node. Historical claims were used as intent evidence, not current runtime verification.

All12 tests and all66 ledger judgments were read. The remaining transport owners, SQL migrations, legal/editorial implementations, proxy, full browser routing, complete vendor trees and arbitrary transitive callbacks were not freshly re-audited in this preservation review. Their97 byte pins and unchanged tests preserve the original proposal, not independent full-domain credit. No database/provider/browser call or image fetching took place. No repository/config file was written and no existing packet artifact was changed.

## Acceptance conditions and independent artifacts

Independent read-only checker: `/tmp/test-audit-public-funnel66-independent-static.cjs`; output `/tmp/test-audit-public-funnel66-independent-static.json`. **996 checks PASS**, no repinning, zero checker filesystem writes, zero children/owner imports/runtime runs. Its stdout was saved separately in TMP. It performs hashes, AST parsing, exact reconstruction, callback/assertion union checks, static literal-title expansion and source recipe checks only.

Root still needs frozen-guard acceptance, clean full79 original/transfer and74 cut native proof, exact-one clean→intended ERR_ASSERTION→byte-exact restore→clean controls, and its usual integrated verification. The source recipes and pinned first oracles are ready for that main-owned proof. This review does not authorize or perform integration itself.
