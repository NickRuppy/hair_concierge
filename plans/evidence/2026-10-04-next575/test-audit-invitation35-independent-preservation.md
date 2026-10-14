# Independent preservation review — invitation C1/C2

Verdict: **C1 CONDITIONAL PASS; C2 CONDITIONAL PASS.** No lost asserted contract identified in the proposed transfer/cut. F1 stays unchanged, zero deletion or repair credit. This is a review of the two candidates and complete invitation test context, not an independent audit of the broader 35 declarations.

Root `/Users/nick/AI_work/hair_conscierge/.worktrees/test-audit-pruning`; verified HEAD `21e0e41fa996ec6a725c258ab3766971f0edb94d`. Repository read-only. No tests, compiler, renderer, source mutations, provider/DB commands, environment access, or counterpart reviewer invoked. Only this report and the companion static JSON were written in `/tmp`.

## C1 — coral present / plum absent

Donor `tests/discovery-invitation-card.test.tsx:43-49`; retained keeper `:62-76`, specifically its prefilled render `:63-65`. Both render the real DiscoveryInvitationCard with exactly `email="lea@example.test" mode="ready" name="Lea Sommer"` and identical omitted props. Card defaults error/errorHint to null (`src/app/beratung/einladung/discovery-invitation-client.tsx:139-155`), takes its non-email_sent branch (`:157-183`), and forwards those props to InvitationForm. No mock implements class output.

The union preserves the donor's two literal assertions: coral background token anywhere in markup and no plum background token anywhere in markup. Keeper's original six assertions are unchanged: prefilled email input value/type, label, no readonly, no disabled, empty email input value/type, and CTA copy. Added assertions use the already-rendered `prefilled` string. No new input, render, fixture row, or call.

Actual CTA owner is InvitationForm `:269-270`; Button variant `funnelCta` resolves to coral at `src/components/ui/button.tsx:18-19`; its actual forwardRef renderer emits the merged classes at `:46-56`, with `cn` at `src/lib/utils.ts:4-5`. Installed class-variance-authority `dist/index.js:43-85` selects configured variant and appends className; clsx's actual implementation flattens these strings. Tailwind merge `dist/bundle-cjs.js:357-423` keys conflicts by modifier plus class group (`:403-415`), so the proposed `before:bg-[var(--brand-plum)]` does not replace unmodified coral. Thus the two proposed source faults target independently observable positive and negative string assertions:

1. Change the unique actual CTA's variant to `unstyled`: intended failure is `prefilled.includes("bg-[var(--brand-coral)]")`, with normal rendering and preceding field/label assertions successful.
2. Keep funnelCta and add the before:plum class: intended failure is `!prefilled.includes("bg-[var(--brand-plum)]")`, with coral positive assertion still successful. This proves rejection of the literal plum token, not the visibility or computed color of a pseudo-element.

The existing donor already asserts class substrings across the whole card rather than selecting the CTA. Neither donor nor keeper independently proves computed CSS, browser color, disabled-state styling, continuation CTA styling, or a particular variant identifier. Those are unchanged limitations, not newly lost coverage. History `928cc334` (#604) explicitly introduced coral invite/continuation CTA styling and this donor; `2a1f3add` (#606) introduced the editable-email keeper. The historical styling regression remains represented.

## C2 — ready content fade token

Donor `tests/discovery-invitation-card.test.tsx:108-111`; retained keeper's empty render `:71-75`. Both have empty email, ready mode, and identical omitted callbacks/errors. Names differ (`Lea` versus `Lea Sommer`); this is readset/semantic equivalence, not byte-identical inputs.

Card reads name only to forward it (`src/app/beratung/einladung/discovery-invitation-client.tsx:172-179`). InvitationForm's sole semantic name read is `name.trim().split(/\s+/)[0] || name` at `:228`, used in the heading at `:231`. Both supplied values produce Lea via the same truthy first-token path. Neither name controls style, mode, identity lookup, or animation. The wrapper uses CONTENT_FADE_IN independently at `:171`; the exact class string is defined at `:187-188`. Empty email does not introduce a conditional fade branch. No single-token-name-specific behavior was asserted by the donor.

The transfer carries the original regex unchanged onto the existing `empty` markup, after its original input and CTA assertions. Original keeper assertions remain byte-identical. No new renderer call/input/table row. The source fault replaces the unique CONTENT_FADE_IN literal with an empty string. Intended failure is the transferred assert.match on `empty`; field, CTA, and both prefilled color assertions should remain successful. This targets the real owner's emitted class, not a setup exception or a fake renderer.

The regex protects only presence of the motion-safe animation prefix through `var(--motion-screen)`. Neither old nor retained test establishes duration resolution, easing suffix, actual opacity change, browser reduced-motion behavior, or correct placement on the outer wrapper when another element happens to emit the same prefix. Those limits remain unchanged. History `feb9284c` (#614) added this donor alongside initial-card and loader-minimum contracts; `plans/discovery-b8-motion-days/plan.md:33-38,51` establishes screen/loader motion intent. Removing only this duplicate render does not discard the loader or continuation contracts.

## Retained contextual risks and F1

The eight other invitation callbacks remain byte-identical across all three snapshots: refusal with recovery hint, other refusal without hint, code-to-hint mapping, email_sent address/no-input branch, email validation, initial loading card markup, initial continuation markup, and loader-minimum callback. In particular, truthy-error/no-hint is a distinct branch (`client.tsx:263-267`) from the keeper's error-free ready form and is retained.

F1 at test `:173-217` is independently useful: real client/useDelayedLoader executes through the local hook dispatcher (`:125-170`) with fake timers and controlled fetch. It checks hidden text before 300ms, visible text at 300ms, holding the loading element after resolution at 400ms and at 799ms, and switching to DiscoveryInvitationCard at 800ms. Production owner holds on `resolving || loaderVisible` (`client.tsx:36-37,116`); `src/lib/motion-loader.ts:58-79,88-105` provides the remaining minimum, and `src/lib/motion.ts:17-19` supplies 300/500ms.

Its detector at test `:193-194` depends on the private function name `InvitationLoading`, so an identifier-only rename yields a false failure. Its handwritten hook dispatcher also is not full React scheduling/unmount proof. These findings support a separately scoped repair, not deletion or mutation credit in this proposal. Do not claim C2's SSR fade assertion proves minimum loading duration. No repair is included here.

## Actual boundary, entrypoints, CI, and dependency limits

Read the entire 217-line invitation test, all helper bodies, entire 346-line invitation owner, complete Button/cn, motion-loader/motion, continuation sibling, and both page entrypoints. Symbol search finds production Card use in InvitationClient (`:126-135`), with page import/render at `src/app/beratung/einladung/page.tsx:6,11-14`. The page's feature guard is supported production wiring; no deployed enabled-state inference or dead-feature argument is made. Continuation separately uses its own loader and failure CTA; it is not absorbed by the invitation keeper.

Tests import actual `react-dom/server`. The native preload only substitutes the server-only marker (`tests/server-only-register.cjs:7-10`), not rendering. Installed `react-dom/server.node.js:3-15` routes static rendering to the legacy server implementation; development source calls renderToStringImpl (`react-dom-server-legacy.node.development.js:9860-9866`), invokes components (`:5042-5074`), and serializes className as class (`:1108-1113`). Its render-to-string machinery (`:8352-8400`) accumulates emitted markup. Production entry `react-dom-server-legacy.node.production.js:6676-6682` uses the same static-render route. Dependency source inspection is structural evidence only; no renderer was executed and no dependency version was inferred from environment. No claim of browser hydration or effects follows from static markup.

CI includes `.test.tsx` through `package.json:49`; `.github/workflows/ci.yml:158` invokes test:node. No registration or source/support cleanup is necessary; all imports/helpers retain users.

## Static byte verification and required main controls

Companion `/tmp/test-audit-invitation35-independent-static.json` records:

- All 25 manifest guard hashes match current files; these hashes are freshness guards, not 25 human source reads.
- All three full snapshot hashes match their manifest. Live invitation file equals before snapshot.
- Replacing only the existing keeper body with its proposed augmented body reproduces transfer exactly. Removing only the two donor callbacks reproduces cut exactly, including all remaining helpers/imports/whitespace.
- Eight unrelated invitation callbacks remain unchanged. Raw renderToStaticMarkup call counts are 9 → 9 → 7; this is text counting, not an independent AST declaration recount.
- All three source-control anchors occur exactly once and their owner hashes match.

Main must refresh guards before writing; run baseline and transfer proof; execute each of the three source faults serially with the selected keeper; verify the named assertion goes red (not module/harness/setup failure); restore owner bytes exactly and recover selected green; then cut and run focused/campaign coverage gates. The advertised cohort 35 → 35 → 33 is manifest data, not a runtime result from this review. None of the three faults is claimed caught here. Conditional PASS becomes actionable only through those remaining gates under the main operator.
