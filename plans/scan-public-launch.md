# Produkt-Scan — Public Launch (alle User)

## Context

Produkt-Scan (barcode → persönlicher Fit-Verdict) is live in stealth since 2026-08-20 (PRs #455, #457, #458): fully deployed at `/scan`, gated on auth + active access + completed quiz, but reachable only by direct link — the nav tab is commented out. Barcode coverage is now 197/282 products (~70%, enrichment continues separately). This plan makes the feature discoverable and operable for all entitled users.

**Decisions from planning session (Nick, 2026-08-31):**
- **Nav: five identical tabs for everyone, always.** Nick's ruling: the navigation must never change composition — no tabs popping in as stages unlock. All personal-plan users see Chat · Routine · Scan · Anwendung · Profil, with Scan center. Rationale: since the Feinschliff cutover (#471/#479/#481) every paying user gets a first plan version via the post-payment plan-start CTA in their first session, so Routine/Anwendung have content (unrefined, with the refinement banner) essentially immediately. For the sliver who haven't pressed that CTA yet, the existing middleware frontier redirect sends Routine/Anwendung taps back into `/plan-start` — coherent, no new UI. 5-tab mockup shown and reviewed 2026-08-31.
- **Announcement:** nav tab + existing unvisited-dot only. No chat message, no banner. Measure adoption via PostHog `scan_started` / `scan_result_shown`.
- **Intake ops:** keep the "meist innerhalb von 24 Stunden" promise; Nick commits to a daily intake run (queue + notify sweeper).
- **Scope:** go-live only. Promotion-layer guardrail, Merkliste-in-plan, provenance widening = separate follow-ups.

## Non-goals

- Promotion-layer rule ("never suggest a product the scanner rates Passt nicht for that user"), Merkliste surfacing in the plan, `user_product_usage.source` widening — parked follow-ups, not launch blockers (both scan and recommendations already run on the same Stage-3 engine, so day-one contradictions are unlikely).
- EAN backfill / catalog enrichment (in progress separately; unmerged branch `codex/scan-ean-backfill` in `.worktrees/scan-ean-backfill` stays untouched).
- Any announcement mechanism beyond the nav dot; admin dashboards; automation of the intake pipeline.
- No changes to scan verdict logic, rate limits (30/min shared bucket is adequate), or access gates.

## Tasks

### 0. Copy sign-off (gate — no merge without it; run as interactive walkthrough at implementation start)
Present the ~30 strings from `plans/scan-mvp-copy-signoff.md` to Nick grouped and in context (the 3 flagged issues first), decide live, apply edits immediately (one-liners, mostly `src/lib/scan/verdict-labels.ts` + scan components). The flagged items:
- deferred copy "Für Kopfhautprodukt …" reads bumpy for scalp_care (missing article),
- friendlier copy for the 409 `product_not_saveable` toast,
- keep or revert the "Das übernimmt bei dir" header-vs-inline deviation (§ item 8).
Mark the sign-off doc as resolved.

### 1. Nav — five fixed tabs for all personal-plan users
`src/lib/personal-plan/navigation-access.ts` (`toAuthenticatedAppNavigationAccess`, lines 71–81): remove the `access.allowed.stage4` / `stage5` conditionals AND the stealth comment/commented line — always push chat, routine, scan, application, profile in that order. Legacy (`kind: "legacy"`) users keep the legacy header, unchanged. Type unions already contain `scan`/`/scan`/`"Scan"`; mobile grid auto-sizes (`repeat(items.length, …)`); `ScanLine` icon already mapped. The effective access gate for pre-plan users stays the middleware frontier redirect (`src/lib/personal-plan/frontier-routing.ts` via `src/lib/supabase/middleware.ts:493-517`): Routine/Anwendung taps before a plan exists land in `/plan-bereit`/`/plan-start`; Anwendung with a pending-unaccepted proposal lands on `/routine`. Update navigation-access + stage5-navigation tests for the fixed composition (drop stage-gated expectations).

**1b. Dead-end screen fix:** the rare divergence state (middleware frontier passes, journey-access disagrees) renders „Deine Routine ist gerade nicht verfügbar" with only an „Erneut laden" button (`src/app/routine/page.tsx:139-155`). With an always-visible tab this becomes discoverable: add a forward CTA („Zum Plan" → `/plan-start`) alongside reload. Same pattern check for `/anwendung`'s `feature_disabled` state (already has „Zur Routine" CTA — fine as is).

### 2. Unvisited-dot clearing
`src/app/scan/layout.tsx:9-12` deliberately omits `schedulePersonalPlanNavSurfaceVisit` (would leave a permanent dot after launch). Add the call, mirroring `src/app/chat/layout.tsx` et al.; remove the stealth comment. `scan` is already a valid `PersonalPlanNavSurface`.

### 3. Onboarding-bypass fix
`src/lib/auth/intake-state.ts:78-80`: add `/scan` to `isPersonalPlanOnboardingBypassRoute` (currently only routine/anwendung/chat) so a personal-plan user in legacy-onboarding state isn't bounced from `/scan` to `/onboarding` while `/chat` works. Add a test alongside the existing intake-state tests.

### 4. Sentry on scan API routes
`/api/scan/{resolve,search,submit,save,wishlist,brands}` currently log failures only via `console.error/warn`. Add Sentry capture on server-error paths (5xx, unexpected throws — not 4xx client errors), following the existing pattern in `src/lib/observability/product-intake` (reference: `scripts/product-intake/review-actions.ts:353`). Keep the fail-open behavior of `resolve-event-log.ts` and rate-limit fail-closed semantics unchanged.

### 5. noindex the bare `/scan` path
`next.config.ts:59` noindexes `/scan/:path*` but not bare `/scan` — same bare-segment gap the camera-header comment (lines 20–21) works around for `camera=(self)`. Extend the noindex header to the bare path.

### 6. Attempt-log retention rule — 90 days, automated (Nick's ruling 2026-08-31: follow best practice)
`scan_resolve_events.user_id` is anonymized after 90 days via `pg_cron` (best practice: automated storage limitation; miss-ranking aggregates by barcode and never needs `user_id`; account deletion already cascades via FK). Implementation: one migration that enables the `pg_cron` extension (if not already enabled — check `list_extensions` first) and schedules a daily job running `update scan_resolve_events set user_id = null where user_id is not null and created_at < now() - interval '90 days'`. Document the policy + how to inspect the job in `docs/scan-attempt-log.md`, replacing the open-item note at line 7. Apply the migration to prod at deploy (same discipline as `20260821120000`).

### 7. Operator runbook + launch checklist
- New short section in `docs/scan-attempt-log.md` or a `docs/scan-ops.md`: the **daily loop** — `products:intake:queue -- --status pending_review`, review/approve via review-center or approve-package, then `products:intake:notify-pending -- --apply --confirm` sweeper; link to `docs/product-intake-research-ops.md` instead of duplicating it.
- Add scan to `docs/runbooks/launch-readiness-checklist.md` (currently zero scan mentions).

### 8. Field-test walkthrough (post-deploy, soft gate — Nick's ruling: he already field-tested the scanner successfully; this launch only changes discoverability)
Immediately after deploy, Nick on his own phone: five tabs render with dot on Scan, dot clears after first visit, one real scan end-to-end, one unknown-EAN submission → operator run → "Produktprüfung" chat notification arrives. Anything found is hotfixed. (The deeper decode-quality items — curved bottles, bathroom light, 3s timeout, 409 flows — were covered in his stealth-phase testing.)

## Designed user journey (confirmed at plan approval)

**A. Jeder Personal-Plan-User, erste Session nach Deploy:** opens app → bottom bar shows the same 5 tabs as always going forward (Chat · Routine · Scan · Anwendung · Profil), Scan center with a small dot → taps Scan → camera permission prompt → scans a bottle → green "✓ Barcode erkannt" → verdict sheet (Passt / Passt mit Einschränkung / Passt nicht / Unklar) with reasons, save to "Benutze ich schon" / Merkliste → dot is gone on next navigation. Desktop/no camera: placeholder + "Produkt suchen" search fallback.

**B. Frischer User direkt nach Quiz/Payment:** same 5 tabs. Routine/Anwendung show the first plan version (with refinement banner) as soon as the plan-start CTA was pressed; before that, tapping them redirects into the plan flow (`/plan-start`). Scan works immediately (verdict from quiz profile).

**C. Unbekannter Barcode:** "Danke dir – das ist neu für uns!" → single tap on a shelf-category card submits immediately (no brand/product-name step) → "Eingereicht!" pending screen ("meist innerhalb von 24 Stunden…") → Nick's daily operator run classifies it → chat notification in "Produktprüfung" conversation → user re-scans, gets verdict.

**Error/edge states (all existing, unchanged):** expired access → `/reactivate?next=/scan`; quiz incomplete → `/quiz`; legacy-onboarding user → now reaches `/scan` (Task 3) instead of bouncing; rate limit → 429 German toast; camera denied → search fallback.

## Verification

- `npm run ci:verify`; scan suites via npm shims (never bare `npx tsx --test`); nav/intake-state test updates green.
- Local drive (dev login per `docs/local-qa-access.md`): all five tabs render for a full account AND a fresh pre-plan account; pre-plan Routine/Anwendung taps redirect into the plan flow; dot appears on Scan and clears after first visit; `/scan` reachable from legacy-onboarding state; dead-end screen shows the new „Zum Plan" CTA.
- Post-deploy field walkthrough (Task 8) — soft gate, hotfix on findings.
- Launch timing (Nick's ruling): ship as soon as tasks are done — 70% barcode coverage + search fallback + waiting list is sufficient; no coverage threshold. Misses feed the enrichment priority list.
- Whole-branch Codex review (`codex:codex-rescue`, read-only) before push per repo workflow.
- Post-deploy: uncommented nav visible on prod; Sentry shows scan routes instrumented (force one 5xx in dev to confirm capture path); watch PostHog `scan_started`/`scan_result_shown` for first-week adoption; run miss-ranking SQL after a few days to feed enrichment.

## Execution notes

- Worktree: `npm run worktree:new -- scan-public-launch` (verify base == fetched origin/main tip). Copy this plan to `plans/scan-public-launch.md` in the worktree.
- Order: Task 0 (interactive copy walkthrough with Nick) first; Tasks 1–7 are small, independent code/doc changes (Sonnet-tier except copy judgment); Task 8 runs right after deploy.
- Migration discipline: Task 6's pg_cron migration must be applied to prod at deploy.
- Ship via `/ship`; merge on explicit "merge it" per repo workflow. Post-deploy Sentry check per CLAUDE.local.md.

## Task 0 — RESOLVED (walkthrough 2026-08-31/09-01)

All stealth copy signed off as-is except the changes below. `plans/scan-mvp-copy-signoff.md` is to be marked resolved.

**Copy edits (exact strings, apply verbatim):**
1. `scanDeferredSubtitle`: scalp_care renders plural — „Für Kopfhautprodukte steht deine Einschätzung noch aus" (special-case only scalp_care; other categories unchanged).
2. „Das übernimmt bei dir" reverts from section header to the spec's inline sentence form „Das übernimmt bei dir: …" (undo the header deviation, sign-off doc item 8).
3. Unklar title: „Noch nicht sicher einzuordnen" → „Da sind wir noch nicht sicher".
4. Search error: „Die Suche ist gerade nicht erreichbar." → „Die Suche klappt gerade nicht."
5. Generic error toast: „Das hat gerade nicht geklappt. Versuch es noch einmal." → „Hat nicht geklappt – versuch's nochmal."
6. Profile subtitle: „Bewertet anhand deines Profils" → „Basierend auf deinem Haarprofil".

## Task 9 (NEW, signed off via mockup 2026-09-01) — Unknown-flow rework: success-first, one tap
`src/components/scan/scan-unknown-flow.tsx` + `scan-flow.tsx`: reorder to success-first. New copy: headline „Danke dir – das ist neu für uns!" + subline „Wir nehmen es auf. Dein Ergebnis kommt in den Chat." + question „Wobei benutzt du es?" over the existing category cards (5 primary + expander, unchanged). **Chip tap submits immediately** (commitment+auto-advance, like the quiz) — no Absenden button, no step 2. Brand/name fields + brand typeahead are REMOVED (delete the now-unused typeahead code and `/api/scan/brands` route + its rate-limit config). Pending screen copy: „Eingereicht!" / „Meist innerhalb von 24 Stunden – wir melden uns im Chat." (`SCAN_PENDING_SUBMISSION_HEADLINE` + pending body). API unchanged — category still submitted, brand/name already optional. Update scan tests accordingly.
**Follow-up (parked):** category prefill via external product DB (e.g. Open Beauty Facts) — chips arrive pre-selected, tap = confirm.

## Task 10 (NEW, Nick's ruling) — No save dead end
`src/lib/scan/saved-state.ts` (origin gate at ~:198 and wishlist equivalent): allow „Benutze ich schon" AND Merkliste for **active, non-quarantined** products regardless of `origin` (18 active user_submitted products affected). Quarantined stays blocked (unreachable in practice — resolve treats quarantined as unknown). Keep the 409 code path + existing generic toast for that residual case. Update saved-state tests (rule-ID fixtures where applicable).
