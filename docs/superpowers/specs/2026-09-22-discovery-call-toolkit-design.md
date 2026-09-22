# Discovery-Call Toolkit — Design

**Date:** 2026-09-22 (Rev. 2 after Codex review)
**Status:** Approved in shape by Nick; Rev. 2 incorporates Codex findings; one open decision (routine authority)
**Owner:** Nick

## Purpose

Nick runs 50–100 manual one-on-one hair-consultation calls (friends, family, extended network) to rediscover the product shape from first principles. Participants rate their hair satisfaction 1–10 (collected by Nick during WhatsApp outreach; not stored in-app); anyone below 10 gets a call whose goal is that they leave knowing exactly what to do to get to a 10.

The toolkit optimizes call productivity: all data is captured **before** the call, all analysis happens **during prep**, and the call itself is Nick driving a purpose-built cockpit. The cockpit deliberately is **not** the existing product UI — it is the canvas on which the next product version gets discovered, adapted call by call.

## Participant journey (locked boundary)

Participants see **only**: registration → existing 10-question quiz (unchanged content) → new intake checklist page. No routine, no plan UI, no paywall, no existing member area. The call is the reveal; delivery is cockpit (screen-share) + PDF afterwards.

1. **Outreach** (manual, WhatsApp) → participant books via Calendly.
2. **Intake link** in the booking confirmation → register → quiz → product checklist → submit.
3. **Prep** (Nick, T-1 day): research unknown products, review generated analysis in cockpit.
4. **Call**: Nick screen-shares the cockpit and walks through product verdicts → Idealroutine → alternatives.
5. **After**: participant receives a simple PDF of their plan; optionally a `manual_access_grants` comp (reason `friend`) if they explicitly want the normal app afterwards. Grants are **never** used as the pre-call gating mechanism — an active grant flips full member routing, which would break the locked boundary (`src/lib/billing/subscriptions.ts`).

### Journey contract (Codex finding 1 — the locked journey does not exist in current routing)

The discovery flow needs its own contract; it cannot ride the normal funnel:

- **Admission:** per-participant **invite/enrollment token** that binds the discovery enrollment to the account at registration, plus an **environment flag as global kill switch**. Not env-flag-only (would expose the route to every account) and not allowlist-only (doesn't carry the quiz destination).
- **Discovery mode carried through the flow:** quiz completion for an enrolled participant must **suppress the normal result/offer redirect** (`src/components/quiz/quiz-results.tsx`) and the `needs_onboarding` classification/redirect (`src/lib/auth/intake-state.ts`), securely project quiz answers into `hair_profiles` (the `linkQuizToProfile` path used by `src/app/onboarding/page.tsx`), and land on the checklist — bypassing onboarding, subscription, and Personal Plan frontier routing.
- The existing field-test token route (`src/app/test/quiz/[token]/route.ts`) is a useful *pattern* but not reusable directly: it rejects authenticated sessions and activates guests toward `/plan-bereit`.
- The checklist route must be explicitly protected; unknown routes pass through middleware unauthenticated (`src/lib/supabase/middleware.ts`).

## Component 1 — Intake checklist page (build)

Token-gated page in the existing app (participant must be logged in and enrolled). Purely the product checklist — no score/problem capture: the quiz already covers concerns + goals.

- One entry section per product category, using the **Personal Plan category vocabulary** (`src/lib/personal-plan/products/contracts.ts`) — required, because the scanner submit endpoint validates that vocabulary; there is no single "engine category set" (recommendation inventory and legacy usage differ). The checklist may group the styling categories under one visible „Styling" section that fans out to the concrete categories.
- Per category:
  - **Scan barcode** (existing scan resolve flow) **or type a name** (existing name-only search with dm-backed lane, PR #593). Name submissions carry separate `brand` + `product_name` fields as `POST /api/scan/submit` requires.
  - Pick the match, or „nicht dabei" → files a normal miss into the existing research pipeline (`product_submissions`), and the intake item stores the returned `submission_id` so post-research reconciliation via `product_submissions.approved_product_id` is possible.
  - Category gets its checkmark; **multiple products per category allowed**; „benutze ich nicht" is an explicit, stored answer (distinct from unanswered).
- **Storage (Codex finding 3):** two new tables:
  - `discovery_intakes` — parent per participant: enrollment reference, state (`draft` / `submitted`), `submitted_at`. This is what tells Nick intake is complete.
  - `discovery_intake_items` — `(intake_id, category, brand_text, product_name_text, barcode_identifier?, product_id?, product_submission_id?, source)`, plus explicit empty-category rows. Deliberately separate from `user_product_usage` (`UNIQUE (user_id, category)`), `scan_wishlist` (identity only), and `user_products` (couples to Personal Plan service-only writes and routine source-change triggers — rejected to keep the experiment decoupled).
- **Finish:** explicit „Absenden" setting the parent state to `submitted`.
- All UI text in German, telegram style, one job per screen.

This page doubles as a live probe of the Badezimmer-Check pillar from the freemium direction.

## Component 2 — Thin cockpit (build)

One admin-gated page per participant, inside the existing repo so it calls the real engines directly. Deliberately minimal — output only, three sections:

1. **Product verdicts** — for each intake product, what the scanner output page would show if the participant had scanned it. **Implementation contract (Codex findings 4–5):** call the lower-level helpers (`loadScanVerdict` in `src/lib/scan/load-scan-verdict.ts`, scanner context loading, quarantine filter, presentation helpers) with the **participant's** user id via a service-role client behind the admin gate — never `POST /api/scan/resolve` as Nick (that route fixes identity to the caller, applies caller entitlements, and auto-saves to the caller's wishlist). Note: scanner context loading publishes a context revision, so "output-only" describes the cockpit UX, not a strictly read-only backend.
2. **Idealroutine** — ⚠️ **open decision, see below.**
3. **Alternatives** — the alternatives the scanner output computes, rendered from the same server payload. `ScanResultCard` is not reusable as-is (client component with rescan/buy callbacks, private alternatives renderer): extract or add **neutral presentational sections** for verdict body + alternatives that both cockpit and print view consume. Since the card already embeds alternatives, cockpit rendering must avoid duplicating them (verdict body and alternatives as two views of one payload).

No diagnosis rendering, no score/problem header, no notes field (Nick keeps call notes outside the app). Design bar: deliberately plain, fast to reshape between calls. No polish, no mobile optimization, no access for anyone but Nick.

### Open decision — routine authority (Codex finding 2)

"Idealroutine (existing engine)" is ambiguous; neither existing path consumes `discovery_intake` as-is:

- **Option A — ephemeral admin-side projection (recommended):** compute the routine on the fly from the participant's `hair_profiles` + a documented `discovery_intake_items` → engine-input reduction (including the primary-product-per-category rule when multiple exist), via the recommendation runtime that the legacy loader maps into (`src/lib/routines/load-routine-artifact-data.ts` shape, invoked with an explicit userId + service-role reads). No Personal Plan artifacts created. Lighter, decoupled, easy to reshape between calls.
- **Option B — full Personal Plan routine:** drive the real product lifecycle (refined-need snapshot, Stage-3 portfolio/category resolutions, plan artifact) per participant. Byte-identical to the paying product's output, but disproportionate machinery for a manual 50–100-call program and couples the experiment to product internals.

The intake→engine reduction is part of the output definition and must be specified in the implementation plan, whichever option is chosen.

## Component 3 — PDF (thin)

A participant-facing, print-styled view of the cockpit's sections (product voice, German), consuming the **same view model** minus scanner controls, reveal masking, analytics callbacks, and purchase interactions. The route itself stays **admin-gated** (its wording is participant-facing; its access is not). Export = browser "print to PDF", sent manually. No PDF generation pipeline.

## Access & data boundary (Codex finding 6)

- Participant writes (intake): authenticated participant endpoint → server-side ownership + enrollment check → service-role persistence (the `scan_wishlist` pattern).
- Nick's cross-user reads (cockpit, print view): admin gate first (middleware admin check protects `/admin` routing only — it grants no SQL access by itself), then service-role reads scoped to the participant.
- New tables ship with owner-only or service-only RLS consistent with the above; no authenticated cross-user policies.

## Component 4 — Prep runbook (docs only)

Checklist in `docs/` (no feature): T-1 day → check `discovery_intakes.state = submitted` → run misses through the existing research queue → promote → reconcile `approved_product_id` into intake items → open cockpit → sanity-check routine → note talking points against the participant's stated problem (from WhatsApp/quiz).

## Non-goals (YAGNI)

- No shortened quiz variant; the existing quiz runs unchanged.
- No shelf-inventory feature in the member product proper (checklist stays gated to the discovery program).
- No PDF generation pipeline, no email automation, no Calendly API integration.
- No self-serve reveal for participants pre-call.
- No cockpit multi-user/team features.
- No in-app 1–10 score tracking (revisit only if cross-call tracking warrants it).

## Decisions log

- Intake path: existing funnel pieces, full quiz, checklist page; submit-everything before call (Nick, 2026-09-21)
- Cockpit: thin, purpose-built, not the existing product UI — seed of next product version (Nick)
- Handoff: simple PDF; optional comp grant (Nick)
- Build first, then start calls — no manual-entry bridge (Nick, 2026-09-22)
- Participant boundary confirmed: registration + quiz + checklist only (Nick, 2026-09-22)
- No score/problem capture in intake: quiz already covers concerns/goals; 1–10 score stays in WhatsApp outreach (Nick, 2026-09-22)
- Cockpit trimmed to output only: scanner-style product verdicts + Idealroutine + recycled alternatives; no diagnosis/notes sections (Nick, 2026-09-22)
- Build order: intake tables + checklist first, then cockpit (Nick, 2026-09-22)
- Rev. 2 technical contracts (journey/token gating, two-table intake schema, Personal Plan category vocabulary, lower-level scan helper reuse, RLS boundary, grants-not-for-gating) adopted from Codex review 2026-09-22
- Routine authority (Option A vs B): **OPEN — Nick to rule**
