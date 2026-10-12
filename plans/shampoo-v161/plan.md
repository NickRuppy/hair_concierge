# Shampoo classification v1.6.1 — plan

Status: approved by Nick 2026-10-12 ("yes to A, do v1.6.1 in its own worktree"). Worktree `.worktrees/shampoo-v161`, branch `codex/shampoo-v161`, base `3ade3b2d` (= origin/main at creation).

Origin: profi-shampoos wave (`.worktrees/profi-shampoos`, `plans/profi-shampoos/classification/`): selenium-sulfide evidence, contradiction audit, weight-method comparison, surfactant-class evidence. The v1.6 lock rules say a rule change is a new version with its own calibration and lock receipt; v1.6 stays frozen and pinned.

## Scope (Nick's rulings)

| # | Change | Source | Ruling |
|---|---|---|---|
| S1 | `Selenium Sulfide` / `Selenium Disulfide` joins the Section 11 recognized anti-dandruff actives (EU cosmetic ≤1%, incl. micronized 0.6%). | `evidence-selenium-sulfide-2026-10-11.md` | 2026-10-11/12 (B, C) |
| S2 | W-LINE: a concentration line for weight. "Material" for W-RICH, W1(c) and the `high` convergence route = listed before the earliest *plausible* marker (capped preservative/active, Parfum or declared allergen, typical sub-1% actives, alphabetical tail); plausibility test; never later than E3; fallback = v1.6 reading. C2 and Section 5 keep E3 (Option B out of scope). | `weight-method-comparison-2026-10-12.md` (leave-in/mask precedent) | 2026-10-12 (A, 1) |
| S3 | Oily-scalp lexicon: "fettiges Haar" counts like "schnell fettendes Haar". | contradiction audit (Aveda) | 2026-10-12 (2) |
| S4 | C3 class rows: Sodium Methyl 2-Sulfolaurate / Disodium 2-Sulfolaurate = mild anionic; Sulfated Castor Oil = not a cleansing route; Cocamidopropylamine Oxide = amphoteric buffer; Sodium Laureth-8 Sulfate = strong anionic with high-EO counter-signal. | `evidence-surfactant-classes-2026-10-12.md` | 2026-10-12 (4) |

Out of scope: lipid banding (v1.7 candidate), W-line for C2 (Option B), the R16.4 closed-list batch (E4/C2/CSA additions) — that batch needs the Track A/B `unlisted_route_candidate` collection, which has not run yet (to be confirmed with Nick: separate later step v1.6.2 instead of bundling).

## Phases

1. **Candidate** (`plans/shampoo-v161/candidate/`): v1.6 text + S1–S4, changelog rows from 116, open questions. Opus drafts, main session reviews line by line. Every rule change fails toward the cautious value where uncertain (P0).
2. **Pre-registration + test kit** (`plans/shampoo-v161/test/`): pre-register expected outcomes before any lane runs. Cohort: the 16 weight products of the comparison doc (incl. P02, P32 and the gold/unseen W-RICH citers) + S1/S3/S4-affected products (Vichy Dercos Anti-Schuppen, Davines Purifying, Aveda Rosemary Mint, Color Wow HOOKED, KMS HeadRemedy, GLYNT DERMA, System Professional P1/P4). Packets reused from v1.6 calibration and the profi freeze (fingerprints unchanged). Two sealed Opus lanes with the two-stage kit (kit builder needs a `--standard` option for the candidate text). Pass: only the pre-registered moves happen, no unexplained movement, ≥ v1.6 agreement bars.
3. **Compare + adjudication** by Nick (cause-coded, no tuning).
4. **Lock**: `docs/research/shampoo-inci/v1.6.1/` (standard, rule-changes, README, runbook delta), `data/research/shampoo-inci/v1.6.1/` (receipt, manifest, test evidence, rulings snapshot), CI pin test `tests/shampoo-research-v1-6-1-lock.test.ts`, parked-validator re-scope, README index.
5. **Review + ship**: ci:verify (relevant), one Codex whole-branch review, `/ship`; merge on Nick's "merge it". No production writes in this branch.

Downstream (not in this branch): Production Light re-pin to v1.6.1 and the app weight/three-tier PR (rollout session); re-projection of the affected profi and Track A products.
