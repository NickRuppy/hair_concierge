# Product presentation and shared-overlay owner-layer challenge

Read-only worktree: `/Users/nick/AI_work/hair_conscierge/.worktrees/test-audit-pruning`; campaign base `21e0e41f`. Main remains sole writer. No repo edits, tests, compiler runs, mutations, provider calls, browser actions, .env reads or counterpart dispatch occurred.

## Verdict and denominator

**10 conditional C removals; 0 D; 40 R; 4 F — 54 declarations in 7 complete test files.** No added test sites are needed. Every C names an existing final keeper and preserves actual inputs/outputs at the higher boundary. Cases inside the strengthened error keeper are execution cases, not extra declaration credit. This is a coherent product presentation / overlay dependency slice, not a 250-site claim or whole-UI audit.

Earlier `/tmp/test-audit-ui-ledger.md` retained product-line helpers on generic “neither layer subsumes the other” reasoning and retained observer source text because its fake DOM could not model callbacks. This pass rejects that reasoning where a real existing consumer already provides the contract, but identifies one important true distinction: parts-versus-joined-label has a live drawer/popover consumer and cannot be erased by a card assertion.

All 54 bodies, file-local helpers and literal inputs were fully read. Complete primary source owners read: product-display-model, product-card, product-image, product-detail-drawer, product-popover, product-lines/display, chat/[id]/route, modal-layer-manager, bottom-sheet, dialog, toast-provider and leave-in constants. Supporting caller paths were inspected at ChatMessage, ChatContainer, RoutineDrawer and select-products; those larger callers were read at relevant call sites, not fully audited. Discovery product-line-title test was fully read for navigation (9 sites), but remains outside this 54-site cohort and no cuts are proposed there. chat-product-mentions was read only in excerpts/navigation and is already being changed by another lane. Two immediate-Escape Playwright test bodies were fully read as supporting evidence; their full spec fixtures were not independently audited and they are not cut candidates. Source-only F guards' consumer title call sites were inspected, not entire billing/cookie/feedback subsystems.

## Actual owners, product constraints, history and CI

* ProductCard calls buildCompactProductFacts, formatProductPrice and getProductIdentityDisplayLabel directly before rendering. ChatMessage renders real ProductCard recommendations; ChatContainer renders ProductDetailDrawer. Drawer and RoutineDrawer consume summary/application/profile rows and purchase-link helpers that compact cards never call. ProductPopover and ProductDetailDrawer destructure getProductIdentityDisplayParts into separate brand/line rows, making array shape meaningful.
* Product identity rules `docs/product-catalog-identity-rules.md:18–45` explicitly require Brand · Line, then product-specific name, category chip and limited compact facts. **807eb5bf (#194)** added current line enrichment/card changes after review caught duplicate brand/line rendering. Preserve the display behavior; do not retain arbitrary React-key source identifiers as public data contracts.
* Chat GET normalizes persisted messages then calls actual attachProductLineNamesToMessages. This flattens products, calls real attachProductLineNamesToProducts, and partitions the result back into message groups. Its injected Supabase-shaped client is an external query port, not a stub of the tested helper. The second live caller is select-products.ts:3604; it uses the same enrichment helper with a logging callback. Distinct query failures and all-enriched no-query remain protected.
* BottomSheet and Dialog both register with the shared manager in layout effects. **13b7d798 (#491)** documents the real first-visible Escape race and moved keyboard handling into the manager. Existing Playwright tests at personal-plan-start.spec.ts:234 and :654 exercise that race for sheet and dialog. They do not prove every restore-focus/drag/title/exempt-toast behavior represented by source guards.
* **feb9284c (#614)** added/refined bottom-sheet focus and transition behavior. The focus-action tests receive distinct lifecycle inputs; no existing composed runtime keeper found in this bounded scope receives all of them. Their source CSS guard is F, not automatic D.
* package.json:49 `test:node` includes all 7 files; `.github/workflows/ci.yml:158` runs it. Parent should use native Node/register/tsx below, not a browser runner for these ten C changes. No measured runtime/coverage improvement is claimed. Global <=2pp gate remains mandatory.

## Concrete C ledger
### C1 — `tests/product-display-model.test.ts:148`

buildCompactProductFacts returns whitelisted leave-in facts for a Wella-like product

Primary keeper: `tests/product-card-rendering.test.tsx:63`.

Input and assertion transfer: The Wella-like leave-in fixture has the same category, recommendation metadata (lotion, medium, heat protection) and specs as the card fixture. Extra internal tag heat_style on the renderer fixture is deliberately nonpublic and does not feed buildCompactProductFacts. Transfer exact visible sequence Leave-in, Lotion, Hitzeschutz and the exclusion of Mittel to the existing card render. Also preserve exactly one visible chip for each. Category/format/heat_protection source strings are only consumed in React keys, not serialized or displayed; retaining their arbitrary internal identifiers is not an independent contract.

Credible actual-owner control: In actual buildCompactProductFacts drop/reorder a chip or allow the fourth weight fact: retained card must fail. Change only source-key spelling while preserving unique stable keys: no behavioral failure is required.

### C2 — `tests/product-display-model.test.ts:214`

formatProductPrice formats EUR prices for German UI

Primary keeper: `tests/product-card-rendering.test.tsx:63`.

Input and assertion transfer: Same 18.51/EUR input already reaches formatProductPrice through ProductCard. Tighten the retained price assertion to exact rendered text 18,51 € (ordinary space), rather than only whitespace-tolerant regex. The card already proves delivery.

Credible actual-owner control: Change de-DE to en-US or remove the nonbreaking-space replacement: exact retained text must fail. No isolated formatter call added.

### C3 — `tests/product-display-model.test.ts:218`

formatProductPrice falls back to EUR for unexpected currency values

Primary keeper: `tests/product-card-rendering.test.tsx:107`.

Input and assertion transfer: The existing image-bearing ProductCard fixture already has price18.51; set currency to NOT_A_CURRENCY and assert exact 18,51 € while preserving the image and no-fallback-icon assertions. This carries the invalid-currency fallback through an actual existing render without adding a test site or render. Normal EUR remains in :63.

Credible actual-owner control: Remove try/catch fallback or fall back to USD in actual formatProductPrice: image-card rendering throws or exact price fails. Keep image-positive assertions so the existing contract is not replaced.

### C4 — `tests/product-card-rendering.test.tsx:87`

compact product card surfaces the product category as the first fact chip

Primary keeper: `tests/product-card-rendering.test.tsx:63`.

Input and assertion transfer: The only fixture difference is product.name=Ultimate Repair instead of Wella Ultimate Repair Leave-In; buildCompactProductFacts never reads name. Move >Leave-in< and >Lotion< order checks, heat-protection presence and absence of Mittel/Pflege: into :63, retaining the full-name identity assertion there. Exact text-node delimiters prevent a product-name occurrence from satisfying chip coverage. C1 and C4 share this final keeper, not a circular intermediate keeper.

Credible actual-owner control: Swap category/format insertion order or emit weight as a fourth fact in actual owner: strengthened :63 fails. It must also still catch ProductCard omitting facts entirely.

### C5 — `tests/product-line-display.test.ts:68`

attachProductLineNamesToProducts resolves missing product line names

Primary keeper: `tests/chat-route-product-lines.test.ts:58`.

Input and assertion transfer: Actual GET-used message enrichment invokes attachProductLineNamesToProducts with an injected query port and preserves message/product grouping. Preserve the exact NEQI x @_the.beautiful.people value by using it as line-1 canonical_name and first expected enriched value in the existing route-consumer fixture. Instrument its existing client with a calls array; table, columns and id-filter assertions already exist. Query ID batch is asserted with C6 below. Product id and line-id are opaque keys; no branch inspects the text of this line name.

Credible actual-owner control: Return null instead of mapping returned canonical_name, use wrong table/columns/id filter, or skip the first product: the retained consumer test fails. This test exercises the production GET projection helper, not auth/HTTP GET itself; do not claim authorization coverage.

### C6 — `tests/product-line-display.test.ts:100`

attachProductLineNamesToProducts preserves order in mixed batches

Primary keeper: `tests/chat-route-product-lines.test.ts:58`.

Input and assertion transfer: Retained fixture already mixes resolved line-1/line-2 and pre-enriched line-3 across messages with a null recommendations message. Add product-4 with missing-line to the existing final message. Assert product group/order [product-1],null,[product-2,product-3,product-4]; names NEQI...,Line Two,Existing line,null; and one exact query batch [line-1,line-2,line-3,missing-line]. This preserves missing result fallback plus pre-enriched value preservation at the actual message consumer. Keep standalone all-enriched/no-query test: mixed batch cannot prove the all-enriched short circuit.

Credible actual-owner control: Misadvance cursor, reorder flattened products, overwrite Existing line, or convert missing result to wrong value: actual consumer test fails. Query batch mutation must fail exact capture, not a mock-generated final payload.

### C7 — `tests/product-line-display.test.ts:118`

attachProductLineNamesToProducts returns original products on lookup errors

Primary keeper: `tests/chat-route-product-lines.test.ts:89`.

Input and assertion transfer: Extend the existing consumer failure keeper with a query port returning {data:null,error:new Error("lookup failed")} from async in(). Capture console.error and assert its second argument is that exact Error, one call, and the current persisted-recommendation product-line prefix. Assert returned messages===original and product object identity retained. Preserve its existing synchronous from() throw case. This transfers the result.error and callback contract to the actual consumer, rather than merely grouping lower-helper tests.

Credible actual-owner control: Ignore result.error, omit options.onError, clone the fallback products, or replace the error object in actual enrichment: retained consumer case fails. Do not stub attachProductLineNamesToProducts itself.

### C8 — `tests/product-line-display.test.ts:131`

attachProductLineNamesToProducts returns original products on thrown lookup failures

Primary keeper: `tests/chat-route-product-lines.test.ts:89`.

Input and assertion transfer: Also carry the original async in() rejection new Error("network failed") into the same existing consumer failure keeper. Keep the original synchronous from() exception separately in its input cases. The three forms are distinct: resolved error result, asynchronous rejection, synchronous throw. Every form must return exact original messages and report its exact Error once via actual onError closure. These cases now execute real message assembly, not only raw product enrichment.

Credible actual-owner control: Remove await or the try/catch around the actual query, silence onError, or rethrow: async case fails. Preserve all three input forms; no credit for deleting lower sites if their inputs are dropped.

### C9 — `tests/modal-layer-manager.test.ts:231`

keeps the body locked while a nested layer releases

Primary keeper: `tests/modal-layer-manager.test.ts:192`.

Input and assertion transfer: Both register a lower sheet then higher-priority dialog, release dialog, then sheet. The retained priority/isolation test already performs this exact lifecycle. Change the retained setup to const document = installFakeDom(0, 222), preserving the donor’s exact zero-horizontal/nonzero-vertical input. Add position=fixed and scrollToCalls=[] after dialog release, then position empty and exact scrollToCalls=[[0,222]] after sheet release. The donor DOES assert zero horizontal restoration; the retained keeper must preserve that assertion. First-layer test :161 separately retains exact nonzero x/y restoration [[20,640]]. No new declaration or additional lifecycle is needed.

Credible actual-owner control: Release body lock on every layer release rather than final release in actual reconcileIsolation: retained priority lifecycle must fail midway. Releasing twice/losing saved scroll must fail final assertion.

### C10 — `tests/modal-layer-manager.test.ts:376`

modal manager observes newly inserted body siblings while a layer is active

Primary keeper: `tests/modal-layer-manager.test.ts:161`.

Input and assertion transfer: Replace the source observer grep with runtime proof within the existing register/release keeper. Add a narrowly scoped MutationObserver port that captures actual constructor callback, observe target/options and disconnect; preserve/restore original global descriptor. After registering, append a new FakeElement body sibling, deliver the captured DOM mutation callback and assert actual manager sets inert=true and aria-hidden=true on that sibling. On final release assert new sibling original attributes restored and actual observer disconnected. Assert observation targets the body child-list. The port must not perform isolation or reset behavior itself.

Credible actual-owner control: Remove observe setup, use a no-op callback, skip reconciling newly inserted siblings, or omit disconnect: the extended actual-owner test fails. Native MutationObserver scheduling is not proven by this port; browser semantics remain a dependency assumption, but this is strictly stronger than text existence. No new production seam needed.

## Implementation/verification boundaries

No production behavior change is needed for these cuts. Keep every helper that has a live caller. Remove unused imports/test helpers after deletion: product-display-model loses buildCompactProductFacts and formatProductPrice imports; product-line-display retains identity imports plus all-enriched createClient, but its standalone createErrorClient/createThrowingClient move to or are replaced by minimal route-consumer query ports. ProductCard fixture remains Wella-like; only the existing image case needs the invalid currency. Do not add a new production export for a test.

For C7/C8, the existing route-consumer failure declaration may iterate the three literal port forms, but each must call the actual production message enrichment helper. This is a real ownership transfer, not regrouping the old raw helper calls. Restore console.error in finally and check exact count/error object per case. Preserve original sync-from case, async-in rejection and resolved error independently; do not turn them into one mock returning a manufactured expected message list.

For C10 preserve/restore the original MutationObserver global descriptor. Its fake implementation captures constructor callback and observed target/options and records disconnect only. It must not write inert/aria-hidden, simulate the production layer registry, or call reset to make assertions pass. Append the late sibling while the registered layer is active; deliver the browser callback; inspect actual manager mutations. Assert both late-sibling restoration and disconnect on release. This controls the actual handler while leaving native browser scheduling outside the claim. If the shared fake DOM cannot support this cleanly without broad harness changes, classify C10 as pending F and take only 9 cuts.

Run before, transfer-only and after under parent's serialized window. The exact native focused command is:

```sh
node --import ./tests/server-only-register.cjs --import tsx --test tests/product-display-model.test.ts tests/product-card-rendering.test.tsx tests/product-line-display.test.ts tests/product-detail-drawer.test.tsx tests/chat-route-product-lines.test.ts tests/modal-layer-manager.test.ts tests/bottom-sheet-focus.test.tsx
```

Then apply one temporary actual-owner control at a time, prove the named retained keeper fails for its intended assertion, restore source/hashes, and rerun. Do not mutate a fixture/mock into an invalid unrelated input to obtain red. Parent runs full canonical coverage gate and retains preexisting failures. No coverage/data/provider claim follows from these native tests.

## Complete per-declaration ledger

R means the complete test body and primary implementation support the specific surviving risk stated below; it does not imply this read-only pass ran a mutation. F is a repair recommendation with zero pruning credit. C is conditional on the exact transfer above and native validation. No table-row credit.

### tests/product-display-model.test.ts — 18 sites

| Line | Verdict | Test and independent risk / keeper |
|---:|---|---|
| 148 | C | **buildCompactProductFacts returns whitelisted leave-in facts for a Wella-like product** — C1 → tests/product-card-rendering.test.tsx:63 |
| 156 | R | **buildDrawerProductProfileRows maps leave-in metadata to user-facing profile rows** — Drawer rows require 5 distinct localized labels/values including weight, balance, yes/no heat protection and role. ProductCard intentionally omits weight/role and has no drawer profile section; faulty buildDrawerProductProfileRows could lose Rolle while every retained card passes. |
| 166 | R | **buildProductMatchSummary synthesizes product facts and profile signals without internal labels** — Fine profile+regular heat+shine input exercises feminine Lotion summary, profile synthesis and one paragraph/no raw metadata. Card consumes neither buildProductMatchSummary nor hairProfile; a wrong grammatical pronoun or leaked need_bucket would escape it. |
| 182 | R | **non-leave-in products get drawer profile rows and a match summary without leaking metadata** — Non-leave-in Shampoo uses suitable_thicknesses/concerns filtering and safe summary/profile rows; preserve unknown raw code, internal tags, score and underscore leakage controls. This is a different branch from the leave-in renderer fixture. |
| 214 | C | **formatProductPrice formats EUR prices for German UI** — C2 → tests/product-card-rendering.test.tsx:63 |
| 218 | C | **formatProductPrice falls back to EUR for unexpected currency values** — C3 → tests/product-card-rendering.test.tsx:107 |
| 222 | R | **buildProductApplicationSentence returns a complete usage sentence** — Application owner must retain full usage sentence and avoid appending fine-hair guidance when original says sparsam. Card does not display usage_hint. Credible fault: ignore sparse-use recognizer and duplicate advice. |
| 233 | R | **buildProductApplicationSentence does not duplicate existing fine-hair sparing guidance** — usage_hint exactly Bei feinem Haar sparsam dosieren. is a separate recognizer input; preserve exact sentence, not the longer Wella sparsam wording alone. |
| 248 | R | **buildProductMatchSummary falls back to Leave-in for leave-in specs without a category** — Absent category and recommendation_meta with leave_in_specs is a distinct persisted-product fallback; dropping specs detection yields malformed subject or empty summary. No card fixture supplies that combination. |
| 271 | R | **buildProductMatchSummary uses the right article for leave-in spray summaries** — Spray/light metadata takes neuter Dieses/es instead of feminine lotion. Existing lotion renderer cannot detect malformed Spray grammar. |
| 289 | R | **getShopLabel derives a shop-aware buy label from affiliate hosts** — dm host-aware CTA is consumed by drawers, not the compact card. No opened drawer keeper currently asserts Bei dm kaufen. |
| 296 | R | **unavailable purchase links use the unavailable CTA label and helper text** — purchase_link_status=unavailable must override even valid dm link and show literal unavailable helper. Available case cannot detect ignoring status. |
| 304 | R | **available purchase links keep the normal shop CTA and omit helper text** — available Müller link must omit unavailable helper. The unavailable case cannot detect stale helper text leaking to normal links. |
| 313 | R | **getShopLabel recognizes brand-direct hosts** — Six brand-direct host aliases are distinct literal mapping entries; retail dm and locale-stripped cases do not cover them. One AST declaration for six cases; no regrouping credit. |
| 328 | R | **getShopLabel strips locale subdomains before host lookup** — de.nuxe/de.curlsmith/en.neqi hostname normalization is an independent locale-prefix path absent in brand-direct roots; broken prefix stripping would expose De/En CTA. |
| 334 | R | **affiliate links are trimmed and validated before display** — Whitespace valid Amazon, javascript: and blank inputs jointly protect URL trimming, allowed protocols and affiliate disclosure. Compact card has no external link; security branch cannot be inferred from price/facts rendering. |
| 355 | R | **category labels are public whitelist only** — Conditioner (Drogerie), Öle, deep_cleansing_shampoo and unknown internal category are separate public whitelist keys. Card unknown-category test alone cannot detect known aliases disappearing. |
| 362 | R | **fallback summaries drop internal-looking description text** — Internal-looking short_description must be dropped while safe factual shampoo summary remains. Other fixture descriptions are public copy; a faulty isSafePublicText could leak raw codes only here. |

### tests/product-card-rendering.test.tsx — 7 sites

| Line | Verdict | Test and independent risk / keeper |
|---:|---|---|
| 63 | R | **compact product card renders identity, price, whitelisted facts, and a quiet tap affordance** — Primary composed keeper: actual button identity/name, Leave-in/lotion/heat facts, fallback icon, price and quiet detail affordance, plus raw metadata exclusions. Fault: ProductCard stops rendering a valid helper result. |
| 87 | C | **compact product card surfaces the product category as the first fact chip** — C4 → tests/product-card-rendering.test.tsx:63 |
| 107 | R | **compact product card uses product image when available** — Actual image branch must choose ProductImage and suppress fallback icon. C3 transfers invalid-currency fallback here while retaining the image input and assertions. |
| 117 | R | **compact product card renders product line as identity metadata** — Actual Neqi brand/line before name with separate identity/name typography implements documented display hierarchy; helper output alone cannot prove rendering order. |
| 143 | R | **compact product card does not duplicate line names embedded in brand** — Actual Garnier combined brand must render one Wahre Schätze line. Joined-label shape alone does not replace helper parts contract, but this keeper protects real consumption. |
| 160 | R | **compact product card does not surface unmapped raw category values** — Unknown raw category with recommendation_meta/specs null must not surface internal_shampoo_bucket. Baseline leave-in fixture retains metadata category override and cannot detect this path. |
| 171 | R | **compact product card maps known category variants to their icons** — Bondbuilder with null metadata/specs must choose atom icon; fallback sparkles/shampoo assertions on other categories cannot detect missing Bondbuilder map. |

### tests/product-line-display.test.ts — 6 sites

| Line | Verdict | Test and independent risk / keeper |
|---:|---|---|
| 68 | C | **attachProductLineNamesToProducts resolves missing product line names** — C5 → tests/chat-route-product-lines.test.ts:58 |
| 86 | R | **attachProductLineNamesToProducts keeps already enriched products untouched** — All products already enriched must preserve the object and make zero query calls. Mixed route fixture always contains missing names and cannot observe this short circuit. |
| 100 | C | **attachProductLineNamesToProducts preserves order in mixed batches** — C6 → tests/chat-route-product-lines.test.ts:58 |
| 118 | C | **attachProductLineNamesToProducts returns original products on lookup errors** — C7 → tests/chat-route-product-lines.test.ts:89 |
| 131 | C | **attachProductLineNamesToProducts returns original products on thrown lookup failures** — C8 → tests/chat-route-product-lines.test.ts:89 |
| 144 | R | **product identity display removes line suffixes from combined brand names** — Parts shape is a distinct live contract: ProductCard joins values, so erroneous [Garnier · Wahre Schätze] still renders identical card text while Drawer/Popover lose separate brand/line rows. Retain exact [Garnier,Wahre Schätze] proof and its Balea/Neqi label inputs (one AST site). |

### tests/product-detail-drawer.test.tsx — 4 sites

| Line | Verdict | Test and independent risk / keeper |
|---:|---|---|
| 115 | R | **product routine action posts an add payload for an empty category** — Real action callback constructs add payload without replace fields and invokes onChanged after response; mock captures request and does not manufacture request body. |
| 163 | R | **product routine action asks before replacing an occupied category** — Existing occupied usage requires a no-request first click then explicit confirmReplace/replaceUsageId. 409 fallback starts unknown and is not the same initial input. |
| 215 | R | **product routine action turns an occupied-category response into replace confirmation** — Server409 supplies usage-from-api after initial add; real state must switch to confirmation and second request must use new id. Initial occupied fixture cannot detect ignoring response data. |
| 277 | R | **product routine action renders owned state when product is already in routine** — alreadyInRoutine must render Drin disabled without add action. Success/confirm fixtures all start unowned. |

### tests/chat-route-product-lines.test.ts — 2 sites

| Line | Verdict | Test and independent risk / keeper |
|---:|---|---|
| 58 | R | **attachProductLineNamesToMessages preserves message product grouping** — Primary production GET projection keeper: actual flatten-enrich-repartition must preserve null recommendations and grouping. C5/C6 add missing-line and exact query/error-independent inputs here. |
| 89 | R | **attachProductLineNamesToMessages returns original messages when enrichment throws** — Primary consumer error keeper: exact original messages must survive enrichment failure. C7/C8 preserve resolved query error, async rejection and original synchronous throw; capture actual diagnostic callback. |

### tests/modal-layer-manager.test.ts — 11 sites

| Line | Verdict | Test and independent risk / keeper |
|---:|---|---|
| 161 | R | **locks body on first layer and restores exact scroll on final release** — Primary body-lock lifecycle keeps exact initial scroll/style/attributes and release; C10 extends it with actual observer callback delivery. Distinct faulty owner: remove left/top locking or fail restore. |
| 192 | R | **uses priority and registration order to isolate only the top layer** — Primary nested lifecycle: high-priority dialog isolates lower sheet, sends top-state transitions, and restores lower on release. C9 adds nested body-lock lifetime assertions. |
| 231 | C | **keeps the body locked while a nested layer releases** — C9 → tests/modal-layer-manager.test.ts:192 |
| 255 | R | **restores original inert and aria-hidden attributes** — Preexisting aria-hidden=legacy and inert attribute/property must be restored rather than cleared. The first lifecycle starts with neither attribute and cannot detect lost original state. |
| 274 | R | **keeps exempt live feedback surfaces interactive above modal layers** — A data-modal-layer-exempt body sibling must remain interactive while ordinary app root becomes inert. Nonexempt siblings cannot detect over-broad isolation. |
| 291 | R | **uses newest registration when priorities match** — Equal priority50 selects newest registration and restores first on release. Different-priority fixture cannot detect reversing tie order. |
| 313 | F | **bottom sheet and dialog primitives use the shared top-layer manager** — Source names do not prove primitive registration at the first visible commit, top-layer focus, drag opt-out or restore-target behavior. Existing personal-plan-start.spec.ts:234/:654 independently exercise immediate Escape for BottomSheet/Dialog, but do not cover every focus/drag/priority invariant asserted here. Repair at mounted primitive boundaries before deleting the entire declaration; not a cut in this batch. |
| 341 | R | **routes Escape to the top layer only and releases the listener with the last layer** — Real document listener routes Escape only to top, prevents default, ignores other keys, then removes final listener. Priority state checks do not dispatch events or catch leaked listeners. |
| 376 | C | **modal manager observes newly inserted body siblings while a layer is active** — C10 → tests/modal-layer-manager.test.ts:161 |
| 387 | F | **existing dialog consumers provide the title required by the shared aria label** — Presence of <DialogTitle anywhere in three source files does not prove every open state has an accessible title matching aria-labelledby. Actual DialogTitle sets context titleId, but the observer Escape test closes the cookie dialog immediately and is not a retained accessible-name check. Replace with rendered consumer states; current caller inventory alone is not architecture proof. No deletion credit. |
| 398 | F | **toast viewport remains portaled and exempt from modal background isolation** — Source createPortal/exempt/z130 words can remain in dead code. Actual ToastProvider is live and creates a body portal; manager exemption test uses a fake exempt root and does not render the provider. Need actual mounted toast above modal proof; do not delete because source grep is weak. No deletion credit. |

### tests/bottom-sheet-focus.test.tsx — 6 sites

| Line | Verdict | Test and independent risk / keeper |
|---:|---|---|
| 16 | R | **initial focus only on the first open** — InitialFocusDone=false must select initial even on top acquisition; other cases start true and cannot detect failure to focus first open. |
| 27 | R | **a content or step change inside the open sheet moves focus nowhere** — InitialFocusDone=true and regainedTopLayer=false must return none regardless focus-inside boolean, preventing content updates from stealing focus. |
| 40 | R | **back on top after a nested layer: restore only when focus left the sheet** — Regained top layer restores only when focus left the panel; both inside/outside branches retained. Initial/content-update cases do not exercise top regain. |
| 59 | F | **the close X shows its ring for keyboard focus only** — Static focus-visible class check does not exercise keyboard versus pointer focus. feb9284c introduced modality-specific initial focus. The other tests pass booleans to focus resolver and cannot prove CSS/visible ring behavior. Repair using a real mounted/browser keyboard/tap case before replacing this source guard; no deletion credit. |
| 70 | R | **the focus trap wraps from an element outside the tabbable list (tap-open title)** — Active title/body is outside tabbable list; forward goes first and backward last, including no-close-button list. Endpoint test uses only list members and misses this branch. |
| 81 | R | **the focus trap wraps at both ends and leaves the middle to the browser** — List endpoints wrap, middle returns null for native browser movement, empty list returns null. Outside-list test cannot detect trapping the middle or indexing an empty list. |

## Rejected alternatives

1. Deleting all 18 display-model tests from one compact card was rejected: the card never invokes drawer summary/application/profile-row/shop-link functions. Their malformed links, missing metadata/specs, grammar and internal-text leakage inputs remain real independent contracts.
2. Deleting the product identity parts declaration was rejected even though two label rows overlap cards. A single joined string array would pass ProductCard but break separate drawer/popover rows. No row-to-site inflation.
3. Dropping all modal source guards from the two immediate-Escape browser tests was rejected: those browser tests do not observe restored focus targets, drag opt-out, every named title or toast isolation. Their existing weak oracle should be repaired, not silently counted as duplicated proof.
4. Treating the route-consumer enrichment test as full HTTP authorization/database verification was rejected: it directly invokes the production projection helper with a query port. It is stronger than its raw helper for grouping and caller error handling, but not a GET authentication/real Supabase test.

Remaining uncertainty: native transfer/control results are pending. C10 is the only harness-sensitive proposal; C7/C8 need diagnostic capture preserved carefully. No claim that ten cuts alone meets the campaign quota.
