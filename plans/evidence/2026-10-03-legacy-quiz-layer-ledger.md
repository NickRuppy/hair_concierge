# Legacy quiz layer challenge — read-only, 2026-10-03

## Decision and denominator

**27 assigned AST declarations = 20 R, 2 F, 5 conditional C, 0 D. Five proposed net removals; zero applied or executed by this lane.** The mobile file has16 declaration sites,17 viewport executions per selected project because one declaration loops over two viewports. No row/regrouping credit. The optional13 quiz-option-card test declarations were not added to the denominator or audited for removal.

The source checks are not a reason to retire the quiz. `route-classification.ts` explicitly puts `/quiz` in PUBLIC_EXACT_ROUTES; `updateSession` returns the normal response for unauthenticated public users. `src/proxy.ts` maps ordinary `/quiz` to the default organic package and only rewrites signed regular field-test cases. `src/app/quiz/layout.tsx` renders actual QuizShell and package provider; `page.tsx` renders the actual question, scalp, concerns, goals and lead-capture components and restores drafts. `src/app/page.tsx` actually renders OrganicRefreshLandingVariant with `/quiz` CTAs. Current packages.json has active default_organic, scan_v1 and discovery_call_v1 using legacy-quiz-v1. This is present source/config evidence, not a live traffic claim. Authenticated routing and field-test gates remain independently owned and untouched.

## Real boundaries and independent oracles

`legacy-quiz-motion.spec.ts` is a real Playwright page journey, not a fake browser implementation. Its MutationObserver only observes real DOM changes, computed style and attributes after clicking Wellig, then Zurück. It does not generate the shell transition or progress width. `legacy-quiz-email-deliverability.spec.ts` intercepts `/api/quiz/lead` responses (external boundary) but real QuizLeadCapture/QuizShell own saving, local error, suggestion, history, focus and consent recovery. The mock does not implement those asserted behaviors. Its successful follow-on route is not claimed to validate a backend lead or real provider transaction.

History's local WindowLike stub implements only stack push/replace/read. Actual imported browser-history owner computes depth, ownership, position and preservation; the mock does not copy those algorithms. The five direct history inputs remain distinct from browser ordinary-draft inputs. General facade coverage by itself is not the reason to retain them: exact missing inputs and credible faults are listed below.

## Complete assigned-site ledger

| File:line | Classification | Declaration | Specific evidence/fault |
|---|---|---|---|
| tests/legacy-quiz-browser-history.test.ts:33 | R | legacy quiz screen positions include each lead-capture substep | Actual getLegacyQuizScreenPosition adapter: null-package regular step3>2, email>name, consent>email, preparation>consent. A resolver that ignores leadCaptureSubStep fails; treatment Back/Forward browser input cannot guard these lead positions. |
| tests/legacy-quiz-browser-history.test.ts:52 | R | creator quiz history collapses hidden identity screens without changing regular positions | Actual positional adapter: partner consent immediately after final question and preparation immediately after consent, while regular consent stays later. Wrong mode forwarded to getQuizHistoryScreenOrder fails; regular-only browser fixture does not exercise partner identity collapse. |
| tests/legacy-quiz-browser-history.test.ts:65 | R | legacy quiz browser history preserves unrelated state while incrementing depth | Actual ensure+push preserve {campaign:"creator"}, initialize depth0, increment1 and exactly append one entry. Dropping unrelated history.state during spread breaks another history consumer; browser fixtures do not supply campaign state. |
| tests/legacy-quiz-browser-history.test.ts:76 | R | resume seeding only adds the missing browser-history depth | Actual seed from depth1 to4 adds only three entries; later target2 neither truncates nor appends. Off-by-one/add-on-every-restore bugs fail. Browser restored draft starts fresh and does not reseed a lower target over existing deeper history. |
| tests/legacy-quiz-browser-history.test.ts:87 | R | popstate handling is limited to quiz-owned history entries | Actual pop-state ownership accepts depth2 and rejects negative, foreign state and null. A permissive ownership test navigates quiz on foreign browser entries. Browser valid-depth back/forward cases do not supply these foreign states. |
| tests/legacy-quiz-mobile-action.spec.ts:94 | R | fits all four texture choices in the fresh 390x844 first frame | Fresh390x844 actual card layout checks four literal labels, welcome/treatment clarification and all four bottom/height bounds; overflow or oversized fourth card fails. Short-height test measures only Glatt at375x667. |
| tests/legacy-quiz-mobile-action.spec.ts:133 | R | keeps thickness descriptions visible on mobile | Draftstep3 actual thickness cards retain all three explanatory strings on mobile; wrongly applying hidden sm:block to descriptions fails. Fresh texture geometry does not exercise thickness descriptions. |
| tests/legacy-quiz-mobile-action.spec.ts:141 | R | uses the newer quiz's short-height grid density at 375x667 | Fresh375x667 actual short-height CSS bounds Glatt button153/image113; removing max-height density rules fails even when390x844 four-card case passes. |
| tests/legacy-quiz-mobile-action.spec.ts:162 | R | `pins the treatment action and clears final content at ${viewport.name}` | One AST site/two viewports: draftstep7 empty selection→Naturhaar, disabled→enabled count1 plus real fixed-body portal/safe-bottom/padding/clearance. Incorrect mobile portal placement, bottom inset or content clearance fails. Do not count the two rows as two declarations. |
| tests/legacy-quiz-mobile-action.spec.ts:203 | R | renders the aligned scalp question and answer scale | Draftstep7 Naturhaar→actual scalp owner, exact heading/advice and three scale labels. Wrong continuation or reverted scalp terminology fails; direct constants do not prove delivered next screen. |
| tests/legacy-quiz-mobile-action.spec.ts:221 | R | keeps exactly one fixed action while concerns transition to goals | Draftstep8 single dryness→goals during outgoing snapshot; exactly one fixed accessible action outside transformed root. Portal snapshot duplication during overlap fails despite resting footer test passing. |
| tests/legacy-quiz-mobile-action.spec.ts:243 | R | uses the neutral goals heading for coily hair | Same flow but coily structure; actual goals heading stays neutral. Coily-only fallback to Locken-specific heading fails; wavy keeper cannot reach that input. |
| tests/legacy-quiz-mobile-action.spec.ts:253 | R | keeps the concerns note usable without changing the fixed footer height | 375x667 note edit focus after500ms, deselect/reselect local text and count1/2, unchanged footer height and textarea clearance. Reopening clears local text or keyboard/footer overlap fails; saved-note Back tests have different lifecycle. |
| tests/legacy-quiz-mobile-action.spec.ts:311 | R | does not refocus or scroll a saved concern note after Back | Draftgoals with saved note→Back concerns; after650ms heading H2 focused, textarea not focused and scroll movement<=32. Autofocus saved textarea on reentry fails; interactive note keeper deliberately focuses textarea. |
| tests/legacy-quiz-mobile-action.spec.ts:337 | R | keeps a saved concern note deselected after navigating Back and returning | Draftconcerns low_shine+saved note→deselect→Backscalp→Nein→return; store-level stale concerns_other_text resurrects note. Same-screen local toggle keeper does not unmount/reenter. |
| tests/legacy-quiz-mobile-action.spec.ts:366 | R | keeps the regular desktop action inline | 1024x800 inline action visible, viewport/spacer hidden, inside transition root and exactly one Weiter. Wrong min-height/min-width breakpoint yields duplicate/fixed desktop footer. |
| tests/legacy-quiz-mobile-action.spec.ts:385 | R | centers a short desktop footer across the single-column quiz | 1280x700 short desktop activates fixed footer, full viewport left0/rightwithin8 and centered button. Width-only breakpoint or stale split-column positioning fails; ordinary tall desktop is distinct. |
| tests/legacy-quiz-mobile-action.spec.ts:407 | C | silently restores a draft and maps browser Back to the previous quiz screen | C5: identical openDraft(step7,390x844), first heading and first browser Back are the prefix of retained Forward test421. Transfer no-resume-banner and exact /quiz URL into that same prefix, before Forward. |
| tests/legacy-quiz-mobile-action.spec.ts:421 | R | keeps browser Forward from desynchronizing the rendered quiz screen | C5 primary keeper: actual Back→Forward bounce leaves pulltest rendered, next Back reaches fingertest. Removing positive-depth rejection in provider desynchronizes URL/history and current rendered step. Add donor prefix assertions. |
| tests/legacy-quiz-mobile-action.spec.ts:438 | R | maps browser Back through the scalp question's in-place phase | Draftstep6 unset scalp fields; selecting Ausgeglichen enters local gate, real Back restores type options and hides gate without leaving question. Removing custom in-place history entry/back handler fails; whole-question Back differs. |
| tests/legacy-quiz-mobile-action.spec.ts:462 | R | uses a centered desktop question column without the split brand panel | Fresh1280x800 actual centered <=640 question column, no split Chaarlie panel. Restoring old split desktop shell fails; footer geometry does not pin question-column center or brand-panel removal. |
| tests/legacy-quiz-ui.test.ts:29 | F | legacy quiz multi-select screens do not enforce the retired concern or goal caps in UI | No whole cut: existing browser cases select one concern or one concern plus a note, not all applicable concerns/goals. A reintroduced cap under another identifier passes these negative regexes. Replace with owner selection assertions before deleting; generic QuizQuestion treatment exclusivity must not be confused with a concern cap. |
| tests/legacy-quiz-ui.test.ts:37 | F | legacy concerns reuse the Personal Plan concern options while retaining free text | No whole cut: note keeper covers Etwas anderes, editing, hide/restore and footer geometry, but not the 50-character boundary, full texture-aware options, or absence of Nichts davon/Notiz entfernen. getConcernOptions spelling is private; observable copy/options and truncation remain real policy. |
| tests/legacy-quiz-ui.test.ts:47 | C | legacy quiz shell uses the Personal Plan motion classes for screen transitions | C1: actual motion keeper already observes real active/outgoing layers, forward/back direction, inert/aria-hidden snapshot and frozen nested animation. Transfer nonzero computed animation on both layers; remove class-name/source-attribute assertions. |
| tests/legacy-quiz-ui.test.ts:54 | C | legacy lead capture keeps local recovery state across its animated substeps | C2: actual email-recovery keeper crosses consent→email with local error/suggestion/consent intact. Add settled focus observation; ref spelling and blanket key={step} prohibition are not contracts. Deliberate substep remount must fail keeper. |
| tests/legacy-quiz-ui.test.ts:61 | C | legacy progress animates from the previous question without remounting at its target width | C3: actual motion keeper already captures initial 10% forward/20% back and 0.5s. Transfer final 20%/10%, computed width transition and ease-out; catches no-progress-update and timing loss without pinning requestAnimationFrame/provider names. |
| tests/legacy-quiz-ui.test.ts:67 | C | organic landing profile card uses a real canonical hair portrait | C4: real home-page portrait keeper already asserts labelled visible image and no horizontal overflow. Transfer exact resolved underlying wavy-medium asset path to that image; no source-level property remains. |

## Whole-declaration transfer plans

### C5 — tests/legacy-quiz-mobile-action.spec.ts:407

Primary retained owner: `tests/legacy-quiz-mobile-action.spec.ts` — **keeps browser Forward from desynchronizing the rendered quiz screen**.

- Immediately after existing restored chemical-treatment heading, insert await expect(page.getByText("Angefangener Haar-Check")).toHaveCount(0). Immediately after existing first Back/pulltest heading insert await expect(page).toHaveURL(/\/quiz$/). Keep subsequent Forward and next Back assertions unchanged. Both donor and keeper use openDraft(page,7,{width:390,height:844}) with identical storage values.

Actual-source controls to prepare/run serially by main, then restore bytes:

- Actual draft initialization stopped/replaced with fresh start must fail initial treatment heading.
- Actual seeded pushState URL changed to /quiz?resumed=1 must fail transferred post-Back URL assertion (owner browser-history.ts); check intended URL failure rather than setup redirect.
- Reintroduce Angefangener Haar-Check in real restored-draft page render: transferred absence assertion must fail.
- Remove provider positive-depth Forward bounce: existing Forward pulltest/fingertest sequence must fail.

### C1 — tests/legacy-quiz-ui.test.ts:47

Primary retained owner: `tests/legacy-quiz-motion.spec.ts` — **uses the Personal Plan two-layer transition and smooth progress timing**.

- In the already armed MutationObserver capture getComputedStyle(active/outgoing).animationName and animationDuration. Require each name != none and each parsed duration > 0 in both forward and back snapshots. Keep all existing direction/headings/inert/aria-hidden/ID/frozen-option assertions. Do not assert a literal private CSS animation name.

Actual-source controls to prepare/run serially by main, then restore bytes:

- Remove only personal-plan-screen-enter from QuizShell active class; computed active animation must fail.
- Remove only personal-plan-screen-exit from outgoing class; computed outgoing animation must fail.
- Behavior-preserving control: rename both CSS class tokens consistently in QuizShell and globals.css; old donor must fail, retained runtime keeper must pass.

### C2 — tests/legacy-quiz-ui.test.ts:54

Primary retained owner: `tests/legacy-quiz-email-deliverability.spec.ts` — **keeps saving bounded and returns a rejected address to editable recovery**.

- After 422 recovery and before editing, wait for outgoing layer count0 and two requestAnimationFrame ticks, then assert email is still focused. Preserve server-error text, aria-invalid/describedby, server suggestion correction, no repeated consent and exactly two submissions. Existing input is step9 regular wavy draft; Legacy Test; legacy.test@gmail.vom; 422 no_mx suggestion legacy.test@gmail.com, then200.

Actual-source controls to prepare/run serially by main, then restore bytes:

- Add key={`${step}:${leadCaptureSubStep}`} to QuizShell active layer: real child remount discards error/serverSuggestion/consentAnsweredRef, so actual recovery keeper must fail intended recovery assertion.
- Remove only if (step === 9) return from shell focus effect: after settled transition it must fail email focus. Do not accept a timeout elsewhere as focus proof.
- Consistent activeLayerRef→motionLayerRef rename should leave runtime tests green while old donor fails.

### C3 — tests/legacy-quiz-ui.test.ts:61

Primary retained owner: `tests/legacy-quiz-motion.spec.ts` — **uses the Personal Plan two-layer transition and smooth progress timing**.

- Capture computed transitionProperty and transitionTimingFunction from active progress fill; exact width and ease-out, retaining 0.5s. After forward snapshot assert active fill.style.width reaches 20%; after back snapshot assert it reaches10%. Existing initial10% and20% assertions stay. Use existing capture timing, not an arbitrary sleep; eventual target alone is insufficient.

Actual-source controls to prepare/run serially by main, then restore bytes:

- Change setDisplayFraction(targetFraction) in progress effect to setDisplayFraction(fromFraction); final20% must fail.
- Set provider fromCurrent from nextState instead of previousState in shell; initial10% must fail.
- Change duration-500 to duration-300 in progress owner;0.5s must fail.
- Change ease-out to ease-linear; computed easing must fail.

### C4 — tests/legacy-quiz-ui.test.ts:67

Primary retained owner: `tests/legacy-quiz-motion.spec.ts` — **renders a labelled real profile image on the organic landing**.

- From the same visible image selected by exact alt Beispielprofil mit welligem Haar, read src attribute, parse new URL(src,location.href), and compare searchParams.get("url") ?? pathname to literal /images/funnels/personal-plan-quiz/profile-summary/wavy-medium.webp. This handles Next image URL encoding without copying owner constants. Keep visible image, separate Beispielprofil caption and overflow checks.

Actual-source controls to prepare/run serially by main, then restore bytes:

- Change actual OrganicRefreshLandingVariant portrait src to a different existing portrait; exact decoded source assertion must fail.
- Change alt to Beispielprofil; existing role/name locator must fail.
- Replace image with labelled gradient; actual visible img keeper must fail.

## Why these are whole C cuts

C1: the lost assertions merely spell enter/exit classes and direction/layer attributes. Existing real layers/directions plus computed nonzero animation cover actual delivered motion. The direct class strings have no separately identified external API consumer. The CSS binding is real and retained at runtime; consistent class renaming must survive.

C2: ref spelling serves snapshot capture (C1 keeper). A key keyed by substep genuinely remounts the child with locally held error/serverSuggestion/consentAnsweredRef; the live rejection journey observes the consequence. A blanket ban on key={step} does not independently prove persistence within step9; it can reject a harmless refactor. The focus branch protects a real keyboard recovery contract and is explicitly retained after frames settle. The exact error message on the keeper is imported from production into the mocked response, but the proposed cut does not rely on that import to prove business copy: the keeper independently asserts rendered literal substring and the real component preserving error/suggestion/consent across transitions.

C3: context-provider and requestAnimationFrame identifiers are implementation mechanisms; previous-to-target progress, width-only0.5s ease-out interpolation are the delivered contract. Keep prior and final widths, because merely0.5s duration can pass with a permanently frozen progress bar. Removing this donor does not license dropping reduced-motion behavior; the assigned donor does not test that branch. Existing reduced-motion coverage was not certified by this lane.

C4: exact asset is a documented approved portrait, not an arbitrary filename to erase. Transfer it literally to the existing real `/` image test. The SSR organic-funnel-surface keeper was also fully read but is not chosen as a second primary owner; it guards the larger landing copy/CTA contract. Browser image visibility still does not by itself prove downloaded pixel content; do not claim it does.

C5: donor407 and keeper421 have the same viewport, draft step and literal completeAnswers, and the same first navigation. The donor's extra absence and URL assertions belong at that prefix before Forward. No distinct input is removed and later Forward cannot mask a failed donor assertion. This is semantic duplicate elimination, not combining different cases into a table.

## F repairs, no quota credit

UI29: source negative regexes catch only specific obsolete cap spellings; another variable/guard can cap choices undetected. Needed owner proof: select beyond old cap at actual concern and goal screens, verify all pressed states/counts and committed values while preserving primary-concern-sheet behavior for2+ concerns. Current mobile keeper selects onlyone concern orone concern+note; no input-complete keeper was found in the fully read set. A mere new table grouping would not qualify as deletion. Retain pending a separately validated in-place owner transfer.

UI37: current note keeper proves free text usability but not maxLength50 (and onChange independently slices to50), complete texture-specific options, retired Nichts davon or Notiz entfernen absence. Replace private getConcernOptions(question.options.map) grep with real rendered labels, explicit absence and50/51 boundary on a meaningful existing journey; do not compute expected options by calling getConcernOptions. Need both DOM maxLength and actual truncation controls, since changing one limit alone can be masked by the other. No whole cut is proposed now. Optional native option-card tests retain independent keyboard/disabled/accessibility input contracts; no mouse-only mobile equivalence is claimed.

## History and CI evidence

Commit1100e686 (#319,2026-08-03) introduced the motion/portrait browser suite and these four source declarations together. Its message explicitly names real portrait, two-layer forward/back, previous-width500ms interpolation, frozen outgoing snapshots and preserved recovery. The accompanying approved `plans/2026-08-02-organic-influencer-funnel-refresh.md:178` records the production correction and real portrait/motion intent. Its original200ms transition text is historical; current CSS motion tokens are240ms enter/160ms exit. Do not transfer obsolete200ms as a new expected value. No need to pin240/160 merely to replace source presence checks; nonzero animation is the lost assertion's functional equivalent, while existing motion-token owners can own timing policy.

Later commits9ae684fc/9c02f20f (Aug5) update concerns/parity;167455e4 (Sep1) fixes custom-note deselection;f8c28328 (Sep13) adds scanner package/history;cee5f253 (Sep22) neutralizes goals copy;feb9284c (Sep25) updates real quiz/lead transitions. These are maintained paths. Current source package registry and current route admission corroborate support rather than inferring it from age or package registration alone.

`npm run test:node` includes root tests/*.test.ts and*.test.tsx. All three browser suites here are under @ci describes and enter the `playwright-smoke` job's `--grep @ci --project=chromium` selection. That job is conditional on scope and live-secret availability; a skipped job is not proof. They are not in the explicit test:playwright:contracts list. The mobile-action suite also belongs to configured webkit-mobile-action testMatch, but motion and deliverability do not. No claim of current green/browser execution is made.

## Cleanup and main's validation plan

After C1–C4 transfer/control proof, remove only those four UI declarations and their now-unused top-level quizShellSource, quizProgressSource and organicLandingSource reads. Keep assert/readFileSync/test plus question/concerns/goals source reads for the two F declarations. Remove only mobile donor407 after its assertions are in keeper421. No production export, helper, CSS, route or source seam becomes unneeded; no production deletion follows.

Native Node before/after command, from task root:

`node --import ./tests/server-only-register.cjs --import tsx --test tests/legacy-quiz-ui.test.ts tests/legacy-quiz-browser-history.test.ts tests/organic-funnel-surface.test.tsx`

Actual browser before/transfer/after selection for main's already-approved local server/config:

`playwright test tests/legacy-quiz-motion.spec.ts tests/legacy-quiz-email-deliverability.spec.ts tests/legacy-quiz-mobile-action.spec.ts --project=chromium`

Also rerun mobile-action under webkit-mobile-action because its donor/keeper is enabled there. The repository Playwright config reads.env.local: this lane did not load it. Main should use its isolated no-env config and controlled server/network setup rather than treating the printed command as authorization to read env or contact providers. The lead fixture intercepts the lead endpoint but is not an all-network offline harness; other page/auth/analytics traffic must remain controlled. Preserve genuine browser execution and CSS/layout; do not replace it with a harness that fabricates computed animation or recovery.

Controls must fail the intended assertion, not startup/auth/provider/setup. Baseline failures remain visible. Run real owner controls against each retained strengthened keeper while donors still exist, restore exact bytes, then remove donors and rerun. C5 firstBack URL/notice assertions run before Forward. Parent alone decides integration. Global native/c8<=2pp gate remains necessary; this read-only lane has no measured coverage result.

## Read depth and limits

Complete: all27 assigned declarations and their fixtures/helpers; both legacy-quiz-motion declarations plus complete observer helpers; all7 legacy-quiz-email-deliverability declarations plus draft/response/route fixtures; all organic-funnel-surface test file; actual quiz page/layout/shell; browser-history helper and provider; progressbar; QuizQuestion, QuizConcernsQuestion, QuizGoals, QuizLeadCapture(806lines), QuizScalpQuestion, QuizMobileBottomAction, QuizOptionCard; home page and organic landing component; route-classification file; current package registry.

Focused excerpts/navigation: Supabase middleware public-route return/auth handling, proxy attribution/field-test rewrite branches, CSS keyframes/motion/progress-related rules, package scripts/CI smoke gates, shared concern/goal option functions, screen-order relevant projections, related plans/history. Quiz-email-return browser excerpts were navigation only, not chosen as keepers. The13 quiz-option-card test bodies, entire middleware, entire CSS, entire store/draft implementation, every route provider and all external dependency sources were not audited. No whole-suite or complete dependency-closure claim. No tests, builds, compiler, owner code, browser, network, DB or mutation ran; only file/git/static-inventory reads and/tmp artifacts were written.

## Main transfer correction

Actual Tailwind easing output is cubic-bezier(0, 0, 0.2, 1), confirmed in node_modules/tailwindcss/theme.css --ease-out. CSS keyword ease-out is a different curve. Initial transferred test correctly failed on the mistaken expectation; main corrected only the independent expected computed value and staged driver. Existing sourceease-out → ease-linear control still proves regression sensitivity. No production change or cut made here.
