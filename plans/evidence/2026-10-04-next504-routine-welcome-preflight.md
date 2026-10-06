# next1091 Routine + Welcome preservation preflight

## Scope and verdict

Read only the six Routine candidates in `/tmp/test-audit-routine-presentation75-candidates.json` and the four Welcome candidates in `/tmp/test-audit-welcome-static-candidates.json`, their named plans/controls, donor/keeper bodies, and direct owners. **All ten are conditionally clean for the staged transfers/cuts.** The six Routine donors and their keeper-before snapshots remain current; all candidates are unapplied. No repository change, runner, mutation, provider, or browser action was performed here.

`plannedLabelFor` is excluded: it is not in either candidate file and was not assessed.

## Routine C1–C6

| ID | Verdict | preserved assertion union and source path |
|---|---|---|
| C1 | Clean | `stage4-route-ui:198` and keeper `:177` render the identical `RoutineUnavailableState` plus same retry element. Move the `/plan-start` link regex into the keeper; its button, text, callback, and refresh binding assertions remain. The actual component emits the link at `src/app/routine/page.tsx:148-170`; route resolver can reach it. |
| C2 | Clean | Direct reader donor has the same `ids` and `v3Snapshot()` as GET keeper `portfolio-presentation:304`. The route invokes actual plan/version/portfolio reader (`src/app/api/personal-plan/portfolio-presentation/route.ts:25-54`), and `loadOwnerPortfolioPresentation` applies the three exact portfolio filters at `src/lib/personal-plan/routine/portfolio-presentation.ts:40-52`. The proposed table-specific receipt preserves `id`, `user_id`, `personal_plan_id`; schema v3 and `Altes Shampoo` are also retained. The client fixture supplies rows, not a finished presentation. |
| C3 | Clean | Null banner donor and keeper’s omitted prop both resolve `refinementBanner = null` (`routine-page.tsx:82-92`) with the same view. Transferred missing product/habits/dismiss/progress fragments all observe the same `banner` guard at lines 157-166. It does not claim a dismissal lifecycle. |
| C4 | Clean | Same omitted-prop render already exists as C3’s `withoutFlag`. Its two donor assertions are part of C3’s transferred no-banner union. No additional render or input is added. |
| C5 | Clean | The coexistence keeper has the donor’s same routine/view, toast flag and dismiss callback; actual `RoutinePage` renders toast and banner as independent adjacent slots before `Deine Basis` (`routine-page.tsx:250-260`). It retains toast text and adds donor `role=status` plus toast-before-basis ordering. A banner cannot mask those observations. |
| C6 | Clean | The same coexistence keeper has the donor’s exact habits `3/4`, both banner callbacks, and same view. It retains the title and adds progress, CTA, and banner-before-basis assertions. Toast is an independent preceding sibling, so its presence changes only the additional composition case, not the banner predicate/readset. |

The controls are appropriately source-specific, but remain pending execution: C1 link destination; C2 each portfolio filter/schema delivery; C3/C4 visible fragments; C5 toast role/order; C6 banner order/progress/CTA. SSR cannot establish mounted navigation, timer, or callback lifecycle; none of those claims transfers.

## Welcome C1/C2/D1/D2

| ID | Verdict | preserved assertion union and source path |
|---|---|---|
| C1 | Clean, with fixture-recorder condition | Donor is only a source regex over the terminal PayPal `capturePaymentFailure` call. The actual call is `welcome-client.tsx:216-230`. Keeper `welcome-activation-outcomes.spec.ts:234` compiles the real `WelcomeClient`, drives exactly 15 pending PayPal responses and the timeout; this reaches that call. Replacing its existing no-op `capturePaymentFailure` fixture export with an argument recorder does not manufacture a payload. It must assert exactly one emitted 13-field object, including stage/timeout and no token/extra field. The fixture has no network error, so no preceding capture should enter the recorder. |
| C2 | Clean | The browser fixture renders actual `WelcomeClient` with `email="alex@example.com"` in `beforeAll`; its sender-failure keeper starts at that rendered branch. The real, single label is `welcome-client.tsx:692-700`. Add exact accessible label/value and old-label absence before interactions; existing password/send/retry assertions remain. This is compiled browser behavior, rather than a source string check. |
| D1 | Clean | Donor only freezes private helper signature/code. Keeper `welcome-activation-return.test.ts:204` runs the actual `WelcomePage` assembly with payment+paid recovery and typed `checkout_one_time_charge_revoked`, then observes `oneTimeReturnState === "revoked"`. It reaches `oneTimeReturnStateFromError` at `welcome/page.tsx:427-432`; control D1 changes the true arm and should fail the retained behavior. The other terminal mappings remain in the same keeper. |
| D2 | Clean | Donor deliberately mutates the source in its test harness and checks the bypass. Adjacent keeper `welcome-activation-return.test.ts:188` executes original `WelcomePage` for both authentication states, observing `trial_unavailable` panel and zero downstream calls. It reaches the real early return at `welcome/page.tsx:144-149`. Removing the guard makes that keeper fail; delete only the test-only `bypassStripePreflight` source replacement/options path and retain the parent-only serial fault control. |

### Welcome controls and limits

All five named controls target the relevant production branch. They are not proof yet: focused native/browser baseline, intended-red, byte-exact restoration, and after-cut validation remain main-owned. The C1 recorder must be scoped to the test fixture and must not construct, normalize, or pre-seed expected fields; otherwise it would invalidate the claim that the real compiled client generated the payload. The compiled fixture stubs external effects, so this supports client emission and rendered behavior, not a provider delivery guarantee. D1/D2 native harnesses execute the page assembly with mocked provider/auth dependencies, so they retain classification/ordering, not external Stripe state.

## Current snapshot check

All six Routine donor bodies and keeper-before bodies are present in current files; candidate keeper-after bodies are absent, as expected before application. Current owned source hashes match controls: `welcome-client.tsx` `2f877931…`; `welcome/page.tsx` `e6c5c768…`. Candidate stage files remain unapplied. This is a static/body and direct-owner preflight only.
