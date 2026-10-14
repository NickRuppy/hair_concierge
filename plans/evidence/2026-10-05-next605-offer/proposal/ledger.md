# Acquisition offer experiments / render delivery — full87-site ledger

Read-only prospective audit. R80 / F3 / C4 / D0. The four conditional C sites are all free-reveal; no removal credit or execution claimed. Complete callback bodies, literal rows and hashes: inventory.json; complete helper/support bytes: phases/before/tests/*. Full proposed keeper bodies: candidates.json.

## tests/personal-plan-offer-motion.spec.ts

| Site | Class | Contract and owner fault / limit |
|---|---|---|
| 1 · line122 · sticky header keeps its footprint and page containment across the viewport matrix | R | Five viewport rows observe real sticky rectangle, containment, wordmark separation and completed animation. Changing mobile width or leaving an infinite animation is invisible to SSR and individual checkout tests. |
| 2 · line172 · membership sticky CTA keeps fixed mobile geometry and switches from pricing to checkout | R | Membership sticky before/after pricing focus and destination, fixed 320px geometry, quarter→month copy, dialog opening. A stale selected interval or wrong click handler can pass geometry-only case. |
| 3 · line212 · membership readiness stays pristine for immediate close and plan change | R | Membership pristine open→close and plan-change close without confirmation. Treating mere readiness as engagement would add alertdialog; one-time uses another owner branch. |
| 4 · line243 · one-time sticky CTA never invents a billing interval after pricing is reached | R | One-time sticky strips billing interval and shows literal reference/current prices and payment destination. Membership summary logic can leak an interval only in one-time arm. |
| 5 · line264 · personal-plan offer never starts provider work before checkout opens | R | Two existing pricing-arm rows assert no SDK or prepare before checkout opens, including ApplePay capability. Eager warm-up can start provider work while all open-checkout cases still pass. |
| 6 · line294 · `one-time Stripe containment is PayPal-only with ${disabledGate} off` | R | Two declaration expansions independently disable expressElements and overlay; require PayPal-only containment and zero Stripe requests. Conjoining feature guards incorrectly activates Stripe when just one gate is false. |
| 7 · line328 · one-time checkout dismisses pristine state directly and protects provider engagement | R | One-time pristine dismissal versus engaged PayPal confirmation, continue/cancel and reopened pristine state. Stale engagement surviving cancellation is browser lifecycle behavior. |
| 8 · line382 · PayPal SDK uncertainty stays pending on the same mounted attempt | R | Deferred prepared Stripe response after PayPal ownership, SDK error pending polls, same mounted PayPal attempt, cooldown. A stale Stripe completion can overwrite provider ownership or remount PayPal while native reducers remain correct. |
| 9 · line498 · a failed speculative Stripe SDK load retries automatically for the checkout child | R | First speculative Stripe SDK fails, subsequent real checkout child retries; one prepare and card option recover. A rejected shared cached promise can suppress retry; this browser includes route.continue SDK network dependency. |
| 10 · line567 · @payment-feedback-v2 existing one-time access stops payment and carries the Chaarlie email into login | R | Tagged V2 duplicate one-time access carries exact recovered email into login; legacy build branch retained. Ignoring prepared duplicate-access reply allows a second payment or loses recovery identity. |
| 11 · line616 · membership existing access recovers before any provider or session work | R | Membership eligibility existing_access denies all provider/session work and preserves force-login/recovery next URL. Loading Stripe before access check or navigating to generic login breaks this boundary. |
| 12 · line676 · membership eligibility failure retries before provider initialization | R | Membership eligibility503 then retry eligible gates provider setup until successful check. A cached unavailable result prevents recovery or eager setup bypasses access proof. |
| 13 · line727 · a terminal PayPal recovery state hands the customer to support without another payment | R | Terminal PayPal status navigates token-bound welcome recovery and offers support without repaying/status retry. Permanent-failure reducer effect might navigate to normal payment; real welcome render matters. |
| 14 · line788 · a newly activated customer can choose a login link | R | Payment-welcome lab customer chooses login link, one intercepted magic-link send, confirmation visible. Setup toggle could submit password or omit request; no corresponding native user interaction here. |
| 15 · line817 · an authenticated returning customer continues into the app instead of payment | R | Existing opt-in local-dev-login journey reaches retained app/profile and completion without payment. Authentication retained-account destination is distinct from anonymous lab; conditional skip unchanged. |
| 16 · line838 · one-time card selection is single-flight and keeps PayPal available before claim | R | One-time card prepare single-flight across viewport rerenders and card selection; PayPal remains available before claim. Responsive remount can create another prepare or hide unclaimed alternative provider. |
| 17 · line891 · one-time card selection remains available when the PayPal build flag is disabled | R | Existing opt-in PayPal-disabled build still offers one-time card with one preparation. Wrong provider feature gating removes sole remaining payment method; skip unchanged. |
| 18 · line929 · FAQ disclosure remains native and supports keyboard reversal | R | Actual details/summary keyboard Enter, Space and rapid reversal. Click-only handler or stale close timer can break keyboard native semantics. |
| 19 · line950 · reduced motion keeps pricing, sticky summary, and FAQ state changes immediate | R | Reduced-motion CSS and JS yield immediate pricing, sticky and FAQ transitions without inline residue. Media-query mismatch survives ordinary-motion interactions and SSR markup. |

## tests/personal-plan-pricing-experiment.test.ts

| Site | Class | Contract and owner fault / limit |
|---|---|---|
| 1 · line30 · personal-plan pricing allocation is deterministic and has exclusive pricing modes | R | Determinism, variant predicate and three mode mappings including historical one-time string. Returning membership for every mode would break historical checkout even with no new one-time allocations. |
| 2 · line46 · retired one-time arm is never assigned to a new Personal Plan session | R | Three literal new-session identifiers all allocate membership. Reintroducing the historical hash split can assign some new sessions one-time; first determinism site does not demand membership. |
| 3 · line52 · personal-plan pricing experiment flag is enabled only by exact true | R | Deleted, uppercase TRUE and exact true pricing flag with restoration. Truthy/insensitive flag parsing enables rollout accidentally. |
| 4 · line67 · personal-plan launch pricing flag defaults off and enables only for exact true | R | Separate launch-pricing flag default, uppercase and exact true. Wrong environment name or default activates commercial pricing independently. |
| 5 · line82 · QA token helper defaults to a five-minute TTL when the option is omitted | R | Actual CLI argument boundary omits TTL and decodes emitted claims for300seconds. Changing CLI default to900 is not caught by direct token call supplying120. Existing child process never run in this audit. |
| 6 · line111 · personal-plan resolver uses the historical base for disabled, missing, viewed-base, and ineligible sessions | R | Five explicit resolver conditions: missing session, wrong package, unexpected arm, disabled base, viewed base. An admission guard regression can rewrite viewed/foreign sessions; each row retained. |
| 7 · line164 · personal-plan resolver persists an enabled unviewed assignment against the base identity | R | Enabled unviewed assignment captures actual update and id/view-null/stored-base guard chain. Missing persisted identity guard permits race overwrite despite deterministic allocator. |
| 8 · line218 · persisted retired one-time arms resolve to the subscription presentation | R | Historical retired one-time viewed/checkout/internal-test rows present base; membership persists. Unpaid historical arm accidentally returns one-time again or valid membership gets retired. |
| 9 · line260 · a persisted retired arm is left intact for historic reporting | R | Retired unviewed one-time yields base without captured update or variant guard. Removing early retirement invokes reset and overwrites attribution even if returned presentation remains base. |
| 10 · line302 · a persisted retired arm does not attempt a reset or database read | R | Same retired fields but update miss and membership readback fake discriminate mistaken race-winner return. Rejected C: a regression that consults only readback and accepts valid membership fails here; preceding keeper readback null would still fall back and record no update. Title alone does not prove every possible read absent. |
| 11 · line340 · assignment races use the persisted winner while assignment failures stay on the base | R | Assignment miss with retired readback falls back; persistence error also falls back and records failure. Accepting retired race winner or suppressing capture is distinct from initially retired session. |
| 12 · line408 · QA token validation binds the atomic assignment to one lead/session/package | R | Token valid/wrong-secret/expiry plus atomic assignment RPC binds exact lead/session/package/arm. A valid token for wrong identity could assign unauthorized arm; live RPC transaction itself not exercised. |
| 13 · line452 · one-time checkout authorization uses only the canonical stored session | R | Canonical stored-session authorization projection and membership/wrong-lead/unviewed denials. Browser-supplied variant or missing ownership/view evidence could authorize retired checkout. |
| 14 · line495 · one-time checkout authorization distinguishes lookup failure from expected denial | R | Lookup error and absent row remain distinct typed authorization reasons. Collapsing outage into normal denial obscures recovery and caller response. |

## tests/free-reveal.test.ts

| Site | Class | Contract and owner fault / limit |
|---|---|---|
| 1 · line80 · hasUsedFreeReveal: false when no row exists for the user | R | Empty ledger hasUsed returnsfalse. Keep independent cold empty-ledger read; no need infer it from populated cross-user test. |
| 2 · line88 · hasUsedFreeReveal: true once a reveal has been consumed | C | C1: exact consume→same-user lookup prefix already asserted by cross-user keeper3. Owner existence returnfalse is caught at first keeper3 assertion; no transfer required. |
| 3 · line97 · hasUsedFreeReveal: does not leak across users | R | Same-user true and other-user false queries on populated fake; keeper forC1. Dropping eq user scope leaks a used credit across accounts. |
| 4 · line106 · consumeFreeReveal: first consume for a user returns consumed | C | C2: first consume result already keeper5 first; transfer row assertion before second existing insert. Wrong first persisted product is caught at transferred pre-second row assertion. |
| 5 · line118 · consumeFreeReveal: second consume for the same user returns already_used | R | Two consumes retain consumed/already_used and final originalrow; adds original first-row observation andC3counters. Second insert must not overwrite historical product or allow another credit. |
| 6 · line137 · consumeFreeReveal: relies on the insert's own PK conflict, never reads first | C | C3: same two consumes askeeper5; move two existing counter assertions into it. Extra pre-read can reintroduce TOCTOU pattern while ordinary return assertions pass. |
| 7 · line147 · consumeFreeReveal: different users each get their own one-time credit | R | Different user IDs each receive independent credit. An erroneously global consumed flag can pass same-user duplicate test. |
| 8 · line163 · hasUsedFreeReveal: throws on an unexpected lookup error | R | Unexpected lookup connection error throws named lookup failure. Failing open grants credit during lookup outage. |
| 9 · line180 · loadFreeRevealRecord: null when no row exists for the user | R | Empty ledger record returnsnull. Keep null-contract cold read; no shortcut from populated foreign-user path. |
| 10 · line188 · loadFreeRevealRecord: returns the ledgered productId once a reveal has been consumed | C | C4: exact same-user recordload prefix already asserted by keeper11 before foreign query. Wrong product projection is caught by first keeper11 deepEqual. |
| 11 · line197 · loadFreeRevealRecord: does not leak across users | R | Ledgered own product preserved; unrelated user recordnull; keeperforC4. Cross-account keepsake leak distinct from boolean used-state projection. |
| 12 · line208 · loadFreeRevealRecord: throws on an unexpected lookup error | R | Record lookup unexpected error throws named lookup failure. Returningnull on outage is not equivalent to a genuinely unused ledger. |
| 13 · line225 · consumeFreeReveal: throws on an unexpected insert error | R | Nonunique insert permission error throws consume failure. Treating every insert error as already_used hides authorization/storage failures. |

## tests/meta-offer-view.test.ts

| Site | Class | Contract and owner fault / limit |
|---|---|---|
| 1 · line37 · Meta offer endpoint validates, limits, and passes only request-bound delivery data | R | Canonical endpoint result, two rate-limit identities and exact populated cookie/UA delivery. Dropping canonical ID or mixing browser body metadata into delivery violates server request boundary. |
| 2 · line76 · Meta offer endpoint is a benign no-op while its flag is off | R | Flag-off validated payload is202skipped with no delivery. A disabled rollout could continue emitting external event. |
| 3 · line91 · Meta offer endpoint rejects forged context, unknown keys, and malformed IDs | R | Five payload rows reject forged contexts, extra key and malformed IDs. Permissive schema can admit extra/client-forged attributes; allrows retained. |
| 4 · line112 · Meta offer endpoint rejects non-canonical UUIDs before rate limiting or delivery | R | Noncanonical syntacticallyvalidUUID rejected before limits/delivery. UUIDshape-only validation permits forged identity and duplicate conversions. |
| 5 · line135 · Meta offer endpoint accepts only the deterministic UUID-v8 event ID used by the client | R | CanonicalUUIDv8 accepted without cookie/useragent headers and exact sameID delivered. Rejected C: richer populated-header case doesnot cover absence branches of metaRequestData; native browser counterpart injects send instead of real endpoint. |
| 6 · line151 · Meta offer endpoint rejects missing server-owned lead evidence | R | Delivery lacks eligible lead evidence→404. Treating eligibility denial as accepted delivery lies about conversion quality. |
| 7 · line161 · Meta offer delivery requires recent quiz evidence and constructs the canonical event | R | 24hour cutoff, missing lead no delivery, eligible lead canonical ViewContent/user fields/custom name. Injected lead predicate plus event construction has separate contracts from HTTP schema. |
| 8 · line209 · Meta offer endpoint bounds streamed bodies before rate limiting | R | Streamed17KB body with false Content-Length1 blocked before limits. Trusting header only allows excess body processing. |
| 9 · line228 · Meta offer endpoint isolates delivery failures from its validated request contract | R | Delivery failure result→503 without changing valid request contract. Swallowing provider rejection as accepted202 prevents proper recovery. |
| 10 · line238 · Meta offer lookup preserves legacy quiz evidence and requires an attached personal plan | R | Static actual POST lookup has legacy nonempty answers and personal-plan attached artifact, recency and quiz-kind filters. Injected findEligibleLead tests do not reach actual query; keep source contract until mounted/DB proof exists. |
| 11 · line256 · offer CAPI uses the eligible lead's server-resolved package behind its existing flag | R | Flag false/true customdata uses server-resolved eligiblelead package. Browser supplied package or always-on addition changes attribution/privacy payload. |

## tests/organic-offer-media-experiment.test.ts

| Site | Class | Contract and owner fault / limit |
|---|---|---|
| 1 · line18 · the no-access organic result resolves its media experiment before recording the offer view | F | Source clauses remain useful but before-record ordering assertion matches first import occurrence. Moving actual resolution below recordLeadOfferView keeps current indexOf assertion true. Retain/no cut; repair separate owner execution or scoped syntax assertion, no new inputs here. |
| 2 · line31 · organic media allocation is deterministic and accepts exactly its two arms | R | Two literal sessions allocate treatment/control deterministically; predicate accepts two arms and rejects foreign. Changing namespace/hash or admitting other arms changes experiment assignment. |
| 3 · line45 · organic media flag is enabled only by exact true | R | Deleted, TRUE, true organic flag behavior with restoration. Truthy environment check enrolls inadvertently. |
| 4 · line119 · enabled organic media assignment persists from the current video control before the offer is viewed | R | Treatment assignment captures value and id/view-null/basevariant guards. Missing CAS condition overwrites viewed or concurrent customer assignment. |
| 5 · line141 · a deterministic control allocation does not rewrite the existing control row | R | Deterministic control does not rewrite control row. Persisting a no-op allocation causes unnecessary write/race despite same output. |
| 6 · line158 · organic media resolver never reassigns a viewed or checkout-started video control | R | Viewed and checkout-started control rows staycontrol without writes. Missing checkout gate reassigns customer after commercial intent. |
| 7 · line176 · disabled rollout leaves an unviewed video control untouched | R | Disabled unviewed control stayscontrol without writes. Checking allocator before enabled gate performs unintended assignment. |
| 8 · line189 · organic media resolver uses concurrent persisted winners and fails closed on persistence errors | R | Concurrent persisted winner accepted; update error fallback and capture include experiment/package. Ignoring winner or dropping failure evidence differs from normal persistence. |
| 9 · line226 · disabled rollout resets only unviewed image treatment and preserves viewed or checkout assignments | R | Disabled fresh treatment resets withtreatmentguard; viewed/checkout treatment persists. Resetting committed treatment or storing wrong guard destroys attribution consistency. |
| 10 · line261 · ineligible organic sessions force video without a mutation | R | Five null/wrongpackage/fieldtest/nullvariant/excluded inputs remainvideo without mutation. Excluded noncommercial journey gets enrolled even if anonymous realroute unavailable. |
| 11 · line283 · stored retired legacy arms remain attribution authority and are never enrolled | R | Historical explicit default/guided-story arms remain stored authority and never enrolled. Null-coalescing legacy fallback mistakenly recreates or overwrites retired attribution. |

## tests/meta-offer-view-client.test.ts

| Site | Class | Contract and owner fault / limit |
|---|---|---|
| 1 · line21 · offer provider keeps internal views separate from the dedicated Meta path | F | Source provider internaloffer_viewed and completion-only dedicated call checks retain limited wiring value. Dead/unmounted code can satisfy strings; helper runtime tests cannot establish actual provider effect. Prior static-layer-challenge same F retained; no cut. |
| 2 · line40 · Meta offer view is claimed once per browser funnel and variant | R | Storage claim exactidentity once; changedvariant separateclaim; key containslead. Wrong identitydimensions can suppress distinctoffer or doublecount samebrowser. |
| 3 · line49 · Meta offer view fails closed when local storage is unavailable | R | Nullstorage/getthrow/setthrow failclosed. Writing before safeget or failingopen emits repeated pixel during restricted storage. |
| 4 · line71 · Meta offer view derives one UUID-shaped id from stable identity | F | Stablelead/event UUID and changedlead assertions useful; uppercase subcase uses digits-onlyUUID so is identical input. Removing toLowerCase would pass this uppercase claim. Retain useful assertions; no repair/newfixture inpruning proposal. |
| 5 · line97 · event-id derivation failure leaves the browser claim available for retry | R | Derivation failure returnsfalse and leaves storageunclaimed. Claim beforecrypto failure consumes future retry permanently. |
| 6 · line111 · Meta offer view sends Pixel and endpoint with the identical id | R | Pixel and endpoint exactly sameID, keepalive, narrowbody, oneclaim and repeatfalse. Changing one channel ID breaksdedup despite UUIDshape test passing. |
| 7 · line140 · non-completion entries never claim or send the primary Meta offer view | R | Two noncompletionentry contexts neitherclaim nor send. Resultemail/quizreturn can inflate primaryMeta conversions. |
| 8 · line165 · a transport failure never rejects the offer render path | R | Transport rejectionisolated; functionreturnstrue afterclaimedattempt. Uncaught fetch rejection can fail offer render flow. |
| 9 · line177 · a Pixel failure does not suppress the matching server request | R | Pixelthrow still sendsserverrequest andreturnstrue. Nestingservercopy insidepixel success suppresses recoverable measurement. |

## tests/personal-plan-transition-motion.test.tsx

| Site | Class | Contract and owner fault / limit |
|---|---|---|
| 1 · line47 · Anwendung has no journey header — Bottom-Nav carries orientation, the day view keeps a quiet in-page Back (Task 2.7 + fix round 1 I-2) | R | ActualSSRApplication ready overview/day differ; nojourneyheader/progress; exactquietbacklink. Dropping daybacklink canpass generic transition marker and browseroffer cannot reach application component. |
| 2 · line65 · non-ready Anwendung surfaces never claim a successful view transition | R | Nonreadyday_unavailable SSRneverclaimstransition. Unconditionalwrapper mislabels unavailable application ready. |
| 3 · line72 · malformed Anwendung day segments fall back without throwing during render | R | Malformedpercent-encodedpath fallsbackoverviewwithoutthrow. Uncaught decodeURIComponent cancrashapplication despite ordinaryvalidpaths. |
| 4 · line81 · Bedarfsplan keeps its Journey header outside a bounded depth surface | R | ActualSSRPlanStartFlow oneheaderoutsidebasis transition withbasis screen. Duplicating headerinside/outsideyieldstwomarkers; unrelated offerbrowser doesnot mount. |
| 5 · line105 · Feinschliff keeps its Journey header outside the ordered-question depth surface | R | ActualSSRRefinement initialsession header/clearance/focus/no fakeprogress. Refinement may lose focus marker or duplicate chrome independently fromStage1. |
| 6 · line127 · stage navigation intent is destination-bound, single-use, and time-bounded | R | Intent validonce, wrongdestination consumes, staleTTL rejects. Stale or crossdestination entrance motion canreplay; all literal times preserved. |
| 7 · line154 · manual scroll restoration ownership is nested, idempotent, and cleanup-safe | R | Nested ownership releasesidempotently andrestores priorauto/manual. Firstunmount resetsmanualwhileanotherowneractive; CSS/PWofferdoesnotexercisehelper. |
| 8 · line172 · stage navigation intent fails closed when storage is unavailable | R | Storageexceptions onwrite/read/remove failclosed. Restrictedstorage crashesstagehandoff. |
| 9 · line188 · successful Stage 3 handoff marks Routine before invoking client route replacement | R | Successfulhandoff marksRoutinebefore route replacement. Reorderingloses intent asdestinationmounts synchronously. |
| 10 · line198 · automatic Stage 3 bootstrap keeps the direct products-prep bridge visible | R | Completedrefinementsession SSRkeepsdirectproductprep bridge, no manualheading/fakestage3/loadingcopy. Initial completedbridge canrenderold intermediary; unresolvedonHandoff promise isnotexecuted duringSSR. |


Reachability qualification for pricing sites13–14: the actual Stripe handler returns410 at578–580 before its sole helper call629. These are retained compatibility helper contracts, not proof of current reachable checkout admission. Whole helper/source retirement closure is a separate follow-up; no deletion credit here.
