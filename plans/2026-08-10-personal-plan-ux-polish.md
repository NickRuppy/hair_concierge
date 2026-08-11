# Personal Plan — UX-Politur (Post-Audit Fix-Batch)

## Context

The UX audit of the live Personal Plan funnel (2026-08-10, `ux-audits/2026-08-10-personal-plan-test-flow/report.md`, 43 screenshots) found 23 issues. Nick wants everything fixed except the hard structural bugs, which he fixes separately. This plan covers the interaction, copy, and visual-consistency work in **one PR** on a dedicated worktree (`npm run worktree:new -- personal-plan-ux-polish`).

## Locked decisions (Nick, 2026-08-10)

| Topic | Decision |
|---|---|
| C1 "Produkte prüfen" dead end + C2 onboarding handoff | Out of scope — Nick fixes elsewhere |
| M1 phantom "Maske — Passt sehr gut" verdict | Out of scope — requirement handed to Nick's fix: no fit verdict without a user product |
| M4 fake-progress commitment modals | Keep exactly as-is |
| M7 tracking / consent gating | Explicitly deferred — full tracking stays ("consent doesn't matter for now"); zero analytics changes in this PR |
| K3 "Viel Potenzial" scale labels | Keep; only dedupe the doubled eyebrow/badge |
| Advance model | Auto-advance stays for single-selects at ~400ms with visible confirmation; every multi-select (incl. all "Nichts davon") requires Weiter |
| Terminology | "Haaranalyse" everywhere user-facing; "Quiz"/"Haar-Check" leave the UI (identifiers/event names byte-identical) |
| Design unification | Full: one CTA system (quiz + plan area + onboarding) AND stepper/header unification; coral stays CTA-only |
| PR structure | One UX-polish PR |

## Hard constraints

- **Never edit** `stage3-products-flow.tsx:1687-1849` (verdict logic) or `personal-plan-products/index.tsx:671-960` (decision cards) — owned by Nick's parallel fix.
- No analytics event names, storage keys, API paths, or tracking behavior change.
- All UI copy German, du-form. Coral = CTA/pill accent only; selected states & steppers = plum.
- Legacy quiz (`src/components/quiz/*`, `goals-screen.tsx`) keeps `.quiz-btn-primary` untouched.

## Architecture decisions

1. **CTA**: new Button cva variant `funnelCta` — coral **pill** (`rounded-full`, min-h-14, full width, hover = darker coral + soft shadow + `-translate-y-px`, no rotate; focus ring plum-dark offset). Pill because every selectable surface is a rounded rect — the pill alone reads "action, not option". Migrate funnel + plan area + onboarding to it; delete `.personal-plan-primary-action` when grep-clean; keep `.quiz-btn-primary` deprecated for legacy quiz only. Existing `cta`/`landingCta` variants untouched (used outside the funnel).
2. **Email precheck**: new `POST /api/quiz/personal-plan-email-precheck` reusing `checkEmailDeliverability` (fail-open, 3s timeout, known-good short-circuit) + `recordEmailDeliverabilityOutcome("personal_plan_precheck", …)`. Client: "Weiter zu meiner Auswertung" runs the precheck with spinner ("E-Mail wird geprüft…"); 422 stays on the email step (error + suggestion), 200/network-error advances to consent. Lead-route 422 remains as backstop; on backstop the given consent answer is remembered and resubmitted — consent is never asked twice.
3. **Selection states**: unselected cards lose `hover:border-plum` (hover = lift + shadow only); selected gains plum border + ring + `bg-plum-ice` fill; `focus-visible` becomes offset plum-dark ring. Kills the "first card looks pre-selected" bug with pure CSS. `AUTO_ADVANCE_MS` 260→400. Scalp "Nichts davon" becomes a stateful pressed card (`scalpConcerns: []` as explicit choice) + Weiter — no more instant `goNext`.
4. **Desktop CTA fold**: no sticky on desktop; instead complement `MobileBottomAction`'s media pair — `<main>` padding drops to `pb-12` under `(min-width:640px) and (min-height:701px)`, and ProofScreen's image/stat/spacing shrink so header+content+CTA ≤ 900px.
5. **Midpoint**: keep reveal animation, delete auto-continue timer, add `funnelCta` "Weiter" in `MobileBottomAction` (rendered from mount, `disabled` until reveal done — no dock pop).
6. **Steppers**: `journey-header.tsx` current-state moves coral→plum-dark (labels plum-darkest/plum); `refinement-bridge.tsx` hardcoded dot-stepper replaced by canonical `PersonalPlanJourneyHeader currentStage={3}`. Quiz header: top-right stage label + `SECTION_LABELS` removed (stepper is the only stage indicator).

## Evidence & sign-off record

- Mockup evidence: `plans/evidence/2026-08-10-personal-plan-ux-polish-mockups.html` (published: https://claude.ai/code/artifact/78e56bd1-fd3f-4215-8a3e-6e3061d23f0c) — CTA unification, option-card states, stepper, email microcopy, full copy table.
- Evidence review: **confirmed by Nick, 2026-08-11.**
- User-journey walkthrough (email precheck incl. backstop-consent-preservation, scalp "Nichts davon" stateful, midpoint explicit Weiter, 400ms selection confirmation): **signed off by Nick, 2026-08-11.**

## Execution phases

### Phase 0 — Setup + evidence gate (before any implementation)
1. `branch-gate`, then `npm run worktree:new -- personal-plan-ux-polish`; copy this plan to `plans/`.
2. **Mockup evidence (CLAUDE.md gate)**: one lightweight HTML mock rendering — new `funnelCta` next to old quiz/plan buttons; option-card hover vs selected vs focus states; unified stepper (plum) vs current coral; plus before/after copy for all rewritten strings shown in component layout (screenshots from the audit as "before").
3. Present evidence to Nick; walk the updated user journey (email precheck path incl. backstop, scalp-none, midpoint Weiter); record sign-off here before Phase 1.

### Phase 1 — Foundation (sequential)
- **T1** `funnelCta` variant (`ui/button.tsx`, deprecation comment in `globals.css`) — *Opus*. AC: pill spec above; `mobile-quiz-hover-styles.test.ts` (raw-CSS-text regexes!) stays green.
- **T2** CTA migration sweep — *Sonnet*. All PPQ `variant="cta"` (11), plan area (`plan-bereit` client :126, `need-plan-screen` :77-96, `refinement-flow` :648/:689, `refinement-question` :630 dock, `refinement-bridge` :68-77, `personal-plan-products/index.tsx` :165-173 & :541+ — not 671-960, `routine-page`), onboarding (8 files, "LOS GEHT'S"→"Los geht's"). Delete `.personal-plan-primary-action`. Update `personal-plan-stage3-components.test.tsx:46`. AC: greps clean, `ci:verify` green, legacy quiz untouched.

### Phase 2 — Quiz lane (T3→T6 strictly sequential, single 2915-line file) + plan-area lane (parallel)

Quiz lane (PPQ = `personal-plan-quiz/personal-plan-quiz.tsx`):
- **T3** Selection/advance model — *Opus*. D3: OptionCard classes (:613-617, :666-672, intensity branch + `globals.css:905-920`), `AUTO_ADVANCE_MS=400` (:135), scalp none stateful (:943-956, :2723-2737). Guards: `personal-plan-quiz-funnel-entry.test.ts` :153/:221/:250 must stay green unchanged.
- **T4** Midpoint Weiter + desktop fold/padding — *Opus*. D4+D5 (`MidpointProfileScreen` :1195-1278, `<main>` :2899, ProofScreen :1101-1145; spot-check AnalysisBridge). AC: 1440×900 CTA in viewport on all interstitials; 390×844 dock unchanged (`personal-plan-mobile-action.spec.ts`).
- **T5** Email precheck — *Opus*. New route (DI pattern from `personal-plan-lead/route.ts:110-119`) + `EmailCapture` state machine (:1830-2093, `checking`, `rememberedConsent`). Rewrite `tests/personal-plan-email-deliverability.spec.ts` (precheck-reject / backstop-consent-preserved with `submissionCount===2` / fail-open) + new `personal-plan-email-precheck.test.ts`.
- **T6** Quiz copy + header + Notiz — *Opus (German copy)*. Lock-microcopy :2039-2042 (explain why email is needed, no "optionale Zustimmung" forward-reference), goals helper :2652, cost question :1333 (→ Fehlkauf framing), eyebrow :1352 (→ "Deine Haarthemen"), dedupe "Viel Potenzial" eyebrow :1428 (badge :1446 stays), remove stage label :420-422 + `SECTION_LABELS` :214-223, Eigene Notiz scrollIntoView + note counted in Weiter counter (:958-1005, :1019-1021; maxLength stays 50). Update `personal-plan-question-context-copy.test.ts:37`.

Plan-area lane (parallel after T2):
- **T8** Stepper unification — *Sonnet*. `journey-header.tsx:86-107` plum spec; `refinement-bridge.tsx:26-38` → canonical header. AC: zero coral in steppers, progressbar semantics intact.
- **T9** Wash-frequency order + none-copy — *Sonnet*. `refinement-options.tsx:65-76` → ascending `PRODUCT_FREQUENCY_OPTIONS` (frequencies.ts:125-128); **`stage3-products-flow.tsx:151` stays common-first**. Soften none-option (defaults :262-263, aria :310, override `refinement-question.tsx:355-363`) — no "gelöscht". Update the 4 aria-string tests (`stage1-2-3.spec:11`, `stage1-5.spec:315`, `stage2-refinement-ui.test:262`, `stage2-refinement.spec:23-25,194`).
- **T10** Search empty state — *Sonnet*. `index.tsx:357` + `stage3-products-flow.tsx:392-396` → copy pointing to "Produkt hinzufügen". Update `personal-plan-stage3.spec.ts:60`. Hard stop at owned ranges.

### Phase 3 — Sweep + verify
- **T7** "Haaranalyse" terminology sweep — *Sonnet* (after T6, last PPQ toucher). Known: `plan-start-flow.tsx:431`, `snapshot-adapter.ts:150,293-294`, `personal-plan-offer.tsx:279-280`, `refinement-question.tsx:321-322`; then grep sweep, user-visible strings only. Update `personal-plan-offer-page.test.tsx:467-518`. Review rule: `git diff` shows zero changes to `trackAppEvent(` names/keys/routes.
- **T11** Verification — `npm run ci:verify`, full test suite, playwright specs above; canaries green (`legacy-quiz-*`, `quiz-onboarding-e2e`, `auth-intake-routing`, `personal-plan-mobile-action`). Manual walkthrough 390×844 + 1440×900 over the full funnel (incl. bad-domain email, suggestion, backstop path, scalp none, midpoint, wet-wash order, bridge, search empty state). Re-screenshot the changed surfaces against the audit set.

### Phase 4 — Finish
Codex whole-branch review (codex:codex-rescue agent, read-only, `--effort xhigh`) → fix real findings → `/ship` (runs chat eval; PR includes plan + mockup evidence + before/after screenshots).

## New/changed test coverage
Precheck route unit test; playwright: scalp-none stateful, midpoint explicit Weiter, backstop consent preservation, desktop-viewport CTA-visible assertion on `early_proof`.

## Risks
PPQ conflicts (mitigated: strict T3→T6 sequence); button blast radius (new variant, legacy untouched + canary tests); precheck latency (spinner, fail-open, backstop); terminology over-reach (diff review rule); consent-preservation edge (user changes mind after email fix — accepted trade-off).

## Follow-ups (explicitly not this PR)
Thickness images too similar (new assets) · product-catalog coverage audit (top-50 German lines) · consent gating (deferred by Nick — TTDSG §25 backlog memory stays) · phantom-verdict requirement note to Nick's Produkte-prüfen fix.
