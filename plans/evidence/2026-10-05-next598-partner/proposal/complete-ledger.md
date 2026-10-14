# Partner-access84 complete declaration ledger

Read-only: 84 declaration sites in16 exact current files. Full callback/fixture bodies read; four auth-continuation sites excluded as instructed. Candidate counts are conditional, no runtime run or repo edit. Verdicts: {'R': 71, 'C': 8, 'F': 5}.

## tests/partner-access-sql-execution.test.ts

|Line|Mark|Exact test name|Observed contract / escaped fault / stronger owner|
|---:|:---:|---|---|
|19|R|partner invitation batches are atomic and normalize creator identity|Real SQL duplicate-normalized-email batch rejection leaves table empty; successful trim/lower output. Service RPC stub cannot establish SQL statement atomicity or stored normalization.|
|48|R|claim reservation is exclusive, replayable, and recoverable after abandonment|Real reservation same-attempt reuse, conflicting live attempt rejection and expired-attempt takeover. Sequential exclusion proof, not concurrent locking proof.|
|66|R|an existing-account handoff can release its reservation immediately|Actual release clears the reservation so a different attempt can reserve immediately; expiration-only test does not exercise release RPC.|
|79|R|email correction is throttled and invalidated by invitation rotation|Real issue throttle plus rotation consumes outstanding mailbox token; generic route error mapping cannot enforce durable invalidation.|
|103|R|claiming a partner invitation grants free access and restarts an existing account|Initial explicit true decision resets the complete already-used account state, stamps grant/provenance and all 11 plan plus 14 dependent reset fields. Later replay/default cases cannot replace this full field union.|
|178|R|a paying account can claim partner access without a fresh start|Explicit false paid decision preserves full account state while granting access. Omitted SQL default is a different undecided state; later true replay must remain harmless.|
|233|R|omitting p_fresh_start grants access, records no decision and performs no reset|Five-argument deployed caller reaches DEFAULT NULL, no decision stamp and no reset. Explicit false is final and is not equivalent to omitted/null.|
|286|R|a claim from the rollout window still restarts on the next decided claim|Previously undecided claim already holding grant is later explicitly restarted. Preserves rolling-deploy compatibility, distinct from missing-grant legacy repair.|
|323|R|an admin repair leaves the pending fresh start for the creator's next link open|Admin missing-grant repair leaves fresh-start decision open; next creator claim resets. Admin action and subsequent claim are distinct from direct creator self-heal.|
|367|R|a recorded no-reset decision survives a later fresh-start claim (P1)|Explicit false then true preserves old plan/hair state and single grant. Prevents later billing lapse from reversing a recorded no-reset decision.|
|395|R|a replayed claim completion neither re-grants nor restarts the account again|Initial true then reseeded state then replay neither resets nor remints, with exact revision 4. Legacy repair starts from missing/revoked grant and has no identical revision oracle.|
|417|R|a legacy claimed invitation self-heals its grant and restart exactly once|Undecided legacy claimed row with revoked grant heals, resets once, then a second reseeded replay preserves state. Revoke history differs from deleted-grant admin repair.|
|461|R|a failing fresh start rolls the whole claim completion back|Actual trigger exception forces transaction rollback of account binding, invitation stamp, grant and funnel user. Mock route completion failures do not execute this transaction.|
|506|R|activation reuses the claim grant and revocation cycles keep one active grant|Actual activation reuses exact claim grant and explicitly stamps lead_id/activated_at, then revoke/reactivate yields distinct new grant. Later replay test lacks stored lead/stamp query; transferring it would add a database read.|
|550|R|a claimed but never activated invitation regains a grant on reactivation|Claimed but never activated row revoked then reactivated gains new grant. Activated lifecycle and never-revoked legacy repair exercise different SQL predicates.|
|576|R|reactivation repairs a legacy claimed row that was never revoked, exactly once|Never-revoked claimed row missing all grants repaired by admin once, current pointer pinned and replay changed=false. Undecided admin case lacks exact no-op receipt union.|
|626|R|activation is replay-safe, indefinite, revocable, and preserves independent paid access|Activation replay full receipt, null expiry/email, partner reason, independent friend grant survival and history count2. Other cases do not observe full durable grant fields.|
|716|R|the fresh start helper stays out of reach of anon and authenticated callers|Actual has_function_privilege for private reset and six-argument public claim denies anon/auth and grants service. Base source grep does not execute new signature ACLs.|

## tests/partner-access-journey.test.ts

|Line|Mark|Exact test name|Observed contract / escaped fault / stronger owner|
|---:|:---:|---|---|
|80|C|a signed-out visitor gets an ordinary journey with zero lookups|C1: null getUser result and thrown forbidden lookup already covered through real defaultGetUser/AuthSessionMissingError keeper at204. Same resolver null branch and exact {kind:none}.|
|92|R|a signed-in user with no claimed invitation gets an ordinary journey|Stamped authenticated account whose invitation query returns null must yield none. Auth-null and revoked fake-filter paths do not directly cover lookup returning empty after a stamped user.|
|101|C|a claimed, unrevoked invitation authorizes the partner journey from the user alone|C2: full authorized field projection moves into existing defaultGetUser metadata keeper227; same actual resolved user and invitation object, no extra lookup or resolver call.|
|113|R|a revoked invitation makes the account an ordinary user again, never blocked|Revoked owned row uses real defaultLoadInvitation filtering; dropping revoked_at predicate would authorize it. Stub-null test cannot detect query predicate loss.|
|133|R|another user's claimed invitation never authorizes this user|Only unrevoked row belongs to another user; actual claimed_user_id query predicate enforces isolation. A row simply absent/revoked does not exercise owner mismatch.|
|155|R|a read error is unavailable, not none or a thrown exception|Stamped user invitation lookup throws -> exact unavailable; preserves read-error branch after successful auth independently of auth failure.|
|166|C|an auth-service error on getUser() is unavailable, not none|C3: actual defaultGetUser error path214 throws into identical resolver catch and preserves exact unavailable; generic Error message is neither read nor emitted. No error-message public contract lost.|
|204|R|no auth session is an ordinary signed-out visit, not an outage|Primary C1 keeper drives real AuthSessionMissingError normalization and resolver no-user branch; throwing invitation collaborator makes unintended lookup yield unavailable instead of required none.|
|214|R|a real auth failure on the default getUser path is unavailable, not none|Primary C3 keeper drives actual defaultGetUser AuthRetryableFetchError throw and outer unavailable mapping. Does not independently observe zero lookup after failure; donor did not either.|
|227|R|the default getUser path carries app_metadata through to the hint check|Primary C2 keeper drives actual user/id/app_metadata adapter mapping then hint and emitted authorized fields. Transfer replaces kind-only assertion with donor full independent fixture-field union.|
|241|R|a signed-in user without the claim stamp never reads the invitation table|Primary C4 ordinary branch observes lookups==0 with a collaborator that would return valid invitation; removes any possibility of a caught throw masking an illicit lookup.|
|256|C|only a stamped account can be made unavailable by an invitation read error|C4: two existing calls duplicate retained241 unstamped counter and155 stamped read-error. Metadata {} versus {provider:email} reads the same missing partner_access_invitation_id; no owner reads provider. No calls/inputs appended to either keeper.|
|277|R|an invitation row without a funnel session stays an ordinary journey|Real query not-null plus adapter postguard and resolver funnel-session guard reject null session. Other denied rows do not reach this null topology; no claim of isolating each redundant guard.|

## tests/partner-access-claim-route.test.ts

|Line|Mark|Exact test name|Observed contract / escaped fault / stronger owner|
|---:|:---:|---|---|
|74|R|new creator claim creates and signs into the exact named account without an email roundtrip|Primary C6 keeper captures new-user identity, reserve/create/funnel/complete/signIn order, exact response, password absence and cookie. Move donor forbidden-billing throw into existing request fixture; no new handler invocation.|
|99|C|an existing unrelated account requires normal mailbox proof once|C8: existing cross-device keeper first leg has identical email_exists422 stub/request and real handoff creation. Transfer status202/full response JSON/order before extracting existing redirect; no extra POST.|
|115|R|an existing-account email can resume the claim in a different browser|Primary C8 keeper additionally parses actual generated cross-device handoff and observes second body-carried intent restored to cookie. Second decode is intentionally fake; cryptography is independently tested.|
|146|R|a failed account creation releases the claim reservation immediately|Non-email_exists creation failure releases reservation and yields503; duplicate-account handoff and completion cleanup have different error timing and effects.|
|160|R|an invalid claim-attempt cookie is replaced before the database reservation|Malformed saved attempt UUID is replaced with observed randomUUID before reservation; default missing-cookie request cannot detect accepting invalid stored cookie.|
|177|R|authenticated continuation completes only the invitation email account|Primary C5 keeper has exact same authenticated false-paid fixture, full positive status/body/freshStart plus reserve/metadata/funnel/complete order and separate mismatch403/zero calls.|
|206|R|a currently paying account claims without a fresh start|Authenticated current paid=true must forward false and emit false; cannot merge into false/default without introducing a new case.|
|224|C|a lapsed account claims with a fresh start|C5: explicit false override duplicates factory default false, same user/request/invitation and exact status/body/complete.freshStart assertions already at177.|
|242|C|a new account always claims with a fresh start, without consulting billing|C6: new-account status200 and complete.freshStart true already at74; preserve forbidden billing lookup by moving exact throw collaborator into that existing invocation.|
|256|R|a paid-access lookup failure fails closed instead of assuming a fresh start|Authenticated billing throw must503 with exact German error and reserve/release only; false lookup and createUser failure reach different guards.|
|272|R|a failed claim completion removes only the new unbound funnel and releases the reservation|Completion failure deletes only newly created funnel/user then releases with exact identities/order. Real SQL transaction rollback cannot enforce these Auth/funnel cleanup effects.|

## tests/partner-access-quiz-context.test.ts

|Line|Mark|Exact test name|Observed contract / escaped fault / stronger owner|
|---:|:---:|---|---|
|12|R|creator quiz context returns only the server-authorized invitation identity, resolved from the user alone|Actual GET strips invitation/user/funnel fields, emitting only creator status/name/email; direct resolver full projection cannot prove HTTP disclosure boundary.|
|33|R|creator quiz context distinguishes ordinary and temporarily unavailable journeys|Explicit resolver none and unavailable map to different public statuses, preserving distinction that catch-only test misses.|
|45|R|creator quiz context reports unavailable when the journey lookup throws|Actual GET catches collaborator exception to unavailable envelope; explicit unavailable return does not execute catch. This is handler fault containment, not a claim the default resolver ordinarily throws.|
|54|R|creator quiz context parser and metadata hint fail closed|Client parser trim/lower, invalid creator/null fail-closed, metadata hint and query-marker literals are independently consumed by actual quiz lead-capture; browser fixtures supply already-normalized identity and cannot cover malformed payload union.|
|80|R|only a stable creator hint triggers context lookup|Auth-loading checking, marker precedence, stamped user cache key and ordinary no-request key are explicit client state/readset branches. Browser ordinary/creator cases do not cover all four keys.|

## tests/partner-access-service.test.ts

|Line|Mark|Exact test name|Observed contract / escaped fault / stronger owner|
|---:|:---:|---|---|
|15|R|partner invitation creation sends one normalized atomic batch and projects personal links|Actual service normalizes two inputs and sends exactly one named RPC batch; projects actual token links/message. SQL normalization cannot catch transport batch split or wrong RPC name.|
|60|R|partner invitation resolution is read-only and fails closed on version or revocation|Real token decode plus invitation version/revocation rejection and successful exact identity projection; resolver route stubs both decode/load and cannot replace it.|
|119|R|partner invitation status is derived from current revocation and grant state|Six current badge-policy inputs include active, explicit revoke, absent active grant for claimed or activated, untouched and claimed-active. Admin list observes only two and cannot absorb other four without new inputs.|
|176|R|admin list projects reproducible links without returning raw credentials|Actual list projection emits invited status, reproducible fragment URL/German message and omits raw credential key. Create response intentionally returns credential, so not equivalent.|
|199|R|admin list distinguishes a claimed account from an untouched invitation|Actual list converts current claimed timestamp plus grant_active=true to claimed. Direct status input literal now does not test list coercion/delivery.|

## tests/partner-access-ui.test.tsx

|Line|Mark|Exact test name|Observed contract / escaped fault / stronger owner|
|---:|:---:|---|---|
|9|C|creator invitation keeps the approved concise identity and account-creation copy|C7: ready full-name SSR keeper30 computes identical firstName Lea, email, mode and defaults. Transfer all five remaining positive/negative copy assertions; original greeting already present. No extra render.|
|30|R|creator invitation greets a full-name account by first name|Primary C7 keeper retains full-name negative plus first-name greeting, absorbs exact email/edit/CTA/disclaimer/noncommercial copy. Callback presence only sets ignored SSR event props, not branch/output.|
|38|R|email correction stays inline and short|change_email branch actual SSR has heading/helper/submit/cancel copy. Browser equivalent is non-@ci lab and different cadence; no claim of equivalent native lane; keep.|
|54|R|the quiz draft is cleared only when the claim response signals a fresh start|Strict true/object guard handles false,missing,null,primitive inputs at both live invitation and continuation consumers; source grep does not execute values.|
|62|F|the invitation client wires the draft-clearing predicate before navigating away|Private source identifier/order grep can remain green when calls are placed in dead code or predicate result ignored. Keep pending actual mounted claim-to-storage/navigation observation; lab uses Card alone and never runs client claim.|

## tests/partner-access-activation-route.test.ts

|Line|Mark|Exact test name|Observed contract / escaped fault / stronger owner|
|---:|:---:|---|---|
|26|F|partner activation requires exact authorization and sends ready email only once|Fresh activation sends one mail and null authorization denies, but title only-once not established: reused=true callback elsewhere has unobserved mail stub. Removing !activation.reused stays green. Retain; repair existing reused case with monotonic zero-send observation, no new request needed.|
|55|R|partner activation requires no funnel cookie — authorization is resolved from the user and lead alone|Exact user/lead authorize argument delivery without funnel cookie on reused grant. Route passes actual input, authorizer itself remains mocked; this does not replace live SQL lineage proof.|
|76|R|partner activation sends an existing paid creator to their canonical plan lead|Paid canonical lead is emitted through route; direct helper active/none fallback also observed. Route resolver stub does not exercise actual enrollment helper; retain fallback and precedence union.|
|114|R|partner activation rejects cross-origin requests before authorization|Cross-origin rejects403 with authorizer counterfalse before downstream dependency. Independent security request boundary.|

## tests/partner-access-journey.spec.ts

|Line|Mark|Exact test name|Observed contract / escaped fault / stronger owner|
|---:|:---:|---|---|
|30|R|creator invitation stays personal and lets the recipient correct the email|Mounted lab Card toggles ready->inline correction->cancel, with visible accessible controls and exact copy. Native SSR cannot prove event transitions. Lab does not execute public claim client.|
|57|R|creator invite and activation card fit a narrow phone viewport|390px real layout no horizontal overflow for invitation and partner offer, three activation CTAs and forbidden-free-copy count0; SSR string output has no geometry.|
|79|R|@ci verified creator skips duplicate identity and Back returns to the final question|Real quiz saved-last-question plus authorized endpoint fixture skips duplicate identity and Back restores final question. HTTP handler-only tests cannot establish browser sequence.|
|109|R|@ci ordinary quiz keeps its existing name and email sequence|Ordinary real quiz reaches name/email in order and actual intercepted creator request counterzero. Different fixture from creator path, preserves request suppression.|

## tests/partner-access-resolve-route.test.ts

|Line|Mark|Exact test name|Observed contract / escaped fault / stronger owner|
|---:|:---:|---|---|
|30|R|resolve shows personal identity and stores only signed invitation context|Actual credential passed into resolver, public identity-only JSON, signed-cookie-only output/no raw credential, private no-store. Service helper cannot prove HTTP cookie/disclosure serialization.|
|57|R|resolve rejects cross-origin, malformed, and unavailable credentials generically|Origin403 and malformed400 precede generic decoded-invalid410 German error. Unavailable resolver-null branch is not separately established by this decode-null fixture; bounded claim only.|
|71|R|resolve resumes the personal screen from the signed HttpOnly intent cookie|Resume intent cookie decoded and exact invitation/version forwarded, renewed cookie and personal JSON. Fragment credential input uses different branch.|
|98|R|resolve rejects resume without a valid intent cookie|Invalid intent cookie returns410 before loader; forbidden loader throws uncaught if reached, so negative cannot silently succeed on handler catch.|

## tests/partner-access-schema.test.ts

|Line|Mark|Exact test name|Observed contract / escaped fault / stronger owner|
|---:|:---:|---|---|
|14|R|partner access migration creates private invitation and correction state|Named stored columns/default version/unique hash and invitation RLS/revoke contract independent of owner-user SQL fixtures. SQL execution uses privileged connection and cannot establish invitation table ACL/RLS.|
|33|R|partner access migration extends grants and preserves one active grant per invitation|Independent reason enum, partial unique active grant and claimed-user index, partner funnel CHECK/columns. Single invitation happy histories never attempt duplicate active rows or conflicting claimed owners; preserve schema contract.|
|46|F|partner mutation functions are service-only and explicit about privilege|Title promises all mutation privileges but loop observes function declarations and only create function revoke/grant. Permissive reserve/activate ACL mutation would survive. Keep held; actual SQL ACL keeper covers only reset and six-argument claim, not eight listed functions.|
|66|R|partner routing is additive and cannot rename the established owner source|Migration compatibility prohibits renaming established owner routing source and requires additive private/public partner entrypoints; SQL predecessor stub plus no routing invocation cannot replace this architecture guard.|

## tests/partner-access-email-change-routes.test.ts

|Line|Mark|Exact test name|Observed contract / escaped fault / stronger owner|
|---:|:---:|---|---|
|41|R|email correction validates the invitation and sends only the normalized new address|Actual POST trims/lowercases new address and forwards exact invitation/version/name/siteURL; schema and SQL direct calls cannot prove request normalization/recipient delivery.|
|65|R|email correction rejects cross-origin, stale, unchanged, and throttled requests|Origin/stale-version/unchanged-address and SQL55P03 mapping429 exact German error are distinct failure branches in existing callback; no packing/removal.|
|89|R|email confirmation returns a fresh fragment credential and fails closed|Consumption success projects fresh fragment credential into exact destination, consumption throw410. This observes route boundary only; cryptographic/storage consumption remains separate.|

## tests/partner-access-token.test.ts

|Line|Mark|Exact test name|Observed contract / escaped fault / stronger owner|
|---:|:---:|---|---|
|12|R|partner invitation credentials are deterministic, versioned, and tamper evident|Actual HMAC deterministic same-input replay, v1/base64url protocol, exact payload, tamper and wrong secret rejection; service uses only successful projected tokens.|
|26|F|rotating the stored version invalidates the previous credential|Title incorrectly says stored rotation invalidates previous credential: both old/new tokens are deliberately decodable. Actual assertions protect version-bound distinct signatures/payloads; retain and narrow title. Service version mismatch and SQL rotation independently own invalidation.|
|35|R|credentials reject malformed identifiers, versions, and weak secrets|Invalid UUID, nonpositive version and weak secret throw exact diagnostic families. Valid signed service flow cannot cover producer admission.|

## tests/partner-access-cli.test.ts

|Line|Mark|Exact test name|Observed contract / escaped fault / stronger owner|
|---:|:---:|---|---|
|6|R|partner access CLI is dry-run by default and parses a bounded batch|Direct name/email and injected JSON file parse produce exact dry-run command shapes. Actual documented CLI entry guards main execution; admin does not consume CLI syntax. Bounded-size failure is not asserted here.|
|27|F|partner access CLI mutations require all production confirmation gates|Positive all-gates plus no-apply/no-write-flag/wrong-project negatives omit absent confirm-project. Removing confirmation conjunct falsely passes. Retain production safety gate; add exact missing-confirm negative only in separate zero-quota repair outside these eight Cs (not candidate packing).|

## tests/admin-partner-access-page.test.tsx

|Line|Mark|Exact test name|Observed contract / escaped fault / stronger owner|
|---:|:---:|---|---|
|7|R|partner admin page exposes the recurring single and batch workflow|Actual initial admin SSR exposes German single/batch controls, identity labels and creation action, forbids commercial copy. Does not claim mounted batch creation or status actions; no stronger same-surface existing keeper in scope.|

## tests/partner-access-email.test.ts

|Line|Mark|Exact test name|Observed contract / escaped fault / stronger owner|
|---:|:---:|---|---|
|9|R|partner transactional payloads contain only the recipient-facing link and first name|Exact Customer.io template recipient/id and invitation_url versus login_url schemas at live email producers. Route replaces sender; SQL has no message delivery output, so raw envelope contract remains.|

## tests/partner-access-intent.test.ts

|Line|Mark|Exact test name|Observed contract / escaped fault / stronger owner|
|---:|:---:|---|---|
|13|R|partner intent contains only invitation context and expires|Actual HMAC intent full decoded field union and exact expiry boundary plus HttpOnly/Lax options. Email substring assertion alone is weak encoded-data evidence, but independent full decoded equality protects bounded payload. No title-only deletion.|
