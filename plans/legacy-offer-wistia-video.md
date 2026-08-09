# Legacy offer Wistia video

## Outcome and source context

The legacy `/quiz` result offer adds the co-founder-supplied Wistia video directly in the hero without changing the newer Personal Plan offer. Nick reviewed the rendered 390 px proposal on 2026-08-09 and explicitly approved implementation with “okok do it.” The supplied media ID is `hofntlzjgj` with a 16:9 aspect ratio.

## Chosen direction

Keep the existing eyebrow, headline, and personalized hair-profile line. Add the natural German prompt “Schau dir zuerst das Video an:” below the profile line, then render Wistia’s responsive standard web-component embed in a rounded, maximum-720 px container. Load `https://fast.wistia.com/player.js` and the `type="module"` media script `https://fast.wistia.com/embed/hofntlzjgj.js` through Next.js script management. Render `<wistia-player>` through `React.createElement()` so no ambient JSX augmentation is required, explicitly set `autoplay="false"` and `silent-autoplay="false"` to override the media account’s autoplay setting, reserve the full 16:9 space with a CSS-only non-`<img>` swatch before the player upgrades, and keep the rest of the offer usable if the third-party player fails.

The stored legacy offer identity remains `organic-plan-v1`; the presentation revision becomes `organic_plan_v2` so before/after conversion evidence is not mixed.

## Scope and non-goals

In scope:

- Legacy organic offer hero copy and player placement.
- One isolated reusable component for media ID `hofntlzjgj`.
- Exact observed Wistia origins in the report-only Content Security Policy: `https://fast.wistia.com`, `https://fast.wistia.net`, `https://embed-cloudfront.wistia.com`, `https://embed-ssl.wistia.com`, `https://distillery.wistia.com`, and `https://pipedream.wistia.com` in only the directives that use them.
- Regression tests for copy, embed identity, responsive placeholder contract, revision, and CSP.
- Rendered checks at 320 px, 390 px, and desktop, including a blocked-script state.

Non-goals:

- No changes to the Personal Plan quiz or offer.
- No checkout, pricing, section order, CTA, or first-party analytics changes.
- No autoplay, watch gating, or requirement to finish the 4:11 video. The account-level autoplay discovered during planning is explicitly overridden in the embed.
- No Wistia account, media metadata, privacy-mode, domain-allowlist, or dashboard changes because Nick does not have account access. The supplied embed is loaded directly as authorized.
- No cookie-banner or legal-policy redesign in this slice. Nick explicitly authorized loading the supplied Wistia embed directly despite lacking Wistia account access; default pre-consent Wistia viewer tracking remains a disclosed residual compliance risk for owner follow-up.

## Target map

- `src/components/organic-plan-offer/organic-plan-offer.tsx`: prompt placement and offer revision.
- `src/components/organic-plan-offer/wistia-video.tsx`: managed scripts, responsive web component, loading reservation, and failure fallback.
- `next.config.ts`: exact Wistia CSP origins.
- `tests/organic-funnel-surface.test.tsx`: user-visible copy and embed regression guard.
- `tests/offer-tracking-contract.test.ts`: presentation revision update while preserving stored offer identity.
- `tests/wistia-csp.test.ts`: origin-specific CSP guard.
- `plans/mockups/legacy-offer-wistia-mobile.jpg`: reviewed proposed-state evidence.

## Designed user journey

1. A visitor completes the legacy quiz and enters the existing result offer.
2. The sticky Chaarlie header and “Angebot ansehen” shortcut behave exactly as before.
3. The visitor sees “Deine Analyse ist bereit,” “Dein Haarplan ist bereit.”, and the personalized profile line.
4. The new prompt says “Schau dir zuerst das Video an:” and the 16:9 video appears immediately below it.
5. The player does not autoplay, even though the remote media is currently configured to do so. The visitor may play, pause, seek, use captions/fullscreen, or ignore the video and continue scrolling or use the sticky pricing shortcut.
6. While Wistia loads, the supplied swatch reserves the player dimensions so the diagnosis section does not jump.
7. If Wistia is blocked or unavailable, the video region reports that it could not load while the diagnosis, pricing, and all existing offer actions remain usable.
8. On mobile the player fills the content width without horizontal overflow; on desktop it stops growing at 720 px.
9. The visitor continues into the unchanged “Deine Ausgangslage” section and the remainder of the legacy offer.

User-journey sign-off: **confirmed 2026-08-09**. The approval followed review of the real 390 px current and proposed states; the incorporated correction is the natural prompt “Schau dir zuerst das Video an:”.

## Planning evidence

- `plans/mockups/legacy-offer-wistia-mobile.jpg` shows the implemented media in the real legacy offer hero at 390 px.
- Question answered: does a 16:9 video fit between the personalized hero copy and diagnosis without overflow or obscuring the sticky shortcut?
- Finding: yes. The implemented player is 282×159 at 320 px, 352×198 at 390 px, and 720×405 on desktop, without horizontal overflow.
- Selected direction: personalized line retained, natural prompt added, video directly underneath.
- Evidence review status: **confirmed 2026-08-09**.

Test-first proof: before implementation, the focused command failed three guards for the missing `organic_plan_v2` revision, prompt/embed markup, and Wistia CSP origins. After implementation the same command passed 10/10 tests. Live verification additionally confirmed `autoplay=false`, `silentAutoplay=false`, `state="beforeplay"`, and `currentTime=0`; aborting both Wistia scripts produced the German reload fallback while diagnosis and `#pricing` remained available.

## Ordered tasks

1. Add failing component/CSP regression guards.
   - Consumes: approved prompt, media ID, aspect ratio, script URLs, and report-only CSP policy.
   - Produces: focused tests that fail because the prompt/embed/origins are absent.
   - Complete when the focused command fails for the missing production behavior rather than environment or fixture errors.
2. Add the isolated Wistia player and legacy hero placement.
   - Consumes: task 1 guards and Wistia’s supplied standard embed contract.
   - Produces: responsive direct embed, reserved loading layout, non-blocking failure state, and `organic_plan_v2` revision.
   - Complete when focused rendering tests pass and the Personal Plan source is unchanged.
3. Add the exact CSP allowances required by the observed Wistia network requests.
   - Consumes: browser request evidence from the supplied player.
   - Produces: origin-scoped script, image, font, and connection allowances plus a new `media-src` directive without wildcard Wistia access.
   - Complete when the CSP guard passes and the rendered player produces no CSP reports for the enumerated observed origins. Report-only noise from unobserved future Wistia delivery hosts is not a functional blocker.
4. Verify the full task tree and rendered journey.
   - Consumes: tasks 1–3.
   - Produces: ready-check and code-review receipts for one identical content fingerprint.
   - Complete when focused tests, type/lint checks, 320/390/desktop browser checks, blocked-script fallback, and repository review have no blocking findings.

## Verification

Automated:

- Run the focused organic-offer and Wistia CSP tests. The rendered offer asserts the prompt and `<wistia-player>` identity; the organic test reads the isolated component source to guard the two `next/script` URLs because `afterInteractive` scripts do not render in bare server markup.
- Run the offer-tracking contract test that owns the presentation revision.
- Run the repository typecheck and scoped lint for changed TypeScript/TSX.
- Run `ready-check` on the final worktree.

Manual/browser:

- With the offer-page lab enabled, open `/labs/offer-page?variant=organic-plan-v1` at 320×800, 390×844, and desktop.
- Confirm exact copy, personalized line, poster/player, no autoplay, 16:9 geometry, 720 px cap, no horizontal overflow, unchanged sticky shortcut, and unchanged diagnosis transition.
- Abort Wistia script requests and confirm the error region appears while the rest of the offer remains navigable.
- Inspect console errors and Wistia network/CSP evidence.

## Counterpart findings ledger

| ID | Type | Evidence | Decision | Plan change | Revalidation |
| --- | --- | --- | --- | --- | --- |
| C1 | defect | `tests/offer-tracking-contract.test.ts` hard-codes `organic_plan_v1` | accepted | Added the test to target map and verification for the `organic_plan_v2` bump | Focused test plus ready-check |
| C2 | defect | No repository JSX custom-element declaration exists | accepted | Pinned `React.createElement("wistia-player", ...)` | Typecheck |
| C3 | defect | Organic surface test rejects server-rendered `<img>` elements | accepted | Pinned CSS-only swatch reservation | Organic surface test |
| C4 | defect | CSP has no existing `media-src` directive | accepted | Pinned a net-new `media-src` directive | Wistia CSP test and browser console |
| C5 | tradeoff | Revision bump changes downstream analytics dimension | accepted | Nick approved the earlier review recommendation; retain offer variant and bump presentation revision only | Offer tracking contract |
| C6 | tradeoff | Exact origins may need maintenance if Wistia changes delivery hosts | accepted | Enumerated origins observed from the supplied embed instead of a wildcard | Browser request/console audit |
| C7 | tradeoff | Direct embed sends viewer events before site cookie consent | accepted for this slice | Recorded explicit authorization and residual owner follow-up | Handoff risk receipt |
| C8 | defect | Supplied media account silently enables autoplay | accepted and verified | Explicitly override `autoplay` and `silent-autoplay` to false | Live custom-element check returned `autoplayProperty=false`, `silentAutoplayProperty=false`, `state="beforeplay"`, and `currentTime=0`; no play event was emitted |

Counterpart recheck resolution: the only remaining blocker was whether the Wistia custom element parses the explicit string value `"false"`. Live verification against media `hofntlzjgj` confirmed that it does. The reviewer’s CSP zero-report criterion concern was accepted by narrowing the done-criterion to enumerated observed origins. No blocking plan finding remains.

Live-state checks:

- None authorized. The Wistia media URL was reachable during planning, but no Wistia account or production deployment change is in scope.

## Review and handoff

- Branch: `codex/legacy-offer-wistia` in `.worktrees/legacy-offer-wistia`, based on fresh `origin/main`.
- Review gates: one read-only Claude plan review, then `ready-check` and `request-code-review` on the final tree.
- Stop before commit, push, PR, deployment, Wistia account changes, or production writes.
- Artifacts: plan and reviewed screenshot are commit-intended; transient Claude reports and browser screenshots are discarded unless needed as review evidence.
- Residual risk: without Wistia account access, privacy mode, domain restrictions, customer-facing media metadata, and account-level analytics configuration cannot be verified or changed.
