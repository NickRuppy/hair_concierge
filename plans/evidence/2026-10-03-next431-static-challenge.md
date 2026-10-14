# Profile / Personal Plan source-inspection challenge

Read-only challenge, current task worktree. This is **not new read credit** and does not reclassify the 120-site navigation cohort as a new whole-file audit.

## Scope and current fingerprints

The coherent profile / Personal Plan page-wiring navigation cohort has 120 current AST sites:

| File | Current AST sites | SHA-256 |
| --- | ---: | --- |
| `tests/profile-haarcheck-verfeinerung-lock.test.tsx` | 20 | `d705311d0f2b21e0b686b77d3a24c0ec93c39d6cdd73eba62d7b374cd011fd96` |
| `tests/personal-plan-profil-haarprofil.test.tsx` | 17 | `6f5aecb7114cf205ae52bd503b6d88d43652275767daa2f06f375bd406662819` |
| `tests/personal-plan-ready-server-first.test.tsx` | 10 | `5d074f8212e9eaa8883d06ec1208198bbb7a4158b6ef91a0b4bf214c15bd74df` |
| `tests/personal-plan-start-resume.test.tsx` | 36 | `9d07114d482ec44a4552ec6a2534617cb8931b528d6bb91e051fe1d981f6ba31` |
| `tests/personal-plan-accept-ideal-plan.test.tsx` | 28 | `90089e6b9e2e43bc1bae84aa11ed7e9e3b29391eae1e8dbe03863f7b6b01ea99` |
| `tests/personal-plan-option-card-layout.test.ts` | 2 | `3f5b791dd3f39a8c77678d5226ffee6d3de1cf76351609083f654c26496a2b32` |
| `tests/personal-plan-field-test-ui.test.tsx` | 7 | `3a2b873d802dfb9667ca5f8167bb95d5b6eb23cda0a7b8dc90a4ba153d3335e8` |

I read the complete **18 source-inspection declaration bodies** in those files, their fixtures immediately feeding the relevant rendered/direct-owner tests, and the named source owners/callers below. `start-resume` and `accept-ideal-plan` have matching explicit-complete receipts in `/tmp/test-audit-current-complete-read-map.json`; their current hashes match those receipts. The other 56 navigation declarations are outside this narrow source-inspection challenge.

CI executes top-level tests through `package.json:49` (`test:node`) and the Personal Plan nested owner through `package.json:50-51` plus `.github/workflows/ci.yml:158-160`. No command was run.

## Verdict

**C 1, F 17, R 0, D 0 among the 18 challenged source-inspection declarations.**

`F` here means the source assertion fails the identifier-only-refactor bar but lacks an existing behavioral keeper with the same page-composition input/output; it is retained until a real page/effect/browser owner can take the observation. It is not removal credit.

### C — one complete declaration

| Site | Remove/transfer | Exact existing keeper and assertion union |
| --- | --- | --- |
| `tests/personal-plan-accept-ideal-plan.test.tsx:627` — `the Idealplan CTA accepts directly and never opens the fork that no longer exists` | **C: remove whole declaration; no test transfer.** | The declaration only checks source tokens `"fork"`, `PlanForkScreen`, and private `acceptIdealPlanDirectly`, then asserts an old file is absent. The current behavior is already separately observed at the actual state/UI boundary: `:235-240` calls the direct `PlanStartCustomerJourney` effect and expects `{ kind: "open_routine", href: "/routine" }`; `:506-512` renders `PlanStartFlow` with `nextIntent: "accept"`, expects literal `Zu deiner Routine`, and excludes the refinement CTA; `:620-625` exercises the converse refine UI. Thus there is no missing user-observable assertion to transfer. Reintroducing a fork only matters if it alters the decision result or CTA; those existing keepers catch that. |

Actual owner: `src/components/personal-plan-start/plan-start-flow.tsx` is the live Plan Start UI owner. The historical fork deletion came with `97c7f731` / the direct-accept path with `55753b8c`; current `git log -S` shows this assertion is a relic inventory rather than a transport, persistence, access, or public API contract. Cleanup is only the declaration and its `readFileSync` import if it becomes unused. Suggested focused command for main only: `node --import ./tests/server-only-register.cjs --import tsx --test tests/personal-plan-accept-ideal-plan.test.tsx`.

### F — source assertions that do **not** meet the retention bar, but have no same-boundary keeper

| Site | Private source oracle challenged | Actual owner/caller and why no C/D now |
| --- | --- | --- |
| `profile-haarcheck-verfeinerung-lock:149` | Exact JSX spelling of `HaarCheckEditControl tier={tier} onEdit={() => startQuizEditing()}`. | `src/app/profile/page.tsx:507-510,999-1014,1246` composes the page; leaf keepers `:97-146` in the same test prove control markup/click forwarding, but do **not** prove the page passes the server tier or page choke point. No current rendered profile-page keeper exists. |
| `:211` | `MemoryToggleControl` prop order and exact `MEMORY_GATE` literal. | Page owner at `profile/page.tsx:105-108,2073-2079`; leaf test `:158-208` proves locked vs premium control behavior but not page wiring to the memory mutation handler/sheet. |
| `:222` | Private local `memoryStatus` name and branch ordering. | Page `:938-951` determines the visible summary. The leaf switch assertion only proves its own label/checked state, not the page summary; an identifier rename preserving the summary fails this grep. |
| `:238` | Private constant names and exact context object formatting for HAARCHECK/VERFEINERUNG. | `profile/page.tsx:100-108,1005,1220`; feature copy registry assertion `:249-255` is independent, but no page-level click receiver currently observes which context reaches `PremiumSheet`. |
| `:259` | Function name `startQuizEditing` and textual order before `setQuizEditing`. | Actual gate is `profile/page.tsx:999-1014`; all three entrypoints funnel through it, but current leaf-only tests do not invoke that function from the page. |
| `:276` | Separate teaser JSX conditional and a repeated `hasRoutineAccess && refinementStatus` source fragment. | Actual output owner `profile/page.tsx:1219-1230`; `personal-plan-profil-haarprofil:276` repeats the latter fragment, but neither keeper renders the profile page under free/premium inputs. The unique teaser mount remains unabsorbed. |
| `:288` | One `PremiumSheet` mount and `context ?? HAARCHECK_GATE` call shape. | Actual mount `profile/page.tsx:2368-2373`; no existing page interaction test observes fallback context after PayPal return. |
| `:300` | `useProfilePageTier` import/call and absence of direct entitlement identifiers. | `src/components/profile/profile-page-tier.tsx:22-35` is an independently live provider; `src/app/profile/layout.tsx:20-32` supplies it. `tests/gated-example-pages.test.tsx:23-33` proves the shared loader's flag-off result only, not this layout-to-page connection. |
| `:308` | Exact import/`Promise.all`/provider nesting spelling. | Same layout at `profile/layout.tsx:1-32`. A provider rename or alternate equivalent composition fails while behavior remains correct; no profile route/page render keeper replaces it. |
| `personal-plan-profil-haarprofil:276` | `useProfileRoutineAccess` local, guard spelling and layout prop source. | Page `profile/page.tsx:507,1219-1230`; layout `profile/layout.tsx:29-32`; pure owner test `:249-273` proves `hasRoutineTabAccess` decisions and `:205-319` proves `HairProfileSection` output, but neither executes the layout/page composition. |
| `personal-plan-ready-server-first:236` | Client effect implementation spelling (`activeInitialAction`, helper calls, raw `request.method`). | `personal-plan-ready-client.tsx:175-218` is the only active effect wiring. `tests/personal-plan-ready-transition.test.ts:29-42` proves GET→POST→GET transition semantics, but cannot prove this component uses that owner rather than a hand-coded POST. |
| `:313` | Server page call and object-spread spelling for migration readiness. | `src/app/plan-bereit/page.tsx:253-295` is live route composition. `tests/personal-plan-ready-readiness.test.ts` proves loader outcomes, and client renders cover supplied envelopes, but no existing keeper feeds a migration readiness result through this page composition. |
| `personal-plan-start-resume:53` | Two private `installNewStage3Bootstrap` call spellings and a literal occurrence count for the analytics event. | The live flow is `plan-start-flow.tsx`; `tests/personal-plan-stage3-analytics.test.ts:56-85,183-187` proves consented event contract, but not direct-entry/retry wiring or once-per-journey behavior. |
| `personal-plan-option-card-layout:11` | Tailwind class literals/local `OptionCard` slice. | `personal-plan-quiz.tsx` owns the active Personal Plan selector layout. Current `quiz-option-card` tests cover a different shared component, and `personal-plan-stage2-refinement-ui:442-445` only observes one selected class. No same-option-card browser/render keeper has the two layout cases. |
| `:22` | Count of private class-name occurrences in two branches. | Same owner and gap as `:11`; a wrapper/extracted component refactor would falsely fail while unchanged UI passes. |
| `personal-plan-field-test-ui:101` | Source offsets around `fieldTestAttached` and `onSaved`. | Quiz client owner `personal-plan-quiz.tsx:1986-2001`; server route writes `fieldTestAttached` at `api/quiz/personal-plan-lead/route.ts:244-280`. Existing route tests establish server authorization, but no client effect keeper executes this blocked-navigation result. |
| `:112` | Result page import/local assignment identifiers and tracking expression. | `src/app/result/[leadId]/page.tsx` composes persisted intent into `ResultPageClient`; `src/lib/personal-plan-field-test/server.ts:322+` is the authorization owner. Existing `ResultPageClient` rendering covers `fieldTestUnavailable`, but not this server-page mapping. |

## Retained non-source assertions and limits

No other declaration in the 120-site navigation cohort is marked by this challenge. In particular, leaf component render tests, actual state-machine tests, direct access/readiness owners, malformed payload paths, and public copy/accessibility assertions are not source inventories and were not treated as weak merely because nearby files use `readFileSync`.

The profile source assertions were introduced with the live freemium/profile deployment (`bad594d6`) and the routine-profile path was revised in `97c7f731`/`3abfe00a`; history confirms current production ownership, not an orphaned operator seam. The finding is narrower: these tests are **fragile architecture probes**, not independently executable user-outcome guards. Replacing them requires a page-level hook/effect or browser keeper and is outside this no-new-test-input/no-new-seam challenge.

No runners, edits, providers, or external actions were used.
