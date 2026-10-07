# Independent checkout/Premium11 preservation preflight

Verdict: **support all C1–C11 conditionally on main's native before/transfer/control/cut verification; no assertion-preservation blocker found.** This is a bounded preservation review, not executed proof or a fresh retirement decision. No production behavior/source change is proposed. The source/helper layers remain live; the exhausted ordered-benefits test file may disappear because its complete input/output contract moves to the existing component renders.

Scope: all 27 original callbacks and their local fixtures/harnesses in the four files; all 11 complete donor/keeper before/after bodies; proposed transfer/cut strings; actual PremiumSheet, ordering, pricing, context, dismiss, purchase-state, plan-selection, checkout-context-storage, selector, reference-price, Stripe pricing and catalog implementations. Caller search confirmed ordering's actual component consumption and the relevant default/recommended/badge consumption. I did not rerun repository-wide history/CI or audit provider checkout children, lifecycle suites, real navigation or all production caller flows. Author history/CI claims are not independently recertified here. Tooling4 is outside scope.

## Per-declaration judgment

All source lines below are the original/current-before files. Machine candidates preserve exact whole callback strings and titles.

| ID / original donor | Existing keeper | Full union and operative input proof | Judgment |
| --- | --- | --- | --- |
| C1 component:205, approved header | component:347, tapping a plan row | Both use fresh default renderSheet. Header from existing `before` tree now asserts `/Chaarlie Premium/` and `/Alles für dein Haar\./`, precisely the two original checks. No new render. The donor never asserted one exact full header string. | Support conditional |
| C2 component:301, plan rows | component:347, tapping a plan row | Same fresh default tree. Existing `before` receives year/quarter/month order, all three exact combined German name/detail/price strings, false/true/false selection, quarter aria-pressed true, one Beliebteste Wahl badge on quarter, whitespace-nowrap and inline-block, zero old empfohlen marker. Existing monthly click/after selection/CTA checks remain. | Support conditional |
| C3 component:402, opens checkout in place | component:417, mid-payment escape | Same initial default context and close counter. Original keeper had render→CTA click→render→dismiss click→render. Proposed keeper names the same middle render and checks closed=0, no plans, no CTA, actual PremiumSheetCheckout element present, escape text Plan ändern, then invokes the same escape and retains back-to-plans/closed=0/checkout absent checks. Exactly three renders and two clicks; no added input/event. | Support conditional |
| C4 ordered-benefits:15, null fallback | component:248, null context | Fresh component null context reaches actual orderedBenefits(null). Expected value changes from calling the producer to independent literal routine/empfehlungen/chat; three-item assertion remains. No held non-null context applies to this fresh instance. | Support conditional |
| C5 ordered-benefits:30, tapped-feature template | component:213, every feature | Existing seven component renders cover all seven original features. Independent fixed arrays replace producer-derived expectations. orderedBenefits reads only nullness and feature; source:test versus source:scan:verdict is inert to this function. Context source remains separately observed in the retained dismiss-label cases. Full exact order map is below. | Support conditional |
| C6 ordered-benefits:38, unique features | component:213, every feature | Same seven operative feature inputs already present; transferred Set(ids).size===ids.length plus literal arrays detects duplicated IDs. Loop order differs but helper is pure/no state and each harness is fresh. No new row/render. | Support conditional |
| C7 pricing:116, quarter selected/recommended | component:347, tapping a plan row | Actual usePlanSelection consumes default constant; pricing constructs recommended from interval===recommended constant; actual component emits badge constant only on recommended rows. Exact initial order/selection/quarter CTA and exclusive quarter badge/text in strengthened keeper deliver all original constant/list observations. No separately supported raw SDK/config consumer identified. Source exports are retained. Launch ON/OFF money/catalog tests and exact year/quarter/month CTA labels remain. | Support conditional |
| C8 selector:82, reference prices | selector:64, stable motion hooks | Both call renderSelector(QUIZ_RESULT_REFERENCE_PRICES), with same standard catalog, quarter, busy=false and handlers. Existing HTML receives exactly three s-tags and complete ordered label array via same formatter/map oracle used by donor. No extra SSR call. | Support conditional |
| C9 selector:92, discount copy | selector:64, stable motion hooks | Exact same SSR input. Both visible JETZT MIND. 20 % RABATT SICHERN and accessible Jetzt mindestens 20 Prozent Rabatt sichern plus absence of Regulärer Vergleichspreis copied unchanged. | Support conditional |
| C10 selector:100, reference styling | selector:64, stable motion hooks | Exact same SSR input. Exact class text-[14px] font-medium leading-none text-muted-foreground count=3 preserved, including class order. | Support conditional |
| C11 selector:110, no references | selector:56, idle action label | Both call renderSelector() with undefined references/default idle inputs. All three negative regexes (s-tag, Vergleichspreis, Regulärer Vergleichspreis) and zero extracted s-label count copied. Existing exact quarter CTA and no disabled/aria-disabled remain. | Support conditional |

C5 fixed order oracle retained in existing seven renders:

- routine → routine, empfehlungen, chat
- empfehlungen → empfehlungen, routine, chat
- chat → chat, routine, empfehlungen
- anwendung → anwendung, routine, empfehlungen
- merkliste → merkliste, routine, empfehlungen
- haarcheck → haarcheck, routine, empfehlungen
- verfeinerung → verfeinerung, routine, empfehlungen

Registry length=7, rendered length=3, first=tapped, registry label/copy and first-only plum accent checks remain. This does not rely on identity of raw context objects or assume source is inert everywhere. The exact ordering helper's source-independent readset justifies the lower source:test fixtures' removal.

## Rejected false positives and honest limits

1. **Different context source** does not prevent C5/C6: the order helper never reads source; it performs null check, core filtering by feature and return. The separate source-sensitive escape-label tests stay.
2. **Pure default/recommended constants versus rendered behavior** is not independently necessary here: current actual hook/pricing/component consume these constants. Changing default to year, recommended to year or badge text changes the existing rendered keeper. This does not license removal of money amounts, analytics IDs, currency, catalog/launch flag or year CTA cases; those remain.
3. **Mid-payment title/navigation wording overclaims the harness**, but no proof is lost. The middle reducer state is starting, not provider-ready paying. Effects are intentionally skipped, opaque checkout child is not executed, and the donor has no navigation assertion/counter. Both use the actual parent reducer and callbacks. Describe the preserved contract as parent checkout-element transition and escape, not provider/redirect verification.
4. **Reference expected labels use the production formatter**: this correlation already existed in C8; copying it preserves the donor contract but does not independently prove formatter correctness. Main's owner amount fault tests rendered projection; it is not a formatter conformance proof. No new correlation introduced.
5. **Motion keeper includes source greps**: those retained checks are not a claim of mounted animation/remount behavior. They do not invalidate using its already-produced actual SSR HTML for the independent reference assertions.
6. **Grouping unrelated input cases** is absent. C1/C2 observe a preexisting tree; C3 observes a preexisting intermediate tree; C4–C6 replace or extend existing outputs for existing renders; C8–C11 reuse exact existing SSR output. C7 transfers the actual default configuration to its consumer. No new call/table row/fixture earns credit.

## Static verification and remaining execution gates

Independent static receipt: `/tmp/test-audit-checkout-display27-preservation-static.json`; checker: `/tmp/test-audit-checkout-display27-preservation-static.cjs`. Checker imports only TypeScript parser, fs, crypto and assert, never tests or owners.

- Manifest SHA256 `1cc353a6490caa65dae0f61231a01452b6666688e503d7e46a2680b0388ef16a`.
- All four current test files match before-stage hashes. All 14 current source/dependency guards match.
- All 12 prospective stage strings parse. Exact AST totals 27→27→16. Predicted expanded cases34→17 are not extra declaration credit.
- 21 non-keeper callbacks, including all donors, are byte-identical before→transfer. Every retained callback is byte-identical transfer→cut. Exactly named donor callbacks disappear.
- All 22 control source hashes and unique anchors match; prospective mutated strings parse. None executed here.

Main must inspect selected intended assertion failures and restored byte hashes; static parse cannot establish failure attribution. Existing control descriptors cover brand/promise, order/name/month detail, default/recommended/badge copy/styles, unexpected close/CTA retention/escape text, null/core/duplicate benefits, reference amount/visible and accessible copy/negative wording/style/no-reference leak.

For fuller C3 fault attribution, main may additionally replace only the actual starting-state PremiumSheetCheckout element with an inert element and/or expose plans during starting: the transferred child-presence/plans-absence assertions should fail while return-to-plans still works. This is a control-coverage observation, **not a lost assertion or semantic hold**; the full union is visibly present. No fault was prepared/applied by this review.

Changed repository files: none. Only this report and the independent static checker/receipt under /tmp were written. No tests, source mutations, compiler execution, build, browser/provider/DB/network actions or external review were run.
