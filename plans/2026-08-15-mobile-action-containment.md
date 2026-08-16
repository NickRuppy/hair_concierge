# Mobile action and image containment repair

## Outcome and source context

Repair the reported Stage 1 mobile footer so both actions fit at 320–430 px and clear the iPhone safe area, verify that the reported blank image is an absent preview rather than a cropped loaded image, and apply the same safe-area formula to the three affected Stage 3 fixed action docks.

Evidence:

- At 375 px, the current Stage 1 primary CTA measures `x=92..443`, 68 px outside the viewport, while the existing browser test passes.
- The button cva base supplies `whitespace-nowrap`, `funnelCta` supplies `w-full`, and the Stage 1 row also contains `Zur Basis`; flex `min-width:auto` therefore prevents the CTA from shrinking. Call-site `flex-1` establishes a zero flex basis and `whitespace-normal` overrides the base through `twMerge` without changing the global variant.
- The screenshot's image tile has `data-plan-start-card-preview="absent"`. The unauthenticated lab preview request receives a proxy-owned `307` to `/quiz`; a successfully loaded image uses `object-contain`.
- The only other Personal Plan fixed docks missing safe-area padding are `product-fit-comparison.tsx` and the revision/inventory docks in `stage3-products-flow.tsx`.

## Chosen direction

At the Stage 1 call site, override the shared button defaults with `min-w-0 w-full whitespace-normal`. The separately approved navigation plan moves Back to the shared header, leaving this dock forward-only. Replace Stage 1 `py-2.5` with `pt-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))]`, following `chapter-transition.tsx`. Replace each affected Stage 3 `py-3` with `pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]`; do not leave conflicting `py-*` classes. Keep the four dock layouts separate because their composition and desktop positioning differ. Browser regression evidence subsequently reproduced the reported crop: the intrinsic image element exceeded its reserved slot despite `object-fit: contain`, so the fix now uses a fill-positioned image with contained painting and internal padding.

## Scope and non-goals

In scope:

- Stage 1 footer width, wrapping, safe-area padding, and measured content clearance.
- Stage 3 product-comparison, Idealplan-revision, and inventory-disposition safe-area padding plus measured reserves.
- Chromium runtime geometry at 320/375/390 px, a Chromium CDP 34 px safe-area inset, and a local development-server WebKit width/placement check. Headless WebKit's iPhone 13 profile computes the inset as `0px` here, so it is not claimed as non-zero safe-area evidence.
- Loaded and absent preview evidence.

Non-goals:

- No Back-navigation relocation; that is owned by the separate cross-stage navigation plan.
- No copy, route, authority, authentication, preview API, recommendation, persistence, desktop layout, or global button-variant changes.
- No migration, deployment, production write, publication, or cleanup.

## Target map

- `src/components/personal-plan-start/need-plan-screen.tsx`
- `src/components/personal-plan-products/product-fit-comparison.tsx`
- `src/components/personal-plan-products/stage3-products-flow.tsx`
- `tests/personal-plan-start.spec.ts`
- `tests/personal-plan-mobile-action.spec.ts`
- `tests/personal-plan-stage3.spec.ts`
- `tests/personal-plan-stage3-components.test.tsx`
- `tests/personal-plan-product-fit-comparison.test.tsx`

## Designed user journey

1. A customer opens the Optional Idealplan page on a 320–430 px mobile viewport.
2. A loaded example product remains fully visible inside its reserved tile and is labeled `Beispiel`; without an authoritative preview, the neutral reserved tile remains empty.
3. `Zur Basis` remains usable in the shared 48 px top-left header control, and the long primary CTA uses the full forward-only dock width without crossing either viewport edge.
4. The complete footer sits above the home-indicator safe area, and scrolling can reveal all page content and retry copy above it.
5. The same safe-area clearance holds for the three affected Stage 3 fixed decisions. Their actions, loading, retry, persistence, and desktop containment remain unchanged.

Evidence review and journey sign-off: **confirmed by Nick on 2026-08-15**.

## Planning evidence

- [Current/proposed mobile containment](./artifacts/2026-08-15-mobile-action-containment-review.html)
- Selected direction: wrapping constrained CTA, explicit safe-area padding, and unchanged contained-image behavior.
- Evidence status: **confirmed**.

## Ordered tasks

1. **Create the red-capable Stage 1 regression.** Keep the primary Chromium geometry and CDP test in `personal-plan-start.spec.ts`, targeting the existing `navigation[aria-label="Idealplan-Seiten"]`; preserve its current portal contract (`parent=BODY`, fixed bottom equals viewport bottom). Add CTA left/right bounds and both footer paddings at 320/375/390 px. Add a separate 320 px error-state scroll-end assertion that the final alert/content bottom is at or above the dock top. For the Chromium-only safe-area test, first apply `Emulation.setSafeAreaInsetsOverride({ insets: { bottom: 34 } })` to a probe element styled with `padding-bottom:env(safe-area-inset-bottom)` and assert the computed value is 34 px; if the pinned browser reports the method unsupported or the probe remains zero, explicitly skip only this safe-area subtest with the unsupported reason. Otherwise assert the repaired nav padding grows from its 10 px visual pad to 44 px, then reset the override. Modify the existing empty SVG fixture body to a visibly non-empty tall product; use `data-plan-start-card-image-slot`, natural dimensions, computed `object-fit: contain`, and element-within-slot bounds, with screenshot review for painted letterboxing. Completion: current code fails the CTA bound/safe-area checks and loaded versus absent image states are unambiguous.
2. **Repair Stage 1 at its owning call site.** Use the exact wrapping precedent on the forward-only primary action (`h-auto min-h-14 min-w-0 w-full whitespace-normal px-5 py-3 text-center leading-tight`) plus the literal Stage 1 safe-area classes above. Render preview images as fill-positioned, internally padded, contained images so the element itself cannot exceed the reserved slot. The 320 px error-state regression reproduced 5.125 px of content overlap, so the smallest practical reserve raises `main` from 96 px to 104 px; with `.personal-plan-cookie-clearance` (32 px + inset), clearance is 136 px + inset. Completion: Task 1 is green and the Stage 1 handoff remains unchanged.
3. **Repair and guard the three Stage 3 docks.** Apply the literal Stage 3 safe-area classes above without normalizing their intentionally different desktop positioning. Use real browser geometry for `product-fit-comparison.tsx` and focused class/source invariants for the unreachable revision (`stage3-products-flow.tsx` first dock) and inventory (second dock), explicitly recognizing that the latter is weaker than browser geometry. Preserve current reserve math: comparison `pb-40` + shell 32 px/inset; revision `pb-32` + shell 32 px/inset (about 16 px margin for its two single-line actions at 320 px); inventory `pb-28` + shell 32 px/inset. Change reserves only if measured dock height exceeds the corresponding combined reserve. Completion: all three mobile docks carry the formula, the reachable dock clears it geometrically, the existing comparison desktop `x=40/width=1360` assertion stays green, and decision tests remain unchanged.
4. **Verify the complete repair.** Run focused suites, both mobile browser engines through the concrete runners below, `npm run ci:verify`, then have the Codex main session invoke `.agents/skills/ready-check/SKILL.md` as required by the repository workflow. Capture 320×700, 375×667, and 390×844 evidence and classify all task artifacts. Completion: the original reproduction is green with no overflow or covered content.

## Verification

Automated:

- Focused Node tests for Stage 1/Stage 3 components and product comparison.
- Chromium Stage 1 journey through `npm run test:playwright:personal-plan-stage3:journey`.
- Add one Stage 1 lab test to `personal-plan-mobile-action.spec.ts`, guarded with `test.skip(process.env.CI_PERSONAL_PLAN_STAGE3_LAB_ENABLED !== "true")`, targeting the existing Idealplan nav directly rather than the quiz-only `visibleActionGeometry` helper. It asserts one visible fixed nav, CTA horizontal bounds, and visual-viewport bottom. Local WebKit development runner:
  `WAIT_ON_TIMEOUT=60000 PLAYWRIGHT_BASE_URL=http://127.0.0.1:3217 npx start-server-and-test 'NODE_ENV=development CI=true CI_PERSONAL_PLAN_STAGE3_LAB_ENABLED=true npm run dev -- --hostname 127.0.0.1 --port 3217' http://127.0.0.1:3217 'CI_PERSONAL_PLAN_STAGE3_LAB_ENABLED=true PLAYWRIGHT_BASE_URL=http://127.0.0.1:3217 npx playwright test tests/personal-plan-mobile-action.spec.ts --project=webkit-mobile-action --grep "Optional Idealplan"'`.
- `npm run ci:verify`.

Manual/browser:

- Inspect short/standard mobile heights, 34 px safe-area emulation in Chromium, tall loaded preview, absent preview, retry copy, and all four affected docks.
- WebKit is a local width/placement gate for this repair; adding a permanent CI WebKit job is out of scope. It does not prove a non-zero inset in this environment.
- The authenticated source path passes the proxy and reaches the preview API; the observed `307 → /quiz` is specific to the unauthenticated lab probe. No production image/API change is authorized.
- Four-site safe-area formula duplication is accepted for this repair because the dock layouts/desktop modes differ. A shared utility is deferred unless later drift appears.
- Chromium CDP emulation is the automated non-zero-inset oracle. No real iOS device capture is claimed.
- The image fixture/evidence stays in scope because the user explicitly asked whether the image remained cut off; it closes that symptom without changing production image behavior.
- The local-only WebKit run stays as a Safari-engine line-breaking/placement check despite the zero inset and absent CI job; it remains untagged and runs only through the explicit command above.
- A wrapped Stage 1 CTA at 320 px is accepted for the standalone repair. The separately approved navigation plan subsequently moves Back to the header and leaves the CTA full-width.

## Review and handoff

- Worktree/branch: `.worktrees/mobile-action-containment`, `codex/mobile-action-containment` from current `origin/main`.
- Counterpart review: completed with Claude Opus/high on 2026-08-15. Accepted corrections are incorporated: literal non-conflicting safe-area classes, a CDP support probe/isolated skip, the 320 px error-state reserve check, and the exact `.agents/skills/ready-check/SKILL.md` invocation. The review's claim that `ready-check` does not exist was a false positive against the repository-owned skill path.
- Final code review: Claude Opus/high on 2026-08-16 caught an over-broad file-level WebKit skip; the gate is now local to the lab test and the documented runner exports the gate to Playwright itself. The added 320 px retry-state browser assertion confirms the last Optional card clears the taller error dock at scroll end.
- Stop: verified review-ready worktree; no commit, push, PR, merge, deploy, production write, or cleanup.
- Artifacts: plan, HTML evidence, and regression coverage commit; ignored PNG and transient counterpart output discard after review.
