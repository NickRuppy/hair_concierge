# B1–B4 code-review receipt

2026-09-12. **Ready for review; no blocking verified findings remain.** Publication is not authorized by this receipt.

Branch `codex/ios-connected-scanner`, base `469d41f5e81f44702c94829c0ed312e732b01172`. Canonical228-file fingerprint: `c5352d597877d67a136ec3e932ee4263c39a8cc8d588846ebefe047d0e92b860`. Same manifest convention and administrative exclusions as [verification-receipt.md](verification-receipt.md).

## Scope and lanes

`request-code-review` routed the normal correctness/security/regression lens and the structural lens warranted by new auth/context persistence, the shared web/native authority seam and native asynchronous account state. Main Codex owns integration and readiness. The single external counterpart lane was local Claude Opus4.8 at `high`, explicitly read-only and terminal, with no reviewer recursion. Whole-branch review covered tracked changes and all task-owned untracked implementation; a bounded delta review covered the final native recovery/signing/layout changes and local verification helpers. No production writes or provider changes were used for review.

The counterpart independently ran43 Node/PGlite tests in its first pass and inspected the real-stack and native tests statically. It did not independently run real Auth/Postgres or Xcode; main/worker execution evidence is recorded separately. Main inspected the changed paths, integration outputs, final native screenshots and account lifecycle, and independently reran final native units, Node tests and repository checks. The final documentation/image-inventory delta was reviewed locally; unchanged counterpart conclusions were reused.

## Verified findings and disposition

| Finding | Disposition |
|---|---|
| Native `URLComponents` force unwrap | Fixed with guarded construction and configuration error. No new behavior policy. |
| Cold persisted session plus incoming link before restore | Main found a real startup recovery race. Fixed with shared startup hydration before choosing verification or explicit account confirmation; isolated pre-fix red, final green and final connected tests. Counterpart verified account fences. |
| Shampoo label wrapping | Real connected screenshots exposed final-letter wrapping.68pt main/alternative label column fixed it; final screenshots inspected. |
| Native rows/source semantics from integration | Unpublished refined-draft provenance and habits-completeness failures fixed with failing-before tests. Full authority row/severity/alternative projection verified; web transport strips native metadata and retains its own limits. |
| Lost refresh success response | Existing conservative recovery retained: transient failure preserves account for retry; provider rejection returns to login. No unapproved provider idempotency/grace claim added. |
| Mismatched refresh owner should clear account | Rejected as a required policy change. Response B is rejected before persistence or data requests; A remains installed, with a regression test. |
| Final delta F2: mismatched refresh poisons the cached task | False positive: mismatch throws inside `do`; `catch` clears the matching `refreshTask` before rethrowing. A later retry creates a fresh request; concurrent waiters cannot clear a newer task. Verified directly in `MobileClient.swift`. |
| Final delta F1: expiry during cold hydration drops the link | Narrow extra-step recovery remains: expiry rotates the generation and discards that incoming callback. The user sees the explicit expired-session error. B has not been verified or consumed; the same still-valid link can be reopened. Claims that the link is consumed or requires a new email were rejected. Existing account fences retained. |
| Search candidate cap/order and refresh-route throttle | Nonblocking hardening notes. Search exposes truncation at1000 candidates; its capped source query lacks a stable order. Refresh has no additional facade throttle. No policy or scope expansion made for this local development milestone. |

The auth no-signup/owner binding, source CAS/ABA/immutable versions, grants/RLS, nonempty paid-state preservation, shared evaluation and web-cookie isolation had no verified blocker after fixes. Structural review found no required architecture change: shared deterministic calculation remains the authority; native transport/UI owns presentation and session state, with no duplicated recommendation engine or paid-context writer.

## Residuals and disposition

Decision coverage remains confirmed for parent revision9 / first-build revision5 and Nick's2026-09-12 connected journey. No new consequential product choice was silently adopted. The local historical-schema reconstruction, unverified physical-device/public-release boundaries, full VoiceOver traversal, keyboard OTP entry and Mac-lock-limited additional manual repetition are explicit in the verification receipt. This is development review readiness, not public-release approval.

Raw reports `/tmp/ios-claude-review.md` and `/tmp/ios-claude-delta-review.md` are discarded after this durable disposition; no raw reviewer output is added to the repository. Source, tests, operator scripts, approved planning artifacts and sanitized screenshots remain available for the eventual PR.

## Explanation-position correction review

A focused read-only terminal Claude pass covered the popup renderer, both callers and regression tests, without reopening the whole plan. No blocking defect was found. Main verified fixed88% detents, safe-area centering, constrained natural/scrolling content, fade interruption guards and synchronous teardown. The review's claim that only the scrim fades was rejected: the card view is a child of the animated backdrop, so its opacity follows the same transition.

The reviewer saw an intermediate environment override and card-height cap. The final build/test fixes replace the read-only environment mutation with a DEBUG fixture switch, remove the excessive height cap and use `strokeBorder` to avoid AX-bound growth; main inspected these changes and the final four passing UI tests and screenshots. No new product semantics were introduced. Short-card natural height and long-card scroll were both observed. A complete VoiceOver traversal, including focus on rapid reopen during fade-out, is not claimed. The earlier baseline review remains applicable to unchanged modules. Raw `/tmp/chaarlie-explanation-review.md` is discarded after this durable disposition.


## Approved glossary delta review

The supplied glossary request and current coverage acknowledgement are recorded in [glossary-implementation.md](glossary-implementation.md). **No blocking findings.** Main inspected all changed native/backend contracts, row producers, exact approved copy, fixture resources and the real rendered card. The normal correctness and structural lenses were applied to the new native Layout/type-boundary changes. One read-only terminal Claude Opus4.8/high pass covered this delta; it did not reopen the unchanged whole-branch baseline or invoke another reviewer.

Claude verified backend tests and the final unknown-axis/prototype-property fallback guard, optional Swift decoding, actual categorical care-direction authority and fixture parity. During its pass main corrected the Swift wrapper initializer, the unknown-axis fallback, one synthetic fixture status, and accessibility identifier propagation; the reviewer observed the final fallback code. Main reviewed the final native accessibility delta and reran its affected tests. The receipt fingerprint identifies the integrated final tree rather than relying on reviewer-time mtimes.

Nonblocking review notes: gradient-vs-flat color behavior is inspected in screenshots and directly follows the contract axisKind; no pixel-level color regression suite was added. Three small geometry consumers independently invert the same fixed1pt separator calculation; this is consistent and bounded, so no speculative abstraction was introduced. The first/last-center properties have unit coverage. The rail's x=7 correctly centers a12pt dot in a14pt column; the spec's illustrative x=6 conflicts with its center requirement and was not followed.

The reviewer requested explicit equal-height coverage at accessibility size; main added it to the existing largest-text scroll test. Group labels, hidden decorative semantics and fixed title/close are checked without claiming a full VoiceOver traversal. Main preserved all authored copy and deliberately retained label fallbacks for the categories listed in the implementation note. No newly proposed product or scope choice was adopted.

The raw `/tmp/chaarlie-glossary-claude-review.md` and run output are discarded after this durable disposition. Test logs and result bundles remain outside Git; approved spec, implementation note and sanitized screenshots are retained for the eventual PR. Publication remains unauthorized.


## Final native design-polish review

Nick's simulator acceptance and explicit final alignment/wrapping/padding request authorize the bounded corrections in [final-design-review.md](final-design-review.md). Main inspected rendered normal/compact/accessibility states and applied the normal correctness and structural lenses to the SwiftUI layout, German discretionary-break helper, native appearance ownership and isolated DEBUG rendering boundary.

One read-only terminal Claude Opus4.8/high pass reviewed the design delta against pre-pass native snapshots. It found no blocking defect and verified UTF16 insertion order, original accessibility labels, viewport sizing and the fixture's no-Keychain/no-network isolation. Main accepted its low-priority decorative-chevron note and hid those glyphs from accessibility. Its TextFieldStyle underscored-method note is retained as a maintenance consideration; its request for visual evidence is satisfied by direct inspection, not by treating screenshot capture as an assertion. The scanner secondary close control already has a44pt target; no unrelated style unification was added.

After counterpart review, main independently inspected the small glossary title/accessibility-heading soft-break extension, keyboard/logout/reachability capture checks and native per-surface appearance correction. RootView derives appearance from the existing admission/tab state; search/results explicitly own a light sheet. These changes do not add product semantics or modify account/backend logic. Affected native tests and actual transitions are recorded in the verification receipt. The earlier broader backend and branch reviews apply to unchanged modules and were not rerun.

Raw `/tmp/chaarlie-design-claude-review.md` and `/tmp/chaarlie-design-claude-run.log` are discarded after this disposition. Selected synthetic native screenshots and the concise final design review stay with the task; detailed Xcode bundles/logs remain outside Git. Publication remains unauthorized.


## Connected Profile scroll follow-up

Nick’s report was investigated on the actual local account, fresh and after search→result→explanation→close→Profile. One targeted touch test passed, moving logout from y1120.83 to717.5 above the tab bar. Nick confirmed wheel/trackpad input was the issue and that actual clicking/dragging works. No app bug or product fix was established; no settings changed. Temporary test source was restored byte-for-byte. [Diagnosis and before/after touch evidence](profile-scroll-investigation.md) are retained; the fingerprint update adds only that note and two screenshots. No broad retest or counterpart pass was needed for this read-only diagnosis. App and local services remain available.


## Authorized draft checkpoint publication

Nick authorized commit, push and draft PR creation for the reviewed B1–B4 milestone on2026-09-12. Merge, deployment, production writes and subsequent milestone edits remain separate. Fetched `origin/main` at `4935b271f2f734e7b3150732d171c85ac67fefa8`: since the reviewed base469d41f5, only workflow/instruction/planning files changed (#532); no shared application contract or migration changed. The draft preserves the reviewed implementation base and does not claim fresh-main implementation tests.

Read-only target migration history (`pqdkhefxsxkyeqelqegq`) confirms `20260912103630_mobile_auth_attempts` and `20260912103726_mobile_scanner_context` are **unapplied**. They passed the isolated local migration/integration checks above; neither was applied during publication. Before any merge that could deploy the mobile facade, choose and verify a safe migration-first sequence and refresh target history. Existing historical replay limitations remain.

Commit all228 fingerprinted task artifacts plus these two administrative receipts. Original planning/design evidence is preserved; temporary raw review/test probes were discarded as recorded. Local credentials, held environment, dependencies, databases, Xcode output and transient logs stay ignored/outside Git. The original planning worktree is preserved.

Publication hook normalization changed only formatting in `tests/scan-profile-context.test.ts`. Main inspected the delta and compared parsed TypeScript trees (identical after excluding the inserted no-op semicolon). All six tests in that file passed again. Other228-file content remained unchanged. Both receipts now identify the hook-normalized tree; broader unchanged verification/reviews were reused.

Final publication hygiene removed trailing whitespace from the two bundled OFL text files without changing license text or font binaries. Explicit configured pre-commit checks (`lint-staged` and `tsc --noEmit`) passed; the six formatter-affected tests passed. Full base-to-tree `git diff --check` passed, including newly tracked files. These mechanical changes were reviewed locally; no runtime behavior changed.
