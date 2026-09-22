# Discovery-Call Toolkit — Implementation Plan

**Status:** Rev. 1 — self-reviewed, pending counterpart review
**Spec:** `docs/superpowers/specs/2026-09-22-discovery-call-toolkit-design.md` (Rev. 4)
**Worktree:** `.worktrees/discovery-call-toolkit` on `codex/discovery-call-toolkit` (base = origin/main `cee5f253`)
**Evidence:** `plans/discovery-call-toolkit/evidence/{intake-checkliste,cockpit,pdf-ansicht}.html`

## 1. Outcome and source context

Nick runs 50–100 manual one-on-one discovery calls. Toolkit: (1) token-gated participant intake — registration → existing legacy quiz unchanged → new product checklist; (2) admin cockpit per participant — generated Idealroutine, scanner-style verdicts + alternatives, keep/swap per routine step, explicit „Finalisieren"; (3) print-styled refined-routine PDF view rendered only from the finalized state, sent manually. The spec (Rev. 4) is the decision record; this plan is the execution contract.

## 2. Chosen direction

Compose from existing machinery behind one new middleware gate. Enrollment copies the partner-access pattern (HMAC token in URL fragment, `app_metadata` stamp `{access_kind:"discovery", discovery_enrollment_id}`). Product entry reuses `ScanSearchSheet` (+2 additive props), `ScanResearchIntakeForm`, `Scanner`, plus a thin new identify endpoint. The cockpit computes everything ephemerally and strictly read-only: scanner-context projector (`readScannerProfileSource` + `prepareScannerContext`) → one `ScanEvaluationContext` feeding both the Idealplan-Konkret previews (`computeStage1ProductExamplePreviews`) and per-product verdicts (`loadScanVerdictForProduct`). Four new service-only tables. All new UI in German.

## 3. Scope and non-goals

**In scope:** migration (4 tables + RLS), enrollment CLI script, claim page/endpoint, middleware gate + route registration, quiz destination branch + identity prefill, checklist page + intake API + identify endpoint, admin loaders (ideal routine, verdicts, refined-routine composition — TDD), cockpit page + decisions API + finalize, print view, shared `requireAdmin` lift, `ScanVerdictSections`/`ScanAlternativesList` extraction, presentation-rows dedupe, prep runbook doc.

**Non-goals (spec):** no shortened quiz; no member-product shelf feature; no PDF pipeline; no email automation / Calendly integration; no self-serve reveal pre-call; no in-app 1–10 score; no behavior change for normal users (flag off or not enrolled); no Personal Plan artifact writes; no `user_product_usage` writes; no legacy recommendation-engine changes.

## 4. Authoritative shared values

- **Flag:** `DISCOVERY_CALL_TOOLKIT_ENABLED === "true"`, module `src/lib/discovery/flag.ts` (Edge-safe, read per call, default off; shape of `src/lib/entitlements/flag.ts`).
- **Secret:** `DISCOVERY_ENROLLMENT_SIGNING_SECRET` (≥32 chars enforced, cf. partner token module).
- **Stamp:** `auth.users.app_metadata = { access_kind: "discovery", discovery_enrollment_id: <uuid> }` — written only by the claim route; middleware reads it JWT-side (zero DB round-trips).
- **Routes:** `/beratung/einladung` (public invite), `POST /api/beratung/claim` (public), `/beratung/produkte` (protected checklist), intake API under `/api/beratung/*` (authenticated), cockpit `/admin/beratung` + `/admin/beratung/[enrollmentId]` (+ `/pdf`) — under `/admin` because that prefix carries the only admin gate.
- **Participant allow-list (middleware):** `/beratung`, `/api/beratung`, `/quiz`, `/api/quiz`, `/api/scan` (the discovery gate runs before the paywall, so `/api/scan/search|submit` need no freemium-flag dependency; participants could technically call `/api/scan/resolve` for themselves — masked, rate-limited, no UI surface: accepted).
- **Categories:** `SUPPORTED_PRODUCT_CATEGORY_KEYS` (`src/lib/product-identity/index.ts:6-17`), drift-guard-tested equal (as sets) to `PERSONAL_PLAN_PRODUCT_CATEGORIES` and `STAGE1_CATEGORY_ORDER`, and to the migration CHECK list. Display groups (UI only): Waschen (shampoo, conditioner, deep_cleansing_shampoo), Pflege (mask, leave_in, oil, bondbuilder), Kopfhaut (scalp_care), Styling (heat_protectant, dry_shampoo).
- **Item `source` enum:** `catalog_search | barcode | barcode_unknown | dm_search | name_research | none`.
- **Decision key:** `stage3DecisionKey(category, role, null)` → `"decision:<category>:<role>:gap"` (`src/lib/personal-plan/products/contracts.ts:1246-1252`).
- **Step binding rule (deterministic, overridable):** per category, steps = `decision.roles ∩ CATEGORY_ROLE_POLICIES[category].allowedRoles` ordered by `allowedRoles.indexOf(role)`; items ordered by (`product_id` resolved first, source rank barcode<name<submission, `created_at`, `id`); positional bind; surplus items → „kein Schritt im Idealplan"; surplus steps → open.
- **Migration version:** next free `20260922*`; pre-flight `ls supabase/migrations | tail -3` against rebased main immediately before ship (known collision failure mode).

## 5. Decision coverage

Status: **confirmed**

- **Confirmed with Nick:** intake path (full quiz + checklist, submit-everything pre-call); participant boundary (registration + quiz + checklist only); no score/problem capture in intake; cockpit = Idealroutine + verdicts + alternatives with exactly one interaction (keep/swap); call flow (Idealroutine walkthrough → verdicts → keep/swap → refined routine); PDF = refined routine, only after explicit „Finalisieren", manual send, no email service; build order (intake first, then cockpit); build-first-then-outreach; optional post-call comp grant; subagents on Opus.
- **Inherited from evidence or contract:** invite-token + env-kill-switch gating; partner-claim registration pattern incl. paying-member refusal; single middleware gate + allow-list; legacy-`/quiz` pin (scanner-context projector requires a legacy lead); quiz identity prefill (kills the silent `linkQuizToProfile` email-mismatch no-op); four-table schema with service-only RLS; decisions per `decision_key` (multi-role categories make per-category storage unrepresentable); `SUPPORTED_PRODUCT_CATEGORY_KEYS` + drift guard; no styling categories → display-only grouping; thin identify endpoint (resolve route caller-coupled in five ways); read-only cockpit backend via ephemeral context injection (`loadOrCreate`/`provisionFree*`/`loadSharedScannerContext` bypassed); `ScanVerdictSections` fragment extraction; shared presentation-rows + `requireAdmin` lifts; grants never used for pre-call gating — all from the Codex spec review + the three Opus hardening lanes, adopted 2026-09-22.
- **Implementation defaults:** route slugs (`/beratung/*`); exact column names/CHECKs; token format `v1.<payload>.<sig>` in URL fragment; „Noch offen – Empfehlung folgt" copy for undecided PDF steps; kill-switch-off behavior for already-enrolled participants = documented `/reactivate` landing (emergency-only switch; no `/beratung/beendet` page); display-group labels; mockup copy details (adjustable in build); positional-binding tie-break order.
- **Open consequential assumptions:** none.

Undiscussed consequential assumptions affecting this handoff: none.

Coverage acknowledgement: Nick approved the design 2026-09-21/22 (chat), ruled the trims, call flow, PDF lifecycle, and answered "Any other decisions we need to make?" with "Okay, yeah, go ahead. Make sure to please use subagents with Opus." (2026-09-22). The Rev. 4 technical corrections change no product-visible ruling; the one visible refinement — keep/swap lands per routine step, so multi-role categories (e.g. Öl) can carry more than one decision — is presented with the mockups for the single journey approval.

Internal revalidation: plan Rev. 1 written against spec Rev. 4 and the four hardening lane reports (2026-09-22); pending counterpart review.

## 6. Designed user journey

**Participant** (actor), invited via WhatsApp with a personal link (`/beratung/einladung#code=…`):
1. Invite page (German, name greeting) → „Los geht's" → `POST /api/beratung/claim`: account created (`createUser`, generated password, `email_confirm: true`, stamp set) + signed in → destination `/quiz`. Existing account → magic-link branch (`/auth/confirm?next=…`); account with current paid access → refused with clear German copy, no stamp.
2. Legacy quiz, unchanged content; identity prefilled (name/email locked to the enrollment, mismatch impossible). On completion `getPreparationResultPath(discovery)` routes to `/beratung/produkte?lead=<leadId>` instead of `/result/*`.
3. Checklist page (server component): verifies flag + enrollment; idempotently runs `linkQuizToProfile` (projects `hair_profiles` + binds the legacy lead); no diagnostics → redirect `/quiz`. Client: display groups over ten categories; per category scan (identify endpoint) or name search (`ScanSearchSheet`) → pick / „nicht dabei" (research submission; both `already_in_catalog` and `pending_submission` outcomes stored) / „benutze ich nicht"; multiple products per category; draft persists server-side.
4. „Absenden" (visible only when all ten categories answered) → `state='submitted'` → confirmation screen. Participant journey ends until the call.
5. **Error/recovery:** invalid/revoked token or flag off → invite 410 / checklist `notFound()`; middleware bounces any other route to the checklist; closed tab → `/auth?next=/beratung/produkte` (existing sanitized `next` machinery); enrolled participant with flag off lands on documented `/reactivate` (kill-switch emergency semantics).

**Nick** (operator): `npm run discovery -- create --name … --email … --apply` (prod write gate + project confirm) → paste link into WhatsApp → sees `submitted` → prep runbook (misses → research queue → promote → reconcile `approved_product_id`; `classifyPlanBereitSourceFacts` preflight shows „Intake unvollständig" instead of a blank routine) → cockpit: Idealroutine read-aloud block, per-step verdict + alternatives-as-radio keep/swap (empty steps: „Ohne Produkt weiter" / „Neu:"; out-of-routine categories collapse to one grey line) → adjusts freely post-call → „Finalisieren" (requires `submitted`) → `/admin/beratung/[id]/pdf` → browser print → sends manually → optional comp grant.

## 7. Planning evidence

`plans/discovery-call-toolkit/evidence/` — three static HTML mockups (verified rendering in browser): `intake-checkliste.html` (5 mobile frames; no dead CTA in empty state; „benutze ich nicht" cheap; brand-only row labels), `cockpit.html` (desktop; **alternatives are the keep/swap radio options** — single interaction, no duplicate list; third-person copy; Idealroutine block written to be read aloud), `pdf-ansicht.html` (A4; „bleibt"/„neu" on steps, „bleibt"/„ersetzt" in shelf summary; cosmetic-only reasoning). Questions answered: checklist information hierarchy, the keep/swap control shape, PDF content. Disposition: commit as durable evidence. Presented to Nick with this plan for the single journey approval.

## 8. Ordered tasks

### T1 — Migration, vocabulary guard, enrollment CLI
**Produces:** tables `discovery_enrollments`, `discovery_intakes`, `discovery_intake_items`, `discovery_call_decisions`; token module; `npm run discovery` script.
- One migration (version per §4): enrollments (display_name, normalized_email w/ format CHECKs, token_version, claimed_user_id/claimed_at pair CHECK, revoked_at, partial-unique on email + claimed user); intakes (enrollment_id UNIQUE, user_id, state draft/submitted + submitted_at pair CHECK, `call_finalized_at` requires submitted CHECK); items (category CHECK = the ten keys, source CHECK per §4, `source='none'` ⇒ all identity fields NULL CHECK, partial-unique one `none` row per category); decisions (intake_id, decision_key, UNIQUE(intake_id, decision_key), decision keep/swap, `swap` ⇔ `swap_product_id` CHECK, intake_item_id nullable FK). Service-only RLS on all four (`scan_wishlist` doctrine: REVOKE from anon/authenticated, GRANT service_role).
- `src/lib/discovery/token.ts` (HMAC v1, secret length check) + `src/lib/discovery/flag.ts`.
- `scripts/discovery.ts` (create/list/revoke/rotate; prod gate `ALLOW_DISCOVERY_PRODUCTION_WRITE=1` + `--confirm-project=pqdkhefxsxkyeqelqegq` + `--apply`; prints WhatsApp message with fragment link), `package.json` script entry.
- **Tests:** category drift guard (three constants + migration CHECK as sets); token round-trip/tamper; script gates refuse without confirmations. **Done when:** migration applies clean locally; guards green.

### T2 — Claim + journey gating
**Consumes:** T1 (tables, token, flag). **Produces:** enrolled-participant journey shell.
- `/beratung/einladung` page (trimmed `partner-invitation-client`) + `POST /api/beratung/claim` (partner-claim copy: origin check → decode/validate (revoked/token_version) → `createUser` + stamp → `signInWithPassword` → set claimed → `{destination:"/quiz"}`; `email_exists` → magic link; `hasCurrentPaidAppAccess` → German refusal, no stamp).
- Middleware (`src/lib/supabase/middleware.ts`): `isDiscoveryParticipant`, `DISCOVERY_CHECKLIST_PATH`, allow-list predicate; single gate block after the forced-login escape (~line 476), bounce with `redirectWithSupabaseCookies`.
- `src/lib/auth/route-classification.ts`: `/beratung`+`/api/beratung` protected prefixes; invite + claim public-exact. `src/lib/auth/unauthenticated-redirect.ts`: `/beratung` in `AUTH_FIRST_PREFIXES`.
- Quiz: `getPreparationResultPath` gains `discovery` param (pure; caller passes stamp check); identity prefill via discovery quiz-context endpoint + `leadCaptureMode` widening (partner pattern; lead route mismatch rejection covers discovery).
- **Tests:** route classification (R1); middleware matrix with injected `userAppMetadata` — passthrough for every checklist-called path incl. `/api/scan/*`, redirect for `/chat|/routine|/anwendung|/onboarding|/plan-bereit|/reactivate|/result/*|/admin` (R3); flag-off → documented outcome (R4); claim refusal of paying member (R5); `discovery:false` nav byte-compat (R6). **Done when:** enrolled dev user walks invite→quiz→(stub) checklist; normal-user suites green.

### T3 — Intake checklist page + API
**Consumes:** T1, T2. **Produces:** submitted intakes.
- `/beratung/produkte` server page: flag/enrollment/diagnostics guards + idempotent `linkQuizToProfile` (per journey §3; failures logged loudly).
- `POST /api/beratung/identify` (authenticated + enrollment check): `validateEanInput` → `lookupCatalogProductByIdentifier` → `filterScanEligibleProductIds`; identity only.
- Intake CRUD + submit endpoints under `/api/beratung/*` (authenticated participant → server-side ownership+enrollment check → service-role writes; submit requires all ten categories answered, sets `submitted`).
- Client: `DiscoveryProductEntry` wrapper (per scan lane: `ScanSearchSheet` + additive `onSelectProductResult?`/`onSelectRetailerResultRow?` props; own ~40-line submit caller storing `productId` **or** `submissionId`; `Scanner` for barcode; outcome type per §4 source enum); checklist UI per mockup (groups, checkmarks, „benutze ich nicht" both forms, single „Absenden", confirmation).
- **Tests:** existing `ScanSearchSheet`/intake-form suites untouched + new-prop tests; outcome→row mapping unit tests (all six sources, both submit outcomes, text always stored); API ownership/authz tests (foreign user 403, unenrolled 404, post-submit writes rejected); submit completeness. **Done when:** dev participant completes full intake incl. dm-lane and „nicht dabei"; rows correct.

### T4 — Admin read-model (TDD — deterministic core)
**Consumes:** T1 (types). Independent of T2/T3 runtime. **Produces:** `src/lib/discovery/{load-ideal-routine,load-participant-verdicts,refined-routine}.ts`, shared lifts.
- Lifts first: `src/lib/scan/presentation-rows.ts` (dedupe resolve/reveal loaders; their route tests stay green) + shared `loadActiveProductById` + shared `requireAdmin` (from the partner-access private copy).
- `loadDiscoveryIdealRoutine(admin, userId, intakeId)`: `readScannerProfileSource` → `prepareScannerContext` (null → `no_usable_source`; thrown context error → `temporarily_unavailable`) → `computeStage1ProductExamplePreviews` with `personalPlanId: discovery:<intakeId>`, `sourceNeedVersionId: ctx.refinedVersionId` → `buildDiscoveryIdealSteps` (renderedOrder × role order; decisionKey ∈ `stage1PreviewedRoleDecisionKeys`).
- `loadParticipantScanVerdicts(admin, userId, items, context)` — **context injected**, never loaded: per item `loadActiveProductById` → quarantine check → snapshot decision lookup (missing → `decision_missing`, mismatch → `target_mismatch`; never throw per item) → `loadScanVerdictForProduct` (deps as resolve wires) → `withEligibleAlternatives` → batched presentation rows → `presentScanVerdictPayload`; `savedState` absent from the return type.
- `reduceIntakeItemsToSteps` (binding rule §4) + `composeDiscoveryRefinedRoutine` (types per routine lane §7: `DiscoveryIdealStep`, `DiscoveryCallDecision`, `resolved: kept|swapped|ideal|undecided`, `unassignedIntakeProducts`, `sourceHash`); swap resolution via direct products-by-id select (covers non-candidate/inactive products).
- **Tests (write first):** compose fixtures (keep/swap/open × recommendation/fallback; oil 3-role; surplus items; zero intake); binding determinism (insertion-order invariance, id tie-break); ideal-steps drift net; loader fakes assert **zero writes** on the fake client + error mapping; vocabulary guard already in T1; runner `npm run test:node` / `test:personal-plan` (never bare `npx tsx --test` — server-only shim). **Done when:** all green; fake-client write-count assertion proves read-only.

### T5 — Cockpit
**Consumes:** T3 (data), T4 (loaders). **Produces:** the call surface.
- Extraction: `src/components/scan/scan-verdict-sections.tsx` (`ScanVerdictSections` fragment + `ScanAlternativesList` with optional callbacks), `ScanResultCard` shrinks around them; scan-lane regression tests R1–R8 (fragment child order; alternatives-once anti-leak; not-needed flags; callback element parity; hookless plain-function render; criterion fallback; no server-only imports; presentation-rows route tests).
- `/admin/beratung` (list: enrollments + intake state + finalized) and `/admin/beratung/[enrollmentId]` (server, `requireAdmin`): source-facts preflight banner; Idealroutine block; per step verdict card + alternatives-as-radio keep/swap (mockup pattern: „Behalten" / „Tauschen zu …", empty step „Ohne Produkt weiter"/„Neu:", out-of-routine categories one grey line); decisions API `/api/admin/beratung/[id]/decisions` (upsert by decision_key, inline `requireAdmin` per admin-API convention, service-role) + finalize endpoint (`call_finalized_at`, requires submitted; un-finalize allowed while unset PDF not sent — plain toggle).
- **Tests:** decisions API validation (swap requires product id; unknown decision_key for the intake rejected); finalize precondition; cockpit page smoke via loader fakes. **Done when:** dev cockpit renders test participant end-to-end; scan page visually unchanged (`/scan` manual check) and all scan suites green.

### T6 — Print view
**Consumes:** T4, T5. **Produces:** the PDF surface.
- `/admin/beratung/[enrollmentId]/pdf` (server, `requireAdmin`): renders only when `call_finalized_at` set (else redirect to cockpit); refined-routine document per mockup (steps with „bleibt"/„neu", undecided copy per §4, shelf summary „bleibt"/„ersetzt", „brauchst du nicht mehr" list); `@media print` CSS + `print-color-adjust: exact` (no repo precedent — net-new); non-interactive `ScanAlternativesList`/thumb usage; `sourceHash` assertion vs finalized state (mismatch → warning banner, not silent re-derivation).
- **Tests:** render gate (unfinalized redirects); sourceHash mismatch surfaces. **Done when:** browser print produces a clean one-to-two-page A4 for the test participant.

### T7 — Runbook + env docs
**Consumes:** T1–T6. **Produces:** `docs/discovery-call-runbook.md` + env documentation.
- Runbook: enrollment creation (exact command), link sending, monitoring `submitted`, T-1 research (`scan_resolve_events`/`product_submissions` for the participant → research queue → promote → reconcile `approved_product_id` into items), source-facts preflight, call sequence, post-call finalize/PDF/send, optional comp grant command, kill-switch semantics + stranded-participant note, teardown (revoke).
- Env vars documented where the repo documents them (`.env.example`/README pattern). **Done when:** runbook executable start-to-finish against the dev walkthrough.

## 9. Verification

- **Automated:** all new unit/route tests above; full `npm run test:node` (scan-hardening learning: run the whole suite, not slices); `npm run ci:verify`; existing quiz/middleware/scan suites unchanged-green.
- **Manual (dev):** full participant journey with a real enrollment — invite → claim → quiz (prefilled identity) → checklist (barcode + name + dm + „nicht dabei" + „benutze ich nicht") → submit; email-mismatch attempt shows the structural block; normal-user regression pass with flag on (non-enrolled unaffected) and flag off; cockpit → decisions → finalize → print. Dev server restart before manual verification (stale deep-lib trap); use `localhost`, never `127.0.0.1`.
- **Migration/live-state:** local apply + version-collision preflight before ship; prod migration applied only at ship time per repo convention; `get_advisors` check after apply.
- **Evidence-sensitive:** cockpit/PDF output spot-checked against the mockups' content promises (cosmetic-only reasoning, third-person cockpit / du-form PDF).

## 10. Review and handoff

Branch gate: satisfied (feature worktree `codex/discovery-call-toolkit`). Counterpart review: one Codex lane (`codex:codex-rescue`, read-only, `--effort high`) on this plan; findings ledger kept in the review report, transient output outside the repo. Execution: `implementation-loop` via `subagent-driven-development` in this worktree — T1→T2→T3 sequential; T4 parallel to T2/T3 (disjoint write scopes: `src/lib/discovery/` + `src/lib/scan/` lifts vs routes/UI); T5→T6→T7 sequential after. Implementation subagents: per Nick, Opus. Rollout: flag default off everywhere; enabling prod = env var + script-created enrollments only. Risks: migration version collision (preflight); `ScanResultCard` extraction regressions (test net R1–R8); silent lead-link failure (structurally mitigated, loud logging). Artifacts: plan + evidence + runbook committed; review transcripts discarded. Stop point: `/ship` only on explicit request; merge is separate authorization.
