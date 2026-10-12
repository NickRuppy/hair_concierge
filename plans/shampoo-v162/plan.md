# Shampoo classification v1.6.2 — plan

Status: approved by Nick 2026-10-12 ("yes approve both, then do the v1.6.2 + re-check"). Worktree `.worktrees/shampoo-v162`, branch `codex/shampoo-v162`, base `81201a9e` (= origin/main at creation, includes v1.6.1 #667).

Origin: the Track A review of 2026-10-12 (rollout worktree `.worktrees/shampoo-v16-rollout`, review page decisions, rulings ledger `plans/shampoo-v16/rulings.md` R18). v1.6.1 deferred the R16.4 closed-list batch to v1.6.2.

## Scope (Nick's rulings)

| # | Change | Source | Ruling |
|---|---|---|---|
| L1 | Mild-base route: the S-SENSITIVE formula gate (and CSA) also pass when no strong anionic surfactant (C3, either type) is prominent and `cleansingStrength` is not `strong`. A sensitive claim is still required; claims alone never pass. S-DRY unchanged. | evidence `comfort-route-audit-2026-10-12.md`, `sensitive-scalp-levers-2026-10-12.md` | R18 (option C, 2026-10-12) |
| L2 | R16.4 closed-list batch resolved: no additions to the E4 comfort, E4 humectant, C2 humectant or CSA lists. Rejected candidates: Aloe Barbadensis Leaf Juice, Lactococcus Ferment Lysate, Arginine, Lauryl Lactate, PEG-18 Glyceryl Oleate/Cocoate, Glycosphingolipids (no rinse-off evidence). | evidence `closed-list-candidates-2026-10-12.md` | R18.3 |
| L3 | `Laureth-9` is the INCI name of `Polidocanol` (same substance): listed as an alias on the E4 comfort list. | same | R18.3 |
| L4 | User-copy boundary: list ingredients are a plausibility filter, not proof of soothing; research records never support "soothes" in user copy. | audit | R18.4 |

Precision call (main session, within R18): "mild base" is defined through the existing C3 classes — no prominent strong anionic of either type (alkyl sulfates, alkyl ether sulfates, olefin/alkylbenzene sulfonates) — rather than "no sulfate" only, so harsh sulfonate chassis do not pass as mild.

Out of scope: S-DRY changes, the R19 live-display rule (scalp concern decides fit colour; app PR), any list additions, v1.7 ideas.

## Phases

1. **Candidate** (`plans/shampoo-v162/candidate/`): v1.6.1 text + L1–L4 marked "(v1.6.2)", changelog rows from 138. Main session writes; every change fails toward the cautious value (P0).
2. **Pre-registration + test kit** (`plans/shampoo-v162/test/`): cohort of 9 Track A products not touched by v1.6.1 (mechanical screen, rollout `tmp/review/screen.py`): G03 Sebamed Every-Day (expected move), A43 Sante Sensitive Care, A24 ISANA Sensitiv, A21 ISANA MED Totes Meer (sulfate-base controls, no move), A05 Balea Ultra Sensitive, A03 Balea Kopfhaut Sensitive, A40 Salthouse Anti Juckreiz (existing passes, no move; A40 records Laureth-9 as Polidocanol), G01 Guhl Anti Schuppen, A06 Balea Med Anti Schuppen (dandruff-path combination controls, no move). Baseline: Track A run-1 lane records (v1.6). Two sealed Opus lanes, two-stage kit with `--standard`. Pass: only pre-registered moves, agreement ≥ v1.6 bars.
3. **Compare + adjudication** by Nick (cause-coded, no tuning).
4. **Lock**: `docs/research/shampoo-inci/v1.6.2/`, `data/research/shampoo-inci/v1.6.2/` (receipt, manifest, evidence, test round, rulings snapshot), CI pin test `tests/shampoo-research-v1-6-2-lock.test.ts`, lane-kit default standard → v1.6.2.
5. **Review + ship**: relevant checks, one Codex whole-branch review, `/ship`; merge on Nick's "merge it". No production writes.

Downstream (rollout worktree): Track A re-check of all 73 products + 3 corrected packets (Hask 473 ml, Garnier Honig, Neqi Moisture re-pin) on locked v1.6.2; only changes vs the approved review go back to Nick.
