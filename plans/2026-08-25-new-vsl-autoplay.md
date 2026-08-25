# New legacy-offer VSL with muted autoplay

## Outcome and source context

Replace the legacy quiz result offer's current Wistia media `hofntlzjgj` with the co-founder-supplied media `nwrpfub965`. The new VSL starts automatically without sound and exposes Wistia's native click-for-sound action. The rest of the offer remains scrollable and usable whether autoplay succeeds, is blocked, or Wistia fails to load.

Source requirements supplied on 2026-08-25:

- new Wistia media ID: `nwrpfub965`
- aspect ratio: `1.7777777777777777` (16:9)
- autoplay is required
- autoplay must use a click-for-sound recovery because browsers generally block autoplay with sound
- Wistia also supplied an optional transcript-bearing “LLM-friendly” embed

Relevant external contracts:

- [Wistia player attributes](https://docs.wistia.com/docs/player-attributes-and-properties): `autoplay` starts playback; `silent-autoplay="true"` defaults to silent autoplay; setting `muted` directly suppresses the click-for-sound affordance.
- [Wistia LLM embeds](https://docs.wistia.com/docs/use-wistia-llm-embeds-for-seo-ai-visibility): the transcript is a static snapshot and must be recopied after transcript corrections.

## Chosen direction

Keep the existing isolated `WistiaVideo` component and offer placement. Change only its media identity and playback contract:

- `media-id="nwrpfub965"`
- `autoplay="true"`
- `silent-autoplay="true"`
- `preload="auto"`, matching Wistia's documented behavior that every autoplay player preloads media automatically
- do not set `muted`; Wistia uses silent-playback mode to present its native click-for-sound button
- keep the existing aspect ratio, responsive container, swatch placeholder, managed scripts, 12-second load-failure fallback, and non-blocking page behavior

Use the standard Wistia player markup, not the supplied transcript-bearing LLM embed. The real result route is explicitly `noindex, nofollow`, `/result/` is disallowed in `robots.txt`, and the offer contains personalized result data. Injecting a static crawler transcript has no intended discovery benefit on this surface, adds approximately 5.6k characters to the initial HTML/client payload, can flash before player upgrade, and would currently publish known transcription errors.

The new media's current Wistia customization already has `autoPlay=true`, `silentAutoPlay=true`, `muted=false`, and `clickForSound` enabled. The site still pins autoplay and silent-autoplay in markup so those two product requirements do not drift with the Wistia dashboard. The native click-for-sound control remains media-owned and must be live-verified before release.

Retain the stored offer arm `organic-plan-v1` and bump the presentation revision from `organic_plan_v2` to `organic_plan_v3`. `OfferTrackingProvider` passes this revision into raw PostHog event properties; no organic-offer dashboard currently consumes it. The bump therefore enables an ad-hoc revision-filtered conversion query but does not create a dashboard by itself. Because this is a sequential replacement rather than randomized assignment, before/after conversion movement is directional evidence, not a causal A/B result.

Do not compare old and new Wistia play rate: old plays represented intentional starts, while new plays include autoplay impressions. Use the new media's own watch-depth/engagement curve for operational diagnosis and the raw offer revision for directional conversion analysis. Do not claim old-versus-new watch lift without a common page-visitor denominator and a controlled design.

## Scope and non-goals

In scope:

- legacy organic result offer and its regular field-test presentation, which share `WistiaVideo`
- new media ID and autoplay/silent-autoplay markup
- native Wistia click-for-sound behavior
- offer presentation revision `organic_plan_v3`
- corrected German captions on Wistia media `nwrpfub965` as an external release prerequisite
- focused render, CSP, failure, and real-browser verification

Constraints:

- preserve the existing hero hierarchy, German prompt, 16:9 dimensions, 720 px desktop cap, rounded treatment, swatch, and error recovery
- preserve access to diagnosis, pricing/free field-test activation, and all downstream offer actions; video completion is never a gate
- do not load a second player or retain the old media as a hidden fallback
- do not set the plain `muted` option, which would remove the click-for-sound affordance
- pin `preload="auto"`; autoplay intentionally transfers media as soon as the player is allowed to run
- autoplay with sound is not promised; autoplay should start silently wherever the browser allows it and fall back to ordinary player controls otherwise
- do not modify or overwrite user-owned dirty-root files

Non-goals:

- no A/B assignment or new video experiment infrastructure
- no first-party watch-progress analytics or Wistia account analytics changes
- no change to the live newer Personal Plan result surface, which renders `PersonalPlanOffer` directly; the registered `personal-plan-v1` generic fallback delegates to the organic offer and therefore inherits this VSL if that dormant fallback is ever rendered
- no hero copy, pricing, checkout, CTA, section-order, guarantee, or testimonial changes
- no watch gating, forced completion, looping, or custom sound-overlay implementation
- no LLM transcript injection, public SEO surface, or crawler-policy change
- preserve the current direct-embed architecture and start autoplay without a consent gate; Nick explicitly accepted the increased pre-consent media/analytics and bandwidth risk for this release on 2026-08-25
- no caption file is stored or served by the repository; the corrected track is owned by Wistia media `nwrpfub965` and was published there as the external release prerequisite

## Target map

- `src/components/organic-plan-offer/wistia-video.tsx`
  - replace the media ID
  - change the explicit player attributes to autoplay plus silent autoplay and pin `preload="auto"`
  - retain scripts, placeholder, aspect ratio, and fallback behavior
- `src/components/organic-plan-offer/organic-plan-offer.tsx`
  - bump `ORGANIC_PLAN_OFFER_REVISION` to `organic_plan_v3`
- `tests/organic-funnel-surface.test.tsx`
  - guard the new media identity, autoplay contract, `preload="auto"`, absence of plain `muted`, and unchanged offer hierarchy
- `tests/offer-tracking-contract.test.ts`
  - guard the new presentation revision while preserving the stored offer arm
- `tests/wistia-csp.test.ts`
  - rerun unchanged; the new media used the same Wistia origins as the old media in prototype traffic
- `plans/evidence/new-vsl-autoplay/prototype.html`
  - commit-intended runnable planning evidence only; it must not be promoted into production
- `plans/evidence/new-vsl-autoplay/mobile.png` and `desktop.png`
  - commit-intended rendered evidence from the real media

No change is expected in `next.config.ts`: six seconds of playback for both old and new media produced the same Wistia origin set (`fast.wistia.com`, `fast.wistia.net`, `embed-cloudfront.wistia.com`, `distillery.wistia.com`, and `pipedream.wistia.com`), all already covered by the existing report-only CSP contract.

## Designed user journey

1. A visitor completes the legacy quiz and enters the existing result offer. The same behavior applies when an authorized regular field tester enters the field-test version of that offer.
2. The visitor sees the unchanged result eyebrow, personalized hair-profile line, prompt “Schau dir zuerst das Video an:”, and the new 16:9 VSL in the same position.
3. When browser policy allows muted autoplay, the new VSL begins playing immediately without sound. Corrected German captions are visible during silent playback. Wistia loads directly, matching the existing integration; there is no pre-player consent step.
4. Wistia shows its native speaker button in the player. Its accessible German name is the Wistia-owned formal-register string “Klicken Sie hier, um den Ton einzuschalten.” The visible control is an icon. This native localization is accepted instead of adding a custom du-form overlay. When the visitor activates it, playback restarts at the beginning with sound so the opening is not lost.
5. The visitor can pause, scrub, use the available chapters/controls, ignore the video, use the sticky offer shortcut, or continue scrolling. No watch state gates diagnosis, pricing, free field-test activation, or checkout.
6. If a browser blocks autoplay entirely, the Wistia player remains in its normal playable state; the visitor can start it manually.
7. While the player upgrades, the current blurred swatch reserves the full 16:9 region without layout shift.
8. If Wistia scripts fail or are blocked, the existing German load-failure state appears after the bounded timeout with “Seite neu laden.” The rest of the offer stays available.
9. On mobile, the player fills the content width without horizontal overflow. On desktop, it stops at 720 px. The visitor proceeds into the unchanged “Deine Ausgangslage” section and the rest of the offer.

User-journey sign-off: **confirmed 2026-08-25**. Nick approved direct autoplay and the proposed journey after inspecting the real-media prototype.

## Planning evidence

Artifact: [`plans/evidence/new-vsl-autoplay/prototype.html`](evidence/new-vsl-autoplay/prototype.html)

- Question: does real media `nwrpfub965` enter muted autoplay and expose Wistia's native sound action without changing the existing offer hierarchy?
- Decision criterion: playback starts muted; a visible, usable, accessible sound action is present; the player stays within 16:9 bounds; no horizontal overflow or console error appears; clicking for sound restores audio without losing the opening.
- Attribute-only prototype contract: no `window.wistiaOptions`; `autoplay="true"`, `silent-autoplay="true"`, `preload="auto"`, aspect, and aria label match the planned production element.
- Observation at 390×844: `autoplay=true`, `silentAutoplay=true`, `preload="auto"`, `muted=true`, `paused=false`, current time advanced; player 356×200.25; page width remained 390; no console errors.
- Observation at 1440×1100: the same playback state; player 720×405; no overflow or console errors.
- Sound-action observation: Wistia rendered `.click-for-sound-btn` with accessible name “Klicken Sie hier, um den Ton einzuschalten.” Clicking it changed `muted` from `true` to `false`, kept playback active, and restarted near 0:00.
- Selected direction: reuse Wistia's native sound control; do not create a custom overlay.
- Disposition: retain the HTML and screenshots as planning evidence; rewrite the selected behavior in the production component and verify it independently.
- Rendered evidence: [`mobile.png`](evidence/new-vsl-autoplay/mobile.png) and [`desktop.png`](evidence/new-vsl-autoplay/desktop.png).
- Evidence-review status: **confirmed 2026-08-25**. Nick said the rendered proposal “looks good” and approved implementation as shown.

Caption release gate — **satisfied 2026-08-25**:

- The original German track's 130 cues were audited end to end and corrected without changing cue count or timestamps. Corrections include the Chaarlie brand name, “Frizz,” “fettiger Kopfhaut,” “Leave-in,” the product sequence, malformed routine/guarantee sentences, and the refund wording.
- The corrected VTT was uploaded in the authenticated Chaarlie Wistia account. Wistia detected it as `German [replace]`, accepted the save, closed the upload dialog, and rendered the corrected text in the media transcript.
- The public production caption endpoint `https://fast.wistia.net/embed/captions/nwrpfub965.vtt?language=ger` was refetched after publication. It serves all 130 cues and matches the audited replacement VTT except for the final newline; the tracked mistranscriptions are absent.
- Because the replacement preserved every existing timestamp, verification covered the complete published cue track plus its in-player transcript rendering rather than introducing a repository transcript or changing timing.

## Ordered tasks

1. **Pin the new player and revision contracts with failing tests.**
   - Consumes: selected media ID, native autoplay behavior, `preload="auto"`, and `organic_plan_v3`.
   - Produces: focused assertions that fail against the old media/paused-player implementation.
   - Change `tests/organic-funnel-surface.test.tsx` to require `nwrpfub965`, `autoplay="true"`, `silent-autoplay="true"`, `preload="auto"`, and no `muted` player option. Preserve the current exact section order and single Wistia player assertion.
   - Change `tests/offer-tracking-contract.test.ts` to require `organic_plan_v3`.
   - Complete when the focused command fails only for the old media/playback/revision behavior.

2. **Replace the production VSL and enable native muted autoplay.**
   - Consumes: task 1 guards and the existing `WistiaVideo` component boundary.
   - Produces: media `nwrpfub965`, explicit autoplay/silent-autoplay, retained native click-for-sound behavior, and presentation revision `organic_plan_v3`.
   - Update only the media ID and playback attributes in `wistia-video.tsx`; set `preload` to `auto` and retain error state, style selector interpolation, script management, aspect ratio, and placeholder.
   - Bump the revision in `organic-plan-offer.tsx`; do not change the stored `organic-plan-v1` offer identity.
   - Complete when the focused render/tracking tests pass and source inspection shows no duplicate embed, static transcript, custom sound overlay, or live Personal Plan route change.

3. **Verify real playback and fallback on the production component.**
   - Consumes: task 2 production tree.
   - Produces: browser evidence for playback, sound recovery, responsive geometry, failure recovery, and offscreen behavior on the exact production component.
   - Verify 390 px and desktop offer-lab states, plus a narrow 320 px containment check.
   - Confirm current time advances muted, the native sound button is visible and accessibly named, activation unmutes and restarts near 0:00, and autoplay-blocked/manual-play behavior leaves the page usable.
   - Scroll directly to a section below the hero and record the player's offscreen behavior. Do not add custom pause/resume logic to this bounded media replacement; continued offscreen playback is part of the owner-accepted direct-autoplay bandwidth tradeoff.
   - Abort both Wistia scripts and confirm the bounded German reload fallback while diagnosis and pricing/free activation remain reachable.
   - Compare network origins against the existing CSP allowlist and rerun `tests/wistia-csp.test.ts`; change CSP only if a required new origin is directly observed.
   - Run Chromium plus WebKit. Add one physical iOS Safari check in normal mode and Low Power Mode when a device is available; muted-autoplay blocking in Low Power/Data Saver is an accepted fallback state, not a broken page.
   - Complete when repo-verifiable checks pass on the same content fingerprint. This task can complete while the separate caption release gate remains pending.

4. **Satisfy the external caption release gate.**
   - Consumes: corrected German captions published by the owner of Wistia media `nwrpfub965`.
   - Produces: external release evidence; it does not change repository code.
   - Refetch `https://fast.wistia.com/embed/nwrpfub965.js`, confirm corrected caption content, and watch all 4:28 with captions enabled.
   - Complete when known mistranscriptions are absent and the complete published cue track has been verified through Wistia. **Completed 2026-08-25:** the authenticated transcript and public 130-cue VTT both expose the corrected track, whose timestamps were preserved.

## Verification

Automated:

- `node --import ./tests/server-only-register.cjs --import tsx --test tests/organic-funnel-surface.test.tsx tests/offer-tracking-contract.test.ts tests/wistia-csp.test.ts`
- `npm run ci:verify`
- `ready-check` through `implementation-loop` on the final tree

Manual/browser:

- `/labs/offer-page?variant=organic-plan` and `?variant=organic-plan-v1` at 320×800, 390×844, and desktop
- standard and `scenario=field-test` presentations
- muted autoplay success, native click-for-sound, audio recovery/restart, manual-play fallback, pause/scrub, and downstream scrolling
- complete corrected-caption cue-track audit plus authenticated and public Wistia verification
- blocked `player.js` and media-script fallback
- Chromium, WebKit, and a physical iOS Safari normal/Low-Power pass when available
- direct scroll below the hero to record offscreen playback behavior
- console, request-origin, CSP-report, overflow, and layout-shift inspection

Live/external state:

- Nick separately authorized the Wistia caption replacement on 2026-08-25. The corrected German track is published and verified at the public caption endpoint; no caption artifact is served by this repository.
- No deployment, dashboard mutation, or other production write is part of implementation.
- Before release, verify media `nwrpfub965` remains public/reachable and its click-for-sound customization remains active.

Evidence-sensitive review:

- Treat before/after conversion metrics as directional because rollout is not randomized.
- Do not compare old/new Wistia play rate because autoplay changes a play from intentional-start evidence into impression-like evidence. Do not claim a 2–3× lift without a common visitor denominator and post-release evidence.
- Record direct autoplay as an explicit owner-accepted privacy/bandwidth tradeoff; it is not evidence that Wistia is legally exempt from consent requirements.
- Post-deploy, inspect report-only CSP telemetry once because autoplay exercises `media-src` at higher volume.

Implementation browser evidence on 2026-08-25:

- Chromium at 320×800, 390×844, and 1440×1000, plus WebKit at 390×844, loaded media `nwrpfub965` with `autoplay=true`, `silentAutoplay=true`, `preload="auto"`, no plain `muted` attribute, muted active playback, and advancing current time.
- Wistia's native sound action was present with the expected German accessible name; activating it unmuted the player, kept playback active, and restarted near 0:00.
- Both `organic-plan-v1` and `organic-plan` aliases were exercised, including the regular field-test presentation. The player remained 16:9, respected the 720 px desktop cap, and introduced no horizontal overflow or page errors.
- After scrolling to pricing, playback continued. This is consistent with the chosen direct-autoplay integration and is retained as an explicit bandwidth residual rather than expanding scope with custom viewport pausing.
- With both Wistia scripts aborted, the existing bounded German reload fallback appeared and the diagnosis and pricing sections remained present.
- Physical iOS Safari normal/Low Power checks were not available in the local environment and remain a release-device check.

## Review and handoff

- Branch/worktree: `codex/new-vsl-autoplay-plan` in `.worktrees/new-vsl-autoplay-plan`, based on fresh `origin/main`.
- Planning gates: prototype evidence review, one read-only Claude plan review, findings reconciliation, and explicit designed-user-journey sign-off.
- Implementation gate: `implementation-loop` is authorized after the direct-autoplay decision, plan, evidence, and journey were confirmed on 2026-08-25.
- Release gate: corrected Wistia captions for media `nwrpfub965` were published and verified on 2026-08-25; this gate is closed.
- Stop before deployment, merge, cleanup, or any further Wistia mutation. Nick separately authorized commit, push, and draft PR publication with “Ship” and confirmed the caption replacement.
- Rollback posture: no feature flag for this bounded player change. If playback, captions, page performance, or conversion evidence is materially worse, revert the exact VSL media/playback/revision commit and redeploy; do not mutate Wistia to make repository history lie. Perform an immediate post-deploy smoke check and a seven-day directional `offer_revision` comparison, with owner judgment rather than a fabricated low-traffic threshold.
- Artifact disposition:
  - commit: this plan, prototype HTML, mobile screenshot, desktop screenshot
  - discard: transient browser output and counterpart-review files unless a finding must be retained deliberately
- Residual risks:
  - browser autoplay policies can still block playback on some devices; manual play must remain available
  - Wistia dashboard configuration and caption content can drift independently of repository code
  - autoplay increases page/media bandwidth and continues the known pre-consent third-party request risk
  - sequential before/after evidence cannot isolate the VSL change from time and traffic-mix effects

## Counterpart findings ledger

| ID | Type | Evidence | Decision | Plan change | Revalidation |
| --- | --- | --- | --- | --- | --- |
| C1 | defect | Prototype set both `window.wistiaOptions` and element attributes, unlike the planned attribute-only production path. | accepted | Removed global options, matched exact attributes, and reran mobile/desktop and unmute proof successfully. | Attribute-only browser proof recorded above. |
| C2 | defect | Existing `preload="metadata"` obscured Wistia's documented forced-auto preload for autoplay players. | accepted | Chose and pinned `preload="auto"` in prototype, plan, production task, and test contract. | Browser property returned `preload="auto"`. |
| C3 | tradeoff | Revision bump tags raw PostHog events but no organic dashboard consumes it. | accepted as raw tag | Clarified ad-hoc-query utility; no dashboard scope added. | Verify emitted `offer_revision` after implementation. |
| C4 | defect | Old/new Wistia play rate is not comparable because autoplay changes the play denominator. | accepted | Rewrote measurement guidance and prohibited a lift claim without a common denominator. | Post-release receipt must use the revised interpretation. |
| C5 | defect | No rollback path was stated. | accepted | Added exact revert-and-redeploy posture and monitoring windows; no flag. | Review handoff. |
| C6 | tradeoff | Pre-consent autoplay escalates third-party media/analytics activity. | accepted by owner | Nick chose direct autoplay on 2026-08-25; recorded the increased privacy/bandwidth risk without claiming legal exemption. | Final journey re-reviewed and approved. |
| C7 | defect | Scope wording ignored the dormant registered Personal Plan fallback and second lab alias. | accepted | Narrowed non-goal to the live route and expanded manual aliases. | Source review/browser matrix. |
| C8 | tradeoff | Native Wistia accessible copy uses formal German register. | accepted | Retained native localized control instead of custom overlay; recorded the mismatch transparently. | Browser accessibility check. |
| C9 | tradeoff | Autoplay increases mobile bandwidth, including deep-link visitors. | accepted within autoplay requirement | Pinned `preload="auto"`, added offscreen suspension check, and retained manual fallback. | Deep-link browser check. |
| C10 | scope | Negative LLM-transcript test would not fail against the old implementation. | accepted | Removed it from test-first work; retained source inspection as a plan constraint. | Diff review. |
