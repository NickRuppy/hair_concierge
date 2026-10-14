# Independent preservation review: Partner-access84

**Verdict: CONDITIONAL PASS for C1–C8.** No lost assertion, distinct operative-input contract, or new owning invocation was found in the eight proposals. Approval remains conditional on main's clean before/transfer/cut native proof and the 20 source controls failing at their intended assertions. All controls remain unexecuted by this reviewer. This is the independent candidate-preservation review, not a second semantic endorsement of the full 84-site ledger.

Root `/Users/nick/AI_work/hair_conscierge/.worktrees/test-audit-pruning`; proposal `/tmp/test-audit-partner-access84`. The authorized handoff receipt SHA256 is `52c9fa29f47e207a9a4765c27ff97327307717ee1714b0a098cb1edad7a75b63`; manifest SHA256 is `a6ebc4f3d1ebeece0a5778a91dd5a00ccdda53e473c92c1bdcdfbf0a8115a307`. Main owns all repository changes and runtime proof. This review made no repository edits, imports, test/build/type/browser runs, source faults, DB/provider calls, or environment-file reads. Only its three `/tmp/test-audit-partner84-independent-*` artifacts were written.

## Independent static verification

`/tmp/test-audit-partner84-independent-check.py` passed **580 checks**. Machine receipt: `/tmp/test-audit-partner84-independent-static.json`.

- All nine artifact hashes in the pinned author receipt match, including candidates, controls, manifest and complete diff.
- All 64 source/dependency/test/support guards match the current files. All 48 snapshots match their manifest hashes; the 16 current test files match `before` byte for byte.
- Every original declaration body agrees with its recorded offsets and SHA. Replacing only the four named keeper bodies reconstructs `transfer` exactly. Deleting only the eight named donors reconstructs `cut` exactly, including otherwise retained whitespace. The complete diff reconstructs exactly.
- Literal top-level declaration counts independently read **84→84→76**. The one unchanged browser file contains four declarations, hence native **80→80→72**. This is text declaration counting, not a runtime registration count or an independently executed TypeScript parser.
- All **72 unrelated callbacks** remain byte-identical. All five held F bodies and the entire 18-declaration SQL execution file remain byte-identical. No new table rows, tests, skips or owner calls are hidden in support changes: all non-callback bytes are accounted for by the exact reconstruction.
- Every one of the 20 fault replacements has a unique current source anchor, matching original/mutant SHA, and a pinned assertion present at the declared phase line. Mutant bytes were only calculated in Python memory; no source was mutated, parsed, imported or executed.

## Candidate judgments

### C1 — signed-out resolver donor: CONDITIONAL PASS

Original donor `tests/partner-access-journey.test.ts:80–90`; keeper `:204–212`. Complete fixture factory is `:22–29`, fake auth client and missing-session error are `:184–202`. Both owning resolver invocations receive exactly `null` from `getUser`; the keeper gets there through actual `defaultGetUser`, `src/lib/partner-access/journey.ts:85–102`, instead of a direct null stub. Both use the same forbidden invitation-read throw and exact `{kind:"none"}` assertion.

Resolver `:55–57` returns before reading the invitation. Installed Auth-js `GoTrueClient.ts:2972–3030` returns `{data:{user:null},error:AuthSessionMissingError}` when no access token/header is present, and `lib/errors.ts:134–137` supplies the checked name. Thus the extra adapter exercises a real normalization branch, not a fixture that manufactures the final resolver receipt. No assertions need transfer. Neither callback proves Next-cookie/session plumbing or a live Auth request. Both forbidden-read sentinels have the existing limitation that a future implementation which independently swallowed the read error could escape this sentinel; there is no regression in sensitivity caused by this consolidation.

Control `C1-no-session-not-outage` changes the actual no-user result and must fail the keeper's exact deep equality (before/transfer211, cut179).

### C2 — full authorized projection: CONDITIONAL PASS

Donor journey`:101–111`; keeper`:227–239`; transfer keeper deep equality begins238, cut206. Factory `:26–27` and actual adapter `journey.ts:97` deliver the same `creator-user` and same `partnerMetadata`; both load exactly `invitationRow` (`tests:15–20`). Resolver `:60–66` is the same six-field projection, and all effective fields—invitation ID, user ID, name, normalized email, funnel ID and kind—are preserved literally in the new deep equality. Replacing kind-only equality also preserves its existing authorized-kind requirement. There is still one resolver call, no extra read or fixture row.

The five `C2-projection-*` faults alter the actual projected field independently and must fail that full deep equality. The old kind-only keeper is intentionally insensitive; the original donor and transferred keeper are the relevant pair. A null/error or fixture failure is not acceptable oracle evidence.

### C3 — generic auth rejection: CONDITIONAL PASS

Donor journey`:166–178`; keeper`:214–225`. Donor throws an Error, keeper calls actual `defaultGetUser` whose non-missing auth failure throws the supplied `AuthRetryableFetchError` object (`journey.ts:94`). The resolver catch `:68–70` never inspects name/message/prototype. Both return exactly unavailable and carry the same forbidden lookup collaborator. No error-message assertion or ordering observation is lost. The sentinels alone do not independently count zero lookups after failure; this is a shared pre-existing limitation, not a deleted contract.

Control `C3-auth-fault-not-none` changes the resolver catch result and must fail the selected actual-adapter keeper at224/192. It must not be credited merely because another read-failure callback also goes red.

### C4 — unstamped/stamped read-error pair: CONDITIONAL PASS

Donor journey`:256–275`; existing keepers`:241–254` and`:155–164`. The donor's unstamped metadata is `{}`, keeper's is `{provider:"email"}`. Actual `hasPartnerAccessQuizHint` (`src/lib/partner-access/quiz-context.ts:8–13`) reads only the string-valued `partner_access_invitation_id`; both lack it and both have the same `ordinary-user` identity. The unused provider field adds no alternate branch. Resolver `journey.ts:57` must return none before load.

The keeper observes exact none plus a monotonic zero lookup counter; its collaborator returns a row if called. That counter is strictly useful: an erroneous call followed by returning none would escape status-only proof but fail `lookups===0`. The donor instead throws on that read, causing unavailable through the same catch. The second existing keeper has exactly the donor's stamped default fixture, throwing read, and unavailable equality. The union of these two existing calls preserves both donor assertions without adding either call, changing metadata, or packing scenarios.

`C4-unstamped-lookup` preserves the actual none result while invoking load; **the zero counter must be the failure** (transfer260/cut228), not output status or setup. `C4-stamped-read-fault` targets the stamped read-error keeper's unavailable equality163/143, separately from C3 even though the mutation bytes coincide. The proposal does not certify PostgREST transport; revoked-user/other-user/null-funnel query-filter tests remain independent and unchanged.

### C5 — explicit lapsed false: CONDITIONAL PASS

Donor `tests/partner-access-claim-route.test.ts:224–240`; existing keeper`:177–204`. Both have the same authenticated ID/email, invitation, cookie request, fake clock/UUID, and fresh independent dependencies factory. The donor explicitly overrides billing to `async()=>false`; the keeper inherits exactly that implementation at`:61`. Actual handler `src/app/api/partner-access/claim/route.ts:229–247` consumes the same false after `password===null`, producing true. All donor observations already exist: status200, `complete.freshStart===true`, and full JSON `{destination:"/quiz?partner=1",requiresEmail:false,freshStart:true}`. The keeper also checks effect order, and retains its separate existing email-mismatch request unchanged.

`C5-unpaid-restart` flips the actual unpaid decision; it must fail `complete.freshStart` equality at transfer198/cut184. The complete fixture at`:57–59` echoes the input, so this proves route forwarding/response mapping, not SQL determination or persistence. The real `completeClaim` RPC adapter is `route.ts:462–481`, but it is overridden here; none of the 18 SQL tests is displaced.

### C6 — new account must not consult billing: CONDITIONAL PASS

Donor claim`:242–254`; keeper`:74–97`. Both have the same request and fresh default dependencies, returning the same new-user ID and non-null hidden password. Transfer moves the donor's exact throwing `hasCurrentPaidAppAccess` override into the existing keeper call; it does not add an owning call or introduce new scenario data. Valid owner behavior `route.ts:232–234` never reads that collaborator. Existing keeper assertions include both donor assertions (status200 and actual `complete.freshStart===true`), plus full JSON, user name/email, complete effect order, no password cookie leakage, and funnel cookie.

`C6-new-account-billing-read` adds the real forbidden billing call while retaining computed true when the dependency succeeds. With the transferred throw it takes actual catch/release503; intended failure is status200 equality (transfer/cut82). Original keeper alone would remain green because its inherited false collaborator does not throw; the original donor and transferred keeper must supply sensitivity. No actual billing provider access is needed or permitted by this control.

### C7 — ready invitation copy: CONDITIONAL PASS

Donor `tests/partner-access-ui.test.tsx:9–28`; keeper`:30–36`. Complete `PartnerInvitationCard` and helpers, `partner-invitation-client.tsx:121–239`, show both names produce `firstName="Lea"` at143. Email and ready mode are equal; confirmed/error default to false/null; initial nextEmail is identical. The donor's optional callbacks are used only as onClick values196/203; they neither choose a branch nor run under SSR. Installed React DOM legacy server attribute handling1314–1333 omits event handlers and function attributes. The input difference therefore does not change the consumed greeting/copy readset.

The keeper retains greeting equality and its independent full-name negative and receives every other donor assertion unchanged: exact email regex, edit label, CTA, **complete reset disclosure sentence**, and all five forbidden commercial terms. No render is added or altered. The public client actually passes callbacks (`:106–117`), and the lab mounts this Card; unchanged browser tests own the mounted edit/cancel flow and viewport independently. SSR does not prove clicks, request delivery, draft clearing or navigation; the held source-only UI F remains unchanged.

Five C7 controls target the actual ready renderer. Email/edit/start/reset faults must fail their specific transferred matches; `C7-noncommercial-copy` appends Abo while preserving the positive edit-label substring, so only the intended forbidden-copy assertion should reject it. Full-name truncation remains independently asserted. The approved reset disclosure introduced in history `5a3e33f1` is preserved, not weakened to the pre-reset sentence.

### C8 — email-exists first response: CONDITIONAL PASS

Donor claim`:99–113`; keeper`:115–144`. The first leg's dependency override is identical (`email_exists`, status422, same message); `request()` and every other factory value are identical. Both invoke the actual handler's create-user error path `route.ts:196–225`: release, actual handoff intent creation, then actual mailbox response producer488–531. The keeper already made that call; transfer merely binds its Response and adds all donor observations before existing handoff extraction: status202, exact requiresEmail/email JSON, and complete reserve→release→magicLink order. Reading that previously ignored Response once adds an observation, not another POST or input. The second dependency fixture, body-handoff request, status200 and handoff cookie assertion are unchanged.

Actual `createPartnerAccessIntent` executes with fixed valid fixture secret/time and returns a signed token. The second decode remains a deliberately narrow equality stub: this keeper does not replace signature/expiry tests. NextResponse's installed `response.js` uses actual Response.json and cookie storage. Route external Auth/RPC/mail/funnel operations are stubbed; effect order observes owner invocations, not successful persistence/mail delivery.

Four C8 faults separately corrupt status, requiresEmail, returned email, or omit release. They must fail the new first-leg assertions at transfer126–128/cut112–114 before handoff parsing. In particular, omitting release preserves status/body/token and isolates the actual observed effect array. No setup-token failure may stand in for this oracle.

## Preserved boundaries, history, and reading limits

Complete human reads for this candidate review: all three changed test files including every helper/fixture and retained sibling body (journey291 lines, claim290, UI73); journey owner150; claim owner582; invitation client277; quiz-context, intent, Supabase server/admin adapters, funnel cookie module, quiz-context route, invitation page, invitation lab component, server-only-register support, intent test, four-test browser file, and current partner operations doc. All full donor/keeper bodies in phases were also machine-compared against the originals and proposed replacements.

Operative-range reads: quiz lead route210–278 (partner before moderator, invited email, six-field save consumption); billing subscriptions267–321 (paid-access distinction); installed Auth-js getUser/error class; React DOM SSR attribute handling; installed NextResponse response implementation; package native script, CI native job and browser grep; Playwright config was read as source only. No environment file was opened and no config was executed. Git history at the three test paths names `97e7da78`, `3f9b284b`, `5a3e33f1`; original UI and claim fixtures at97e7da78 and journey/UI changes at5a3e33f1 were inspected. Current operations doc and actual source, not historical verification claims, govern this verdict.

SQL was **not** reassessed as an independent 18-contract semantic audit. The harness imports/paths, migratedDatabase setup, completeClaim/read helpers and handcrafted predecessor schema were read at1–90,744–812,985–1212. It applies both actual migration files to its predecessor fixture, but this reviewer did not reread every SQL callback or either full migration in this pass. Their exact current/snapshot hashes and all 18 bodies are preserved; neither route mock receipt is claimed as replacement proof. Likewise the other held F source files were pinned and their bodies proved unchanged, not repaired or given deletion credit. The author's 71R/5F wider judgments remain the author's bounded audit, not independent blanket approval here.

No source/support seam retirement is unlocked. Default auth/query injections still serve independent retained error/filter contracts. No broader schema rollout, concurrency, live Auth/mail, mounted client claim/clear/navigation, deployment or publication claim is made. Reject any runtime control failure caused by import/setup/provider errors rather than the pinned oracle. Main should retain each intended clean→fault→restored result and native phase receipts before accepting these eight cuts.
