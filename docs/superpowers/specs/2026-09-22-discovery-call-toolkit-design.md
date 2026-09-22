# Discovery-Call Toolkit — Design

**Date:** 2026-09-22 (Rev. 4 — hardening corrections)
**Status:** Approved in shape by Nick; Rev. 2 incorporated Codex findings; Rev. 3 encodes Nick's call-flow ruling; Rev. 4 corrects technical contracts from the Opus hardening lanes (implementation plan: `plans/discovery-call-toolkit/plan.md`)
**Owner:** Nick

## Purpose

Nick runs 50–100 manual one-on-one hair-consultation calls (friends, family, extended network) to rediscover the product shape from first principles. Participants rate their hair satisfaction 1–10 (collected by Nick during WhatsApp outreach; not stored in-app); anyone below 10 gets a call whose goal is that they leave knowing exactly what to do to get to a 10.

The toolkit optimizes call productivity: all data is captured **before** the call, all analysis happens **during prep**, and the call itself is Nick driving a purpose-built cockpit. The cockpit deliberately is **not** the existing product UI — it is the canvas on which the next product version gets discovered, adapted call by call.

## Participant journey (locked boundary)

Participants see **only**: registration → existing 10-question quiz (unchanged content) → new intake checklist page. No routine, no plan UI, no paywall, no existing member area. The call is the reveal; delivery is cockpit (screen-share) + PDF afterwards.

1. **Outreach** (manual, WhatsApp) → participant books via Calendly.
2. **Intake link** in the booking confirmation → register → quiz → product checklist → submit.
3. **Prep** (Nick, T-1 day): research unknown products, review generated analysis in cockpit.
4. **Call** (Nick's ruled flow): show the Idealroutine and guide the participant through it → per entered product: „du benutzt X — schauen wir es uns an" (verdict) → per category, decide together: **keep** their product or **swap** to an alternative → the refined routine assembles from those decisions.
5. **After (async, no time pressure)**: Nick curates the PDF content whenever he's ready — reviewing/adjusting the keep/swap decisions post-call, then marking the outcome **final**; only the finalized state produces the PDF. Nothing is auto-generated at call end, and nothing is auto-sent. The participant then receives the PDF of the **refined routine** — the conversation's outcome, mixing kept products and new ones; optionally a `manual_access_grants` comp (reason `friend`) if they explicitly want the normal app afterwards. Grants are **never** used as the pre-call gating mechanism — an active grant flips full member routing, which would break the locked boundary (`src/lib/billing/subscriptions.ts`).

### Journey contract (Codex finding 1 — the locked journey does not exist in current routing)

The discovery flow needs its own contract; it cannot ride the normal funnel:

- **Admission:** per-participant **invite/enrollment token** that binds the discovery enrollment to the account at registration, plus an **environment flag as global kill switch**. Not env-flag-only (would expose the route to every account) and not allowlist-only (doesn't carry the quiz destination).
- **Discovery mode carried through the flow (corrected in hardening, Rev. 4):** one middleware gate keyed on an `app_metadata.access_kind = "discovery"` stamp (set at claim), placed before the subscription paywall / intake redirect / frontier routing, with an allow-list (`/beratung`, `/api/beratung`, `/quiz`, `/api/quiz`, `/api/scan`) and a bounce to the checklist for everything else. The live quiz completion redirect is `getPreparationResultPath` in `src/components/quiz/quiz-preparation.tsx` (NOT the legacy `quiz-results.tsx`); `intake-state.ts` and frontier routing need **no** changes. Quiz answers project into `hair_profiles` + bind the quiz lead to the account via `linkQuizToProfile`, owned idempotently by the checklist page; quiz identity prefill (partner-flow pattern) prevents the silent email-mismatch no-op. Participants take the **legacy `/quiz`** — this is a hard precondition: the scanner-context projector requires an owner-linked `quiz_kind='legacy'` lead.
- Registration surface: the **partner-access claim pattern** (`createUser` + generated password + immediate sign-in + existing-account magic-link branch). Claiming an email with current paid app access is **refused** — never stamp a paying member into discovery mode. `/auth?next=` covers return visits; no new auth UI.
- The checklist route must be registered in `src/lib/auth/route-classification.ts` (protected prefix `/beratung`, public-exact invite + claim routes) and `/beratung` added to `AUTH_FIRST_PREFIXES`; unknown routes pass through middleware unauthenticated.
- Because the discovery gate runs before the paywall, allow-listing `/api/scan` gives participants the search/submit endpoints without any dependency on the freemium flag.

## Component 1 — Intake checklist page (build)

Token-gated page in the existing app (participant must be logged in and enrolled). Purely the product checklist — no score/problem capture: the quiz already covers concerns + goals.

- One entry section per product category, using **`SUPPORTED_PRODUCT_CATEGORY_KEYS`** (`src/lib/product-identity/index.ts` — the constant `POST /api/scan/submit` actually validates; same ten members as `PERSONAL_PLAN_PRODUCT_CATEGORIES` today, different order, so a drift-guard test pins them equal). **There are no styling product categories** in the supported vocabulary (gel/mousse/cream/hairspray are deliberately unsupported) — the checklist shows display-only groups (Waschen / Pflege / Kopfhaut / Styling) over the ten real categories; every row maps 1:1 to a validated category, no fan-out layer.
- Per category:
  - **Scan barcode** via a thin new identify endpoint (EAN → catalog identity only — the resolve route is caller-coupled: verdicts, entitlements, wishlist auto-save, rate limit) **or type a name** (existing name-only search with dm-backed lane, PR #593; `ScanSearchSheet` reused with two additive result-object props). Name submissions carry separate `brand` + `product_name` fields as `POST /api/scan/submit` requires.
  - Pick the match, or „nicht dabei" → files a research submission; submit answers with **either** `{already_in_catalog, productId}` **or** `{pending_submission, submissionId}` — both outcomes stored; post-research reconciliation runs via `product_submissions.approved_product_id`.
  - Category gets its checkmark; **multiple products per category allowed**; „benutze ich nicht" is an explicit, stored answer (distinct from unanswered). Brand/name text is stored in every case, even with a resolved `product_id`, so cockpit and PDF survive catalog changes.
- **Storage (Codex finding 3):** two new tables:
  - `discovery_intakes` — parent per participant: enrollment reference, state (`draft` / `submitted`), `submitted_at`. This is what tells Nick intake is complete.
  - `discovery_intake_items` — pure captured inventory: `(intake_id, category, source, brand_text, product_name_text, barcode_identifier?, product_id?, product_submission_id?)`, plus explicit empty-category rows (`source='none'`).
  - `discovery_call_decisions` (Rev. 4 — decisions moved out of items): `(intake_id, decision_key, decision keep/swap, swap_product_id?, intake_item_id?)`, keyed by the routine step's `decision_key` (category+role), written only by Nick via the admin-gated cockpit. Per-category storage cannot represent multi-role categories (`oil` has 3 roles, `scalp_care` 4) or ideal steps the participant owns nothing for. Deliberately separate from `user_product_usage` (`UNIQUE (user_id, category)`), `scan_wishlist` (identity only), and `user_products` (couples to Personal Plan service-only writes and routine source-change triggers — rejected to keep the experiment decoupled).
- **Finish:** explicit „Absenden" setting the parent state to `submitted`.
- All UI text in German, telegram style, one job per screen.

This page doubles as a live probe of the Badezimmer-Check pillar from the freemium direction.

## Component 2 — Thin cockpit (build)

One admin-gated page per participant, inside the existing repo so it calls the real engines directly. Deliberately minimal — generated output plus exactly **one** interaction (keep/swap). Sections mirror the ruled call flow:

1. **Idealroutine** — the ideal routine generated for the participant's hair profile. **Routine authority (Rev. 4, corrected in hardening):** two lanes compose it — the **scanner-context projector** derives the Stage-1 snapshot from `hair_profiles` + the legacy quiz lead (`readScannerProfileSource` → `prepareScannerContext`, both entitlement-free; the projector is pure), and the **Idealplan-Konkret preview computation** (`computeStage1ProductExamplePreviews`) resolves the concrete ideal products. `createStage1PersistenceService(...).loadOrCreate` and `provisionFreeInitialSnapshotForUser` are explicitly bypassed: both are entitlement-gated and write plan artifacts. `loadSharedScannerContext` is also bypassed (it publishes a context revision) — with the ephemeral context, **the entire cockpit backend is strictly read-only**. A step is a `(category, role)` pair keyed by `decision_key`; there is no intake→engine product input at all (the Stage-1 engine consumes no products), so no `user_product_usage` mapping exists to tempt anyone. The intake items bind to routine steps by a deterministic positional rule (resolved-catalog-first, source rank, created_at, id) that Nick can override per decision.
2. **Product verdicts with alternatives** — for each intake product, what the scanner output page would show if the participant had scanned it. Call `loadScanVerdictForProduct` + `withEligibleAlternatives` + presentation helpers with the **participant's** user id via a service-role client behind the admin gate — never `POST /api/scan/resolve` as Nick (identity fixed to caller, caller entitlements, wishlist auto-save, attempt telemetry, rate limit). The verdict slice **accepts the injected ephemeral context** from section 1 — one computation serves both sections. `savedState` is excluded from the view model by construction. `ScanResultCard` is not reusable as-is: extract neutral `ScanVerdictSections` + `ScanAlternativesList` (fragment discipline so the live scan page stays byte-identical) consumed by cockpit and print view. The privately duplicated presentation-row loader in the resolve/reveal routes is lifted into one shared helper, not copied a third time.
3. **Keep/swap decisions (the one interaction):** per routine step (`decision_key`), Nick records the call's outcome — **behalten** (keep the bound intake product) or **tauschen** (pick an alternative; any catalog product id, not restricted to the previews). Persisted in `discovery_call_decisions` and editable **after** the call too: PDF creation is an async curation step, never an automatic call-end artifact. When Nick is done adjusting, he sets an explicit **„Finalisieren"** status (`call_finalized_at` on `discovery_intakes`, requires `submitted`); the PDF view renders only from that finalized state, and Nick sends it manually (WhatsApp/email by hand — no email service integration).
4. **Refined routine** — the Idealroutine's steps overlaid with the keep/swap decisions: per step, `kept` / `swapped` / `ideal` (open step with a recommendation, marked „neu") / `undecided` (open step whose preview is a fallback — renders „Noch offen – Empfehlung folgt" in the PDF). Intake products with no step in the Idealroutine list separately as „brauchst du nicht mehr". Pure composition of sections 1–3; no second engine run. The composed object carries the engine `sourceHash` so the PDF can assert it renders exactly what Nick finalized.

No diagnosis rendering, no score/problem header, no notes field (Nick keeps call notes outside the app). Design bar: deliberately plain, fast to reshape between calls. No polish, no mobile optimization, no access for anyone but Nick.

## Component 3 — PDF (thin)

A participant-facing, print-styled view of the **refined routine** — the conversation's outcome (steps with the kept and swapped products), in product voice, German — plus the product verdicts as supporting detail. Consumes the **same view model** as the cockpit minus scanner controls, reveal masking, analytics callbacks, purchase interactions, and the keep/swap controls. The route itself stays **admin-gated** (its wording is participant-facing; its access is not). Export = browser "print to PDF", sent manually. No PDF generation pipeline.

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
- Call flow ruled: Idealroutine walkthrough → per-product verdicts → per-category keep/swap decided together → refined routine = outcome; PDF shows the refined routine (Nick, 2026-09-22)
- Routine authority resolved: ephemeral admin-side generation of the Idealroutine from the hair profile (Idealplan-Konkret lane), no Personal Plan artifact lifecycle per participant; refined routine is a composition of Idealroutine + keep/swap decisions, not a second engine run (2026-09-22)
- PDF lifecycle: adjust freely in cockpit → explicit „Finalisieren" → only then PDF; manual send, no email service (Nick, 2026-09-22)
- Rev. 4 hardening corrections (2026-09-22, from Opus research lanes): single middleware gate + partner-claim registration + legacy-/quiz pin + identity prefill; thin identify endpoint for barcode entry; `SUPPORTED_PRODUCT_CATEGORY_KEYS` + drift guard; no styling categories (display-only grouping); decisions per `decision_key` in own table; routine authority = scanner-context projector + Idealplan-Konkret previews, strictly read-only backend; paying-member claims refused
