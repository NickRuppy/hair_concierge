# Offer experiments87 — second layer preservation plan

Decision: conditionally consolidate four exact free-reveal callback replays. Keep the remaining83 sites, including three repair-marked sites. This is prospective static evidence, not permission to apply, not a green-run claim, and zero campaign deletion credit. Main owns independent acceptance, phase writes, real owner controls and final native/coverage/CI proof.

## Scope and previous work

Current TypeScript AST: offer-motion19, pricing14, free-reveal13, Meta endpoint11, organic11, Meta client9, transition10 =87. Native68; browser19 declaration sites expand to20 cases because the disabledGate loop has two literal rows. Existing opt-in browser skips remain untouched. Full test files, helpers, all literal/loop rows and all callback bodies read. inventory.json pins each complete declaration; phases/before keeps every support byte.

/tmp/test-audit-static-layer-challenge.md already covered organic11 + Meta endpoint11 + Meta client9 at file/range level, R30/F1, C0/D0. This review reconciles that evidence rather than claiming31 entirely untouched sites. It adds exact per-site bodies/hashes and a second pass over the real caller, data, transport and failure branches. The prior provider-wiring F remains. New F observations are the organic ordering check matching an import and the digits-only uppercase UUID subcase. No prior keeper was assumed stronger merely because it runs in a browser.

## Candidate unions (same native owner lane)

C1 free-reveal:88 → existing:97. Fresh Map, consume user-1/product-a, then hasUsed user-1. The keeper already asserts true before its unrelated user-2 query. Same table/column/user/row/error/call prefix; no changed bytes or assertion transfer needed.

C2 free-reveal:106 → existing:118. Fresh Map and first consume user-1/product-a are identical. Keeper first===consumed preserves the donor result clause. Move the original rows.get(user-1) deep equality into the keeper immediately after its first consume and before its existing second consume. Keep the final row equality, so neither after-first nor after-conflict state is lost.

C3 free-reveal:137 → same existing:118. Both make the same two sequential calls on the same fresh fake: user-1/product-a, then user-1/product-b. Preserve the fake object reference and destructure the same client/rows from it; add the donor's exact insertCalls2 and selectCalls0 observations. No new fixture, owner/client invocation, row, identity, skip or render. rows.get in C2 is the original assertion observation, not an additional product operation.

C4 free-reveal:188 → existing:197. Same initial consume and load user-1 projection; keeper already deep-compares product-a before loading unrelated user-2. No changed bytes or transfer needed.

All four donor bodies and all three keeper bodies before/transfer/cut are in candidates.json. One keeper changes;82 other retained callbacks remain byte exact. Seven complete file phases87→87→83; free-reveal13→13→9; six files byte identical in every phase. All support bytes are preserved by removing only exact declaration spans; this deliberately leaves extra whitespace at removed positions. Free-file assertion call counts23→26→20 include helper assertions: six donor calls removed, three original clauses copied, three exact duplicate semantic clauses already exist. Count reduction is not assertion loss.

## Actual owner and boundary

The only candidate owner is src/lib/entitlements/free-reveal.ts, read completely. Its imports are server-only and a type-only SupabaseClient; no live client construction occurs. The test preload supplies the empty server-only marker. The shared fake is read completely: Map keyed by user_id, insert increments a private counter, duplicate23505 never overwrites, select validates table/column and projects user_id or product_id after exact eq(user_id,...). No canned verdict replaces hasUsed/load/consume themselves. The model checks adapter behavior, not actual PostgreSQL concurrency, transaction isolation, RLS or service credentials. The helper comment overstates real PK-concurrency proof; this proposal neither relies on nor strengthens that claim.

Positive callers remain: scan resolve injects hasUsedFreeReveal into getEntitlements at src/app/api/scan/resolve/route.ts:500–521; scan reveal's actual POST dependency binding uses consume/load at:209–225, after auth/flag/product/profile/access/verdict/eligible-list checks. Already-used loads the original product for same-product re-serve versus different-product409 at:183–193. Migration20260905090000 specifies user_id PK, nonnull product_id, select-own RLS and service-role writes. It was read as schema evidence, never run or claimed deployed. Historyf3790784 (#526) introduced this credit/keepsake layer; current source remains operative. The four candidates do not remove route/security, SQL or null/error coverage.

## Rejected second-layer cuts

- Empty-map hasUsed/load cases remain. Although populated cross-user lookups also returnnull, no removal is needed to force an equivalence claim across that fixture state.
- Pricing:302 and:260 are not safe to merge. Both currently return before consulting their supplied clients, but their readbacks differ (membership versusnull). An erroneous historical-arm implementation which reads and accepts a valid winner without writing can be caught by302 and escape260. Direct-source current early return does not erase that credible regression. Neither title proves all reads absent.
- Meta endpoint:135 remains separate from:37. Both accept canonicalUUIDv8, but one lacks UA/cookies while the other exercises populated metadata. metaRequestData has real conditional omission branches. Browser trackMetaOfferViewOnce injects fetch and does not reach schema, rate limits, streamed-body bound, lookup, or canonical comparison.
- Organic resolver different rows preserve enablement, exclusions, viewed/checkout stability, update CAS, winner readback and error capture. Literal same-return values do not make their side-effect predicates identical. Historical explicit arms remain attribution authority; null fallback differs.
- SSR application/PlanStart/Refinement markup is produced by different real render owners. Shared transition helper does not subsume route parsing, legal/structure/copy/focus/default contracts. SSR never executes effects or the supplied unresolved handoff callback.
- Browser offer controls mount real components and run event/effect/geometry behavior. Native helper assertions cannot replace responsive layout, keyboard details reversal, focus, reduced-motion CSS, provider lazy-load, stale response ownership, same mounted PayPal SDK, eligibility retry or recovery navigation.

## Current feature and historical reachability

Result page:440–600 constructs actual sessions, executes QA token assignment when present, selects pricing or organic experiment before recordLeadOfferView, and passes variant/pricing catalog into ResultPageClient. Organic excludes moderator, partner and regular field-test lanes. OfferTrackingProvider:229–267 separates internal view from completion-only dedicated Meta delivery and additionally excludes noncommercial test kinds. Real POST lookup adds recent legacy nonempty answers or attached Personal Plan artifact and derives optional package only from signed current-session/lead binding.

Historical one-time is not newly allocatable: assignPersonalPlanPricingExperimentVariant always returns membership; resolver converts stored one-time to base without rewriting stored attribution. History318cf157 (#549) explicitly retired new one-time checkout. Critically, Stripe route:578–580 returns410 for isOneTimePurchase before the only direct production authorization helper call at:629. The native authorization tests therefore prove the retained helper contract, not reachable current checkout admission. No D is proposed: this bounded pass does not remove the source seam, validate every legacy payment/recovery consumer or claim a retired render/provider subtree safe to delete. The lab still explicitly mounts one-time presentation; existing payment recovery is a separate retained customer contract. Main can route a distinct owner-closure pass with this evidence.

## CI, history and dependencies

package.json test:node selects all six .test.ts/.test.tsx files. CI quality-node invokes it using .nvmrc. Playwright config excludes native files, uses Chromium for this motion spec, and has no WebKit match for this file. The entire motion describe is tagged@ci and is selected by the conditional playwright-smoke --grep@ci job; motion case10 is also selected by full-ci payment-feedback-v2. Both workflow lanes have live-secret availability gates; no claim that every run executes them. Two motion callbacks also have their own existing local-login/PayPal-disabled conditional skip gates. Do not manufacture rows or remove those skips to alter counts.

Relevant history: f3790784 free credit+keepsake;318cf157 trials/new one-time retirement; b09a43e9 organic video/image experiment;97e7da78 partner exclusions;6fc40211 canonical Meta dedup;ca176e7d analytics extension;870fc4fb/c6b12b49/893d3b48 transition/scroll contracts;f865a897 existing-access recovery;8a5e42c2 actionable activation. These are local Git evidence, not fresh production-state claims.

Manifest pins exact test/source/readset bytes plus package lock/config/preload, installed TypeScript parser, tsx, React/ReactDOM, Next, Playwright and Zod package metadata, Node executable/version and Git head/branch/root. Guard presence is not a claim of full transitive package-source review. No dependency code or product module was imported except the TypeScript parser for static syntax.

## Controls and acceptance

controls.json gives four unique exact owner patches and complete parsed mutant files. C1 wrong used-state return must fail first own-user true assertion; C2 wrong inserted product must fail the transferred pre-second-insert row equality; C3 added pre-read must fail selectCalls0 after preserving results/rows/insert count; C4 wrong loaded product must fail the first own-user record equality. Each is representative; no claim to exhaust every field/error/concurrency fault.

Static checks:21 full prospective test snapshots and4 full TS mutants parse. Exact source patch uniqueness and phase line oracles recorded. Main must observe clean selected1→intentional ERR_ASSERTION at exact first keeper frame/operator/values→owned byte restore→clean selected1, separately and serially for each fault. Reject zero selection, import/setup failure, unrelated assertion, timeout, signal or hang. No such execution occurred here. Main must use its guarded sole-operator tooling and fresh unchanged-byte checks, then run focused free-reveal13/9, full six-native-file68/64 as appropriate, and campaign coverage/CI. Browser changes:none; existing browser evidence is not fabricated or rerun by this agent.

Limits: bounded owner ranges are explicit in read-scope.json; large render, provider and SSR transitive trees are not exhaustively audited for unrelated contracts. No env file, provider, DB, native/PW/typecheck/build or live browser was read/executed. No source/test/repository write, test repair, unused-owner removal, publication or external review. Proposal-only four; zero accepted deletion credit.
