# Discovery-Call Toolkit — Implementation Plan

**Status:** Rev. 2 — Codex counterpart findings incorporated; pending Nick's single journey approval (+ one small swap-scope ruling)
**Spec:** `docs/superpowers/specs/2026-09-22-discovery-call-toolkit-design.md` (Rev. 4)
**Worktree:** `.worktrees/discovery-call-toolkit` on `codex/discovery-call-toolkit` (base = origin/main `cee5f253`)
**Evidence:** `plans/discovery-call-toolkit/evidence/{intake-checkliste,cockpit,pdf-ansicht}.html`

## 1. Outcome and source context

Nick runs 50–100 manual one-on-one discovery calls. Toolkit: (1) token-gated participant intake — registration → existing legacy quiz unchanged → new product checklist; (2) admin cockpit per participant — generated Idealroutine, scanner-style verdicts + alternatives, keep/swap per routine step, explicit „Finalisieren"; (3) print-styled refined-routine PDF view rendered only from the finalized state, sent manually. The spec (Rev. 4) is the decision record; this plan is the execution contract.

## 2. Chosen direction

Compose from existing machinery behind one new middleware gate. Enrollment copies the partner-access pattern (HMAC token in URL fragment, resolve → claim → optional magic-link continuation, `app_metadata` stamp `{access_kind:"discovery", discovery_enrollment_id}`). Product entry reuses `ScanSearchSheet` (+2 additive props), `ScanResearchIntakeForm`, `Scanner`, plus a thin new identify endpoint. The cockpit computes everything ephemerally with **no plan-artifact writes**: scanner-context source read (one idempotent source-registration RPC — see §4) → pure `prepareScannerContext` → one `ScanEvaluationContext` feeding both the Idealplan-Konkret previews and per-product verdicts. Four new service-only tables. All new UI in German.

## 3. Scope and non-goals

**In scope:** migration (4 tables + RLS), enrollment CLI script, invite resolve/claim/continuation surfaces, middleware gate + route registration, camera-header extension, quiz destination branch + discovery identity handling, checklist page + intake API + identify endpoint, admin loaders (ideal routine, verdicts, refined-routine composition — TDD), cockpit page + decisions API + finalize (with fingerprint), print view, shared `requireAdmin` lift, `ScanVerdictSections`/`ScanAlternativesList` extraction, presentation-rows dedupe, prep runbook doc.

**Non-goals (spec):** no shortened quiz; no member-product shelf feature; no PDF pipeline; no email automation / Calendly integration; no self-serve reveal pre-call; no in-app 1–10 score; no behavior change for normal users (flag off or not enrolled); no Personal Plan artifact writes; no `user_product_usage` writes; no legacy recommendation-engine changes; no general workflow engine.

## 4. Authoritative shared values

- **Flag:** `DISCOVERY_CALL_TOOLKIT_ENABLED === "true"`, module `src/lib/discovery/flag.ts` (Edge-safe, read per call, default off).
- **Secret:** `DISCOVERY_ENROLLMENT_SIGNING_SECRET` (≥32 chars enforced).
- **Stamp:** `auth.users.app_metadata = { access_kind: "discovery", discovery_enrollment_id: <uuid> }` — written only by the claim route.
- **Routes:** `/beratung/einladung` (public invite), `POST /api/beratung/resolve` (public: fragment token → display data, partner pattern), `POST /api/beratung/claim` (public), `/beratung/weiter` (public: magic-link handoff continuation, partner `/partner/weiter` analogue), `/beratung/produkte` (protected checklist), intake API under `/api/beratung/*` (authenticated), cockpit `/admin/beratung` + `/admin/beratung/[enrollmentId]` (+ `/pdf`).
- **Participant allow-list (middleware):** `/beratung`, `/api/beratung`, `/quiz`, `/api/quiz`, `/api/scan`. The gate performs an actual early return before the subscription paywall, so `/api/scan/search|submit` are reachable for no-subscription participants **with the freemium flag off** (tested). Participants could call `/api/scan/resolve` for themselves — masked, rate-limited, no UI surface: accepted.
- **Camera:** `next.config.ts` permissions-policy is `camera=()` globally with a `/scan`-only override — `/beratung/produkte` must be added to the camera-header allow-list (plus a header test), or the reused `Scanner` fails in production.
- **Read-only contract (corrected per Codex finding 1):** the cockpit path performs **no plan-artifact writes** (`stage1-service`, `free-snapshot`, `loadSharedScannerContext`/`scanner_context_publish` all bypassed). It is not byte-strict read-only: `read_scanner_profile_source` executes an idempotent `INSERT … ON CONFLICT DO NOTHING` source-registration plus a `FOR UPDATE` lock (migration `20260916175239`). Accepted and documented; the T4 test asserts the fake client sees only this RPC and selects — no other RPC/insert/upsert/delete.
- **Categories:** `SUPPORTED_PRODUCT_CATEGORY_KEYS` (`src/lib/product-identity/index.ts:6-17`), drift-guard-tested equal (as sets) to `PERSONAL_PLAN_PRODUCT_CATEGORIES`, `STAGE1_CATEGORY_ORDER`, and the migration CHECK. Display groups (UI only): Waschen (shampoo, conditioner, deep_cleansing_shampoo), Pflege (mask, leave_in, oil, bondbuilder), Kopfhaut (scalp_care), Styling (heat_protectant, dry_shampoo).
- **Item `source` enum:** `catalog_search | barcode | barcode_unknown | dm_search | name_research | none`.
- **Decision key:** `stage3DecisionKey(category, role, null)` → `"decision:<category>:<role>:gap"`.
- **Step binding rule (deterministic, overridable):** per category, steps = `decision.roles ∩ CATEGORY_ROLE_POLICIES[category].allowedRoles` ordered by `allowedRoles.indexOf(role)`; items ordered by (`product_id` resolved first, source rank barcode<name<submission, `created_at`, `id`); positional bind; surplus items → „kein Schritt im Idealplan"; surplus steps → open.
- **Finalize semantics (per Codex finding 4):** „Finalisieren" persists `call_finalized_at` **and** `finalized_source_hash` (= the composed routine's `sourceHash` at finalize time). While finalized, decision writes are **rejected** (must un-finalize first; un-finalize clears both fields — allowed any time, since sending is manual). The PDF renders only when finalized and shows a warning banner when the freshly computed `sourceHash` ≠ `finalized_source_hash` (profile or catalog drifted since finalize).
- **`src/lib/discovery/` file ownership (per Codex finding 8, for parallel writers):** T2 owns `flag.ts`, `token.ts`, `enrollment.ts`; T3 owns `intake.ts` (write models + validation); T4 owns `load-ideal-routine.ts`, `load-participant-verdicts.ts`, `refined-routine.ts`. No task touches another's files.
- **Migration version:** next free `20260922*`; pre-flight `ls supabase/migrations | tail -3` against rebased main immediately before ship.

## 5. Decision coverage

Status: **confirmed** (pending only the final journey sign-off word)

- **Confirmed with Nick:** intake path (full quiz + checklist, submit-everything pre-call); participant boundary; no score/problem capture in intake; cockpit = Idealroutine + verdicts + alternatives with exactly one interaction (keep/swap); call flow; PDF = refined routine, only after explicit „Finalisieren", manual send, no email service; build order; build-first-then-outreach; optional post-call comp grant; subagents on Opus.
- **Inherited from evidence or contract:** invite-token + env-kill-switch gating; partner-claim registration pattern **including resolver endpoint and `/beratung/weiter` magic-link continuation** (the pattern requires them); paying-member refusal (new discovery-specific check — the partner route only sets `freshStart`); single middleware gate + allow-list incl. the freemium-off `/api/scan` admission; legacy-`/quiz` pin; discovery quiz identity as a first-class mode (see T2 — more than widening a type union); four-table schema with service-only RLS; decisions per `decision_key`; category constant + drift guard; display-only grouping; thin identify endpoint; no-plan-artifact-writes contract with the documented source-RPC exception; finalize fingerprint + frozen-while-finalized rule; camera-header extension; `ScanVerdictSections` fragment extraction with rendered-parity coverage; shared presentation-rows + `requireAdmin` lifts; grants never for pre-call gating — from the Codex spec review, the three Opus hardening lanes, and the Codex plan review (all verified against the repo, adopted 2026-09-22).
- **Implementation defaults:** route slugs; column names/CHECKs; token format; „Noch offen – Empfehlung folgt" copy for undecided PDF steps; kill-switch-off behavior = documented `/reactivate` landing (no loop — gate inert when flag off; tested); display-group labels; positional-binding tie-breaks; ordinary (non-`create_only`) projection mode for `linkQuizToProfile` — the fresh discovery quiz is intentionally the source of truth, including for a re-used existing account.
- **Open consequential assumptions:** none. (Swap scope ruled by Nick 2026-09-22: **displayed alternatives only** — plus the ideal recommendation on empty steps; a catalog picker only if real calls demand it.)

Undiscussed consequential assumptions affecting this handoff: none.

Coverage acknowledgement: Nick approved the design 2026-09-21/22 (chat), ruled the trims, call flow, and PDF lifecycle, and gave the go 2026-09-22 ("Okay, yeah, go ahead… use subagents with Opus").

Internal revalidation: plan Rev. 2 against spec Rev. 4, the four Opus lane reports, and the Codex plan review (findings ledger in §10), 2026-09-22.

## 6. Designed user journey

**Participant** (actor), invited via WhatsApp with a personal link (`/beratung/einladung#code=…`):
1. Invite page resolves the fragment token (`POST /api/beratung/resolve`) → greets by name → „Los geht's" → `POST /api/beratung/claim`: account created (`createUser`, generated password, `email_confirm: true`, stamp) + signed in → destination `/quiz`. Existing account → `email_exists` → magic link → `/beratung/weiter#handoff=…` continues the claim post-auth. Account with current paid app access → **refused** with clear German copy, no stamp.
2. Legacy quiz, unchanged content; discovery identity locked to the enrollment (name/email prefilled, mismatch fail-closed at the lead route). On completion `getPreparationResultPath(discovery)` routes to `/beratung/produkte?lead=<leadId>`.
3. Checklist page (server component): flag + enrollment + diagnostics guards; runs `linkQuizToProfile` (projects `hair_profiles` + binds the legacy lead; completion criterion = diagnostics present **and** lead bound; failures logged loudly). Client: display groups over ten categories; per category scan (identify endpoint) or name search → pick / „nicht dabei" (research submission; both `already_in_catalog` and `pending_submission` stored) / „benutze ich nicht"; multiple products per category; draft persists server-side.
4. „Absenden" (visible only when all ten categories answered) → `state='submitted'` → confirmation. Participant journey ends until the call.
5. **Error/recovery:** invalid/revoked token or flag off → invite 410 / checklist `notFound()`; middleware bounces other routes to the checklist (allow-listed, terminal — no loop); closed tab → `/auth?next=/beratung/produkte`; flag off + enrolled → documented `/reactivate` landing (gate inert, no loop).

**Nick** (operator): `npm run discovery -- create …` (prod gates) → WhatsApp link → sees `submitted` → prep runbook (misses → research queue → promote → reconcile; `classifyPlanBereitSourceFacts` preflight) → cockpit: Idealroutine block, per-step verdict + keep/swap radio (alternatives as options per mockup), out-of-routine categories collapsed → adjusts freely post-call → „Finalisieren" (stores timestamp + `finalized_source_hash`; decisions frozen until un-finalize) → `/admin/beratung/[id]/pdf` → browser print → sends manually → optional comp grant.

## 7. Planning evidence

`plans/discovery-call-toolkit/evidence/` — three static HTML mockups (rendering verified): `intake-checkliste.html` (5 mobile frames), `cockpit.html` (desktop; **alternatives are the keep/swap radio options**; third-person cockpit copy; read-aloud Idealroutine block), `pdf-ansicht.html` (A4; „bleibt"/„neu" steps, „bleibt"/„ersetzt" shelf summary; cosmetic-only reasoning). Questions answered: checklist hierarchy, keep/swap control shape, PDF content. Disposition: commit. Presented to Nick with this plan for the single journey approval (incl. the swap-scope fork).

## 8. Ordered tasks

### T1 — Migration, vocabulary guard, enrollment CLI
**Produces:** four tables; token module skeleton; `npm run discovery` script.
- One migration (version per §4): enrollments (display_name/normalized_email CHECKs, token_version, claimed pair CHECK, revoked_at, partial-uniques); intakes (enrollment_id UNIQUE, user_id, state draft/submitted + pair CHECK, `call_finalized_at`, **`finalized_source_hash text`**, finalize-requires-submit CHECK, finalized pair CHECK `(call_finalized_at IS NULL) = (finalized_source_hash IS NULL)`); items (category CHECK, source CHECK per §4, `none` ⇒ identity-fields-NULL CHECK, one-`none`-per-category partial-unique); decisions (UNIQUE(intake_id, decision_key), keep/swap, swap ⇔ swap_product_id CHECK, intake_item_id nullable FK). Service-only RLS on all four.
- `scripts/discovery.ts` (create/list/revoke/rotate; `ALLOW_DISCOVERY_PRODUCTION_WRITE=1` + `--confirm-project=pqdkhefxsxkyeqelqegq` + `--apply`; prints WhatsApp message with fragment link) + `package.json` entry.
- **Tests:** category drift guard (three constants + migration CHECK); script gate refusals. **Done when:** migration applies clean locally; guards green.

### T2 — Enrollment surfaces + journey gating (owns `src/lib/discovery/{flag,token,enrollment}.ts`)
**Consumes:** T1. **Produces:** enrolled-participant journey shell.
- Token module (HMAC v1, secret length check) + flag module + enrollment service (load/claim/revoke, status derived not stored).
- `POST /api/beratung/resolve` (public: token → display name/state, partner-resolve analogue), `/beratung/einladung` page (trimmed partner client), `POST /api/beratung/claim` (origin check → validate (revoked/token_version) → **new paid-user refusal**: `hasCurrentPaidAppAccess` → German refusal, no stamp (the partner route only sets `freshStart` — this logic is new) → `createUser` + stamp → `signInWithPassword` → claimed → `{destination:"/quiz"}`; `email_exists` → magic link → continuation), `/beratung/weiter` handoff page (post-auth claim completion, partner `/partner/weiter` analogue).
- Middleware: `isDiscoveryParticipant`, allow-list predicate, single gate block with actual early return after the forced-login escape; `route-classification.ts`: `/beratung`+`/api/beratung` protected prefixes, invite/resolve/claim/weiter public-exact; `unauthenticated-redirect.ts`: `/beratung` in `AUTH_FIRST_PREFIXES`.
- Quiz identity (per Codex finding 5 — a first-class mode, not a union widening): extend `leadCaptureMode` to `"discovery"` with explicit handling at each partner-mode touchpoint (`store.ts` identity lock, `screen-order.ts`, `quiz-lead-capture.tsx`); discovery quiz-context endpoint (enrollment → locked identity); **server branch on `/api/quiz/lead`** marking discovery leads and fail-closing on identity mismatch (partner `invited_email_mismatch` analogue). `getPreparationResultPath` gains `discovery` param (pure).
- **Tests:** route classification; middleware matrix (passthrough for all checklist-called paths **with freemium flag off + no subscription**; redirects for member routes; `/reactivate` no-loop cases flag-on and flag-off); claim refusal of paying member; `email_exists` continuation; `discovery:false` nav byte-compat; quiz-lead fail-closed mismatch. **Done when:** dev walkthrough invite→resolve→claim→quiz→(stub) checklist incl. existing-account branch; normal-user suites green.

### T3 — Intake checklist page + API (owns `src/lib/discovery/intake.ts`)
**Consumes:** T1, T2. **Produces:** submitted intakes.
- `next.config.ts`: add `/beratung/produkte` to the camera permissions-policy allow-list (+ header test) — the global policy is `camera=()`.
- `/beratung/produkte` server page: guards + projection per journey §3 (ordinary mode — fresh quiz wins; completion = diagnostics **and** bound lead; loud logging on `linkQuizToProfile` silent return).
- `POST /api/beratung/identify` (authenticated + enrollment check): `validateEanInput` → `lookupCatalogProductByIdentifier` → `filterScanEligibleProductIds`; identity only.
- Intake CRUD + submit endpoints (participant auth → ownership+enrollment check → service-role writes; submit requires all ten categories answered).
- Client: `DiscoveryProductEntry` wrapper (`ScanSearchSheet` + additive `onSelectProductResult?`/`onSelectRetailerResultRow?` props; own submit caller storing `productId` **or** `submissionId`; `Scanner` reuse), checklist UI per mockup.
- **Tests:** existing sheet/form suites untouched + new-prop tests; outcome→row mapping (six sources, both submit outcomes, text always stored); API authz (foreign 403, unenrolled 404, post-submit writes rejected); submit completeness; camera header test. **Done when:** dev participant completes full intake incl. barcode, dm lane, „nicht dabei"; rows correct.

### T4 — Admin read-model (TDD; owns `src/lib/discovery/{load-ideal-routine,load-participant-verdicts,refined-routine}.ts` + scan lifts)
**Consumes:** T1 (types). Parallel to T2/T3 (disjoint files per §4). **Produces:** loaders + shared lifts.
- Lifts: `src/lib/scan/presentation-rows.ts` (dedupe resolve/reveal; their route tests stay green and both routes provably consume the shared builder) + shared `loadActiveProductById` + shared `requireAdmin` (from the partner-access private copy).
- `loadDiscoveryIdealRoutine(admin, userId, intakeId)`: `readScannerProfileSource` (documented RPC exception) → `prepareScannerContext` (null → `no_usable_source`; throw → `temporarily_unavailable`) → `computeStage1ProductExamplePreviews({ personalPlanId: "discovery:"+intakeId, sourceNeedVersionId: ctx.refinedVersionId, snapshot: ctx.snapshot, loadCandidates: createSupabaseStage1ProductExamplePreviewCandidateLoader(admin) })` — all four inputs named so `stage1-service`/shared-context loading are never reintroduced → `buildDiscoveryIdealSteps`.
- `loadParticipantScanVerdicts(admin, userId, items, context)` — context **injected**: per item active-product → quarantine → decision lookup (`decision_missing`/`target_mismatch`, never throw per item) → `loadScanVerdictForProduct` (resolve-route deps) → `withEligibleAlternatives` → batched presentation rows → `presentScanVerdictPayload`; no `savedState` in the return type.
- `reduceIntakeItemsToSteps` (§4 rule) + `composeDiscoveryRefinedRoutine` (kept/swapped/ideal/undecided, `unassignedIntakeProducts`, `sourceHash`); swap resolution via direct products-by-id select.
- **Tests (first):** compose fixtures (keep/swap/open × recommendation/fallback; oil 3-role; surplus items; zero intake); binding determinism; ideal-steps drift net vs `stage1PreviewedRoleDecisionKeys`; loader fakes assert **only** the source RPC + selects (no other RPC/mutation) + error mapping; runner `npm run test:node`/`test:personal-plan` (never bare `npx tsx --test`). **Done when:** green; RPC-exception assertion in place.

### T5 — Cockpit
**Consumes:** T3 (data), T4 (loaders). **Produces:** the call surface.
- Extraction: `scan-verdict-sections.tsx` (`ScanVerdictSections` fragment + `ScanAlternativesList` optional-callback list), `ScanResultCard` shrinks around them. Regression net: scan-lane R1–R8 **plus rendered-DOM parity fixtures** (premium, masked, revealed, `not_needed`, with-alternatives states compared before/after extraction).
- `/admin/beratung` list + `/admin/beratung/[enrollmentId]` (server, shared `requireAdmin`): source-facts preflight banner; Idealroutine block; per-step verdict card + keep/swap radio — **swap options per Nick's pending ruling** (default build: displayed alternatives + ideal recommendation on open steps; catalog picker only if ruled); decisions API `/api/admin/beratung/[id]/decisions` (upsert by decision_key; **rejected while finalized**) + finalize endpoint (sets `call_finalized_at` + `finalized_source_hash` from the current composed routine; requires submitted; un-finalize clears both).
- **Tests:** decisions API validation incl. frozen-while-finalized; finalize stores hash + precondition; page smoke via loader fakes. **Done when:** dev cockpit end-to-end; `/scan` visually unchanged and all scan suites green.

### T6 — Print view
**Consumes:** T4, T5.
- `/admin/beratung/[enrollmentId]/pdf` (server, `requireAdmin`): renders only when finalized (else redirect to cockpit); document per mockup; `@media print` + `print-color-adjust: exact` (net-new — no repo precedent); non-interactive components; **drift warning banner when computed `sourceHash` ≠ `finalized_source_hash`** — warn, never silently re-derive.
- **Tests:** render gate; hash-mismatch banner. **Done when:** clean A4 print for the test participant.

### T7 — Runbook + env docs
**Consumes:** T1–T6. `docs/discovery-call-runbook.md` (enrollment command, link sending, `submitted` monitoring, T-1 research + reconcile, source-facts preflight, call sequence, finalize/PDF/send, comp grant, kill-switch + stranded-participant semantics, revoke/teardown) + env var documentation. **Done when:** executable start-to-finish against the dev walkthrough.

## 9. Verification

- **Automated:** all task tests above; full `npm run test:node`; `npm run ci:verify`; existing quiz/middleware/scan suites unchanged-green; camera-header test; freemium-off scan-admission middleware test; no-loop redirect tests; rendered-DOM parity fixtures.
- **Manual (dev):** full participant journey with a real enrollment (both new-account and existing-account claim branches); identity-mismatch fail-closed check; normal-user regression flag on + off; cockpit → decisions → finalize (frozen check) → un-finalize → re-finalize → print with and without drift. Dev server restart before manual verification; `localhost`, never `127.0.0.1`.
- **Migration/live-state:** local apply + version-collision preflight before ship; prod migration at ship time; `get_advisors` after apply.
- **Evidence-sensitive:** cockpit/PDF spot-checked against the mockups' content promises.

## 10. Review and handoff

**Counterpart findings ledger (Codex plan review, 2026-09-22 — transient report discarded, decisions recorded here):**

| ID | Type | Decision | Plan change |
|----|------|----------|-------------|
| C1 read path not read-only (source RPC inserts+locks) | defect | accepted | §4 contract relaxed + documented; T4 test reshaped |
| C2 claim flow missing resolver/continuation; paid refusal is new logic | defect | accepted | T2 rewritten (resolve, weiter, refusal) |
| C3 camera permissions-policy blocks checklist scanner | defect | accepted | T3 header change + test |
| C4 finalize has no fingerprint/freeze | defect | accepted | `finalized_source_hash` + frozen-while-finalized (T1/T5/T6) |
| C5 discovery quiz identity underspecified; projection overwrite | defect | accepted | T2 first-class mode + fail-closed; ordinary-mode default documented |
| C6 preview inputs understated | defect | accepted | T4 names all four inputs |
| C7 swap scope narrows spec | scope/product decision | **needs user decision** | §5 open item, presented to Nick |
| C8 `src/lib/discovery` writer scopes | defect | accepted | §4 file ownership |
| C9 middleware test cases (freemium-off admission, no-loop) | defect | accepted | T2 tests + §9 |
| C10 rendered-parity coverage | defect | accepted | T5 parity fixtures |

Branch gate satisfied (feature worktree). Execution: `implementation-loop` via `subagent-driven-development` — T1→T2→T3 sequential; T4 parallel to T2/T3 (file ownership per §4); T5→T6→T7 after. Implementation subagents: Opus (Nick's instruction). Rollout: flag default off; enabling prod = env vars + script-created enrollments only. Residual risks: migration version collision (preflight); extraction regressions (parity net); silent lead-link failure (structurally mitigated + loud logging). Artifacts: plan + evidence + runbook committed; review transcripts discarded. Stop point: `/ship` only on explicit request; merge separate.
