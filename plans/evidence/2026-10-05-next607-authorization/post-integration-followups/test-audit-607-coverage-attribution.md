# Independent attribution of the two new607 raw coverage flags

**No previously covered function or Partner ready/change-email path is lost in the two flagged files.** The Stripe flag is five additional zero-count records from mixed generated coordinate representations; the Partner flag is one fewer positive Istanbul record after two adjacent equally hit ranges coalesce. These are not all-zero modules. Source/function/callback behavior and counts are detailed below; raw metrics remain unchanged and must not be silently corrected in campaign totals.

Read-only data/source analysis; no owner, test, compiler, merger or coverage converter executed. Main's whole607 totals and global2pp verdict are not independently recomputed by this bounded report. Companion JSON pins all six coverage files, exact100 Stripe mappings, five extra records, all Partner branch mappings, raw V8 records and current support hashes.

## Comparison

| File/metric | Baseline |585|607|
|---|---:|---:|---:|
| Stripe functions covered/total |77/100|77/100|77/105|
| Stripe branches covered/total |393/587|393/587|397/589|
| Stripe lines covered/total |1375/2449|1375/2449|1485/2309|
| Partner branches covered/total |12/21|12/21|11/20|
| Partner functions covered/total |8/17|8/17|8/17|
| Partner lines covered/total |118/277|118/277|118/277|

The file-level function rate moves77→73.33%; Partner branch rate57.14→55%. Baseline and585 have identical displayed metrics. Absolute invocation counts may fall with redundant calls removed; a positive→smaller-positive transition does not establish lost behavior.

## Stripe: exact function attribution

Matched each of100585 records to607 by exact function name and occurrence in source-range order, retaining both old/new locations and counts in JSON. **All100 retain their covered/uncovered status**, including all77 positive records. This is a record mapping, not proof that colliding mapped locations name distinct actual functions.

These are the only five extra607 records:

| Function name |607 ID|607 reported span|Hits|
|---|---:|---|---:|
| hashPreparedCheckoutToken | 98 | 2234:13–2239:22 | 0 |
| preparedCheckoutProviderLocked | 97 | 2229:28–2234:13 | 0 |
| createPreparedCheckoutIdentityHash | 99 | 2239:4–2256:6 | 0 |
| buildPreparedCheckoutMetadata | 100 | 2257:2–2260:70 | 0 |
| hasMatchingToken | 102 | 2260:22–2298:33 | 0 |

Each name already had an ordinary source record before the cut; those records remain. The actual mapped owner positions in607 are respectively1529–1540 (providerLocked),1542–1544 (hashToken),1546–1560 (identityHash),1562–1583 (metadata),1585–1590 (matchingToken). The added records instead overlap unrelated late-source functions; treating those locations as newly added production functions would be false. `hashPreparedCheckoutToken` remains hit23 at its ordinary definition and17 through the generated export record; `hasMatchingToken` remains hit6. The other three ordinary functions are zero in both runs.

There are seven raw route-script executions in each run. Five have tsx source maps, and two are unsourcemapped CommonJS VM executions from `returning-checkout-routes.test.ts` and `stripe-trial-checkout-route.test.ts`. All seven pairs have exactly the same ordered function-name/covered-status sequences before/after. The JSON records all raw ranges and exact files. Returning POST hit31→31 and trial POST13→13. All five extra-record function names have raw VM hit0 in both runs: they are not newly unexecuted code.

The fixture `tests/helpers/returning-checkout-route-fixture.ts:404–431` transpiles the real route with TypeScript CommonJS/ES2022, no sourceMap option, then `vm.runInNewContext(..., {filename:file})`. Thus two different generated programs use the same `.ts` URL. Raw tsx total generated length changes237749→221644; VM length91643→84270 after removal of the dominated block. Raw VM function offsets for the five names all shift−7373. C8 merges by URL and selects a URL-keyed source-map cache (`c8/lib/report.js:289–300,350–369`; v8-coverage merge.js groups URL/function ranges). This mixes VM offsets with the tsx map and explains the extra mislocated records. No coverage machinery was modified or executed here.

Source evidence:585 cached route source SHA `0808a083b02a9611deab703bf9fc7a9b3cecb5dce2b5be1889003a0cd06a9bd8` matches the approved authorization-before snapshot.607 cached route SHA `1bfa635dc1f781b784f3c3f89c7dd1a6008d924e61aaf8f5693e7735f8a401ef` matches main's later null-metadata-before backup. The approved source diff removes the one-time branch dominated by the retained410 gate and changes its consent/provider locals to const null. No five new source function declarations were introduced. This report does not treat raw Stripe line/branch growth as newly proven product paths; mixed-coordinate artifacts also affect those metrics.

## Partner: exact raw branch attribution

Production source is identical in585,607 cached sources and current checkout: **True**. No Partner source was deleted. Raw `PartnerInvitationCard` function `[4565,7875]` executes3→2 times. Its two adjacent alternatives remain:

| Raw span | Meaning |585|607|
|---|---|---:|---:|
|[4977,6044]|change-email form|1|1|
|[6044,7872]|other modes, including retained ready card|2|1|

Both are positive. All nested zero-count spans (email_sent, correction_sent, confirmed badge, error, claiming) remain zero; this analysis does not imply those paths have native proof. Raw function ranges and offsets are otherwise identical; no positive raw range becomes zero.

585 Istanbul branch12 is152:16–175:15 hit1 and branch14 is175:8–212:11 hit2.607 combines them as branch12,152:16–212:11 hit1. This is exactly the equal-count adjacent-range normalization in installed `@bcoe/v8-coverage/src/lib/range-tree.js:55–99` (`child.delta === head.delta && child.start === curEnd`); C8's merge happens before Istanbul conversion. It reduces both positive numerator and denominator by one. The remaining19 branch records map directly, preserving covered status; counts on rendered wrappers fall3→2.

Partner84 C7 removed the extra ready SSR render (name Lea, email lea@example.test), retaining the existing ready full-name render (Lea Sommer→Lea) and transferring identity/edit/CTA/disclosure/negative commercial-copy assertions. The unchanged change-email render remains. Current tests call actual `renderToStaticMarkup(PartnerInvitationCard)` twice, once each mode. Full C7 donor and keeper bodies were read from archived candidates and current keeper; no browser interaction or callback-execution equivalence is claimed. This is concrete assertion preservation, not merely a numerical dismissal.

## Later null metadata follow-up

**PASS, zero declaration credit.** Main's exact one-line removal reconstructs the next archived source (private-wrapper-before backup) from `/tmp/test-audit-authorization-null-metadata-main-before.ts.txt`: **True**. The607 cached source equals that backup: **True**. Post-null-spread SHA `a434f0834ffe2b082557d0f2f40f89e7dcbd7a94efbff83a1bbc4410ba35ca71` is therefore later than607 coverage and must not be conflated with the measured source. Main subsequently removed the unused wrapper; that separate phase is checked below.

Removed only `...(oneTimeConsentId ? { personal_plan_once_consent_id: oneTimeConsentId } : {}),`. Within POST the sole binding is `const oneTimeConsentId: string | null = null` at617; all remaining POST uses are reads. Const primitive cannot be altered by the passed helper value; no setter/eval/write path was introduced. The conditional always contributes the ordinary empty object, so removing it preserves all metadata keys/values and guard decisions for every reachable request. Input-specific exported helper `input.oneTimeConsentId` paths, canonical consent metadata, provider-reference binding and historical recovery functions are untouched. The observed CI log TS2345 complains about the impossible optional-undefined metadata property; eliminating the inert spread addresses that inferred type without a cast or weakened Record<string,string> contract. Current CI/runtime result is main-owned and not claimed here.

## Subsequent private wrapper closure

**PASS for removing only the private `preparedCheckoutProviderLocked` wrapper; zero test-declaration credit.** Main's archived before file contains exactly one occurrence, its nonexported async function declaration at1528. Fresh exact-name search over current `src`, `scripts`, `apps`, `packages`, `tests`, and `.github` returns no references. Complete before function body reads only its input/provider and delegates to `reportPreparedCheckoutControlOutcome` when called; declaring it has no initializer or module-start action. Neither before nor after route contains an `eval`/Function constructor reference that could invoke a string-named private binding. The already removed callers were wholly inside the dominated one-time block.

Receipt `/tmp/test-audit-authorization-unused-private-wrapper-main-receipt.json` and backup reconstruct the current file exactly by removing that one function plus separating blank line: before SHA `a434f0834ffe2b082557d0f2f40f89e7dcbd7a94efbff83a1bbc4410ba35ca71` → after SHA `fc8db1376b2825ae31976913eaab2e963175e8ee3c643aea93dd3165e4027a79`. All other bytes are exact. The public `reportPreparedCheckoutControlOutcome`, its provider-locked cause values, and tests at580/639/662/693 remain; generic exported classifiers, consent writers and recovery input paths are unchanged. Removing this uncalled private declaration is narrower than deleting those live/normative contracts. The607 coverage above still describes the pre-wrapper-removal version; no post-cleanup metric is inferred.

## Limits

Bounded to these two flags and one follow-up line. Raw V8 records, archived input source-map caches, coverage mappings, exact source diffs, C7 full bodies, relevant current renderer, fixture loader and installed merge/conversion source slices were inspected. No claim of full585/607 semantic validation, live provider safety or complete coverage reliability. Preserve both original raw reports; keep campaign actual/conservative calculations and final fresh whole-run gate under main ownership.
