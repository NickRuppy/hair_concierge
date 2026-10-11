# Ready-check receipt — Hair Tools port (`codex/hair-tools-port`)

- **Branch / head:** `codex/hair-tools-port` @ `aec3f743` (43 commits ahead of `origin/main` `dc41156b`, 0 behind; `dc41156b` merged in as the last commit).
- **Original base:** `404db24f` (origin/main on 2026-10-09).
- **Content fingerprint (SHA-256 of the sorted manifest `path <blob-hash|DELETED>` for every path changed vs merge-base `dc41156b`, 349 paths):** `e71a14ae1dec8dcb5769377322c1732c6fb6a4786ef6e899148a5f715add6b9b`.
- **Plan:** `plans/2026-10-09-hair-tools-port.md` (Rev. 5). Rulings ledger addendum: `plans/2026-08-24-hair-tools-d1-d9-rulings.md` („2026-10-09/10 port rulings").

## Decision coverage (revalidated on this tree)

- Status: **confirmed**. Coverage acknowledgement: Nick's rulings 2026-10-09 (port onto fresh main; option A third module „Deine Tools" with migration; checkpoint on module return; D2b bundled then temperature dropped on the evidence memo; Diffusor = plain blow-drying; Profil option (b) → Rev. 5 structure Tools before Gewohnheiten, things asked once; wash-day order inside every section; Ziele row into Haar-Check; ship to all after Nick's admin walkthrough) and „Okay, I think I like that" on the Rev. 5 structure with the mockup `plans/mockups/2026-10-09-hair-tools-port/index.html`.
- Internal revalidation: implementation followed Rev. 5; all implementation-time rulings are in the ledger addendum. No consequential assumption is open. Items for Nick's veto at the live walkthrough: invented German copy (checkpoint title/lead/secondary, banner „3 Min.", Profil card descriptions, „Hitze"/„Keine Hitze", tool badges, per-family page titles, short labels, „Aus deinen Angaben abgeleitet", empty state „Du hast keine Tools angegeben."), the heat-source map defaults, and derived-only tools showing „Offen"/„Noch nicht angegeben".

## Promised outcomes checked

1. Third module `tools` between Produkte and Gewohnheiten, meter 5, `not_applicable` when the flag is off — unit + labs + Playwright.
2. Tool questions (overview + per-page photo cards) in wash-day order; things asked once; Gewohnheiten reduced to behaviors with the thing-fields derived from the inventory; drying page polish; Diffusor never asks Hitzeschutz and never raises the tier (tier override, route unchanged).
3. Tool ownership saved through `user_facts_save_v1` as per-page keys; per-key protection; derived fields; `brushesCombs` from user pages only; flag-off completions write no tool keys.
4. Read-time derivation on Stage 1, Routine (page + reload API, keepsake), Anwendung (premium + keepsake, never example); fail-silent tool failures; no routine payload change (`schemaVersion: 1`), no stored tool artifacts.
5. Tool-Checkpoint once on module return; „Tools ergänzen" clears host state; replay-safe module completion (`POST stage-2/complete {module}`).
6. Profil: Haar-Check (+ Ziele row), Produkte, Deine Tools, Gewohnheiten when tools apply; today's cards (minus Ziele card) otherwise; 3 s fail-open status gate.
7. Flag-off invariance on every surface and write path (boundary tests + walkthrough B).
8. Migration `20261009170000_personal_plan_stage2_tools_module.sql` additive (three `CREATE OR REPLACE` bodies differ only in the module list; verified by diff), registered last in the PGlite chains.
9. Rollback: `scripts/personal-plan/tools-rollback-clear-facts.ts` (facts via the door + draft downgrade; dry-run default; PGlite-tested).

## Commands and results (tree `aec3f743`)

| Check | Result |
| --- | --- |
| `npm run ci:verify` (typecheck + lint + build) | exit 0 |
| `npm run test:personal-plan` | 3597 tests · 3596 pass · 0 fail · 1 skipped |
| `npm run test:personal-plan:nested` | 1184 · 1184 pass |
| `npm run test:node` | 11615 · 11600 pass · 0 fail · 15 skipped |
| `npm run test:playwright:personal-plan-stage3:journey` | chromium 81 passed · webkit-mobile 13 passed · exit 0 |
| PGlite migration suites incl. tools module, rebase, optional prefill, rollback, bondbuilder availability | 82/82 |
| Grep guards (no `schemaVersion: 2` in routine producers/parsers; no persisted tool fields; no „Idealplan" in the tools engine) | tests green |

Earlier tree `c4d83e0e` (pre fix-wave, pre merge): same gates green; one Playwright flake on the untouched legal withdrawal page (hydration + click not navigated in 5 s) re-ran 4/4 green in isolation.

Logs: `.superpowers/sdd/2026-10-09-hair-tools-port/reports/readycheck-aec3f743/` (git-ignored, discard at `worktree:finish`).

## Browser / manual evidence

`plans/mockups/2026-10-09-hair-tools-port/ready-check/README.md` + ~55 screenshots at 390 px (tree `c4d83e0e`; the fix wave and merge changed no visual surface except the checkpoint secondary action):

- A labs, flag on: full tools journey, overview sections in wash-day order, two-page families with „Seite 1/2 von 2", checkpoint groups in order, Routine tool section, Gewohnheiten behaviors only, Diffusor-only run without Hitzeschutz block, Haarprofil 5 rows; 0 console errors.
- B dev login, flag off: Profil today's cards (Ziele row inside Haar-Check), Routine/Anwendung unchanged.
- C dev login, flag on: identical to B for a member without facts; `GET /api/personal-plan/routine` Server-Timing flag on 506–550 ms vs off 679–713 ms (on not slower).
- E mobile: no horizontal scroll, chips wrap, CTA reachable.
- **D not run locally:** a real signed-in, plan-enrolled flag-on journey needs the local test-mode checkout (§3 of `docs/local-qa-access.md`), whose Stripe test keys are absent from this worktree. Covered by Nick's production walkthrough in `admin` rollout before `all` (plan §10).

## Review

- Per-task reviews: every task (1–6, 8–12) reviewed; 9 fix rounds total; all findings addressed or parked with rulings (ledger).
- Codex whole-branch review (session `01a129b6…`, on `c4d83e0e`): 3 majors → fixed test-first (`e13b24ae`, `2821a396`, `a58e14de`) → scoped re-review: all addressed. Text: `.superpowers/sdd/…/reports/codex-whole-branch-review-c4d83e0e.md`.
- Merge of `origin/main` `dc41156b`: 10 conflicts resolved as unions; migration renamed to avoid a version collision; focused + full suites green afterwards.

## Artifacts

- commit: plan Rev. 5, mockups (incl. ready-check evidence), evidence memo, ledger addendum, `decision.md` v5, `docs/local-qa-access.md`, this receipt, Task 1 receipt.
- discard: `.superpowers/sdd/2026-10-09-hair-tools-port/**` (git-ignored scratch: ledger, briefs, reports, review packages) at `worktree:finish`.
- retain until merge: old worktree `personal-plan-hair-tools-current-shape` / PR #465 (close as superseded after this PR merges — Nick's call).

## Skipped checks, blockers, residual risk

- Skipped: live signed-in flag-on journey (above); `npm run test:chat` not required (no chat/rag/routines-engine paths changed).
- Deploy order (plan §10): apply the migration first (additive) → deploy with `PERSONAL_PLAN_TOOLS_ROLLOUT` unset → set `admin`, Nick walks the journey in production → `all`.
- Rollback: flag `off` first; a pre-port code rollback only after `scripts/personal-plan/tools-rollback-clear-facts.ts --apply` (facts + draft downgrade).
- Residual: Beratung consult sheets now show the Diffusor tier as „nicht nötig" (unconditional; matches the ruling); with the flag off a completed towel answer that originated from the tools page is indistinguishable from a member answer; one extra `hair_profiles` read per Stage-2 load/save and per Routine/Anwendung view with the flag on (measured: not slower); 4 production members with a stored Diffusor Hitzeschutz value are read-tolerant; 3 August test drafts keep working.
