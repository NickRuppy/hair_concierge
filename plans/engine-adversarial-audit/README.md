# Engine adversarial audit — 2026-10-09

Five Opus auditors, one per engine group, each with a self-contained brief: inventory every rule with a testable consequence from the normative docs and dated rulings, run the real production functions against adversarial profiles/products, pin every contradiction as a **failing** rule-ID test, and park ambiguities under "needs ruling" instead of deciding. No edits under `src/`, `docs/`, `data/`, `supabase/`, or existing tests. Nothing fixed.

Run everything:

```
node --import ./tests/server-only-register.cjs --import tsx --test tests/audit-*-rules.test.ts
# tests 107 · pass 47 (verified rules) · fail 60 (contradictions, intended)
```

Orchestrator verification (2026-10-10): every file re-run individually, counts match the auditors' hand-backs; `tsc --noEmit` reports nothing for the five files.

| Lane | Report | Test file | Rules | Hold | Contradicted (tests) | Needs ruling | Untestable |
|---|---|---|---|---|---|---|---|
| Shampoo (Production Light v1 + v1.6 rulings) | [shampoo.md](./shampoo.md) | `tests/audit-shampoo-rules.test.ts` | 35 | 17 | 9 (11 red) | 6 | 3 |
| Conditioner v1.6 + Mask v1.0 adapters | [conditioner-mask.md](./conditioner-mask.md) | `tests/audit-conditioner-mask-rules.test.ts` | 50 | 16 | 20 (20 red) | 7 | 7 |
| Bondbuilder + Leave-in + Oil | [bondbuilder-leavein-oil.md](./bondbuilder-leavein-oil.md) | `tests/audit-bondbuilder-leavein-oil-rules.test.ts` | 48 | 33 | 10 (10 red) | 7 | 2 |
| Selection + routine planner + Stage-3 budget | [selection-planner.md](./selection-planner.md) | `tests/audit-selection-planner-rules.test.ts` | 31 | 18 | 10 (10 red) + 7 observed, unpinned | 8 groups | Stage-3 gateway end-to-end, chat eval |
| Quiz → profile derivation | [quiz-profile.md](./quiz-profile.md) | `tests/audit-quiz-profile-rules.test.ts` | 25 | 15 | 9 (9 red) | 8 | prod lead data |

## P0 contradictions (wrong product or wrong eligibility for a real-looking user)

1. **Shampoo:** dandruff + irritated scalp is never steered to a gentle anti-dandruff shampoo; the dandruff role targets regular strength and only accepts top-scoring products, so the gentle one is dropped (`shampoo-spec-target.ts:15-16`, `constants.ts:35`, authority `shampoo.ts:200`). Breaks `decision.md` fixture 4.
2. **Shampoo:** the research-to-DB adapter emits dandruff rows for formulas with no recognised anti-dandruff active (trusts `dandruffSupport` instead of checking INCI for Piroctone Olamine / Climbazole per the v1.4 standard) (`production-light-adapter.ts:355-372`).
3. **Mask:** a "Bond Repair" mask with no bond route still projects repair support "high"; the bond route is never read (`mask-research/production-adapter.ts:700`). Latent until the mask adapter is wired into intake.
4. **Conditioner + Mask:** `suitable_thicknesses` is copied verbatim instead of following the weight rule, so a rich product listing "fine" becomes fine-hair eligible and a moderate one drops fine-haired users (`conditioner production-adapter.ts:422`, mask `:737`). Conditioner path is live in Stage 3. Needs NR-2 ruling on whether adapters must enforce derived rules.
5. **Conditioner:** repair high/medium and a protein/balanced care direction projected for formulas with no bond or protein ingredient.
6. **Oil:** the damp-Oil Basis step is demoted to optional whenever Leave-in becomes Basis for heat care, but the doc only allows that when the Basis Leave-in *requires* anti-frizz (`src/lib/personal-plan/portfolio.ts:33-46`).

## Rulings Nick needs to make (consolidated; details and examples in each report)

- **Single scalp condition** (quiz NR1, shampoo): profile and plan keep every scalp concern; recommendation engine and scanner collapse to one by priority. Decide whether the collapse is acceptable or the engines must consume the full set.
- **Thickness fit: hard exclusion or amber?** (conditioner/mask NR-1, shampoo R2–R4 vs production-light doc).
- **Must adapters enforce derived/cross-field rules or only project the reviewed envelope?** (conditioner/mask NR-2) — decides whether findings 3–5 above are adapter bugs or review-process gaps.
- **Budget rulings R1–R4** (selection): manual over-budget picks vs the exception allowance; exception when the affordable product is already ideal; which candidate becomes the exception; flexible scanner/chat showing over-budget items only with evidenced improvement.
- **Does the legacy chat planner have to follow the Personal Plan category docs?** (selection R5, leave-in NR-L4, shampoo "older engine" item) — nine executed divergences stay unpinned until ruled.
- **Dry-scalp wash frequency:** `decision.md` 1×/week vs Nomi T4 ruling 2×/week for straight/wavy.
- **Stale docs superseded by later rulings** (bondbuilder NR-B1, leave-in NR-L2, selection R6): decide whether to update the docs or keep the rulings as the record.
- **Legacy quiz data** (quiz NR4, February "Trocken / Schuppen" and dropped goal values): reach depends on prod lead data.

## Known gaps

- Chat-side product selection (`recommendation-engine/selection.ts` vs category docs) was only partially audited (selection lane child did not hand back in time); seven more Stage-1 contradictions were observed by a research child but not pinned.
- Anything needing production data (coverage invariants, legacy lead reach) or a local Postgres (bondbuilder SQL publication guards) is listed per report as untestable.
- Existing repo fixtures in two adapter tests pair moderate weight with a thickness fit that excludes fine and assert that as correct; they will need to change together with any fix.
